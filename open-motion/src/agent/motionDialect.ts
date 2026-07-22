/**
 * Motion Dialect — context translation engine.
 *
 * This is the thirteenth original AI-native module. Different design
 * contexts speak different motion dialects: web animations favor medium
 * durations with smooth easings, mobile favors shorter snappy transitions,
 * gaming favors longer bouncy sequences, data visualization favors precise
 * linear state changes, and presentation favors dramatic long-form reveals.
 *
 * The Dialect module translates a motion spec from one dialect to another,
 * adjusting duration ranges, easing preferences, intensity levels, loop
 * behavior, and stagger patterns to match the target context's vocabulary.
 *
 * Use cases:
 *   - "Translate this for mobile"
 *   - "Make this gaming-ready"
 *   - "Convert to data-viz style"
 *   - "What does this look like in presentation mode?"
 */

import type { MotionComponent, MotionSpec, Easing } from "@openmotion/shared";
import { easingPreset } from "../shared/motion/easing.js";

/** Identifiers for the built-in motion dialects. */
export type DialectId =
  | "web"
  | "mobile"
  | "gaming"
  | "data-viz"
  | "presentation"
  | "kiosk"
  | "accessibility";

/** A motion dialect defines the vocabulary of a design context. */
export interface MotionDialect {
  id: DialectId;
  name: string;
  description: string;
  /** Preferred duration range in ms. */
  durationRange: { min: number; max: number; ideal: number };
  /** Easings preferred in this dialect. */
  preferredEasings: string[];
  /** Easings avoided in this dialect. */
  avoidedEasings: string[];
  /** Intensity multiplier (1 = neutral, 0.5 = subdued, 1.5 = amplified). */
  intensityMultiplier: number;
  /** Whether infinite loops are welcome in this dialect. */
  favorsInfiniteLoops: boolean;
  /** Default loop count for this dialect. */
  defaultLoopCount: number;
  /** Stagger interval between sequential animations (ms). */
  staggerInterval: number;
  /** Whether this dialect favors transform over opacity. */
  favorsTransform: boolean;
  /** Whether this dialect favors opacity over transform. */
  favorsOpacity: boolean;
  /** Maximum concurrent animations per scene. */
  maxConcurrency: number;
  /** Signature characteristics of this dialect. */
  signatures: string[];
}

