import { Router } from "express";
import { z } from "zod";
import { runAsync } from "../../utils/async.js";
import {
  listPipelines,
  getPipeline,
  createPipeline,
  updatePipeline,
  deletePipeline,
  type PipelineStep,
} from "../../db/repositories/pipelines.js";

export const pipelinesRouter = Router();

const StepSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.unknown()).default({}),
  description: z.string().optional(),
});

const CreatePipelineSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().default(""),
  steps: z.array(StepSchema).min(1),
  tags: z.array(z.string()).optional().default([]),
});

const UpdatePipelineSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  steps: z.array(StepSchema).optional(),
  tags: z.array(z.string()).optional(),
});

pipelinesRouter.get(
  "/projects/:id/pipelines",
  runAsync(async (req, res) => {
    res.json(listPipelines(req.params.id));
  }),
);

pipelinesRouter.get(
  "/projects/:id/pipelines/:pipelineId",
  runAsync(async (req, res) => {
    const pipe = getPipeline(req.params.pipelineId);
    if (!pipe) {
      res.status(404).json({ error: "pipeline not found" });
      return;
    }
    res.json(pipe);
  }),
);

pipelinesRouter.post(
  "/projects/:id/pipelines",
  runAsync(async (req, res) => {
    const parsed = CreatePipelineSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "invalid pipeline input" });
      return;
    }
    const pipe = createPipeline({
      projectId: req.params.id,
      name: parsed.data.name,
      description: parsed.data.description,
      steps: parsed.data.steps as PipelineStep[],
      tags: parsed.data.tags,
    });
    res.status(201).json(pipe);
  }),
);

pipelinesRouter.patch(
  "/projects/:id/pipelines/:pipelineId",
  runAsync(async (req, res) => {
    const parsed = UpdatePipelineSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid patch input" });
      return;
    }
    const pipe = updatePipeline(req.params.pipelineId, parsed.data);
    if (!pipe) {
      res.status(404).json({ error: "pipeline not found" });
      return;
    }
    res.json(pipe);
  }),
);

pipelinesRouter.delete(
  "/projects/:id/pipelines/:pipelineId",
  runAsync(async (req, res) => {
    const ok = deletePipeline(req.params.pipelineId);
    if (!ok) {
      res.status(404).json({ error: "pipeline not found" });
      return;
    }
    res.status(204).end();
  }),
);
