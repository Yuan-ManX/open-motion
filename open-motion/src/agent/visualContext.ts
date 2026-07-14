/**
 * Visual Context Analyzer — interprets the canvas as a spatial layout.
 *
 * The motion spec stores component positions and sizes inside `style` as CSS
 * values (left/top/width/height in px or as numbers). This module extracts
 * bounding boxes, then computes design-relevant signals:
 *   - Visual balance (centroid of area vs. canvas center)
 *   - Spacing consistency (gap variance between neighbors)
 *   - Hierarchy (size and z-order distribution)
 *   - Color distribution (palette extracted from text/background colors)
 *   - Overlap detection (intersecting bounding boxes)
 *   - Alignment detection (rows, columns, grid snapping)
 *
 * The output drives the `analyze_visual_context` agent tool and gives the
 * orchestrator an explicit "eye" on the canvas — it can reason about layout,
 * not just motion timing.
 */

import type { MotionComponent, MotionSpec } from "@openmotion/shared";

export interface BoundingBox {
  componentId: string;
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
  area: number;
}

export interface VisualBalance {
  centroidX: number;
  centroidY: number;
  canvasCx: number;
  canvasCy: number;
  offsetPx: number;
  /** 0..1 — 1 is perfectly balanced. */
  score: number;
  direction: string;
}

export interface SpacingReport {
  gaps: number[];
  meanGap: number;
  gapVariance: number;
  /** 0..1 — 1 means all gaps are identical. */
  consistency: number;
  smallestGap: number;
  largestGap: number;
}

export interface HierarchyReport {
  sizeDistribution: "uniform" | "bimodal" | "varied";
  largestArea: number;
  smallestArea: number;
  areaRatio: number;
  zOrderSpread: number;
  focalCandidate: string | null;
}

export interface ColorDistribution {
  palette: string[];
  uniqueColors: number;
  textColors: string[];
  bgColors: string[];
  /** 0..1 — palette diversity index. */
  diversity: number;
  dominantTone: "light" | "dark" | "mixed";
}

export interface OverlapReport {
  pairs: Array<{ a: string; b: string; area: number }>;
  totalOverlaps: number;
  maxOverlapArea: number;
}

export interface AlignmentReport {
  rows: number;
  columns: number;
  gridAligned: boolean;
  alignedToCanvasCenter: boolean;
  observations: string[];
}

export type VisualSeverity = "info" | "warning" | "critical";

export interface VisualInsight {
  severity: VisualSeverity;
  category: "balance" | "spacing" | "hierarchy" | "color" | "overlap" | "alignment";
  message: string;
  suggestion: string;
}

export interface VisualContextResult {
  bounds: BoundingBox[];
  canvas: { width: number; height: number };
  balance: VisualBalance;
  spacing: SpacingReport;
  hierarchy: HierarchyReport;
  colors: ColorDistribution;
  overlaps: OverlapReport;
  alignment: AlignmentReport;
  insights: VisualInsight[];
  /** 0..100 — composite visual quality score. */
  score: number;
  componentCount: number;
}

/** Parse a CSS-style value into a pixel number. "120px" → 120, 80 → 80. */
function px(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

/** Extract a bounding box from a component's style. */
function extractBounds(comp: MotionComponent): BoundingBox {
  const style = (comp.style ?? {}) as Record<string, string | number>;
  const left = px(style.left, 0);
  const top = px(style.top, 0);
  const width = px(style.width, 100);
  const height = px(style.height, 100);
  return {
    componentId: comp.id,
    name: comp.name,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    cx: left + width / 2,
    cy: top + height / 2,
    area: width * height,
  };
}

/** Pull a hex color (#rgb or #rrggbb) out of a style value. Returns null otherwise. */
function extractHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.match(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/);
  return m ? m[0].toLowerCase() : null;
}

/** Relative luminance approximator — used to classify light vs dark palettes. */
function isLightColor(hex: string): boolean {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.6;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
}

