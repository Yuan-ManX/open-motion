import { Router } from "express";
import { listPresets as listStateMachinePresetIds, getPreset } from "../../motion/stateMachine.js";
import { listRecipes, getRecipe } from "../../motion/recipes.js";
import { encodeRecipeTriple, substituteComponentId } from "../../motion/recipeCodec.js";
import { executeTool } from "../../agent/tools/registry.js";
import { listStylePresets } from "../../motion/stylePresets.js";
import { listShaderEffects } from "../../motion/shaders.js";
import { BRAND_PACK_PRESETS } from "../../motion/brandPack.js";
import { listMoods } from "../../motion/moodEngine.js";
import { runMotionPipeline } from "../../motion/automationPipeline.js";
import { buildCompositionTree, flattenToTimeline, createComposition, generateCompositionReact } from "../../motion/compositionEngine.js";
import { seekToFrame, renderFrameRange, findThumbnailFrame } from "../../motion/frameRenderer.js";
import { generateHtmlComposition } from "../../motion/htmlComposition.js";
import { resolveMedia, getManifest, searchAssets } from "../../motion/mediaPipeline.js";
import { routeSkill, listSkills, getSkillsSummary } from "../../agent/skillsRouter.js";
import { listPresetPacks, getPresetPack } from "../../motion/presetPacks.js";
import {
  listScenePacks,
  getScenePack,
  instantiateScenePack,
  type SceneVertical,
} from "../../motion/scenePacks.js";
import {
  listColorMotionPalettes,
  getColorMotionPalette,
  paletteToCssGradient,
} from "../../motion/colorMotionPalettes.js";
import {
  listPlatformPresets,
  getPlatformPreset,
  matchPlatformPreset,
  type MotionPlatform,
} from "../../motion/platformMotionPresets.js";
import {
  listAccessibilityProfiles,
  getAccessibilityProfile,
  pickStrictestProfile,
  type AccessibilityProfileContext,
} from "../../motion/accessibilityProfiles.js";
import {
  listCursorChoreography,
  getCursorChoreography,
  matchCursorChoreography,
  type CursorPattern,
} from "../../motion/cursorChoreography.js";
import { TEMPLATES } from "../../motion/templates/index.js";
import { PRESETS, PRESET_NAMES } from "../../agent/tools/presets.js";
import { EXPORT_PRESETS } from "../../motion/exportPresets.js";
import { listRhythmPatterns } from "../../motion/rhythmPatterns.js";
import { listThemes } from "../../motion/motionThemeSystem.js";
import { listArcTemplates } from "../../motion/motionSequencePlanner.js";
import { listStoryGenres } from "../../motion/storytelling.js";
import { getProjectSpec } from "../../db/repositories/projects.js";
import { createComponent } from "../../db/repositories/components.js";
import { runAsync } from "../../utils/async.js";

export const catalogRouter = Router();

const CHOREOGRAPHY_PATTERNS = [
  { id: "cascade", name: "Cascade", description: "Sequential staggered entrance — each component starts after the previous with a fixed delay." },
  { id: "wave", name: "Wave", description: "Sine-based delay distribution creating a fluid wave-like ripple across components." },
  { id: "ripple", name: "Ripple", description: "Center-out delay based on distance from the centroid, simulating a ripple effect." },
  { id: "canon", name: "Canon", description: "Fugue-like overlap where each component starts before the previous finishes." },
  { id: "converge", name: "Converge", description: "All components animate toward a synchronized climax point from different start times." },
  { id: "spiral", name: "Spiral", description: "Golden-angle delay distribution creating a spiral entry pattern." },
  { id: "explosion", name: "Explosion", description: "Center-out burst with bounce easing — components explode outward from the centroid." },
  { id: "assembly", name: "Assembly", description: "Edge-to-center convergence — components assemble from scattered positions to their final spots." },
  { id: "breathing", name: "Breathing", description: "Phase-offset opacity/scale oscillation creating a breathing organism effect." },
  { id: "domino", name: "Domino", description: "Alternating-direction cascade with linear easing — domino-topple sequential reveal." },
  { id: "scatter", name: "Scatter", description: "Reverse explosion — components scatter from center to their positions with overshoot easing." },
] as const;

/**
 * GET /api/recipes — list all motion recipes, optionally filtered by category
 * or free-text query. The frontend Recipes panel calls this to populate its
 * grid of curated motion combinations.
 */
catalogRouter.get("/recipes", (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const query = typeof req.query.q === "string" ? req.query.q : undefined;
  let recipes = listRecipes(category);
  if (query) {
    const q = query.toLowerCase();
    recipes = recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }
  res.json(recipes);
});

