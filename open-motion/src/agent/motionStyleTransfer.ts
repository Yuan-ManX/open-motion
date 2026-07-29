/**
 * Motion Style Transfer Engine — extracts the "style DNA" of a source motion
 * and grafts it onto the structure of a target motion. Analogous to image
 * style transfer, but the medium is motion design: easing curves, tempo,
 * energy, axis preference, color palette, iteration behavior, and staging.
 *
 * This is an original AI-native module. The pipeline is fully rule-based —
 * no LLM round-trip is required. Style is treated as a separable layer from
 * structure: the target keeps its components, keyframe offsets, and identity,
 * while the surface expression (how it feels) is rewritten from the source.
 *
 * Core operations:
 * 1. extractStyleDNA — analyze a MotionSpec and produce a MotionStyleDNA fingerprint
 * 2. transferStyle — graft source style onto target structure
 * 3. blendStyles — interpolate two specs' DNA by a ratio
 * 4. describeStyle — human-readable style description
 * 5. compareStyles — per-dimension similarity between two DNAs
 * 6. listStyleArchetypes — curated style archetypes (Minimalist, Energetic, etc.)
 * 7. applyArchetype — apply a named archetype's DNA to a spec
 */

import type { MotionComponent, MotionSpec, Easing } from "@openmotion/shared";
import { easingPreset, easingSpring } from "../shared/motion/easing.js";

// ---------------------------------------------------------------------------
// Style DNA interfaces
// ---------------------------------------------------------------------------

/** Easing-family profile derived from the distribution of easing curves. */
export interface EasingProfile {
  dominant: "smooth" | "snappy" | "bouncy" | "linear" | "spring" | "custom";
  /** Family -> share (0..1). Sums to ~1 across all families present. */
  distribution: Record<string, number>;
  /** 0..1 — how curvy vs linear the average easing is. */
  curvature: number;
  /** 0..1 — degree of overshoot (back/elastic/bounce/spring). */
  overshoot: number;
}

/** Tempo characteristics derived from duration and delay distribution. */
export interface TempoProfile {
  averageDurationMs: number;
  /** Standard deviation of durations in ms. */
  durationSpread: number;
  pace: "fast" | "moderate" | "slow" | "ceremonial";
  /** 0..1 — how regular (rhythmic) the timing is. Higher = metronomic. */
  rhythmicity: number;
  /** Animations per second across the whole timeline. */
  density: number;
}

/** How elements are staged in time. */
export interface StagingProfile {
  style: "sequential" | "simultaneous" | "cascading" | "scattered";
  /** Average delay step between consecutive components in ms. */
  staggerMs: number;
  /** 0..1 — fraction of the timeline where two or more components overlap. */
  overlap: number;
}

/** Iteration and direction tendencies. */
export interface IterationProfile {
  /** 0..1 — fraction of components that loop (iteration > 1 or infinite). */
  loopDominance: number;
  preferredDirection: "normal" | "reverse" | "alternate" | "alternate-reverse";
  /** Average iteration count (infinite treated as a large number). */
  averageIterations: number;
}

/** Color palette extracted from component styles. */
export interface ColorPalette {
  /** Dominant colors (hex), ordered by frequency. */
  dominant: string[];
  /** Accent colors (hex), less frequent but present. */
  accent: string[];
  /** 0..1 — warmth (red/yellow weighted). */
  warmth: number;
  /** 0..1 — average saturation. */
  saturation: number;
}

/** The full style fingerprint of a motion. */
export interface MotionStyleDNA {
  easingProfile: EasingProfile;
  tempoProfile: TempoProfile;
  /** 0..1 — overall motion energy. */
  energyLevel: number;
  /** Transform axis -> share of animated property usage (0..1). */
  axisPreferences: Record<string, number>;
  colorPalette: ColorPalette;
  /** 0..1 — keyframe and property complexity. */
  complexityScore: number;
  iterationBehavior: IterationProfile;
  stagingPattern: StagingProfile;
}

/** Controls how strongly each style dimension is transferred. */
export interface TransferOptions {
  /** 0..1 — how strongly to replace target easings with source's. */
  easingStrength: number;
  /** 0..1 — how strongly to align target durations to source tempo. */
  tempoStrength: number;
  /** 0..1 — how strongly to rescale target transform magnitudes. */
  energyStrength: number;
  /** 0..1 — how strongly to remap transform axes toward source preferences. */
  axisStrength: number;
  /** 0..1 — how strongly to apply source color palette to target styles. */
  colorStrength: number;
  /** 0..1 — how strongly to align keyframe complexity. */
  complexityStrength: number;
  /** 0..1 — how strongly to align iteration behavior. */
  iterationStrength: number;
  /** 0..1 — how strongly to restage delays to match source staging. */
  stagingStrength: number;
  /** When true, keep target component count, ids, names, and keyframe offsets. */
  preserveTargetStructure: boolean;
}

/** Per-dimension comparison result. */
export interface DimensionComparison {
  dimension: string;
  /** 0..1 — similarity, where 1 means identical. */
  similarity: number;
  /** Human-readable delta description. */
  delta: string;
}

/** Full comparison between two style DNAs. */
export interface StyleComparison {
  /** 0..1 — weighted overall similarity. */
  overallSimilarity: number;
  perDimension: DimensionComparison[];
  /** Notable traits both styles share. */
  sharedTraits: string[];
  /** Notable traits where the styles diverge. */
  differences: string[];
  /** Verdict label, e.g. "near-identical", "related", "contrasting". */
  verdict: string;
}

