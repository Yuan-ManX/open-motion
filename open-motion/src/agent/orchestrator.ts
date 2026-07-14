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
    let lastComponentId: string | undefined;
    const failedTools: string[] = [];
    for (const call of toolCalls) {
      // Link this tool call to its corresponding goal so progress is visible.
      const activeGoalId = goalTree ? startToolGoal(goalTree, call.tool) : null;
      if (goalTree && activeGoalId) {
        onEvent({ type: "goal", root: serializeGoal(goalTree) });
      }
      onEvent({ type: "tool_call", tool: call.tool, args: call.args, callId: call.callId });
      const result = await executeTool(call.tool, call.args, { projectId });
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
 */
function reflectOnFailures(
  failedTools: string[],
  _allCalls: LlmToolCall[],
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
  ];

  for (const p of patterns) {
    if (p.test.test(summary)) {
      return { text: p.text, suggestion: p.suggestion };
    }
  }

  return {
    text: `${failedTools.length} tool(s) failed: ${failedTools.join(", ")}. Last error: "${summary}".`,
    suggestion: "Call get_motion_spec to inspect the current state and adjust the approach.",
  };
}

/**
 * Lightweight preference extraction — detects user style preferences from
 * natural language and persists them as project memory for future sessions.
 * Rule-based so it works in mock mode without an LLM.
 */
function autoExtractMemory(projectId: string, message: string): void {
  const lower = message.toLowerCase();

  // Detect style preferences
  const stylePrefs: Record<string, string> = {
    "professional": "prefers professional tone",
    "playful": "prefers playful tone",
    "minimal": "prefers minimal aesthetic",
    "dramatic": "prefers dramatic motion",
    "calm": "prefers calm/soft motion",
    "energetic": "prefers energetic motion",
    "bouncy": "prefers bouncy/spring physics",
    "smooth": "prefers smooth easing",
    "snappy": "prefers snappy/crisp timing",
  };
  for (const [keyword, pref] of Object.entries(stylePrefs)) {
    if (lower.includes(keyword)) {
      remember(projectId, "style-preference", pref, ["preference", "style"], 0.8);
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
}
