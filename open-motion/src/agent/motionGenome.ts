/**
 * Motion Genome — project-level population genetics for motion DNA.
 *
 * This is the ninth original AI-native module. Where Motion DNA decomposes a
 * single component into a genetic fingerprint, the Genome lifts the metaphor
 * to the project level: a population of components whose collective genetic
 * diversity, inbreeding coefficient, evolutionary tree, and monoculture
 * pressure can be measured and acted upon.
 *
 * Five core analytics:
 * 1. Genetic diversity — variance across easing family, timing tier, intensity,
 *    transform signature, and loop strategy. Higher = healthier population.
 * 2. Inbreeding coefficient — average pairwise DNA similarity. High values
 *    indicate monoculture (everything looks the same).
 * 3. Evolutionary tree — cluster components by DNA similarity into a tree,
 *    revealing family branches and outliers.
 * 4. Monoculture detection — flag when >60% of components share identical DNA
 *    along any single dimension (e.g., all using the same easing).
 * 5. Diversification suggestions — recommend which axes to vary next to break
 *    out of monoculture, anchored to specific components.
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, MotionSpec, Easing } from "@openmotion/shared";

/** A single dimension of motion DNA. */
type DnaDimension = "easing" | "timing" | "intensity" | "transform" | "loop";

/** The DNA signature of a single component along all dimensions. */
export interface ComponentDna {
  componentId: string;
  componentName: string;
  easingFamily: string;
  timingTier: string;
  intensityBucket: string;
  transformSignature: string;
  loopStrategy: string;
  /** Composite signature — pipe-joined, used for exact-match monoculture detection. */
  composite: string;
}

/** Diversity score for a single dimension. */
export interface DimensionDiversity {
  dimension: DnaDimension;
  /** 0..1 — fraction of unique values vs. total components. */
  uniqueRatio: number;
  /** Shannon entropy normalized to 0..1. */
  entropy: number;
  /** Distribution of values: value -> count. */
  distribution: Record<string, number>;
  /** Whether this dimension is monoculture (>60% same value). */
  monoculture: boolean;
  /** The dominant value, if monoculture. */
  dominantValue?: string;
  /** Dominant value's share (0..1). */
  dominantShare?: number;
}

/** A node in the evolutionary tree. */
export interface GenomeTreeNode {
  componentId: string;
  componentName: string;
  /** Cluster label — components sharing a label belong to the same family. */
  cluster: number;
  /** Distance from the cluster centroid (0..1). */
  distanceFromCentroid: number;
}

/** A diversification recommendation. */
export interface DiversificationSuggestion {
  dimension: DnaDimension;
  message: string;
  /** Component IDs that would benefit from varying this dimension. */
  componentIds: string[];
  componentNames: string[];
  /** Concrete suggestion — what to try instead. */
  recommendation: string;
}

/** The full genome report. */
export interface GenomeReport {
  componentCount: number;
  /** Overall diversity score 0..100 — higher is healthier. */
  diversityScore: number;
  /** Inbreeding coefficient 0..1 — higher means more monoculture. */
  inbreedingCoefficient: number;
  /** Per-dimension diversity breakdown. */
  dimensions: DimensionDiversity[];
  /** Clustered evolutionary tree. */
  tree: GenomeTreeNode[];
  /** Number of distinct families (clusters). */
  familyCount: number;
  /** Whether the project is in monoculture state. */
  isMonoculture: boolean;
  /** Axes flagged as monoculture. */
  monocultureAxes: DnaDimension[];
  /** Diversification recommendations. */
  suggestions: DiversificationSuggestion[];
  summary: string;
}

/** Classify an easing into a family token. */
function easingFamily(easing: Easing): string {
  if (easing.type === "preset") {
    const n = easing.name;
    if (/bounce|back|elastic/.test(n)) return "bounce";
    if (/smooth|ease-in-out|ease-out|soft/.test(n)) return "smooth";
    if (/snappy|ease-in/.test(n)) return "snappy";
    if (n === "linear") return "linear";
    return n;
  }
  if (easing.type === "spring") return "spring";
  if (easing.type === "bezier") return "bezier";
  return "linear";
}

/** Classify a duration into a timing tier. */
function timingTier(durationMs: number): string {
  if (durationMs < 300) return "fast";
  if (durationMs <= 800) return "normal";
  if (durationMs <= 1500) return "slow";
  return "ceremonial";
}

/** Extract the set of animated properties as a sorted signature. */
function transformSignature(comp: MotionComponent): string {
  const props = new Set<string>();
  for (const kf of comp.keyframes) {
    for (const key of Object.keys(kf.properties)) props.add(key);
  }
  return Array.from(props).sort().join("+") || "static";
}