/**
 * GET /api/recipes/:id — fetch a single recipe by its id.
 */
catalogRouter.get("/recipes/:id", (req, res) => {
  const recipe = getRecipe(req.params.id);
  if (!recipe) {
    res.status(404).json({ error: "recipe not found" });
    return;
  }
  res.json(recipe);
});

/**
 * POST /api/projects/:id/recipes/:recipeId/apply — resolve a recipe's tool
 * call sequence against a target component and execute every call directly
 * so the recipe's easing/duration/loop/transforms land on the component.
 * Body: { componentId? }
 * If componentId is omitted (or not found), the most recently added
 * component is used as the target so the apply always has somewhere to land.
 */
catalogRouter.post(
  "/projects/:id/recipes/:recipeId/apply",
  runAsync(async (req, res) => {
    const spec = getProjectSpec(req.params.id);
    if (!spec) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    const recipe = getRecipe(req.params.recipeId);
    if (!recipe) {
      res.status(404).json({ error: "recipe not found" });
      return;
    }
    if (spec.components.length === 0) {
      res.status(400).json({ error: "no components to apply recipe to — add content first" });
      return;
    }
    const requested = typeof req.body?.componentId === "string" ? req.body.componentId : "";
    const target =
      requested && spec.components.find((c) => c.id === requested)
        ? requested
        : spec.components[spec.components.length - 1].id;

    const triple = encodeRecipeTriple(recipe);
    const resolved = substituteComponentId(triple.toolCalls, target);
    const ctx = { projectId: req.params.id };
    const results = [];
    for (const atom of resolved) {
      const r = await executeTool(atom.tool, atom.args, ctx);
      results.push({ tool: atom.tool, ok: r.ok, summary: r.summary, specChanged: r.specChanged });
    }
    res.json({
      recipeId: recipe.id,
      recipeName: recipe.name,
      componentId: target,
      toolCallsExecuted: resolved.length,
      succeeded: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
      applied: true,
    });
  }),
);

/**
 * GET /api/styles — list all style presets (curated coordinated motion
 * aesthetics that can be applied across an entire project).
 */
catalogRouter.get("/styles", (_req, res) => {
  res.json(listStylePresets());
});

/**
 * GET /api/shaders — list all shader effects, optionally filtered by category.
 * The frontend Shader panel calls this to populate its effect library.
 */
catalogRouter.get("/shaders", (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  res.json(listShaderEffects(category));
});

/**
 * GET /api/brand-packs — list all brand pack presets (coordinated motion
 * identity bundles combining easing, timing, and choreography).
 */
catalogRouter.get("/brand-packs", (_req, res) => {
  res.json(BRAND_PACK_PRESETS);
});

/**
 * GET /api/moods — list all mood presets with labels and descriptions.
 * The frontend Mood intelligence panel calls this to show available moods.
 */
catalogRouter.get("/moods", (_req, res) => {
  res.json(listMoods());
});

/**
 * GET /api/choreography — list all choreography patterns with descriptions.
 */
catalogRouter.get("/choreography", (_req, res) => {
  res.json({ patterns: CHOREOGRAPHY_PATTERNS, count: CHOREOGRAPHY_PATTERNS.length });
});

/**
 * GET /api/state-machine-presets — list all available state machine presets.
 */
catalogRouter.get("/state-machine-presets", (req, res) => {
  const ids = listStateMachinePresetIds();
  const presets = ids.map((id) => {
    const p = getPreset(id);
    return p
      ? {
          id,
          name: p.name,
          description: p.description,
          stateCount: p.states.length,
          transitionCount: p.transitions.length,
          inputCount: p.inputs.length,
        }
      : null;
  }).filter((p): p is NonNullable<typeof p> => p !== null);
  res.json({ presets, count: presets.length });
});

/**
 * GET /api/catalog/search — unified search across all motion resources.
 * Query: ?q=fade&limit=20
 * Searches recipes, style presets, shaders, brand packs, moods, and
 * choreography patterns, returning a unified result set sorted by relevance.
 */
