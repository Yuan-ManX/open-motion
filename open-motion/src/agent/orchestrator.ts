import type { ChatEvent } from "@openmotion/shared";
import type { ChatOptions, ChatResult, LlmProvider, LlmToolCall } from "./provider/types.js";
import { OpenAIProviderError } from "./provider/openai.js";
import { assembleAgentContext } from "./context.js";
import { buildToolSpecs } from "./tools/schema.js";
import { executeTool, type ToolResult } from "./tools/registry.js";
import { addMemory, listMemory, restoreMemory, compressMemory } from "./memory/store.js";
import { buildPlan } from "./planner.js";
import { think } from "./reasoning.js";
import {
  decomposeGoal,
  startToolGoal,
  completeToolGoal,
  serializeGoal,
  type GoalTree,
} from "./goals.js";
import { addMessage } from "../db/repositories/messages.js";
import { getProjectSpec } from "../db/repositories/projects.js";
import { remember } from "./memory/persistentMemory.js";
import { extractSkill } from "./memory/skillGenerator.js";
import { suggestProactive } from "./proactiveEngine.js";
import { recordToolExecution, isToolUnreliable } from "./analytics.js";
import { generateSessionSummary } from "./sessionSummary.js";
import { composeTools, composedToToolCalls } from "./toolComposer.js";
import { logger } from "../utils/logger.js";

const MAX_ITERATIONS = 8;

export interface OrchestrateOptions {
  projectId: string;
  userMessage: string;
  provider: LlmProvider;
  onEvent: (event: ChatEvent) => void;
}

/**
 * Classify whether a provider error is worth retrying.
 * - 429 (rate limited): retryable, with backoff respecting retry-after hint
 * - 5xx (server errors): retryable
 * - 401/403 (auth/permission): never retry — the key is wrong
 * - Network errors (fetch failed, timeouts): retryable
 */
function classifyError(err: unknown): { retryable: boolean; retryAfterMs?: number } {
  if (err instanceof OpenAIProviderError) {
    if (err.status === 429) {
      return { retryable: true, retryAfterMs: err.retryAfter ? err.retryAfter * 1000 : undefined };
    }
    if (err.status >= 500) return { retryable: true };
    return { retryable: false };
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/.test(msg)) {
    return { retryable: true };
  }
  return { retryable: false };
}

/**
 * Wrap provider.chat with bounded retry + exponential backoff. Only network-class
 * errors and 429/5xx retry; auth errors surface immediately. Backoff: 500ms → 1000ms,
 * or the server's retry-after hint when available.
 */
