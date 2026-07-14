import type { Easing, Keyframe, MotionComponent } from "@openmotion/shared";
import { PRESET_BEZIER } from "@openmotion/shared";

/** A minimal view of a component for blending — works with full MotionComponent or drafts. */
export type BlendSource = Pick<
  MotionComponent,
  "name" | "easing" | "durationMs" | "delayMs" | "iterationCount" | "direction" | "keyframes"
>;

export interface BlendResult {
  keyframes: Keyframe[];
  easing: Easing;
  durationMs: number;
  delayMs: number;
  iterationCount: number | "infinite";
  direction: MotionComponent["direction"];
  blendedProperties: string[];
  ratio: number;
}

export interface InterpolationStep {
  index: number;
  ratio: number;
  result: BlendResult;
}

export interface MergeResult {
  keyframes: Keyframe[];
  mergedProperties: string[];
  sourceAProperties: string[];
  sourceBProperties: string[];
  conflicts: string[];
}

/** Convert any easing to cubic-bezier control points [x1, y1, x2, y2]. */
function easingToBezierPoints(e: Easing): [number, number, number, number] {
  if (e.type === "preset") {
    const native: Record<string, [number, number, number, number]> = {
      linear: [0, 0, 1, 1],
      ease: [0.25, 0.1, 0.25, 1],
      "ease-in": [0.42, 0, 1, 1],
      "ease-out": [0, 0, 0.58, 1],
      "ease-in-out": [0.42, 0, 0.58, 1],
    };
    if (native[e.name]) return native[e.name];
    const bz = PRESET_BEZIER[e.name];
    if (bz) return bz;
    return [0.25, 0.1, 0.25, 1];
  }
  if (e.type === "bezier") {
    return [e.p1[0], e.p1[1], e.p2[0], e.p2[1]];
  }
  // spring — approximate
  const r = e.damping / (2 * Math.sqrt(e.stiffness * e.mass));
  if (r >= 1) return [0.22, 1, 0.36, 1];
  return [0.34, 1.56, 0.64, 1];
}

/** Linearly interpolate between two numbers. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Lerp between two bezier easings, returning a bezier easing. */
function blendEasings(a: Easing, b: Easing, ratio: number): Easing {
  const pa = easingToBezierPoints(a);
  const pb = easingToBezierPoints(b);
  return {
    type: "bezier",
    p1: [lerp(pa[0], pb[0], ratio), lerp(pa[1], pb[1], ratio)],
    p2: [lerp(pa[2], pb[2], ratio), lerp(pa[3], pb[3], ratio)],
  };
}

/** Collect all property names from a list of keyframes. */
function collectProperties(keyframes: Keyframe[]): Set<string> {
  const props = new Set<string>();
  for (const kf of keyframes) {
    for (const key of Object.keys(kf.properties)) props.add(key);
  }
  return props;
}

/** Sample a property value at a given offset from a list of keyframes. */
function sampleProperty(keyframes: Keyframe[], prop: string, offset: number): number | null {
  const points: { offset: number; value: number }[] = [];
  for (const kf of keyframes) {
    const v = kf.properties[prop as keyof typeof kf.properties];
    if (typeof v === "number") points.push({ offset: kf.offset, value: v });
  }
  if (points.length === 0) return null;
  if (points.length === 1) return points[0].value;

  points.sort((a, b) => a.offset - b.offset);

  if (offset <= points[0].offset) return points[0].value;
  if (offset >= points[points.length - 1].offset) return points[points.length - 1].value;

  for (let i = 0; i < points.length - 1; i++) {
    if (offset >= points[i].offset && offset <= points[i + 1].offset) {
      const range = points[i + 1].offset - points[i].offset;
      if (range === 0) return points[i + 1].value;
      const t = (offset - points[i].offset) / range;
      return lerp(points[i].value, points[i + 1].value, t);
    }
  }
  return points[points.length - 1].value;
}

/**
 * Blend two motions at a given ratio (0 = source A, 1 = source B, 0.5 = midpoint).
 * Samples both motions at uniform offsets and interpolates property values.
 */
