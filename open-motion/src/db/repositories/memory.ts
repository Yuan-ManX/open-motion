import { getDb } from "../index.js";
import { now } from "../../utils/id.js";

export interface AgentMemoryEntry {
  id: string;
  projectId: string;
  layer: "project" | "skill" | "preference";
  key: string;
  value: string;
  tags: string[];
  relevance: number;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedSkill {
  id: string;
  projectId: string | null;
  name: string;
  description: string;
  triggerPattern: string;
  toolSequence: string;
  skillMarkdown: string;
  usageCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface AgentMemoryRow {
  id: string;
  project_id: string;
  layer: string;
  key: string;
  value: string;
  tags_json: string;
  relevance: number;
  created_at: string;
  updated_at: string;
}

interface GeneratedSkillRow {
  id: string;
  project_id: string | null;
  name: string;
  description: string;
  trigger_pattern: string;
  tool_sequence: string;
  skill_markdown: string;
  usage_count: number;
  tags_json: string;
  created_at: string;
  updated_at: string;
}

function rowToMemory(r: AgentMemoryRow): AgentMemoryEntry {
  return {
    id: r.id,
    projectId: r.project_id,
    layer: r.layer as AgentMemoryEntry["layer"],
    key: r.key,
    value: r.value,
    tags: JSON.parse(r.tags_json) as string[],
    relevance: r.relevance,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToSkill(r: GeneratedSkillRow): GeneratedSkill {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    description: r.description,
    triggerPattern: r.trigger_pattern,
    toolSequence: r.tool_sequence,
    skillMarkdown: r.skill_markdown,
    usageCount: r.usage_count,
    tags: JSON.parse(r.tags_json) as string[],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function saveMemory(entry: Omit<AgentMemoryEntry, "id" | "createdAt" | "updatedAt">): AgentMemoryEntry {
  const db = getDb();
  const id = `mem_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ts = now();
  db.prepare(
    `INSERT INTO agent_memory (id, project_id, layer, key, value, tags_json, relevance, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, entry.projectId, entry.layer, entry.key, entry.value, JSON.stringify(entry.tags), entry.relevance, ts, ts);
  return { ...entry, id, createdAt: ts, updatedAt: ts };
}

export function listMemory(projectId: string, layer?: string): AgentMemoryEntry[] {
  const db = getDb();
  const rows = layer
    ? db.prepare(`SELECT * FROM agent_memory WHERE project_id = ? AND layer = ? ORDER BY relevance DESC, updated_at DESC`).all(projectId, layer) as unknown as AgentMemoryRow[]
    : db.prepare(`SELECT * FROM agent_memory WHERE project_id = ? ORDER BY relevance DESC, updated_at DESC`).all(projectId) as unknown as AgentMemoryRow[];
  return rows.map(rowToMemory);
}

export function searchMemory(projectId: string, query: string, limit = 5): AgentMemoryEntry[] {
  const db = getDb();
  const pattern = `%${query.toLowerCase()}%`;
  const rows = db.prepare(
    `SELECT * FROM agent_memory
     WHERE project_id = ? AND (LOWER(key) LIKE ? OR LOWER(value) LIKE ?)
     ORDER BY relevance DESC, updated_at DESC LIMIT ?`,
  ).all(projectId, pattern, pattern, limit) as unknown as AgentMemoryRow[];
  return rows.map(rowToMemory);
}

export function updateMemoryRelevance(id: string, relevance: number): void {
  const db = getDb();
  db.prepare(`UPDATE agent_memory SET relevance = ?, updated_at = ? WHERE id = ?`).run(relevance, now(), id);
}

export function deleteMemory(id: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM agent_memory WHERE id = ?`).run(id);
}

export function saveGeneratedSkill(skill: Omit<GeneratedSkill, "id" | "createdAt" | "updatedAt" | "usageCount">): GeneratedSkill {
  const db = getDb();
  const id = `skill_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ts = now();
  db.prepare(
    `INSERT INTO generated_skills (id, project_id, name, description, trigger_pattern, tool_sequence, skill_markdown, usage_count, tags_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
  ).run(id, skill.projectId, skill.name, skill.description, skill.triggerPattern, skill.toolSequence, skill.skillMarkdown, JSON.stringify(skill.tags), ts, ts);
  return { ...skill, id, usageCount: 0, createdAt: ts, updatedAt: ts };
}

export function listGeneratedSkills(projectId?: string, limit = 20): GeneratedSkill[] {
  const db = getDb();
  const rows = projectId
    ? db.prepare(`SELECT * FROM generated_skills WHERE project_id = ? ORDER BY usage_count DESC, created_at DESC LIMIT ?`).all(projectId, limit) as unknown as GeneratedSkillRow[]
    : db.prepare(`SELECT * FROM generated_skills ORDER BY usage_count DESC, created_at DESC LIMIT ?`).all(limit) as unknown as GeneratedSkillRow[];
  return rows.map(rowToSkill);
}

export function searchGeneratedSkills(query: string, limit = 5): GeneratedSkill[] {
  const db = getDb();
  const pattern = `%${query.toLowerCase()}%`;
  const rows = db.prepare(
    `SELECT * FROM generated_skills
     WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(trigger_pattern) LIKE ?
     ORDER BY usage_count DESC, created_at DESC LIMIT ?`,
  ).all(pattern, pattern, pattern, limit) as unknown as GeneratedSkillRow[];
  return rows.map(rowToSkill);
}

export function incrementSkillUsage(id: string): void {
  const db = getDb();
  db.prepare(`UPDATE generated_skills SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?`).run(now(), id);
}
