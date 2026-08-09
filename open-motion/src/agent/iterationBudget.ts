/** Iteration Budget — bounded turn counts with parent/subagent isolation. */

export interface IterationBudget {
  /** Remaining iterations. */
  remaining: number;
  /** Initial budget — used for percentage display in the UI. */
  initial: number;
  /** Total consumed so far. */
  consumed: number;
  /** Parent budget, if this is a subagent. */
  parent?: IterationBudget;
  /** Label for debugging ("parent" | "subagent:<goal>"). */
  label: string;
}

const DEFAULT_PARENT_BUDGET = 12;
const DEFAULT_SUBAGENT_BUDGET = 6;

/** Create a fresh parent budget for a new orchestrate() call. */
export function createParentBudget(initial: number = DEFAULT_PARENT_BUDGET): IterationBudget {
  return {
    remaining: initial,
    initial,
    consumed: 0,
    label: "parent",
  };
}

/** Create a subagent budget linked to a parent. */
export function createSubagentBudget(
  parent: IterationBudget,
  goal: string,
  initial: number = DEFAULT_SUBAGENT_BUDGET,
): IterationBudget {
  return {
    remaining: initial,
    initial,
    consumed: 0,
    parent,
    label: `subagent:${goal.slice(0, 40)}`,
  };
}

/**
 * Consume one iteration from the budget. Returns true if the call is
 * allowed, false if the budget is exhausted.
 */
export function consume(budget: IterationBudget): boolean {
  if (budget.remaining <= 0) return false;
  budget.remaining--;
  budget.consumed++;
  return true;
}

/** Refund iterations (e.g., when an iteration was a no-op). */
export function refund(budget: IterationBudget, n = 1): void {
  budget.remaining += n;
  budget.consumed = Math.max(0, budget.consumed - n);
}

/** Percentage of budget consumed (0-1). */
export function utilization(budget: IterationBudget): number {
  if (budget.initial === 0) return 0;
  return budget.consumed / budget.initial;
}

/** Format budget state for UI display. */
export function describeBudget(budget: IterationBudget): string {
  const pct = Math.round(utilization(budget) * 100);
  return `${budget.label}: ${budget.consumed}/${budget.initial} (${pct}%)`;
}

/**
 * Checkpoint-aware budget extension: when the agent is in the middle of a
 * multi-step plan and has made spec-changing progress, allow one extra
 * iteration to consolidate. This prevents the agent from stopping mid-edit
 * just because the budget ran out.
 */
export function mayExtendForConsolidation(budget: IterationBudget, hasSpecProgress: boolean): boolean {
  // Only extend parent budgets, not subagents.
  if (budget.parent) return false;
  // Only extend once per budget.
  if (budget.consumed <= budget.initial) return false;
  // Only extend when there's actual spec progress to consolidate.
  if (!hasSpecProgress) return false;
  // Allow up to 25% extension.
  return budget.consumed < budget.initial * 1.25;
}
