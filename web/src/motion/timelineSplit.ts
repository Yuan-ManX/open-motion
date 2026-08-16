/**
 * Timeline split tool — cut a single component at a given playhead time
 * into two consecutive sibling components. The first retains the keyframes
 * up to the split point (re-normalized to 0..100% within its new duration),
 * the second starts immediately after and carries the remainder.
 *
 * Also exposes smart geometry snap helpers (edge/center/distribute) that
 * the canvas overlay uses for multi-component alignment.
 */

import type { Keyframe, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Keyframe interpolation (for the split tool)
// ---------------------------------------------------------------------------

/** Linear interpolation between two numeric values. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate a single keyframe properties bag between two frames at ratio t.
 * Strings are kept from the left keyframe (no good way to interpolate
 * hex colors or CSS tokens — the caller can upgrade to color-aware logic later).
 */
function interpolateProperties(
  left: Record<string, number | string>,
  right: Record<string, number | string>,
  t: number,
): Record<string, number | string> {
  const result: Record<string, number | string> = {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const k of keys) {
    const lv = left[k];
    const rv = right[k];
    if (typeof lv === "number" && typeof rv === "number") {
      result[k] = lerp(lv, rv, t);
    } else {
      result[k] = lv ?? rv ?? 0;
    }
  }
  return result;
}

/**
 * Sample a keyframes array at an absolute progress t (0..100).
 * Returns the interpolated properties at that point.
 */
function sampleKeyframesAt(
  kfs: Keyframe[],
  t: number,
): Record<string, number | string> {
  if (kfs.length === 0) return {};
  if (kfs.length === 1) return kfs[0].properties as Record<string, number | string>;
  if (t <= kfs[0].offset) return kfs[0].properties as Record<string, number | string>;
  if (t >= kfs[kfs.length - 1].offset) return kfs[kfs.length - 1].properties as Record<string, number | string>;
  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i];
    const b = kfs[i + 1];
    if (t >= a.offset && t <= b.offset) {
      const span = b.offset - a.offset;
      const localT = span === 0 ? 0 : (t - a.offset) / span;
      return interpolateProperties(
        a.properties as Record<string, number | string>,
        b.properties as Record<string, number | string>,
        localT,
      );
    }
  }
  return kfs[kfs.length - 1].properties as Record<string, number | string>;
}

/**
 * Renormalize a slice of a keyframes array so offsets span 0..100.
 * startOffset and endOffset are in the 0..100 space of the original array.
 */
