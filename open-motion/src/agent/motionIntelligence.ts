/**
 * Motion Intelligence — creative analysis and generation capabilities.
 *
 * Three original systems that give the agent the ability to reason about
 * motion at a structural level:
 *
 * 1. Variation Engine
 *    Generate N variations of a component with controlled differences along
 *    orthogonal axes (easing, duration, intensity, direction, origin). Each
 *    variation is a fully-formed component spec ready for preview.
 *
 * 2. DNA Extraction
 *    Decompose a component into its motion DNA: the fundamental primitives
 *    that define its character (easing family, timing profile, transform
 *    signature, trigger semantics). The DNA is a compact, comparable
 *    representation that enables similarity search and style transfer.
 *
 * 3. Style Transfer
 *    Extract the "feel" of a source component and apply it to a target,
 *    preserving the target's structure while adopting the source's easing,
 *    timing, and intensity characteristics.
 *
 * All three systems are rule-based — no LLM round-trip required. They run
 * as part of the agent's tool execution, enabling creative exploration in
 * mock mode.
 */

import type { MotionComponent, Easing } from "@openmotion/shared";
import { easingPreset, EASING_PRESETS } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Variation Engine
// ---------------------------------------------------------------------------

export type VariationAxis =
  | "easing"
  | "duration"
  | "intensity"
  | "direction"
  | "origin"
  | "stagger";

export interface VariationSpec {
  /** Human-readable label for this variation. */
  label: string;
  /** Which axis was varied. */
  axis: VariationAxis;
  /** The modified component. */
  component: MotionComponent;
  /** What changed, in plain language. */
  delta: string;
}

export interface VariationOptions {
  /** How many variations to generate per axis. */
  countPerAxis?: number;
  /** Which axes to explore (default: all). */
  axes?: VariationAxis[];
  /** Seed for deterministic generation. */
  seed?: number;
}

/**
 * Generate variations of a component along orthogonal axes.
 *
 * Each axis produces a set of variations that explore a single dimension of
 * the motion's character. The result is a flat list of labeled variations
 * that the user can preview and select from.
 */
export function generateVariations(
  source: MotionComponent,
  options: VariationOptions = {},
): VariationSpec[] {
  const {
    countPerAxis = 3,
    axes = ["easing", "duration", "intensity", "direction", "origin"],
    seed = 0,
  } = options;

  const variations: VariationSpec[] = [];
  let counter = seed;

  for (const axis of axes) {
    switch (axis) {
      case "easing":
        variations.push(...varyEasing(source, countPerAxis, counter));
        break;
      case "duration":
        variations.push(...varyDuration(source, countPerAxis));
        break;
      case "intensity":
        variations.push(...varyIntensity(source, countPerAxis));
        break;
      case "direction":
        variations.push(...varyDirection(source, countPerAxis));
        break;
      case "origin":
        variations.push(...varyOrigin(source, countPerAxis));
        break;
      case "stagger":
        variations.push(...varyStagger(source, countPerAxis));
        break;
    }
    counter += countPerAxis;
  }

  return variations;
}

function cloneComponent(c: MotionComponent, overrides: Partial<MotionComponent> = {}): MotionComponent {
  return {
    ...c,
    ...overrides,
    keyframes: c.keyframes.map((kf) => ({ ...kf, properties: { ...kf.properties } })),
    style: { ...c.style },
    id: overrides.id ?? c.id,
    updatedAt: new Date().toISOString(),
  };
}

function varyEasing(source: MotionComponent, count: number, seed: number): VariationSpec[] {
  // Pick a diverse set of easings that differ from the source.
  const sourceEasingName = source.easing.type === "preset" ? source.easing.name : null;
  const candidates = EASING_PRESETS.filter((e) => e !== sourceEasingName);
  // Deterministic shuffle based on seed.
  const shuffled = seededShuffle(candidates, seed);
  const selected = shuffled.slice(0, Math.min(count, shuffled.length));

  return selected.map((presetName) => {
    const component = cloneComponent(source, {
      easing: easingPreset(presetName),
    });
    return {
      label: `${presetName} easing`,
      axis: "easing" as const,
      component,
      delta: `easing → ${presetName}`,
    };
  });
}

