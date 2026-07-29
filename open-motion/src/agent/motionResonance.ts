/**
 * Motion Resonance Engine — aligns motion rhythm with cognitive and emotional
 * resonance frequencies.
 *
 * This original AI-native module computes the resonance between a motion
 * composition and the viewer's cognitive/emotional state. Resonance occurs
 * when the motion's temporal frequency, intensity envelope, and easing
 * harmonics align with the viewer's attention cycle and affective baseline.
 *
 * Core concepts:
 * - Cognitive Cycle: human attention oscillates at ~0.5-4 Hz (theta/alpha)
 * - Affective Baseline: emotional state sets a preferred intensity range
 * - Harmonic Alignment: motion that matches cognitive cycles feels "in sync"
 * - Dissonance Detection: motion that fights natural rhythms causes fatigue
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Viewer's cognitive and emotional state. */
export interface ViewerState {
  /** Attention level 0..1 (low = distracted, high = focused). */
  attention: number;
  /** Arousal level 0..1 (low = calm, high = excited). */
  arousal: number;
  /** Valence -1..1 (negative = stressed, positive = happy). */
  valence: number;
  /** Fatigue level 0..1 (0 = fresh, 1 = exhausted). */
  fatigue: number;
  /** Time of day affects cognitive baseline. */
  timeOfDay?: "morning" | "afternoon" | "evening" | "night";
}

/** Resonance analysis result. */
export interface ResonanceAnalysis {
  /** Overall resonance score 0..1. */
  resonance: number;
  /** Cognitive alignment 0..1. */
  cognitiveAlignment: number;
  /** Emotional alignment 0..1. */
  emotionalAlignment: number;
  /** Rhythmic alignment 0..1. */
  rhythmicAlignment: number;
  /** Detected dissonance points. */
  dissonances: DissonancePoint[];
  /** Recommended adjustments. */
  recommendations: ResonanceRecommendation[];
  /** Summary. */
  summary: string;
}

export interface DissonancePoint {
  /** Component id causing dissonance. */
  componentId: string;
  /** Type of dissonance. */
  type: "frequency" | "intensity" | "duration" | "easing";
  /** Description. */
  description: string;
  /** Severity 0..1. */
  severity: number;
}

export interface ResonanceRecommendation {
  /** Component id to adjust. */
  componentId: string;
  /** What to change. */
  adjustment: string;
  /** Expected resonance gain. */
  expectedGain: number;
  /** New parameter value. */
  newValue: number | string;
}

/** Default viewer state derived from time of day. */
export function defaultViewerState(timeOfDay?: "morning" | "afternoon" | "evening" | "night"): ViewerState {
  const hour = new Date().getHours();
  const tod: ViewerState["timeOfDay"] = timeOfDay ?? (
    hour < 12 ? "morning" : hour < 18 ? "afternoon" : hour < 22 ? "evening" : "night"
  );

  switch (tod) {
    case "morning":
      return { attention: 0.7, arousal: 0.5, valence: 0.2, fatigue: 0.2, timeOfDay: tod };
    case "afternoon":
      return { attention: 0.6, arousal: 0.6, valence: 0.3, fatigue: 0.4, timeOfDay: tod };
    case "evening":
      return { attention: 0.5, arousal: 0.4, valence: 0.1, fatigue: 0.6, timeOfDay: tod };
    case "night":
      return { attention: 0.4, arousal: 0.3, valence: 0.0, fatigue: 0.8, timeOfDay: tod };
  }
}

// ---------------------------------------------------------------------------
// Cognitive Frequency Analysis
// ---------------------------------------------------------------------------

/**
 * Estimate the dominant frequency of a motion component in Hz.
 * Derived from duration and iteration count.
 */
function estimateFrequency(component: MotionComponent): number {
  const durationSec = component.durationMs / 1000;
  const isLooping = component.iterationCount === "infinite" || typeof component.iterationCount === "number" && component.iterationCount > 1;
  if (!isLooping) return 0; // One-shot motion has no cyclic frequency
  // Frequency = 1 / period
  return durationSec > 0 ? 1 / durationSec : 0;
}

