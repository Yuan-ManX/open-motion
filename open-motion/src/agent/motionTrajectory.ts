import type { MotionSpec, MotionComponent, Keyframe } from "@openmotion/shared";

/** Trajectory-Compression Engine — minimal-keyframe representation of motion paths. */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A 2D point on a trajectory, with its source keyframe offset. */
export interface TrajectoryPoint {
  /** Keyframe offset 0..1. */
  offset: number;
  /** X translation in px (or relative unit). */
  x: number;
  /** Y translation in px (or relative unit). */
  y: number;
}

/** Per-component trajectory analysis. */
export interface ComponentTrajectory {
  /** Component id. */
  componentId: string;
  /** Display label. */
  label: string;
  /** Whether the component has a translatable path (>=2 translate keyframes). */
  hasPath: boolean;
  /** Original keyframe count. */
  originalKeyframes: number;
  /** Retained keyframe count after compression. */
  retainedKeyframes: number;
  /** Compression ratio (original / retained). 1 = no compression. */
  compressionRatio: number;
  /** 0..1 — estimated perceptual error introduced by compression. */
  perceivedError: number;
  /** 0..1 — fraction of keyframes flagged as redundant. */
  redundancyScore: number;
  /** Path length (sum of segment distances). */
  pathLength: number;
  /** Bounding-box diagonal — scale reference for tolerance. */
  bboxDiagonal: number;
  /** Offsets of the retained keyframes. */
  retainedOffsets: number[];
  /** Offsets of the redundant keyframes (candidates for removal). */
  redundantOffsets: number[];
}

/** The full trajectory report. */
export interface TrajectoryReport {
  /** Per-component trajectory analysis. */
  components: ComponentTrajectory[];
  /** Components that have a translatable path. */
  pathCount: number;
  /** Total keyframes across all path components. */
  totalKeyframes: number;
  /** Total retained keyframes after compression. */
  totalRetained: number;
  /** Aggregate compression ratio across path components. */
  aggregateCompression: number;
  /** Average redundancy score 0..1. */
  averageRedundancy: number;
  /** Component count the analysis ran against. */
  componentCount: number;
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Trajectory extraction
// ---------------------------------------------------------------------------

/** Extract the (x, y) trajectory from a component's keyframes. */
function extractTrajectory(c: MotionComponent): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = [];
  for (const kf of c.keyframes) {
    const x = numericProperty(kf, "translateX");
    const y = numericProperty(kf, "translateY");
    // Include the point if either coordinate is defined — the missing axis
    // is treated as 0 so a horizontal-only path still compresses.
    if (x !== null || y !== null) {
      points.push({ offset: kf.offset, x: x ?? 0, y: y ?? 0 });
    }
  }
  return points;
}

function numericProperty(kf: Keyframe, prop: "translateX" | "translateY"): number | null {
  const v = kf.properties[prop];
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = v.match(/-?\d+\.?\d*/);
    if (m) return parseFloat(m[0]);
  }
  return null;
}

/** Bounding-box diagonal of a point set — the scale reference. */
function bboxDiagonal(points: TrajectoryPoint[]): number {
  if (points.length === 0) return 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.sqrt((maxX - minX) ** 2 + (maxY - minY) ** 2);
}

/** Sum of segment distances — the path length. */
function pathLength(points: TrajectoryPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.sqrt((points[i].x - points[i - 1].x) ** 2 + (points[i].y - points[i - 1].y) ** 2);
  }
  return Math.round(total * 100) / 100;
}

// ---------------------------------------------------------------------------
// Ramer-Douglas-Peucker adaptation
// ---------------------------------------------------------------------------

/**
 * Perpendicular distance from point p to the line segment (a, b).
 * Returns 0 when a and b coincide.
 */
function perpendicularDistance(p: TrajectoryPoint, a: TrajectoryPoint, b: TrajectoryPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

/**
 * Adapted RDP: returns the indices of points to keep. The tolerance is
 * relative to the bounding-box diagonal so it scales with the motion's
 * magnitude rather than absolute pixels. The first and last points are
 * always retained to preserve the trajectory's endpoints.
 */
function rdpSimplify(points: TrajectoryPoint[], tolerance: number): boolean[] {
  const keep = new Array(points.length).fill(false);
  if (points.length < 3) {
    for (let i = 0; i < points.length; i++) keep[i] = true;
    return keep;
  }
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistance(points[i], points[start], points[end]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > tolerance && index !== -1) {
      keep[index] = true;
      stack.push([start, index]);
      stack.push([index, end]);
    }
  }
  return keep;
}

/**
 * Velocity-preservation override: retain keyframes that mark a deliberate
 * speed change. Approximated by checking for non-default easing on the
 * keyframe (a per-keyframe easing hint signals an intentional inflection).
 * Also always retain the offset=0 and offset=1 endpoints.
 */
