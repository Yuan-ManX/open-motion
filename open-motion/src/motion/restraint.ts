import type { MotionComponent, MotionSpec } from "@openmotion/shared";

/**
 * Restraint engine — analyzes motion density and warns when too many animations
 * compete for attention in the same time window.
 *
 * Core principle: good motion design is about restraint, not abundance. Too many
 * simultaneous animations create visual noise, reduce clarity, and dilute the
 * impact of each individual motion. The engine calculates overlap windows and
 * produces actionable warnings.
 */

export interface RestraintAnalysis {
  /** Overall restraint score (0-100, higher is better). */
  score: number;
  /** Number of components in the project. */
  componentCount: number;
  /** Number of simultaneously animating components at peak. */
  peakSimultaneous: number;
  /** Time window (ms) with the most overlap. */
  peakWindowStart: number;
  peakWindowEnd: number;
  /** Warnings about specific issues. */
  warnings: RestraintWarning[];
  /** Recommendations for improvement. */
  recommendations: string[];
}

export interface RestraintWarning {
  level: "info" | "warn" | "critical";
  message: string;
  componentIds?: string[];
  timeRange?: { start: number; end: number };
}

interface AnimationWindow {
  componentId: string;
  componentName: string;
  start: number;
  end: number;
  isLoop: boolean;
}

/** Calculate the animation time window for a component. */
function animationWindow(c: MotionComponent): AnimationWindow {
  const iters = c.iterationCount === "infinite" ? 1 : Number(c.iterationCount) || 1;
  const end = c.delayMs + c.durationMs * iters;
  return {
    componentId: c.id,
    componentName: c.name,
    start: c.delayMs,
    end,
    isLoop: c.iterationCount === "infinite" || (typeof c.iterationCount === "number" && c.iterationCount > 1),
  };
}

/** Find the time window with the most overlapping animations. */
function findPeakOverlap(windows: AnimationWindow[]): {
  peak: number;
  start: number;
  end: number;
  overlapping: AnimationWindow[];
} {
  if (windows.length === 0) return { peak: 0, start: 0, end: 0, overlapping: [] };

  // Collect all boundary points
  const points: { time: number; isStart: boolean; window: AnimationWindow }[] = [];
  for (const w of windows) {
    points.push({ time: w.start, isStart: true, window: w });
    if (!w.isLoop) points.push({ time: w.end, isStart: false, window: w });
  }
  points.sort((a, b) => a.time - b.time);

  let current = 0;
  let peak = 0;
  let peakTime = 0;
  const active = new Set<AnimationWindow>();
  const peakSet = new Set<AnimationWindow>();

  for (const p of points) {
    if (p.isStart) {
      current++;
      active.add(p.window);
      if (current > peak) {
        peak = current;
        peakTime = p.time;
        peakSet.clear();
        for (const a of active) peakSet.add(a);
      }
    } else {
      current--;
      active.delete(p.window);
    }
  }

  const overlapping = [...peakSet];
  // Estimate the peak window end as the earliest end among overlapping items
  const ends = overlapping.map((w) => (w.isLoop ? w.start + w.end : w.end));
  const peakEnd = ends.length > 0 ? Math.min(...ends) : peakTime + 500;

  return { peak, start: peakTime, end: peakEnd, overlapping };
}

