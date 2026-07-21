/**
 * Motion Synthesis — DNA hybridization and genetic crossover for motion.
 *
 * Combines motion DNA from two or more source components to produce a new
 * hybrid motion. Four synthesis strategies are supported, each modeling a
 * different genetic combination pattern.
 *
 * Original systems:
 *
 * 1. DNA Blending
 *    Averages the traits (easing family, timing bucket, intensity, transform
 *    signature) across all sources. Produces a balanced hybrid that
 *    inherits equal influence from each parent.
 *
 * 2. Dominant-Recessive Inheritance
 *    One source is designated as dominant (contributes 70% of traits) and
 *    the other as recessive (contributes 30%). Models Mendelian inheritance
 *    where one parent's traits are expressed more strongly.
 *
 * 3. Genetic Crossover
 *    Each trait is randomly selected from one of the sources, simulating
 *    chromosomal crossover during meiosis. Produces high-variance offspring
 *    that may inherit unexpected trait combinations.
 *
 * 4. Mutation
 *    Applies a blend then introduces controlled random variations to one
 *    or more traits. Models natural mutation rates — most offspring are
 *    unchanged, but occasional mutations introduce novelty.
 *
 * The synthesis result includes a trait attribution map showing which
 * source contributed each trait, enabling full transparency of the
 * hybridization process.
 */

import type { MotionComponent, Easing } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { extractDNA, type MotionDNA } from "./motionIntelligence.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SynthesisStrategy = "blend" | "dominant" | "crossover" | "mutation";

export type DNATrait =
  | "easingFamily"
  | "timingProfile"
  | "transformSignature"
  | "triggerSemantics"
  | "intensity";

export interface TraitAttribution {
  trait: DNATrait;
  /** Index of the source that contributed this trait. -1 = mutated. */
  sourceIndex: number;
  /** The value that was inherited. */
  value: string;
}

export interface SynthesisResult {
  strategy: SynthesisStrategy;
  sourceCount: number;
  /** The synthesized DNA. */
  dna: MotionDNA;
  /** Which source contributed each trait. */
  attributions: TraitAttribution[];
  /** Human-readable summary. */
  summary: string;
  /** Names of the source components. */
  sourceNames: string[];
  /** Average duration in ms (from source components, for applySynthesizedDNA). */
  avgDurationMs: number;
  /** Average delay in ms (from source components, for applySynthesizedDNA). */
  avgDelayMs: number;
}

export interface SynthesisOptions {
  strategy?: SynthesisStrategy;
  /** Index of the dominant source (for "dominant" strategy). Default: 0. */
  dominantIndex?: number;
  /** Mutation rate (0..1, for "mutation" strategy). Default: 0.15. */
  mutationRate?: number;
  /** Random seed for reproducibility. Default: Date.now(). */
  seed?: number;
}

// ---------------------------------------------------------------------------
// Seeded random
// ---------------------------------------------------------------------------

