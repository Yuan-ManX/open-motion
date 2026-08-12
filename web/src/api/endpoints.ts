import type {
  HealthResponse,
  Template,
  ProjectResponse,
  Message,
  Skill,
  SkillSummary,
  MotionComponent,
  Easing,
} from "@openmotion/shared";
import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "./client.js";

export const health = () => apiGet<HealthResponse>("/health");

export const listTemplates = () => apiGet<Template[]>("/templates");

export interface TemplateSearchResult extends Template {
  score: number;
  matchedFields: string[];
}

export const searchTemplates = (q: string, limit?: number) => {
  const params = new URLSearchParams();
  params.set("q", q);
  if (limit) params.set("limit", String(limit));
  return apiGet<{ results: TemplateSearchResult[]; total: number; query: string }>(`/templates/search?${params.toString()}`);
};

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
export const batchRemoveComponents = (projectId: string, componentIds: string[]) =>
  apiDelete<{ removed: number }>(`/projects/${projectId}/components/batch`, { componentIds });
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

// ---------------------------------------------------------------------------
// Accessibility & Performance reports
// ---------------------------------------------------------------------------

export interface AccessibilityIssue {
  severity: "info" | "warning" | "critical";
  category: "vestibular" | "seizure" | "reduced-motion" | "cognitive";
  componentId: string | null;
  componentName: string | null;
  message: string;
  remediation: string;
}

export interface AccessibilityReport {
  issues: AccessibilityIssue[];
  score: number;
  summary: string;
  stats: {
    totalComponents: number;
    vestibularIssues: number;
    seizureIssues: number;
    reducedMotionIssues: number;
    cognitiveIssues: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    maxSimultaneousAnimations: number;
    hasInfiniteLoops: boolean;
    hasFlashingRisk: boolean;
    hasLargeDisplacement: boolean;
  };
}

export interface PerformanceIssue {
  severity: "info" | "warning" | "critical";
  componentId: string | null;
  componentName: string | null;
  category: string;
  message: string;
  suggestion: string;
}

export interface PerformanceReport {
  issues: PerformanceIssue[];
  score: number;
  summary: string;
  componentCosts: Array<{
    componentId: string;
    componentName: string;
    cost: number;
    factors: string[];
  }>;
  totalCost: number;
  frameTimeMs: number;
  targetFrameMs: number;
  achieves60fps: boolean;
}

export const getAccessibilityReport = (projectId: string) =>
  apiGet<AccessibilityReport>(`/projects/${projectId}/accessibility`);

export const getPerformanceReport = (projectId: string) =>
  apiGet<PerformanceReport>(`/projects/${projectId}/performance`);
export const exportVideo = (projectId: string, opts: { format?: string; fps?: number; width?: number; height?: number }) =>
  apiPost<{ jobId: string; status: string }>(`/projects/${projectId}/export/video`, opts);
export const getVideoJob = (jobId: string) =>
  apiGet<{ id: string; status: string; filePath: string | null; error: string | null }>(`/exports/jobs/${jobId}`);

export interface CodeExport {
  code: string;
  language: "css" | "json" | "tsx" | "jsx" | "html";
  filename: string;
}
export const exportCss = (projectId: string) =>
  apiGet<CodeExport>(`/projects/${projectId}/export/css`);
export const exportJson = (projectId: string) =>
  apiGet<CodeExport>(`/projects/${projectId}/export/json`);
export const exportReact = (projectId: string) =>
  apiGet<CodeExport>(`/projects/${projectId}/export/react`);
export const exportFramer = (projectId: string) =>
  apiGet<CodeExport>(`/projects/${projectId}/export/framer`);
export const exportLottie = (projectId: string, fps?: number) =>
  apiGet<CodeExport>(`/projects/${projectId}/export/lottie${fps ? `?fps=${fps}` : ""}`);

export type TemplateCodeFormat = "react" | "framer" | "html" | "css";
export interface TemplateCodeExport {
  code: string;
  language: string;
  filename: string;
}
export const getTemplateCode = (
  templateId: string,
  opts?: { format?: TemplateCodeFormat; color?: string; speed?: number; scale?: number },
) => {
  const params = new URLSearchParams();
  if (opts?.format) params.set("format", opts.format);
  if (opts?.color) params.set("color", opts.color);
  if (opts?.speed) params.set("speed", String(opts.speed));
  if (opts?.scale) params.set("scale", String(opts.scale));
  const qs = params.toString();
  return apiGet<TemplateCodeExport>(`/templates/${templateId}/code${qs ? `?${qs}` : ""}`);
};

// --- Style presets ---

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  easing: { type: string; name?: string };
  durationMs: number;
  iterationCount: number | "infinite";
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  tags: string[];
}

export const listStylePresets = () => apiGet<StylePreset[]>("/style-presets");

/** Result of applying a style preset to every component in a project. */
export interface ApplyStylePresetResponse {
  presetId: string;
  presetName: string;
  applied: boolean;
  componentCount: number;
}

/** Apply a named style preset to all components in a project. */
export const applyStylePreset = (projectId: string, presetId: string, apply = true) =>
  apiPost<ApplyStylePresetResponse>(`/projects/${projectId}/style/apply`, { presetId, apply });

// --- Provider & model registry endpoints ---

export interface ModelCapabilities {
  text: boolean;
  vision: boolean;
  audioInput: boolean;
  audioOutput: boolean;
  imageGeneration: boolean;
  videoGeneration: boolean;
  code: boolean;
  toolUse: boolean;
  streaming: boolean;
  reasoning: boolean;
  embedding?: boolean;
}

export interface RegistryModel {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  capabilities: ModelCapabilities;
  generationModality: string | null;
  description: string;
  available: boolean;
}

export interface ProviderConfigInfo {
  type: string;
  providerName?: string;
  model: string;
  baseUrl: string;
  hasKey: boolean;
}

export interface ProvidersStatus {
  mode: string;
  configured: Array<{ name: string; available: boolean }>;
  configs: ProviderConfigInfo[];
}

export interface ProviderKeySpec {
  envVar: string;
  label: string;
  category: string;
  baseUrl?: string;
  defaultModel?: string;
  configured: boolean;
}

export interface ProviderKeysResponse {
  specs: ProviderKeySpec[];
}

export interface ConfigureProvidersResponse {
  ok: boolean;
  mode: string;
  configured: Array<{ name: string; available: boolean }>;
  keyStatus: Array<{ envVar: string; label: string; category: string; configured: boolean }>;
}

export const listProviders = () => apiGet<ProvidersStatus>("/providers");
export const listProviderModels = (provider?: string) =>
  apiGet<{ models: RegistryModel[] }>(`/providers/models${provider ? `?provider=${provider}` : ""}`);
export const listProviderKeys = () => apiGet<ProviderKeysResponse>("/providers/keys");
export const configureProviders = (keys: Record<string, string>) =>
  apiPost<ConfigureProvidersResponse>("/providers/configure", { keys });
export const testProvider = (providerName: string) =>
  apiPost<TestProviderResponse>("/providers/test", { providerName });
export const setProviderMode = (mode: string) =>
  apiPost<{ ok: boolean; mode: string; llmProvider: string }>("/providers/mode", { mode });

export interface ProviderHealthEntry {
  provider: string;
  model: string;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  avgLatencyMs: number;
  circuitOpen: boolean;
  lastError: string;
}

export interface ProviderHealthResponse {
  providers: ProviderHealthEntry[];
}

export const listProviderHealth = () => apiGet<ProviderHealthResponse>("/providers/health");

export interface TestProviderResponse {
  ok: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  tokensOut?: number;
  response?: string;
  error?: string;
}

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

// --- Failure memory endpoints ---
// Episodic lessons the agent recovered from prior tool failures. Each record
// pairs a normalized error signature with the recovery suggestion the agent
// now applies when the same tool fails again.

export interface FailureRecord {
  id: string;
  tool: string;
  errorPattern: string;
  suggestion: string;
  occurrenceCount: number;
  lastSeen: string;
  relevance: number;
}

export interface FailureMemoryResponse {
  count: number;
  records: FailureRecord[];
}

/** List accumulated failure lessons for a project, most relevant first. */
export const listFailures = (projectId: string, limit?: number) => {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return apiGet<FailureMemoryResponse>(`/projects/${projectId}/failures${qs ? `?${qs}` : ""}`);
};

// --- Context budget endpoint ---
// Surfaces the token estimator's view of the active conversation window so
// operators can see when older messages start getting dropped.

export interface ContextBudgetResponse {
  model: string | null;
  contextWindow: number;
  conversation: {
    messageCount: number;
    estimatedTokens: number;
  };
  budget: {
    maxTotal: number;
    systemReserve: number;
    completionReserve: number;
    availableForHistory: number;
  };
  selection: {
    keptMessageCount: number;
    keptTokens: number;
    droppedCount: number;
    fitsBudget: boolean;
  };
  tierLabel: "small" | "medium" | "large" | "xlarge" | "unlimited";
}

/** Estimate the current conversation's token usage and budget allocation. */
export const getContextBudget = (projectId: string, model?: string) => {
  const params = new URLSearchParams();
  if (model) params.set("model", model);
  const qs = params.toString();
  return apiGet<ContextBudgetResponse>(`/projects/${projectId}/context-budget${qs ? `?${qs}` : ""}`);
};

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

/** Result of applying a recipe's tool call sequence to a target component. */
export interface ApplyRecipeResponse {
  recipeId: string;
  recipeName: string;
  componentId: string;
  toolCallsExecuted: number;
  succeeded: number;
  failed: number;
  results: Array<{ tool: string; ok: boolean; summary: string; specChanged?: boolean }>;
  applied: boolean;
}

/** Resolve and execute a recipe's tool calls against a component in a project. */
export const applyRecipe = (projectId: string, recipeId: string, componentId?: string) =>
  apiPost<ApplyRecipeResponse>(`/projects/${projectId}/recipes/${recipeId}/apply`, { componentId });

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

// --- Version history endpoints ---

export interface VersionSummary {
  id: string;
  projectId: string;
  label: string;
  componentCount: number;
  createdAt: string;
}

export const listVersions = (projectId: string) =>
  apiGet<VersionSummary[]>(`/projects/${projectId}/versions`);
export const createVersion = (projectId: string, label: string) =>
  apiPost<VersionSummary>(`/projects/${projectId}/versions`, { label });
export const restoreVersion = (projectId: string, versionId: string) =>
  apiPost<ProjectResponse>(`/projects/${projectId}/versions/${versionId}/restore`, {});
export const deleteVersion = (projectId: string, versionId: string) =>
  apiDelete<void>(`/projects/${projectId}/versions/${versionId}`);

// --- Design token endpoints ---

export type TokenCategory = "duration" | "easing" | "color" | "spacing" | "radius" | "shadow" | "font";

export interface DesignToken {
  id: string;
  projectId: string;
  name: string;
  category: TokenCategory;
  value: string;
  description: string;
  createdAt: string;
}

export const listTokens = (projectId: string, category?: string) =>
  apiGet<DesignToken[]>(`/projects/${projectId}/tokens${category ? `?category=${category}` : ""}`);
export const createToken = (projectId: string, input: { name: string; category: TokenCategory; value: string; description?: string }) =>
  apiPost<DesignToken>(`/projects/${projectId}/tokens`, input);
export const updateToken = (projectId: string, name: string, patch: { value?: string; description?: string }) =>
  apiPatch<DesignToken>(`/projects/${projectId}/tokens/${name}`, patch);
export const deleteToken = (projectId: string, name: string) =>
  apiDelete<void>(`/projects/${projectId}/tokens/${name}`);

// --- Tool pipeline endpoints ---

export interface PipelineStep {
  tool: string;
  args: Record<string, unknown>;
  description?: string;
}