function varyDuration(source: MotionComponent, count: number): VariationSpec[] {
  const base = source.durationMs;
  // Generate durations at 0.5x, 0.75x, 1.5x, 2x of the original.
  const multipliers = [0.5, 0.75, 1.5, 2.0, 0.33, 3.0];
  const selected = multipliers.slice(0, count);

  return selected.map((mult) => {
    const newDuration = Math.round(base * mult);
    const component = cloneComponent(source, { durationMs: newDuration });
    const label =
      mult < 1 ? `${Math.round((1 - mult) * 100)}% faster` : `${Math.round((mult - 1) * 100)}% slower`;
    return {
      label,
      axis: "duration" as const,
      component,
      delta: `durationMs: ${base} → ${newDuration}`,
    };
  });
}

function varyIntensity(source: MotionComponent, count: number): VariationSpec[] {
  // Intensity = how far the transform travels. Scale keyframe property values.
  const intensities = [0.5, 0.75, 1.25, 1.5, 2.0];
  const selected = intensities.slice(0, count);

  return selected.map((mult) => {
    const scaledKeyframes = source.keyframes.map((kf) => {
      const properties: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(kf.properties)) {
        if (typeof value === "number") {
          properties[key] = value * mult;
        } else if (typeof value === "string") {
          // Scale numeric values within strings (e.g., "100px" → "150px").
          properties[key] = scaleStringNumeric(value, mult);
        } else {
          properties[key] = value;
        }
      }
      return { ...kf, properties: properties as typeof kf.properties };
    });
    const component = cloneComponent(source, { keyframes: scaledKeyframes });
    const label =
      mult < 1 ? `${Math.round((1 - mult) * 100)}% subtler` : `${Math.round((mult - 1) * 100)}% bolder`;
    return {
      label,
      axis: "intensity" as const,
      component,
      delta: `keyframe intensity × ${mult}`,
    };
  });
}

function varyDirection(source: MotionComponent, count: number): VariationSpec[] {
  const directions = ["normal", "reverse", "alternate", "alternate-reverse"] as const;
  const selected = directions.filter((d) => d !== source.direction).slice(0, count);

  return selected.map((dir) => {
    const component = cloneComponent(source, { direction: dir });
    return {
      label: `direction: ${dir}`,
      axis: "direction" as const,
      component,
      delta: `direction → ${dir}`,
    };
  });
}

function varyOrigin(source: MotionComponent, count: number): VariationSpec[] {
  // Vary the transform origin via style.
  const origins = [
    { label: "top-left", value: "top left" },
    { label: "top-right", value: "top right" },
    { label: "bottom-left", value: "bottom left" },
    { label: "bottom-right", value: "bottom right" },
    { label: "center", value: "center" },
  ];
  const current = (source.style["transformOrigin"] as string) ?? "center";
  const selected = origins.filter((o) => o.value !== current).slice(0, count);

  return selected.map((origin) => {
    const component = cloneComponent(source, {
      style: { ...source.style, transformOrigin: origin.value },
    });
    return {
      label: `origin: ${origin.label}`,
      axis: "origin" as const,
      component,
      delta: `transformOrigin → ${origin.value}`,
    };
  });
}

function varyStagger(source: MotionComponent, count: number): VariationSpec[] {
  // Vary the delay to create stagger effects.
  const baseDelay = source.delayMs;
  const staggers = [50, 100, 200, 300, 500];
  const selected = staggers.slice(0, count);

  return selected.map((delay) => {
    const component = cloneComponent(source, { delayMs: baseDelay + delay });
    return {
      label: `+${delay}ms delay`,
      axis: "stagger" as const,
      component,
      delta: `delayMs: ${baseDelay} → ${baseDelay + delay}`,
    };
  });
}

function scaleStringNumeric(value: string, mult: number): string {
  return value.replace(/(-?\d+\.?\d*)\s*(px|deg|%|em|rem|vh|vw)?/g, (_, num, unit) => {
    const scaled = parseFloat(num) * mult;
    return `${Math.round(scaled * 100) / 100}${unit ?? ""}`;
  });
}

