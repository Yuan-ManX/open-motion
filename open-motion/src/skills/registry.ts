import type { Easing, MotionSpec } from "@openmotion/shared";
import { getSkill } from "../db/repositories/skills.js";
import { generateStandaloneHtml } from "../motion/generator/html.js";

export interface InvokeSkillArgs {
  easing?: Easing;
  durationMs?: number;
  iterationCount?: number | "infinite";
}

export interface InvokeSkillResult {
  html: string;
  spec: MotionSpec;
}

/**
 * Invoke a packaged skill with optional overrides. The skill's frozen motion
 * spec is cloned, overrides are applied to every component, and a fresh HTML
 * artifact is generated — so a skill stays a living, parameterizable unit.
 */
export function invokeSkill(skillId: string, args: InvokeSkillArgs): InvokeSkillResult | null {
  const skill = getSkill(skillId);
  if (!skill) return null;
  const components = skill.motionSpec.components.map((c) => ({
    ...c,
    ...(args.easing ? { easing: args.easing } : {}),
    ...(args.durationMs != null ? { durationMs: args.durationMs } : {}),
    ...(args.iterationCount != null ? { iterationCount: args.iterationCount } : {}),
  }));
  const spec: MotionSpec = { ...skill.motionSpec, components };
  const html = generateStandaloneHtml(spec);
  return { html, spec };
}
