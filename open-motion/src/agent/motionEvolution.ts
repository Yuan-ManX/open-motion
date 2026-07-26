import type { MotionComponent, MotionSpec, Easing } from "@openmotion/shared";
import { easingPreset } from "../shared/motion/easing.js";

/**
 * Evolutionary motion optimization engine.
 *
 * Treats a MotionSpec as a genome and evolves it across generations using
 * selection, crossover, and mutation. Each individual is scored by a
 * multi-criteria fitness function measuring principle adherence, accessibility,
 * performance, and aesthetic harmony. The engine returns the fittest spec
 * along with a full evolution trace for transparency.
 *
 * Original to OpenMotion — applies evolutionary computation to motion design
 * so the Agent can breed progressively better animations from a seed spec.
 */

export interface Individual {
  id: string;
  generation: number;
  spec: MotionSpec;
  fitness: FitnessScore;
  parents: string[];
  origin: "seed" | "crossover" | "mutation" | "elite";
}

export interface FitnessScore {
  total: number;
  principles: number;
  accessibility: number;
  performance: number;
  harmony: number;
  novelty: number;
  breakdown: string[];
}

export interface EvolutionConfig {
  populationSize: number;
  generations: number;
  eliteCount: number;
  mutationRate: number;
  crossoverRate: number;
  tournamentSize: number;
  targets: FitnessTargets;
}

export interface FitnessTargets {
  /** Preferred duration range in ms. */
  durationRange: [number, number];
  /** Whether infinite loops are penalized. */
  penalizeInfiniteLoops: boolean;
  /** Whether to reward easing variety. */
  rewardEasingVariety: boolean;
  /** Maximum acceptable keyframe count per component. */
  maxKeyframes: number;
  /** Whether to reward staggered timing. */
  rewardStagger: boolean;
}

export interface EvolutionResult {
  best: Individual;
  population: Individual[];
  history: GenerationSummary[];
  config: EvolutionConfig;
  improvement: number;
  summary: string;
}

export interface GenerationSummary {
  generation: number;
  bestFitness: number;
  averageFitness: number;
  worstFitness: number;
  diversity: number;
  improvements: number;
}

const DEFAULT_CONFIG: EvolutionConfig = {
  populationSize: 12,
  generations: 8,
  eliteCount: 2,
  mutationRate: 0.35,
  crossoverRate: 0.7,
  tournamentSize: 3,
  targets: {
    durationRange: [400, 2000],
    penalizeInfiniteLoops: false,
    rewardEasingVariety: true,
    maxKeyframes: 12,
    rewardStagger: true,
  },
};

// --- Easing gene pool for mutations ---

const EASING_GENE_POOL: Easing[] = [
  easingPreset("ease-out"),
  easingPreset("ease-in-out"),
  easingPreset("ease-in"),
  easingPreset("bounce"),
  easingPreset("back"),
  easingPreset("elastic"),
  easingPreset("snappy"),
  easingPreset("smooth"),
  easingPreset("soft"),
  { type: "spring", stiffness: 200, damping: 20, mass: 1 },
  { type: "spring", stiffness: 400, damping: 30, mass: 1 },
  { type: "spring", stiffness: 100, damping: 15, mass: 1 },
  { type: "bezier", p1: [0.16, 1], p2: [0.3, 1] },
  { type: "bezier", p1: [0.34, 1.56], p2: [0.64, 1] },
  { type: "bezier", p1: [0.68, -0.55], p2: [0.265, 1.55] },
];

// --- Fitness evaluation ---

