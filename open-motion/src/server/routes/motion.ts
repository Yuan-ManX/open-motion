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
import {
  listArcTemplates,
  planSequence,
  optimizeTransitions,
  summarizeSequence,
  type NarrativeArcId,
} from "../../motion/motionSequencePlanner.js";
import {
  listThemes,
  getTheme,
  applyTheme,
  analyzeThemeCompatibility,
  type MotionPersonality,
} from "../../motion/motionThemeSystem.js";
import {
  listRhythmPatterns,
  getRhythmPatternsByCategory,
  computeRhythmTiming,
  applyRhythmToItems,
  visualizeRhythm,
  type RhythmId,
} from "../../motion/rhythmPatterns.js";
import { generateVariants, compareVariants, summarizeVariants } from "../../motion/motionVariantGenerator.js";
import { evolveMotion, listEvolutionStrategies, getEvolutionConfig } from "../../agent/motionEvolution.js";
import { predictPerception } from "../../agent/motionPerception.js";
import {
  listSemanticConcepts,
  inferIntent,
  blendConcepts,
} from "../../agent/motionSemantics.js";
import {
  simulateSpring,
  simulateGravityDrop,
  simulateProjectile,
  simulateFriction,
  simulatePendulum,
  listPhysicsPresets,
  listPhysicsTypes,
  runPreset,
  type SpringConfig,
  type GravityDropConfig,
  type ProjectileConfig,
  type FrictionConfig,
  type PendulumConfig,
} from "../../agent/motionPhysics.js";
import {
  generatePathMotion,
  listPathPresets,
  listPathTypes,
  runPathPreset,
  type PathConfig,
} from "../../agent/motionPath.js";
import {
  encodeMotion,
  listCodecFormats,
  type CodecFormat,
} from "../../agent/motionCodec.js";
import {
  extractStyleDNA,
  transferStyle as transferMotionStyle,
  blendStyles,
  describeStyle,
  compareStyles,
  listStyleArchetypes,
  applyArchetype,
} from "../../agent/motionStyleTransfer.js";
import { getStylePreset, applyStylePresetToComponents } from "../../motion/stylePresets.js";
import {
  buildKnowledgeGraph,
  queryConcept,
  findRelated,
  findPath,
  searchConcepts,
  suggestConnections,
  recommendNext,
  analyzeGraph,
} from "../../agent/motionKnowledgeGraph.js";
import {
  runAllTests,
  runTestsByCategory,
  runTestSuite,
  listTestSuites,
} from "../../agent/motionTesting.js";
import {
  synthesizeFromEmotion,
  detectEmotionFromMotion,
  blendEmotions,
  planEmotionJourney,
  listEmotions,
  getEmotion,
  formatEmotionReport,
  formatDetectionReport,
  formatBlendReport,
  formatJourneyReport,
} from "../../agent/motionEmotion.js";
import {
  recordMotionObservation,
  getProjectTasteProfile,
  recommendForProject,
  formatTasteProfile,
  formatRecommendation,
} from "../../agent/motionAdaptive.js";
import {
  computeContextAdjustments,
  adaptComponentForContext,
  autoDetectContext,
  listContextOptions,
  detectTimeOfDay,
  formatContextReport,
  formatAdaptationReport,
} from "../../agent/motionContext.js";
import {
  planCollaboration,
  executeCollaboration,
  listCollaborationModules,
  collaborate,
  formatCollaborationPlan,
  formatCollaborationResult,
} from "../../agent/motionCollaboration.js";
import {
  analyzeResonance,
  tuneForResonance,
  defaultViewerState,
  formatResonanceReport,
  type ViewerState,
} from "../../agent/motionResonance.js";
import {
  translateSpec as translateSynesthesia,
  mapSensoryToMotion,
  formatSynestheticReport,
} from "../../agent/motionSynesthesia.js";
import {
  dreamFromPrompt,
  generateDreamSequence,
  listDreamConcepts,
  formatDreamReport,
  formatDreamSequenceReport,
} from "../../agent/motionDream.js";
import {
  analyzeHarmonics,
  findHarmonics as findHarmonicsForComponent,
  formatHarmonicsReport,
} from "../../agent/motionHarmonics.js";
import {
  analyzeEntropy,
  identifyInformationHotspots,
  formatEntropyReport,
} from "../../agent/motionEntropy.js";
import {
  analyzeCognitiveLoad,
  formatCognitionReport,
} from "../../agent/motionCognition.js";
import {
  analyzeTopology,
  findTemporalPath,
  formatTopologyReport,
} from "../../agent/motionTopology.js";
import {
  analyzePoetics,
  formatPoeticsReport,
} from "../../agent/motionPoetics.js";
import {
  analyzeEcosystem,
  formatEcosystemReport,
} from "../../agent/motionEcology.js";
import {
  analyzeCalligraphy,
  formatCalligraphyReport,
} from "../../agent/motionCalligraphy.js";
import {
  analyzeMythology,
  formatMythologyReport,
} from "../../agent/motionMythology.js";
import {
  analyzeWeather,
  formatWeatherReport,
} from "../../agent/motionWeather.js";
import {
  analyzeAlchemy,
  formatAlchemyReport,
} from "../../agent/motionAlchemy.js";
import {
  analyzeArchitecture,
  formatArchitectureReport,
} from "../../agent/motionArchitecture.js";
import {
  analyzeCartography,
  formatCartographyReport,
} from "../../agent/motionCartography.js";
import {
  analyzeGenealogy,
  formatGenealogyReport,
} from "../../agent/motionGenealogy.js";
import {
  analyzeAstronomy,
  formatAstronomyReport,
} from "../../agent/motionAstronomy.js";
import {
  analyzeChemistry,
  formatChemistryReport,
} from "../../agent/motionChemistry.js";
import {
  analyzeMusicology,
  formatMusicologyReport,
} from "../../agent/motionMusicology.js";
import {
  analyzeBotany,
  formatBotanyReport,
} from "../../agent/motionBotany.js";
import {
  analyzeGeology,
  formatGeologyReport,
} from "../../agent/motionGeology.js";
import {
  analyzePhysics,
  formatPhysicsReport,
} from "../../agent/motionPhysics.js";
import {
  analyzeLinguistics,
  formatLinguisticsReport,
} from "../../agent/motionLinguistics.js";
import {
  analyzeCinema,
  formatCinemaReport,
} from "../../agent/motionCinema.js";
import {
  predictChronopath,
  formatChronopathReport,
} from "../../agent/motionChronopath.js";
import { analyzeCreativeContext } from "../../agent/motionCreativeContext.js";
import { patchComponent } from "../../db/repositories/components.js";

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

// ---------------------------------------------------------------------------
// Narrative Sequence Planning
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/narrative-arcs — list all available narrative arc templates.
 * Returns arc id, name, description, default scene count, and tone progression.
 */