/** Built-in dialects. */
export const DIALECTS: Record<DialectId, MotionDialect> = {
  web: {
    id: "web",
    name: "Web",
    description: "Standard web animations — medium durations, smooth easings, transform-friendly.",
    durationRange: { min: 200, max: 800, ideal: 400 },
    preferredEasings: ["ease-out", "smooth", "ease-in-out"],
    avoidedEasings: ["linear"],
    intensityMultiplier: 1.0,
    favorsInfiniteLoops: false,
    defaultLoopCount: 1,
    staggerInterval: 80,
    favorsTransform: true,
    favorsOpacity: true,
    maxConcurrency: 6,
    signatures: ["smooth", "polished", "medium-tempo"],
  },
  mobile: {
    id: "mobile",
    name: "Mobile",
    description: "Mobile-first — shorter durations, snappy easings, gesture-driven feel.",
    durationRange: { min: 150, max: 500, ideal: 250 },
    preferredEasings: ["snappy", "ease-out", "smooth"],
    avoidedEasings: ["bounce", "elastic", "linear"],
    intensityMultiplier: 0.8,
    favorsInfiniteLoops: false,
    defaultLoopCount: 1,
    staggerInterval: 50,
    favorsTransform: true,
    favorsOpacity: true,
    maxConcurrency: 4,
    signatures: ["snappy", "compact", "gesture-friendly"],
  },
  gaming: {
    id: "gaming",
    name: "Gaming",
    description: "Game-ready — longer durations, bouncy easings, high intensity, loops welcome.",
    durationRange: { min: 400, max: 2000, ideal: 800 },
    preferredEasings: ["bounce", "elastic", "back", "snappy"],
    avoidedEasings: ["linear"],
    intensityMultiplier: 1.5,
    favorsInfiniteLoops: true,
    defaultLoopCount: 3,
    staggerInterval: 120,
    favorsTransform: true,
    favorsOpacity: false,
    maxConcurrency: 12,
    signatures: ["bouncy", "energetic", "looping"],
  },
  "data-viz": {
    id: "data-viz",
    name: "Data Visualization",
    description: "Data-viz — precise durations, linear/ease easings, state-driven, opacity-heavy.",
    durationRange: { min: 300, max: 1000, ideal: 600 },
    preferredEasings: ["ease-in-out", "linear", "smooth"],
    avoidedEasings: ["bounce", "elastic", "back"],
    intensityMultiplier: 0.7,
    favorsInfiniteLoops: false,
    defaultLoopCount: 1,
    staggerInterval: 100,
    favorsTransform: false,
    favorsOpacity: true,
    maxConcurrency: 8,
    signatures: ["precise", "state-driven", "measured"],
  },
  presentation: {
    id: "presentation",
    name: "Presentation",
    description: "Slideshows and decks — long durations, dramatic easings, sequential reveals.",
    durationRange: { min: 600, max: 2500, ideal: 1200 },
    preferredEasings: ["smooth", "ease-in-out", "soft"],
    avoidedEasings: ["bounce", "elastic", "linear"],
    intensityMultiplier: 1.2,
    favorsInfiniteLoops: false,
    defaultLoopCount: 1,
    staggerInterval: 200,
    favorsTransform: true,
    favorsOpacity: true,
    maxConcurrency: 3,
    signatures: ["dramatic", "sequential", "long-form"],
  },
  kiosk: {
    id: "kiosk",
    name: "Kiosk",
    description: "Digital signage and kiosks — very long durations, loops, ambient motion.",
    durationRange: { min: 1000, max: 5000, ideal: 2500 },
    preferredEasings: ["smooth", "soft", "ease-in-out"],
    avoidedEasings: ["bounce", "elastic", "snappy"],
    intensityMultiplier: 0.5,
    favorsInfiniteLoops: true,
    defaultLoopCount: 5,
    staggerInterval: 300,
    favorsTransform: true,
    favorsOpacity: true,
    maxConcurrency: 5,
    signatures: ["ambient", "looping", "calm"],
  },
  accessibility: {
    id: "accessibility",
    name: "Accessibility",
    description: "Reduced-motion and accessibility-first — minimal durations, soft easings, no loops.",
    durationRange: { min: 100, max: 400, ideal: 200 },
    preferredEasings: ["soft", "smooth", "ease-out"],
    avoidedEasings: ["bounce", "elastic", "back", "spring"],
    intensityMultiplier: 0.3,
    favorsInfiniteLoops: false,
    defaultLoopCount: 1,
    staggerInterval: 40,
    favorsTransform: false,
    favorsOpacity: true,
    maxConcurrency: 2,
    signatures: ["minimal", "safe", "reduced-motion"],
  },
};

/** A single translation change made during dialect conversion. */
export interface DialectChange {
  componentId: string;
  componentName: string;
  field: string;
  before: string;
  after: string;
  reason: string;
}

/** Result of a dialect translation pass. */
export interface DialectResult {
  sourceDialect: DialectId;
  targetDialect: DialectId;
  changes: DialectChange[];
  translatedSpec: MotionSpec;
  componentCount: number;
  changeCount: number;
  summary: string;
}

/** Deep-clone a component. */
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

/** Clamp a duration to a range. */
function clampDuration(ms: number, range: { min: number; max: number; ideal: number }): number {
  if (ms < range.min) return range.min;
  if (ms > range.max) return range.max;
  return ms;
}

/** Check if an easing is in a list. */
function easingMatches(easing: Easing, names: string[]): boolean {
  if (easing.type !== "preset") return false;
  return names.includes(easing.name);
}

/** Resolve an easing name to an Easing object, with fallback. */
function resolveEasing(name: string): Easing {
  try {
    return easingPreset(name as never);
  } catch {
    return easingPreset("ease-out");
  }
}

/** Format an easing for display. */
function formatEasing(easing: Easing): string {
  if (easing.type === "preset") return easing.name;
  if (easing.type === "bezier") return `bezier(${easing.p1.join(",")},${easing.p2.join(",")})`;
  if (easing.type === "spring") return `spring(${easing.stiffness},${easing.damping})`;
  return "custom";
}

/**
 * Translate a motion spec from one dialect to another. Each component is
 * adjusted to match the target dialect's duration range, easing preferences,
 * intensity multiplier, loop behavior, and stagger patterns.
 */
