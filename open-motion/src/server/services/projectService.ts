import { z } from "zod";
import type { MotionProject, MotionSpec } from "@openmotion/shared";
import { CreateProjectInputSchema } from "@openmotion/shared";
import {
  listProjects,
  getProject,
  getProjectSpec,
  createProject,
  updateProject,
  deleteProject,
  duplicateProject,
} from "../../db/repositories/projects.js";
import { HttpError } from "../middleware/error.js";

export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export interface ProjectWithSpec extends MotionProject {
  spec: MotionSpec | null;
}

function withSpec(p: MotionProject): ProjectWithSpec {
  return { ...p, spec: getProjectSpec(p.id) };
}

export function listProjectsWithSpec(): ProjectWithSpec[] {
  return listProjects().map(withSpec);
}

export function getProjectWithSpec(id: string): ProjectWithSpec {
  const project = getProject(id);
  if (!project) throw new HttpError(404, "project not found");
  return withSpec(project);
}

export function createProjectWithSpec(input: CreateProjectInput): ProjectWithSpec {
  const project = createProject(input);
  return withSpec(project);
}

export function updateProjectOrThrow(id: string, patch: Partial<MotionProject>): MotionProject {
  const updated = updateProject(id, patch);
  if (!updated) throw new HttpError(404, "project not found");
  return updated;
}

export function deleteProjectOrThrow(id: string): void {
  const ok = deleteProject(id);
  if (!ok) throw new HttpError(404, "project not found");
}

export function duplicateProjectWithSpec(id: string): ProjectWithSpec {
  const copy = duplicateProject(id);
  if (!copy) throw new HttpError(404, "project not found");
  return withSpec(copy);
}

export function ensureProjectExists(id: string): void {
  if (!getProject(id)) throw new HttpError(404, "project not found");
}

export interface ProjectStats {
  projectId: string;
  projectName: string;
  componentCount: number;
  sceneCount: number;
  unassignedCount: number;
  totalDurationMs: number;
  easingDistribution: Record<string, number>;
  loopCount: number;
  primaryDna: string;
  perComponentDna: Array<{ name: string; dna: string }>;
  sourceTemplateId: string | null;
  status: string;
}

/** Classify an easing into a short DNA token. */
function easingDnaToken(easing: MotionSpec["components"][0]["easing"]): string {
  if (!easing) return "LINEAR";
  if (easing.type === "preset") {
    const n = easing.name;
    if (/bounce|back|elastic|spring/.test(n)) return "BOUNCE";
    if (/smooth|ease-in-out|ease-out/.test(n)) return "SMOOTH";
    if (/snappy|ease-in/.test(n)) return "SNAPPY";
    return n.toUpperCase();
  }
  if (easing.type === "spring") return "SPRING";
  if (easing.type === "bezier") return "BEZIER";
  return "LINEAR";
}

/** Compute the Motion DNA signature for a single component. */
function componentDna(comp: MotionSpec["components"][0]): string {
  const easing = easingDnaToken(comp.easing);
  const dur = comp.durationMs < 500 ? "FAST" : comp.durationMs <= 1500 ? "NORMAL" : "SLOW";
  const loop = comp.iterationCount === "infinite" ? "LOOP∞" : comp.iterationCount === 1 ? "ONCE" : `LOOP×${comp.iterationCount}`;
  const dir = comp.direction === "alternate" || comp.direction === "alternate-reverse" ? "ALT" : comp.direction === "reverse" ? "REV" : "FWD";
  const props = new Set<string>();
  for (const kf of comp.keyframes) {
    for (const key of Object.keys(kf.properties)) props.add(key.toUpperCase());
  }
  const propStr = Array.from(props).join("+") || "STATIC";
  return [easing, dur, loop, propStr, dir].join("|");
}

export function getProjectStats(id: string): ProjectStats {
  const project = getProject(id);
  if (!project) throw new HttpError(404, "project not found");
  const spec = getProjectSpec(id);
  const components = spec?.components ?? [];

  const totalDurationMs = components.reduce((max, c) => {
    const iters = c.iterationCount === "infinite" ? 1 : Number(c.iterationCount) || 1;
    return Math.max(max, c.delayMs + c.durationMs * iters);
  }, 0);

  const easingDistribution: Record<string, number> = {};
  let loopCount = 0;
  for (const c of components) {
    const eName = c.easing?.type === "preset" ? c.easing.name : c.easing?.type ?? "linear";
    easingDistribution[eName] = (easingDistribution[eName] ?? 0) + 1;
    if (c.iterationCount === "infinite" || (typeof c.iterationCount === "number" && c.iterationCount > 1)) {
      loopCount++;
    }
  }

  const perComponentDna = components.map((c) => ({ name: c.name, dna: componentDna(c) }));
  const unassignedCount = components.filter((c) => !c.sceneId).length;

  return {
    projectId: id,
    projectName: project.name,
    componentCount: components.length,
    sceneCount: project.scenes.length,
    unassignedCount,
    totalDurationMs,
    easingDistribution,
    loopCount,
    primaryDna: perComponentDna[0]?.dna ?? "",
    perComponentDna,
    sourceTemplateId: project.sourceTemplateId,
    status: project.status,
  };
}
