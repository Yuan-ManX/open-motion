/**
 * Subagent Delegation — parallel workstream execution with isolated budgets.
 *
 * The parent agent can delegate focused subtasks to independent subagents.
 * Each subagent gets its own iteration budget, tool whitelist, and goal.
 * This enables parallel exploration of alternative approaches (e.g., "try
 * three different easing curves and report which feels best").
 *
 * Design:
 *   - Subagents share the parent's project context (same projectId)
 *   - Each subagent has an isolated IterationBudget (default 6 iterations)
 *   - Tool whitelists prevent subagents from wandering outside their scope
 *   - Results are returned as a SubagentResult for the parent to merge
 *   - Checkpoint capture happens before subagent execution, so a bad
 *     subagent run can be rolled back without affecting the parent's state
 *
 * The parent agent decides when to delegate. Heuristics:
 *   - "explore alternatives" / "try different approaches" → spawn subagents
 *   - "compare X vs Y" → spawn two subagents, one per approach
 *   - "while you're at it, also..." → delegate the side task to a subagent
 *
 * Subagents are synchronous from the parent's perspective — the parent
 * awaits all subagents before continuing. True parallelism would require
 * worker threads, which is overkill for tool calls that are mostly I/O.
 */

import type { ChatEvent, ToolName } from "@openmotion/shared";
import type { LlmToolCall } from "./provider/types.js";
import { executeTool, type ToolContext, type ToolResult } from "./tools/registry.js";
import { runPreHooks, runPostHooks } from "./pluginHooks.js";
import { capture, isSpecMutating } from "./checkpointManager.js";
import {
  createSubagentBudget,
  consume,
  type IterationBudget,
} from "./iterationBudget.js";
import type { GoalTree } from "./goals.js";
import { recordToolExecution } from "./analytics.js";
import { logger } from "../utils/logger.js";

export interface SubagentTask {
  /** Focused goal for the subagent (e.g., "explore bouncy easing variants"). */
  goal: string;
  /** Tool whitelist — subagent can only call these tools. */
  allowedTools: ToolName[];
  /** Concrete tool calls to execute (rule-based, no LLM round-trip). */
  toolCalls: Array<{
    tool: ToolName;
    args: Record<string, unknown>;
    reason: string;
  }>;
  /** Maximum iterations (default 6). */
  maxIterations?: number;
}

export interface SubagentResult {
  /** The task that was executed. */
  task: SubagentTask;
  /** All tool calls executed. */
  toolCalls: LlmToolCall[];
  /** All tool results. */
  toolResults: ToolResult[];
  /** Whether any spec-changing tool succeeded. */
  specChanged: boolean;
  /** Whether all tool calls succeeded. */
  allSucceeded: boolean;
  /** Wall-clock duration in ms. */
  durationMs: number;
  /** Iterations consumed. */
  iterationsUsed: number;
  /** Human-readable summary for the parent agent. */
  summary: string;
}

export interface SubagentContext extends ToolContext {
  /** Parent's goal tree, so subagent progress can be tracked. */
  goalTree?: GoalTree | null;
  /** Event emitter for streaming progress to the UI. */
  onEvent: (event: ChatEvent) => void;
  /** Parent's iteration budget (for linking the subagent budget). */
  parentBudget?: IterationBudget;
}

let subagentCounter = 0;