export function blendMotions(sourceA: BlendSource, sourceB: BlendSource, ratio: number): BlendResult {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const propsA = collectProperties(sourceA.keyframes);
  const propsB = collectProperties(sourceB.keyframes);
  const allProps = new Set([...propsA, ...propsB]);

  const numSamples = Math.max(sourceA.keyframes.length, sourceB.keyframes.length, 4);
  const blendedKeyframes: Keyframe[] = [];

  for (let i = 0; i < numSamples; i++) {
    const offset = numSamples === 1 ? 0 : i / (numSamples - 1);
    const properties: Record<string, number> = {};

    for (const prop of allProps) {
      const valA = sampleProperty(sourceA.keyframes, prop, offset);
      const valB = sampleProperty(sourceB.keyframes, prop, offset);
      if (valA !== null && valB !== null) {
        properties[prop] = lerp(valA, valB, clampedRatio);
      } else if (valA !== null) {
        properties[prop] = clampedRatio < 0.5 ? valA : valA;
      } else if (valB !== null) {
        properties[prop] = clampedRatio > 0.5 ? valB : valB;
      }
    }

    blendedKeyframes.push({ offset, properties });
  }

  return {
    keyframes: blendedKeyframes,
    easing: blendEasings(sourceA.easing, sourceB.easing, clampedRatio),
    durationMs: Math.round(lerp(sourceA.durationMs, sourceB.durationMs, clampedRatio)),
    delayMs: Math.round(lerp(sourceA.delayMs, sourceB.delayMs, clampedRatio)),
    iterationCount: clampedRatio < 0.5 ? sourceA.iterationCount : sourceB.iterationCount,
    direction: clampedRatio < 0.5 ? sourceA.direction : sourceB.direction,
    blendedProperties: Array.from(allProps).sort(),
    ratio: clampedRatio,
  };
}

/**
 * Generate N intermediate motions between two components.
 * Returns an array of BlendResults from ratio 0 to 1.
 */
export function interpolateMotion(
  source: BlendSource,
  target: BlendSource,
  steps: number,
): InterpolationStep[] {
  const clampedSteps = Math.max(2, Math.min(20, steps));
  const results: InterpolationStep[] = [];
  for (let i = 0; i < clampedSteps; i++) {
    const ratio = clampedSteps === 1 ? 0 : i / (clampedSteps - 1);
    results.push({
      index: i,
      ratio,
      result: blendMotions(source, target, ratio),
    });
  }
  return results;
}

/**
 * Merge animated properties from two motions into a single keyframe set.
 * Properties that exist in both are flagged as conflicts (resolved by taking
 * the union of keyframes at all unique offsets).
 */
export function mergeProperties(sourceA: BlendSource, sourceB: BlendSource): MergeResult {
  const propsA = Array.from(collectProperties(sourceA.keyframes)).sort();
  const propsB = Array.from(collectProperties(sourceB.keyframes)).sort();
  const allProps = new Set([...propsA, ...propsB]);
  const conflicts = propsA.filter((p) => propsB.includes(p));

  // Collect all unique offsets from both sources
  const offsetsA = sourceA.keyframes.map((kf) => kf.offset);
  const offsetsB = sourceB.keyframes.map((kf) => kf.offset);
  const allOffsets = Array.from(new Set([...offsetsA, ...offsetsB])).sort((a, b) => a - b);

  const mergedKeyframes: Keyframe[] = allOffsets.map((offset) => {
    const properties: Record<string, number> = {};
    for (const prop of allProps) {
      const valA = sampleProperty(sourceA.keyframes, prop, offset);
      const valB = sampleProperty(sourceB.keyframes, prop, offset);
      if (valA !== null && valB !== null) {
        // Conflict — prefer the value from the source that has a keyframe at this exact offset
        const hasExactA = offsetsA.includes(offset);
        properties[prop] = hasExactA ? valA : valB;
      } else if (valA !== null) {
        properties[prop] = valA;
      } else if (valB !== null) {
        properties[prop] = valB;
      }
    }
    return { offset, properties };
  });

  return {
    keyframes: mergedKeyframes,
    mergedProperties: Array.from(allProps).sort(),
    sourceAProperties: propsA,
    sourceBProperties: propsB,
    conflicts,
  };
}

/** Human-readable description of a blend result. */
export function describeBlend(result: BlendResult): string {
  const easingDesc =
    result.easing.type === "preset"
      ? result.easing.name
      : result.easing.type === "bezier"
        ? `bezier(${result.easing.p1.map((v) => v.toFixed(2)).join(",")},${result.easing.p2.map((v) => v.toFixed(2)).join(",")})`
        : `spring(s=${result.easing.stiffness},d=${result.easing.damping})`;
  return `Ratio ${result.ratio.toFixed(2)}: ${result.blendedProperties.length} properties, ${result.keyframes.length} keyframes, ${easingDesc} easing, ${result.durationMs}ms`;
}
