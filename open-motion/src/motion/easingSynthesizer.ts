/**
 * Smart Easing Curve Synthesizer — maps semantic descriptions (natural language
 * adjectives for motion feel) to precise cubic-bezier control points or spring
 * physics parameters.
 *
 * The synthesizer understands a vocabulary of motion qualities:
 * weighty, featherlight, snappy, dramatic, playful, elegant, organic,
 * mechanical, bouncy, heavy, light, energetic, calm, aggressive, gentle.
 *
 * Each quality maps to specific bezier control points or spring constants
 * that produce the described feel when applied to an animation.
 */

import type { Easing } from "@openmotion/shared";

export interface EasingSynthesisResult {
  description: string;
  detectedQualities: string[];
  easing: Easing;
  cssString: string;
  rationale: string;
}

interface QualityProfile {
  keywords: RegExp;
  qualities: string[];
  bezier: { p1: [number, number]; p2: [number, number] };
  spring?: { stiffness: number; damping: number; mass: number };
  rationale: string;
}

const QUALITY_PROFILES: QualityProfile[] = [
  {
    keywords: /\b(weighty|heavy|solid|massive|substantial|dense|ponderous)\b/i,
    qualities: ["weighty", "heavy"],
    bezier: { p1: [0.34, 1.56], p2: [0.64, 1] },
    spring: { stiffness: 120, damping: 14, mass: 1.5 },
    rationale: "High mass with moderate damping — the motion builds momentum slowly, overshoots slightly, and settles with gravitational weight.",
  },
  {
    keywords: /\b(featherlight|feather|airy|weightless|floating|delicate|gossamer)\b/i,
    qualities: ["featherlight", "airy"],
    bezier: { p1: [0.25, 0.1], p2: [0.25, 1] },
    spring: { stiffness: 80, damping: 20, mass: 0.3 },
    rationale: "Low mass with gentle damping — the motion drifts effortlessly, barely touching the extremes before settling.",
  },
  {
    keywords: /\b(snappy|crisp|sharp|precise|tight|brisk|punchy)\b/i,
    qualities: ["snappy", "precise"],
    bezier: { p1: [0.95, 0.05], p2: [0.795, 0.035] },
    spring: { stiffness: 400, damping: 30, mass: 1 },
    rationale: "High stiffness with strong damping — the motion snaps to position quickly and decisively with minimal overshoot.",
  },
  {
    keywords: /\b(dramatic|bold|powerful|intense|strong|theatrical|cinematic)\b/i,
    qualities: ["dramatic", "bold"],
    bezier: { p1: [0.7, 0], p2: [0.3, 1] },
    spring: { stiffness: 200, damping: 8, mass: 1.2 },
    rationale: "Strong initial acceleration with a long deceleration — the motion commands attention with a wide dynamic range.",
  },
  {
    keywords: /\b(playful|fun|cheerful|lively|bouncy|springy|energetic)\b/i,
    qualities: ["playful", "bouncy"],
    bezier: { p1: [0.68, -0.55], p2: [0.265, 1.55] },
    spring: { stiffness: 260, damping: 12, mass: 1 },
    rationale: "Low damping with high stiffness — the motion bounces past the target multiple times with joyful energy.",
  },
  {
    keywords: /\b(elegant|graceful|refined|sophisticated|smooth|polished|classy)\b/i,
    qualities: ["elegant", "smooth"],
    bezier: { p1: [0.25, 0.1], p2: [0.25, 1] },
    spring: { stiffness: 150, damping: 22, mass: 1 },
    rationale: "Balanced stiffness and damping — the motion flows with restrained confidence, never rushing or overshooting.",
  },
  {
    keywords: /\b(organic|natural|living|breathing|alive|flowing)\b/i,
    qualities: ["organic", "natural"],
    bezier: { p1: [0.4, 0.0], p2: [0.2, 1] },
    spring: { stiffness: 170, damping: 18, mass: 1 },
    rationale: "Moderate spring physics with natural damping — the motion mimics living tissue with subtle settling.",
  },
  {
    keywords: /\b(mechanical|robotic|precise|industrial|steampunk|machine)\b/i,
    qualities: ["mechanical", "precise"],
    bezier: { p1: [0.9, 0.02], p2: [0.9, 0.02] },
    rationale: "Near-linear acceleration and deceleration — the motion moves with mechanical precision, no organic softness.",
  },
  {
    keywords: /\b(bouncy|bounce|spring|elastic|rubber|rubbery)\b/i,
    qualities: ["bouncy", "elastic"],
    bezier: { p1: [0.68, -0.3], p2: [0.32, 1.4] },
    spring: { stiffness: 300, damping: 10, mass: 1 },
    rationale: "Very low damping with high stiffness — the motion overshoots significantly and oscillates with elastic energy.",
  },
  {
    keywords: /\b(calm|peaceful|serene|gentle|soft|tranquil|meditative)\b/i,
    qualities: ["calm", "gentle"],
    bezier: { p1: [0.4, 0.0], p2: [0.6, 1] },
    spring: { stiffness: 100, damping: 25, mass: 1 },
    rationale: "Low stiffness with high damping — the motion unfolds slowly and settles without disturbance.",
  },
  {
    keywords: /\b(aggressive|forceful|violent|explosive|rapid|sudden)\b/i,
    qualities: ["aggressive", "explosive"],
    bezier: { p1: [0.95, 0.0], p2: [0.1, 0.5] },
    spring: { stiffness: 500, damping: 15, mass: 0.8 },
    rationale: "Very high stiffness with moderate damping — the motion launches explosively and decelerates hard.",
  },
  {
    keywords: /\b(energetic|dynamic|vibrant|active|vigorous|spirited)\b/i,
    qualities: ["energetic", "dynamic"],
    bezier: { p1: [0.5, 1.5], p2: [0.5, 0.9] },
    spring: { stiffness: 280, damping: 14, mass: 0.9 },
    rationale: "High energy with controlled overshoot — the motion is lively and dynamic without being chaotic.",
  },
  {
    keywords: /\b(light|quick|swift|nimble|agile|fast)\b/i,
    qualities: ["light", "quick"],
    bezier: { p1: [0.0, 0.0], p2: [0.2, 1] },
    spring: { stiffness: 220, damping: 20, mass: 0.5 },
    rationale: "Low mass with moderate stiffness — the motion moves swiftly and settles cleanly without heaviness.",
  },
];

