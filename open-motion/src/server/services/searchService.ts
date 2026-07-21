/**
 * Full-text search service backed by SQLite FTS5 virtual tables.
 *
 * The schema (see db/schema.ts) defines one FTS5 table per searchable entity
 * (projects, components, messages, agent_memory, skills, generated_skills,
 * motion_recipes). Each table is kept in sync with its parent via INSERT /
 * UPDATE / DELETE triggers, so queries always reflect the current state.
 *
 * This service exposes a single `unifiedSearch` function that fans a query
 * out across every FTS5 table, ranks results by FTS5's bm25() relevance
 * score, and returns a merged, scope-tagged result list.
 */

import { getDb } from "../../db/index.js";

export type SearchScope =
  | "projects"
  | "components"
  | "messages"
  | "memory"
  | "skills"
  | "generated_skills"
  | "recipes"
  | "all";

export interface SearchHit {
  scope: Exclude<SearchScope, "all">;
  id: string;
  /** Project id when the hit is project-scoped (components, messages, memory). */
  projectId?: string;
  title: string;
  snippet: string;
  /** FTS5 bm25() relevance score (lower is more relevant). */
  rank: number;
}

export interface SearchOptions {
  query: string;
  scope?: SearchScope;
  /** Restrict project-scoped hits to a single project. */
  projectId?: string;
  /** Maximum results per scope. Default: 10. */
  limitPerScope?: number;
}

/**
 * Escape a raw user query into a safe FTS5 MATCH expression. We split on
 * whitespace and AND the terms together with prefix matching, so "fade in"
 * becomes "fade* in*". Quotes and special characters are stripped.
 */
function buildMatchExpression(raw: string): string {
  const cleaned = raw.replace(/["*^()\-+]/g, " ").trim();
  const tokens = cleaned.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return "";
  return tokens.map((t) => `${t}*`).join(" ");
}

interface ScopeQuery {
  scope: Exclude<SearchScope, "all">;
  sql: string;
  params: unknown[];
}

function buildScopeQueries(
  matchExpr: string,
  options: SearchOptions,
): ScopeQuery[] {
  const limit = options.limitPerScope ?? 10;
  const projectIdFilter = options.projectId ?? null;
  const scopes: Exclude<SearchScope, "all">[] =
    options.scope && options.scope !== "all"
      ? [options.scope]
      : ["projects", "components", "messages", "memory", "skills", "generated_skills", "recipes"];

  const queries: ScopeQuery[] = [];

  for (const scope of scopes) {
    let sql: string;
    const params: unknown[] = [matchExpr, limit];
    switch (scope) {
      case "projects":
        sql = `
          SELECT p.id AS id, p.name AS title, p.description AS snippet, bm25(projects_fts) AS rank
          FROM projects_fts
          JOIN projects p ON p.id = projects_fts.id
          WHERE projects_fts MATCH ?
          ORDER BY rank
          LIMIT ?`;
        break;
      case "components":
        if (projectIdFilter) {
          sql = `
            SELECT c.id AS id, c.project_id AS projectId, c.name AS title, COALESCE(c.selector, '') AS snippet, bm25(components_fts) AS rank
            FROM components_fts
            JOIN motion_components c ON c.id = components_fts.id
            WHERE components_fts MATCH ? AND c.project_id = ?
            ORDER BY rank
            LIMIT ?`;
          params.splice(1, 0, projectIdFilter);
        } else {
          sql = `
            SELECT c.id AS id, c.project_id AS projectId, c.name AS title, COALESCE(c.selector, '') AS snippet, bm25(components_fts) AS rank
            FROM components_fts
            JOIN motion_components c ON c.id = components_fts.id
            WHERE components_fts MATCH ?
            ORDER BY rank
            LIMIT ?`;
        }
        break;
      case "messages":
        if (projectIdFilter) {
          sql = `
            SELECT m.id AS id, m.project_id AS projectId, m.role AS title, substr(m.content, 1, 240) AS snippet, bm25(messages_fts) AS rank
            FROM messages_fts
            JOIN messages m ON m.id = messages_fts.id
            WHERE messages_fts MATCH ? AND m.project_id = ?
            ORDER BY rank
            LIMIT ?`;
          params.splice(1, 0, projectIdFilter);
        } else {
          sql = `
            SELECT m.id AS id, m.project_id AS projectId, m.role AS title, substr(m.content, 1, 240) AS snippet, bm25(messages_fts) AS rank
            FROM messages_fts
            JOIN messages m ON m.id = messages_fts.id
            WHERE messages_fts MATCH ?
            ORDER BY rank
            LIMIT ?`;
        }
        break;
      case "memory":
        if (projectIdFilter) {
          sql = `
            SELECT a.id AS id, a.project_id AS projectId, a.key AS title, substr(a.value, 1, 240) AS snippet, bm25(agent_memory_fts) AS rank
            FROM agent_memory_fts
            JOIN agent_memory a ON a.id = agent_memory_fts.id
            WHERE agent_memory_fts MATCH ? AND a.project_id = ?
            ORDER BY rank
            LIMIT ?`;
          params.splice(1, 0, projectIdFilter);
        } else {
          sql = `
            SELECT a.id AS id, a.project_id AS projectId, a.key AS title, substr(a.value, 1, 240) AS snippet, bm25(agent_memory_fts) AS rank
            FROM agent_memory_fts
            JOIN agent_memory a ON a.id = agent_memory_fts.id
            WHERE agent_memory_fts MATCH ?
            ORDER BY rank
            LIMIT ?`;
        }
        break;
      case "skills":
        sql = `
          SELECT s.id AS id, s.name AS title, substr(s.description, 1, 240) AS snippet, bm25(skills_fts) AS rank
          FROM skills_fts
          JOIN skills s ON s.id = skills_fts.id
          WHERE skills_fts MATCH ?
          ORDER BY rank
          LIMIT ?`;
        break;
      case "generated_skills":
        if (projectIdFilter) {
          sql = `
            SELECT g.id AS id, g.project_id AS projectId, g.name AS title, substr(g.description, 1, 240) AS snippet, bm25(generated_skills_fts) AS rank
            FROM generated_skills_fts
            JOIN generated_skills g ON g.id = generated_skills_fts.id
            WHERE generated_skills_fts MATCH ? AND g.project_id = ?
            ORDER BY rank
            LIMIT ?`;
          params.splice(1, 0, projectIdFilter);
        } else {
          sql = `
            SELECT g.id AS id, g.project_id AS projectId, g.name AS title, substr(g.description, 1, 240) AS snippet, bm25(generated_skills_fts) AS rank
            FROM generated_skills_fts
            JOIN generated_skills g ON g.id = generated_skills_fts.id
            WHERE generated_skills_fts MATCH ?
            ORDER BY rank
            LIMIT ?`;
        }
        break;
      case "recipes":
        sql = `
          SELECT r.id AS id, r.name AS title, substr(r.description, 1, 240) AS snippet, bm25(recipes_fts) AS rank
          FROM recipes_fts
          JOIN motion_recipes r ON r.id = recipes_fts.id
          WHERE recipes_fts MATCH ?
          ORDER BY rank
          LIMIT ?`;
        break;
      default:
        continue;
    }
    queries.push({ scope, sql, params });
  }
  return queries;
}

/**
 * Run a unified FTS5 search across the configured scopes. Results are
 * returned grouped by scope, then merged and sorted by rank so the most
 * relevant hits appear first regardless of which table they came from.
 */
export function unifiedSearch(options: SearchOptions): {
  query: string;
  total: number;
  hits: SearchHit[];
} {
  const matchExpr = buildMatchExpression(options.query);
  if (matchExpr.length === 0) {
    return { query: options.query, total: 0, hits: [] };
  }
  const db = getDb();
  const scopeQueries = buildScopeQueries(matchExpr, options);
  const hits: SearchHit[] = [];

  for (const { scope, sql, params } of scopeQueries) {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...(params as Parameters<typeof stmt.all>)) as Array<{
        id: string;
        projectId?: string;
        title: string;
        snippet: string;
        rank: number;
      }>;
      for (const row of rows) {
        hits.push({
          scope,
          id: row.id,
          projectId: row.projectId,
          title: row.title,
          snippet: row.snippet,
          rank: row.rank,
        });
      }
    } catch {
      // A scope failure (e.g. table missing in older databases) should not
      // abort the whole search — skip and continue with the remaining scopes.
    }
  }

  // Merge and sort by rank (lower bm25 = more relevant).
  hits.sort((a, b) => a.rank - b.rank);

  return { query: options.query, total: hits.length, hits };
}