async function chatWithRetry(
  provider: LlmProvider,
  options: ChatOptions,
  retries = 2,
): Promise<ChatResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await provider.chat(options);
    } catch (err) {
      lastErr = err;
      const { retryable, retryAfterMs } = classifyError(err);
      if (!retryable || attempt === retries) throw err;
      const backoff = retryAfterMs ?? 500 * Math.pow(2, attempt);
      logger.warn("provider.chat retryable error, backing off", { attempt, backoff, message: err instanceof Error ? err.message : String(err) });
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

/**
 * The conversation heart: prompt the provider, execute any tool calls, feed
 * results back, and repeat until the provider returns a plain reply. Each
 * spec-mutating tool batch emits a spec_update so the live canvas refreshes.
 */
export async function orchestrate(opts: OrchestrateOptions): Promise<void> {
  const { projectId, userMessage, provider, onEvent } = opts;

  // Rehydrate conversation window from DB on the first turn of a fresh session
  // so the agent keeps context across server restarts.
  if (listMemory(projectId).length === 0) {
    restoreMemory(projectId);
  }

  addMemory(projectId, { role: "user", content: userMessage });
  addMessage(projectId, { role: "user", content: userMessage });

  // Compress the conversation window when it grows beyond the threshold.
  compressMemory(projectId);

  // Auto-extract persistent facts from the user message (preference detection)
  autoExtractMemory(projectId, userMessage);

  // Emit a lightweight plan so the user sees the agent's intended steps before
  // tool execution begins. Rule-based so it works in mock mode without an LLM.
  const initialSpec = getProjectSpec(projectId);
  let goalTree: GoalTree | null = null;
  if (initialSpec) {
    // Structured thinking trace: analyze the request, evaluate constraints,
    // consider options, and commit to an approach — all before planning.
    const trace = think(userMessage, initialSpec);
    onEvent({
      type: "thinking",
      text: trace.text,
      analysis: trace.analysis,
      constraints: trace.constraints,
      options: trace.options,
      chosenApproach: trace.chosenApproach,
    });

    const plan = buildPlan(userMessage, initialSpec);
    onEvent({ type: "plan", steps: plan.steps, summary: plan.summary });

    // Decompose the plan into a goal tree so the user can see intent phases
    // and live progress as each tool call advances a goal.
    goalTree = decomposeGoal(userMessage, plan.steps);
    onEvent({ type: "goal", root: serializeGoal(goalTree) });
  }

  const tools = buildToolSpecs();
  const allToolCalls: LlmToolCall[] = [];
  const allToolResults: ToolResult[] = [];
  const componentCountBefore = initialSpec?.components.length ?? 0;

  // Tool composition pre-pass: if the user's message matches a known
  // compound pattern (e.g., "add a bouncy fade with 200ms delay"),
  // synthesize the tool calls directly without an LLM round-trip.
  if (initialSpec) {
    const composition = composeTools(userMessage, projectId, initialSpec.components.length > 0);
    if (composition.matched) {
      logger.info("tool composition matched", { pattern: composition.patternName, tools: composition.tools.length });
      onEvent({
        type: "reasoning",
        text: `Composed ${composition.tools.length} tool calls via pattern: ${composition.patternName}`,
      });

      // Execute the composed tools sequentially, resolving __last__ placeholder
      const composedCalls = composedToToolCalls(composition.tools);
      let composedSpecChanged = false;
      for (let i = 0; i < composedCalls.length; i++) {
        const call = composedCalls[i];
        // Resolve __last__ to the most recently created component
        const args = call.args as Record<string, unknown>;
        if (args && typeof args === "object" && args.componentId === "__last__") {
          const freshSpec = getProjectSpec(projectId);
          const lastComponent = freshSpec?.components[freshSpec.components.length - 1];
          if (lastComponent) {
            call.args = { ...args, componentId: lastComponent.id };
          } else {
            // Skip this tool if no component exists yet
            continue;
          }
        }

        onEvent({ type: "tool_call", tool: call.tool, args: call.args, callId: call.callId });
        const toolStart = Date.now();
        const result = await executeTool(call.tool, call.args, { projectId });
        const toolDurationMs = Date.now() - toolStart;
        recordToolExecution(projectId, call.tool, result.ok, toolDurationMs);
        if (isToolUnreliable(projectId, call.tool)) {
          logger.warn("composed tool is unreliable", { tool: call.tool });
        }
        allToolCalls.push(call);
        allToolResults.push(result);
        if (result.specChanged) composedSpecChanged = true;

        if (goalTree) {
          const gid = startToolGoal(goalTree, call.tool);
          if (gid) onEvent({ type: "goal", root: serializeGoal(goalTree) });
          onEvent({
            type: "tool_result",
            callId: call.callId,
            tool: call.tool,
            result: result.data ?? null,
            summary: result.summary,
          });
          if (result.ok && gid) {
            completeToolGoal(goalTree, gid);
            onEvent({ type: "goal", root: serializeGoal(goalTree) });
          }
        } else {
          onEvent({
            type: "tool_result",
            callId: call.callId,
            tool: call.tool,
            result: result.data ?? null,
            summary: result.summary,
          });
        }
      }

      // Emit spec_update so the frontend canvas refreshes after composed tools.
      if (composedSpecChanged) {
        const fresh = getProjectSpec(projectId);
        if (fresh) onEvent({ type: "spec_update", components: fresh.components, project: fresh.project });
      }

      // Generate session summary for the composed execution
      const freshSpec = getProjectSpec(projectId);
      const componentCountAfter = freshSpec?.components.length ?? componentCountBefore;
      const summaryText = composition.tools.map((t: { reason: string }) => t.reason).join("; ");
      addMemory(projectId, { role: "assistant", content: summaryText });
      addMessage(projectId, { role: "assistant", content: summaryText });

      if (allToolCalls.length > 0) {
        const summary = generateSessionSummary({
          userMessage,
          toolCalls: allToolCalls,
          toolResults: allToolResults,
          goalTree,
          componentCountBefore,
          componentCountAfter,
        });
        onEvent({ type: "session_summary", summary });
      }

      onEvent({ type: "done", message: summaryText, tokensIn: 0, tokensOut: 0 });
      return;
    }
  }

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    // Pass userMessage on first iteration so persistent memory can be retrieved
    const ctx = assembleAgentContext(projectId, iter === 0 ? userMessage : undefined);
    if (!ctx) {
      onEvent({ type: "error", message: "project not found", recoverable: false });
      return;
    }

    let assistantText = "";
    let toolCalls: LlmToolCall[] = [];
    let tokensIn = 0;
    let tokensOut = 0;

    try {
      const result = await chatWithRetry(provider, {
        messages: ctx.messages,
        tools,
        onToken: (delta) => {
          assistantText += delta;
          onEvent({ type: "token", delta });
        },
      });
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      assistantText = result.text || assistantText;
      toolCalls = result.toolCalls;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("provider.chat failed", { message });
      const recoverable = err instanceof OpenAIProviderError
        ? err.status === 429 || err.status >= 500
        : true;
      onEvent({ type: "error", message: recoverable ? `model error: ${message}` : message, recoverable });
      return;
    }

    if (toolCalls.length === 0) {
      addMemory(projectId, { role: "assistant", content: assistantText });
      addMessage(projectId, { role: "assistant", content: assistantText, tokensIn, tokensOut });
      // Self-learning: generate a skill from the completed multi-step sequence
      if (allToolCalls.length >= 2) {
        const skill = extractSkill(userMessage, allToolCalls, allToolResults, projectId);
        if (skill) {
          logger.info("generated skill from task", { skillId: skill.id, skillName: skill.name });
        }
      }
      // Generate a session summary when tools were executed, so the user
      // gets a recap of what was accomplished and what to do next.
      if (allToolCalls.length > 0) {
        const freshSpec = getProjectSpec(projectId);
        const componentCountAfter = freshSpec?.components.length ?? componentCountBefore;
        const summary = generateSessionSummary({
          userMessage,
          toolCalls: allToolCalls,
          toolResults: allToolResults,
          goalTree,
          componentCountBefore,
          componentCountAfter,
        });
        onEvent({ type: "session_summary", summary });
      }
      onEvent({ type: "done", message: assistantText, tokensIn, tokensOut });
      return;
    }

    // Assistant issued tool calls; record the turn (memory + persisted log) and execute them.
    // Emit any reasoning text the assistant produced before the tool calls.
    if (assistantText.trim()) {
      onEvent({ type: "reasoning", text: assistantText.trim() });
    }
    addMemory(projectId, { role: "assistant", content: assistantText, toolCalls });
    addMessage(projectId, {
      role: "assistant",
      content: assistantText,
      tokensIn,
      tokensOut,
      toolCallsJson: JSON.stringify(toolCalls),
    });

    let anySpecChanged = false;
    let lastSpecTool: string | null = null;
    let lastSuccessfulTool: string | null = null;
    let lastComponentId: string | undefined;
    const failedTools: string[] = [];
    for (const call of toolCalls) {
      // Resolve __last__ placeholder to the most recently created component.
      // This lets providers chain create + property-tuning calls (e.g.,
      // set_template followed by set_color targeting the new component).
      const callArgs = call.args as Record<string, unknown> | null;
      if (callArgs && typeof callArgs === "object" && callArgs.componentId === "__last__") {
        const freshSpec = getProjectSpec(projectId);
        const lastComponent = freshSpec?.components[freshSpec.components.length - 1];
        if (lastComponent) {
          call.args = { ...callArgs, componentId: lastComponent.id };
        } else {
          // No component exists yet — skip this tool call gracefully.
          logger.warn("__last__ placeholder could not resolve — no component exists", { tool: call.tool });
          continue;
        }
      }
      // Link this tool call to its corresponding goal so progress is visible.
      const activeGoalId = goalTree ? startToolGoal(goalTree, call.tool) : null;
      if (goalTree && activeGoalId) {
        onEvent({ type: "goal", root: serializeGoal(goalTree) });
      }
      onEvent({ type: "tool_call", tool: call.tool, args: call.args, callId: call.callId });
      // Recovery heuristic: warn when a tool has been failing repeatedly
      if (isToolUnreliable(projectId, call.tool)) {
        logger.warn("tool is currently unreliable — recent failures detected", { tool: call.tool });
      }
      const toolStart = Date.now();
      const result = await executeTool(call.tool, call.args, { projectId });
      const toolDurationMs = Date.now() - toolStart;
      // Record analytics for observability and recovery heuristics
      recordToolExecution(projectId, call.tool, result.ok, toolDurationMs);
      allToolCalls.push(call);
      allToolResults.push(result);
      if (goalTree) {
        completeToolGoal(goalTree, activeGoalId);
        onEvent({ type: "goal", root: serializeGoal(goalTree) });
      }
      onEvent({
        type: "tool_result",
        callId: call.callId,
        tool: call.tool,
        result: result.data ?? null,
        summary: result.summary,
      });
      addMemory(projectId, {
        role: "tool",
        content: result.summary,
        toolCallId: call.callId,
        toolName: call.tool,
      });
      addMessage(projectId, {
        role: "tool",
        content: result.summary,
        toolCallId: call.callId,
        toolName: call.tool,
      });
      if (result.specChanged) {
        anySpecChanged = true;
        lastSpecTool = call.tool;
        const data = result.data as { componentId?: string } | null;
        if (data && typeof data.componentId === "string") {
          lastComponentId = data.componentId;
        }
      }
      // Track the last successful tool regardless of spec change so proactive
      // suggestions can fire for analysis, generation, and other non-mutating
      // tools (e.g., generate_image, analyze_principles, describe_motion).
      if (result.ok) {
        lastSuccessfulTool = call.tool;
      }
      if (!result.ok) failedTools.push(call.tool);
    }

    // Self-reflection: if any tools failed, analyze and suggest a correction
    // before the next iteration so the agent can adjust its approach.
    if (failedTools.length > 0) {
      const reflection = reflectOnFailures(failedTools, allToolCalls, allToolResults);
      onEvent({
        type: "reflection",
        text: reflection.text,
        failedTools,
        suggestion: reflection.suggestion,
      });
      // Inject the reflection into conversation memory so the provider sees it
      addMemory(projectId, {
        role: "system",
        content: `Self-reflection: ${reflection.text} Suggested action: ${reflection.suggestion}`,
      });
    }

    if (anySpecChanged) {
      const fresh = getProjectSpec(projectId);
      if (fresh) onEvent({ type: "spec_update", components: fresh.components, project: fresh.project });
      // Proactive suggestions: surface 0-3 contextual next-step prompts tied
      // to the just-completed tool and the fresh spec state. Hidden by the UI
      // when empty, so callers see it only when there's something worth saying.
      if (fresh) {
        const suggestions = suggestProactive({
          spec: fresh,
          lastTool: lastSpecTool,
          lastToolOk: failedTools.length === 0 || (lastSpecTool !== null && !failedTools.includes(lastSpecTool)),
          lastComponentId,
        });
        if (suggestions.length > 0) {
          onEvent({ type: "proactive_suggestion", suggestions });
        }
      }
    } else if (lastSuccessfulTool) {
      // Non-spec-changing tools (analysis, generation, documentation) still
      // benefit from proactive follow-up suggestions. Emit them against the
      // current spec so the user gets a contextual next step.
      const fresh = getProjectSpec(projectId);
      if (fresh) {
        const suggestions = suggestProactive({
          spec: fresh,
          lastTool: lastSuccessfulTool,
          lastToolOk: !failedTools.includes(lastSuccessfulTool),
          lastComponentId,
        });
        if (suggestions.length > 0) {
          onEvent({ type: "proactive_suggestion", suggestions });
        }
      }
    }
    // Loop back: re-assemble context (system prompt now reflects the new spec).
  }

  onEvent({
    type: "error",
    message: "agent exceeded its tool-call budget without a final reply",
    recoverable: true,
  });
}

