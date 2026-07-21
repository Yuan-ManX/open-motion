import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { runAsync } from "../../utils/async.js";
import { validate, validated } from "../middleware/validate.js";
import {
  listMemory,
  saveMemory,
  searchMemory,
  deleteMemory,
  updateMemoryRelevance,
  listGeneratedSkills,
} from "../services/agentMemoryService.js";
import {
  listRecipes,
  getRecipe,
  searchRecipes,
} from "../services/recipeService.js";
import { analyzeProjectRestraint } from "../services/restraintService.js";
import { compileGrammar, GRAMMAR_EXAMPLES, MOTION_VERBS } from "../../motion/grammar.js";
import { listShaderEffects, getShaderEffect } from "../../motion/shaders.js";
import { listAllShaderEffects, getExtendedShaderEffect } from "../../motion/shaderLibraryExt.js";
import {
  encodeRecipeTriple,
  encodeRecipeLibrary,
  substituteComponentId,
  decodeToolCallsToSpec,
  composeDescriptionFromSpec,
  buildSkillMarkdown,
} from "../../motion/recipeCodec.js";
import {
  readBudget,
  writeBudget,
  setTier,
  recomputeSpend,
  formatBudgetReport,
  recommendTierUpgrade,
  type RestraintTier,
} from "../../motion/restraintBudget.js";
import { getProjectWithSpec, updateProjectOrThrow } from "../services/projectService.js";
import {
  connectExternalServer,
  disconnectExternalServer,
  listExternalServers,
  listExternalMcpTools,
  callExternalMcpTool,
  routeNamespacedExternalCall,
  isExternalServerConnected,
  type ExternalServerConfig,
} from "../../agent/mcpClient.js";
import { getSessionMetrics, listToolStats, resetAnalytics } from "../../agent/analytics.js";
import { composeTools } from "../../agent/toolComposer.js";
import { listMemory as listConversationMemory } from "../../agent/memory/store.js";
import { semanticSearch } from "../../agent/memory/semanticSearch.js";
import { executeTool } from "../../agent/tools/registry.js";
import { capture, listCheckpoints, isSpecMutating, rollback, rollbackTo, clearCheckpoints } from "../../agent/checkpointManager.js";
import { runPreHooks, runPostHooks } from "../../agent/pluginHooks.js";
import { logger } from "../../utils/logger.js";
import { TOOL_NAMES, TOOL_DESCRIPTIONS } from "@openmotion/shared";
import { composeStructuredPlan, shouldUsePlanMode } from "../../agent/planExecutor.js";
import { setPlan, getPlan, cancelPlan, clearPlan, summarizePlan, getPlanProgress, isPlanDone } from "../../agent/planStore.js";
import { getProjectSpec } from "../../db/repositories/projects.js";
import { unifiedSearch, rebuildFtsIndexes, type SearchScope } from "../services/searchService.js";
import {
  generateVariations,
  extractDNA,
  transferStyle,
  compareDNA,
  formatVariationSummary,
  formatDNAReport,
  formatStyleTransferReport,
  type VariationAxis,
} from "../../agent/motionIntelligence.js";
import { critiqueMotion, formatCritiqueReport } from "../../agent/motionCritique.js";
import {
  generateStorySequence,
  formatStoryReport,
  detectNarrativeIntent,
  listNarrativeIntents,
  type NarrativeIntent,
} from "../../agent/motionStorytelling.js";

export const agentRouter = Router();

const SaveMemorySchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  tags: z.array(z.string()).optional(),
  relevance: z.number().min(0).max(1).optional(),
});

// --- Persistent memory endpoints ---

agentRouter.get(
  "/projects/:id/memory",
  runAsync(async (req: Request, res: Response) => {
    const layer = typeof req.query.layer === "string" ? req.query.layer : undefined;
    res.json(listMemory(req.params.id, layer));
  }),
);

agentRouter.post(
  "/projects/:id/memory",
  validate(SaveMemorySchema),
  runAsync(async (req: Request, res: Response) => {
    const input = validated<z.infer<typeof SaveMemorySchema>>(req);
    const entry = saveMemory(req.params.id, input);
    res.status(201).json(entry);
  }),
);

agentRouter.get(
  "/projects/:id/memory/search",
  runAsync(async (req: Request, res: Response) => {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    if (!query) {
      res.status(400).json({ error: "q parameter is required" });
      return;
    }
    res.json(searchMemory(req.params.id, query));
  }),
);

