import type {
  HealthResponse,
  Template,
  ProjectResponse,
  Message,
  Skill,
  SkillSummary,
  MotionComponent,
} from "@openmotion/shared";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "./client.js";

export const health = () => apiGet<HealthResponse>("/health");

export const listTemplates = () => apiGet<Template[]>("/templates");

export const listProjects = () => apiGet<ProjectResponse[]>("/projects");
export const getProject = (id: string) => apiGet<ProjectResponse>(`/projects/${id}`);
export const createProject = (opts: { name?: string; templateId?: string }) =>
  apiPost<ProjectResponse>("/projects", opts);
export const updateProject = (id: string, patch: Partial<{ name: string; description: string; status: string; tokens: Record<string, string | number> }>) =>
  apiPut<ProjectResponse>(`/projects/${id}`, patch);
export const deleteProject = (id: string) => apiDelete<void>(`/projects/${id}`);
export const duplicateProject = (id: string) =>
  apiPost<ProjectResponse>(`/projects/${id}/duplicate`);

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
export const getProjectStats = (id: string) =>
  apiGet<ProjectStats>(`/projects/${id}/stats`);

export const listComponents = (projectId: string) =>
  apiGet<MotionComponent[]>(`/projects/${projectId}/components`);
export const createComponent = (projectId: string, opts: { name?: string; templateId?: string }) =>
  apiPost<MotionComponent>(`/projects/${projectId}/components`, opts);
export const patchComponent = (projectId: string, componentId: string, patch: Partial<MotionComponent>) =>
  apiPatch<MotionComponent>(`/projects/${projectId}/components/${componentId}`, patch);
export const removeComponent = (projectId: string, componentId: string) =>
  apiDelete<void>(`/projects/${projectId}/components/${componentId}`);
export const duplicateComponent = (projectId: string, componentId: string) =>
  apiPost<MotionComponent>(`/projects/${projectId}/components/${componentId}/duplicate`, {});
export const batchUpdateComponents = (
  projectId: string,
  updates: { componentId: string; patch: Partial<MotionComponent> }[],
) =>
  apiPatch<MotionComponent[]>(`/projects/${projectId}/components/batch`, { updates });
export const reorderComponents = (projectId: string, orderedIds: string[]) =>
  apiPost<MotionComponent[]>(`/projects/${projectId}/components/reorder`, { orderedIds });

export const listMessages = (projectId: string) =>
  apiGet<Message[]>(`/projects/${projectId}/messages`);
export const clearMessages = (projectId: string) =>
  apiDelete<void>(`/projects/${projectId}/messages`);

export const listSkills = () => apiGet<SkillSummary[]>("/skills");
export const getSkill = (id: string) => apiGet<Skill>(`/skills/${id}`);
export const getSkillCode = (id: string) =>
  apiGet<{ id: string; codeHtml: string }>(`/skills/${id}/code`);
export const createSkill = (input: {
  projectId: string;
  componentId?: string;
  name: string;
  description: string;
  tags?: string[];
}) => apiPost<Skill>("/skills", input);
export const deleteSkill = (id: string) => apiDelete<void>(`/skills/${id}`);
export const invokeSkill = (id: string, args: { easing?: unknown; durationMs?: number; iterationCount?: number | string }) =>
  apiPost<{ html: string }>(`/skills/${id}/invoke`, args);

export const exportHtml = (projectId: string) =>
  apiPost<{ html: string; url: string; filename: string }>(`/projects/${projectId}/export/html`);
export const exportVideo = (projectId: string, opts: { format?: string; fps?: number; width?: number; height?: number }) =>
  apiPost<{ jobId: string; status: string }>(`/projects/${projectId}/export/video`, opts);
export const getVideoJob = (jobId: string) =>
  apiGet<{ id: string; status: string; filePath: string | null; error: string | null }>(`/exports/jobs/${jobId}`);

export interface CodeExport {
  code: string;
  language: "css" | "json" | "tsx";
  filename: string;
}
export const exportCss = (projectId: string) =>
  apiGet<CodeExport>(`/projects/${projectId}/export/css`);
export const exportJson = (projectId: string) =>
  apiGet<CodeExport>(`/projects/${projectId}/export/json`);
export const exportReact = (projectId: string) =>
  apiGet<CodeExport>(`/projects/${projectId}/export/react`);
