/** Motion Ecology Engine — models motion components as an ecosystem. */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A species classification. */
export interface Species {
  /** Species name (e.g., "spring-short-fast"). */
  name: string;
  /** Easing family. */
  easingFamily: string;
  /** Duration bucket. */
  durationBucket: "very-short" | "short" | "medium" | "long" | "very-long";
  /** Loop behavior. */
  loopBehavior: "one-shot" | "finite-loop" | "infinite-loop";
  /** Member component ids. */
  memberIds: string[];
  /** Population count. */
  population: number;
}

/** An ecological relationship between two species. */
export interface EcologicalRelation {
  speciesA: string;
  speciesB: string;
  /** Relationship type. */
  type: "symbiotic" | "parasitic" | "predator-prey" | "commensal" | "neutral";
  /** Strength 0..1. */
  strength: number;
  /** Description. */
  description: string;
}

/** Ecosystem analysis result. */
export interface EcosystemAnalysis {
  /** Detected species. */
  species: Species[];
  /** Ecological relationships. */
  relations: EcologicalRelation[];
  /** Biodiversity index (Shannon-like) 0..1. */
  biodiversity: number;
  /** Species richness (number of distinct species). */
  richness: number;
  /** Evenness (how evenly distributed populations are) 0..1. */
  evenness: number;
  /** Dominant species name. */
  dominantSpecies: string;
  /** Total population. */
  totalPopulation: number;
  /** Carrying capacity estimate. */
  carryingCapacity: number;
  /** Ecosystem health 0..1. */
  health: number;
  /** Stability classification. */
  stability: "fragile" | "stable" | "resilient" | "thriving";
  /** Trophic level distribution. */
  trophicLevels: {
    producers: number;     // Background/static components
    primaryConsumers: number; // Entrance animations
    secondaryConsumers: number; // Emphasis animations
    apex: number;          // Hero/signature animations
  };
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Species Classification
// ---------------------------------------------------------------------------

/** Classify a component into a species. */
function classifySpecies(comp: MotionComponent): {
  easingFamily: string;
  durationBucket: Species["durationBucket"];
  loopBehavior: Species["loopBehavior"];
  name: string;
} {
  // Easing family
  let easingFamily = "none";
  if (comp.easing && typeof comp.easing === "object") {
    if (comp.easing.type === "preset") {
      easingFamily = `preset:${comp.easing.name}`;
    } else {
      easingFamily = comp.easing.type;
    }
  }

  // Duration bucket
  const d = comp.durationMs;
  const durationBucket: Species["durationBucket"] =
    d < 500 ? "very-short" :
    d < 1000 ? "short" :
    d < 2000 ? "medium" :
    d < 4000 ? "long" :
    "very-long";

  // Loop behavior
  const loopBehavior: Species["loopBehavior"] =
    comp.iterationCount === "infinite" ? "infinite-loop" :
    typeof comp.iterationCount === "number" && comp.iterationCount > 1 ? "finite-loop" :
    "one-shot";

  return {
    easingFamily,
    durationBucket,
    loopBehavior,
    name: `${easingFamily}-${durationBucket}-${loopBehavior}`,
  };
}

/** Group components into species. */
function detectSpecies(components: MotionComponent[]): Species[] {
  const speciesMap = new Map<string, Species>();

  for (const comp of components) {
    const cls = classifySpecies(comp);
    if (!speciesMap.has(cls.name)) {
      speciesMap.set(cls.name, {
        name: cls.name,
        easingFamily: cls.easingFamily,
        durationBucket: cls.durationBucket,
        loopBehavior: cls.loopBehavior,
        memberIds: [],
        population: 0,
      });
    }
    const sp = speciesMap.get(cls.name)!;
    sp.memberIds.push(comp.id);
    sp.population++;
  }

  return Array.from(speciesMap.values());
}

// ---------------------------------------------------------------------------
// Relationship Detection
// ---------------------------------------------------------------------------

/** Detect ecological relationships between species. */
function detectRelations(species: Species[], components: MotionComponent[]): EcologicalRelation[] {
  const relations: EcologicalRelation[] = [];

  for (let i = 0; i < species.length; i++) {
    for (let j = i + 1; j < species.length; j++) {
      const a = species[i];
      const b = species[j];
      const rel = classifyRelation(a, b, components);
      if (rel.type !== "neutral") {
        relations.push(rel);
      }
    }
  }

  return relations;
}

/** Classify the relationship between two species. */
function classifyRelation(
  a: Species,
  b: Species,
  components: MotionComponent[],
): EcologicalRelation {
  // Check temporal overlap between members
  const aMembers = a.memberIds.map((id) => components.find((c) => c.id === id)!).filter(Boolean);
  const bMembers = b.memberIds.map((id) => components.find((c) => c.id === id)!).filter(Boolean);

  let overlapCount = 0;
  for (const am of aMembers) {
    for (const bm of bMembers) {
      if (temporalOverlap(am, bm)) {
        overlapCount++;
      }
    }
  }

  const maxPairs = aMembers.length * bMembers.length;
  const overlapRatio = maxPairs > 0 ? overlapCount / maxPairs : 0;

  // Same easing family = potential competition (parasitic)
  if (a.easingFamily === b.easingFamily && overlapRatio > 0.5) {
    return {
      speciesA: a.name,
      speciesB: b.name,
      type: "parasitic",
      strength: overlapRatio,
      description: `Species ${a.name} and ${b.name} compete for the same easing niche with ${(overlapRatio * 100).toFixed(0)}% temporal overlap`,
    };
  }

  // Complementary timing (one-shot + loop = symbiotic)
  if (
    (a.loopBehavior === "one-shot" && b.loopBehavior === "infinite-loop") ||
    (a.loopBehavior === "infinite-loop" && b.loopBehavior === "one-shot")
  ) {
    return {
      speciesA: a.name,
      speciesB: b.name,
      type: "symbiotic",
      strength: 0.8,
      description: `Species ${a.name} and ${b.name} form a symbiotic relationship — one-shot entrances complement infinite background loops`,
    };
  }

  // Different duration buckets with overlap = predator-prey
  if (a.durationBucket !== b.durationBucket && overlapRatio > 0.3) {
    // Longer duration = predator (consumes attention), shorter = prey
    const aDuration = avgDuration(a, components);
    const bDuration = avgDuration(b, components);
    const predator = aDuration > bDuration ? a.name : b.name;
    const prey = aDuration > bDuration ? b.name : a.name;
    return {
      speciesA: predator,
      speciesB: prey,
      type: "predator-prey",
      strength: overlapRatio,
      description: `Species ${predator} (longer duration) preys on ${prey} (shorter duration) — captures viewer attention`,
    };
  }

  // Commensal: one benefits, other unaffected
  if (overlapRatio > 0.1 && overlapRatio < 0.3) {
    return {
      speciesA: a.name,
      speciesB: b.name,
      type: "commensal",
      strength: overlapRatio,
      description: `Species ${a.name} and ${b.name} have a commensal relationship with minimal temporal overlap`,
    };
  }

  return {
    speciesA: a.name,
    speciesB: b.name,
    type: "neutral",
    strength: 0,
    description: `Species ${a.name} and ${b.name} do not interact`,
  };
}

/** Check temporal overlap between two components. */
function temporalOverlap(a: MotionComponent, b: MotionComponent): boolean {
  return a.delayMs < b.delayMs + b.durationMs && b.delayMs < a.delayMs + a.durationMs;
}

/** Compute average duration of a species' members. */
function avgDuration(species: Species, components: MotionComponent[]): number {
  const members = species.memberIds
    .map((id) => components.find((c) => c.id === id))
    .filter((c): c is MotionComponent => Boolean(c));
  if (members.length === 0) return 0;
  return members.reduce((sum, c) => sum + c.durationMs, 0) / members.length;
}

// ---------------------------------------------------------------------------
// Biodiversity Metrics
// ---------------------------------------------------------------------------

/** Compute Shannon biodiversity index (normalized 0..1). */
function computeBiodiversity(species: Species[]): number {
  if (species.length === 0) return 0;
  const total = species.reduce((sum, s) => sum + s.population, 0);
  if (total === 0) return 0;

  let shannonH = 0;
  for (const s of species) {
    const p = s.population / total;
    if (p > 0) {
      shannonH -= p * Math.log2(p);
    }
  }

  // Normalize by max possible entropy
  const maxH = Math.log2(species.length);
  return maxH > 0 ? shannonH / maxH : 0;
}

/** Compute evenness (Pielou's index). */
function computeEvenness(species: Species[]): number {
  return computeBiodiversity(species); // Same as normalized Shannon
}

// ---------------------------------------------------------------------------
// Trophic Levels
// ---------------------------------------------------------------------------

/** Classify trophic levels. */
function classifyTrophicLevels(species: Species[], components: MotionComponent[]): {
  producers: number;
  primaryConsumers: number;
  secondaryConsumers: number;
  apex: number;
} {
  let producers = 0;       // Static/background
  let primaryConsumers = 0; // Entrance (one-shot, short)
  let secondaryConsumers = 0; // Emphasis (loops, medium)
  let apex = 0;            // Hero (long, infinite, large)

  for (const sp of species) {
    const avg = avgDuration(sp, components);
    if (sp.loopBehavior === "infinite-loop" && avg > 2000) {
      apex += sp.population;
    } else if (sp.loopBehavior === "infinite-loop") {
      secondaryConsumers += sp.population;
    } else if (sp.loopBehavior === "one-shot" && avg < 1000) {
      primaryConsumers += sp.population;
    } else {
      producers += sp.population;
    }
  }

  return { producers, primaryConsumers, secondaryConsumers, apex };
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Analyze the ecological structure of a motion composition.
 */
export function analyzeEcosystem(spec: MotionSpec): EcosystemAnalysis {
  const components = spec.components;
  if (components.length === 0) {
    return {
      species: [],
      relations: [],
      biodiversity: 0,
      richness: 0,
      evenness: 0,
      dominantSpecies: "none",
      totalPopulation: 0,
      carryingCapacity: 0,
      health: 0,
      stability: "fragile",
      trophicLevels: { producers: 0, primaryConsumers: 0, secondaryConsumers: 0, apex: 0 },
      summary: "No components — empty ecosystem.",
    };
  }

  const species = detectSpecies(components);
  const relations = detectRelations(species, components);

  const biodiversity = computeBiodiversity(species);
  const evenness = computeEvenness(species);
  const richness = species.length;

  // Dominant species (highest population)
  const dominant = species.reduce((max, s) => (s.population > max.population ? s : max), species[0]);

  const totalPopulation = components.length;

  // Carrying capacity: timeline duration / average component duration
  const timelineEnd = Math.max(...components.map((c) => c.delayMs + c.durationMs));
  const avgDur = components.reduce((sum, c) => sum + c.durationMs, 0) / components.length;
  const carryingCapacity = avgDur > 0 ? Math.round(timelineEnd / avgDur) : totalPopulation;

  // Trophic levels
  const trophicLevels = classifyTrophicLevels(species, components);

  // Health: combination of biodiversity, evenness, and balance
  const balanceScore = trophicLevels.apex > 0 && trophicLevels.producers > 0 ? 1 : 0.5;
  const health = biodiversity * 0.4 + evenness * 0.3 + balanceScore * 0.3;

  // Stability classification
  const stability: EcosystemAnalysis["stability"] =
    health < 0.25 ? "fragile" :
    health < 0.5 ? "stable" :
    health < 0.75 ? "resilient" :
    "thriving";

  const summary = `Ecosystem: ${richness} species, ${totalPopulation} population, ` +
    `biodiversity ${(biodiversity * 100).toFixed(0)}%, evenness ${(evenness * 100).toFixed(0)}%, ` +
    `health ${(health * 100).toFixed(0)}% (${stability}), ` +
    `${relations.length} interaction(s), carrying capacity ${carryingCapacity}`;

  return {
    species,
    relations,
    biodiversity,
    richness,
    evenness,
    dominantSpecies: dominant.name,
    totalPopulation,
    carryingCapacity,
    health,
    stability,
    trophicLevels,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format an ecosystem analysis as a human-readable report. */
export function formatEcosystemReport(analysis: EcosystemAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Ecosystem Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  lines.push("## Species");
  for (const sp of analysis.species) {
    lines.push(
      `- ${sp.name}: population ${sp.population} (${sp.easingFamily}, ${sp.durationBucket}, ${sp.loopBehavior})`,
    );
  }
  lines.push("");

  if (analysis.relations.length > 0) {
    lines.push("## Ecological Relationships");
    for (const rel of analysis.relations) {
      lines.push(`- [${rel.type}] ${rel.speciesA} ↔ ${rel.speciesB} — ${rel.description}`);
    }
    lines.push("");
  }

  lines.push("## Trophic Levels");
  lines.push(`- Producers (background): ${analysis.trophicLevels.producers}`);
  lines.push(`- Primary consumers (entrance): ${analysis.trophicLevels.primaryConsumers}`);
  lines.push(`- Secondary consumers (emphasis): ${analysis.trophicLevels.secondaryConsumers}`);
  lines.push(`- Apex (hero): ${analysis.trophicLevels.apex}`);
  lines.push("");

  lines.push("## Health");
  lines.push(`- Biodiversity: ${(analysis.biodiversity * 100).toFixed(0)}%`);
  lines.push(`- Evenness: ${(analysis.evenness * 100).toFixed(0)}%`);
  lines.push(`- Health: ${(analysis.health * 100).toFixed(0)}%`);
  lines.push(`- Stability: ${analysis.stability}`);
  lines.push(`- Carrying capacity: ${analysis.carryingCapacity}`);

  return lines.join("\n");
}