/**
 * Self-reflection engine — analyzes failed tool calls and produces a
 * correction suggestion. Rule-based so it works in mock mode.
 *
 * The reflection layer does three things:
 *   1. Pattern-matches the error summary against known failure shapes and
 *      emits a targeted recovery suggestion.
 *   2. Inspects which tool failed and emits a tool-specific hint (e.g., if
 *      set_easing failed, list the valid easing preset names).
 *   3. Detects retry loops — when the same tool has failed twice in the
 *      session, it suggests switching to an alternative approach instead of
 *      retrying the same call.
 */
function reflectOnFailures(
  failedTools: string[],
  allCalls: LlmToolCall[],
  allResults: ToolResult[],
): { text: string; suggestion: string } {
  const lastFailed = allResults.filter((r) => !r.ok).slice(-1)[0];
  const summary = lastFailed?.summary ?? "unknown error";

  // Common failure patterns and corrections
  const patterns: Array<{ test: RegExp; text: string; suggestion: string }> = [
    {
      test: /not found|does not exist/i,
      text: `Tool failed: "${summary}". The referenced entity was not found.`,
      suggestion: "Call get_motion_spec to list valid component IDs, then retry with a valid ID.",
    },
    {
      test: /validation|invalid|must be|expected/i,
      text: `Tool failed: "${summary}". The arguments did not pass validation.`,
      suggestion: "Check the argument types and ranges, then retry with corrected values.",
    },
    {
      test: /already exists|duplicate/i,
      text: `Tool failed: "${summary}". A conflicting entity already exists.`,
      suggestion: "Use get_motion_spec to inspect the current state, then modify the existing entity instead of creating a new one.",
    },
    {
      test: /parse error|grammar/i,
      text: `Tool failed: "${summary}". The input could not be parsed.`,
      suggestion: "Try a simpler expression or check the grammar syntax (e.g., fade.in(600ms) then slide.up(400ms)).",
    },
    {
      test: /timeout|timed out/i,
      text: `Tool failed: "${summary}". The operation timed out.`,
      suggestion: "Retry the operation — if it continues to time out, simplify the request or reduce the scope.",
    },
    {
      test: /permission|forbidden|unauthorized/i,
      text: `Tool failed: "${summary}". Permission denied.`,
      suggestion: "Check that the API key has the required permissions, then retry.",
    },
    {
      test: /rate limit|too many requests|429/i,
      text: `Tool failed: "${summary}". Rate limit exceeded.`,
      suggestion: "Wait a moment before retrying — the provider is throttling requests.",
    },
    {
      test: /unsupported|not supported/i,
      text: `Tool failed: "${summary}". The feature is not supported.`,
      suggestion: "Use an alternative approach — check available tools with list_templates or get_motion_spec.",
    },
    {
      test: /out of range|below minimum|above maximum|exceeds/i,
      text: `Tool failed: "${summary}". A numeric argument was out of the allowed range.`,
      suggestion: "Check the allowed ranges in the tool schema and retry with a value inside the bounds.",
    },
    {
      test: /circular|cycle|self.?parent/i,
      text: `Tool failed: "${summary}". A circular reference was detected.`,
      suggestion: "Avoid nesting a component under its own descendant — restructure the hierarchy first.",
    },
    {
      test: /empty|no components|nothing to/i,
      text: `Tool failed: "${summary}". The project has no components to operate on.`,
      suggestion: "Add a layer with add_layer or apply a template with set_template before retrying.",
    },
    {
      test: /missing.*argument|required.*field|argument.*missing/i,
      text: `Tool failed: "${summary}". A required argument was missing.`,
      suggestion: "Re-issue the call with all required fields populated — check the tool schema for details.",
    },
  ];

  for (const p of patterns) {
    if (p.test.test(summary)) {
      return { text: p.text, suggestion: p.suggestion };
    }
  }

  // Tool-specific recovery hints: when a known tool fails, suggest the
  // canonical recovery action for that tool family.
  const failedTool = failedTools[failedTools.length - 1];
  const toolHint = toolSpecificHint(failedTool);
  if (toolHint) {
    return {
      text: `${failedTools.length} tool(s) failed: ${failedTools.join(", ")}. Last error: "${summary}".`,
      suggestion: toolHint,
    };
  }

  // Retry-loop detection: if the same tool has failed 2+ times in this
  // session, recommend switching to an alternative approach instead of
  // retrying the same call.
  const failCounts = new Map<string, number>();
  for (const t of failedTools) failCounts.set(t, (failCounts.get(t) ?? 0) + 1);
  const repeated = [...failCounts.entries()].find(([, n]) => n >= 2);
  if (repeated) {
    return {
      text: `${repeated[0]} has failed ${repeated[1]} times this session — retrying is unlikely to succeed.`,
      suggestion: `Switch to an alternative approach for ${repeated[0]}. Consider get_motion_spec to re-ground, or ask the user for clarification.`,
    };
  }

  return {
    text: `${failedTools.length} tool(s) failed: ${failedTools.join(", ")}. Last error: "${summary}".`,
    suggestion: "Call get_motion_spec to inspect the current state and adjust the approach.",
  };
}