/** A named, curated style archetype. */
export interface StyleArchetype {
  /** Stable identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** One-line description of the look and feel. */
  description: string;
  /** The DNA this archetype embodies. */
  dna: MotionStyleDNA;
  /** Short signature phrases describing the visual outcome. */
  signatures: string[];
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

/** Default transfer options — moderate strength on every dimension. */
export const DEFAULT_TRANSFER_OPTIONS: TransferOptions = {
  easingStrength: 0.8,
  tempoStrength: 0.7,
  energyStrength: 0.7,
  axisStrength: 0.4,
  colorStrength: 0.6,
  complexityStrength: 0.5,
  iterationStrength: 0.6,
  stagingStrength: 0.7,
  preserveTargetStructure: true,
};

// ---------------------------------------------------------------------------
// Internal helpers — easing analysis
// ---------------------------------------------------------------------------

type EasingFamily = "smooth" | "snappy" | "bouncy" | "linear" | "spring" | "custom";

/** Classify an easing into a family token used for distribution analysis. */
function classifyEasing(easing: Easing): EasingFamily {
  if (easing.type === "preset") {
    const n = easing.name;
    if (n === "linear") return "linear";
    if (n === "bounce" || n === "back" || n === "elastic") return "bouncy";
    if (n === "smooth" || n === "soft" || n === "ease" || n === "ease-in-out" || n === "ease-out") return "smooth";
    if (n === "snappy" || n === "ease-in") return "snappy";
    // Quad/cubic easings resolve to smooth by default.
    return "smooth";
  }
  if (easing.type === "spring") return "spring";
  if (easing.type === "bezier") {
    // Control points outside [0,1] on the y-axis indicate overshoot.
    if (easing.p1[1] < 0 || easing.p2[1] > 1) return "bouncy";
    // A shallow horizontal span reads as smooth; a steep one as snappy.
    const span = Math.abs(easing.p2[0] - easing.p1[0]);
    return span < 0.45 ? "smooth" : "snappy";
  }
  return "custom";
}

/** Curvature score 0..1 — how non-linear the easing is. Linear = 0. */
function easingCurvature(easing: Easing): number {
  if (easing.type === "preset") {
    if (easing.name === "linear") return 0;
    if (easing.name === "bounce" || easing.name === "elastic") return 0.95;
    if (easing.name === "back") return 0.8;
    if (easing.name === "smooth" || easing.name === "soft") return 0.6;
    if (easing.name === "ease-in-out" || easing.name === "ease-in-out-quad" || easing.name === "ease-in-out-cubic") return 0.55;
    if (easing.name === "ease-out" || easing.name === "ease-out-quad" || easing.name === "ease-out-cubic") return 0.5;
    if (easing.name === "ease-in" || easing.name === "ease-in-quad" || easing.name === "ease-in-cubic") return 0.5;
    if (easing.name === "snappy") return 0.7;
    return 0.5;
  }
  if (easing.type === "spring") return 0.85;
  if (easing.type === "bezier") {
    // Distance of control points from the diagonal line y=x.
    const ax = easing.p1[0], ay = easing.p1[1];
    const bx = easing.p2[0], by = easing.p2[1];
    const devA = Math.abs(ay - ax);
    const devB = Math.abs(by - bx);
    return Math.min(1, (devA + devB) / 1.2);
  }
  return 0.5;
}

/** Overshoot score 0..1 — whether the curve exceeds its terminal value. */
function easingOvershoot(easing: Easing): number {
  if (easing.type === "preset") {
    if (easing.name === "bounce") return 0.9;
    if (easing.name === "elastic") return 0.95;
    if (easing.name === "back") return 0.75;
    if (easing.name === "smooth" || easing.name === "soft") return 0.0;
    if (easing.name === "snappy") return 0.15;
    return 0.0;
  }
  if (easing.type === "spring") {
    const r = easing.damping / (2 * Math.sqrt(easing.stiffness * easing.mass));
    // Under-damped springs overshoot.
    return r >= 1 ? 0 : Math.min(1, 1 - r);
  }
  if (easing.type === "bezier") {
    const overY = Math.max(0, easing.p2[1] - 1) + Math.max(0, -easing.p1[1]);
    return Math.min(1, overY * 2);
  }
  return 0;
}

/** Resolve a family token back to a representative easing curve. */
function familyToEasing(family: EasingFamily): Easing {
  switch (family) {
    case "smooth": return easingPreset("smooth");
    case "snappy": return easingPreset("snappy");
    case "bouncy": return easingPreset("back");
    case "linear": return easingPreset("linear");
    case "spring": return easingSpring(180, 14, 1);
    case "custom": return easingPreset("ease-out");
  }
}

// ---------------------------------------------------------------------------
// Internal helpers — color analysis
// ---------------------------------------------------------------------------

interface ParsedColor {
  r: number;
  g: number;
  b: number;
  /** 0..1 — saturation in HSL space. */
  sat: number;
  /** 0..1 — warmth (red/yellow weighted). */
  warmth: number;
  /** Original normalized hex form, e.g. #ff8800. */
  hex: string;
}

/** Parse a CSS color string into RGB. Supports #rgb, #rrggbb, rgb(), rgba(). */
function parseColor(input: string): ParsedColor | null {
  if (!input) return null;
  const s = input.trim().toLowerCase();
  let r = 0, g = 0, b = 0;

  const hex3 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  const hex6 = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex3) {
    r = parseInt(hex3[1] + hex3[1], 16);
    g = parseInt(hex3[2] + hex3[2], 16);
    b = parseInt(hex3[3] + hex3[3], 16);
  } else if (hex6) {
    r = parseInt(hex6[1], 16);
    g = parseInt(hex6[2], 16);
    b = parseInt(hex6[3], 16);
  } else {
    const rgbMatch = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
      r = parseInt(rgbMatch[1], 10);
      g = parseInt(rgbMatch[2], 10);
      b = parseInt(rgbMatch[3], 10);
    } else {
      return null;
    }
  }

  // Normalize to 0..1 for HSL computation.
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let sat = 0;
  if (max > 0) sat = delta / max;
  const warmth = (r * 0.5 + g * 0.3 + (255 - b) * 0.2) / 255;
  const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  return { r, g, b, sat, warmth, hex };
}

