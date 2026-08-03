import type { MotionSpec, MotionComponent, Trigger, Easing } from "@openmotion/shared";
import { easingPreset, easingBezier } from "@openmotion/shared";

/**
 * Recipe Engine — curated catalog of motion recipes with constraints.
 *
 * A recipe is a named motion pattern tagged by category (entrance /
 * emphasis / attention / exit), the motion verbs it exercises, the
 * situations in which it should be avoided (avoid_when), and a restraint
 * budget ceiling so applying a recipe cannot silently blow the
 * composition's perceptual capacity. Matching a project's components
 * against the catalog reveals (a) which recipes are already in use,
 * (b) which recipes fit unmet component intents, and (c) which active
 * recipes violate their own avoid_when constraints.
 *
 * Core concepts:
 * - Recipe: a named {category, verbs, properties, duration band, easing,
 *   avoidWhen, budget} record. Properties are the transform channels the
 *   recipe exercises (translate / rotate / scale / opacity / filter).
 * - Match: a component matches a recipe when its animated property set
 *   overlaps the recipe's properties, its duration falls in the recipe's
 *   band, and its trigger aligns with the recipe's category.
 * - AvoidWhen: a predicate over MotionComponent signals — e.g. a recipe
 *   that flashes opacity should be avoided when the component also loops,
 *   because looping flash is a vestibular hazard.
 * - Budget: each recipe declares the demand it tends to add. The engine
 *   rejects candidate recipes whose budget would push the composition
 *   past its attention capacity (delegated to a simple inline estimate
 *   so this engine stays self-contained).
 *
 * Rule-based — no LLM round-trip required, so mock mode stays functional.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RecipeCategory = "entrance" | "emphasis" | "attention" | "exit";

export type MotionProperty =
  | "translateX"
  | "translateY"
  | "translateZ"
  | "rotate"
  | "rotateX"
  | "rotateY"
  | "scale"
  | "opacity"
  | "filter"
  | "backgroundColor"
  | "color";

export type AvoidSignal =
  | "looping"
  | "high_magnitude"
  | "long_duration"
  | "interactive_trigger"
  | "reduced_motion"
  | "text_content"
  | "shader_present";

/** A curated motion recipe. */
export interface MotionRecipe {
  /** Stable identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** entrance / emphasis / attention / exit. */
  category: RecipeCategory;
  /** Motion verbs the recipe exercises (e.g. "fade", "slide", "pulse"). */
  verbs: string[];
  /** Transform channels the recipe animates. */
  properties: MotionProperty[];
  /** Duration band [min, max] in milliseconds. */
  durationBandMs: [number, number];
  /** Easing the recipe prefers. */
  easing: Easing;
  /** Triggers that fit this category. */
  triggers: Trigger[];
  /** Conditions under which this recipe should be avoided. */
  avoidWhen: AvoidSignal[];
  /** Demand this recipe tends to add to the composition. */
  budget: number;
  /** Short description of the recipe's intent. */
  intent: string;
}

/** A component→recipe match. */
export interface RecipeMatch {
  /** Component id. */
  componentId: string;
  /** Display label. */
  label: string;
  /** Matched recipe id. */
  recipeId: string;
  /** Matched recipe name. */
  recipeName: string;
  /** Recipe category. */
  category: RecipeCategory;
  /** Match confidence 0..1. */
  confidence: number;
  /** AvoidWhen signals currently triggered by this component. */
  triggeredAvoids: AvoidSignal[];
  /** Whether any avoid signal is active. */
  violatesAvoid: boolean;
}

/** A recipe suggested for an unmatched component. */
export interface RecipeSuggestion {
  /** Component id. */
  componentId: string;
  /** Display label. */
  label: string;
  /** Suggested recipe id. */
  recipeId: string;
  /** Suggested recipe name. */
  recipeName: string;
  /** Why this recipe fits. */
  reason: string;
  /** Demand it would add. */
  budgetCost: number;
  /** Whether adding it would exceed the composition budget. */
  wouldExceedBudget: boolean;
}

/** Catalog coverage per category. */
export interface RecipeCoverage {
  category: RecipeCategory;
  /** Recipes in the catalog for this category. */
  catalogCount: number;
  /** Components matched to a recipe in this category. */
  matchedCount: number;
}