catalogRouter.get("/catalog/search", (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.toLowerCase().trim() : "";
  const limit = typeof req.query.limit === "string" ? Math.min(parseInt(req.query.limit, 10) || 20, 100) : 20;

  if (!query) {
    res.json({ results: [], total: 0, query: "" });
    return;
  }

  type SearchResult = { type: string; id: string; name: string; description: string; score: number };
  const results: SearchResult[] = [];

  // Search recipes
  for (const r of listRecipes()) {
    const score = scoreMatch(query, [r.name, r.description ?? "", ...r.tags]);
    if (score > 0) results.push({ type: "recipe", id: r.id, name: r.name, description: r.description ?? "", score });
  }

  // Search templates
  for (const t of TEMPLATES) {
    const score = scoreMatch(query, [t.id, t.name, t.description, t.category, ...(t.tags ?? [])]);
    if (score > 0) results.push({ type: "template", id: t.id, name: t.name, description: t.description, score });
  }

  // Search style presets
  for (const s of listStylePresets()) {
    const score = scoreMatch(query, [s.name, s.description ?? "", ...(s.tags ?? [])]);
    if (score > 0) results.push({ type: "style", id: s.id, name: s.name, description: s.description ?? "", score });
  }

  // Search preset packs (curated template bundles)
  for (const p of listPresetPacks()) {
    const score = scoreMatch(query, [p.name, p.description, ...(p.tags ?? [])]);
    if (score > 0) results.push({ type: "preset-pack", id: p.id, name: p.name, description: p.description, score });
  }

  // Search animation presets (shake/wiggle/float/glow/heartbeat/typewriter)
  for (const name of PRESET_NAMES) {
    const preset = PRESETS[name];
    const description = `${name} animation preset — ${preset.keyframes.length} keyframes, ${preset.durationMs}ms, ${preset.iterationCount === "infinite" ? "looping" : "one-shot"}`;
    const score = scoreMatch(query, [name, description]);
    if (score > 0) results.push({ type: "animation-preset", id: name, name, description, score });
  }

  // Search export presets (platform-aware export profiles)
  for (const e of EXPORT_PRESETS) {
    const score = scoreMatch(query, [
      e.name,
      e.description,
      e.platform,
      e.format,
      ...(e.keywords ?? []),
      ...(e.recommendedFor ?? []),
    ]);
    if (score > 0) results.push({ type: "export-preset", id: e.id, name: e.name, description: e.description, score });
  }

  // Search rhythm patterns
  for (const r of listRhythmPatterns()) {
    const score = scoreMatch(query, [r.name, r.description, r.category]);
    if (score > 0) results.push({ type: "rhythm", id: r.id, name: r.name, description: r.description, score });
  }

  // Search motion themes
  for (const t of listThemes()) {
    const score = scoreMatch(query, [t.name, t.description, t.personality]);
    if (score > 0) results.push({ type: "motion-theme", id: t.id, name: t.name, description: t.description, score });
  }

  // Search narrative arcs
  for (const a of listArcTemplates()) {
    const score = scoreMatch(query, [a.name, a.description]);
    if (score > 0) results.push({ type: "narrative-arc", id: a.id, name: a.name, description: a.description, score });
  }

  // Search shaders
  for (const sh of listShaderEffects()) {
    const score = scoreMatch(query, [sh.name, sh.description, sh.category]);
    if (score > 0) results.push({ type: "shader", id: sh.id, name: sh.name, description: sh.description, score });
  }

  // Search brand packs
  for (const bp of BRAND_PACK_PRESETS) {
    const score = scoreMatch(query, [bp.name, bp.description ?? ""]);
    if (score > 0) results.push({ type: "brand-pack", id: bp.name.toLowerCase().replace(/\s+/g, "-"), name: bp.name, description: bp.description ?? "", score });
  }

  // Search choreography patterns
  for (const cp of CHOREOGRAPHY_PATTERNS) {
    const score = scoreMatch(query, [cp.name, cp.description]);
    if (score > 0) results.push({ type: "choreography", id: cp.id, name: cp.name, description: cp.description, score });
  }

  // Search story genres
  for (const g of listStoryGenres()) {
    const score = scoreMatch(query, [g.name, g.description]);
    if (score > 0) results.push({ type: "story-genre", id: g.id, name: g.name, description: g.description, score });
  }

  // Search scene packs
  for (const s of listScenePacks()) {
    const score = scoreMatch(query, [s.name, s.description, s.vertical, s.choreography, ...s.tags]);
    if (score > 0) results.push({ type: "scene-pack", id: s.id, name: s.name, description: s.description, score });
  }

  // Search color motion palettes
  for (const p of listColorMotionPalettes()) {
    const score = scoreMatch(query, [p.name, p.description, ...p.tags]);
    if (score > 0) results.push({ type: "color-palette", id: p.id, name: p.name, description: p.description, score });
  }

  // Search platform motion presets
  for (const p of listPlatformPresets()) {
    const score = scoreMatch(query, [p.name, p.description, p.platform, ...p.tags]);
    if (score > 0) results.push({ type: "platform-preset", id: p.id, name: p.name, description: p.description, score });
  }

  // Search accessibility profiles
  for (const a of listAccessibilityProfiles()) {
    const score = scoreMatch(query, [a.name, a.description, a.context, ...a.tags]);
    if (score > 0) results.push({ type: "a11y-profile", id: a.id, name: a.name, description: a.description, score });
  }

  // Search cursor choreography presets
  for (const c of listCursorChoreography()) {
    const score = scoreMatch(query, [c.name, c.description, c.pattern, ...c.tags]);
    if (score > 0) results.push({ type: "cursor-choreography", id: c.id, name: c.name, description: c.description, score });
  }

  // Sort by relevance score (descending) and limit
  results.sort((a, b) => b.score - a.score);
  const limited = results.slice(0, limit);

  res.json({
    results: limited,
    total: results.length,
    query,
    categories: {
      recipes: results.filter((r) => r.type === "recipe").length,
      templates: results.filter((r) => r.type === "template").length,
      styles: results.filter((r) => r.type === "style").length,
      presetPacks: results.filter((r) => r.type === "preset-pack").length,
      animationPresets: results.filter((r) => r.type === "animation-preset").length,
      exportPresets: results.filter((r) => r.type === "export-preset").length,
      rhythms: results.filter((r) => r.type === "rhythm").length,
      motionThemes: results.filter((r) => r.type === "motion-theme").length,
      narrativeArcs: results.filter((r) => r.type === "narrative-arc").length,
      shaders: results.filter((r) => r.type === "shader").length,
      brandPacks: results.filter((r) => r.type === "brand-pack").length,
      choreography: results.filter((r) => r.type === "choreography").length,
      storyGenres: results.filter((r) => r.type === "story-genre").length,
      scenePacks: results.filter((r) => r.type === "scene-pack").length,
      colorPalettes: results.filter((r) => r.type === "color-palette").length,
      platformPresets: results.filter((r) => r.type === "platform-preset").length,
      accessibilityProfiles: results.filter((r) => r.type === "a11y-profile").length,
      cursorChoreography: results.filter((r) => r.type === "cursor-choreography").length,
    },
  });
});

