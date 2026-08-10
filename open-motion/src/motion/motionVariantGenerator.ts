/** Motion Variant Generator — generates multiple motion variants from a single spec for A/B comparison. */

import type { MotionSpec, MotionComponent, Easing } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Variant strategy — the dimension to vary. */
export type VariantStrategy =
  | "easing"
  | "timing"
  | "choreography"
  | "intensity"
  | "direction"
  | "palette";

/** A single motion variant. */
export interface MotionVariant {
  /** Unique variant identifier. */
  id: string;
  /** Variant name. */
  name: string;
  /** Strategy used to generate this variant. */
  strategy: VariantStrategy;
  /** Description of what changed. */
  description: string;
  /** The modified spec. */
  spec: MotionSpec;
  /** What was changed. */
  changes: VariantChange[];
  /** Variant score (0-100, how different from original). */
  divergence: number;
}

/** A single change in a variant. */
export interface VariantChange {
  /** Component that was changed. */
  componentId: string;
  /** Component name. */
  componentName: string;
  /** Property that was changed. */
  property: string;
  /** Original value. */
  oldValue: string;
  /** New value. */
  newValue: string;
}

/** Options for generating variants. */
export interface VariantOptions {
  /** Number of variants to generate. */
  count?: number;
  /** Strategies to use. If omitted, all strategies are used. */
  strategies?: VariantStrategy[];
  /** Seed for deterministic generation. */
  seed?: number;
}

// ---------------------------------------------------------------------------
// Easing Variants
// ---------------------------------------------------------------------------

const EASING_PRESETS: { name: string; easing: Easing }[] = [
  { name: "ease-in-out", easing: { type: "preset", name: "ease-in-out" } },
  { name: "ease-out", easing: { type: "preset", name: "ease-out" } },
  { name: "ease-in", easing: { type: "preset", name: "ease-in" } },
  { name: "back", easing: { type: "preset", name: "back" } },
  { name: "bounce", easing: { type: "preset", name: "bounce" } },
  { name: "elastic", easing: { type: "preset", name: "elastic" } },
  { name: "spring-soft", easing: { type: "spring", stiffness: 100, damping: 15, mass: 1 } },
  { name: "spring-firm", easing: { type: "spring", stiffness: 300, damping: 25, mass: 1 } },
  { name: "spring-bouncy", easing: { type: "spring", stiffness: 200, damping: 10, mass: 1 } },
  { name: "bezier-snappy", easing: { type: "bezier", p1: [0.1, 0.0], p2: [0.0, 1.0] } },
  { name: "bezier-dramatic", easing: { type: "bezier", p1: [0.7, 0.0], p2: [0.3, 1.0] } },
];

const TIMING_MULTIPLIERS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

const DIRECTIONS = ["normal", "reverse", "alternate", "alternate-reverse"] as const;

const INTENSITY_MULTIPLIERS = [0.5, 0.75, 1.0, 1.25, 1.5];

// ---------------------------------------------------------------------------
// Seeded Random
// ---------------------------------------------------------------------------

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed || 1;
  }

  next(): number {
    // xorshift32
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    return ((this.state >>> 0) / 4294967296);
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  pickN<T>(arr: T[], n: number): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, n);
  }
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Generate motion variants from a spec.
 * Each variant explores a different design direction.
 */
export function generateVariants(spec: MotionSpec, options?: VariantOptions): MotionVariant[] {
  const count = options?.count ?? 4;
  const strategies = options?.strategies ?? (["easing", "timing", "intensity", "direction"] as VariantStrategy[]);
  const seed = options?.seed ?? Date.now();
  const rng = new SeededRandom(seed);

  const variants: MotionVariant[] = [];

  // Ensure each strategy is used at least once if count >= strategies.length
  const strategyQueue: VariantStrategy[] = [];
  for (let i = 0; i < count; i++) {
    strategyQueue.push(strategies[i % strategies.length]);
  }

  for (let i = 0; i < count; i++) {
    const strategy = strategyQueue[i];
    const variant = generateVariant(spec, strategy, rng, i + 1);
    variants.push(variant);
  }

  return variants;
}

/** Generate a single variant using a specific strategy. */
function generateVariant(spec: MotionSpec, strategy: VariantStrategy, rng: SeededRandom, index: number): MotionVariant {
  switch (strategy) {
    case "easing":
      return generateEasingVariant(spec, rng, index);
    case "timing":
      return generateTimingVariant(spec, rng, index);
    case "choreography":
      return generateChoreographyVariant(spec, rng, index);
    case "intensity":
      return generateIntensityVariant(spec, rng, index);
    case "direction":
      return generateDirectionVariant(spec, rng, index);
    case "palette":
      return generatePaletteVariant(spec, rng, index);
    default:
      return generateEasingVariant(spec, rng, index);
  }
}

