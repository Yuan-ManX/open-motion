/**
 * Project-level Motion Recipe system — save, load, and apply reusable motion
 * units stored as JSON in project tokens. Complements the curated recipe library
 * in recipes.ts by allowing users to capture and reuse their own motion patterns.
 *
 * A ProjectRecipe captures a complete motion configuration from an existing
 * component: easing, duration, delay, loop, direction, trigger, and keyframe
 * property hints. It also carries intent keywords and avoidance conditions for
 * context-aware matching by the Agent.
 */

import type { Easing, MotionComponent } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";

export interface ProjectRecipe {
  id: string;
  name: string;
  description: string;
  intentKeywords: string[];
  avoidWhen: string[];
  durationMs: number;
  delayMs: number;
  iterationCount: number | "infinite";
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  easing: Easing;
  trigger: string;
  propertyHints: string[];
  restraintLevel: number;
  createdAt: string;
}

export interface ProjectRecipeSummary {
  id: string;
  name: string;
  description: string;
  intentKeywords: string[];
  durationMs: number;
  easingType: string;
  trigger: string;
}

const PROJECT_RECIPES_KEY = "__projectRecipes";

function genId(): string {
  return `precipe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Read project recipes from tokens. */
export function readProjectRecipes(tokens: Record<string, string | number>): ProjectRecipe[] {
  const raw = tokens[PROJECT_RECIPES_KEY];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ProjectRecipe[];
  } catch {
    return [];
  }
}

/** Write project recipes to tokens (returns updated tokens). */
export function writeProjectRecipes(
  tokens: Record<string, string | number>,
  recipes: ProjectRecipe[],
): Record<string, string | number> {
  return { ...tokens, [PROJECT_RECIPES_KEY]: JSON.stringify(recipes) };
}

/** Save a recipe derived from a component's current motion parameters. */
export function saveProjectRecipe(
  component: MotionComponent,
  options: {
    name: string;
    description?: string;
    intentKeywords?: string[];
    avoidWhen?: string[];
    restraintLevel?: number;
  },
  tokens: Record<string, string | number>,
): { recipe: ProjectRecipe; tokens: Record<string, string | number> } {
  const recipes = readProjectRecipes(tokens);
  const recipe: ProjectRecipe = {
    id: genId(),
    name: options.name,
    description: options.description ?? `Motion recipe captured from "${component.name}"`,
    intentKeywords: options.intentKeywords ?? [],
    avoidWhen: options.avoidWhen ?? [],
    durationMs: component.durationMs,
    delayMs: component.delayMs,
    iterationCount: component.iterationCount,
    direction: component.direction,
    easing: component.easing,
    trigger: component.trigger,
    propertyHints: extractPropertyHints(component),
    restraintLevel: options.restraintLevel ?? 5,
    createdAt: new Date().toISOString(),
  };
  const updated = writeProjectRecipes(tokens, [...recipes, recipe]);
  return { recipe, tokens: updated };
}

/** Apply a recipe's parameters to a component (returns a patch object). */
export function applyProjectRecipe(recipe: ProjectRecipe): Partial<MotionComponent> {
  return {
    durationMs: recipe.durationMs,
    delayMs: recipe.delayMs,
    iterationCount: recipe.iterationCount,
    direction: recipe.direction,
    easing: recipe.easing,
    trigger: recipe.trigger as MotionComponent["trigger"],
  };
}

/** Delete a project recipe by ID. */
export function deleteProjectRecipe(
  recipeId: string,
  tokens: Record<string, string | number>,
): Record<string, string | number> {
  const recipes = readProjectRecipes(tokens).filter((r) => r.id !== recipeId);
  return writeProjectRecipes(tokens, recipes);
}

/** Find a project recipe by ID. */
export function findProjectRecipe(
  recipeId: string,
  tokens: Record<string, string | number>,
): ProjectRecipe | undefined {
  return readProjectRecipes(tokens).find((r) => r.id === recipeId);
}

/** Summarize project recipes for display. */
export function summarizeProjectRecipes(tokens: Record<string, string | number>): ProjectRecipeSummary[] {
  return readProjectRecipes(tokens).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    intentKeywords: r.intentKeywords,
    durationMs: r.durationMs,
    easingType: r.easing.type === "preset" ? r.easing.name : r.easing.type,
    trigger: r.trigger,
  }));
}

/** Match project recipes by intent keywords (returns ranked list). */
export function matchProjectRecipesByIntent(
  text: string,
  tokens: Record<string, string | number>,
  limit = 5,
): ProjectRecipe[] {
  const recipes = readProjectRecipes(tokens);
  const lower = text.toLowerCase();
  const scored = recipes.map((r) => {
    let score = 0;
    for (const kw of r.intentKeywords) {
      if (lower.includes(kw.toLowerCase())) score += 2;
    }
    if (lower.includes(r.name.toLowerCase())) score += 3;
    return { recipe: r, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.recipe);
}

function extractPropertyHints(component: MotionComponent): string[] {
  const hints = new Set<string>();
  for (const kf of component.keyframes) {
    for (const key of Object.keys(kf.properties)) {
      hints.add(key);
    }
  }
  return Array.from(hints);
}

/** Built-in project recipe presets for seeding. */
export const PROJECT_RECIPE_PRESETS: Array<Omit<ProjectRecipe, "id" | "createdAt">> = [
  {
    name: "Gentle Entrance",
    description: "Soft fade-in with slight upward drift — welcoming and unobtrusive.",
    intentKeywords: ["entrance", "fade", "soft", "welcome", "appear"],
    avoidWhen: ["urgent", "alert", "error"],
    durationMs: 600,
    delayMs: 0,
    iterationCount: 1,
    direction: "normal",
    easing: easingPreset("smooth"),
    trigger: "onLoad",
    propertyHints: ["opacity", "translateY"],
    restraintLevel: 7,
  },
  {
    name: "Confident Reveal",
    description: "Bold scale-up with slight overshoot — confident and attention-grabbing.",
    intentKeywords: ["reveal", "scale", "bold", "confident", "showcase"],
    avoidWhen: ["subtle", "background", "ambient"],
    durationMs: 500,
    delayMs: 100,
    iterationCount: 1,
    direction: "normal",
    easing: easingPreset("back"),
    trigger: "onLoad",
    propertyHints: ["scale", "opacity"],
    restraintLevel: 4,
  },
  {
    name: "Playful Bounce",
    description: "Energetic bounce with spring physics — fun and engaging.",
    intentKeywords: ["playful", "bounce", "fun", "energetic", "spring"],
    avoidWhen: ["professional", "serious", "corporate"],
    durationMs: 800,
    delayMs: 0,
    iterationCount: 1,
    direction: "normal",
    easing: easingPreset("bounce"),
    trigger: "onClick",
    propertyHints: ["translateY", "scale"],
    restraintLevel: 3,
  },
  {
    name: "Ambient Breath",
    description: "Subtle continuous breathing — ambient and alive without distraction.",
    intentKeywords: ["ambient", "breathing", "alive", "subtle", "loop"],
    avoidWhen: ["emphasis", "alert", "action"],
    durationMs: 3000,
    delayMs: 0,
    iterationCount: "infinite",
    direction: "alternate",
    easing: easingPreset("smooth"),
    trigger: "onLoad",
    propertyHints: ["opacity", "scale"],
    restraintLevel: 8,
  },
  {
    name: "Snappy Click",
    description: "Quick scale pop on interaction — responsive and tactile.",
    intentKeywords: ["click", "tap", "pop", "snappy", "responsive"],
    avoidWhen: ["slow", "ambient", "cinematic"],
    durationMs: 200,
    delayMs: 0,
    iterationCount: 1,
    direction: "normal",
    easing: easingPreset("snappy"),
    trigger: "onClick",
    propertyHints: ["scale"],
    restraintLevel: 6,
  },
];

/** Seed a project with recipe presets. */
export function seedProjectRecipes(
  tokens: Record<string, string | number>,
): Record<string, string | number> {
  const existing = readProjectRecipes(tokens);
  const now = new Date().toISOString();
  const presets: ProjectRecipe[] = PROJECT_RECIPE_PRESETS.map((p) => ({
    ...p,
    id: genId(),
    createdAt: now,
  }));
  return writeProjectRecipes(tokens, [...existing, ...presets]);
}
