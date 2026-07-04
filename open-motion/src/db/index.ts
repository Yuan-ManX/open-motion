import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "data");
const DB_PATH = join(DATA_DIR, "openmotion.db");

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  _db = db;
  logger.info("SQLite opened", { path: DB_PATH });
  return db;
}

export const dataDir = DATA_DIR;
export const exportsDir = join(DATA_DIR, "exports");
export const renderedDir = join(DATA_DIR, "rendered");

export function ensureDirs() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(exportsDir, { recursive: true });
  mkdirSync(renderedDir, { recursive: true });
}

/** Parse a JSON column that may be NULL into a typed object (with fallback). */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
