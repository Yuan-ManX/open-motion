/**
 * Motion Variant Comparator — multi-criteria variant comparison and ranking.
 *
 * This is the twenty-second original AI-native module. Where the Variation
 * Engine generates variants and the Critique scores a single component, the
 * Comparator evaluates multiple variants side-by-side across five criteria and
 * recommends the best option with transparent reasoning.
 *
 * Five evaluation criteria:
 * 1. Accessibility — estimates vestibular risk, flash risk, and motion
 *    reduction friendliness from the component's properties.
 * 2. Performance — estimates GPU cost from animated properties, duration,
 *    and loop behavior.
 * 3. Aesthetic novelty — scores how distinctive the easing and transform
 *    signature are compared to common patterns.
 * 4. Consistency — measures how well the variant's DNA matches the project's
 *    dominant easing family and timing tier.
 * 5. Clarity — evaluates whether the animation's duration and intensity are
 *    in a perceptually comfortable range.
 *
 * The comparator produces a ranked table with per-criterion scores, an overall
 * winner, and a trade-off analysis explaining what each variant sacrifices.
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, MotionSpec, Easing } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The five evaluation criteria. */
export type Criterion = "accessibility" | "performance" | "novelty" | "consistency" | "clarity";

/** Per-criterion score for a single variant. */
export interface CriterionScore {
  criterion: Criterion;
  /** Score 0..100. Higher is better. */
  score: number;
  /** Short explanation of the score. */
  reasoning: string;
}

/** A single variant's evaluation. */
export interface VariantEvaluation {
  /** Index of the variant in the input array. */
  index: number;
  componentId: string;
  componentName: string;
  /** Overall score (weighted average, 0..100). */
  overallScore: number;
  /** Per-criterion scores. */
  scores: CriterionScore[];
  /** Which criterion this variant wins. */
  wins: Criterion[];
  /** Rank (1 = best). */
  rank: number;
}

/** A trade-off between two variants. */
export interface TradeOff {
  /** The variant that wins the overall comparison. */
  winnerIndex: number;
  winnerName: string;
  /** The variant that loses overall but may win on specific criteria. */
  loserIndex: number;
  loserName: string;
  /** What the winner sacrifices compared to the loser. */
  sacrifices: string[];
  /** What the loser sacrifices compared to the winner. */
  gains: string[];
}

