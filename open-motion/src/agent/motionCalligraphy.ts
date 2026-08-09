/** Motion Calligraphy Engine — analyzes motion as calligraphic art. */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A calligraphic stroke analysis for a single component. */
export interface StrokeAnalysis {
  componentId: string;
  /** Brush pressure 0..1 (intensity of the stroke). */
  pressure: number;
  /** Stroke velocity 0..1 (speed of the motion). */
  velocity: number;
  /** Fluency 0..1 (smoothness and continuity). */
  fluency: number;
  /** Ink deposition pattern. */
  inkFlow: "wet" | "medium" | "dry" | "splatter";
  /** Stroke type classification. */
  strokeType: "dot" | "dash" | "line" | "curve" | "hook" | "complex";
  /** Stroke character. */
  character: "regular" | "cursive" | "running" | "wild";
  /** Description. */
  description: string;
}

/** Calligraphic composition analysis. */
export interface CalligraphyAnalysis {
  /** Per-stroke analysis. */
  strokes: StrokeAnalysis[];
  /** Overall brush pressure 0..1. */
  overallPressure: number;
  /** Overall velocity 0..1. */
  overallVelocity: number;
  /** Overall fluency 0..1. */
  overallFluency: number;
  /** Ink usage classification. */
  inkUsage: "sparse" | "economical" | "balanced" | "lavish" | "saturated";
  /** Dominant stroke character. */
  dominantCharacter: "regular" | "cursive" | "running" | "wild";
  /** Composition style classification. */
  style: "kaisho" | "gyosho" | "sosho" | "mixed";
  /** Rhythm classification. */
  rhythm: "measured" | "flowing" | "dynamic" | "erratic";
  /** Spatial balance 0..1. */
  balance: number;
  /** Expressive power 0..1. */
  expressiveness: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Stroke Analysis
// ---------------------------------------------------------------------------

/** Analyze a single component as a calligraphic stroke. */
export function analyzeStroke(comp: MotionComponent): StrokeAnalysis {
  const pressure = computePressure(comp);
  const velocity = computeVelocity(comp);
  const fluency = computeFluency(comp);
  const inkFlow = classifyInkFlow(comp, pressure);
  const strokeType = classifyStrokeType(comp);
  const character = classifyCharacter(pressure, velocity, fluency);

  const description = `${character} ${strokeType} — pressure ${(pressure * 100).toFixed(0)}%, ` +
    `velocity ${(velocity * 100).toFixed(0)}%, fluency ${(fluency * 100).toFixed(0)}%, ink ${inkFlow}`;

  return {
    componentId: comp.id,
    pressure,
    velocity,
    fluency,
    inkFlow,
    strokeType,
    character,
    description,
  };
}

/** Compute brush pressure from motion intensity. */
function computePressure(comp: MotionComponent): number {
  // Pressure = intensity of motion
  // Short duration + many keyframes = high pressure
  const durationFactor = comp.durationMs < 500 ? 0.9 : comp.durationMs < 1500 ? 0.6 : 0.3;
  const keyframeFactor = Math.min(1, (comp.keyframes?.length ?? 2) / 8);

  // Spring easing = more pressure
  let easingFactor = 0.5;
  if (comp.easing && typeof comp.easing === "object") {
    if (comp.easing.type === "spring") easingFactor = 0.8;
    else if (comp.easing.type === "preset") {
      const intense = ["bounce", "elastic", "back", "snappy"];
      if (intense.includes(comp.easing.name)) easingFactor = 0.7;
    }
  }

  return Math.min(1, durationFactor * 0.4 + keyframeFactor * 0.3 + easingFactor * 0.3);
}

/** Compute stroke velocity from duration. */
function computeVelocity(comp: MotionComponent): number {
  // Shorter duration = faster stroke
  if (comp.durationMs < 200) return 1.0;
  if (comp.durationMs < 500) return 0.85;
  if (comp.durationMs < 1000) return 0.6;
  if (comp.durationMs < 2000) return 0.4;
  if (comp.durationMs < 4000) return 0.2;
  return 0.1;
}

/** Compute fluency from easing smoothness. */
function computeFluency(comp: MotionComponent): number {
  if (!comp.easing) return 0.5;
  if (typeof comp.easing !== "object") return 0.5;

  if (comp.easing.type === "spring") {
    // Springs can be fluent or jerky depending on damping
    if ("damping" in comp.easing && typeof comp.easing.damping === "number") {
      return Math.min(1, comp.easing.damping / 30);
    }
    return 0.6;
  }
  if (comp.easing.type === "preset") {
    const fluent = ["smooth", "soft", "ease", "ease-in-out", "linear"];
    const jerky = ["bounce", "elastic", "snappy"];
    if (fluent.includes(comp.easing.name)) return 0.9;
    if (jerky.includes(comp.easing.name)) return 0.4;
    return 0.7;
  }
  if (comp.easing.type === "bezier") return 0.8;
  return 0.5;
}

/** Classify ink flow pattern. */
function classifyInkFlow(comp: MotionComponent, pressure: number): StrokeAnalysis["inkFlow"] {
  // Check opacity keyframes for ink buildup/fade
  const opacityKeyframes = comp.keyframes?.filter((kf) => {
    const props = kf.properties as Record<string, string | number>;
    return "opacity" in props;
  }) ?? [];

  if (opacityKeyframes.length >= 3) {
    // Multiple opacity changes = splatter
    return "splatter";
  }

  if (pressure > 0.8) return "wet";
  if (pressure > 0.5) return "medium";
  if (pressure > 0.2) return "dry";
  return "dry";
}

/** Classify stroke type from keyframe structure. */
function classifyStrokeType(comp: MotionComponent): StrokeAnalysis["strokeType"] {
  const keyframeCount = comp.keyframes?.length ?? 0;
  if (keyframeCount <= 1) return "dot";
  if (keyframeCount === 2) {
    // Check if it involves rotation (hook) or translation (line)
    const props = comp.keyframes[0].properties as Record<string, string | number>;
    if ("rotate" in props) return "hook";
    if ("translateX" in props || "translateY" in props) return "line";
    return "dash";
  }
  if (keyframeCount <= 4) return "curve";
  return "complex";
}

/** Classify stroke character from pressure, velocity, and fluency. */
function classifyCharacter(
  pressure: number,
  velocity: number,
  fluency: number,
): StrokeAnalysis["character"] {
  const expressiveness = pressure * 0.4 + velocity * 0.3 + (1 - fluency) * 0.3;

  if (expressiveness < 0.3) return "regular";    // Kaisho-like: controlled, precise
  if (expressiveness < 0.5) return "cursive";     // Gyosho-like: semi-cursive
  if (expressiveness < 0.7) return "running";     // Running script
  return "wild";                                   // Sosho-like: wild cursive
}

// ---------------------------------------------------------------------------
// Composition Analysis
// ---------------------------------------------------------------------------

/** Classify ink usage from total pressure. */
function classifyInkUsage(avgPressure: number, strokeCount: number): CalligraphyAnalysis["inkUsage"] {
  const totalInk = avgPressure * strokeCount;
  if (totalInk < 0.5) return "sparse";
  if (totalInk < 1.5) return "economical";
  if (totalInk < 3) return "balanced";
  if (totalInk < 5) return "lavish";
  return "saturated";
}

/** Classify composition style from dominant character. */
function classifyStyle(strokes: StrokeAnalysis[]): CalligraphyAnalysis["style"] {
  if (strokes.length === 0) return "mixed";
  const counts = new Map<string, number>();
  for (const s of strokes) {
    counts.set(s.character, (counts.get(s.character) ?? 0) + 1);
  }
  const dominant = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];

