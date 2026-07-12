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

// --- Agent memory endpoints ---

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

export const listMemory = (projectId: string, layer?: string) =>
  apiGet<AgentMemoryEntry[]>(`/projects/${projectId}/memory${layer ? `?layer=${layer}` : ""}`);
export const saveMemory = (projectId: string, input: { key: string; value: string; tags?: string[]; relevance?: number }) =>
  apiPost<AgentMemoryEntry>(`/projects/${projectId}/memory`, input);
export const searchMemory = (projectId: string, query: string) =>
  apiGet<AgentMemoryEntry[]>(`/projects/${projectId}/memory/search?q=${encodeURIComponent(query)}`);
export const deleteMemory = (memoryId: string) =>
  apiDelete<void>(`/memory/${memoryId}`);
export const updateMemoryRelevance = (memoryId: string, relevance: number) =>
  apiPatch<{ id: string; relevance: number }>(`/memory/${memoryId}/relevance`, { relevance });

// --- Recipe endpoints ---

export interface MotionRecipe {
  id: string;
  name: string;
  category: string;
  description: string;
  avoidWhen: string[];
  restraintCost: number;
  recipe: Record<string, unknown>;
  skillMarkdown: string;
  tags: string[];
}

export const listRecipes = (category?: string, query?: string) =>
  apiGet<MotionRecipe[]>(`/recipes${category ? `?category=${category}` : ""}${query ? `${category ? "&" : "?"}q=${encodeURIComponent(query)}` : ""}`);
export const getRecipe = (id: string) =>
  apiGet<MotionRecipe>(`/recipes/${id}`);

// --- Generated skills endpoints ---

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

export const listGeneratedSkills = (projectId?: string, limit = 20) =>
  apiGet<GeneratedSkill[]>(`/generated-skills${projectId ? `?projectId=${projectId}` : ""}${limit ? `${projectId ? "&" : "?"}limit=${limit}` : ""}`);

// --- Restraint analysis endpoint ---

export interface RestraintWarning {
  level: "info" | "warn" | "critical";
  message: string;
  componentIds?: string[];
  timeRange?: { start: number; end: number };
}

export interface RestraintAnalysis {
  score: number;
  componentCount: number;
  peakSimultaneous: number;
  peakWindowStart: number;
  peakWindowEnd: number;
  warnings: RestraintWarning[];
  recommendations: string[];
}

export interface RestraintReport {
  analysis: RestraintAnalysis;
  report: string;
}

export const getProjectRestraint = (projectId: string) =>
  apiGet<RestraintReport>(`/projects/${projectId}/restraint`);
