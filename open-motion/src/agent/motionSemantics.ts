/**
 * Motion Semantics Engine — translates abstract concepts and emotions into
 * concrete motion parameters.
 *
 * This is an original AI-native module that bridges the gap between intent
 * and execution. When a user says "make it feel trustworthy" or "add a sense
 * of urgency", the engine maps these abstract semantic concepts to specific
 * easing curves, durations, transforms, colors, and choreography patterns.
 *
 * Six core capabilities:
 * 1. Concept resolution — maps semantic concepts (trust, urgency, luxury,
 *    playfulness, etc.) to motion DNA profiles.
 * 2. Emotion synthesis — generates motion parameters from emotional targets
 *    (valence + arousal pairs from Russell's circumplex model).
 * 3. Brand DNA encoding — translates brand attributes into a coordinated
 *    motion identity that can be applied across components.
 * 4. Semantic diff — compares two motion compositions and describes the
 *    perceptual difference in natural language.
 * 5. Concept blending — merges two concepts into a hybrid motion profile
 *    (e.g., "playful luxury" = bounce + smooth + gold).
 * 6. Intent inference — analyzes a natural language description and infers
 *    the most likely semantic concepts the user wants to express.
 *
 * Rule-based — no LLM round-trip required.
 */

import type { Easing, EasingPreset } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A semantic concept with its motion DNA profile. */
export interface SemanticConcept {
  /** Concept id, e.g. "trust", "urgency". */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Category: emotion, brand, energy, aesthetic. */
  category: "emotion" | "brand" | "energy" | "aesthetic";
  /** The motion DNA this concept maps to. */
  profile: MotionProfile;
  /** Keywords that signal this concept in natural language. */
  keywords: string[];
  /** Description of how this concept manifests in motion. */
  description: string;
}

/** A concrete motion parameter profile derived from a concept. */
export interface MotionProfile {
  /** Recommended easing preset names. */
  easings: string[];
  /** Recommended duration range in ms. */
  durationRange: { min: number; max: number };
  /** Recommended delay pattern. */
  delayStrategy: "none" | "short-stagger" | "long-stagger" | "cascading";
  /** Recommended stagger step in ms (if staggered). */
  staggerMs: number;
  /** Recommended transform tendencies. */
  transforms: string[];
  /** Recommended color palette (hex codes). */
  palette: string[];
  /** Recommended iteration behavior. */
  iteration: "once" | "loop" | "alternate";
  /** Energy level 0..1. */
  energy: number;
  /** Warmth level 0..1. */
  warmth: number;
  /** Smoothness level 0..1. */
  smoothness: number;
}

/** An emotional target using Russell's circumplex model. */
export interface EmotionalTarget {
  /** Valence: -1 (unpleasant) to 1 (pleasant). */
  valence: number;
  /** Arousal: 0 (calm) to 1 (excited). */
  arousal: number;
  /** Optional label for the emotion. */
  label?: string;
}

/** Result of concept blending. */
export interface BlendedConcept {
  /** The blended profile. */
  profile: MotionProfile;
  /** How the blend was computed. */
  recipe: string;
  /** The source concepts. */
  sources: string[];
}

/** Semantic difference between two compositions. */
export interface SemanticDiff {
  /** Overall semantic distance (0..1). 0 = identical, 1 = opposite. */
  distance: number;
  /** Dimensions that differ. */
  dimensions: Array<{
    name: string;
    fromValue: string;
    toValue: string;
    delta: number;
  }>;
  /** Natural language description of the difference. */
  description: string;
}