export interface ToolPipeline {
  id: string;
  projectId: string | null;
  name: string;
  description: string;
  steps: PipelineStep[];
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export const listPipelines = (projectId: string) =>
  apiGet<ToolPipeline[]>(`/projects/${projectId}/pipelines`);
export const createPipeline = (
  projectId: string,
  input: { name: string; description?: string; steps: PipelineStep[]; tags?: string[] },
) => apiPost<ToolPipeline>(`/projects/${projectId}/pipelines`, input);
export const updatePipeline = (
  projectId: string,
  pipelineId: string,
  patch: { name?: string; description?: string; steps?: PipelineStep[]; tags?: string[] },
) => apiPatch<ToolPipeline>(`/projects/${projectId}/pipelines/${pipelineId}`, patch);
export const deletePipeline = (projectId: string, pipelineId: string) =>
  apiDelete<void>(`/projects/${projectId}/pipelines/${pipelineId}`);

export interface PipelineExecutionStepResult {
  tool: string;
  ok: boolean;
  summary: string;
  specChanged?: boolean;
}

export interface PipelineExecutionResponse {
  ok: boolean;
  pipelineId: string;
  pipelineName: string;
  stepCount: number;
  succeeded: number;
  failed: number;
  failedSteps: string[];
  anySpecChanged: boolean;
  results: PipelineExecutionStepResult[];
  summary: string;
}

export const runPipeline = (projectId: string, pipelineId: string) =>
  apiPost<PipelineExecutionResponse>(`/projects/${projectId}/pipelines/${pipelineId}/run`, {});

// --- Project insights endpoint (mood, quality, restraint, complexity, creative) ---

export interface MoodAnalysis {
  dominantMood: string;
  moodScores: Record<string, number>;
  narrative: string;
  energy: number;
  rhythm: string;
  coherence: number;
}

export interface ProjectInsights {
  mood: MoodAnalysis;
  quality: { score: number; insights: string[]; componentCount: number };
  restraint: { score: number; warnings: Array<{ level: string; message: string }> };
  creative: {
    suggestions: Array<{ category: string; title: string; description: string; priority: number; novelty: number }>;
    diversityIndex: number;
    projectFingerprint: string;
  };
  timing: {
    easingDistribution: Record<string, number>;
    durationBuckets: { fast: number; normal: number; slow: number };
    totalDurationMs: number;
  };
  complexity: {
    score: number;
    componentCount: number;
    propertyCount: number;
    easingVariety: number;
    loopCount: number;
  };
  availableMoods: string[];
}

export const getProjectInsights = (projectId: string) =>
  apiGet<ProjectInsights>(`/projects/${projectId}/insights`);

/* ----------------------------- Catalog endpoints ----------------------------- */

export interface ShaderEffectInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  parameters: Record<string, { default: number; min: number; max: number }>;
}

export interface ChoreographyPatternInfo {
  id: string;
  name: string;
  description: string;
}

export interface StateMachinePresetInfo {
  id: string;
  name: string;
  description: string;
  stateCount: number;
  transitionCount: number;
  inputCount: number;
}

export const getShaders = (category?: string) =>
  apiGet<ShaderEffectInfo[]>(`/shaders${category ? `?category=${category}` : ""}`);

export const getChoreographyPatterns = () =>
  apiGet<{ patterns: ChoreographyPatternInfo[]; count: number }>("/choreography");

export const getStateMachinePresets = () =>
  apiGet<{ presets: StateMachinePresetInfo[]; count: number }>("/state-machine-presets");

// --- Unified catalog search ---

export interface CatalogSearchResult {
  type:
    | "recipe"
    | "template"
    | "style"
    | "preset-pack"
    | "animation-preset"
    | "export-preset"
    | "rhythm"
    | "motion-theme"
    | "narrative-arc"
    | "shader"
    | "brand-pack"
    | "choreography"
    | "story-genre"
    | "scene-pack"
    | "color-palette"
    | "platform-preset"
    | "a11y-profile"
    | "cursor-choreography";
  id: string;
  name: string;
  description: string;
  score: number;
}

export interface CatalogSearchResponse {
  results: CatalogSearchResult[];
  total: number;
  query: string;
  categories: {
    recipes: number;
    templates: number;
    styles: number;
    presetPacks: number;
    animationPresets: number;
    exportPresets: number;
    rhythms: number;
    motionThemes: number;
    narrativeArcs: number;
    shaders: number;
    brandPacks: number;
    choreography: number;
    storyGenres: number;
    scenePacks: number;
    colorPalettes: number;
    platformPresets: number;
    accessibilityProfiles: number;
    cursorChoreography: number;
  };
}

export const searchCatalog = (q: string, limit?: number) => {
  const params = new URLSearchParams();
  params.set("q", q);
  if (limit) params.set("limit", String(limit));
  return apiGet<CatalogSearchResponse>(`/catalog/search?${params.toString()}`);
};

export interface CatalogSummary {
  total: number;
  categories: {
    recipes: number;
    templates: number;
    styles: number;
    presetPacks: number;
    animationPresets: number;
    exportPresets: number;
    rhythms: number;
    motionThemes: number;
    narrativeArcs: number;
    shaders: number;
    brandPacks: number;
    moods: number;
    choreography: number;
    storyGenres: number;
    stateMachinePresets: number;
    scenePacks: number;
    colorPalettes: number;
    platformPresets: number;
    accessibilityProfiles: number;
    cursorChoreography: number;
  };
}

export const getCatalogSummary = () => apiGet<CatalogSummary>("/catalog/summary");

// --- Automated motion pipeline ---

export interface PipelineStep {
  stage: string;
  status: "pending" | "running" | "done" | "skipped";
  detail?: string;
  durationMs?: number;
}

export interface PipelineResultResponse {
  summary: string;
  steps: PipelineStep[];
  totalDurationMs: number;
  componentCount: number;
  spec: unknown;
}

export interface RunPipelineInput {
  description: string;
  durationMs?: number;
  colorScheme?: "complementary" | "analogous" | "triadic" | "monochrome";
  baseColor?: string;
  choreography?: string;
  componentCount?: number;
}

export const runMotionPipeline = (input: RunPipelineInput) =>
  apiPost<PipelineResultResponse>("/catalog/pipeline", input);

// --- Composition engine ---

export interface TimelineEntry {
  componentId: string;
  name: string;
  startMs: number;
  endMs: number;
  startFrame: number;
  endFrame: number;
}

export interface ComposeInput {
  projectId: string;
  type: "sequence" | "parallel" | "stagger";
  componentIds: string[];
  stepMs?: number;
  gapMs?: number;
}

export interface ComposeResponse {
  type: string;
  timeline: TimelineEntry[];
  totalDurationMs: number;
  frameCount: number;
  fps: number;
}

export const composeSequence = (input: ComposeInput) =>
  apiPost<ComposeResponse>("/catalog/compose", input);

export interface CompositionTreeResponse {
  tree: unknown;
  timeline: TimelineEntry[];
  totalDurationMs: number;
  frameCount: number;
  fps: number;
}

export const getCompositionTree = (projectId: string) =>
  apiGet<CompositionTreeResponse>(`/catalog/composition/${projectId}`);

export interface ReactExportResponse {
  code: string;
  componentCount: number;
  totalDurationMs: number;
  frameCount: number;
}

export const exportCompositionReact = (projectId: string, componentName?: string) =>
  apiPost<ReactExportResponse>("/catalog/composition/react", { projectId, componentName });

// --- Seek-driven deterministic frame rendering ---

export interface ComponentFrameSnapshot {
  componentId: string;
  name: string;
  visible: boolean;
  progress: number;
  transform: Record<string, number | string>;
  styles: Record<string, number | string>;
  transformCss: string;
  opacity: number;
  layer: number;
  startMs: number;
  endMs: number;
}

export interface FrameSeekResponse {
  frame: number;
  fps: number;
  timeMs: number;
  totalFrames: number;
  isComplete: boolean;
  components: ComponentFrameSnapshot[];
  activeCount: number;
  totalCount: number;
}

export const seekToFrame = (projectId: string, frame: number, fps?: number) =>
  apiPost<FrameSeekResponse>(`/catalog/frame/${projectId}`, { frame, fps });

export interface RenderFrameRangeResponse {
  startFrame: number;
  endFrame: number;
  fps: number;
  totalFrames: number;
  durationMs: number;
  activeFrames: number;
  sampleCount: number;
  snapshots: FrameSeekResponse[];
  thumbnailFrame: number;
}

export const renderFrameRange = (
  projectId: string,
  opts?: { startFrame?: number; endFrame?: number; fps?: number; sampleStep?: number },
) =>
  apiPost<RenderFrameRangeResponse>(`/catalog/render/${projectId}`, opts ?? {});

export interface HtmlCompositionResponse {
  html: string;
  componentCount: number;
  totalFrames: number;
  durationMs: number;
  fps: number;
  sizeBytes: number;
}

export const exportHtmlComposition = (
  projectId: string,
  opts?: { width?: number; height?: number; fps?: number; includeControls?: boolean; loop?: boolean },
) =>
  apiPost<HtmlCompositionResponse>(`/catalog/html/${projectId}`, opts ?? {});

// --- Media pipeline ---

export type MediaModality = "audio" | "image" | "video" | "voice" | "icon" | "logo" | "lut" | "font";
export type MediaPurpose =
  | "background-music"
  | "sound-effect"
  | "voiceover"
  | "background-image"
  | "foreground-image"
  | "transition"
  | "overlay"
  | "color-grade"
  | "caption"
  | "watermark";

export interface MediaAsset {
  id: string;
  modality: MediaModality;
  purpose: MediaPurpose;
  description: string;
  source: string;
  mimeType: string;
  sizeBytes: number;
  durationSec?: number;
  width?: number;
  height?: number;
  generated: boolean;
  seed?: number;
  createdAt: string;
  tags: string[];
}

export interface ResolveMediaInput {
  modality: MediaModality;
  purpose: MediaPurpose;
  description: string;
  durationSec?: number;
  allowGeneration?: boolean;
}

export const resolveMedia = (input: ResolveMediaInput) =>
  apiPost<{ asset: MediaAsset }>("/catalog/media/resolve", input);

export interface MediaManifest {
  assets: MediaAsset[];
  totalSizeBytes: number;
  generatedCount: number;
  catalogCount: number;
}

export const getMediaManifest = () => apiGet<MediaManifest>("/catalog/media/manifest");

export const searchMedia = (query: string, limit?: number) => {
  const params = new URLSearchParams();
  params.set("q", query);
  if (limit) params.set("limit", String(limit));
  return apiGet<{ results: MediaAsset[]; count: number }>(`/catalog/media/search?${params.toString()}`);
};

// --- Skills router ---

export type SkillCategory = "creation" | "analysis" | "optimization" | "export" | "editing" | "intelligence";
export type SkillComplexity = "atomic" | "workflow" | "router";

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  category: SkillCategory;
  complexity: SkillComplexity;
  keywords: string[];
  tools: string[];
  prerequisites?: string[];
  mockAvailable: boolean;
  estimatedSteps: number;
}

export interface SkillRouteResponse {
  primary: SkillInfo;
  supporting: SkillInfo[];
  intent: string;
  confidence: number;
  plan: string[];
}

export const routeUserIntent = (userInput: string) =>
  apiPost<SkillRouteResponse>("/catalog/skills/route", { userInput });

export interface SkillsSummary {
  totalSkills: number;
  byCategory: Record<string, number>;
  byComplexity: Record<string, number>;
  mockAvailable: number;
}

export interface SkillsListResponse {
  skills: SkillInfo[];
  summary: SkillsSummary;
  count: number;
}

export const listSkillsByCategory = (category?: SkillCategory) =>
  apiGet<SkillsListResponse>(`/catalog/skills${category ? `?category=${category}` : ""}`);

// --- Narrative sequence planning ---

export interface NarrativeArcInfo {
  id: string;
  name: string;
  description: string;
  defaultSceneCount: number;
  toneProgression: string[];
}

export interface NarrativeArcsResponse {
  arcs: NarrativeArcInfo[];
  count: number;
}

export const listNarrativeArcs = () =>
  apiGet<NarrativeArcsResponse>("/motion/narrative-arcs");

