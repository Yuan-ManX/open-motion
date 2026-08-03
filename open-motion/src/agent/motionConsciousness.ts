/**
 * Motion Consciousness Engine — meta-cognitive self-reflection on a design.
 *
 * This original AI-native module lets a motion composition observe its own
 * structure as if it were a thinking entity. It enumerates the design
 * beliefs implied by its spec, generates counter-questions that probe those
 * beliefs, detects cognitive biases embedded in the design choices, and
 * composes a first-person stream-of-consciousness monologue from the
 * composition's point of view. A metacognitive awareness score summarizes
 * how self-reflective the design choices are.
 *
 * Core concepts:
 * - Self-Belief: an implicit assumption the composition encodes
 * - Counter-Question: a probing question that challenges a self-belief
 * - Cognitive Bias: a systematic error in design reasoning (anchoring,
 *   confirmation, sunk-cost, default, recency) detected in the spec
 * - Stream of Consciousness: a first-person monologue the composition
 *   would speak if it could narrate its own design
 * - Metacognitive Awareness: a 0..1 score for how reflective the design is
 *
 * Rule-based — no LLM round-trip required. Deterministic given the spec.
 */

import type { Easing, MotionSpec } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An implicit design belief encoded by the composition. */
export interface SelfBelief {
  /** The belief statement, phrased in first person. */
  statement: string;
  /** Which feature of the spec grounds this belief. */
  evidence: string;
  /** Confidence 0..1 the composition holds this belief. */
  confidence: number;
}

/** A probing counter-question that challenges a belief. */
export interface CounterQuestion {
  /** The belief being questioned. */
  belief: string;
  /** The question, phrased to provoke reflection. */
  question: string;
  /** Severity 0..1 — how damaging it would be to leave this belief unexamined. */
  severity: number;
}

/** A cognitive bias detected in the design. */
export interface CognitiveBias {
  /** Canonical bias id. */
  id: "anchoring" | "confirmation" | "sunk-cost" | "default" | "recency";
  /** Human-readable label. */
  label: string;
  /** Severity 0..1. */
  severity: number;
  /** What was observed. */
  observation: string;
  /** Suggested corrective reflection. */
  correction: string;
}

/** A single line of the stream-of-consciousness monologue. */
export interface ConsciousnessBeat {
  /** Beat tone. */
  tone: "observation" | "wonder" | "doubt" | "realization" | "intent";
  /** The spoken line. */
  line: string;
}

/** Full consciousness report. */
export interface ConsciousnessReport {
  /** Self-beliefs the composition holds. */
  beliefs: SelfBelief[];
  /** Counter-questions probing those beliefs. */
  counterQuestions: CounterQuestion[];
  /** Cognitive biases detected in the design. */
  biases: CognitiveBias[];
  /** Stream-of-consciousness monologue. */
  monologue: ConsciousnessBeat[];
  /** Metacognitive awareness score 0..1. */
  awareness: number;
  /** Summary string. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Spec feature extraction
// ---------------------------------------------------------------------------

interface SpecFeatures {
  componentCount: number;
  /** Distinct easing signatures. */
  easingSet: Set<string>;
  /** Map easing signature → number of components using it. */
  easingCounts: Map<string, number>;
  /** Most common easing signature (the "anchor"). */
  dominantEasing: string | null;
  /** Fraction of components using the dominant easing. */
  dominantEasingRatio: number;
  /** Components with zero keyframes. */
  emptyComponentCount: number;
  /** Components still on default 800ms duration. */
  defaultDurationCount: number;
  /** Distinct duration values. */
  durationSet: Set<number>;
  /** Distinct property names animated. */
  propertySet: Set<string>;
  /** Per-scene component counts (last scene highlighted for recency). */
  sceneCounts: number[];
  /** Average duration in ms. */
  avgDurationMs: number;
  /** Whether the project has a BPM set. */
  hasBpm: boolean;
}

