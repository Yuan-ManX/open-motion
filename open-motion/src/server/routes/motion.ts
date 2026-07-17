import { Router } from "express";
import { getProjectSpec } from "../../db/repositories/projects.js";
import { analyzeIntelligence } from "../../motion/intelligence.js";
import {
  adaptMotion,
  generateResponsiveCss,
  previewAdaptations,
  RESPONSIVE_BREAKPOINTS,
  type AdaptationContext,
} from "../../motion/adaptive.js";
import {
  synthesizeMotion,
  morphToPattern,
  synthesizeCustomWaveform,
  listGenerativePatterns,
  type GenerativePattern,
  type WaveformType,
} from "../../motion/synthesis.js";
import {
  createStoryArc,
  analyzePacing,
  generateTransitions,
  assignComponentsToBeats,
  createStorytellingPlan,
  applyStorytellingPlan,
  listStoryGenres,
  type StoryGenre,
} from "../../motion/storytelling.js";
import { checkAccessibility } from "../../motion/accessibility.js";
import { checkPerformance } from "../../motion/performance.js";

export const motionRouter = Router();

// ---------------------------------------------------------------------------
// Motion Intelligence
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/intelligence — full motion intelligence report.
 * Returns emotional analysis, rhythm, narrative structure, personality
 * profiles, and attention flow for the project's motion composition.
 */
motionRouter.get("/projects/:id/intelligence", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const report = analyzeIntelligence(spec);
  res.json(report);
});

// ---------------------------------------------------------------------------
// Accessibility & Safety
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/accessibility — run the full accessibility & safety
 * checker on the project's motion components. Returns categorized issues,
 * a score, and remediation suggestions.
 */
motionRouter.get("/projects/:id/accessibility", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const report = checkAccessibility(spec.components);
  res.json(report);
});

/**
 * GET /api/projects/:id/performance — profile runtime performance metrics
 * for the project's motion components (estimated CPU/GPU cost, paint areas,
 * simultaneous animations, and optimization suggestions).
 */
motionRouter.get("/projects/:id/performance", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const report = checkPerformance(spec.components);
  res.json(report);
});

// ---------------------------------------------------------------------------
// Adaptive Motion
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/adaptive/preview — preview how motion adapts across
 * viewport breakpoints without applying changes.
 */
motionRouter.get("/projects/:id/adaptive/preview", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const previews = previewAdaptations(spec);
  res.json({ previews });
});

/**
 * GET /api/projects/:id/adaptive/css — generate responsive CSS with media
 * queries for all breakpoints.
 */
motionRouter.get("/projects/:id/adaptive/css", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const css = generateResponsiveCss(spec);
  res.json({ css });
});

/**
 * GET /api/adaptive/breakpoints — list all responsive breakpoints.
 */
motionRouter.get("/adaptive/breakpoints", (_req, res) => {
  res.json({ breakpoints: RESPONSIVE_BREAKPOINTS });
});

/**
 * POST /api/projects/:id/adaptive — apply motion adaptation with a context.
 * Body: { device?, performance?, accessibility?, viewportWidth? }
 */
motionRouter.post("/projects/:id/adaptive", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  const device = body.device ?? "mobile";
  const viewportWidth = body.viewportWidth ?? 640;
  const ctx: AdaptationContext = {
    viewport: {
      device,
      width: viewportWidth,
      height: Math.round(viewportWidth * 0.5625),
      pixelRatio: device === "mobile" ? 2 : 1,
    },
    performance: body.performance ?? "medium",
    accessibility: body.accessibility ?? "full",
    connectionSpeed: body.connectionSpeed ?? "fast",
    batteryLevel: body.batteryLevel ?? 1,
  };
  const result = adaptMotion(spec, ctx);
  res.json(result);
});

// ---------------------------------------------------------------------------
// Motion Synthesis
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/synthesis/patterns — list all generative motion patterns.
 */
motionRouter.get("/motion/synthesis/patterns", (_req, res) => {
  res.json({ patterns: listGenerativePatterns() });
});

/**
 * POST /api/projects/:id/synthesis — synthesize a new motion component from
 * a generative pattern. Body: { pattern, componentName?, durationMs?, ... }
 */