/** Classify the loop strategy. */
function loopStrategy(comp: MotionComponent): string {
  if (comp.iterationCount === "infinite") return "infinite";
  if (typeof comp.iterationCount === "number" && comp.iterationCount > 1) return `loop×${comp.iterationCount}`;
  return "once";
}

/** Classify the intensity bucket from the maximum transform magnitude. */
function intensityBucket(comp: MotionComponent): string {
  let maxMag = 0;
  for (const kf of comp.keyframes) {
    for (const prop of ["translateX", "translateY", "rotate", "scale"] as const) {
      const v = kf.properties[prop];
      if (typeof v === "number") {
        maxMag = Math.max(maxMag, Math.abs(v));
      } else if (typeof v === "string") {
        const m = v.match(/-?\d+\.?\d*/);
        if (m) maxMag = Math.max(maxMag, Math.abs(parseFloat(m[0])));
      }
    }
  }
  if (maxMag <= 0) return "static";
  if (maxMag <= 30) return "subtle";
  if (maxMag <= 100) return "moderate";
  if (maxMag <= 300) return "bold";
  return "extreme";
}

/** Compute the DNA signature for a component. */
function computeDna(comp: MotionComponent): ComponentDna {
  const family = easingFamily(comp.easing);
  const tier = timingTier(comp.durationMs);
  const intensity = intensityBucket(comp);
  const transform = transformSignature(comp);
  const loop = loopStrategy(comp);
  return {
    componentId: comp.id,
    componentName: comp.name,
    easingFamily: family,
    timingTier: tier,
    intensityBucket: intensity,
    transformSignature: transform,
    loopStrategy: loop,
    composite: [family, tier, intensity, transform, loop].join("|"),
  };
}