/**
 * Compute the cognitive alignment between motion frequency and viewer state.
 * Human attention cycles: theta (4-8 Hz), alpha (8-13 Hz), beta (13-30 Hz).
 * For motion, we focus on the slower range (0.5-4 Hz) where perceptible
 * motion cycles resonate with attention.
 */
function computeCognitiveAlignment(spec: MotionSpec, viewer: ViewerState): { alignment: number; dissonances: DissonancePoint[] } {
  const dissonances: DissonancePoint[] = [];
  let totalAlignment = 0;
  let componentCount = 0;

  // Viewer's preferred frequency range based on arousal
  // High arousal → faster motion preferred (2-4 Hz)
  // Low arousal → slower motion preferred (0.5-1.5 Hz)
  const preferredMinHz = viewer.arousal < 0.3 ? 0.3 : viewer.arousal < 0.7 ? 0.5 : 1.0;
  const preferredMaxHz = viewer.arousal < 0.3 ? 1.5 : viewer.arousal < 0.7 ? 3.0 : 4.0;

  for (const comp of spec.components) {
    const freq = estimateFrequency(comp);
    if (freq === 0) continue; // Skip non-cyclic components
    componentCount++;

    // Alignment is highest when frequency is in the preferred range
    let alignment: number;
    if (freq >= preferredMinHz && freq <= preferredMaxHz) {
      alignment = 0.9 + 0.1 * (1 - Math.abs(freq - (preferredMinHz + preferredMaxHz) / 2) / ((preferredMaxHz - preferredMinHz) / 2 || 1));
    } else if (freq < preferredMinHz) {
      // Too slow — may feel sluggish
      alignment = Math.max(0.3, 0.9 * (freq / preferredMinHz));
      if (alignment < 0.5) {
        dissonances.push({
          componentId: comp.id,
          type: "frequency",
          description: `Motion frequency ${freq.toFixed(2)} Hz is below the preferred range [${preferredMinHz}-${preferredMaxHz} Hz] — may feel sluggish for current arousal level`,
          severity: 1 - alignment,
        });
      }
    } else {
      // Too fast — may feel jarring
      alignment = Math.max(0.2, 0.9 * (preferredMaxHz / freq));
      if (alignment < 0.5) {
        dissonances.push({
          componentId: comp.id,
          type: "frequency",
          description: `Motion frequency ${freq.toFixed(2)} Hz exceeds the preferred range [${preferredMinHz}-${preferredMaxHz} Hz] — may feel jarring for current arousal level`,
          severity: 1 - alignment,
        });
      }
    }

    // Fatigue penalty: tired viewers prefer slower motion
    if (viewer.fatigue > 0.7 && freq > 2) {
      alignment *= 0.7;
      dissonances.push({
        componentId: comp.id,
        type: "frequency",
        description: `High fatigue viewer should avoid fast motion (${freq.toFixed(2)} Hz) — causes cognitive overload`,
        severity: 0.5,
      });
    }

    totalAlignment += alignment;
  }

  const avgAlignment = componentCount > 0 ? totalAlignment / componentCount : 0.8;
  return { alignment: Math.min(1, avgAlignment), dissonances };
}

// ---------------------------------------------------------------------------
// Emotional Alignment
// ---------------------------------------------------------------------------

/**
 * Compute emotional alignment between motion intensity and viewer valence/arousal.
 * Positive valence + high arousal → energetic, vibrant motion
 * Negative valence + low arousal → subdued, slow motion
 */