motionRouter.get("/motion/narrative-arcs", (_req, res) => {
  const arcs = listArcTemplates();
  res.json({
    arcs: arcs.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      defaultSceneCount: a.defaultSceneCount,
      toneProgression: a.toneProgression,
    })),
    count: arcs.length,
  });
});

/**
 * POST /api/projects/:id/sequence/plan — plan a multi-scene motion sequence.
 * Body: { description, arc?, totalDurationMs?, sceneCount?, fps?, optimize? }
 * Returns the planned sequence with scenes, timeline, emotional arc, and pacing.
 */
motionRouter.post("/projects/:id/sequence/plan", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  if (!body.description) {
    res.status(400).json({ error: "description is required" });
    return;
  }
  const sequence = planSequence({
    description: body.description,
    arc: body.arc as NarrativeArcId | undefined,
    totalDurationMs: body.totalDurationMs,
    sceneCount: body.sceneCount,
    fps: body.fps,
    baseSpec: spec,
  });
  const optimized = body.optimize !== false ? optimizeTransitions(sequence) : sequence;
  res.json({
    sequence: optimized,
    summary: summarizeSequence(optimized),
  });
});

// ---------------------------------------------------------------------------
// Motion Themes
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/themes — list all motion themes.
 * Query: ?personality=precision
 */
motionRouter.get("/motion/themes", (req, res) => {
  const personality = typeof req.query.personality === "string"
    ? (req.query.personality as MotionPersonality)
    : undefined;
  const themes = personality ? listThemes().filter((t) => t.personality === personality) : listThemes();
  res.json({
    themes: themes.map((t) => ({
      id: t.id,
      name: t.name,
      personality: t.personality,
      description: t.description,
      tags: t.tags,
      easingFamily: {
        standard: t.easingFamily.standard.type === "preset" ? t.easingFamily.standard.name : "bezier",
        spring: t.easingFamily.spring,
      },
      timingScale: t.timingScale,
      vocabulary: t.vocabulary,
    })),
    count: themes.length,
  });
});

/**
 * POST /api/projects/:id/theme/apply — apply a motion theme to a project.
 * Body: { themeId, apply? }
 * Returns the themed spec (if applied) or compatibility analysis (if previewed).
 */
motionRouter.post("/projects/:id/theme/apply", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  if (!body.themeId) {
    res.status(400).json({ error: "themeId is required" });
    return;
  }
  const theme = getTheme(body.themeId);
  if (!theme) {
    res.status(404).json({ error: "theme not found" });
    return;
  }
  if (spec.components.length === 0) {
    res.status(400).json({ error: "no components to theme — add content first" });
    return;
  }
  const compatibility = analyzeThemeCompatibility(spec, theme);
  const apply = body.apply === true;
  if (apply) {
    const themed = applyTheme(spec, theme);
    for (const comp of themed.components) {
      patchComponent(req.params.id, comp.id, {
        easing: comp.easing,
        durationMs: comp.durationMs,
        delayMs: comp.delayMs,
      });
    }
  }
  res.json({
    themeId: theme.id,
    themeName: theme.name,
    personality: theme.personality,
    applied: apply,
    compatibility,
  });
});

/**
 * POST /api/projects/:id/style/apply — apply a named style preset to every
 * component in a project. Style presets bundle an easing family, duration,
 * loop behavior, and direction into one coherent aesthetic; applying them
 * overrides the per-component timing/easing so the whole composition shares
 * one feel. Component identity (name, selector, keyframes, trigger) is kept.
 * Body: { presetId, apply? }
 */
motionRouter.post("/projects/:id/style/apply", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  if (!body.presetId) {
    res.status(400).json({ error: "presetId is required" });
    return;
  }
  const preset = getStylePreset(body.presetId);
  if (!preset) {
    res.status(404).json({ error: "style preset not found" });
    return;
  }
  if (spec.components.length === 0) {
    res.status(400).json({ error: "no components to style — add content first" });
    return;
  }
  const apply = body.apply === true;
  if (apply) {
    const patches = applyStylePresetToComponents(preset, spec.components);
    for (let i = 0; i < spec.components.length; i++) {
      patchComponent(req.params.id, spec.components[i].id, patches[i]);
    }
  }
  res.json({
    presetId: preset.id,
    presetName: preset.name,
    applied: apply,
    componentCount: spec.components.length,
  });
});

// ---------------------------------------------------------------------------
// Rhythm Patterns
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/rhythms — list all rhythm patterns.
 * Query: ?category=steady
 */
motionRouter.get("/motion/rhythms", (req, res) => {
  const category = typeof req.query.category === "string" ? (req.query.category as never) : undefined;
  const patterns = category ? getRhythmPatternsByCategory(category) : listRhythmPatterns();
  res.json({
    patterns: patterns.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      bpm: p.bpm,
      timeSignature: `${p.beatsPerMeasure}/${p.beatValue}`,
      beatMultipliers: p.beatMultipliers,
      accents: p.accents,
      tags: p.tags,
    })),
    count: patterns.length,
  });
});

/**
 * POST /api/motion/rhythms/apply — apply a rhythm pattern to generate delays.
 * Body: { patternId, itemCount, bpm?, scale? }
 * Returns beat times, accents, delays, and a text visualization.
 */
motionRouter.post("/motion/rhythms/apply", (req, res) => {
  const body = req.body ?? {};
  if (!body.patternId || typeof body.itemCount !== "number" || body.itemCount <= 0) {
    res.status(400).json({ error: "patternId and itemCount (positive) are required" });
    return;
  }
  const patternId = body.patternId as RhythmId;
  const result = applyRhythmToItems(patternId, body.itemCount, {
    bpm: body.bpm,
    scale: body.scale,
  });
  const timing = computeRhythmTiming(patternId, {
    beatCount: body.itemCount,
    bpm: body.bpm,
    scale: body.scale,
  });
  const visualization = visualizeRhythm(timing);
  res.json({
    patternId,
    delays: result.delays,
    accents: result.accents,
    totalMs: result.totalMs,
    bpm: timing.bpm,
    beatTimes: timing.beatTimes,
    beatAccents: timing.beatAccents,
    visualization,
  });
});

// ---------------------------------------------------------------------------
// Motion Variants
// ---------------------------------------------------------------------------

/**
 * POST /api/projects/:id/variants — generate A/B motion variants.
 * Body: { count?, strategies?, seed? }
 * Returns multiple variants exploring different design directions.
 */
