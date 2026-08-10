/** Cursor Choreography — presets for cursor-driven motion choreography (reveal, trail, magnet, spotlight, repel, tug). */

import type { Easing } from "@openmotion/shared";
import { easingPreset, easingSpring, easingBezier } from "@openmotion/shared";

/** The cursor-driven pattern type. */
export type CursorPattern =
  | "reveal"
  | "trail"
  | "magnet"
  | "spotlight"
  | "repel"
  | "tug"
  | "wake";

/** A cursor choreography preset. */
export interface CursorChoreography {
  /** Unique preset identifier. */
  id: string;
  /** Human-readable preset name. */
  name: string;
  /** Cursor-driven pattern. */
  pattern: CursorPattern;
  /** Short description of the effect and when to use it. */
  description: string;
  /** Radius of cursor influence (px). */
  radius: number;
  /** Intensity multiplier (0..1 — how strongly elements respond). */
  intensity: number;
  /** Easing applied to the response curve. */
  easing: Easing;
  /** Response duration (ms) — how quickly elements react to cursor moves. */
  durationMs: number;
  /** Whether the effect continues to track when the cursor leaves (lags behind). */
  trailsCursor: boolean;
  /** Recommended number of elements the pattern works best on. */
  idealElementCount: number;
  /** Tags for search and filtering. */
  tags: string[];
}

export const CURSOR_CHOREOGRAPHY: CursorChoreography[] = [
  {
    id: "cursor-reveal-spotlight",
    name: "Spotlight Reveal",
    pattern: "spotlight",
    description: "Cursor acts as a spotlight — elements inside the radius fade in, outside elements stay dim. Ideal for hero sections and immersive landing pages.",
    radius: 180,
    intensity: 0.8,
    easing: easingPreset("ease-out"),
    durationMs: 300,
    trailsCursor: false,
    idealElementCount: 8,
    tags: ["spotlight", "reveal", "hero", "immersive", "cursor"],
  },
  {
    id: "cursor-magnet-attract",
    name: "Magnetic Attract",
    pattern: "magnet",
    description: "Elements within the radius drift toward the cursor with spring physics. Ideal for CTAs and interactive clusters.",
    radius: 120,
    intensity: 0.6,
    easing: easingSpring(220, 22, 1),
    durationMs: 250,
    trailsCursor: true,
    idealElementCount: 5,
    tags: ["magnet", "attract", "spring", "cta", "interactive"],
  },
  {
    id: "cursor-trail-ribbon",
    name: "Trail Ribbon",
    pattern: "trail",
    description: "Elements trail behind the cursor in a delayed ribbon — each element lags the previous. Ideal for playfulness and ambient feedback.",
    radius: 200,
    intensity: 0.5,
    easing: easingPreset("smooth"),
    durationMs: 600,
    trailsCursor: true,
    idealElementCount: 12,
    tags: ["trail", "ribbon", "playful", "ambient", "cursor"],
  },
  {
    id: "cursor-repel-bubble",
    name: "Repel Bubble",
    pattern: "repel",
    description: "Elements push away from the cursor as if avoiding contact, then spring back. Ideal for playful grids and creative portfolios.",
    radius: 100,
    intensity: 0.7,
    easing: easingSpring(180, 18, 1),
    durationMs: 400,
    trailsCursor: false,
    idealElementCount: 16,
    tags: ["repel", "bubble", "playful", "grid", "portfolio"],
  },
  {
    id: "cursor-tug-elastic",
    name: "Elastic Tug",
    pattern: "tug",
    description: "Elements tug slightly toward the cursor with elastic overshoot, then settle — suggests the cursor is pulling on a thread. Ideal for editorial and storytelling.",
    radius: 240,
    intensity: 0.4,
    easing: easingSpring(140, 12, 1),
    durationMs: 500,
    trailsCursor: true,
    idealElementCount: 6,
    tags: ["tug", "elastic", "editorial", "storytelling", "cursor"],
  },
  {
    id: "cursor-reveal-wipe",
    name: "Wipe Reveal",
    pattern: "reveal",
    description: "Cursor acts as a wipe mask — elements appear as the cursor passes over them and stay revealed. Ideal for image galleries and progressive disclosure.",
    radius: 160,
    intensity: 1.0,
    easing: easingBezier([0.4, 0.0], [0.2, 1.0]),
    durationMs: 200,
    trailsCursor: false,
    idealElementCount: 20,
    tags: ["wipe", "reveal", "gallery", "disclosure", "cursor"],
  },
  {
    id: "cursor-wake-ambient",
    name: "Ambient Wake",
    pattern: "wake",
    description: "Dormant elements wake gently as the cursor approaches — subtle scale and opacity shifts that suggest life. Ideal for dashboards and minimal interfaces.",
    radius: 220,
    intensity: 0.3,
    easing: easingPreset("smooth"),
    durationMs: 700,
    trailsCursor: false,
    idealElementCount: 10,
    tags: ["wake", "ambient", "subtle", "dashboard", "minimal"],
  },
];

/** List all cursor choreography presets, optionally filtered by pattern. */
export function listCursorChoreography(pattern?: CursorPattern): CursorChoreography[] {
  if (!pattern) return CURSOR_CHOREOGRAPHY;
  return CURSOR_CHOREOGRAPHY.filter((c) => c.pattern === pattern);
}

/** Get a single cursor choreography preset by id. */
export function getCursorChoreography(id: string): CursorChoreography | undefined {
  return CURSOR_CHOREOGRAPHY.find((c) => c.id === id);
}

/** Pick the preset whose tags best match a free-text query. */
export function matchCursorChoreography(query: string): CursorChoreography | undefined {
  const q = query.toLowerCase();
  let best: CursorChoreography | undefined;
  let bestScore = 0;
  for (const preset of CURSOR_CHOREOGRAPHY) {
    let score = 0;
    if (preset.pattern.toLowerCase().includes(q)) score += 50;
    if (preset.name.toLowerCase().includes(q)) score += 30;
    for (const tag of preset.tags) {
      if (tag.toLowerCase().includes(q)) score += 20;
    }
    if (score > bestScore) {
      bestScore = score;
      best = preset;
    }
  }
  return best;
}