function computeEmotionalAlignment(spec: MotionSpec, viewer: ViewerState): { alignment: number; dissonances: DissonancePoint[] } {
  const dissonances: DissonancePoint[] = [];
  let totalAlignment = 0;
  let count = 0;

  for (const comp of spec.components) {
    count++;
    // Estimate motion intensity from duration and easing
    const intensity = estimateIntensity(comp);

    // Expected intensity from viewer state
    // High arousal → expects higher intensity (0.6-0.9)
    // Low arousal → expects lower intensity (0.2-0.5)
    const expectedIntensity = viewer.arousal * 0.8 + 0.1;

    // Alignment based on how close the motion intensity is to expected
    const diff = Math.abs(intensity - expectedIntensity);
    let alignment = 1 - diff;

    // Valence mismatch: stressed viewers (negative valence) should avoid
    // extremely energetic motion (intensity > 0.8) which can increase stress
    if (viewer.valence < -0.3 && intensity > 0.8) {
      alignment *= 0.6;
      dissonances.push({
        componentId: comp.id,
        type: "intensity",
        description: `High-intensity motion may amplify viewer stress (valence ${viewer.valence.toFixed(2)})`,
        severity: 0.4,
      });
    }

    // Fatigue: tired viewers should avoid high intensity
    if (viewer.fatigue > 0.6 && intensity > 0.7) {
      alignment *= 0.7;
      dissonances.push({
        componentId: comp.id,
        type: "intensity",
        description: `High-intensity motion causes fatigue for tired viewers (fatigue ${viewer.fatigue.toFixed(2)})`,
        severity: 0.5,
      });
    }

    totalAlignment += Math.max(0, alignment);
  }

  const avgAlignment = count > 0 ? totalAlignment / count : 0.7;
  return { alignment: Math.min(1, avgAlignment), dissonances };
}

/** Estimate motion intensity on a 0..1 scale from component properties. */
function estimateIntensity(comp: MotionComponent): number {
  // Shorter duration with more keyframes = higher intensity
  const durationFactor = comp.durationMs < 500 ? 0.9 : comp.durationMs < 1500 ? 0.6 : 0.3;
  const keyframeFactor = Math.min(1, (comp.keyframes?.length ?? 2) / 8);

  // Spring easing = higher intensity
  const easing = comp.easing;
  let easingFactor = 0.5;
  if (easing && typeof easing === "object") {
    if (easing.type === "spring") {
      easingFactor = 0.8;
      // Stiffer springs = more intense
      if ("stiffness" in easing && typeof easing.stiffness === "number") {
        easingFactor = Math.min(1, easing.stiffness / 300);
      }
    } else if (easing.type === "preset") {
      const intense = ["bounce", "elastic", "back", "snappy"];
      const calm = ["smooth", "soft", "ease-in-out"];
      if (intense.includes(easing.name)) easingFactor = 0.8;
      else if (calm.includes(easing.name)) easingFactor = 0.4;
    }
  }

  return Math.min(1, durationFactor * 0.4 + keyframeFactor * 0.2 + easingFactor * 0.4);
}

// ---------------------------------------------------------------------------
// Rhythmic Alignment
// ---------------------------------------------------------------------------

/**
 * Compute rhythmic alignment — how well the motion's rhythm matches the
 * viewer's attention cycle.
 */