export interface SequencePlanInput {
  description: string;
  arc?: string;
  totalDurationMs?: number;
  sceneCount?: number;
  fps?: number;
  optimize?: boolean;
}

export interface SequencePlanResponse {
  sequence: unknown;
  summary: string;
}

export const planMotionSequence = (projectId: string, input: SequencePlanInput) =>
  apiPost<SequencePlanResponse>(`/projects/${projectId}/sequence/plan`, input);

// --- Motion themes ---

export interface MotionThemeInfo {
  id: string;
  name: string;
  personality: string;
  description: string;
  tags: string[];
  easingFamily: {
    standard: string;
    spring: { stiffness: number; damping: number; mass: number };
  };
  timingScale: {
    micro: number;
    standard: number;
    extended: number;
    scene: number;
    stagger: number;
  };
  vocabulary: { encouraged: string[]; discouraged: string[] };
}

export interface MotionThemesResponse {
  themes: MotionThemeInfo[];
  count: number;
}

export const listMotionThemes = (personality?: string) =>
  apiGet<MotionThemesResponse>(`/motion/themes${personality ? `?personality=${personality}` : ""}`);

export interface ApplyThemeInput {
  themeId: string;
  apply?: boolean;
}

export interface ApplyThemeResponse {
  themeId: string;
  themeName: string;
  personality: string;
  applied: boolean;
  compatibility: {
    score: number;
    matched: string[];
    mismatched: string[];
    suggestions: string[];
  };
}

export const applyMotionTheme = (projectId: string, input: ApplyThemeInput) =>
  apiPost<ApplyThemeResponse>(`/projects/${projectId}/theme/apply`, input);

// --- Rhythm patterns ---

export interface RhythmPatternInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  bpm: number;
  timeSignature: string;
  beatMultipliers: number[];
  accents: number[];
  tags: string[];
}

export interface RhythmPatternsResponse {
  patterns: RhythmPatternInfo[];
  count: number;
}

export const listRhythmPatterns = (category?: string) =>
  apiGet<RhythmPatternsResponse>(`/motion/rhythms${category ? `?category=${category}` : ""}`);

export interface ApplyRhythmInput {
  patternId: string;
  itemCount: number;
  bpm?: number;
  scale?: number;
}

export interface ApplyRhythmResponse {
  patternId: string;
  delays: number[];
  accents: number[];
  totalMs: number;
  bpm: number;
  beatTimes: number[];
  beatAccents: number[];
  visualization: string;
}

export const applyRhythmPattern = (input: ApplyRhythmInput) =>
  apiPost<ApplyRhythmResponse>("/motion/rhythms/apply", input);

// --- Motion variants ---

export interface GenerateVariantsInput {
  count?: number;
  strategies?: string[];
  seed?: number;
}

export interface MotionVariantInfo {
  id: string;
  name: string;
  strategy: string;
  changes: unknown[];
  spec: unknown;
}

export interface GenerateVariantsResponse {
  variants: MotionVariantInfo[];
  count: number;
  comparison: unknown;
  summary: string;
}

export const generateMotionVariants = (projectId: string, input: GenerateVariantsInput) =>
  apiPost<GenerateVariantsResponse>(`/projects/${projectId}/variants`, input);

// --- Motion evolution ---

export interface EvolutionStrategyInfo {
  id: string;
  name: string;
  description: string;
}

export interface EvolutionStrategiesResponse {
  strategies: EvolutionStrategyInfo[];
  count: number;
}

export const listEvolutionStrategies = () =>
  apiGet<EvolutionStrategiesResponse>("/motion/evolution/strategies");

export interface EvolveMotionInput {
  strategy?: string;
  generations?: number;
  populationSize?: number;
  mutationRate?: number;
  apply?: boolean;
}

export interface EvolveMotionResponse {
  best: {
    generation: number;
    origin: string;
    fitness: {
      total: number;
      principles: number;
      accessibility: number;
      performance: number;
      harmony: number;
      novelty: number;
      breakdown: string[];
    };
  };
  history: Array<{
    generation: number;
    bestFitness: number;
    averageFitness: number;
    worstFitness: number;
    diversity: number;
    improvements: number;
  }>;
  improvement: number;
  applied: boolean;
  summary: string;
}

export const evolveMotion = (projectId: string, input: EvolveMotionInput) =>
  apiPost<EvolveMotionResponse>(`/projects/${projectId}/evolve`, input);

// ---------------------------------------------------------------------------
// Motion Perception
// ---------------------------------------------------------------------------

export interface PerceptionReport {
  valenceCurve: Array<{ timeMs: number; valence: number; drivers: string[] }>;
  arousalCurve: Array<{ timeMs: number; arousal: number; label: string }>;
  cognitiveLoad: {
    score: number;
    level: string;
    peakSimultaneous: number;
    peakWindow: { startMs: number; endMs: number } | null;
    factors: {
      simultaneousAnimations: number;
      averageSpeed: number;
      complexityScore: number;
      trackingDifficulty: number;
    };
    recommendations: string[];
  };
  attention: {
    points: Array<{ timeMs: number; attention: number }>;
    halfLifeMs: number;
    disengagementMs: number | null;
    sustainsAttention: boolean;
  };
  memorability: {
    score: number;
    level: string;
    drivers: {
      distinctiveness: number;
      emotionalPeak: number;
      narrativeStructure: number;
      surpriseElement: number;
      repetitionPattern: number;
    };
    suggestions: string[];
  };
  brand: {
    attributes: Array<{ name: string; strength: number; direction: string }>;
    personality: string;
    confidence: number;
  };
  overallScore: number;
  summary: string;
  topRecommendations: string[];
}

export const predictPerception = (projectId: string) =>
  apiGet<PerceptionReport>(`/projects/${projectId}/perception`);

// ---------------------------------------------------------------------------
// Motion Semantics
// ---------------------------------------------------------------------------

export interface SemanticConceptInfo {
  id: string;
  label: string;
  category: string;
  description: string;
  keywords: string[];
  profile: {
    easings: string[];
    durationRange: { min: number; max: number };
    delayStrategy: string;
    staggerMs: number;
    transforms: string[];
    palette: string[];
    iteration: string;
    energy: number;
    warmth: number;
    smoothness: number;
  };
}

export interface SemanticConceptsResponse {
  concepts: SemanticConceptInfo[];
  count: number;
}

export const listSemanticConcepts = (category?: string) =>
  apiGet<SemanticConceptsResponse>(
    `/motion/semantic-concepts${category ? `?category=${category}` : ""}`,
  );

export interface InferredIntent {
  concepts: Array<{
    conceptId: string;
    conceptLabel: string;
    confidence: number;
    matchedKeywords: string[];
  }>;
  emotion: { valence: number; arousal: number; label?: string };
  suggestedProfile: SemanticConceptInfo["profile"];
  summary: string;
}

export const inferIntent = (description: string) =>
  apiPost<InferredIntent>("/motion/infer-intent", { description });

export interface BlendedConcept {
  profile: SemanticConceptInfo["profile"];
  recipe: string;
  sources: string[];
}

export const blendConcepts = (conceptA: string, conceptB: string, weightA?: number) =>
  apiPost<BlendedConcept>("/motion/blend-concepts", { conceptA, conceptB, weightA });

// ---------------------------------------------------------------------------
// Motion Physics
// ---------------------------------------------------------------------------

export interface PhysicsTypeInfo {
  id: string;
  name: string;
  description: string;
}

export interface PhysicsPresetInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  config: Record<string, number>;
}

export interface PhysicsSimulationResult {
  component: unknown;
  samples: Array<{ timeMs: number; x: number; y: number; rotation: number }>;
  summary: string;
}

export const listPhysicsTypes = () =>
  apiGet<{ types: PhysicsTypeInfo[] }>("/motion/physics/types");

export const listPhysicsPresets = () =>
  apiGet<{ presets: PhysicsPresetInfo[] }>("/motion/physics/presets");

export const simulatePhysics = (type: string, config?: Record<string, number>) =>
  apiPost<PhysicsSimulationResult>("/motion/physics/simulate", { type, config });

export const runPhysicsPreset = (presetId: string) =>
  apiPost<PhysicsSimulationResult>(`/motion/physics/preset/${presetId}`, {});

// ---------------------------------------------------------------------------
// Motion Path
// ---------------------------------------------------------------------------

export interface PathTypeInfo {
  id: string;
  name: string;
  description: string;
}

export interface PathPresetInfo {
  id: string;
  name: string;
  description: string;
  type: string;
  config: Record<string, unknown>;
}

export interface PathMotionResult {
  component: unknown;
  points: Array<{ x: number; y: number; t: number }>;
  summary: string;
}

export const listPathTypes = () =>
  apiGet<{ types: PathTypeInfo[] }>("/motion/path/types");

export const listPathPresets = () =>
  apiGet<{ presets: PathPresetInfo[] }>("/motion/path/presets");

export const generatePathMotion = (type: string, options?: { durationMs?: number; samples?: number; scale?: number; loop?: boolean }) =>
  apiPost<PathMotionResult>("/motion/path/generate", { type, ...options });

export const runPathPreset = (presetId: string) =>
  apiPost<PathMotionResult>(`/motion/path/preset/${presetId}`, {});

// ---------------------------------------------------------------------------
// Motion Codec
// ---------------------------------------------------------------------------

export interface CodecFormatInfo {
  id: string;
  name: string;
  description: string;
  mimeType: string;
  fileExtension: string;
}

export interface CodecResult {
  format: string;
  output: string;
  mimeType: string;
  fileExtension: string;
  summary: string;
}

export const listCodecFormats = () =>
  apiGet<{ formats: CodecFormatInfo[] }>("/motion/codec/formats");

export const encodeProject = (projectId: string, format: string, minify?: boolean) =>
  apiPost<CodecResult>(`/projects/${projectId}/encode`, { format, minify });

// ---------------------------------------------------------------------------
// Style Transfer API
// ---------------------------------------------------------------------------

export interface StyleArchetype {
  id: string;
  name: string;
  description: string;
  dna: Record<string, unknown>;
}

export interface StyleDnaResult {
  dna: Record<string, unknown>;
  description: string;
}

export interface StyleComparisonResult {
  overallSimilarity: number;
  verdict: string;
  dimensions: Record<string, unknown>;
}

export const listStyleArchetypes = () =>
  apiGet<{ archetypes: StyleArchetype[] }>("/motion/style/archetypes");

export const extractStyleDna = (projectId: string) =>
  apiGet<StyleDnaResult>(`/projects/${projectId}/style/dna`);

export const describeProjectStyle = (projectId: string) =>
  apiGet<StyleDnaResult>(`/projects/${projectId}/style/description`);

export const transferProjectStyle = (
  projectId: string,
  sourceProjectId: string,
  options?: { easingStrength?: number; tempoStrength?: number; energyStrength?: number; colorStrength?: number },
) =>
  apiPost<{ result: Record<string, unknown> }>(`/projects/${projectId}/style/transfer`, {
    sourceProjectId,
    ...options,
  });

export const blendProjectStyles = (projectId: string, projectIdA: string, projectIdB: string, ratio: number) =>
  apiPost<StyleDnaResult>(`/projects/${projectId}/style/blend`, { projectIdA, projectIdB, ratio });

export const compareProjectStyles = (projectIdA: string, projectIdB: string) =>
  apiGet<StyleComparisonResult>(`/projects/${projectIdA}/style/compare/${projectIdB}`);

export const applyStyleArchetype = (projectId: string, archetypeId: string) =>
  apiPost<{ result: Record<string, unknown> }>(`/projects/${projectId}/style/archetype`, { archetypeId });

// ---------------------------------------------------------------------------
// Knowledge Graph API
// ---------------------------------------------------------------------------

export interface KnowledgeGraph {
  nodes: Array<{ id: string; label: string; category: string; description: string; tags: string[] }>;
  edges: Array<{ source: string; target: string; relationship: string; strength: number; description: string }>;
}

export interface GraphAnalysis {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  centralNodes: Array<{ conceptId: string; centrality: number }>;
  clusters: Array<{ id: number; conceptIds: string[] }>;
  bridges: string[];
  connectedComponents: number;
  isolatedNodes: string[];
}

