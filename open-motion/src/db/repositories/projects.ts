import type { MotionProject, MotionSpec } from "@openmotion/shared";
import { createId, now } from "../../utils/id.js";
import { getDb } from "../index.js";
import { rowToProject, rowToComponent, assembleSpec } from "../mappers.js";
import { instantiateTemplate } from "../../motion/templates/index.js";
import { createComponent } from "./components.js";

export function listProjects(): MotionProject[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all() as never[];
  return rows.map(rowToProject);
}

export function getProject(id: string): MotionProject | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as never;
  return row ? rowToProject(row) : null;
}

export interface CreateProjectOpts {
  name?: string;
  templateId?: string;
}

export function createProject(opts: CreateProjectOpts = {}): MotionProject {
  const db = getDb();
  const id = createId("p_");
  const ts = now();
  const tpl = opts.templateId ? instantiateTemplate(opts.templateId, id) : [];
  const name = opts.name ?? (opts.templateId ? "Untitled motion" : "Untitled motion");
  const sourceTemplateId = opts.templateId ?? null;
  db.prepare(
    `INSERT INTO projects (id, name, description, scenes_json, tokens_json, global_timing_json, status, source_template_id, created_at, updated_at)
     VALUES (?, ?, '', '[]', '{}', '{}', 'draft', ?, ?, ?)`,
  ).run(id, name, sourceTemplateId, ts, ts);
  for (const c of tpl) createComponent(c);
  return getProject(id)!;
}

export function updateProject(
  id: string,
  patch: Partial<Pick<MotionProject, "name" | "description" | "scenes" | "tokens" | "globalTiming" | "status">>,
): MotionProject | null {
  const current = getProject(id);
  if (!current) return null;
  const next: MotionProject = { ...current, ...patch, updatedAt: now() };
  const db = getDb();
  db.prepare(
    `UPDATE projects SET name=?, description=?, scenes_json=?, tokens_json=?, global_timing_json=?, status=?, updated_at=? WHERE id=?`,
  ).run(
    next.name,
    next.description,
    JSON.stringify(next.scenes),
    JSON.stringify(next.tokens),
    JSON.stringify(next.globalTiming),
    next.status,
    next.updatedAt,
    id,
  );
  return next;
}

export function deleteProject(id: string): boolean {
  const db = getDb();
  const info = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return info.changes > 0;
}

interface ComponentRow {
  scene_id: string | null;
  name: string;
  selector: string | null;
  template_id: string | null;
  duration_ms: number;
  delay_ms: number;
  iteration_count: number | string;
  direction: string | null;
  fill_mode: string | null;
  play_state: string | null;
  trigger: string | null;
  easing_json: string;
  keyframes_json: string;
  style_json: string;
  order_index: number;
}

export function duplicateProject(id: string): MotionProject | null {
  const src = getProject(id);
  if (!src) return null;
  const copy = createProject({ name: `${src.name} copy` });
  const db = getDb();
  const rows = db.prepare("SELECT * FROM motion_components WHERE project_id = ? ORDER BY order_index").all(id) as never[];
  for (const row of rows) {
    const r = row as unknown as ComponentRow;
    const newId = createId("c_");
    const ts = now();
    db.prepare(
      `INSERT INTO motion_components (id, project_id, scene_id, name, selector, template_id, duration_ms, delay_ms, iteration_count, direction, fill_mode, play_state, trigger, easing_json, keyframes_json, style_json, order_index, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      newId,
      copy.id,
      r.scene_id,
      r.name,
      r.selector,
      r.template_id,
      r.duration_ms,
      r.delay_ms,
      r.iteration_count,
      r.direction,
      r.fill_mode,
      r.play_state,
      r.trigger ?? "onLoad",
      r.easing_json,
      r.keyframes_json,
      r.style_json,
      r.order_index,
      ts,
      ts,
    );
  }
  return getProject(copy.id);
}

export function getProjectSpec(id: string): MotionSpec | null {
  const project = getProject(id);
  if (!project) return null;
  const db = getDb();
  const rows = db.prepare("SELECT * FROM motion_components WHERE project_id = ? ORDER BY order_index").all(id) as never[];
  const components = rows.map((r) => rowToComponent(r as never));
  return assembleSpec(project, components);
}