/**
 * Tool-specific recovery hints. When a tool fails, the canonical recovery
 * action varies by tool family — this map gives the agent a targeted next
 * step instead of a generic "inspect state" suggestion.
 */
function toolSpecificHint(tool: string): string | null {
  const hints: Record<string, string> = {
    set_easing: "Valid easing presets: linear, ease, ease-in, ease-out, ease-in-out, ease-in-quad, ease-out-quad, ease-in-out-quad, ease-in-cubic, ease-out-cubic, ease-in-out-cubic, bounce, back, elastic, snappy, smooth, soft. Or use set_spring / set_custom_bezier for custom curves.",
    set_template: "Call list_templates to see available template IDs, then retry with a valid ID.",
    apply_preset: "Valid presets: shake, wiggle, float, glow, heartbeat, typewriter. Check the spelling and retry.",
    apply_style: "Valid style presets: playful, energetic, calm, professional, dramatic, minimal, cinematic, glassy, retro, futuristic, organic, mechanical, luxury.",
    apply_recipe: "Call the recipes endpoint to list available recipe IDs, then retry with a valid ID.",
    apply_choreography: "Valid choreography patterns: cascade, wave, ripple, canon, converge, spiral, explosion, assembly, breathing, domino, scatter.",
    set_shader_effect: "Call the shaders endpoint to list available shader effect IDs, then retry with a valid ID.",
    apply_brand_pack: "Call list_brand_packs to see available brand pack IDs, or seed_brand_packs to create defaults first.",
    apply_motion_profile: "Call list_motion_profiles to see available profile IDs, or suggest_motion_profile to generate one.",
    apply_motion_capture: "Call list_motion_captures to see available capture IDs, or seed_motion_captures to create defaults first.",
    capture_state: "Ensure at least one component exists before capturing a state.",
    apply_state: "Call list_states to see captured state IDs, then retry with a valid ID.",
    add_transition: "Both source and target states must exist before adding a transition — call list_states to verify.",
    set_parent: "The parent component must exist and must not be a descendant of the child — check list_hierarchy for the current tree.",
    add_constraint: "Both components must exist before linking — call get_motion_spec to verify IDs.",
    restore_version: "Call list_versions to see available version IDs, then retry with a valid ID.",
    run_pipeline: "Call list_pipelines to see available pipeline IDs, then retry with a valid ID.",
    compile_grammar: "Check the grammar syntax — valid verbs include fade, slide, scale, rotate, spin. Use 'then' to sequence.",
    parse_motion: "Ensure the grammar expression is compiled first with compile_grammar.",
    synthesize_code: "Specify a valid format: html, css, or react.",
  };
  return hints[tool] ?? null;
}

