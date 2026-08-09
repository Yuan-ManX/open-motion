/**
 * Motion Harmonics Engine — analyzes motion as waveforms and computes
 * harmonic relationships between components.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Frequency signature of a single component. */
export interface FrequencySignature {
  componentId: string;
  /** Fundamental frequency in Hz. */
  fundamentalHz: number;
  /** Period in milliseconds. */
  periodMs: number;
  /** Whether the component is cyclic (loops). */
  isCyclic: boolean;
  /** Amplitude estimate 0..1 (intensity of the motion). */
  amplitude: number;
  /** Waveform shape classification. */
  waveform: "sine" | "triangle" | "square" | "sawtooth" | "pulse" | "noise";
  /** Overtone strengths (relative to fundamental). */
  overtones: number[];
}

/** Harmonic relationship between two components. */
export interface HarmonicRelation {
  componentAId: string;
  componentBId: string;
  /** Frequency ratio (fundamentalA / fundamentalB). */
  ratio: number;
  /** Simplified ratio as a string (e.g., "2:1", "3:2", "complex"). */
  ratioLabel: string;
  /** Consonance score 0..1 (1 = perfectly consonant). */
  consonance: number;
  /** Relationship classification. */
  type: "unison" | "octave" | "fifth" | "fourth" | "third" | "consonant" | "dissonant" | "incomparable";
  /** Description. */
  description: string;
}

