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
import { getSessionMetrics, listToolStats, resetAnalytics } from "../../agent/analytics.js";
import { composeTools } from "../../agent/toolComposer.js";
import { listMemory as listConversationMemory } from "../../agent/memory/store.js";
import { semanticSearch } from "../../agent/memory/semanticSearch.js";
import { executeTool } from "../../agent/tools/registry.js";
import { capture, listCheckpoints, isSpecMutating } from "../../agent/checkpointManager.js";
import { runPreHooks, runPostHooks } from "../../agent/pluginHooks.js";
import { logger } from "../../utils/logger.js";
import { TOOL_NAMES, TOOL_DESCRIPTIONS } from "@openmotion/shared";

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
    res.json(listShaderEffects(category));
  }),
);

agentRouter.get(
  "/shaders/:id",
  runAsync(async (req: Request, res: Response) => {
    const effect = getShaderEffect(req.params.id);
    if (!effect) {
      res.status(404).json({ error: `shader ${req.params.id} not found` });
      return;
    }
    res.json(effect);
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