motionRouter.post("/projects/:id/synthesis", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  if (!body.pattern) {
    res.status(400).json({ error: "pattern is required" });
    return;
  }
  const result = synthesizeMotion({
    projectId: req.params.id,
    pattern: body.pattern as GenerativePattern,
    durationMs: body.durationMs ?? 2000,
    loopCount: body.loopCount ?? "infinite",
    amplitudeScale: body.amplitudeScale ?? 1,
    speedScale: body.speedScale ?? 1,
    componentName: body.componentName ?? body.name ?? `synth-${Date.now()}`,
  });
  res.json(result);
});

/**
 * POST /api/projects/:id/synthesis/waveform — synthesize a motion component
 * from a custom waveform. Body: { waveform, property, amplitude, frequency, ... }
 */
motionRouter.post("/projects/:id/synthesis/waveform", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  if (!body.waveform) {
    res.status(400).json({ error: "waveform is required" });
    return;
  }
  const result = synthesizeCustomWaveform({
    projectId: req.params.id,
    waveform: body.waveform as WaveformType,
    property: body.property ?? "translateY",
    amplitude: body.amplitude ?? 20,
    frequency: body.frequency ?? 1,
    phase: body.phase ?? 0,
    offset: body.offset ?? 0,
    durationMs: body.durationMs ?? 2000,
    loopCount: body.loopCount ?? "infinite",
    componentName: body.componentName ?? `waveform-${Date.now()}`,
    keyframeCount: body.keyframeCount ?? 20,
  });
  res.json(result);
});

/**
 * POST /api/projects/:id/synthesis/morph — morph an existing component toward
 * a generative pattern. Body: { componentId, pattern, morphSteps, durationMs }
 */
motionRouter.post("/projects/:id/synthesis/morph", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  if (!body.componentId) {
    res.status(400).json({ error: "componentId is required" });
    return;
  }
  const source = spec.components.find((c) => c.id === body.componentId);
  if (!source) {
    res.status(404).json({ error: "component not found" });
    return;
  }
  const result = morphToPattern({
    sourceSpec: spec,
    targetPattern: body.pattern as GenerativePattern,
    morphSteps: body.morphSteps ?? body.steps ?? 3,
    durationMs: body.durationMs ?? source.durationMs,
    projectId: req.params.id,
  });
  res.json(result);
});

// ---------------------------------------------------------------------------
// Motion Storytelling
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/storytelling/genres — list all story genres.
 */
motionRouter.get("/motion/storytelling/genres", (_req, res) => {
  res.json({ genres: listStoryGenres() });
});

/**
 * POST /api/projects/:id/storytelling/arc — create a story arc.
 * Body: { genre, totalDurationMs? }
 */
motionRouter.post("/projects/:id/storytelling/arc", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  if (!body.genre) {
    res.status(400).json({ error: "genre is required" });
    return;
  }
  const totalDurationMs =
    body.totalDurationMs ??
    (spec.components.reduce((max, c) => Math.max(max, c.delayMs + c.durationMs), 0) || 5000);
  const arc = createStoryArc(body.genre as StoryGenre, totalDurationMs, spec.components);
  res.json(arc);
});

/**
 * GET /api/projects/:id/storytelling/pacing — analyze pacing of the project.
 * Query: ?genre=hero (default: hero)
 */
motionRouter.get("/projects/:id/storytelling/pacing", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const genre = (req.query.genre as string) ?? "hero";
  const totalDurationMs =
    spec.components.reduce((max, c) => Math.max(max, c.delayMs + c.durationMs), 0) || 5000;
  const arc = createStoryArc(genre as StoryGenre, totalDurationMs, spec.components);
  const pacing = analyzePacing(arc);
  const transitions = generateTransitions(arc);
  const assignments = assignComponentsToBeats(arc, spec.components);
  res.json({ arc, pacing, transitions, assignments });
});

/**
 * POST /api/projects/:id/storytelling/plan — create and apply a storytelling
 * plan. Body: { genre, totalDurationMs? }
 */
motionRouter.post("/projects/:id/storytelling/plan", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  if (!body.genre) {
    res.status(400).json({ error: "genre is required" });
    return;
  }
  const totalDurationMs =
    body.totalDurationMs ??
    (spec.components.reduce((max, c) => Math.max(max, c.delayMs + c.durationMs), 0) || 5000);
  const plan = createStorytellingPlan(body.genre as StoryGenre, totalDurationMs, spec.components);
  const applied = applyStorytellingPlan(spec, plan);
  res.json({ plan, applied });
});
