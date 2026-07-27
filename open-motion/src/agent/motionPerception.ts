/**
 * Motion Perception Predictor — predicts how viewers will cognitively and
 * emotionally respond to a motion composition.
 *
 * This is an original AI-native module that models the VIEWER's perceptual
 * experience rather than the motion itself. Where existing modules analyze
 * what the motion IS, this module predicts what the viewer FEELS and PERCEIVES.
 *
 * Seven core analytics:
 * 1. Emotional valence — predicts positive/negative/neutral emotional response
 *    based on motion energy, color warmth, and easing curvature.
 * 2. Arousal profile — maps the excitement level over time, identifying peaks
 *    and valleys in the viewer's engagement curve.
 * 3. Cognitive load — estimates mental effort required to track the motion,
 *    factoring in simultaneous animations, speed, and complexity.
 * 4. Attention retention — models how long the motion holds attention before
 *    the viewer's mind wanders, based on novelty and variation.
 * 5. Memorability score — predicts how memorable the motion will be, driven by
 *    distinctiveness, emotional peaks, and narrative structure.
 * 6. Brand perception — forecasts how the motion shapes brand perception
 *    (premium, playful, trustworthy, innovative, etc.).
 * 7. Perception summary — a composite report with actionable recommendations
 *    for tuning the motion to achieve desired perceptual outcomes.
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, MotionSpec, Easing } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Predicted emotional valence at a point in time. */
export interface ValencePoint {
  /** Time in ms from start. */
  timeMs: number;
  /** Valence score (-1..1). Negative = unpleasant, positive = pleasant. */
  valence: number;
  /** Contributing factors. */
  drivers: string[];
}

/** Arousal (excitement) level at a point in time. */
export interface ArousalPoint {
  timeMs: number;
  /** Arousal score (0..1). 0 = calm, 1 = maximally exciting. */
  arousal: number;
  /** Label for this arousal level. */
  label: "calm" | "low" | "moderate" | "high" | "peak";
}

/** Cognitive load assessment. */
export interface CognitiveLoad {
  /** Overall load score (0..100). Higher = more mental effort. */
  score: number;
  /** Load category. */
  level: "effortless" | "light" | "moderate" | "heavy" | "overwhelming";
  /** Number of simultaneous animations at peak complexity. */
  peakSimultaneous: number;
  /** Time window with highest cognitive demand. */
  peakWindow: { startMs: number; endMs: number } | null;
  /** Factors driving cognitive load. */
  factors: {
    simultaneousAnimations: number;
    averageSpeed: number;
    complexityScore: number;
    trackingDifficulty: number;
  };
  /** Recommendations to reduce load. */
  recommendations: string[];
}

/** Attention retention curve. */
export interface AttentionCurve {
  /** Sampled attention level over time (0..1). */
  points: Array<{ timeMs: number; attention: number }>;
  /** Estimated time (ms) before attention drops below 50%. */
  halfLifeMs: number;
  /** Estimated time (ms) before attention drops below 20% (disengagement). */
  disengagementMs: number | null;
  /** Whether the motion sustains attention throughout. */
  sustainsAttention: boolean;
}

/** Memorability assessment. */
export interface MemorabilityAssessment {
  /** Memorability score (0..100). */
  score: number;
  /** Level of memorability. */
  level: "forgettable" | "low" | "moderate" | "high" | "unforgettable";
  /** What makes this motion memorable (or not). */
  drivers: {
    distinctiveness: number;
    emotionalPeak: number;
    narrativeStructure: number;
    surpriseElement: number;
    repetitionPattern: number;
  };
  /** Suggested additions to boost memorability. */
  suggestions: string[];
}

/** Brand perception forecast. */
export interface BrandPerception {
  /** Top perceived brand attributes, ranked by strength. */
  attributes: Array<{
    name: string;
    /** Strength score (0..100). */
    strength: number;
    /** Whether this attribute is reinforced or contradicted. */
    direction: "reinforced" | "contradicted";
  }>;
  /** Overall brand personality the motion projects. */
  personality: string;
  /** Confidence in the assessment (0..1). */
  confidence: number;
}