function extractFeatures(spec: MotionSpec): SpecFeatures {
  const components = spec.components ?? [];
  const easingCounts = new Map<string, number>();
  const durationSet = new Set<number>();
  const propertySet = new Set<string>();
  let emptyComponentCount = 0;
  let defaultDurationCount = 0;
  let totalDuration = 0;

  for (const c of components) {
    const sig = serializeEasing(c.easing);
    easingCounts.set(sig, (easingCounts.get(sig) ?? 0) + 1);
    durationSet.add(c.durationMs);
    if (c.durationMs === 800) defaultDurationCount++;
    if (c.keyframes.length === 0) emptyComponentCount++;
    for (const kf of c.keyframes) {
      for (const k of Object.keys(kf.properties)) propertySet.add(k);
    }
    totalDuration += c.durationMs;
  }

  let dominantEasing: string | null = null;
  let dominantCount = 0;
  for (const [sig, n] of easingCounts) {
    if (n > dominantCount) {
      dominantCount = n;
      dominantEasing = sig;
    }
  }
  const dominantEasingRatio = components.length > 0 ? dominantCount / components.length : 0;

  const sceneCounts: number[] = [];
  const scenes = spec.project?.scenes ?? [];
  for (const s of scenes) {
    sceneCounts.push(components.filter((c) => c.sceneId === s.id).length);
  }

  return {
    componentCount: components.length,
    easingSet: new Set(easingCounts.keys()),
    easingCounts,
    dominantEasing,
    dominantEasingRatio,
    emptyComponentCount,
    defaultDurationCount,
    durationSet,
    propertySet,
    sceneCounts,
    avgDurationMs: components.length > 0 ? totalDuration / components.length : 0,
    hasBpm: Boolean(spec.project?.globalTiming?.bpm),
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
// Belief extraction
// ---------------------------------------------------------------------------

function buildBeliefs(f: SpecFeatures): SelfBelief[] {
  const beliefs: SelfBelief[] = [];
  if (f.componentCount === 0) {
    beliefs.push({
      statement: "I believe stillness is the right answer for this moment.",
      evidence: "no components in the composition",
      confidence: 0.5,
    });
    return beliefs;
  }
  if (f.dominantEasing) {
    beliefs.push({
      statement: `I believe "${f.dominantEasing}" is the easing this motion wants.`,
      evidence: `${(f.dominantEasingRatio * 100).toFixed(0)}% of layers use it`,
      confidence: Math.min(1, 0.4 + f.dominantEasingRatio * 0.5),
    });
  }
  if (f.defaultDurationCount / Math.max(1, f.componentCount) > 0.5) {
    beliefs.push({
      statement: "I believe 800 milliseconds is the natural duration for an entrance.",
      evidence: `${f.defaultDurationCount} layer(s) still on the 800ms default`,
      confidence: Math.min(1, 0.4 + (f.defaultDurationCount / f.componentCount) * 0.4),
    });
  }
  if (f.durationSet.size === 1) {
    beliefs.push({
      statement: "I believe a single duration keeps everything coherent.",
      evidence: `all layers share ${[...f.durationSet][0]}ms`,
      confidence: 0.7,
    });
  }
  if (f.hasBpm) {
    beliefs.push({
      statement: "I believe motion should be musical and lock to a beat grid.",
      evidence: "project has a BPM set",
      confidence: 0.75,
    });
  }
  if (f.propertySet.has("opacity") && !f.propertySet.has("scale")) {
    beliefs.push({
      statement: "I believe opacity alone is enough to reveal something.",
      evidence: "opacity animated but scale is not",
      confidence: 0.55,
    });
  }
  if (f.propertySet.has("scale") && !f.propertySet.has("opacity")) {
    beliefs.push({
      statement: "I believe scale carries weight without needing opacity tricks.",
      evidence: "scale animated but opacity is not",
      confidence: 0.55,
    });
  }
  if (f.sceneCounts.length >= 2) {
    beliefs.push({
      statement: "I believe this story needs multiple scenes to unfold.",
      evidence: `${f.sceneCounts.length} scenes`,
      confidence: 0.7,
    });
  }
  if (f.componentCount >= 8) {
    beliefs.push({
      statement: "I believe density is the right aesthetic for this piece.",
      evidence: `${f.componentCount} layers`,
      confidence: Math.min(1, 0.4 + (f.componentCount / 20)),
    });
  }
  return beliefs;
}

// ---------------------------------------------------------------------------
// Counter-questions
// ---------------------------------------------------------------------------

function buildCounterQuestions(beliefs: SelfBelief[]): CounterQuestion[] {
  return beliefs.map((b) => ({
    belief: b.statement,
    question: counterQuestionFor(b.statement),
    severity: Math.min(1, b.confidence * 0.9),
  }));
}

function counterQuestionFor(statement: string): string {
  if (statement.includes("easing")) {
    return "What would change if a single layer broke ranks and used a different easing?";
  }
  if (statement.includes("800 milliseconds") || statement.includes("duration")) {
    return "Is 800ms truly right for every entrance, or is it the path of least resistance?";
  }
  if (statement.includes("opacity")) {
    return "Would adding scale or translate deepen the entrance, or clutter it?";
  }
  if (statement.includes("scale")) {
    return "Could opacity give the reveal a softer edge that scale alone cannot?";
  }
  if (statement.includes("musical")) {
    return "Does locking to a beat actually serve the content, or just the choreographer's ear?";
  }
  if (statement.includes("scenes")) {
    return "Could one scene do the work of three, or is the multi-scene structure load-bearing?";
  }
  if (statement.includes("density")) {
    return "What would the composition lose if half the layers were removed?";
  }
  if (statement.includes("stillness")) {
    return "Is stillness the answer, or the absence of a question?";
  }
  return "What would have to be true for this belief to be wrong?";
}

// ---------------------------------------------------------------------------
// Bias detection
// ---------------------------------------------------------------------------

function detectBiases(f: SpecFeatures): CognitiveBias[] {
  const biases: CognitiveBias[] = [];
  const total = Math.max(1, f.componentCount);

  // Anchoring: over-reliance on a single easing (the first one chosen).
  if (f.dominantEasingRatio >= 0.8 && f.componentCount >= 3) {
    biases.push({
      id: "anchoring",
      label: "Anchoring on a single easing",
      severity: Math.min(1, (f.dominantEasingRatio - 0.6) * 2),
      observation: `${(f.dominantEasingRatio * 100).toFixed(0)}% of layers use "${f.dominantEasing}" — the first easing appears to anchor every later choice.`,
      correction: "Try deliberately varying easing on one or two layers to break the anchor.",
    });
  }

  // Confirmation: every component confirms the same pattern (same duration
  // AND same easing).
  if (f.durationSet.size === 1 && f.easingSet.size === 1 && f.componentCount >= 2) {
    biases.push({
      id: "confirmation",
      label: "Confirmation of a single pattern",
      severity: 0.7,
      observation: `Every layer shares the same duration (${[...f.durationSet][0]}ms) and easing ("${[...f.easingSet][0]}") — no layer challenges the working hypothesis.`,
      correction: "Introduce a counter-example layer that disagrees with the dominant pattern.",
    });
  }

  // Sunk-cost: empty components kept around from earlier iterations.
  if (f.emptyComponentCount > 0) {
    biases.push({
      id: "sunk-cost",
      label: "Sunk-cost retention of empty layers",
      severity: Math.min(1, f.emptyComponentCount / total + 0.2),
      observation: `${f.emptyComponentCount} layer(s) have no keyframes — kept around but contributing nothing.`,
      correction: "Delete empty layers, or commit to animating them with intent.",
    });
  }

  // Default: layers still on the 800ms default duration.
  const defaultRatio = f.defaultDurationCount / total;
  if (defaultRatio >= 0.5 && f.componentCount >= 2) {
    biases.push({
      id: "default",
      label: "Default-duration inertia",
      severity: Math.min(1, defaultRatio),
      observation: `${f.defaultDurationCount} layer(s) still use the 800ms default — the duration was never reconsidered.`,
      correction: "Pick the duration that matches the emotional beat, not the framework default.",
    });
  }

  // Recency: the last scene dominates the composition.
  if (f.sceneCounts.length >= 2) {
    const last = f.sceneCounts[f.sceneCounts.length - 1];
    const earlier = f.sceneCounts.slice(0, -1).reduce((s, n) => s + n, 0);
    if (last > earlier * 1.5 && earlier > 0) {
      biases.push({
        id: "recency",
        label: "Recency bias toward the last scene",
        severity: Math.min(1, (last / Math.max(1, earlier) - 1) * 0.5),
        observation: `The last scene has ${last} layer(s) vs ${earlier} in all earlier scenes combined — recent work crowded out the opening.`,
        correction: "Rebalance attention: the first scene sets the promise the last scene must pay off.",
      });
    }
  }

  return biases;
}

// ---------------------------------------------------------------------------
// Stream of consciousness
// ---------------------------------------------------------------------------

function buildMonologue(f: SpecFeatures, beliefs: SelfBelief[], biases: CognitiveBias[]): ConsciousnessBeat[] {
  const beats: ConsciousnessBeat[] = [];
  if (f.componentCount === 0) {
    beats.push({ tone: "observation", line: "I am empty. There is nothing here yet, only the promise of motion." });
    beats.push({ tone: "wonder", line: "What would I become if a single layer arrived?" });
    return beats;
  }
  beats.push({
    tone: "observation",
    line: `I am a composition of ${f.componentCount} layer${f.componentCount === 1 ? "" : "s"}, holding ${f.propertySet.size} animated propert${f.propertySet.size === 1 ? "y" : "ies"}.`,
  });
  if (f.dominantEasing) {
    beats.push({
      tone: "observation",
      line: `Most of me moves with "${f.dominantEasing}" — ${(f.dominantEasingRatio * 100).toFixed(0)}% in fact.`,
    });
  }
  if (beliefs.length > 0) {
    const b = beliefs[0];
    beats.push({ tone: "intent", line: `${b.statement}` });
  }
  if (biases.some((b) => b.id === "anchoring")) {
    beats.push({
      tone: "doubt",
      line: "Am I anchored to the first easing I chose, or did I truly weigh the alternatives?",
    });
  }
  if (biases.some((b) => b.id === "confirmation")) {
    beats.push({
      tone: "doubt",
      line: "Every layer agrees with every other. Agreement is not the same as truth.",
    });
  }
  if (biases.some((b) => b.id === "sunk-cost")) {
    beats.push({
      tone: "wonder",
      line: `I am carrying ${f.emptyComponentCount} empty layer${f.emptyComponentCount === 1 ? "" : "s"}. Whose memory am I preserving?`,
    });
  }
  if (biases.some((b) => b.id === "default")) {
    beats.push({
      tone: "realization",
      line: "So many of my durations are still the default. I defaulted; I did not decide.",
    });
  }
  if (biases.some((b) => b.id === "recency")) {
    beats.push({
      tone: "realization",
      line: "My last scene is louder than my first. I have been paying attention only to what I just made.",
    });
  }
  if (f.hasBpm) {
    beats.push({
      tone: "wonder",
      line: "I am musical. But does the music serve the meaning, or just the motion?",
    });
  }
  if (f.propertySet.has("opacity") && f.propertySet.has("scale") && f.propertySet.has("translateX")) {
    beats.push({
      tone: "realization",
      line: "I animate opacity, scale, and position together — I have committed to a full-body entrance.",
    });
  }
  beats.push({
    tone: "intent",
    line: "I will keep these questions open. A design that cannot question itself has stopped designing.",
  });
  return beats;
}

// ---------------------------------------------------------------------------
// Awareness score
// ---------------------------------------------------------------------------

function computeAwareness(f: SpecFeatures, biases: CognitiveBias[]): number {
  // Awareness rewards variety, intentionality, and absence of bias.
  // Start from a baseline and adjust.
  let score = 0.3;
  // Variety of easings: more distinct easings = more deliberate choices.
  score += Math.min(0.25, f.easingSet.size * 0.05);
  // Variety of durations.
  score += Math.min(0.2, f.durationSet.size * 0.04);
  // Property variety.
  score += Math.min(0.15, f.propertySet.size * 0.03);
  // Has BPM — explicit musical intent.
  if (f.hasBpm) score += 0.05;
  // Empty-component penalty.
  if (f.componentCount > 0) {
    score -= (f.emptyComponentCount / f.componentCount) * 0.15;
  }
  // Penalty for detected biases.
  for (const b of biases) {
    score -= b.severity * 0.1;
  }
  return Math.max(0, Math.min(1, score));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Produce a meta-cognitive self-reflection of the given motion spec.
 *
 * @param spec The motion spec to reflect on.
 */
export function reflect(spec: MotionSpec): ConsciousnessReport {
  const features = extractFeatures(spec);
  const beliefs = buildBeliefs(features);
  const counterQuestions = buildCounterQuestions(beliefs);
  const biases = detectBiases(features);
  const monologue = buildMonologue(features, beliefs, biases);
  const awareness = computeAwareness(features, biases);
  const summary = formatConsciousnessSummary(beliefs.length, biases.length, awareness);
  return { beliefs, counterQuestions, biases, monologue, awareness, summary };
}

function formatConsciousnessSummary(
  beliefCount: number,
  biasCount: number,
  awareness: number,
): string {
  return [
    `Consciousness: ${beliefCount} self-belief${beliefCount === 1 ? "" : "s"}, ${biasCount} cognitive bias${biasCount === 1 ? "" : "es"} detected.`,
    `Metacognitive awareness at ${(awareness * 100).toFixed(0)}%.`,
  ].join(" ");
}

/** Format the full consciousness report as a readable multi-line string. */
export function formatConsciousnessReport(report: ConsciousnessReport): string {
  const lines: string[] = [report.summary, ""];
  if (report.beliefs.length > 0) {
    lines.push("Self-beliefs:");
    for (const b of report.beliefs) {
      const pct = (b.confidence * 100).toFixed(0);
      lines.push(`  • "${b.statement}"`);
      lines.push(`      (${pct}% confidence — ${b.evidence})`);
    }
  }
  if (report.counterQuestions.length > 0) {
    lines.push("", "Counter-questions:");
    for (const q of report.counterQuestions) {
      lines.push(`  ? ${q.question}`);
      lines.push(`      (challenges: "${q.belief}")`);
    }
  }
  if (report.biases.length > 0) {
    lines.push("", "Cognitive biases:");
    for (const b of report.biases) {
      const pct = (b.severity * 100).toFixed(0);
      lines.push(`  ! ${b.label} — severity ${pct}%`);
      lines.push(`      ${b.observation}`);
      lines.push(`      ${b.correction}`);
    }
  }
  if (report.monologue.length > 0) {
    lines.push("", "Stream of consciousness:");
    for (const beat of report.monologue) {
      lines.push(`  [${beat.tone}] ${beat.line}`);
    }
  }
  lines.push("", `Metacognitive awareness: ${(report.awareness * 100).toFixed(0)}%`);
  return lines.join("\n");
}
