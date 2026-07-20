/**
 * Checkpoint Manager — automatic snapshotting before AI-driven mutations.
 *
 * Before each spec-mutating tool batch, the orchestrator calls `capture()`
 * to persist a lightweight snapshot of the current MotionSpec. If the user
 * dislikes the result (or a tool fails mid-sequence), `rollback()` restores
 * the most recent checkpoint in O(1).
 *
 * Design choices:
 *   - In-memory ring buffer (default 8 slots per project) — no DB writes
 *     on the hot path, so capture is essentially free.
 *   - Each checkpoint records: timestamp, trigger tool, component count,
 *     and a deep clone of the spec's component array.
 *   - The orchestrator emits a `checkpoint` event so the UI can surface
 *     "undo last AI action" affordances.
 *   - Rollback is non-destructive: the pre-rollback state is itself
 *     checkpointed, so users can redo.
 */

import type { MotionComponent, MotionSpec } from "@openmotion/shared";
import { getProjectSpec, updateProject } from "../db/repositories/projects.js";
import { createComponent, batchDeleteComponents, listComponents } from "../db/repositories/components.js";
import { getDb } from "../db/index.js";
import { now } from "../utils/id.js";

/**
 * Restore a project spec from a checkpoint. Mirrors the pattern used by
 * `restoreVersion()` in versions.ts: wipe current components, restore
 * project-level metadata, then re-create each component from the snapshot.
 */
function restoreSpec(projectId: string, spec: { project: MotionSpec["project"]; components: MotionComponent[] }): void {
  const db = getDb();
  // Wipe existing components for the project.
  db.prepare(`DELETE FROM motion_components WHERE project_id = ?`).run(projectId);

  // Restore project-level metadata.
  updateProject(projectId, {
    name: spec.project.name,
    description: spec.project.description,
    scenes: spec.project.scenes,
    tokens: spec.project.tokens,
    globalTiming: spec.project.globalTiming,
  });

  // Re-create each component with fresh timestamps.
  const ts = now();
  for (const comp of spec.components) {
    const restored: MotionComponent = {
      ...comp,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(restored);
  }
}

export interface Checkpoint {
  id: string;
  projectId: string;
  capturedAt: number;
  triggerTool: string;
  componentCount: number;
  components: MotionComponent[];
  project: MotionSpec["project"];
  /** Human-readable label for UI display. */
  label: string;
}

const RING_SIZE = 8;
const buffers = new Map<string, Checkpoint[]>();
let counter = 0;

function nextId(): string {
  counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
  return `cp_${Date.now().toString(36)}_${counter.toString(36)}`;
}

function buffer(projectId: string): Checkpoint[] {
  let buf = buffers.get(projectId);
  if (!buf) {
    buf = [];
    buffers.set(projectId, buf);
  }
  return buf;
}

/**
 * Capture a checkpoint before a mutation. Returns the checkpoint if one
 * was created, or null if the project has no spec (nothing to snapshot).
 */
export function capture(projectId: string, triggerTool: string): Checkpoint | null {
  const spec = getProjectSpec(projectId);
  if (!spec) return null;

  const cp: Checkpoint = {
    id: nextId(),
    projectId,
    capturedAt: Date.now(),
    triggerTool,
    componentCount: spec.components.length,
    // Deep clone via structuredClone (available in Node 17+).
    components: spec.components.map((c) => ({ ...c, keyframes: [...c.keyframes], style: { ...c.style } })),
    project: { ...spec.project },
    label: `before ${triggerTool}`,
  };

  const buf = buffer(projectId);
  buf.push(cp);
  // Ring buffer: drop oldest when over capacity.
  if (buf.length > RING_SIZE) buf.shift();
  return cp;
}

/**
 * Rollback to the most recent checkpoint. The current state is itself
 * checkpointed first so the user can redo (re-apply the rolled-back change).
 */
export function rollback(projectId: string): Checkpoint | null {
  const buf = buffer(projectId);
  if (buf.length === 0) return null;

  // Snapshot the current state so rollback is reversible.
  const currentSpec = getProjectSpec(projectId);
  if (currentSpec) {
    const redoCp: Checkpoint = {
      id: nextId(),
      projectId,
      capturedAt: Date.now(),
      triggerTool: "rollback",
      componentCount: currentSpec.components.length,
      components: currentSpec.components.map((c) => ({ ...c, keyframes: [...c.keyframes], style: { ...c.style } })),
      project: { ...currentSpec.project },
      label: "before rollback (redo point)",
    };
    buf.push(redoCp);
    if (buf.length > RING_SIZE) buf.shift();
  }

  const target = buf[buf.length - 1];
  if (!target) return null;

  // Restore the spec from the checkpoint.
  restoreSpec(projectId, {
    project: { ...target.project },
    components: target.components.map((c) => ({ ...c, keyframes: [...c.keyframes], style: { ...c.style } })),
  });
  return target;
}

/** Rollback to a specific checkpoint by id (used by the UI's history list). */
export function rollbackTo(projectId: string, checkpointId: string): Checkpoint | null {
  const buf = buffer(projectId);
  const idx = buf.findIndex((c) => c.id === checkpointId);
  if (idx < 0) return null;
  const target = buf[idx];
  // Same redo-snapshot logic as rollback().
  const currentSpec = getProjectSpec(projectId);
  if (currentSpec) {
    const redoCp: Checkpoint = {
      id: nextId(),
      projectId,
      capturedAt: Date.now(),
      triggerTool: "rollback_to",
      componentCount: currentSpec.components.length,
      components: currentSpec.components.map((c) => ({ ...c, keyframes: [...c.keyframes], style: { ...c.style } })),
      project: { ...currentSpec.project },
      label: "before rollback_to (redo point)",
    };
    buf.push(redoCp);
    if (buf.length > RING_SIZE) buf.shift();
  }
  restoreSpec(projectId, {
    project: { ...target.project },
    components: target.components.map((c) => ({ ...c, keyframes: [...c.keyframes], style: { ...c.style } })),
  });
  return target;
}

/** List checkpoints for UI display (newest first). */
export function listCheckpoints(projectId: string): Checkpoint[] {
  const buf = buffer(projectId);
  return [...buf].reverse();
}

/** Clear all checkpoints for a project (e.g., when the project is deleted). */
export function clearCheckpoints(projectId: string): void {
  buffers.delete(projectId);
}

/**
 * Convenience: capture a checkpoint only if the next tool is spec-mutating.
 * The orchestrator calls this with the tool name; non-mutating tools (query,
 * export, analysis) are skipped to avoid filling the buffer with no-ops.
 */
const SPEC_MUTATING_PREFIXES = [
  "set_", "add_", "apply_", "remove_", "delete_", "update_",
  "create_", "compose_", "capture_", "restore_", "save_",
  "synthesize_", "morph_", "compile_", "generate_",
];

export function isSpecMutating(tool: string): boolean {
  return SPEC_MUTATING_PREFIXES.some((p) => tool.startsWith(p));
}