export const getKnowledgeGraph = () =>
  apiGet<{ graph: KnowledgeGraph }>("/motion/knowledge-graph");

export const queryConcept = (conceptId: string) =>
  apiGet<{ concept: KnowledgeGraph["nodes"][0] }>(`/motion/knowledge-graph/concept/${conceptId}`);

export const findRelatedConcepts = (conceptId: string, relationship?: string) => {
  const params = new URLSearchParams();
  if (relationship) params.set("relationship", relationship);
  const qs = params.toString();
  return apiGet<{ related: KnowledgeGraph["nodes"] }>(
    `/motion/knowledge-graph/related/${conceptId}${qs ? `?${qs}` : ""}`,
  );
};

export const findConceptPath = (fromId: string, toId: string) => {
  const params = new URLSearchParams();
  params.set("from", fromId);
  params.set("to", toId);
  return apiGet<{ path: string[] }>(`/motion/knowledge-graph/path?${params.toString()}`);
};

export const searchConcepts = (query: string) => {
  const params = new URLSearchParams();
  params.set("q", query);
  return apiGet<{ results: KnowledgeGraph["nodes"] }>(`/motion/knowledge-graph/search?${params.toString()}`);
};

export const suggestConnections = (conceptIds: string[]) =>
  apiPost<{ suggestions: Array<{ conceptA: string; conceptB: string; reason: string; strength: number }> }>(
    "/motion/knowledge-graph/suggest",
    { conceptIds },
  );

export const recommendNextConcepts = (usedConceptIds: string[]) =>
  apiPost<{ recommendations: KnowledgeGraph["nodes"] }>(
    "/motion/knowledge-graph/recommend",
    { usedConceptIds },
  );

export const analyzeKnowledgeGraph = () =>
  apiGet<{ analysis: GraphAnalysis }>("/motion/knowledge-graph/analyze");

// ---------------------------------------------------------------------------
// Motion Testing API
// ---------------------------------------------------------------------------

export interface TestSuiteInfo {
  id: string;
  name: string;
  description: string;
  category: string;
}

export interface TestCheck {
  name: string;
  passed: boolean;
  severity: "info" | "warning" | "error";
  message: string;
  componentId?: string;
}

export interface TestResult {
  suiteId: string;
  suiteName: string;
  category: string;
  passed: boolean;
  score: number;
  checks: TestCheck[];
  summary: string;
  recommendations: string[];
}

export interface TestReport {
  totalSuites: number;
  passedSuites: number;
  overallScore: number;
  results: TestResult[];
  topIssues: TestCheck[];
  summary: string;
}

export const listTestSuites = () =>
  apiGet<{ suites: TestSuiteInfo[] }>("/motion/test-suites");

export const runAllTests = (projectId: string) =>
  apiGet<TestReport>(`/projects/${projectId}/tests`);

export const runTestsByCategory = (projectId: string, category: string) =>
  apiGet<{ results: TestResult[] }>(`/projects/${projectId}/tests/category/${category}`);

export const runTestSuite = (projectId: string, suiteId: string) =>
  apiGet<{ result: TestResult }>(`/projects/${projectId}/tests/suite/${suiteId}`);

// ---------------------------------------------------------------------------
// Motion Collaboration Engine
// ---------------------------------------------------------------------------

export interface CollaborationModule {
  id: string;
  name: string;
  specialty: string;
  triggerKeywords: string[];
}

export interface CollaborationPlan {
  request: string;
  modules: CollaborationModule[];
  subTasks: Array<{
    id: string;
    moduleId: string;
    objective: string;
    inputs: Record<string, unknown>;
    dependsOn: string[];
    parallelizable: boolean;
  }>;
  pattern: string;
  summary: string;
  report?: string;
}

export interface CollaborationResult {
  component: unknown;
  contributions: Array<{
    moduleId: string;
    moduleName: string;
    contribution: string;
    confidence: number;
  }>;
  conflictResolutions: string[];
  confidence: number;
  summary: string;
  report?: string;
}

export const listCollaborationModules = () =>
  apiGet<{ modules: CollaborationModule[]; count: number }>("/motion/collaboration/modules");

export const planCollaboration = (request: string) =>
  apiPost<CollaborationPlan>("/motion/collaboration/plan", { request });

export const executeCollaboration = (request: string) =>
  apiPost<CollaborationResult>("/motion/collaboration/execute", { request });

// ---------------------------------------------------------------------------
// Motion Resonance Engine
// ---------------------------------------------------------------------------

export interface ViewerState {
  attention?: number;
  arousal?: number;
  valence?: number;
  fatigue?: number;
  timeOfDay?: "morning" | "afternoon" | "evening" | "night";
}

export interface DissonancePoint {
  componentId: string;
  type: "frequency" | "intensity" | "duration" | "easing";
  description: string;
  severity: number;
}

export interface ResonanceRecommendation {
  componentId: string;
  adjustment: string;
  expectedGain: number;
  newValue: number | string;
}

export interface ResonanceAnalysis {
  resonance: number;
  cognitiveAlignment: number;
  emotionalAlignment: number;
  rhythmicAlignment: number;
  dissonances: DissonancePoint[];
  recommendations: ResonanceRecommendation[];
  summary: string;
  report?: string;
}

export interface ResonanceTuning {
  tunedSpec: unknown;
  adjustments: Array<{
    componentId: string;
    field: string;
    oldValue: unknown;
    newValue: unknown;
    reason: string;
  }>;
  summary: string;
}

