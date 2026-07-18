import { now } from "../utils/id.js";
import { getDb } from "../db/index.js";

/**
 * Curated motion recipe library with restraint metadata.
 *
 * Each recipe carries an `avoid_when` list — situations where applying the
 * recipe would harm the composition. The restraint engine uses this to
 * prevent the agent from stacking incompatible effects.
 *
 * Recipes are also exportable as SKILL.md for cross-project portability.
 */

export interface MotionRecipe {
  id: string;
  name: string;
  category: string;
  description: string;
  avoidWhen: string[];
  restraintCost: number;
  recipe: Record<string, unknown>;
  skillMarkdown: string;
  tags: string[];
}

interface RecipeRow {
  id: string;
  name: string;
  category: string;
  description: string;
  avoid_when: string;
  restraint_cost: number;
  recipe_json: string;
  skill_markdown: string;
  tags_json: string;
  created_at: string;
}

function rowToRecipe(r: RecipeRow): MotionRecipe {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    description: r.description,
    avoidWhen: JSON.parse(r.avoid_when) as string[],
    restraintCost: r.restraint_cost,
    recipe: JSON.parse(r.recipe_json) as Record<string, unknown>,
    skillMarkdown: r.skill_markdown,
    tags: JSON.parse(r.tags_json) as string[],
  };
}