/** Compute Shannon entropy (normalized to 0..1) for a value distribution. */
function normalizedEntropy(distribution: Record<string, number>): number {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const n = Object.keys(distribution).length;
  if (n <= 1) return 0;
  let entropy = 0;
  for (const count of Object.values(distribution)) {
    const p = count / total;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  // Normalize by log2(n) — the maximum possible entropy.
  return entropy / Math.log2(n);
}

/** Compute per-dimension diversity. */
function computeDimensionDiversity(
  dimension: DnaDimension,
  dnas: ComponentDna[],
): DimensionDiversity {
  const getValue = (dna: ComponentDna): string => {
    switch (dimension) {
      case "easing": return dna.easingFamily;
      case "timing": return dna.timingTier;
      case "intensity": return dna.intensityBucket;
      case "transform": return dna.transformSignature;
      case "loop": return dna.loopStrategy;
    }
  };

  const distribution: Record<string, number> = {};
  for (const dna of dnas) {
    const v = getValue(dna);
    distribution[v] = (distribution[v] ?? 0) + 1;
  }

  const uniqueValues = Object.keys(distribution).length;
  const uniqueRatio = dnas.length > 0 ? uniqueValues / dnas.length : 0;
  const entropy = normalizedEntropy(distribution);

  // Find dominant value.
  let dominantValue: string | undefined;
  let dominantCount = 0;
  for (const [v, c] of Object.entries(distribution)) {
    if (c > dominantCount) {
      dominantCount = c;
      dominantValue = v;
    }
  }
  const dominantShare = dnas.length > 0 ? dominantCount / dnas.length : 0;
  const monoculture = dominantShare >= 0.6 && uniqueValues > 1 && dnas.length >= 3 || (dominantShare === 1 && dnas.length >= 2);

  return {
    dimension,
    uniqueRatio,
    entropy,
    distribution,
    monoculture,
    dominantValue,
    dominantShare,
  };
}

/** Compute pairwise DNA similarity between two components (0..1). */
function dnaSimilarity(a: ComponentDna, b: ComponentDna): number {
  let matches = 0;
  let total = 5;
  if (a.easingFamily === b.easingFamily) matches++;
  if (a.timingTier === b.timingTier) matches++;
  if (a.intensityBucket === b.intensityBucket) matches++;
  if (a.transformSignature === b.transformSignature) matches++;
  if (a.loopStrategy === b.loopStrategy) matches++;
  return matches / total;
}

/**
 * Cluster components by DNA similarity using a simple greedy approach:
 * two components belong to the same cluster if their similarity >= 0.6.
 */
function clusterByDna(dnas: ComponentDna[]): { clusters: number[]; familyCount: number } {
  const n = dnas.length;
  if (n === 0) return { clusters: [], familyCount: 0 };

  const threshold = 0.6;
  const clusters = new Array(n).fill(-1);
  let nextCluster = 0;

  for (let i = 0; i < n; i++) {
    if (clusters[i] !== -1) continue;
    clusters[i] = nextCluster;
    for (let j = i + 1; j < n; j++) {
      if (clusters[j] !== -1) continue;
      if (dnaSimilarity(dnas[i], dnas[j]) >= threshold) {
        clusters[j] = nextCluster;
      }
    }
    nextCluster++;
  }

  return { clusters, familyCount: nextCluster };
}

/** Compute the centroid DNA of a cluster (per-dimension mode). */
function clusterCentroid(dnas: ComponentDna[], clusterIds: number[], clusterId: number): ComponentDna | null {
  const members = dnas.filter((_, i) => clusterIds[i] === clusterId);
  if (members.length === 0) return null;
  const mode = (values: string[]) => {
    const counts: Record<string, number> = {};
    for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
    let best = values[0] ?? "";
    let bestCount = 0;
    for (const [v, c] of Object.entries(counts)) {
      if (c > bestCount) { best = v; bestCount = c; }
    }
    return best;
  };
  const representative = members[0];
  return {
    ...representative,
    easingFamily: mode(members.map((m) => m.easingFamily)),
    timingTier: mode(members.map((m) => m.timingTier)),
    intensityBucket: mode(members.map((m) => m.intensityBucket)),
    transformSignature: mode(members.map((m) => m.transformSignature)),
    loopStrategy: mode(members.map((m) => m.loopStrategy)),
    composite: "",
  };
}

/** Generate diversification suggestions for monoculture axes. */
function suggestDiversification(
  dimensions: DimensionDiversity[],
  dnas: ComponentDna[],
): DiversificationSuggestion[] {
  const suggestions: DiversificationSuggestion[] = [];

  for (const dim of dimensions) {
    if (!dim.monoculture || !dim.dominantValue) continue;
    const offending = dnas.filter((dna) => {
      switch (dim.dimension) {
        case "easing": return dna.easingFamily === dim.dominantValue;
        case "timing": return dna.timingTier === dim.dominantValue;
        case "intensity": return dna.intensityBucket === dim.dominantValue;
        case "transform": return dna.transformSignature === dim.dominantValue;
        case "loop": return dna.loopStrategy === dim.dominantValue;
      }
    });

    // Keep only the dominant offenders — leave room for the minority.
    const toVary = offending.slice(0, Math.max(1, Math.floor(offending.length / 2)));
    let recommendation = "";
    switch (dim.dimension) {
      case "easing":
        recommendation = `Try switching some "${dim.dominantValue}" components to a contrasting family (e.g., bounce vs smooth) to add rhythmic variety.`;
        break;
      case "timing":
        recommendation = `Vary the duration tier — break up the "${dim.dominantValue}" cluster by introducing some faster or slower components.`;
        break;
      case "intensity":
        recommendation = `Introduce contrast in intensity — pair "${dim.dominantValue}" components with subtle or extreme counterparts.`;
        break;
      case "transform":
        recommendation = `Animate different properties — not everything should be "${dim.dominantValue}". Mix opacity, scale, and translate.`;
        break;
      case "loop":
        recommendation = `Diversify loop strategy — not every component should be "${dim.dominantValue}". Mix single-play with infinite loops.`;
        break;
    }

    suggestions.push({
      dimension: dim.dimension,
      message: `${dim.dominantValue} dominates ${Math.round((dim.dominantShare ?? 0) * 100)}% of ${dim.dimension} — monoculture detected.`,
      componentIds: toVary.map((d) => d.componentId),
      componentNames: toVary.map((d) => d.componentName),
      recommendation,
    });
  }

  return suggestions;
}

/** Compute the full genome report for a project. */
export function analyzeGenome(spec: MotionSpec): GenomeReport {
  const dnas = spec.components.map(computeDna);
  const n = dnas.length;

  if (n === 0) {
    return {
      componentCount: 0,
      diversityScore: 100,
      inbreedingCoefficient: 0,
      dimensions: [],
      tree: [],
      familyCount: 0,
      isMonoculture: false,
      monocultureAxes: [],
      suggestions: [],
      summary: "Empty project — no genome to analyze.",
    };
  }

  if (n === 1) {
    return {
      componentCount: 1,
      diversityScore: 50,
      inbreedingCoefficient: 0,
      dimensions: ["easing", "timing", "intensity", "transform", "loop"].map((d) => ({
        dimension: d as DnaDimension,
        uniqueRatio: 1,
        entropy: 1,
        distribution: { [d]: 1 },
        monoculture: false,
      })),
      tree: [{
        componentId: dnas[0].componentId,
        componentName: dnas[0].componentName,
        cluster: 0,
        distanceFromCentroid: 0,
      }],
      familyCount: 1,
      isMonoculture: false,
      monocultureAxes: [],
      suggestions: [],
      summary: "Single component — add at least one more to measure diversity.",
    };
  }

  // Per-dimension diversity.
  const dimensions: DimensionDiversity[] = [
    computeDimensionDiversity("easing", dnas),
    computeDimensionDiversity("timing", dnas),
    computeDimensionDiversity("intensity", dnas),
    computeDimensionDiversity("transform", dnas),
    computeDimensionDiversity("loop", dnas),
  ];

  // Overall diversity score — average of normalized entropies, scaled to 0..100.
  const avgEntropy = dimensions.reduce((sum, d) => sum + d.entropy, 0) / dimensions.length;
  const diversityScore = Math.round(avgEntropy * 100);

  // Inbreeding coefficient — average pairwise similarity.
  let pairwiseSum = 0;
  let pairCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      pairwiseSum += dnaSimilarity(dnas[i], dnas[j]);
      pairCount++;
    }
  }
  const inbreedingCoefficient = pairCount > 0 ? pairwiseSum / pairCount : 0;

  // Cluster into families.
  const { clusters, familyCount } = clusterByDna(dnas);
  const tree: GenomeTreeNode[] = dnas.map((dna, i) => {
    const centroid = clusterCentroid(dnas, clusters, clusters[i]);
    const distance = centroid ? 1 - dnaSimilarity(dna, centroid) : 0;
    return {
      componentId: dna.componentId,
      componentName: dna.componentName,
      cluster: clusters[i],
      distanceFromCentroid: Math.round(distance * 100) / 100,
    };
  });

  // Monoculture detection.
  const monocultureAxes = dimensions.filter((d) => d.monoculture).map((d) => d.dimension);
  const isMonoculture = monocultureAxes.length >= 2 || inbreedingCoefficient >= 0.8;

  // Diversification suggestions.
  const suggestions = suggestDiversification(dimensions, dnas);

  const summary = `${n} components across ${familyCount} family/families. Diversity ${diversityScore}/100. Inbreeding ${inbreedingCoefficient.toFixed(2)}. ${isMonoculture ? "MONOCULTURE detected on " + monocultureAxes.join(", ") + "." : "Healthy genetic variation."}`;

  return {
    componentCount: n,
    diversityScore,
    inbreedingCoefficient: Math.round(inbreedingCoefficient * 100) / 100,
    dimensions,
    tree,
    familyCount,
    isMonoculture,
    monocultureAxes,
    suggestions,
    summary,
  };
}

