import { getDb } from "./index.js";
import { SCHEMA_SQL } from "./schema.js";
import { seedTemplates, countTemplates } from "./seed.js";
import { seedRecipes } from "../motion/recipes.js";
import { logger } from "../utils/logger.js";

/** Columns added after initial release; applied idempotently to existing DBs. */
const COLUMN_MIGRATIONS: { table: string; column: string; ddl: string }[] = [
  { table: "motion_components", column: "trigger", ddl: "TEXT NOT NULL DEFAULT 'onLoad'" },
  { table: "motion_components", column: "parent_id", ddl: "TEXT" },
];

/** Add a column if it isn't present yet (SQLite lacks ADD COLUMN IF NOT EXISTS). */
function ensureColumns(): void {
  const db = getDb();
  for (const { table, column, ddl } of COLUMN_MIGRATIONS) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl};`);
      logger.info("migration: added column", { table, column });
    }
  }
}

export function migrate(): void {
  const db = getDb();
  db.exec(SCHEMA_SQL);
  ensureColumns();
  logger.info("DB schema applied");
  if (countTemplates() === 0) {
    seedTemplates();
    logger.info("Template library seeded");
  } else {
    seedTemplates(); // upsert keeps previews fresh as the engine evolves
    logger.debug("Template library refreshed");
  }
  seedRecipes();
  logger.info("Motion recipe library seeded");
}