/** Inferred intent from natural language. */
export interface InferredIntent {
  /** Top matched concepts, ranked by confidence. */
  concepts: Array<{
    conceptId: string;
    conceptLabel: string;
    confidence: number;
    matchedKeywords: string[];
  }>;
  /** Inferred emotional target. */
  emotion: EmotionalTarget;
  /** Suggested motion profile. */
  suggestedProfile: MotionProfile;
  /** Summary of the inference. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Semantic Concept Library
// ---------------------------------------------------------------------------

const CONCEPTS: SemanticConcept[] = [
  {
    id: "trust",
    label: "Trust",
    category: "emotion",
    profile: {
      easings: ["smooth", "soft", "ease-out"],
      durationRange: { min: 800, max: 1500 },
      delayStrategy: "short-stagger",
      staggerMs: 120,
      transforms: ["scale", "opacity", "translateY"],
      palette: ["#1a1a1a", "#404040", "#0a7c8c", "#e8e8e8"],
      iteration: "once",
      energy: 0.3,
      warmth: 0.7,
      smoothness: 0.9,
    },
    keywords: ["trust", "reliable", "dependable", "stable", "secure", "confident", "信", "稳", "可靠"],
    description: "Slow, smooth motions with gentle scaling — conveys stability and reliability.",
  },
  {
    id: "urgency",
    label: "Urgency",
    category: "emotion",
    profile: {
      easings: ["snappy", "ease-in", "sharp"],
      durationRange: { min: 200, max: 600 },
      delayStrategy: "none",
      staggerMs: 0,
      transforms: ["scale", "translateX", "opacity"],
      palette: ["#ff0000", "#ff6600", "#1a1a1a", "#ffffff"],
      iteration: "once",
      energy: 0.95,
      warmth: 0.2,
      smoothness: 0.2,
    },
    keywords: ["urgent", "rush", "fast", "now", "quick", "emergency", "alert", "紧急", "快", "立即"],
    description: "Fast, sharp motions with high contrast — creates immediate attention and action.",
  },
  {
    id: "luxury",
    label: "Luxury",
    category: "brand",
    profile: {
      easings: ["smooth", "ease-in-out", "soft"],
      durationRange: { min: 1200, max: 2500 },
      delayStrategy: "long-stagger",
      staggerMs: 300,
      transforms: ["opacity", "scale", "translateY"],
      palette: ["#0a0a0a", "#1a1a1a", "#c4a35a", "#f5f5f5", "#8b6914"],
      iteration: "once",
      energy: 0.2,
      warmth: 0.6,
      smoothness: 0.95,
    },
    keywords: ["luxury", "premium", "elegant", "sophisticated", "refined", "exclusive", "奢华", "高端", "精致"],
    description: "Slow, refined motions with gold accents — communicates exclusivity and quality.",
  },
  {
    id: "playful",
    label: "Playful",
    category: "brand",
    profile: {
      easings: ["bounce", "elastic", "back"],
      durationRange: { min: 400, max: 1000 },
      delayStrategy: "short-stagger",
      staggerMs: 80,
      transforms: ["scale", "rotate", "translateY", "translateX"],
      palette: ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a8e6cf", "#c7b3ff"],
      iteration: "alternate",
      energy: 0.85,
      warmth: 0.8,
      smoothness: 0.3,
    },
    keywords: ["playful", "fun", "joy", "happy", "cheerful", "lively", "bouncy", "有趣", "快乐", "活泼"],
    description: "Bouncy, varied motions with bright colors — evokes joy and energy.",
  },
  {
    id: "innovation",
    label: "Innovation",
    category: "brand",
    profile: {
      easings: ["ease-out", "smooth", "snappy"],
      durationRange: { min: 500, max: 900 },
      delayStrategy: "cascading",
      staggerMs: 100,
      transforms: ["scale", "opacity", "translateY", "rotate"],
      palette: ["#0066ff", "#00ccff", "#0a0a0a", "#ffffff", "#1a1a2e"],
      iteration: "once",
      energy: 0.7,
      warmth: 0.5,
      smoothness: 0.7,
    },
    keywords: ["innovation", "innovative", "future", "tech", "modern", "cutting-edge", "创新", "未来", "科技"],
    description: "Precise, cascading motions with blue tones — signals forward-thinking technology.",
  },
  {
    id: "calm",
    label: "Calm",
    category: "emotion",
    profile: {
      easings: ["smooth", "soft", "ease-in-out"],
      durationRange: { min: 1500, max: 3000 },
      delayStrategy: "long-stagger",
      staggerMs: 250,
      transforms: ["opacity", "translateY", "scale"],
      palette: ["#e8f4f8", "#c3e0e8", "#a8c8d8", "#7ab0c4", "#f5f5f5"],
      iteration: "alternate",
      energy: 0.15,
      warmth: 0.7,
      smoothness: 0.95,
    },
    keywords: ["calm", "peaceful", "serene", "gentle", "relaxed", "tranquil", "安静", "平静", "宁静"],
    description: "Slow, gentle motions with soft colors — induces relaxation and peace.",
  },
  {
    id: "energy",
    label: "Energy",
    category: "energy",
    profile: {
      easings: ["snappy", "ease-in", "bounce"],
      durationRange: { min: 300, max: 700 },
      delayStrategy: "short-stagger",
      staggerMs: 60,
      transforms: ["scale", "translateY", "rotate", "translateX"],
      palette: ["#ff3300", "#ff9900", "#ffcc00", "#1a1a1a", "#ffffff"],
      iteration: "loop",
      energy: 0.9,
      warmth: 0.6,
      smoothness: 0.3,
    },
    keywords: ["energy", "energetic", "dynamic", "active", "vibrant", "powerful", "活力", "动力", "充满能量"],
    description: "Fast, powerful motions with warm accents — radiates vitality and drive.",
  },
  {
    id: "mystery",
    label: "Mystery",
    category: "aesthetic",
    profile: {
      easings: ["ease-in", "ease-in-out"],
      durationRange: { min: 800, max: 1800 },
      delayStrategy: "long-stagger",
      staggerMs: 200,
      transforms: ["opacity", "translateZ", "rotateY", "scale"],
      palette: ["#0a0a1a", "#1a0a2a", "#2a1a3a", "#4a2a6a", "#8a6aaa"],
      iteration: "once",
      energy: 0.4,
      warmth: 0.2,
      smoothness: 0.6,
    },
    keywords: ["mystery", "mysterious", "enigmatic", "dark", "intriguing", "secret", "神秘", "深邃"],
    description: "Slow reveals with depth transforms and dark purple tones — creates intrigue.",
  },
  {
    id: "minimal",
    label: "Minimal",
    category: "aesthetic",
    profile: {
      easings: ["smooth", "ease-out"],
      durationRange: { min: 300, max: 600 },
      delayStrategy: "none",
      staggerMs: 0,
      transforms: ["opacity", "translateY"],
      palette: ["#0a0a0a", "#404040", "#808080", "#c0c0c0", "#ffffff"],
      iteration: "once",
      energy: 0.3,
      warmth: 0.4,
      smoothness: 0.85,
    },
    keywords: ["minimal", "clean", "simple", "subtle", "understated", "pure", "极简", "简洁", "干净"],
    description: "Short, subtle motions with monochrome palette — emphasizes content over decoration.",
  },
  {
    id: "celebration",
    label: "Celebration",
    category: "emotion",
    profile: {
      easings: ["bounce", "elastic", "back"],
      durationRange: { min: 600, max: 1200 },
      delayStrategy: "cascading",
      staggerMs: 100,
      transforms: ["scale", "rotate", "translateY", "translateX", "opacity"],
      palette: ["#ffd700", "#ff6b6b", "#4ecdc4", "#ffe66d", "#ff8c42", "#c7b3ff"],
      iteration: "alternate",
      energy: 0.95,
      warmth: 0.9,
      smoothness: 0.2,
    },
    keywords: ["celebrate", "celebration", "party", "festive", "confetti", "joy", "triumph", "庆祝", "胜利", "狂欢"],
    description: "Explosive, colorful motions with cascading timing — expresses joy and achievement.",
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** List all available semantic concepts. */
export function listSemanticConcepts(): SemanticConcept[] {
  return [...CONCEPTS];
}

/** Get a concept by id. */
export function getSemanticConcept(id: string): SemanticConcept | undefined {
  return CONCEPTS.find((c) => c.id === id);
}

/** Find concepts matching a keyword. */
export function findConceptsByKeyword(keyword: string): SemanticConcept[] {
  const lower = keyword.toLowerCase();
  return CONCEPTS.filter((c) =>
    c.keywords.some((k) => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase())),
  );
}

