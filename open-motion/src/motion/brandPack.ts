/**
 * Brand Pack system — cohesive motion identity presets stored as JSON in
 * project tokens. A Brand Pack defines the "motion personality" of a project:
 * standard durations, signature easings, trigger philosophy, stagger timing,
 * and personality traits (energy, formality, playfulness, precision).
 *
 * Applying a Brand Pack to a project rewrites all component timing parameters
 * to align with the brand's motion identity, creating instant consistency.
 */

import type { Easing, MotionComponent } from "@openmotion/shared";
import { easingPreset, easingBezier, easingSpring } from "@openmotion/shared";

export interface BrandPack {
  id: string;
  name: string;
  description: string;
  durationScale: {
    fast: number;
    normal: number;
    slow: number;
    cinematic: number;
  };
  easings: {
    primary: Easing;
    secondary: Easing;
    emphasis: Easing;
    exit: Easing;
  };
  defaultTrigger: "onLoad" | "onClick" | "onHover" | "onScroll" | "afterDelay";
  loopPhilosophy: "none" | "subtle-ambient" | "playful-continuous";
  staggerStepMs: number;
  personality: {
    energy: number;
    formality: number;
    playfulness: number;
    precision: number;
  };
  signaturePatterns: Array<{
    name: string;
    description: string;
    easing: Easing;
    durationMs: number;
  }>;
  createdAt: string;
}

export interface BrandPackSummary {
  id: string;
  name: string;
  description: string;
  energy: number;
  formality: number;
  playfulness: number;
  precision: number;
  defaultTrigger: string;
  loopPhilosophy: string;
}

const BRAND_PACKS_KEY = "__brandPacks";