/** Extract color strings from a component's style record. */
function extractComponentColors(style: Record<string, unknown> | undefined): string[] {
  if (!style) return [];
  const out: string[] = [];
  const keys = ["backgroundColor", "color", "borderColor", "boxShadow", "outlineColor"];
  for (const k of keys) {
    const v = style[k];
    if (typeof v === "string" && v) out.push(v);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Internal helpers — stats and cloning
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Deep-clone a motion component so the original spec is never mutated. */
function cloneComponent(comp: MotionComponent): MotionComponent {
  return {
    ...comp,
    keyframes: comp.keyframes.map((kf) => ({
      ...kf,
      properties: { ...kf.properties },
      easing: kf.easing ? { ...kf.easing } : undefined,
    })),
    easing: { ...comp.easing },
    style: { ...comp.style },
  };
}

/** Extract the numeric magnitude of a keyframe property value. */
function numericMagnitude(value: unknown): number {
  if (typeof value === "number") return Math.abs(value);
  if (typeof value === "string") {
    const m = value.match(/-?\d+\.?\d*/);
    if (m) return Math.abs(parseFloat(m[0]));
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Core: extractStyleDNA
// ---------------------------------------------------------------------------

/**
 * Analyze a MotionSpec and extract its style DNA. The DNA captures easing
 * family distribution, tempo, energy, axis preferences, color palette,
 * complexity, iteration behavior, and staging — independent of the spec's
 * concrete structure (component count or ids).
 */
export function extractStyleDNA(spec: MotionSpec): MotionStyleDNA {
  const comps = spec.components;
  const n = comps.length;

  if (n === 0) {
    return emptyDNA();
  }

  // --- Easing profile ---
  const familyCounts: Record<string, number> = {};
  let totalCurvature = 0;
  let totalOvershoot = 0;
  for (const c of comps) {
    const f = classifyEasing(c.easing);
    familyCounts[f] = (familyCounts[f] ?? 0) + 1;
    totalCurvature += easingCurvature(c.easing);
    totalOvershoot += easingOvershoot(c.easing);
    for (const kf of c.keyframes) {
      if (kf.easing) {
        const kfFamily = classifyEasing(kf.easing);
        familyCounts[kfFamily] = (familyCounts[kfFamily] ?? 0) + 0.5;
        totalCurvature += easingCurvature(kf.easing) * 0.5;
        totalOvershoot += easingOvershoot(kf.easing) * 0.5;
      }
    }
  }
  const familyTotal = Object.values(familyCounts).reduce((a, b) => a + b, 0) || 1;
  const distribution: Record<string, number> = {};
  let dominant: EasingFamily = "custom";
  let dominantShare = -1;
  for (const [fam, cnt] of Object.entries(familyCounts)) {
    const share = cnt / familyTotal;
    distribution[fam] = share;
    if (share > dominantShare) {
      dominantShare = share;
      dominant = fam as EasingFamily;
    }
  }
  // "custom" only wins if nothing else is present.
  if (dominant === "custom" && Object.keys(distribution).length > 1) {
    let best = "custom";
    let bestShare = -1;
    for (const [fam, share] of Object.entries(distribution)) {
      if (fam === "custom") continue;
      if (share > bestShare) { bestShare = share; best = fam; }
    }
    if (bestShare >= 0) dominant = best as EasingFamily;
  }

  // --- Tempo profile ---
  const durations = comps.map((c) => c.durationMs);
  const avgDuration = mean(durations);
  const durationSpread = stdDev(durations);
  const pace: TempoProfile["pace"] = avgDuration < 300
    ? "fast"
    : avgDuration <= 700
      ? "moderate"
      : avgDuration <= 1400
        ? "slow"
        : "ceremonial";
  // Rhythmicity: inverse of coefficient of variation, clamped to 0..1.
  const cv = avgDuration > 0 ? durationSpread / avgDuration : 1;
  const rhythmicity = clamp(1 - cv, 0, 1);
  const totalSpan = comps.reduce((m, c) => Math.max(m, c.delayMs + c.durationMs), 0) || 1;
  const density = n / (totalSpan / 1000);

  // --- Energy level ---
  // Energy = combination of intensity (transform magnitude), easing curvature,
  // overshoot, and loop presence.
  let maxMagnitude = 0;
  for (const c of comps) {
    for (const kf of c.keyframes) {
      for (const prop of ["translateX", "translateY", "translateZ", "rotate", "rotateX", "rotateY", "scale", "scaleX", "scaleY", "skewX", "skewY"] as const) {
        const v = kf.properties[prop];
        if (v !== undefined) maxMagnitude = Math.max(maxMagnitude, numericMagnitude(v));
      }
    }
  }
  const intensityScore = clamp(maxMagnitude / 300, 0, 1);
  const curvatureScore = totalCurvature / (n * 1.5);
  const overshootScore = totalOvershoot / (n * 1.5);
  const loopFraction = comps.filter((c) => c.iterationCount === "infinite" || (typeof c.iterationCount === "number" && c.iterationCount > 1)).length / n;
  const energyLevel = clamp(
    intensityScore * 0.45 + curvatureScore * 0.2 + overshootScore * 0.2 + loopFraction * 0.15,
    0, 1,
  );

  // --- Axis preferences ---
  const axisCounts: Record<string, number> = {};
  let axisTotal = 0;
  for (const c of comps) {
    const seenInComponent = new Set<string>();
    for (const kf of c.keyframes) {
      for (const key of Object.keys(kf.properties)) {
        seenInComponent.add(key);
      }
    }
    for (const axis of seenInComponent) {
      axisCounts[axis] = (axisCounts[axis] ?? 0) + 1;
      axisTotal++;
    }
  }
  const axisPreferences: Record<string, number> = {};
  if (axisTotal > 0) {
    for (const [axis, cnt] of Object.entries(axisCounts)) {
      axisPreferences[axis] = cnt / axisTotal;
    }
  }

  // --- Color palette ---
  const colorCounts: Record<string, number> = {};
  const parsedColors: ParsedColor[] = [];
  for (const c of comps) {
    const colors = extractComponentColors(c.style as Record<string, unknown> | undefined);
    for (const cs of colors) {
      const parsed = parseColor(cs);
      if (parsed) {
        colorCounts[parsed.hex] = (colorCounts[parsed.hex] ?? 0) + 1;
        parsedColors.push(parsed);
      }
    }
  }
  const sortedHex = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const dominantColors = sortedHex.slice(0, 3);
  const accentColors = sortedHex.slice(3, 6);
  const warmth = parsedColors.length > 0
    ? mean(parsedColors.map((p) => p.warmth))
    : 0.5;
  const saturation = parsedColors.length > 0
    ? mean(parsedColors.map((p) => p.sat))
    : 0;

  // --- Complexity score ---
  // Complexity = keyframe density, property diversity, easing diversity,
  // and iteration complexity, blended.
  const avgKeyframes = mean(comps.map((c) => c.keyframes.length));
  const keyframeComplexity = clamp(avgKeyframes / 6, 0, 1);
  const propertyDiversity = clamp(Object.keys(axisPreferences).length / 8, 0, 1);
  const easingDiversity = clamp(Object.keys(distribution).length / 5, 0, 1);
  const iterationComplexity = clamp(loopFraction + (comps.filter((c) => c.direction !== "normal").length / n) * 0.5, 0, 1);
  const complexityScore = clamp(
    keyframeComplexity * 0.35 + propertyDiversity * 0.25 + easingDiversity * 0.2 + iterationComplexity * 0.2,
    0, 1,
  );

  // --- Iteration behavior ---
  const loopingCount = comps.filter((c) => c.iterationCount === "infinite" || (typeof c.iterationCount === "number" && c.iterationCount > 1)).length;
  const loopDominance = loopingCount / n;
  const directionCounts: Record<string, number> = {};
  for (const c of comps) directionCounts[c.direction] = (directionCounts[c.direction] ?? 0) + 1;
  let preferredDirection: IterationProfile["preferredDirection"] = "normal";
  let dirBest = -1;
  for (const [d, cnt] of Object.entries(directionCounts)) {
    if (cnt > dirBest) { dirBest = cnt; preferredDirection = d as IterationProfile["preferredDirection"]; }
  }
  const avgIterations = mean(comps.map((c) => (c.iterationCount === "infinite" ? 100 : c.iterationCount)));

  // --- Staging pattern ---
  const delays = comps.map((c) => c.delayMs);
  const sortedDelays = [...delays].sort((a, b) => a - b);
  const delaySteps: number[] = [];
  for (let i = 1; i < sortedDelays.length; i++) {
    delaySteps.push(sortedDelays[i] - sortedDelays[i - 1]);
  }
  const staggerMs = delaySteps.length > 0 ? mean(delaySteps) : 0;
  const sameDelay = delays.every((d) => d === delays[0]);
  const monotonic = delays.every((d, i) => i === 0 || delays[i - 1] <= d);
  const stepVar = stdDev(delaySteps);
  // Overlap: fraction of components whose [delay, delay+duration] intervals intersect.
  let overlapPairs = 0;
  let totalPairs = 0;
  for (let i = 0; i < comps.length; i++) {
    for (let j = i + 1; j < comps.length; j++) {
      totalPairs++;
      const aStart = comps[i].delayMs;
      const aEnd = aStart + comps[i].durationMs;
      const bStart = comps[j].delayMs;
      const bEnd = bStart + comps[j].durationMs;
      if (aStart < bEnd && bStart < aEnd) overlapPairs++;
    }
  }
  const overlap = totalPairs > 0 ? overlapPairs / totalPairs : 0;
  let stagingStyle: StagingProfile["style"];
  if (sameDelay) stagingStyle = "simultaneous";
  else if (monotonic && stepVar < staggerMs * 0.3 + 5) stagingStyle = staggerMs > 150 ? "sequential" : "cascading";
  else stagingStyle = "scattered";

  return {
    easingProfile: {
      dominant,
      distribution,
      curvature: clamp(curvatureScore, 0, 1),
      overshoot: clamp(overshootScore, 0, 1),
    },
    tempoProfile: {
      averageDurationMs: Math.round(avgDuration),
      durationSpread: Math.round(durationSpread),
      pace,
      rhythmicity,
      density,
    },
    energyLevel,
    axisPreferences,
    colorPalette: {
      dominant: dominantColors,
      accent: accentColors,
      warmth,
      saturation,
    },
    complexityScore,
    iterationBehavior: {
      loopDominance,
      preferredDirection,
      averageIterations: avgIterations === 100 ? Infinity : Math.round(avgIterations * 100) / 100,
    },
    stagingPattern: {
      style: stagingStyle,
      staggerMs: Math.round(staggerMs),
      overlap,
    },
  };
}

/** Empty DNA used when a spec has no components. */
function emptyDNA(): MotionStyleDNA {
  return {
    easingProfile: {
      dominant: "smooth",
      distribution: { smooth: 1 },
      curvature: 0.5,
      overshoot: 0,
    },
    tempoProfile: {
      averageDurationMs: 600,
      durationSpread: 0,
      pace: "moderate",
      rhythmicity: 1,
      density: 0,
    },
    energyLevel: 0,
    axisPreferences: {},
    colorPalette: {
      dominant: [],
      accent: [],
      warmth: 0.5,
      saturation: 0,
    },
    complexityScore: 0,
    iterationBehavior: {
      loopDominance: 0,
      preferredDirection: "normal",
      averageIterations: 1,
    },
    stagingPattern: {
      style: "simultaneous",
      staggerMs: 0,
      overlap: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Core: transferStyle and applyArchetype
// ---------------------------------------------------------------------------

/**
 * Apply a style DNA directly to a spec. This is the shared engine used by
 * both transferStyle (which extracts DNA from a source spec) and
 * applyArchetype (which uses a curated DNA).
 */
function applyDna(
  source: MotionStyleDNA,
  target: MotionSpec,
  options: TransferOptions,
): MotionSpec {
  const transformed = target.components.map(cloneComponent);
  if (transformed.length === 0) {
    return { ...target, components: [] };
  }

  // Pre-compute target's per-component energy for rescaling.
  const targetMagnitudes = transformed.map((c) => {
    let maxMag = 0;
    for (const kf of c.keyframes) {
      for (const prop of ["translateX", "translateY", "rotate", "scale", "skewX", "skewY"] as const) {
        const v = kf.properties[prop];
        if (v !== undefined) maxMag = Math.max(maxMag, numericMagnitude(v));
      }
    }
    return maxMag;
  });
  const targetEnergy = targetMagnitudes.length > 0 ? clamp(mean(targetMagnitudes) / 200, 0.05, 1) : 0.1;

  // Easing transfer: replace each component's easing with the source's
  // dominant easing, blended by easingStrength. Per-keyframe easings are
  // also normalized so the target adopts the source's easing vocabulary.
  const dominantEasing = familyToEasing(source.easingProfile.dominant);
  const secondaryEasing = pickSecondaryEasing(source.easingProfile.distribution);
  for (const c of transformed) {
    const blend = options.easingStrength;
    if (blend >= 0.99) {
      c.easing = dominantEasing;
    } else if (blend > 0) {
      // Only swap when the target's easing family differs meaningfully.
      const targetFamily = classifyEasing(c.easing);
      if (targetFamily !== source.easingProfile.dominant) {
        c.easing = dominantEasing;
      }
    }
    // Normalize keyframe-level easings to the source vocabulary.
    for (const kf of c.keyframes) {
      if (kf.easing && options.complexityStrength < 0.3) {
        kf.easing = dominantEasing;
      } else if (kf.easing && options.complexityStrength > 0.7) {
        // Keep keyframe easings but align them to source families.
        kf.easing = secondaryEasing;
      }
    }
  }

  // Tempo transfer: scale each duration toward the source's average.
  const sourceAvg = source.tempoProfile.averageDurationMs;
  for (const c of transformed) {
    const blended = Math.round(lerp(c.durationMs, sourceAvg, options.tempoStrength));
    c.durationMs = Math.max(50, blended);
  }

  // Energy transfer: scale transform magnitudes so target's energy matches source.
  if (options.energyStrength > 0 && targetEnergy > 0) {
    const desiredEnergy = lerp(targetEnergy, source.energyLevel, options.energyStrength);
    const scaleFactor = desiredEnergy / targetEnergy;
    if (Math.abs(scaleFactor - 1) > 0.01) {
      for (const c of transformed) {
        for (const kf of c.keyframes) {
          for (const prop of ["translateX", "translateY", "translateZ", "rotate", "rotateX", "rotateY", "skewX", "skewY"] as const) {
            const v = kf.properties[prop];
            if (typeof v === "number") {
              kf.properties[prop] = Math.round(v * scaleFactor * 100) / 100;
            } else if (typeof v === "string") {
              const m = v.match(/^(-?\d+\.?\d*)(.*)$/);
              if (m) kf.properties[prop] = `${Math.round(parseFloat(m[1]) * scaleFactor * 100) / 100}${m[2]}`;
            }
          }
          // Scale is multiplicative around 1.0.
          for (const prop of ["scale", "scaleX", "scaleY"] as const) {
            const v = kf.properties[prop];
            if (typeof v === "number") {
              const centered = v - 1;
              kf.properties[prop] = Math.round((1 + centered * scaleFactor) * 1000) / 1000;
            }
          }
        }
      }
    }
  }

  // Axis transfer: scale per-axis magnitudes by the ratio of source preference
  // to target preference. Favored axes get amplified, disfavored ones attenuated.
  if (options.axisStrength > 0 && Object.keys(source.axisPreferences).length > 0) {
    const targetDna = extractStyleDNA({ project: target.project, components: transformed });
    for (const c of transformed) {
      for (const kf of c.keyframes) {
        for (const axis of Object.keys(kf.properties)) {
          const sourcePref = source.axisPreferences[axis] ?? 0.05;
          const targetPref = targetDna.axisPreferences[axis] ?? 0.05;
          if (targetPref <= 0) continue;
          const ratio = sourcePref / targetPref;
          const axisScale = lerp(1, ratio, options.axisStrength);
          if (Math.abs(axisScale - 1) < 0.02) continue;
          const props = kf.properties as Record<string, string | number>;
          const v = props[axis];
          if (typeof v === "number") {
            if (axis.startsWith("scale")) {
              const centered = v - 1;
              props[axis] = Math.round((1 + centered * axisScale) * 1000) / 1000;
            } else {
              props[axis] = Math.round(v * axisScale * 100) / 100;
            }
          } else if (typeof v === "string") {
            const m = v.match(/^(-?\d+\.?\d*)(.*)$/);
            if (m) props[axis] = `${Math.round(parseFloat(m[1]) * axisScale * 100) / 100}${m[2]}`;
          }
        }
      }
    }
  }

  // Color transfer: apply source palette to target styles.
  if (options.colorStrength > 0 && source.colorPalette.dominant.length > 0) {
    const palette = [...source.colorPalette.dominant, ...source.colorPalette.accent];
    let paletteIdx = 0;
    for (const c of transformed) {
      const style = c.style as Record<string, unknown>;
      const colorKeys = ["backgroundColor", "color", "borderColor", "outlineColor"];
      for (const k of colorKeys) {
        if (style[k] !== undefined && typeof style[k] === "string") {
          const replacement = palette[paletteIdx % palette.length];
          paletteIdx++;
          if (options.colorStrength >= 0.99) {
            style[k] = replacement;
          } else {
            // Blend: only replace a fraction of colored properties.
            if (Math.random() < options.colorStrength) style[k] = replacement;
          }
        }
      }
    }
  }

  // Iteration transfer: align loop behavior and direction.
  if (options.iterationStrength > 0) {
    const sourceLoops = source.iterationBehavior.loopDominance;
    for (const c of transformed) {
      // Direction alignment.
      if (Math.random() < options.iterationStrength * 0.5) {
        c.direction = source.iterationBehavior.preferredDirection;
      }
      // Loop alignment: if source strongly loops and target doesn't, promote looping.
      const targetLoops = c.iterationCount === "infinite" || (typeof c.iterationCount === "number" && c.iterationCount > 1);
      if (sourceLoops > 0.5 && !targetLoops && Math.random() < options.iterationStrength * sourceLoops) {
        c.iterationCount = "infinite";
      } else if (sourceLoops < 0.2 && targetLoops && Math.random() < options.iterationStrength * (1 - sourceLoops)) {
        c.iterationCount = 1;
      }
    }
  }

  // Complexity transfer: add or remove keyframes to align complexity.
  if (options.complexityStrength > 0) {
    const targetDna = extractStyleDNA({ project: target.project, components: transformed });
    const complexityDelta = source.complexityScore - targetDna.complexityScore;
    if (Math.abs(complexityDelta) > 0.1) {
      for (const c of transformed) {
        if (complexityDelta > 0 && c.keyframes.length < 6 && Math.random() < options.complexityStrength * 0.5) {
          // Add an intermediate keyframe by interpolating neighbors.
          const newKf = synthesizeIntermediateKeyframe(c);
          if (newKf) c.keyframes.push(newKf);
          c.keyframes.sort((a, b) => a.offset - b.offset);
        } else if (complexityDelta < 0 && c.keyframes.length > 2 && Math.random() < options.complexityStrength * 0.5) {
          // Drop a middle keyframe to simplify.
          const midIdx = Math.floor(c.keyframes.length / 2);
          c.keyframes.splice(midIdx, 1);
        }
      }
    }
  }

  // Staging transfer: redistribute delays to match source staging pattern.
  if (options.stagingStrength > 0 && transformed.length > 1) {
    const sorted = [...transformed].sort((a, b) => a.orderIndex - b.orderIndex);
    const sourceStaging = source.stagingPattern.style;
    const sourceStagger = source.stagingPattern.staggerMs;
    if (sourceStaging === "simultaneous") {
      for (const c of sorted) c.delayMs = lerp(c.delayMs, 0, options.stagingStrength);
    } else if (sourceStaging === "sequential" || sourceStaging === "cascading") {
      for (let i = 0; i < sorted.length; i++) {
        const target = i * sourceStagger;
        sorted[i].delayMs = Math.round(lerp(sorted[i].delayMs, target, options.stagingStrength));
      }
    } else {
      // scattered — preserve relative order but spread using source stagger variance.
      const spread = source.tempoProfile.durationSpread || sourceStagger;
      for (let i = 0; i < sorted.length; i++) {
        const jitter = (Math.random() - 0.5) * spread * 2;
        const target = i * sourceStagger + jitter;
        sorted[i].delayMs = Math.max(0, Math.round(lerp(sorted[i].delayMs, target, options.stagingStrength)));
      }
    }
  }

  return {
    ...target,
    components: transformed,
  };
}

/** Pick a secondary easing from a distribution to keep some variety. */
function pickSecondaryEasing(distribution: Record<string, number>): Easing {
  const families = Object.entries(distribution).filter(([f]) => f !== "custom");
  if (families.length === 0) return easingPreset("ease-out");
  families.sort((a, b) => b[1] - a[1]);
  const second = families[1] ?? families[0];
  return familyToEasing(second[0] as EasingFamily);
}

/** Synthesize an intermediate keyframe by interpolating between existing ones. */
function synthesizeIntermediateKeyframe(comp: MotionComponent): MotionComponent["keyframes"][number] | null {
  if (comp.keyframes.length < 2) return null;
  const sorted = [...comp.keyframes].sort((a, b) => a.offset - b.offset);
  // Find the largest gap.
  let bestIdx = 0;
  let bestGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].offset - sorted[i - 1].offset;
    if (gap > bestGap) { bestGap = gap; bestIdx = i; }
  }
  const a = sorted[bestIdx - 1];
  const b = sorted[bestIdx];
  const midOffset = (a.offset + b.offset) / 2;
  const midProperties: Record<string, number | string> = {};
  for (const key of new Set([...Object.keys(a.properties), ...Object.keys(b.properties)])) {
    const av = a.properties[key as keyof typeof a.properties];
    const bv = b.properties[key as keyof typeof b.properties];
    if (typeof av === "number" && typeof bv === "number") {
      midProperties[key] = (av + bv) / 2;
    } else if (av !== undefined) {
      midProperties[key] = av;
    } else if (bv !== undefined) {
      midProperties[key] = bv;
    }
  }
  return {
    offset: midOffset,
    properties: midProperties,
    easing: a.easing ? { ...a.easing } : undefined,
  };
}

/**
 * Transfer the style of sourceSpec onto the structure of targetSpec.
 * The target's components, ids, names, and keyframe offsets are preserved;
 * the surface expression (easing, timing, energy, color, iteration, staging)
 * is rewritten from the source.
 */
export function transferStyle(
  sourceSpec: MotionSpec,
  targetSpec: MotionSpec,
  options?: Partial<TransferOptions>,
): MotionSpec {
  const merged: TransferOptions = { ...DEFAULT_TRANSFER_OPTIONS, ...options };
  const sourceDna = extractStyleDNA(sourceSpec);
  return applyDna(sourceDna, targetSpec, merged);
}

// ---------------------------------------------------------------------------
// Core: blendStyles
// ---------------------------------------------------------------------------

/**
 * Blend two specs' style DNA by a ratio. ratio = 0 returns specA's DNA,
 * ratio = 1 returns specB's DNA, and values in between interpolate each
 * dimension. Returns a synthesized DNA, not a spec.
 */
export function blendStyles(specA: MotionSpec, specB: MotionSpec, ratio: number): MotionStyleDNA {
  const t = clamp(ratio, 0, 1);
  const a = extractStyleDNA(specA);
  const b = extractStyleDNA(specB);
  return blendDna(a, b, t);
}

/** Interpolate two DNAs by ratio t (0 = a, 1 = b). */
function blendDna(a: MotionStyleDNA, b: MotionStyleDNA, t: number): MotionStyleDNA {
  // Easing: pick dominant from whichever side has more weight.
  const dominant: EasingProfile["dominant"] = t < 0.5 ? a.easingProfile.dominant : b.easingProfile.dominant;
  // Merge distributions, weighted.
  const allFamilies = new Set([...Object.keys(a.easingProfile.distribution), ...Object.keys(b.easingProfile.distribution)]);
  const distribution: Record<string, number> = {};
  for (const fam of allFamilies) {
    const av = a.easingProfile.distribution[fam] ?? 0;
    const bv = b.easingProfile.distribution[fam] ?? 0;
    distribution[fam] = lerp(av, bv, t);
  }
  // Renormalize distribution.
  const distSum = Object.values(distribution).reduce((s, v) => s + v, 0) || 1;
  for (const fam of Object.keys(distribution)) distribution[fam] /= distSum;

  // Tempo: linear interpolation of numeric fields.
  const avgDur = Math.round(lerp(a.tempoProfile.averageDurationMs, b.tempoProfile.averageDurationMs, t));
  const spread = Math.round(lerp(a.tempoProfile.durationSpread, b.tempoProfile.durationSpread, t));
  const pace: TempoProfile["pace"] = avgDur < 300 ? "fast" : avgDur <= 700 ? "moderate" : avgDur <= 1400 ? "slow" : "ceremonial";
  const rhythmicity = lerp(a.tempoProfile.rhythmicity, b.tempoProfile.rhythmicity, t);
  const density = lerp(a.tempoProfile.density, b.tempoProfile.density, t);

  // Energy, complexity.
  const energyLevel = lerp(a.energyLevel, b.energyLevel, t);
  const complexityScore = lerp(a.complexityScore, b.complexityScore, t);

  // Axis preferences: merge and weight.
  const allAxes = new Set([...Object.keys(a.axisPreferences), ...Object.keys(b.axisPreferences)]);
  const axisPreferences: Record<string, number> = {};
  let axisSum = 0;
  for (const axis of allAxes) {
    const av = a.axisPreferences[axis] ?? 0;
    const bv = b.axisPreferences[axis] ?? 0;
    const v = lerp(av, bv, t);
    axisPreferences[axis] = v;
    axisSum += v;
  }
  if (axisSum > 0) {
    for (const axis of Object.keys(axisPreferences)) axisPreferences[axis] /= axisSum;
  }

  // Color palette: pick from the side with more weight, with fallback.
  const dominantColors = t < 0.5 ? a.colorPalette.dominant : b.colorPalette.dominant;
  const accentColors = t < 0.5 ? a.colorPalette.accent : b.colorPalette.accent;
  const warmth = lerp(a.colorPalette.warmth, b.colorPalette.warmth, t);
  const saturation = lerp(a.colorPalette.saturation, b.colorPalette.saturation, t);

  // Iteration.
  const loopDominance = lerp(a.iterationBehavior.loopDominance, b.iterationBehavior.loopDominance, t);
  const preferredDirection: IterationProfile["preferredDirection"] = t < 0.5
    ? a.iterationBehavior.preferredDirection
    : b.iterationBehavior.preferredDirection;
  const avgIterationsA = a.iterationBehavior.averageIterations === Infinity ? 100 : a.iterationBehavior.averageIterations;
  const avgIterationsB = b.iterationBehavior.averageIterations === Infinity ? 100 : b.iterationBehavior.averageIterations;
  const blendedIterations = lerp(avgIterationsA, avgIterationsB, t);

  // Staging.
  const stagingStyle: StagingProfile["style"] = t < 0.5 ? a.stagingPattern.style : b.stagingPattern.style;
  const staggerMs = Math.round(lerp(a.stagingPattern.staggerMs, b.stagingPattern.staggerMs, t));
  const overlap = lerp(a.stagingPattern.overlap, b.stagingPattern.overlap, t);

  return {
    easingProfile: {
      dominant,
      distribution,
      curvature: lerp(a.easingProfile.curvature, b.easingProfile.curvature, t),
      overshoot: lerp(a.easingProfile.overshoot, b.easingProfile.overshoot, t),
    },
    tempoProfile: {
      averageDurationMs: avgDur,
      durationSpread: spread,
      pace,
      rhythmicity,
      density,
    },
    energyLevel,
    axisPreferences,
    colorPalette: {
      dominant: dominantColors,
      accent: accentColors,
      warmth,
      saturation,
    },
    complexityScore,
    iterationBehavior: {
      loopDominance,
      preferredDirection,
      averageIterations: blendedIterations >= 99 ? Infinity : Math.round(blendedIterations * 100) / 100,
    },
    stagingPattern: {
      style: stagingStyle,
      staggerMs,
      overlap,
    },
  };
}

// ---------------------------------------------------------------------------
// Core: describeStyle
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable description of a style DNA. The description names
 * the dominant easing family, tempo, energy, staging, complexity, and color
 * character, producing a paragraph that a designer can scan in seconds.
 */
export function describeStyle(dna: MotionStyleDNA): string {
  const parts: string[] = [];

  // Easing character.
  const easingWord: Record<EasingProfile["dominant"], string> = {
    smooth: "smooth, flowing",
    snappy: "snappy, decisive",
    bouncy: "bouncy, playful",
    linear: "linear, mechanical",
    spring: "spring-driven, organic",
    custom: "custom-curved",
  };
  parts.push(`Easing leans ${easingWord[dna.easingProfile.dominant]}`);
  if (dna.easingProfile.overshoot > 0.5) parts.push("with pronounced overshoot");
  else if (dna.easingProfile.overshoot < 0.1) parts.push("with no overshoot");

  // Tempo.
  const paceWord: Record<TempoProfile["pace"], string> = {
    fast: "brisk",
    moderate: "measured",
    slow: "deliberate",
    ceremonial: "ceremonial",
  };
  parts.push(`tempo is ${paceWord[dna.tempoProfile.pace]} (~${dna.tempoProfile.averageDurationMs}ms average)`);
  if (dna.tempoProfile.rhythmicity > 0.75) parts.push("and tightly rhythmic");

  // Energy.
  let energyWord: string;
  if (dna.energyLevel < 0.2) energyWord = "subdued";
  else if (dna.energyLevel < 0.45) energyWord = "calm";
  else if (dna.energyLevel < 0.7) energyWord = "lively";
  else if (dna.energyLevel < 0.85) energyWord = "energetic";
  else energyWord = "explosive";
  parts.push(`energy reads as ${energyWord} (${Math.round(dna.energyLevel * 100)}%)`);

  // Staging.
  const stagingWord: Record<StagingProfile["style"], string> = {
    sequential: "in strict sequence",
    simultaneous: "all at once",
    cascading: "in a tight cascade",
    scattered: "in a scattered scatter",
  };
  parts.push(`elements enter ${stagingWord[dna.stagingPattern.style]}`);

  // Complexity.
  let complexityWord: string;
  if (dna.complexityScore < 0.25) complexityWord = "minimal";
  else if (dna.complexityScore < 0.5) complexityWord = "moderate";
  else if (dna.complexityScore < 0.75) complexityWord = "layered";
  else complexityWord = "dense";
  parts.push(`complexity is ${complexityWord}`);

  // Color.
  if (dna.colorPalette.dominant.length > 0) {
    const warmthWord = dna.colorPalette.warmth > 0.6 ? "warm" : dna.colorPalette.warmth < 0.4 ? "cool" : "neutral";
    const satWord = dna.colorPalette.saturation > 0.6 ? "saturated" : dna.colorPalette.saturation < 0.25 ? "muted" : "balanced";
    parts.push(`palette is ${warmthWord} and ${satWord} (${dna.colorPalette.dominant.length} dominant color${dna.colorPalette.dominant.length === 1 ? "" : "s"})`);
  } else {
    parts.push("palette is unstyled");
  }

  // Iteration.
  if (dna.iterationBehavior.loopDominance > 0.5) parts.push("motion tends to loop");

  // Axis preference top three.
  const topAxes = Object.entries(dna.axisPreferences)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([axis]) => axis);
  if (topAxes.length > 0) parts.push(`favors ${topAxes.join(", ")}`);

  // Build the paragraph.
  const sentence = parts.join(", ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

// ---------------------------------------------------------------------------
// Core: compareStyles
// ---------------------------------------------------------------------------

/**
 * Compare two style DNAs and return per-dimension similarity scores plus a
 * weighted overall similarity. Similarity is 1.0 for identical values and
 * drops toward 0 as the values diverge.
 */
export function compareStyles(dnaA: MotionStyleDNA, dnaB: MotionStyleDNA): StyleComparison {
  const perDimension: DimensionComparison[] = [];
  const sharedTraits: string[] = [];
  const differences: string[] = [];

  // Easing similarity: 50% dominant match, 30% curvature, 20% overshoot.
  const dominantMatch = dnaA.easingProfile.dominant === dnaB.easingProfile.dominant ? 1 : 0;
  const curvatureSim = 1 - Math.abs(dnaA.easingProfile.curvature - dnaB.easingProfile.curvature);
  const overshootSim = 1 - Math.abs(dnaA.easingProfile.overshoot - dnaB.easingProfile.overshoot);
  const easingSim = dominantMatch * 0.5 + curvatureSim * 0.3 + overshootSim * 0.2;
  perDimension.push({
    dimension: "easing",
    similarity: easingSim,
    delta: dominantMatch === 1
      ? `both ${dnaA.easingProfile.dominant}`
      : `${dnaA.easingProfile.dominant} vs ${dnaB.easingProfile.dominant}`,
  });
  if (dominantMatch === 1) sharedTraits.push(`${dnaA.easingProfile.dominant} easing family`);
  else differences.push(`easing family differs (${dnaA.easingProfile.dominant} vs ${dnaB.easingProfile.dominant})`);

  // Tempo similarity: 40% pace match, 40% duration proximity, 20% rhythmicity.
  const paceMatch = dnaA.tempoProfile.pace === dnaB.tempoProfile.pace ? 1 : 0;
  const durDiff = Math.abs(dnaA.tempoProfile.averageDurationMs - dnaB.tempoProfile.averageDurationMs);
  const durSim = clamp(1 - durDiff / 2000, 0, 1);
  const rhythmSim = 1 - Math.abs(dnaA.tempoProfile.rhythmicity - dnaB.tempoProfile.rhythmicity);
  const tempoSim = paceMatch * 0.4 + durSim * 0.4 + rhythmSim * 0.2;
  perDimension.push({
    dimension: "tempo",
    similarity: tempoSim,
    delta: `${dnaA.tempoProfile.pace} (~${dnaA.tempoProfile.averageDurationMs}ms) vs ${dnaB.tempoProfile.pace} (~${dnaB.tempoProfile.averageDurationMs}ms)`,
  });
  if (paceMatch === 1) sharedTraits.push(`${dnaA.tempoProfile.pace} tempo`);
  else differences.push(`tempo differs (${dnaA.tempoProfile.pace} vs ${dnaB.tempoProfile.pace})`);

  // Energy similarity.
  const energySim = 1 - Math.abs(dnaA.energyLevel - dnaB.energyLevel);
  perDimension.push({
    dimension: "energy",
    similarity: energySim,
    delta: `${Math.round(dnaA.energyLevel * 100)}% vs ${Math.round(dnaB.energyLevel * 100)}%`,
  });
  if (energySim > 0.85) sharedTraits.push(`similar energy (~${Math.round(dnaA.energyLevel * 100)}%)`);
  else differences.push(`energy differs (${Math.round(dnaA.energyLevel * 100)}% vs ${Math.round(dnaB.energyLevel * 100)}%)`);

  // Complexity similarity.
  const complexitySim = 1 - Math.abs(dnaA.complexityScore - dnaB.complexityScore);
  perDimension.push({
    dimension: "complexity",
    similarity: complexitySim,
    delta: `${Math.round(dnaA.complexityScore * 100)}% vs ${Math.round(dnaB.complexityScore * 100)}%`,
  });

  // Staging similarity.
  const stagingMatch = dnaA.stagingPattern.style === dnaB.stagingPattern.style ? 1 : 0;
  const overlapSim = 1 - Math.abs(dnaA.stagingPattern.overlap - dnaB.stagingPattern.overlap);
  const stagingSim = stagingMatch * 0.7 + overlapSim * 0.3;
  perDimension.push({
    dimension: "staging",
    similarity: stagingSim,
    delta: `${dnaA.stagingPattern.style} vs ${dnaB.stagingPattern.style}`,
  });
  if (stagingMatch === 1) sharedTraits.push(`${dnaA.stagingPattern.style} staging`);
  else differences.push(`staging differs (${dnaA.stagingPattern.style} vs ${dnaB.stagingPattern.style})`);

  // Iteration similarity.
  const loopSim = 1 - Math.abs(dnaA.iterationBehavior.loopDominance - dnaB.iterationBehavior.loopDominance);
  const dirMatch = dnaA.iterationBehavior.preferredDirection === dnaB.iterationBehavior.preferredDirection ? 1 : 0;
  const iterationSim = loopSim * 0.6 + dirMatch * 0.4;
  perDimension.push({
    dimension: "iteration",
    similarity: iterationSim,
    delta: `${dnaA.iterationBehavior.preferredDirection} vs ${dnaB.iterationBehavior.preferredDirection}`,
  });

  // Color similarity (warmth and saturation proximity).
  const warmthSim = 1 - Math.abs(dnaA.colorPalette.warmth - dnaB.colorPalette.warmth);
  const satSim = 1 - Math.abs(dnaA.colorPalette.saturation - dnaB.colorPalette.saturation);
  const colorSim = warmthSim * 0.6 + satSim * 0.4;
  perDimension.push({
    dimension: "color",
    similarity: colorSim,
    delta: `warmth ${Math.round(dnaA.colorPalette.warmth * 100)}% vs ${Math.round(dnaB.colorPalette.warmth * 100)}%`,
  });

  // Overall weighted similarity.
  const weights: Record<string, number> = {
    easing: 0.25,
    tempo: 0.18,
    energy: 0.17,
    complexity: 0.1,
    staging: 0.12,
    iteration: 0.08,
    color: 0.1,
  };
  let overall = 0;
  let weightSum = 0;
  for (const dim of perDimension) {
    const w = weights[dim.dimension] ?? 0;
    overall += dim.similarity * w;
    weightSum += w;
  }
  const overallSimilarity = weightSum > 0 ? overall / weightSum : 0;

  let verdict: string;
  if (overallSimilarity >= 0.9) verdict = "near-identical";
  else if (overallSimilarity >= 0.75) verdict = "closely related";
  else if (overallSimilarity >= 0.55) verdict = "related";
  else if (overallSimilarity >= 0.35) verdict = "loosely related";
  else verdict = "contrasting";

  return {
    overallSimilarity: Math.round(overallSimilarity * 100) / 100,
    perDimension,
    sharedTraits,
    differences,
    verdict,
  };
}

// ---------------------------------------------------------------------------
// Core: archetypes
// ---------------------------------------------------------------------------

const STYLE_ARCHETYPES: StyleArchetype[] = [
  {
    id: "minimalist",
    name: "Minimalist",
    description: "Sparse, calm, single-axis motion with neutral palette.",
    signatures: ["one property at a time", "neutral palette", "long pauses"],
    dna: {
      easingProfile: {
        dominant: "smooth",
        distribution: { smooth: 0.9, linear: 0.1 },
        curvature: 0.5,
        overshoot: 0.0,
      },
      tempoProfile: {
        averageDurationMs: 700,
        durationSpread: 100,
        pace: "moderate",
        rhythmicity: 0.85,
        density: 0.5,
      },
      energyLevel: 0.2,
      axisPreferences: { opacity: 0.6, translateY: 0.4 },
      colorPalette: {
        dominant: ["#ffffff", "#000000"],
        accent: [],
        warmth: 0.5,
        saturation: 0.05,
      },
      complexityScore: 0.2,
      iterationBehavior: {
        loopDominance: 0.0,
        preferredDirection: "normal",
        averageIterations: 1,
      },
      stagingPattern: {
        style: "sequential",
        staggerMs: 200,
        overlap: 0.1,
      },
    },
  },
  {
    id: "energetic",
    name: "Energetic",
    description: "Fast, bouncy, high-density motion with saturated colors.",
    signatures: ["bouncy entrances", "rapid cascade", "saturated palette"],
    dna: {
      easingProfile: {
        dominant: "bouncy",
        distribution: { bouncy: 0.6, snappy: 0.3, smooth: 0.1 },
        curvature: 0.85,
        overshoot: 0.8,
      },
      tempoProfile: {
        averageDurationMs: 350,
        durationSpread: 80,
        pace: "fast",
        rhythmicity: 0.7,
        density: 3.0,
      },
      energyLevel: 0.85,
      axisPreferences: { translateY: 0.3, scale: 0.3, rotate: 0.2, opacity: 0.2 },
      colorPalette: {
        dominant: ["#ff3366", "#ffcc00", "#00ccff"],
        accent: ["#6633ff"],
        warmth: 0.7,
        saturation: 0.85,
      },
      complexityScore: 0.7,
      iterationBehavior: {
        loopDominance: 0.3,
        preferredDirection: "normal",
        averageIterations: 1.5,
      },
      stagingPattern: {
        style: "cascading",
        staggerMs: 80,
        overlap: 0.5,
      },
    },
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Slow, ceremonial, layered motion with deep palette.",
    signatures: ["slow reveals", "depth via scale", "deep palette"],
    dna: {
      easingProfile: {
        dominant: "smooth",
        distribution: { smooth: 0.7, spring: 0.2, snappy: 0.1 },
        curvature: 0.65,
        overshoot: 0.1,
      },
      tempoProfile: {
        averageDurationMs: 1400,
        durationSpread: 300,
        pace: "slow",
        rhythmicity: 0.6,
        density: 0.8,
      },
      energyLevel: 0.45,
      axisPreferences: { scale: 0.35, opacity: 0.3, translateZ: 0.2, translateY: 0.15 },
      colorPalette: {
        dominant: ["#0a0a1a", "#1a1a3a", "#2a2a5a"],
        accent: ["#ffaa00"],
        warmth: 0.35,
        saturation: 0.5,
      },
      complexityScore: 0.6,
      iterationBehavior: {
        loopDominance: 0.1,
        preferredDirection: "normal",
        averageIterations: 1,
      },
      stagingPattern: {
        style: "sequential",
        staggerMs: 250,
        overlap: 0.25,
      },
    },
  },
  {
    id: "playful",
    name: "Playful",
    description: "Bouncy, rotating, multi-color motion with loops.",
    signatures: ["rotating shapes", "infinite loops", "multi-color bursts"],
    dna: {
      easingProfile: {
        dominant: "bouncy",
        distribution: { bouncy: 0.5, spring: 0.3, smooth: 0.2 },
        curvature: 0.8,
        overshoot: 0.85,
      },
      tempoProfile: {
        averageDurationMs: 600,
        durationSpread: 150,
        pace: "moderate",
        rhythmicity: 0.55,
        density: 2.0,
      },
      energyLevel: 0.75,
      axisPreferences: { rotate: 0.3, scale: 0.3, translateY: 0.2, opacity: 0.2 },
      colorPalette: {
        dominant: ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a8e6cf"],
        accent: ["#c7b8ff"],
        warmth: 0.65,
        saturation: 0.75,
      },
      complexityScore: 0.65,
      iterationBehavior: {
        loopDominance: 0.7,
        preferredDirection: "alternate",
        averageIterations: Infinity,
      },
      stagingPattern: {
        style: "scattered",
        staggerMs: 100,
        overlap: 0.6,
      },
    },
  },
  {
    id: "corporate",
    name: "Corporate",
    description: "Predictable, measured motion with restrained palette.",
    signatures: ["predictable timing", "restrained palette", "clean transitions"],
    dna: {
      easingProfile: {
        dominant: "smooth",
        distribution: { smooth: 0.7, snappy: 0.25, linear: 0.05 },
        curvature: 0.55,
        overshoot: 0.05,
      },
      tempoProfile: {
        averageDurationMs: 500,
        durationSpread: 60,
        pace: "moderate",
        rhythmicity: 0.9,
        density: 1.2,
      },
      energyLevel: 0.35,
      axisPreferences: { translateY: 0.4, opacity: 0.35, translateX: 0.25 },
      colorPalette: {
        dominant: ["#1a73e8", "#ffffff", "#5f6368"],
        accent: ["#ea4335"],
        warmth: 0.45,
        saturation: 0.45,
      },
      complexityScore: 0.35,
      iterationBehavior: {
        loopDominance: 0.05,
        preferredDirection: "normal",
        averageIterations: 1,
      },
      stagingPattern: {
        style: "cascading",
        staggerMs: 120,
        overlap: 0.3,
      },
    },
  },
  {
    id: "organic",
    name: "Organic",
    description: "Spring-driven, irregular, natural-feeling motion.",
    signatures: ["spring physics", "irregular timing", "natural curves"],
    dna: {
      easingProfile: {
        dominant: "spring",
        distribution: { spring: 0.6, smooth: 0.3, bouncy: 0.1 },
        curvature: 0.78,
        overshoot: 0.45,
      },
      tempoProfile: {
        averageDurationMs: 800,
        durationSpread: 250,
        pace: "moderate",
        rhythmicity: 0.4,
        density: 1.0,
      },
      energyLevel: 0.55,
      axisPreferences: { translateY: 0.3, scale: 0.25, rotate: 0.2, translateX: 0.15, opacity: 0.1 },
      colorPalette: {
        dominant: ["#7cb342", "#8d6e63", "#aed581"],
        accent: ["#ffab40"],
        warmth: 0.55,
        saturation: 0.5,
      },
      complexityScore: 0.55,
      iterationBehavior: {
        loopDominance: 0.3,
        preferredDirection: "alternate",
        averageIterations: 2,
      },
      stagingPattern: {
        style: "scattered",
        staggerMs: 180,
        overlap: 0.45,
      },
    },
  },
  {
    id: "mechanical",
    name: "Mechanical",
    description: "Linear, precise, robotic motion with no overshoot.",
    signatures: ["linear cuts", "precise timing", "no overshoot"],
    dna: {
      easingProfile: {
        dominant: "linear",
        distribution: { linear: 0.7, snappy: 0.25, smooth: 0.05 },
        curvature: 0.1,
        overshoot: 0.0,
      },
      tempoProfile: {
        averageDurationMs: 300,
        durationSpread: 40,
        pace: "fast",
        rhythmicity: 0.95,
        density: 2.5,
      },
      energyLevel: 0.6,
      axisPreferences: { translateX: 0.4, translateY: 0.3, opacity: 0.3 },
      colorPalette: {
        dominant: ["#212121", "#9e9e9e", "#ffffff"],
        accent: ["#00e676"],
        warmth: 0.3,
        saturation: 0.2,
      },
      complexityScore: 0.4,
      iterationBehavior: {
        loopDominance: 0.2,
        preferredDirection: "normal",
        averageIterations: 1,
      },
      stagingPattern: {
        style: "sequential",
        staggerMs: 60,
        overlap: 0.15,
      },
    },
  },
  {
    id: "elegant",
    name: "Elegant",
    description: "Slow, smooth, symmetric motion with refined palette.",
    signatures: ["symmetric pairs", "golden timing", "refined palette"],
    dna: {
      easingProfile: {
        dominant: "smooth",
        distribution: { smooth: 0.8, spring: 0.15, snappy: 0.05 },
        curvature: 0.6,
        overshoot: 0.05,
      },
      tempoProfile: {
        averageDurationMs: 1000,
        durationSpread: 120,
        pace: "slow",
        rhythmicity: 0.8,
        density: 0.7,
      },
      energyLevel: 0.4,
      axisPreferences: { scale: 0.35, opacity: 0.3, translateY: 0.2, rotate: 0.15 },
      colorPalette: {
        dominant: ["#1a1a1a", "#d4af37", "#f5f5f5"],
        accent: ["#8b6914"],
        warmth: 0.55,
        saturation: 0.35,
      },
      complexityScore: 0.5,
      iterationBehavior: {
        loopDominance: 0.1,
        preferredDirection: "normal",
        averageIterations: 1,
      },
      stagingPattern: {
        style: "simultaneous",
        staggerMs: 0,
        overlap: 0.7,
      },
    },
  },
];

/** Return all curated style archetypes. */
export function listStyleArchetypes(): StyleArchetype[] {
  return STYLE_ARCHETYPES.map((a) => ({ ...a, dna: cloneDna(a.dna) }));
}

/** Look up a single archetype by id. */
export function getStyleArchetype(id: string): StyleArchetype | null {
  const found = STYLE_ARCHETYPES.find((a) => a.id === id);
  return found ? { ...found, dna: cloneDna(found.dna) } : null;
}

/** Deep-clone a DNA (records and arrays must not be shared by reference). */
function cloneDna(dna: MotionStyleDNA): MotionStyleDNA {
  return {
    easingProfile: {
      dominant: dna.easingProfile.dominant,
      distribution: { ...dna.easingProfile.distribution },
      curvature: dna.easingProfile.curvature,
      overshoot: dna.easingProfile.overshoot,
    },
    tempoProfile: { ...dna.tempoProfile },
    energyLevel: dna.energyLevel,
    axisPreferences: { ...dna.axisPreferences },
    colorPalette: {
      dominant: [...dna.colorPalette.dominant],
      accent: [...dna.colorPalette.accent],
      warmth: dna.colorPalette.warmth,
      saturation: dna.colorPalette.saturation,
    },
    complexityScore: dna.complexityScore,
    iterationBehavior: { ...dna.iterationBehavior },
    stagingPattern: { ...dna.stagingPattern },
  };
}

/**
 * Apply a named archetype's DNA to a spec. The spec's structure is preserved
 * while its surface expression adopts the archetype's style.
 */
export function applyArchetype(archetypeId: string, spec: MotionSpec): MotionSpec {
  const archetype = getStyleArchetype(archetypeId);
  if (!archetype) {
    // Unknown archetype: return the spec unchanged (deep-cloned).
    return { ...spec, components: spec.components.map(cloneComponent) };
  }
  return applyDna(archetype.dna, spec, DEFAULT_TRANSFER_OPTIONS);
}