motionRouter.post("/projects/:id/variants", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  if (spec.components.length === 0) {
    res.status(400).json({ error: "no components to generate variants from" });
    return;
  }
  const body = req.body ?? {};
  const variants = generateVariants(spec, {
    count: body.count ?? 4,
    strategies: body.strategies,
    seed: body.seed,
  });
  if (variants.length < 2) {
    res.status(500).json({ error: "could not generate enough variants" });
    return;
  }
  const comparison = compareVariants(variants[0], variants[1]);
  const summary = summarizeVariants(variants);
  res.json({
    variants: variants.map((v) => ({
      id: v.id,
      name: v.name,
      strategy: v.strategy,
      changes: v.changes,
      spec: v.spec,
    })),
    count: variants.length,
    comparison,
    summary,
  });
});

// ---------------------------------------------------------------------------
// Motion Evolution
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/evolution/strategies — list all evolution strategies.
 * Returns strategy id, name, and description.
 */
motionRouter.get("/motion/evolution/strategies", (_req, res) => {
  const strategies = listEvolutionStrategies();
  res.json({ strategies, count: strategies.length });
});

/**
 * POST /api/projects/:id/evolve — evolve a motion spec across generations.
 * Body: { strategy?, generations?, populationSize?, mutationRate?, apply? }
 * Returns the best individual, evolution history, and improvement score.
 */
motionRouter.post("/projects/:id/evolve", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  if (spec.components.length === 0) {
    res.status(400).json({ error: "no components to evolve — add content first" });
    return;
  }
  const body = req.body ?? {};
  const strategyId = typeof body.strategy === "string" ? body.strategy : "balanced";
  const config = getEvolutionConfig(strategyId);
  if (typeof body.generations === "number") config.generations = body.generations;
  if (typeof body.populationSize === "number") config.populationSize = body.populationSize;
  if (typeof body.mutationRate === "number") config.mutationRate = body.mutationRate;

  const result = evolveMotion(spec, config);
  const apply = body.apply === true && result.improvement > 0;

  if (apply) {
    for (const comp of result.best.spec.components) {
      patchComponent(req.params.id, comp.id, {
        easing: comp.easing,
        durationMs: comp.durationMs,
        delayMs: comp.delayMs,
        iterationCount: comp.iterationCount,
        direction: comp.direction,
      });
    }
  }

  res.json({
    best: {
      generation: result.best.generation,
      origin: result.best.origin,
      fitness: result.best.fitness,
    },
    history: result.history,
    improvement: result.improvement,
    applied: apply,
    summary: result.summary,
  });
});

// ---------------------------------------------------------------------------
// Motion Perception
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/perception — predict how viewers will cognitively
 * and emotionally respond to the motion composition.
 * Returns valence curve, arousal curve, cognitive load, attention retention,
 * memorability score, and brand perception forecast.
 */
motionRouter.get("/projects/:id/perception", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  if (spec.components.length === 0) {
    res.status(400).json({ error: "no components to analyze — add content first" });
    return;
  }
  const report = predictPerception(spec);
  res.json(report);
});

// ---------------------------------------------------------------------------
// Motion Chronopath — gaze trajectory prediction
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/chronopath — predict the viewer's gaze trajectory
 * through time. Returns gaze path, saccade segments, gaze collisions,
 * dead zones, optimal reveal ordering, and gaze efficiency score.
 */
motionRouter.get("/projects/:id/chronopath", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  if (spec.components.length === 0) {
    res.status(400).json({ error: "no components to analyze — add content first" });
    return;
  }
  const report = predictChronopath(spec);
  res.json({
    ...report,
    summary: formatChronopathReport(report),
  });
});

// ---------------------------------------------------------------------------
// Motion Creative Context — session-aware intelligence
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/creative-context — analyze the creative session
 * context. Returns design decisions, creative direction, detected patterns,
 * session statistics, and context-aware recommendations.
 */
motionRouter.get("/projects/:id/creative-context", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const report = analyzeCreativeContext(req.params.id, spec);
  res.json(report);
});

// ---------------------------------------------------------------------------
// Motion Semantics
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/semantic-concepts — list all semantic concepts that can be
 * mapped to motion parameters (trust, urgency, luxury, playful, etc.).
 * Query: ?category=emotion|brand|energy|aesthetic
 */
motionRouter.get("/motion/semantic-concepts", (req, res) => {
  const category = req.query.category as string | undefined;
  const all = listSemanticConcepts();
  const filtered = category ? all.filter((c) => c.category === category) : all;
  res.json({
    concepts: filtered.map((c) => ({
      id: c.id,
      label: c.label,
      category: c.category,
      description: c.description,
      keywords: c.keywords,
      profile: c.profile,
    })),
    count: filtered.length,
  });
});

/**
 * POST /api/motion/infer-intent — infer semantic intent from a natural
 * language description.
 * Body: { description }
 * Returns matched concepts, inferred emotion, and suggested motion profile.
 */
motionRouter.post("/motion/infer-intent", (req, res) => {
  const body = req.body ?? {};
  if (!body.description) {
    res.status(400).json({ error: "description is required" });
    return;
  }
  const intent = inferIntent(body.description);
  res.json(intent);
});

/**
 * POST /api/motion/blend-concepts — blend two semantic concepts into a
 * hybrid motion profile.
 * Body: { conceptA, conceptB, weightA? }
 */
motionRouter.post("/motion/blend-concepts", (req, res) => {
  const body = req.body ?? {};
  if (!body.conceptA || !body.conceptB) {
    res.status(400).json({ error: "both conceptA and conceptB are required" });
    return;
  }
  const weightA = typeof body.weightA === "number" ? body.weightA : 0.5;
  try {
    const blend = blendConcepts(body.conceptA, body.conceptB, weightA);
    res.json(blend);
  } catch {
    res.status(404).json({ error: "unknown concept id — use GET /motion/semantic-concepts to list available options" });
  }
});

// ---------------------------------------------------------------------------
// Motion Physics
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/physics/types — list all physics simulation types.
 */
motionRouter.get("/motion/physics/types", (_req, res) => {
  res.json({ types: listPhysicsTypes() });
});

/**
 * GET /api/motion/physics/presets — list all physics presets.
 */
motionRouter.get("/motion/physics/presets", (_req, res) => {
  res.json({ presets: listPhysicsPresets() });
});

/**
 * POST /api/motion/physics/simulate — run a physics simulation and return
 * the generated motion component with sampled keyframes.
 * Body: { type, config? }
 */
motionRouter.post("/motion/physics/simulate", (req, res) => {
  const body = req.body ?? {};
  if (!body.type) {
    res.status(400).json({ error: "type is required (spring, gravity, projectile, friction, pendulum)" });
    return;
  }
  const config = typeof body.config === "object" && body.config !== null ? body.config : {};
  let result;
  switch (body.type) {
    case "spring": result = simulateSpring(config as Partial<SpringConfig>); break;
    case "gravity": result = simulateGravityDrop(config as Partial<GravityDropConfig>); break;
    case "projectile": result = simulateProjectile(config as Partial<ProjectileConfig>); break;
    case "friction": result = simulateFriction(config as Partial<FrictionConfig>); break;
    case "pendulum": result = simulatePendulum(config as Partial<PendulumConfig>); break;
    default:
      res.status(400).json({ error: `unknown type: ${body.type}` });
      return;
  }
  res.json(result);
});

