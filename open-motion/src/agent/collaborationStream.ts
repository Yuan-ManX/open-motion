/**
 * Streaming Collaboration Engine — emits real-time progress events as each
 * collaboration module completes its analysis, enabling the frontend to render
 * live progress indicators during multi-module motion synthesis.
 */

import type { CollaborationPlan, CollaborationResult, SubTaskResult } from "./motionCollaboration.js";
import { executeModule, mergeResults, planCollaboration } from "./motionCollaboration.js";
import { consensusVote, type ConsensusBallot } from "./consensusVote.js";

// ---------------------------------------------------------------------------
// Event Types
// ---------------------------------------------------------------------------

export type CollaborationStreamEvent =
  | { type: "plan"; plan: CollaborationPlan }
  | { type: "module_start"; moduleId: string; moduleName: string; objective: string }
  | { type: "module_done"; moduleId: string; moduleName: string; confidence: number; notes: string }
  | { type: "module_error"; moduleId: string; error: string }
  | { type: "merge_start" }
  | { type: "merge_done"; conflictResolutions: string[] }
  | { type: "done"; result: CollaborationResult }
  | { type: "error"; message: string };

export type CollaborationStreamCallback = (event: CollaborationStreamEvent) => void;

// ---------------------------------------------------------------------------
// Streaming Executor
// ---------------------------------------------------------------------------

/**
 * Execute a collaboration plan with streaming progress events.
 * Each module runs sequentially (respecting dependencies) and emits a
 * module_start/module_done event pair so the UI can show live progress.
 *
 * If a module throws, it is skipped with a module_error event and the
 * collaboration continues with remaining modules — graceful degradation
 * ensures the user always gets a result.
 */
export function executeCollaborationStream(
  plan: CollaborationPlan,
  callback: CollaborationStreamCallback,
): CollaborationResult {
  callback({ type: "plan", plan });

  if (plan.subTasks.length === 0) {
    const result = mergeResults([], plan.request);
    callback({ type: "done", result });
    return result;
  }

  const results: SubTaskResult[] = [];
  const executed = new Set<string>();
  const pending = [...plan.subTasks];

  while (pending.length > 0) {
    const ready = pending.filter(
      (t) => t.dependsOn.every((dep) => executed.has(dep)) || t.dependsOn.length === 0,
    );

    if (ready.length === 0) {
      // Circular dependency or all remaining tasks have unmet deps
      callback({ type: "error", message: "Unresolvable task dependencies in collaboration plan" });
      break;
    }

    for (const task of ready) {
      const moduleInfo = plan.modules.find((m) => m.id === task.moduleId);
      const moduleName = moduleInfo?.name ?? task.moduleId;

      callback({
        type: "module_start",
        moduleId: task.moduleId,
        moduleName,
        objective: task.objective,
      });

      try {
        const result = executeModule(task);
        results.push(result);
        executed.add(task.id);

        callback({
          type: "module_done",
          moduleId: task.moduleId,
          moduleName,
          confidence: result.confidence,
          notes: result.notes,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        callback({
          type: "module_error",
          moduleId: task.moduleId,
          error: errorMsg,
        });
        executed.add(task.id);
      }
    }

    // Remove executed tasks from pending
    for (let i = pending.length - 1; i >= 0; i--) {
      if (executed.has(pending[i].id)) {
        pending.splice(i, 1);
      }
    }
  }

  // Merge phase with consensus voting
  callback({ type: "merge_start" });

  const result = mergeWithConsensus(results, plan.request);

  callback({
    type: "merge_done",
    conflictResolutions: result.conflictResolutions,
  });

  callback({ type: "done", result });
  return result;
}

/**
 * Merge results using consensus voting when multiple modules disagree.
 * Falls back to the standard mergeResults when only one module contributed.
 */
function mergeWithConsensus(
  results: SubTaskResult[],
  request: string,
): CollaborationResult {
  if (results.length <= 1) {
    return mergeResults(results, request);
  }

  // Build ballots for easing and duration conflicts
  const easingBallots: ConsensusBallot[] = results
    .filter((r) => r.motionParams.easing)
    .map((r) => ({
      voter: r.moduleId,
      choice: r.motionParams.easing!,
      weight: r.confidence,
    }));

  const durationBallots: ConsensusBallot[] = results
    .filter((r) => r.motionParams.durationMs)
    .map((r) => ({
      voter: r.moduleId,
      choice: String(r.motionParams.durationMs!),
      weight: r.confidence,
    }));

  // If we have disagreements, use consensus voting
  const easingChoices = new Set(easingBallots.map((b) => b.choice));
  const durationChoices = new Set(durationBallots.map((b) => b.choice));

  let conflictResolutions: string[] = [];

  if (easingChoices.size > 1 || durationChoices.size > 1) {
    const easingWinner = easingChoices.size > 1 ? consensusVote(easingBallots) : null;
    const durationWinner = durationChoices.size > 1 ? consensusVote(durationBallots) : null;

    if (easingWinner) {
      conflictResolutions.push(
        `Easing consensus: "${easingWinner.winner}" won with ${easingWinner.score.toFixed(2)} Borda score ` +
        `(consensus strength: ${(easingWinner.consensusStrength * 100).toFixed(0)}%)`,
      );
    }
    if (durationWinner) {
      conflictResolutions.push(
        `Duration consensus: ${durationWinner.winner}ms won with ${durationWinner.score.toFixed(2)} Borda score ` +
        `(consensus strength: ${(durationWinner.consensusStrength * 100).toFixed(0)}%)`,
      );
    }
  }

  // Use standard merge for the actual component creation
  const merged = mergeResults(results, request);

  // Append consensus resolutions to the existing ones
  merged.conflictResolutions = [...merged.conflictResolutions, ...conflictResolutions];

  return merged;
}

/**
 * High-level convenience: plan and execute a collaboration with streaming.
 */
export function collaborateStream(
  request: string,
  callback: CollaborationStreamCallback,
): CollaborationResult {
  const plan = planCollaboration(request);
  return executeCollaborationStream(plan, callback);
}
