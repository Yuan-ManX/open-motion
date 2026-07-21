import type { ChatEvent } from "@openmotion/shared";
import type { ChatOptions, ChatResult, LlmProvider, LlmToolCall } from "./provider/types.js";
import { OpenAIProviderError } from "./provider/openai.js";
import { assembleAgentContext } from "./context.js";
import { buildToolSpecs } from "./tools/schema.js";
import { executeTool, type ToolContext, type ToolResult } from "./tools/registry.js";
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
import { capture, isSpecMutating } from "./checkpointManager.js";
import { runPreHooks, runPostHooks } from "./pluginHooks.js";
import {
  createParentBudget,
  consume,
  mayExtendForConsolidation,
  describeBudget,
  type IterationBudget,
} from "./iterationBudget.js";
import {
  shouldUsePlanMode,
  composeStructuredPlan,
  initPlanExecution,
  completeAction,
  failAction,
  planProgress,
  isPlanFinished,
  type PlanExecutionState,
  type StructuredPlan,
  type PlanAction,
} from "./planExecutor.js";
import { setPlanState, clearPlanState } from "./tools/agentTools.js";
import {
  shouldDelegate,
  composeSubagentTasks,
  runSubagentsParallel,
  type SubagentContext,
} from "./subagent.js";
import { routeNamespacedExternalCall, describeExternalToolsForOrchestrator } from "./mcpClient.js";
import {
  generateVariations,
  extractDNA,
  transferStyle,
  formatVariationSummary,
  formatDNAReport,
  formatStyleTransferReport,
} from "./motionIntelligence.js";
import { critiqueMotion, formatCritiqueReport } from "./motionCritique.js";
import {
  generateStorySequence,
  formatStoryReport,
  detectNarrativeIntent,
  listNarrativeIntents,
  type NarrativeIntent,
} from "./motionStorytelling.js";
import {
  recordLineage,
  getLineage,
  getLineageTree,
  generateLineageReport,
  getProjectLineageSummary,
  formatLineageTree,
} from "./motionLineage.js";
import {
  synthesizeMotion,
  formatSynthesisReport,
  type SynthesisStrategy,
} from "./motionSynthesis.js";
import { logger } from "../utils/logger.js";

const MAX_ITERATIONS = 12;

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
 * Execute a tool with full guardrail wrapping:
 *   1. Capture a checkpoint if the tool is spec-mutating (so we can undo).
 *   2. Run pre-hooks (validation, veto, arg patching).
 *   3. Execute the tool via the standard registry.
 *   4. Run post-hooks (side effects, metrics).
 *   5. Emit checkpoint / hook_warning events to the UI.
 *
 * Returns the tool result plus any warnings emitted by hooks. If a hook
 * vetoes the call, returns a synthetic failed result with the veto reason.
 */
async function executeToolWithGuardrails(
  tool: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  onEvent: (event: ChatEvent) => void,
): Promise<{ result: ToolResult; warnings: string[]; checkpointId?: string }> {
  const warnings: string[] = [];
  let checkpointId: string | undefined;

  // 0. External MCP routing: namespaced tool names ("serverId__toolName")
  // bypass the local registry entirely and call the external server.
  if (tool.includes("__")) {
    const externalResult = await routeNamespacedExternalCall(tool, args);
    if (externalResult) {
      const textParts = externalResult.content
        .map((c: { type: string; text?: string } & Record<string, unknown>) =>
          typeof c.text === "string" ? c.text : JSON.stringify(c),
        )
        .join("\n");
      return {
        result: {
          ok: externalResult.ok,
          summary: textParts.slice(0, 500) || `external call ${externalResult.ok ? "ok" : "failed"}`,
          specChanged: false,
          data: {
            external: true,
            content: externalResult.content,
            durationMs: externalResult.durationMs,
          },
        },
        warnings,
        checkpointId,
      };
    }
    // If the namespace does not match any connected server, fall through to
    // the local registry so the user sees a normal "unknown tool" error.
  }

  // 1. Checkpoint capture for spec-mutating tools.
  if (isSpecMutating(tool)) {
    const cp = capture(ctx.projectId, tool);
    if (cp) {
      checkpointId = cp.id;
      onEvent({
        type: "checkpoint",
        checkpointId: cp.id,
        triggerTool: tool,
        componentCount: cp.componentCount,
        label: cp.label,
      });
    }
  }

  // 2. Pre-hooks: validate, patch args, or veto.
  const pre = await runPreHooks({
    projectId: ctx.projectId,
    tool: tool as never,
    args,
  });
  if (pre.warnings.length > 0) {
    warnings.push(...pre.warnings);
    onEvent({ type: "hook_warning", warnings: pre.warnings, tool });
  }
  if (pre.veto) {
    return {
      result: {
        ok: false,
        summary: `vetoed by guardrail: ${pre.reason ?? "unknown reason"}`,
        specChanged: false,
      },
      warnings,
      checkpointId,
    };
  }

  // 3. Execute the tool with (possibly patched) args.
  const result = await executeTool(tool as never, pre.args, ctx);

  // 4. Post-hooks: side effects only.
  await runPostHooks(
    { projectId: ctx.projectId, tool: tool as never, args: pre.args },
    result,
  );

  return { result, warnings, checkpointId };
}

