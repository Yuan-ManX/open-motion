import type { ToolName } from "@openmotion/shared";
import {
  listPipelines,
  getPipeline,
  createPipeline,
  deletePipeline,
  incrementUsage,
  type PipelineStep,
} from "../../db/repositories/pipelines.js";
import { executeTool, type ToolContext, type ToolResult } from "./registry.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

export const pipelineExecutors: Partial<Record<ToolName, Executor>> = {
  save_pipeline: (args, ctx) => {
    const name = String(args.name);
    const description = args.description ? String(args.description) : "";
    const rawSteps = args.steps;
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      return { ok: false, summary: "pipeline requires at least one step", specChanged: false };
    }
    const steps: PipelineStep[] = rawSteps.map((s, i) => {
      const step = s as { tool?: string; args?: Record<string, unknown>; description?: string };
      if (!step.tool || typeof step.tool !== "string") {
        throw new Error(`step ${i + 1} missing "tool" name`);
      }
      return {
        tool: step.tool,
        args: step.args ?? {},
        description: step.description,
      };
    });
    const tags = Array.isArray(args.tags) ? (args.tags as string[]) : [];
    const pipe = createPipeline({
      projectId: ctx.projectId,
      name,
      description,
      steps,
      tags,
    });
    return {
      ok: true,
      summary: `saved pipeline "${name}" with ${steps.length} step(s)`,
      specChanged: false,
      data: { id: pipe.id, name: pipe.name, stepCount: steps.length },
    };
  },

  list_pipelines: (_args, ctx) => {
    const pipes = listPipelines(ctx.projectId);
    const summaries = pipes.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      stepCount: p.steps.length,
      usageCount: p.usageCount,
      tags: p.tags,
    }));
    return {
      ok: true,
      summary: `${pipes.length} pipeline(s) available`,
      specChanged: false,
      data: summaries,
    };
  },

  run_pipeline: async (args, ctx) => {
    const pipelineId = String(args.pipelineId);
    const pipe = getPipeline(pipelineId);
    if (!pipe) {
      return { ok: false, summary: `pipeline ${pipelineId} not found`, specChanged: false };
    }
    let anySpecChanged = false;
    const failedSteps: string[] = [];
    const results: { tool: string; ok: boolean; summary: string }[] = [];
    for (const step of pipe.steps) {
      const result = await executeTool(step.tool as ToolName, step.args, ctx);
      results.push({ tool: step.tool, ok: result.ok, summary: result.summary });
      if (result.specChanged) anySpecChanged = true;
      if (!result.ok) failedSteps.push(step.tool);
    }
    incrementUsage(pipelineId);
    const okCount = results.filter((r) => r.ok).length;
    if (failedSteps.length > 0) {
      return {
        ok: false,
        summary: `pipeline "${pipe.name}" ran ${okCount}/${results.length} steps; failed: ${failedSteps.join(", ")}`,
        specChanged: anySpecChanged,
        data: { results, failedSteps },
      };
    }
    return {
      ok: true,
      summary: `pipeline "${pipe.name}" completed (${okCount}/${results.length} steps)`,
      specChanged: anySpecChanged,
      data: { results },
    };
  },

  delete_pipeline: (args, _ctx) => {
    const pipelineId = String(args.pipelineId);
    const ok = deletePipeline(pipelineId);
    if (!ok) {
      return { ok: false, summary: `pipeline ${pipelineId} not found`, specChanged: false };
    }
    return {
      ok: true,
      summary: `deleted pipeline ${pipelineId}`,
      specChanged: false,
    };
  },
};