/**
 * GET /api/catalog/summary — aggregate counts of all motion resources.
 * Useful for the frontend to show available content at a glance.
 */
catalogRouter.get("/catalog/summary", (_req, res) => {
  const recipes = listRecipes();
  const templates = TEMPLATES;
  const styles = listStylePresets();
  const presetPacks = listPresetPacks();
  const animationPresets = PRESET_NAMES.length;
  const exportPresets = EXPORT_PRESETS;
  const rhythms = listRhythmPatterns();
  const motionThemes = listThemes();
  const narrativeArcs = listArcTemplates();
  const shaders = listShaderEffects();
  const brandPacks = BRAND_PACK_PRESETS;
  const moods = listMoods();
  const storyGenres = listStoryGenres();
  const smPresets = listStateMachinePresetIds().map(getPreset).filter(Boolean);
  const scenePacks = listScenePacks();
  const colorPalettes = listColorMotionPalettes();
  const platformPresets = listPlatformPresets();
  const a11yProfiles = listAccessibilityProfiles();
  const cursorChoreo = listCursorChoreography();

  const total =
    recipes.length +
    templates.length +
    styles.length +
    presetPacks.length +
    animationPresets +
    exportPresets.length +
    rhythms.length +
    motionThemes.length +
    narrativeArcs.length +
    shaders.length +
    brandPacks.length +
    moods.length +
    CHOREOGRAPHY_PATTERNS.length +
    storyGenres.length +
    smPresets.length +
    scenePacks.length +
    colorPalettes.length +
    platformPresets.length +
    a11yProfiles.length +
    cursorChoreo.length;

  res.json({
    total,
    categories: {
      recipes: recipes.length,
      templates: templates.length,
      styles: styles.length,
      presetPacks: presetPacks.length,
      animationPresets,
      exportPresets: exportPresets.length,
      rhythms: rhythms.length,
      motionThemes: motionThemes.length,
      narrativeArcs: narrativeArcs.length,
      shaders: shaders.length,
      brandPacks: brandPacks.length,
      moods: moods.length,
      choreography: CHOREOGRAPHY_PATTERNS.length,
      storyGenres: storyGenres.length,
      stateMachinePresets: smPresets.length,
      scenePacks: scenePacks.length,
      colorPalettes: colorPalettes.length,
      platformPresets: platformPresets.length,
      accessibilityProfiles: a11yProfiles.length,
      cursorChoreography: cursorChoreo.length,
    },
  });
});

