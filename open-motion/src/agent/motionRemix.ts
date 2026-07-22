/**
 * Motion Remix — creative recombination engine.
 *
 * This is the twelfth original AI-native module. Where Variation Engine
 * explores axis-space around a single component and Synthesis hybridizes
 * two components' DNA, Remix operates on the entire project as a creative
 * work: it shuffles, mirrors, inverts, swaps, cascades, scatters,
 * hybridizes, and rephrases the components to produce a fresh interpretation
 * of the same motion vocabulary.
 *
 * The remix is rule-based and reproducible by seed. Each strategy produces
 * a transformed spec and a per-component change log explaining what was
 * recombined and why.
 *
 * Use cases:
 *   - "Give me a different take on this project"
 *   - "Remix this with a shuffle strategy"
 *   - "Show me what this looks like mirrored"
 *   - "I want to see a scattered version"
 */

import type { MotionComponent, MotionSpec, Easing } from "@openmotion/shared";
import { easingPreset } from "../shared/motion/easing.js";

/** Strategies available for remixing. */
export type RemixStrategy =
  | "shuffle"
  | "mirror"
  | "invert"
  | "swap"
  | "cascade"
  | "scatter"
  | "hybridize"
  | "rephrase";

/** A single change made during a remix. */
export interface RemixChange {
  /** Component ID that was changed. */
  componentId: string;
  /** Component name (may have been renamed). */
  componentName: string;
  /** What was changed. */
  field: string;
  /** Value before the remix. */
  before: string;
  /** Value after the remix. */
  after: string;
  /** Why this change was made. */
  reason: string;
}

/** Result of a remix pass. */
export interface RemixResult {
  /** Strategy that was applied. */
  strategy: RemixStrategy;
  /** Seed used for reproducibility. */
  seed: number;
  /** Number of components in the source spec. */
  sourceComponentCount: number;
  /** Number of components in the remixed spec. */
  remixComponentCount: number;
  /** Per-component change log. */
  changes: RemixChange[];
  /** The remixed spec. */
  remixedSpec: MotionSpec;
  /** Human-readable summary. */
  summary: string;
}

/** Seeded pseudo-random number generator (mulberry32). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

/** Shuffle an array in-place (Fisher-Yates). */
function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Format an easing for display. */
function formatEasing(easing: Easing): string {
  if (easing.type === "preset") return easing.name;
  if (easing.type === "bezier") return `bezier(${easing.p1.join(",")},${easing.p2.join(",")})`;
  if (easing.type === "spring") return `spring(${easing.stiffness},${easing.damping})`;
  return "custom";
}

/**
 * Apply a remix strategy to a spec and return the remixed spec with a
 * change log. The seed makes the remix reproducible.
 */