// ---------------------------------------------------------------------------
// DNA Extraction
// ---------------------------------------------------------------------------

export interface MotionDNA {
  /** Easing family classification. */
  easingFamily: "linear" | "smooth" | "bouncy" | "elastic" | "spring" | "sharp";
  /** Timing profile. */
  timingProfile: {
    durationBucket: "instant" | "quick" | "normal" | "slow" | "cinematic";
    hasDelay: boolean;
    isLooping: boolean;
  };
  /** Transform signature — what properties are animated. */
  transformSignature: string[];
  /** Trigger semantics — when does it fire. */
  triggerSemantics: string;
  /** Intensity estimate — how far does it travel. */
  intensity: "subtle" | "moderate" | "bold" | "extreme";
  /** Compact string representation for comparison. */
  signature: string;
}

/**
 * Extract the motion DNA from a component — a compact, comparable
 * representation of its fundamental character.
 */
export function extractDNA(component: MotionComponent): MotionDNA {
  const easingFamily = classifyEasing(component.easing);
  const timingProfile = classifyTiming(component);
  const transformSignature = extractTransformSignature(component);
  const triggerSemantics = component.trigger;
  const intensity = estimateIntensity(component);
  const signature = [
    easingFamily,
    timingProfile.durationBucket,
    timingProfile.isLooping ? "loop" : "once",
    transformSignature.join("+") || "none",
    triggerSemantics,
    intensity,
  ].join("|");

  return {
    easingFamily,
    timingProfile,
    transformSignature,
    triggerSemantics,
    intensity,
    signature,
  };
}

function classifyEasing(easing: Easing): MotionDNA["easingFamily"] {
  if (easing.type === "preset") {
    if (easing.name === "linear") return "linear";
    if (["bounce", "back", "elastic"].includes(easing.name)) return "bouncy";
    if (["snappy"].includes(easing.name)) return "sharp";
    return "smooth";
  }
  if (easing.type === "bezier") {
    if (easing.p2[1] > 1.2 || easing.p1[1] < -0.2) return "elastic";
    if (easing.p2[1] > 1 || easing.p1[1] < 0) return "bouncy";
    if (Math.abs(easing.p2[0] - easing.p1[0]) < 0.3) return "sharp";
    return "smooth";
  }
  if (easing.type === "spring") {
    const r = easing.damping / (2 * Math.sqrt(easing.stiffness * easing.mass));
    if (r < 0.5) return "elastic";
    if (r < 1) return "spring";
    return "smooth";
  }
  return "smooth";
}

function classifyTiming(component: MotionComponent): MotionDNA["timingProfile"] {
  const d = component.durationMs;
  let durationBucket: MotionDNA["timingProfile"]["durationBucket"];
  if (d <= 150) durationBucket = "instant";
  else if (d <= 400) durationBucket = "quick";
  else if (d <= 800) durationBucket = "normal";
  else if (d <= 1500) durationBucket = "slow";
  else durationBucket = "cinematic";

  return {
    durationBucket,
    hasDelay: component.delayMs > 0,
    isLooping: component.iterationCount === "infinite" || (typeof component.iterationCount === "number" && component.iterationCount > 1),
  };
}

function extractTransformSignature(component: MotionComponent): string[] {
  const props = new Set<string>();
  for (const kf of component.keyframes) {
    for (const key of Object.keys(kf.properties)) {
      props.add(key);
    }
  }
  // Also check style for transform hints.
  for (const key of Object.keys(component.style)) {
    if (key.startsWith("transform") || key.startsWith("opacity") || key.startsWith("filter")) {
      props.add(key);
    }
  }
  return [...props].sort();
}

function estimateIntensity(component: MotionComponent): MotionDNA["intensity"] {
  let maxTravel = 0;
  for (const kf of component.keyframes) {
    for (const value of Object.values(kf.properties)) {
      if (typeof value === "number") {
        maxTravel = Math.max(maxTravel, Math.abs(value));
      } else if (typeof value === "string") {
        const numMatch = value.match(/(-?\d+\.?\d*)/);
        if (numMatch) {
          maxTravel = Math.max(maxTravel, Math.abs(parseFloat(numMatch[1])));
        }
      }
    }
  }
  if (maxTravel === 0) return "subtle";
  if (maxTravel < 20) return "subtle";
  if (maxTravel < 100) return "moderate";
  if (maxTravel < 300) return "bold";
  return "extreme";
}