function computeRhythmicAlignment(spec: MotionSpec, viewer: ViewerState): { alignment: number; dissonances: DissonancePoint[] } {
  const dissonances: DissonancePoint[] = [];

  if (spec.components.length === 0) {
    return { alignment: 0.5, dissonances };
  }

  // Compute the stagger pattern
  const delays = spec.components.map((c: MotionComponent) => c.delayMs);
  const durations = spec.components.map((c: MotionComponent) => c.durationMs);
  const totalSpan = Math.max(...delays.map((d: number, i: number) => d + durations[i])) - Math.min(...delays);

  // Attention cycle: ~2 seconds for focused viewers, ~1 second for distracted
  const attentionCycleMs = viewer.attention > 0.7 ? 2000 : viewer.attention > 0.4 ? 1500 : 1000;

  // Check if components are spaced at intervals that align with attention cycle
  const sortedDelays = [...delays].sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < sortedDelays.length; i++) {
    intervals.push(sortedDelays[i] - sortedDelays[i - 1]);
  }

  if (intervals.length === 0) {
    return { alignment: 0.7, dissonances };
  }

  // Average interval vs attention cycle
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const ratio = avgInterval / attentionCycleMs;

  // Alignment is highest when ratio is between 0.5 and 2 (one event per half to double cycle)
  let alignment: number;
  if (ratio >= 0.5 && ratio <= 2) {
    alignment = 0.9;
  } else if (ratio < 0.5) {
    // Too frequent — cognitive overload
    alignment = Math.max(0.3, ratio * 2);
    dissonances.push({
      componentId: spec.components[0].id,
      type: "duration",
      description: `Stagger interval ${avgInterval.toFixed(0)}ms is too frequent for attention cycle ${attentionCycleMs}ms — cognitive overload risk`,
      severity: 1 - alignment,
    });
  } else {
    // Too sparse — loss of engagement
    alignment = Math.max(0.4, 2 / ratio);
    dissonances.push({
      componentId: spec.components[0].id,
      type: "duration",
      description: `Stagger interval ${avgInterval.toFixed(0)}ms is too sparse for attention cycle ${attentionCycleMs}ms — engagement loss risk`,
      severity: 1 - alignment,
    });
  }

  return { alignment, dissonances };
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

