/**
 * Plan Store — in-memory persistence for the current plan and its execution
 * state, keyed by project id. The orchestrator composes a StructuredPlan
 * via planExecutor.composeStructuredPlan() and stores it here so the UI can
 * poll progress, cancel mid-flight, or re-execute later.
 *
 * The store is intentionally in-memory: plans are ephemeral working state,
 * not project data. If the server restarts, a new plan is composed on the
 * next user turn from the current spec + message.
 */

import type { StructuredPlan, PlanExecutionState } from "./planExecutor.js";
import { initPlanExecution, completeAction, failAction, requestCancel, planProgress, isPlanFinished } from "./planExecutor.js";

export interface PlanRecord {
  projectId: string;
  plan: StructuredPlan;
  state: PlanExecutionState;
  createdAt: number;
  updatedAt: number;
}

const records = new Map<string, PlanRecord>();

/**
 * Store a freshly-composed plan for a project. Replaces any existing plan.
 * Returns the new record so the caller can immediately inspect it.
 */
export function setPlan(projectId: string, plan: StructuredPlan): PlanRecord {
  const now = Date.now();
  const record: PlanRecord = {
    projectId,
    plan,
    state: initPlanExecution(plan),
    createdAt: now,
    updatedAt: now,
  };
  records.set(projectId, record);
  return record;
}

/** Get the current plan record for a project (or null if none). */
export function getPlan(projectId: string): PlanRecord | null {
  return records.get(projectId) ?? null;
}

/** Mark an action completed in the project's current plan. No-op if no plan. */
export function markActionCompleted(projectId: string, actionId: string): void {
  const rec = records.get(projectId);
  if (!rec) return;
  completeAction(rec.state, actionId);
  rec.updatedAt = Date.now();
}

/** Mark an action failed in the project's current plan. No-op if no plan. */
export function markActionFailed(projectId: string, actionId: string): void {
  const rec = records.get(projectId);
  if (!rec) return;
  failAction(rec.state, actionId);
  rec.updatedAt = Date.now();
}

/** Request cancellation of the current plan. The executor checks between actions. */
export function cancelPlan(projectId: string): PlanRecord | null {
  const rec = records.get(projectId);
  if (!rec) return null;
  requestCancel(rec.state);
  rec.updatedAt = Date.now();
  return rec;
}

/** Drop the current plan for a project (e.g., after completion or on clear). */
export function clearPlan(projectId: string): void {
  records.delete(projectId);
}

/** Compute the 0..1 progress fraction for the current plan. */
export function getPlanProgress(projectId: string): number {
  const rec = records.get(projectId);
  if (!rec) return 0;
  return planProgress(rec.state);
}

/** Whether the plan has finished (all actions completed/failed or cancelled). */
export function isPlanDone(projectId: string): boolean {
  const rec = records.get(projectId);
  if (!rec) return true;
  return isPlanFinished(rec.state);
}

/** Summarize the plan for REST responses without leaking internal state. */
export function summarizePlan(projectId: string): {
  hasPlan: boolean;
  summary: string;
  totalActions: number;
  completedActions: number;
  failedActions: number;
  currentActionIndex: number;
  cancelRequested: boolean;
  progress: number;
  finished: boolean;
  startedAt: number | null;
  endedAt: number | null;
  totalToolCalls: number;
  totalComplexity: number;
  mutatesSpec: boolean;
  actions: Array<{
    id: string;
    type: string;
    description: string;
    toolCalls: number;
    complexity: 1 | 2 | 3 | 4 | 5;
    mutatesSpec: boolean;
    status: "pending" | "completed" | "failed";
  }>;
} {
  const rec = records.get(projectId);
  if (!rec) {
    return {
      hasPlan: false,
      summary: "",
      totalActions: 0,
      completedActions: 0,
      failedActions: 0,
      currentActionIndex: -1,
      cancelRequested: false,
      progress: 0,
      finished: true,
      startedAt: null,
      endedAt: null,
      totalToolCalls: 0,
      totalComplexity: 0,
      mutatesSpec: false,
      actions: [],
    };
  }
  return {
    hasPlan: true,
    summary: rec.plan.summary,
    totalActions: rec.plan.actions.length,
    completedActions: rec.state.completedActionIds.size,
    failedActions: rec.state.failedActionIds.size,
    currentActionIndex: rec.state.currentActionIndex,
    cancelRequested: rec.state.cancelRequested,
    progress: planProgress(rec.state),
    finished: isPlanFinished(rec.state),
    startedAt: rec.state.startedAt,
    endedAt: rec.state.endedAt,
    totalToolCalls: rec.plan.totalToolCalls,
    totalComplexity: rec.plan.totalComplexity,
    mutatesSpec: rec.plan.mutatesSpec,
    actions: rec.plan.actions.map((a) => ({
      id: a.id,
      type: a.type,
      description: a.description,
      toolCalls: a.toolCalls.length,
      complexity: a.complexity,
      mutatesSpec: a.mutatesSpec,
      status: rec.state.completedActionIds.has(a.id)
        ? "completed"
        : rec.state.failedActionIds.has(a.id)
          ? "failed"
          : "pending",
    })),
  };
}
