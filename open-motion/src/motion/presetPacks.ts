/** Curated themed template packs — bundles of existing template IDs grouped by use case. */

import type { MotionComponent } from "@openmotion/shared";
import { instantiateTemplate } from "./templates/index.js";

export interface PresetPack {
  /** Unique pack identifier. */
  id: string;
  /** Human-readable pack name. */
  name: string;
  /** Short description of when to use this pack. */
  description: string;
  /** Template IDs that belong to this pack. */
  templateIds: string[];
  /** Tags for search and filtering. */
  tags: string[];
}

export const PRESET_PACKS: PresetPack[] = [
  {
    id: "ui-feedback",
    name: "UI Feedback",
    description: "Subtle responses to user input — taps, hovers, and state flips that confirm an action.",
    templateIds: ["tpl-pulse", "tpl-hover-lift", "tpl-ripple", "tpl-magnetic-pull", "tpl-micro-interaction"],
    tags: ["feedback", "interaction", "hover", "tap"],
  },
  {
    id: "loaders",
    name: "Loaders",
    description: "Waiting states that keep the user informed while content is fetching or processing.",
    templateIds: ["tpl-skeleton-loader", "tpl-progress", "tpl-breathing-light", "tpl-shimmer", "tpl-data-stream"],
    tags: ["loading", "skeleton", "progress", "waiting"],
  },
  {
    id: "onboarding",
    name: "Onboarding",
    description: "Reveal sequences for first-run experiences — staggered text, blurred imagery, and gradients.",
    templateIds: ["tpl-page-transition", "tpl-scroll-reveal", "tpl-text-reveal", "tpl-blur-reveal", "tpl-gradient-shift"],
    tags: ["onboarding", "reveal", "intro", "first-run"],
  },
  {
    id: "transitions",
    name: "Transitions",
    description: "Scene and state transitions for moving between views without jarring cuts.",
    templateIds: ["tpl-fade-in", "tpl-slide-up", "tpl-morph", "tpl-dissolve-out", "tpl-state-transition"],
    tags: ["transition", "scene", "navigation", "fade"],
  },
  {
    id: "celebration",
    name: "Celebration",
    description: "High-energy bursts for milestones, achievements, and festive moments.",
    templateIds: ["tpl-confetti", "tpl-particle-burst", "tpl-cosmic-birth", "tpl-photon-stream", "tpl-neon-pulse"],
    tags: ["celebration", "achievement", "burst", "festive"],
  },
  {
    id: "microinteractions",
    name: "Microinteractions",
    description: "Gesture-driven touches — tap, swipe, and long-press responses for tactile UIs.",
    templateIds: ["tpl-gesture-tap", "tpl-gesture-swipe", "tpl-long-press", "tpl-hover-lift", "tpl-magnetic-ripple"],
    tags: ["gesture", "touch", "mobile", "tactile"],
  },
];

/** List all preset packs. */
export function listPresetPacks(): PresetPack[] {
  return PRESET_PACKS;
}

/** Get a single preset pack by ID. */
export function getPresetPack(id: string): PresetPack | undefined {
  return PRESET_PACKS.find((p) => p.id === id);
}

/**
 * Instantiate every template referenced by a preset pack for a project,
 * returning the combined component drafts (already bound to projectId with
 * fresh ids) and the list of template IDs that were actually materialized.
 * The caller persists the components — this helper does not write to the DB.
 *
 * Templates that cannot be found are skipped silently (their absence is
 * reflected by a shorter component list and a shorter templateIds result).
 */
export function applyPresetPackToProject(
  pack: PresetPack,
  projectId: string,
): { components: MotionComponent[]; templateIds: string[] } {
  const components: MotionComponent[] = [];
  const templateIds: string[] = [];
  for (const templateId of pack.templateIds) {
    const instantiated = instantiateTemplate(templateId, projectId);
    if (instantiated.length > 0) {
      components.push(...instantiated);
      templateIds.push(templateId);
    }
  }
  return { components, templateIds };
}