/**
 * POST /api/motion/physics/preset/:presetId — run a named preset and return
 * the generated motion component.
 */
motionRouter.post("/motion/physics/preset/:presetId", (req, res) => {
  const result = runPreset(req.params.presetId);
  if (!result) {
    res.status(404).json({ error: `unknown preset: ${req.params.presetId}` });
    return;
  }
  res.json(result);
});

// ---------------------------------------------------------------------------
// Motion Path
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/path/types — list all path types.
 */
motionRouter.get("/motion/path/types", (_req, res) => {
  res.json({ types: listPathTypes() });
});

/**
 * GET /api/motion/path/presets — list all path presets.
 */
motionRouter.get("/motion/path/presets", (_req, res) => {
  res.json({ presets: listPathPresets() });
});

/**
 * POST /api/motion/path/generate — generate motion along a path.
 * Body: { type, durationMs?, samples?, scale?, loop? }
 */
motionRouter.post("/motion/path/generate", (req, res) => {
  const body = req.body ?? {};
  if (!body.type) {
    res.status(400).json({ error: "type is required (bezier, lissajous, spiral, figure-eight, heart, circle, svg-path)" });
    return;
  }
  const result = generatePathMotion(body as Partial<PathConfig>);
  res.json(result);
});

/**
 * POST /api/motion/path/preset/:presetId — run a named path preset.
 */
motionRouter.post("/motion/path/preset/:presetId", (req, res) => {
  const result = runPathPreset(req.params.presetId);
  if (!result) {
    res.status(404).json({ error: `unknown preset: ${req.params.presetId}` });
    return;
  }
  res.json(result);
});

// ---------------------------------------------------------------------------
// Motion Codec
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/codec/formats — list all codec formats.
 */
motionRouter.get("/motion/codec/formats", (_req, res) => {
  res.json({ formats: listCodecFormats() });
});

/**
 * POST /api/projects/:id/encode — encode a project's motion to a standard format.
 * Body: { format, minify? }
 * Returns the encoded output, MIME type, and file extension.
 */
motionRouter.post("/projects/:id/encode", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  if (!body.format) {
    res.status(400).json({ error: "format is required (lottie, css, waapi, smil, gsap, react-spring)" });
    return;
  }
  const format = body.format as CodecFormat;
  const minify = body.minify === true;
  const result = encodeMotion(spec, format, { minify });
  res.json(result);
});

// ---------------------------------------------------------------------------
// Motion Style Transfer
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/style/archetypes — list all curated style archetypes.
 */
motionRouter.get("/motion/style/archetypes", (_req, res) => {
  const archetypes = listStyleArchetypes();
  res.json({ archetypes, count: archetypes.length });
});

/**
 * GET /api/projects/:id/style/dna — extract the style DNA of a project.
 * The DNA captures easing, tempo, energy, axes, color, complexity, iteration,
 * and staging — independent of the project's concrete component structure.
 */
motionRouter.get("/projects/:id/style/dna", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const dna = extractStyleDNA(spec);
  res.json({ dna });
});

/**
 * GET /api/projects/:id/style/description — produce a human-readable
 * description of the project's motion style.
 */
motionRouter.get("/projects/:id/style/description", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const dna = extractStyleDNA(spec);
  const description = describeStyle(dna);
  res.json({ description, dna });
});

/**
 * POST /api/projects/:id/style/transfer — transfer the style of another
 * project onto this project's structure. The target's components, ids, and
 * names are preserved while the surface expression is rewritten from source.
 * Body: { sourceProjectId, easingStrength?, tempoStrength?, energyStrength?, colorStrength? }
 */
motionRouter.post("/projects/:id/style/transfer", (req, res) => {
  const targetSpec = getProjectSpec(req.params.id);
  if (!targetSpec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  if (!body.sourceProjectId) {
    res.status(400).json({ error: "sourceProjectId is required" });
    return;
  }
  const sourceSpec = getProjectSpec(body.sourceProjectId);
  if (!sourceSpec) {
    res.status(404).json({ error: "source project not found" });
    return;
  }
  if (targetSpec.components.length === 0) {
    res.status(400).json({ error: "no components to style — add content first" });
    return;
  }
  const options: {
    easingStrength?: number;
    tempoStrength?: number;
    energyStrength?: number;
    colorStrength?: number;
  } = {};
  if (typeof body.easingStrength === "number") options.easingStrength = body.easingStrength;
  if (typeof body.tempoStrength === "number") options.tempoStrength = body.tempoStrength;
  if (typeof body.energyStrength === "number") options.energyStrength = body.energyStrength;
  if (typeof body.colorStrength === "number") options.colorStrength = body.colorStrength;
  const result = transferMotionStyle(sourceSpec, targetSpec, options);
  for (const comp of result.components) {
    patchComponent(req.params.id, comp.id, {
      easing: comp.easing,
      durationMs: comp.durationMs,
      delayMs: comp.delayMs,
    });
  }
  res.json({ spec: result, dna: extractStyleDNA(result) });
});

/**
 * POST /api/projects/:id/style/blend — blend the styles of two projects by a
 * ratio (0 = projectA, 1 = projectB). Returns the synthesized DNA and a
 * human-readable description.
 * Body: { projectIdA, projectIdB, ratio }
 */
motionRouter.post("/projects/:id/style/blend", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  if (!body.projectIdA || !body.projectIdB) {
    res.status(400).json({ error: "projectIdA and projectIdB are required" });
    return;
  }
  if (typeof body.ratio !== "number") {
    res.status(400).json({ error: "ratio (number 0..1) is required" });
    return;
  }
  const specA = getProjectSpec(body.projectIdA);
  if (!specA) {
    res.status(404).json({ error: "projectIdA not found" });
    return;
  }
  const specB = getProjectSpec(body.projectIdB);
  if (!specB) {
    res.status(404).json({ error: "projectIdB not found" });
    return;
  }
  const dna = blendStyles(specA, specB, body.ratio);
  res.json({ dna, description: describeStyle(dna) });
});

/**
 * GET /api/projects/:idA/style/compare/:idB — compare the styles of two
 * projects and return per-dimension similarity plus an overall score.
 */
motionRouter.get("/projects/:idA/style/compare/:idB", (req, res) => {
  const specA = getProjectSpec(req.params.idA);
  if (!specA) {
    res.status(404).json({ error: "project A not found" });
    return;
  }
  const specB = getProjectSpec(req.params.idB);
  if (!specB) {
    res.status(404).json({ error: "project B not found" });
    return;
  }
  const comparison = compareStyles(extractStyleDNA(specA), extractStyleDNA(specB));
  res.json(comparison);
});

