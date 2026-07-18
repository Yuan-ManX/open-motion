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
 * produce a summary entry capturing the goal, progress, decisions, entity
 * state, failure patterns, and next step — then keep only the most recent
 * entries. This preserves semantic continuity without requiring an LLM for
 * summarization, so mock mode stays fully functional.
 *
 * The compressor extracts four signal classes:
 *   1. Tool roster — which tools were invoked and how often, so the agent
 *      remembers its action vocabulary across the compressed window.
 *   2. Entity ledger — component IDs, template IDs, and preset names that
 *      appeared in tool arguments or results, so the agent keeps referencing
 *      valid entities after compression.
 *   3. Spec mutations — easing/duration/color/loop changes extracted from
 *      tool arguments, so the agent knows the current motion state without
 *      re-reading the full spec.
 *   4. Failure trace — tools that returned errors, so the agent avoids
 *      repeating the same failing approach.
 */
export function compressMemory(projectId: string): void {
  const list = store.get(projectId);
  if (!list || list.length <= COMPRESS_THRESHOLD) return;

  // Extract the original goal (first user message).
  const firstUser = list.find((m) => m.role === "user");
  const goal = firstUser ? firstUser.content.slice(0, 200) : "(unknown)";

  let toolCallCount = 0;
  const decisions: string[] = [];
  const toolRoster = new Map<string, number>();
  const entityIds = new Set<string>();
  const mutations: string[] = [];
  const failures: string[] = [];

  for (const m of list) {
    if (m.toolCalls) {
      toolCallCount += m.toolCalls.length;
      for (const tc of m.toolCalls) {
        toolRoster.set(tc.tool, (toolRoster.get(tc.tool) ?? 0) + 1);
        // Extract entity IDs from tool arguments.
        const args = tc.args as Record<string, unknown> | undefined;
        if (args && typeof args === "object") {
          for (const key of ["componentId", "templateId", "presetName", "recipeId", "stylePreset", "brandPackId", "profileId", "captureId", "stateId", "pattern", "effect"]) {
            const v = args[key];
            if (typeof v === "string" && v.length > 0 && v.length < 80) entityIds.add(`${key}=${v}`);
          }
          // Track spec mutations for motion-relevant fields.
          if (tc.tool === "set_easing" && typeof args.name === "string") mutations.push(`easing→${args.name}`);
          if (tc.tool === "set_duration" && typeof args.durationMs === "number") mutations.push(`duration→${args.durationMs}ms`);
          if (tc.tool === "set_delay" && typeof args.delayMs === "number") mutations.push(`delay→${args.delayMs}ms`);
          if (tc.tool === "set_loop" && (typeof args.iterationCount === "string" || typeof args.iterationCount === "number")) mutations.push(`loop→${args.iterationCount}`);
          if (tc.tool === "set_color" && typeof args.value === "string") mutations.push(`color→${args.value}`);
          if (tc.tool === "apply_style" && typeof args.style === "string") mutations.push(`style→${args.style}`);
          if (tc.tool === "apply_preset" && typeof args.name === "string") mutations.push(`preset→${args.name}`);
          if (tc.tool === "set_template" && typeof args.templateId === "string") mutations.push(`template→${args.templateId}`);
          if (tc.tool === "apply_choreography" && typeof args.pattern === "string") mutations.push(`choreography→${args.pattern}`);
          if (tc.tool === "refine_motion" && typeof args.descriptor === "string") mutations.push(`refine→${args.descriptor}`);
        }
      }
    }
    // Capture failure signals from tool-result messages.
    if (m.role === "tool" && m.content) {
      if (/error|fail|not found|invalid|cannot/i.test(m.content)) {
        failures.push(`${m.toolName ?? "tool"}: ${m.content.slice(0, 80)}`);
      }
    }
    // Capture decision snippets from assistant replies. The verb set mirrors
    // the sessionSummary toolLabel map so compressed summaries retain the
    // full breadth of actions the agent performed.
    if (m.role === "assistant" && m.content) {
      const snips = m.content.match(
        /\b(?:set|applied|created|added|removed|updated|switched|duplicated|staggered|adjusted|configured|changed|edited|toggled|aligned|selected|nudged|reordered|choreographed|blended|interpolated|merged|captured|composed|triggered|analyzed|checked|suggested|recognized|harmonized|refined|exported|saved|restored|recalled|synthesized|compiled|parsed|morphed|generated|adapted|previewed|seeded|deleted|inspected|listed|described|matched|found|recommended)\b[^.]*\./gi,
      );
      if (snips) decisions.push(...snips.slice(0, 2));
    }
  }

  // The most recent user message is the current intent.
  const recentUsers = list.filter((m) => m.role === "user");
  const next = recentUsers.length > 0 ? recentUsers[recentUsers.length - 1].content.slice(0, 200) : "(none)";

  // Assemble the top tools (max 6) for a compact action vocabulary.
  const topTools = [...toolRoster.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, n]) => `${t}×${n}`);
  // Assemble the entity ledger (max 10) so the agent keeps valid references.
  const entities = [...entityIds].slice(0, 10);
  // Assemble spec mutations (max 8) showing the recent motion state trajectory.
  const mutSummary = mutations.slice(-8);

  const summary =
    `[Conversation summary]\n` +
    `Goal: ${goal}\n` +
    `Progress: ${toolCallCount} tool call(s), ${decisions.length} decision(s)\n` +
    `Tools: ${topTools.join(", ") || "(none)"}\n` +
    `Entities: ${entities.join(", ") || "(none)"}\n` +
    `Mutations: ${mutSummary.join(", ") || "(none)"}\n` +
    `Failures: ${failures.slice(-3).join(" | ") || "(none)"}\n` +
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