/** Synthesize a motion profile from an emotional target. */
export function synthesizeFromEmotion(target: EmotionalTarget): MotionProfile {
  // Map valence/arousal to motion parameters
  const v = target.valence; // -1..1
  const a = target.arousal; // 0..1

  // High arousal → bounce/elastic, low arousal → smooth/soft
  const easings = a > 0.7 ? ["bounce", "elastic", "back"] :
    a > 0.4 ? ["ease-out", "snappy", "smooth"] :
    ["smooth", "soft", "ease-in-out"];

  // High arousal → short duration, low arousal → long duration
  const durationMax = Math.round(3000 - a * 2500);
  const durationMin = Math.round(durationMax * 0.3);

  // Positive valence → warm colors, negative → cool/dark
  const warmth = (v + 1) / 2; // 0..1
  const palette = v > 0.3 ?
    ["#ff6b6b", "#ffe66d", "#4ecdc4", "#ffffff", "#0a0a0a"] :
    v < -0.3 ?
    ["#0a0a1a", "#1a1a2a", "#4a4a6a", "#8a8aaa", "#ffffff"] :
    ["#404040", "#808080", "#c0c0c0", "#ffffff", "#0a0a0a"];

  const staggerMs = a > 0.6 ? 80 : 200;
  const delayStrategy: MotionProfile["delayStrategy"] =
    a > 0.7 ? "short-stagger" :
    a > 0.3 ? "cascading" : "long-stagger";

  return {
    easings,
    durationRange: { min: durationMin, max: durationMax },
    delayStrategy,
    staggerMs,
    transforms: a > 0.6 ?
      ["scale", "rotate", "translateY", "translateX"] :
      ["opacity", "scale", "translateY"],
    palette,
    iteration: a > 0.7 ? "alternate" : "once",
    energy: a,
    warmth,
    smoothness: 1 - a * 0.7,
  };
}