function renormalizeSlice(kfs: Keyframe[], startOffset: number, endOffset: number): Keyframe[] {
  const span = endOffset - startOffset;
  if (span <= 0) return [{ offset: 0, properties: kfs[0]?.properties ?? {} }, { offset: 100, properties: kfs[0]?.properties ?? {} }];
  const filtered = kfs.filter((k) => k.offset >= startOffset && k.offset <= endOffset);
  if (filtered.length === 0) {
    // Both boundary offsets are between keyframes — synthesize two endpoint frames
    return [
      { offset: 0, properties: sampleKeyframesAt(kfs, startOffset) },
      { offset: 100, properties: sampleKeyframesAt(kfs, endOffset) },
    ];
  }
  // Ensure exact start/end coverage
  const out: Keyframe[] = [];
  if (filtered[0].offset > startOffset) {
    out.push({ offset: 0, properties: sampleKeyframesAt(kfs, startOffset) });
  }
  for (const k of filtered) {
    out.push({ offset: ((k.offset - startOffset) / span) * 100, properties: k.properties });
  }
  if (out[out.length - 1].offset < 100) {
    out.push({ offset: 100, properties: sampleKeyframesAt(kfs, endOffset) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Split tool
// ---------------------------------------------------------------------------

export interface SplitResult {
  before: MotionComponent;
  after: MotionComponent;
  splitAtMs: number;
}

/**
 * Split a single motion component into two at the specified millisecond
 * position. If the split point is before the component begins (within its
 * delay), returns the original component as `after` with a zero-duration
 * `before` placeholder (caller can decide whether to keep it).
 *
 * Iteration count > 1 is treated as a single repeat: only the currently
 * playing cycle is split and subsequent repeats are attached to `after`.
 */
export function splitComponentAtTime(
  component: MotionComponent,
  splitAtMs: number,
  idGenerator?: (suffix: "-before" | "-after") => string,
): SplitResult {
  const id = component.id;
  const newId = (s: "-before" | "-after") => idGenerator?.(s) ?? `${id}${s}-${Math.random().toString(36).slice(2, 6)}`;

  const delay = Number(component.delayMs) || 0;
  const duration = Number(component.durationMs) || 0;
  const iters = component.iterationCount === "infinite" ? "infinite" : Math.max(1, Number(component.iterationCount) || 1);

  // Split point relative to the first cycle's active animation (not counting delay).
  const relMs = splitAtMs - delay;
  const t = relMs <= 0 ? 0 : Math.min(100, (relMs / duration) * 100);

  const kfs = (component.keyframes as Keyframe[] | undefined) ?? [];

  // before: 0..t, after: t..100, renormalized
  const beforeKfs = t <= 0 ? [{ offset: 0, properties: kfs[0]?.properties ?? {} } as Keyframe, { offset: 100, properties: kfs[0]?.properties ?? {} } as Keyframe] : renormalizeSlice(kfs, 0, t);
  const afterKfs = t >= 100 ? [{ offset: 0, properties: kfs[kfs.length - 1]?.properties ?? {} } as Keyframe, { offset: 100, properties: kfs[kfs.length - 1]?.properties ?? {} } as Keyframe] : renormalizeSlice(kfs, t, 100);

  // before iterations: always 1 (we split the first cycle, the rest go to after)
  const beforeIters = 1;
  const beforeDur = Math.max(0, Math.floor(relMs < 0 ? 0 : (duration * t) / 100));
  const afterDur = Math.max(0, duration - beforeDur);
  // after: inherit iteration count but if numeric, subtract 1 (the split cycle)
  const afterIters = iters === "infinite" ? "infinite" : Math.max(1, (iters as number) - 0);

  const cloneBase: Partial<MotionComponent> = {
    name: component.name,
    templateId: component.templateId,
    style: component.style,
    easing: component.easing,
    direction: component.direction,
    trigger: component.trigger,
    parentId: component.parentId,
  };

  const before: MotionComponent = {
    ...(component as unknown as MotionComponent),
    id: newId("-before"),
    name: component.name ? `${component.name} · A` : `Split-A-${component.id.slice(0, 6)}`,
    delayMs: delay,
    durationMs: beforeDur,
    iterationCount: beforeIters,
    keyframes: beforeKfs,
    orderIndex: component.orderIndex,
    ...cloneBase,
  };

  const after: MotionComponent = {
    ...(component as unknown as MotionComponent),
    id: newId("-after"),
    name: component.name ? `${component.name} · B` : `Split-B-${component.id.slice(0, 6)}`,
    delayMs: delay + beforeDur,
    durationMs: afterDur,
    iterationCount: afterIters,
    keyframes: afterKfs,
    orderIndex: component.orderIndex,
    ...cloneBase,
  };

  return { before, after, splitAtMs };
}

// ---------------------------------------------------------------------------
// Smart geometry snapping — multi-component helpers
// ---------------------------------------------------------------------------

export type SnapAxis = "x" | "y";
export type SnapTarget = "left" | "right" | "top" | "bottom" | "hcenter" | "vcenter" | "distribute-x" | "distribute-y";

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  hcenter: number;
  vcenter: number;
  id: string;
}

export function rectOf(c: { id: string; style?: Record<string, unknown> }, canvasWidth = 0, canvasHeight = 0): Rect {
  const s = (c.style ?? {}) as Record<string, unknown>;
  const left = Number(s.left) ?? 0;
  const top = Number(s.top) ?? 0;
  const w = Number(s.width) ?? 100;
  const h = Number(s.height) ?? 50;
  return {
    id: c.id,
    left, top, width: w, height: h,
    right: left + w, bottom: top + h,
    hcenter: left + w / 2, vcenter: top + h / 2,
    _canvasWidth: canvasWidth, _canvasHeight: canvasHeight,
  } as Rect & { _canvasWidth: number; _canvasHeight: number };
}

/** Return all possible snap guides from a set of reference rects + artboard. */
export function collectSnapGuides(
  references: Rect[],
  artboard: { width: number; height: number },
): Record<SnapTarget, number[]> {
  const guides: Record<SnapTarget, number[]> = {
    left: [], right: [], top: [], bottom: [],
    hcenter: [], vcenter: [],
    "distribute-x": [], "distribute-y": [],
  };
  for (const r of references) {
    guides.left.push(r.left);
    guides.right.push(r.right);
    guides.top.push(r.top);
    guides.bottom.push(r.bottom);
    guides.hcenter.push(r.hcenter);
    guides.vcenter.push(r.vcenter);
  }
  // Artboard
  guides.left.push(0);
  guides.right.push(artboard.width);
  guides.top.push(0);
  guides.bottom.push(artboard.height);
  guides.hcenter.push(artboard.width / 2);
  guides.vcenter.push(artboard.height / 2);
  return guides;
}

/**
 * Given a moving rect and a set of guides, snap its edges/centers to the
 * closest guide within tolerancePx. Returns new left/top values plus the
 * list of guide types snapped to (for rendering snap lines on the canvas).
 */
export function snapMovingRect(
  moving: Rect,
  guides: Record<SnapTarget, number[]>,
  tolerancePx = 4,
): { left: number; top: number; snapped: Array<{ target: SnapTarget; guide: number }> } {
  let { left, top } = moving;
  const snapped: Array<{ target: SnapTarget; guide: number }> = [];

  const trySnap = (value: number, targetGuides: number[], which: SnapTarget, axisAdjust: (guide: number) => void) => {
    let best = Infinity;
    let bestGuide = NaN;
    for (const g of targetGuides) {
      const d = Math.abs(value - g);
      if (d < best && d <= tolerancePx) { best = d; bestGuide = g; }
    }
    if (!isNaN(bestGuide)) {
      axisAdjust(bestGuide);
      snapped.push({ target: which, guide: bestGuide });
    }
  };

  trySnap(moving.left,    guides.left,    "left",    (g) => { left = g; });
  trySnap(moving.right,   guides.right,   "right",   (g) => { left = g - moving.width; });
  trySnap(moving.hcenter, guides.hcenter, "hcenter", (g) => { left = g - moving.width / 2; });
  trySnap(moving.top,     guides.top,     "top",     (g) => { top = g; });
  trySnap(moving.bottom,  guides.bottom,  "bottom",  (g) => { top = g - moving.height; });
  trySnap(moving.vcenter, guides.vcenter, "vcenter", (g) => { top = g - moving.height / 2; });

  return { left, top, snapped };
}

/**
 * Distribute an array of selected components evenly along the specified axis.
 * Works by equalizing the gaps between consecutive components (sorted by
 * current position) between the leftmost and rightmost (or top/bottom) extents.
 */
export function distributeEvenly(
  selectedRects: Rect[],
  axis: SnapAxis,
): Array<{ id: string; stylePatch: Record<string, number> }> {
  if (selectedRects.length < 3) return [];
  const sorted = [...selectedRects].sort((a, b) =>
    axis === "x" ? a.left - b.left : a.top - b.top,
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSpan = axis === "x"
    ? (last.left + last.width) - first.left - sorted.reduce((sum, r) => sum + r.width, 0) + first.width + last.width - first.width
    : (last.top + last.height) - first.top - sorted.reduce((sum, r) => sum + r.height, 0) + first.height + last.height - first.height;
  // Simpler approach: equal gap between consecutive start positions,
  // using sorted order + fixed component widths/heights.
  const count = sorted.length;
  const extentStart = axis === "x" ? first.left : first.top;
  const extentEnd = axis === "x"
    ? (last.left + last.width) - sorted[count - 1].width
    : (last.top + last.height) - sorted[count - 1].height;
  const usable = extentEnd - extentStart;
  const gap = count > 1 ? usable / (count - 1) : 0;

  const result: Array<{ id: string; stylePatch: Record<string, number> }> = [];
  sorted.forEach((r, i) => {
    const target = extentStart + gap * i;
    const current = axis === "x" ? r.left : r.top;
    if (Math.abs(target - current) > 0.5) {
      result.push({
        id: r.id,
        stylePatch: axis === "x" ? { left: target } : { top: target },
      });
    }
  });
  return result;
}
