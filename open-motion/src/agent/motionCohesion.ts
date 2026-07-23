/**
 * Motion Cohesion Analyzer — project-level visual and motion cohesion analysis.
 *
 * This is the twentieth original AI-native module. Where the Curator groups
 * components by semantic role and the Strategist detects the project archetype,
 * the Cohesion Analyzer measures how well all components work together as a
 * unified composition. It evaluates visual hierarchy, focal points, attention
 * flow, compositional balance, and motion synchronicity.
 *
 * Six core analytics:
 * 1. Visual hierarchy — ranks components by visual weight (intensity, duration,
 *    scale, color change) to reveal which element draws the eye first.
 * 2. Focal point detection — identifies the dominant focal component and
 *    checks whether secondary elements support or compete with it.
 * 3. Attention flow path — predicts the order in which a viewer's eye
 *    travels across components based on timing, intensity, and position.
 * 4. Compositional balance — evaluates whether entrance timing is spread
 *    evenly or bunched into clusters that overwhelm the viewer.
 * 5. Motion synchronicity — checks whether components share easing families
 *    and complementary timing, or move in chaotic discord.
 * 6. Cohesion score — a 0..100 composite score with driving factors and
 *    actionable recommendations for improvement.
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, MotionSpec, Easing } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A component's computed visual weight and hierarchy rank. */
export interface HierarchyEntry {
  componentId: string;
  componentName: string;
  /** Computed visual weight (0..100). Higher = more attention-grabbing. */
  visualWeight: number;
  /** Hierarchy rank (1 = most prominent). */
  rank: number;
  /** Factors contributing to the weight. */
  factors: {
    intensity: number;
    duration: number;
    scaleChange: number;
    colorChange: number;
    loopPenalty: number;
  };
  /** Role in the hierarchy. */
  tier: "primary" | "secondary" | "tertiary" | "background";
}

/** Focal point analysis result. */
export interface FocalAnalysis {
  /** The component ID that serves as the primary focal point. */
  primaryFocalId: string;
  primaryFocalName: string;
  /** How dominant the focal point is (0..1). >0.5 means clear winner. */
  dominance: number;
  /** Whether the project has a clear focal point or is scattered. */
  hasClearFocal: boolean;
  /** Components that compete with the primary focal point. */
  competitors: Array<{ componentId: string; componentName: string; weight: number }>;
}

/** A step in the predicted attention flow path. */
export interface AttentionStep {
  order: number;
  componentId: string;
  componentName: string;
  /** When the viewer likely notices this (ms from start). */
  estimatedNoticeMs: number;
  /** Why the eye is drawn here at this point. */
  reason: string;
}

/** Compositional balance analysis. */
export interface BalanceAnalysis {
  /** Timing distribution: how evenly entrances are spread. */
  timingDistribution: "even" | "front-loaded" | "back-loaded" | "clustered" | "sparse";
  /** Balance score (0..100). 100 = perfectly spread. */
  balanceScore: number;
  /** Number of timing clusters (groups of components starting within 100ms). */
  clusterCount: number;
  /** Largest gap with no animation (ms). */
  largestGapMs: number;
  /** Assessment of the balance. */
  assessment: string;
}

/** Motion synchronicity analysis. */
export interface SynchronicityAnalysis {
  /** How many easing families are in use. */
  easingFamilyCount: number;
  /** The dominant easing family. */
  dominantFamily: string;
  /** Synchronicity score (0..100). 100 = all components move in harmony. */
  syncScore: number;
  /** Whether the motion vocabulary is unified or fragmented. */
  isUnified: boolean;
  /** Easing families detected and their counts. */
  families: Array<{ family: string; count: number; percentage: number }>;
  /** Assessment of synchronicity. */
  assessment: string;
}