function generateEasingVariant(spec: MotionSpec, rng: SeededRandom, index: number): MotionVariant {
  const newEasing = rng.pick(EASING_PRESETS.filter((e) => e.name !== "ease-in-out")); // Avoid default
  const changes: VariantChange[] = [];

  const newComponents = spec.components.map((comp) => {
    const oldEasingName = comp.easing?.type === "preset" ? comp.easing.name : comp.easing?.type ?? "linear";
    changes.push({
      componentId: comp.id,
      componentName: comp.name,
      property: "easing",
      oldValue: oldEasingName,
      newValue: newEasing.name,
    });

    return { ...comp, easing: newEasing.easing };
  });

  return {
    id: `variant-easing-${index}`,
    name: `Easing: ${newEasing.name}`,
    strategy: "easing",
    description: `All easings changed to ${newEasing.name}`,
    spec: { ...spec, components: newComponents },
    changes,
    divergence: 60,
  };
}

function generateTimingVariant(spec: MotionSpec, rng: SeededRandom, index: number): MotionVariant {
  const multiplier = rng.pick(TIMING_MULTIPLIERS.filter((m) => m !== 1.0));
  const changes: VariantChange[] = [];

  const newComponents = spec.components.map((comp) => {
    const oldDuration = comp.durationMs;
    const newDuration = Math.round(oldDuration * multiplier);
    changes.push({
      componentId: comp.id,
      componentName: comp.name,
      property: "durationMs",
      oldValue: `${oldDuration}ms`,
      newValue: `${newDuration}ms`,
    });

    return {
      ...comp,
      durationMs: newDuration,
      delayMs: Math.round(comp.delayMs * multiplier),
    };
  });

  const label = multiplier < 1 ? `${Math.round((1 - multiplier) * 100)}% faster` : `${Math.round((multiplier - 1) * 100)}% slower`;

  return {
    id: `variant-timing-${index}`,
    name: `Timing: ${label}`,
    strategy: "timing",
    description: `All durations ${multiplier < 1 ? "compressed" : "expanded"} by ${Math.round(Math.abs(1 - multiplier) * 100)}%`,
    spec: { ...spec, components: newComponents },
    changes,
    divergence: Math.round(Math.abs(1 - multiplier) * 80),
  };
}

function generateChoreographyVariant(spec: MotionSpec, rng: SeededRandom, index: number): MotionVariant {
  const staggerBase = rng.pick([40, 80, 120, 160, 200]);
  const direction = rng.pick(["ltr", "rtl", "ttb", "btt", "center-out"]);
  const changes: VariantChange[] = [];

  // Reorder components based on direction
  let orderedComponents = [...spec.components];
  if (direction === "rtl") orderedComponents.reverse();
  if (direction === "center-out") {
    const mid = Math.floor(orderedComponents.length / 2);
    const result: MotionComponent[] = [];
    for (let i = 0; i <= mid; i++) {
      if (mid - i >= 0) result.push(orderedComponents[mid - i]);
      if (mid + i + 1 < orderedComponents.length) result.push(orderedComponents[mid + i + 1]);
    }
    orderedComponents = result;
  }

  const newComponents = orderedComponents.map((comp, i) => {
    const oldDelay = comp.delayMs;
    const newDelay = i * staggerBase;
    changes.push({
      componentId: comp.id,
      componentName: comp.name,
      property: "delayMs",
      oldValue: `${oldDelay}ms`,
      newValue: `${newDelay}ms`,
    });

    return { ...comp, delayMs: newDelay };
  });

  return {
    id: `variant-choreography-${index}`,
    name: `Choreography: ${direction}, ${staggerBase}ms stagger`,
    strategy: "choreography",
    description: `Reordered ${direction} with ${staggerBase}ms stagger between items`,
    spec: { ...spec, components: newComponents },
    changes,
    divergence: 50,
  };
}

function generateIntensityVariant(spec: MotionSpec, rng: SeededRandom, index: number): MotionVariant {
  const multiplier = rng.pick(INTENSITY_MULTIPLIERS.filter((m) => m !== 1.0));
  const changes: VariantChange[] = [];

  const newComponents = spec.components.map((comp) => {
    // Scale keyframe values by multiplier
    const newKeyframes = comp.keyframes.map((kf) => {
      const newProps: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(kf.properties)) {
        if (typeof value === "number") {
          newProps[key] = value * multiplier;
        } else {
          newProps[key] = value;
        }
      }
      return { ...kf, properties: newProps };
    });

    const oldIntensity = comp.keyframes.length > 0 ? "1.0x" : "1.0x";
    changes.push({
      componentId: comp.id,
      componentName: comp.name,
      property: "keyframe intensity",
      oldValue: oldIntensity,
      newValue: `${multiplier.toFixed(2)}x`,
    });

    return { ...comp, keyframes: newKeyframes };
  });

  const label = multiplier > 1 ? `${Math.round((multiplier - 1) * 100)}% more intense` : `${Math.round((1 - multiplier) * 100)}% subtler`;

  return {
    id: `variant-intensity-${index}`,
    name: `Intensity: ${label}`,
    strategy: "intensity",
    description: `All keyframe values ${multiplier > 1 ? "amplified" : "reduced"} by ${Math.round(Math.abs(1 - multiplier) * 100)}%`,
    spec: { ...spec, components: newComponents },
    changes,
    divergence: Math.round(Math.abs(1 - multiplier) * 70),
  };
}

