import { getDb } from "../index.js";
import { createId, now } from "../../utils/id.js";

/** A single step in a tool pipeline — a tool name and its arguments. */
export interface PipelineStep {
  tool: string;
  args: Record<string, unknown>;
  description?: string;
}

export interface ToolPipeline {
  id: string;
  projectId: string | null;
  name: string;
  description: string;
  steps: PipelineStep[];
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PipelineRow {
  id: string;
  project_id: string | null;
  name: string;
  description: string;
  steps_json: string;
  tags_json: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

function rowToPipeline(r: PipelineRow): ToolPipeline {
  let steps: PipelineStep[] = [];
  try {
    steps = JSON.parse(r.steps_json) as PipelineStep[];
  } catch {
    steps = [];
  }
  let tags: string[] = [];
  try {
    tags = JSON.parse(r.tags_json) as string[];
  } catch {
    tags = [];
  }
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    description: r.description,
    steps,
    tags,
    usageCount: r.usage_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** List all pipelines for a project (project-scoped + global). */
export function listPipelines(projectId: string): ToolPipeline[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM tool_pipelines WHERE project_id = ? OR project_id IS NULL ORDER BY updated_at DESC`,
    )
    .all(projectId) as never[];
  return rows.map((r) => rowToPipeline(r as unknown as PipelineRow));
}

/** Get a single pipeline by id. */
export function getPipeline(id: string): ToolPipeline | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM tool_pipelines WHERE id = ?`).get(id) as never;
  return row ? rowToPipeline(row as unknown as PipelineRow) : null;
}

export interface CreatePipelineInput {
  projectId?: string;
  name: string;
  description?: string;
  steps: PipelineStep[];
  tags?: string[];
}

/** Create a new tool pipeline. */
export function createPipeline(input: CreatePipelineInput): ToolPipeline {
  const db = getDb();
  const id = createId("pipe_");
  const ts = now();
  db.prepare(
    `INSERT INTO tool_pipelines (id, project_id, name, description, steps_json, tags_json, usage_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  ).run(
    id,
    input.projectId ?? null,
    input.name,
    input.description ?? "",
    JSON.stringify(input.steps),
    JSON.stringify(input.tags ?? []),
    ts,
    ts,
  );
  return getPipeline(id)!;
}

export interface UpdatePipelinePatch {
  name?: string;
  description?: string;
  steps?: PipelineStep[];
  tags?: string[];
}

/** Update an existing pipeline's metadata or steps. */
export function updatePipeline(id: string, patch: UpdatePipelinePatch): ToolPipeline | null {
  const current = getPipeline(id);
  if (!current) return null;
  const db = getDb();
  const ts = now();
  db.prepare(
    `UPDATE tool_pipelines SET name=?, description=?, steps_json=?, tags_json=?, updated_at=? WHERE id=?`,
  ).run(
    patch.name ?? current.name,
    patch.description ?? current.description,
    JSON.stringify(patch.steps ?? current.steps),
    JSON.stringify(patch.tags ?? current.tags),
    ts,
    id,
  );
  return getPipeline(id);
}

/** Delete a pipeline. */
export function deletePipeline(id: string): boolean {
  const db = getDb();
  const info = db.prepare(`DELETE FROM tool_pipelines WHERE id = ?`).run(id);
  return info.changes > 0;
}

/** Increment the usage counter when a pipeline is replayed. */
export function incrementUsage(id: string): void {
  const db = getDb();
  db.prepare(`UPDATE tool_pipelines SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?`).run(
    now(),
    id,
  );
}