agentRouter.delete(
  "/memory/:memoryId",
  runAsync(async (req: Request, res: Response) => {
    deleteMemory(req.params.memoryId);
    res.status(204).end();
  }),
);

agentRouter.patch(
  "/memory/:memoryId/relevance",
  runAsync(async (req: Request, res: Response) => {
    const relevance = Number(req.body?.relevance);
    if (Number.isNaN(relevance) || relevance < 0 || relevance > 1) {
      res.status(400).json({ error: "relevance must be a number between 0 and 1" });
      return;
    }
    updateMemoryRelevance(req.params.memoryId, relevance);
    res.json({ id: req.params.memoryId, relevance });
  }),
);

// --- Recipe endpoints ---

agentRouter.get(
  "/recipes",
  runAsync(async (req: Request, res: Response) => {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    if (query) {
      res.json(searchRecipes(query));
    } else {
      res.json(listRecipes(category));
    }
  }),
);

// --- Triple-encoded recipe endpoints ---
// Each recipe is exposed in three encodings: natural language, structured
// spec, and executable tool call sequence. The triple form lets the Agent
// pick the most efficient execution path for any context.
// NOTE: these routes must be declared BEFORE /recipes/:id to avoid the
// parameter route shadowing them.

agentRouter.get(
  "/recipes/triple",
  runAsync(async (_req: Request, res: Response) => {
    const recipes = listRecipes();
    const library = encodeRecipeLibrary(recipes);
    res.json({
      encoding: "triple",
      count: library.length,
      recipes: library,
    });
  }),
);

const CaptureRecipeSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  toolCalls: z.array(
    z.object({
      tool: z.string(),
      args: z.record(z.unknown()),
    }),
  ),
  avoidWhen: z.array(z.string()).default([]),
  restraintCost: z.number().min(0).max(5).default(2),
  tags: z.array(z.string()).default([]),
});

agentRouter.post(
  "/recipes/capture",
  validate(CaptureRecipeSchema),
  runAsync(async (req: Request, res: Response) => {
    const input = validated<z.infer<typeof CaptureRecipeSchema>>(req);
    const spec = decodeToolCallsToSpec(input.toolCalls);
    const description = composeDescriptionFromSpec(spec);
    const skillMarkdown = buildSkillMarkdown({
      recipeId: `captured-${Date.now()}`,
      name: input.name,
      category: input.category,
      description,
      skillMarkdown: "",
      spec,
      toolCalls: input.toolCalls.map((tc: { tool: string; args: Record<string, unknown> }) => ({
        tool: tc.tool as never,
        args: tc.args,
        reason: "captured from user composition",
      })),
      executionCost: input.toolCalls.length + input.restraintCost,
    });
    res.status(201).json({
      captured: true,
      name: input.name,
      category: input.category,
      description,
      spec,
      skillMarkdown,
      toolCallCount: input.toolCalls.length,
      executionCost: input.toolCalls.length + input.restraintCost,
    });
  }),
);

agentRouter.get(
  "/recipes/:id",
  runAsync(async (req: Request, res: Response) => {
    const recipe = getRecipe(req.params.id);
    if (!recipe) {
      res.status(404).json({ error: `recipe ${req.params.id} not found` });
      return;
    }
    res.json(recipe);
  }),
);

agentRouter.get(
  "/recipes/:id/triple",
  runAsync(async (req: Request, res: Response) => {
    const recipe = getRecipe(req.params.id);
    if (!recipe) {
      res.status(404).json({ error: `recipe ${req.params.id} not found` });
      return;
    }
    const triple = encodeRecipeTriple(recipe);
    res.json(triple);
  }),
);

// Resolve a recipe's tool call sequence against a specific component.
// Returns the substituted tool calls ready for direct execution.
agentRouter.post(
  "/recipes/:id/resolve",
  runAsync(async (req: Request, res: Response) => {
    const recipe = getRecipe(req.params.id);
    if (!recipe) {
      res.status(404).json({ error: `recipe ${req.params.id} not found` });
      return;
    }
    const componentId = typeof req.body?.componentId === "string" ? req.body.componentId : "";
    if (!componentId) {
      res.status(400).json({ error: "componentId is required in the body" });
      return;
    }
    const triple = encodeRecipeTriple(recipe);
    const resolved = substituteComponentId(triple.toolCalls, componentId);
    res.json({
      recipeId: recipe.id,
      componentId,
      toolCalls: resolved,
      executionCost: triple.executionCost,
    });
  }),
);

// --- Generated skills endpoints ---