/** Blend two concepts into a hybrid profile. */
export function blendConcepts(idA: string, idB: string, weightA = 0.5): BlendedConcept {
  const a = getSemanticConcept(idA);
  const b = getSemanticConcept(idB);
  if (!a || !b) {
    throw new Error(`Unknown concept: ${!a ? idA : idB}`);
  }
  const wB = 1 - weightA;

  const blendEase = Math.random() < weightA ? a.profile.easings[0] : b.profile.easings[0];
  const blended: MotionProfile = {
    easings: [blendEase, ...new Set([...a.profile.easings, ...b.profile.easings])].slice(0, 3),
    durationRange: {
      min: Math.round(a.profile.durationRange.min * weightA + b.profile.durationRange.min * wB),
      max: Math.round(a.profile.durationRange.max * weightA + b.profile.durationRange.max * wB),
    },
    delayStrategy: weightA > 0.5 ? a.profile.delayStrategy : b.profile.delayStrategy,
    staggerMs: Math.round(a.profile.staggerMs * weightA + b.profile.staggerMs * wB),
    transforms: [...new Set([...a.profile.transforms, ...b.profile.transforms])].slice(0, 4),
    palette: [...new Set([...a.profile.palette.slice(0, 3), ...b.profile.palette.slice(0, 3)])].slice(0, 5),
    iteration: weightA > 0.5 ? a.profile.iteration : b.profile.iteration,
    energy: a.profile.energy * weightA + b.profile.energy * wB,
    warmth: a.profile.warmth * weightA + b.profile.warmth * wB,
    smoothness: a.profile.smoothness * weightA + b.profile.smoothness * wB,
  };

  const recipe = `${Math.round(weightA * 100)}% ${a.label} + ${Math.round(wB * 100)}% ${b.label}`;

  return {
    profile: blended,
    recipe,
    sources: [idA, idB],
  };
}

/** Compare two motion profiles and describe the semantic difference. */
export function diffProfiles(from: MotionProfile, to: MotionProfile): SemanticDiff {
  const dimensions: SemanticDiff["dimensions"] = [];
  let totalDelta = 0;

  // Energy
  const energyDelta = Math.abs(to.energy - from.energy);
  dimensions.push({
    name: "Energy",
    fromValue: from.energy.toFixed(2),
    toValue: to.energy.toFixed(2),
    delta: energyDelta,
  });
  totalDelta += energyDelta;

  // Warmth
  const warmthDelta = Math.abs(to.warmth - from.warmth);
  dimensions.push({
    name: "Warmth",
    fromValue: from.warmth.toFixed(2),
    toValue: to.warmth.toFixed(2),
    delta: warmthDelta,
  });
  totalDelta += warmthDelta;

  // Smoothness
  const smoothDelta = Math.abs(to.smoothness - from.smoothness);
  dimensions.push({
    name: "Smoothness",
    fromValue: from.smoothness.toFixed(2),
    toValue: to.smoothness.toFixed(2),
    delta: smoothDelta,
  });
  totalDelta += smoothDelta;

  // Duration
  const fromAvgDur = (from.durationRange.min + from.durationRange.max) / 2;
  const toAvgDur = (to.durationRange.min + to.durationRange.max) / 2;
  const durDelta = Math.abs(toAvgDur - fromAvgDur) / 3000;
  dimensions.push({
    name: "Duration",
    fromValue: `${Math.round(fromAvgDur)}ms`,
    toValue: `${Math.round(toAvgDur)}ms`,
    delta: durDelta,
  });
  totalDelta += durDelta;

  const distance = Math.min(1, totalDelta / 4);

  // Description
  const parts: string[] = [];
  if (to.energy > from.energy + 0.2) parts.push("more energetic");
  else if (to.energy < from.energy - 0.2) parts.push("calmer");
  if (to.warmth > from.warmth + 0.2) parts.push("warmer");
  else if (to.warmth < from.warmth - 0.2) parts.push("cooler");
  if (to.smoothness > from.smoothness + 0.2) parts.push("smoother");
  else if (to.smoothness < from.smoothness - 0.2) parts.push("sharper");
  if (toAvgDur < fromAvgDur - 300) parts.push("faster");
  else if (toAvgDur > fromAvgDur + 300) parts.push("slower");

  const description = parts.length > 0
    ? `The motion becomes ${parts.join(", ")}.`
    : "The motion is semantically similar — minimal perceptual difference.";

  return { distance, dimensions, description };
}