/**
 * POST /api/projects/:id/style/archetype — apply a named style archetype to a
 * project. The spec's structure is preserved while its surface expression
 * adopts the archetype's style.
 * Body: { archetypeId }
 */
motionRouter.post("/projects/:id/style/archetype", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const body = req.body ?? {};
  if (!body.archetypeId) {
    res.status(400).json({ error: "archetypeId is required" });
    return;
  }
  if (spec.components.length === 0) {
    res.status(400).json({ error: "no components to style — add content first" });
    return;
  }
  const exists = listStyleArchetypes().some((a) => a.id === body.archetypeId);
  if (!exists) {
    res.status(404).json({ error: `unknown archetype: ${body.archetypeId}` });
    return;
  }
  const result = applyArchetype(body.archetypeId, spec);
  for (const comp of result.components) {
    patchComponent(req.params.id, comp.id, {
      easing: comp.easing,
      durationMs: comp.durationMs,
      delayMs: comp.delayMs,
    });
  }
  res.json({ spec: result, dna: extractStyleDNA(result) });
});

// ---------------------------------------------------------------------------
// Motion Knowledge Graph
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/knowledge-graph — build and return the complete motion
 * knowledge graph (concept nodes and relationship edges).
 */
motionRouter.get("/motion/knowledge-graph", (_req, res) => {
  const graph = buildKnowledgeGraph();
  res.json(graph);
});

/**
 * GET /api/motion/knowledge-graph/concept/:conceptId — look up a single
 * concept node by id.
 */
motionRouter.get("/motion/knowledge-graph/concept/:conceptId", (req, res) => {
  const graph = buildKnowledgeGraph();
  const concept = queryConcept(graph, req.params.conceptId);
  if (!concept) {
    res.status(404).json({ error: `concept not found: ${req.params.conceptId}` });
    return;
  }
  res.json(concept);
});

/**
 * GET /api/motion/knowledge-graph/related/:conceptId — find concepts directly
 * related to the given concept, optionally filtered by relationship.
 * Query: ?relationship=...
 */
motionRouter.get("/motion/knowledge-graph/related/:conceptId", (req, res) => {
  const graph = buildKnowledgeGraph();
  const relationship = typeof req.query.relationship === "string"
    ? (req.query.relationship as never)
    : undefined;
  const related = findRelated(graph, req.params.conceptId, relationship);
  res.json({ conceptId: req.params.conceptId, related, count: related.length });
});

/**
 * GET /api/motion/knowledge-graph/path — find the shortest path between two
 * concepts. Query: ?from=...&to=...
 */
motionRouter.get("/motion/knowledge-graph/path", (req, res) => {
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  if (!from || !to) {
    res.status(400).json({ error: "query params 'from' and 'to' are required" });
    return;
  }
  const graph = buildKnowledgeGraph();
  const path = findPath(graph, from, to);
  res.json({ from, to, path, length: path.length });
});

/**
 * GET /api/motion/knowledge-graph/search — search concepts by keyword across
 * id, label, description, category, and tags. Query: ?q=...
 */
motionRouter.get("/motion/knowledge-graph/search", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const graph = buildKnowledgeGraph();
  const results = searchConcepts(graph, q);
  res.json({ query: q, results, count: results.length });
});

/**
 * POST /api/motion/knowledge-graph/suggest — suggest connections between a
 * set of concepts based on shared neighbours and category complementarity.
 * Body: { conceptIds: [] }
 */
motionRouter.post("/motion/knowledge-graph/suggest", (req, res) => {
  const body = req.body ?? {};
  if (!Array.isArray(body.conceptIds)) {
    res.status(400).json({ error: "conceptIds (string[]) is required" });
    return;
  }
  const graph = buildKnowledgeGraph();
  const suggestions = suggestConnections(graph, body.conceptIds);
  res.json({ suggestions, count: suggestions.length });
});

/**
 * POST /api/motion/knowledge-graph/recommend — recommend next concepts to
 * explore based on concepts already used. Body: { usedConceptIds: [] }
 */
motionRouter.post("/motion/knowledge-graph/recommend", (req, res) => {
  const body = req.body ?? {};
  if (!Array.isArray(body.usedConceptIds)) {
    res.status(400).json({ error: "usedConceptIds (string[]) is required" });
    return;
  }
  const graph = buildKnowledgeGraph();
  const recommendations = recommendNext(graph, body.usedConceptIds);
  res.json({ recommendations, count: recommendations.length });
});

/**
 * GET /api/motion/knowledge-graph/analyze — analyze the structure of the
 * knowledge graph (centrality, clusters, coverage).
 */
motionRouter.get("/motion/knowledge-graph/analyze", (_req, res) => {
  const graph = buildKnowledgeGraph();
  const analysis = analyzeGraph(graph);
  res.json(analysis);
});

// ---------------------------------------------------------------------------
// Motion Testing
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/test-suites — list all available motion test suites.
 */
motionRouter.get("/motion/test-suites", (_req, res) => {
  const suites = listTestSuites();
  res.json({ suites, count: suites.length });
});

/**
 * GET /api/projects/:id/tests — run all test suites on a project and return a
 * comprehensive report with scores, failures, and top issues.
 */
motionRouter.get("/projects/:id/tests", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const report = runAllTests(spec);
  res.json(report);
});

/**
 * GET /api/projects/:id/tests/category/:category — run test suites in a
 * specific category on a project.
 */
motionRouter.get("/projects/:id/tests/category/:category", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const results = runTestsByCategory(spec, req.params.category as never);
  res.json({ category: req.params.category, results, count: results.length });
});

/**
 * GET /api/projects/:id/tests/suite/:suiteId — run a single test suite on a
 * project.
 */
motionRouter.get("/projects/:id/tests/suite/:suiteId", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const result = runTestSuite(spec, req.params.suiteId);
  if (!result) {
    res.status(404).json({ error: `unknown test suite: ${req.params.suiteId}` });
    return;
  }
  res.json(result);
});

// ===========================================================================
// Motion Emotion Intelligence API
// ===========================================================================

/**
 * GET /api/motion/emotions — list all available emotion profiles.
 */
motionRouter.get("/motion/emotions", (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category as never : undefined;
  const emotions = listEmotions(category);
  res.json({ emotions, count: emotions.length });
});

/**
 * GET /api/motion/emotions/:emotionId — get a specific emotion profile.
 */
motionRouter.get("/motion/emotions/:emotionId", (req, res) => {
  const emotion = getEmotion(req.params.emotionId);
  if (!emotion) {
    res.status(404).json({ error: `emotion not found: ${req.params.emotionId}` });
    return;
  }
  res.json(emotion);
});

/**
 * POST /api/motion/emotions/:emotionId/synthesize — synthesize motion from an emotion.
 */