/** Complete perception report. */
export interface PerceptionReport {
  valenceCurve: ValencePoint[];
  arousalCurve: ArousalPoint[];
  cognitiveLoad: CognitiveLoad;
  attention: AttentionCurve;
  memorability: MemorabilityAssessment;
  brand: BrandPerception;
  /** Overall perception score (0..100). */
  overallScore: number;
  /** One-line summary. */
  summary: string;
  /** Top 3 actionable recommendations. */
  topRecommendations: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function profileEasing(easing: Easing): {
  energy: number;
  warmth: number;
  smoothness: number;
} {
  if (easing.type === "preset") {
    const n = easing.name.toLowerCase();
    const energy = /bounce|elastic|back|spring/.test(n) ? 0.9 :
      /ease-in|snappy|sharp/.test(n) ? 0.7 :
      /linear/.test(n) ? 0.5 : 0.4;
    const warmth = /smooth|soft|ease-out|ease-in-out/.test(n) ? 0.8 :
      /linear/.test(n) ? 0.5 : 0.4;
    const smoothness = /smooth|soft|ease-in-out|ease-out/.test(n) ? 0.9 :
      /bounce|elastic|back/.test(n) ? 0.3 : 0.6;
    return { energy, warmth, smoothness };
  }
  if (easing.type === "spring") {
    return { energy: 0.85, warmth: 0.6, smoothness: 0.5 };
  }
  // bezier
  return { energy: 0.6, warmth: 0.6, smoothness: 0.7 };
}

function extractColor(style: Record<string, unknown> | undefined): string | null {
  if (!style) return null;
  const bg = style.backgroundColor;
  const color = style.color;
  return (typeof bg === "string" && bg) || (typeof color === "string" && color) || null;
}

function colorWarmth(color: string | null): number {
  if (!color) return 0.5;
  const hex = color.match(/#([0-9a-f]{6}|[0-9a-f]{3})/i);
  if (!hex) return 0.5;
  let r = 0, g = 0, b = 0;
  const h = hex[1];
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16);
    g = parseInt(h[1] + h[1], 16);
    b = parseInt(h[2] + h[2], 16);
  } else {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
  }
  // Warm colors: red/yellow > green > blue
  return (r * 0.5 + g * 0.3 + (255 - b) * 0.2) / 255;
}

function speedScore(comp: MotionComponent): number {
  const dur = comp.durationMs || 1000;
  // Shorter duration = faster = higher speed score
  return Math.max(0, Math.min(1, 2000 / dur));
}

function complexityScore(comp: MotionComponent): number {
  const keyframeCount = comp.keyframes?.length ?? 0;
  const hasLoop = comp.iterationCount === "infinite" || comp.iterationCount === -1;
  const hasDirection = comp.direction === "alternate" || comp.direction === "alternate-reverse";
  let score = keyframeCount * 0.15;
  if (hasLoop) score += 0.2;
  if (hasDirection) score += 0.1;
  return Math.min(1, score);
}

// ---------------------------------------------------------------------------
// Core analytics
// ---------------------------------------------------------------------------

function computeValenceCurve(spec: MotionSpec): ValencePoint[] {
  const points: ValencePoint[] = [];
  const totalMs = spec.components.reduce(
    (max, c) => Math.max(max, c.delayMs + c.durationMs),
    2000,
  );
  const samples = 10;
  for (let i = 0; i <= samples; i++) {
    const timeMs = Math.round((totalMs * i) / samples);
    let valence = 0;
    const drivers: string[] = [];

    for (const comp of spec.components) {
      const endMs = comp.delayMs + comp.durationMs;
      if (timeMs < comp.delayMs || timeMs > endMs) continue;

      const { energy, warmth, smoothness } = profileEasing(comp.easing);
      const color = extractColor(comp.style as Record<string, unknown> | undefined);
      const cWarmth = colorWarmth(color);

      // Positive valence from warmth and smoothness
      const v = warmth * 0.3 + smoothness * 0.2 + cWarmth * 0.2 - energy * 0.1;
      valence += v;

      if (warmth > 0.7) drivers.push(`${comp.name}: warm easing`);
      if (cWarmth > 0.7) drivers.push(`${comp.name}: warm color`);
      if (energy > 0.7) drivers.push(`${comp.name}: high energy (reduces valence)`);
    }

    // Normalize
    const count = Math.max(1, spec.components.length);
    valence = Math.max(-1, Math.min(1, valence / count));
    points.push({ timeMs, valence, drivers: drivers.slice(0, 3) });
  }
  return points;
}