function buildRecommendations(
  spec: MotionSpec,
  viewer: ViewerState,
  cognitiveDissonances: DissonancePoint[],
  emotionalDissonances: DissonancePoint[],
): ResonanceRecommendation[] {
  const recommendations: ResonanceRecommendation[] = [];

  // Frequency adjustments
  for (const d of cognitiveDissonances.filter((x) => x.type === "frequency")) {
    const comp = spec.components.find((c: MotionComponent) => c.id === d.componentId);
    if (!comp) continue;

    if (viewer.fatigue > 0.6) {
      // Suggest slower motion
      const newDuration = Math.round(comp.durationMs * 1.5);
      recommendations.push({
        componentId: d.componentId,
        adjustment: "Increase duration to reduce cognitive load for fatigued viewer",
        expectedGain: 0.2,
        newValue: newDuration,
      });
    } else if (viewer.arousal > 0.7) {
      // Suggest faster motion
      const newDuration = Math.round(comp.durationMs * 0.7);
      recommendations.push({
        componentId: d.componentId,
        adjustment: "Decrease duration to match high-arousal viewer preference",
        expectedGain: 0.15,
        newValue: newDuration,
      });
    }
  }

  // Intensity adjustments
  for (const d of emotionalDissonances.filter((x) => x.type === "intensity")) {
    const comp = spec.components.find((c: MotionComponent) => c.id === d.componentId);
    if (!comp) continue;

    if (viewer.valence < -0.3 || viewer.fatigue > 0.6) {
      // Suggest calmer easing
      recommendations.push({
        componentId: d.componentId,
        adjustment: "Switch to a calmer easing preset (smooth/soft) to reduce emotional intensity",
        expectedGain: 0.25,
        newValue: "smooth",
      });
    }
  }

  return recommendations;
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Analyze the resonance between a motion spec and a viewer state.
 */
export function analyzeResonance(spec: MotionSpec, viewer?: ViewerState): ResonanceAnalysis {
  const v = viewer ?? defaultViewerState();

  const cognitive = computeCognitiveAlignment(spec, v);
  const emotional = computeEmotionalAlignment(spec, v);
  const rhythmic = computeRhythmicAlignment(spec, v);

  const allDissonances = [...cognitive.dissonances, ...emotional.dissonances, ...rhythmic.dissonances];
  const recommendations = buildRecommendations(spec, v, cognitive.dissonances, emotional.dissonances);

  // Weighted average: cognitive 35%, emotional 35%, rhythmic 30%
  const overall = cognitive.alignment * 0.35 + emotional.alignment * 0.35 + rhythmic.alignment * 0.30;

  const summary = `Resonance ${overall.toFixed(2)} (cognitive ${cognitive.alignment.toFixed(2)}, emotional ${emotional.alignment.toFixed(2)}, rhythmic ${rhythmic.alignment.toFixed(2)}) with ${allDissonances.length} dissonance point(s) and ${recommendations.length} recommendation(s)`;

  return {
    resonance: overall,
    cognitiveAlignment: cognitive.alignment,
    emotionalAlignment: emotional.alignment,
    rhythmicAlignment: rhythmic.alignment,
    dissonances: allDissonances,
    recommendations,
    summary,
  };
}

/**
 * Generate a tuned motion spec that maximizes resonance with the viewer.
 * Returns adjusted durations and easings without mutating the input.
 */
export function tuneForResonance(spec: MotionSpec, viewer?: ViewerState): {
  tunedSpec: MotionSpec;
  adjustments: Array<{ componentId: string; field: string; oldValue: unknown; newValue: unknown; reason: string }>;
  summary: string;
} {
  const v = viewer ?? defaultViewerState();
  const analysis = analyzeResonance(spec, v);
  const adjustments: Array<{ componentId: string; field: string; oldValue: unknown; newValue: unknown; reason: string }> = [];

  const tunedComponents = spec.components.map((comp: MotionComponent) => {
    const newComp = { ...comp };
    let changed = false;

    for (const rec of analysis.recommendations) {
      if (rec.componentId !== comp.id) continue;

      if (typeof rec.newValue === "number" && rec.adjustment.includes("duration")) {
        adjustments.push({
          componentId: comp.id,
          field: "durationMs",
          oldValue: comp.durationMs,
          newValue: rec.newValue,
          reason: rec.adjustment,
        });
        newComp.durationMs = rec.newValue;
        changed = true;
      } else if (typeof rec.newValue === "string" && rec.adjustment.includes("easing")) {
        adjustments.push({
          componentId: comp.id,
          field: "easing",
          oldValue: comp.easing,
          newValue: { type: "preset", name: rec.newValue },
          reason: rec.adjustment,
        });
        newComp.easing = { type: "preset", name: rec.newValue as never };
        changed = true;
      }
    }

    return changed ? newComp : comp;
  });

  const tunedSpec = { ...spec, components: tunedComponents };

  return {
    tunedSpec,
    adjustments,
    summary: `Tuned ${adjustments.length} parameter(s) across ${new Set(adjustments.map((a) => a.componentId)).size} component(s) for optimal resonance`,
  };
}

/** Format a resonance analysis as a human-readable report. */
export function formatResonanceReport(analysis: ResonanceAnalysis): string {
  const lines: string[] = [
    "Motion Resonance Analysis",
    "=========================",
    "",
    `Overall Resonance: ${(analysis.resonance * 100).toFixed(1)}%`,
    `Cognitive Alignment: ${(analysis.cognitiveAlignment * 100).toFixed(1)}%`,
    `Emotional Alignment: ${(analysis.emotionalAlignment * 100).toFixed(1)}%`,
    `Rhythmic Alignment: ${(analysis.rhythmicAlignment * 100).toFixed(1)}%`,
    "",
  ];

  if (analysis.dissonances.length > 0) {
    lines.push("Dissonance Points:");
    for (const d of analysis.dissonances) {
      lines.push(`  • [${d.type}] ${d.componentId}: ${d.description} (severity: ${(d.severity * 100).toFixed(0)}%)`);
    }
    lines.push("");
  }

  if (analysis.recommendations.length > 0) {
    lines.push("Recommendations:");
    for (const r of analysis.recommendations) {
      lines.push(`  • ${r.componentId}: ${r.adjustment} → ${r.newValue} (expected gain: +${(r.expectedGain * 100).toFixed(0)}%)`);
    }
    lines.push("");
  }

  lines.push(`Summary: ${analysis.summary}`);
  return lines.join("\n");
}