// ---------------------------------------------------------------------------
// Style Transfer
// ---------------------------------------------------------------------------

export interface StyleTransferResult {
  /** The target component with the source's style applied. */
  component: MotionComponent;
  /** What was transferred. */
  transferred: string[];
  /** What was preserved from the target. */
  preserved: string[];
}

/**
 * Transfer the "feel" of a source component onto a target component.
 *
 * What is transferred:
 *   - Easing (the curve that defines the motion's character)
 *   - Duration bucket (preserving relative timing feel)
 *   - Intensity scaling (how far the motion travels)
 *   - Direction (normal/reverse/alternate)
 *
 * What is preserved:
 *   - The target's keyframe structure (what properties animate)
 *   - The target's trigger (when it fires)
 *   - The target's selector and name
 */
export function transferStyle(
  source: MotionComponent,
  target: MotionComponent,
): StyleTransferResult {
  const sourceDNA = extractDNA(source);
  const transferred: string[] = [];
  const preserved: string[] = [];

  // 1. Transfer easing.
  const newEasing = source.easing;
  transferred.push(`easing → ${describeEasing(newEasing)}`);

  // 2. Transfer duration bucket — map the source's duration to the target's
  //    range while preserving the bucket. If source is "quick" (400ms) and
  //    target is "slow" (1200ms), the result is "quick" in the target's
  //    scale (~400ms).
  const sourceDuration = source.durationMs;
  const targetDuration = target.durationMs;
  // Keep the source's absolute duration — that's what defines "feel".
  transferred.push(`durationMs: ${targetDuration} → ${sourceDuration}`);

  // 3. Transfer intensity — scale the target's keyframe values to match the
  //    source's intensity bucket.
  const targetDNA = extractDNA(target);
  const intensityMult = intensityMultiplier(targetDNA.intensity, sourceDNA.intensity);
  let newKeyframes = target.keyframes;
  if (intensityMult !== 1) {
    newKeyframes = target.keyframes.map((kf) => {
      const properties: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(kf.properties)) {
        if (typeof value === "number") {
          properties[key] = value * intensityMult;
        } else if (typeof value === "string") {
          properties[key] = scaleStringNumeric(value, intensityMult);
        } else {
          properties[key] = value;
        }
      }
      return { ...kf, properties: properties as typeof kf.properties };
    });
    transferred.push(`intensity × ${intensityMult} (${targetDNA.intensity} → ${sourceDNA.intensity})`);
  }

  // 4. Transfer direction.
  const newDirection = source.direction;
  if (newDirection !== target.direction) {
    transferred.push(`direction: ${target.direction} → ${newDirection}`);
  }

  // 5. Preserve target's structure, trigger, selector, name.
  preserved.push(`keyframe structure (${target.keyframes.length} keyframes)`);
  preserved.push(`trigger: ${target.trigger}`);
  preserved.push(`selector: ${target.selector ?? "(none)"}`);
  preserved.push(`name: ${target.name}`);

  const component = cloneComponent(target, {
    easing: newEasing,
    durationMs: sourceDuration,
    keyframes: newKeyframes,
    direction: newDirection,
  });

  return { component, transferred, preserved };
}

function intensityMultiplier(from: MotionDNA["intensity"], to: MotionDNA["intensity"]): number {
  const levels: Record<MotionDNA["intensity"], number> = {
    subtle: 0.5,
    moderate: 1,
    bold: 1.5,
    extreme: 2.5,
  };
  const fromLevel = levels[from];
  const toLevel = levels[to];
  if (fromLevel === 0) return 1;
  return Math.round((toLevel / fromLevel) * 100) / 100;
}

