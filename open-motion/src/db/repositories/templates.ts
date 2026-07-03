import type { Template } from "@openmotion/shared";
import { getDb, parseJson } from "../index.js";

interface TemplateRow {
  id: string;
  name: string;
  category: string;
  description: string;
  spec_json: string;
  tags_json: string;
  preview_html: string | null;
  created_at: string;
}

function rowToTemplate(r: TemplateRow): Template {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
    tags: parseJson(r.tags_json, []),
    spec: parseJson(r.spec_json, {}),
    previewHtml: r.preview_html,
    createdAt: r.created_at,
  };
}

export function listTemplates(category?: string, tag?: string): Template[] {
  const db = getDb();
  let rows: TemplateRow[];
  if (category) {
    rows = db.prepare("SELECT * FROM templates WHERE category = ? ORDER BY name").all(category) as unknown as TemplateRow[];
  } else {
    rows = db.prepare("SELECT * FROM templates ORDER BY name").all() as unknown as TemplateRow[];
  }
  let result = rows.map(rowToTemplate);
  if (tag) result = result.filter((t) => t.tags.includes(tag));
  return result;
}

export function getTemplate(id: string): Template | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as unknown as TemplateRow | undefined;
  return row ? rowToTemplate(row) : null;
}

export function upsertTemplate(t: Template): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO templates (id, name, category, description, spec_json, tags_json, preview_html, created_at)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, description=excluded.description, spec_json=excluded.spec_json, tags_json=excluded.tags_json, preview_html=excluded.preview_html`,
  ).run(
    t.id,
    t.name,
    t.category,
    t.description,
    JSON.stringify(t.spec),
    JSON.stringify(t.tags),
    t.previewHtml,
    t.createdAt,
  );
}

export function countTemplates(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as n FROM templates").get() as unknown as { n: number };
  return row.n;
}