/** Relevance scoring that handles multi-word queries by tokenizing the query
 * into individual terms and matching each term independently across fields. A
 * query like "gentle float" therefore surfaces any resource whose name or
 * description contains "gentle" OR "float", ranked by how many distinct terms
 * landed. Scoring tiers: exact field match > starts-with > includes > word match. */
function scoreMatch(query: string, fields: string[]): number {
  const terms = query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (terms.length === 0) return 0;

  let bestCoverage = 0;
  for (const field of fields) {
    if (!field) continue;
    const lower = field.toLowerCase();
    let covered = 0;
    let maxTier = 0;
    for (const term of terms) {
      let tier = 0;
      if (lower === term) tier = 100;
      else if (lower.startsWith(term)) tier = 80;
      else if (lower.includes(term)) tier = 60;
      else {
        const words = lower.split(/\s+/);
        for (const word of words) {
          if (word.startsWith(term)) {
            tier = Math.max(tier, 40);
            break;
          }
          if (word.includes(term) && term.length >= 3) {
            tier = Math.max(tier, 20);
            break;
          }
        }
      }
      if (tier > 0) {
        covered++;
        maxTier = Math.max(maxTier, tier);
      }
    }
    if (covered === 0) continue;
    // Reward coverage of more query terms; preference for exact phrase over
    // scattered single-term hits.
    const exactPhrase = lower.includes(query) ? 25 : 0;
    bestCoverage = Math.max(bestCoverage, covered * 40 + maxTier + exactPhrase);
  }
  return bestCoverage;
}

/**
 * POST /api/catalog/pipeline — run the automated motion pipeline.
 * Body: { description, durationMs?, colorScheme?, baseColor?, choreography?, componentCount? }
 * Returns the generated spec, pipeline steps, and timing.
 */
catalogRouter.post(
  "/catalog/pipeline",
  runAsync(async (req, res) => {
    const { description, durationMs, colorScheme, baseColor, choreography, componentCount } = req.body ?? {};
    if (!description) {
      res.status(400).json({ error: "description is required" });
      return;
    }
    const result = await runMotionPipeline({
      description,
      durationMs,
      colorScheme,
      baseColor,
      choreography,
      componentCount,
    });
    res.json({
      summary: result.summary,
      steps: result.steps,
      totalDurationMs: result.totalDurationMs,
      componentCount: result.componentCount,
      spec: result.spec,
    });
  }),
);

/**
 * POST /api/catalog/compose — compose components into sequence/parallel/stagger.
 * Body: { projectId, type, componentIds, stepMs?, gapMs? }
 * Returns the timeline with precise start/end times.
 */
catalogRouter.post(
  "/catalog/compose",
  runAsync(async (req, res) => {
    const { projectId, type, componentIds, stepMs, gapMs } = req.body ?? {};
    if (!projectId || !type || !Array.isArray(componentIds)) {
      res.status(400).json({ error: "projectId, type, and componentIds are required" });
      return;
    }

    const spec = getProjectSpec(projectId);
    if (!spec) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const components = spec.components.filter((c: { id: string }) => componentIds.includes(c.id));
    if (components.length === 0) {
      res.status(404).json({ error: "No matching components found" });
      return;
    }

    const composition = createComposition(components, type, { stepMs: stepMs ?? 80, gapMs: gapMs ?? 0 });
    const timeline = flattenToTimeline(composition);

    res.json({
      type,
      timeline: timeline.timeline,
      totalDurationMs: timeline.totalDurationMs,
      frameCount: timeline.frameCount,
      fps: timeline.fps,
    });
  }),
);

/**
 * GET /api/catalog/composition/:projectId — get composition tree for a project.
 * Returns the tree structure and flattened timeline.
 */
catalogRouter.get("/catalog/composition/:projectId", (req, res) => {
  const spec = getProjectSpec(req.params.projectId);
  if (!spec) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const tree = buildCompositionTree(spec);
  const timeline = flattenToTimeline(tree);
  res.json({
    tree,
    timeline: timeline.timeline,
    totalDurationMs: timeline.totalDurationMs,
    frameCount: timeline.frameCount,
    fps: timeline.fps,
  });
});

/**
 * POST /api/catalog/composition/react — generate React component from composition.
 * Body: { projectId, componentName? }
 * Returns a React component string with Remotion-style sequences.
 */