/**
 * Execute a structured plan: walk each action, run its tool calls, and emit
 * plan_progress events as actions complete. Returns when all actions are done
 * or the user requests cancellation.
 */
async function executeStructuredPlan(
  plan: StructuredPlan,
  ctx: ToolContext,
  onEvent: (event: ChatEvent) => void,
  allToolCalls: LlmToolCall[],
  allToolResults: ToolResult[],
  goalTree: GoalTree | null,
): Promise<{ componentCountDelta: number; anySpecChanged: boolean }> {
  const state: PlanExecutionState = initPlanExecution(plan);
  // Surface the plan state to the LLM via the cancel_plan / get_plan_state tools.
  setPlanState(ctx.projectId, {
    planSummary: plan.summary,
    currentActionIndex: -1,
    completed: 0,
    failed: 0,
    total: plan.actions.length,
    cancelRequested: false,
  });

  let anySpecChanged = false;
  const componentCountBefore =
    getProjectSpec(ctx.projectId)?.components.length ?? 0;

  for (let i = 0; i < plan.actions.length; i++) {
    if (state.cancelRequested) break;
    const action = plan.actions[i];
    state.currentActionIndex = i;

    let actionOk = true;
    for (const call of action.toolCalls) {
      if (state.cancelRequested) break;
      const callId = `plan_${action.id}_${call.tool}`;
      onEvent({ type: "tool_call", tool: call.tool, args: call.args, callId });

      const activeGoalId = goalTree ? startToolGoal(goalTree, call.tool) : null;
      if (goalTree && activeGoalId) {
        onEvent({ type: "goal", root: serializeGoal(goalTree) });
      }

      const toolStart = Date.now();
      const { result } = await executeToolWithGuardrails(
        call.tool as string,
        call.args,
        ctx,
        onEvent,
      );
      const toolDurationMs = Date.now() - toolStart;
      recordToolExecution(ctx.projectId, call.tool, result.ok, toolDurationMs);

      allToolCalls.push({ tool: call.tool, args: call.args, callId });
      allToolResults.push(result);

      if (goalTree && activeGoalId) {
        if (result.ok) completeToolGoal(goalTree, activeGoalId);
        onEvent({ type: "goal", root: serializeGoal(goalTree) });
      }

      onEvent({
        type: "tool_result",
        callId,
        tool: call.tool,
        result: result.data ?? null,
        summary: result.summary,
      });
      addMemory(ctx.projectId, {
        role: "tool",
        content: result.summary,
        toolCallId: callId,
        toolName: call.tool,
      });
      addMessage(ctx.projectId, {
        role: "tool",
        content: result.summary,
        toolCallId: callId,
        toolName: call.tool,
      });

      if (result.specChanged) anySpecChanged = true;
      if (!result.ok) actionOk = false;
    }

    if (actionOk) {
      completeAction(state, action.id);
    } else {
      failAction(state, action.id);
    }

    // Update shared plan state for cancel_plan / get_plan_state tools.
    setPlanState(ctx.projectId, {
      planSummary: plan.summary,
      currentActionIndex: i,
      completed: state.completedActionIds.size,
      failed: state.failedActionIds.size,
      total: plan.actions.length,
      cancelRequested: state.cancelRequested,
    });

    onEvent({
      type: "plan_progress",
      actionId: action.id,
      actionType: action.type,
      description: action.description,
      completed: state.completedActionIds.size,
      total: plan.actions.length,
    });

    // Emit spec_update after each spec-mutating action so the canvas refreshes.
    if (action.mutatesSpec && anySpecChanged) {
      const fresh = getProjectSpec(ctx.projectId);
      if (fresh) {
        onEvent({
          type: "spec_update",
          components: fresh.components,
          project: fresh.project,
        });
      }
    }
  }

  clearPlanState(ctx.projectId);

  const componentCountAfter =
    getProjectSpec(ctx.projectId)?.components.length ?? componentCountBefore;
  return {
    componentCountDelta: componentCountAfter - componentCountBefore,
    anySpecChanged,
  };
}

