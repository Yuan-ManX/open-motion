/**
 * Motion Entropy Engine — information-theoretic analysis of motion.
 *
 * This original AI-native module applies Shannon's information theory to
 * motion compositions. It measures the information content of motion
 * properties, detects redundancy between components, quantifies the
 * information density across the timeline, and reveals whether a
 * composition is information-rich (varied, surprising) or information-poor
 * (repetitive, predictable).
 *
 * Core concepts:
 * - Shannon Entropy: H(X) = -Σ p(x) log2 p(x), measures surprise in bits
 * - Mutual Information: I(X;Y) = H(X) + H(Y) - H(X,Y), measures shared info
 * - Information Density: bits of variation per unit time
 * - Redundancy: components that carry the same information
 * - Predictability: 1 - normalized entropy, how easy the motion is to forecast
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Entropy analysis of a single property dimension. */
export interface PropertyEntropy {
  /** Property name (e.g., "easing", "durationMs", "translateX"). */
  property: string;
  /** Shannon entropy in bits. */
  entropyBits: number;
  /** Normalized entropy 0..1 (entropy / max possible entropy). */
  normalized: number;
  /** Number of distinct values. */
  distinctValues: number;
  /** Distribution of values. */
  distribution: Array<{ value: string; count: number; probability: number }>;
}

/** Mutual information between two components. */
export interface MutualInformation {
  componentAId: string;
  componentBId: string;
  /** Mutual information in bits. */
  mutualInfoBits: number;
  /** Normalized mutual information 0..1. */
  normalized: number;
  /** Relationship classification. */
  type: "independent" | "weak" | "moderate" | "strong" | "redundant";
  /** Description. */
  description: string;
}

/** Information density over time. */
export interface DensityWindow {
  /** Window start time in ms. */
  startMs: number;
  /** Window end time in ms. */
  endMs: number;
  /** Number of active components. */
  activeCount: number;
  /** Information density (bits/ms). */
  densityBitsPerMs: number;
  /** Entropy of the window. */
  entropyBits: number;
}

/** Entropy analysis result. */
export interface EntropyAnalysis {
  /** Per-property entropy. */
  propertyEntropies: PropertyEntropy[];
  /** Pairwise mutual information. */
  mutualInformation: MutualInformation[];
  /** Information density over time. */
  densityWindows: DensityWindow[];
  /** Overall composition entropy in bits. */
  overallEntropyBits: number;
  /** Overall normalized entropy 0..1. */
  overallNormalized: number;
  /** Overall predictability 0..1 (1 - normalized entropy). */
  predictability: number;
  /** Overall redundancy 0..1 (average normalized mutual info). */
  redundancy: number;
  /** Information density classification. */
  densityClass: "sparse" | "balanced" | "dense" | "saturated";
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Shannon Entropy Computation
// ---------------------------------------------------------------------------

/**
 * Compute Shannon entropy of a list of values.
 * Returns entropy in bits and the probability distribution.
 */
function shannonEntropy(values: string[]): {
  entropyBits: number;
  distribution: Array<{ value: string; count: number; probability: number }>;
} {
  if (values.length === 0) {
    return { entropyBits: 0, distribution: [] };
  }

  // Count occurrences
  const counts = new Map<string, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }

  const total = values.length;
  const distribution: Array<{ value: string; count: number; probability: number }> = [];
  let entropyBits = 0;

  for (const [value, count] of counts) {
    const p = count / total;
    distribution.push({ value, count, probability: p });
    if (p > 0) {
      entropyBits -= p * Math.log2(p);
    }
  }

  distribution.sort((a, b) => b.count - a.count);
  return { entropyBits, distribution };
}

/**
 * Compute the entropy of a single property across all components.
 */
export function computePropertyEntropy(spec: MotionSpec, property: string): PropertyEntropy {
  const values = spec.components.map((c) => extractPropertyValue(c, property));
  const { entropyBits, distribution } = shannonEntropy(values);
  const distinctValues = distribution.length;
  // Max entropy = log2(n) for n distinct values
  const maxEntropy = distinctValues > 1 ? Math.log2(distinctValues) : 0;
  const normalized = maxEntropy > 0 ? entropyBits / maxEntropy : 0;

  return {
    property,
    entropyBits,
    normalized,
    distinctValues,
    distribution,
  };
}