export function translateDialect(
  spec: MotionSpec,
  sourceId: DialectId,
  targetId: DialectId,
): DialectResult {
  const source = DIALECTS[sourceId];
  const target = DIALECTS[targetId];
  const changes: DialectChange[] = [];

  if (spec.components.length === 0) {
    return {
      sourceDialect: sourceId,
      targetDialect: targetId,
      changes: [],
      translatedSpec: spec,
      componentCount: 0,
      changeCount: 0,
      summary: `Cannot translate: source spec has no components.`,
    };
  }

  const translated = spec.components.map((c, i) => {
    const comp = cloneComponent(c);

    // 1. Adjust duration to target range.
    const oldDuration = comp.durationMs;
    const newDuration = clampDuration(oldDuration, target.durationRange);
    if (oldDuration !== newDuration) {
      comp.durationMs = newDuration;
      changes.push({
        componentId: comp.id,
        componentName: comp.name,
        field: "durationMs",
        before: `${oldDuration}ms`,
        after: `${newDuration}ms`,
        reason: `${target.name} dialect prefers ${target.durationRange.min}-${target.durationRange.max}ms`,
      });
    }

    // 2. Adjust easing to target preferences.
    const oldEasing = comp.easing;
    if (easingMatches(oldEasing, target.avoidedEasings)) {
      const newEasingName = target.preferredEasings[0] ?? "ease-out";
      const newEasing = resolveEasing(newEasingName);
      comp.easing = newEasing;
      changes.push({
        componentId: comp.id,
        componentName: comp.name,
        field: "easing",
        before: formatEasing(oldEasing),
        after: formatEasing(newEasing),
        reason: `${target.name} dialect avoids ${formatEasing(oldEasing)}`,
      });
    }

    // 3. Apply intensity multiplier to displacement and rotation.
    if (target.intensityMultiplier !== 1.0) {
      for (const kf of comp.keyframes) {
        for (const prop of ["translateX", "translateY"] as const) {
          const v = kf.properties[prop];
          if (typeof v === "number") {
            const oldVal = v;
            const newVal = Math.round(v * target.intensityMultiplier);
            if (oldVal !== newVal) {
              kf.properties[prop] = newVal;
              changes.push({
                componentId: comp.id,
                componentName: comp.name,
                field: `keyframe.${prop}`,
                before: String(oldVal),
                after: String(newVal),
                reason: `${target.name} dialect intensity multiplier ${target.intensityMultiplier}`,
              });
            }
          }
        }
        const r = kf.properties.rotate;
        if (typeof r === "number") {
          const oldVal = r;
          const newVal = Math.round(r * target.intensityMultiplier);
          if (oldVal !== newVal) {
            kf.properties.rotate = newVal;
            changes.push({
              componentId: comp.id,
              componentName: comp.name,
              field: "keyframe.rotate",
              before: String(oldVal),
              after: String(newVal),
              reason: `${target.name} dialect intensity multiplier ${target.intensityMultiplier}`,
            });
          }
        }
        const s = kf.properties.scale;
        if (typeof s === "number") {
          const oldVal = s;
          // Scale intensity: move away from 1.0 by the multiplier.
          const newVal = 1 + (s - 1) * target.intensityMultiplier;
          if (Math.abs(oldVal - newVal) > 0.01) {
            kf.properties.scale = Math.round(newVal * 100) / 100;
            changes.push({
              componentId: comp.id,
              componentName: comp.name,
              field: "keyframe.scale",
              before: String(oldVal),
              after: String(kf.properties.scale),
              reason: `${target.name} dialect intensity multiplier ${target.intensityMultiplier}`,
            });
          }
        }
      }
    }

    // 4. Adjust loop behavior.
    const oldLoop = comp.iterationCount;
    if (oldLoop === "infinite" && !target.favorsInfiniteLoops) {
      comp.iterationCount = target.defaultLoopCount as never;
      changes.push({
        componentId: comp.id,
        componentName: comp.name,
        field: "iterationCount",
        before: "infinite",
        after: String(target.defaultLoopCount),
        reason: `${target.name} dialect does not favor infinite loops`,
      });
    } else if (oldLoop !== "infinite" && target.favorsInfiniteLoops && oldLoop === 1) {
      comp.iterationCount = target.defaultLoopCount as never;
      changes.push({
        componentId: comp.id,
        componentName: comp.name,
        field: "iterationCount",
        before: String(oldLoop),
        after: String(target.defaultLoopCount),
        reason: `${target.name} dialect welcomes looping`,
      });
    }

    // 5. Adjust stagger (delay) to target interval.
    if (i > 0) {
      const oldDelay = comp.delayMs;
      const newDelay = i * target.staggerInterval;
      if (oldDelay !== newDelay) {
        comp.delayMs = newDelay;
        changes.push({
          componentId: comp.id,
          componentName: comp.name,
          field: "delayMs",
          before: `${oldDelay}ms`,
          after: `${newDelay}ms`,
          reason: `${target.name} dialect stagger interval ${target.staggerInterval}ms`,
        });
      }
    }

    return comp;
  });

  const translatedSpec: MotionSpec = {
    ...spec,
    components: translated,
  };

  const summary = `Translated ${spec.components.length} component(s) from ${source.name} to ${target.name} dialect: ${changes.length} change(s).`;

  return {
    sourceDialect: sourceId,
    targetDialect: targetId,
    changes,
    translatedSpec,
    componentCount: spec.components.length,
    changeCount: changes.length,
    summary,
  };
}