export function remixMotion(
  spec: MotionSpec,
  strategy: RemixStrategy,
  seed: number = Date.now(),
): RemixResult {
  const rng = makeRng(seed);
  const changes: RemixChange[] = [];
  const source = spec.components;

  if (source.length === 0) {
    return {
      strategy,
      seed,
      sourceComponentCount: 0,
      remixComponentCount: 0,
      changes: [],
      remixedSpec: spec,
      summary: `Cannot remix: source spec has no components.`,
    };
  }

  // Clone all components for the remix.
  let remixed = source.map(cloneComponent);

  switch (strategy) {
    case "shuffle": {
      // Shuffle the order of components and reassign orderIndex.
      remixed = shuffleArray(remixed, rng);
      remixed.forEach((c, i) => {
        const oldIndex = c.orderIndex;
        c.orderIndex = i;
        changes.push({
          componentId: c.id,
          componentName: c.name,
          field: "orderIndex",
          before: String(oldIndex),
          after: String(i),
          reason: "Shuffled component order",
        });
      });
      break;
    }

    case "mirror": {
      // Invert all displacement and rotation directions.
      for (const c of remixed) {
        for (const kf of c.keyframes) {
          for (const prop of ["translateX", "translateY"] as const) {
            const v = kf.properties[prop];
            if (typeof v === "number") {
              const before = String(v);
              kf.properties[prop] = -v;
              changes.push({
                componentId: c.id,
                componentName: c.name,
                field: `keyframe.${prop}`,
                before,
                after: String(-v),
                reason: "Mirrored displacement direction",
              });
            }
          }
          const r = kf.properties.rotate;
          if (typeof r === "number") {
            const before = String(r);
            kf.properties.rotate = -r;
            changes.push({
              componentId: c.id,
              componentName: c.name,
              field: "keyframe.rotate",
              before,
              after: String(-r),
              reason: "Mirrored rotation direction",
            });
          }
        }
        // Reverse direction flag too.
        if (c.direction === "normal") {
          c.direction = "reverse";
          changes.push({
            componentId: c.id,
            componentName: c.name,
            field: "direction",
            before: "normal",
            after: "reverse",
            reason: "Mirrored playback direction",
          });
        } else if (c.direction === "reverse") {
          c.direction = "normal";
          changes.push({
            componentId: c.id,
            componentName: c.name,
            field: "direction",
            before: "reverse",
            after: "normal",
            reason: "Mirrored playback direction",
          });
        }
      }
      break;
    }

    case "invert": {
      // Swap intensity tiers: subtle ↔ bold, slow ↔ fast.
      for (const c of remixed) {
        const oldDuration = c.durationMs;
        // Invert duration around a 1000ms midpoint.
        const newDuration = Math.max(100, 2000 - oldDuration);
        c.durationMs = newDuration;
        changes.push({
          componentId: c.id,
          componentName: c.name,
          field: "durationMs",
          before: `${oldDuration}ms`,
          after: `${newDuration}ms`,
          reason: "Inverted timing (slow ↔ fast)",
        });

        // Invert scale magnitudes.
        for (const kf of c.keyframes) {
          const s = kf.properties.scale;
          if (typeof s === "number") {
            const before = String(s);
            // Invert around 1.0: 1.5 → 0.5, 0.8 → 1.2, 2.0 → 0.0 (clamped to 0.1)
            const inverted = Math.max(0.1, 2 - s);
            kf.properties.scale = inverted;
            changes.push({
              componentId: c.id,
              componentName: c.name,
              field: "keyframe.scale",
              before,
              after: String(inverted),
              reason: "Inverted scale intensity (bold ↔ subtle)",
            });
          }
        }
      }
      break;
    }

    case "swap": {
      // Exchange easings between components in a circular shift.
      if (remixed.length < 2) break;
      const originalEasings = remixed.map((c) => c.easing);
      for (let i = 0; i < remixed.length; i++) {
        const nextIdx = (i + 1) % remixed.length;
        const c = remixed[i];
        const newEasing = originalEasings[nextIdx];
        const before = formatEasing(c.easing);
        c.easing = newEasing;
        changes.push({
          componentId: c.id,
          componentName: c.name,
          field: "easing",
          before,
          after: formatEasing(newEasing),
          reason: `Swapped easing with component ${remixed[nextIdx].name}`,
        });
      }
      break;
    }

    case "cascade": {
      // Redistribute delays to create a cascade effect.
      const totalDuration = remixed.reduce((sum, c) => Math.max(sum, c.durationMs), 600);
      const stagger = Math.max(80, Math.floor(totalDuration / (remixed.length + 1)));
      remixed.forEach((c, i) => {
        const oldDelay = c.delayMs;
        c.delayMs = i * stagger;
        changes.push({
          componentId: c.id,
          componentName: c.name,
          field: "delayMs",
          before: `${oldDelay}ms`,
          after: `${c.delayMs}ms`,
          reason: `Cascade stagger: ${i} * ${stagger}ms`,
        });
      });
      break;
    }

    case "scatter": {
      // Randomize timing within bounds.
      for (const c of remixed) {
        const oldDuration = c.durationMs;
        const oldDelay = c.delayMs;
        // Scatter duration between 60% and 180% of original.
        const durFactor = 0.6 + rng() * 1.2;
        c.durationMs = Math.max(50, Math.round(oldDuration * durFactor));
        // Scatter delay between 0 and 600ms.
        c.delayMs = Math.floor(rng() * 600);
        changes.push({
          componentId: c.id,
          componentName: c.name,
          field: "durationMs+delayMs",
          before: `${oldDuration}ms / ${oldDelay}ms`,
          after: `${c.durationMs}ms / ${c.delayMs}ms`,
          reason: "Scattered timing within bounded random range",
        });
      }
      break;
    }

    case "hybridize": {
      // Cross-pollinate keyframes between pairs of components.
      if (remixed.length < 2) break;
      for (let i = 0; i < remixed.length; i += 2) {
        const a = remixed[i];
        const b = remixed[i + 1];
        if (!b) break;
        // Swap the first keyframe's properties between a and b.
        if (a.keyframes.length > 0 && b.keyframes.length > 0) {
          const aProps = a.keyframes[0].properties;
          const bProps = b.keyframes[0].properties;
          const aBefore = JSON.stringify(aProps);
          const bBefore = JSON.stringify(bProps);
          a.keyframes[0].properties = { ...bProps };
          b.keyframes[0].properties = { ...aProps };
          changes.push({
            componentId: a.id,
            componentName: a.name,
            field: "keyframe[0].properties",
            before: aBefore,
            after: bBefore,
            reason: `Hybridized first keyframe with ${b.name}`,
          });
          changes.push({
            componentId: b.id,
            componentName: b.name,
            field: "keyframe[0].properties",
            before: bBefore,
            after: aBefore,
            reason: `Hybridized first keyframe with ${a.name}`,
          });
        }
      }
      break;
    }

    case "rephrase": {
      // Change the narrative intent while preserving structure.
      // Rotate through a set of easing "moods" to rephrase the feel.
      const moods: Array<{ name: string; easing: Easing }> = [
        { name: "confident", easing: easingPreset("snappy") },
        { name: "gentle", easing: easingPreset("soft") },
        { name: "playful", easing: easingPreset("bounce") },
        { name: "smooth", easing: easingPreset("smooth") },
        { name: "elastic", easing: easingPreset("elastic") },
      ];
      remixed.forEach((c, i) => {
        const mood = moods[i % moods.length];
        const before = formatEasing(c.easing);
        c.easing = mood.easing;
        // Rename to reflect the rephrased mood.
        const oldName = c.name;
        c.name = `${c.name} (${mood.name})`;
        changes.push({
          componentId: c.id,
          componentName: c.name,
          field: "easing+name",
          before: `${oldName} [${before}]`,
          after: `${c.name} [${mood.name}]`,
          reason: `Rephrased narrative mood to ${mood.name}`,
        });
      });
      break;
    }
  }

  const remixedSpec: MotionSpec = {
    ...spec,
    components: remixed,
  };

  const summary = `Remixed ${source.length} component(s) with strategy "${strategy}" (seed ${seed}): ${changes.length} change(s) applied.`;

  return {
    strategy,
    seed,
    sourceComponentCount: source.length,
    remixComponentCount: remixed.length,
    changes,
    remixedSpec,
    summary,
  };
}