function computeArousalCurve(spec: MotionSpec): ArousalPoint[] {
  const points: ArousalPoint[] = [];
  const totalMs = spec.components.reduce(
    (max, c) => Math.max(max, c.delayMs + c.durationMs),
    2000,
  );
  const samples = 10;
  for (let i = 0; i <= samples; i++) {
    const timeMs = Math.round((totalMs * i) / samples);
    let arousal = 0;
    let activeCount = 0;

    for (const comp of spec.components) {
      const endMs = comp.delayMs + comp.durationMs;
      if (timeMs < comp.delayMs || timeMs > endMs) continue;
      activeCount++;

      const { energy } = profileEasing(comp.easing);
      const speed = speedScore(comp);
      // Arousal peaks during entrance (first 30% of animation)
      const progress = (timeMs - comp.delayMs) / comp.durationMs;
      const entranceBoost = progress < 0.3 ? 0.3 : 0;

      arousal += energy * 0.4 + speed * 0.3 + entranceBoost;
    }

    arousal = activeCount > 0 ? arousal / activeCount : 0;
    // Scale by number of simultaneous animations
    arousal = Math.min(1, arousal * (1 + activeCount * 0.1));

    const label: ArousalPoint["label"] =
      arousal > 0.8 ? "peak" :
      arousal > 0.6 ? "high" :
      arousal > 0.4 ? "moderate" :
      arousal > 0.2 ? "low" : "calm";

    points.push({ timeMs, arousal, label });
  }
  return points;
}

function computeCognitiveLoad(spec: MotionSpec): CognitiveLoad {
  const totalMs = spec.components.reduce(
    (max, c) => Math.max(max, c.delayMs + c.durationMs),
    2000,
  );

  // Find peak simultaneous animations
  let peakSimultaneous = 0;
  let peakWindow: { startMs: number; endMs: number } | null = null;
  const checkPoints = 20;
  for (let i = 0; i < checkPoints; i++) {
    const t = Math.round((totalMs * i) / checkPoints);
    let count = 0;
    for (const comp of spec.components) {
      if (t >= comp.delayMs && t <= comp.delayMs + comp.durationMs) count++;
    }
    if (count > peakSimultaneous) {
      peakSimultaneous = count;
      const startT = Math.round((totalMs * Math.max(0, i - 1)) / checkPoints);
      const endT = Math.round((totalMs * Math.min(checkPoints, i + 1)) / checkPoints);
      peakWindow = { startMs: startT, endMs: endT };
    }
  }

  const avgSpeed = spec.components.reduce((s, c) => s + speedScore(c), 0) /
    Math.max(1, spec.components.length);
  const avgComplexity = spec.components.reduce((s, c) => s + complexityScore(c), 0) /
    Math.max(1, spec.components.length);
  const trackingDifficulty = Math.min(1, peakSimultaneous / 5);

  const score = Math.round(
    peakSimultaneous * 15 +
    avgSpeed * 20 +
    avgComplexity * 30 +
    trackingDifficulty * 35,
  );

  const level: CognitiveLoad["level"] =
    score > 80 ? "overwhelming" :
    score > 60 ? "heavy" :
    score > 40 ? "moderate" :
    score > 20 ? "light" : "effortless";

  const recommendations: string[] = [];
  if (peakSimultaneous > 4) {
    recommendations.push("Stagger component entrances to reduce simultaneous tracking load");
  }
  if (avgSpeed > 0.7) {
    recommendations.push("Slow down some animations to give viewers time to process");
  }
  if (avgComplexity > 0.6) {
    recommendations.push("Simplify keyframe curves on complex components");
  }
  if (recommendations.length === 0) {
    recommendations.push("Cognitive load is well-balanced — no changes needed");
  }

  return {
    score,
    level,
    peakSimultaneous,
    peakWindow,
    factors: {
      simultaneousAnimations: peakSimultaneous,
      averageSpeed: Math.round(avgSpeed * 100) / 100,
      complexityScore: Math.round(avgComplexity * 100) / 100,
      trackingDifficulty: Math.round(trackingDifficulty * 100) / 100,
    },
    recommendations,
  };
}