motionRouter.post("/motion/emotions/:emotionId/synthesize", (req, res) => {
  const result = synthesizeFromEmotion(req.params.emotionId);
  if (!result) {
    res.status(404).json({ error: `emotion not found: ${req.params.emotionId}` });
    return;
  }
  res.json({ ...result, report: formatEmotionReport(result) });
});

/**
 * POST /api/projects/:id/emotions/detect — detect the emotion of a component.
 */
motionRouter.post("/projects/:id/emotions/detect", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const componentId = typeof req.body.componentId === "string" ? req.body.componentId : "";
  const component = spec.components.find((c) => c.id === componentId);
  if (!component) {
    res.status(404).json({ error: `component not found: ${componentId}` });
    return;
  }
  const result = detectEmotionFromMotion(component);
  res.json({ ...result, report: formatDetectionReport(result) });
});

/**
 * POST /api/motion/emotions/blend — blend multiple emotions.
 */
motionRouter.post("/motion/emotions/blend", (req, res) => {
  const emotions = Array.isArray(req.body.emotions) ? req.body.emotions : [];
  const result = blendEmotions(
    emotions.map((e: { emotionId: string; weight: number }) => ({
      emotionId: String(e.emotionId),
      weight: Number(e.weight),
    })),
  );
  if (!result) {
    res.status(400).json({ error: "failed to blend emotions — check emotion ids" });
    return;
  }
  res.json({ ...result, report: formatBlendReport(result) });
});

/**
 * POST /api/motion/emotions/journey — plan an emotion journey.
 */
motionRouter.post("/motion/emotions/journey", (req, res) => {
  const emotionIds = Array.isArray(req.body.emotionIds) ? req.body.emotionIds.map(String) : [];
  const totalDurationMs = typeof req.body.totalDurationMs === "number" ? req.body.totalDurationMs : 5000;
  const result = planEmotionJourney(emotionIds, totalDurationMs);
  if (!result) {
    res.status(400).json({ error: "failed to plan journey — check emotion ids" });
    return;
  }
  res.json({ ...result, report: formatJourneyReport(result) });
});

// ===========================================================================
// Adaptive Motion Learning API
// ===========================================================================

/**
 * GET /api/projects/:id/taste-profile — get the user's taste profile.
 */
motionRouter.get("/projects/:id/taste-profile", (req, res) => {
  const profile = getProjectTasteProfile(req.params.id);
  res.json({ ...profile, report: formatTasteProfile(profile) });
});

/**
 * GET /api/projects/:id/recommend — get a recommendation based on learned preferences.
 */
motionRouter.get("/projects/:id/recommend", (req, res) => {
  const rec = recommendForProject(req.params.id);
  if (!rec) {
    res.json({ recommendation: null, message: "Not enough observations yet" });
    return;
  }
  res.json({ recommendation: rec, report: formatRecommendation(rec) });
});

/**
 * POST /api/projects/:id/observations — record a motion observation.
 */
motionRouter.post("/projects/:id/observations", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const componentId = typeof req.body.componentId === "string" ? req.body.componentId : "";
  const action = typeof req.body.action === "string" ? req.body.action : "created";
  const component = spec.components.find((c) => c.id === componentId);
  if (!component) {
    res.status(404).json({ error: `component not found: ${componentId}` });
    return;
  }
  recordMotionObservation(req.params.id, { component, action: action as never });
  const profile = getProjectTasteProfile(req.params.id);
  res.json({ recorded: true, action, componentId, profileSummary: profile.summary });
});

// ===========================================================================
// Motion Contextual Awareness API
// ===========================================================================

/**
 * GET /api/motion/context/options — list all context options.
 */
motionRouter.get("/motion/context/options", (_req, res) => {
  res.json(listContextOptions());
});

/**
 * GET /api/motion/context/auto-detect — auto-detect the current context.
 */
motionRouter.get("/motion/context/auto-detect", (req, res) => {
  const signals = {
    userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
    hardwareConcurrency: undefined,
    deviceMemory: undefined,
  };
  const result = autoDetectContext(signals);
  res.json(result);
});

/**
 * POST /api/motion/context/adjustments — compute context adjustments.
 */
motionRouter.post("/motion/context/adjustments", (req, res) => {
  const context = {
    device: (typeof req.body.device === "string" ? req.body.device : "desktop") as never,
    performance: (typeof req.body.performance === "string" ? req.body.performance : "high") as never,
    timeOfDay: (typeof req.body.timeOfDay === "string" ? req.body.timeOfDay : detectTimeOfDay()) as never,
    ambientLight: (typeof req.body.ambientLight === "string" ? req.body.ambientLight : "normal") as never,
    userState: (typeof req.body.userState === "string" ? req.body.userState : "casual") as never,
  };
  const adjustments = computeContextAdjustments(context);
  res.json({ context, adjustments, report: formatContextReport(context, adjustments) });
});

/**
 * POST /api/projects/:id/context/adapt — adapt a component for a context.
 */
motionRouter.post("/projects/:id/context/adapt", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const componentId = typeof req.body.componentId === "string" ? req.body.componentId : "";
  const component = spec.components.find((c) => c.id === componentId);
  if (!component) {
    res.status(404).json({ error: `component not found: ${componentId}` });
    return;
  }
  const context = {
    device: (typeof req.body.device === "string" ? req.body.device : "desktop") as never,
    performance: (typeof req.body.performance === "string" ? req.body.performance : "high") as never,
    timeOfDay: (typeof req.body.timeOfDay === "string" ? req.body.timeOfDay : detectTimeOfDay()) as never,
    ambientLight: (typeof req.body.ambientLight === "string" ? req.body.ambientLight : "normal") as never,
    userState: (typeof req.body.userState === "string" ? req.body.userState : "casual") as never,
  };
  const result = adaptComponentForContext(component, context);
  patchComponent(req.params.id, result.component.id, result.component);
  res.json({ ...result, report: formatAdaptationReport(result) });
});

// ===========================================================================
// Motion Collaboration Engine API
// ===========================================================================

/**
 * GET /api/motion/collaboration/modules — list all collaboration modules.
 */
motionRouter.get("/motion/collaboration/modules", (_req, res) => {
  const modules = listCollaborationModules();
  res.json({ modules, count: modules.length });
});

/**
 * POST /api/motion/collaboration/plan — plan a collaboration.
 */
motionRouter.post("/motion/collaboration/plan", (req, res) => {
  const request = typeof req.body.request === "string" ? req.body.request : "";
  const plan = planCollaboration(request);
  res.json({ ...plan, report: formatCollaborationPlan(plan) });
});

/**
 * POST /api/motion/collaboration/execute — execute a collaboration.
 */
motionRouter.post("/motion/collaboration/execute", (req, res) => {
  const request = typeof req.body.request === "string" ? req.body.request : "";
  const result = collaborate(request);
  res.json({ ...result, report: formatCollaborationResult(result) });
});

