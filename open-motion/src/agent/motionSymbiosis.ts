/**
 * Motion Symbiosis Engine — models cross-composition ecological relationships.
 *
 * This original AI-native module treats two motion compositions as organisms
 * sharing a design ecosystem. It extracts each composition's genomic
 * signature (a trait vector over motion design dimensions), measures niche
 * overlap and resource competition, classifies the ecological relationship
 * between the two, and breeds a hybrid offspring composition by crossing
 * over keyframe tracks and easing curves from both parents.
 *
 * Core concepts:
 * - Genome: a trait vector characterizing a composition's design phenotype
 * - Niche Overlap: how much the two compositions occupy the same design
 *   territory (high overlap = direct competitors for the same niche)
 * - Complementarity: how much each composition fills gaps the other leaves
 * - Relationship Type: mutualism, commensalism, parasitism, competition,
 *   neutralism — derived from overlap and complementarity
 * - Hybrid Offspring: a new component set bred by recombining parental
 *   keyframes, easings, and timings via crossover
 * - Symbiosis Fitness: how viable the offspring is in the shared niche
 *
 * Rule-based — no LLM round-trip required. Deterministic given the inputs.
 */

import type { Easing, Keyframe, MotionComponent, MotionSpec } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import type { ComponentDraft } from "../motion/templates/helper.js";
import { draft, kf, resetOrder } from "../motion/templates/helper.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Genomic trait vector characterizing a single composition. */
export interface MotionGenome {
  /** Density of simultaneous motion elements (0..1). */
  density: number;
  /** Energy / speed of motion (0..1). */
  energy: number;
  /** Complexity of easing curves (0..1). */
  easingComplexity: number;
  /** Visual richness from inline styles (0..1). */
  richness: number;
  /** Rhythmic structure (0..1). */
  rhythmicity: number;
  /** Narrative structure from scenes (0..1). */
  narrativity: number;
  /** Organic vs mechanical motion (0..1). */
  organicity: number;
  /** Average duration in ms (raw, for offspring timing). */
  avgDurationMs: number;
  /** Set of distinct animated property names. */
  propertySet: Set<string>;
  /** Set of distinct easing signatures. */
  easingSet: Set<string>;
}

/** Ecological relationship classifications between two compositions. */
export type RelationshipType =
  | "mutualism"
  | "commensalism"
  | "parasitism"
  | "competition"
  | "neutralism";

/** A single observed ecological interaction between the two compositions. */
export interface EcologicalInteraction {
  /** Trait dimension where the interaction occurs. */
  dimension: string;
  /** Observed relationship on this dimension. */
  relationship: RelationshipType;
  /** Strength 0..1 of the interaction. */
  strength: number;
  /** Human-readable explanation. */
  note: string;
}

/** A hybrid offspring component bred from two parental components. */
export interface HybridOffspringComponent {
  /** Display name. */
  name: string;
  /** Which parent contributed the easing (A or B). */
  easingParent: "A" | "B";
  /** Which parent contributed the keyframe shape (A or B). */
  keyframeParent: "A" | "B";
  /** Component draft ready to persist. */
  draft: ComponentDraft;
}