/** Format the genome report as a human-readable string. */
export function formatGenomeReport(report: GenomeReport): string {
  const lines: string[] = [];
  lines.push("=== Motion Genome ===");
  lines.push("");
  lines.push(`Components: ${report.componentCount}`);
  lines.push(`Families: ${report.familyCount}`);
  lines.push(`Diversity: ${report.diversityScore}/100`);
  lines.push(`Inbreeding: ${report.inbreedingCoefficient}`);
  lines.push(`Monoculture: ${report.isMonoculture ? "YES" : "no"}`);
  if (report.monocultureAxes.length > 0) {
    lines.push(`Monoculture axes: ${report.monocultureAxes.join(", ")}`);
  }
  lines.push("");

  if (report.dimensions.length > 0) {
    lines.push("--- Per-Dimension Diversity ---");
    for (const dim of report.dimensions) {
      const status = dim.monoculture ? "MONOCULTURE" : "ok";
      lines.push(`${dim.dimension.padEnd(12)} entropy=${dim.entropy.toFixed(2)} unique=${dim.uniqueRatio.toFixed(2)} ${status}`);
      if (dim.dominantValue && dim.dominantShare) {
        lines.push(`  dominant: ${dim.dominantValue} (${Math.round(dim.dominantShare * 100)}%)`);
      }
    }
    lines.push("");
  }

  if (report.tree.length > 0) {
    lines.push("--- Evolutionary Tree ---");
    const byCluster = new Map<number, GenomeTreeNode[]>();
    for (const node of report.tree) {
      const arr = byCluster.get(node.cluster) ?? [];
      arr.push(node);
      byCluster.set(node.cluster, arr);
    }
    for (const [cluster, members] of byCluster) {
      lines.push(`Family ${cluster}:`);
      for (const m of members) {
        lines.push(`  - ${m.componentName} (distance ${m.distanceFromCentroid})`);
      }
    }
    lines.push("");
  }

  if (report.suggestions.length > 0) {
    lines.push("--- Diversification Suggestions ---");
    for (const s of report.suggestions) {
      lines.push(`[${s.dimension}] ${s.message}`);
      lines.push(`  ${s.recommendation}`);
      lines.push(`  components to vary: ${s.componentNames.join(", ")}`);
    }
    lines.push("");
  }

  lines.push(`Summary: ${report.summary}`);
  return lines.join("\n");
}
