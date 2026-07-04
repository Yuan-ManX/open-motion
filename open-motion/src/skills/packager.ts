import type { Skill, MotionSpec, MotionProject } from "@openmotion/shared";
import { createId, now } from "../utils/id.js";
import { getProjectSpec } from "../db/repositories/projects.js";
import { insertSkill } from "../db/repositories/skills.js";
import { generateStandaloneHtml } from "../motion/generator/html.js";
import { buildManifest } from "./manifest.js";

export interface PackageSkillInput {
  projectId: string;
  componentId?: string;
  name: string;
  description: string;
  tags?: string[];
}

/**
 * Freeze a project (or a single component) into a self-contained, AI-callable
 * skill: motion spec + runnable HTML + manifest. Persists it for reuse.
 */
export function packageSkill(input: PackageSkillInput): Skill | null {
  const spec = getProjectSpec(input.projectId);
  if (!spec) return null;

  let motionSpec: MotionSpec;
  let sourceComponentId: string | null = null;

  if (input.componentId) {
    const comp = spec.components.find((c) => c.id === input.componentId);
    if (!comp) return null;
    sourceComponentId = comp.id;
    const stubProject: MotionProject = {
      ...spec.project,
      id: createId("p_"),
      name: input.name,
      sourceTemplateId: null,
      createdAt: now(),
      updatedAt: now(),
    };
    motionSpec = { project: stubProject, components: [{ ...comp, projectId: stubProject.id }] };
  } else {
    motionSpec = spec;
  }

  const codeHtml = generateStandaloneHtml(motionSpec);
  const ts = now();
  const skill: Skill = {
    id: createId("sk_"),
    name: input.name,
    description: input.description,
    version: "1.0.0",
    sourceProjectId: input.projectId,
    sourceComponentId,
    manifest: buildManifest({ name: input.name, description: input.description, sourceSpec: motionSpec }),
    motionSpec,
    codeHtml,
    tags: input.tags ?? [],
    createdAt: ts,
    updatedAt: ts,
  };
  insertSkill(skill);
  return skill;
}
