/**
 * Motion Dream Engine — generative creativity for novel motion concepts.
 *
 * This original AI-native module produces "dream-like" motion variations by
 * combining unrelated concepts through surrealist techniques. It enables
 * designers to explore motion possibilities beyond conventional patterns
 * through procedural generation and concept blending.
 *
 * Core techniques:
 * - Concept Juxtaposition: combine distant concepts to spark new ideas
 * - Procedural Generation: rule-based synthesis of novel motion patterns
 * - Mutation Operators: apply creative transformations to existing motion
 * - Dream Logic: associative chains that traverse the motion concept space
 * - Emergent Composition: combine multiple generators for surprising results
 *
 * Rule-based — no LLM round-trip required.
 */

import type { Keyframe } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { draft, kf, type ComponentDraft } from "../motion/templates/helper.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A dream concept used as a seed for generation. */
export interface DreamConcept {
  /** Concept id. */
  id: string;
  /** Concept name. */
  name: string;
  /** Concept category. */
  category: "natural" | "mechanical" | "abstract" | "organic" | "cosmic" | "temporal" | "emotional";
  /** Associated motion parameters. */
  parameters: DreamMotionParams;
  /** Trigger words that evoke this concept. */
  triggerWords: string[];
}

export interface DreamMotionParams {
  /** Duration range [min, max] in ms. */
  durationRange: [number, number];
  /** Easing preset. */
  easing: string;
  /** Keyframe pattern. */
  pattern: "wave" | "spiral" | "burst" | "drift" | "pulse" | "orbit" | "shatter" | "fold";
  /** Transform types. */
  transforms: string[];
  /** Color palette. */
  palette: string[];
  /** Intensity 0-1. */
  intensity: number;
}

/** A generated dream motion. */
export interface DreamMotion {
  /** Generated component draft. */
  component: ComponentDraft;
  /** Source concepts that influenced this dream. */
  sourceConcepts: string[];
  /** Generation technique used. */
  technique: string;
  /** Creative description. */
  description: string;
  /** Novelty score 0-1. */
  novelty: number;
}

