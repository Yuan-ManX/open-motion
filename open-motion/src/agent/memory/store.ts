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
const COMPRESS_THRESHOLD = 30;
const COMPRESS_KEEP = 20;
const store = new Map<string, MemoryEntry[]>();

export function listMemory(projectId: string): MemoryEntry[] {
  return store.get(projectId) ?? [];
}

export function addMemory(projectId: string, entry: Omit<MemoryEntry, "createdAt">): void {
  const list = store.get(projectId) ?? [];
  list.push({ ...entry, createdAt: now() });
  if (list.length > MAX_MESSAGES) {
    // Preserve the first user turn so the agent never loses the original intent.
    const firstUserIdx = list.findIndex((m) => m.role === "user");
    const keep = list.slice(list.length - MAX_MESSAGES);
    if (firstUserIdx >= 0 && firstUserIdx < list.length - MAX_MESSAGES) {
      keep.unshift(list[firstUserIdx]);
    }
    store.set(projectId, keep);
    return;
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

/**
 * Structured context compression. When the transcript exceeds the threshold,
 * produce a summary entry capturing the goal, progress, decisions, and next
 * step — then keep only the most recent entries. This preserves semantic
 * continuity without requiring an LLM for summarization, so mock mode stays
 * fully functional.
 */
export function compressMemory(projectId: string): void {
  const list = store.get(projectId);
  if (!list || list.length <= COMPRESS_THRESHOLD) return;

  // Extract the original goal (first user message).
  const firstUser = list.find((m) => m.role === "user");
  const goal = firstUser ? firstUser.content.slice(0, 200) : "(unknown)";

  // Count progress: tool calls and component-related actions.
  let toolCallCount = 0;
  const decisions: string[] = [];
  for (const m of list) {
    if (m.toolCalls) toolCallCount += m.toolCalls.length;
    if (m.role === "assistant" && m.content) {
      // Capture decision snippets from assistant replies.
      const snips = m.content.match(/\b(?:set|applied|created|added|removed|updated|switched|duplicated|staggered)\b[^.]*\./gi);
      if (snips) decisions.push(...snips.slice(0, 2));
    }
  }

  // The most recent user message is the current intent.
  const recentUsers = list.filter((m) => m.role === "user");
  const next = recentUsers.length > 0 ? recentUsers[recentUsers.length - 1].content.slice(0, 200) : "(none)";

  const summary =
    `[Conversation summary]\n` +
    `Goal: ${goal}\n` +
    `Progress: ${toolCallCount} tool call(s), ${decisions.length} decision(s)\n` +
    `Decisions: ${decisions.slice(-5).join(" ") || "(none)"}\n` +
    `Next: ${next}`;

  // Keep the summary + the most recent window.
  const keep = list.slice(list.length - COMPRESS_KEEP);
  keep.unshift({
    role: "system",
    content: summary,
    createdAt: now(),
  });

  store.set(projectId, keep);
}
