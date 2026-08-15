import { Router } from "express";
import { runAsync } from "../../utils/async.js";
import { planMotionHierarchy } from "../../agent/motionPlanner.js";
import { routeAutonomous } from "../../agent/autonomousRouter.js";
import { getProjectSpec } from "../../db/repositories/projects.js";
import type { ToolContext } from "../../agent/tools/registry.js";

export const plannerRouter = Router();

// POST /api/planner/plan — build a hierarchical motion plan from a text goal
plannerRouter.post("/planner/plan", (req, res) => {
  const goal = typeof req.body?.goal === "string" ? req.body.goal : "";
  if (goal.trim().length === 0) {
    res.status(400).json({ error: "goal is required" });
    return;
  }
  const plan = planMotionHierarchy(goal);
  res.json({
    ok: true,
    plan: {
      summary: plan.summary,
      goal: plan.goal,
      objectives: plan.objectives,
      executionOrder: plan.executionOrder,
      maxParallelism: plan.maxParallelism,
      criticalPathMs: plan.criticalPathMs,
    },
  });
});

// POST /api/planner/route — autonomous task router. Classifies intent,
// expands into tool steps with fallback chain, executes tools through
// the registry, and returns the full execution trace.
plannerRouter.post(
  "/planner/route",
  runAsync(async (req, res) => {
    const projectId = typeof req.body?.projectId === "string" ? req.body.projectId : "";
    const text = typeof req.body?.text === "string" ? req.body.text : "";
    const execute = req.body?.execute !== false; // default: execute tools
    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }
    if (text.trim().length === 0) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    const spec = getProjectSpec(projectId);
    if (!spec) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    const ctx: ToolContext = { projectId };
    const route = execute
      ? await routeAutonomous(text, spec, ctx)
      : await routeAutonomous(text, spec);
    res.json({
      ok: true,
      projectId,
      route: {
        intent: route.plan.intent,
        steps: route.plan.steps,
        reasoning: route.plan.reasoning,
        concepts: route.plan.concepts,
        collaborationFallbackModules: route.plan.collaborationFallbackModules,
        emotion: route.plan.emotion,
        strategy: route.strategy,
        results: route.results,
        finalResult: route.finalResult
          ? {
              ok: route.finalResult.ok,
              summary: route.finalResult.summary,
              specChanged: route.finalResult.specChanged ?? false,
            }
          : null,
      },
    });
  }),
);