agentRouter.get(
  "/generated-skills",
  runAsync(async (req: Request, res: Response) => {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    res.json(listGeneratedSkills(projectId, limit));
  }),
);

// --- Restraint analysis endpoint ---

agentRouter.get(
  "/projects/:id/restraint",
  runAsync(async (req: Request, res: Response) => {
    const result = analyzeProjectRestraint(req.params.id);
    if (!result) {
      res.status(404).json({ error: `project ${req.params.id} not found` });
      return;
    }
    res.json(result);
  }),
);

// --- Restraint budget endpoints ---
// Per-project ceiling on cumulative motion "loudness". The budget tracks
// spend across spec mutations and blocks new loud effects when exhausted.

agentRouter.get(
  "/projects/:id/budget",
  runAsync(async (req: Request, res: Response) => {
    const project = getProjectWithSpec(req.params.id);
    if (!project || !project.spec) {
      res.status(404).json({ error: `project ${req.params.id} not found` });
      return;
    }
    const tokens = project.spec.project.tokens ?? {};
    const budget = readBudget(tokens);
    const report = formatBudgetReport(budget);
    const recommendedUpgrade = recommendTierUpgrade(budget);
    res.json({
      budget,
      remaining: budget.ceiling - budget.spent,
      percentUsed: budget.ceiling > 0 ? Math.round((budget.spent / budget.ceiling) * 100) : 0,
      report,
      recommendedUpgrade,
    });
  }),
);

const SetTierSchema = z.object({
  tier: z.enum(["minimalist", "balanced", "expressive", "maximalist"]),
});

agentRouter.post(
  "/projects/:id/budget/tier",
  validate(SetTierSchema),
  runAsync(async (req: Request, res: Response) => {
    const input = validated<z.infer<typeof SetTierSchema>>(req);
    const project = getProjectWithSpec(req.params.id);
    if (!project || !project.spec) {
      res.status(404).json({ error: `project ${req.params.id} not found` });
      return;
    }
    const tokens = project.spec.project.tokens ?? {};
    const { budget, tokens: newTokens } = setTier(input.tier as RestraintTier, tokens);
    updateProjectOrThrow(req.params.id, { tokens: newTokens });
    res.json({
      budget,
      message: `Tier set to ${input.tier} (ceiling ${budget.ceiling})`,
    });
  }),
);

agentRouter.post(
  "/projects/:id/budget/recompute",
  runAsync(async (req: Request, res: Response) => {
    const project = getProjectWithSpec(req.params.id);
    if (!project || !project.spec) {
      res.status(404).json({ error: `project ${req.params.id} not found` });
      return;
    }
    const tokens = project.spec.project.tokens ?? {};
    const budget = readBudget(tokens);
    const newSpend = recomputeSpend(project.spec);
    const updated = { ...budget, spent: newSpend };
    const newTokens = writeBudget(tokens, updated);
    updateProjectOrThrow(req.params.id, { tokens: newTokens });
    res.json({
      budget: updated,
      message: `Recomputed spend: ${newSpend}/${updated.ceiling} (${updated.tier})`,
    });
  }),
);

// --- Grammar endpoints ---

const CompileGrammarSchema = z.object({
  source: z.string().min(1),
});

agentRouter.get(
  "/grammar",
  runAsync(async (_req: Request, res: Response) => {
    res.json({
      verbs: MOTION_VERBS,
      examples: GRAMMAR_EXAMPLES,
    });
  }),
);

agentRouter.post(
  "/grammar/compile",
  validate(CompileGrammarSchema),
  runAsync(async (req: Request, res: Response) => {
    const { source } = validated<z.infer<typeof CompileGrammarSchema>>(req);
    const compiled = compileGrammar(source);
    res.json(compiled);
  }),
);

// --- Shader endpoints ---

agentRouter.get(
  "/shaders",
  runAsync(async (req: Request, res: Response) => {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const extended = req.query.extended === "1" || req.query.extended === "true";
    if (extended) {
      res.json({
        base: listShaderEffects(category),
        extended: listAllShaderEffects(category).filter(
          (s) => !listShaderEffects(category).some((b) => b.id === s.id),
        ),
        total: listAllShaderEffects(category).length,
      });
    } else {
      res.json(listShaderEffects(category));
    }
  }),
);

agentRouter.get(
  "/shaders/all",
  runAsync(async (req: Request, res: Response) => {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const all = listAllShaderEffects(category);
    res.json({
      count: all.length,
      categories: [...new Set(all.map((s) => s.category))],
      shaders: all,
    });
  }),
);