catalogRouter.post(
  "/catalog/composition/react",
  runAsync(async (req, res) => {
    const { projectId, componentName } = req.body ?? {};
    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }

    const spec = getProjectSpec(projectId);
    if (!spec) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const tree = buildCompositionTree(spec);
    const composition = flattenToTimeline(tree);
    const reactCode = generateCompositionReact(spec, composition, componentName ?? "MotionComposition");

    res.json({
      code: reactCode,
      componentCount: spec.components.length,
      totalDurationMs: composition.totalDurationMs,
      frameCount: composition.frameCount,
    });
  }),
);

/**
 * POST /api/catalog/frame/:projectId — seek to a deterministic frame.
 * Body: { frame, fps? }
 * Returns the snapshot of every component's state at the requested frame.
 */
catalogRouter.post("/catalog/frame/:projectId", (req, res) => {
  const spec = getProjectSpec(req.params.projectId);
  if (!spec) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const { frame, fps } = req.body ?? {};
  if (typeof frame !== "number" || frame < 0) {
    res.status(400).json({ error: "frame is required and must be >= 0" });
    return;
  }
  const snapshot = seekToFrame(spec, Math.floor(frame), { fps: typeof fps === "number" ? fps : undefined });
  res.json({
    frame: snapshot.frame,
    fps: snapshot.fps,
    timeMs: snapshot.timeMs,
    totalFrames: snapshot.totalFrames,
    isComplete: snapshot.isComplete,
    components: snapshot.components,
    activeCount: snapshot.components.filter((c) => c.visible).length,
    totalCount: snapshot.components.length,
  });
});

/**
 * POST /api/catalog/render/:projectId — render a frame range.
 * Body: { startFrame?, endFrame?, fps?, sampleStep? }
 * Returns sampled snapshots across the requested range.
 */
catalogRouter.post(
  "/catalog/render/:projectId",
  runAsync(async (req, res) => {
    const spec = getProjectSpec(req.params.projectId);
    if (!spec) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const { startFrame, endFrame, fps, sampleStep } = req.body ?? {};
    const fpsVal = typeof fps === "number" ? fps : 60;
    const start = typeof startFrame === "number" ? startFrame : 0;
    // Determine end frame: use provided value, or composition length, or default 120
    let end: number;
    if (typeof endFrame === "number") {
      end = endFrame;
    } else {
      const thumb = findThumbnailFrame(spec, { fps: fpsVal });
      end = thumb + 60;
    }
    const result = renderFrameRange(spec, start, end, { fps: fpsVal });
    // Sample frames for efficiency when sampleStep is provided
    const step = typeof sampleStep === "number" && sampleStep > 0 ? sampleStep : 1;
    const sampled = result.frames.filter((_, i) => i % step === 0);
    res.json({
      startFrame: start,
      endFrame: end,
      fps: result.fps,
      totalFrames: result.totalFrames,
      durationMs: result.durationMs,
      activeFrames: result.activeFrames,
      sampleCount: sampled.length,
      snapshots: sampled,
      thumbnailFrame: findThumbnailFrame(spec, { fps: result.fps }),
    });
  }),
);

/**
 * POST /api/catalog/html/:projectId — generate self-contained HTML composition.
 * Body: { width?, height?, fps?, includeControls?, loop? }
 * Returns a runnable HTML document implementing the seek protocol.
 */
catalogRouter.post(
  "/catalog/html/:projectId",
  runAsync(async (req, res) => {
    const spec = getProjectSpec(req.params.projectId);
    if (!spec) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const { width, height, fps, includeControls, loop } = req.body ?? {};
    const result = generateHtmlComposition(spec, {
      width: typeof width === "number" ? width : undefined,
      height: typeof height === "number" ? height : undefined,
      fps: typeof fps === "number" ? fps : undefined,
      includeControls: typeof includeControls === "boolean" ? includeControls : undefined,
      loop: typeof loop === "boolean" ? loop : undefined,
    });
    res.json({
      html: result.html,
      componentCount: result.componentCount,
      totalFrames: result.totalFrames,
      durationMs: result.durationMs,
      fps: result.fps,
      sizeBytes: result.html.length,
    });
  }),
);

/**
 * POST /api/catalog/media/resolve — resolve a media request.
 * Body: { modality, purpose, description, durationSec?, allowGeneration? }
 * Resolves from catalog first, then generates on demand with deterministic seed.
 */
catalogRouter.post(
  "/catalog/media/resolve",
  runAsync(async (req, res) => {
    const { modality, purpose, description, durationSec, allowGeneration } = req.body ?? {};
    if (!modality || !purpose || !description) {
      res.status(400).json({ error: "modality, purpose, and description are required" });
      return;
    }
    const asset = await resolveMedia({ modality, purpose, description, durationSec, allowGeneration });
    res.json({ asset });
  }),
);

