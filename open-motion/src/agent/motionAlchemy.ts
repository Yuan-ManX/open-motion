/** Motion Alchemy Engine — interprets motion through alchemical transformation. */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An alchemical stage detected in the composition. */
export interface AlchemyStage {
  /** Stage name. */
  name: "nigredo" | "albedo" | "citrinitas" | "rubedo";
  /** Latin title. */
  latinTitle: string;
  /** Common name. */
  commonName: string;
  /** Time range in ms. */
  startMs: number;
  endMs: number;
  /** Component IDs active in this stage. */
  componentIds: string[];
  /** Intensity 0..1 (how strongly this stage manifests). */
  intensity: number;
  /** Transformation description. */
  transformation: string;
  /** Symbolic meaning. */
  symbolism: string;
}

/** An alchemical operation performed on the composition. */
export interface AlchemicalOperation {
  /** Operation name. */
  name: "calcination" | "dissolution" | "separation" | "conjunction" | "fermentation" | "distillation" | "coagulation" | "sublimation";
  /** Description of what the operation does. */
  description: string;
  /** Which components are affected. */
  componentIds: string[];
  /** Potency 0..1. */
  potency: number;
}

/** The prima materia (raw material) analysis. */
export interface PrimaMateria {
  /** Raw element count. */
  elementCount: number;
  /** Elemental composition. */
  elements: Array<{ element: "earth" | "water" | "air" | "fire" | "aether"; proportion: number; description: string }>;
  /** Raw state description. */
  state: "chaotic" | "formless" | "primitive" | "raw" | "virgin";
  /** Description. */
  description: string;
}

/** The philosopher's stone (final transmutation). */
export interface PhilosophersStone {
  /** Whether the stone was achieved. */
  achieved: boolean;
  /** Completion percentage 0..1. */
  completion: number;
  /** Quality of the stone. */
  quality: "base" | "common" | "noble" | "philosopher's" | "universal";
  /** The gift/boon the stone provides. */
  gift: string;
  /** Description. */
  description: string;
}

/** Hermes principle (as above, so below). */
export interface HermesPrinciple {
  /** Macrocosm (the whole composition) description. */
  macrocosm: string;
  /** Microcosm (a representative component) description. */
  microcosm: string;
  /** Resonance between macro and micro 0..1. */
  resonance: number;
  /** Description. */
  description: string;
}

