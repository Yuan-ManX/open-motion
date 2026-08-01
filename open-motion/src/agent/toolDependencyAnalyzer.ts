import type { LlmToolCall } from "./provider/types.js";
import { isSpecMutating } from "./checkpointManager.js";

/**
 * Tool-call placeholder tokens that resolve against live spec state at
 * execution time. Calls using these placeholders must run sequentially
 * because their resolved target depends on a prior call's effect.
 */
const PLACEHOLDERS = new Set(["__last__", "__first__"]);

/**
 * Inspect a tool call's args for placeholder component references that
 * require sequential ordering. Returns the placeholder name if found,
 * or null otherwise.
 */
function detectPlaceholder(call: LlmToolCall): string | null {
  const args = call.args as Record<string, unknown> | null;
  if (!args || typeof args !== "object") return null;
  for (const key of ["componentId", "sourceComponentId", "targetComponentId"]) {
    const v = args[key];
    if (typeof v === "string" && PLACEHOLDERS.has(v)) return v;
  }
  return null;
}

/**
 * Extract the concrete componentId targeted by a call, if any. Used to
 * detect write conflicts: two calls targeting the same component should
 * not run in parallel even when both are otherwise parallelizable.
 */
function targetComponentId(call: LlmToolCall): string | null {
  const args = call.args as Record<string, unknown> | null;
  if (!args || typeof args !== "object") return null;
  for (const key of ["componentId", "sourceComponentId", "targetComponentId"]) {
    const v = args[key];
    if (typeof v === "string" && !PLACEHOLDERS.has(v) && v.length > 0) {
      return v;
    }
  }
  return null;
}

/**
 * Determine whether a call is safe to run in parallel with others.
 * Conservative: spec-mutating tools, placeholder users, and MCP-namespaced
 * external calls are never parallelized.
 */
function isParallelizable(call: LlmToolCall): boolean {
  if (typeof call.tool !== "string") return false;
  // MCP namespaced tool names look like "serverId__toolName" — they route
  // through external servers and may have their own ordering requirements.
  if (call.tool.includes("__")) return false;
  if (isSpecMutating(call.tool)) return false;
  if (detectPlaceholder(call) !== null) return false;
  return true;
}

export interface ToolBatch {
  /** Whether the calls in this batch may execute concurrently. */
  parallel: boolean;
  calls: LlmToolCall[];
}

/**
 * Group tool calls into execution batches. Batches execute sequentially;
 * within a `parallel` batch, calls may execute concurrently via Promise.all.
 *
 * Grouping rules (conservative — when in doubt, run sequentially):
 *   1. Non-parallelizable calls (spec-mutating, placeholder users, MCP
 *      namespaced) get their own sequential singleton batch.
 *   2. Parallelizable calls that target distinct componentIds may share a
 *      parallel batch.
 *   3. Calls targeting the same componentId are split across batches to
 *      avoid write races on the same component.
 *
 * The order of calls is preserved across batches — only intra-batch order
 * is relaxed (and only when `parallel` is true and the batch has >1 call).
 */
export function analyzeToolDependencies(calls: LlmToolCall[]): ToolBatch[] {
  const batches: ToolBatch[] = [];
  let current: LlmToolCall[] = [];
  let currentTargets = new Set<string>();

  const flush = () => {
    if (current.length === 0) return;
    batches.push({ parallel: true, calls: current });
    current = [];
    currentTargets = new Set();
  };

  for (const call of calls) {
    if (!isParallelizable(call)) {
      // Close any in-flight parallel batch, then emit this call as a
      // sequential singleton batch so its effects are observable before
      // any later batch runs.
      flush();
      batches.push({ parallel: false, calls: [call] });
      continue;
    }
    const target = targetComponentId(call);
    if (target && currentTargets.has(target)) {
      // Write conflict with an existing batch member — close the batch
      // and start a new one containing this call.
      flush();
    }
    if (target) currentTargets.add(target);
    current.push(call);
  }
  flush();
  return batches;
}
