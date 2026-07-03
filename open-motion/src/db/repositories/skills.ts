import type { Skill } from "@openmotion/shared";
import { getDb, parseJson } from "../index.js";

interface SkillRow {
  id: string;
  name: string;
  description: string;
  version: string;
  source_project_id: string | null;
  source_component_id: string | null;
  manifest_json: string;
  motion_spec_json: string;
  code_html: string | null;
  tags_json: string;
  created_at: string;
  updated_at: string;
}

function rowToSkill(r: SkillRow): Skill {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    version: r.version,
    sourceProjectId: r.source_project_id,
    sourceComponentId: r.source_component_id,
    manifest: parseJson(r.manifest_json, { name: r.name, description: r.description, version: r.version, outputType: "html", inputSchema: {} }),
    motionSpec: parseJson(r.motion_spec_json, { project: { id: "", name: "", description: "", scenes: [], tokens: {}, globalTiming: {}, status: "draft", sourceTemplateId: null, createdAt: "", updatedAt: "" }, components: [] }),
    codeHtml: r.code_html,
    tags: parseJson(r.tags_json, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listSkills(): Skill[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM skills ORDER BY created_at DESC").all() as unknown as SkillRow[];
  return rows.map(rowToSkill);
}

export function getSkill(id: string): Skill | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM skills WHERE id = ?").get(id) as unknown as SkillRow | undefined;
  return row ? rowToSkill(row) : null;
}

export function getSkillByName(name: string): Skill | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM skills WHERE name = ?").get(name) as unknown as SkillRow | undefined;
  return row ? rowToSkill(row) : null;
}

export function insertSkill(s: Skill): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO skills (id, name, description, version, source_project_id, source_component_id, manifest_json, motion_spec_json, code_html, tags_json, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    s.id,
    s.name,
    s.description,
    s.version,
    s.sourceProjectId,
    s.sourceComponentId,
    JSON.stringify(s.manifest),
    JSON.stringify(s.motionSpec),
    s.codeHtml,
    JSON.stringify(s.tags),
    s.createdAt,
    s.updatedAt,
  );
}

export function deleteSkill(id: string): boolean {
  const db = getDb();
  const info = db.prepare("DELETE FROM skills WHERE id = ?").run(id);
  return info.changes > 0;
}