/** Full alchemy analysis result. */
export interface AlchemyAnalysis {
  /** Detected stages in temporal order. */
  stages: AlchemyStage[];
  /** Alchemical operations performed. */
  operations: AlchemicalOperation[];
  /** Prima materia analysis. */
  primaMateria: PrimaMateria;
  /** Philosopher's stone analysis. */
  philosophersStone: PhilosophersStone;
  /** Hermes principle analysis. */
  hermesPrinciple: HermesPrinciple;
  /** Overall transmutation progress 0..1. */
  transmutationProgress: number;
  /** Dominant element. */
  dominantElement: "earth" | "water" | "air" | "fire" | "aether";
  /** Crucible temperature (intensity) 0..1. */
  crucibleTemperature: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Compute the intensity of a component based on its properties. */
function componentIntensity(comp: MotionComponent): number {
  let intensity = 0;
  // Duration contributes (longer = more intense)
  intensity += Math.min(1, comp.durationMs / 3000) * 0.2;
  // Iteration count contributes
  const iter = comp.iterationCount === "infinite" ? 5 : Math.min(5, comp.iterationCount ?? 1);
  intensity += (iter / 5) * 0.2;
  // Keyframe count contributes
  const kfCount = comp.keyframes?.length ?? 0;
  intensity += Math.min(1, kfCount / 6) * 0.3;
  // Easing type contributes
  const easing = comp.easing;
  if (easing && typeof easing === "object") {
    if (easing.type === "spring") intensity += 0.3;
    else if (easing.type === "preset") {
      const energetic = ["bounce", "elastic", "snappy"];
      if (energetic.includes(easing.name as string)) intensity += 0.25;
      else intensity += 0.1;
    }
  }
  return Math.min(1, intensity);
}

/** Classify the elemental nature of a component. */
function classifyElement(comp: MotionComponent): "earth" | "water" | "air" | "fire" | "aether" {
  const intensity = componentIntensity(comp);
  const duration = comp.durationMs;
  const hasFade = comp.keyframes?.some((kf) => {
    const props = kf.properties as Record<string, string | number>;
    return "opacity" in props;
  }) ?? false;
  const hasScale = comp.keyframes?.some((kf) => {
    const props = kf.properties as Record<string, string | number>;
    return "scale" in props;
  }) ?? false;
  const hasRotate = comp.keyframes?.some((kf) => {
    const props = kf.properties as Record<string, string | number>;
    return "rotate" in props;
  }) ?? false;
  const hasTranslate = comp.keyframes?.some((kf) => {
    const props = kf.properties as Record<string, string | number>;
    return "translateX" in props || "translateY" in props;
  }) ?? false;

  // Fire: high intensity, rotation, fast
  if (intensity > 0.6 && hasRotate && duration < 1500) return "fire";
  // Air: fade, low duration, translate
  if (hasFade && (hasTranslate || duration < 1000)) return "air";
  // Water: long duration, smooth flow, scale
  if (duration > 2000 && hasScale) return "water";
  // Earth: long duration, stable, no dramatic motion
  if (duration > 1500 && intensity < 0.5) return "earth";
  // Aether: spring easing (transcends physical)
  const easing = comp.easing;
  if (easing && typeof easing === "object" && easing.type === "spring") return "aether";
  // Default
  return intensity > 0.5 ? "fire" : "earth";
}

/** Detect the alchemical stage of a component based on its timeline position and properties. */
function detectComponentStage(comp: MotionComponent, timelineStart: number, timelineEnd: number): AlchemyStage["name"] {
  const timelineDuration = timelineEnd - timelineStart;
  if (timelineDuration <= 0) return "nigredo";

  const componentStart = comp.delayMs - timelineStart;
  const componentMid = componentStart + comp.durationMs / 2;
  const relativePos = componentMid / timelineDuration;

  // Check properties for stage indicators
  const hasFadeOut = comp.keyframes?.some((kf) => {
    const props = kf.properties as Record<string, string | number>;
    return "opacity" in props && typeof props.opacity === "number" && props.opacity === 0;
  }) ?? false;
  const hasFadeIn = comp.keyframes?.some((kf) => {
    const props = kf.properties as Record<string, string | number>;
    const next = kf.offset > 0;
    return "opacity" in props && typeof props.opacity === "number" && props.opacity === 0 && !next;
  }) ?? false;

  // Nigredo: beginning, fade out (death/decomposition), or low opacity
  if (relativePos < 0.25 || hasFadeOut) return "nigredo";
  // Albedo: early-mid, fade in (purification, emergence from darkness)
  if (relativePos < 0.5 || hasFadeIn) return "albedo";
  // Citrinitas: mid-late, peak intensity (golden moment, awakening)
  if (relativePos < 0.75) return "citrinitas";
  // Rubedo: end, completion (final synthesis)
  return "rubedo";
}

// ---------------------------------------------------------------------------
// Main Analysis
// ---------------------------------------------------------------------------

/** Analyze the prima materia (raw material) of the composition. */
function analyzePrimaMateria(spec: MotionSpec): PrimaMateria {
  const elementCounts = new Map<string, number>();
  for (const comp of spec.components) {
    const el = classifyElement(comp);
    elementCounts.set(el, (elementCounts.get(el) ?? 0) + 1);
  }

  const total = spec.components.length || 1;
  const elements: PrimaMateria["elements"] = [];
  const elementDescriptions: Record<string, string> = {
    earth: "solid, stable, foundational motion — the material substrate",
    water: "flowing, fluid, adaptive motion — emotional and connective",
    air: "light, ephemeral, transparent motion — communicative and swift",
    fire: "energetic, transformative, intense motion — passionate and catalytic",
    aether: "transcendent, spring-driven motion — the spiritual quintessence",
  };

  for (const [el, count] of elementCounts) {
    elements.push({
      element: el as PrimaMateria["elements"][0]["element"],
      proportion: count / total,
      description: elementDescriptions[el] ?? "unknown element",
    });
  }

  elements.sort((a, b) => b.proportion - a.proportion);

  const elementCount = spec.components.length;
  let state: PrimaMateria["state"] = "raw";
  if (elementCount === 0) state = "formless";
  else if (elementCount <= 2) state = "primitive";
  else if (elementCount <= 5) state = "raw";
  else if (elementCount <= 10) state = "chaotic";
  else state = "virgin";

  const description = `Prima materia: ${elementCount} element(s), state=${state}, ` +
    `dominant element=${elements[0]?.element ?? "none"} (${((elements[0]?.proportion ?? 0) * 100).toFixed(0)}%)`;

  return { elementCount, elements, state, description };
}

/** Detect the alchemical stages present in the composition. */
function detectStages(spec: MotionSpec): AlchemyStage[] {
  if (spec.components.length === 0) return [];

  const timelineStart = Math.min(...spec.components.map((c) => c.delayMs));
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));

  const stageComponents = new Map<AlchemyStage["name"], MotionComponent[]>();
  for (const comp of spec.components) {
    const stage = detectComponentStage(comp, timelineStart, timelineEnd);
    const arr = stageComponents.get(stage) ?? [];
    arr.push(comp);
    stageComponents.set(stage, arr);
  }

  const stageInfo: Record<AlchemyStage["name"], { latin: string; common: string; transformation: string; symbolism: string }> = {
    nigredo: {
      latin: "Nigredo",
      common: "Blackening",
      transformation: "Decomposition and calcination — the old form breaks down, impurities burn away",
      symbolism: "Death of the old self, the dark night of the soul, the void before creation",
    },
    albedo: {
      latin: "Albedo",
      common: "Whitening",
      transformation: "Purification and ablution — the essence is washed clean, clarity emerges from darkness",
      symbolism: "Dawn after the dark night, the purified soul, the white tincture",
    },
    citrinitas: {
      latin: "Citrinitas",
      common: "Yellowing",
      transformation: "Awakening and solarization — the golden essence crystallizes, the sun rises within",
      symbolism: "The golden dawn, solar consciousness, the coagulating wisdom",
    },
    rubedo: {
      latin: "Rubedo",
      common: "Reddening",
      transformation: "Completion and coniunctio — the final synthesis, the union of opposites, the stone is born",
      symbolism: "The philosopher's stone, the red tincture, the completed great work",
    },
  };

  const stages: AlchemyStage[] = [];
  const stageOrder: AlchemyStage["name"][] = ["nigredo", "albedo", "citrinitas", "rubedo"];

  for (const stageName of stageOrder) {
    const components = stageComponents.get(stageName);
    if (!components || components.length === 0) continue;

    const startMs = Math.min(...components.map((c) => c.delayMs));
    const endMs = Math.max(...components.map((c) => c.delayMs + c.durationMs));
    const avgIntensity = components.reduce((sum, c) => sum + componentIntensity(c), 0) / components.length;
    const info = stageInfo[stageName];

    stages.push({
      name: stageName,
      latinTitle: info.latin,
      commonName: info.common,
      startMs,
      endMs,
      componentIds: components.map((c) => c.id),
      intensity: avgIntensity,
      transformation: info.transformation,
      symbolism: info.symbolism,
    });
  }

  return stages;
}

