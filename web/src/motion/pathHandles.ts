/**
 * Motion path handle editing on the canvas surface. Given a component's
 * keyframes that express a translate-based curve, this module exposes:
 *
 *   - PathHandle extraction (screen-space coordinates for each keyframe)
 *   - Drag-to-move a handle, producing a new keyframes array
 *   - Add / remove keyframe handles
 *   - Toggle bezier handle tangents for cubic curves
 *
 * The module is framework-agnostic: given a component + a viewport transform,
 * it outputs the patch data the caller should apply to the project store.
 */

import type { Keyframe, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewportTransform {
  /** canvas pan offset */
  panX: number;
  panY: number;
  /** canvas zoom (multiplier) */
  zoom: number;
  /** Width of the component's bounding rect on canvas */
  componentWidth: number;
  /** Height of the component's bounding rect on canvas */
  componentHeight: number;
}

export interface PathHandle {
  /** index into the keyframes array */
  index: number;
  /** Keyframe offset (0..100) — used for sorting/debugging */
  offset: number;
  /** Screen-space x of this handle */
  screenX: number;
  /** Screen-space y of this handle */
  screenY: number;
  /** True if the keyframe is the first or last in the sequence (cannot be removed) */
  isEndpoint: boolean;
  /** Optional bezier tangent "out" handle (in screen-space) */
  tangentOut?: { dx: number; dy: number };
  /** Optional bezier tangent "in" handle (in screen-space) */
  tangentIn?: { dx: number; dy: number };
}

export interface MoveHandleResult {
  /** New keyframes array the caller should apply via patch */
  keyframes: Keyframe[];
  /** Which properties were affected — e.g. ["translateX","translateY"] */
  affectedProperties: string[];
}

// ---------------------------------------------------------------------------
// Value parsing: get numeric translateX/translateY from the property bag
// ---------------------------------------------------------------------------

function parsePx(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = /^(-?\d+(?:\.\d+)?)/.exec(v.trim());
    return m ? Number(m[1]) : null;
  }
  return null;
}

/**
 * Resolve a keyframe's translate values in pixels. Returns [x, y]. Missing
 * values default to 0 (identity = baseline of the motion path).
 */
function getTranslateXY(props: Record<string, unknown>): [number, number] {
  const x = parsePx(props.translateX) ?? parsePx(props.x) ?? 0;
  const y = parsePx(props.translateY) ?? parsePx(props.y) ?? 0;
  return [x, y];
}

// ---------------------------------------------------------------------------
// Build path handles from a component's keyframes + current viewport
// ---------------------------------------------------------------------------

/**
 * Extract editable motion-path handles from a component's keyframes.
 * Returns the handles in keyframe order and the "origin" on-canvas top-left
 * of the component so callers can transform to screen coordinates.
 */
export function extractPathHandles(
  component: MotionComponent,
  transform: ViewportTransform,
): PathHandle[] {
  const kfs = (component.keyframes as Keyframe[] | undefined) ?? [];
  if (kfs.length === 0) return [];
  const style = (component.style ?? {}) as Record<string, unknown>;
  const originLeft = parsePx(style.left) ?? 0;
  const originTop = parsePx(style.top) ?? 0;

  const handles: PathHandle[] = kfs.map((kf, i) => {
    const [tx, ty] = getTranslateXY(kf.properties as Record<string, unknown>);
    // Position on the canvas artboard is component-origin + translate
    const artboardX = originLeft + transform.componentWidth / 2 + tx;
    const artboardY = originTop + transform.componentHeight / 2 + ty;
    const screenX = artboardX * transform.zoom + transform.panX;
    const screenY = artboardY * transform.zoom + transform.panY;

    // Tangent hints: if there is a preceding/following frame, approximate a
    // bezier tangent using the slope to the neighbour (scaled by 1/3 span).
    let tangentOut: { dx: number; dy: number } | undefined;
    let tangentIn: { dx: number; dy: number } | undefined;
    if (i < kfs.length - 1) {
      const nxt = kfs[i + 1];
      const [nx, ny] = getTranslateXY(nxt.properties as Record<string, unknown>);
      tangentOut = {
        dx: ((nx - tx) / 3) * transform.zoom,
        dy: ((ny - ty) / 3) * transform.zoom,
      };
    }
    if (i > 0) {
      const prev = kfs[i - 1];
      const [px, py] = getTranslateXY(prev.properties as Record<string, unknown>);
      tangentIn = {
        dx: -((tx - px) / 3) * transform.zoom,
        dy: -((ty - py) / 3) * transform.zoom,
      };
    }
    return {
      index: i,
      offset: kf.offset,
      screenX, screenY,
      isEndpoint: i === 0 || i === kfs.length - 1,
      tangentOut, tangentIn,
    };
  });
  return handles;
}

// ---------------------------------------------------------------------------
// Mutators: move / add / remove handles
// ---------------------------------------------------------------------------

/**
 * Move a keyframe handle to a new screen position. Returns a new keyframes
 * array with translateX / translateY updated in-place for that frame. Other
 * properties are preserved verbatim.
 */