/** Harmonic analysis result. */
export interface HarmonicAnalysis {
  /** Frequency signatures for all cyclic components. */
  signatures: FrequencySignature[];
  /** Pairwise harmonic relations. */
  relations: HarmonicRelation[];
  /** Overall harmonic complexity 0..1. */
  complexity: number;
  /** Overall consonance 0..1. */
  consonance: number;
  /** Dominant frequency in Hz. */
  dominantFrequency: number;
  /** Spectral centroid in Hz (perceptual "brightness"). */
  spectralCentroid: number;
  /** Number of detected beat frequencies (dissonance indicators). */
  beatCount: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Frequency Signature Extraction
// ---------------------------------------------------------------------------

/**
 * Extract the frequency signature of a component by analyzing its duration,
 * loop count, easing curve, and keyframe structure.
 */
export function extractFrequencySignature(comp: MotionComponent): FrequencySignature {
  const durationSec = comp.durationMs / 1000;
  const isLooping = comp.iterationCount === "infinite" ||
    (typeof comp.iterationCount === "number" && comp.iterationCount > 1);

  const fundamentalHz = isLooping && durationSec > 0 ? 1 / durationSec : 0;
  const periodMs = isLooping ? comp.durationMs : 0;

  // Amplitude from keyframe range
  const amplitude = estimateAmplitude(comp);

  // Waveform from easing
  const waveform = classifyWaveform(comp);

  // Overtones from waveform shape
  const overtones = computeOvertones(waveform, amplitude);

  return {
    componentId: comp.id,
    fundamentalHz,
    periodMs,
    isCyclic: isLooping,
    amplitude,
    waveform,
    overtones,
  };
}

/** Estimate motion amplitude 0..1 from keyframe property range. */
function estimateAmplitude(comp: MotionComponent): number {
  if (!comp.keyframes || comp.keyframes.length < 2) return 0.5;

  let maxDelta = 0;
  for (let i = 1; i < comp.keyframes.length; i++) {
    const prev = comp.keyframes[i - 1].properties as Record<string, string | number>;
    const curr = comp.keyframes[i].properties as Record<string, string | number>;
    for (const key of Object.keys(curr)) {
      if (typeof curr[key] === "number" && typeof prev[key] === "number") {
        const delta = Math.abs((curr[key] as number) - (prev[key] as number));
        maxDelta = Math.max(maxDelta, delta);
      }
    }
  }

  // Normalize: 0-100px or 0-360deg or 0-1 scale
  return Math.min(1, maxDelta / 100);
}

/** Classify the waveform shape from easing curve. */
function classifyWaveform(comp: MotionComponent): FrequencySignature["waveform"] {
  const easing = comp.easing;
  if (!easing || typeof easing !== "object") return "sine";

  if (easing.type === "spring") return "sine";
  if (easing.type === "preset") {
    switch (easing.name) {
      case "linear": return "sawtooth";
      case "bounce": return "pulse";
      case "elastic": return "sine";
      case "snappy": return "pulse";
      case "smooth": return "sine";
      case "soft": return "triangle";
      case "ease":
      case "ease-in":
      case "ease-out":
      case "ease-in-out": return "sine";
      default: return "sine";
    }
  }
  if (easing.type === "bezier") return "triangle";
  return "sine";
}

/** Compute overtone strengths based on waveform type. */
function computeOvertones(waveform: FrequencySignature["waveform"], amplitude: number): number[] {
  // Fourier series for common waveforms (relative to fundamental amplitude = 1)
  switch (waveform) {
    case "sine":
      // Pure sine — no overtones
      return [];
    case "triangle":
      // Odd harmonics, 1/n² decay
      return [0, amplitude * 0.111, 0, amplitude * 0.04, 0, amplitude * 0.02];
    case "square":
      // Odd harmonics, 1/n decay
      return [0, amplitude * 0.333, 0, amplitude * 0.2, 0, amplitude * 0.143];
    case "sawtooth":
      // All harmonics, 1/n decay
      return [amplitude * 0.5, amplitude * 0.333, amplitude * 0.25, amplitude * 0.2, amplitude * 0.167, amplitude * 0.143];
    case "pulse":
      // Sharp transient — rich spectrum
      return [amplitude * 0.7, amplitude * 0.5, amplitude * 0.4, amplitude * 0.3, amplitude * 0.25, amplitude * 0.2];
    case "noise":
      // Random — flat spectrum
      return [amplitude * 0.3, amplitude * 0.3, amplitude * 0.3, amplitude * 0.3, amplitude * 0.3, amplitude * 0.3];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Harmonic Relation Analysis
// ---------------------------------------------------------------------------

/** Tolerance for ratio matching (allow slight detuning). */
const RATIO_TOLERANCE = 0.03;

/**
 * Compute the harmonic relation between two frequency signatures.
 */
export function computeHarmonicRelation(a: FrequencySignature, b: FrequencySignature): HarmonicRelation | null {
  if (!a.isCyclic || !b.isCyclic || a.fundamentalHz === 0 || b.fundamentalHz === 0) {
    return null;
  }

  // Ensure a has the higher frequency
  const hi = a.fundamentalHz >= b.fundamentalHz ? a : b;
  const lo = a.fundamentalHz >= b.fundamentalHz ? b : a;
  const ratio = hi.fundamentalHz / lo.fundamentalHz;

  const ratioLabel = simplifyRatio(ratio);
  const { consonance, type } = classifyRatio(ratio);
  const description = describeRelation(type, ratioLabel, hi.componentId, lo.componentId);

  return {
    componentAId: a.componentId,
    componentBId: b.componentId,
    ratio,
    ratioLabel,
    consonance,
    type,
    description,
  };
}

/** Simplify a frequency ratio to a human-readable label. */
function simplifyRatio(ratio: number): string {
  // Common musical ratios
  const common = [
    { ratio: 1, label: "1:1" },
    { ratio: 2, label: "2:1" },
    { ratio: 1.5, label: "3:2" },
    { ratio: 4 / 3, label: "4:3" },
    { ratio: 5 / 4, label: "5:4" },
    { ratio: 6 / 5, label: "6:5" },
    { ratio: 3, label: "3:1" },
    { ratio: 4, label: "4:1" },
  ];

  for (const c of common) {
    if (Math.abs(ratio - c.ratio) < RATIO_TOLERANCE) return c.label;
  }

  // Find the best small-integer approximation
  for (let denom = 1; denom <= 8; denom++) {
    const numer = Math.round(ratio * denom);
    if (numer > 0 && numer <= 16) {
      const approxRatio = numer / denom;
      if (Math.abs(ratio - approxRatio) / ratio < 0.05) {
        return `${numer}:${denom}`;
      }
    }
  }

  return "complex";
}

/** Classify a frequency ratio and compute consonance. */
function classifyRatio(ratio: number): { consonance: number; type: HarmonicRelation["type"] } {
  // Unison
  if (Math.abs(ratio - 1) < RATIO_TOLERANCE) {
    return { consonance: 1.0, type: "unison" };
  }
  // Octave (2:1)
  if (Math.abs(ratio - 2) < RATIO_TOLERANCE) {
    return { consonance: 0.95, type: "octave" };
  }
  // Perfect fifth (3:2)
  if (Math.abs(ratio - 1.5) < RATIO_TOLERANCE) {
    return { consonance: 0.9, type: "fifth" };
  }
  // Perfect fourth (4:3)
  if (Math.abs(ratio - 4 / 3) < RATIO_TOLERANCE) {
    return { consonance: 0.85, type: "fourth" };
  }
  // Major third (5:4)
  if (Math.abs(ratio - 5 / 4) < RATIO_TOLERANCE) {
    return { consonance: 0.8, type: "third" };
  }
  // Minor third (6:5)
  if (Math.abs(ratio - 6 / 5) < RATIO_TOLERANCE) {
    return { consonance: 0.75, type: "third" };
  }

  // Higher octaves
  if (Math.abs(ratio - 3) < RATIO_TOLERANCE || Math.abs(ratio - 4) < RATIO_TOLERANCE) {
    return { consonance: 0.85, type: "octave" };
  }

  // Consonant if simple integer ratio
  for (let denom = 1; denom <= 8; denom++) {
    const numer = Math.round(ratio * denom);
    if (numer > 0 && numer <= 16) {
      const approxRatio = numer / denom;
      if (Math.abs(ratio - approxRatio) / ratio < 0.05) {
        return { consonance: 0.6, type: "consonant" };
      }
    }
  }

  // Otherwise dissonant
  return { consonance: 0.3, type: "dissonant" };
}

/** Generate a human-readable description of a harmonic relation. */
function describeRelation(
  type: HarmonicRelation["type"],
  ratioLabel: string,
  hiId: string,
  loId: string,
): string {
  switch (type) {
    case "unison":
      return `Components ${hiId} and ${loId} are in unison (${ratioLabel}) — they share the same cycle, creating a reinforced pulse`;
    case "octave":
      return `Components ${hiId} and ${loId} form an octave (${ratioLabel}) — the faster motion completes exactly N cycles per slower cycle, creating hierarchical unity`;
    case "fifth":
      return `Components ${hiId} and ${loId} form a perfect fifth (${ratioLabel}) — strongly consonant, the foundation of harmonic motion`;
    case "fourth":
      return `Components ${hiId} and ${loId} form a perfect fourth (${ratioLabel}) — consonant with a subtle tension that adds interest`;
    case "third":
      return `Components ${hiId} and ${loId} form a third (${ratioLabel}) — the basis of harmonic color, adding emotional richness`;
    case "consonant":
      return `Components ${hiId} and ${loId} form a consonant ratio (${ratioLabel}) — pleasant and stable`;
    case "dissonant":
      return `Components ${hiId} and ${loId} form a complex ratio (${ratioLabel}) — dissonant, creating beating patterns and tension`;
    default:
      return `Components ${hiId} and ${loId} have no clear harmonic relation`;
  }
}

// ---------------------------------------------------------------------------
// Spectral Analysis
// ---------------------------------------------------------------------------

/** Compute the spectral centroid (perceptual brightness) of the composition. */
function computeSpectralCentroid(signatures: FrequencySignature[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const sig of signatures) {
    if (!sig.isCyclic || sig.fundamentalHz === 0) continue;
    const weight = sig.amplitude;
    weightedSum += sig.fundamentalHz * weight;
    totalWeight += weight;

    // Include overtones
    for (let i = 0; i < sig.overtones.length; i++) {
      if (sig.overtones[i] === 0) continue;
      const overtoneFreq = sig.fundamentalHz * (i + 2);
      weightedSum += overtoneFreq * sig.overtones[i];
      totalWeight += sig.overtones[i];
    }
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/** Compute the dominant frequency (highest amplitude). */
function computeDominantFrequency(signatures: FrequencySignature[]): number {
  let dominant = 0;
  let maxAmp = 0;
  for (const sig of signatures) {
    if (!sig.isCyclic) continue;
    if (sig.amplitude > maxAmp) {
      maxAmp = sig.amplitude;
      dominant = sig.fundamentalHz;
    }
  }
  return dominant;
}

/** Count beat frequencies (pairs that produce perceptible beating). */
function countBeats(relations: HarmonicRelation[]): number {
  return relations.filter((r) => r.type === "dissonant" && r.consonance < 0.4).length;
}

/** Compute overall harmonic complexity from the spectrum. */
function computeComplexity(signatures: FrequencySignature[]): number {
  if (signatures.length === 0) return 0;

  let totalOvertones = 0;
  let cyclicCount = 0;
  const waveformDiversity = new Set<string>();

  for (const sig of signatures) {
    if (sig.isCyclic) {
      cyclicCount++;
      totalOvertones += sig.overtones.filter((o) => o > 0).length;
      waveformDiversity.add(sig.waveform);
    }
  }

  if (cyclicCount === 0) return 0;

  // Complexity factors:
  // - Number of cyclic components (more = richer)
  // - Overtone richness (more overtones = denser spectrum)
  // - Waveform diversity (different shapes = richer texture)
  const densityFactor = Math.min(1, cyclicCount / 6);
  const overtoneFactor = Math.min(1, totalOvertones / 20);
  const diversityFactor = Math.min(1, waveformDiversity.size / 4);

  return densityFactor * 0.4 + overtoneFactor * 0.4 + diversityFactor * 0.2;
}

/** Compute overall consonance from pairwise relations. */
function computeOverallConsonance(relations: HarmonicRelation[]): number {
  if (relations.length === 0) return 1.0;
  const sum = relations.reduce((acc, r) => acc + r.consonance, 0);
  return sum / relations.length;
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Analyze the harmonic structure of a motion composition.
 */
export function analyzeHarmonics(spec: MotionSpec): HarmonicAnalysis {
  const signatures = spec.components.map(extractFrequencySignature);
  const cyclicSigs = signatures.filter((s) => s.isCyclic);

  // Compute all pairwise relations
  const relations: HarmonicRelation[] = [];
  for (let i = 0; i < cyclicSigs.length; i++) {
    for (let j = i + 1; j < cyclicSigs.length; j++) {
      const rel = computeHarmonicRelation(cyclicSigs[i], cyclicSigs[j]);
      if (rel) relations.push(rel);
    }
  }

  const complexity = computeComplexity(signatures);
  const consonance = computeOverallConsonance(relations);
  const dominantFrequency = computeDominantFrequency(signatures);
  const spectralCentroid = computeSpectralCentroid(signatures);
  const beatCount = countBeats(relations);

  const cyclicCount = cyclicSigs.length;
  const summary = `Harmonic analysis: ${cyclicCount} cyclic component(s), ${relations.length} relation(s) ` +
    `(complexity ${complexity.toFixed(2)}, consonance ${consonance.toFixed(2)}, ` +
    `dominant ${dominantFrequency.toFixed(2)} Hz, centroid ${spectralCentroid.toFixed(2)} Hz, ` +
    `${beatCount} beating pair(s))`;

  return {
    signatures,
    relations,
    complexity,
    consonance,
    dominantFrequency,
    spectralCentroid,
    beatCount,
    summary,
  };
}

/** Find components that harmonize with a given component. */
export function findHarmonics(spec: MotionSpec, componentId: string): {
  target: FrequencySignature | null;
  compatible: HarmonicRelation[];
  dissonant: HarmonicRelation[];
} {
  const signatures = spec.components.map(extractFrequencySignature);
  const target = signatures.find((s) => s.componentId === componentId) ?? null;

  if (!target || !target.isCyclic) {
    return { target, compatible: [], dissonant: [] };
  }

  const compatible: HarmonicRelation[] = [];
  const dissonant: HarmonicRelation[] = [];

  for (const sig of signatures) {
    if (sig.componentId === componentId || !sig.isCyclic) continue;
    const rel = computeHarmonicRelation(target, sig);
    if (!rel) continue;
    if (rel.consonance >= 0.7) compatible.push(rel);
    else dissonant.push(rel);
  }

  return { target, compatible, dissonant };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a harmonic analysis as a human-readable report. */
export function formatHarmonicsReport(analysis: HarmonicAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Harmonics Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  if (analysis.signatures.filter((s) => s.isCyclic).length === 0) {
    lines.push("No cyclic components detected — harmonic analysis requires looping motion.");
    return lines.join("\n");
  }

  lines.push("## Frequency Signatures");
  for (const sig of analysis.signatures) {
    if (!sig.isCyclic) {
      lines.push(`- ${sig.componentId}: non-cyclic (one-shot)`);
    } else {
      lines.push(
        `- ${sig.componentId}: ${sig.fundamentalHz.toFixed(2)} Hz (${sig.waveform}, amplitude ${sig.amplitude.toFixed(2)}, ${sig.overtones.filter((o) => o > 0).length} overtones)`,
      );
    }
  }
  lines.push("");

  if (analysis.relations.length > 0) {
    lines.push("## Harmonic Relations");
    for (const rel of analysis.relations) {
      lines.push(`- [${rel.type}] ${rel.ratioLabel} — ${rel.description}`);
    }
    lines.push("");
  }

  lines.push("## Spectrum");
  lines.push(`- Complexity: ${(analysis.complexity * 100).toFixed(0)}%`);
  lines.push(`- Consonance: ${(analysis.consonance * 100).toFixed(0)}%`);
  lines.push(`- Dominant frequency: ${analysis.dominantFrequency.toFixed(2)} Hz`);
  lines.push(`- Spectral centroid: ${analysis.spectralCentroid.toFixed(2)} Hz`);
  lines.push(`- Beating pairs: ${analysis.beatCount}`);

  return lines.join("\n");
}
