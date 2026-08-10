/** Scene Packs — vertically-tailored motion scene compositions that orchestrate template slots into drop-in product scenes. */

import type { MotionComponent } from "@openmotion/shared";
import { now } from "../utils/id.js";
import { instantiateTemplate } from "./templates/index.js";

/** Vertical category a scene pack targets. */
export type SceneVertical =
  | "marketing"
  | "dashboard"
  | "ecommerce"
  | "onboarding"
  | "states"
  | "communication"
  | "presentation";

/** The role a single slot plays within a scene. */
export type SceneSlotRole =
  | "headline"
  | "subhead"
  | "media"
  | "primary-action"
  | "secondary-action"
  | "metric"
  | "chart"
  | "list-item"
  | "card"
  | "badge"
  | "illustration"
  | "background"
  | "footer"
  | "overlay"
  | "status-icon"
  | "status-message";

/** Choreography pattern used to time slot entrances. */
export type SceneChoreography =
  | "cascade"
  | "wave"
  | "ripple"
  | "converge"
  | "assembly"
  | "simultaneous";

/** A single slot in a scene — role + template + timing. */
export interface SceneSlot {
  /** Role this slot plays in the scene narrative. */
  role: SceneSlotRole;
  /** Template id (from templates/index.ts) that materializes this slot. */
  templateId: string;
  /** Delay (ms) from scene start — drives the choreography. */
  delayMs: number;
  /** Optional override for the slot's duration. */
  durationMs?: number;
  /** Human-readable note for the agent / designer. */
  note?: string;
}

/** A complete scene pack definition. */
export interface ScenePack {
  /** Unique pack identifier. */
  id: string;
  /** Human-readable pack name. */
  name: string;
  /** Vertical this pack serves. */
  vertical: SceneVertical;
  /** Short description of the scene and when to use it. */
  description: string;
  /** Ordered slots that compose the scene. */
  slots: SceneSlot[];
  /** Choreography pattern that governs inter-slot timing. */
  choreography: SceneChoreography;
  /** Total scene duration in milliseconds. */
  totalDurationMs: number;
  /** Style preset ids (from stylePresets.ts) that pair well. */
  recommendedStyles: string[];
  /** Tags for search and filtering. */
  tags: string[];
}