/** Seed the recipe library with curated entries. Called during migration. */
export function seedRecipes(): void {
  const db = getDb();
  const ts = now();
  const recipes: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    avoid_when: string[];
    restraint_cost: number;
    recipe_json: string;
    skill_markdown: string;
    tags_json: string;
  }> = [
    {
      id: "recipe-gentle-entrance",
      name: "Gentle Entrance",
      category: "entrance",
      description: "Soft fade + subtle upward drift for content appearing on screen.",
      avoid_when: ["bold-action", "alert", "playful-bounce", "more-than-5-simultaneous"],
      restraint_cost: 1,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-out" },
        durationMs: 600,
        keyframes: [
          { offset: 0, properties: { opacity: 0, translateY: 20 } },
          { offset: 1, properties: { opacity: 1, translateY: 0 } },
        ],
      }),
      skill_markdown: `# Gentle Entrance\n\nSoft fade with upward drift. Best for content sections.\n\n**Avoid when:** bold action needed, alerts, or 5+ simultaneous entrances.\n\n**Restraint cost:** 1 (minimal)`,
      tags_json: JSON.stringify(["entrance", "subtle", "content"]),
    },
    {
      id: "recipe-impact-reveal",
      name: "Impact Reveal",
      category: "entrance",
      description: "Scale + opacity punch for hero elements that demand attention.",
      avoid_when: ["subtle-context", "background-element", "more-than-3-simultaneous", "already-has-bounce"],
      restraint_cost: 3,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "cubic-bezier" },
        durationMs: 800,
        keyframes: [
          { offset: 0, properties: { opacity: 0, scale: 0.8 } },
          { offset: 0.6, properties: { scale: 1.05 } },
          { offset: 1, properties: { opacity: 1, scale: 1 } },
        ],
      }),
      skill_markdown: `# Impact Reveal\n\nScale punch for hero elements. High attention demand.\n\n**Avoid when:** subtle context, background elements, or 3+ simultaneous impacts.\n\n**Restraint cost:** 3 (moderate)`,
      tags_json: JSON.stringify(["entrance", "hero", "impact"]),
    },
    {
      id: "recipe-elastic-bounce",
      name: "Elastic Bounce",
      category: "playful",
      description: "Spring-based overshoot for playful, energetic interactions.",
      avoid_when: ["professional-tone", "error-state", "data-table", "more-than-2-simultaneous"],
      restraint_cost: 4,
      recipe_json: JSON.stringify({
        easing: { type: "spring", stiffness: 170, damping: 12, mass: 1 },
        durationMs: 1000,
        keyframes: [
          { offset: 0, properties: { scale: 0 } },
          { offset: 1, properties: { scale: 1 } },
        ],
      }),
      skill_markdown: `# Elastic Bounce\n\nSpring overshoot for playful energy.\n\n**Avoid when:** professional tone, error states, data tables, or 2+ simultaneous bounces.\n\n**Restraint cost:** 4 (high)`,
      tags_json: JSON.stringify(["playful", "spring", "bounce"]),
    },
    {
      id: "recipe-cinematic-fade",
      name: "Cinematic Fade",
      category: "transition",
      description: "Slow opacity cross-fade with slight scale for scene transitions.",
      avoid_when: ["fast-interaction", "ui-feedback", "loading-state"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 1200,
        keyframes: [
          { offset: 0, properties: { opacity: 0, scale: 1.05 } },
          { offset: 1, properties: { opacity: 1, scale: 1 } },
        ],
      }),
      skill_markdown: `# Cinematic Fade\n\nSlow cross-fade for scene transitions.\n\n**Avoid when:** fast interactions, UI feedback, loading states.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["transition", "cinematic", "fade"]),
    },
    {
      id: "recipe-data-pulse",
      name: "Data Pulse",
      category: "feedback",
      description: "Quick scale pulse for data update notifications.",
      avoid_when: ["hero-element", "initial-entrance", "more-than-4-simultaneous"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-out" },
        durationMs: 400,
        keyframes: [
          { offset: 0, properties: { scale: 1 } },
          { offset: 0.5, properties: { scale: 1.08 } },
          { offset: 1, properties: { scale: 1 } },
        ],
      }),
      skill_markdown: `# Data Pulse\n\nQuick scale pulse for data updates.\n\n**Avoid when:** hero elements, initial entrance, or 4+ simultaneous pulses.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["feedback", "data", "pulse"]),
    },
    {
      id: "recipe-ambient-float",
      name: "Ambient Float",
      category: "ambient",
      description: "Gentle infinite floating loop for ambient background motion.",
      avoid_when: ["foreground-content", "text-heavy", "more-than-2-simultaneous", "performance-critical"],
      restraint_cost: 3,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 3000,
        iterationCount: "infinite",
        direction: "alternate",
        keyframes: [
          { offset: 0, properties: { translateY: 0 } },
          { offset: 1, properties: { translateY: -12 } },
        ],
      }),
      skill_markdown: `# Ambient Float\n\nInfinite floating loop for background ambiance.\n\n**Avoid when:** foreground content, text-heavy areas, 2+ simultaneous floats, or performance-critical contexts.\n\n**Restraint cost:** 3 (moderate)`,
      tags_json: JSON.stringify(["ambient", "loop", "background"]),
    },
    {
      id: "recipe-typewriter-reveal",
      name: "Typewriter Reveal",
      category: "text",
      description: "Character-by-character text reveal with cursor blink.",
      avoid_when: ["long-text", "data-content", "more-than-1-simultaneous"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "linear" },
        durationMs: 1500,
        keyframes: [
          { offset: 0, properties: { width: "0%" } },
          { offset: 1, properties: { width: "100%" } },
        ],
      }),
      skill_markdown: `# Typewriter Reveal\n\nCharacter-by-character text reveal.\n\n**Avoid when:** long text, data content, or multiple simultaneous typewriters.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["text", "typewriter", "reveal"]),
    },
    {
      id: "recipe-magnetic-hover",
      name: "Magnetic Hover",
      category: "interaction",
      description: "Component subtly shifts toward cursor on hover for tactile feedback.",
      avoid_when: ["touch-device", "list-item", "more-than-4-simultaneous"],
      restraint_cost: 1,
      recipe_json: JSON.stringify({
        trigger: "onHover",
        easing: { type: "spring", stiffness: 200, damping: 15, mass: 1 },
        durationMs: 300,
        keyframes: [
          { offset: 0, properties: { translateX: 0, translateY: 0 } },
          { offset: 1, properties: { translateX: 4, translateY: -2 } },
        ],
      }),
      skill_markdown: `# Magnetic Hover\n\nSubtle cursor-following shift on hover.\n\n**Avoid when:** touch devices, list items, or 4+ simultaneous hovers.\n\n**Restraint cost:** 1 (minimal)`,
      tags_json: JSON.stringify(["interaction", "hover", "tactile"]),
    },
    // --- Exit recipes ---
    {
      id: "recipe-swift-dismissal",
      name: "Swift Dismissal",
      category: "exit",
      description: "Quick fade and slide-out for dismissing cards and modals without lingering.",
      avoid_when: ["cinematic-context", "hero-exit", "more-than-3-simultaneous"],
      restraint_cost: 1,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-in-quad" },
        durationMs: 300,
        keyframes: [
          { offset: 0, properties: { opacity: 1, translateX: 0 } },
          { offset: 1, properties: { opacity: 0, translateX: 40 } },
        ],
      }),
      skill_markdown: `# Swift Dismissal\n\nQuick fade and slide for dismissals.\n\n**Avoid when:** cinematic context, hero exits, or 3+ simultaneous dismissals.\n\n**Restraint cost:** 1 (minimal)`,
      tags_json: JSON.stringify(["exit", "dismiss", "quick"]),
    },
    {
      id: "recipe-graceful-departure",
      name: "Graceful Departure",
      category: "exit",
      description: "Slow scale-down with blur for a cinematic, deliberate exit.",
      avoid_when: ["fast-interaction", "list-item", "error-state"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "smooth" },
        durationMs: 700,
        keyframes: [
          { offset: 0, properties: { opacity: 1, scale: 1, blur: "0px" } },
          { offset: 0.5, properties: { opacity: 0.7, scale: 0.95, blur: "2px" } },
          { offset: 1, properties: { opacity: 0, scale: 0.85, blur: "8px" } },
        ],
      }),
      skill_markdown: `# Graceful Departure\n\nCinematic blur and scale-down exit.\n\n**Avoid when:** fast interactions, list items, error states.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["exit", "cinematic", "blur"]),
    },
    // --- Loading recipes ---
    {
      id: "recipe-skeleton-shimmer",
      name: "Skeleton Shimmer",
      category: "loading",
      description: "Gradient sweep across placeholder blocks for loading states.",
      avoid_when: ["loaded-content", "error-state", "more-than-6-simultaneous"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 1500,
        iterationCount: "infinite",
        keyframes: [
          { offset: 0, properties: { backgroundPosition: "-200% 0" } },
          { offset: 1, properties: { backgroundPosition: "200% 0" } },
        ],
      }),
      skill_markdown: `# Skeleton Shimmer\n\nGradient sweep for loading placeholders.\n\n**Avoid when:** content is loaded, error states, or 6+ simultaneous shimmers.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["loading", "skeleton", "shimmer"]),
    },
    {
      id: "recipe-progress-march",
      name: "Progress March",
      category: "loading",
      description: "Determinate progress bar with a pulsing leading edge.",
      avoid_when: ["indeterminate-loading", "background-task"],
      restraint_cost: 1,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-out" },
        durationMs: 500,
        iterationCount: "infinite",
        direction: "alternate",
        keyframes: [
          { offset: 0, properties: { opacity: 0.6 } },
          { offset: 1, properties: { opacity: 1 } },
        ],
      }),
      skill_markdown: `# Progress March\n\nPulsing leading edge for determinate progress.\n\n**Avoid when:** indeterminate loading, background tasks.\n\n**Restraint cost:** 1 (minimal)`,
      tags_json: JSON.stringify(["loading", "progress", "pulse"]),
    },
    // --- Notification recipes ---
    {
      id: "recipe-toast-rise",
      name: "Toast Rise",
      category: "notification",
      description: "Toast slides up from bottom with a subtle scale and auto-dismisses.",
      avoid_when: ["modal-open", "more-than-3-simultaneous", "fullscreen-mode"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "back" },
        durationMs: 400,
        keyframes: [
          { offset: 0, properties: { opacity: 0, translateY: 40, scale: 0.9 } },
          { offset: 1, properties: { opacity: 1, translateY: 0, scale: 1 } },
        ],
      }),
      skill_markdown: `# Toast Rise\n\nSlide-up with scale for toast notifications.\n\n**Avoid when:** modals open, 3+ simultaneous toasts, fullscreen.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["notification", "toast", "slide"]),
    },
    // --- Data viz recipes ---
    {
      id: "recipe-bar-grow",
      name: "Bar Grow",
      category: "data-viz",
      description: "Chart bars grow from baseline with staggered timing for data reveal.",
      avoid_when: ["real-time-data", "more-than-20-bars"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-out" },
        durationMs: 600,
        keyframes: [
          { offset: 0, properties: { scaleY: 0 } },
          { offset: 1, properties: { scaleY: 1 } },
        ],
      }),
      skill_markdown: `# Bar Grow\n\nStaggered bar growth for chart reveals.\n\n**Avoid when:** real-time data, or 20+ bars.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["data-viz", "chart", "grow"]),
    },
    // --- Celebration recipes ---
    {
      id: "recipe-confetti-burst",
      name: "Confetti Burst",
      category: "celebration",
      description: "Particle burst with gravity and rotation for achievement unlocks.",
      avoid_when: ["professional-tone", "error-state", "more-than-1-simultaneous", "accessibility-sensitive"],
      restraint_cost: 5,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-out" },
        durationMs: 2000,
        keyframes: [
          { offset: 0, properties: { opacity: 1, translateY: 0, rotate: 0 } },
          { offset: 0.6, properties: { opacity: 1, translateY: 120, rotate: 180 } },
          { offset: 1, properties: { opacity: 0, translateY: 200, rotate: 360 } },
        ],
      }),
      skill_markdown: `# Confetti Burst\n\nParticle celebration with gravity and rotation.\n\n**Avoid when:** professional tone, error states, multiple simultaneous bursts, or accessibility-sensitive contexts.\n\n**Restraint cost:** 5 (very high)`,
      tags_json: JSON.stringify(["celebration", "confetti", "particles"]),
    },
    {
      id: "recipe-error-shake",
      name: "Error Shake",
      category: "feedback",
      description: "Short horizontal shake for form validation errors and rejected actions.",
      avoid_when: ["playful-tone", "more-than-1-simultaneous", "accessibility-sensitive"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 400,
        keyframes: [
          { offset: 0, properties: { translateX: 0 } },
          { offset: 0.2, properties: { translateX: -8 } },
          { offset: 0.4, properties: { translateX: 8 } },
          { offset: 0.6, properties: { translateX: -6 } },
          { offset: 0.8, properties: { translateX: 6 } },
          { offset: 1, properties: { translateX: 0 } },
        ],
      }),
      skill_markdown: `# Error Shake\n\nHorizontal shake for validation feedback.\n\n**Avoid when:** playful tone, multiple simultaneous shakes, or accessibility-sensitive contexts.\n\n**Restraint cost:** 2 (moderate)`,
      tags_json: JSON.stringify(["feedback", "error", "validation", "shake"]),
    },
    {
      id: "recipe-success-checkmark",
      name: "Success Checkmark",
      category: "feedback",
      description: "Scale-in checkmark with a subtle bounce for successful action confirmation.",
      avoid_when: ["error-state", "loading-state"],
      restraint_cost: 1,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "bounce-out" },
        durationMs: 500,
        keyframes: [
          { offset: 0, properties: { scale: 0, opacity: 0 } },
          { offset: 0.5, properties: { scale: 1.2, opacity: 1 } },
          { offset: 1, properties: { scale: 1, opacity: 1 } },
        ],
      }),
      skill_markdown: `# Success Checkmark\n\nScale-in checkmark with bounce for confirmation.\n\n**Avoid when:** error states or loading states.\n\n**Restraint cost:** 1 (low)`,
      tags_json: JSON.stringify(["feedback", "success", "confirmation", "checkmark"]),
    },
    {
      id: "recipe-modal-open",
      name: "Modal Open",
      category: "transition",
      description: "Scale-up with backdrop fade for modal dialog entrance.",
      avoid_when: ["more-than-1-simultaneous", "embedded-context"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-out" },
        durationMs: 250,
        keyframes: [
          { offset: 0, properties: { scale: 0.9, opacity: 0 } },
          { offset: 1, properties: { scale: 1, opacity: 1 } },
        ],
      }),
      skill_markdown: `# Modal Open\n\nScale-up entrance for modal dialogs.\n\n**Avoid when:** multiple simultaneous modals or embedded contexts.\n\n**Restraint cost:** 2 (moderate)`,
      tags_json: JSON.stringify(["transition", "modal", "dialog", "overlay"]),
    },
    {
      id: "recipe-tab-switch",
      name: "Tab Switch",
      category: "transition",
      description: "Cross-fade with slight horizontal slide for tab content switching.",
      avoid_when: ["fast-switching", "more-than-3-simultaneous"],
      restraint_cost: 1,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 200,
        keyframes: [
          { offset: 0, properties: { opacity: 0, translateX: 12 } },
          { offset: 1, properties: { opacity: 1, translateX: 0 } },
        ],
      }),
      skill_markdown: `# Tab Switch\n\nCross-fade with slide for tab navigation.\n\n**Avoid when:** fast switching or multiple simultaneous switches.\n\n**Restraint cost:** 1 (low)`,
      tags_json: JSON.stringify(["transition", "tab", "navigation", "switch"]),
    },
    {
      id: "recipe-dropdown-reveal",
      name: "Dropdown Reveal",
      category: "transition",
      description: "Height expand with opacity fade for dropdown menu opening.",
      avoid_when: ["more-than-2-simultaneous"],
      restraint_cost: 1,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-out" },
        durationMs: 180,
        keyframes: [
          { offset: 0, properties: { opacity: 0, scaleY: 0.8 } },
          { offset: 1, properties: { opacity: 1, scaleY: 1 } },
        ],
      }),
      skill_markdown: `# Dropdown Reveal\n\nExpand-and-fade for dropdown menus.\n\n**Avoid when:** multiple simultaneous dropdowns.\n\n**Restraint cost:** 1 (low)`,
      tags_json: JSON.stringify(["transition", "dropdown", "menu", "expand"]),
    },
  ];

  // Insert only recipes that don't already exist (incremental seeding)
  const checkStmt = db.prepare(`SELECT id FROM motion_recipes WHERE id = ?`);
  const insertStmt = db.prepare(
    `INSERT INTO motion_recipes (id, name, category, description, avoid_when, restraint_cost, recipe_json, skill_markdown, tags_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const r of recipes) {
    const existing = checkStmt.get(r.id) as { id: string } | undefined;
    if (!existing) {
      insertStmt.run(r.id, r.name, r.category, r.description, JSON.stringify(r.avoid_when), r.restraint_cost, r.recipe_json, r.skill_markdown, r.tags_json, ts);
    }
  }
}

export function listRecipes(category?: string): MotionRecipe[] {
  const db = getDb();
  const rows = category
    ? db.prepare(`SELECT * FROM motion_recipes WHERE category = ? ORDER BY name`).all(category) as unknown as RecipeRow[]
    : db.prepare(`SELECT * FROM motion_recipes ORDER BY category, name`).all() as unknown as RecipeRow[];
  return rows.map(rowToRecipe);
}

export function getRecipe(id: string): MotionRecipe | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM motion_recipes WHERE id = ?`).get(id) as unknown as RecipeRow | undefined;
  return row ? rowToRecipe(row) : null;
}