/** List all available dialects. */
export function listDialects(): MotionDialect[] {
  return Object.values(DIALECTS);
}

/** Get a dialect by ID. */
export function getDialect(id: string): MotionDialect | null {
  return DIALECTS[id as DialectId] ?? null;
}

/** Detect the closest dialect match for a spec based on its characteristics. */
export function detectDialect(spec: MotionSpec): { bestMatch: DialectId; scores: Array<{ dialect: DialectId; name: string; score: number }> } {
  const components = spec.components;
  if (components.length === 0) {
    return { bestMatch: "web", scores: [] };
  }

  const scores: Array<{ dialect: DialectId; name: string; score: number }> = [];

  for (const dialect of Object.values(DIALECTS)) {
    let score = 50; // Start at neutral.

    // Check duration alignment.
    const avgDuration = components.reduce((sum, c) => sum + c.durationMs, 0) / components.length;
    if (avgDuration >= dialect.durationRange.min && avgDuration <= dialect.durationRange.max) {
      score += 20;
      // Closer to ideal = higher score.
      const distFromIdeal = Math.abs(avgDuration - dialect.durationRange.ideal);
      score += Math.max(0, 10 - Math.floor(distFromIdeal / 100));
    } else {
      score -= 10;
    }

    // Check easing alignment.
    for (const c of components) {
      if (c.easing.type === "preset") {
        if (dialect.preferredEasings.includes(c.easing.name)) score += 2;
        if (dialect.avoidedEasings.includes(c.easing.name)) score -= 3;
      }
    }

    // Check loop alignment.
    const hasInfinite = components.some((c) => c.iterationCount === "infinite");
    if (hasInfinite && dialect.favorsInfiniteLoops) score += 10;
    if (hasInfinite && !dialect.favorsInfiniteLoops) score -= 10;

    // Check concurrency alignment.
    if (components.length > dialect.maxConcurrency) score -= 5;

    scores.push({ dialect: dialect.id, name: dialect.name, score: Math.max(0, score) });
  }

  scores.sort((a, b) => b.score - a.score);
  return { bestMatch: scores[0].dialect, scores };
}

/** Format a dialect translation result as a human-readable report. */
export function formatDialectReport(result: DialectResult): string {
  const lines: string[] = [];
  const source = DIALECTS[result.sourceDialect];
  const target = DIALECTS[result.targetDialect];
  lines.push(`=== Motion Dialect Translation ===`);
  lines.push("");
  lines.push(`Source: ${source.name} — ${source.description}`);
  lines.push(`Target: ${target.name} — ${target.description}`);
  lines.push(`Components: ${result.componentCount}`);
  lines.push(`Changes: ${result.changeCount}`);
  lines.push("");

  if (result.changes.length > 0) {
    lines.push("--- Changes ---");
    // Group by component for readability.
    const byComponent = new Map<string, DialectChange[]>();
    for (const change of result.changes) {
      const list = byComponent.get(change.componentId) ?? [];
      list.push(change);
      byComponent.set(change.componentId, list);
    }
    for (const [, componentChanges] of byComponent) {
      const name = componentChanges[0].componentName;
      lines.push(`[${name}] (${componentChanges.length} change(s))`);
      for (const c of componentChanges) {
        lines.push(`  ${c.field}: ${c.before} -> ${c.after}`);
        lines.push(`    reason: ${c.reason}`);
      }
      lines.push("");
    }
  }

  lines.push(`Summary: ${result.summary}`);
  return lines.join("\n");
}
