/**
 * Motion Heuristics Engine — applies design heuristics to evaluate and
 * improve motion compositions. Each heuristic captures a design principle
 * and returns a score, rationale, and actionable suggestion. The engine
 * aggregates all heuristics into a composite quality signal.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeuristicResult {
  id: string;
  name: string;
  category: "timing" | "hierarchy" | "rhythm" | "contrast" | "consistency" | "accessibility" | "performance";
  score: number; // 0..1
  rationale: string;
  suggestion: string;
  affectedComponents: string[];
}

export interface HeuristicsReport {
  results: HeuristicResult[];
  compositeScore: number;
  topIssue: string | null;
  quickWins: string[];
}

// ---------------------------------------------------------------------------
// Heuristic functions
// ---------------------------------------------------------------------------

/** Check that durations fall within comfortable perceptual ranges. */
function checkDurationRange(spec: MotionSpec): HeuristicResult {
  const tooShort = spec.components.filter((c) => c.durationMs < 200 && c.durationMs > 0);
  const tooLong = spec.components.filter((c) => c.durationMs > 5000);
  const affected = [...tooShort, ...tooLong].map((c) => c.id);
  const score = affected.length === 0 ? 1 : Math.max(0, 1 - affected.length * 0.15);

  let rationale = "All durations fall within comfortable perceptual ranges (200ms–5000ms).";
  let suggestion = "";
  if (tooShort.length > 0) {
    rationale = `${tooShort.length} component(s) have durations below 200ms — too fast to perceive.`;
    suggestion = "Increase duration to at least 300ms for perceivable motion.";
  }
  if (tooLong.length > 0) {
    rationale = `${tooLong.length} component(s) exceed 5000ms — risks losing viewer attention.`;
    suggestion = "Consider splitting into shorter, sequential segments.";
  }

  return {
    id: "duration-range",
    name: "Duration Range",
    category: "timing",
    score,
    rationale,
    suggestion,
    affectedComponents: affected,
  };
}

/** Check that stagger delays create a natural cascading effect. */
function checkStaggerPattern(spec: MotionSpec): HeuristicResult {
  if (spec.components.length < 2) {
    return {
      id: "stagger-pattern",
      name: "Stagger Pattern",
      category: "rhythm",
      score: 1,
      rationale: "Single component — no stagger needed.",
      suggestion: "",
      affectedComponents: [],
    };
  }

  const sorted = [...spec.components].sort((a, b) => a.delayMs - b.delayMs);
  const delays = sorted.map((c) => c.delayMs);
  const gaps: number[] = [];
  for (let i = 1; i < delays.length; i++) {
    gaps.push(delays[i]! - delays[i - 1]!);
  }

  // Good stagger: gaps between 50-300ms
  const goodGaps = gaps.filter((g) => g >= 50 && g <= 300);
  const zeroGaps = gaps.filter((g) => g === 0);
  const score = gaps.length > 0 ? goodGaps.length / gaps.length : 1;

  let rationale = "Stagger delays create a natural cascading rhythm.";
  let suggestion = "";
  if (zeroGaps.length > 0) {
    rationale = `${zeroGaps.length + 1} components share the same delay — no cascade effect.`;
    suggestion = "Offset each component by 80-150ms for a staggered entrance.";
  } else if (goodGaps.length < gaps.length * 0.5) {
    rationale = "Stagger gaps are irregular — rhythm feels inconsistent.";
    suggestion = "Aim for consistent 80-150ms gaps between sequential elements.";
  }

  return {
    id: "stagger-pattern",
    name: "Stagger Pattern",
    category: "rhythm",
    score,
    rationale,
    suggestion,
    affectedComponents: sorted.map((c) => c.id),
  };
}