function generateDirectionVariant(spec: MotionSpec, rng: SeededRandom, index: number): MotionVariant {
  const direction = rng.pick([...DIRECTIONS].filter((d) => d !== "normal"));
  const changes: VariantChange[] = [];

  const newComponents = spec.components.map((comp) => {
    changes.push({
      componentId: comp.id,
      componentName: comp.name,
      property: "direction",
      oldValue: comp.direction,
      newValue: direction,
    });

    return { ...comp, direction };
  });

  return {
    id: `variant-direction-${index}`,
    name: `Direction: ${direction}`,
    strategy: "direction",
    description: `All animation directions changed to ${direction}`,
    spec: { ...spec, components: newComponents },
    changes,
    divergence: 40,
  };
}

function generatePaletteVariant(spec: MotionSpec, rng: SeededRandom, index: number): MotionVariant {
  // Generate a hue shift for color properties
  const hueShift = rng.pick([30, 60, 90, 120, 180, -30, -60, -90, -120, -180]);
  const changes: VariantChange[] = [];

  const newComponents = spec.components.map((comp) => {
    const newStyle: Record<string, string | number> = {};
    let hasColor = false;

    for (const [key, value] of Object.entries(comp.style ?? {})) {
      if (typeof value === "string" && value.startsWith("#")) {
        // Shift hue of hex colors
        const shifted = shiftHue(value, hueShift);
        newStyle[key] = shifted;
        hasColor = true;
        changes.push({
          componentId: comp.id,
          componentName: comp.name,
          property: key,
          oldValue: value,
          newValue: shifted,
        });
      } else if (typeof value === "string" && value.startsWith("rgb")) {
        const hex = rgbToHex(value);
        const shifted = shiftHue(hex, hueShift);
        newStyle[key] = shifted;
        hasColor = true;
        changes.push({
          componentId: comp.id,
          componentName: comp.name,
          property: key,
          oldValue: value,
          newValue: shifted,
        });
      } else {
        newStyle[key] = value;
      }
    }

    return { ...comp, style: newStyle };
  });

  return {
    id: `variant-palette-${index}`,
    name: `Palette: ${hueShift > 0 ? "+" : ""}${hueShift}° hue`,
    strategy: "palette",
    description: `Color palette hue-shifted by ${hueShift}°`,
    spec: { ...spec, components: newComponents },
    changes,
    divergence: 55,
  };
}

// ---------------------------------------------------------------------------
// Color Utilities
// ---------------------------------------------------------------------------

function shiftHue(hex: string, degrees: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.h = (hsl.h + degrees / 360 + 1) % 1;
  const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgbToHexStr(newRgb.r, newRgb.g, newRgb.b);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "").match(/.{2}/g);
  if (!m || m.length < 3) return null;
  return { r: parseInt(m[0], 16), g: parseInt(m[1], 16), b: parseInt(m[2], 16) };
}

function rgbToHex(rgb: string): string {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return "#000000";
  return rgbToHexStr(parseInt(m[0]), parseInt(m[1]), parseInt(m[2]));
}

function rgbToHexStr(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return { r: r * 255, g: g * 255, b: b * 255 };
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * Compare two variants and return a summary of differences.
 */
export function compareVariants(variantA: MotionVariant, variantB: MotionVariant): {
  sharedChanges: number;
  uniqueA: number;
  uniqueB: number;
  summary: string;
} {
  const propsA = new Set(variantA.changes.map((c) => `${c.componentId}:${c.property}`));
  const propsB = new Set(variantB.changes.map((c) => `${c.componentId}:${c.property}`));

  const shared = [...propsA].filter((p) => propsB.has(p)).length;
  const uniqueA = propsA.size - shared;
  const uniqueB = propsB.size - shared;

  const summary = `Variant A (${variantA.strategy}) and Variant B (${variantB.strategy}): ${shared} shared changes, ${uniqueA} unique to A, ${uniqueB} unique to B`;

  return { sharedChanges: shared, uniqueA, uniqueB, summary };
}

/**
 * Get a summary of all variants as text.
 */
export function summarizeVariants(variants: MotionVariant[]): string {
  const lines: string[] = [];
  lines.push(`Generated ${variants.length} variants:`);
  lines.push("");

  for (const v of variants) {
    lines.push(`  ${v.name} (divergence: ${v.divergence}%)`);
    lines.push(`    ${v.description}`);
    lines.push(`    ${v.changes.length} component(s) changed`);
    lines.push("");
  }

  return lines.join("\n");
}