  // Check if mixed (no clear dominance)
  const dominantRatio = (counts.get(dominant) ?? 0) / strokes.length;
  if (dominantRatio < 0.5) return "mixed";

  switch (dominant) {
    case "regular": return "kaisho";   // Formal, block style
    case "cursive": return "gyosho";   // Semi-cursive
    case "running": return "sosho";    // Cursive
    case "wild": return "sosho";       // Wild cursive
    default: return "mixed";
  }
}

/** Classify rhythm from stroke timing. */
function classifyRhythm(strokes: StrokeAnalysis[]): CalligraphyAnalysis["rhythm"] {
  if (strokes.length < 2) return "measured";

  const velocities = strokes.map((s) => s.velocity);
  const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const variance = velocities.reduce((sum, v) => sum + Math.pow(v - avgVel, 2), 0) / velocities.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev < 0.1) {
    return avgVel > 0.6 ? "flowing" : "measured";
  }
  if (stdDev < 0.25) return "dynamic";
  return "erratic";
}

/** Compute spatial balance from stroke distribution. */
function computeBalance(strokes: StrokeAnalysis[]): number {
  if (strokes.length === 0) return 0;
  // Balance = 1 - normalized variance of pressures
  const pressures = strokes.map((s) => s.pressure);
  const avg = pressures.reduce((a, b) => a + b, 0) / pressures.length;
  const variance = pressures.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / pressures.length;
  return Math.max(0, 1 - Math.sqrt(variance));
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/** Analyze a motion composition as calligraphic art. */
export function analyzeCalligraphy(spec: MotionSpec): CalligraphyAnalysis {
  const strokes = spec.components.map(analyzeStroke);

  if (strokes.length === 0) {
    return {
      strokes: [],
      overallPressure: 0,
      overallVelocity: 0,
      overallFluency: 0,
      inkUsage: "sparse",
      dominantCharacter: "regular",
      style: "mixed",
      rhythm: "measured",
      balance: 0,
      expressiveness: 0,
      summary: "No strokes — empty canvas.",
    };
  }

  const overallPressure = strokes.reduce((sum, s) => sum + s.pressure, 0) / strokes.length;
  const overallVelocity = strokes.reduce((sum, s) => sum + s.velocity, 0) / strokes.length;
  const overallFluency = strokes.reduce((sum, s) => sum + s.fluency, 0) / strokes.length;

  const inkUsage = classifyInkUsage(overallPressure, strokes.length);

  // Dominant character
  const charCounts = new Map<string, number>();
  for (const s of strokes) {
    charCounts.set(s.character, (charCounts.get(s.character) ?? 0) + 1);
  }
  const dominantCharacter = (Array.from(charCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "regular") as
    StrokeAnalysis["character"];

  const style = classifyStyle(strokes);
  const rhythm = classifyRhythm(strokes);
  const balance = computeBalance(strokes);

  // Expressiveness = pressure * velocity * (1 - fluency)
  const expressiveness = overallPressure * 0.4 + overallVelocity * 0.3 + (1 - overallFluency) * 0.3;

  const summary = `Calligraphy: ${strokes.length} stroke(s), style=${style}, rhythm=${rhythm}, ` +
    `pressure ${(overallPressure * 100).toFixed(0)}%, velocity ${(overallVelocity * 100).toFixed(0)}%, ` +
    `fluency ${(overallFluency * 100).toFixed(0)}%, ink=${inkUsage}, ` +
    `balance ${(balance * 100).toFixed(0)}%, expressiveness ${(expressiveness * 100).toFixed(0)}%`;

  return {
    strokes,
    overallPressure,
    overallVelocity,
    overallFluency,
    inkUsage,
    dominantCharacter,
    style,
    rhythm,
    balance,
    expressiveness,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a calligraphy analysis as a human-readable report. */
export function formatCalligraphyReport(analysis: CalligraphyAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Calligraphy Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  lines.push("## Strokes");
  for (const s of analysis.strokes) {
    lines.push(`- ${s.componentId}: ${s.description}`);
  }
  lines.push("");

  lines.push("## Composition");
  lines.push(`- Style: ${analysis.style}`);
  lines.push(`- Rhythm: ${analysis.rhythm}`);
  lines.push(`- Ink usage: ${analysis.inkUsage}`);
  lines.push(`- Dominant character: ${analysis.dominantCharacter}`);
  lines.push(`- Balance: ${(analysis.balance * 100).toFixed(0)}%`);
  lines.push(`- Expressiveness: ${(analysis.expressiveness * 100).toFixed(0)}%`);

  return lines.join("\n");
}
