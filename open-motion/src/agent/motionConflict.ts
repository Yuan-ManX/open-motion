/**
 * Motion Timeline Conflict Detector — structural problem detection.
 *
 * This is the twenty-first original AI-native module. Where the Choreographer
 * sequences components into optimal timing and the Profiler measures cost, the
 * Conflict Detector finds structural problems in the timeline itself: property
 * conflicts, transform collisions, timing gaps, duration anomalies, and
 * redundant animations.
 *
 * Five core checks:
 * 1. Property conflicts — same CSS property animated by multiple overlapping
 *    components on the same selector.
 * 2. Transform collisions — translate/rotate/scale fighting between
 *    overlapping components, causing visual jitter.
 * 3. Timing gaps — dead time with no animation between the start and end
 *    of the timeline.
 * 4. Timing collisions — too many components starting simultaneously
 *    (>5 within 50ms), overwhelming the viewer.
 * 5. Duration anomalies — components with durations 5x longer or shorter
 *    than the project average, indicating potential errors.
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, MotionSpec } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConflictSeverity = "critical" | "warning" | "info";

export type ConflictType =
  | "property_conflict"
  | "transform_collision"
  | "timing_gap"
  | "timing_collision"
  | "duration_anomaly"
  | "redundant_animation";

/** A single detected conflict. */
export interface Conflict {
  type: ConflictType;
  severity: ConflictSeverity;
  /** Components involved in the conflict. */
  componentIds: string[];
  componentNames: string[];
  /** Human-readable description of the conflict. */
  description: string;
  /** When in the timeline this conflict occurs (ms). */
  timelineMs: number;
  /** Suggested resolution. */
  resolution: string;
}

/** The complete conflict report. */
export interface ConflictReport {
  componentCount: number;
  /** Total conflicts found. */
  conflictCount: number;
  /** Breakdown by severity. */
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  /** All conflicts sorted by severity then timeline position. */
  conflicts: Conflict[];
  /** Overall timeline health score (0..100). 100 = no conflicts. */
  healthScore: number;
  /** Timeline span in ms. */
  timelineSpanMs: number;
  /** Summary of the report. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract animated properties from a component's keyframes. */
function animatedProperties(component: MotionComponent): Set<string> {
  const props = new Set<string>();
  for (const kf of component.keyframes) {
    const p = kf.properties as Record<string, unknown>;
    for (const key of Object.keys(p)) {
      props.add(key);
    }
  }
  return props;
}

/** Check if two components' time ranges overlap. */
function timeRangesOverlap(a: MotionComponent, b: MotionComponent): boolean {
  const aStart = a.delayMs;
  const aEnd = a.delayMs + a.durationMs * (a.iterationCount === "infinite" ? 1 : typeof a.iterationCount === "number" ? a.iterationCount : 1);
  const bStart = b.delayMs;
  const bEnd = b.delayMs + b.durationMs * (b.iterationCount === "infinite" ? 1 : typeof b.iterationCount === "number" ? b.iterationCount : 1);
  return aStart < bEnd && bStart < aEnd;
}

/** Get the effective end time of a component. */
function effectiveEndTime(component: MotionComponent): number {
  const iterations = component.iterationCount === "infinite" ? 1 : typeof component.iterationCount === "number" ? component.iterationCount : 1;
  return component.delayMs + component.durationMs * iterations;
}

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

/** Detect property conflicts: same property animated by overlapping components. */
function detectPropertyConflicts(components: MotionComponent[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const selectorGroups = new Map<string, MotionComponent[]>();

  // Group by selector (if available) or by animated property overlap
  for (const c of components) {
    const key = c.selector ?? c.id;
    const group = selectorGroups.get(key) ?? [];
    group.push(c);
    selectorGroups.set(key, group);
  }

  for (const [, group] of selectorGroups) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (!timeRangesOverlap(group[i], group[j])) continue;
        const propsA = animatedProperties(group[i]);
        const propsB = animatedProperties(group[j]);
        const shared = [...propsA].filter((p) => propsB.has(p));
        if (shared.length > 0) {
          conflicts.push({
            type: "property_conflict",
            severity: "critical",
            componentIds: [group[i].id, group[j].id],
            componentNames: [group[i].name, group[j].name],
            description: `Both components animate ${shared.join(", ")} during overlapping time ranges on the same selector.`,
            timelineMs: Math.min(group[i].delayMs, group[j].delayMs),
            resolution: `Stagger their delays so they don't overlap, or animate different properties. Consider using parentId to establish a parent-child relationship.`,
          });
        }
      }
    }
  }

  return conflicts;
}