export function searchRecipes(query: string, limit = 10): MotionRecipe[] {
  const db = getDb();
  const pattern = `%${query.toLowerCase()}%`;
  const rows = db.prepare(
    `SELECT * FROM motion_recipes
     WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR tags_json LIKE ?
     ORDER BY restraint_cost ASC LIMIT ?`,
  ).all(pattern, pattern, pattern, limit) as unknown as RecipeRow[];
  return rows.map(rowToRecipe);
}

/** Check if a recipe should be avoided given the current context. */
export function checkRecipeAvoidance(recipe: MotionRecipe, context: {
  componentCount: number;
  hasBounce: boolean;
  isProfessional: boolean;
}): { shouldAvoid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const condition of recipe.avoidWhen) {
    if (condition === "more-than-5-simultaneous" && context.componentCount > 5) {
      reasons.push(`Too many simultaneous components (${context.componentCount} > 5)`);
    }
    if (condition === "more-than-3-simultaneous" && context.componentCount > 3) {
      reasons.push(`Too many simultaneous components (${context.componentCount} > 3)`);
    }
    if (condition === "more-than-2-simultaneous" && context.componentCount > 2) {
      reasons.push(`Too many simultaneous components (${context.componentCount} > 2)`);
    }
    if (condition === "already-has-bounce" && context.hasBounce) {
      reasons.push("Bounce effect already present in composition");
    }
    if (condition === "professional-tone" && context.isProfessional) {
      reasons.push("Not suitable for professional tone");
    }
  }
  return { shouldAvoid: reasons.length > 0, reasons };
}