/** Check that there's a clear visual hierarchy via scale contrast. */
function checkScaleHierarchy(spec: MotionSpec): HeuristicResult {
  const withScale = spec.components.filter((c) =>
    c.keyframes.some((kf) => "scale" in kf.properties),
  );

  if (withScale.length === 0) {
    return {
      id: "scale-hierarchy",
      name: "Scale Hierarchy",
      category: "hierarchy",
      score: 0.7,
      rationale: "No scale transforms detected — hierarchy may rely on other cues.",
      suggestion: "Consider using scale to establish visual hierarchy between elements.",
      affectedComponents: [],
    };
  }

  // Check for hero elements (large scale) vs supporting elements
  const maxScales = withScale.map((c) => {
    const scales = c.keyframes
      .map((kf) => kf.properties["scale"])
      .filter((s): s is number => typeof s === "number");
    return { id: c.id, maxScale: scales.length > 0 ? Math.max(...scales) : 1 };
  });

  const heroCount = maxScales.filter((m) => m.maxScale >= 1.2).length;
  const score = heroCount > 0 && heroCount <= withScale.length / 2 ? 1 : 0.6;

  return {
    id: "scale-hierarchy",
    name: "Scale Hierarchy",
    category: "hierarchy",
    score,
    rationale: score === 1
      ? "Clear scale hierarchy with hero elements standing out."
      : "Scale hierarchy unclear — too many or too few hero-scale elements.",
    suggestion: score === 1 ? "" : "Reserve scale ≥ 1.2 for 1-2 hero elements; keep others at scale 1.0.",
    affectedComponents: maxScales.filter((m) => m.maxScale >= 1.2).map((m) => m.id),
  };
}

/** Check easing consistency across the composition. */
function checkEasingConsistency(spec: MotionSpec): HeuristicResult {
  if (spec.components.length === 0) {
    return {
      id: "easing-consistency",
      name: "Easing Consistency",
      category: "consistency",
      score: 1,
      rationale: "No components to check.",
      suggestion: "",
      affectedComponents: [],
    };
  }

  const easingFamilies = new Map<string, number>();
  for (const c of spec.components) {
    const family = c.easing.type === "preset" ? c.easing.name ?? "unknown" : "bezier";
    easingFamilies.set(family, (easingFamilies.get(family) ?? 0) + 1);
  }

  // Good: 1-3 easing families
  const score = easingFamilies.size <= 3 ? 1 : Math.max(0.4, 1 - (easingFamilies.size - 3) * 0.15);
  const dominant = Array.from(easingFamilies.entries()).sort((a, b) => b[1] - a[1])[0];

  return {
    id: "easing-consistency",
    name: "Easing Consistency",
    category: "consistency",
    score,
    rationale: score === 1
      ? `${easingFamilies.size} easing famil${easingFamilies.size === 1 ? "y" : "ies"} used — consistent.`
      : `${easingFamilies.size} easing families used — feels inconsistent.`,
    suggestion: score === 1 ? "" : `Standardize on "${dominant?.[0]}" easing for visual coherence.`,
    affectedComponents: spec.components.map((c) => c.id),
  };
}

/** Check for motion contrast — variation in speed and direction. */
function checkMotionContrast(spec: MotionSpec): HeuristicResult {
  if (spec.components.length < 2) {
    return {
      id: "motion-contrast",
      name: "Motion Contrast",
      category: "contrast",
      score: 0.8,
      rationale: "Single component — limited contrast opportunity.",
      suggestion: "",
      affectedComponents: [],
    };
  }

  const durations = spec.components.map((c) => c.durationMs);
  const minDur = Math.min(...durations);
  const maxDur = Math.max(...durations);
  const ratio = maxDur / Math.max(1, minDur);

  // Good contrast: at least 2x variation
  const score = ratio >= 2 ? 1 : ratio >= 1.5 ? 0.7 : 0.4;

  return {
    id: "motion-contrast",
    name: "Motion Contrast",
    category: "contrast",
    score,
    rationale: score === 1
      ? `Good contrast — durations span ${minDur}ms to ${formatDur(maxDur)} (${ratio.toFixed(1)}x).`
      : `Low contrast — all durations cluster around ${minDur}-${maxDur}ms.`,
    suggestion: score < 0.7 ? "Vary durations more: mix fast (300ms) and slow (1500ms) motions." : "",
    affectedComponents: spec.components.map((c) => c.id),
  };
}

function formatDur(maxDur: number): string {
  return maxDur >= 1000 ? `${(maxDur / 1000).toFixed(1)}s` : `${maxDur}ms`;
}