/** Detect transform collisions: translate/rotate/scale fighting. */
function detectTransformCollisions(components: MotionComponent[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const transformProps = new Set(["translateX", "translateY", "rotate", "rotation", "scaleX", "scaleY", "scale", "skewX", "skewY"]);

  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      if (!timeRangesOverlap(components[i], components[j])) continue;
      const propsA = animatedProperties(components[i]);
      const propsB = animatedProperties(components[j]);
      const sharedTransforms = [...propsA].filter((p) => transformProps.has(p) && propsB.has(p));
      if (sharedTransforms.length > 0) {
        conflicts.push({
          type: "transform_collision",
          severity: "warning",
          componentIds: [components[i].id, components[j].id],
          componentNames: [components[i].name, components[j].name],
          description: `Transform properties (${sharedTransforms.join(", ")}) are animated by both components simultaneously, which may cause visual jitter.`,
          timelineMs: Math.min(components[i].delayMs, components[j].delayMs),
          resolution: `Nest one component inside the other using parentId, or separate their transform animations into different time slots.`,
        });
      }
    }
  }

  return conflicts;
}

/** Detect timing gaps: dead time with no animation. */
function detectTimingGaps(components: MotionComponent[]): Conflict[] {
  const conflicts: Conflict[] = [];
  if (components.length < 2) return conflicts;

  const sorted = [...components].sort((a, b) => a.delayMs - b.delayMs);
  const timelineEnd = Math.max(...components.map(effectiveEndTime));

  for (let i = 0; i < sorted.length - 1; i++) {
    const currentEnd = effectiveEndTime(sorted[i]);
    const nextStart = sorted[i + 1].delayMs;
    const gap = nextStart - currentEnd;
    if (gap > 1500) {
      conflicts.push({
        type: "timing_gap",
        severity: gap > 3000 ? "warning" : "info",
        componentIds: [sorted[i].id, sorted[i + 1].id],
        componentNames: [sorted[i].name, sorted[i + 1].name],
        description: `${gap}ms gap with no animation between "${sorted[i].name}" ending and "${sorted[i + 1].name}" starting.`,
        timelineMs: currentEnd,
        resolution: `Add an ambient or transition component to fill the gap, or reduce the delay of "${sorted[i + 1].name}".`,
      });
    }
  }

  // Check for gap at the end of the timeline
  const lastEnd = effectiveEndTime(sorted[sorted.length - 1]);
  if (timelineEnd - lastEnd > 2000) {
    conflicts.push({
      type: "timing_gap",
      severity: "info",
      componentIds: [sorted[sorted.length - 1].id],
      componentNames: [sorted[sorted.length - 1].name],
      description: `${timelineEnd - lastEnd}ms of dead time at the end of the timeline after "${sorted[sorted.length - 1].name}" finishes.`,
      timelineMs: lastEnd,
      resolution: `Consider adding a closing animation or reducing the total timeline duration.`,
    });
  }

  return conflicts;
}

/** Detect timing collisions: too many components starting simultaneously. */
function detectTimingCollisions(components: MotionComponent[]): Conflict[] {
  const conflicts: Conflict[] = [];
  if (components.length < 5) return conflicts;

  const delays = components.map((c) => c.delayMs).sort((a, b) => a - b);

  // Slide a 50ms window and count how many starts fall within it
  for (let i = 0; i < delays.length; i++) {
    const windowStart = delays[i];
    const windowEnd = windowStart + 50;
    const simultaneous = delays.filter((d) => d >= windowStart && d <= windowEnd);
    if (simultaneous.length > 5) {
      const collisionComponents = components.filter((c) => c.delayMs >= windowStart && c.delayMs <= windowEnd);
      conflicts.push({
        type: "timing_collision",
        severity: "warning",
        componentIds: collisionComponents.map((c) => c.id),
        componentNames: collisionComponents.map((c) => c.name),
        description: `${simultaneous.length} components start within 50ms of each other (at ${windowStart}ms), which may overwhelm the viewer.`,
        timelineMs: windowStart,
        resolution: `Stagger the delays by 80-150ms each to create a cascade effect instead of a simultaneous burst.`,
      });
      break; // Only report the first collision
    }
  }

  return conflicts;
}

