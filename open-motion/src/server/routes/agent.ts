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