/** Score an individual spec across all fitness criteria. */
function evaluateFitness(spec: MotionSpec, config: EvolutionConfig, previousSpecs?: MotionSpec[]): FitnessScore {
  const breakdown: string[] = [];
  const components = spec.components;

  if (components.length === 0) {
    return { total: 0, principles: 0, accessibility: 0, performance: 0, harmony: 0, novelty: 0, breakdown: ["empty spec"] };
  }

  // --- Principles (0-30) ---
  let principles = 0;
  for (const comp of components) {
    // Duration in a good range
    const [min, max] = config.targets.durationRange;
    if (comp.durationMs >= min && comp.durationMs <= max) {
      principles += 4;
      breakdown.push(`${comp.name}: duration ${comp.durationMs}ms in range`);
    } else if (comp.durationMs < min) {
      principles += 1;
    } else {
      principles += 2;
    }

    // Easing quality — non-linear easings are preferred for organic motion
    const easingName = comp.easing?.type === "preset" ? comp.easing.name : comp.easing?.type ?? "";
    if (easingName === "linear") {
      principles += 0;
    } else if (["bounce", "back", "elastic"].includes(easingName)) {
      principles += 5;
    } else if (["ease-out", "ease-in-out", "smooth", "soft", "snappy"].includes(easingName)) {
      principles += 4;
    } else if (easingName === "spring" || easingName === "bezier") {
      principles += 5;
    } else {
      principles += 2;
    }

    // Has keyframes (not static)
    if (comp.keyframes.length >= 2) {
      principles += 3;
    }
  }
  principles = Math.min(principles / components.length * 5, 30);

  // --- Accessibility (0-20) ---
  let accessibility = 0;
  for (const comp of components) {
    // Duration not too fast (accessibility)
    if (comp.durationMs >= 300) {
      accessibility += 3;
    } else {
      accessibility += 0;
      breakdown.push(`${comp.name}: duration too fast for accessibility`);
    }

    // Penalize infinite loops if configured
    if (config.targets.penalizeInfiniteLoops && comp.iterationCount === "infinite") {
      accessibility += 0;
    } else {
      accessibility += 2;
    }
  }
  accessibility = Math.min(accessibility / components.length * 4, 20);

  // --- Performance (0-20) ---
  let performance = 0;
  for (const comp of components) {
    // Keyframe count within limits
    const kfCount = comp.keyframes.length;
    if (kfCount <= config.targets.maxKeyframes) {
      performance += 4;
    } else {
      performance += 1;
      breakdown.push(`${comp.name}: too many keyframes (${kfCount})`);
    }

    // Simple easing is performant
    const easingType = comp.easing?.type ?? "preset";
    if (easingType === "preset") {
      performance += 3;
    } else if (easingType === "bezier") {
      performance += 2;
    } else if (easingType === "spring") {
      performance += 2; // Spring requires JS, slightly heavier
    }
  }
  performance = Math.min(performance / components.length * 4, 20);

  // --- Harmony (0-20) ---
  let harmony = 0;
  // Duration consistency
  const durations = components.map((c) => c.durationMs);
  const durAvg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const durVariance = durations.reduce((sum, d) => sum + Math.pow(d - durAvg, 2), 0) / durations.length;
  const durStdDev = Math.sqrt(durVariance);
  if (durStdDev < durAvg * 0.3) {
    harmony += 6;
    breakdown.push(`duration harmony: stddev ${durStdDev.toFixed(0)}ms`);
  } else if (durStdDev < durAvg * 0.6) {
    harmony += 3;
  }

  // Easing variety or consistency
  const easingTypes = new Set(components.map((c) => c.easing?.type === "preset" ? c.easing.name : c.easing?.type));
  if (config.targets.rewardEasingVariety) {
    if (easingTypes.size >= 2 && easingTypes.size <= 4) {
      harmony += 6;
      breakdown.push(`easing variety: ${easingTypes.size} types`);
    } else if (easingTypes.size === 1) {
      harmony += 4; // Consistent
    } else {
      harmony += 2; // Too varied
    }
  } else {
    if (easingTypes.size === 1) {
      harmony += 6;
    } else {
      harmony += 3;
    }
  }

  // Stagger (delays create cascading effect)
  if (config.targets.rewardStagger) {
    const delays = components.map((c) => c.delayMs);
    const hasStagger = delays.some((d) => d > 0) && delays.some((d) => d === 0);
    if (hasStagger) {
      harmony += 5;
      breakdown.push("staggered timing detected");
    } else if (delays.every((d) => d === 0)) {
      harmony += 2; // All at once is okay but less interesting
    }
  } else {
    harmony += 3;
  }

  // Direction consistency
  const directions = new Set(components.map((c) => c.direction));
  if (directions.size === 1) {
    harmony += 3;
  }

  harmony = Math.min(harmony, 20);

  // --- Novelty (0-10) ---
  let novelty = 5; // Base score
  if (previousSpecs && previousSpecs.length > 0) {
    // Compare against previous generations to reward exploration
    let maxSimilarity = 0;
    for (const prev of previousSpecs) {
      const similarity = computeSpecSimilarity(spec, prev);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }
    novelty = Math.round((1 - maxSimilarity) * 10);
    if (novelty > 7) {
      breakdown.push(`high novelty: ${(1 - maxSimilarity).toFixed(2)} dissimilarity`);
    }
  }

  const total = Math.round(principles + accessibility + performance + harmony + novelty);
  return { total, principles: Math.round(principles), accessibility: Math.round(accessibility), performance: Math.round(performance), harmony: Math.round(harmony), novelty, breakdown };
}