export const analyzeResonance = (projectId: string, viewerState?: ViewerState) => {
  const params = new URLSearchParams();
  if (viewerState) {
    if (viewerState.attention !== undefined) params.set("attention", String(viewerState.attention));
    if (viewerState.arousal !== undefined) params.set("arousal", String(viewerState.arousal));
    if (viewerState.valence !== undefined) params.set("valence", String(viewerState.valence));
    if (viewerState.fatigue !== undefined) params.set("fatigue", String(viewerState.fatigue));
    if (viewerState.timeOfDay) params.set("timeOfDay", viewerState.timeOfDay);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiGet<ResonanceAnalysis>(`/projects/${projectId}/resonance${query}`);
};

export const tuneResonance = (projectId: string, viewerState?: ViewerState) =>
  apiPost<ResonanceTuning>(`/projects/${projectId}/resonance/tune`, { viewerState });

// ---------------------------------------------------------------------------
// Motion Synesthesia Engine
// ---------------------------------------------------------------------------

export interface ColorMapping {
  hue: number;
  saturation: number;
  lightness: number;
  hex: string;
  name: string;
  rationale: string;
}

export interface SoundMapping {
  pitch: number;
  note: string;
  instrument: string;
  tempo: number;
  volume: number;
  rationale: string;
}

export interface TextureMapping {
  surface: "smooth" | "rough" | "soft" | "hard" | "liquid" | "granular" | "crystalline" | "elastic";
  weight: number;
  temperature: number;
  rationale: string;
}

export interface SensoryTranslation {
  componentId: string;
  color: ColorMapping;
  sound: SoundMapping;
  texture: TextureMapping;
  character: string;
}

export interface SynestheticExperience {
  translations: SensoryTranslation[];
  palette: string[];
  soundscape: string;
  tactileCharacter: string;
  summary: string;
  report?: string;
}

export interface SensoryToMotionMapping {
  modality: "color" | "sound" | "texture" | "emotion";
  sourceValue: string | number;
  durationMs: number;
  easingPreset: string;
  intensity: number;
  hue?: number;
  rationale: string;
}

export const translateSynesthesia = (projectId: string) =>
  apiGet<SynestheticExperience>(`/projects/${projectId}/synesthesia`);

export const mapSensoryToMotion = (modality: "color" | "sound" | "texture" | "emotion", value: string) =>
  apiPost<SensoryToMotionMapping>("/motion/synesthesia/map", { modality, value });

// ---------------------------------------------------------------------------
// Motion Dream Engine
// ---------------------------------------------------------------------------

export interface DreamConcept {
  id: string;
  name: string;
  category: "natural" | "mechanical" | "abstract" | "organic" | "cosmic" | "temporal" | "emotional";
  parameters: {
    durationRange: [number, number];
    easing: string;
    pattern: string;
    transforms: string[];
    palette: string[];
    intensity: number;
  };
  triggerWords: string[];
}

export interface DreamMotion {
  component: unknown;
  sourceConcepts: string[];
  technique: string;
  description: string;
  novelty: number;
  report?: string;
}

export interface DreamSequence {
  title: string;
  motions: DreamMotion[];
  narrative: string;
  novelty: number;
  summary: string;
  report?: string;
}

export const listDreamConcepts = () =>
  apiGet<{ concepts: DreamConcept[]; count: number }>("/motion/dream/concepts");

export const dreamFromPrompt = (prompt: string) =>
  apiPost<DreamMotion>("/motion/dream/prompt", { prompt });

export const generateDreamSequence = (length?: number, seed?: string) =>
  apiPost<DreamSequence>("/motion/dream/sequence", { length, seed });

// ---------------------------------------------------------------------------
// Motion Harmonics Engine
// ---------------------------------------------------------------------------

export interface FrequencySignature {
  componentId: string;
  fundamentalHz: number;
  periodMs: number;
  isCyclic: boolean;
  amplitude: number;
  waveform: "sine" | "triangle" | "square" | "sawtooth" | "pulse" | "noise";
  overtones: number[];
}

export interface HarmonicRelation {
  componentAId: string;
  componentBId: string;
  ratio: number;
  ratioLabel: string;
  consonance: number;
  type: "unison" | "octave" | "fifth" | "fourth" | "third" | "consonant" | "dissonant" | "incomparable";
  description: string;
}

export interface HarmonicAnalysis {
  signatures: FrequencySignature[];
  relations: HarmonicRelation[];
  complexity: number;
  consonance: number;
  dominantFrequency: number;
  spectralCentroid: number;
  beatCount: number;
  summary: string;
  report?: string;
}

export const analyzeHarmonics = (projectId: string) =>
  apiGet<HarmonicAnalysis>(`/projects/${projectId}/harmonics`);

export const findHarmonics = (projectId: string, componentId: string) =>
  apiGet<{
    target: FrequencySignature | null;
    compatible: HarmonicRelation[];
    dissonant: HarmonicRelation[];
  }>(`/projects/${projectId}/harmonics/${componentId}`);

// ---------------------------------------------------------------------------
// Motion Entropy Engine
// ---------------------------------------------------------------------------

export interface PropertyEntropy {
  property: string;
  entropyBits: number;
  normalized: number;
  distinctValues: number;
  distribution: Array<{ value: string; count: number; probability: number }>;
}

export interface MutualInformation {
  componentAId: string;
  componentBId: string;
  mutualInfoBits: number;
  normalized: number;
  type: "independent" | "weak" | "moderate" | "strong" | "redundant";
  description: string;
}

export interface DensityWindow {
  startMs: number;
  endMs: number;
  activeCount: number;
  densityBitsPerMs: number;
  entropyBits: number;
}

export interface EntropyAnalysis {
  propertyEntropies: PropertyEntropy[];
  mutualInformation: MutualInformation[];
  densityWindows: DensityWindow[];
  overallEntropyBits: number;
  overallNormalized: number;
  predictability: number;
  redundancy: number;
  densityClass: "sparse" | "balanced" | "dense" | "saturated";
  summary: string;
  report?: string;
}

export interface InformationHotspots {
  mostVaried: PropertyEntropy[];
  leastVaried: PropertyEntropy[];
  redundantPairs: MutualInformation[];
}

export const analyzeEntropy = (projectId: string) =>
  apiGet<EntropyAnalysis>(`/projects/${projectId}/entropy`);

export const identifyInformationHotspots = (projectId: string) =>
  apiGet<InformationHotspots>(`/projects/${projectId}/entropy/hotspots`);

// ---------------------------------------------------------------------------
// Motion Cognition Engine
// ---------------------------------------------------------------------------

export interface WorkingMemoryDemand {
  simultaneousElements: number;
  exceedsCapacity: boolean;
  level: "low" | "moderate" | "high" | "overload";
  chunkCount: number;
  description: string;
}

export interface AttentionSwitching {
  eventsPerSecond: number;
  totalEvents: number;
  switchingCost: number;
  level: "low" | "moderate" | "high" | "overload";
  description: string;
}

export interface PerceptualGrouping {
  similarityGroups: number;
  proximityGroups: number;
  continuityGroups: number;
  efficiency: number;
  description: string;
}

export interface ProcessingFluency {
  fluency: number;
  familiarity: number;
  complexity: number;
  description: string;
}

export interface CognitiveLoadAnalysis {
  workingMemory: WorkingMemoryDemand;
  attentionSwitching: AttentionSwitching;
  perceptualGrouping: PerceptualGrouping;
  processingFluency: ProcessingFluency;
  overallLoad: number;
  loadClass: "effortless" | "easy" | "moderate" | "demanding" | "overwhelming";
  sustainedAttentionSec: number;
  recommendations: string[];
  summary: string;
  report?: string;
}

export const analyzeCognitiveLoad = (projectId: string) =>
  apiGet<CognitiveLoadAnalysis>(`/projects/${projectId}/cognitive-load`);

// ---------------------------------------------------------------------------
// Motion Topology Engine
// ---------------------------------------------------------------------------

export interface TopologyNode {
  componentId: string;
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  degree: number;
  isBoundary: boolean;
  componentGroup: number;
}

export interface TopologyEdge {
  componentAId: string;
  componentBId: number;
  overlapMs: number;
  strength: number;
}

export interface ConnectedComponent {
  id: number;
  memberIds: string[];
  startTimeMs: number;
  endTimeMs: number;
  spanMs: number;
  isIsolated: boolean;
}

export interface TemporalHole {
  startMs: number;
  endMs: number;
  durationMs: number;
  beforeIds: string[];
  afterIds: string[];
  severity: number;
}

export interface TopologyAnalysis {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  connectedComponents: ConnectedComponent[];
  temporalHoles: TemporalHole[];
  eulerCharacteristic: number;
  genus: number;
  connectivity: number;
  compactness: number;
  complexity: number;
  summary: string;
  report?: string;
}

export interface TemporalPath {
  found: boolean;
  path: string[];
  totalOverlapMs: number;
}

export const analyzeTopology = (projectId: string) =>
  apiGet<TopologyAnalysis>(`/projects/${projectId}/topology`);

export const findTemporalPath = (projectId: string, fromId: string, toId: string) => {
  const params = new URLSearchParams();
  params.set("fromId", fromId);
  params.set("toId", toId);
  return apiGet<TemporalPath>(`/projects/${projectId}/topology/path?${params.toString()}`);
};

// ---------------------------------------------------------------------------
// Motion Poetics Engine
// ---------------------------------------------------------------------------

export type PoeticFoot =
  | "iamb" | "trochee" | "dactyl" | "anapest" | "spondee" | "pyrrhic";

export interface FootInstance {
  index: number;
  foot: PoeticFoot;
  componentIds: string[];
  durationRatio: number;
  startMs: number;
}

export interface Stanza {
  index: number;
  componentIds: string[];
  startMs: number;
  endMs: number;
  footCount: number;
  endsWithCaesura: boolean;
}

export interface PoeticAnalysis {
  feet: FootInstance[];
  stanzas: Stanza[];
  dominantMeter: string;
  dominantFoot: PoeticFoot;
  avgFeetPerStanza: number;
  regularity: number;
  caesuras: Array<{ timeMs: number; durationMs: number }>;
  enjambments: Array<{ fromStanza: number; toStanza: number }>;
  form: "free-verse" | "blank-verse" | "haiku" | "sonnet" | "ballad" | "structured";
  tempo: "largo" | "adagio" | "andante" | "moderato" | "allegro" | "presto";
  summary: string;
  report?: string;
}

export const analyzePoetics = (projectId: string) =>
  apiGet<PoeticAnalysis>(`/projects/${projectId}/poetics`);

// ---------------------------------------------------------------------------
// Motion Ecology Engine
// ---------------------------------------------------------------------------

export interface Species {
  name: string;
  easingFamily: string;
  durationBucket: "very-short" | "short" | "medium" | "long" | "very-long";
  loopBehavior: "one-shot" | "finite-loop" | "infinite-loop";
  memberIds: string[];
  population: number;
}

export interface EcologicalRelation {
  speciesA: string;
  speciesB: string;
  type: "symbiotic" | "parasitic" | "predator-prey" | "commensal" | "neutral";
  strength: number;
  description: string;
}

export interface EcosystemAnalysis {
  species: Species[];
  relations: EcologicalRelation[];
  biodiversity: number;
  richness: number;
  evenness: number;
  dominantSpecies: string;
  totalPopulation: number;
  carryingCapacity: number;
  health: number;
  stability: "fragile" | "stable" | "resilient" | "thriving";
  trophicLevels: {
    producers: number;
    primaryConsumers: number;
    secondaryConsumers: number;
    apex: number;
  };
  summary: string;
  report?: string;
}

export const analyzeEcosystem = (projectId: string) =>
  apiGet<EcosystemAnalysis>(`/projects/${projectId}/ecosystem`);

// ---------------------------------------------------------------------------
// Motion Calligraphy Engine
// ---------------------------------------------------------------------------

export interface CalligraphyAnalysis {
  strokes: Array<{
    componentId: string;
    pressure: number;
    velocity: number;
    fluency: number;
    inkFlow: string;
    strokeType: string;
    character: string;
    description: string;
  }>;
  overallCharacter: string;
  inkFlowDistribution: Record<string, number>;
  styleConsistency: number;
  summary: string;
  report?: string;
}

export const analyzeCalligraphy = (projectId: string) =>
  apiGet<CalligraphyAnalysis>(`/projects/${projectId}/calligraphy`);

// ---------------------------------------------------------------------------
// Motion Mythology Engine
// ---------------------------------------------------------------------------

export interface MythologyAnalysis {
  journeyStages: Array<{ name: string; componentIds: string[]; intensity: number }>;
  archetypes: Array<{ name: string; componentIds: string[]; confidence: number }>;
  narrativeStructure: string;
  theme: string;
  resonance: number;
  boon: string;
  tensionCurve: Array<{ timeMs: number; tension: number }>;
  catharsis: number;
  summary: string;
  report?: string;
}

export const analyzeMythology = (projectId: string) =>
  apiGet<MythologyAnalysis>(`/projects/${projectId}/mythology`);

// ---------------------------------------------------------------------------
// Motion Weather Engine
// ---------------------------------------------------------------------------

export interface WeatherAnalysis {
  pressure: number;
  windSpeed: number;
  windDirection: string;
  temperature: string;
  humidity: number;
  fronts: Array<{ type: string; timeMs: number; intensity: number }>;
  storms: Array<{ peakTimeMs: number; intensity: number; durationMs: number }>;
  calmPeriods: Array<{ startMs: number; endMs: number }>;
  climate: string;
  forecast: string;
  visibility: number;
  summary: string;
  report?: string;
}

export const analyzeWeather = (projectId: string) =>
  apiGet<WeatherAnalysis>(`/projects/${projectId}/weather`);

// ---------------------------------------------------------------------------
// Motion Alchemy Engine
// ---------------------------------------------------------------------------

export interface AlchemyAnalysis {
  stages: Array<{ name: string; latinTitle: string; commonName: string; intensity: number; transformation: string; symbolism: string }>;
  operations: Array<{ name: string; description: string; potency: number }>;
  primaMateria: { elementCount: number; state: string; elements: Array<{ element: string; proportion: number }> };
  philosophersStone: { achieved: boolean; completion: number; quality: string; gift: string };
  hermesPrinciple: { macrocosm: string; microcosm: string; resonance: number };
  transmutationProgress: number;
  dominantElement: string;
  crucibleTemperature: number;
  summary: string;
  report?: string;
}

export const analyzeAlchemy = (projectId: string) =>
  apiGet<AlchemyAnalysis>(`/projects/${projectId}/alchemy`);

// ---------------------------------------------------------------------------
// Motion Architecture Engine
// ---------------------------------------------------------------------------

export interface ArchitectureAnalysis {
  structuralRoles: Array<{ componentId: string; role: string; loadBearing: number; essential: boolean }>;
  proportion: { goldenRatioProximity: number; modularHarmony: number; dominantModule: number };
  hierarchy: Array<{ level: string; componentCount: number; weight: number }>;
  spatialOrganization: { plan: string; section: string; elevation: string; compactness: number };
  style: { style: string; confidence: number; characteristics: string[] };
  integrity: { stability: number; balance: number; loadDistribution: number; materialHonesty: number; issues: Array<{ severity: string; message: string }> };
  quality: number;
  summary: string;
  report?: string;
}

export const analyzeArchitecture = (projectId: string) =>
  apiGet<ArchitectureAnalysis>(`/projects/${projectId}/architecture`);

// ---------------------------------------------------------------------------
// Motion Cartography Engine
// ---------------------------------------------------------------------------

export interface CartographyAnalysis {
  elevationProfile: Array<{ timeMs: number; elevation: number; contributingComponents: string[] }>;
  contourLines: Array<{ level: number; ranges: Array<{ startMs: number; endMs: number }>; description: string }>;
  landmarks: Array<{ name: string; timeMs: number; elevation: number; type: string; description: string }>;
  routes: Array<{ name: string; componentId: string; difficulty: number; description: string }>;
  territories: Array<{ name: string; biome: string; startMs: number; endMs: number; avgElevation: number; description: string }>;
  compass: { direction: string; meaning: string; intensity: number };
  scale: { level: string; duration: number; density: number };
  highestPeak: number;
  lowestValley: number;
  averageElevation: number;
  roughness: number;
  summary: string;
  report?: string;
}

export const analyzeCartography = (projectId: string) =>
  apiGet<CartographyAnalysis>(`/projects/${projectId}/cartography`);

// ---------------------------------------------------------------------------
// Motion Genealogy Engine
// ---------------------------------------------------------------------------

export interface GenealogyAnalysis {
  traits: Array<{ componentId: string; componentName: string | null; easingGene: string; durationGene: string; complexityGene: string; motionTypeGene: string; signature: string }>;
  ancestryLinks: Array<{ parentId: string; childId: string; similarity: number; type: string; inheritedTraits: string[]; mutatedTraits: string[] }>;
  tree: { roots: Array<{ componentId: string; generation: number; childrenIds: string[] }>; maxDepth: number; totalBranches: number };
  pattern: { pattern: string; strength: number; evidence: string[] };
  diversity: { diversity: number; distinctSignatures: number; traitVariation: Array<{ gene: string; distinctValues: number; entropy: number }> };
  inheritance: { conservedTraits: Array<{ trait: string; conservationRate: number }>; mutatedTraits: Array<{ trait: string; mutationRate: number }> };
  commonAncestor: string | null;
  mutationRate: number;
  summary: string;
  report?: string;
}

export const analyzeGenealogy = (projectId: string) =>
  apiGet<GenealogyAnalysis>(`/projects/${projectId}/genealogy`);

// ---------------------------------------------------------------------------
// Motion Astronomy Engine
// ---------------------------------------------------------------------------

export interface CelestialBody {
  componentId: string;
  componentName: string | null;
  type: "star" | "planet" | "moon" | "asteroid" | "comet" | "black-hole" | "nebula" | "pulsar";
  spectralType: "O" | "B" | "A" | "F" | "G" | "K" | "M";
  luminosity: number;
  orbitalPeriod: number;
  cosmicDistance: number;
  magnitude: number;
  description: string;
}

export interface Constellation {
  name: string;
  starIds: string[];
  starCount: number;
  pattern: "linear" | "triangular" | "quadrilateral" | "cluster" | "scattered";
  brightness: number;
  description: string;
}

export interface CosmicEvent {
  type: "big-bang" | "supernova" | "eclipse" | "conjunction" | "alignment";
  timeMs: number;
  description: string;
}

export interface GalacticStructure {
  type: "spiral" | "elliptical" | "irregular" | "lenticular" | "ring";
  diameter: number;
  starCount: number;
  brightness: number;
  rotation: "clockwise" | "counter-clockwise" | "static";
  description: string;
}

export interface AstronomyAnalysis {
  celestialBodies: CelestialBody[];
  constellations: Constellation[];
  cosmicEvents: CosmicEvent[];
  galacticStructure: GalacticStructure;
  totalLuminosity: number;
  averageMagnitude: number;
  cosmicDensity: number;
  cosmicEntropy: number;
  summary: string;
  report?: string;
}

export const analyzeAstronomy = (projectId: string) =>
  apiGet<AstronomyAnalysis>(`/projects/${projectId}/astronomy`);

// ---------------------------------------------------------------------------
// Motion Chemistry Engine
// ---------------------------------------------------------------------------

export interface MotionAtom {
  componentId: string;
  element: string;
  atomicNumber: number;
  atomicMass: number;
  valence: number;
  electronegativity: number;
  group: "alkali" | "alkaline-earth" | "transition" | "halogen" | "noble" | "metalloid" | "nonmetal";
  period: number;
}

export interface MotionBond {
  atomA: string;
  atomB: string;
  type: "covalent" | "ionic" | "metallic" | "hydrogen" | "van-der-waals";
  strength: number;
  description: string;
}

export interface MotionMolecule {
  componentId: string;
  componentName: string | null;
  atoms: MotionAtom[];
  formula: string;
  molecularWeight: number;
  polarity: number;
  stateOfMatter: "solid" | "liquid" | "gas" | "plasma";
  description: string;
}

export interface MotionReaction {
  reactants: string[];
  products: string[];
  type:
    | "synthesis"
    | "decomposition"
    | "single-displacement"
    | "double-displacement"
    | "combustion"
    | "redox"
    | "acid-base"
    | "catalytic";
  timeMs: number;
  activationEnergy: number;
  enthalpyChange: number;
  rate: number;
  catalyst?: string;
  description: string;
}

export interface MotionCatalyst {
  componentId: string;
  type: "catalyst" | "inhibitor";
  agent: string;
  strength: number;
  rateChange: number;
  description: string;
}

export interface MotionCompound {
  componentIds: string[];
  name: string;
  formula: string;
  type: "ionic" | "covalent" | "metallic" | "polymeric" | "network";
  stability: number;
  description: string;
}

export interface ChemistryAnalysis {
  atoms: MotionAtom[];
  molecules: MotionMolecule[];
  bonds: MotionBond[];
  reactions: MotionReaction[];
  catalysts: MotionCatalyst[];
  compounds: MotionCompound[];
  ph: number;
  temperatureK: number;
  concentration: number;
  entropy: number;
  enthalpy: number;
  equilibriumConstant: number;
  primaryState: "solid" | "liquid" | "gas" | "plasma";
  summary: string;
  report?: string;
}

export const analyzeChemistry = (projectId: string) =>
  apiGet<ChemistryAnalysis>(`/projects/${projectId}/chemistry`);

// ---------------------------------------------------------------------------
// Motion Musicology Engine
// ---------------------------------------------------------------------------

export interface MotionNote {
  componentId: string;
  componentName: string | null;
  pitch: number;
  octave: number;
  noteName: string;
  onsetMs: number;
  durationMs: number;
  velocity: number;
  articulation: "legato" | "staccato" | "tenuto" | "accent" | "marcato" | "sustain";
  description: string;
}

export interface MotionChord {
  timeMs: number;
  componentIds: string[];
  notes: MotionNote[];
  quality: "major" | "minor" | "diminished" | "augmented" | "sus4" | "sus2" | "power" | "cluster";
  root: number;
  name: string;
  description: string;
}

export interface MelodicPhrase {
  index: number;
  startMs: number;
  endMs: number;
  notes: MotionNote[];
  contour: "ascending" | "descending" | "arch" | "v-shape" | "flat" | "undulating";
  range: number;
  description: string;
}

export interface MusicologyAnalysis {
  notes: MotionNote[];
  chords: MotionChord[];
  phrases: MelodicPhrase[];
  rhythm: {
    bpm: number;
    timeSignature: string;
    beatPattern: number[];
    syncopation: number;
    grooveConsistency: number;
    description: string;
  };
  dynamics: {
    overall: string;
    changes: Array<{ timeMs: number; from: string; to: string; type: string }>;
    range: number;
    description: string;
  };
  form: {
    type: string;
    sections: Array<{ label: string; startMs: number; endMs: number; componentCount: number; description: string }>;
    description: string;
  };
  key: string;
  scale: string;
  mood: string;
  harmonicComplexity: number;
  melodicInterest: number;
  rhythmicVitality: number;
  summary: string;
  report?: string;
}

export const analyzeMusicology = (projectId: string) =>
  apiGet<MusicologyAnalysis>(`/projects/${projectId}/musicology`);

// ---------------------------------------------------------------------------
// Motion Botany Engine
// ---------------------------------------------------------------------------

export interface PlantOrgan {
  componentId: string;
  componentName: string | null;
  type: "leaf" | "stem" | "flower" | "root" | "branch" | "fruit" | "seed" | "tendril" | "bark";
  growthStage: "germination" | "seedling" | "vegetative" | "flowering" | "fruiting" | "senescence";
  branchingOrder: number;
  phototropism: "up" | "down" | "left" | "right" | "outward" | "inward";
  biomass: number;
  vitality: number;
  description: string;
}

export interface BotanyAnalysis {
  organs: PlantOrgan[];
  branching: Array<{
    componentId: string;
    children: string[];
    angle: number;
    order: number;
    description: string;
  }>;
  canopy: {
    shape: "dome" | "conical" | "columnar" | "spreading" | "umbrella" | "irregular";
    density: number;
    height: number;
    width: number;
    description: string;
  };
  rootSystem: {
    type: "taproot" | "fibrous" | "adventitious" | "aerial" | "tuberous";
    depth: number;
    spread: number;
    density: number;
    description: string;
  };
  phenology: {
    stages: Array<{
      stage: string;
      startMs: number;
      endMs: number;
      durationMs: number;
      organCount: number;
      description: string;
    }>;
    currentStage: string;
    description: string;
  };
  totalBiomass: number;
  diversity: number;
  vitality: number;
  lifeForm: "tree" | "shrub" | "herb" | "vine" | "grass" | "succulent" | "epiphyte";
  growthRhythm: "annual" | "perennial" | "biennial" | "evergreen" | "deciduous";
  summary: string;
  report?: string;
}

export const analyzeBotany = (projectId: string) =>
  apiGet<BotanyAnalysis>(`/projects/${projectId}/botany`);

// ---------------------------------------------------------------------------
// Motion Geology Engine
// ---------------------------------------------------------------------------

export interface GeologicalStratum {
  componentId: string;
  componentName: string | null;
  rockType: "sedimentary" | "igneous" | "metamorphic" | "volcanic" | "alluvial";
  rockName: string;
  depth: number;
  thickness: number;
  hardness: number;
  age: number;
  fossilCount: number;
  description: string;
}

export interface GeologyAnalysis {
  strata: GeologicalStratum[];
  tectonicEvents: Array<{
    timeMs: number;
    type: "earthquake" | "uplift" | "subsidence" | "volcanic-eruption" | "faulting" | "folding" | "intrusion";
    magnitude: number;
    affectedIds: string[];
    description: string;
  }>;
  faultLines: Array<{
    componentA: string;
    componentB: string;
    type: "normal" | "reverse" | "strike-slip" | "thrust";
    displacement: number;
    description: string;
  }>;
  mineralComposition: Array<{
    mineral: string;
    percentage: number;
    sourceProperty: string;
    description: string;
  }>;
  epochs: Array<{
    name: string;
    startMs: number;
    endMs: number;
    strataCount: number;
    description: string;
  }>;
  topology: {
    surface: "plain" | "plateau" | "mountain" | "valley" | "canyon" | "coastline" | "archipelago";
    maxElevation: number;
    minElevation: number;
    relief: number;
    roughness: number;
    description: string;
  };
  primaryRockType: "sedimentary" | "igneous" | "metamorphic" | "volcanic" | "alluvial";
  stability: number;
  erosionRate: number;
  depositionRate: number;
  summary: string;
  report?: string;
}

export const analyzeGeology = (projectId: string) =>
  apiGet<GeologyAnalysis>(`/projects/${projectId}/geology`);

// Motion Physics Engine
export interface KinematicState {
  componentId: string;
  timeMs: number;
  displacement: number;
  velocity: number;
  acceleration: number;
  jerk: number;
}

export interface ForceAnalysis {
  componentId: string;
  componentName: string | null;
  netForce: number;
  appliedForce: number;
  frictionForce: number;
  gravitationalForce: number;
  springForce: number;
  dominantForce: "applied" | "friction" | "gravity" | "spring" | "normal";
  description: string;
}

export interface EnergyAnalysis {
  componentId: string;
  componentName: string | null;
  kineticEnergy: number;
  potentialEnergy: number;
  totalEnergy: number;
  dissipation: number;
  efficiency: number;
  description: string;
}

export interface MomentumAnalysis {
  componentId: string;
  componentName: string | null;
  linearMomentum: number;
  angularMomentum: number;
  impulse: number;
  description: string;
}

export interface CollisionEvent {
  componentA: string;
  componentB: string;
  timeMs: number;
  type: "elastic" | "inelastic" | "partially-elastic" | "near-miss";
  relativeVelocity: number;
  restitution: number;
  description: string;
}

export interface EquilibriumAnalysis {
  type: "none" | "static" | "dynamic" | "unstable" | "metastable";
  balance: number;
  centerOfMassOffset: number;
  netSystemForce: number;
  description: string;
}

export interface PhysicsAnalysis {
  kinematics: KinematicState[];
  forces: ForceAnalysis[];
  energy: EnergyAnalysis[];
  momentum: MomentumAnalysis[];
  collisions: CollisionEvent[];
  equilibrium: EquilibriumAnalysis;
  totalSystemEnergy: number;
  averageVelocity: number;
  peakAcceleration: number;
  systemInertia: number;
  totalWork: number;
  averagePower: number;
  summary: string;
  report?: string;
}

export const analyzePhysics = (projectId: string) =>
  apiGet<PhysicsAnalysis>(`/projects/${projectId}/physics`);

// Motion Linguistics Engine
export interface MotionPhoneme {
  componentId: string;
  timeMs: number;
  class: "plosive" | "fricative" | "affricate" | "nasal" | "liquid" | "vowel" | "diphthong" | "sibilant";
  voicing: "voiced" | "voiceless" | "whisper";
  place: "bilabial" | "labiodental" | "dental" | "alveolar" | "palatal" | "velar" | "glottal";
  manner: "stop" | "fricative" | "affricate" | "nasal" | "approximant" | "trill" | "lateral";
  description: string;
}

export interface MotionMorpheme {
  componentId: string;
  componentName: string | null;
  type: "root" | "prefix" | "suffix" | "infix" | "circumfix";
  category: "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "determiner" | "interjection";
  gloss: string;
  description: string;
}

export interface SyntacticPhrase {
  id: string;
  type: "noun-phrase" | "verb-phrase" | "adjective-phrase" | "adverbial-phrase" | "prepositional-phrase";
  head: string;
  dependents: string[];
  startMs: number;
  endMs: number;
  description: string;
}

export interface MotionClause {
  id: string;
  type: "declarative" | "interrogative" | "imperative" | "exclamative" | "subjunctive";
  subject: string | null;
  predicate: string;
  objects: string[];
  startMs: number;
  endMs: number;
  description: string;
}

export interface ProsodyAnalysis {
  stressPattern: Array<"strong" | "weak" | "secondary">;
  intonation: "rising" | "falling" | "level" | "rise-fall" | "fall-rise";
  tempo: number;
  rhythm: "stress-timed" | "syllable-timed" | "mora-timed";
  pauseCount: number;
  description: string;
}

export interface SemanticAnalysis {
  lexicalFields: string[];
  roles: Array<{
    componentId: string;
    role: "agent" | "patient" | "theme" | "experiencer" | "beneficiary" | "instrument" | "location" | "goal" | "source";
    description: string;
  }>;
  polarity: "positive" | "negative" | "neutral";
  modality: "epistemic" | "deontic" | "dynamic" | "alethic";
  tense: "past" | "present" | "future" | "aorist" | "perfect" | "imperfect";
  aspect: "perfective" | "imperfective" | "progressive" | "habitual" | "inchoative" | "cessative";
  description: string;
}

export interface PragmaticAnalysis {
  speechAct: "assertive" | "directive" | "commissive" | "expressive" | "declaration" | "verdictive";
  illocutionaryForce: string;
  politeness: number;
  formality: number;
  description: string;
}

export interface DiscourseAnalysis {
  relations: Array<{
    fromClause: string;
    toClause: string;
    relation: "narration" | "background" | "result" | "cause" | "condition" | "elaboration" | "contrast" | "parallel";
    description: string;
  }>;
  rhetoricalStructure: "narrative" | "descriptive" | "expository" | "argumentative" | "dialogic";
  cohesion: number;
  description: string;
}

export interface LinguisticsAnalysis {
  phonemes: MotionPhoneme[];
  morphemes: MotionMorpheme[];
  phrases: SyntacticPhrase[];
  clauses: MotionClause[];
  prosody: ProsodyAnalysis;
  semantics: SemanticAnalysis;
  pragmatics: PragmaticAnalysis;
  discourse: DiscourseAnalysis;
  languageFamily: string;
  register: "frozen" | "formal" | "consultative" | "casual" | "intimate";
  summary: string;
  report?: string;
}

export const analyzeLinguistics = (projectId: string) =>
  apiGet<LinguisticsAnalysis>(`/projects/${projectId}/linguistics`);

// Motion Cinema Engine
export interface CinematicShot {
  componentId: string;
  componentName: string | null;
  size: "extreme-wide" | "wide" | "medium-wide" | "medium" | "medium-close" | "close-up" | "extreme-close-up";
  angle: "eye-level" | "high" | "low" | "dutch" | "overhead" | "worms-eye";
  cameraMovement: "static" | "pan" | "tilt" | "dolly" | "zoom" | "crane" | "tracking" | "handheld" | "steady-cam";
  durationMs: number;
  description: string;
}

export interface CutOrTransition {
  kind: "cut" | "transition";
  timeMs: number;
  transitionType?: "dissolve" | "fade" | "wipe" | "iris" | "morph" | "crossfade";
  from: string;
  to: string;
  description: string;
}

export interface MiseEnScene {
  balance: number;
  depthOfField: "shallow" | "medium" | "deep";
  colorPalette: "warm" | "cool" | "neutral" | "monochrome" | "saturated" | "desaturated";
  lighting: "low-key" | "high-key" | "chiaroscuro" | "natural" | "artificial" | "backlit";
  density: number;
  description: string;
}

export interface NarrativeStructure {
  type: "three-act" | "five-act" | "heros-journey" | "kishōtenketsu" | "episodic" | "non-linear" | "minimal";
  acts: Array<{
    label: string;
    startMs: number;
    endMs: number;
    description: string;
  }>;
  description: string;
}

export interface PacingAnalysis {
  averageShotLength: number;
  pace: "very-slow" | "slow" | "moderate" | "fast" | "very-fast";
  rhythm: "regular" | "irregular" | "accelerating" | "decelerating";
  description: string;
}

export interface MontageAnalysis {
  type: "sequential" | "dialectical" | "rhythmic" | "tonal" | "overtonal" | "intellectual" | "none";
  sequenceLength: number;
  description: string;
}

export interface GenreAnalysis {
  primary: "action" | "drama" | "comedy" | "documentary" | "experimental" | "horror" | "romance" | "thriller" | "musical" | "silent";
  secondary: string | null;
  confidence: number;
  description: string;
}

export interface CinemaAnalysis {
  shots: CinematicShot[];
  cuts: CutOrTransition[];
  miseEnScene: MiseEnScene;
  narrative: NarrativeStructure;
  pacing: PacingAnalysis;
  montage: MontageAnalysis;
  genre: GenreAnalysis;
  runtime: number;
  frameCount: number;
  aspectRatio: string;
  summary: string;
  report?: string;
}

export const analyzeCinema = (projectId: string) =>
  apiGet<CinemaAnalysis>(`/projects/${projectId}/cinema`);

/** Combined result of running every cross-disciplinary analysis engine. */
export interface AnalyzeAllResult {
  engines: Array<{
    name: string;
    analysis: unknown;
    report: string;
    error?: string;
  }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    failures: string[];
  };
}