/** The complete cohesion report. */
export interface CohesionReport {
  componentCount: number;
  /** Overall cohesion score (0..100). */
  cohesionScore: number;
  /** Qualitative level. */
  level: "excellent" | "good" | "fair" | "poor" | "fragmented";
  hierarchy: HierarchyEntry[];
  focal: FocalAnalysis;
  attentionFlow: AttentionStep[];
  balance: BalanceAnalysis;
  synchronicity: SynchronicityAnalysis;
  /** Key factors driving the cohesion score. */
  drivingFactors: string[];
  /** Recommendations to improve cohesion. */
  recommendations: Array<{ priority: number; title: string; description: string }>;
  summary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the easing family from an Easing object. */
function easingFamily(easing: Easing): string {
  if (easing.type === "preset") {
    const name = easing.name;
    if (name.includes("spring")) return "spring";
    if (name.includes("bounce")) return "bounce";
    if (name.includes("elastic")) return "elastic";
    if (name.includes("ease-in-out") || name.includes("in-out")) return "ease-in-out";
    if (name.includes("ease-in")) return "ease-in";
    if (name.includes("ease-out")) return "ease-out";
    if (name === "linear") return "linear";
    return "custom";
  }
  if (easing.type === "bezier") return "bezier";
  if (easing.type === "spring") return "spring";
  return "custom";
}

/** Compute the scale change magnitude from keyframes. */
function scaleChange(component: MotionComponent): number {
  let maxScale = 1;
  let minScale = 1;
  for (const kf of component.keyframes) {
    const props = kf.properties as Record<string, unknown>;
    const sx = typeof props.scaleX === "number" ? props.scaleX : 1;
    const sy = typeof props.scaleY === "number" ? props.scaleY : 1;
    const s = Math.max(sx, sy);
    maxScale = Math.max(maxScale, s);
    minScale = Math.min(minScale, s);
  }
  return Math.abs(maxScale - minScale);
}

/** Compute the color/opacity change magnitude from keyframes. */
function colorChange(component: MotionComponent): number {
  let maxOpacity = 1;
  let minOpacity = 1;
  for (const kf of component.keyframes) {
    const props = kf.properties as Record<string, unknown>;
    if (typeof props.opacity === "number") {
      maxOpacity = Math.max(maxOpacity, props.opacity);
      minOpacity = Math.min(minOpacity, props.opacity);
    }
  }
  return Math.abs(maxOpacity - minOpacity);
}

/** Estimate motion intensity (0..1) from keyframe property changes. */
function estimateIntensity(component: MotionComponent): number {
  let totalChange = 0;
  let propCount = 0;
  for (const kf of component.keyframes) {
    const props = kf.properties as Record<string, unknown>;
    for (const [key, value] of Object.entries(props)) {
      if (typeof value === "number") {
        if (key === "opacity") {
          totalChange += Math.abs(value - 0.5) * 2;
        } else if (key === "rotate" || key === "rotation") {
          totalChange += Math.min(Math.abs(value) / 360, 1);
        } else if (key === "translateX" || key === "translateY") {
          totalChange += Math.min(Math.abs(value) / 300, 1);
        } else if (key === "scaleX" || key === "scaleY" || key === "scale") {
          totalChange += Math.abs(value - 1);
        }
        propCount++;
      }
    }
  }
  if (propCount === 0) return 0;
  return Math.min(totalChange / propCount, 1);
}

/** Loop penalty — infinite loops continuously grab attention. */
function loopPenalty(component: MotionComponent): number {
  if (component.iterationCount === "infinite") return 0.3;
  if (typeof component.iterationCount === "number" && component.iterationCount > 3) {
    return 0.15;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Core analytics
// ---------------------------------------------------------------------------

/** Compute the visual hierarchy of all components. */
function computeHierarchy(components: MotionComponent[]): HierarchyEntry[] {
  const entries = components.map((c) => {
    const intensity = estimateIntensity(c);
    const duration = Math.min(c.durationMs / 2000, 1);
    const sc = scaleChange(c);
    const cc = colorChange(c);
    const lp = loopPenalty(c);

    const visualWeight = Math.round(
      (intensity * 30 + duration * 20 + sc * 20 + cc * 15 + lp * 100 + 15) * 100,
    ) / 100;

    return {
      componentId: c.id,
      componentName: c.name,
      visualWeight: Math.min(visualWeight, 100),
      factors: {
        intensity: Math.round(intensity * 100) / 100,
        duration: Math.round(duration * 100) / 100,
        scaleChange: Math.round(sc * 100) / 100,
        colorChange: Math.round(cc * 100) / 100,
        loopPenalty: lp,
      },
      rank: 0,
      tier: "background" as const,
    };
  });

  entries.sort((a, b) => b.visualWeight - a.visualWeight);
  entries.forEach((e, i) => {
    e.rank = i + 1;
    if (i === 0) e.tier = "primary";
    else if (i < Math.max(2, entries.length * 0.2)) e.tier = "secondary";
    else if (i < Math.max(4, entries.length * 0.5)) e.tier = "tertiary";
    else e.tier = "background";
  });

  return entries;
}

/** Analyze the focal point. */
function analyzeFocal(hierarchy: HierarchyEntry[]): FocalAnalysis {
  if (hierarchy.length === 0) {
    return {
      primaryFocalId: "",
      primaryFocalName: "none",
      dominance: 0,
      hasClearFocal: false,
      competitors: [],
    };
  }

  const top = hierarchy[0];
  const second = hierarchy[1];
  const dominance = second ? top.visualWeight / (top.visualWeight + second.visualWeight) : 1;
  const competitors = hierarchy
    .slice(1)
    .filter((h) => h.visualWeight > top.visualWeight * 0.7)
    .map((h) => ({
      componentId: h.componentId,
      componentName: h.componentName,
      weight: h.visualWeight,
    }));

  return {
    primaryFocalId: top.componentId,
    primaryFocalName: top.componentName,
    dominance: Math.round(dominance * 100) / 100,
    hasClearFocal: dominance > 0.55,
    competitors,
  };
}

/** Predict the attention flow path. */
function predictAttentionFlow(components: MotionComponent[], hierarchy: HierarchyEntry[]): AttentionStep[] {
  const sorted = [...components].sort((a, b) => {
    const rankA = hierarchy.find((h) => h.componentId === a.id)?.rank ?? 99;
    const rankB = hierarchy.find((h) => h.componentId === b.id)?.rank ?? 99;
    if (a.delayMs !== b.delayMs) return a.delayMs - b.delayMs;
    return rankA - rankB;
  });

  return sorted.map((c, i) => {
    const rank = hierarchy.find((h) => h.componentId === c.id)?.rank ?? 99;
    const reason =
      i === 0
        ? `First to appear (delay ${c.delayMs}ms), rank #${rank}`
        : rank <= 2
          ? `High visual weight (rank #${rank}), appears at ${c.delayMs}ms`
          : `Appears at ${c.delayMs}ms, rank #${rank}`;
    return {
      order: i + 1,
      componentId: c.id,
      componentName: c.name,
      estimatedNoticeMs: c.delayMs,
      reason,
    };
  });
}

/** Analyze compositional balance of timing. */
function analyzeBalance(components: MotionComponent[]): BalanceAnalysis {
  if (components.length === 0) {
    return {
      timingDistribution: "sparse",
      balanceScore: 0,
      clusterCount: 0,
      largestGapMs: 0,
      assessment: "No components to analyze.",
    };
  }

  const delays = components.map((c) => c.delayMs).sort((a, b) => a - b);
  const totalSpan = delays[delays.length - 1] + Math.max(...components.map((c) => c.durationMs));

  // Detect clusters: groups of components starting within 100ms of each other
  let clusters = 0;
  let inCluster = false;
  for (let i = 1; i < delays.length; i++) {
    if (delays[i] - delays[i - 1] <= 100) {
      if (!inCluster) {
        clusters++;
        inCluster = true;
      }
    } else {
      inCluster = false;
    }
  }

  // Find largest gap
  let largestGap = 0;
  for (let i = 1; i < delays.length; i++) {
    largestGap = Math.max(largestGap, delays[i] - delays[i - 1]);
  }

  // Determine distribution type
  const firstHalf = delays.filter((d) => d < totalSpan / 2).length;
  const secondHalf = delays.length - firstHalf;
  let distribution: BalanceAnalysis["timingDistribution"];
  if (clusters >= Math.ceil(delays.length / 2)) {
    distribution = "clustered";
  } else if (firstHalf > secondHalf * 2) {
    distribution = "front-loaded";
  } else if (secondHalf > firstHalf * 2) {
    distribution = "back-loaded";
  } else if (largestGap > totalSpan * 0.4) {
    distribution = "sparse";
  } else {
    distribution = "even";
  }

  // Balance score: 100 = perfectly even, lower for clustering and gaps
  const idealGap = totalSpan / (delays.length + 1);
  const gapRatio = idealGap > 0 ? Math.min(largestGap / idealGap, 2) : 1;
  const clusterPenalty = clusters * 10;
  const balanceScore = Math.max(0, Math.min(100, Math.round(100 - clusterPenalty - (gapRatio - 1) * 30)));

  const assessments: Record<BalanceAnalysis["timingDistribution"], string> = {
    "even": "Entrances are well-distributed across the timeline, giving the viewer time to process each element.",
    "front-loaded": "Most components start early, which can overwhelm the viewer with simultaneous motion.",
    "back-loaded": "Most components start late, leaving the opening feeling empty before a sudden burst.",
    "clustered": "Components are bunched into tight clusters, creating chaotic moments followed by dead time.",
    "sparse": "There are large gaps with no motion, which may cause the viewer to lose engagement.",
  };

  return {
    timingDistribution: distribution,
    balanceScore,
    clusterCount: clusters,
    largestGapMs: largestGap,
    assessment: assessments[distribution],
  };
}

/** Analyze motion synchronicity across components. */
function analyzeSynchronicity(components: MotionComponent[]): SynchronicityAnalysis {
  if (components.length === 0) {
    return {
      easingFamilyCount: 0,
      dominantFamily: "none",
      syncScore: 0,
      isUnified: false,
      families: [],
      assessment: "No components to analyze.",
    };
  }

  const familyCounts = new Map<string, number>();
  for (const c of components) {
    const family = easingFamily(c.easing);
    familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
  }

  const families = Array.from(familyCounts.entries())
    .map(([family, count]) => ({
      family,
      count,
      percentage: Math.round((count / components.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const dominantFamily = families[0]?.family ?? "none";
  const dominantPct = families[0]?.percentage ?? 0;
  const isUnified = dominantPct >= 60 && families.length <= 3;

  // Sync score: higher when fewer families and one dominant
  const familyPenalty = Math.max(0, (families.length - 1) * 15);
  const dominanceBonus = dominantPct >= 70 ? 20 : dominantPct >= 50 ? 10 : 0;
  const syncScore = Math.max(0, Math.min(100, 100 - familyPenalty + dominanceBonus - 20));

  const assessment = isUnified
    ? `Motion vocabulary is unified — ${dominantPct}% of components use the ${dominantFamily} easing family, creating a coherent feel.`
    : families.length > 4
      ? `Motion vocabulary is fragmented — ${families.length} different easing families are in use, creating visual discord.`
      : `Motion vocabulary is moderately diverse — ${dominantPct}% use ${dominantFamily}, but ${families.length - 1} other families are present.`;

  return {
    easingFamilyCount: families.length,
    dominantFamily,
    syncScore,
    isUnified,
    families,
    assessment,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Analyze the cohesion of an entire motion project.
 *
 * Returns a comprehensive report covering hierarchy, focal points, attention
 * flow, balance, synchronicity, and an overall cohesion score.
 */
export function analyzeCohesion(spec: MotionSpec): CohesionReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      componentCount: 0,
      cohesionScore: 0,
      level: "fragmented",
      hierarchy: [],
      focal: {
        primaryFocalId: "",
        primaryFocalName: "none",
        dominance: 0,
        hasClearFocal: false,
        competitors: [],
      },
      attentionFlow: [],
      balance: {
        timingDistribution: "sparse",
        balanceScore: 0,
        clusterCount: 0,
        largestGapMs: 0,
        assessment: "No components to analyze.",
      },
      synchronicity: {
        easingFamilyCount: 0,
        dominantFamily: "none",
        syncScore: 0,
        isUnified: false,
        families: [],
        assessment: "No components to analyze.",
      },
      drivingFactors: ["Empty project — no components to analyze."],
      recommendations: [],
      summary: "The project has no components. Add components to begin cohesion analysis.",
    };
  }

  const hierarchy = computeHierarchy(components);
  const focal = analyzeFocal(hierarchy);
  const attentionFlow = predictAttentionFlow(components, hierarchy);
  const balance = analyzeBalance(components);
  const synchronicity = analyzeSynchronicity(components);

  // Composite cohesion score
  const focalScore = focal.hasClearFocal ? 25 : focal.dominance > 0.4 ? 15 : 5;
  const balanceContribution = Math.round(balance.balanceScore * 0.25);
  const syncContribution = Math.round(synchronicity.syncScore * 0.25);
  const hierarchyContribution = hierarchy.length <= 1 ? 25 : Math.round(25 * Math.min(1, 3 / hierarchy.length));
  const cohesionScore = Math.max(0, Math.min(100, focalScore + balanceContribution + syncContribution + hierarchyContribution));

  const level: CohesionReport["level"] =
    cohesionScore >= 80 ? "excellent"
    : cohesionScore >= 60 ? "good"
    : cohesionScore >= 40 ? "fair"
    : cohesionScore >= 20 ? "poor"
    : "fragmented";

  // Driving factors
  const drivingFactors: string[] = [];
  if (focal.hasClearFocal) {
    drivingFactors.push(`Clear focal point: "${focal.primaryFocalName}" dominates at ${Math.round(focal.dominance * 100)}%`);
  } else {
    drivingFactors.push(`No clear focal point — top components compete for attention`);
  }
  drivingFactors.push(`Timing balance: ${balance.balanceScore}/100 (${balance.timingDistribution})`);
  drivingFactors.push(`Motion synchronicity: ${synchronicity.syncScore}/100 (${synchronicity.isUnified ? "unified" : "fragmented"})`);
  if (balance.clusterCount > 0) {
    drivingFactors.push(`${balance.clusterCount} timing cluster(s) detected — entrances are bunched`);
  }

  // Recommendations
  const recommendations: CohesionReport["recommendations"] = [];
  if (!focal.hasClearFocal) {
    recommendations.push({
      priority: 1,
      title: "Establish a clear focal point",
      description: `Reduce the visual weight of "${focal.competitors[0]?.componentName ?? "secondary components"}" or increase the weight of "${focal.primaryFocalName}" to create a clearer hierarchy.`,
    });
  }
  if (balance.timingDistribution === "clustered" || balance.timingDistribution === "front-loaded") {
    recommendations.push({
      priority: 2,
      title: "Spread out entrance timing",
      description: `Components are ${balance.timingDistribution}. Stagger delays by 100-200ms to give the viewer time to process each element.`,
    });
  }
  if (!synchronicity.isUnified && synchronicity.easingFamilyCount > 3) {
    recommendations.push({
      priority: 3,
      title: "Unify easing vocabulary",
      description: `${synchronicity.easingFamilyCount} easing families create discord. Standardize on ${synchronicity.dominantFamily} for 60%+ of components.`,
    });
  }
  if (balance.largestGapMs > 2000) {
    recommendations.push({
      priority: 4,
      title: "Fill timing gaps",
      description: `There is a ${balance.largestGapMs}ms gap with no motion. Add ambient or transition components to maintain engagement.`,
    });
  }

  const summary = `Cohesion ${cohesionScore}/100 (${level}). ${focal.hasClearFocal ? `Clear focal point on "${focal.primaryFocalName}".` : "No clear focal point."} ${balance.assessment} ${synchronicity.assessment}`;

  return {
    componentCount: components.length,
    cohesionScore,
    level,
    hierarchy,
    focal,
    attentionFlow,
    balance,
    synchronicity,
    drivingFactors,
    recommendations,
    summary,
  };
}

/** Format a cohesion report as a human-readable string. */
export function formatCohesionReport(report: CohesionReport): string {
  const lines: string[] = [];
  lines.push(`=== Motion Cohesion Analysis ===`);
  lines.push(`Score: ${report.cohesionScore}/100 (${report.level})`);
  lines.push(`Components: ${report.componentCount}`);
  lines.push("");
  lines.push(`Summary: ${report.summary}`);
  lines.push("");

  lines.push(`--- Visual Hierarchy ---`);
  for (const h of report.hierarchy.slice(0, 10)) {
    lines.push(`  #${h.rank} [${h.tier}] ${h.componentName} — weight ${h.visualWeight}`);
    lines.push(`    intensity=${h.factors.intensity} duration=${h.factors.duration} scale=${h.factors.scaleChange} color=${h.factors.colorChange} loop=${h.factors.loopPenalty}`);
  }

  lines.push("");
  lines.push(`--- Focal Point ---`);
  lines.push(`  Primary: ${report.focal.primaryFocalName} (dominance: ${Math.round(report.focal.dominance * 100)}%)`);
  lines.push(`  Clear focal: ${report.focal.hasClearFocal ? "yes" : "no"}`);
  if (report.focal.competitors.length > 0) {
    lines.push(`  Competitors: ${report.focal.competitors.map((c) => `${c.componentName} (${c.weight})`).join(", ")}`);
  }

  lines.push("");
  lines.push(`--- Attention Flow ---`);
  for (const step of report.attentionFlow) {
    lines.push(`  ${step.order}. ${step.componentName} @ ${step.estimatedNoticeMs}ms — ${step.reason}`);
  }

  lines.push("");
  lines.push(`--- Balance ---`);
  lines.push(`  Distribution: ${report.balance.timingDistribution} (score ${report.balance.balanceScore})`);
  lines.push(`  Clusters: ${report.balance.clusterCount}, Largest gap: ${report.balance.largestGapMs}ms`);
  lines.push(`  ${report.balance.assessment}`);

  lines.push("");
  lines.push(`--- Synchronicity ---`);
  lines.push(`  Score: ${report.synchronicity.syncScore}/100 (${report.synchronicity.isUnified ? "unified" : "fragmented"})`);
  lines.push(`  Families: ${report.synchronicity.families.map((f) => `${f.family}(${f.percentage}%)`).join(", ")}`);
  lines.push(`  ${report.synchronicity.assessment}`);

  if (report.recommendations.length > 0) {
    lines.push("");
    lines.push(`--- Recommendations ---`);
    for (const r of report.recommendations) {
      lines.push(`  ${r.priority}. ${r.title}`);
      lines.push(`     ${r.description}`);
    }
  }

  return lines.join("\n");
}
