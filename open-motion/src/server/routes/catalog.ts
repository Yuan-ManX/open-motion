import { Router } from "express";
import { listPresets as listStateMachinePresetIds, getPreset } from "../../motion/stateMachine.js";
import { listRecipes, getRecipe } from "../../motion/recipes.js";
import { listStylePresets } from "../../motion/stylePresets.js";
import { listShaderEffects } from "../../motion/shaders.js";
import { BRAND_PACK_PRESETS } from "../../motion/brandPack.js";
import { listMoods } from "../../motion/moodEngine.js";

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
catalogRouter.get("/state-machine-presets", (_req, res) => {
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