/** Area overlap (px²) between two bounding boxes. */
function overlapArea(a: BoundingBox, b: BoundingBox): number {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

/**
 * Analyze the visual layout of a motion spec.
 *
 * @param spec     The assembled project spec.
 * @param componentId  Optional — restrict to a single component.
 */
export function analyzeVisualContext(
  spec: MotionSpec,
  componentId?: string,
): VisualContextResult {
  const tokens = (spec.project.tokens ?? {}) as Record<string, string | number>;
  const canvasWidth = Number(tokens.artboardWidth ?? 640);
  const canvasHeight = Number(tokens.artboardHeight ?? 360);

  const components = componentId
    ? spec.components.filter((c) => c.id === componentId)
    : spec.components;

  const bounds = components.map(extractBounds);

  // --- Visual balance: area-weighted centroid vs canvas center ---
  const totalArea = bounds.reduce((s, b) => s + b.area, 0) || 1;
  const centroidX = bounds.reduce((s, b) => s + b.cx * b.area, 0) / totalArea;
  const centroidY = bounds.reduce((s, b) => s + b.cy * b.area, 0) / totalArea;
  const canvasCx = canvasWidth / 2;
  const canvasCy = canvasHeight / 2;
  const offsetPx = Math.sqrt((centroidX - canvasCx) ** 2 + (centroidY - canvasCy) ** 2);
  const maxOffset = Math.sqrt(canvasCx ** 2 + canvasCy ** 2) || 1;
  const balanceScore = Math.max(0, 1 - offsetPx / maxOffset);
  const dx = centroidX - canvasCx;
  const dy = centroidY - canvasCy;
  const direction =
    Math.abs(dx) < 5 && Math.abs(dy) < 5
      ? "centered"
      : `${dy < -5 ? "top" : dy > 5 ? "bottom" : ""}-${dx < -5 ? "left" : dx > 5 ? "right" : ""}`.replace(/^-|-$/g, "") || "centered";

  const balance: VisualBalance = {
    centroidX,
    centroidY,
    canvasCx,
    canvasCy,
    offsetPx: Math.round(offsetPx),
    score: Math.round(balanceScore * 100) / 100,
    direction,
  };

  // --- Spacing: nearest-neighbor horizontal + vertical gaps ---
  const gaps: number[] = [];
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i];
      const b = bounds[j];
      const hGap = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
      const vGap = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
      if (hGap > 0 && vGap <= 0) gaps.push(hGap);
      else if (vGap > 0 && hGap <= 0) gaps.push(vGap);
      else if (hGap > 0 && vGap > 0) gaps.push(Math.min(hGap, vGap));
    }
  }
  const meanGap = mean(gaps);
  const gapVar = variance(gaps);
  const consistency = gaps.length > 1 ? Math.max(0, 1 - gapVar / (meanGap * meanGap + 1)) : 1;
  const spacing: SpacingReport = {
    gaps: gaps.map((g) => Math.round(g)),
    meanGap: Math.round(meanGap),
    gapVariance: Math.round(gapVar),
    consistency: Math.round(consistency * 100) / 100,
    smallestGap: gaps.length ? Math.round(Math.min(...gaps)) : 0,
    largestGap: gaps.length ? Math.round(Math.max(...gaps)) : 0,
  };

  // --- Hierarchy: size distribution + z-order spread ---
  const areas = bounds.map((b) => b.area);
  const largestArea = areas.length ? Math.max(...areas) : 0;
  const smallestArea = areas.length ? Math.min(...areas) : 0;
  const areaRatio = smallestArea > 0 ? largestArea / smallestArea : 0;
  const zSpread = components.length
    ? Math.max(...components.map((c) => c.orderIndex)) - Math.min(...components.map((c) => c.orderIndex))
    : 0;
  const avgArea = mean(areas) || 1;
  const sizeDistribution: HierarchyReport["sizeDistribution"] =
    areas.every((a) => Math.abs(a - avgArea) / avgArea < 0.15)
      ? "uniform"
      : areaRatio > 4
        ? "bimodal"
        : "varied";
  const focalCandidate =
    bounds.find((b) => b.area === largestArea && largestArea > avgArea * 1.5)?.name ?? null;
  const hierarchy: HierarchyReport = {
    sizeDistribution,
    largestArea: Math.round(largestArea),
    smallestArea: Math.round(smallestArea),
    areaRatio: Math.round(areaRatio * 10) / 10,
    zOrderSpread: zSpread,
    focalCandidate,
  };

  // --- Color distribution ---
  const textColors = new Set<string>();
  const bgColors = new Set<string>();
  for (const comp of components) {
    const style = (comp.style ?? {}) as Record<string, string | number>;
    const tc = extractHex(style.color);
    const bc = extractHex(style.backgroundColor);
    if (tc) textColors.add(tc);
    if (bc) bgColors.add(bc);
  }
  const palette = Array.from(new Set([...textColors, ...bgColors]));
  const lightCount = palette.filter(isLightColor).length;
  const dominantTone: ColorDistribution["dominantTone"] =
    palette.length === 0 ? "mixed" : lightCount > palette.length / 2 ? "light" : "dark";
  const colors: ColorDistribution = {
    palette,
    uniqueColors: palette.length,
    textColors: Array.from(textColors),
    bgColors: Array.from(bgColors),
    diversity: Math.min(1, palette.length / 6),
    dominantTone,
  };

  // --- Overlap detection ---
  const overlapPairs: OverlapReport["pairs"] = [];
  for (let i = 0; i < bounds.length; i++) {
    for (let j = i + 1; j < bounds.length; j++) {
      const ov = overlapArea(bounds[i], bounds[j]);
      if (ov > 1) {
        overlapPairs.push({
          a: bounds[i].name,
          b: bounds[j].name,
          area: Math.round(ov),
        });
      }
    }
  }
  const overlaps: OverlapReport = {
    pairs: overlapPairs,
    totalOverlaps: overlapPairs.length,
    maxOverlapArea: overlapPairs.length ? Math.max(...overlapPairs.map((p) => p.area)) : 0,
  };

  // --- Alignment detection ---
  const cxValues = bounds.map((b) => b.cx);
  const cyValues = bounds.map((b) => b.cy);
  const colTol = Math.max(4, canvasWidth * 0.02);
  const rowTol = Math.max(4, canvasHeight * 0.02);
  let columns = 0;
  let rows = 0;
  for (let i = 0; i < cxValues.length; i++) {
    if (cxValues.some((v, j) => j !== i && Math.abs(v - cxValues[i]) < colTol)) columns++;
    if (cyValues.some((v, j) => j !== i && Math.abs(v - cyValues[i]) < rowTol)) rows++;
  }
  const gridAligned = columns > 0 && rows > 0 && columns + rows >= bounds.length;
  const alignedToCanvasCenter = bounds.some(
    (b) => Math.abs(b.cx - canvasCx) < colTol || Math.abs(b.cy - canvasCy) < rowTol,
  );
  const alignmentObservations: string[] = [];
  if (gridAligned) alignmentObservations.push("Components form a grid layout.");
  if (rows > 0) alignmentObservations.push(`${rows} component(s) share horizontal alignment.`);
  if (columns > 0) alignmentObservations.push(`${columns} component(s) share vertical alignment.`);
  if (!gridAligned && rows === 0 && columns === 0 && bounds.length > 1)
    alignmentObservations.push("No shared alignment detected — components are free-positioned.");
  const alignment: AlignmentReport = {
    rows,
    columns,
    gridAligned,
    alignedToCanvasCenter,
    observations: alignmentObservations,
  };

  // --- Insights ---
  const insights: VisualInsight[] = [];

  if (balance.score < 0.5 && bounds.length > 0) {
    insights.push({
      severity: "warning",
      category: "balance",
      message: `Visual weight is biased toward the ${direction} (offset ${balance.offsetPx}px from center).`,
      suggestion: "Reposition components so the area-weighted centroid sits closer to the canvas center.",
    });
  } else if (bounds.length > 1) {
    insights.push({
      severity: "info",
      category: "balance",
      message: `Layout is ${direction === "centered" ? "well centered" : `leaning ${direction}`} (${balance.offsetPx}px offset, score ${balance.score}).`,
      suggestion: direction === "centered" ? "Balance looks good." : "Shift a large component toward the opposite side to balance.",
    });
  }

  if (bounds.length > 1) {
    if (spacing.consistency < 0.4 && spacing.gaps.length > 2) {
      insights.push({
        severity: "warning",
        category: "spacing",
        message: `Gap variance is high (${spacing.smallestGap}px–${spacing.largestGap}px, consistency ${spacing.consistency}).`,
        suggestion: "Use align_components with distribute-h or distribute-v to even out the gaps.",
      });
    } else if (spacing.gaps.length > 0) {
      insights.push({
        severity: "info",
        category: "spacing",
        message: `Gaps range ${spacing.smallestGap}px–${spacing.largestGap}px (mean ${spacing.meanGap}px, consistency ${spacing.consistency}).`,
        suggestion: spacing.consistency > 0.7 ? "Spacing is consistent." : "Consider tightening the spacing rhythm.",
      });
    }
  }

  if (sizeDistribution === "uniform" && bounds.length > 2) {
    insights.push({
      severity: "info",
      category: "hierarchy",
      message: "All components are similarly sized — no clear focal point.",
      suggestion: "Enlarge the primary element or shrink secondary ones to establish visual hierarchy.",
    });
  } else if (focalCandidate) {
    insights.push({
      severity: "info",
      category: "hierarchy",
      message: `Strong focal hierarchy detected — "${focalCandidate}" dominates (${hierarchy.areaRatio}x size ratio).`,
      suggestion: "Hierarchy reads clearly. Keep the focal element's motion restrained so secondary elements can accent it.",
    });
  }

  if (colors.uniqueColors > 5) {
    insights.push({
      severity: "warning",
      category: "color",
      message: `${colors.uniqueColors} distinct colors detected — palette may feel cluttered.`,
      suggestion: "Call harmonize_colors to reduce the palette to a cohesive scheme.",
    });
  } else if (colors.uniqueColors > 0) {
    insights.push({
      severity: "info",
      category: "color",
      message: `Palette has ${colors.uniqueColors} color(s), dominant tone ${colors.dominantTone}.`,
      suggestion: colors.uniqueColors <= 3 ? "Palette is restrained." : "Palette is balanced.",
    });
  }

  if (overlaps.totalOverlaps > 0) {
    insights.push({
      severity: overlaps.maxOverlapArea > 2000 ? "critical" : "warning",
      category: "overlap",
      message: `${overlaps.totalOverlaps} overlapping pair(s) detected (max ${overlaps.maxOverlapArea}px²).`,
      suggestion: "Nudge or realign overlapping components, or use set_z_order to clarify stacking.",
    });
  }

  if (!gridAligned && bounds.length > 3) {
    insights.push({
      severity: "info",
      category: "alignment",
      message: "Components are not grid-aligned.",
      suggestion: "Use align_components to snap to rows/columns for a cleaner layout.",
    });
  } else if (gridAligned) {
    insights.push({
      severity: "info",
      category: "alignment",
      message: "Grid-like alignment detected.",
      suggestion: "Alignment looks structured.",
    });
  }

  // --- Composite score ---
  const penalty =
    (balance.score < 0.5 ? 15 : 0) +
    (spacing.consistency < 0.4 && spacing.gaps.length > 2 ? 10 : 0) +
    (sizeDistribution === "uniform" && bounds.length > 2 ? 10 : 0) +
    (colors.uniqueColors > 5 ? 10 : 0) +
    (overlaps.totalOverlaps > 0 ? (overlaps.maxOverlapArea > 2000 ? 25 : 12) : 0) +
    (!gridAligned && bounds.length > 3 ? 8 : 0);
  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    bounds,
    canvas: { width: canvasWidth, height: canvasHeight },
    balance,
    spacing,
    hierarchy,
    colors,
    overlaps,
    alignment,
    insights,
    score,
    componentCount: bounds.length,
  };
}
