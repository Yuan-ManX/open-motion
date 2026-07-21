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
    // --- Scroll-driven recipes ---
    {
      id: "recipe-scroll-reveal",
      name: "Scroll Reveal",
      category: "scroll",
      description: "Progressive opacity and translateY tied to scroll position for content entering the viewport.",
      avoid_when: ["above-the-fold", "loading-state", "more-than-6-simultaneous"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        trigger: "onScroll",
        easing: { type: "preset", name: "ease-out" },
        durationMs: 800,
        keyframes: [
          { offset: 0, properties: { opacity: 0, translateY: 60 } },
          { offset: 1, properties: { opacity: 1, translateY: 0 } },
        ],
      }),
      skill_markdown: `# Scroll Reveal\n\nProgressive entrance tied to scroll position.\n\n**Avoid when:** above-the-fold content, loading states, or 6+ simultaneous reveals.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["scroll", "reveal", "viewport"]),
    },
    {
      id: "recipe-parallax-depth",
      name: "Parallax Depth",
      category: "scroll",
      description: "Multi-layer parallax where background moves slower than foreground for depth illusion.",
      avoid_when: ["single-layer", "performance-critical", "more-than-4-layers"],
      restraint_cost: 3,
      recipe_json: JSON.stringify({
        trigger: "onScroll",
        easing: { type: "preset", name: "linear" },
        durationMs: 1000,
        keyframes: [
          { offset: 0, properties: { translateY: 0 } },
          { offset: 1, properties: { translateY: -100 } },
        ],
      }),
      skill_markdown: `# Parallax Depth\n\nMulti-layer depth via differential scroll speeds.\n\n**Avoid when:** single-layer scenes, performance-critical contexts, or 4+ layers.\n\n**Restraint cost:** 3 (moderate)`,
      tags_json: JSON.stringify(["scroll", "parallax", "depth"]),
    },
    {
      id: "recipe-sticky-shrink",
      name: "Sticky Shrink",
      category: "scroll",
      description: "Header or section shrinks and condenses as the user scrolls past a threshold.",
      avoid_when: ["mobile-viewport", "more-than-1-simultaneous"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        trigger: "onScroll",
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 400,
        keyframes: [
          { offset: 0, properties: { scale: 1, opacity: 1 } },
          { offset: 1, properties: { scale: 0.85, opacity: 0.7 } },
        ],
      }),
      skill_markdown: `# Sticky Shrink\n\nHeader condenses on scroll past threshold.\n\n**Avoid when:** mobile viewports or multiple simultaneous instances.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["scroll", "sticky", "header"]),
    },
    // --- Gesture-driven recipes ---
    {
      id: "recipe-swipe-back",
      name: "Swipe Back",
      category: "gesture",
      description: "Track horizontal swipe velocity to dismiss or return, with spring follow-through.",
      avoid_when: ["desktop-only", "form-input", "more-than-1-simultaneous"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        trigger: "onSwipe",
        easing: { type: "spring", stiffness: 220, damping: 28, mass: 1 },
        durationMs: 500,
        keyframes: [
          { offset: 0, properties: { translateX: 0, opacity: 1 } },
          { offset: 1, properties: { translateX: -400, opacity: 0 } },
        ],
      }),
      skill_markdown: `# Swipe Back\n\nVelocity-tracked horizontal dismissal with spring.\n\n**Avoid when:** desktop-only contexts, form inputs, or multiple simultaneous swipes.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["gesture", "swipe", "dismiss"]),
    },
    {
      id: "recipe-pinch-zoom",
      name: "Pinch Zoom",
      category: "gesture",
      description: "Two-finger pinch scales content with momentum and rubber-band at limits.",
      avoid_when: ["non-touch", "scroll-context", "more-than-1-simultaneous"],
      restraint_cost: 3,
      recipe_json: JSON.stringify({
        trigger: "onPinch",
        easing: { type: "spring", stiffness: 180, damping: 22, mass: 1 },
        durationMs: 300,
        keyframes: [
          { offset: 0, properties: { scale: 1 } },
          { offset: 0.5, properties: { scale: 1.5 } },
          { offset: 1, properties: { scale: 2 } },
        ],
      }),
      skill_markdown: `# Pinch Zoom\n\nTwo-finger pinch with momentum and rubber-band edges.\n\n**Avoid when:** non-touch contexts, scroll containers, or multiple simultaneous pinches.\n\n**Restraint cost:** 3 (moderate)`,
      tags_json: JSON.stringify(["gesture", "pinch", "zoom"]),
    },
    {
      id: "recipe-long-press-bloom",
      name: "Long Press Bloom",
      category: "gesture",
      description: "Sustained press triggers a radial bloom with haptic-style scale feedback.",
      avoid_when: ["fast-tap", "more-than-2-simultaneous"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        trigger: "onLongPress",
        easing: { type: "spring", stiffness: 200, damping: 14, mass: 1 },
        durationMs: 600,
        keyframes: [
          { offset: 0, properties: { scale: 1 } },
          { offset: 0.4, properties: { scale: 0.95 } },
          { offset: 1, properties: { scale: 1.1 } },
        ],
      }),
      skill_markdown: `# Long Press Bloom\n\nSustained press with radial bloom feedback.\n\n**Avoid when:** fast tap interactions or 2+ simultaneous blooms.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["gesture", "long-press", "bloom"]),
    },
    // --- 3D depth recipes ---
    {
      id: "recipe-flip-3d",
      name: "3D Flip",
      category: "3d",
      description: "Card flips on Y-axis revealing back face with perspective depth.",
      avoid_when: ["more-than-2-simultaneous", "no-perspective-context"],
      restraint_cost: 3,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 700,
        keyframes: [
          { offset: 0, properties: { rotateY: 0 } },
          { offset: 1, properties: { rotateY: 180 } },
        ],
      }),
      skill_markdown: `# 3D Flip\n\nY-axis card flip with perspective.\n\n**Avoid when:** 2+ simultaneous flips or contexts without perspective.\n\n**Restraint cost:** 3 (moderate)`,
      tags_json: JSON.stringify(["3d", "flip", "card"]),
    },
    {
      id: "recipe-card-tilt",
      name: "Card Tilt",
      category: "3d",
      description: "Card subtly tilts toward cursor in 3D space for tactile parallax depth.",
      avoid_when: ["touch-device", "list-context", "more-than-3-simultaneous"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        trigger: "onHover",
        easing: { type: "spring", stiffness: 150, damping: 18, mass: 1 },
        durationMs: 250,
        keyframes: [
          { offset: 0, properties: { rotateX: 0, rotateY: 0 } },
          { offset: 1, properties: { rotateX: 5, rotateY: -5 } },
        ],
      }),
      skill_markdown: `# Card Tilt\n\nCursor-tracking 3D tilt with spring.\n\n**Avoid when:** touch devices, list contexts, or 3+ simultaneous tilts.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["3d", "tilt", "hover"]),
    },
    {
      id: "recipe-perspective-rotate",
      name: "Perspective Rotate",
      category: "3d",
      description: "Continuous slow rotation around X and Y axes for showcase hero elements.",
      avoid_when: ["text-heavy", "more-than-1-simultaneous", "performance-critical"],
      restraint_cost: 4,
      recipe_json: JSON.stringify({
        easing: { type: "preset", name: "linear" },
        durationMs: 8000,
        iterationCount: "infinite",
        keyframes: [
          { offset: 0, properties: { rotateX: 0, rotateY: 0 } },
          { offset: 0.5, properties: { rotateX: 15, rotateY: 180 } },
          { offset: 1, properties: { rotateX: 0, rotateY: 360 } },
        ],
      }),
      skill_markdown: `# Perspective Rotate\n\nContinuous 3D rotation for showcase heroes.\n\n**Avoid when:** text-heavy content, multiple simultaneous instances, or performance-critical contexts.\n\n**Restraint cost:** 4 (high)`,
      tags_json: JSON.stringify(["3d", "rotate", "showcase"]),
    },
    // --- View transition recipes ---
    {
      id: "recipe-cross-route",
      name: "Cross Route",
      category: "view-transition",
      description: "Opacity cross-fade between route-level views with shared element continuity.",
      avoid_when: ["fast-navigation", "more-than-1-simultaneous"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        trigger: "onRouteChange",
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 350,
        keyframes: [
          { offset: 0, properties: { opacity: 0 } },
          { offset: 1, properties: { opacity: 1 } },
        ],
      }),
      skill_markdown: `# Cross Route\n\nRoute-level cross-fade with shared element continuity.\n\n**Avoid when:** fast navigation or multiple simultaneous transitions.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["view-transition", "route", "cross-fade"]),
    },
    {
      id: "recipe-shared-element",
      name: "Shared Element",
      category: "view-transition",
      description: "Element morphs position and size between contexts during navigation transitions.",
      avoid_when: ["no-shared-source", "more-than-2-simultaneous"],
      restraint_cost: 4,
      recipe_json: JSON.stringify({
        trigger: "onRouteChange",
        easing: { type: "spring", stiffness: 200, damping: 20, mass: 1 },
        durationMs: 500,
        keyframes: [
          { offset: 0, properties: { scale: 0.5, translateX: -200, translateY: -100 } },
          { offset: 1, properties: { scale: 1, translateX: 0, translateY: 0 } },
        ],
      }),
      skill_markdown: `# Shared Element\n\nPosition/size morph across navigation contexts.\n\n**Avoid when:** no shared source element or 2+ simultaneous morphs.\n\n**Restraint cost:** 4 (high)`,
      tags_json: JSON.stringify(["view-transition", "shared", "morph"]),
    },
    {
      id: "recipe-page-curl",
      name: "Page Curl",
      category: "view-transition",
      description: "Page-turn effect with curling shadow for document-style navigation.",
      avoid_when: ["data-table", "more-than-1-simultaneous"],
      restraint_cost: 5,
      recipe_json: JSON.stringify({
        trigger: "onRouteChange",
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 900,
        keyframes: [
          { offset: 0, properties: { rotateY: 0, opacity: 1 } },
          { offset: 0.7, properties: { rotateY: -90, opacity: 0.6 } },
          { offset: 1, properties: { rotateY: -180, opacity: 0 } },
        ],
      }),
      skill_markdown: `# Page Curl\n\nDocument-style page turn with shadow.\n\n**Avoid when:** data tables or multiple simultaneous curls.\n\n**Restraint cost:** 5 (very high)`,
      tags_json: JSON.stringify(["view-transition", "page", "curl"]),
    },
    // --- Micro-interaction recipes ---
    {
      id: "recipe-toggle-pulse",
      name: "Toggle Pulse",
      category: "micro",
      description: "Quick scale pulse on toggle state change for tactile switch feedback.",
      avoid_when: ["more-than-3-simultaneous", "loading-state"],
      restraint_cost: 1,
      recipe_json: JSON.stringify({
        trigger: "onToggle",
        easing: { type: "preset", name: "ease-out" },
        durationMs: 200,
        keyframes: [
          { offset: 0, properties: { scale: 1 } },
          { offset: 0.5, properties: { scale: 1.15 } },
          { offset: 1, properties: { scale: 1 } },
        ],
      }),
      skill_markdown: `# Toggle Pulse\n\nTactile scale pulse on toggle.\n\n**Avoid when:** 3+ simultaneous toggles or loading states.\n\n**Restraint cost:** 1 (low)`,
      tags_json: JSON.stringify(["micro", "toggle", "pulse"]),
    },
    {
      id: "recipe-ripple-out",
      name: "Ripple Out",
      category: "micro",
      description: "Radial ripple expanding from tap point for material-style touch feedback.",
      avoid_when: ["more-than-4-simultaneous", "text-heavy"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        trigger: "onTap",
        easing: { type: "preset", name: "ease-out" },
        durationMs: 600,
        keyframes: [
          { offset: 0, properties: { scale: 0, opacity: 0.5 } },
          { offset: 1, properties: { scale: 4, opacity: 0 } },
        ],
      }),
      skill_markdown: `# Ripple Out\n\nMaterial-style radial ripple from tap point.\n\n**Avoid when:** 4+ simultaneous ripples or text-heavy areas.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["micro", "ripple", "tap"]),
    },
    {
      id: "recipe-focus-ring",
      name: "Focus Ring",
      category: "micro",
      description: "Keyboard focus ring smoothly scales in around active input elements.",
      avoid_when: ["mouse-focus", "more-than-1-simultaneous"],
      restraint_cost: 1,
      recipe_json: JSON.stringify({
        trigger: "onFocus",
        easing: { type: "preset", name: "ease-out" },
        durationMs: 150,
        keyframes: [
          { offset: 0, properties: { scale: 0.8, opacity: 0 } },
          { offset: 1, properties: { scale: 1, opacity: 1 } },
        ],
      }),
      skill_markdown: `# Focus Ring\n\nKeyboard focus ring scale-in for accessibility.\n\n**Avoid when:** mouse-driven focus or multiple simultaneous rings.\n\n**Restraint cost:** 1 (low)`,
      tags_json: JSON.stringify(["micro", "focus", "accessibility"]),
    },
    // --- Physics-based motion recipes ---
    {
      id: "recipe-spring-settle",
      name: "Spring Settle",
      category: "physics",
      description: "Overshoot-and-settle spring physics for natural deceleration on interactive elements.",
      avoid_when: ["formal-ui", "data-table", "more-than-3-simultaneous"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        trigger: "onLoad",
        easing: { type: "spring", stiffness: 170, damping: 14, mass: 1 },
        durationMs: 800,
        keyframes: [
          { offset: 0, properties: { translateY: 40, opacity: 0 } },
          { offset: 1, properties: { translateY: 0, opacity: 1 } },
        ],
      }),
      skill_markdown: `# Spring Settle\n\nSpring physics with overshoot for natural deceleration.\n\n**Avoid when:** formal UI, data tables, or 3+ simultaneous springs.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["physics", "spring", "settle", "natural"]),
    },
    {
      id: "recipe-gravity-drop",
      name: "Gravity Drop",
      category: "physics",
      description: "Accelerating downward motion with a subtle bounce on impact, simulating gravity.",
      avoid_when: ["upward-motion", "formal-ui", "more-than-2-simultaneous"],
      restraint_cost: 3,
      recipe_json: JSON.stringify({
        trigger: "onLoad",
        easing: { type: "bezier", p1: [0.5, 0], p2: [0.75, 0] },
        durationMs: 700,
        keyframes: [
          { offset: 0, properties: { translateY: -120, opacity: 0 } },
          { offset: 0.7, properties: { translateY: 0, opacity: 1 } },
          { offset: 0.85, properties: { translateY: -12 } },
          { offset: 1, properties: { translateY: 0 } },
        ],
      }),
      skill_markdown: `# Gravity Drop\n\nFalling element with bounce on impact.\n\n**Avoid when:** upward motion context, formal UI, or 2+ simultaneous drops.\n\n**Restraint cost:** 3 (moderate)`,
      tags_json: JSON.stringify(["physics", "gravity", "drop", "bounce"]),
    },
    {
      id: "recipe-momentum-slide",
      name: "Momentum Slide",
      category: "physics",
      description: "Decelerating horizontal slide with residual drift, mimicking momentum from a swipe gesture.",
      avoid_when: ["vertical-layout", "more-than-3-simultaneous"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        trigger: "onScroll",
        easing: { type: "bezier", p1: [0.2, 0.8], p2: [0.2, 1] },
        durationMs: 500,
        keyframes: [
          { offset: 0, properties: { translateX: 200, opacity: 0 } },
          { offset: 0.6, properties: { translateX: 0, opacity: 1 } },
          { offset: 0.8, properties: { translateX: -8 } },
          { offset: 1, properties: { translateX: 0 } },
        ],
      }),
      skill_markdown: `# Momentum Slide\n\nHorizontal slide with residual drift after deceleration.\n\n**Avoid when:** vertical layouts or 3+ simultaneous slides.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["physics", "momentum", "slide", "swipe"]),
    },
    // --- Cinematic camera recipes ---
    {
      id: "recipe-cinematic-dolly",
      name: "Cinematic Dolly",
      category: "cinematic",
      description: "Slow forward zoom with subtle scale increase, creating a cinematic dolly shot feel.",
      avoid_when: ["fast-interaction", "data-heavy", "more-than-1-simultaneous"],
      restraint_cost: 4,
      recipe_json: JSON.stringify({
        trigger: "onLoad",
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 2000,
        keyframes: [
          { offset: 0, properties: { scale: 1, opacity: 0 } },
          { offset: 0.3, properties: { opacity: 1 } },
          { offset: 1, properties: { scale: 1.15 } },
        ],
      }),
      skill_markdown: `# Cinematic Dolly\n\nSlow forward zoom for cinematic entrance.\n\n**Avoid when:** fast interactions, data-heavy views, or multiple simultaneous dolly shots.\n\n**Restraint cost:** 4 (moderate-high)`,
      tags_json: JSON.stringify(["cinematic", "dolly", "zoom", "entrance"]),
    },
    {
      id: "recipe-cinematic-pan",
      name: "Cinematic Pan",
      category: "cinematic",
      description: "Horizontal camera pan across a wide scene, revealing content from left to right.",
      avoid_when: ["narrow-viewport", "more-than-1-simultaneous"],
      restraint_cost: 3,
      recipe_json: JSON.stringify({
        trigger: "onLoad",
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 1500,
        keyframes: [
          { offset: 0, properties: { translateX: -100, opacity: 0 } },
          { offset: 0.2, properties: { opacity: 1 } },
          { offset: 1, properties: { translateX: 0 } },
        ],
      }),
      skill_markdown: `# Cinematic Pan\n\nHorizontal camera pan revealing content.\n\n**Avoid when:** narrow viewports or multiple simultaneous pans.\n\n**Restraint cost:** 3 (moderate)`,
      tags_json: JSON.stringify(["cinematic", "pan", "horizontal", "reveal"]),
    },
    {
      id: "recipe-cinematic-rack-focus",
      name: "Rack Focus",
      category: "cinematic",
      description: "Blur-to-focus transition where one element sharpens while the rest blur, directing attention.",
      avoid_when: ["text-heavy", "more-than-2-simultaneous"],
      restraint_cost: 3,
      recipe_json: JSON.stringify({
        trigger: "onLoad",
        easing: { type: "preset", name: "ease-out" },
        durationMs: 1000,
        keyframes: [
          { offset: 0, properties: { filter: "blur(20px)", opacity: 0 } },
          { offset: 1, properties: { filter: "blur(0px)", opacity: 1 } },
        ],
      }),
      skill_markdown: `# Rack Focus\n\nBlur-to-focus transition directing attention.\n\n**Avoid when:** text-heavy areas or 2+ simultaneous rack focuses.\n\n**Restraint cost:** 3 (moderate)`,
      tags_json: JSON.stringify(["cinematic", "focus", "blur", "attention"]),
    },
    // --- Chromatic motion recipes ---
    {
      id: "recipe-chromatic-shift",
      name: "Chromatic Shift",
      category: "chromatic",
      description: "Hue rotation animation creating a prismatic color shift across the element.",
      avoid_when: ["brand-strict", "accessibility-critical", "more-than-2-simultaneous"],
      restraint_cost: 3,
      recipe_json: JSON.stringify({
        trigger: "onLoad",
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 3000,
        iterationCount: "infinite",
        direction: "alternate",
        keyframes: [
          { offset: 0, properties: { filter: "hue-rotate(0deg)" } },
          { offset: 1, properties: { filter: "hue-rotate(60deg)" } },
        ],
      }),
      skill_markdown: `# Chromatic Shift\n\nHue rotation creating prismatic color animation.\n\n**Avoid when:** brand-strict contexts, accessibility-critical areas, or 2+ simultaneous shifts.\n\n**Restraint cost:** 3 (moderate)`,
      tags_json: JSON.stringify(["chromatic", "hue", "color", "prismatic"]),
    },
    {
      id: "recipe-gradient-flow",
      name: "Gradient Flow",
      category: "chromatic",
      description: "Animated background-position shift creating a flowing gradient effect.",
      avoid_when: ["text-overlay", "more-than-3-simultaneous"],
      restraint_cost: 2,
      recipe_json: JSON.stringify({
        trigger: "onLoad",
        easing: { type: "preset", name: "linear" },
        durationMs: 4000,
        iterationCount: "infinite",
        direction: "alternate",
        keyframes: [
          { offset: 0, properties: { backgroundPosition: "0% 50%" } },
          { offset: 1, properties: { backgroundPosition: "100% 50%" } },
        ],
      }),
      skill_markdown: `# Gradient Flow\n\nFlowing gradient via background-position animation.\n\n**Avoid when:** text overlays or 3+ simultaneous flows.\n\n**Restraint cost:** 2 (low-moderate)`,
      tags_json: JSON.stringify(["chromatic", "gradient", "flow", "background"]),
    },
    {
      id: "recipe-color-pulse",
      name: "Color Pulse",
      category: "chromatic",
      description: "Synchronized scale and hue pulse creating a vibrant breathing color effect.",
      avoid_when: ["formal-ui", "data-table", "more-than-2-simultaneous"],
      restraint_cost: 3,
      recipe_json: JSON.stringify({
        trigger: "onLoad",
        easing: { type: "preset", name: "ease-in-out" },
        durationMs: 1500,
        iterationCount: "infinite",
        direction: "alternate",
        keyframes: [
          { offset: 0, properties: { scale: 1, filter: "hue-rotate(0deg)" } },
          { offset: 1, properties: { scale: 1.05, filter: "hue-rotate(30deg)" } },
        ],
      }),
      skill_markdown: `# Color Pulse\n\nSynchronized scale and hue pulse for vibrant breathing effect.\n\n**Avoid when:** formal UI, data tables, or 2+ simultaneous pulses.\n\n**Restraint cost:** 3 (moderate)`,
      tags_json: JSON.stringify(["chromatic", "pulse", "color", "breathing"]),
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