/** Check for infinite loops that may cause accessibility issues. */
function checkInfiniteLoops(spec: MotionSpec): HeuristicResult {
  const infinite = spec.components.filter(
    (c) => c.iterationCount === "infinite" || (typeof c.iterationCount === "number" && c.iterationCount > 100),
  );
  const score = infinite.length === 0 ? 1 : Math.max(0.3, 1 - infinite.length * 0.2);

  return {
    id: "infinite-loops",
    name: "Loop Safety",
    category: "accessibility",
    score,
    rationale: infinite.length === 0
      ? "No infinite loops — safe for reduced-motion users."
      : `${infinite.length} component(s) loop infinitely — may cause vestibular distress.`,
    suggestion: infinite.length > 0 ? "Cap iterations at 3-5 or provide a reduced-motion fallback." : "",
    affectedComponents: infinite.map((c) => c.id),
  };
}

/** Check GPU-friendliness — prefer transform and opacity over layout properties. */
function checkGpuFriendly(spec: MotionSpec): HeuristicResult {
  const layoutProps = ["width", "height", "margin", "padding", "top", "left", "right", "bottom"];
  const offenders: MotionComponent[] = [];

  for (const c of spec.components) {
    const animProps = new Set<string>();
    for (const kf of c.keyframes) {
      for (const key of Object.keys(kf.properties)) {
        animProps.add(key);
      }
    }
    const hasLayout = Array.from(animProps).some((p) => layoutProps.includes(p));
    if (hasLayout) offenders.push(c);
  }

  const score = offenders.length === 0 ? 1 : Math.max(0.3, 1 - offenders.length * 0.15);

  return {
    id: "gpu-friendly",
    name: "GPU Compositing",
    category: "performance",
    score,
    rationale: offenders.length === 0
      ? "All animations use GPU-accelerated properties (transform, opacity, filter)."
      : `${offenders.length} component(s) animate layout properties — causes reflow.`,
    suggestion: offenders.length > 0 ? "Replace layout property animations with transform equivalents." : "",
    affectedComponents: offenders.map((c) => c.id),
  };
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

const HEURISTICS: Array<(spec: MotionSpec) => HeuristicResult> = [
  checkDurationRange,
  checkStaggerPattern,
  checkScaleHierarchy,
  checkEasingConsistency,
  checkMotionContrast,
  checkInfiniteLoops,
  checkGpuFriendly,
];

/** Run all heuristics and produce a composite report. */
export function runHeuristics(spec: MotionSpec): HeuristicsReport {
  const results = HEURISTICS.map((h) => h(spec));
  const compositeScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  // Find the lowest-scoring heuristic as top issue
  const sorted = [...results].sort((a, b) => a.score - b.score);
  const topIssue = sorted[0] && sorted[0].score < 0.7
    ? `${sorted[0].name}: ${sorted[0].suggestion}`
    : null;

  // Quick wins: high-impact, easy-to-fix suggestions
  const quickWins = results
    .filter((r) => r.score < 0.8 && r.suggestion)
    .sort((a, b) => a.score - b.score)
    .map((r) => r.suggestion)
    .slice(0, 3);

  return {
    results,
    compositeScore,
    topIssue,
    quickWins,
  };
}

/** Format the heuristics report as a human-readable string. */
export function formatHeuristicsReport(report: HeuristicsReport): string {
  const lines: string[] = [
    `Composite Score: ${(report.compositeScore * 100).toFixed(0)}/100`,
  ];

  if (report.topIssue) {
    lines.push(`Top Issue: ${report.topIssue}`);
  }

  if (report.quickWins.length > 0) {
    lines.push("Quick Wins:");
    for (const w of report.quickWins) {
      lines.push(`  - ${w}`);
    }
  }

  for (const r of report.results) {
    const bar = "█".repeat(Math.round(r.score * 10)) + "░".repeat(10 - Math.round(r.score * 10));
    lines.push(`  ${r.name.padEnd(22)} ${bar} ${(r.score * 100).toFixed(0)}%`);
  }

  return lines.join("\n");
}
