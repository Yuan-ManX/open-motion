/**
 * Motion Forecast — predictive trend analytics for motion DNA.
 *
 * This is the tenth original AI-native module. Where the Genome measures the
 * current state of a project's population, the Forecast projects where the
 * project is trending and recommends the next moves to either reinforce or
 * correct the trajectory.
 *
 * Five core analytics:
 * 1. Trend projection — extrapolate the dominant DNA traits and predict the
 *    project's likely final form if current patterns continue.
 * 2. Saturation forecast — detect when a dimension is approaching monoculture
 *    and project how many more components it would take to lock it in.
 * 3. Missing-axis detection — identify dimensions the project hasn't explored
 *    at all (e.g., no spring easings, no rotations, no infinite loops).
 * 4. Recommended next moves — concrete suggestions for what to add next,
 *    ranked by expected diversity gain.
 * 5. Risk assessment — flag patterns that will likely cause accessibility or
 *    aesthetic problems if continued (e.g., trending toward all-fast durations).
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, MotionSpec } from "@openmotion/shared";

/** A projected trend for a single DNA dimension. */
export interface DimensionTrend {
  dimension: string;
  /** Current dominant value. */
  dominantValue: string;
  /** Current dominant share (0..1). */
  dominantShare: number;
  /** Projected dominant share if one more component follows the trend (0..1). */
  projectedShare: number;
  /** Whether this dimension is trending toward monoculture. */
  trendingToMonoculture: boolean;
  /** How many more components following the trend would lock in monoculture. */
  componentsToLockIn: number | null;
}

/** A missing axis the project hasn't explored. */
export interface MissingAxis {
  dimension: string;
  /** Values not present in the project at all. */
  missingValues: string[];
  /** Why exploring this axis would benefit the project. */
  benefit: string;
}

/** A recommended next move, ranked by expected diversity gain. */
export interface NextMove {
  rank: number;
  title: string;
  description: string;
  /** Expected diversity gain (0..100). */
  expectedGain: number;
  /** Concrete action — what to create or change. */
  action: string;
  /** The dimension this move primarily affects. */
  primaryDimension: string;
}

/** A risk flag if current patterns continue. */
export interface RiskFlag {
  severity: "info" | "warning" | "critical";
  dimension: string;
  message: string;
  /** What will happen if the trend continues unchecked. */
  projection: string;
  /** Suggested corrective action. */
  mitigation: string;
}

/** The projected final form of the project if trends continue. */
export interface ProjectedFinalForm {
  description: string;
  dominantEasing: string;
  dominantTiming: string;
  dominantIntensity: string;
  dominantTransform: string;
  dominantLoop: string;
  /** Overall health projection 0..100 — higher is better. */
  healthScore: number;
}

/** The full forecast result. */
export interface ForecastResult {
  componentCount: number;
  trends: DimensionTrend[];
  missingAxes: MissingAxis[];
  nextMoves: NextMove[];
  risks: RiskFlag[];
  projectedFinalForm: ProjectedFinalForm;
  summary: string;
}