function preserveVelocityInflections(c: MotionComponent, keep: boolean[]): boolean[] {
  const adjusted = [...keep];
  for (let i = 0; i < c.keyframes.length && i < adjusted.length; i++) {
    const kf = c.keyframes[i];
    if (kf.easing && kf.easing.type !== "preset") adjusted[i] = true;
    if (kf.easing && kf.easing.type === "preset" && /bounce|elastic|back|spring/.test(kf.easing.name.toLowerCase())) {
      adjusted[i] = true;
    }
  }
  return adjusted;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run trajectory compression analysis on a project spec. */
export function analyzeTrajectory(spec: MotionSpec): TrajectoryReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      components: [],
      pathCount: 0,
      totalKeyframes: 0,
      totalRetained: 0,
      aggregateCompression: 1,
      averageRedundancy: 0,
      componentCount: 0,
      summary: "Empty project — no trajectories to compress.",
    };
  }

  const perComponent: ComponentTrajectory[] = components.map((c) => {
    const points = extractTrajectory(c);
    const hasPath = points.length >= 2;
    if (!hasPath) {
      return {
        componentId: c.id,
        label: c.name || c.id,
        hasPath: false,
        originalKeyframes: c.keyframes.length,
        retainedKeyframes: c.keyframes.length,
        compressionRatio: 1,
        perceivedError: 0,
        redundancyScore: 0,
        pathLength: 0,
        bboxDiagonal: 0,
        retainedOffsets: c.keyframes.map((k) => k.offset),
        redundantOffsets: [],
      };
    }

    const diagonal = bboxDiagonal(points);
    // Tolerance: 2.5% of the bounding-box diagonal. Below this, a viewer
    // cannot perceive the deviation. Falls back to a small absolute
    // tolerance when the diagonal is degenerate (single-point paths).
    const tolerance = diagonal > 0 ? diagonal * 0.025 : 0.5;

    let keep = rdpSimplify(points, tolerance);
    keep = preserveVelocityInflections(c, keep);

    const retainedOffsets: number[] = [];
    const redundantOffsets: number[] = [];
    for (let i = 0; i < points.length; i++) {
      if (keep[i]) retainedOffsets.push(points[i].offset);
      else redundantOffsets.push(points[i].offset);
    }

    const original = points.length;
    const retained = retainedOffsets.length;
    const compressionRatio = retained > 0 ? Math.round((original / retained) * 100) / 100 : original;
    const redundancyScore = original > 0 ? Math.round((redundantOffsets.length / original) * 100) / 100 : 0;
    // Perceived error estimate: tolerance / diagonal (capped at 0.05 since
    // tolerance is by definition below the perception threshold).
    const perceivedError = diagonal > 0 ? Math.min(0.05, Math.round((tolerance / diagonal) * 100) / 100) : 0;

    return {
      componentId: c.id,
      label: c.name || c.id,
      hasPath: true,
      originalKeyframes: original,
      retainedKeyframes: retained,
      compressionRatio,
      perceivedError,
      redundancyScore,
      pathLength: pathLength(points),
      bboxDiagonal: Math.round(diagonal * 100) / 100,
      retainedOffsets,
      redundantOffsets,
    };
  });

  const pathComponents = perComponent.filter((c) => c.hasPath);
  const pathCount = pathComponents.length;
  const totalKeyframes = pathComponents.reduce((s, c) => s + c.originalKeyframes, 0);
  const totalRetained = pathComponents.reduce((s, c) => s + c.retainedKeyframes, 0);
  const aggregateCompression = totalRetained > 0 ? Math.round((totalKeyframes / totalRetained) * 100) / 100 : 1;
  const averageRedundancy = pathCount > 0
    ? Math.round((pathComponents.reduce((s, c) => s + c.redundancyScore, 0) / pathCount) * 100) / 100
    : 0;

  const summary = `${pathCount} path component(s). ${totalKeyframes} keyframes → ${totalRetained} retained (${aggregateCompression}x compression). Average redundancy ${averageRedundancy}.`;

  return {
    components: perComponent,
    pathCount,
    totalKeyframes,
    totalRetained,
    aggregateCompression,
    averageRedundancy,
    componentCount: components.length,
    summary,
  };
}

/** Format a trajectory report as a human-readable string. */
export function formatTrajectoryReport(report: TrajectoryReport): string {
  const lines: string[] = [];
  lines.push("=== Motion Trajectory Compression ===");
  lines.push("");
  lines.push(`Components: ${report.componentCount}`);
  lines.push(`Path components: ${report.pathCount}`);
  lines.push(`Total keyframes: ${report.totalKeyframes}`);
  lines.push(`Retained keyframes: ${report.totalRetained}`);
  lines.push(`Aggregate compression: ${report.aggregateCompression}x`);
  lines.push(`Average redundancy: ${report.averageRedundancy}`);
  lines.push("");

  const pathComponents = report.components.filter((c) => c.hasPath);
  if (pathComponents.length > 0) {
    lines.push("--- Path Components (top 8) ---");
    for (const c of pathComponents.slice(0, 8)) {
      lines.push(`• ${c.label.padEnd(16)} ${c.originalKeyframes}→${c.retainedKeyframes} (${c.compressionRatio}x) redundancy=${c.redundancyScore}`);
      if (c.redundantOffsets.length > 0) {
        lines.push(`    redundant offsets: ${c.redundantOffsets.slice(0, 6).map((o) => o.toFixed(2)).join(", ")}`);
      }
    }
    lines.push("");
  }

  lines.push(`Summary: ${report.summary}`);
  return lines.join("\n");
}
