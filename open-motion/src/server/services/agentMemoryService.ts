import {
  listMemory as repoListMemory,
  saveMemory as repoSaveMemory,
  searchMemory as repoSearchMemory,
  deleteMemory as repoDeleteMemory,
  updateMemoryRelevance as repoUpdateRelevance,
  listGeneratedSkills as repoListGeneratedSkills,
  type AgentMemoryEntry,
  type GeneratedSkill,
} from "../../db/repositories/memory.js";

export type { AgentMemoryEntry, GeneratedSkill };

export function listMemory(projectId: string, layer?: string): AgentMemoryEntry[] {
  return repoListMemory(projectId, layer);
}

export function saveMemory(
  projectId: string,
  input: { key: string; value: string; tags?: string[]; relevance?: number },
): AgentMemoryEntry {
  return repoSaveMemory({
    projectId,
    layer: "project",
    key: input.key,
    value: input.value,
    tags: input.tags ?? [],
    relevance: input.relevance ?? 0.7,
  });
}

export function searchMemory(projectId: string, query: string): AgentMemoryEntry[] {
  return repoSearchMemory(projectId, query);
}

export function deleteMemory(id: string): void {
  repoDeleteMemory(id);
}

export function updateMemoryRelevance(id: string, relevance: number): void {
  repoUpdateRelevance(id, relevance);
}

export function listGeneratedSkills(projectId?: string, limit = 20): GeneratedSkill[] {
  return repoListGeneratedSkills(projectId, limit);
}