/** Classify an easing into a family token. */
function easingFamily(easing: MotionComponent["easing"]): string {
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

/** Compute the dominant value and its share for a dimension. */
function dominantValue(values: string[]): { value: string; share: number } {
  if (values.length === 0) return { value: "", share: 0 };
  const counts: Record<string, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  let best = values[0];
  let bestCount = 0;
  for (const [v, c] of Object.entries(counts)) {
    if (c > bestCount) { best = v; bestCount = c; }
  }
  return { value: best, share: bestCount / values.length };
}

/** Project the share if one more component follows the dominant trend. */
function projectShare(currentShare: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  // If one more component joins the dominant pool: (count + 1) / (total + 1).
  const count = currentShare * totalCount;
  return (count + 1) / (totalCount + 1);
}

/** Compute how many more components following the trend would push share >= 0.8. */
function componentsToLockIn(currentShare: number, totalCount: number): number | null {
  if (currentShare >= 0.8) return 0;
  if (currentShare <= 0) return null;
  const count = currentShare * totalCount;
  // Solve (count + n) / (total + n) >= 0.8 for n.
  // count + n >= 0.8 * (total + n)
  // count + n >= 0.8 * total + 0.8 * n
  // 0.2 * n >= 0.8 * total - count
  // n >= (0.8 * total - count) / 0.2
  const n = Math.ceil((0.8 * totalCount - count) / 0.2);
  return n > 0 ? n : 0;
}

/** Generate trend projections for each dimension. */
function projectTrends(spec: MotionSpec): DimensionTrend[] {
  const n = spec.components.length;
  if (n === 0) return [];

  const easings = spec.components.map((c) => easingFamily(c.easing));
  const timings = spec.components.map((c) => timingTier(c.durationMs));
  const intensities = spec.components.map((c) => {
    let maxMag = 0;
    for (const kf of c.keyframes) {
      for (const prop of ["translateX", "translateY", "rotate", "scale"] as const) {
        const v = kf.properties[prop];
        if (typeof v === "number") maxMag = Math.max(maxMag, Math.abs(v));
        else if (typeof v === "string") {
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
  });
  const transforms = spec.components.map((c) => {
    const props = new Set<string>();
    for (const kf of c.keyframes) for (const k of Object.keys(kf.properties)) props.add(k);
    return Array.from(props).sort().join("+") || "static";
  });
  const loops = spec.components.map((c) => {
    if (c.iterationCount === "infinite") return "infinite";
    if (typeof c.iterationCount === "number" && c.iterationCount > 1) return "multi";
    return "once";
  });

  const dimensions = [
    { name: "easing", values: easings },
    { name: "timing", values: timings },
    { name: "intensity", values: intensities },
    { name: "transform", values: transforms },
    { name: "loop", values: loops },
  ];

  return dimensions.map(({ name, values }) => {
    const dominant = dominantValue(values);
    const projected = projectShare(dominant.share, n);
    const lockIn = componentsToLockIn(dominant.share, n);
    return {
      dimension: name,
      dominantValue: dominant.value,
      dominantShare: Math.round(dominant.share * 100) / 100,
      projectedShare: Math.round(projected * 100) / 100,
      trendingToMonoculture: projected >= 0.6 && dominant.share < 0.6,
      componentsToLockIn: lockIn,
    };
  });
}

/** Identify axes the project hasn't explored at all. */
function findMissingAxes(spec: MotionSpec): MissingAxis[] {
  const missing: MissingAxis[] = [];
  const easings = new Set(spec.components.map((c) => easingFamily(c.easing)));
  const loops = new Set(spec.components.map((c) => {
    if (c.iterationCount === "infinite") return "infinite";
    if (typeof c.iterationCount === "number" && c.iterationCount > 1) return "multi";
    return "once";
  }));
  const transforms = new Set<string>();
  for (const c of spec.components) {
    for (const kf of c.keyframes) {
      for (const k of Object.keys(kf.properties)) transforms.add(k);
    }
  }
  const intensities = new Set(spec.components.map((c) => {
    let maxMag = 0;
    for (const kf of c.keyframes) {
      for (const prop of ["translateX", "translateY", "rotate", "scale"] as const) {
        const v = kf.properties[prop];
        if (typeof v === "number") maxMag = Math.max(maxMag, Math.abs(v));
      }
    }
    if (maxMag <= 0) return "static";
    if (maxMag <= 30) return "subtle";
    if (maxMag <= 100) return "moderate";
    if (maxMag <= 300) return "bold";
    return "extreme";
  }));

  // Missing easing families.
  const easingGaps: string[] = [];
  if (!easings.has("bounce")) easingGaps.push("bounce");
  if (!easings.has("spring")) easingGaps.push("spring");
  if (!easings.has("snappy")) easingGaps.push("snappy");
  if (easingGaps.length > 0) {
    missing.push({
      dimension: "easing",
      missingValues: easingGaps,
      benefit: `Adding ${easingGaps.join(", ")} easing would expand the project's emotional range — bounce adds playfulness, spring adds physicality, snappy adds responsiveness.`,
    });
  }

  // Missing loop strategies.
  const loopGaps: string[] = [];
  if (!loops.has("infinite")) loopGaps.push("infinite");
  if (!loops.has("multi")) loopGaps.push("multi-repeat");
  if (loopGaps.length > 0) {
    missing.push({
      dimension: "loop",
      missingValues: loopGaps,
      benefit: "Adding infinite or multi-repeat loops would give the scene ambient life — pulses, breathing, ongoing rhythm.",
    });
  }

  // Missing transform properties.
  const transformGaps: string[] = [];
  if (!transforms.has("rotate")) transformGaps.push("rotate");
  if (!transforms.has("scale")) transformGaps.push("scale");
  if (transformGaps.length > 0) {
    missing.push({
      dimension: "transform",
      missingValues: transformGaps,
      benefit: `Animating ${transformGaps.join(" and ")} would add secondary motion — rotate adds spin, scale adds weight and emphasis.`,
    });
  }

  // Missing intensity tiers.
  const intensityGaps: string[] = [];
  if (!intensities.has("subtle")) intensityGaps.push("subtle");
  if (!intensities.has("bold")) intensityGaps.push("bold");
  if (intensityGaps.length > 0) {
    missing.push({
      dimension: "intensity",
      missingValues: intensityGaps,
      benefit: "Mixing intensity tiers creates visual hierarchy — subtle background motion paired with bold foreground motion guides the eye.",
    });
  }

  return missing;
}

/** Rank next moves by expected diversity gain. */
function rankNextMoves(trends: DimensionTrend[], missingAxes: MissingAxis[]): NextMove[] {
  const moves: NextMove[] = [];
  let rank = 1;

  // Highest priority: explore missing axes.
  for (const axis of missingAxes) {
    const gain = Math.min(40, 15 + axis.missingValues.length * 8);
    moves.push({
      rank,
      title: `Explore ${axis.dimension}: ${axis.missingValues.join(", ")}`,
      description: axis.benefit,
      expectedGain: gain,
      action: `Create a new component that uses ${axis.missingValues[0]} for its ${axis.dimension}.`,
      primaryDimension: axis.dimension,
    });
    rank++;
  }

  // Second priority: counter trending-to-monoculture dimensions.
  for (const trend of trends) {
    if (!trend.trendingToMonoculture) continue;
    moves.push({
      rank,
      title: `Counter the ${trend.dominantValue} trend in ${trend.dimension}`,
      description: `${trend.dimension} is at ${Math.round(trend.dominantShare * 100)}% "${trend.dominantValue}" and trending up. Adding a contrasting value would prevent monoculture lock-in.`,
      expectedGain: 25,
      action: `Add a component with a different ${trend.dimension} value than "${trend.dominantValue}".`,
      primaryDimension: trend.dimension,
    });
    rank++;
  }

  // Sort by expected gain descending, then re-rank.
  moves.sort((a, b) => b.expectedGain - a.expectedGain);
  moves.forEach((m, i) => { m.rank = i + 1; });
  return moves;
}

/** Identify risk flags if current patterns continue. */
function identifyRisks(trends: DimensionTrend[], spec: MotionSpec): RiskFlag[] {
  const risks: RiskFlag[] = [];

  for (const trend of trends) {
    if (trend.dimension === "timing" && trend.dominantValue === "fast" && trend.dominantShare >= 0.5) {
      risks.push({
        severity: trend.dominantShare >= 0.7 ? "critical" : "warning",
        dimension: "timing",
        message: `${Math.round(trend.dominantShare * 100)}% of components animate in <300ms — trending toward jarring motion.`,
        projection: "If this continues, the project will feel aggressive and inaccessible to vestibular-sensitive users.",
        mitigation: "Introduce slower components (600ms+) to balance the rhythm and provide visual rest.",
      });
    }
    if (trend.dimension === "intensity" && trend.dominantValue === "extreme" && trend.dominantShare >= 0.4) {
      risks.push({
        severity: trend.dominantShare >= 0.6 ? "critical" : "warning",
        dimension: "intensity",
        message: `${Math.round(trend.dominantShare * 100)}% of components are at extreme intensity — trending toward visual overload.`,
        projection: "Continued extreme motion will fatigue viewers and obscure hierarchy.",
        mitigation: "Pair extreme components with subtle ones to create contrast and visual hierarchy.",
      });
    }
    if (trend.dimension === "loop" && trend.dominantValue === "infinite" && trend.dominantShare >= 0.6) {
      risks.push({
        severity: "warning",
        dimension: "loop",
        message: `${Math.round(trend.dominantShare * 100)}% of components loop infinitely — trending toward ambient noise.`,
        projection: "Too many infinite loops compete for attention and reduce the impact of each.",
        mitigation: "Limit infinite loops to 1-2 ambient elements; convert the rest to single-play.",
      });
    }
    if (trend.dimension === "easing" && trend.dominantValue === "linear" && trend.dominantShare >= 0.5) {
      risks.push({
        severity: "warning",
        dimension: "easing",
        message: `${Math.round(trend.dominantShare * 100)}% of components use linear easing — trending toward mechanical motion.`,
        projection: "Linear motion feels robotic and artificial; the project will lack natural polish.",
        mitigation: "Switch most components to smooth or ease-out easing for natural acceleration/deceleration.",
      });
    }
  }

  // Check for flash-risk patterns in current components.
  const flashRisk = spec.components.some((c) => {
    const opacityKfs = c.keyframes.filter((k) => k.properties.opacity !== undefined);
    if (opacityKfs.length < 3) return false;
    const durationSec = c.durationMs / 1000;
    return durationSec > 0 && (opacityKfs.length / durationSec) > 6; // >6Hz rough oscillation
  });
  if (flashRisk) {
    risks.push({
      severity: "critical",
      dimension: "seizure",
      message: "At least one component shows high-frequency opacity oscillation — seizure risk.",
      projection: "Continued flashing patterns will be inaccessible and potentially harmful.",
      mitigation: "Reduce opacity oscillation frequency below 3Hz, or replace flashing with a smooth fade.",
    });
  }

  return risks;
}

/** Project the final form of the project if trends continue. */
function projectFinalForm(trends: DimensionTrend[], spec: MotionSpec): ProjectedFinalForm {
  const findByDim = (name: string) => trends.find((t) => t.dimension === name);
  const easingT = findByDim("easing");
  const timingT = findByDim("timing");
  const intensityT = findByDim("intensity");
  const transformT = findByDim("transform");
  const loopT = findByDim("loop");

  const dominantEasing = easingT?.dominantValue ?? "smooth";
  const dominantTiming = timingT?.dominantValue ?? "normal";
  const dominantIntensity = intensityT?.dominantValue ?? "moderate";
  const dominantTransform = transformT?.dominantValue ?? "opacity";
  const dominantLoop = loopT?.dominantValue ?? "once";

  // Health score — penalize monoculture and risky trends.
  let health = 80;
  for (const t of trends) {
    if (t.dominantShare >= 0.8) health -= 12;
    else if (t.dominantShare >= 0.6) health -= 6;
  }
  if (dominantTiming === "fast") health -= 8;
  if (dominantIntensity === "extreme") health -= 8;
  if (dominantEasing === "linear") health -= 6;
  health = Math.max(0, Math.min(100, health));

  const description = `If current trends continue, the project will read as ${dominantIntensity} ${dominantEasing} motion at ${dominantTiming} speed, animating ${dominantTransform}, ${dominantLoop === "infinite" ? "looping forever" : "playing once"}.`;

  return {
    description,
    dominantEasing,
    dominantTiming,
    dominantIntensity,
    dominantTransform,
    dominantLoop,
    healthScore: health,
  };
}

/** Run the forecast on a project spec. */
export function forecastMotion(spec: MotionSpec): ForecastResult {
  if (spec.components.length === 0) {
    return {
      componentCount: 0,
      trends: [],
      missingAxes: [],
      nextMoves: [],
      risks: [],
      projectedFinalForm: {
        description: "Empty project — no trends to forecast.",
        dominantEasing: "",
        dominantTiming: "",
        dominantIntensity: "",
        dominantTransform: "",
        dominantLoop: "",
        healthScore: 100,
      },
      summary: "Empty project — no trends to forecast.",
    };
  }

  const trends = projectTrends(spec);
  const missingAxes = findMissingAxes(spec);
  const nextMoves = rankNextMoves(trends, missingAxes);
  const risks = identifyRisks(trends, spec);
  const projectedFinalForm = projectFinalForm(trends, spec);

  const trendCount = trends.filter((t) => t.trendingToMonoculture).length;
  const riskCount = risks.length;
  const moveCount = nextMoves.length;

  const summary = `Forecast for ${spec.components.length} component(s). ${trendCount} dimension(s) trending to monoculture. ${riskCount} risk(s) flagged. ${moveCount} recommended next move(s). Projected health: ${projectedFinalForm.healthScore}/100.`;

  return {
    componentCount: spec.components.length,
    trends,
    missingAxes,
    nextMoves,
    risks,
    projectedFinalForm,
    summary,
  };
}

/** Format a forecast result as a human-readable report. */
export function formatForecastReport(result: ForecastResult): string {
  const lines: string[] = [];
  lines.push("=== Motion Forecast ===");
  lines.push("");
  lines.push(`Components: ${result.componentCount}`);
  lines.push("");

  if (result.trends.length > 0) {
    lines.push("--- Trend Projections ---");
    for (const t of result.trends) {
      const arrow = t.trendingToMonoculture ? "↑ RISK" : "→";
      lines.push(`${t.dimension.padEnd(12)} ${t.dominantValue} at ${Math.round(t.dominantShare * 100)}% → ${Math.round(t.projectedShare * 100)}% ${arrow}`);
      if (t.componentsToLockIn !== null && t.componentsToLockIn > 0) {
        lines.push(`  ${t.componentsToLockIn} more component(s) would lock in monoculture`);
      }
    }
    lines.push("");
  }

  if (result.missingAxes.length > 0) {
    lines.push("--- Missing Axes ---");
    for (const axis of result.missingAxes) {
      lines.push(`${axis.dimension}: missing ${axis.missingValues.join(", ")}`);
      lines.push(`  ${axis.benefit}`);
    }
    lines.push("");
  }

  if (result.nextMoves.length > 0) {
    lines.push("--- Recommended Next Moves ---");
    for (const move of result.nextMoves) {
      lines.push(`#${move.rank} (${move.expectedGain} gain) ${move.title}`);
      lines.push(`  ${move.description}`);
      lines.push(`  action: ${move.action}`);
    }
    lines.push("");
  }

  if (result.risks.length > 0) {
    lines.push("--- Risk Assessment ---");
    for (const risk of result.risks) {
      lines.push(`[${risk.severity.toUpperCase()}] ${risk.dimension}: ${risk.message}`);
      lines.push(`  projection: ${risk.projection}`);
      lines.push(`  mitigation: ${risk.mitigation}`);
    }
    lines.push("");
  }

  lines.push("--- Projected Final Form ---");
  lines.push(result.projectedFinalForm.description);
  lines.push(`Health: ${result.projectedFinalForm.healthScore}/100`);
  lines.push("");
  lines.push(`Summary: ${result.summary}`);
  return lines.join("\n");
}