/**
 * GET /api/catalog/media/manifest — get the full media manifest.
 * Lists all resolved and generated assets for the current session.
 */
catalogRouter.get("/catalog/media/manifest", (_req, res) => {
  const manifest = getManifest();
  res.json(manifest);
});

/**
 * GET /api/catalog/media/search — search assets by query string.
 * Query: ?q=cinematic&limit=20
 */
catalogRouter.get("/catalog/media/search", (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const limit = typeof req.query.limit === "string" ? Math.min(parseInt(req.query.limit, 10) || 20, 100) : 20;
  const results = searchAssets(query, limit);
  res.json({ results, count: results.length });
});

/**
 * POST /api/catalog/skills/route — route a user intent to skills.
 * Body: { userInput }
 * Returns the primary skill, supporting skills, and the execution plan.
 */
catalogRouter.post("/catalog/skills/route", (req, res) => {
  const { userInput } = req.body ?? {};
  if (!userInput || typeof userInput !== "string") {
    res.status(400).json({ error: "userInput is required" });
    return;
  }
  const result = routeSkill(userInput);
  res.json({
    primary: result.primary,
    supporting: result.supporting,
    intent: result.intent,
    confidence: result.confidence,
    plan: result.plan,
  });
});

/**
 * GET /api/catalog/skills — list all available skills.
 * Query: ?category=creation|analysis|optimization|export|editing|intelligence
 */
catalogRouter.get("/catalog/skills", (req, res) => {
  const category = typeof req.query.category === "string" ? (req.query.category as never) : undefined;
  const skills = listSkills(category);
  const summary = getSkillsSummary();
  res.json({
    skills,
    summary,
    count: skills.length,
  });
});

/**
 * GET /api/catalog/packs — list all curated preset packs (themed bundles of
 * existing template IDs). Returns the full pack metadata so the frontend
 * can render a Packs section without a follow-up request per pack.
 */
catalogRouter.get("/catalog/packs", (_req, res) => {
  res.json({ packs: listPresetPacks(), count: listPresetPacks().length });
});

/**
 * GET /api/catalog/packs/:id — fetch a single preset pack by ID. Returns 404
 * when the pack id does not match any known pack.
 */
catalogRouter.get("/catalog/packs/:id", (req, res) => {
  const pack = getPresetPack(req.params.id);
  if (!pack) {
    res.status(404).json({ error: "pack not found" });
    return;
  }
  res.json(pack);
});

/**
 * GET /api/scenes — list all scene packs (vertically-tailored motion scene
 * compositions). Optional ?vertical= filter narrows by product vertical.
 */
catalogRouter.get("/scenes", (req, res) => {
  const vertical = typeof req.query.vertical === "string"
    ? (req.query.vertical as SceneVertical)
    : undefined;
  const packs = listScenePacks(vertical);
  res.json({ packs, count: packs.length });
});

/** GET /api/scenes/:id — fetch a single scene pack by id. */
catalogRouter.get("/scenes/:id", (req, res) => {
  const pack = getScenePack(req.params.id);
  if (!pack) {
    res.status(404).json({ error: "scene pack not found" });
    return;
  }
  res.json(pack);
});

/**
 * POST /api/projects/:id/scenes/:sceneId/apply — materialize every slot in a
 * scene pack into the target project, persisting the resulting components.
 * Per-slot delayMs and durationMs are applied as overrides so the scene's
 * choreography survives instantiation. Returns the persisted component ids
 * and the role each slot played.
 */
catalogRouter.post(
  "/projects/:id/scenes/:sceneId/apply",
  runAsync(async (req, res) => {
    const spec = getProjectSpec(req.params.id);
    if (!spec) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    const pack = getScenePack(req.params.sceneId);
    if (!pack) {
      res.status(404).json({ error: "scene pack not found" });
      return;
    }
    const { components, slotRoles } = instantiateScenePack(pack, req.params.id);
    for (const comp of components) {
      createComponent(comp);
    }
    res.json({
      sceneId: pack.id,
      sceneName: pack.name,
      vertical: pack.vertical,
      componentIds: components.map((c) => c.id),
      slotRoles,
      appliedCount: components.length,
      skippedSlotCount: pack.slots.length - components.length,
      applied: true,
    });
  }),
);

/**
 * GET /api/color-palettes — list all curated color motion palettes. Optional
 * ?tag= filter narrows by tag (e.g. warm, cool, neon, pastel).
 */