/**
 * Lightweight preference extraction — detects user style preferences from
 * natural language and persists them as project memory for future sessions.
 * Rule-based so it works in mock mode without an LLM.
 */
function autoExtractMemory(projectId: string, message: string): void {
  const lower = message.toLowerCase();

  // Detect style preferences — covers all 13 style presets
  const stylePrefs: Record<string, string> = {
    "professional": "prefers professional tone",
    "playful": "prefers playful tone",
    "minimal": "prefers minimal aesthetic",
    "dramatic": "prefers dramatic motion",
    "calm": "prefers calm/soft motion",
    "energetic": "prefers energetic motion",
    "cinematic": "prefers cinematic motion",
    "glassy": "prefers glassy aesthetic",
    "retro": "prefers retro aesthetic",
    "futuristic": "prefers futuristic aesthetic",
    "organic": "prefers organic motion",
    "mechanical": "prefers mechanical motion",
    "luxury": "prefers luxury aesthetic",
    "bouncy": "prefers bouncy/spring physics",
    "smooth": "prefers smooth easing",
    "snappy": "prefers snappy/crisp timing",
  };
  for (const [keyword, pref] of Object.entries(stylePrefs)) {
    if (lower.includes(keyword)) {
      remember(projectId, "style-preference", pref, ["preference", "style"], 0.8);
    }
  }

  // Detect easing preferences
  const easingPrefs: Record<string, string> = {
    "elastic": "prefers elastic easing",
    "soft": "prefers soft easing",
    "back": "prefers back/overshoot easing",
    "ease-in": "prefers ease-in acceleration",
    "ease-out": "prefers ease-out deceleration",
  };
  for (const [keyword, pref] of Object.entries(easingPrefs)) {
    if (lower.includes(keyword)) {
      remember(projectId, "easing-preference", pref, ["preference", "easing"], 0.7);
    }
  }

  // Detect duration preferences
  if (lower.includes("slow") || lower.includes("longer")) {
    remember(projectId, "duration-preference", "prefers longer durations", ["preference", "timing"], 0.6);
  }
  if (lower.includes("fast") || lower.includes("quick") || lower.includes("short")) {
    remember(projectId, "duration-preference", "prefers shorter durations", ["preference", "timing"], 0.6);
  }

  // Detect loop preferences
  if (lower.includes("loop") || lower.includes("repeat") || lower.includes("infinite")) {
    remember(projectId, "loop-preference", "comfortable with looping animations", ["preference", "loop"], 0.5);
  }

  // Detect direction preferences
  if (lower.includes("reverse") || lower.includes("backward")) {
    remember(projectId, "direction-preference", "prefers reverse playback", ["preference", "direction"], 0.5);
  }
  if (lower.includes("alternate")) {
    remember(projectId, "direction-preference", "prefers alternate direction", ["preference", "direction"], 0.5);
  }

  // Detect choreography preferences
  const choreoPrefs: Record<string, string> = {
    "cascade": "prefers cascade choreography",
    "wave": "prefers wave choreography",
    "ripple": "prefers ripple choreography",
    "spiral": "prefers spiral choreography",
    "domino": "prefers domino choreography",
  };
  for (const [keyword, pref] of Object.entries(choreoPrefs)) {
    if (lower.includes(keyword)) {
      remember(projectId, "choreography-preference", pref, ["preference", "choreography"], 0.6);
    }
  }

  // Detect export format preferences
  const exportPrefs: Record<string, string> = {
    "export html": "prefers HTML export",
    "export video": "prefers video export",
    "export react": "prefers React export",
    "export lottie": "prefers Lottie export",
    "export code": "prefers code export",
  };
  for (const [keyword, pref] of Object.entries(exportPrefs)) {
    if (lower.includes(keyword)) {
      remember(projectId, "export-preference", pref, ["preference", "export"], 0.7);
    }
  }
}