function describeEasing(easing: Easing): string {
  if (easing.type === "preset") return easing.name;
  if (easing.type === "bezier") return `bezier(${easing.p1.join(",")},${easing.p2.join(",")})`;
  if (easing.type === "spring") return `spring(${easing.stiffness},${easing.damping},${easing.mass})`;
  return "unknown";
}

// ---------------------------------------------------------------------------
// DNA Comparison
// ---------------------------------------------------------------------------

export interface DNAComparison {
  /** Similarity score 0..1 (1 = identical DNA). */
  similarity: number;
  /** Which axes match. */
  matches: string[];
  /** Which axes differ. */
  differences: string[];
}

/**
 * Compare two motion DNA signatures and return a similarity score.
 * Useful for finding similar motions or detecting duplicates.
 */
export function compareDNA(a: MotionDNA, b: MotionDNA): DNAComparison {
  const matches: string[] = [];
  const differences: string[] = [];

  if (a.easingFamily === b.easingFamily) matches.push(`easing: ${a.easingFamily}`);
  else differences.push(`easing: ${a.easingFamily} vs ${b.easingFamily}`);

  if (a.timingProfile.durationBucket === b.timingProfile.durationBucket)
    matches.push(`duration: ${a.timingProfile.durationBucket}`);
  else differences.push(`duration: ${a.timingProfile.durationBucket} vs ${b.timingProfile.durationBucket}`);

  if (a.timingProfile.isLooping === b.timingProfile.isLooping)
    matches.push(`looping: ${a.timingProfile.isLooping}`);
  else differences.push(`looping: ${a.timingProfile.isLooping} vs ${b.timingProfile.isLooping}`);

  const sigOverlap = a.transformSignature.filter((s) => b.transformSignature.includes(s));
  if (sigOverlap.length > 0) matches.push(`transforms: ${sigOverlap.join(",")}`);
  const sigDiff = [...a.transformSignature, ...b.transformSignature].filter(
    (s) => !sigOverlap.includes(s),
  );
  if (sigDiff.length > 0) differences.push(`transforms: ${sigDiff.join(",")}`);

  if (a.triggerSemantics === b.triggerSemantics) matches.push(`trigger: ${a.triggerSemantics}`);
  else differences.push(`trigger: ${a.triggerSemantics} vs ${b.triggerSemantics}`);

  if (a.intensity === b.intensity) matches.push(`intensity: ${a.intensity}`);
  else differences.push(`intensity: ${a.intensity} vs ${b.intensity}`);

  const totalAxes = matches.length + differences.length;
  const similarity = totalAxes > 0 ? matches.length / totalAxes : 0;

  return { similarity, matches, differences };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function seededShuffle<T>(arr: readonly T[], seed: number): T[] {
  const result = [...arr];
  let s = seed + 1;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Format a variation for display in the agent's response.
 */
export function formatVariationSummary(variations: VariationSpec[]): string {
  if (variations.length === 0) return "No variations generated.";
  const lines = variations.map((v, i) => `${i + 1}. ${v.label} (${v.axis}) — ${v.delta}`);
  return `Generated ${variations.length} variations:\n${lines.join("\n")}`;
}

/**
 * Format a DNA report for display.
 */
export function formatDNAReport(dna: MotionDNA, componentName: string): string {
  return [
    `Motion DNA for "${componentName}":`,
    `  Easing family: ${dna.easingFamily}`,
    `  Timing: ${dna.timingProfile.durationBucket}${dna.timingProfile.hasDelay ? " +delay" : ""}${dna.timingProfile.isLooping ? " +loop" : ""}`,
    `  Transforms: ${dna.transformSignature.join(", ") || "(none)"}`,
    `  Trigger: ${dna.triggerSemantics}`,
    `  Intensity: ${dna.intensity}`,
    `  Signature: ${dna.signature}`,
  ].join("\n");
}

/**
 * Format a style transfer report for display.
 */
export function formatStyleTransferReport(
  result: StyleTransferResult,
  sourceName: string,
  targetName: string,
): string {
  return [
    `Style transfer: ${sourceName} → ${targetName}`,
    `  Transferred: ${result.transferred.join("; ")}`,
    `  Preserved: ${result.preserved.join("; ")}`,
  ].join("\n");
}
