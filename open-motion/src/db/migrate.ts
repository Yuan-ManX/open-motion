import { getDb } from "./index.js";
import { SCHEMA_SQL } from "./schema.js";
import { seedTemplates, countTemplates } from "./seed.js";
import { logger } from "../utils/logger.js";

export function migrate(): void {
  const db = getDb();
  db.exec(SCHEMA_SQL);
  logger.info("DB schema applied");
  if (countTemplates() === 0) {
    seedTemplates();
    logger.info("Template library seeded");
  } else {
    seedTemplates(); // upsert keeps previews fresh as the engine evolves
    logger.debug("Template library refreshed");
  }
}