catalogRouter.get("/color-palettes", (req, res) => {
  const tag = typeof req.query.tag === "string" ? req.query.tag : undefined;
  const palettes = listColorMotionPalettes(tag);
  res.json({ palettes, count: palettes.length });
});

/** GET /api/color-palettes/:id — fetch a single palette by id. */
catalogRouter.get("/color-palettes/:id", (req, res) => {
  const palette = getColorMotionPalette(req.params.id);
  if (!palette) {
    res.status(404).json({ error: "palette not found" });
    return;
  }
  res.json({
    ...palette,
    cssGradient: paletteToCssGradient(palette, 135),
  });
});

/**
 * GET /api/platform-presets — list all platform motion presets. Optional
 * ?platform= filter narrows by target platform (ios, android, macos, web, windows).
 */
catalogRouter.get("/platform-presets", (req, res) => {
  const platform = typeof req.query.platform === "string"
    ? (req.query.platform as MotionPlatform)
    : undefined;
  const presets = listPlatformPresets(platform);
  res.json({ presets, count: presets.length });
});

/**
 * GET /api/platform-presets/match — pick the platform preset whose tags best
 * match a free-text query (e.g. ?q=ios app). Returns the best match or null.
 * Registered before /:id so "match" is not treated as an id.
 */
catalogRouter.get("/platform-presets/match", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (!q) {
    res.status(400).json({ error: "q query parameter is required" });
    return;
  }
  const preset = matchPlatformPreset(q);
  res.json({ query: q, match: preset ?? null });
});

/** GET /api/platform-presets/:id — fetch a single platform preset by id. */
catalogRouter.get("/platform-presets/:id", (req, res) => {
  const preset = getPlatformPreset(req.params.id);
  if (!preset) {
    res.status(404).json({ error: "platform preset not found" });
    return;
  }
  res.json(preset);
});

/**
 * GET /api/a11y-profiles — list all accessibility motion profiles. Optional
 * ?context= filter narrows by accessibility context.
 */
catalogRouter.get("/a11y-profiles", (req, res) => {
  const context = typeof req.query.context === "string"
    ? (req.query.context as AccessibilityProfileContext)
    : undefined;
  const profiles = listAccessibilityProfiles(context);
  res.json({ profiles, count: profiles.length });
});

/** GET /api/a11y-profiles/:id — fetch a single accessibility profile by id. */
catalogRouter.get("/a11y-profiles/:id", (req, res) => {
  const profile = getAccessibilityProfile(req.params.id);
  if (!profile) {
    res.status(404).json({ error: "accessibility profile not found" });
    return;
  }
  res.json(profile);
});

/**
 * POST /api/a11y-profiles/strictest — pick the strictest profile from a set
 * of profile ids. Body: { ids: string[] }. Useful when multiple accessibility
 * considerations apply and the intersection is the most restrictive profile.
 */
catalogRouter.post("/a11y-profiles/strictest", (req, res) => {
  const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const ids: string[] = rawIds.filter((id: unknown): id is string => typeof id === "string");
  const profiles = ids
    .map((id) => getAccessibilityProfile(id))
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const strictest = pickStrictestProfile(profiles);
  res.json({
    inputIds: ids,
    resolvedIds: profiles.map((p) => p.id),
    strictest,
  });
});

/**
 * GET /api/cursor-choreography — list all cursor choreography presets.
 * Optional ?pattern= filter narrows by cursor pattern type.
 */
catalogRouter.get("/cursor-choreography", (req, res) => {
  const pattern = typeof req.query.pattern === "string"
    ? (req.query.pattern as CursorPattern)
    : undefined;
  const presets = listCursorChoreography(pattern);
  res.json({ presets, count: presets.length });
});

/**
 * GET /api/cursor-choreography/match — pick the cursor choreography preset
 * whose tags best match a free-text query (e.g. ?q=playful grid). Registered
 * before /:id so "match" is not treated as an id.
 */
catalogRouter.get("/cursor-choreography/match", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (!q) {
    res.status(400).json({ error: "q query parameter is required" });
    return;
  }
  const preset = matchCursorChoreography(q);
  res.json({ query: q, match: preset ?? null });
});

/** GET /api/cursor-choreography/:id — fetch a single cursor choreography preset by id. */
catalogRouter.get("/cursor-choreography/:id", (req, res) => {
  const preset = getCursorChoreography(req.params.id);
  if (!preset) {
    res.status(404).json({ error: "cursor choreography preset not found" });
    return;
  }
  res.json(preset);
});
