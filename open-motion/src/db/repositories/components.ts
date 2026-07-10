import type { MotionComponent } from "@openmotion/shared";
import { now } from "../../utils/id.js";
import { getDb } from "../index.js";
import { rowToComponent } from "../mappers.js";

const INSERT_SQL = `INSERT INTO motion_components
  (id, project_id, scene_id, name, selector, template_id, duration_ms, delay_ms, iteration_count, direction, fill_mode, play_state, trigger, easing_json, keyframes_json, style_json, order_index, parent_id, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

export function createComponent(c: MotionComponent): void {
  const db = getDb();
  db.prepare(INSERT_SQL).run(
    c.id,
    c.projectId,
    c.sceneId,
    c.name,
    c.selector,
    c.templateId,
    c.durationMs,
    c.delayMs,
    c.iterationCount === "infinite" ? "infinite" : String(c.iterationCount),
    c.direction,
    c.fillMode,
    c.playState,
    c.trigger ?? "onLoad",
    JSON.stringify(c.easing),
    JSON.stringify(c.keyframes),
    JSON.stringify(c.style),
    c.orderIndex,
    c.parentId ?? null,
    c.createdAt,
    c.updatedAt,
  );
}

export function listComponents(projectId: string): MotionComponent[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM motion_components WHERE project_id = ? ORDER BY order_index")
    .all(projectId) as never[];
  return rows.map((r) => rowToComponent(r as never));
}

export function getComponent(projectId: string, componentId: string): MotionComponent | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM motion_components WHERE id = ? AND project_id = ?")
    .get(componentId, projectId) as never;
  return row ? rowToComponent(row as never) : null;
}

export type ComponentPatch = Partial<
  Pick<
    MotionComponent,
    | "name"
    | "selector"
    | "durationMs"
    | "delayMs"
    | "iterationCount"
    | "direction"
    | "fillMode"
    | "playState"
    | "trigger"
    | "easing"
    | "keyframes"
    | "style"
    | "orderIndex"
    | "sceneId"
    | "parentId"
  >
>;

export function patchComponent(
  projectId: string,
  componentId: string,
  patch: ComponentPatch,
): MotionComponent | null {
  const current = getComponent(projectId, componentId);
  if (!current) return null;
  const next: MotionComponent = { ...current, ...patch, updatedAt: now() };
  const db = getDb();
  db.prepare(
    `UPDATE motion_components SET
      name=?, selector=?, duration_ms=?, delay_ms=?, iteration_count=?, direction=?, fill_mode=?, play_state=?, trigger=?, easing_json=?, keyframes_json=?, style_json=?, order_index=?, scene_id=?, parent_id=?, updated_at=?
     WHERE id=? AND project_id=?`,
  ).run(
    next.name,
    next.selector,
    next.durationMs,
    next.delayMs,
    next.iterationCount === "infinite" ? "infinite" : String(next.iterationCount),
    next.direction,
    next.fillMode,
    next.playState,
    next.trigger ?? "onLoad",
    JSON.stringify(next.easing),
    JSON.stringify(next.keyframes),
    JSON.stringify(next.style),
    next.orderIndex,
    next.sceneId,
    next.parentId ?? null,
    next.updatedAt,
    componentId,
    projectId,
  );
  return next;
}

export function deleteComponent(projectId: string, componentId: string): boolean {
  const db = getDb();
  const info = db
    .prepare("DELETE FROM motion_components WHERE id = ? AND project_id = ?")
    .run(componentId, projectId);
  return info.changes > 0;
}
