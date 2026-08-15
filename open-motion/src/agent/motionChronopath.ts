/** Motion Chronopath — predicts the viewer's gaze trajectory through time,
 *  modeling WHERE the eye looks at each moment during the animation playback.
 *  Distinct from attention-curve analysis (which models retention) — this
 *  models the spatial-temporal path the eye traces across the screen.
 */

import type { MotionComponent, MotionSpec, Easing } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single gaze target at a point in time. */
export interface GazeTarget {
  /** Time in ms from animation start. */
  timeMs: number;
  /** Component ID the eye is drawn to. */
  componentId: string;
  /** Component name for display. */
  componentName: string;
  /** Screen-space center of the gaze target (canvas coords). */
  x: number;
  y: number;
  /** Confidence that the eye is here (0..1). */
  confidence: number;
  /** Why the eye is drawn here. */
  reason: "motion_onset" | "color_contrast" | "size_dominant" | "trajectory_end" | "novelty" | "social_cue" | "brightness";
}

/** A segment of the gaze path — the eye moves from one target to the next. */
export interface GazeSegment {
  /** Start time of this saccade (ms). */
  startMs: number;
  /** End time of this saccade (ms). */
  endMs: number;
  /** From target index in the gaze path. */
  fromIndex: number;
  /** To target index in the gaze path. */
  toIndex: number;
  /** Saccade type — smooth pursuit vs jump. */
  type: "saccade" | "smooth_pursuit" | "fixation";
  /** Angular direction of eye movement (degrees, 0 = right, 90 = down). */
  angle: number;
  /** Distance the eye travels (canvas units). */
  distance: number;
}

/** A moment where two or more elements compete for the viewer's gaze. */
export interface GazeCollision {
  timeMs: number;
  /** Component IDs competing for attention. */
  competitors: string[];
  /** Severity of the collision (0..1). Higher = more confusing. */
  severity: number;
  /** Recommendation to resolve the collision. */
  recommendation: string;
}

/** A region of the canvas the eye never visits during playback. */
export interface GazeDeadZone {
  /** Bounding box of the dead zone. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Whether this zone contains a component (wasted content). */
  hasContent: boolean;
  /** Suggestion to draw attention here. */
  suggestion: string;
}

/** Optimal reveal ordering based on natural F-pattern and Z-pattern scan paths. */
export interface RevealOrdering {
  /** Component IDs in recommended reveal order. */
  orderedIds: string[];
  /** The scan pattern detected. */
  pattern: "F_pattern" | "Z_pattern" | "diagonal" | "center_out" | "left_to_right";
  /** Confidence in this ordering (0..1). */
  confidence: number;
  /** Rationale for the ordering. */
  rationale: string;
}

