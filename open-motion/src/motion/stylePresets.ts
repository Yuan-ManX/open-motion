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
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Smooth easing with long timing and alternate direction — sweeping, film-like motion.",
    easing: easingPreset("smooth"),
    durationMs: 1800,
    iterationCount: 1,
    direction: "normal",
    tags: ["film", "sweep", "epic"],
  },
  {
    id: "glassy",
    name: "Glassy",
    description: "Ease-out with moderate timing — clean, translucent, and modern interface motion.",
    easing: easingPreset("ease-out"),
    durationMs: 500,
    iterationCount: 1,
    direction: "normal",
    tags: ["clean", "modern", "interface"],
  },
  {
    id: "retro",
    name: "Retro",
    description: "Bounce easing with quick timing and alternate loops — nostalgic, playful, and vintage.",
    easing: easingPreset("bounce"),
    durationMs: 700,
    iterationCount: "infinite",
    direction: "alternate",
    tags: ["vintage", "nostalgic", "fun"],
  },
  {
    id: "futuristic",
    name: "Futuristic",
    description: "Snappy easing with fast timing — sleek, precise, and tech-forward.",
    easing: easingPreset("snappy"),
    durationMs: 350,
    iterationCount: 1,
    direction: "normal",
    tags: ["tech", "sleek", "precise"],
  },
  {
    id: "organic",
    name: "Organic",
    description: "Smooth easing with gentle timing and alternate loops — natural, breathing, and alive.",
    easing: easingPreset("smooth"),
    durationMs: 2500,
    iterationCount: "infinite",
    direction: "alternate",
    tags: ["natural", "breathing", "alive"],
  },
  {
    id: "mechanical",
    name: "Mechanical",
    description: "Linear easing with precise timing — robotic, exact, and systematic.",
    easing: easingPreset("linear"),
    durationMs: 400,
    iterationCount: 1,
    direction: "normal",
    tags: ["robotic", "exact", "systematic"],
  },
  {
    id: "luxury",
    name: "Luxury",
    description: "Back easing with slow timing — premium, elegant, and sophisticated.",
    easing: easingPreset("back"),
    durationMs: 1200,
    iterationCount: 1,
    direction: "normal",
    tags: ["premium", "elegant", "sophisticated"],
  },
  {
    id: "industrial",
    name: "Industrial",
    description: "Linear easing with sharp timing — raw, mechanical, and structural.",
    easing: easingPreset("linear"),
    durationMs: 350,
    iterationCount: 1,
    direction: "normal",
    tags: ["raw", "mechanical", "structural"],
  },
  {
    id: "neon",
    name: "Neon",
    description: "Elastic easing with fast timing and alternate loops — vibrant, electric, and pulsing.",
    easing: easingPreset("elastic"),
    durationMs: 800,
    iterationCount: "infinite",
    direction: "alternate",
    tags: ["vibrant", "electric", "pulse"],
  },
  {
    id: "vintage",
    name: "Vintage",
    description: "Ease-in-out with moderate timing — nostalgic, warm, and classic.",
    easing: easingPreset("ease-in-out"),
    durationMs: 900,
    iterationCount: 1,
    direction: "normal",
    tags: ["nostalgic", "warm", "classic"],
  },
  {
    id: "athletic",
    name: "Athletic",
    description: "Snappy easing with fast timing and alternate direction — dynamic, powerful, and agile.",
    easing: easingPreset("snappy"),
    durationMs: 250,
    iterationCount: "infinite",
    direction: "alternate",
    tags: ["dynamic", "powerful", "agile"],
  },
];

export function getStylePreset(id: string): StylePreset | undefined {
  return STYLE_PRESETS.find((p) => p.id === id);
}

export function listStylePresets(): StylePreset[] {
  return STYLE_PRESETS;
}