/** Compute a 0-1 similarity score between two specs. */
function computeSpecSimilarity(a: MotionSpec, b: MotionSpec): number {
  if (a.components.length === 0 || b.components.length === 0) return 0;
  const minLen = Math.min(a.components.length, b.components.length);
  let matchSum = 0;
  for (let i = 0; i < minLen; i++) {
    const ca = a.components[i];
    const cb = b.components[i];
    let match = 0;
    // Duration similarity
    const durDiff = Math.abs(ca.durationMs - cb.durationMs) / Math.max(ca.durationMs, cb.durationMs, 1);
    match += (1 - durDiff) * 0.3;
    // Easing similarity
    const eaName = ca.easing?.type === "preset" ? ca.easing.name : ca.easing?.type;
    const ebName = cb.easing?.type === "preset" ? cb.easing.name : cb.easing?.type;
    if (eaName === ebName) match += 0.4;
    // Delay similarity
    const delayDiff = Math.abs(ca.delayMs - cb.delayMs) / 1000;
    match += Math.max(0, 1 - delayDiff) * 0.3;
    matchSum += match;
  }
  return matchSum / minLen;
}

// --- Genetic operators ---

/** Create a deep clone of a spec with fresh timestamps. */
function cloneSpec(spec: MotionSpec): MotionSpec {
  return JSON.parse(JSON.stringify(spec));
}

/** Mutate a spec by randomly altering easing, duration, delay, or keyframes. */
function mutate(spec: MotionSpec, rate: number): MotionSpec {
  const mutated = cloneSpec(spec);
  for (const comp of mutated.components) {
    // Mutate easing
    if (Math.random() < rate) {
      comp.easing = EASING_GENE_POOL[Math.floor(Math.random() * EASING_GENE_POOL.length)];
    }
    // Mutate duration
    if (Math.random() < rate) {
      const factor = 0.5 + Math.random() * 1.5; // 0.5x to 2x
      comp.durationMs = Math.max(100, Math.round(comp.durationMs * factor));
    }
    // Mutate delay
    if (Math.random() < rate * 0.7) {
      comp.delayMs = Math.max(0, Math.round(Math.random() * 500));
    }
    // Mutate iteration count
    if (Math.random() < rate * 0.3) {
      const choices: Array<number | "infinite"> = [1, 1, 2, 3, "infinite"];
      comp.iterationCount = choices[Math.floor(Math.random() * choices.length)];
    }
    // Mutate direction
    if (Math.random() < rate * 0.2) {
      const dirs = ["normal", "reverse", "alternate", "alternate-reverse"];
      comp.direction = dirs[Math.floor(Math.random() * dirs.length)] as MotionComponent["direction"];
    }
    // Jitter keyframe values
    if (comp.keyframes.length > 0 && Math.random() < rate * 0.4) {
      const kf = comp.keyframes[Math.floor(Math.random() * comp.keyframes.length)];
      const props = kf.properties as Record<string, string | number>;
      for (const key of Object.keys(props)) {
        const val = props[key];
        if (typeof val === "number") {
          const jitter = val * (Math.random() * 0.2 - 0.1);
          props[key] = val + jitter;
        }
      }
    }
  }
  return mutated;
}

/** Crossover two specs to create an offspring. */
function crossover(parentA: MotionSpec, parentB: MotionSpec): MotionSpec {
  const child = cloneSpec(parentA);
  const minLen = Math.min(child.components.length, parentB.components.length);
  for (let i = 0; i < minLen; i++) {
    const childComp = child.components[i];
    const donorComp = parentB.components[i];
    // 50% chance to inherit each trait from parent B
    if (Math.random() < 0.5) {
      childComp.easing = donorComp.easing;
    }
    if (Math.random() < 0.5) {
      childComp.durationMs = donorComp.durationMs;
    }
    if (Math.random() < 0.5) {
      childComp.delayMs = donorComp.delayMs;
    }
    if (Math.random() < 0.3) {
      childComp.iterationCount = donorComp.iterationCount;
    }
    if (Math.random() < 0.3) {
      childComp.direction = donorComp.direction;
    }
    if (Math.random() < 0.3) {
      childComp.keyframes = JSON.parse(JSON.stringify(donorComp.keyframes));
    }
  }
  return child;
}