/**
 * Synthesize an easing curve from a natural language description.
 * Detects quality keywords and maps them to precise bezier/spring parameters.
 */
export function synthesizeEasing(
  description: string,
  format: "bezier" | "spring" | "css" = "bezier",
): EasingSynthesisResult {
  const detected: string[] = [];
  let matchedProfile: QualityProfile | null = null;

  for (const profile of QUALITY_PROFILES) {
    if (profile.keywords.test(description)) {
      detected.push(...profile.qualities);
      if (!matchedProfile) matchedProfile = profile;
    }
  }

  if (!matchedProfile) {
    const fallback: Easing = { type: "bezier", p1: [0.25, 0.1], p2: [0.25, 1] };
    return {
      description,
      detectedQualities: [],
      easing: fallback,
      cssString: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      rationale: "No specific quality keywords detected — using a balanced ease-in-out curve as fallback.",
    };
  }

  let easing: Easing;
  let cssString: string;

  if (format === "spring" && matchedProfile.spring) {
    easing = {
      type: "spring",
      stiffness: matchedProfile.spring.stiffness,
      damping: matchedProfile.spring.damping,
      mass: matchedProfile.spring.mass,
    };
    cssString = `spring(stiffness=${matchedProfile.spring.stiffness}, damping=${matchedProfile.spring.damping}, mass=${matchedProfile.spring.mass})`;
  } else {
    const { p1, p2 } = matchedProfile.bezier;
    easing = { type: "bezier", p1, p2 };
    cssString = `cubic-bezier(${p1[0]}, ${p1[1]}, ${p2[0]}, ${p2[1]})`;
  }

  return {
    description,
    detectedQualities: detected.length > 0 ? [...new Set(detected)] : matchedProfile.qualities,
    easing,
    cssString,
    rationale: matchedProfile.rationale,
  };
}

/**
 * List all available quality profiles for discovery and documentation.
 */
export function listEasingQualities(): Array<{
  name: string;
  keywords: string[];
  bezierP1: [number, number];
  bezierP2: [number, number];
  hasSpring: boolean;
}> {
  return QUALITY_PROFILES.map((p) => ({
    name: p.qualities[0],
    keywords: p.keywords.source.replace(/\\b|\[|\]|\(|\)|\||\//g, " ").trim().split(/\s+/).filter(Boolean),
    bezierP1: p.bezier.p1,
    bezierP2: p.bezier.p2,
    hasSpring: !!p.spring,
  }));
}