function genId(): string {
  return `brand_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Read brand packs from project tokens. */
export function readBrandPacks(tokens: Record<string, string | number>): BrandPack[] {
  const raw = tokens[BRAND_PACKS_KEY];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as BrandPack[];
  } catch {
    return [];
  }
}

/** Write brand packs to tokens. */
export function writeBrandPacks(
  tokens: Record<string, string | number>,
  packs: BrandPack[],
): Record<string, string | number> {
  return { ...tokens, [BRAND_PACKS_KEY]: JSON.stringify(packs) };
}

/** Find a brand pack by ID. */
export function findBrandPack(
  packId: string,
  tokens: Record<string, string | number>,
): BrandPack | undefined {
  return readBrandPacks(tokens).find((p) => p.id === packId);
}

/** Summarize brand packs for display. */
export function summarizeBrandPacks(tokens: Record<string, string | number>): BrandPackSummary[] {
  return readBrandPacks(tokens).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    energy: p.personality.energy,
    formality: p.personality.formality,
    playfulness: p.personality.playfulness,
    precision: p.personality.precision,
    defaultTrigger: p.defaultTrigger,
    loopPhilosophy: p.loopPhilosophy,
  }));
}

/** Delete a brand pack by ID. */
export function deleteBrandPack(
  packId: string,
  tokens: Record<string, string | number>,
): Record<string, string | number> {
  const packs = readBrandPacks(tokens).filter((p) => p.id !== packId);
  return writeBrandPacks(tokens, packs);
}

/**
 * Apply a brand pack to a component — rewrites timing, easing, and trigger
 * to align with the brand's motion identity. Returns a patch object.
 */
export function applyBrandPackToComponent(
  pack: BrandPack,
  component: MotionComponent,
): Partial<MotionComponent> {
  const patch: Partial<MotionComponent> = {};

  // Map duration to brand scale based on current duration range
  const current = component.durationMs;
  if (current <= 200) {
    patch.durationMs = pack.durationScale.fast;
  } else if (current <= 500) {
    patch.durationMs = pack.durationScale.normal;
  } else if (current <= 1000) {
    patch.durationMs = pack.durationScale.slow;
  } else {
    patch.durationMs = pack.durationScale.cinematic;
  }

  // Assign easing based on component role (entrance vs exit vs emphasis)
  const isExit = /exit|leave|out|hide|dismiss|close/i.test(component.name);
  const isEmphasis = /emphasis|highlight|pulse|shake|glow|attention/i.test(component.name);
  if (isExit) {
    patch.easing = pack.easings.exit;
  } else if (isEmphasis) {
    patch.easing = pack.easings.emphasis;
  } else if (component.delayMs > 0) {
    patch.easing = pack.easings.secondary;
  } else {
    patch.easing = pack.easings.primary;
  }

  // Apply default trigger
  patch.trigger = pack.defaultTrigger;

  // Apply loop philosophy
  if (pack.loopPhilosophy === "none") {
    patch.iterationCount = 1;
  } else if (pack.loopPhilosophy === "subtle-ambient" && component.iterationCount === "infinite") {
    patch.iterationCount = "infinite";
    patch.direction = "alternate";
  } else if (pack.loopPhilosophy === "playful-continuous") {
    patch.iterationCount = "infinite";
    patch.direction = "alternate";
  }

  return patch;
}

/** Built-in brand pack presets. */
export const BRAND_PACK_PRESETS: Array<Omit<BrandPack, "id" | "createdAt">> = [
  {
    name: "Minimal Reserve",
    description: "Understated, confident, Apple-keynote timing. Smooth deceleration, generous durations, no loops.",
    durationScale: { fast: 250, normal: 400, slow: 600, cinematic: 900 },
    easings: {
      primary: easingPreset("smooth"),
      secondary: easingPreset("ease-out"),
      emphasis: easingPreset("smooth"),
      exit: easingPreset("ease-in"),
    },
    defaultTrigger: "onLoad",
    loopPhilosophy: "none",
    staggerStepMs: 80,
    personality: { energy: 3, formality: 9, playfulness: 2, precision: 8 },
    signaturePatterns: [
      { name: "Soft Reveal", description: "Gentle fade + upward drift", easing: easingPreset("smooth"), durationMs: 600 },
      { name: "Confident Scale", description: "Measured scale-up with overshoot", easing: easingPreset("back"), durationMs: 500 },
    ],
  },
  {
    name: "Material Expressive",
    description: "Google Material motion — snappy, responsive, standardized easing curves.",
    durationScale: { fast: 150, normal: 300, slow: 450, cinematic: 600 },
    easings: {
      primary: easingBezier([0.4, 0.0], [0.2, 1]),
      secondary: easingBezier([0.2, 0.0], [0.0, 1]),
      emphasis: easingBezier([0.4, 0.0], [0.6, 1]),
      exit: easingBezier([0.4, 0.0], [1, 1]),
    },
    defaultTrigger: "onLoad",
    loopPhilosophy: "none",
    staggerStepMs: 50,
    personality: { energy: 6, formality: 6, playfulness: 4, precision: 7 },
    signaturePatterns: [
      { name: "Shared Transition", description: "Container transform", easing: easingBezier([0.4, 0.0], [0.2, 1]), durationMs: 300 },
      { name: "Fade Through", description: "Opacity crossfade", easing: easingBezier([0.4, 0.0], [0.2, 1]), durationMs: 150 },
    ],
  },
  {
    name: "Playful Dynamic",
    description: "Nintendo-inspired bounce, spring physics, energetic cascades. Fun and tactile.",
    durationScale: { fast: 200, normal: 400, slow: 700, cinematic: 1000 },
    easings: {
      primary: easingSpring(400, 15, 1),
      secondary: easingPreset("bounce"),
      emphasis: easingPreset("elastic"),
      exit: easingPreset("ease-in"),
    },
    defaultTrigger: "onClick",
    loopPhilosophy: "playful-continuous",
    staggerStepMs: 100,
    personality: { energy: 9, formality: 2, playfulness: 9, precision: 4 },
    signaturePatterns: [
      { name: "Bounce In", description: "Spring entrance with overshoot", easing: easingSpring(400, 15, 1), durationMs: 500 },
      { name: "Squash Stretch", description: "Cartoon physics deformation", easing: easingPreset("bounce"), durationMs: 400 },
    ],
  },
  {
    name: "Cinematic Flow",
    description: "Stripe-style refined motion — custom bezier curves, generous timing, ambient breathing.",
    durationScale: { fast: 300, normal: 500, slow: 800, cinematic: 1200 },
    easings: {
      primary: easingBezier([0.16, 1], [0.3, 1]),
      secondary: easingBezier([0.7, 0], [0.3, 1]),
      emphasis: easingBezier([0.34, 1.56], [0.64, 1]),
      exit: easingBezier([0.7, 0], [0.84, 0]),
    },
    defaultTrigger: "onScroll",
    loopPhilosophy: "subtle-ambient",
    staggerStepMs: 120,
    personality: { energy: 5, formality: 7, playfulness: 3, precision: 6 },
    signaturePatterns: [
      { name: "Scroll Reveal", description: "Elements rise into view on scroll", easing: easingBezier([0.16, 1], [0.3, 1]), durationMs: 800 },
      { name: "Ambient Float", description: "Subtle infinite breathing", easing: easingBezier([0.7, 0], [0.3, 1]), durationMs: 3000 },
    ],
  },
  {
    name: "Technical Precision",
    description: "Linear, exact, mechanical. For data dashboards, technical UIs, engineering tools.",
    durationScale: { fast: 100, normal: 200, slow: 300, cinematic: 400 },
    easings: {
      primary: easingPreset("linear"),
      secondary: easingPreset("ease"),
      emphasis: easingPreset("snappy"),
      exit: easingPreset("linear"),
    },
    defaultTrigger: "onClick",
    loopPhilosophy: "none",
    staggerStepMs: 30,
    personality: { energy: 4, formality: 8, playfulness: 1, precision: 10 },
    signaturePatterns: [
      { name: "Instant Toggle", description: "Immediate state switch", easing: easingPreset("linear"), durationMs: 100 },
      { name: "Data Update", description: "Quick value transition", easing: easingPreset("ease"), durationMs: 200 },
    ],
  },
];

/** Seed a project with brand pack presets. */
export function seedBrandPacks(
  tokens: Record<string, string | number>,
): Record<string, string | number> {
  const existing = readBrandPacks(tokens);
  const now = new Date().toISOString();
  const presets: BrandPack[] = BRAND_PACK_PRESETS.map((p) => ({
    ...p,
    id: genId(),
    createdAt: now,
  }));
  return writeBrandPacks(tokens, [...existing, ...presets]);
}

/** Save a custom brand pack from explicit parameters. */
export function saveBrandPack(
  options: {
    name: string;
    description?: string;
    durationScale?: Partial<BrandPack["durationScale"]>;
    easings?: Partial<BrandPack["easings"]>;
    defaultTrigger?: BrandPack["defaultTrigger"];
    loopPhilosophy?: BrandPack["loopPhilosophy"];
    staggerStepMs?: number;
    personality?: Partial<BrandPack["personality"]>;
  },
  tokens: Record<string, string | number>,
): { pack: BrandPack; tokens: Record<string, string | number> } {
  const packs = readBrandPacks(tokens);
  const defaultPreset = BRAND_PACK_PRESETS[0];
  const pack: BrandPack = {
    id: genId(),
    name: options.name,
    description: options.description ?? `Custom brand pack: ${options.name}`,
    durationScale: { ...defaultPreset.durationScale, ...options.durationScale },
    easings: { ...defaultPreset.easings, ...options.easings },
    defaultTrigger: options.defaultTrigger ?? "onLoad",
    loopPhilosophy: options.loopPhilosophy ?? "none",
    staggerStepMs: options.staggerStepMs ?? 80,
    personality: { ...defaultPreset.personality, ...options.personality },
    signaturePatterns: [],
    createdAt: new Date().toISOString(),
  };
  const updated = writeBrandPacks(tokens, [...packs, pack]);
  return { pack, tokens: updated };
}