export function moveHandle(
  component: MotionComponent,
  handleIndex: number,
  newScreenX: number,
  newScreenY: number,
  transform: ViewportTransform,
): MoveHandleResult {
  const kfs = (component.keyframes as Keyframe[] | undefined) ?? [];
  if (handleIndex < 0 || handleIndex >= kfs.length) {
    return { keyframes: kfs, affectedProperties: [] };
  }
  const style = (component.style ?? {}) as Record<string, unknown>;
  const originLeft = parsePx(style.left) ?? 0;
  const originTop = parsePx(style.top) ?? 0;

  // Convert screen coords back to translate pixels (reverse of extract above).
  const artboardX = (newScreenX - transform.panX) / transform.zoom;
  const artboardY = (newScreenY - transform.panY) / transform.zoom;
  const newTx = artboardX - originLeft - transform.componentWidth / 2;
  const newTy = artboardY - originTop - transform.componentHeight / 2;

  const next = kfs.slice();
  const kf = next[handleIndex];
  const props = { ...(kf.properties as Record<string, unknown>) };
  props.translateX = Math.round(newTx);
  props.translateY = Math.round(newTy);
  next[handleIndex] = { ...kf, properties: props };
  return { keyframes: next, affectedProperties: ["translateX", "translateY"] };
}

/**
 * Insert a new keyframe handle along the path at progress t (0..100) in
 * offset space. The properties are interpolated between the two neighbouring
 * frames so the resulting motion is identical before/after the insert.
 */
export function insertHandle(
  component: MotionComponent,
  tOffset: number,
): Keyframe[] {
  const kfs = (component.keyframes as Keyframe[] | undefined) ?? [];
  if (kfs.length < 2) {
    return kfs.length === 0
      ? [{ offset: 0, properties: {} }, { offset: 100, properties: {} }]
      : [...kfs, { offset: 100, properties: kfs[kfs.length - 1].properties }];
  }
  // Copy-paste the interpolation helper locally to avoid circular exports
  const lerp = (a: number, b: number, tt: number) => a + (b - a) * tt;
  const sample = (left: Keyframe, right: Keyframe, localT: number): Keyframe => {
    const propsA = (left.properties ?? {}) as Record<string, unknown>;
    const propsB = (right.properties ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(propsA), ...Object.keys(propsB)])) {
      const a = propsA[k];
      const b = propsB[k];
      out[k] = typeof a === "number" && typeof b === "number" ? lerp(a, b, localT) : a ?? b ?? 0;
    }
    return { offset: tOffset, properties: out };
  };
  const sorted = [...kfs].sort((a, b) => a.offset - b.offset);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (tOffset >= sorted[i].offset && tOffset <= sorted[i + 1].offset) {
      const span = sorted[i + 1].offset - sorted[i].offset;
      const localT = span === 0 ? 0 : (tOffset - sorted[i].offset) / span;
      const newFrame = sample(sorted[i], sorted[i + 1], localT);
      const merged = [...sorted];
      merged.splice(i + 1, 0, newFrame);
      return merged;
    }
  }
  return sorted;
}

/**
 * Remove a keyframe handle. Preserves endpoints (caller should not attempt
 * removal of handle[0] or handle[n-1]; this function silently returns the
 * original array in that case).
 */
export function removeHandle(component: MotionComponent, handleIndex: number): Keyframe[] {
  const kfs = (component.keyframes as Keyframe[] | undefined) ?? [];
  if (handleIndex <= 0 || handleIndex >= kfs.length - 1) return kfs;
  const next = kfs.slice();
  next.splice(handleIndex, 1);
  return next;
}

// ---------------------------------------------------------------------------
// Path preview sampling — used by the canvas overlay to render the smooth
// trajectory polyline between the discrete handle positions.
// ---------------------------------------------------------------------------

/**
 * Sample the motion path at N evenly spaced steps (default 30) and return
 * an array of {x, y} points in artboard coordinates (screen-space conversion
 * is up to the caller).
 */
export function sampleMotionPath(
  component: MotionComponent,
  steps = 30,
): Array<{ x: number; y: number; offset: number }> {
  const kfs = (component.keyframes as Keyframe[] | undefined) ?? [];
  if (kfs.length === 0) return [];
  if (kfs.length === 1) {
    const [x, y] = getTranslateXY(kfs[0].properties as Record<string, unknown>);
    return [{ x, y, offset: kfs[0].offset }];
  }
  const sorted = [...kfs].sort((a, b) => a.offset - b.offset);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const points: Array<{ x: number; y: number; offset: number }> = [];
  for (let s = 0; s <= steps; s++) {
    const t = (100 * s) / steps;
    // find segment
    let found = false;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (t >= sorted[i].offset && t <= sorted[i + 1].offset) {
        const span = sorted[i + 1].offset - sorted[i].offset;
        const localT = span === 0 ? 0 : (t - sorted[i].offset) / span;
        const [ax, ay] = getTranslateXY(sorted[i].properties as Record<string, unknown>);
        const [bx, by] = getTranslateXY(sorted[i + 1].properties as Record<string, unknown>);
        points.push({ x: lerp(ax, bx, localT), y: lerp(ay, by, localT), offset: t });
        found = true;
        break;
      }
    }
    if (!found) {
      const [x, y] = getTranslateXY(sorted[sorted.length - 1].properties as Record<string, unknown>);
      points.push({ x, y, offset: t });
    }
  }
  return points;
}