/** Analyze motion density and produce a restraint report. */
export function analyzeRestraint(spec: MotionSpec): RestraintAnalysis {
  const components = spec.components;
  const windows = components.map(animationWindow);
  const { peak, start, end, overlapping } = findPeakOverlap(windows);

  const warnings: RestraintWarning[] = [];
  const recommendations: string[] = [];

  // Check 1: Too many simultaneous animations
  if (peak > 5) {
    warnings.push({
      level: "critical",
      message: `${peak} components animate simultaneously (${start}ms–${Math.round(end)}ms). Consider staggering entrance times.`,
      componentIds: overlapping.map((w) => w.componentId),
      timeRange: { start, end: Math.round(end) },
    });
    recommendations.push("Stagger component delays by 100-200ms to reduce visual congestion.");
  } else if (peak > 3) {
    warnings.push({
      level: "warn",
      message: `${peak} components animate at the same time. Consider adding delays for visual rhythm.`,
      componentIds: overlapping.map((w) => w.componentId),
      timeRange: { start, end: Math.round(end) },
    });
    recommendations.push("Add incremental delays to create a cascade effect.");
  }

  // Check 2: All components use the same easing
  const easingTypes = new Set(components.map((c) => c.easing?.type === "preset" ? c.easing.name : c.easing?.type));
  if (components.length > 2 && easingTypes.size === 1) {
    warnings.push({
      level: "warn",
      message: `All ${components.length} components use the same easing (${[...easingTypes][0]}). Variation creates visual interest.`,
    });
    recommendations.push("Mix easing types — try bounce for emphasis elements, smooth for transitions.");
  }

  // Check 3: Identical durations
  const durations = new Set(components.map((c) => c.durationMs));
  if (components.length > 2 && durations.size === 1) {
    warnings.push({
      level: "info",
      message: `All components have the same duration (${[...durations][0]}ms). Varying durations create depth.`,
    });
    recommendations.push("Use 2-3 different duration tiers (e.g., 400ms, 800ms, 1200ms) for visual hierarchy.");
  }

  // Check 4: Infinite loops competing
  const loopCount = components.filter((c) => c.iterationCount === "infinite").length;
  if (loopCount > 3) {
    warnings.push({
      level: "warn",
      message: `${loopCount} components loop infinitely. Multiple infinite loops create visual noise and increase CPU usage.`,
      componentIds: components.filter((c) => c.iterationCount === "infinite").map((c) => c.id),
    });
    recommendations.push("Limit infinite loops to 1-2 focal elements. Use finite iterations for supporting motion.");
  }

  // Check 5: No delays at all (everything starts at once)
  const noDelayCount = components.filter((c) => c.delayMs === 0).length;
  if (components.length > 2 && noDelayCount === components.length) {
    warnings.push({
      level: "info",
      message: "All components start at 0ms delay. Adding staggered delays improves perceived choreography.",
    });
    recommendations.push("Set incremental delays (e.g., 0, 100, 200, 300ms) for a polished entrance sequence.");
  }

  // Check 6: Excessive duration
  const longAnims = components.filter((c) => c.durationMs > 3000);
  if (longAnims.length > 0) {
    warnings.push({
      level: "info",
      message: `${longAnims.length} component(s) have duration > 3000ms. Long animations may lose user attention.`,
      componentIds: longAnims.map((c) => c.id),
    });
    recommendations.push("Consider breaking long animations into shorter segments with different easings.");
  }

  // Calculate score
  let score = 100;
  for (const w of warnings) {
    if (w.level === "critical") score -= 25;
    else if (w.level === "warn") score -= 10;
    else score -= 3;
  }
  score = Math.max(0, score);

  return {
    score,
    componentCount: components.length,
    peakSimultaneous: peak,
    peakWindowStart: start,
    peakWindowEnd: Math.round(end),
    warnings,
    recommendations,
  };
}

/** Format the restraint analysis as a human-readable summary. */
export function formatRestraintReport(analysis: RestraintAnalysis): string {
  const lines: string[] = [];
  lines.push(`Restraint Score: ${analysis.score}/100`);
  lines.push(`Peak simultaneous animations: ${analysis.peakSimultaneous} (at ${analysis.peakWindowStart}ms–${analysis.peakWindowEnd}ms)`);

  if (analysis.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const w of analysis.warnings) {
      const icon = w.level === "critical" ? "⚠" : w.level === "warn" ? "△" : "i";
      lines.push(`  ${icon} ${w.message}`);
    }
  }

  if (analysis.recommendations.length > 0) {
    lines.push("");
    lines.push("Recommendations:");
    for (const r of analysis.recommendations) {
      lines.push(`  → ${r}`);
    }
  }

  return lines.join("\n");
}