agentRouter.get(
  "/shaders/:id",
  runAsync(async (req: Request, res: Response) => {
    const effect = getShaderEffect(req.params.id) ?? getExtendedShaderEffect(req.params.id);
    if (!effect) {
      res.status(404).json({ error: `shader ${req.params.id} not found` });
      return;
    }
    res.json(effect);
  }),
);

// --- MotionMount runtime config ---
// Returns the runtime configuration for mounting a shader to a WebGL canvas.
// The frontend MotionMount component fetches this config and uses the
// createShaderRenderer() utility to render the shader.

agentRouter.get(
  "/shaders/:id/mount",
  runAsync(async (req: Request, res: Response) => {
    const effect = getShaderEffect(req.params.id) ?? getExtendedShaderEffect(req.params.id);
    if (!effect) {
      res.status(404).json({ error: `shader ${req.params.id} not found` });
      return;
    }
    const defaultParams: Record<string, number> = {};
    for (const [name, spec] of Object.entries(effect.parameters)) {
      defaultParams[name] = spec.default;
    }
    res.json({
      shaderId: effect.id,
      name: effect.name,
      category: effect.category,
      glslSource: effect.glslSource,
      cssFallback: effect.cssStyle,
      parameters: effect.parameters,
      defaultParams,
      mountConfig: {
        antialias: true,
        premultipliedAlpha: false,
        uniformPrefix: "u_",
        timeUniform: "u_time",
        resolutionUniform: "u_resolution",
        intensityUniform: "u_intensity",
        fps: 60,
      },
    });
  }),
);

// --- Analytics endpoints ---

agentRouter.get(
  "/projects/:id/analytics",
  runAsync(async (req: Request, res: Response) => {
    res.json(getSessionMetrics(req.params.id));
  }),
);

agentRouter.get(
  "/projects/:id/analytics/tools",
  runAsync(async (req: Request, res: Response) => {
    res.json(listToolStats(req.params.id));
  }),
);

agentRouter.delete(
  "/projects/:id/analytics",
  runAsync(async (req: Request, res: Response) => {
    resetAnalytics(req.params.id);
    res.status(204).end();
  }),
);

// --- Agent capabilities endpoint ---

agentRouter.get(
  "/capabilities",
  runAsync(async (_req: Request, res: Response) => {
    const tools = TOOL_NAMES.map((name) => ({
      name,
      description: TOOL_DESCRIPTIONS[name],
    }));
    res.json({
      toolCount: tools.length,
      tools,
    });
  }),
);

// --- Tool composition preview endpoint ---

const ComposePreviewSchema = z.object({
  message: z.string().min(1),
  hasComponents: z.boolean().default(false),
});

agentRouter.post(
  "/projects/:id/compose",
  validate(ComposePreviewSchema),
  runAsync(async (req: Request, res: Response) => {
    const { message, hasComponents } = validated<{ message: string; hasComponents: boolean }>(req);
    const result = composeTools(message, req.params.id, hasComponents);
    res.json(result);
  }),
);

// --- Semantic memory search endpoint ---

agentRouter.get(
  "/projects/:id/semantic-search",
  runAsync(async (req: Request, res: Response) => {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    if (!query) {
      res.status(400).json({ error: "Query parameter 'q' is required" });
      return;
    }
    const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit ?? "5"), 10)));
    const entries = listConversationMemory(req.params.id);
    const results = semanticSearch(entries, query, limit);
    res.json({
      query,
      totalEntries: entries.length,
      resultCount: results.length,
      results: results.map((r: { score: number; matchedTerms: string[]; entry: { role: string; content: string; createdAt: string } }) => ({
        score: Math.round(r.score * 1000) / 1000,
        matchedTerms: r.matchedTerms,
        entry: {
          role: r.entry.role,
          content: r.entry.content.slice(0, 300),
          createdAt: r.entry.createdAt,
        },
      })),
    });
  }),
);

// --- Direct tool execution endpoint ---
// Allows the UI (or MCP bridge) to invoke a tool directly without going
// through the chat loop. Useful for operational tools like rollback_last_action,
// list_checkpoints, get_plan_state, cancel_plan.

const ExecuteToolSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.unknown()).default({}),
});