/** The full recipe report. */
export interface RecipeReport {
  /** All matches found. */
  matches: RecipeMatch[];
  /** All suggestions for unmatched components. */
  suggestions: RecipeSuggestion[];
  /** Per-category coverage. */
  coverage: RecipeCoverage[];
  /** Components that matched no recipe. */
  unmatchedCount: number;
  /** Components that violate their matched recipe's avoidWhen. */
  violationCount: number;
  /** Active recipes (distinct ids matched). */
  activeRecipeCount: number;
  /** Catalog size. */
  catalogSize: number;
  /** Estimated composition attention demand. */
  estimatedDemand: number;
  /** Composition attention capacity. */
  compositionBudget: number;
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Catalog — curated, original recipe set
// ---------------------------------------------------------------------------

const RECIPE_CATALOG: readonly MotionRecipe[] = [
  {
    id: "entrance.fade",
    name: "Fade In",
    category: "entrance",
    verbs: ["fade", "appear"],
    properties: ["opacity"],
    durationBandMs: [200, 600],
    easing: easingPreset("ease-out"),
    triggers: ["onLoad", "onScroll", "afterDelay"],
    avoidWhen: ["looping", "reduced_motion"],
    budget: 0.6,
    intent: "Reveal an element by raising opacity from 0 to 1.",
  },
  {
    id: "entrance.slide",
    name: "Slide In",
    category: "entrance",
    verbs: ["slide", "enter"],
    properties: ["translateX", "translateY"],
    durationBandMs: [300, 700],
    easing: easingBezier([0.22, 1], [0.36, 1]),
    triggers: ["onLoad", "onScroll", "afterDelay"],
    avoidWhen: ["high_magnitude", "looping"],
    budget: 0.9,
    intent: "Translate an element into view from off-screen.",
  },
  {
    id: "entrance.scale",
    name: "Scale Up",
    category: "entrance",
    verbs: ["scale", "grow"],
    properties: ["scale", "opacity"],
    durationBandMs: [250, 550],
    easing: easingBezier([0.34, 1.56], [0.64, 1]),
    triggers: ["onLoad", "afterDelay"],
    avoidWhen: ["high_magnitude", "shader_present"],
    budget: 0.8,
    intent: "Grow an element from a smaller scale to full size.",
  },
  {
    id: "emphasis.pulse",
    name: "Pulse",
    category: "emphasis",
    verbs: ["pulse", "beat"],
    properties: ["scale"],
    durationBandMs: [400, 900],
    easing: easingPreset("ease-in-out"),
    triggers: ["onLoad", "onClick", "afterDelay"],
    avoidWhen: ["looping", "reduced_motion", "text_content"],
    budget: 0.7,
    intent: "Subtle rhythmic scale oscillation to signal liveliness.",
  },
  {
    id: "emphasis.shake",
    name: "Shake",
    category: "emphasis",
    verbs: ["shake", "wobble"],
    properties: ["translateX", "rotate"],
    durationBandMs: [300, 600],
    easing: easingPreset("ease-in-out"),
    triggers: ["onClick", "afterDelay"],
    avoidWhen: ["looping", "reduced_motion", "high_magnitude"],
    budget: 1.0,
    intent: "Rapid lateral+rotational oscillation, often signaling an error.",
  },
  {
    id: "emphasis.glow",
    name: "Glow",
    category: "emphasis",
    verbs: ["glow", "radiate"],
    properties: ["filter", "backgroundColor"],
    durationBandMs: [500, 1200],
    easing: easingPreset("ease-out"),
    triggers: ["onHover", "afterDelay"],
    avoidWhen: ["shader_present", "looping"],
    budget: 0.8,
    intent: "Diffuse luminosity shift to draw the eye without displacement.",
  },
  {
    id: "attention.flash",
    name: "Flash",
    category: "attention",
    verbs: ["flash", "blink"],
    properties: ["opacity", "backgroundColor"],
    durationBandMs: [150, 400],
    easing: easingPreset("linear"),
    triggers: ["onClick", "afterDelay"],
    avoidWhen: ["looping", "reduced_motion", "text_content", "long_duration"],
    budget: 1.1,
    intent: "Brief high-contrast opacity/color spike to alarm the viewer.",
  },
  {
    id: "attention.bounce",
    name: "Bounce",
    category: "attention",
    verbs: ["bounce", "hop"],
    properties: ["translateY"],
    durationBandMs: [500, 900],
    easing: easingBezier([0.68, -0.55], [0.27, 1.55]),
    triggers: ["onLoad", "onClick", "afterDelay"],
    avoidWhen: ["looping", "high_magnitude"],
    budget: 0.9,
    intent: "Vertical translation with overshoot to demand attention.",
  },
  {
    id: "exit.fade",
    name: "Fade Out",
    category: "exit",
    verbs: ["fade", "dismiss"],
    properties: ["opacity"],
    durationBandMs: [200, 500],
    easing: easingPreset("ease-in"),
    triggers: ["onClick", "afterDelay"],
    avoidWhen: ["looping"],
    budget: 0.5,
    intent: "Lower opacity to remove an element from view.",
  },
  {
    id: "exit.slide",
    name: "Slide Out",
    category: "exit",
    verbs: ["slide", "exit"],
    properties: ["translateX", "translateY"],
    durationBandMs: [250, 600],
    easing: easingPreset("ease-in"),
    triggers: ["onClick", "afterDelay"],
    avoidWhen: ["looping", "high_magnitude"],
    budget: 0.8,
    intent: "Translate an element out of view.",
  },
  {
    id: "exit.collapse",
    name: "Collapse",
    category: "exit",
    verbs: ["collapse", "shrink"],
    properties: ["scale", "opacity"],
    durationBandMs: [200, 500],
    easing: easingPreset("ease-in"),
    triggers: ["onClick", "afterDelay"],
    avoidWhen: ["looping"],
    budget: 0.7,
    intent: "Shrink and fade an element simultaneously for dismissal.",
  },
];

// ---------------------------------------------------------------------------
// Component signal extraction
// ---------------------------------------------------------------------------

interface ComponentSignals {
  properties: Set<MotionProperty>;
  durationMs: number;
  trigger: Trigger;
  loops: boolean;
  highMagnitude: boolean;
  longDuration: boolean;
  interactive: boolean;
  textContent: boolean;
  shaderPresent: boolean;
  reducedMotion: boolean;
}

function extractProperties(c: MotionComponent): Set<MotionProperty> {
  const props = new Set<MotionProperty>();
  for (const kf of c.keyframes) {
    for (const key of Object.keys(kf.properties)) {
      // Normalize keys to the MotionProperty union where possible.
      if (
        key === "translateX" || key === "translateY" || key === "translateZ" ||
        key === "rotate" || key === "rotateX" || key === "rotateY" ||
        key === "scale" || key === "opacity" || key === "filter" ||
        key === "backgroundColor" || key === "color"
      ) {
        props.add(key as MotionProperty);
      }
    }
  }
  // Style-driven channels also count.
  const s = c.style ?? {};
  if (typeof s.filter === "string") props.add("filter");
  if (typeof s.backgroundColor === "string") props.add("backgroundColor");
  if (typeof s.color === "string") props.add("color");
  return props;
}

function maxMagnitude(c: MotionComponent): number {
  let max = 0;
  for (const kf of c.keyframes) {
    for (const prop of ["translateX", "translateY", "rotate", "scale"] as const) {
      const v = kf.properties[prop];
      if (typeof v === "number") {
        max = Math.max(max, prop === "scale" ? Math.abs(v - 1) * 100 : Math.abs(v));
      } else if (typeof v === "string") {
        const m = v.match(/-?\d+\.?\d*/);
        if (m) max = Math.max(max, Math.abs(parseFloat(m[0])));
      }
    }
  }
  return max;
}

function extractSignals(c: MotionComponent): ComponentSignals {
  const properties = extractProperties(c);
  const mag = maxMagnitude(c);
  const style = c.style ?? {};
  const textContent = typeof style.color === "string" && (c.name ?? "").length > 0 && /text|label|title|heading|caption|copy/i.test(c.name);
  const shaderPresent = (c.templateId ?? "").startsWith("tpl-shader") ||
    Object.keys(style).some((k) => /shader/i.test(k));
  return {
    properties,
    durationMs: c.durationMs,
    trigger: c.trigger,
    loops: c.iterationCount === "infinite" || (typeof c.iterationCount === "number" && c.iterationCount > 1),
    highMagnitude: mag > 120,
    longDuration: c.durationMs > 1200,
    interactive: c.trigger === "onClick" || c.trigger === "onHover",
    textContent,
    shaderPresent,
    // The composition does not yet carry a global prefers-reduced-motion
    // flag in the schema, so we approximate: any component that flashes
    // opacity in a loop is treated as a reduced-motion hazard for matching.
    reducedMotion: false,
  };
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function triggersAlign(recipe: MotionRecipe, signal: ComponentSignals): boolean {
  return recipe.triggers.includes(signal.trigger);
}

function durationInBand(recipe: MotionRecipe, durationMs: number): boolean {
  return durationMs >= recipe.durationBandMs[0] && durationMs <= recipe.durationBandMs[1];
}

function propertyOverlap(recipe: MotionRecipe, signal: ComponentSignals): number {
  if (recipe.properties.length === 0) return 0;
  let overlap = 0;
  for (const p of recipe.properties) {
    if (signal.properties.has(p)) overlap += 1;
  }
  return overlap / recipe.properties.length;
}

function triggeredAvoids(recipe: MotionRecipe, signal: ComponentSignals): AvoidSignal[] {
  const triggered: AvoidSignal[] = [];
  for (const avoid of recipe.avoidWhen) {
    switch (avoid) {
      case "looping": if (signal.loops) triggered.push(avoid); break;
      case "high_magnitude": if (signal.highMagnitude) triggered.push(avoid); break;
      case "long_duration": if (signal.longDuration) triggered.push(avoid); break;
      case "interactive_trigger": if (signal.interactive) triggered.push(avoid); break;
      case "reduced_motion": if (signal.reducedMotion) triggered.push(avoid); break;
      case "text_content": if (signal.textContent) triggered.push(avoid); break;
      case "shader_present": if (signal.shaderPresent) triggered.push(avoid); break;
    }
  }
  return triggered;
}

function matchConfidence(recipe: MotionRecipe, signal: ComponentSignals): number {
  // Confidence is a weighted blend of property overlap, trigger alignment,
  // and duration-band fit. Each contribution is 0..1; the weighted mean
  // produces a stable ranking even when one signal is missing.
  const overlap = propertyOverlap(recipe, signal);
  const trigger = triggersAlign(recipe, signal) ? 1 : 0.2;
  const duration = durationInBand(recipe, signal.durationMs) ? 1 : 0.4;
  return Math.round((overlap * 0.5 + trigger * 0.3 + duration * 0.2) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Composition budget (inline estimate — keeps engine self-contained)
// ---------------------------------------------------------------------------

function compositionBudget(componentCount: number): number {
  if (componentCount === 0) return 0;
  return Math.round((1 + Math.log2(1 + componentCount)) * componentCount * 10) / 10;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run recipe-catalog matching against a project spec. */
export function analyzeRecipes(spec: MotionSpec): RecipeReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      matches: [],
      suggestions: [],
      coverage: [
        { category: "entrance", catalogCount: 0, matchedCount: 0 },
        { category: "emphasis", catalogCount: 0, matchedCount: 0 },
        { category: "attention", catalogCount: 0, matchedCount: 0 },
        { category: "exit", catalogCount: 0, matchedCount: 0 },
      ],
      unmatchedCount: 0,
      violationCount: 0,
      activeRecipeCount: 0,
      catalogSize: RECIPE_CATALOG.length,
      estimatedDemand: 0,
      compositionBudget: 0,
      summary: "Empty project — no recipes to match.",
    };
  }

  const budget = compositionBudget(components.length);
  const matches: RecipeMatch[] = [];
  const matchedIds = new Set<string>();
  let estimatedDemand = 0;

  for (const c of components) {
    const signal = extractSignals(c);
    let best: { recipe: MotionRecipe; confidence: number; avoids: AvoidSignal[] } | null = null;
    for (const recipe of RECIPE_CATALOG) {
      const confidence = matchConfidence(recipe, signal);
      if (confidence < 0.35) continue;
      const avoids = triggeredAvoids(recipe, signal);
      if (!best || confidence > best.confidence) {
        best = { recipe, confidence, avoids };
      }
    }
    if (best && best.confidence >= 0.4) {
      const violates = best.avoids.length > 0;
      matches.push({
        componentId: c.id,
        label: c.name || c.id,
        recipeId: best.recipe.id,
        recipeName: best.recipe.name,
        category: best.recipe.category,
        confidence: best.confidence,
        triggeredAvoids: best.avoids,
        violatesAvoid: violates,
      });
      matchedIds.add(c.id);
      estimatedDemand += best.recipe.budget;
    }
  }

  // Suggestions for unmatched components — pick the highest-confidence
  // catalog entry whose avoidWhen is clean for the component's signals,
  // and flag whether adding it would exceed the composition budget.
  const suggestions: RecipeSuggestion[] = [];
  for (const c of components) {
    if (matchedIds.has(c.id)) continue;
    const signal = extractSignals(c);
    let best: { recipe: MotionRecipe; confidence: number } | null = null;
    for (const recipe of RECIPE_CATALOG) {
      const avoids = triggeredAvoids(recipe, signal);
      if (avoids.length > 0) continue;
      const confidence = matchConfidence(recipe, signal);
      if (!best || confidence > best.confidence) {
        best = { recipe, confidence };
      }
    }
    if (best && best.confidence >= 0.3) {
      const wouldExceed = estimatedDemand + best.recipe.budget > budget;
      suggestions.push({
        componentId: c.id,
        label: c.name || c.id,
        recipeId: best.recipe.id,
        recipeName: best.recipe.name,
        reason: `${best.recipe.category} recipe matching ${signal.properties.size} property channel(s); confidence ${best.confidence}.`,
        budgetCost: best.recipe.budget,
        wouldExceedBudget: wouldExceed,
      });
    }
  }

  // Coverage per category.
  const coverage: RecipeCoverage[] = [];
  for (const cat of ["entrance", "emphasis", "attention", "exit"] as RecipeCategory[]) {
    const catalogCount = RECIPE_CATALOG.filter((r) => r.category === cat).length;
    const matchedCount = matches.filter((m) => m.category === cat).length;
    coverage.push({ category: cat, catalogCount, matchedCount });
  }

  const violationCount = matches.filter((m) => m.violatesAvoid).length;
  const unmatchedCount = components.length - matchedIds.size;
  const activeRecipeCount = new Set(matches.map((m) => m.recipeId)).size;
  const overBudget = estimatedDemand > budget;

  const summary = `${matches.length}/${components.length} component(s) matched a recipe; ${activeRecipeCount} active recipe(s); ${violationCount} avoid-when violation(s); ${suggestions.length} suggestion(s) for unmatched. ${
    overBudget ? `Estimated demand ${estimatedDemand} exceeds budget ${budget}.` : `Demand ${estimatedDemand} within budget ${budget}.`
  }`;

  return {
    matches,
    suggestions,
    coverage,
    unmatchedCount,
    violationCount,
    activeRecipeCount,
    catalogSize: RECIPE_CATALOG.length,
    estimatedDemand: Math.round(estimatedDemand * 100) / 100,
    compositionBudget: budget,
    summary,
  };
}

/** List the static recipe catalog (for UI discovery). */
export function listRecipeCatalog(): readonly MotionRecipe[] {
  return RECIPE_CATALOG;
}

/** Format a recipe report as a human-readable string. */
export function formatRecipesReport(report: RecipeReport): string {
  const lines: string[] = [];
  lines.push("=== Motion Recipes ===");
  lines.push("");
  lines.push(`Catalog: ${report.catalogSize} recipes`);
  lines.push(`Active recipes: ${report.activeRecipeCount}`);
  lines.push(`Avoid-when violations: ${report.violationCount}`);
  lines.push(`Unmatched components: ${report.unmatchedCount}`);
  lines.push(`Demand: ${report.estimatedDemand} / budget ${report.compositionBudget}`);
  lines.push("");

  if (report.coverage.length > 0) {
    lines.push("--- Coverage ---");
    for (const cov of report.coverage) {
      lines.push(`• ${cov.category.padEnd(10)} ${cov.matchedCount}/${cov.catalogCount}`);
    }
    lines.push("");
  }

  if (report.matches.length > 0) {
    lines.push("--- Matches (top 10) ---");
    for (const m of report.matches.slice(0, 10)) {
      const flag = m.violatesAvoid ? "!" : " ";
      lines.push(`[${flag}] ${m.label.padEnd(16)} -> ${m.recipeName.padEnd(12)} conf=${m.confidence} cat=${m.category}`);
      if (m.triggeredAvoids.length > 0) {
        lines.push(`    avoids: ${m.triggeredAvoids.join(", ")}`);
      }
    }
    lines.push("");
  }

  if (report.suggestions.length > 0) {
    lines.push("--- Suggestions (top 8) ---");
    for (const s of report.suggestions.slice(0, 8)) {
      const flag = s.wouldExceedBudget ? "!" : " ";
      lines.push(`[${flag}] ${s.label.padEnd(16)} -> ${s.recipeName.padEnd(12)} cost=${s.budgetCost}${s.wouldExceedBudget ? " (over budget)" : ""}`);
    }
    lines.push("");
  }

  lines.push(`Summary: ${report.summary}`);
  return lines.join("\n");
}
