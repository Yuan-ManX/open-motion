/**
 * Adaptive replanning on failure.
 *
 * Regenerates a focused remaining plan from the current spec state plus
 * failure context, dropping already-succeeded and just-failed steps.
 */

import type { MotionSpec } from "@openmotion/shared";
import { composeStructuredPlan } from "./planExecutor.js";

export interface ReplanInput {
  /** The original user message for this turn. */
  userMessage: string;
  /** Current spec (after any partial mutations this turn). */
  spec: MotionSpec | null;
  /** Tools that failed this iteration. */
  failedTools: string[];
  /** Recovery suggestion produced by reflectOnFailures. */
  failureSuggestion: string;
  /** Remaining iterations in the budget. */
  budgetRemaining: number;
  /** Tools that succeeded earlier this turn (already-done work). */
  successfulToolsThisTurn: string[];
}

export interface ReplanStep {
  tool: string;
  description: string;
}

export interface ReplanResult {
  /** Whether a replan was produced. False when the conservative gates fail. */
  replanned: boolean;
  steps: ReplanStep[];
  summary: string;
  /** Short explanation of why the replan fired (or did not). */
  reason: string;
}

/** Minimum remaining iterations required to justify replanning. */
const MIN_BUDGET_FOR_REPLAN = 2;

/** Cap on replan length so the agent does not over-commit under pressure. */
const MAX_REPLAN_STEPS = 6;

/**
 * Produce a fresh remaining-steps plan after a failure. Returns
 * `{ replanned: false, ... }` when the conservative gates fail.
 */
export function replanAfterFailure(input: ReplanInput): ReplanResult {
  const {
    userMessage,
    spec,
    failedTools,
    failureSuggestion,
    budgetRemaining,
    successfulToolsThisTurn,
  } = input;

  if (failedTools.length === 0) {
    return { replanned: false, steps: [], summary: "", reason: "no failures" };
  }
  if (budgetRemaining < MIN_BUDGET_FOR_REPLAN) {
    return {
      replanned: false,
      steps: [],
      summary: "",
      reason: `insufficient budget (${budgetRemaining} < ${MIN_BUDGET_FOR_REPLAN})`,
    };
  }
  if (!spec) {
    return { replanned: false, steps: [], summary: "", reason: "no spec" };
  }

  // Rebuild a plan from the CURRENT spec. The original plan was built from
  // the pre-turn spec; after partial mutations or a failure, only a fresh
  // plan reflects the real state the agent must operate on.
  const freshPlan = composeStructuredPlan(userMessage, spec);

  // Recovery step: always first. Re-grounds the agent before re-attempting.
  // Default to get_motion_spec (safe introspection) and annotate with the
  // failure-specific suggestion so the agent sees the targeted recovery.
  const recoveryDescription =
    (failureSuggestion || "Re-ground by inspecting the current spec").slice(0, 140);
  const recoveryStep: ReplanStep = {
    tool: "get_motion_spec",
    description: recoveryDescription,
  };

  // Flatten the fresh plan into concrete steps, then drop work that is
  // already done or that just failed (the recovery step covers the failure).
  const succeededSet = new Set(successfulToolsThisTurn);
  const failedSet = new Set(failedTools);
  const remainingSteps: ReplanStep[] = [];
  for (const action of freshPlan.actions) {
    for (const tc of action.toolCalls) {
      const tool = tc.tool as string;
      if (succeededSet.has(tool)) continue;
      if (failedSet.has(tool)) continue;
      remainingSteps.push({ tool, description: tc.reason });
    }
  }

  // Deduplicate by tool (keep the first occurrence) so a re-plan does not
  // repeat the same tool multiple times.
  const seenTools = new Set<string>();
  const deduped = remainingSteps.filter((s) => {
    if (seenTools.has(s.tool)) return false;
    seenTools.add(s.tool);
    return true;
  });

  const steps = [recoveryStep, ...deduped].slice(0, MAX_REPLAN_STEPS);
  const summary =
    `Replanned after ${failedTools.length} failure(s): ${steps.length} step(s) remaining ` +
    `(${budgetRemaining} iterations left).`;

  return {
    replanned: true,
    steps,
    summary,
    reason: `${failedTools.length} tool(s) failed; ${budgetRemaining} iterations remaining`,
  };
}