/** Detect alchemical operations performed on the composition. */
function detectOperations(spec: MotionSpec): AlchemicalOperation[] {
  const operations: AlchemicalOperation[] = [];

  for (const comp of spec.components) {
    const hasFadeOut = comp.keyframes?.some((kf) => {
      const props = kf.properties as Record<string, string | number>;
      return "opacity" in props && typeof props.opacity === "number" && props.opacity === 0 && kf.offset > 0;
    }) ?? false;
    const hasFadeIn = comp.keyframes?.some((kf) => {
      const props = kf.properties as Record<string, string | number>;
      return "opacity" in props && typeof props.opacity === "number" && props.opacity === 0 && kf.offset === 0;
    }) ?? false;
    const hasScale = comp.keyframes?.some((kf) => {
      const props = kf.properties as Record<string, string | number>;
      return "scale" in props;
    }) ?? false;
    const hasRotate = comp.keyframes?.some((kf) => {
      const props = kf.properties as Record<string, string | number>;
      return "rotate" in props;
    }) ?? false;
    const easing = comp.easing;
    const isSpring = easing && typeof easing === "object" && easing.type === "spring";

    // Calcination: burning away (fade out)
    if (hasFadeOut) {
      operations.push({
        name: "calcination",
        description: `${comp.name ?? comp.id}: calcination — the form is burned away, reducing to essence`,
        componentIds: [comp.id],
        potency: 0.8,
      });
    }
    // Dissolution: dissolving boundaries (fade in from nothing)
    if (hasFadeIn) {
      operations.push({
        name: "dissolution",
        description: `${comp.name ?? comp.id}: dissolution — boundaries dissolve, the form emerges from the void`,
        componentIds: [comp.id],
        potency: 0.7,
      });
    }
    // Separation: distinguishing elements (scale change)
    if (hasScale) {
      operations.push({
        name: "separation",
        description: `${comp.name ?? comp.id}: separation — the subtle is distinguished from the gross through scale`,
        componentIds: [comp.id],
        potency: 0.6,
      });
    }
    // Conjunction: joining opposites (rotation - circular union)
    if (hasRotate) {
      operations.push({
        name: "conjunction",
        description: `${comp.name ?? comp.id}: conjunction — opposites are united in the rotating wheel`,
        componentIds: [comp.id],
        potency: 0.65,
      });
    }
    // Fermentation: new life begins (spring easing)
    if (isSpring) {
      operations.push({
        name: "fermentation",
        description: `${comp.name ?? comp.id}: fermentation — new life ferments, the spark of transformation ignites`,
        componentIds: [comp.id],
        potency: 0.85,
      });
    }
    // Sublimation: rising to a higher state (long duration + intensity)
    if (comp.durationMs > 2000 && componentIntensity(comp) > 0.5) {
      operations.push({
        name: "sublimation",
        description: `${comp.name ?? comp.id}: sublimation — the material rises to a higher, subtler state`,
        componentIds: [comp.id],
        potency: 0.75,
      });
    }
    // Coagulation: final solidification (last component in timeline)
    const isLast = spec.components.every((c) => c.delayMs + c.durationMs <= comp.delayMs + comp.durationMs);
    if (isLast && spec.components.length > 1) {
      operations.push({
        name: "coagulation",
        description: `${comp.name ?? comp.id}: coagulation — the final form solidifies, the stone is fixed`,
        componentIds: [comp.id],
        potency: 0.9,
      });
    }
    // Distillation: purification through repetition
    const iter = comp.iterationCount === "infinite" ? 100 : comp.iterationCount ?? 1;
    if (iter > 3) {
      operations.push({
        name: "distillation",
        description: `${comp.name ?? comp.id}: distillation — repeated cycles purify the essence (${iter} iterations)`,
        componentIds: [comp.id],
        potency: Math.min(1, iter / 20),
      });
    }
  }

  return operations;
}