/** Full symbiosis report. */
export interface SymbiosisReport {
  /** Genome of composition A. */
  genomeA: MotionGenome;
  /** Genome of composition B. */
  genomeB: MotionGenome;
  /** Niche overlap 0..1 (Jaccard over trait space). */
  nicheOverlap: number;
  /** Complementarity 0..1 — how well each fills the other's gaps. */
  complementarity: number;
  /** Resource competition 0..1 — direct competition for the same niche. */
  competition: number;
  /** Overall classified relationship. */
  relationship: RelationshipType;
  /** Per-dimension interaction breakdown. */
  interactions: EcologicalInteraction[];
  /** Hybrid offspring components. */
  offspring: HybridOffspringComponent[];
  /** Offspring viability 0..1. */
  fitness: number;
  /** Summary string. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Genome extraction
// ---------------------------------------------------------------------------

function extractGenome(spec: MotionSpec): MotionGenome {
  const components = spec.components ?? [];
  if (components.length === 0) {
    return {
      density: 0,
      energy: 0,
      easingComplexity: 0,
      richness: 0,
      rhythmicity: 0,
      narrativity: 0,
      organicity: 0,
      avgDurationMs: 0,
      propertySet: new Set(),
      easingSet: new Set(),
    };
  }

  const density = Math.min(1, components.length / 10);
  const avgDurationMs =
    components.reduce((s, c) => s + (c.durationMs ?? 800), 0) / components.length;
  const energy = Math.max(0, Math.min(1, 1 - (avgDurationMs - 200) / 2000));

  const easingSet = new Set<string>();
  let complexCount = 0;
  for (const c of components) {
    const sig = serializeEasing(c.easing);
    easingSet.add(sig);
    if (sig.includes("elastic") || sig.includes("bounce") || sig.includes("back") || sig.includes("spring")) {
      complexCount++;
    }
  }
  const easingComplexity = Math.min(
    1,
    (easingSet.size / 4) * 0.5 + (complexCount / components.length) * 0.5,
  );

  const propertySet = new Set<string>();
  const styleKeys = new Set<string>();
  let colorCount = 0;
  for (const c of components) {
    for (const kfEntry of c.keyframes) {
      for (const k of Object.keys(kfEntry.properties)) propertySet.add(k);
    }
    const style = (c as MotionComponent & { style?: Record<string, unknown> }).style ?? {};
    for (const k of Object.keys(style)) styleKeys.add(k);
    if ("background" in style || "backgroundColor" in style || "color" in style) colorCount++;
  }
  const richness = Math.min(
    1,
    (styleKeys.size / 8) * 0.6 + (colorCount / components.length) * 0.4,
  );

  const bpm = spec.project?.globalTiming?.bpm;
  const hasStagger = components.some((c, i) => (c.delayMs ?? 0) > 0 && i > 0);
  const rhythmicity = Math.min(
    1,
    (bpm ? 0.5 : 0) + (hasStagger ? 0.3 : 0) + (components.length > 3 ? 0.2 : 0),
  );

  const sceneCount = spec.project?.scenes?.length ?? 0;
  const narrativity = Math.min(1, sceneCount / 4);

  const organicCount = components.filter((c) => {
    const s = serializeEasing(c.easing);
    return s.includes("spring") || s.includes("elastic");
  }).length;
  const organicity = organicCount / components.length;

  return {
    density,
    energy,
    easingComplexity,
    richness,
    rhythmicity,
    narrativity,
    organicity,
    avgDurationMs,
    propertySet,
    easingSet,
  };
}

function serializeEasing(e: Easing | undefined): string {
  if (!e) return "none";
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Relationship classification
// ---------------------------------------------------------------------------

/** Trait dimensions examined for ecological interactions. */
const TRAIT_KEYS: Array<keyof MotionGenome> = [
  "density",
  "energy",
  "easingComplexity",
  "richness",
  "rhythmicity",
  "narrativity",
  "organicity",
];

function traitDistance(a: MotionGenome, b: MotionGenome): number {
  let sum = 0;
  for (const k of TRAIT_KEYS) {
    const av = a[k] as number;
    const bv = b[k] as number;
    sum += (av - bv) ** 2;
  }
  return Math.sqrt(sum / TRAIT_KEYS.length);
}

/** Jaccard-style overlap over the property and easing sets plus trait proximity. */
function computeNicheOverlap(a: MotionGenome, b: MotionGenome): number {
  // Set overlap (Jaccard) on the union of property + easing sets.
  const setA = new Set<string>([...a.propertySet, ...a.easingSet]);
  const setB = new Set<string>([...b.propertySet, ...b.easingSet]);
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  const setOverlap = union === 0 ? 0 : inter / union;
  // Trait proximity: 1 minus normalized distance.
  const traitProximity = Math.max(0, 1 - traitDistance(a, b) * 2);
  // Weighted blend.
  return Math.min(1, setOverlap * 0.5 + traitProximity * 0.5);
}

function computeComplementarity(a: MotionGenome, b: MotionGenome): number {
  // Complementarity: each composition fills gaps the other leaves.
  // For each trait, if one is high and the other low, they complement.
  let sum = 0;
  for (const k of TRAIT_KEYS) {
    const av = a[k] as number;
    const bv = b[k] as number;
    const gap = Math.abs(av - bv);
    // Reward mid-range gaps — extreme specialization both ways.
    sum += Math.min(1, gap * 1.2);
  }
  // Set complementarity: traits/easings only in one composition.
  const setA = new Set<string>([...a.propertySet, ...a.easingSet]);
  const setB = new Set<string>([...b.propertySet, ...b.easingSet]);
  let onlyOne = 0;
  const union = new Set<string>([...setA, ...setB]);
  for (const x of union) {
    if (setA.has(x) !== setB.has(x)) onlyOne++;
  }
  const setComplement = union.size === 0 ? 0 : onlyOne / union.size;
  return Math.min(1, (sum / TRAIT_KEYS.length) * 0.6 + setComplement * 0.4);
}

function classifyOverall(
  overlap: number,
  complementarity: number,
  interactions: EcologicalInteraction[],
): RelationshipType {
  // Tally per-dimension votes; weigh by strength.
  const tally: Record<RelationshipType, number> = {
    mutualism: 0,
    commensalism: 0,
    parasitism: 0,
    competition: 0,
    neutralism: 0,
  };
  for (const it of interactions) {
    tally[it.relationship] += it.strength;
  }
  // Strong direct competition when overlap is very high and complementarity low.
  if (overlap > 0.7 && complementarity < 0.3) {
    tally.competition += 0.5;
  }
  // Mutualism thrives when both overlap and complementarity are moderate.
  if (overlap > 0.3 && overlap < 0.7 && complementarity > 0.4) {
    tally.mutualism += 0.4;
  }
  // Neutralism when there is neither overlap nor complementarity.
  if (overlap < 0.2 && complementarity < 0.2) {
    tally.neutralism += 0.5;
  }
  let best: RelationshipType = "neutralism";
  let bestScore = -1;
  (Object.keys(tally) as RelationshipType[]).forEach((k) => {
    if (tally[k] > bestScore) {
      bestScore = tally[k];
      best = k;
    }
  });
  return best;
}

function buildInteractions(a: MotionGenome, b: MotionGenome): EcologicalInteraction[] {
  const interactions: EcologicalInteraction[] = [];
  for (const k of TRAIT_KEYS) {
    const av = a[k] as number;
    const bv = b[k] as number;
    const diff = bv - av;
    const strength = Math.min(1, Math.abs(diff) * 1.5);
    let relationship: RelationshipType;
    let note: string;
    if (Math.abs(diff) < 0.08) {
      relationship = "competition";
      note = `Both compositions claim the same "${k}" niche (${av.toFixed(2)} vs ${bv.toFixed(2)}) — they compete directly.`;
    } else if (diff > 0.25) {
      relationship = "commensalism";
      note = `Composition B leads on "${k}" (${bv.toFixed(2)} vs ${av.toFixed(2)}) — A benefits from B's strength without cost.`;
    } else if (diff < -0.25) {
      relationship = "parasitism";
      note = `Composition A dominates "${k}" (${av.toFixed(2)} vs ${bv.toFixed(2)}) — B is overshadowed.`;
    } else if (Math.abs(diff) >= 0.08 && Math.abs(diff) <= 0.25) {
      relationship = "mutualism";
      note = `Complementary "${k}" levels (${av.toFixed(2)} vs ${bv.toFixed(2)}) — both contribute to a balanced ecosystem.`;
    } else {
      relationship = "neutralism";
      note = `"${k}" levels are close enough (${av.toFixed(2)} vs ${bv.toFixed(2)}) to neither help nor harm.`;
    }
    if (strength > 0.05) {
      interactions.push({ dimension: String(k), relationship, strength, note });
    }
  }
  return interactions;
}

// ---------------------------------------------------------------------------
// Hybrid offspring breeding
// ---------------------------------------------------------------------------

/** Pick a representative component from a spec for breeding. Falls back to a
 *  synthesized placeholder when the spec is empty so the offspring is never
 *  empty. */
function pickBreedingStock(spec: MotionSpec, label: string): {
  easing: Easing;
  keyframes: Keyframe[];
  durationMs: number;
  name: string;
} {
  const components = spec.components ?? [];
  if (components.length === 0) {
    return {
      easing: easingPreset("ease-out"),
      keyframes: [
        kf(0, { opacity: "0", scale: "0.8" }),
        kf(1, { opacity: "1", scale: "1" }),
      ],
      durationMs: 800,
      name: `${label} (empty)`,
    };
  }
  // Pick the component with the richest keyframe set.
  let best = components[0];
  let bestScore = best.keyframes.length;
  for (const c of components) {
    const score = c.keyframes.length + Object.keys(c.style ?? {}).length * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return {
    easing: best.easing,
    keyframes: best.keyframes,
    durationMs: best.durationMs,
    name: best.name,
  };
}

/** Recombine two parental keyframe tracks via single-point crossover.
 *  Takes the first half of parent A's offsets and the second half of
 *  parent B's, then re-normalizes offsets to span 0..1. */
function crossoverKeyframes(a: Keyframe[], b: Keyframe[]): Keyframe[] {
  const safeA = a.length > 0 ? a : [kf(0, { opacity: "0" }), kf(1, { opacity: "1" })];
  const safeB = b.length > 0 ? b : [kf(0, { opacity: "1" }), kf(1, { opacity: "1" })];
  const split = Math.max(1, Math.floor(safeA.length / 2));
  const head = safeA.slice(0, split);
  const tail = safeB.slice(split);
  const combined = [...head, ...tail];
  if (combined.length === 0) {
    return [kf(0, { opacity: "0" }), kf(1, { opacity: "1" })];
  }
  // Re-normalize offsets to span 0..1 in original order.
  const first = combined[0].offset;
  const last = combined[combined.length - 1].offset;
  const span = last - first || 1;
  return combined.map((k, i) => ({
    offset: i === 0 ? 0 : i === combined.length - 1 ? 1 : (k.offset - first) / span,
    properties: { ...k.properties },
    easing: k.easing,
  }));
}

function breedOffspring(specA: MotionSpec, specB: MotionSpec): HybridOffspringComponent[] {
  resetOrder();
  const stockA = pickBreedingStock(specA, "A");
  const stockB = pickBreedingStock(specB, "B");
  const offspring: HybridOffspringComponent[] = [];

  // Offspring 1: A's easing + B's keyframes.
  const duration1 = Math.round((stockA.durationMs + stockB.durationMs) / 2);
  offspring.push({
    name: "Symbiosis Offspring α",
    easingParent: "A",
    keyframeParent: "B",
    draft: draft("Symbiosis Offspring α", {
      durationMs: duration1,
      easing: stockA.easing,
      iterationCount: 1,
      keyframes: crossoverKeyframes(stockA.keyframes, stockB.keyframes),
      style: { _content: "α", fontSize: 56, color: "#f4f6fb" },
    }),
  });

  // Offspring 2: B's easing + A's keyframes (mirrored crossover).
  offspring.push({
    name: "Symbiosis Offspring β",
    easingParent: "B",
    keyframeParent: "A",
    draft: draft("Symbiosis Offspring β", {
      durationMs: duration1,
      easing: stockB.easing,
      iterationCount: 1,
      keyframes: crossoverKeyframes(stockB.keyframes, stockA.keyframes),
      style: { _content: "β", fontSize: 56, color: "#f4f6fb" },
    }),
  });

  // Offspring 3: a unified hybrid — both easings in sequence (A's then B's),
  // merging keyframes from both parents for a richer phenotype.
  const mergedKeyframes: Keyframe[] = [];
  const maxLen = Math.max(stockA.keyframes.length, stockB.keyframes.length);
  for (let i = 0; i < maxLen; i++) {
    const ka = stockA.keyframes[i % stockA.keyframes.length];
    const kb = stockB.keyframes[i % stockB.keyframes.length];
    if (ka && kb) {
      mergedKeyframes.push({
        offset: i / Math.max(1, maxLen - 1),
        properties: { ...ka.properties, ...kb.properties },
        easing: i % 2 === 0 ? ka.easing : kb.easing,
      });
    }
  }
  if (mergedKeyframes.length === 0) {
    mergedKeyframes.push(kf(0, { opacity: "0" }), kf(1, { opacity: "1" }));
  }
  offspring.push({
    name: "Symbiosis Offspring γ",
    easingParent: "A",
    keyframeParent: "A",
    draft: draft("Symbiosis Offspring γ", {
      durationMs: Math.max(stockA.durationMs, stockB.durationMs),
      easing: stockA.easing,
      iterationCount: 1,
      keyframes: mergedKeyframes,
      style: { _content: "γ", fontSize: 56, color: "#f4f6fb" },
    }),
  });

  return offspring;
}

function computeFitness(
  genomeA: MotionGenome,
  genomeB: MotionGenome,
  overlap: number,
  complementarity: number,
): number {
  // Offspring viability is highest when parents are neither identical
  // (inbreeding depression) nor totally alien (outbreeding depression).
  // Sweet spot: moderate overlap with healthy complementarity.
  const overlapFitness = 1 - Math.abs(overlap - 0.45) * 1.5;
  const complementFitness = Math.min(1, complementarity * 1.3);
  // Distance penalty for extreme mismatch.
  const dist = traitDistance(genomeA, genomeB);
  const distFitness = 1 - Math.abs(dist - 0.35) * 1.2;
  return Math.max(0, Math.min(1, (overlapFitness + complementFitness + distFitness) / 3));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze the symbiotic relationship between two motion compositions and
 * breed a hybrid offspring.
 *
 * @param specA First composition (parent A).
 * @param specB Second composition (parent B).
 */
export function analyzeSymbiosis(specA: MotionSpec, specB: MotionSpec): SymbiosisReport {
  const genomeA = extractGenome(specA);
  const genomeB = extractGenome(specB);
  const nicheOverlap = computeNicheOverlap(genomeA, genomeB);
  const complementarity = computeComplementarity(genomeA, genomeB);
  const interactions = buildInteractions(genomeA, genomeB);
  const relationship = classifyOverall(nicheOverlap, complementarity, interactions);
  const offspring = breedOffspring(specA, specB);
  const fitness = computeFitness(genomeA, genomeB, nicheOverlap, complementarity);
  const competition = Math.min(1, nicheOverlap * (1 - complementarity));
  const summary = formatSymbiosisSummary(
    relationship,
    nicheOverlap,
    complementarity,
    offspring.length,
    fitness,
  );
  return {
    genomeA,
    genomeB,
    nicheOverlap,
    complementarity,
    competition,
    relationship,
    interactions,
    offspring,
    fitness,
    summary,
  };
}

function formatSymbiosisSummary(
  relationship: RelationshipType,
  overlap: number,
  complementarity: number,
  offspringCount: number,
  fitness: number,
): string {
  return [
    `Symbiosis: relationship is "${relationship}".`,
    `Niche overlap ${(overlap * 100).toFixed(0)}%, complementarity ${(complementarity * 100).toFixed(0)}%.`,
    `Bred ${offspringCount} hybrid offspring at ${(fitness * 100).toFixed(0)}% viability.`,
  ].join(" ");
}

/** Format the full symbiosis report as a readable multi-line string. */
export function formatSymbiosisReport(report: SymbiosisReport): string {
  const lines: string[] = [report.summary, ""];
  lines.push("Genome A:");
  lines.push(`  density=${report.genomeA.density.toFixed(2)} energy=${report.genomeA.energy.toFixed(2)}`);
  lines.push(`  easingComplexity=${report.genomeA.easingComplexity.toFixed(2)} richness=${report.genomeA.richness.toFixed(2)}`);
  lines.push(`  rhythmicity=${report.genomeA.rhythmicity.toFixed(2)} narrativity=${report.genomeA.narrativity.toFixed(2)}`);
  lines.push(`  organicity=${report.genomeA.organicity.toFixed(2)}`);
  lines.push("Genome B:");
  lines.push(`  density=${report.genomeB.density.toFixed(2)} energy=${report.genomeB.energy.toFixed(2)}`);
  lines.push(`  easingComplexity=${report.genomeB.easingComplexity.toFixed(2)} richness=${report.genomeB.richness.toFixed(2)}`);
  lines.push(`  rhythmicity=${report.genomeB.rhythmicity.toFixed(2)} narrativity=${report.genomeB.narrativity.toFixed(2)}`);
  lines.push(`  organicity=${report.genomeB.organicity.toFixed(2)}`);
  lines.push("");
  lines.push(`Niche overlap: ${(report.nicheOverlap * 100).toFixed(0)}%`);
  lines.push(`Complementarity: ${(report.complementarity * 100).toFixed(0)}%`);
  lines.push(`Competition: ${(report.competition * 100).toFixed(0)}%`);
  if (report.interactions.length > 0) {
    lines.push("", "Interactions:");
    for (const it of report.interactions) {
      lines.push(`  • ${it.dimension} → ${it.relationship} (strength ${(it.strength * 100).toFixed(0)}%)`);
      lines.push(`      ${it.note}`);
    }
  }
  if (report.offspring.length > 0) {
    lines.push("", `Hybrid offspring (fitness ${(report.fitness * 100).toFixed(0)}%):`);
    for (const child of report.offspring) {
      lines.push(`  • ${child.name} — easing from ${child.easingParent}, keyframes from ${child.keyframeParent}`);
      lines.push(`      ${child.draft.keyframes.length} keyframe(s), ${child.draft.durationMs}ms`);
    }
  }
  return lines.join("\n");
}