/** Run all cross-disciplinary analysis engines for a project in one call. */
export const analyzeAllProject = (projectId: string) =>
  apiGet<AnalyzeAllResult>(`/projects/${projectId}/analyze-all`);

/** Agent self-test result returned by POST /api/agent/self-test. */
export interface SelfTestScenarioResult {
  name: string;
  prompt: string;
  ok: boolean;
  durationMs: number;
  toolCalls: number;
  sawSpecUpdate: boolean;
  sawDone: boolean;
  sawError: boolean;
  errors: string[];
}

/** Agent self-test result returned by POST /api/self-test. */
export interface AgentSelfTestResult {
  ok: boolean;
  prompt: string;
  durationMs: number;
  events: string[];
  toolCalls: number;
  sawSpecUpdate: boolean;
  sawDone: boolean;
  sawError: boolean;
  errors: string[];
  /** Per-scenario breakdown; present when running the full suite. */
  scenarios?: SelfTestScenarioResult[];
}

/** Run a canned agent round-trip to verify the orchestration stack is healthy. */
export const selfTestAgent = (prompt?: string) =>
  apiPost<AgentSelfTestResult>("/self-test" + (prompt ? `?prompt=${encodeURIComponent(prompt)}` : ""), {});

/** Aggregated agent capability manifest returned by GET /api/agent/capabilities. */
export interface CapabilityManifest {
  tools: Array<{ name: string; description: string }>;
  skills: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    complexity: string;
    keywords: string[];
    tools: string[];
    mockAvailable: boolean;
    estimatedSteps: number;
  }>;
  skillsSummary: {
    totalSkills: number;
    byCategory: Record<string, number>;
    byComplexity: Record<string, number>;
    mockAvailable: number;
  };
  crossDisciplinaryEngines: string[];
  motionXEngines: string[];
  intentPatternCount: number;
  providers: string[];
  modelCount: number;
  generatedAt: string;
}