agentRouter.post(
  "/projects/:id/tools",
  validate(ExecuteToolSchema),
  runAsync(async (req: Request, res: Response) => {
    const { tool, args } = validated<z.infer<typeof ExecuteToolSchema>>(req);
    if (!TOOL_NAMES.includes(tool as never)) {
      res.status(400).json({ ok: false, error: `unknown tool: ${tool}` });
      return;
    }
    // Capture a checkpoint for spec-mutating tools (consistency with the chat loop).
    if (isSpecMutating(tool)) {
      capture(req.params.id, tool);
    }
    // Run pre-hooks (validation, veto, arg patching).
    const pre = await runPreHooks({
      projectId: req.params.id,
      tool: tool as never,
      args: { ...args, projectId: req.params.id },
    });
    if (pre.veto) {
      res.json({
        ok: false,
        result: {
          ok: false,
          summary: `vetoed by guardrail: ${pre.reason ?? "unknown reason"}`,
          specChanged: false,
        },
        warnings: pre.warnings,
      });
      return;
    }
    const result = await executeTool(tool as never, pre.args, { projectId: req.params.id });
    // Run post-hooks (side effects only).
    await runPostHooks(
      { projectId: req.params.id, tool: tool as never, args: pre.args },
      result,
    );
    if (pre.warnings.length > 0) {
      logger.warn("tool warnings", { tool, warnings: pre.warnings });
    }
    res.json({ ok: result.ok, result, warnings: pre.warnings });
  }),
);

// --- Checkpoint endpoints ---

agentRouter.get(
  "/projects/:id/checkpoints",
  runAsync(async (req: Request, res: Response) => {
    const checkpoints = listCheckpoints(req.params.id);
    res.json({
      count: checkpoints.length,
      checkpoints: checkpoints.map((c) => ({
        id: c.id,
        capturedAt: c.capturedAt,
        triggerTool: c.triggerTool,
        componentCount: c.componentCount,
        label: c.label,
      })),
    });
  }),
);

// Capture a manual checkpoint (e.g., before a risky user-initiated change).
agentRouter.post(
  "/projects/:id/checkpoints",
  runAsync(async (req: Request, res: Response) => {
    const trigger = typeof req.body?.triggerTool === "string" ? req.body.triggerTool : "manual";
    const cp = capture(req.params.id, trigger);
    if (!cp) {
      res.status(404).json({ ok: false, error: "project has no spec to snapshot" });
      return;
    }
    res.status(201).json({
      ok: true,
      checkpoint: {
        id: cp.id,
        capturedAt: cp.capturedAt,
        triggerTool: cp.triggerTool,
        componentCount: cp.componentCount,
        label: cp.label,
      },
    });
  }),
);

// Get a specific checkpoint by id (includes the full component snapshot).
agentRouter.get(
  "/projects/:id/checkpoints/:cpId",
  runAsync(async (req: Request, res: Response) => {
    const checkpoints = listCheckpoints(req.params.id);
    const cp = checkpoints.find((c) => c.id === req.params.cpId);
    if (!cp) {
      res.status(404).json({ ok: false, error: "checkpoint not found" });
      return;
    }
    res.json({
      checkpoint: {
        id: cp.id,
        capturedAt: cp.capturedAt,
        triggerTool: cp.triggerTool,
        componentCount: cp.componentCount,
        label: cp.label,
        components: cp.components,
        project: cp.project,
      },
    });
  }),
);

// Rollback to the most recent checkpoint.
agentRouter.post(
  "/projects/:id/checkpoints/rollback",
  runAsync(async (req: Request, res: Response) => {
    const cp = rollback(req.params.id);
    if (!cp) {
      res.status(404).json({ ok: false, error: "no checkpoints available" });
      return;
    }
    res.json({
      ok: true,
      checkpoint: {
        id: cp.id,
        capturedAt: cp.capturedAt,
        triggerTool: cp.triggerTool,
        componentCount: cp.componentCount,
        label: cp.label,
      },
    });
  }),
);

// Rollback to a specific checkpoint by id.
agentRouter.post(
  "/projects/:id/checkpoints/:cpId/rollback",
  runAsync(async (req: Request, res: Response) => {
    const cp = rollbackTo(req.params.id, req.params.cpId);
    if (!cp) {
      res.status(404).json({ ok: false, error: "checkpoint not found" });
      return;
    }
    res.json({
      ok: true,
      checkpoint: {
        id: cp.id,
        capturedAt: cp.capturedAt,
        triggerTool: cp.triggerTool,
        componentCount: cp.componentCount,
        label: cp.label,
      },
    });
  }),
);

// Clear all checkpoints for a project.
agentRouter.delete(
  "/projects/:id/checkpoints",
  runAsync(async (req: Request, res: Response) => {
    clearCheckpoints(req.params.id);
    res.json({ ok: true });
  }),
);