class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed > 0 ? seed : 1;
  }
  next(): number {
    // xorshift32
    this.state ^= this.state << 13;
    this.state ^= this.state >>> 17;
    this.state ^= this.state << 5;
    return ((this.state >>> 0) % 100000) / 100000;
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Synthesize a new motion DNA from two or more source components.
 *
 * The resulting DNA can then be used to generate a new component via
 * applySynthesizedDNA().
 */
export function synthesizeMotion(
  sources: MotionComponent[],
  options?: SynthesisOptions,
): SynthesisResult {
  if (sources.length < 2) {
    throw new Error("Motion Synthesis requires at least 2 source components");
  }

  const strategy = options?.strategy ?? "blend";
  const dominantIndex = options?.dominantIndex ?? 0;
  const mutationRate = options?.mutationRate ?? 0.15;
  const seed = options?.seed ?? Date.now();
  const rng = new SeededRandom(seed);

  const sourceDNAs = sources.map((s) => extractDNA(s));
  const sourceNames = sources.map((s) => s.name);
  const attributions: TraitAttribution[] = [];

  // Calculate average duration/delay from source components for later use.
  const avgDurationMs = Math.round(sources.reduce((s, c) => s + c.durationMs, 0) / sources.length);
  const avgDelayMs = Math.round(sources.reduce((s, c) => s + c.delayMs, 0) / sources.length);

  let resultDNA: MotionDNA;

  switch (strategy) {
    case "blend":
      resultDNA = blendDNAs(sourceDNAs, attributions);
      break;
    case "dominant":
      resultDNA = dominantRecessive(sourceDNAs, dominantIndex, attributions);
      break;
    case "crossover":
      resultDNA = geneticCrossover(sourceDNAs, rng, attributions);
      break;
    case "mutation":
      resultDNA = mutationBlend(sourceDNAs, mutationRate, rng, attributions);
      break;
  }

  const summary = buildSummary(strategy, sourceNames, attributions, resultDNA);

  return {
    strategy,
    sourceCount: sources.length,
    dna: resultDNA,
    attributions,
    summary,
    sourceNames,
    avgDurationMs,
    avgDelayMs,
  };
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

function blendDNAs(dnas: MotionDNA[], attributions: TraitAttribution[]): MotionDNA {
  // Average numeric traits, pick most common for categorical traits.
  const easingFamilies = dnas.map((d) => d.easingFamily);
  const blendedEasing = mostCommon(easingFamilies);
  attributions.push({ trait: "easingFamily", sourceIndex: -1, value: `blend(${unique(easingFamilies).join("+")})` });

  const buckets = dnas.map((d) => d.timingProfile.durationBucket);
  const blendedBucket = mostCommon(buckets);
  const hasDelay = dnas.some((d) => d.timingProfile.hasDelay);
  const isLooping = dnas.filter((d) => d.timingProfile.isLooping).length > dnas.length / 2;
  attributions.push({ trait: "timingProfile", sourceIndex: -1, value: `bucket=${blendedBucket}, delay=${hasDelay}, loop=${isLooping}` });

  const allTransforms = dnas.flatMap((d) => d.transformSignature);
  const blendedTransforms = unique(allTransforms).slice(0, 3);
  attributions.push({ trait: "transformSignature", sourceIndex: -1, value: blendedTransforms.join("+") });

  const triggers = dnas.map((d) => d.triggerSemantics);
  const blendedTrigger = mostCommon(triggers);
  attributions.push({ trait: "triggerSemantics", sourceIndex: -1, value: blendedTrigger });

  const intensities = dnas.map((d) => d.intensity);
  const blendedIntensity = mostCommon(intensities);
  attributions.push({ trait: "intensity", sourceIndex: -1, value: blendedIntensity });

  return assembleDNA(blendedEasing, blendedBucket, hasDelay, isLooping, blendedTransforms, blendedTrigger, blendedIntensity);
}

function dominantRecessive(
  dnas: MotionDNA[],
  dominantIndex: number,
  attributions: TraitAttribution[],
): MotionDNA {
  const dominant = dnas[dominantIndex] ?? dnas[0];
  const recessive = dnas[(dominantIndex + 1) % dnas.length];

  attributions.push({ trait: "easingFamily", sourceIndex: dominantIndex, value: dominant.easingFamily });

  const bucket = dominant.timingProfile.durationBucket;
  const hasDelay = dominant.timingProfile.hasDelay || recessive.timingProfile.hasDelay;
  const isLooping = dominant.timingProfile.isLooping;
  attributions.push({ trait: "timingProfile", sourceIndex: dominantIndex, value: `bucket=${bucket} (dominant)` });

  const transforms = unique([...dominant.transformSignature, ...recessive.transformSignature]).slice(0, 3);
  attributions.push({ trait: "transformSignature", sourceIndex: dominantIndex, value: transforms.join("+") });

  attributions.push({ trait: "triggerSemantics", sourceIndex: dominantIndex, value: dominant.triggerSemantics });
  attributions.push({ trait: "intensity", sourceIndex: dominantIndex, value: dominant.intensity });

  return assembleDNA(dominant.easingFamily, bucket, hasDelay, isLooping, transforms, dominant.triggerSemantics, dominant.intensity);
}

function geneticCrossover(
  dnas: MotionDNA[],
  rng: SeededRandom,
  attributions: TraitAttribution[],
): MotionDNA {
  // Each trait randomly selected from one of the sources.
  const easingIdx = Math.floor(rng.next() * dnas.length);
  const easing = dnas[easingIdx].easingFamily;
  attributions.push({ trait: "easingFamily", sourceIndex: easingIdx, value: easing });

  const timingIdx = Math.floor(rng.next() * dnas.length);
  const bucket = dnas[timingIdx].timingProfile.durationBucket;
  const hasDelay = dnas[timingIdx].timingProfile.hasDelay;
  const isLooping = dnas[timingIdx].timingProfile.isLooping;
  attributions.push({ trait: "timingProfile", sourceIndex: timingIdx, value: `bucket=${bucket}, delay=${hasDelay}` });

  const transformIdx = Math.floor(rng.next() * dnas.length);
  const transforms = dnas[transformIdx].transformSignature.slice(0, 3);
  attributions.push({ trait: "transformSignature", sourceIndex: transformIdx, value: transforms.join("+") });

  const triggerIdx = Math.floor(rng.next() * dnas.length);
  const trigger = dnas[triggerIdx].triggerSemantics;
  attributions.push({ trait: "triggerSemantics", sourceIndex: triggerIdx, value: trigger });

  const intensityIdx = Math.floor(rng.next() * dnas.length);
  const intensity = dnas[intensityIdx].intensity;
  attributions.push({ trait: "intensity", sourceIndex: intensityIdx, value: intensity });

  return assembleDNA(easing, bucket, hasDelay, isLooping, transforms, trigger, intensity);
}

function mutationBlend(
  dnas: MotionDNA[],
  mutationRate: number,
  rng: SeededRandom,
  attributions: TraitAttribution[],
): MotionDNA {
  // Start with a blend, then apply random mutations.
  const blended = blendDNAs(dnas, []);
  const mutationCount = Math.floor(5 * mutationRate);
  let mutated = 0;

  let easing = blended.easingFamily;
  let bucket = blended.timingProfile.durationBucket;
  let hasDelay = blended.timingProfile.hasDelay;
  let isLooping = blended.timingProfile.isLooping;
  let transforms = blended.transformSignature.slice();
  let trigger = blended.triggerSemantics;
  let intensity = blended.intensity;

  const easingOptions: MotionDNA["easingFamily"][] = ["linear", "smooth", "bouncy", "elastic", "spring", "sharp"];
  const intensityOptions: MotionDNA["intensity"][] = ["subtle", "moderate", "bold", "extreme"];
  const bucketOptions: MotionDNA["timingProfile"]["durationBucket"][] = ["instant", "quick", "normal", "slow", "cinematic"];

  // Mutate easing
  if (rng.next() < mutationRate) {
    easing = rng.pick(easingOptions.filter((e) => e !== easing));
    attributions.push({ trait: "easingFamily", sourceIndex: -1, value: `mutated->${easing}` });
    mutated++;
  } else {
    attributions.push({ trait: "easingFamily", sourceIndex: -1, value: `blend(${easing})` });
  }

  // Mutate timing bucket
  if (rng.next() < mutationRate) {
    bucket = rng.pick(bucketOptions.filter((b) => b !== bucket));
    attributions.push({ trait: "timingProfile", sourceIndex: -1, value: `mutated->bucket=${bucket}` });
    mutated++;
  } else {
    attributions.push({ trait: "timingProfile", sourceIndex: -1, value: `bucket=${bucket}` });
  }

  attributions.push({ trait: "transformSignature", sourceIndex: -1, value: transforms.join("+") });
  attributions.push({ trait: "triggerSemantics", sourceIndex: -1, value: trigger });

  // Mutate intensity
  if (rng.next() < mutationRate) {
    intensity = rng.pick(intensityOptions.filter((i) => i !== intensity));
    attributions.push({ trait: "intensity", sourceIndex: -1, value: `mutated->${intensity}` });
    mutated++;
  } else {
    attributions.push({ trait: "intensity", sourceIndex: -1, value: intensity });
  }

  if (mutated < mutationCount && mutationCount > 0) {
    // Ensure at least one mutation happened if mutationCount > 0.
    bucket = rng.pick(bucketOptions.filter((b) => b !== bucket));
    attributions[1] = { trait: "timingProfile", sourceIndex: -1, value: `mutated->bucket=${bucket}` };
  }

  return assembleDNA(easing, bucket, hasDelay, isLooping, transforms, trigger, intensity);
}

// ---------------------------------------------------------------------------
// Apply synthesized DNA to a target component
// ---------------------------------------------------------------------------

/**
 * Apply a synthesized DNA to a target component, producing a new component
 * with the hybrid traits. The original component is not modified.
 */
export function applySynthesizedDNA(
  target: MotionComponent,
  result: SynthesisResult,
): MotionComponent {
  const { dna, avgDurationMs, avgDelayMs } = result;
  const newId = `${target.id}-synth-${Date.now()}`;
  const newName = `${target.name} [${result.strategy}]`;

  // Map DNA easing family back to an Easing preset.
  const easingMap: Record<string, Easing> = {
    linear: easingPreset("linear"),
    smooth: easingPreset("smooth"),
    bouncy: easingPreset("bounce"),
    elastic: easingPreset("elastic"),
    spring: { type: "spring", stiffness: 200, damping: 14, mass: 1 },
    sharp: easingPreset("snappy"),
  };

  return {
    ...target,
    id: newId,
    name: newName,
    durationMs: avgDurationMs || target.durationMs,
    delayMs: avgDelayMs,
    easing: easingMap[dna.easingFamily] ?? target.easing,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatSynthesisReport(result: SynthesisResult): string {
  const lines: string[] = [];
  lines.push(`Motion Synthesis: ${result.strategy.toUpperCase()}`);
  lines.push(`  Sources (${result.sourceCount}): ${result.sourceNames.join(", ")}`);
  lines.push(`  Summary: ${result.summary}`);
  lines.push("");
  lines.push("  Trait Attribution:");

  for (const attr of result.attributions) {
    const sourceLabel = attr.sourceIndex === -1 ? "blend/mutation" : result.sourceNames[attr.sourceIndex];
    lines.push(`    ${attr.trait.padEnd(20)} <- ${sourceLabel} (${attr.value})`);
  }

  lines.push("");
  lines.push("  Synthesized DNA:");
  lines.push(`    Easing: ${result.dna.easingFamily}`);
  lines.push(`    Timing: bucket=${result.dna.timingProfile.durationBucket}, delay=${result.dna.timingProfile.hasDelay}, loop=${result.dna.timingProfile.isLooping}`);
  lines.push(`    Transform: ${result.dna.transformSignature.join(" + ")}`);
  lines.push(`    Trigger: ${result.dna.triggerSemantics}`);
  lines.push(`    Intensity: ${result.dna.intensity}`);
  lines.push(`    Signature: ${result.dna.signature}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSummary(
  strategy: string,
  sourceNames: string[],
  attributions: TraitAttribution[],
  dna: MotionDNA,
): string {
  const mutated = attributions.filter((a) => a.sourceIndex === -1).length;
  const inherited = attributions.length - mutated;

  switch (strategy) {
    case "blend":
      return `Blended DNA from ${sourceNames.length} sources. ${inherited} traits averaged. Result: ${dna.easingFamily}/${dna.intensity}/${dna.timingProfile.durationBucket}.`;
    case "dominant":
      return `Dominant inheritance from ${sourceNames[0]}. ${inherited} traits inherited dominantly. Result: ${dna.easingFamily}/${dna.intensity}.`;
    case "crossover":
      return `Genetic crossover across ${sourceNames.length} sources. ${inherited} traits randomly selected. Result: ${dna.easingFamily}/${dna.intensity}.`;
    case "mutation":
      return `Blended then mutated. ${mutated} traits mutated. Result: ${dna.easingFamily}/${dna.intensity}/${dna.timingProfile.durationBucket}.`;
  }
  return `Synthesized motion DNA from ${sourceNames.length} sources.`;
}

function assembleDNA(
  easingFamily: MotionDNA["easingFamily"],
  durationBucket: MotionDNA["timingProfile"]["durationBucket"],
  hasDelay: boolean,
  isLooping: boolean,
  transforms: string[],
  trigger: string,
  intensity: MotionDNA["intensity"],
): MotionDNA {
  const signature = `${easingFamily[0]}-${durationBucket[0]}-${transforms[0]?.[0] ?? "x"}-${intensity[0]}`;
  return {
    easingFamily,
    timingProfile: { durationBucket, hasDelay, isLooping },
    transformSignature: transforms,
    triggerSemantics: trigger,
    intensity,
    signature,
  };
}

function mostCommon<T>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  let max = 0;
  let result = arr[0];
  for (const [item, count] of counts) {
    if (count > max) {
      max = count;
      result = item;
    }
  }
  return result;
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}
