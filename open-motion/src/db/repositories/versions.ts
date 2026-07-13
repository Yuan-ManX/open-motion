import { getDb } from "../index.js";
import type { MotionSpec, MotionComponent } from "@openmotion/shared";
import { getProjectSpec, updateProject } from "./projects.js";
import { createComponent } from "./components.js";
import { createId, now } from "../../utils/id.js";

export interface VersionRow {
  id: string;
  projectId: string;
  label: string;
  specJson: string;
  componentCount: number;
  createdAt: string;
}

export interface VersionSummary {
  id: string;
  projectId: string;
  label: string;
  componentCount: number;
  createdAt: string;
}

function rowToSummary(r: Record<string, unknown>): VersionSummary {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    label: r.label as string,
    componentCount: r.component_count as number,
    createdAt: r.created_at as string,
  };
}

/** Capture the current project spec as a named version snapshot. */
export function saveVersion(projectId: string, label: string): VersionSummary | null {
  const spec = getProjectSpec(projectId);
  if (!spec) return null;
  const db = getDb();
  const id = createId("ver_");
  const ts = now();
  db.prepare(
    `INSERT INTO project_versions (id, project_id, label, spec_json, component_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, projectId, label, JSON.stringify(spec), spec.components.length, ts);
  return { id, projectId, label, componentCount: spec.components.length, createdAt: ts };
}

/** List all version snapshots for a project, newest first. */
export function listVersions(projectId: string): VersionSummary[] {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, project_id, label, component_count, created_at
     FROM project_versions WHERE project_id = ? ORDER BY created_at DESC`,
  ).all(projectId) as Record<string, unknown>[];
  return rows.map(rowToSummary);
}

/** Load the full spec from a version snapshot. */
export function getVersion(versionId: string): MotionSpec | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT spec_json FROM project_versions WHERE id = ?`,
  ).get(versionId) as { spec_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.spec_json) as MotionSpec;
  } catch {
    return null;
  }
}

/** Delete a version snapshot. */
export function deleteVersion(versionId: string): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM project_versions WHERE id = ?`).run(versionId);
  return result.changes > 0;
}

/** Count versions for a project (for budget enforcement). */
export function countVersions(projectId: string): number {
  const db = getDb();
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM project_versions WHERE project_id = ?`,
  ).get(projectId) as { cnt: number };
  return row.cnt;
}

/** Prune oldest versions beyond a keep-limit (FIFO eviction). */
export function pruneVersions(projectId: string, keepLimit: number): number {
  const db = getDb();
  const count = countVersions(projectId);
  if (count <= keepLimit) return 0;
  const toRemove = count - keepLimit;
  db.prepare(
    `DELETE FROM project_versions WHERE id IN (
       SELECT id FROM project_versions WHERE project_id = ?
       ORDER BY created_at ASC LIMIT ?
     )`,
  ).run(projectId, toRemove);
  return toRemove;
}

/**
 * Restore a project to a previously captured version snapshot.
 * Deletes all current components and re-creates them from the snapshot.
 * Returns the restored spec or null if the version was not found.
 */
export function restoreVersion(versionId: string): MotionSpec | null {
  const spec = getVersion(versionId);
  if (!spec) return null;
  const db = getDb();
  const projectId = spec.project.id;

  // Wipe existing components and replace with the snapshot's components.
  db.prepare(`DELETE FROM motion_components WHERE project_id = ?`).run(projectId);

  // Restore project-level metadata (scenes, tokens, timing, name).
  updateProject(projectId, {
    name: spec.project.name,
    description: spec.project.description,
    scenes: spec.project.scenes,
    tokens: spec.project.tokens,
    globalTiming: spec.project.globalTiming,
  });

  // Re-create each component from the snapshot with fresh timestamps.
  const ts = now();
  for (const comp of spec.components) {
    const restored: MotionComponent = {
      ...comp,
      createdAt: ts,
      updatedAt: ts,
    };
    createComponent(restored);
  }

  // Prune to keep a reasonable version history budget.
  pruneVersions(projectId, 30);

  return getProjectSpec(projectId);
}
