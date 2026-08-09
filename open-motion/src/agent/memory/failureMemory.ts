/** Episodic failure memory — cross-session lessons from tool failures. */

import {
  listMemory,
  saveMemory,
  updateMemoryEntry,
  type AgentMemoryEntry,
} from "../../db/repositories/memory.js";

/** A single failure lesson recovered from the persistent store. */
export interface FailureRecord {
  id: string;
  /** Tool that failed. */
  tool: string;
  /** Normalized summary of the error produced by the tool. */
  errorPattern: string;
  /** Recovery suggestion produced by reflectOnFailures. */
  suggestion: string;
  /** How many times this signature has been seen in this project. */
  occurrenceCount: number;
  /** ISO timestamp of the most recent occurrence. */
  lastSeen: string;
  /** 0..1 relevance used to rank failures when surfacing. */
  relevance: number;
}

interface FailurePayload {
  errorPattern: string;
  suggestion: string;
  occurrenceCount: number;
  lastSeen: string;
}

/** Tag prefix that marks an entry as a failure lesson. */
const FAILURE_TAG = "failure";

/**
 * Normalize a (tool, errorSummary) pair into a stable signature so recurring
 * failures with the same shape deduplicate. IDs, numbers, hex strings, and
 * quoted values are collapsed into placeholders — "component abc not found"
 * and "component xyz not found" map to the same signature.
 */
function hashErrorPattern(tool: string, errorSummary: string): string {
  const normalized = errorSummary
    .toLowerCase()
    .replace(/['"`]/g, "")
    .trim()
    .replace(/component\s+\S+/g, "component:id")
    .replace(/\b[0-9a-f]{8,}\b/g, ":hex")
    .replace(/\b\d+\b/g, ":n");
  return `${tool}::${normalized.slice(0, 120)}`;
}

function encodePayload(p: FailurePayload): string {
  return JSON.stringify(p);
}

function decodePayload(value: string): FailurePayload | null {
  try {
    const parsed = JSON.parse(value) as Partial<FailurePayload>;
    if (typeof parsed.errorPattern !== "string" || typeof parsed.suggestion !== "string") {
      return null;
    }
    return {
      errorPattern: parsed.errorPattern,
      suggestion: parsed.suggestion,
      occurrenceCount: typeof parsed.occurrenceCount === "number" ? parsed.occurrenceCount : 1,
      lastSeen: typeof parsed.lastSeen === "string" ? parsed.lastSeen : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

function rowToRecord(entry: AgentMemoryEntry): FailureRecord | null {
  const payload = decodePayload(entry.value);
  if (!payload) return null;
  // The tool name is stored as the second tag (after the "failure" marker).
  const tool = entry.tags.find((t) => t !== FAILURE_TAG) ?? "";
  return {
    id: entry.id,
    tool,
    errorPattern: payload.errorPattern,
    suggestion: payload.suggestion,
    occurrenceCount: payload.occurrenceCount,
    lastSeen: payload.lastSeen,
    relevance: entry.relevance,
  };
}

/**
 * Record (or increment) a failure for a tool in a project. Returns the
 * stored record, or null when the memory store is unavailable.
 */
export function recordFailure(
  tool: string,
  errorSummary: string,
  suggestion: string,
  projectId: string,
): FailureRecord | null {
  const signature = hashErrorPattern(tool, errorSummary);
  const key = `failure:${signature}`;
  const nowIso = new Date().toISOString();

  const existing = listMemory(projectId, FAILURE_TAG);
  const match = existing.find((e) => e.key === key);

  if (match) {
    const payload = decodePayload(match.value);
    const occurrenceCount = (payload?.occurrenceCount ?? 1) + 1;
    // Bump relevance but cap at 1.0 so one flaky tool cannot dominate.
    const relevance = Math.min(1, match.relevance + 0.1);
    const nextPayload: FailurePayload = {
      // Preserve the original error pattern text — it is the canonical form.
      errorPattern: payload?.errorPattern ?? errorSummary.slice(0, 240),
      // Prefer the latest suggestion (it may be more specific).
      suggestion: suggestion.slice(0, 240) || payload?.suggestion || "",
      occurrenceCount,
      lastSeen: nowIso,
    };
    updateMemoryEntry(match.id, encodePayload(nextPayload), relevance);
    return {
      id: match.id,
      tool,
      errorPattern: nextPayload.errorPattern,
      suggestion: nextPayload.suggestion,
      occurrenceCount,
      lastSeen: nowIso,
      relevance,
    };
  }

  const payload: FailurePayload = {
    errorPattern: errorSummary.slice(0, 240),
    suggestion: suggestion.slice(0, 240),
    occurrenceCount: 1,
    lastSeen: nowIso,
  };
  const entry = saveMemory({
    projectId,
    layer: "failure",
    key,
    value: encodePayload(payload),
    tags: [FAILURE_TAG, tool],
    relevance: 0.6,
  });
  return {
    id: entry.id,
    tool,
    errorPattern: payload.errorPattern,
    suggestion: payload.suggestion,
    occurrenceCount: 1,
    lastSeen: nowIso,
    relevance: entry.relevance,
  };
}

/**
 * Look up prior failure lessons for a tool in a project. Returns the most
 * relevant matching record, or null when no prior lesson exists.
 *
 * Lookup is two-tiered:
 *   1. Exact signature match — same tool + same error shape.
 *   2. Same-tool fallback — any prior failure for that tool family.
 */
export function searchFailureMemory(
  tool: string,
  errorSummary: string,
  projectId: string,
): FailureRecord | null {
  const failures = listMemory(projectId, FAILURE_TAG);
  if (failures.length === 0) return null;

  const signature = hashErrorPattern(tool, errorSummary);
  const exact = failures.find((e) => e.key === `failure:${signature}`);
  if (exact) {
    const rec = rowToRecord(exact);
    if (rec) return rec;
  }

  // Same-tool fallback: pick the most relevant prior failure for this tool.
  const toolMatch = failures
    .filter((e) => e.tags.includes(tool))
    .sort((a, b) => b.relevance - a.relevance)[0];
  if (toolMatch) {
    return rowToRecord(toolMatch);
  }
  return null;
}

/** Return all failure lessons for a project, most relevant first. */
export function listFailureMemory(projectId: string, limit = 5): FailureRecord[] {
  const failures = listMemory(projectId, FAILURE_TAG);
  const records = failures
    .map(rowToRecord)
    .filter((r): r is FailureRecord => r !== null)
    .sort((a, b) => b.relevance - a.relevance || b.occurrenceCount - a.occurrenceCount);
  return records.slice(0, limit);
}

/** Format failure lessons as a context block for the system prompt. */
export function formatFailureMemory(projectId: string): string {
  const records = listFailureMemory(projectId, 4);
  if (records.length === 0) return "";
  const lines = records.map((r) => {
    const seen = `seen ${r.occurrenceCount}x`;
    return `- ${r.tool}: ${r.errorPattern} (${seen}) — recovery: ${r.suggestion}`;
  });
  return `\nPrior failure lessons for this project (avoid repeating):\n${lines.join("\n")}\n`;
}