// --- Plan endpoints ---
// The plan store holds the current StructuredPlan for a project so the UI
// can poll progress, cancel mid-flight, and inspect the action roster.

const ComposePlanSchema = z.object({
  message: z.string().min(1),
});

agentRouter.get(
  "/projects/:id/plan",
  runAsync(async (req: Request, res: Response) => {
    res.json(summarizePlan(req.params.id));
  }),
);

agentRouter.post(
  "/projects/:id/plan",
  validate(ComposePlanSchema),
  runAsync(async (req: Request, res: Response) => {
    const { message } = validated<{ message: string }>(req);
    const spec = getProjectSpec(req.params.id);
    if (!spec) {
      res.status(404).json({ ok: false, error: "project not found" });
      return;
    }
    const plan = composeStructuredPlan(message, spec);
    const record = setPlan(req.params.id, plan);
    res.status(201).json({
      ok: true,
      planMode: shouldUsePlanMode(message, spec),
      createdAt: record.createdAt,
      summary: summarizePlan(req.params.id),
    });
  }),
);

agentRouter.post(
  "/projects/:id/plan/cancel",
  runAsync(async (req: Request, res: Response) => {
    const rec = cancelPlan(req.params.id);
    if (!rec) {
      res.status(404).json({ ok: false, error: "no active plan to cancel" });
      return;
    }
    res.json({ ok: true, summary: summarizePlan(req.params.id) });
  }),
);

agentRouter.delete(
  "/projects/:id/plan",
  runAsync(async (req: Request, res: Response) => {
    clearPlan(req.params.id);
    res.json({ ok: true });
  }),
);

agentRouter.get(
  "/projects/:id/plan/progress",
  runAsync(async (req: Request, res: Response) => {
    res.json({
      progress: getPlanProgress(req.params.id),
      finished: isPlanDone(req.params.id),
      summary: summarizePlan(req.params.id),
    });
  }),
);

// --- Unified FTS5 search endpoint ---
// Searches across projects, components, messages, memory, skills, generated
// skills, and recipes. Pass `scope` to restrict to one category, and
// `projectId` to scope project-bound results to a single project.

agentRouter.get(
  "/search",
  runAsync(async (req: Request, res: Response) => {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    if (query.trim().length === 0) {
      res.json({ query: "", total: 0, hits: [] });
      return;
    }
    const scope = typeof req.query.scope === "string" ? (req.query.scope as SearchScope) : "all";
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const limitParam = Number(req.query.limit);
    const limitPerScope = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(50, limitParam) : 10;
    const result = unifiedSearch({ query, scope, projectId, limitPerScope });
    res.json(result);
  }),
);

// Rebuild the FTS5 indexes from existing rows (admin operation).
agentRouter.post(
  "/search/rebuild",
  runAsync(async (_req: Request, res: Response) => {
    const result = rebuildFtsIndexes();
    res.json({ ok: true, indexed: result.indexed });
  }),
);

// --- Inbound MCP client endpoints ---
// OpenMotion can act as an MCP client and connect to external MCP servers
// (stdio or Streamable HTTP). Tools from connected servers are namespaced as
// `${serverId}__${toolName}` and become callable from the orchestrator.

const ConnectStdioSchema = z.object({
  transport: z.literal("stdio"),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
});

const ConnectHttpSchema = z.object({
  transport: z.literal("http"),
  url: z.string().url(),
  requestInit: z.any().optional(),
  sessionId: z.string().optional(),
});

const ConnectExternalSchema = z.discriminatedUnion("transport", [
  ConnectStdioSchema,
  ConnectHttpSchema,
]);

agentRouter.post(
  "/mcp/servers/:serverId",
  validate(ConnectExternalSchema),
  runAsync(async (req: Request, res: Response) => {
    const config = validated<ExternalServerConfig>(req);
    const info = await connectExternalServer(req.params.serverId, config);
    res.status(201).json(info);
  }),
);

agentRouter.get(
  "/mcp/servers",
  runAsync(async (_req: Request, res: Response) => {
    const servers = listExternalServers();
    res.json({ count: servers.length, servers });
  }),
);

agentRouter.get(
  "/mcp/servers/:serverId",
  runAsync(async (req: Request, res: Response) => {
    if (!isExternalServerConnected(req.params.serverId)) {
      res.status(404).json({ error: `server "${req.params.serverId}" is not connected` });
      return;
    }
    res.json(listExternalServers().find((s) => s.serverId === req.params.serverId));
  }),
);