/** The complete comparison report. */
export interface ComparisonReport {
  variantCount: number;
  evaluations: VariantEvaluation[];
  /** The index of the recommended variant. */
  recommendedIndex: number;
  recommendedName: string;
  /** Why this variant is recommended. */
  recommendation: string;
  /** Trade-off analysis between the top 2 variants. */
  tradeOffs: TradeOff[];
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

/** Get all animated properties from a component. */
function getProperties(component: MotionComponent): Set<string> {
  const props = new Set<string>();
  for (const kf of component.keyframes) {
    const p = kf.properties as Record<string, unknown>;
    for (const key of Object.keys(p)) {
      props.add(key);
    }
  }
  return props;
}

/** Check if a component has infinite loops. */
function isInfiniteLoop(component: MotionComponent): boolean {
  return component.iterationCount === "infinite";
}

/** Check if a component has large translations (vestibular risk). */
function hasLargeTranslation(component: MotionComponent): boolean {
  for (const kf of component.keyframes) {
    const p = kf.properties as Record<string, unknown>;
    if (typeof p.translateX === "number" && Math.abs(p.translateX) > 300) return true;
    if (typeof p.translateY === "number" && Math.abs(p.translateY) > 300) return true;
  }
  return false;
}

/** Check if a component has large rotations. */
function hasLargeRotation(component: MotionComponent): boolean {
  for (const kf of component.keyframes) {
    const p = kf.properties as Record<string, unknown>;
    if (typeof p.rotate === "number" && Math.abs(p.rotate) > 360) return true;
    if (typeof p.rotation === "number" && Math.abs(p.rotation) > 360) return true;
  }
  return false;
}

/** Check if a component animates opacity (flash risk). */
function hasOpacityChange(component: MotionComponent): boolean {
  for (const kf of component.keyframes) {
    const p = kf.properties as Record<string, unknown>;
    if (typeof p.opacity === "number") return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Criterion scoring
// ---------------------------------------------------------------------------

/** Score accessibility (0..100). Higher = more accessible. */
function scoreAccessibility(component: MotionComponent): CriterionScore {
  let score = 100;
  const reasons: string[] = [];

  if (isInfiniteLoop(component)) {
    score -= 30;
    reasons.push("infinite loop may cause distraction");
  }
  if (hasLargeTranslation(component)) {
    score -= 20;
    reasons.push("large translation creates vestibular risk");
  }
  if (hasLargeRotation(component)) {
    score -= 15;
    reasons.push("large rotation creates vestibular risk");
  }
  if (hasOpacityChange(component) && isInfiniteLoop(component) && component.durationMs < 333) {
    score -= 25;
    reasons.push("fast opacity changes in a loop risk flashing above 3Hz");
  }
  if (component.durationMs > 5000) {
    score -= 10;
    reasons.push("long duration may test attention span");
  }

  score = Math.max(0, score);
  return {
    criterion: "accessibility",
    score,
    reasoning: reasons.length > 0 ? reasons.join("; ") : "no accessibility concerns detected",
  };
}

/** Score performance (0..100). Higher = better performance. */
function scorePerformance(component: MotionComponent): CriterionScore {
  let score = 100;
  const reasons: string[] = [];

  const props = getProperties(component);
  // Paint-heavy properties
  const paintProps = ["opacity", "boxShadow", "filter", "backgroundColor", "color", "borderColor"];
  const paintCount = [...props].filter((p) => paintProps.includes(p)).length;
  if (paintCount > 0) {
    score -= paintCount * 8;
    reasons.push(`${paintCount} paint-heavy propert${paintCount > 1 ? "ies" : "y"}`);
  }

  // Transform properties are cheap
  const transformProps = ["translateX", "translateY", "scale", "scaleX", "scaleY", "rotate", "rotation"];
  const transformCount = [...props].filter((p) => transformProps.includes(p)).length;
  if (transformCount > 0) {
    score += 5; // Slight bonus for using transforms
  }

  // Long durations with loops are costly
  if (isInfiniteLoop(component) && component.durationMs > 2000) {
    score -= 15;
    reasons.push("infinite loop with long duration");
  }

  // Very short durations cause layout thrash
  if (component.durationMs < 200) {
    score -= 10;
    reasons.push("very short duration may cause layout thrash");
  }

  score = Math.max(0, Math.min(100, score));
  return {
    criterion: "performance",
    score,
    reasoning: reasons.length > 0 ? reasons.join("; ") : "performance is well-optimized",
  };
}

/** Score aesthetic novelty (0..100). Higher = more distinctive. */
function scoreNovelty(component: MotionComponent): CriterionScore {
  let score = 50;
  const reasons: string[] = [];

  const family = easingFamily(component.easing);
  // Common easings are less novel
  if (family === "spring") {
    score += 20;
    reasons.push("spring physics adds organic character");
  } else if (family === "bounce") {
    score += 25;
    reasons.push("bounce easing is distinctive");
  } else if (family === "elastic") {
    score += 25;
    reasons.push("elastic easing is distinctive");
  } else if (family === "ease-out") {
    score += 5;
  } else if (family === "linear") {
    score -= 15;
    reasons.push("linear easing feels mechanical");
  }

  // Multiple animated properties add richness
  const propCount = getProperties(component).size;
  if (propCount >= 3) {
    score += 15;
    reasons.push(`${propCount} animated properties create rich motion`);
  } else if (propCount === 1) {
    score -= 5;
    reasons.push("single property animation is simple");
  }

  // Non-standard durations are more memorable
  if (component.durationMs > 1000 && component.durationMs < 3000) {
    score += 10;
    reasons.push("deliberate duration creates presence");
  }

  score = Math.max(0, Math.min(100, score));
  return {
    criterion: "novelty",
    score,
    reasoning: reasons.length > 0 ? reasons.join("; ") : "standard motion pattern",
  };
}

/** Score consistency with the project (0..100). Higher = more consistent. */
function scoreConsistency(component: MotionComponent, spec: MotionSpec): CriterionScore {
  let score = 50;
  const reasons: string[] = [];

  const projectFamilies = new Map<string, number>();
  for (const c of spec.components) {
    if (c.id === component.id) continue;
    const f = easingFamily(c.easing);
    projectFamilies.set(f, (projectFamilies.get(f) ?? 0) + 1);
  }

  const dominantFamily = [...projectFamilies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const componentFamily = easingFamily(component.easing);

  if (dominantFamily && componentFamily === dominantFamily) {
    score += 30;
    reasons.push(`easing family matches project dominant (${dominantFamily})`);
  } else if (dominantFamily) {
    score -= 10;
    reasons.push(`easing family (${componentFamily}) differs from project dominant (${dominantFamily})`);
  }

  // Duration consistency
  const otherDurations = spec.components.filter((c) => c.id !== component.id).map((c) => c.durationMs);
  if (otherDurations.length > 0) {
    const avgDuration = otherDurations.reduce((a, b) => a + b, 0) / otherDurations.length;
    const ratio = component.durationMs / avgDuration;
    if (ratio > 0.5 && ratio < 2) {
      score += 20;
      reasons.push("duration aligns with project average");
    } else if (ratio > 2) {
      score -= 15;
      reasons.push(`duration is ${Math.round(ratio)}x longer than project average`);
    } else if (ratio < 0.5) {
      score -= 15;
      reasons.push(`duration is much shorter than project average`);
    }
  }

  score = Math.max(0, Math.min(100, score));
  return {
    criterion: "consistency",
    score,
    reasoning: reasons.length > 0 ? reasons.join("; ") : "no consistency data available",
  };
}

/** Score clarity (0..100). Higher = clearer perception. */
function scoreClarity(component: MotionComponent): CriterionScore {
  let score = 50;
  const reasons: string[] = [];

  // Optimal duration range: 300-1500ms
  if (component.durationMs >= 300 && component.durationMs <= 1500) {
    score += 30;
    reasons.push("duration is in the optimal perceptual range (300-1500ms)");
  } else if (component.durationMs < 200) {
    score -= 20;
    reasons.push("duration is too short to perceive comfortably");
  } else if (component.durationMs > 3000) {
    score -= 15;
    reasons.push("duration is long enough to lose viewer attention");
  }

  // Intensity check
  let hasTransform = false;
  for (const kf of component.keyframes) {
    const p = kf.properties as Record<string, unknown>;
    if (typeof p.translateX === "number" || typeof p.translateY === "number" || typeof p.scale === "number" || typeof p.rotate === "number") {
      hasTransform = true;
      break;
    }
  }
  if (hasTransform) {
    score += 10;
    reasons.push("transform-based motion is easy to perceive");
  }

  // Too many keyframes can be confusing
  if (component.keyframes.length > 6) {
    score -= 10;
    reasons.push(`${component.keyframes.length} keyframes may create complex motion`);
  } else if (component.keyframes.length >= 2 && component.keyframes.length <= 4) {
    score += 10;
    reasons.push("clean keyframe count");
  }

  score = Math.max(0, Math.min(100, score));
  return {
    criterion: "clarity",
    score,
    reasoning: reasons.length > 0 ? reasons.join("; ") : "standard clarity",
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/** Criterion weights for the overall score. */
const CRITERION_WEIGHTS: Record<Criterion, number> = {
  accessibility: 0.25,
  performance: 0.20,
  novelty: 0.20,
  consistency: 0.20,
  clarity: 0.15,
};

/**
 * Compare multiple component variants across five criteria and recommend
 * the best option.
 *
 * The components to compare are identified by their IDs in the `variantIds`
 * array. If empty, all components in the spec are compared.
 */
export function compareVariants(
  spec: MotionSpec,
  variantIds?: string[],
): ComparisonReport {
  const components = variantIds && variantIds.length > 0
    ? spec.components.filter((c) => variantIds.includes(c.id))
    : spec.components;

  if (components.length === 0) {
    return {
      variantCount: 0,
      evaluations: [],
      recommendedIndex: 0,
      recommendedName: "none",
      recommendation: "No variants to compare.",
      tradeOffs: [],
      summary: "No variants provided for comparison.",
    };
  }

  if (components.length === 1) {
    return {
      variantCount: 1,
      evaluations: [{
        index: 0,
        componentId: components[0].id,
        componentName: components[0].name,
        overallScore: 0,
        scores: [],
        wins: [],
        rank: 1,
      }],
      recommendedIndex: 0,
      recommendedName: components[0].name,
      recommendation: "Only one variant provided — no comparison needed.",
      tradeOffs: [],
      summary: "Only one variant provided.",
    };
  }

  // Evaluate each variant
  const evaluations: VariantEvaluation[] = components.map((c, i) => {
    const scores: CriterionScore[] = [
      scoreAccessibility(c),
      scorePerformance(c),
      scoreNovelty(c),
      scoreConsistency(c, spec),
      scoreClarity(c),
    ];

    const overallScore = Math.round(
      scores.reduce((sum, s) => sum + s.score * CRITERION_WEIGHTS[s.criterion], 0),
    );

    return {
      index: i,
      componentId: c.id,
      componentName: c.name,
      overallScore,
      scores,
      wins: [],
      rank: 0,
    };
  });

  // Sort by overall score
  evaluations.sort((a, b) => b.overallScore - a.overallScore);
  evaluations.forEach((e, i) => { e.rank = i + 1; });

  // Determine per-criterion winners
  const criteria: Criterion[] = ["accessibility", "performance", "novelty", "consistency", "clarity"];
  for (const criterion of criteria) {
    let bestScore = -1;
    let bestIndex = -1;
    for (const e of evaluations) {
      const s = e.scores.find((sc) => sc.criterion === criterion)?.score ?? 0;
      if (s > bestScore) {
        bestScore = s;
        bestIndex = e.index;
      }
    }
    const winner = evaluations.find((e) => e.index === bestIndex);
    if (winner) winner.wins.push(criterion);
  }

  // Build trade-off analysis between top 2
  const tradeOffs: TradeOff[] = [];
  if (evaluations.length >= 2) {
    const winner = evaluations[0];
    const loser = evaluations[1];
    const sacrifices: string[] = [];
    const gains: string[] = [];

    for (const criterion of criteria) {
      const winnerScore = winner.scores.find((s) => s.criterion === criterion)?.score ?? 0;
      const loserScore = loser.scores.find((s) => s.criterion === criterion)?.score ?? 0;
      if (loserScore > winnerScore) {
        sacrifices.push(`${criterion} (${loserScore} vs ${winnerScore})`);
      } else if (winnerScore > loserScore) {
        gains.push(`${criterion} (${winnerScore} vs ${loserScore})`);
      }
    }

    tradeOffs.push({
      winnerIndex: winner.index,
      winnerName: winner.componentName,
      loserIndex: loser.index,
      loserName: loser.componentName,
      sacrifices: sacrifices.length > 0 ? sacrifices : ["none — winner dominates all criteria"],
      gains: gains.length > 0 ? gains : ["none — loser is dominated"],
    });
  }

  const recommended = evaluations[0];
  const recommendation = `"${recommended.componentName}" is recommended with an overall score of ${recommended.overallScore}/100. ` +
    `It wins on: ${recommended.wins.length > 0 ? recommended.wins.join(", ") : "no single criterion (balanced overall)"}. ` +
    `Strengths: ${recommended.scores.filter((s) => s.score >= 70).map((s) => `${s.criterion} (${s.score})`).join(", ") || "consistent across all criteria"}.`;

  const summary = `Compared ${components.length} variants. Recommended: "${recommended.componentName}" (${recommended.overallScore}/100). ` +
    `${tradeOffs.length > 0 ? `Trade-off: choosing "${recommended.componentName}" over "${evaluations[1].componentName}" sacrifices ${tradeOffs[0].sacrifices.join(", ")}.` : ""}`;

  return {
    variantCount: components.length,
    evaluations,
    recommendedIndex: recommended.index,
    recommendedName: recommended.componentName,
    recommendation,
    tradeOffs,
    summary,
  };
}

/** Format a comparison report as a human-readable string. */
export function formatComparisonReport(report: ComparisonReport): string {
  const lines: string[] = [];
  lines.push(`=== Motion Variant Comparison ===`);
  lines.push(`Variants: ${report.variantCount}`);
  lines.push(`Recommended: ${report.recommendedName}`);
  lines.push("");

  lines.push(`--- Ranking ---`);
  for (const e of report.evaluations) {
    lines.push(`  #${e.rank} ${e.componentName} — overall ${e.overallScore}/100`);
    for (const s of e.scores) {
      lines.push(`    ${s.criterion}: ${s.score}/100 — ${s.reasoning}`);
    }
    if (e.wins.length > 0) {
      lines.push(`    Wins: ${e.wins.join(", ")}`);
    }
  }

  lines.push("");
  lines.push(`--- Recommendation ---`);
  lines.push(`  ${report.recommendation}`);

  if (report.tradeOffs.length > 0) {
    lines.push("");
    lines.push(`--- Trade-off Analysis ---`);
    for (const t of report.tradeOffs) {
      lines.push(`  ${t.winnerName} vs ${t.loserName}`);
      lines.push(`    Choosing ${t.winnerName} sacrifices: ${t.sacrifices.join("; ")}`);
      lines.push(`    Choosing ${t.winnerName} gains: ${t.gains.join("; ")}`);
    }
  }

  lines.push("");
  lines.push(`Summary: ${report.summary}`);

  return lines.join("\n");
}