export const SCENE_PACKS: ScenePack[] = [
  // --- Marketing -----------------------------------------------------------
  {
    id: "scene-hero-product-launch",
    name: "Product Launch Hero",
    vertical: "marketing",
    description:
      "Cinematic hero reveal for a product launch — headline drops, media fades in, primary CTA pulses, and a gradient background breathes underneath.",
    slots: [
      { role: "background", templateId: "tpl-aurora", delayMs: 0, note: "Ambient gradient wash sets the stage." },
      { role: "headline", templateId: "tpl-text-reveal", delayMs: 200, note: "Headline enters first to anchor attention." },
      { role: "subhead", templateId: "tpl-blur-reveal", delayMs: 500, note: "Subhead softens in behind the headline." },
      { role: "media", templateId: "tpl-reveal3d", delayMs: 800, note: "Product media rotates into view." },
      { role: "primary-action", templateId: "tpl-magnetic-pull", delayMs: 1100, note: "CTA draws the cursor." },
      { role: "secondary-action", templateId: "tpl-fade-in", delayMs: 1300, note: "Secondary link settles in last." },
    ],
    choreography: "cascade",
    totalDurationMs: 2200,
    recommendedStyles: ["cinematic", "dramatic", "luxury"],
    tags: ["hero", "landing", "launch", "cinematic", "marketing"],
  },
  {
    id: "scene-feature-grid",
    name: "Feature Grid Reveal",
    vertical: "marketing",
    description:
      "Staggered grid of feature cards revealing one by one in a wave pattern — ideal for product capability sections.",
    slots: [
      { role: "headline", templateId: "tpl-split-text", delayMs: 0, note: "Section title splits into place." },
      { role: "card", templateId: "tpl-hover-lift", delayMs: 300, note: "Card 1 lifts in." },
      { role: "card", templateId: "tpl-hover-lift", delayMs: 420, note: "Card 2 follows." },
      { role: "card", templateId: "tpl-hover-lift", delayMs: 540, note: "Card 3 follows." },
      { role: "card", templateId: "tpl-hover-lift", delayMs: 660, note: "Card 4 closes the row." },
      { role: "footer", templateId: "tpl-fade-in", delayMs: 900, note: "Footnote fades in." },
    ],
    choreography: "wave",
    totalDurationMs: 1500,
    recommendedStyles: ["professional", "minimal", "calm"],
    tags: ["features", "grid", "stagger", "marketing"],
  },

  // --- Dashboard -----------------------------------------------------------
  {
    id: "scene-dashboard-load",
    name: "Dashboard Load",
    vertical: "dashboard",
    description:
      "Analytics dashboard entrance — skeleton loaders dissolve into metrics, charts, and a status badge in a converge pattern.",
    slots: [
      { role: "status-icon", templateId: "tpl-breathing-light", delayMs: 0, note: "Live status indicator pulses." },
      { role: "card", templateId: "tpl-skeleton-loader", delayMs: 100, durationMs: 600, note: "Skeleton placeholder." },
      { role: "metric", templateId: "tpl-counter", delayMs: 400, note: "KPI counts up." },
      { role: "chart", templateId: "tpl-data-stream", delayMs: 600, note: "Chart streams in." },
      { role: "metric", templateId: "tpl-counter", delayMs: 700, note: "Secondary KPI counts up." },
      { role: "list-item", templateId: "tpl-fade-in", delayMs: 900, note: "Recent activity rows fade in." },
    ],
    choreography: "converge",
    totalDurationMs: 1800,
    recommendedStyles: ["professional", "minimal", "calm"],
    tags: ["dashboard", "analytics", "skeleton", "metrics", "loading"],
  },

  // --- E-commerce ----------------------------------------------------------
  {
    id: "scene-product-card",
    name: "Product Card Showcase",
    vertical: "ecommerce",
    description:
      "E-commerce product card — image hover-zoom, price counter, badge pop, and add-to-cart magnetic pull in an assembly pattern.",
    slots: [
      { role: "badge", templateId: "tpl-pulse", delayMs: 0, note: "Sale badge pulses." },
      { role: "media", templateId: "tpl-scale", delayMs: 150, note: "Product image scales in." },
      { role: "headline", templateId: "tpl-fade-in", delayMs: 350, note: "Product name fades in." },
      { role: "metric", templateId: "tpl-counter", delayMs: 500, note: "Price counts up." },
      { role: "primary-action", templateId: "tpl-magnetic-pull", delayMs: 700, note: "Add-to-cart pulls cursor." },
    ],
    choreography: "assembly",
    totalDurationMs: 1300,
    recommendedStyles: ["playful", "energetic", "professional"],
    tags: ["ecommerce", "product", "card", "cart", "shopping"],
  },
  {
    id: "scene-checkout-success",
    name: "Checkout Success",
    vertical: "ecommerce",
    description:
      "Post-purchase celebration — confetti burst, success icon bounce, order number typewriter, and a gentle CTA fade.",
    slots: [
      { role: "background", templateId: "tpl-confetti", delayMs: 0, note: "Confetti celebrates the purchase." },
      { role: "status-icon", templateId: "tpl-bounce", delayMs: 200, note: "Checkmark bounces in." },
      { role: "headline", templateId: "tpl-typewriter", delayMs: 600, note: "Order number types out." },
      { role: "primary-action", templateId: "tpl-fade-in", delayMs: 1400, note: "Continue-shopping CTA fades in." },
    ],
    choreography: "cascade",
    totalDurationMs: 2000,
    recommendedStyles: ["playful", "energetic", "celebration"],
    tags: ["ecommerce", "checkout", "success", "celebration", "purchase"],
  },

  // --- Onboarding ----------------------------------------------------------
  {
    id: "scene-onboarding-first-run",
    name: "First-Run Onboarding",
    vertical: "onboarding",
    description:
      "Three-step first-run reveal — headline, illustration, and tip cards appear in sequence with a page transition backdrop.",
    slots: [
      { role: "background", templateId: "tpl-page-transition", delayMs: 0, note: "Page wipes in." },
      { role: "headline", templateId: "tpl-text-reveal", delayMs: 300, note: "Welcome headline reveals." },
      { role: "illustration", templateId: "tpl-blur-reveal", delayMs: 600, note: "Illustration blurs in." },
      { role: "subhead", templateId: "tpl-fade-in", delayMs: 900, note: "Tip text fades in." },
      { role: "primary-action", templateId: "tpl-hover-lift", delayMs: 1100, note: "Get-started button lifts." },
    ],
    choreography: "cascade",
    totalDurationMs: 1900,
    recommendedStyles: ["calm", "playful", "glassy"],
    tags: ["onboarding", "first-run", "welcome", "intro"],
  },

  // --- States --------------------------------------------------------------
  {
    id: "scene-empty-state",
    name: "Empty State",
    vertical: "states",
    description:
      "Friendly empty state — illustration floats in, message fades, and a primary action invites the first action.",
    slots: [
      { role: "illustration", templateId: "tpl-elastic-scale", delayMs: 0, note: "Illustration springs in." },
      { role: "headline", templateId: "tpl-fade-in", delayMs: 300, note: "Empty-state title fades in." },
      { role: "subhead", templateId: "tpl-fade-in", delayMs: 500, note: "Helpful copy fades in." },
      { role: "primary-action", templateId: "tpl-micro-interaction", delayMs: 700, note: "CTA invites the first action." },
    ],
    choreography: "cascade",
    totalDurationMs: 1300,
    recommendedStyles: ["calm", "minimal", "professional"],
    tags: ["empty", "state", "zero-data", "friendly"],
  },
  {
    id: "scene-error-state",
    name: "Error State",
    vertical: "states",
    description:
      "Reassuring error state — status icon shakes, message fades in, and a retry action pulses to invite recovery.",
    slots: [
      { role: "status-icon", templateId: "tpl-glitch", delayMs: 0, note: "Icon glitches to signal the error." },
      { role: "headline", templateId: "tpl-fade-in", delayMs: 250, note: "Error title fades in." },
      { role: "subhead", templateId: "tpl-fade-in", delayMs: 450, note: "Recovery copy fades in." },
      { role: "primary-action", templateId: "tpl-pulse", delayMs: 700, note: "Retry button pulses." },
    ],
    choreography: "cascade",
    totalDurationMs: 1200,
    recommendedStyles: ["minimal", "professional"],
    tags: ["error", "state", "failure", "recovery", "retry"],
  },
  {
    id: "scene-loading-state",
    name: "Loading State",
    vertical: "states",
    description:
      "Waiting state with a breathing light, progress bar, and shimmering placeholder — keeps the user oriented while content fetches.",
    slots: [
      { role: "status-icon", templateId: "tpl-breathing-light", delayMs: 0, note: "Status light breathes." },
      { role: "card", templateId: "tpl-shimmer", delayMs: 100, note: "Placeholder shimmers." },
      { role: "metric", templateId: "tpl-progress", delayMs: 300, note: "Progress bar fills." },
    ],
    choreography: "simultaneous",
    totalDurationMs: 1800,
    recommendedStyles: ["minimal", "calm"],
    tags: ["loading", "state", "waiting", "progress", "skeleton"],
  },

  // --- Communication -------------------------------------------------------
  {
    id: "scene-notification-toast",
    name: "Notification Toast",
    vertical: "communication",
    description:
      "In-app toast — slides in from the edge, badge pulses, message fades, then auto-dismisses with a dissolve.",
    slots: [
      { role: "overlay", templateId: "tpl-slide-up", delayMs: 0, note: "Toast slides in." },
      { role: "badge", templateId: "tpl-pulse", delayMs: 200, note: "Icon pulses." },
      { role: "headline", templateId: "tpl-fade-in", delayMs: 350, note: "Toast message fades in." },
      { role: "status-icon", templateId: "tpl-dissolve-out", delayMs: 3500, note: "Toast dissolves out." },
    ],
    choreography: "cascade",
    totalDurationMs: 4200,
    recommendedStyles: ["minimal", "professional", "snappy"],
    tags: ["notification", "toast", "in-app", "message"],
  },

  // --- Presentation --------------------------------------------------------
  {
    id: "scene-slide-title",
    name: "Presentation Title Slide",
    vertical: "presentation",
    description:
      "Keynote-style title slide — gradient background, headline split-text, subhead fade, and a logo reveal.",
    slots: [
      { role: "background", templateId: "tpl-gradient-shift", delayMs: 0, note: "Gradient wash shifts." },
      { role: "headline", templateId: "tpl-split-text", delayMs: 200, note: "Title splits into place." },
      { role: "subhead", templateId: "tpl-fade-in", delayMs: 600, note: "Subtitle fades in." },
      { role: "footer", templateId: "tpl-logo-reveal", delayMs: 900, note: "Logo draws in." },
    ],
    choreography: "cascade",
    totalDurationMs: 1600,
    recommendedStyles: ["cinematic", "dramatic", "professional"],
    tags: ["presentation", "slide", "title", "keynote"],
  },
];