/** Infer semantic intent from a natural language description. */
export function inferIntent(description: string): InferredIntent {
  const lower = description.toLowerCase();
  const matched: Array<{
    concept: SemanticConcept;
    matchedKeywords: string[];
    score: number;
  }> = [];

  for (const concept of CONCEPTS) {
    const matchedKeywords: string[] = [];
    let score = 0;
    for (const kw of concept.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        matchedKeywords.push(kw);
        score += kw.length > 3 ? 2 : 1;
      }
    }
    if (score > 0) {
      matched.push({ concept, matchedKeywords, score });
    }
  }

  matched.sort((a, b) => b.score - a.score);

  const concepts = matched.slice(0, 5).map((m) => ({
    conceptId: m.concept.id,
    conceptLabel: m.concept.label,
    confidence: Math.min(1, m.score / 5),
    matchedKeywords: m.matchedKeywords,
  }));

  // Infer emotional target from matched concepts
  let valence = 0;
  let arousal = 0.5;
  if (matched.length > 0) {
    valence = matched[0].concept.profile.warmth * 2 - 1;
    arousal = matched[0].concept.profile.energy;
  }
  const emotion: EmotionalTarget = { valence, arousal };

  // Build suggested profile from top concepts
  let suggestedProfile: MotionProfile;
  if (matched.length >= 2) {
    const blend = blendConcepts(
      matched[0].concept.id,
      matched[1].concept.id,
      0.6,
    );
    suggestedProfile = blend.profile;
  } else if (matched.length === 1) {
    suggestedProfile = matched[0].concept.profile;
  } else {
    suggestedProfile = synthesizeFromEmotion(emotion);
  }

  const summary = matched.length > 0
    ? `Detected ${matched[0].concept.label.toLowerCase()} intent${matched.length > 1 ? ` blended with ${matched[1].concept.label.toLowerCase()}` : ""}.`
    : "No specific semantic concept detected — using neutral motion profile.";

  return {
    concepts,
    emotion,
    suggestedProfile,
    summary,
  };
}

/** Convert a motion profile to an easing object. */
export function profileToEasing(profile: MotionProfile): Easing {
  const name = (profile.easings[0] ?? "smooth") as EasingPreset;
  return { type: "preset", name };
}

/** Format a motion profile for display. */
export function formatProfile(profile: MotionProfile): string {
  const lines: string[] = [];
  lines.push(`Easings: ${profile.easings.join(", ")}`);
  lines.push(`Duration: ${profile.durationRange.min}-${profile.durationRange.max}ms`);
  lines.push(`Stagger: ${profile.staggerMs}ms (${profile.delayStrategy})`);
  lines.push(`Transforms: ${profile.transforms.join(", ")}`);
  lines.push(`Palette: ${profile.palette.join(", ")}`);
  lines.push(`Iteration: ${profile.iteration}`);
  lines.push(`Energy: ${(profile.energy * 100).toFixed(0)}%`);
  lines.push(`Warmth: ${(profile.warmth * 100).toFixed(0)}%`);
  lines.push(`Smoothness: ${(profile.smoothness * 100).toFixed(0)}%`);
  return lines.join("\n");
}