agentRouter.delete(
  "/mcp/servers/:serverId",
  runAsync(async (req: Request, res: Response) => {
    await disconnectExternalServer(req.params.serverId);
    res.status(204).end();
  }),
);

agentRouter.get(
  "/mcp/tools",
  runAsync(async (_req: Request, res: Response) => {
    const tools = await listExternalMcpTools();
    res.json({ count: tools.length, tools });
  }),
);

const CallExternalSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.unknown()).default({}),
  timeoutMs: z.number().min(100).max(120_000).optional(),
});

agentRouter.post(
  "/mcp/servers/:serverId/call",
  validate(CallExternalSchema),
  runAsync(async (req: Request, res: Response) => {
    const { tool, args, timeoutMs } = validated<z.infer<typeof CallExternalSchema>>(req);
    if (!isExternalServerConnected(req.params.serverId)) {
      res.status(404).json({
        ok: false,
        error: `server "${req.params.serverId}" is not connected`,
      });
      return;
    }
    const result = await callExternalMcpTool(req.params.serverId, tool, args, timeoutMs);
    res.json(result);
  }),
);

const CallNamespacedSchema = z.object({
  name: z.string().min(1),
  args: z.record(z.unknown()).default({}),
  timeoutMs: z.number().min(100).max(120_000).optional(),
});

agentRouter.post(
  "/mcp/route",
  validate(CallNamespacedSchema),
  runAsync(async (req: Request, res: Response) => {
    const { name, args, timeoutMs } = validated<z.infer<typeof CallNamespacedSchema>>(req);
    const result = await routeNamespacedExternalCall(name, args, timeoutMs);
    if (!result) {
      res.status(404).json({
        ok: false,
        error: `tool "${name}" is not a namespaced external call (expected "serverId__toolName")`,
      });
      return;
    }
    res.json(result);
  }),
);

// --- Motion Intelligence endpoints ---
// Three original systems for creative motion analysis and generation:
// variation engine, DNA extraction, and style transfer.

const VariationsSchema = z.object({
  componentId: z.string().min(1),
  countPerAxis: z.number().int().min(1).max(10).optional(),
  axes: z.array(
    z.enum(["easing", "duration", "intensity", "direction", "origin", "stagger"]),
  ).optional(),
  seed: z.number().int().optional(),
});

agentRouter.post(
  "/projects/:id/variations",
  validate(VariationsSchema),
  runAsync(async (req: Request, res: Response) => {
    const input = validated<z.infer<typeof VariationsSchema>>(req);
    const spec = getProjectSpec(req.params.id);
    if (!spec) {
      res.status(404).json({ error: `project ${req.params.id} not found` });
      return;
    }
    const source = spec.components.find((c) => c.id === input.componentId);
    if (!source) {
      res.status(404).json({ error: `component ${input.componentId} not found` });
      return;
    }
    const variations = generateVariations(source, {
      countPerAxis: input.countPerAxis,
      axes: input.axes as VariationAxis[] | undefined,
      seed: input.seed,
    });
    res.json({
      ok: true,
      sourceComponentId: source.id,
      count: variations.length,
      summary: formatVariationSummary(variations),
      variations: variations.map((v) => ({
        label: v.label,
        axis: v.axis,
        delta: v.delta,
        component: v.component,
      })),
    });
  }),
);

agentRouter.get(
  "/projects/:id/components/:componentId/dna",
  runAsync(async (req: Request, res: Response) => {
    const spec = getProjectSpec(req.params.id);
    if (!spec) {
      res.status(404).json({ error: `project ${req.params.id} not found` });
      return;
    }
    const component = spec.components.find((c) => c.id === req.params.componentId);
    if (!component) {
      res.status(404).json({ error: `component ${req.params.componentId} not found` });
      return;
    }
    const dna = extractDNA(component);
    res.json({
      ok: true,
      componentId: component.id,
      componentName: component.name,
      dna,
      report: formatDNAReport(dna, component.name),
    });
  }),
);

const StyleTransferSchema = z.object({
  sourceComponentId: z.string().min(1),
  targetComponentId: z.string().min(1),
  apply: z.boolean().default(false),
});

