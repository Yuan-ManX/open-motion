import { Router } from "express";
import { getProjectSpec } from "../../db/repositories/projects.js";
import { analyzeMood, listMoods } from "../../motion/moodEngine.js";
import { suggestCreative, suggestStyleTransfer } from "../../motion/creativeEngine.js";
import { analyzeMotion } from "../../motion/analysis.js";
import { analyzeRestraint } from "../../motion/restraint.js";
import { predictIntent, formatTelepathyReport } from "../../agent/motionTelepathy.js";
import { forecast, formatProphecyReport, listDesignEras } from "../../agent/motionProphecy.js";
import { genesis, formatGenesisReport, listGenesisKinds, type GenesisKind } from "../../agent/motionGenesis.js";
import { analyzeSymbiosis, formatSymbiosisReport } from "../../agent/motionSymbiosis.js";
import { reflect, formatConsciousnessReport } from "../../agent/motionConsciousness.js";
import { decide, formatVolitionReport, listVolitionModes } from "../../agent/motionVolition.js";
import { translateLexicon, formatLexiconReport, listMotionTokens, listMotionCategories } from "../../agent/motionLexicon.js";
import { createComponent } from "../../db/repositories/components.js";
import { createId, now } from "../../utils/id.js";

export const insightsRouter = Router();

/**
 * GET /api/projects/:id/insights — aggregate motion analytics for a project.
 * Returns mood analysis, complexity score, diversity index, quality insights,
 * restraint score, timing distribution, and creative recommendations.
 */
insightsRouter.get("/projects/:id/insights", (_req, res) => {
  const projectId = _req.params.id;
  const spec = getProjectSpec(projectId);

  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  const mood = analyzeMood(spec);
  const quality = analyzeMotion(spec);
  const restraint = analyzeRestraint(spec);
  const creative = suggestCreative(spec, { surprise: true });
  const transfer = suggestStyleTransfer(spec);

  const suggestions = transfer ? [transfer, ...creative.suggestions] : creative.suggestions;

  const easingDistribution: Record<string, number> = {};
  for (const c of spec.components) {
    const fam = c.easing.type === "preset" ? c.easing.name : c.easing.type;
    easingDistribution[fam] = (easingDistribution[fam] ?? 0) + 1;
  }

  const durationBuckets = { fast: 0, normal: 0, slow: 0 };
  for (const c of spec.components) {
    if (c.durationMs < 500) durationBuckets.fast++;
    else if (c.durationMs <= 1500) durationBuckets.normal++;
    else durationBuckets.slow++;
  }

  const propertySet = new Set<string>();
  for (const c of spec.components) {
    for (const kf of c.keyframes) {
      for (const key of Object.keys(kf.properties)) propertySet.add(key);
    }
  }

  const complexityScore = Math.min(
    100,
    Math.round(
      spec.components.length * 5 +
      propertySet.size * 8 +
      Object.keys(easingDistribution).length * 6 +
      (spec.components.filter((c) => c.iterationCount === "infinite").length * 4),
    ),
  );

  res.json({
    mood,
    quality: {
      score: quality.score,
      insights: quality.insights,
      componentCount: quality.componentCount,
    },
    restraint: {
      score: restraint.score,
      warnings: restraint.warnings ?? [],
    },
    creative: {
      suggestions: suggestions.slice(0, 8),
      diversityIndex: creative.diversityIndex,
      projectFingerprint: creative.projectFingerprint,
    },
    timing: {
      easingDistribution,
      durationBuckets,
      totalDurationMs: spec.components.reduce(
        (max, c) => Math.max(max, c.delayMs + c.durationMs * (c.iterationCount === "infinite" ? 1 : Number(c.iterationCount) || 1)),
        0,
      ),
    },
    complexity: {
      score: complexityScore,
      componentCount: spec.components.length,
      propertyCount: propertySet.size,
      easingVariety: Object.keys(easingDistribution).length,
      loopCount: spec.components.filter((c) => c.iterationCount === "infinite").length,
    },
    availableMoods: listMoods(),
  });
});

/**
 * GET /api/projects/:id/prophecy — forecast the motion design trajectory.
 * Returns the current design era, predicted next eras with probabilities,
 * avant-garde proposals, and a novelty score.
 */
insightsRouter.get("/projects/:id/prophecy", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const report = forecast(spec);
  res.json({
    ...report,
    formatted: formatProphecyReport(report),
  });
});

/**
 * GET /api/design-eras — list all available design eras.
 */
insightsRouter.get("/design-eras", (_req, res) => {
  res.json({ eras: listDesignEras() });
});

/**
 * POST /api/predict-intent — predict user intent from partial input.
 * Body: { partial: string, projectId?: string, topK?: number }
 */
insightsRouter.post("/predict-intent", (req, res) => {
  const partial = String(req.body?.partial ?? "");
  const topK = Number(req.body?.topK ?? 5);
  let spec = null;
  if (req.body?.projectId) {
    try {
      spec = getProjectSpec(String(req.body.projectId));
    } catch {
      // Spec is optional.
    }
  }
  const report = predictIntent(partial, spec, topK);
  res.json({
    ...report,
    formatted: formatTelepathyReport(report),
  });
});

/**
 * GET /api/genesis-kinds — list all available mathematical genesis generators.
 */
insightsRouter.get("/genesis-kinds", (_req, res) => {
  res.json({ kinds: listGenesisKinds() });
});

/**
 * POST /api/projects/:id/genesis — generate original motion from mathematics.
 * Body: { kind: GenesisKind, samples?, durationMs?, a?, b?, amplitude?, damping?, omega? }
 */
