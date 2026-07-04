import type { Skill, SkillSummary, Easing } from "@openmotion/shared";
import { HttpError } from "../middleware/error.js";
import { listSkills, getSkill, deleteSkill } from "../../db/repositories/skills.js";
import { invokeSkill, type InvokeSkillArgs } from "../../skills/registry.js";
import { packageProjectSkill } from "./exportService.js";

export interface CreateSkillInput {
  projectId: string;
  componentId?: string;
  name: string;
  description: string;
  tags?: string[];
}

export function listSkillSummaries(): SkillSummary[] {
  return listSkills().map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    version: s.version,
    tags: s.tags,
    outputType: s.manifest.outputType,
  }));
}

export function getSkillOrThrow(id: string): Skill {
  const skill = getSkill(id);
  if (!skill) throw new HttpError(404, "skill not found");
  return skill;
}

export function getSkillCodeOrThrow(id: string): { id: string; codeHtml: string | null } {
  const skill = getSkillOrThrow(id);
  return { id: skill.id, codeHtml: skill.codeHtml };
}

export function createSkill(input: CreateSkillInput): Skill {
  return packageProjectSkill(input);
}

export function invokeSkillOrThrow(
  id: string,
  args: { easing?: Easing; durationMs?: number; iterationCount?: number | "infinite" },
): { html: string } {
  const result = invokeSkill(id, args as InvokeSkillArgs);
  if (!result) throw new HttpError(404, "skill not found");
  return result;
}

export function deleteSkillOrThrow(id: string): void {
  const ok = deleteSkill(id);
  if (!ok) throw new HttpError(404, "skill not found");
}
