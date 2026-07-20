/**
 * Agent infrastructure tool executors — checkpoint, plan, and budget control.
 *
 * These tools expose the agent's meta-layer (snapshots, structured plan
 * state, cancellation) to the LLM so it can self-recover from bad mutations
 * and respect user-driven plan cancellation.
 */

import type { ToolName } from "@openmotion/shared";
import {
  capture,
  rollback,
  rollbackTo,
  listCheckpoints,
  isSpecMutating,
} from "../checkpointManager.js";
import type { ToolContext, ToolResult } from "./registry.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

/** Active plan execution states keyed by projectId (in-memory, single-flight). */
interface PlanStateEntry {
  planSummary: string;
  currentActionIndex: number;
  completed: number;
  failed: number;
  total: number;
  cancelRequested: boolean;
}

const planStates = new Map<string, PlanStateEntry>();

/** Update the active plan state for a project (called by the orchestrator). */
export function setPlanState(projectId: string, state: PlanStateEntry): void {
  planStates.set(projectId, state);
}

/** Clear the plan state when the plan completes or is cancelled. */
export function clearPlanState(projectId: string): void {
  planStates.delete(projectId);
}

export const agentExecutors: Partial<Record<ToolName, Executor>> = {
  rollback_last_action: (_args, ctx) => {
    const cp = rollback(ctx.projectId);
    if (!cp) {
      return {
        ok: false,
        summary: "no checkpoint available to roll back to",
        specChanged: false,
      };
    }
    return {
      ok: true,
      summary: `rolled back to checkpoint "${cp.label}" (${cp.componentCount} components)`,
      specChanged: true,
      data: { checkpointId: cp.id, componentCount: cp.componentCount },
    };
  },

  list_checkpoints: (_args, ctx) => {
    const checkpoints = listCheckpoints(ctx.projectId);
    return {
      ok: true,
      summary: `${checkpoints.length} checkpoint(s) available`,
      specChanged: false,
      data: checkpoints.map((c) => ({
        id: c.id,
        capturedAt: c.capturedAt,
        triggerTool: c.triggerTool,
        componentCount: c.componentCount,
        label: c.label,
      })),
    };
  },

  rollback_to_checkpoint: (args, ctx) => {
    const checkpointId = String(args.checkpointId);
    const cp = rollbackTo(ctx.projectId, checkpointId);
    if (!cp) {
      return {
        ok: false,
        summary: `checkpoint ${checkpointId} not found`,
        specChanged: false,
      };
    }
    return {
      ok: true,
      summary: `rolled back to checkpoint "${cp.label}" (${cp.componentCount} components)`,
      specChanged: true,
      data: { checkpointId: cp.id, componentCount: cp.componentCount },
    };
  },

  cancel_plan: (_args, ctx) => {
    const state = planStates.get(ctx.projectId);
    if (!state) {
      return {
        ok: false,
        summary: "no active plan to cancel",
        specChanged: false,
      };
    }
    state.cancelRequested = true;
    return {
      ok: true,
      summary: "plan cancellation requested — remaining actions will be skipped",
      specChanged: false,
    };
  },

  get_plan_state: (_args, ctx) => {
    const state = planStates.get(ctx.projectId);
    if (!state) {
      return {
        ok: true,
        summary: "no active structured plan — running in ReAct mode",
        specChanged: false,
        data: { active: false },
      };
    }
    return {
      ok: true,
      summary: `plan: ${state.completed}/${state.total} completed, ${state.failed} failed${state.cancelRequested ? " (cancel requested)" : ""}`,
      specChanged: false,
      data: { active: true, ...state },
    };
  },
};

/** Re-export for orchestrator convenience. */
export { capture, isSpecMutating };
