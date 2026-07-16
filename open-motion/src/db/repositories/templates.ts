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

/** Fuzzy search templates by query across name, description, category, and tags. */
export function searchTemplatesByQuery(query: string, limit = 30): Array<Template & { score: number; matchedFields: string[] }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter((t) => t.length > 0);
  const all = listTemplates();
  const scored: Array<Template & { score: number; matchedFields: string[] }> = [];

  for (const tpl of all) {
    const nameLc = tpl.name.toLowerCase();
    const descLc = tpl.description.toLowerCase();
    const catLc = tpl.category.toLowerCase();
    const tagsLc = tpl.tags.map((t) => t.toLowerCase());
    const fields: string[] = [];
    let score = 0;

    for (const term of terms) {
      // Name match — highest weight
      if (nameLc.includes(term)) {
        score += nameLc === term ? 10 : nameLc.startsWith(term) ? 7 : 5;
        if (!fields.includes("name")) fields.push("name");
      }
      // Tag exact match — high weight
      if (tagsLc.includes(term)) {
        score += 6;
        if (!fields.includes("tags")) fields.push("tags");
      }
      // Description match — medium weight
      if (descLc.includes(term)) {
        score += 3;
        if (!fields.includes("description")) fields.push("description");
      }
      // Category match — low weight
      if (catLc.includes(term)) {
        score += 2;
        if (!fields.includes("category")) fields.push("category");
      }
    }

    if (score > 0) {
      scored.push({ ...tpl, score, matchedFields: fields });
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
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
