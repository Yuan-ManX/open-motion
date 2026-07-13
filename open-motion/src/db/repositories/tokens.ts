import { getDb } from "../index.js";
import { createId, now } from "../../utils/id.js";

export type TokenCategory = "duration" | "easing" | "color" | "spacing" | "radius" | "shadow" | "font";

export interface MotionToken {
  id: string;
  projectId: string;
  name: string;
  category: TokenCategory;
  value: string;
  description: string;
  createdAt: string;
}

interface TokenRow {
  id: string;
  project_id: string;
  name: string;
  category: string;
  value: string;
  description: string;
  created_at: string;
}

function rowToToken(r: TokenRow): MotionToken {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    category: r.category as TokenCategory,
    value: r.value,
    description: r.description,
    createdAt: r.created_at,
  };
}

export function listTokens(projectId: string, category?: string): MotionToken[] {
  const db = getDb();
  const rows = category
    ? (db
        .prepare("SELECT * FROM motion_tokens WHERE project_id = ? AND category = ? ORDER BY name")
        .all(projectId, category) as never[])
    : (db
        .prepare("SELECT * FROM motion_tokens WHERE project_id = ? ORDER BY category, name")
        .all(projectId) as never[]);
  return rows.map((r) => rowToToken(r as unknown as TokenRow));
}

export function getToken(projectId: string, name: string): MotionToken | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM motion_tokens WHERE project_id = ? AND name = ?")
    .get(projectId, name) as never;
  return row ? rowToToken(row as unknown as TokenRow) : null;
}

export interface CreateTokenInput {
  projectId: string;
  name: string;
  category: TokenCategory;
  value: string;
  description?: string;
}

export function createToken(input: CreateTokenInput): MotionToken {
  const db = getDb();
  const id = createId("tok_");
  const ts = now();
  db.prepare(
    `INSERT INTO motion_tokens (id, project_id, name, category, value, description, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.projectId, input.name, input.category, input.value, input.description ?? "", ts);
  return getToken(input.projectId, input.name)!;
}

export function updateToken(
  projectId: string,
  name: string,
  patch: Partial<Pick<MotionToken, "value" | "description" | "category">>,
): MotionToken | null {
  const current = getToken(projectId, name);
  if (!current) return null;
  const next = { ...current, ...patch };
  const db = getDb();
  db.prepare(
    `UPDATE motion_tokens SET value=?, description=?, category=? WHERE project_id=? AND name=?`,
  ).run(next.value, next.description, next.category, projectId, name);
  return getToken(projectId, name);
}

export function deleteToken(projectId: string, name: string): boolean {
  const db = getDb();
  const info = db
    .prepare("DELETE FROM motion_tokens WHERE project_id = ? AND name = ?")
    .run(projectId, name);
  return info.changes > 0;
}

export function deleteTokenById(id: string): boolean {
  const db = getDb();
  const info = db.prepare("DELETE FROM motion_tokens WHERE id = ?").run(id);
  return info.changes > 0;
}

/** Resolve a token reference ($name) to its value within a project. */
export function resolveToken(projectId: string, ref: string): string | null {
  if (!ref.startsWith("$")) return null;
  const name = ref.slice(1);
  const token = getToken(projectId, name);
  return token?.value ?? null;
}

/** Seed a starter set of design tokens when a project is created. */
export function seedDefaultTokens(projectId: string): void {
  const defaults: Omit<CreateTokenInput, "projectId">[] = [
    { name: "fast", category: "duration", value: "200ms", description: "Quick feedback duration" },
    { name: "normal", category: "duration", value: "400ms", description: "Standard duration" },
    { name: "slow", category: "duration", value: "800ms", description: "Deliberate duration" },
    { name: "bounce", category: "easing", value: "cubic-bezier(0.68,-0.55,0.27,1.55)", description: "Overshoot easing" },
    { name: "smooth", category: "easing", value: "cubic-bezier(0.4,0,0.2,1)", description: "Smooth in-out" },
    { name: "snappy", category: "easing", value: "cubic-bezier(0.4,0,1,1)", description: "Decisive ease-in" },
  ];
  for (const t of defaults) {
    if (!getToken(projectId, t.name)) {
      createToken({ ...t, projectId });
    }
  }
}