/**
 * Backfill the FTS5 tables from existing parent rows. Called once on boot
 * after the schema is applied, so databases created before the FTS5 tables
 * were added are searchable without a manual rebuild.
 */
export function rebuildFtsIndexes(): { indexed: number } {
  const db = getDb();
  let indexed = 0;
  const tables: Array<{ fts: string; cols: string; sql: string }> = [
    {
      fts: "projects_fts",
      cols: "id, name, description",
      sql: "INSERT OR REPLACE INTO projects_fts(id, name, description) SELECT id, name, description FROM projects",
    },
    {
      fts: "components_fts",
      cols: "id, project_id, name, selector",
      sql: "INSERT OR REPLACE INTO components_fts(id, project_id, name, selector) SELECT id, project_id, name, COALESCE(selector, '') FROM motion_components",
    },
    {
      fts: "messages_fts",
      cols: "id, project_id, role, content",
      sql: "INSERT OR REPLACE INTO messages_fts(id, project_id, role, content) SELECT id, project_id, role, content FROM messages",
    },
    {
      fts: "agent_memory_fts",
      cols: "id, project_id, layer, key, value, tags_json",
      sql: "INSERT OR REPLACE INTO agent_memory_fts(id, project_id, layer, key, value, tags_json) SELECT id, project_id, layer, key, value, tags_json FROM agent_memory",
    },
    {
      fts: "skills_fts",
      cols: "id, name, description",
      sql: "INSERT OR REPLACE INTO skills_fts(id, name, description) SELECT id, name, description FROM skills",
    },
    {
      fts: "generated_skills_fts",
      cols: "id, project_id, name, description, trigger_pattern, skill_markdown",
      sql: "INSERT OR REPLACE INTO generated_skills_fts(id, project_id, name, description, trigger_pattern, skill_markdown) SELECT id, project_id, name, description, trigger_pattern, skill_markdown FROM generated_skills",
    },
    {
      fts: "recipes_fts",
      cols: "id, name, category, description, skill_markdown",
      sql: "INSERT OR REPLACE INTO recipes_fts(id, name, category, description, skill_markdown) SELECT id, name, category, description, skill_markdown FROM motion_recipes",
    },
  ];
  for (const { fts, sql } of tables) {
    try {
      // Clear and rebuild — cheaper than per-row upserts on cold start.
      db.exec(`DELETE FROM ${fts};`);
      // INSERT...SELECT returns no rows; use .run() and read changes.
      const result = db.prepare(sql).run();
      indexed += Number(result.changes ?? 0);
    } catch {
      // Skip on failure (e.g. parent table not yet created).
    }
  }
  return { indexed };
}