/** Tournament selection: pick the best from a random subset. */
function tournamentSelect(population: Individual[], size: number): Individual {
  let best: Individual | null = null;
  for (let i = 0; i < size; i++) {
    const candidate = population[Math.floor(Math.random() * population.length)];
    if (!best || candidate.fitness.total > best.fitness.total) {
      best = candidate;
    }
  }
  return best!;
}

// --- Main evolution loop ---

/**
 * Evolve a motion spec across multiple generations.
 *
 * @param seedSpec The initial spec to evolve from
 * @param partialConfig Optional configuration overrides
 * @returns The evolution result with the best individual and full history
 */
export function evolveMotion(seedSpec: MotionSpec, partialConfig?: Partial<EvolutionConfig>): EvolutionResult {
  const config: EvolutionConfig = {
    ...DEFAULT_CONFIG,
    ...partialConfig,
    targets: { ...DEFAULT_CONFIG.targets, ...partialConfig?.targets },
  };

  const history: GenerationSummary[] = [];
  const allPreviousSpecs: MotionSpec[] = [];

  // --- Generation 0: seed population ---
  let population: Individual[] = [];
  const seedFitness = evaluateFitness(seedSpec, config);
  population.push({
    id: "ind-0-0",
    generation: 0,
    spec: seedSpec,
    fitness: seedFitness,
    parents: [],
    origin: "seed",
  });

  // Fill the rest of the population with mutations of the seed
  for (let i = 1; i < config.populationSize; i++) {
    const mutated = mutate(seedSpec, config.mutationRate);
    const fitness = evaluateFitness(mutated, config);
    population.push({
      id: `ind-0-${i}`,
      generation: 0,
      spec: mutated,
      fitness,
      parents: ["seed"],
      origin: "mutation",
    });
  }

  allPreviousSpecs.push(seedSpec);

  // Record generation 0
  const gen0Fitnesses = population.map((p) => p.fitness.total);
  history.push({
    generation: 0,
    bestFitness: Math.max(...gen0Fitnesses),
    averageFitness: gen0Fitnesses.reduce((a, b) => a + b, 0) / gen0Fitnesses.length,
    worstFitness: Math.min(...gen0Fitnesses),
    diversity: computePopulationDiversity(population),
    improvements: 0,
  });

  // --- Evolution loop ---
  for (let gen = 1; gen <= config.generations; gen++) {
    // Sort by fitness descending
    population.sort((a, b) => b.fitness.total - a.fitness.total);

    const nextGen: Individual[] = [];

    // Elitism: carry over the best individuals unchanged
    for (let i = 0; i < config.eliteCount && i < population.length; i++) {
      nextGen.push({
        ...population[i],
        id: `ind-${gen}-${i}`,
        generation: gen,
        origin: "elite",
      });
    }

    // Fill the rest with crossover and mutation
    while (nextGen.length < config.populationSize) {
      const parentA = tournamentSelect(population, config.tournamentSize);
      let offspringSpec: MotionSpec;

      if (Math.random() < config.crossoverRate && population.length > 1) {
        const parentB = tournamentSelect(population, config.tournamentSize);
        offspringSpec = crossover(parentA.spec, parentB.spec);
      } else {
        offspringSpec = parentA.spec;
      }

      // Always apply some mutation
      offspringSpec = mutate(offspringSpec, config.mutationRate);

      const fitness = evaluateFitness(offspringSpec, config, allPreviousSpecs.slice(-5));
      nextGen.push({
        id: `ind-${gen}-${nextGen.length}`,
        generation: gen,
        spec: offspringSpec,
        fitness,
        parents: [parentA.id],
        origin: Math.random() < config.crossoverRate ? "crossover" : "mutation",
      });
    }

    population = nextGen;
    allPreviousSpecs.push(...population.map((p) => p.spec));

    // Record generation stats
    const fitnesses = population.map((p) => p.fitness.total);
    const prevBest = history[history.length - 1].bestFitness;
    const currBest = Math.max(...fitnesses);
    history.push({
      generation: gen,
      bestFitness: currBest,
      averageFitness: fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length,
      worstFitness: Math.min(...fitnesses),
      diversity: computePopulationDiversity(population),
      improvements: currBest > prevBest ? currBest - prevBest : 0,
    });
  }

  // Sort final population by fitness
  population.sort((a, b) => b.fitness.total - a.fitness.total);
  const best = population[0];
  const seedScore = seedFitness.total;
  const improvement = best.fitness.total - seedScore;

  const summary = formatEvolutionSummary(history, best, seedScore, improvement);

  return {
    best,
    population,
    history,
    config,
    improvement,
    summary,
  };
}