/**
 * Inline executor for Motion Intelligence tools.
 *
 * These tools are not registered in the standard tool registry because they
 * return analysis/creative output rather than mutating the project spec. They
 * are intercepted here so the orchestrator can run them as part of a composed
 * tool pipeline.
 *
 * Returns the tool result, or `null` if the tool name is not a Motion
 * Intelligence tool — in which case the caller falls through to the standard
 * `executeToolWithGuardrails` path.
 */
async function executeMotionIntelligenceTool(
  tool: string,
  args: Record<string, unknown>,
  projectId: string,
): Promise<ToolResult | null> {
  if (
    tool !== "generate_variations" &&
    tool !== "extract_motion_dna" &&
    tool !== "transfer_style" &&
    tool !== "critique_motion" &&
    tool !== "generate_story" &&
    tool !== "list_story_intents" &&
    tool !== "query_lineage" &&
    tool !== "get_lineage_tree" &&
    tool !== "get_lineage_summary" &&
    tool !== "record_lineage" &&
    tool !== "synthesize_motion"
  ) {
    return null;
  }

  // List story intents does not require a spec.
  if (tool === "list_story_intents") {
    const intents = listNarrativeIntents();
    return {
      ok: true,
      summary: `${intents.length} narrative intents available: ${intents.map((i) => i.intent).join(", ")}`,
      specChanged: false,
      data: { kind: "story_intents", intents },
    };
  }

  // Lineage tools work on the in-memory lineage store, not the spec.
  if (tool === "get_lineage_summary") {
    const summary = getProjectLineageSummary(projectId);
    return {
      ok: true,
      summary: `Lineage: ${summary.totalComponents} components, ${summary.rootCount} roots, max generation ${summary.maxGeneration}, avg ${summary.averageGeneration.toFixed(1)}`,
      specChanged: false,
      data: { kind: "lineage_summary", summary },
    };
  }

  if (tool === "get_lineage_tree") {
    const tree = getLineageTree(projectId);
    return {
      ok: true,
      summary: formatLineageTree(tree),
      specChanged: false,
      data: { kind: "lineage_tree", tree },
    };
  }

  if (tool === "query_lineage") {
    const componentId = typeof args.componentId === "string" ? args.componentId : "";
    if (!componentId) {
      return {
        ok: false,
        summary: "componentId is required for query_lineage",
        specChanged: false,
      };
    }
    const report = generateLineageReport(projectId, componentId);
    if (!report) {
      return {
        ok: false,
        summary: `no lineage record found for component ${componentId}`,
        specChanged: false,
      };
    }
    return {
      ok: true,
      summary: report.summary,
      specChanged: false,
      data: { kind: "lineage_report", report },
    };
  }

  if (tool === "record_lineage") {
    const componentId = typeof args.componentId === "string" ? args.componentId : "";
    const componentName = typeof args.componentName === "string" ? args.componentName : "";
    const operation = typeof args.operation === "string" ? args.operation : "original";
    const parentIds = Array.isArray(args.parentIds) ? args.parentIds.filter((id): id is string => typeof id === "string") : [];
    const params = (args.params && typeof args.params === "object" ? args.params : {}) as Record<string, unknown>;
    if (!componentId || !componentName) {
      return {
        ok: false,
        summary: "componentId and componentName are required for record_lineage",
        specChanged: false,
      };
    }
    const record = recordLineage(projectId, componentId, componentName, operation as never, parentIds, params);
    return {
      ok: true,
      summary: `Recorded lineage: ${componentName} (${operation}, generation ${record.generation})`,
      specChanged: false,
      data: { kind: "lineage_record", record },
    };
  }

  const spec = getProjectSpec(projectId);
  if (!spec) {
    return {
      ok: false,
      summary: "no project spec available for Motion Intelligence analysis",
      specChanged: false,
    };
  }

  if (tool === "synthesize_motion") {
    // Resolve source component IDs from args. Supports componentIds array
    // or sourceComponentId + targetComponentId pair.
    const componentIds = Array.isArray(args.componentIds)
      ? args.componentIds.filter((id): id is string => typeof id === "string")
      : [];
    const sourceId = typeof args.sourceComponentId === "string" ? args.sourceComponentId : "";
    const targetId = typeof args.targetComponentId === "string" ? args.targetComponentId : "";
    const ids = componentIds.length >= 2
      ? componentIds
      : [sourceId, targetId].filter(Boolean);
    if (ids.length < 2) {
      return {
        ok: false,
        summary: "synthesize_motion requires at least 2 source component IDs",
        specChanged: false,
      };
    }
    const sources = ids
      .map((id) => spec.components.find((c) => c.id === id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
    if (sources.length < 2) {
      return {
        ok: false,
        summary: "could not resolve at least 2 valid source components",
        specChanged: false,
      };
    }
    const strategy = typeof args.strategy === "string" ? (args.strategy as SynthesisStrategy) : "blend";
    const result = synthesizeMotion(sources, { strategy });
    return {
      ok: true,
      summary: formatSynthesisReport(result),
      specChanged: false,
      data: { kind: "synthesis", result },
    };
  }

  if (tool === "critique_motion") {
    const report = critiqueMotion(spec);
    return {
      ok: true,
      summary: formatCritiqueReport(report, spec.project.name),
      specChanged: false,
      data: { kind: "critique", report },
    };
  }

  if (tool === "generate_story") {
    // Accept either an explicit intent or a natural-language prompt.
    const explicitIntent = typeof args.intent === "string" ? (args.intent as NarrativeIntent) : null;
    const prompt = typeof args.prompt === "string" ? args.prompt : "";
    const intent = explicitIntent ?? detectNarrativeIntent(prompt);
    if (!intent) {
      return {
        ok: false,
        summary: "could not detect a narrative intent from the message. Available intents: hero-entrance, celebration, dramatic-reveal, conflict, transformation, journey, resolution",
        specChanged: false,
      };
    }
    const totalDurationMs = typeof args.totalDurationMs === "number" ? args.totalDurationMs : 4000;
    const intensityScale = typeof args.intensityScale === "number" ? args.intensityScale : 1.0;
    const sequence = generateStorySequence(intent, { totalDurationMs, intensityScale });
    return {
      ok: true,
      summary: formatStoryReport(sequence),
      specChanged: false,
      data: { kind: "story", sequence },
    };
  }

  if (tool === "generate_variations") {
    const componentId = typeof args.componentId === "string" ? args.componentId : "";
    const source = spec.components.find((c) => c.id === componentId);
    if (!source) {
      return {
        ok: false,
        summary: `component ${componentId} not found for variation generation`,
        specChanged: false,
      };
    }
    const countPerAxis = typeof args.countPerAxis === "number" ? args.countPerAxis : 3;
    const variations = generateVariations(source, { countPerAxis });
    return {
      ok: true,
      summary: formatVariationSummary(variations),
      specChanged: false,
      data: {
        kind: "variations",
        sourceComponentId: source.id,
        sourceComponentName: source.name,
        variations: variations.map((v) => ({
          label: v.label,
          axis: v.axis,
          delta: v.delta,
          component: v.component,
        })),
      },
    };
  }

  if (tool === "extract_motion_dna") {
    const componentId = typeof args.componentId === "string" ? args.componentId : "";
    const component = spec.components.find((c) => c.id === componentId);
    if (!component) {
      return {
        ok: false,
        summary: `component ${componentId} not found for DNA extraction`,
        specChanged: false,
      };
    }
    const dna = extractDNA(component);
    return {
      ok: true,
      summary: formatDNAReport(dna, component.name),
      specChanged: false,
      data: { kind: "motion_dna", componentId: component.id, componentName: component.name, dna },
    };
  }

  // transfer_style
  const sourceComponentId = typeof args.sourceComponentId === "string" ? args.sourceComponentId : "";
  const targetComponentId = typeof args.targetComponentId === "string" ? args.targetComponentId : "";
  const source = spec.components.find((c) => c.id === sourceComponentId);
  const target = spec.components.find((c) => c.id === targetComponentId);
  if (!source || !target) {
    return {
      ok: false,
      summary: `source ${sourceComponentId} or target ${targetComponentId} not found for style transfer`,
      specChanged: false,
    };
  }
  const result = transferStyle(source, target);
  return {
    ok: true,
    summary: formatStyleTransferReport(result, source.name, target.name),
    specChanged: false,
    data: {
      kind: "style_transfer",
      sourceComponentId: source.id,
      targetComponentId: target.id,
      transferred: result.transferred,
      preserved: result.preserved,
      component: result.component,
    },
  };
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
  // Augment the tool surface with any tools from connected external MCP
  // servers. Their names are namespaced ("serverId__toolName") so the LLM
  // can call them like any native tool and the orchestrator routes the call
  // back through routeNamespacedExternalCall in executeToolWithGuardrails.
  try {
    const externalToolSpecs = await describeExternalToolsForOrchestrator();
    for (const spec of externalToolSpecs) {
      tools.push({
        name: spec.name as never,
        description: spec.description,
        inputSchema: spec.inputSchema,
      });
    }
    if (externalToolSpecs.length > 0) {
      logger.info("external mcp tools attached to orchestrator", {
        count: externalToolSpecs.length,
      });
    }
  } catch (err) {
    logger.warn("failed to attach external mcp tools", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  const allToolCalls: LlmToolCall[] = [];
  const allToolResults: ToolResult[] = [];
  const componentCountBefore = initialSpec?.components.length ?? 0;

  // Subagent delegation routing: when the user asks for exploration, comparison,
  // or parallel workstreams, delegate to focused subagents with isolated budgets.
  if (initialSpec && shouldDelegate(userMessage)) {
    const subagentTasks = composeSubagentTasks(userMessage, projectId);
    if (subagentTasks.length > 0) {
      logger.info("subagent delegation mode", { tasks: subagentTasks.length });
      for (const task of subagentTasks) {
        onEvent({
          type: "subagent_started",
          goal: task.goal,
          toolCount: task.toolCalls.length,
          maxIterations: task.maxIterations ?? 6,
        });
      }

      const subagentCtx: SubagentContext = {
        projectId,
        goalTree,
        onEvent,
      };
      const results = await runSubagentsParallel(subagentTasks, subagentCtx);

      // Merge subagent results into the parent's tool call history.
      for (const result of results) {
        allToolCalls.push(...result.toolCalls);
        allToolResults.push(...result.toolResults);
        onEvent({
          type: "subagent_completed",
          goal: result.task.goal,
          allSucceeded: result.allSucceeded,
          specChanged: result.specChanged,
          durationMs: result.durationMs,
          iterationsUsed: result.iterationsUsed,
          summary: result.summary,
        });
      }

      const anySpecChanged = results.some((r) => r.specChanged);
      if (anySpecChanged) {
        const fresh = getProjectSpec(projectId);
        if (fresh) {
          onEvent({
            type: "spec_update",
            components: fresh.components,
            project: fresh.project,
          });
        }
      }

      const summaryText = results.map((r) => r.summary).join("\n");
      addMemory(projectId, { role: "assistant", content: summaryText });
      addMessage(projectId, { role: "assistant", content: summaryText });

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

      onEvent({ type: "done", message: summaryText, tokensIn: 0, tokensOut: 0 });
      return;
    }
  }

  // Plan-then-Execute routing: for complex multi-step requests, decompose into
  // typed actions and execute them sequentially with reviewable progress and
  // cancel support. This runs BEFORE the composition pre-pass so complex
  // multi-action requests get the full plan treatment (reviewable, cancellable)
  // instead of being shortcut by composition.
  if (initialSpec && shouldUsePlanMode(userMessage, initialSpec)) {
    const structuredPlan = composeStructuredPlan(userMessage, initialSpec);
    if (structuredPlan.totalToolCalls > 0) {
      logger.info("plan-then-execute mode", {
        actions: structuredPlan.actions.length,
        toolCalls: structuredPlan.totalToolCalls,
        mutatesSpec: structuredPlan.mutatesSpec,
      });
      onEvent({
        type: "plan_state",
        planSummary: structuredPlan.summary,
        currentActionIndex: -1,
        completed: 0,
        failed: 0,
        total: structuredPlan.actions.length,
        cancelRequested: false,
      });

      const planResult = await executeStructuredPlan(
        structuredPlan,
        { projectId },
        onEvent,
        allToolCalls,
        allToolResults,
        goalTree,
      );

      const freshSpec = getProjectSpec(projectId);
      const componentCountAfter = freshSpec?.components.length ?? componentCountBefore;

      if (planResult.anySpecChanged && freshSpec) {
        onEvent({
          type: "spec_update",
          components: freshSpec.components,
          project: freshSpec.project,
        });
        const suggestions = suggestProactive({
          spec: freshSpec,
          lastTool: structuredPlan.actions[structuredPlan.actions.length - 1]?.toolCalls[0]?.tool ?? null,
          lastToolOk: true,
          lastComponentId: undefined,
        });
        if (suggestions.length > 0) {
          onEvent({ type: "proactive_suggestion", suggestions });
        }
      }

      // Self-learning: extract a skill from the executed plan.
      if (allToolCalls.length >= 2) {
        const skill = extractSkill(userMessage, allToolCalls, allToolResults, projectId);
        if (skill) {
          logger.info("generated skill from plan execution", { skillId: skill.id, skillName: skill.name });
        }
      }

      const summaryText = structuredPlan.summary;
      addMemory(projectId, { role: "assistant", content: summaryText });
      addMessage(projectId, { role: "assistant", content: summaryText });

      const summary = generateSessionSummary({
        userMessage,
        toolCalls: allToolCalls,
        toolResults: allToolResults,
        goalTree,
        componentCountBefore,
        componentCountAfter,
      });
      onEvent({ type: "session_summary", summary });
      onEvent({ type: "done", message: summaryText, tokensIn: 0, tokensOut: 0 });
      return;
    }
  }

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

      // Execute the composed tools sequentially, resolving __last__/__first__ placeholders
      const composedCalls = composedToToolCalls(composition.tools);
      let composedSpecChanged = false;
      for (let i = 0; i < composedCalls.length; i++) {
        const call = composedCalls[i];
        const args = call.args as Record<string, unknown>;
        if (args && typeof args === "object") {
          // Resolve __last__ to the most recently created component
          if (args.componentId === "__last__") {
            const freshSpec = getProjectSpec(projectId);
            const lastComponent = freshSpec?.components[freshSpec.components.length - 1];
            if (lastComponent) {
              call.args = { ...args, componentId: lastComponent.id };
            } else {
              continue;
            }
          }
          // Resolve __first__ to the first component in the spec
          if (args.componentId === "__first__") {
            const freshSpec = getProjectSpec(projectId);
            const firstComponent = freshSpec?.components[0];
            if (firstComponent) {
              call.args = { ...args, componentId: firstComponent.id };
            } else {
              continue;
            }
          }
          // Resolve sourceComponentId/targetComponentId placeholders
          if (args.sourceComponentId === "__first__") {
            const freshSpec = getProjectSpec(projectId);
            const firstComponent = freshSpec?.components[0];
            if (firstComponent) {
              call.args = { ...args, sourceComponentId: firstComponent.id };
            } else {
              continue;
            }
          }
          if (args.targetComponentId === "__last__") {
            const freshSpec = getProjectSpec(projectId);
            const lastComponent = freshSpec?.components[freshSpec.components.length - 1];
            if (lastComponent) {
              call.args = { ...args, targetComponentId: lastComponent.id };
            } else {
              continue;
            }
          }
        }

        onEvent({ type: "tool_call", tool: call.tool, args: call.args, callId: call.callId });
        const toolStart = Date.now();

        // Motion Intelligence tools are handled inline (not in the tool registry).
        const miResult = await executeMotionIntelligenceTool(
          call.tool,
          call.args as Record<string, unknown>,
          projectId,
        );
        const result = miResult ?? (await executeToolWithGuardrails(call.tool as string, call.args as Record<string, unknown>, { projectId }, onEvent)).result;
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

  // Standard ReAct loop with bounded iteration budget.
  const budget = createParentBudget(MAX_ITERATIONS);
  onEvent({
    type: "budget",
    label: budget.label,
    consumed: budget.consumed,
    initial: budget.initial,
    remaining: budget.remaining,
  });

  while (consume(budget)) {
    // Allow one consolidation iteration when the budget is exhausted but
    // spec-changing progress has been made — prevents mid-edit termination.
    if (budget.remaining === 0 && !mayExtendForConsolidation(budget, allToolResults.some((r) => r.specChanged))) {
      break;
    }
    const iter = budget.consumed - 1;
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
      const { result } = await executeToolWithGuardrails(call.tool as string, call.args as Record<string, unknown>, { projectId }, onEvent);
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
    onEvent({
      type: "budget",
      label: budget.label,
      consumed: budget.consumed,
      initial: budget.initial,
      remaining: budget.remaining,
    });
  }

  logger.warn("agent budget exhausted", { budget: describeBudget(budget) });
  onEvent({
    type: "error",
    message: `agent exceeded its tool-call budget (${budget.consumed}/${budget.initial} iterations) without a final reply`,
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