/** Fetch the aggregated agent capability manifest (tools, skills, engines, providers). */
export const listAgentCapabilities = () =>
  apiGet<CapabilityManifest>("/agent/capabilities");

/** A curated preset pack — a themed bundle of existing template IDs. */
export interface PresetPack {
  id: string;
  name: string;
  description: string;
  templateIds: string[];
  tags: string[];
}

/** Result of listing all preset packs via GET /api/catalog/packs. */
export interface PresetPacksResult {
  packs: PresetPack[];
  count: number;
}

/** List all curated preset packs. */
export const listPacks = () =>
  apiGet<PresetPacksResult>("/catalog/packs");

/** Fetch a single preset pack by ID. */
export const getPack = (id: string) =>
  apiGet<PresetPack>(`/catalog/packs/${encodeURIComponent(id)}`);

// ---------------------------------------------------------------------------
// Phase 2 motion resources — scene packs, color palettes, platform presets,
// accessibility profiles, and cursor choreography. Each resource ships its
// own list/get pair plus match or apply variants where the backend supports
// them. Types mirror the backend module contracts so the frontend can reason
// about resource shapes without an extra round trip.
// ---------------------------------------------------------------------------

// --- Scene Packs ---

export type SceneVertical =
  | "marketing"
  | "dashboard"
  | "ecommerce"
  | "onboarding"
  | "states"
  | "communication"
  | "presentation";

export type SceneSlotRole =
  | "headline"
  | "subhead"
  | "media"
  | "primary-action"
  | "secondary-action"
  | "metric"
  | "chart"
  | "list-item"
  | "card"
  | "badge"
  | "illustration"
  | "background"
  | "footer"
  | "overlay"
  | "status-icon"
  | "status-message";

export type SceneChoreography =
  | "cascade"
  | "wave"
  | "ripple"
  | "converge"
  | "assembly"
  | "simultaneous";

export interface SceneSlot {
  role: SceneSlotRole;
  templateId: string;
  delayMs: number;
  durationMs?: number;
  note?: string;
}

export interface ScenePack {
  id: string;
  name: string;
  vertical: SceneVertical;
  description: string;
  slots: SceneSlot[];
  choreography: SceneChoreography;
  totalDurationMs: number;
  recommendedStyles: string[];
  tags: string[];
}

export interface ScenePacksResult {
  packs: ScenePack[];
  count: number;
}

export interface SceneApplyResult {
  sceneId: string;
  sceneName: string;
  vertical: SceneVertical;
  componentIds: string[];
  slotRoles: SceneSlotRole[];
  appliedCount: number;
  skippedSlotCount: number;
  applied: boolean;
}

/** List all scene packs, optionally filtered by vertical. */
export const listScenes = (vertical?: SceneVertical) => {
  const params = new URLSearchParams();
  if (vertical) params.set("vertical", vertical);
  const qs = params.toString();
  return apiGet<ScenePacksResult>(`/scenes${qs ? `?${qs}` : ""}`);
};

/** Fetch a single scene pack by id. */
export const getScene = (id: string) =>
  apiGet<ScenePack>(`/scenes/${encodeURIComponent(id)}`);

/**
 * Materialize every slot in a scene pack into the target project, persisting
 * the resulting components. Returns the persisted component ids and the role
 * each slot played.
 */
export const applyScene = (projectId: string, sceneId: string) =>
  apiPost<SceneApplyResult>(
    `/projects/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(sceneId)}/apply`,
    {},
  );

// --- Color Motion Palettes ---

export interface ColorMotionPair {
  from: string;
  to: string;
  mood: string;
}

export interface ColorMotionPalette {
  id: string;
  name: string;
  description: string;
  base: string;
  accent: string;
  stops: string[];
  motionPairs: ColorMotionPair[];
  tags: string[];
}

/** Detail response includes a ready-to-use CSS gradient string. */
export interface ColorMotionPaletteDetail extends ColorMotionPalette {
  cssGradient: string;
}

export interface ColorPalettesResult {
  palettes: ColorMotionPalette[];
  count: number;
}

/** List all color motion palettes, optionally filtered by tag. */
export const listColorPalettes = (tag?: string) => {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  const qs = params.toString();
  return apiGet<ColorPalettesResult>(`/color-palettes${qs ? `?${qs}` : ""}`);
};

/** Fetch a single palette by id, including a CSS gradient rendering. */
export const getColorPalette = (id: string) =>
  apiGet<ColorMotionPaletteDetail>(`/color-palettes/${encodeURIComponent(id)}`);

// --- Platform Motion Presets ---

export type MotionPlatform = "ios" | "android" | "macos" | "web" | "windows";

export interface PlatformSpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
}

export interface PlatformMotionPreset {
  id: string;
  platform: MotionPlatform;
  name: string;
  description: string;
  durationMs: number;
  easing: Easing;
  entranceEasing: Easing;
  exitEasing: Easing;
  spring?: PlatformSpringConfig;
  cornerRadius: number;
  shadowStyle: string;
  staggerStepMs: number;
  tags: string[];
}

export interface PlatformPresetsResult {
  presets: PlatformMotionPreset[];
  count: number;
}

export interface PlatformPresetMatchResult {
  query: string;
  match: PlatformMotionPreset | null;
}

/** List all platform motion presets, optionally filtered by platform. */
export const listPlatformPresets = (platform?: MotionPlatform) => {
  const params = new URLSearchParams();
  if (platform) params.set("platform", platform);
  const qs = params.toString();
  return apiGet<PlatformPresetsResult>(`/platform-presets${qs ? `?${qs}` : ""}`);
};