/** Compute population diversity as the average pairwise distance. */
function computePopulationDiversity(population: Individual[]): number {
  if (population.length < 2) return 0;
  let totalDist = 0;
  let pairs = 0;
  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      totalDist += 1 - computeSpecSimilarity(population[i].spec, population[j].spec);
      pairs++;
    }
  }
  return pairs > 0 ? totalDist / pairs : 0;
}

/** Format a human-readable evolution summary. */
export function formatEvolutionSummary(
  history: GenerationSummary[],
  best: Individual,
  seedScore: number,
  improvement: number,
): string {
  const lines: string[] = [];
  lines.push(`Evolution complete: ${history.length - 1} generations.`);
  lines.push(`Seed fitness: ${seedScore} → Best fitness: ${best.fitness.total} (Δ${improvement > 0 ? "+" : ""}${improvement})`);
  lines.push(`Best individual from generation ${best.generation} via ${best.origin}.`);
  lines.push(`Fitness breakdown — Principles: ${best.fitness.principles}/30, Accessibility: ${best.fitness.accessibility}/20, Performance: ${best.fitness.performance}/20, Harmony: ${best.fitness.harmony}/20, Novelty: ${best.fitness.novelty}/10`);

  // Show generation progression
  const progression = history.map((g) => `G${g.generation}:${g.bestFitness}`).join(" → ");
  lines.push(`Progression: ${progression}`);

  // Show notable improvements
  const improvements = history.filter((g) => g.improvements > 0);
  if (improvements.length > 0) {
    lines.push(`Improvements in ${improvements.length} generation(s).`);
  }

  // Show diversity
  const finalDiversity = history[history.length - 1].diversity;
  lines.push(`Final population diversity: ${(finalDiversity * 100).toFixed(1)}%`);

  if (best.fitness.breakdown.length > 0) {
    lines.push(`Notable traits: ${best.fitness.breakdown.slice(0, 3).join("; ")}`);
  }

  return lines.join("\n");
}

/** List available evolution strategies. */
export function listEvolutionStrategies(): Array<{ id: string; name: string; description: string }> {
  return [
    {
      id: "balanced",
      name: "Balanced Evolution",
      description: "Equal weight across principles, accessibility, performance, and harmony. Good default for general motion.",
    },
    {
      id: "playful",
      name: "Playful Evolution",
      description: "Rewards bounce/elastic easings, variety, and staggered timing. Higher mutation rate for creative exploration.",
    },
    {
      id: "accessible",
      name: "Accessible Evolution",
      description: "Penalizes fast durations and infinite loops. Prioritizes accessibility and clarity.",
    },
    {
      id: "performant",
      name: "Performant Evolution",
      description: "Rewards simpler easings, fewer keyframes, and shorter durations. Optimizes for rendering performance.",
    },
    {
      id: "harmonious",
      name: "Harmonious Evolution",
      description: "Rewards consistent timing, easing families, and coordinated stagger. Creates cohesive multi-element motion.",
    },
  ];
}

/** Get an evolution config preset by strategy ID. */
export function getEvolutionConfig(strategyId: string): EvolutionConfig {
  const base = { ...DEFAULT_CONFIG };
  switch (strategyId) {
    case "playful":
      return {
        ...base,
        mutationRate: 0.5,
        populationSize: 16,
        targets: { ...base.targets, rewardEasingVariety: true, rewardStagger: true, durationRange: [300, 1500] },
      };
    case "accessible":
      return {
        ...base,
        mutationRate: 0.25,
        targets: { ...base.targets, penalizeInfiniteLoops: true, durationRange: [500, 3000] },
      };
    case "performant":
      return {
        ...base,
        mutationRate: 0.3,
        targets: { ...base.targets, maxKeyframes: 6, durationRange: [200, 1000] },
      };
    case "harmonious":
      return {
        ...base,
        mutationRate: 0.2,
        crossoverRate: 0.85,
        targets: { ...base.targets, rewardEasingVariety: false, rewardStagger: true, durationRange: [600, 1500] },
      };
    default:
      return base;
  }
}