// ---------------------------------------------------------------------------
// Motion Resonance Engine
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/resonance — analyze motion resonance with viewer state.
 * Query: ?attention=0.7&arousal=0.5&valence=0.2&fatigue=0.3&timeOfDay=morning
 */
motionRouter.get("/projects/:id/resonance", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const viewer: ViewerState | undefined = req.query.attention || req.query.arousal || req.query.valence || req.query.fatigue || req.query.timeOfDay
    ? {
        attention: req.query.attention ? Number(req.query.attention) : undefined,
        arousal: req.query.arousal ? Number(req.query.arousal) : undefined,
        valence: req.query.valence ? Number(req.query.valence) : undefined,
        fatigue: req.query.fatigue ? Number(req.query.fatigue) : undefined,
        timeOfDay: req.query.timeOfDay as ViewerState["timeOfDay"] | undefined,
      } as ViewerState
    : undefined;
  const analysis = analyzeResonance(spec, viewer);
  res.json({ ...analysis, report: formatResonanceReport(analysis) });
});

/**
 * POST /api/projects/:id/resonance/tune — tune motion for optimal resonance.
 * Body: { viewerState? }
 */
motionRouter.post("/projects/:id/resonance/tune", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const viewer = req.body?.viewerState as ViewerState | undefined;
  const result = tuneForResonance(spec, viewer);
  // Apply adjustments
  for (const adj of result.adjustments) {
    if (adj.field === "durationMs" && typeof adj.newValue === "number") {
      patchComponent(req.params.id, adj.componentId, { durationMs: adj.newValue });
    } else if (adj.field === "easing") {
      patchComponent(req.params.id, adj.componentId, { easing: adj.newValue as never });
    }
  }
  res.json(result);
});

// ---------------------------------------------------------------------------
// Motion Synesthesia Engine
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/synesthesia — translate motion to multi-sensory experience.
 */
motionRouter.get("/projects/:id/synesthesia", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const experience = translateSynesthesia(spec);
  res.json({ ...experience, report: formatSynestheticReport(experience) });
});

/**
 * POST /api/motion/synesthesia/map — reverse-map a sensory input to motion parameters.
 * Body: { modality, value }
 */
motionRouter.post("/motion/synesthesia/map", (req, res) => {
  const modality = req.body?.modality as "color" | "sound" | "texture" | "emotion";
  const value = req.body?.value;
  if (!modality || !value) {
    res.status(400).json({ error: "modality and value are required" });
    return;
  }
  const mapping = mapSensoryToMotion(modality, value);
  res.json(mapping);
});

// ---------------------------------------------------------------------------
// Motion Dream Engine
// ---------------------------------------------------------------------------

/**
 * GET /api/motion/dream/concepts — list all dream concepts.
 */
motionRouter.get("/motion/dream/concepts", (_req, res) => {
  const concepts = listDreamConcepts();
  res.json({ concepts, count: concepts.length });
});

/**
 * POST /api/motion/dream/prompt — generate a dream motion from a prompt.
 * Body: { prompt }
 */
motionRouter.post("/motion/dream/prompt", (req, res) => {
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
  const dream = dreamFromPrompt(prompt);
  res.json({ ...dream, report: formatDreamReport(dream) });
});

/**
 * POST /api/motion/dream/sequence — generate a dream sequence.
 * Body: { length?, seed? }
 */
motionRouter.post("/motion/dream/sequence", (req, res) => {
  const length = typeof req.body?.length === "number" ? Math.min(8, Math.max(1, req.body.length)) : 3;
  const seed = typeof req.body?.seed === "string" ? req.body.seed : undefined;
  const sequence = generateDreamSequence(length, seed);
  res.json({ ...sequence, report: formatDreamSequenceReport(sequence) });
});

// ---------------------------------------------------------------------------
// Motion Harmonics Engine
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/harmonics — analyze the harmonic structure of a project.
 */
motionRouter.get("/projects/:id/harmonics", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeHarmonics(spec);
  res.json({ ...analysis, report: formatHarmonicsReport(analysis) });
});

/**
 * GET /api/projects/:id/harmonics/:componentId — find harmonizing partners.
 */
motionRouter.get("/projects/:id/harmonics/:componentId", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const result = findHarmonicsForComponent(spec, req.params.componentId);
  res.json(result);
});

// ---------------------------------------------------------------------------
// Motion Entropy Engine
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/entropy — analyze information-theoretic structure.
 */
motionRouter.get("/projects/:id/entropy", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeEntropy(spec);
  res.json({ ...analysis, report: formatEntropyReport(analysis) });
});

/**
 * GET /api/projects/:id/entropy/hotspots — identify information hotspots.
 */
motionRouter.get("/projects/:id/entropy/hotspots", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const hotspots = identifyInformationHotspots(spec);
  res.json(hotspots);
});

// ---------------------------------------------------------------------------
// Motion Cognition Engine
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/cognitive-load — analyze cognitive load.
 */
motionRouter.get("/projects/:id/cognitive-load", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeCognitiveLoad(spec);
  res.json({ ...analysis, report: formatCognitionReport(analysis) });
});

// ---------------------------------------------------------------------------
// Motion Topology Engine
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/topology — analyze topological structure.
 */
motionRouter.get("/projects/:id/topology", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeTopology(spec);
  res.json({ ...analysis, report: formatTopologyReport(analysis) });
});

/**
 * GET /api/projects/:id/topology/path — find temporal path between two components.
 */
motionRouter.get("/projects/:id/topology/path", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const fromId = typeof req.query.fromId === "string" ? req.query.fromId : "";
  const toId = typeof req.query.toId === "string" ? req.query.toId : "";
  const result = findTemporalPath(spec, fromId, toId);
  res.json({
    found: result !== null,
    path: result?.path ?? [],
    totalOverlapMs: result?.totalOverlapMs ?? 0,
  });
});

// ---------------------------------------------------------------------------
// Motion Poetics Engine
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/poetics — analyze poetic structure.
 */
motionRouter.get("/projects/:id/poetics", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzePoetics(spec);
  res.json({ ...analysis, report: formatPoeticsReport(analysis) });
});

// ---------------------------------------------------------------------------
// Motion Ecology Engine
// ---------------------------------------------------------------------------

/**
 * GET /api/projects/:id/ecosystem — analyze ecosystem structure.
 */
motionRouter.get("/projects/:id/ecosystem", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeEcosystem(spec);
  res.json({ ...analysis, report: formatEcosystemReport(analysis) });
});

/**
 * GET /api/projects/:id/calligraphy — analyze composition as calligraphic art.
 */
motionRouter.get("/projects/:id/calligraphy", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeCalligraphy(spec);
  res.json({ ...analysis, report: formatCalligraphyReport(analysis) });
});

/**
 * GET /api/projects/:id/mythology — interpret composition through mythological lens.
 */