function computeAttention(spec: MotionSpec): AttentionCurve {
  const totalMs = spec.components.reduce(
    (max, c) => Math.max(max, c.delayMs + c.durationMs),
    2000,
  );
  const points: Array<{ timeMs: number; attention: number }> = [];
  const samples = 20;

  for (let i = 0; i <= samples; i++) {
    const timeMs = Math.round((totalMs * i) / samples);
    let activeEnergy = 0;
    let activeCount = 0;
    let novelty = 0;

    for (const comp of spec.components) {
      const endMs = comp.delayMs + comp.durationMs;
      if (timeMs < comp.delayMs || timeMs > endMs) continue;
      activeCount++;
      const { energy } = profileEasing(comp.easing);
      const progress = (timeMs - comp.delayMs) / comp.durationMs;
      // Novelty is highest at entrance, then decays
      novelty += (1 - progress) * 0.5;
      activeEnergy += energy;
    }

    // Attention = combination of active energy, novelty, and density
    const density = activeCount / Math.max(1, spec.components.length);
    const attention = Math.min(1,
      (activeEnergy / Math.max(1, activeCount)) * 0.4 +
      novelty * 0.3 +
      density * 0.3,
    );
    points.push({ timeMs, attention: Math.round(attention * 100) / 100 });
  }

  const halfLifeIdx = points.findIndex((p) => p.attention < 0.5);
  const halfLifeMs = halfLifeIdx >= 0 ? points[halfLifeIdx].timeMs : totalMs;
  const disengageIdx = points.findIndex((p) => p.attention < 0.2);
  const disengagementMs = disengageIdx >= 0 ? points[disengageIdx].timeMs : null;

  // Sustains attention if it stays above 30% for at least 70% of duration
  const sustainThreshold = Math.floor(points.length * 0.7);
  const sustainsAttention = points
    .slice(0, sustainThreshold)
    .every((p) => p.attention >= 0.3);

  return { points, halfLifeMs, disengagementMs, sustainsAttention };
}