/** List all scene packs, optionally filtered by vertical. */
export function listScenePacks(vertical?: SceneVertical): ScenePack[] {
  if (!vertical) return SCENE_PACKS;
  return SCENE_PACKS.filter((p) => p.vertical === vertical);
}

/** Get a single scene pack by id. */
export function getScenePack(id: string): ScenePack | undefined {
  return SCENE_PACKS.find((p) => p.id === id);
}

/** Summarize slots by role — useful for the agent when reasoning about coverage. */
export function summarizeSceneSlots(pack: ScenePack): Record<SceneSlotRole, number> {
  const summary = {} as Record<SceneSlotRole, number>;
  for (const slot of pack.slots) {
    summary[slot.role] = (summary[slot.role] ?? 0) + 1;
  }
  return summary;
}

/**
 * Instantiate every slot in a scene pack for a project, returning the
 * materialized components (bound to projectId with fresh ids) in slot order.
 * Slots whose template id cannot be resolved are skipped silently — callers
 * can detect this by comparing the returned length to pack.slots.length.
 *
 * The caller persists the components — this helper does not write to the DB.
 * Per-slot delayMs and durationMs are applied as overrides on the materialized
 * drafts so the choreography survives instantiation.
 */
export function instantiateScenePack(
  pack: ScenePack,
  projectId: string,
): { components: MotionComponent[]; slotRoles: SceneSlotRole[] } {
  const components: MotionComponent[] = [];
  const slotRoles: SceneSlotRole[] = [];
  const ts = now();
  for (const slot of pack.slots) {
    const instantiated = instantiateTemplate(slot.templateId, projectId);
    if (instantiated.length === 0) continue;
    for (const comp of instantiated) {
      const patched: MotionComponent = {
        ...comp,
        delayMs: slot.delayMs,
        durationMs: slot.durationMs ?? comp.durationMs,
        updatedAt: ts,
      };
      components.push(patched);
      slotRoles.push(slot.role);
    }
  }
  return { components, slotRoles };
}