motionRouter.get("/projects/:id/mythology", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeMythology(spec);
  res.json({ ...analysis, report: formatMythologyReport(analysis) });
});

/**
 * GET /api/projects/:id/weather — model composition as a weather system.
 */
motionRouter.get("/projects/:id/weather", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeWeather(spec);
  res.json({ ...analysis, report: formatWeatherReport(analysis) });
});

/**
 * GET /api/projects/:id/alchemy — interpret composition through alchemical transformation.
 */
motionRouter.get("/projects/:id/alchemy", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeAlchemy(spec);
  res.json({ ...analysis, report: formatAlchemyReport(analysis) });
});

/**
 * GET /api/projects/:id/architecture — analyze composition as a built structure.
 */
motionRouter.get("/projects/:id/architecture", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeArchitecture(spec);
  res.json({ ...analysis, report: formatArchitectureReport(analysis) });
});

/**
 * GET /api/projects/:id/cartography — map composition as cartographic terrain.
 */
motionRouter.get("/projects/:id/cartography", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeCartography(spec);
  res.json({ ...analysis, report: formatCartographyReport(analysis) });
});

/**
 * GET /api/projects/:id/genealogy — trace evolutionary lineage of motion patterns.
 */
motionRouter.get("/projects/:id/genealogy", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeGenealogy(spec);
  res.json({ ...analysis, report: formatGenealogyReport(analysis) });
});

/**
 * GET /api/projects/:id/astronomy — map composition as celestial phenomena.
 */
motionRouter.get("/projects/:id/astronomy", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeAstronomy(spec);
  res.json({ ...analysis, report: formatAstronomyReport(analysis) });
});

/**
 * GET /api/projects/:id/chemistry — analyze composition as a chemical system.
 */
motionRouter.get("/projects/:id/chemistry", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeChemistry(spec);
  res.json({ ...analysis, report: formatChemistryReport(analysis) });
});

/**
 * GET /api/projects/:id/musicology — analyze composition as a musical score.
 */
motionRouter.get("/projects/:id/musicology", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeMusicology(spec);
  res.json({ ...analysis, report: formatMusicologyReport(analysis) });
});

/**
 * GET /api/projects/:id/botany — analyze composition as a botanical system.
 */
motionRouter.get("/projects/:id/botany", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeBotany(spec);
  res.json({ ...analysis, report: formatBotanyReport(analysis) });
});

/**
 * GET /api/projects/:id/geology — analyze composition as a geological formation.
 */
motionRouter.get("/projects/:id/geology", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeGeology(spec);
  res.json({ ...analysis, report: formatGeologyReport(analysis) });
});

/**
 * GET /api/projects/:id/physics — analyze composition through physics principles.
 */
motionRouter.get("/projects/:id/physics", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzePhysics(spec);
  res.json({ ...analysis, report: formatPhysicsReport(analysis) });
});

/**
 * GET /api/projects/:id/linguistics — analyze composition as a linguistic utterance.
 */
motionRouter.get("/projects/:id/linguistics", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeLinguistics(spec);
  res.json({ ...analysis, report: formatLinguisticsReport(analysis) });
});

/**
 * GET /api/projects/:id/cinema — analyze composition as a cinematic sequence.
 */
motionRouter.get("/projects/:id/cinema", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }
  const analysis = analyzeCinema(spec);
  res.json({ ...analysis, report: formatCinemaReport(analysis) });
});

/**
 * GET /api/projects/:id/analyze-all — runs every cross-disciplinary analysis
 * engine in one call and returns a combined report. Useful for a "Run All"
 * button in the analysis panel so the user can survey the full spread of
 * interpretations without clicking each engine individually. Engines are
 * executed sequentially against the same spec snapshot; per-engine failures
 * are captured and surfaced without aborting the batch.
 */
motionRouter.get("/projects/:id/analyze-all", (req, res) => {
  const spec = getProjectSpec(req.params.id);
  if (!spec) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  type EngineEntry = {
    name: string;
    analysis: unknown;
    report: string;
    error?: string;
  };

  // Each entry pairs the analyze function with its report formatter and a
  // display name. Listed in the same order as the standalone routes above so
  // the batch output matches the panel's engine ordering.
  const engines: Array<{
    name: string;
    run: () => { analysis: unknown; report: string };
  }> = [
    { name: "calligraphy", run: () => { const a = analyzeCalligraphy(spec); return { analysis: a, report: formatCalligraphyReport(a) }; } },
    { name: "mythology", run: () => { const a = analyzeMythology(spec); return { analysis: a, report: formatMythologyReport(a) }; } },
    { name: "weather", run: () => { const a = analyzeWeather(spec); return { analysis: a, report: formatWeatherReport(a) }; } },
    { name: "alchemy", run: () => { const a = analyzeAlchemy(spec); return { analysis: a, report: formatAlchemyReport(a) }; } },
    { name: "architecture", run: () => { const a = analyzeArchitecture(spec); return { analysis: a, report: formatArchitectureReport(a) }; } },
    { name: "cartography", run: () => { const a = analyzeCartography(spec); return { analysis: a, report: formatCartographyReport(a) }; } },
    { name: "genealogy", run: () => { const a = analyzeGenealogy(spec); return { analysis: a, report: formatGenealogyReport(a) }; } },
    { name: "astronomy", run: () => { const a = analyzeAstronomy(spec); return { analysis: a, report: formatAstronomyReport(a) }; } },
    { name: "chemistry", run: () => { const a = analyzeChemistry(spec); return { analysis: a, report: formatChemistryReport(a) }; } },
    { name: "musicology", run: () => { const a = analyzeMusicology(spec); return { analysis: a, report: formatMusicologyReport(a) }; } },
    { name: "botany", run: () => { const a = analyzeBotany(spec); return { analysis: a, report: formatBotanyReport(a) }; } },
    { name: "geology", run: () => { const a = analyzeGeology(spec); return { analysis: a, report: formatGeologyReport(a) }; } },
    { name: "physics", run: () => { const a = analyzePhysics(spec); return { analysis: a, report: formatPhysicsReport(a) }; } },
    { name: "linguistics", run: () => { const a = analyzeLinguistics(spec); return { analysis: a, report: formatLinguisticsReport(a) }; } },
    { name: "cinema", run: () => { const a = analyzeCinema(spec); return { analysis: a, report: formatCinemaReport(a) }; } },
  ];

  const results: EngineEntry[] = [];
  const failures: string[] = [];
  for (const engine of engines) {
    try {
      const { analysis, report } = engine.run();
      results.push({ name: engine.name, analysis, report });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(engine.name);
      results.push({ name: engine.name, analysis: null, report: "", error: message });
    }
  }

  res.json({
    engines: results,
    summary: {
      total: engines.length,
      succeeded: engines.length - failures.length,
      failed: failures.length,
      failures,
    },
  });
});