function computeMemorability(spec: MotionSpec): MemorabilityAssessment {
  const components = spec.components;

  // Distinctiveness: how varied are easings, durations, and transforms
  const easings = new Set(components.map((c) => JSON.stringify(c.easing)));
  const durations = new Set(components.map((c) => c.durationMs));
  const distinctiveness = Math.min(100,
    (easings.size / Math.max(1, components.length)) * 40 +
    (durations.size / Math.max(1, components.length)) * 30 +
    Math.min(30, components.length * 5),
  );

  // Emotional peak: max arousal in the composition
  const arousal = computeArousalCurve(spec);
  const maxArousal = Math.max(...arousal.map((a) => a.arousal));
  const emotionalPeak = Math.round(maxArousal * 100);

  // Narrative structure: presence of staggered timing suggests story
  const delays = components.map((c) => c.delayMs).sort((a, b) => a - b);
  const hasStagger = delays.some((d, i) => i > 0 && d > delays[i - 1] + 100);
  const narrativeStructure = hasStagger ? 70 : 30;

  // Surprise: unexpected easings or very short/long durations
  const avgDur = components.reduce((s, c) => s + c.durationMs, 0) / Math.max(1, components.length);
  const hasOutlier = components.some((c) =>
    Math.abs(c.durationMs - avgDur) > avgDur * 0.5,
  );
  const hasUnusualEasing = components.some((c) => {
    if (c.easing.type !== "preset") return true;
    return /bounce|elastic|back/.test(c.easing.name.toLowerCase());
  });
  const surpriseElement = (hasOutlier ? 40 : 0) + (hasUnusualEasing ? 40 : 0) + 20;

  // Repetition pattern: loops create rhythm
  const hasLoops = components.some((c) => c.iterationCount === "infinite");
  const repetitionPattern = hasLoops ? 60 : 40;

  const score = Math.round(
    distinctiveness * 0.25 +
    emotionalPeak * 0.25 +
    narrativeStructure * 0.2 +
    surpriseElement * 0.2 +
    repetitionPattern * 0.1,
  );

  const level: MemorabilityAssessment["level"] =
    score > 80 ? "unforgettable" :
    score > 60 ? "high" :
    score > 40 ? "moderate" :
    score > 20 ? "low" : "forgettable";

  const suggestions: string[] = [];
  if (distinctiveness < 40) suggestions.push("Vary easing curves and durations to increase distinctiveness");
  if (emotionalPeak < 50) suggestions.push("Add a high-energy focal point to create an emotional peak");
  if (narrativeStructure < 50) suggestions.push("Stagger entrance times to create a narrative arc");
  if (surpriseElement < 40) suggestions.push("Introduce an unexpected easing or duration for surprise");
  if (suggestions.length === 0) suggestions.push("Memorability is strong — the motion has good distinctive qualities");

  return {
    score,
    level,
    drivers: {
      distinctiveness: Math.round(distinctiveness),
      emotionalPeak,
      narrativeStructure,
      surpriseElement,
      repetitionPattern,
    },
    suggestions,
  };
}