/** Complete chronopath report. */
export interface ChronopathReport {
  /** The predicted gaze path through time. */
  gazePath: GazeTarget[];
  /** Saccade segments connecting gaze targets. */
  segments: GazeSegment[];
  /** Moments of gaze competition. */
  collisions: GazeCollision[];
  /** Screen regions the eye never visits. */
  deadZones: GazeDeadZone[];
  /** Optimal reveal ordering. */
  revealOrdering: RevealOrdering;
  /** Overall gaze efficiency score (0..100). How efficiently the motion guides the eye. */
  efficiencyScore: number;
  /** Total gaze distance traveled (canvas units). */
  totalGazeDistance: number;
  /** Number of distinct fixation points. */
  fixationCount: number;
  /** Average fixation duration (ms). */
  avgFixationMs: number;
  /** Summary of the gaze trajectory. */
  summary: string;
  /** Timestamp of analysis. */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ComponentBox {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  area: number;
  brightness: number;
  contrast: number;
  hasMotion: boolean;
  motionOnsetMs: number;
  motionEndMs: number;
  speed: number;
  isAnimated: boolean;
}

function parsePx(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

function easeIntensity(easing: Easing | undefined): number {
  if (!easing) return 0.5;
  switch (easing.type) {
    case "preset": {
      const sharp = ["ease-in", "ease-out", "ease-in-out"];
      const dynamic = ["bounce", "elastic", "back"];
      if (dynamic.includes(easing.name)) return 1.0;
      if (sharp.includes(easing.name)) return 0.7;
      return 0.4;
    }
    case "spring":
      return 0.9;
    case "bezier":
      return 0.6;
    default:
      return 0.5;
  }
}

function colorBrightness(color: string | number | undefined): number {
  if (typeof color === "number") return 0.5;
  if (typeof color !== "string") return 0.5;
  const hex = color.replace("#", "");
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }
  if (color === "white") return 1;
  if (color === "black") return 0;
  return 0.5;
}

function contrastAgainst(bg: number, fg: number): number {
  return Math.abs(bg - fg);
}

function boxArea(w: number, h: number): number {
  return w * h;
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function angle(x1: number, y1: number, x2: number, y2: number): number {
  return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
}

// ---------------------------------------------------------------------------
// Core Analysis
// ---------------------------------------------------------------------------

/** Build component boxes from the motion spec with all visual properties. */
function buildComponentBoxes(spec: MotionSpec): ComponentBox[] {
  return spec.components.map((c) => {
    const s = c.style as Record<string, string | number> | undefined;
    const x = parsePx(s?.left);
    const y = parsePx(s?.top);
    const w = parsePx(s?.width, 100);
    const h = parsePx(s?.height, 100);
    const bg = colorBrightness(s?.backgroundColor ?? s?.background);
    const fg = colorBrightness(s?.color);
    const speed = c.durationMs > 0 ? Math.sqrt(w * w + h * h) / c.durationMs : 0;
    return {
      id: c.id,
      name: c.name,
      x,
      y,
      width: w,
      height: h,
      centerX: x + w / 2,
      centerY: y + h / 2,
      area: boxArea(w, h),
      brightness: bg,
      contrast: contrastAgainst(0.1, fg),
      hasMotion: c.keyframes.length > 0 || c.durationMs > 0,
      motionOnsetMs: c.delayMs,
      motionEndMs: c.delayMs + c.durationMs * (c.iterationCount === "infinite" ? 1 : Number(c.iterationCount) || 1),
      speed,
      isAnimated: c.durationMs > 0 && c.keyframes.length > 0,
    };
  });
}

/** Compute the salience score for a component at a given time. */
function salienceAt(box: ComponentBox, timeMs: number, allBoxes: ComponentBox[]): number {
  let score = 0;

  // Motion onset bonus — the moment a component starts moving, it grabs attention
  if (box.isAnimated) {
    const onsetDist = Math.abs(timeMs - box.motionOnsetMs);
    if (onsetDist < 200) {
      score += 40 * (1 - onsetDist / 200);
    }
    // Continuous motion sustain
    if (timeMs >= box.motionOnsetMs && timeMs <= box.motionEndMs) {
      score += 15 * easeIntensity(undefined);
    }
  }

  // Size dominance — larger elements attract the eye
  const maxArea = Math.max(...allBoxes.map((b) => b.area), 1);
  score += (box.area / maxArea) * 20;

  // Brightness — brighter elements on dark backgrounds draw the eye
  score += box.brightness * 15;

  // Contrast — high contrast edges attract
  score += box.contrast * 10;

  // Novelty — elements that are visually distinct from neighbors
  const neighbors = allBoxes.filter((b) => b.id !== box.id);
  if (neighbors.length > 0) {
    const avgBrightness = neighbors.reduce((s, n) => s + n.brightness, 0) / neighbors.length;
    const novelty = Math.abs(box.brightness - avgBrightness);
    score += novelty * 10;
  }

  return Math.max(0, score);
}

/** Predict the gaze path — which component the eye looks at over time. */
function predictGazePath(boxes: ComponentBox[], totalDuration: number): GazeTarget[] {
  const path: GazeTarget[] = [];
  const sampleMs = 100; // Sample every 100ms
  let lastTargetId: string | null = null;

  for (let t = 0; t <= totalDuration; t += sampleMs) {
    // Compute salience for each component at this time
    const scored = boxes.map((b) => ({
      box: b,
      score: salienceAt(b, t, boxes),
    }));

    // Find the most salient component
    scored.sort((a, b) => b.score - a.score);
    const top = scored[0];
    if (!top || top.score < 5) continue;

    // Determine reason for attention
    let reason: GazeTarget["reason"] = "size_dominant";
    if (top.box.isAnimated && Math.abs(t - top.box.motionOnsetMs) < 200) {
      reason = "motion_onset";
    } else if (top.box.brightness > 0.7) {
      reason = "brightness";
    } else if (top.box.contrast > 0.5) {
      reason = "color_contrast";
    } else if (top.box.area > 50000) {
      reason = "size_dominant";
    } else {
      reason = "novelty";
    }

    // Only add to path if the target changed (new fixation)
    if (top.box.id !== lastTargetId) {
      path.push({
        timeMs: t,
        componentId: top.box.id,
        componentName: top.box.name,
        x: top.box.centerX,
        y: top.box.centerY,
        confidence: Math.min(1, top.score / 80),
        reason,
      });
      lastTargetId = top.box.id;
    }
  }

  // Always include the initial fixation (first component or top-left)
  if (path.length === 0 && boxes.length > 0) {
    const first = boxes.reduce((a, b) => (a.y < b.y || (a.y === b.y && a.x < b.x) ? a : b));
    path.push({
      timeMs: 0,
      componentId: first.id,
      componentName: first.name,
      x: first.centerX,
      y: first.centerY,
      confidence: 0.5,
      reason: "size_dominant",
    });
  }

  return path;
}

/** Build saccade segments from the gaze path. */
function buildSegments(path: GazeTarget[]): GazeSegment[] {
  const segments: GazeSegment[] = [];
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    const dist = distance(from.x, from.y, to.x, to.y);
    const dur = to.timeMs - from.timeMs;
    const type: GazeSegment["type"] = dur < 150 ? "saccade" : dur < 400 ? "smooth_pursuit" : "fixation";
    segments.push({
      startMs: from.timeMs,
      endMs: to.timeMs,
      fromIndex: i - 1,
      toIndex: i,
      type,
      angle: angle(from.x, from.y, to.x, to.y),
      distance: dist,
    });
  }
  return segments;
}

/** Detect gaze collisions — moments when multiple elements compete for attention. */
function detectCollisions(boxes: ComponentBox[], totalDuration: number): GazeCollision[] {
  const collisions: GazeCollision[] = [];
  const sampleMs = 100;

  for (let t = 0; t <= totalDuration; t += sampleMs) {
    const scored = boxes
      .map((b) => ({ box: b, score: salienceAt(b, t, boxes) }))
      .filter((s) => s.score > 15)
      .sort((a, b) => b.score - a.score);

    if (scored.length >= 2) {
      const top2 = scored.slice(0, 2);
      const scoreRatio = top2[1].score / Math.max(top2[0].score, 1);
      if (scoreRatio > 0.7) {
        const severity = Math.min(1, scoreRatio);
        const recommendation =
          severity > 0.9
            ? `Stagger motion onset: delay ${top2[1].box.name} by 200ms to avoid attention split`
            : `Consider reducing ${top2[1].box.name} salience or offset its timing`;
        collisions.push({
          timeMs: t,
          competitors: top2.map((s) => s.box.id),
          severity,
          recommendation,
        });
      }
    }
  }

  // Deduplicate nearby collisions
  const deduped: GazeCollision[] = [];
  for (const c of collisions) {
    if (deduped.length === 0 || c.timeMs - deduped[deduped.length - 1].timeMs > 300) {
      deduped.push(c);
    }
  }
  return deduped;
}

/** Find dead zones — screen regions the eye never visits. */
function findDeadZones(path: GazeTarget[], boxes: ComponentBox[], canvasW: number, canvasH: number): GazeDeadZone[] {
  const deadZones: GazeDeadZone[] = [];
  const gridSize = 100;
  const visited = new Set<string>();

  // Mark grid cells near gaze targets as visited
  for (const target of path) {
    for (let dx = -gridSize; dx <= gridSize; dx += gridSize) {
      for (let dy = -gridSize; dy <= gridSize; dy += gridSize) {
        const gx = Math.floor((target.x + dx) / gridSize);
        const gy = Math.floor((target.y + dy) / gridSize);
        visited.add(`${gx},${gy}`);
      }
    }
  }

  // Check each grid cell
  for (let gx = 0; gx < canvasW / gridSize; gx++) {
    for (let gy = 0; gy < canvasH / gridSize; gy++) {
      if (visited.has(`${gx},${gy}`)) continue;
      const x = gx * gridSize;
      const y = gy * gridSize;
      // Check if any component is in this dead zone
      const hasContent = boxes.some(
        (b) => b.x < x + gridSize && b.x + b.width > x && b.y < y + gridSize && b.y + b.height > y,
      );
      if (hasContent) {
        deadZones.push({
          x,
          y,
          width: gridSize,
          height: gridSize,
          hasContent: true,
          suggestion: "Add motion or visual emphasis to draw the eye to this region",
        });
      }
    }
  }

  return deadZones.slice(0, 5); // Limit to top 5
}

/** Compute the optimal reveal ordering based on scan patterns. */
function computeRevealOrdering(boxes: ComponentBox[], canvasW: number, canvasH: number): RevealOrdering {
  if (boxes.length === 0) {
    return {
      orderedIds: [],
      pattern: "left_to_right",
      confidence: 0,
      rationale: "No components to order.",
    };
  }

  // Determine dominant scan pattern based on layout
  const sortedByY = [...boxes].sort((a, b) => a.centerY - b.centerY);
  const ySpread = sortedByY[sortedByY.length - 1].centerY - sortedByY[0].centerY;
  const xSpread = Math.max(...boxes.map((b) => b.centerX)) - Math.min(...boxes.map((b) => b.centerX));

  let pattern: RevealOrdering["pattern"] = "left_to_right";
  let ordered: ComponentBox[] = [];

  if (ySpread > canvasH * 0.4 && xSpread < canvasW * 0.3) {
    // Tall layout — F-pattern (top to bottom, left to right within rows)
    pattern = "F_pattern";
    ordered = [...boxes].sort((a, b) => {
      const rowA = Math.floor(a.centerY / 100);
      const rowB = Math.floor(b.centerY / 100);
      if (rowA !== rowB) return rowA - rowB;
      return a.centerX - b.centerX;
    });
  } else if (xSpread > canvasW * 0.4 && ySpread > canvasH * 0.3) {
    // Diagonal layout — Z-pattern
    pattern = "Z_pattern";
    ordered = [...boxes].sort((a, b) => a.centerY + a.centerX - (b.centerY + b.centerX));
  } else if (xSpread > canvasW * 0.4 && ySpread < canvasH * 0.2) {
    // Wide layout — left to right
    pattern = "left_to_right";
    ordered = [...boxes].sort((a, b) => a.centerX - b.centerX);
  } else {
    // Clustered — center out
    pattern = "center_out";
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    ordered = [...boxes].sort((a, b) => distance(a.centerX, a.centerY, cx, cy) - distance(b.centerX, b.centerY, cx, cy));
  }

  const rationales: Record<RevealOrdering["pattern"], string> = {
    F_pattern: "Top-to-bottom scan with left-to-right rows matches natural reading patterns",
    Z_pattern: "Diagonal sweep captures attention efficiently for wide layouts",
    diagonal: "Diagonal flow creates dynamic visual movement",
    center_out: "Center-first reveal focuses attention then expands outward",
    left_to_right: "Sequential left-to-right reveal matches Western reading direction",
  };

  return {
    orderedIds: ordered.map((b) => b.id),
    pattern,
    confidence: 0.75,
    rationale: rationales[pattern],
  };
}

// ---------------------------------------------------------------------------
// Main Entry
// ---------------------------------------------------------------------------

/** Predict the viewer's gaze trajectory through the motion sequence. */
export function predictChronopath(spec: MotionSpec): ChronopathReport {
  const boxes = buildComponentBoxes(spec);

  // Calculate total animation duration
  const totalDuration = spec.components.reduce((max, c) => {
    const end = c.delayMs + c.durationMs * (c.iterationCount === "infinite" ? 1 : Number(c.iterationCount) || 1);
    return Math.max(max, end);
  }, 0);

  // Derive canvas dimensions from component bounding box or project tokens
  const tokenW = typeof spec.project.tokens?.canvasWidth === "number" ? spec.project.tokens.canvasWidth : undefined;
  const tokenH = typeof spec.project.tokens?.canvasHeight === "number" ? spec.project.tokens.canvasHeight : undefined;
  const canvasW = tokenW ?? Math.max(1920, ...boxes.map((b) => b.x + b.width));
  const canvasH = tokenH ?? Math.max(1080, ...boxes.map((b) => b.y + b.height));

  // Run all analyses
  const gazePath = predictGazePath(boxes, totalDuration);
  const segments = buildSegments(gazePath);
  const collisions = detectCollisions(boxes, totalDuration);
  const deadZones = findDeadZones(gazePath, boxes, canvasW, canvasH);
  const revealOrdering = computeRevealOrdering(boxes, canvasW, canvasH);

  // Compute metrics
  const totalGazeDistance = segments.reduce((s, seg) => s + seg.distance, 0);
  const fixationCount = gazePath.length;
  const fixationDurations = segments.map((s) => s.endMs - s.startMs);
  const avgFixationMs = fixationDurations.length > 0 ? fixationDurations.reduce((a, b) => a + b, 0) / fixationDurations.length : 0;

  // Efficiency score — higher is better
  // Penalize: collisions, dead zones with content, long gaze distances, too many fixations
  const collisionPenalty = collisions.reduce((s, c) => s + c.severity * 10, 0);
  const deadZonePenalty = deadZones.filter((d) => d.hasContent).length * 8;
  const distancePenalty = Math.min(30, totalGazeDistance / 500);
  const fixationPenalty = Math.min(20, Math.max(0, fixationCount - 5) * 3);
  const efficiencyScore = Math.max(0, Math.min(100, 100 - collisionPenalty - deadZonePenalty - distancePenalty - fixationPenalty));

  // Generate summary
  const summaryParts: string[] = [];
  summaryParts.push(`Eye traces a ${revealOrdering.pattern.replace("_", "-")} path across ${fixationCount} fixation points`);
  if (collisions.length > 0) {
    summaryParts.push(`${collisions.length} gaze collision${collisions.length > 1 ? "s" : ""} detected where elements compete for attention`);
  }
  if (deadZones.filter((d) => d.hasContent).length > 0) {
    summaryParts.push(`${deadZones.filter((d) => d.hasContent).length} content area(s) in gaze dead zones`);
  }
  if (efficiencyScore >= 80) {
    summaryParts.push("Gaze guidance is efficient — the motion naturally leads the eye");
  } else if (efficiencyScore >= 60) {
    summaryParts.push("Gaze guidance is adequate but could be tightened with staggered timing");
  } else {
    summaryParts.push("Gaze guidance needs improvement — consider staggering motion onsets and reducing simultaneous activity");
  }

  return {
    gazePath,
    segments,
    collisions,
    deadZones,
    revealOrdering,
    efficiencyScore,
    totalGazeDistance,
    fixationCount,
    avgFixationMs,
    summary: summaryParts.join(". ") + ".",
    timestamp: Date.now(),
  };
}

/** Format the chronopath report as a readable string for the agent. */
export function formatChronopathReport(report: ChronopathReport): string {
  const lines: string[] = [];
  lines.push("## Motion Chronopath — Gaze Trajectory Analysis\n");
  lines.push(`**Efficiency Score:** ${report.efficiencyScore}/100`);
  lines.push(`**Fixation Points:** ${report.fixationCount}`);
  lines.push(`**Avg Fixation:** ${Math.round(report.avgFixationMs)}ms`);
  lines.push(`**Total Gaze Distance:** ${Math.round(report.totalGazeDistance)} units`);
  lines.push(`**Scan Pattern:** ${report.revealOrdering.pattern.replace("_", " ")}`);
  lines.push(`\n**Summary:** ${report.summary}\n`);

  if (report.gazePath.length > 0) {
    lines.push("### Gaze Path");
    for (const target of report.gazePath.slice(0, 10)) {
      lines.push(`- ${target.timeMs}ms → ${target.componentName} (${target.reason}, confidence: ${(target.confidence * 100).toFixed(0)}%)`);
    }
    if (report.gazePath.length > 10) {
      lines.push(`- ... and ${report.gazePath.length - 10} more fixation points`);
    }
  }

  if (report.collisions.length > 0) {
    lines.push("\n### Gaze Collisions");
    for (const c of report.collisions.slice(0, 5)) {
      lines.push(`- ${c.timeMs}ms: severity ${(c.severity * 100).toFixed(0)}% — ${c.recommendation}`);
    }
  }

  if (report.deadZones.filter((d) => d.hasContent).length > 0) {
    lines.push("\n### Content in Dead Zones");
    for (const d of report.deadZones.filter((d) => d.hasContent)) {
      lines.push(`- (${d.x}, ${d.y}) — ${d.suggestion}`);
    }
  }

  lines.push(`\n### Optimal Reveal Order (${report.revealOrdering.pattern.replace("_", " ")})`);
  lines.push(report.revealOrdering.rationale);
  lines.push(`Order: ${report.revealOrdering.orderedIds.join(" → ")}`);

  return lines.join("\n");
}