/** Extract a string representation of a property from a component. */
function extractPropertyValue(comp: MotionComponent, property: string): string {
  switch (property) {
    case "easing":
      if (!comp.easing) return "none";
      if (typeof comp.easing === "object") {
        if (comp.easing.type === "preset") return `preset:${comp.easing.name}`;
        if (comp.easing.type === "spring") return "spring";
        if (comp.easing.type === "bezier") return "bezier";
        return String((comp.easing as { type: string }).type);
      }
      return String(comp.easing);
    case "durationMs": {
      // Bucket durations
      const d = comp.durationMs;
      if (d < 500) return "very-short";
      if (d < 1000) return "short";
      if (d < 2000) return "medium";
      if (d < 4000) return "long";
      return "very-long";
    }
    case "iterationCount":
      return String(comp.iterationCount);
    case "direction":
      return comp.direction ?? "normal";
    case "delayMs": {
      const d = comp.delayMs;
      if (d === 0) return "none";
      if (d < 200) return "minimal";
      if (d < 800) return "short";
      if (d < 2000) return "medium";
      return "long";
    }
    case "name":
      return comp.name ?? "unnamed";
    case "trigger":
      return comp.trigger ?? "auto";
    default:
      return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Mutual Information
// ---------------------------------------------------------------------------

/**
 * Estimate mutual information between two components based on shared
 * property values. This is a heuristic approximation: components that
 * share many property values have high mutual information.
 */
export function computeMutualInformation(a: MotionComponent, b: MotionComponent): MutualInformation {
  const properties = ["easing", "durationMs", "iterationCount", "direction", "delayMs", "trigger"];
  let sharedBits = 0;
  let totalBits = 0;

  for (const prop of properties) {
    const va = extractPropertyValue(a, prop);
    const vb = extractPropertyValue(b, prop);
    // If both values are defined and equal, they share information
    if (va === vb && va !== "unknown") {
      // Information shared = log2(1/p) where p is the probability of the value
      // Approximate p as 0.2 (assuming 5 buckets on average)
      sharedBits += Math.log2(5);
    }
    if (va !== "unknown" && vb !== "unknown") {
      totalBits += Math.log2(5);
    }
  }

  const mutualInfoBits = sharedBits;
  const normalized = totalBits > 0 ? mutualInfoBits / totalBits : 0;
  const { type, description } = classifyMutualInfo(normalized, a.id, b.id);

  return {
    componentAId: a.id,
    componentBId: b.id,
    mutualInfoBits,
    normalized,
    type,
    description,
  };
}

/** Classify the strength of mutual information. */
function classifyMutualInfo(
  normalized: number,
  aId: string,
  bId: string,
): { type: MutualInformation["type"]; description: string } {
  if (normalized < 0.1) {
    return {
      type: "independent",
      description: `Components ${aId} and ${bId} are informationally independent — they share little to no design information`,
    };
  }
  if (normalized < 0.3) {
    return {
      type: "weak",
      description: `Components ${aId} and ${bId} have weak informational overlap — minor shared patterns`,
    };
  }
  if (normalized < 0.6) {
    return {
      type: "moderate",
      description: `Components ${aId} and ${bId} share moderate information — coordinated but distinct`,
    };
  }
  if (normalized < 0.85) {
    return {
      type: "strong",
      description: `Components ${aId} and ${bId} share strong information — they carry largely the same design knowledge`,
    };
  }
  return {
    type: "redundant",
    description: `Components ${aId} and ${bId} are informationally redundant — consider differentiating or removing one`,
  };
}

// ---------------------------------------------------------------------------
// Information Density Over Time
// ---------------------------------------------------------------------------

/**
 * Compute information density across the timeline in fixed-size windows.
 */
export function computeDensityWindows(spec: MotionSpec, windowMs = 1000): DensityWindow[] {
  if (spec.components.length === 0) return [];

  const timelineEnd = spec.components.reduce(
    (max, c) => Math.max(max, c.delayMs + c.durationMs),
    0,
  );

  const windows: DensityWindow[] = [];
  for (let start = 0; start < timelineEnd; start += windowMs) {
    const end = start + windowMs;
    const activeComponents = spec.components.filter(
      (c) => c.delayMs < end && c.delayMs + c.durationMs > start,
    );

    if (activeComponents.length === 0) continue;

    // Entropy of the window = entropy of active component names
    const names = activeComponents.map((c) => c.name ?? c.id);
    const { entropyBits } = shannonEntropy(names);

    const densityBitsPerMs = entropyBits / windowMs;

    windows.push({
      startMs: start,
      endMs: end,
      activeCount: activeComponents.length,
      densityBitsPerMs,
      entropyBits,
    });
  }

  return windows;
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Analyze the information-theoretic structure of a motion composition.
 */
export function analyzeEntropy(spec: MotionSpec): EntropyAnalysis {
  // Compute per-property entropy
  const properties = ["easing", "durationMs", "iterationCount", "direction", "delayMs", "trigger", "name"];
  const propertyEntropies = properties.map((p) => computePropertyEntropy(spec, p));

  // Compute pairwise mutual information
  const mutualInformation: MutualInformation[] = [];
  for (let i = 0; i < spec.components.length; i++) {
    for (let j = i + 1; j < spec.components.length; j++) {
      mutualInformation.push(computeMutualInformation(spec.components[i], spec.components[j]));
    }
  }

  // Compute density windows
  const densityWindows = computeDensityWindows(spec);

  // Overall entropy = average of normalized property entropies
  const validEntropies = propertyEntropies.filter((e) => e.distinctValues > 1);
  const overallNormalized = validEntropies.length > 0
    ? validEntropies.reduce((sum, e) => sum + e.normalized, 0) / validEntropies.length
    : 0;
  const overallEntropyBits = validEntropies.reduce((sum, e) => sum + e.entropyBits, 0);

  // Predictability = 1 - normalized entropy
  const predictability = 1 - overallNormalized;

  // Redundancy = average normalized mutual information
  const redundancy = mutualInformation.length > 0
    ? mutualInformation.reduce((sum, mi) => sum + mi.normalized, 0) / mutualInformation.length
    : 0;

  // Density classification
  const avgDensity = densityWindows.length > 0
    ? densityWindows.reduce((sum, w) => sum + w.activeCount, 0) / densityWindows.length
    : 0;
  const densityClass: EntropyAnalysis["densityClass"] =
    avgDensity < 1.5 ? "sparse" :
    avgDensity < 3 ? "balanced" :
    avgDensity < 6 ? "dense" :
    "saturated";

  const summary = `Entropy ${overallEntropyBits.toFixed(2)} bits (normalized ${overallNormalized.toFixed(2)}, ` +
    `predictability ${predictability.toFixed(2)}, redundancy ${redundancy.toFixed(2)}, ` +
    `${mutualInformation.length} pair(s), density ${densityClass})`;

  return {
    propertyEntropies,
    mutualInformation,
    densityWindows,
    overallEntropyBits,
    overallNormalized,
    predictability,
    redundancy,
    densityClass,
    summary,
  };
}

/**
 * Identify the most and least informative properties in the composition.
 */
export function identifyInformationHotspots(spec: MotionSpec): {
  mostVaried: PropertyEntropy[];
  leastVaried: PropertyEntropy[];
  redundantPairs: MutualInformation[];
} {
  const analysis = analyzeEntropy(spec);
  const sorted = [...analysis.propertyEntropies].sort((a, b) => b.normalized - a.normalized);
  return {
    mostVaried: sorted.slice(0, 3),
    leastVaried: sorted.slice(-3).reverse(),
    redundantPairs: analysis.mutualInformation.filter((mi) => mi.type === "redundant" || mi.type === "strong"),
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format an entropy analysis as a human-readable report. */
export function formatEntropyReport(analysis: EntropyAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Entropy Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  lines.push("## Property Entropy");
  for (const pe of analysis.propertyEntropies) {
    if (pe.distinctValues <= 1) continue;
    lines.push(
      `- ${pe.property}: ${pe.entropyBits.toFixed(2)} bits (normalized ${pe.normalized.toFixed(2)}, ${pe.distinctValues} values)`,
    );
  }
  lines.push("");

  if (analysis.mutualInformation.length > 0) {
    lines.push("## Mutual Information");
    for (const mi of analysis.mutualInformation) {
      lines.push(`- [${mi.type}] ${mi.normalized.toFixed(2)} — ${mi.description}`);
    }
    lines.push("");
  }

  if (analysis.densityWindows.length > 0) {
    lines.push("## Information Density");
    for (const w of analysis.densityWindows) {
      lines.push(
        `- ${w.startMs}-${w.endMs}ms: ${w.activeCount} active, ${w.entropyBits.toFixed(2)} bits, ${w.densityBitsPerMs.toFixed(4)} bits/ms`,
      );
    }
    lines.push("");
  }

  lines.push("## Summary");
  lines.push(`- Overall entropy: ${analysis.overallEntropyBits.toFixed(2)} bits`);
  lines.push(`- Normalized: ${(analysis.overallNormalized * 100).toFixed(0)}%`);
  lines.push(`- Predictability: ${(analysis.predictability * 100).toFixed(0)}%`);
  lines.push(`- Redundancy: ${(analysis.redundancy * 100).toFixed(0)}%`);
  lines.push(`- Density class: ${analysis.densityClass}`);

  return lines.join("\n");
}