function computeBrandPerception(spec: MotionSpec): BrandPerception {
  const components = spec.components;
  const attributes: Map<string, number> = new Map();

  function addAttr(name: string, value: number) {
    attributes.set(name, (attributes.get(name) ?? 0) + value);
  }

  for (const comp of components) {
    const { energy, warmth, smoothness } = profileEasing(comp.easing);
    const speed = speedScore(comp);
    const complexity = complexityScore(comp);

    // Map motion characteristics to brand attributes
    if (smoothness > 0.7) addAttr("Premium", smoothness * 20);
    if (energy > 0.7) addAttr("Playful", energy * 15);
    if (warmth > 0.7) addAttr("Trustworthy", warmth * 15);
    if (speed > 0.7) addAttr("Innovative", speed * 15);
    if (complexity > 0.5) addAttr("Sophisticated", complexity * 20);
    if (energy < 0.4 && smoothness > 0.6) addAttr("Calm", (1 - energy) * 20);
    if (speed < 0.4) addAttr("Patient", (1 - speed) * 15);
    if (warmth < 0.4) addAttr("Bold", (1 - warmth) * 15);
  }

  const sorted = Array.from(attributes.entries())
    .map(([name, strength]) => ({
      name,
      strength: Math.min(100, Math.round(strength)),
      direction: "reinforced" as const,
    }))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 5);

  // If no strong attributes, add default
  if (sorted.length === 0) {
    sorted.push({ name: "Neutral", strength: 50, direction: "reinforced" });
  }

  const personality = sorted.slice(0, 3).map((a) => a.name).join(", ");
  const confidence = Math.min(1, components.length / 5);

  return {
    attributes: sorted,
    personality,
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function predictPerception(spec: MotionSpec): PerceptionReport {
  const valenceCurve = computeValenceCurve(spec);
  const arousalCurve = computeArousalCurve(spec);
  const cognitiveLoad = computeCognitiveLoad(spec);
  const attention = computeAttention(spec);
  const memorability = computeMemorability(spec);
  const brand = computeBrandPerception(spec);

  // Overall score — weighted composite
  const avgValence = valenceCurve.reduce((s, p) => s + p.valence, 0) / valenceCurve.length;
  const avgArousal = arousalCurve.reduce((s, p) => s + p.arousal, 0) / arousalCurve.length;
  const valenceScore = ((avgValence + 1) / 2) * 100; // -1..1 → 0..100
  const arousalScore = avgArousal * 100;
  const attentionScore = attention.sustainsAttention ? 80 : 40;
  const loadScore = 100 - cognitiveLoad.score; // Lower load = higher score

  const overallScore = Math.round(
    valenceScore * 0.2 +
    arousalScore * 0.2 +
    attentionScore * 0.2 +
    memorability.score * 0.2 +
    loadScore * 0.2,
  );

  // Summary
  const arousalLevel = arousalCurve[Math.floor(arousalCurve.length / 2)]?.label ?? "moderate";
  const summary = `This motion composition projects a ${brand.personality.toLowerCase()} personality with ${arousalLevel} energy, ${cognitiveLoad.level} cognitive load, and ${memorability.level.toLowerCase()} memorability.`;

  // Top recommendations
  const topRecommendations: string[] = [];
  if (!attention.sustainsAttention) {
    topRecommendations.push("Add looped or staggered animations to sustain viewer attention longer");
  }
  if (cognitiveLoad.level === "heavy" || cognitiveLoad.level === "overwhelming") {
    topRecommendations.push("Reduce simultaneous animations to lower cognitive load");
  }
  if (memorability.level === "low" || memorability.level === "forgettable") {
    topRecommendations.push("Introduce distinctive easing or surprise elements to boost memorability");
  }
  topRecommendations.push(...cognitiveLoad.recommendations.slice(0, 1));
  if (topRecommendations.length === 0) {
    topRecommendations.push("The composition is well-balanced — consider fine-tuning brand attributes");
  }

  return {
    valenceCurve,
    arousalCurve,
    cognitiveLoad,
    attention,
    memorability,
    brand,
    overallScore,
    summary,
    topRecommendations: topRecommendations.slice(0, 3),
  };
}

export function formatPerceptionReport(report: PerceptionReport): string {
  const lines: string[] = [];
  lines.push(`## Motion Perception Report`);
  lines.push("");
  lines.push(`**Overall Score:** ${report.overallScore}/100`);
  lines.push(`**Summary:** ${report.summary}`);
  lines.push("");
  lines.push(`### Emotional Valence`);
  const avgValence = report.valenceCurve.reduce((s, p) => s + p.valence, 0) / report.valenceCurve.length;
  lines.push(`Average valence: ${avgValence > 0.2 ? "Positive" : avgValence < -0.2 ? "Negative" : "Neutral"} (${avgValence.toFixed(2)})`);
  lines.push("");
  lines.push(`### Arousal Profile`);
  const peak = report.arousalCurve.reduce((max, p) => p.arousal > max.arousal ? p : max, report.arousalCurve[0]);
  lines.push(`Peak arousal: ${peak.label} (${(peak.arousal * 100).toFixed(0)}%) at ${peak.timeMs}ms`);
  lines.push("");
  lines.push(`### Cognitive Load`);
  lines.push(`Level: ${report.cognitiveLoad.level} (${report.cognitiveLoad.score}/100)`);
  lines.push(`Peak simultaneous animations: ${report.cognitiveLoad.peakSimultaneous}`);
  lines.push("");
  lines.push(`### Attention Retention`);
  lines.push(`Half-life: ${report.attention.halfLifeMs}ms`);
  lines.push(`Sustains attention: ${report.attention.sustainsAttention ? "Yes" : "No"}`);
  lines.push("");
  lines.push(`### Memorability`);
  lines.push(`Level: ${report.memorability.level} (${report.memorability.score}/100)`);
  lines.push("");
  lines.push(`### Brand Perception`);
  lines.push(`Personality: ${report.brand.personality}`);
  lines.push(`Confidence: ${(report.brand.confidence * 100).toFixed(0)}%`);
  lines.push("");
  lines.push(`### Top Recommendations`);
  for (const rec of report.topRecommendations) {
    lines.push(`- ${rec}`);
  }
  return lines.join("\n");
}
