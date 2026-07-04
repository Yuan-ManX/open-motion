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