insightsRouter.post("/projects/:id/genesis", (req, res) => {
  const projectId = req.params.id;
  // Verify the project exists.
  const spec = getProjectSpec(projectId);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const kind = String(req.body?.kind) as GenesisKind;
  const validKinds: GenesisKind[] = [
    "lissajous",
    "goldenSpiral",
    "waveInterference",
    "dampedOscillator",
    "phyllotaxis",
    "lorenzAttractor",
  ];
  if (!validKinds.includes(kind)) {
    res.status(400).json({ error: `invalid kind: ${kind}`, validKinds });
    return;
  }
  const result = genesis(kind, {
    samples: req.body?.samples != null ? Number(req.body.samples) : undefined,
    durationMs: req.body?.durationMs != null ? Number(req.body.durationMs) : undefined,
    a: req.body?.a != null ? Number(req.body.a) : undefined,
    b: req.body?.b != null ? Number(req.body.b) : undefined,
    amplitude: req.body?.amplitude != null ? Number(req.body.amplitude) : undefined,
    damping: req.body?.damping != null ? Number(req.body.damping) : undefined,
    omega: req.body?.omega != null ? Number(req.body.omega) : undefined,
  });
  // Persist each draft as a real component.
  const ts = now();
  const createdIds: string[] = [];
  for (const d of result.components) {
    const id = createId("c_");
    createComponent({
      ...d,
      id,
      projectId,
      createdAt: ts,
      updatedAt: ts,
    });
    createdIds.push(id);
  }
  res.json({
    ok: true,
    kind: result.kind,
    description: result.description,
    componentIds: createdIds,
    count: createdIds.length,
    summary: result.summary,
    formatted: formatGenesisReport(result),
  });
});

/**
 * POST /api/symbiosis — analyze the ecological relationship between two
 * compositions and breed a hybrid offspring.
 * Body: { projectIdA: string, projectIdB: string, persistOffspring?: boolean }
 */
insightsRouter.post("/symbiosis", (req, res) => {
  const projectIdA = String(req.body?.projectIdA ?? "");
  const projectIdB = String(req.body?.projectIdB ?? "");
  if (!projectIdA || !projectIdB) {
    res.status(400).json({ error: "projectIdA and projectIdB are required" });
    return;
  }
  if (projectIdA === projectIdB) {
    res.status(400).json({ error: "symbiosis requires two distinct project ids" });
    return;
  }
  const specA = getProjectSpec(projectIdA);
  if (!specA) {
    res.status(404).json({ error: `project ${projectIdA} not found` });
    return;
  }
  const specB = getProjectSpec(projectIdB);
  if (!specB) {
    res.status(404).json({ error: `project ${projectIdB} not found` });
    return;
  }
  const persistOffspring = Boolean(req.body?.persistOffspring);
  const report = analyzeSymbiosis(specA, specB);
  const persistedIds: string[] = [];
  if (persistOffspring) {
    const ts = now();
    for (const child of report.offspring) {
      const id = createId("c_");
      createComponent({
        ...child.draft,
        id,
        projectId: projectIdA,
        createdAt: ts,
        updatedAt: ts,
      });
      persistedIds.push(id);
    }
  }
  // Convert Set fields to arrays so the report serializes to JSON cleanly.
  const serializable = {
    ...report,
    genomeA: { ...report.genomeA, propertySet: [...report.genomeA.propertySet], easingSet: [...report.genomeA.easingSet] },
    genomeB: { ...report.genomeB, propertySet: [...report.genomeB.propertySet], easingSet: [...report.genomeB.easingSet] },
  };
  res.json({
    ...serializable,
    persistedComponentIds: persistedIds,
    persisted: persistOffspring,
    formatted: formatSymbiosisReport(report),
  });
});

/**
 * GET /api/projects/:id/consciousness — meta-cognitive self-reflection.
 * Returns self-beliefs, counter-questions, cognitive biases, a
 * stream-of-consciousness monologue, and a metacognitive awareness score.
 */
insightsRouter.get("/projects/:id/consciousness", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const report = reflect(spec);
  res.json({
    ...report,
    formatted: formatConsciousnessReport(report),
  });
});

/**
 * GET /api/volition-modes — list the canonical volition modes.
 */
insightsRouter.get("/volition-modes", (_req, res) => {
  res.json({ modes: listVolitionModes() });
});

/**
 * POST /api/volition — decide whether the agent should act, ask, defer, or refine.
 * Body: { partial: string, projectId?: string, consecutiveAsks?: number, repeatedKeyword?: boolean }
 */
insightsRouter.post("/volition", (req, res) => {
  const partial = String(req.body?.partial ?? "");
  let spec = null;
  if (req.body?.projectId) {
    try {
      spec = getProjectSpec(String(req.body.projectId));
    } catch {
      // Spec is optional.
    }
  }
  const history = {
    consecutiveAsks: req.body?.consecutiveAsks != null ? Number(req.body.consecutiveAsks) : 0,
    repeatedKeyword: Boolean(req.body?.repeatedKeyword),
  };
  const report = decide(partial, spec, history);
  res.json({
    ...report,
    formatted: formatVolitionReport(report),
  });
});

/**
 * GET /api/lexicon/tokens — list all duration and easing tokens.
 */
insightsRouter.get("/lexicon/tokens", (_req, res) => {
  res.json(listMotionTokens());
});

/**
 * GET /api/lexicon/categories — list all eleven motion categories.
 */
insightsRouter.get("/lexicon/categories", (_req, res) => {
  res.json({ categories: listMotionCategories() });
});

/**
 * POST /api/lexicon/translate — translate a natural-language intent into motion tokens.
 * Body: { input: string, projectId?: string }
 */
insightsRouter.post("/lexicon/translate", (req, res) => {
  const input = String(req.body?.input ?? "");
  const report = translateLexicon(input);
  res.json({
    ...report,
    formatted: formatLexiconReport(report),
  });
});