function nextSubagentId(): string {
  subagentCounter = (subagentCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `sub_${Date.now().toString(36)}_${subagentCounter.toString(36)}`;
}

/**
 * Execute a single subagent task. The subagent runs its tool calls
 * sequentially with guardrails (pre/post hooks, checkpoint capture).
 * Returns when all tool calls are done or the budget is exhausted.
 */
export async function runSubagent(
  task: SubagentTask,
  ctx: SubagentContext,
): Promise<SubagentResult> {
  const subagentId = nextSubagentId();
  const startTime = Date.now();
  const budget = createSubagentBudget(
    ctx.parentBudget ?? { remaining: 12, initial: 12, consumed: 0, label: "parent" },
    task.goal,
    task.maxIterations ?? 6,
  );

  logger.info("subagent started", {
    subagentId,
    goal: task.goal,
    allowedTools: task.allowedTools.length,
    toolCalls: task.toolCalls.length,
    budget: budget.initial,
  });

  const toolCalls: LlmToolCall[] = [];
  const toolResults: ToolResult[] = [];
  let specChanged = false;
  let allSucceeded = true;

  // Capture a checkpoint before the subagent runs, so its mutations can be
  // rolled back independently if the parent decides to discard the result.
  if (task.toolCalls.some((tc) => isSpecMutating(tc.tool))) {
    capture(ctx.projectId, `subagent:${task.goal.slice(0, 40)}`);
  }

  for (const call of task.toolCalls) {
    if (!consume(budget)) {
      logger.warn("subagent budget exhausted", { subagentId, goal: task.goal });
      break;
    }

    // Enforce the tool whitelist.
    if (!task.allowedTools.includes(call.tool)) {
      logger.warn("subagent attempted disallowed tool", {
        subagentId,
        tool: call.tool,
        allowedTools: task.allowedTools.length,
      });
      toolResults.push({
        ok: false,
        summary: `tool ${call.tool} is not in the subagent's allowed tools`,
        specChanged: false,
      });
      allSucceeded = false;
      continue;
    }

    const callId = `${subagentId}_${call.tool}`;
    ctx.onEvent({
      type: "tool_call",
      tool: call.tool,
      args: call.args,
      callId,
    });

    // Run guardrails (pre-hooks, checkpoint, execute, post-hooks).
    const pre = await runPreHooks({
      projectId: ctx.projectId,
      tool: call.tool,
      args: call.args,
    });
    if (pre.warnings.length > 0) {
      ctx.onEvent({
        type: "hook_warning",
        warnings: pre.warnings,
        tool: call.tool,
      });
    }
    if (pre.veto) {
      const vetoResult: ToolResult = {
        ok: false,
        summary: `vetoed by guardrail: ${pre.reason ?? "unknown reason"}`,
        specChanged: false,
      };
      toolCalls.push({ tool: call.tool, args: call.args, callId });
      toolResults.push(vetoResult);
      allSucceeded = false;
      ctx.onEvent({
        type: "tool_result",
        callId,
        tool: call.tool,
        result: null,
        summary: vetoResult.summary,
      });
      continue;
    }

    const toolStart = Date.now();
    const result = await executeTool(call.tool, pre.args, ctx);
    const toolDurationMs = Date.now() - toolStart;
    recordToolExecution(ctx.projectId, call.tool, result.ok, toolDurationMs);

    await runPostHooks(
      { projectId: ctx.projectId, tool: call.tool, args: pre.args },
      result,
    );

    toolCalls.push({ tool: call.tool, args: call.args, callId });
    toolResults.push(result);

    if (result.specChanged) specChanged = true;
    if (!result.ok) allSucceeded = false;

    ctx.onEvent({
      type: "tool_result",
      callId,
      tool: call.tool,
      result: result.data ?? null,
      summary: result.summary,
    });
  }

  const durationMs = Date.now() - startTime;
  const summary = buildSubagentSummary(task, toolResults, allSucceeded);

  logger.info("subagent completed", {
    subagentId,
    goal: task.goal,
    toolCalls: toolCalls.length,
    specChanged,
    allSucceeded,
    durationMs,
    iterationsUsed: budget.consumed,
  });

  return {
    task,
    toolCalls,
    toolResults,
    specChanged,
    allSucceeded,
    durationMs,
    iterationsUsed: budget.consumed,
    summary,
  };
}

/**
 * Execute multiple subagent tasks concurrently. Results are returned in the
 * same order as the input tasks. This is useful for parallel exploration of
 * alternative approaches.
 *
 * Note: tool calls within a subagent are sequential, but multiple subagents
 * run concurrently via Promise.all. Since tool calls are mostly I/O (DB
 * writes, no heavy computation), this gives real speedup.
 */
export async function runSubagentsParallel(
  tasks: SubagentTask[],
  ctx: SubagentContext,
): Promise<SubagentResult[]> {
  if (tasks.length === 0) return [];
  logger.info("running subagents in parallel", { count: tasks.length });
  return Promise.all(tasks.map((task) => runSubagent(task, ctx)));
}

/**
 * Pick the best subagent result based on a scoring function. Useful for
 * "try multiple approaches and pick the best" workflows.
 */
export function pickBestResult(
  results: SubagentResult[],
  scorer: (result: SubagentResult) => number,
): SubagentResult | null {
  if (results.length === 0) return null;
  let best = results[0];
  let bestScore = scorer(best);
  for (let i = 1; i < results.length; i++) {
    const score = scorer(results[i]);
    if (score > bestScore) {
      best = results[i];
      bestScore = score;
    }
  }
  return best;
}

/**
 * Heuristic: detect whether a user message is asking for subagent delegation.
 * Used by the orchestrator to route "explore alternatives" requests.
 */
export function shouldDelegate(message: string): boolean {
  const lower = message.toLowerCase();
  // "compare X vs Y" / "compare X and Y" — direct comparison always delegates.
  if (/\bcompare\b.*\b(?:vs\.?|versus|or|and)\b/i.test(lower)) {
    return true;
  }
  // "explore alternatives" / "try different approaches" — needs both verbs.
  if (/\b(explore|try|compare|alternative|variation|option|approach)\b/i.test(lower)) {
    if (/\b(alternative|variation|option|approach|different|several|multiple)\b/i.test(lower)) {
      return true;
    }
  }
  // "while you're at it, also..." → delegate the side task
  if (/\b(also|while you(?:'re| are) at it|in parallel|meanwhile|on the side)\b/i.test(lower)) {
    return true;
  }
  return false;
}

/**
 * Compose subagent tasks from a user message. Rule-based decomposition that
 * identifies parallel-worthy subtasks and constructs SubagentTask objects
 * with appropriate tool whitelists.
 */
export function composeSubagentTasks(
  message: string,
  projectId: string,
): SubagentTask[] {
  const lower = message.toLowerCase();
  const tasks: SubagentTask[] = [];

  // "explore easing alternatives" → try multiple easing presets
  if (/\b(easing|curve|feel)\s*(alternative|variation|option|approach)\b/i.test(lower)) {
    const presets = ["smooth", "snappy", "elastic", "back", "bounce"];
    tasks.push({
      goal: "explore easing alternatives",
      allowedTools: ["set_easing", "set_spring", "set_custom_bezier", "get_motion_spec"],
      toolCalls: presets.map((preset) => ({
        tool: "set_easing" as ToolName,
        args: { preset },
        reason: `try ${preset} easing`,
      })),
      maxIterations: 6,
    });
  }

  // "compare cinematic vs playful style" → spawn two subagents
  const compareM = message.match(/\bcompare\s+(\w+)\s+vs\.?\s+(\w+)\b/i);
  if (compareM) {
    const styleA = compareM[1].toLowerCase();
    const styleB = compareM[2].toLowerCase();
    tasks.push({
      goal: `apply ${styleA} style`,
      allowedTools: ["apply_style", "get_motion_spec"],
      toolCalls: [{ tool: "apply_style" as ToolName, args: { style: styleA }, reason: `apply ${styleA}` }],
      maxIterations: 3,
    });
    tasks.push({
      goal: `apply ${styleB} style`,
      allowedTools: ["apply_style", "get_motion_spec"],
      toolCalls: [{ tool: "apply_style" as ToolName, args: { style: styleB }, reason: `apply ${styleB}` }],
      maxIterations: 3,
    });
  }

  // "while you're at it, also apply X" → delegate the side task
  const whileM = message.match(/\b(?:also|while you(?:'re| are) at it|in parallel)\b[^.]*\b(?:apply|set|add|create)\s+(\w+)/i);
  if (whileM) {
    const action = whileM[1].toLowerCase();
    tasks.push({
      goal: `side task: ${action}`,
      allowedTools: ["apply_style", "set_easing", "set_duration", "set_color", "add_layer"],
      toolCalls: [{ tool: "apply_style" as ToolName, args: { style: action }, reason: `side task: ${action}` }],
      maxIterations: 3,
    });
  }

  return tasks;
}

function buildSubagentSummary(
  task: SubagentTask,
  results: ToolResult[],
  allSucceeded: boolean,
): string {
  const successCount = results.filter((r) => r.ok).length;
  const status = allSucceeded ? "succeeded" : successCount > 0 ? "partially succeeded" : "failed";
  const toolSummary = results.map((r) => r.summary).join("; ");
  return `Subagent "${task.goal}" ${status} (${successCount}/${results.length} tools): ${toolSummary}`;
}
