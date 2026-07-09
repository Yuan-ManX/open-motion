import type { Easing } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";

/**
 * A motion style preset bundles an aesthetic vision — easing family, duration
 * range, loop behavior, and direction — into a single named configuration.
 * Applied across ALL components in a project for a coherent feel.
 *
 * Distinct from animation presets (shake, wiggle, etc.) which define
 * individual keyframe patterns. Style presets define the overall "mood".
 */
export interface StylePreset {
  id: string;
  name: string;
  description: string;
  easing: Easing;
  durationMs: number;
  iterationCount: number | "infinite";
  direction: "normal" | "reverse" | "alternate" | "alternate-reverse";
  tags: string[];
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "playful",
    name: "Playful",
    description: "Bouncy easing with quick timing and infinite loops — energetic and fun.",
    easing: easingPreset("bounce"),
    durationMs: 600,
    iterationCount: "infinite",
    direction: "alternate",
    tags: ["fun", "energetic", "loop"],
  },
  {
    id: "energetic",
    name: "Energetic",
    description: "Snappy easing with fast timing — crisp, punchy, and attention-grabbing.",
    easing: easingPreset("snappy"),
    durationMs: 300,
    iterationCount: 1,
    direction: "normal",
    tags: ["fast", "punchy", "crisp"],
  },
  {
    id: "calm",
    name: "Calm",
    description: "Smooth easing with slow timing and gentle loops — serene and meditative.",
    easing: easingPreset("smooth"),
    durationMs: 2000,
    iterationCount: "infinite",
    direction: "alternate",
    tags: ["smooth", "slow", "gentle"],
  },
  {
    id: "professional",
    name: "Professional",
    description: "Ease-out with moderate timing — polished, confident, and business-ready.",
    easing: easingPreset("ease-out"),
    durationMs: 800,
    iterationCount: 1,
    direction: "normal",
    tags: ["polished", "business", "clean"],
  },
  {
    id: "dramatic",
    name: "Dramatic",
    description: "Back easing with long timing — theatrical, suspenseful, and impactful.",
    easing: easingPreset("back"),
    durationMs: 1500,
    iterationCount: 1,
    direction: "normal",
    tags: ["theatrical", "suspense", "impact"],
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Linear easing with ultra-fast timing — subtle, understated, and refined.",
    easing: easingPreset("linear"),
    durationMs: 200,
    iterationCount: 1,
    direction: "normal",
    tags: ["subtle", "fast", "understated"],
  },
];

export function getStylePreset(id: string): StylePreset | undefined {
  return STYLE_PRESETS.find((p) => p.id === id);
}

export function listStylePresets(): StylePreset[] {
  return STYLE_PRESETS;
}