/** A dream sequence — multiple dream motions composed together. */
export interface DreamSequence {
  /** Sequence title. */
  title: string;
  /** Motions in the sequence. */
  motions: DreamMotion[];
  /** Narrative thread. */
  narrative: string;
  /** Overall novelty. */
  novelty: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Concept Library
// ---------------------------------------------------------------------------

export const DREAM_CONCEPTS: DreamConcept[] = [
  {
    id: "tide",
    name: "Tide",
    category: "natural",
    parameters: {
      durationRange: [3000, 6000],
      easing: "ease-in-out",
      pattern: "wave",
      transforms: ["translateY", "scaleX"],
      palette: ["#1a3a5c", "#2d5a87", "#4a90c2"],
      intensity: 0.4,
    },
    triggerWords: ["tide", "wave", "ocean", "water", "sea", "潮", "海"],
  },
  {
    id: "crystal",
    name: "Crystal",
    category: "abstract",
    parameters: {
      durationRange: [800, 1500],
      easing: "snappy",
      pattern: "shatter",
      transforms: ["scale", "rotate", "skewX"],
      palette: ["#e8f4f8", "#a8d8ea", "#7fb3d5"],
      intensity: 0.7,
    },
    triggerWords: ["crystal", "glass", "shard", "prism", "水晶", "棱镜"],
  },
  {
    id: "smoke",
    name: "Smoke",
    category: "organic",
    parameters: {
      durationRange: [2500, 4500],
      easing: "soft",
      pattern: "drift",
      transforms: ["translateY", "translateX", "scale", "opacity"],
      palette: ["#2a2a2a", "#4a4a4a", "#6a6a6a"],
      intensity: 0.3,
    },
    triggerWords: ["smoke", "mist", "fog", "vapor", "烟", "雾"],
  },
  {
    id: "firework",
    name: "Firework",
    category: "temporal",
    parameters: {
      durationRange: [600, 1200],
      easing: "ease-out",
      pattern: "burst",
      transforms: ["scale", "opacity", "translateX", "translateY"],
      palette: ["#ff6b6b", "#ffd93d", "#6bcf7f"],
      intensity: 0.9,
    },
    triggerWords: ["firework", "explosion", "burst", "spark", "烟花", "爆炸"],
  },
  {
    id: "orbit",
    name: "Orbit",
    category: "cosmic",
    parameters: {
      durationRange: [2000, 4000],
      easing: "linear",
      pattern: "orbit",
      transforms: ["rotate", "translateX", "translateY"],
      palette: ["#0f0f1e", "#4a5bc7", "#7c8ff0"],
      intensity: 0.5,
    },
    triggerWords: ["orbit", "planet", "cosmic", "galaxy", "轨道", "星"],
  },
  {
    id: "origami",
    name: "Origami",
    category: "mechanical",
    parameters: {
      durationRange: [1200, 2500],
      easing: "snappy",
      pattern: "fold",
      transforms: ["skewX", "skewY", "scaleX", "scaleY", "rotate"],
      palette: ["#f7f1e3", "#d4c5a0", "#a89968"],
      intensity: 0.6,
    },
    triggerWords: ["origami", "fold", "paper", "crease", "折纸", "折叠"],
  },
  {
    id: "pulse",
    name: "Pulse",
    category: "abstract",
    parameters: {
      durationRange: [800, 1600],
      easing: "ease-in-out",
      pattern: "pulse",
      transforms: ["scale", "opacity"],
      palette: ["#ff4757", "#ff6b81", "#ee5a6f"],
      intensity: 0.8,
    },
    triggerWords: ["pulse", "heartbeat", "rhythm", "throb", "脉冲", "心跳"],
  },
  {
    id: "spiral",
    name: "Spiral",
    category: "abstract",
    parameters: {
      durationRange: [1500, 3000],
      easing: "ease-in-out",
      pattern: "spiral",
      transforms: ["rotate", "scale", "translateX", "translateY"],
      palette: ["#9b59b6", "#8e44ad", "#bdc3c7"],
      intensity: 0.6,
    },
    triggerWords: ["spiral", "vortex", "whirl", "swirl", "螺旋", "漩涡"],
  },
  {
    id: "aurora",
    name: "Aurora",
    category: "natural",
    parameters: {
      durationRange: [4000, 8000],
      easing: "linear",
      pattern: "drift",
      transforms: ["opacity", "translateX", "skewX"],
      palette: ["#0abdc6", "#ea580c", "#7101ff"],
      intensity: 0.5,
    },
    triggerWords: ["aurora", "borealis", "northern lights", "极光"],
  },
  {
    id: "neuron",
    name: "Neuron",
    category: "organic",
    parameters: {
      durationRange: [500, 1500],
      easing: "elastic",
      pattern: "pulse",
      transforms: ["scale", "opacity", "filter"],
      palette: ["#00ff88", "#00cc66", "#006633"],
      intensity: 0.7,
    },
    triggerWords: ["neuron", "synapse", "nerve", "brain", "神经元", "突触"],
  },
];

// ---------------------------------------------------------------------------
// Generation Techniques
// ---------------------------------------------------------------------------

/** Find concepts matching a prompt. */
export function findConcepts(prompt: string): DreamConcept[] {
  const lower = prompt.toLowerCase();
  return DREAM_CONCEPTS.filter((c) =>
    c.triggerWords.some((w) => lower.includes(w.toLowerCase())),
  );
}

/** Pick a random concept. */
function randomConcept(): DreamConcept {
  return DREAM_CONCEPTS[Math.floor(Math.random() * DREAM_CONCEPTS.length)];
}

/** Pick two distinct concepts for juxtaposition. */
export function pickTwoConcepts(): [DreamConcept, DreamConcept] {
  const idx1 = Math.floor(Math.random() * DREAM_CONCEPTS.length);
  let idx2 = Math.floor(Math.random() * DREAM_CONCEPTS.length);
  while (idx2 === idx1) idx2 = Math.floor(Math.random() * DREAM_CONCEPTS.length);
  return [DREAM_CONCEPTS[idx1], DREAM_CONCEPTS[idx2]];
}

/** Generate a random duration within a range. */
function randomDuration(range: [number, number]): number {
  return Math.round(range[0] + Math.random() * (range[1] - range[0]));
}

/** Build keyframes for a pattern. */
function buildKeyframes(pattern: DreamMotionParams["pattern"], transforms: string[], intensity: number): Keyframe[] {
  const kfs: Keyframe[] = [];

  switch (pattern) {
    case "wave":
      kfs.push(
        kf(0, { opacity: 0.4, [transforms[0]]: 0 }),
        kf(0.25, { opacity: 0.8, [transforms[0]]: 20 * intensity }),
        kf(0.5, { opacity: 1, [transforms[0]]: 0 }),
        kf(0.75, { opacity: 0.8, [transforms[0]]: -20 * intensity }),
        kf(1, { opacity: 0.4, [transforms[0]]: 0 }),
      );
      break;
    case "spiral":
      kfs.push(
        kf(0, { rotate: 0, scale: 0.5, opacity: 0 }),
        kf(0.5, { rotate: 180, scale: 1, opacity: 1 }),
        kf(1, { rotate: 360, scale: 0.5, opacity: 0 }),
      );
      break;
    case "burst":
      kfs.push(
        kf(0, { scale: 0, opacity: 1 }),
        kf(0.5, { scale: 1.5 * intensity, opacity: 0.8 }),
        kf(1, { scale: 2 * intensity, opacity: 0 }),
      );
      break;
    case "drift":
      kfs.push(
        kf(0, { opacity: 0, translateY: 0, scale: 0.5 }),
        kf(0.3, { opacity: 0.6, translateY: -30 * intensity, scale: 0.8 }),
        kf(0.7, { opacity: 0.4, translateY: -60 * intensity, scale: 1.0 }),
        kf(1, { opacity: 0, translateY: -100 * intensity, scale: 1.2 }),
      );
      break;
    case "pulse":
      kfs.push(
        kf(0, { scale: 1, opacity: 0.8 }),
        kf(0.5, { scale: 1 + 0.3 * intensity, opacity: 1 }),
        kf(1, { scale: 1, opacity: 0.8 }),
      );
      break;
    case "orbit":
      kfs.push(
        kf(0, { rotate: 0, translateX: 50, translateY: 0 }),
        kf(0.25, { rotate: 90, translateX: 0, translateY: 50 }),
        kf(0.5, { rotate: 180, translateX: -50, translateY: 0 }),
        kf(0.75, { rotate: 270, translateX: 0, translateY: -50 }),
        kf(1, { rotate: 360, translateX: 50, translateY: 0 }),
      );
      break;
    case "shatter":
      kfs.push(
        kf(0, { scale: 1, rotate: 0, opacity: 1 }),
        kf(0.3, { scale: 1.1, rotate: 5 * intensity, opacity: 0.9 }),
        kf(0.6, { scale: 0.8, rotate: -10 * intensity, opacity: 0.5 }),
        kf(1, { scale: 0.3, rotate: 30 * intensity, opacity: 0 }),
      );
      break;
    case "fold":
      kfs.push(
        kf(0, { skewX: 0, scaleY: 1, rotate: 0 }),
        kf(0.5, { skewX: 30 * intensity, scaleY: 0.5, rotate: 90 }),
        kf(1, { skewX: 0, scaleY: 1, rotate: 0 }),
      );
      break;
  }

  return kfs;
}

// ---------------------------------------------------------------------------
// Dream Generators
// ---------------------------------------------------------------------------

/**
 * Generate a dream motion from a single concept.
 */
export function dreamFromConcept(concept: DreamConcept): DreamMotion {
  const params = concept.parameters;
  const durationMs = randomDuration(params.durationRange);
  const keyframes = buildKeyframes(params.pattern, params.transforms, params.intensity);
  const bgColor = params.palette[Math.floor(Math.random() * params.palette.length)];

  const component = draft(`${concept.name} Dream`, {
    durationMs,
    easing: easingPreset(params.easing as never),
    iterationCount: "infinite",
    direction: "alternate",
    keyframes,
    style: {
      _content: "",
      _tag: "div",
      width: "200px",
      height: "200px",
      backgroundColor: bgColor,
      borderRadius: "12px",
    },
  });

  return {
    component,
    sourceConcepts: [concept.id],
    technique: "concept-projection",
    description: `A ${concept.name.toLowerCase()} dream — ${params.pattern} pattern with ${params.intensity.toFixed(2)} intensity`,
    novelty: 0.5 + Math.random() * 0.3,
  };
}

/**
 * Generate a dream motion by juxtaposing two distant concepts.
 * This is the core surrealist technique: combining unrelated elements.
 */
export function dreamFromJuxtaposition(conceptA: DreamConcept, conceptB: DreamConcept): DreamMotion {
  const paramsA = conceptA.parameters;
  const paramsB = conceptB.parameters;

  // Blend parameters
  const durationMs = Math.round((randomDuration(paramsA.durationRange) + randomDuration(paramsB.durationRange)) / 2);
  const intensity = (paramsA.intensity + paramsB.intensity) / 2;

  // Choose pattern from the more intense concept
  const pattern = paramsA.intensity > paramsB.intensity ? paramsA.pattern : paramsB.pattern;
  const transforms = [...new Set([...paramsA.transforms, ...paramsB.transforms])].slice(0, 4);

  // Blend palettes
  const blendedPalette = [paramsA.palette[0], paramsB.palette[0], paramsA.palette[1] ?? paramsA.palette[0]];
  const bgColor = blendedPalette[Math.floor(Math.random() * blendedPalette.length)];

  // Choose easing: alternate between the two
  const easing = Math.random() < 0.5 ? paramsA.easing : paramsB.easing;

  const keyframes = buildKeyframes(pattern, transforms, intensity);

  const component = draft(`${conceptA.name}-${conceptB.name} Fusion`, {
    durationMs,
    easing: easingPreset(easing as never),
    iterationCount: "infinite",
    direction: "alternate",
    keyframes,
    style: {
      _content: "",
      _tag: "div",
      width: "240px",
      height: "240px",
      backgroundColor: bgColor,
      borderRadius: "8px",
    },
  });

  return {
    component,
    sourceConcepts: [conceptA.id, conceptB.id],
    technique: "concept-juxtaposition",
    description: `A surrealist fusion of ${conceptA.name.toLowerCase()} and ${conceptB.name.toLowerCase()} — ${pattern} pattern blending both concept spaces`,
    novelty: 0.7 + Math.random() * 0.3,
  };
}

/**
 * Generate a dream motion by mutating an existing concept with a random
 * transformation operator.
 */
export function dreamFromMutation(concept: DreamConcept): DreamMotion {
  const mutations = [
    "time-stretch",
    "intensity-invert",
    "pattern-shift",
    "palette-invert",
    "transform-mirror",
  ];
  const mutation = mutations[Math.floor(Math.random() * mutations.length)];

  const params = { ...concept.parameters };
  let description = `Mutated ${concept.name.toLowerCase()} via ${mutation}`;

  switch (mutation) {
    case "time-stretch":
      params.durationRange = [params.durationRange[0] * 2, params.durationRange[1] * 2];
      description += " — duration doubled for dreamlike slowness";
      break;
    case "intensity-invert":
      params.intensity = 1 - params.intensity;
      description += ` — intensity inverted to ${params.intensity.toFixed(2)}`;
      break;
    case "pattern-shift": {
      const patterns: DreamMotionParams["pattern"][] = ["wave", "spiral", "burst", "drift", "pulse", "orbit", "shatter", "fold"];
      const newPattern = patterns[Math.floor(Math.random() * patterns.length)];
      params.pattern = newPattern;
      description += ` — pattern shifted to ${newPattern}`;
      break;
    }
    case "palette-invert":
      params.palette = params.palette.reverse();
      description += " — palette inverted";
      break;
    case "transform-mirror":
      params.transforms = params.transforms.map((t) =>
        t.startsWith("translate") ? t === "translateX" ? "translateY" : "translateX" : t,
      );
      description += " — transforms mirrored";
      break;
  }

  const durationMs = randomDuration(params.durationRange);
  const keyframes = buildKeyframes(params.pattern, params.transforms, params.intensity);
  const bgColor = params.palette[0];

  const component = draft(`${concept.name} Mutant`, {
    durationMs,
    easing: easingPreset(params.easing as never),
    iterationCount: "infinite",
    direction: "alternate",
    keyframes,
    style: {
      _content: "",
      _tag: "div",
      width: "200px",
      height: "200px",
      backgroundColor: bgColor,
      borderRadius: "16px",
    },
  });

  return {
    component,
    sourceConcepts: [concept.id],
    technique: `mutation:${mutation}`,
    description,
    novelty: 0.6 + Math.random() * 0.4,
  };
}

/**
 * Generate a dream sequence — multiple dream motions composed into a
 * narrative thread.
 */
export function generateDreamSequence(length: number = 3, seed?: string): DreamSequence {
  const concepts = seed ? findConcepts(seed) : [];
  const motions: DreamMotion[] = [];

  for (let i = 0; i < length; i++) {
    const technique = Math.random();
    let motion: DreamMotion;

    if (technique < 0.4) {
      // Single concept
      const concept = concepts[i % concepts.length] ?? randomConcept();
      motion = dreamFromConcept(concept);
    } else if (technique < 0.8) {
      // Juxtaposition
      const [a, b] = concepts.length >= 2
        ? [concepts[i % concepts.length], concepts[(i + 1) % concepts.length]]
        : pickTwoConcepts();
      motion = dreamFromJuxtaposition(a, b);
    } else {
      // Mutation
      const concept = concepts[i % concepts.length] ?? randomConcept();
      motion = dreamFromMutation(concept);
    }

    motions.push(motion);
  }

  // Build narrative thread
  const techniques = [...new Set(motions.map((m) => m.technique))];
  const conceptNames = [...new Set(motions.flatMap((m) => m.sourceConcepts))];
  const narrative = `A dream sequence traversing ${conceptNames.length} concept(s) via ${techniques.length} technique(s): ${techniques.join(", ")}`;

  const avgNovelty = motions.reduce((sum, m) => sum + m.novelty, 0) / motions.length;

  const titles = [
    "Echoes of Motion",
    "Reverie Sequence",
    "Hypnagogic Drift",
    "Lucid Trajectory",
    "Twilight Composition",
    "Subconscious Choreography",
  ];
  const title = titles[Math.floor(Math.random() * titles.length)];

  return {
    title,
    motions,
    narrative,
    novelty: avgNovelty,
    summary: `"${title}" — ${length} motion(s), novelty ${(avgNovelty * 100).toFixed(0)}%, concepts: ${conceptNames.join(", ")}`,
  };
}

/**
 * Generate a dream motion from a natural language prompt.
 */
export function dreamFromPrompt(prompt: string): DreamMotion {
  const concepts = findConcepts(prompt);

  if (concepts.length === 0) {
    // No matching concepts — generate a random juxtaposition
    const [a, b] = pickTwoConcepts();
    return dreamFromJuxtaposition(a, b);
  }

  if (concepts.length === 1) {
    // 50% chance to mutate, 50% to project
    return Math.random() < 0.5
      ? dreamFromMutation(concepts[0])
      : dreamFromConcept(concepts[0]);
  }

  // Multiple concepts — juxtapose the first two
  return dreamFromJuxtaposition(concepts[0], concepts[1]);
}

/** List all available dream concepts. */
export function listDreamConcepts(): DreamConcept[] {
  return DREAM_CONCEPTS;
}

/** Format a dream motion as a human-readable report. */
export function formatDreamReport(motion: DreamMotion): string {
  const lines: string[] = [
    "Motion Dream Report",
    "===================",
    "",
    `Technique: ${motion.technique}`,
    `Source Concepts: ${motion.sourceConcepts.join(", ")}`,
    `Novelty: ${(motion.novelty * 100).toFixed(0)}%`,
    `Description: ${motion.description}`,
  ];
  return lines.join("\n");
}

/** Format a dream sequence as a human-readable report. */
export function formatDreamSequenceReport(sequence: DreamSequence): string {
  const lines: string[] = [
    "Dream Sequence Report",
    "=====================",
    "",
    `Title: ${sequence.title}`,
    `Novelty: ${(sequence.novelty * 100).toFixed(0)}%`,
    `Motions: ${sequence.motions.length}`,
    `Narrative: ${sequence.narrative}`,
    "",
    "Sequence contents:",
  ];

  sequence.motions.forEach((m, i) => {
    lines.push(`  ${i + 1}. [${m.technique}] ${m.description} (novelty: ${(m.novelty * 100).toFixed(0)}%)`);
  });

  lines.push("");
  lines.push(`Summary: ${sequence.summary}`);
  return lines.join("\n");
}
