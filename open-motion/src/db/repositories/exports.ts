import type { ExportJobStatus } from "@openmotion/shared";
import { createId, now } from "../../utils/id.js";
import { getDb, parseJson } from "../index.js";

interface ExportRow {
  id: string;
  project_id: string;
  format: string;
  status: string;
  params_json: string;
  file_path: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

function rowToStatus(r: ExportRow): ExportJobStatus {
  return {
    id: r.id,
    projectId: r.project_id,
    format: r.format,
    status: r.status as ExportJobStatus["status"],
    filePath: r.file_path,
    error: r.error,
    createdAt: r.created_at,
    completedAt: r.completed_at,
  };
}

export function createExportJob(projectId: string, format: string, params: unknown): ExportJobStatus {
  const db = getDb();
  const id = createId("e_");
  const ts = now();
  db.prepare(
    `INSERT INTO exports (id, project_id, format, status, params_json, file_path, error, created_at, completed_at)
     VALUES (?,?,?,?,?, NULL, NULL, ?, NULL)`,
  ).run(id, projectId, format, "pending", JSON.stringify(params), ts);
  return { id, projectId, format, status: "pending", filePath: null, error: null, createdAt: ts, completedAt: null };
}

export function getExportJob(id: string): ExportJobStatus | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM exports WHERE id = ?").get(id) as ExportRow | undefined;
  return row ? rowToStatus(row) : null;
}

export function updateExportJob(
  id: string,
  patch: Partial<Pick<ExportJobStatus, "status" | "filePath" | "error" | "completedAt">>,
): ExportJobStatus | null {
  const current = getExportJob(id);
  if (!current) return null;
  const next: ExportJobStatus = { ...current, ...patch };
  const db = getDb();
  db.prepare("UPDATE exports SET status=?, file_path=?, error=?, completed_at=? WHERE id=?").run(
    next.status,
    next.filePath,
    next.error,
    next.completedAt,
    id,
  );
  return next;
}