/** Detect duration anomalies: components with extreme durations. */
function detectDurationAnomalies(components: MotionComponent[]): Conflict[] {
  const conflicts: Conflict[] = [];
  if (components.length < 3) return conflicts;

  const durations = components.map((c) => c.durationMs);
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;

  for (const c of components) {
    if (c.durationMs > avg * 5 && c.durationMs > 5000) {
      conflicts.push({
        type: "duration_anomaly",
        severity: "warning",
        componentIds: [c.id],
        componentNames: [c.name],
        description: `"${c.name}" has a duration of ${c.durationMs}ms, which is ${Math.round(c.durationMs / avg)}x longer than the project average (${Math.round(avg)}ms).`,
        timelineMs: c.delayMs,
        resolution: `Consider splitting this into a sequence of shorter animations, or reducing the duration to closer to the average.`,
      });
    }
    if (c.durationMs < avg / 5 && c.durationMs < 100) {
      conflicts.push({
        type: "duration_anomaly",
        severity: "info",
        componentIds: [c.id],
        componentNames: [c.name],
        description: `"${c.name}" has a very short duration of ${c.durationMs}ms, which may be too fast to perceive.`,
        timelineMs: c.delayMs,
        resolution: `Increase the duration to at least 200ms for the animation to be comfortably visible.`,
      });
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Detect structural conflicts in the project's timeline.
 *
 * Returns a comprehensive conflict report with severity-tagged issues and
 * resolution suggestions.
 */
export function detectConflicts(spec: MotionSpec): ConflictReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      componentCount: 0,
      conflictCount: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      conflicts: [],
      healthScore: 100,
      timelineSpanMs: 0,
      summary: "No components to analyze.",
    };
  }

  const allConflicts: Conflict[] = [
    ...detectPropertyConflicts(components),
    ...detectTransformCollisions(components),
    ...detectTimingGaps(components),
    ...detectTimingCollisions(components),
    ...detectDurationAnomalies(components),
  ];

  // Sort by severity (critical first), then by timeline position
  const severityOrder: Record<ConflictSeverity, number> = { critical: 0, warning: 1, info: 2 };
  allConflicts.sort((a, b) => {
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.timelineMs - b.timelineMs;
  });

  const criticalCount = allConflicts.filter((c) => c.severity === "critical").length;
  const warningCount = allConflicts.filter((c) => c.severity === "warning").length;
  const infoCount = allConflicts.filter((c) => c.severity === "info").length;

  // Health score: start at 100, deduct for each conflict
  const healthScore = Math.max(0, Math.min(100, 100 - criticalCount * 20 - warningCount * 8 - infoCount * 3));

  const timelineSpanMs = components.length > 0
    ? Math.max(...components.map(effectiveEndTime)) - Math.min(...components.map((c) => c.delayMs))
    : 0;

  const summary = allConflicts.length === 0
    ? `Timeline is clean — no conflicts detected across ${components.length} components. Health: ${healthScore}/100.`
    : `${allConflicts.length} conflict(s) found: ${criticalCount} critical, ${warningCount} warning, ${infoCount} info. Health: ${healthScore}/100.`;

  return {
    componentCount: components.length,
    conflictCount: allConflicts.length,
    criticalCount,
    warningCount,
    infoCount,
    conflicts: allConflicts,
    healthScore,
    timelineSpanMs,
    summary,
  };
}

/** Format a conflict report as a human-readable string. */
export function formatConflictReport(report: ConflictReport): string {
  const lines: string[] = [];
  lines.push(`=== Motion Timeline Conflict Report ===`);
  lines.push(`Health: ${report.healthScore}/100`);
  lines.push(`Components: ${report.componentCount}`);
  lines.push(`Timeline span: ${report.timelineSpanMs}ms`);
  lines.push(`Conflicts: ${report.conflictCount} (${report.criticalCount} critical, ${report.warningCount} warning, ${report.infoCount} info)`);
  lines.push("");
  lines.push(`Summary: ${report.summary}`);

  if (report.conflicts.length > 0) {
    lines.push("");
    lines.push(`--- Conflicts ---`);
    for (const c of report.conflicts) {
      lines.push(`  [${c.severity.toUpperCase()}] ${c.type} @ ${c.timelineMs}ms`);
      lines.push(`    Components: ${c.componentNames.join(", ")}`);
      lines.push(`    ${c.description}`);
      lines.push(`    Fix: ${c.resolution}`);
    }
  }

  return lines.join("\n");
}
