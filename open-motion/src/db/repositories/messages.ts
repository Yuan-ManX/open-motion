import type { Message } from "@openmotion/shared";
import type { LlmToolCall } from "../../agent/provider/types.js";
import { createId, now } from "../../utils/id.js";
import { getDb } from "../index.js";

interface MessageRow {
  id: string;
  project_id: string;
  role: string;
  content: string;
  tool_calls_json: string | null;
  tool_call_id: string | null;
  tool_name: string | null;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}

function rowToMessage(r: MessageRow): Message {
  let toolCalls: LlmToolCall[] | undefined;
  if (r.tool_calls_json) {
    try {
      toolCalls = JSON.parse(r.tool_calls_json) as LlmToolCall[];
    } catch {
      toolCalls = undefined;
    }
  }
  return {
    id: r.id,
    projectId: r.project_id,
    role: r.role as Message["role"],
    content: r.content,
    toolName: r.tool_name,
    toolCalls,
    toolCallId: r.tool_call_id,
    createdAt: r.created_at,
  };
}

export function listMessages(projectId: string): Message[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC")
    .all(projectId) as unknown as MessageRow[];
  return rows.map(rowToMessage);
}

export interface AddMessageOpts {
  role: Message["role"];
  content: string;
  toolName?: string | null;
  toolCallsJson?: string | null;
  toolCallId?: string | null;
  tokensIn?: number;
  tokensOut?: number;
}

export function addMessage(projectId: string, opts: AddMessageOpts): Message {
  const db = getDb();
  const id = createId("m_");
  const ts = now();
  db.prepare(
    `INSERT INTO messages (id, project_id, role, content, tool_calls_json, tool_call_id, tool_name, tokens_in, tokens_out, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    projectId,
    opts.role,
    opts.content,
    opts.toolCallsJson ?? null,
    opts.toolCallId ?? null,
    opts.toolName ?? null,
    opts.tokensIn ?? 0,
    opts.tokensOut ?? 0,
    ts,
  );
  return { id, projectId, role: opts.role, content: opts.content, toolName: opts.toolName ?? null, createdAt: ts };
}

export function clearMessages(projectId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM messages WHERE project_id = ?").run(projectId);
}