/** Analyze the philosopher's stone (final transmutation result). */
function analyzePhilosophersStone(spec: MotionSpec, stages: AlchemyStage[]): PhilosophersStone {
  const stageCount = stages.length;
  const hasAllStages = stageCount === 4;
  const completion = stageCount / 4;

  let quality: PhilosophersStone["quality"] = "base";
  if (completion >= 1) quality = "universal";
  else if (completion >= 0.75) quality = "philosopher's";
  else if (completion >= 0.5) quality = "noble";
  else if (completion >= 0.25) quality = "common";

  const gifts = [
    "the elixir of life — motion that renews itself through infinite iteration",
    "the universal solvent — motion that dissolves all rigidity",
    "the tincture of transformation — motion that transmutes the base into the noble",
    "the panacea — motion that heals all dissonance and restores harmony",
    "the quintessence — motion that unites earth, water, air, fire, and aether",
  ];
  const giftIndex = Math.min(gifts.length - 1, Math.floor(completion * gifts.length));

  const description = `Philosopher's Stone: ${quality} quality, completion ${(completion * 100).toFixed(0)}%, ` +
    `${stageCount}/4 stages present${hasAllStages ? " — the magnum opus is complete" : " — the great work continues"}`;

  return {
    achieved: hasAllStages,
    completion,
    quality,
    gift: gifts[giftIndex],
    description,
  };
}

