import { now } from "../../utils/id.js";

/**
 * Working Memory — a transient per-turn scratchpad layer.
 *
 * Distinct from the four persistent memory layers (session window, project
 * facts, generated skills, failure lessons), working memory holds short-lived
 * notes the agent produces within a single turn: intermediate hypotheses,
 * verification verdicts, partial findings, and discarded options.
 *
 * Why a separate layer:
 *   - The conversation window is the source of truth for the user-facing
 *     dialog. Mixing in scratch notes pollutes context the LLM must echo back.
 *   - Persistent memory outlives the turn, but scratch notes are only relevant
 *     while the agent is actively reasoning about this specific request.
 *   - Surfacing scratch notes in the system prompt (not the message list)
 *     keeps them visible to the model without inflating the chat transcript.
 *
 * Lifecycle:
 *   1. `resetForTurn(projectId)` is called at the start of each orchestrator
 *      turn so the scratchpad is fresh.
 *   2. The orchestrator and verification engine append notes via `addScratch`.
 *   3. `formatScratchForContext(projectId)` is called by context assembly to
 *      inject the current scratchpad into the system prompt.
 *   4. Notes are retained until the next turn reset, so a mid-turn
 *      re-assembly still sees them, but they never leak into the persisted
 *      message log.
 */

export type ScratchKind =
  | "hypothesis" // a candidate approach the agent considered
  | "verification" // a structured check verdict from motionVerification
  | "finding" // a partial observation from a tool result
  | "decision" // a committed choice (e.g. "apply spring easing")
  | "deferred"; // an idea parked for a later turn

export interface ScratchEntry {
  /** Category controlling how the note is rendered in the prompt. */
  kind: ScratchKind;
  /** Short note body. Kept brief so the scratchpad stays cheap to inject. */
  note: string;
  /** ISO timestamp for ordering and debugging. */
  createdAt: string;
}

const MAX_ENTRIES = 12;
const store = new Map<string, ScratchEntry[]>();

/** Return the current scratchpad for a project (empty when none). */
export function listScratch(projectId: string): ScratchEntry[] {
  return store.get(projectId) ?? [];
}

/** Clear the scratchpad for a project. Called at the start of each turn. */
export function resetForTurn(projectId: string): void {
  store.set(projectId, []);
}

/** Append a scratch note. Caps the total entries to keep the prompt cheap. */
export function addScratch(projectId: string, kind: ScratchKind, note: string): void {
  const list = store.get(projectId) ?? [];
  list.push({ kind, note: note.slice(0, 240), createdAt: now() });
  if (list.length > MAX_ENTRIES) {
    // Drop the oldest entries — recent reasoning is more relevant mid-turn.
    list.splice(0, list.length - MAX_ENTRIES);
  }
  store.set(projectId, list);
}

/** Remove a specific note by index (best-effort, used when an idea is discarded). */
export function dropScratch(projectId: string, index: number): void {
  const list = store.get(projectId);
  if (!list) return;
  if (index < 0 || index >= list.length) return;
  list.splice(index, 1);
  store.set(projectId, list);
}

/**
 * Format the scratchpad for injection into the system prompt. Returns an empty
 * string when the scratchpad is empty so the prompt stays compact on the first
 * iteration of a turn.
 */
export function formatScratchForContext(projectId: string): string {
  const list = store.get(projectId);
  if (!list || list.length === 0) return "";
  const lines = list.map((e, i) => `- (${e.kind}) ${e.note}`);
  return `\nWorking memory (this turn's scratchpad):\n${lines.join("\n")}\n`;
}

/** Clear all scratchpads (used by tests and project deletion). */
export function clearAllScratch(): void {
  store.clear();
}
