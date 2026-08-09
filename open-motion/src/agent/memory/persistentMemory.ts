import type { MotionSpec } from "@openmotion/shared";
import {
  listMemory,
  searchMemory,
  saveMemory,
  deleteMemory,
  updateMemoryRelevance,
  searchGeneratedSkills,
  listGeneratedSkills,
  type AgentMemoryEntry,
  type GeneratedSkill,
} from "../../db/repositories/memory.js";
import { formatFailureMemory } from "./failureMemory.js";

/**
 * Multi-level persistent memory system assembling project memory, generated
 * skill documents, and failure lessons into context strings injected into the
 * system prompt so the agent retains knowledge across restarts and sessions.
 */

export interface MemoryContext {
  projectMemory: string;
  relevantSkills: string;
  /** Prior failure lessons for this project, formatted for the system prompt. */
  failureMemory: string;
  totalEntries: number;
}

/** Assemble persistent memory context for the system prompt. */
export function assembleMemoryContext(projectId: string, userMessage: string): MemoryContext {
  // Failure-layer entries carry JSON payloads and are surfaced via a
  // dedicated formatter below — exclude them from the regular project
  // memory list so they do not appear as raw JSON in the prompt.
  const projectEntries = listMemory(projectId).filter((e) => e.layer !== "failure");
  const skillResults = searchGeneratedSkills(userMessage);

  // Also search project memory for keywords from the user message
  const keywords = userMessage.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 5);
  const searched = keywords.length > 0
    ? searchMemory(projectId, keywords[0]).filter((e) => e.layer !== "failure")
    : [];

  const allEntries = [...projectEntries];
  for (const s of searched) {
    if (!allEntries.some((e) => e.id === s.id)) allEntries.push(s);
  }

  const projectMemory = formatProjectMemory(allEntries);
  const relevantSkills = formatSkills(skillResults);
  const failureMemory = formatFailureMemory(projectId);

  return {
    projectMemory,
    relevantSkills,
    failureMemory,
    totalEntries: projectEntries.length,
  };
}

function formatProjectMemory(entries: AgentMemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.slice(0, 15).map((e) => {
    const tagStr = e.tags.length > 0 ? ` [${e.tags.join(",")}]` : "";
    return `- (${e.layer}) ${e.key}: ${e.value}${tagStr}`;
  });
  return `\nPersistent project memory (cross-session knowledge):\n${lines.join("\n")}\n`;
}

function formatSkills(skills: GeneratedSkill[]): string {
  if (skills.length === 0) return "";
  const lines = skills.slice(0, 3).map((s) => {
    return `- Skill "${s.name}": ${s.description} (used ${s.usageCount}x) — trigger: "${s.triggerPattern}"`;
  });
  return `\nRelevant learned skills (from past sessions):\n${lines.join("\n")}\n`;
}

/** Save a project-level memory entry. */
export function remember(
  projectId: string,
  key: string,
  value: string,
  tags: string[] = [],
  relevance = 0.7,
): AgentMemoryEntry {
  return saveMemory({
    projectId,
    layer: "project",
    key,
    value,
    tags,
    relevance,
  });
}

/** Save a user preference. */
export function rememberPreference(
  projectId: string,
  key: string,
  value: string,
): AgentMemoryEntry {
  return saveMemory({
    projectId,
    layer: "preference",
    key,
    value,
    tags: ["preference"],
    relevance: 0.9,
  });
}

/** Forget a memory entry by id. */
export function forget(id: string): void {
  deleteMemory(id);
}

/** Boost or decay a memory's relevance score. */
export function adjustRelevance(id: string, newRelevance: number): void {
  updateMemoryRelevance(id, Math.max(0, Math.min(1, newRelevance)));
}