/** Analyze the Hermes principle (as above, so below). */
function analyzeHermesPrinciple(spec: MotionSpec): HermesPrinciple {
  if (spec.components.length === 0) {
    return {
      macrocosm: "The void — no composition to mirror",
      microcosm: "The void — no component to reflect",
      resonance: 0,
      description: "No components — the hermetic principle cannot be observed.",
    };
  }

  // Macrocosm: the whole composition
  const totalDuration = spec.components.reduce((max, c) => Math.max(max, c.delayMs + c.durationMs), 0);
  const avgIntensity = spec.components.reduce((sum, c) => sum + componentIntensity(c), 0) / spec.components.length;
  const macrocosm = `The whole (${spec.components.length} components, ${totalDuration}ms, intensity ${(avgIntensity * 100).toFixed(0)}%)`;

  // Microcosm: the most representative component (median intensity)
  const sorted = [...spec.components].sort((a, b) => componentIntensity(a) - componentIntensity(b));
  const representative = sorted[Math.floor(sorted.length / 2)];
  const repIntensity = componentIntensity(representative);
  const microcosm = `The part (${representative.name ?? representative.id}, ${representative.durationMs}ms, intensity ${(repIntensity * 100).toFixed(0)}%)`;

  // Resonance: how closely the part reflects the whole
  const durationResonance = 1 - Math.min(1, Math.abs(representative.durationMs - totalDuration / spec.components.length) / 2000);
  const intensityResonance = 1 - Math.abs(repIntensity - avgIntensity);
  const resonance = (durationResonance + intensityResonance) / 2;

  const description = `Hermes principle: macrocosm=${macrocosm}, microcosm=${microcosm}, ` +
    `resonance ${(resonance * 100).toFixed(0)}% — "as above, so below"`;

  return { macrocosm, microcosm, resonance, description };
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Analyze a motion composition through the alchemical lens.
 *
 * Interprets the composition as a magnum opus (great work) — a sequence of
 * transmutational stages from prima materia to philosopher's stone.
 */
export function analyzeAlchemy(spec: MotionSpec): AlchemyAnalysis {
  if (spec.components.length === 0) {
    return {
      stages: [],
      operations: [],
      primaMateria: {
        elementCount: 0,
        elements: [],
        state: "formless",
        description: "Prima materia: the void — no elements to transmute",
      },
      philosophersStone: {
        achieved: false,
        completion: 0,
        quality: "base",
        gift: "No gift — the great work has not begun",
        description: "Philosopher's Stone: not achieved — the crucible is empty",
      },
      hermesPrinciple: {
        macrocosm: "The void",
        microcosm: "The void",
        resonance: 0,
        description: "No components — the hermetic principle is dormant.",
      },
      transmutationProgress: 0,
      dominantElement: "earth",
      crucibleTemperature: 0,
      summary: "No components — the alchemical crucible is empty.",
    };
  }

  const stages = detectStages(spec);
  const operations = detectOperations(spec);
  const primaMateria = analyzePrimaMateria(spec);
  const philosophersStone = analyzePhilosophersStone(spec, stages);
  const hermesPrinciple = analyzeHermesPrinciple(spec);

  const dominantElement = primaMateria.elements[0]?.element ?? "earth";
  const crucibleTemperature = spec.components.reduce((sum, c) => sum + componentIntensity(c), 0) / spec.components.length;
  const transmutationProgress = philosophersStone.completion;

  const summary = `Alchemy: ${stages.length}/4 stages (${stages.map((s) => s.latinTitle).join("→") || "none"}), ` +
    `${operations.length} operation(s), element=${dominantElement}, ` +
    `transmutation ${(transmutationProgress * 100).toFixed(0)}%, ` +
    `crucible ${(crucibleTemperature * 100).toFixed(0)}%, ` +
    `stone=${philosophersStone.quality}`;

  return {
    stages,
    operations,
    primaMateria,
    philosophersStone,
    hermesPrinciple,
    transmutationProgress,
    dominantElement,
    crucibleTemperature,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format an alchemy analysis as a human-readable report. */
export function formatAlchemyReport(analysis: AlchemyAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Alchemy Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  // Stages
  lines.push("## Magnum Opus — Stages of Transformation");
  if (analysis.stages.length === 0) {
    lines.push("- No stages detected — the great work has not begun");
  } else {
    for (const stage of analysis.stages) {
      lines.push(`- [${stage.latinTitle}] ${stage.commonName} (${stage.startMs}-${stage.endMs}ms, ${stage.componentIds.length} element(s), intensity ${(stage.intensity * 100).toFixed(0)}%)`);
      lines.push(`  - Transformation: ${stage.transformation}`);
      lines.push(`  - Symbolism: ${stage.symbolism}`);
    }
  }
  lines.push("");

  // Prima Materia
  lines.push("## Prima Materia — The Raw Material");
  lines.push(`- State: ${analysis.primaMateria.state}`);
  lines.push(`- Elements: ${analysis.primaMateria.elements.length > 0 ? analysis.primaMateria.elements.map((e) => `${e.element} (${(e.proportion * 100).toFixed(0)}%)`).join(", ") : "none"}`);
  lines.push("");

  // Operations
  lines.push("## Alchemical Operations");
  if (analysis.operations.length === 0) {
    lines.push("- No operations detected");
  } else {
    for (const op of analysis.operations) {
      lines.push(`- ${op.name} (potency ${(op.potency * 100).toFixed(0)}%): ${op.description}`);
    }
  }
  lines.push("");

  // Hermes Principle
  lines.push("## Hermes Principle — As Above, So Below");
  lines.push(`- Macrocosm: ${analysis.hermesPrinciple.macrocosm}`);
  lines.push(`- Microcosm: ${analysis.hermesPrinciple.microcosm}`);
  lines.push(`- Resonance: ${(analysis.hermesPrinciple.resonance * 100).toFixed(0)}%`);
  lines.push("");

  // Philosopher's Stone
  lines.push("## Philosopher's Stone — The Final Transmutation");
  lines.push(`- Achieved: ${analysis.philosophersStone.achieved ? "yes" : "no"}`);
  lines.push(`- Quality: ${analysis.philosophersStone.quality}`);
  lines.push(`- Completion: ${(analysis.philosophersStone.completion * 100).toFixed(0)}%`);
  lines.push(`- Gift: ${analysis.philosophersStone.gift}`);
  lines.push("");

  lines.push(`## Crucible`);
  lines.push(`- Temperature: ${(analysis.crucibleTemperature * 100).toFixed(0)}%`);
  lines.push(`- Dominant Element: ${analysis.dominantElement}`);
  lines.push(`- Transmutation Progress: ${(analysis.transmutationProgress * 100).toFixed(0)}%`);

  return lines.join("\n");
}