/** List all available remix strategies with descriptions. */
export function listRemixStrategies(): Array<{ id: RemixStrategy; name: string; description: string }> {
  return [
    { id: "shuffle", name: "Shuffle", description: "Randomize the order of components to break out of the original sequence." },
    { id: "mirror", name: "Mirror", description: "Invert all displacement and rotation directions for a mirrored interpretation." },
    { id: "invert", name: "Invert", description: "Swap intensity tiers: slow ↔ fast, bold ↔ subtle." },
    { id: "swap", name: "Swap", description: "Exchange easings between components in a circular shift." },
    { id: "cascade", name: "Cascade", description: "Redistribute delays to create a clean cascade sequence." },
    { id: "scatter", name: "Scatter", description: "Randomize timing within bounded ranges for organic variation." },
    { id: "hybridize", name: "Hybridize", description: "Cross-pollinate keyframes between pairs of components." },
    { id: "rephrase", name: "Rephrase", description: "Change the narrative mood while preserving structure." },
  ];
}

/** Format a remix result as a human-readable report. */
export function formatRemixReport(result: RemixResult): string {
  const lines: string[] = [];
  lines.push(`=== Motion Remix ===`);
  lines.push("");
  lines.push(`Strategy: ${result.strategy}`);
  lines.push(`Seed: ${result.seed} (use this seed to reproduce)`);
  lines.push(`Components: ${result.sourceComponentCount} -> ${result.remixComponentCount}`);
  lines.push(`Changes: ${result.changes.length}`);
  lines.push("");

  if (result.changes.length > 0) {
    lines.push("--- Changes ---");
    // Group changes by component for readability.
    const byComponent = new Map<string, RemixChange[]>();
    for (const change of result.changes) {
      const list = byComponent.get(change.componentId) ?? [];
      list.push(change);
      byComponent.set(change.componentId, list);
    }
    for (const [componentId, componentChanges] of byComponent) {
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
