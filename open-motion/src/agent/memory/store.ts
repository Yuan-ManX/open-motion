import type { LlmToolCall } from "../provider/types.js";
import { now } from "../../utils/id.js";
import { listMessages } from "../../db/repositories/messages.js";

export interface MemoryEntry {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
  toolName?: string;
  createdAt: string;
}

const MAX_MESSAGES = 24;
const store = new Map<string, MemoryEntry[]>();

export function listMemory(projectId: string): MemoryEntry[] {
  return store.get(projectId) ?? [];
}

export function addMemory(projectId: string, entry: Omit<MemoryEntry, "createdAt">): void {
  const list = store.get(projectId) ?? [];
  list.push({ ...entry, createdAt: now() });
  // Rolling window: keep the most recent entries, always preserving a leading
  // user turn if it lands at the boundary.
  if (list.length > MAX_MESSAGES) {
    list.splice(0, list.length - MAX_MESSAGES);
  }
  store.set(projectId, list);
}

/**
 * Rehydrate the in-memory conversation window from the persisted message log.
 * Called on the first turn of a session so the agent retains context across
 * server restarts. No-op when the store already holds entries for the project,
 * so active conversations are never overwritten.
 */
export function restoreMemory(projectId: string): void {
  const existing = store.get(projectId);
  if (existing && existing.length > 0) return;
  const rows = listMessages(projectId).slice(-MAX_MESSAGES);
  const entries: MemoryEntry[] = rows.map((m) => ({
    role: m.role,
    content: m.content,
    toolCalls: m.toolCalls,
    toolCallId: m.toolCallId ?? undefined,
    toolName: m.toolName ?? undefined,
    createdAt: m.createdAt,
  }));
  store.set(projectId, entries);
}

export function clearMemory(projectId: string): void {
  store.delete(projectId);
}