/**
 * Pick the platform preset whose tags best match a free-text query
 * (e.g. "ios app"). Returns the best match or null.
 */
export const matchPlatformPreset = (q: string) => {
  const params = new URLSearchParams();
  params.set("q", q);
  return apiGet<PlatformPresetMatchResult>(`/platform-presets/match?${params.toString()}`);
};

/** Fetch a single platform preset by id. */
export const getPlatformPreset = (id: string) =>
  apiGet<PlatformMotionPreset>(`/platform-presets/${encodeURIComponent(id)}`);

// --- Accessibility Motion Profiles ---

export type AccessibilityProfileContext =
  | "vestibular-safe"
  | "reduced-motion"
  | "seizure-safe"
  | "cognitive-load"
  | "low-bandwidth"
  | "default";

export interface AccessibilityProfile {
  id: string;
  name: string;
  context: AccessibilityProfileContext;
  description: string;
  maxDisplacementPx: number;
  maxRotationDeg: number;
  maxOpacityFrequencyHz: number;
  maxDurationMs: number;
  maxSimultaneousAnimations: number;
  allowLoops: boolean;
  allowParallax: boolean;
  simplifyEasing: boolean;
  disableOvershoot: boolean;
  discouragedCategories: string[];
  tags: string[];
}

export interface AccessibilityProfilesResult {
  profiles: AccessibilityProfile[];
  count: number;
}

export interface StrictestProfileResult {
  inputIds: string[];
  resolvedIds: string[];
  strictest: AccessibilityProfile;
}

/** List all accessibility motion profiles, optionally filtered by context. */
export const listAccessibilityProfiles = (context?: AccessibilityProfileContext) => {
  const params = new URLSearchParams();
  if (context) params.set("context", context);
  const qs = params.toString();
  return apiGet<AccessibilityProfilesResult>(`/a11y-profiles${qs ? `?${qs}` : ""}`);
};

/** Fetch a single accessibility profile by id. */
export const getAccessibilityProfile = (id: string) =>
  apiGet<AccessibilityProfile>(`/a11y-profiles/${encodeURIComponent(id)}`);

/**
 * Pick the strictest profile from a set of profile ids. Useful when multiple
 * accessibility considerations apply and the intersection is the most
 * restrictive profile.
 */
export const pickStrictestAccessibilityProfile = (ids: string[]) =>
  apiPost<StrictestProfileResult>(`/a11y-profiles/strictest`, { ids });

// --- Cursor Choreography ---

export type CursorPattern =
  | "reveal"
  | "trail"
  | "magnet"
  | "spotlight"
  | "repel"
  | "tug"
  | "wake";

export interface CursorChoreography {
  id: string;
  name: string;
  pattern: CursorPattern;
  description: string;
  radius: number;
  intensity: number;
  easing: Easing;
  durationMs: number;
  trailsCursor: boolean;
  idealElementCount: number;
  tags: string[];
}

export interface CursorChoreographyResult {
  presets: CursorChoreography[];
  count: number;
}

export interface CursorChoreographyMatchResult {
  query: string;
  match: CursorChoreography | null;
}

/** List all cursor choreography presets, optionally filtered by pattern. */
export const listCursorChoreography = (pattern?: CursorPattern) => {
  const params = new URLSearchParams();
  if (pattern) params.set("pattern", pattern);
  const qs = params.toString();
  return apiGet<CursorChoreographyResult>(`/cursor-choreography${qs ? `?${qs}` : ""}`);
};

/**
 * Pick the cursor choreography preset whose tags best match a free-text query
 * (e.g. "playful grid"). Returns the best match or null.
 */
export const matchCursorChoreography = (q: string) => {
  const params = new URLSearchParams();
  params.set("q", q);
  return apiGet<CursorChoreographyMatchResult>(`/cursor-choreography/match?${params.toString()}`);
};

/** Fetch a single cursor choreography preset by id. */
export const getCursorChoreography = (id: string) =>
  apiGet<CursorChoreography>(`/cursor-choreography/${encodeURIComponent(id)}`);

// ---------------------------------------------------------------------------
// Motion Volition + Lexicon (Cognition panel)
// ---------------------------------------------------------------------------

export type VolitionMode = "act" | "ask" | "defer" | "refine";

export interface AmbiguitySignal {
  id: string;
  label: string;
  severity: number;
  observation: string;
}

export interface ClarifyingQuestion {
  question: string;
  resolves: string;
  options: string[];
}

export interface RefinedIntent {
  refined: string;
  changes: string[];
}

export interface VolitionReport {
  input: string;
  mode: VolitionMode;
  readiness: number;
  stallRisk: number;
  regretEstimate: number;
  ambiguities: AmbiguitySignal[];
  clarifyingQuestion: ClarifyingQuestion | null;
  refinedIntent: RefinedIntent | null;
  suggestedTools: string[];
  rationale: string;
  summary: string;
  /** Pre-formatted multi-line rendering returned by the backend. */
  formatted?: string;
}

export interface VolitionModeInfo {
  id: VolitionMode;
  label: string;
  description: string;
}

/** Decide whether the agent should act, ask, defer, or refine. */
export const decideVolition = (
  partial: string,
  projectId?: string,
  history?: { consecutiveAsks?: number; repeatedKeyword?: boolean },
) =>
  apiPost<VolitionReport>("/volition", {
    partial,
    projectId,
    consecutiveAsks: history?.consecutiveAsks,
    repeatedKeyword: history?.repeatedKeyword,
  });

/** List the canonical volition modes. */
export const listVolitionModes = () =>
  apiGet<{ modes: VolitionModeInfo[] }>("/volition-modes");

export type DurationTokenId =
  | "instant" | "micro" | "standard" | "normal" | "extended" | "cinematic";
export type EasingTokenId =
  | "ease-out" | "ease-in-out" | "spring-soft" | "spring-snappy" | "linear";
export type MotionCategoryId =
  | "entrance" | "exit" | "scroll-reveal" | "hover-press" | "state-transition"
  | "feedback-delight" | "emphasis" | "loading" | "page-transition"
  | "text-kinetic" | "video-transition";
export type ReducedMotionMode = "scale-only" | "crossfade" | "none";

export interface DurationToken {
  id: DurationTokenId;
  label: string;
  minMs: number;
  maxMs: number;
  suggestedMs: number;
  description: string;
}

export interface EasingToken {
  id: EasingTokenId;
  label: string;
  signature: string;
  description: string;
}

export interface MotionCategory {
  id: MotionCategoryId;
  label: string;
  description: string;
  defaultDuration: DurationTokenId;
  defaultEasing: EasingTokenId;
  defaultReducedMotion: ReducedMotionMode;
}

export interface LexiconReport {
  input: string;
  category: MotionCategoryId;
  durationToken: DurationToken;
  easingToken: EasingToken;
  reducedMotionMode: ReducedMotionMode;
  matchedCues: Array<{ cue: string; category: MotionCategoryId }>;
  suggestedTools: string[];
  summary: string;
  formatted?: string;
}

/** Translate a natural-language intent into motion tokens. */
export const translateLexicon = (input: string, projectId?: string) =>
  apiPost<LexiconReport>("/lexicon/translate", { input, projectId });

/** List all duration and easing tokens. */
export const listMotionTokens = () =>
  apiGet<{ durations: DurationToken[]; easings: EasingToken[] }>("/lexicon/tokens");

/** List all eleven motion categories. */
export const listMotionCategories = () =>
  apiGet<{ categories: MotionCategory[] }>("/lexicon/categories");

// --- Motion Consciousness (Cognition panel) ---

export interface SelfBelief {
  statement: string;
  evidence: string;
  confidence: number;
}

export interface CounterQuestion {
  belief: string;
  question: string;
  severity: number;
}

export interface CognitiveBias {
  id: "anchoring" | "confirmation" | "sunk-cost" | "default" | "recency";
  label: string;
  severity: number;
  observation: string;
  correction: string;
}

export interface ConsciousnessBeat {
  tone: "observation" | "wonder" | "doubt" | "realization" | "intent";
  line: string;
}

export interface ConsciousnessReport {
  beliefs: SelfBelief[];
  counterQuestions: CounterQuestion[];
  biases: CognitiveBias[];
  monologue: ConsciousnessBeat[];
  awareness: number;
  summary: string;
  formatted?: string;
}

/** Meta-cognitive self-reflection of a project's motion composition. */
export const reflectConsciousness = (projectId: string) =>
  apiGet<ConsciousnessReport>(`/projects/${encodeURIComponent(projectId)}/consciousness`);

// ---------------------------------------------------------------------------
// Genesis — generative motion from mathematical curves
// ---------------------------------------------------------------------------

export type GenesisKind =
  | "lissajous"
  | "goldenSpiral"
  | "waveInterference"
  | "dampedOscillator"
  | "phyllotaxis"
  | "lorenzAttractor";

export interface GenesisKindSummary {
  kind: GenesisKind;
  description: string;
}

export interface GenesisOptions {
  samples?: number;
  durationMs?: number;
  a?: number;
  b?: number;
  amplitude?: number;
  damping?: number;
  omega?: number;
}

export interface GenesisReport {
  ok: true;
  kind: GenesisKind;
  description: string;
  componentIds: string[];
  count: number;
  summary: string;
  formatted?: string;
}

/** List all available mathematical genesis generators. */
export const listGenesisKinds = () =>
  apiGet<{ kinds: GenesisKindSummary[] }>("/genesis-kinds");

/** Generate original motion components from a mathematical curve. */
export const runGenesis = (projectId: string, kind: GenesisKind, opts: GenesisOptions = {}) =>
  apiPost<GenesisReport>(
    `/projects/${encodeURIComponent(projectId)}/genesis`,
    { kind, ...opts },
  );

// ---------------------------------------------------------------------------
// Prophecy — forecast the trajectory of a composition
// ---------------------------------------------------------------------------

export interface DesignTraits {
  density: number;
  energy: number;
  easingComplexity: number;
  richness: number;
  rhythmicity: number;
  narrativity: number;
  organicity: number;
}

export interface DesignEra {
  id: string;
  label: string;
  traits: DesignTraits;
  description: string;
}

export interface Prophecy {
  eraId: string;
  eraLabel: string;
  probability: number;
  distance: number;
  rationale: string;
  suggestions: string[];
}

export interface AvantGardeProposal {
  id: string;
  label: string;
  novelty: number;
  risk: number;
  description: string;
  actions: string[];
}

export interface ProphecyReport {
  currentEra: DesignEra;
  trajectory: DesignTraits;
  prophecies: Prophecy[];
  avantGarde: AvantGardeProposal[];
  noveltyScore: number;
  summary: string;
  formatted?: string;
}

/** List all available design eras. */
export const listDesignEras = () =>
  apiGet<{ eras: DesignEra[] }>("/design-eras");

/** Forecast the motion design trajectory of a project. */
export const forecastMotion = (projectId: string) =>
  apiGet<ProphecyReport>(`/projects/${encodeURIComponent(projectId)}/prophecy`);

// ---------------------------------------------------------------------------
// Telepathy — predict user intent from partial input
// ---------------------------------------------------------------------------

export interface PredictedIntent {
  id: string;
  label: string;
  confidence: number;
  evidence: string[];
  completion: string;
  toolPath: string[];
}

export interface TelepathySignal {
  match: string;
  category: "action" | "modifier" | "target" | "constraint" | "quality";
  weight: number;
  start: number;
}

export interface TelepathyReport {
  input: string;
  predictions: PredictedIntent[];
  signals: TelepathySignal[];
  actionable: boolean;
  suggestedPrompt: string | null;
  summary: string;
  formatted?: string;
}

/** Predict user intent from a partial input string. */
export const predictIntent = (
  partial: string,
  projectId?: string,
  topK?: number,
) =>
  apiPost<TelepathyReport>("/predict-intent", {
    partial,
    ...(projectId !== undefined ? { projectId } : {}),
    ...(topK !== undefined ? { topK } : {}),
  });