agentRouter.post(
  "/projects/:id/style-transfer",
  validate(StyleTransferSchema),
  runAsync(async (req: Request, res: Response) => {
    const input = validated<z.infer<typeof StyleTransferSchema>>(req);
    const spec = getProjectSpec(req.params.id);
    if (!spec) {
      res.status(404).json({ error: `project ${req.params.id} not found` });
      return;
    }
    const source = spec.components.find((c) => c.id === input.sourceComponentId);
    const target = spec.components.find((c) => c.id === input.targetComponentId);
    if (!source) {
      res.status(404).json({ error: `source component ${input.sourceComponentId} not found` });
      return;
    }
    if (!target) {
      res.status(404).json({ error: `target component ${input.targetComponentId} not found` });
      return;
    }
    const result = transferStyle(source, target);
    res.json({
      ok: true,
      sourceComponentId: source.id,
      targetComponentId: target.id,
      transferred: result.transferred,
      preserved: result.preserved,
      component: result.component,
      report: formatStyleTransferReport(result, source.name, target.name),
    });
  }),
);

const DnaCompareSchema = z.object({
  componentIdA: z.string().min(1),
  componentIdB: z.string().min(1),
});

agentRouter.post(
  "/projects/:id/dna-compare",
  validate(DnaCompareSchema),
  runAsync(async (req: Request, res: Response) => {
    const input = validated<z.infer<typeof DnaCompareSchema>>(req);
    const spec = getProjectSpec(req.params.id);
    if (!spec) {
      res.status(404).json({ error: `project ${req.params.id} not found` });
      return;
    }
    const a = spec.components.find((c) => c.id === input.componentIdA);
    const b = spec.components.find((c) => c.id === input.componentIdB);
    if (!a) {
      res.status(404).json({ error: `component ${input.componentIdA} not found` });
      return;
    }
    if (!b) {
      res.status(404).json({ error: `component ${input.componentIdB} not found` });
      return;
    }
    const dnaA = extractDNA(a);
    const dnaB = extractDNA(b);
    const comparison = compareDNA(dnaA, dnaB);
    res.json({
      ok: true,
      componentA: { id: a.id, name: a.name, dna: dnaA },
      componentB: { id: b.id, name: b.name, dna: dnaB },
      similarity: comparison.similarity,
      matches: comparison.matches,
      differences: comparison.differences,
    });
  }),
);

// --- Motion Critique endpoint ---

agentRouter.get(
  "/projects/:id/critique",
  runAsync(async (req: Request, res: Response) => {
    const spec = getProjectSpec(req.params.id);
    if (!spec) {
      res.status(404).json({ error: `project ${req.params.id} not found` });
      return;
    }
    const report = critiqueMotion(spec);
    res.json({
      ok: true,
      projectName: spec.project.name,
      componentCount: report.componentCount,
      overallScore: report.overallScore,
      dimensions: report.dimensions,
      findings: report.findings,
      recommendations: report.recommendations,
      report: formatCritiqueReport(report, spec.project.name),
    });
  }),
);

// --- Motion Storytelling endpoints ---

agentRouter.get(
  "/storytelling/intents",
  runAsync(async (_req: Request, res: Response) => {
    res.json({ ok: true, intents: listNarrativeIntents() });
  }),
);

const StorySchema = z.object({
  intent: z.string().optional(),
  prompt: z.string().optional(),
  totalDurationMs: z.number().int().positive().max(30000).optional(),
  intensityScale: z.number().min(0.1).max(3).optional(),
});

agentRouter.post(
  "/projects/:id/story",
  validate(StorySchema),
  runAsync(async (req: Request, res: Response) => {
    const input = validated<z.infer<typeof StorySchema>>(req);
    // Resolve the narrative intent: explicit > detected from prompt > error.
    let intent: NarrativeIntent | null = null;
    if (input.intent) {
      intent = input.intent as NarrativeIntent;
    } else if (input.prompt) {
      intent = detectNarrativeIntent(input.prompt);
    }
    if (!intent) {
      res.status(400).json({
        error: "could not detect a narrative intent. Provide an 'intent' or a 'prompt' containing narrative keywords.",
        availableIntents: listNarrativeIntents().map((i) => i.intent),
      });
      return;
    }
    const sequence = generateStorySequence(intent, {
      totalDurationMs: input.totalDurationMs,
      intensityScale: input.intensityScale,
    });
    res.json({
      ok: true,
      intent: sequence.intent,
      title: sequence.title,
      summary: sequence.summary,
      themes: sequence.themes,
      totalDurationMs: sequence.totalDurationMs,
      beats: sequence.beats,
      intensityCurve: sequence.intensityCurve,
      report: formatStoryReport(sequence),
    });
  }),
);
