import type { MotionComponent, MotionSpec, Easing, Keyframe, KeyValue } from "@openmotion/shared";
import { PRESET_BEZIER, easingPreset } from "../shared/motion/easing.js";
import { buildCompositionTree, flattenToTimeline, type CompositionResult, type TimelineEntry } from "./compositionEngine.js";

/**
 * Seek-driven deterministic frame rendering engine.
 *
 * The canonical clock is `t = frame / fps`. Given the same MotionSpec and
 * frame number, the engine always produces the identical FrameSnapshot —
 * no wall-clock dependencies, no unseeded randomness. This makes it suitable
 * for CI regression testing, batch rendering, and frame-accurate preview.
 *
 * The engine calculates the interpolated state of every component at any
 * frame by walking keyframes and applying the correct easing function.
 */

export const DEFAULT_FPS = 60;

/** A snapshot of a single property at a specific frame. */
export interface PropertySnapshot {
  name: string;
  value: number | string;
  unit: string;
}

/** A snapshot of a single component at a specific frame. */
export interface ComponentSnapshot {
  componentId: string;
  name: string;
  visible: boolean;
  /** Progress through the animation (0-1), or 1 if past end with fillMode forwards/both. */
  progress: number;
  /** Resolved transform properties. */
  transform: Record<string, number | string>;
  /** Resolved non-transform CSS properties. */
  styles: Record<string, number | string>;
  /** Computed CSS transform string. */
  transformCss: string;
  /** Computed opacity (0-1). */
  opacity: number;
  /** Layer index for stacking. */
  layer: number;
  /** Absolute start time in ms. */
  startMs: number;
  /** Absolute end time in ms. */
  endMs: number;
}

/** A complete snapshot of the entire composition at a specific frame. */
export interface FrameSnapshot {
  frame: number;
  timeMs: number;
  fps: number;
  /** Total duration in frames. */
  totalFrames: number;
  /** Active components at this frame. */
  components: ComponentSnapshot[];
  /** Whether this frame is past the end of the composition. */
  isComplete: boolean;
}

/** Frame adapter — a plugin that can resolve component state at any frame. */
export interface FrameAdapter {
  name: string;
  /** Whether this adapter handles the given component. */
  matches(component: MotionComponent): boolean;
  /** Resolve the component's state at the given progress (0-1). */
  resolve(component: MotionComponent, progress: number): Partial<ComponentSnapshot>;
}

/** Render configuration. */
export interface RenderConfig {
  fps?: number;
  width?: number;
  height?: number;
  /** Background color as CSS string. */
  background?: string;
  /** Whether to include components that haven't started yet. */
  includeUpcoming?: boolean;
  /** Custom frame adapters. */
  adapters?: FrameAdapter[];
}

/** Result of rendering a range of frames. */
export interface RenderResult {
  frames: FrameSnapshot[];
  totalFrames: number;
  fps: number;
  durationMs: number;
  /** Number of frames that had at least one active component. */
  activeFrames: number;
}

/** Default frame adapters registered with the engine. */
const defaultAdapters: FrameAdapter[] = [];

/**
 * Register a custom frame adapter. Adapters are checked in registration
 * order; the first adapter whose `matches()` returns true wins.
 */
export function registerFrameAdapter(adapter: FrameAdapter): void {
  defaultAdapters.push(adapter);
}

/** Resolve an easing to a progress function (0-1 input -> 0-1 output). */
function resolveEasingFn(easing: Easing | undefined): (t: number) => number {
  if (!easing) return (t) => t;

  if (easing.type === "preset") {
    const nativeMap: Record<string, (t: number) => number> = {
      linear: (t) => t,
      ease: cubicBezier(0.25, 0.1, 0.25, 1),
      "ease-in": cubicBezier(0.42, 0, 1, 1),
      "ease-out": cubicBezier(0, 0, 0.58, 1),
      "ease-in-out": cubicBezier(0.42, 0, 0.58, 1),
    };
    if (nativeMap[easing.name]) return nativeMap[easing.name];

    const bz = PRESET_BEZIER[easing.name];
    if (bz) return cubicBezier(bz[0], bz[1], bz[2], bz[3]);
    return (t) => t;
  }

  if (easing.type === "bezier") {
    return cubicBezier(easing.p1[0], easing.p1[1], easing.p2[0], easing.p2[1]);
  }

  if (easing.type === "spring") {
    return springFn(easing.stiffness, easing.damping, easing.mass);
  }

  return (t) => t;
}

/** Cubic Bezier easing function (same algorithm as CSS cubic-bezier). */
function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  // Solve for t given x (progress), then return y at that t.
  return function (progress: number): number {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;

    // Newton-Raphson iteration to find t from x
    let t = progress;
    for (let i = 0; i < 8; i++) {
      const x = bezierComponent(t, x1, x2) - progress;
      if (Math.abs(x) < 1e-6) break;
      const dx = bezierDerivative(t, x1, x2);
      if (Math.abs(dx) < 1e-6) break;
      t -= x / dx;
      t = Math.max(0, Math.min(1, t));
    }

    return bezierComponent(t, y1, y2);
  };
}

function bezierComponent(t: number, p1: number, p2: number): number {
  const ct = 1 - t;
  return 3 * ct * ct * t * p1 + 3 * ct * t * t * p2 + t * t * t;
}

function bezierDerivative(t: number, p1: number, p2: number): number {
  const ct = 1 - t;
  return 3 * ct * ct * p1 + 6 * ct * t * (p2 - p1) + 3 * t * t * (1 - p2);
}

/** Spring physics easing — underdamped, critically damped, or overdamped. */
function springFn(stiffness: number, damping: number, mass: number): (t: number) => number {
  const omega0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  return function (progress: number): number {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;

    const t = progress * (1 / omega0) * 2; // Scale time to ~1 period

    if (zeta >= 1) {
      // Overdamped or critically damped
      const a = -omega0 * (zeta - Math.sqrt(zeta * zeta - 1));
      const b = -omega0 * (zeta + Math.sqrt(zeta * zeta - 1));
      if (zeta === 1) {
        // Critically damped
        return 1 - (1 + omega0 * t) * Math.exp(-omega0 * t);
      }
      return 1 - (b * Math.exp(a * t) - a * Math.exp(b * t)) / (b - a);
    }

    // Underdamped (bouncy)
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const envelope = Math.exp(-zeta * omega0 * t);
    return 1 - envelope * (Math.cos(omegaD * t) + (zeta * omega0 / omegaD) * Math.sin(omegaD * t));
  };
}

/** Interpolate between two keyframe values. */
function interpolateValue(from: KeyValue, to: KeyValue, t: number): KeyValue {
  if (typeof from === "string" || typeof to === "string") {
    // For string values, snap to the target at t > 0.5
    return t >= 0.5 ? to : from;
  }
  return from + (to - from) * t;
}

/** Extract numeric value and unit from a KeyValue. */
function extractValueAndUnit(value: KeyValue): { num: number; unit: string } {
  if (typeof value === "number") return { num: value, unit: "" };
  const match = value.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (match) return { num: parseFloat(match[1]), unit: match[2] };
  return { num: 0, unit: "" };
}

/**
 * Resolve a component's keyframes at the given progress (0-1).
 * Returns the interpolated property values.
 */
function resolveKeyframes(
  component: MotionComponent,
  progress: number,
  easingFn: (t: number) => number,
): { transform: Record<string, number | string>; styles: Record<string, number | string>; opacity: number } {
  const transform: Record<string, number | string> = {};
  const styles: Record<string, number | string> = {};
  let opacity = 1;

  const keyframes = component.keyframes;
  if (!keyframes || keyframes.length === 0) {
    // No keyframes — use static style
    if (component.style) {
      for (const [key, val] of Object.entries(component.style)) {
        if (key === "opacity") {
          opacity = typeof val === "number" ? val : 1;
        } else if (isTransformProp(key)) {
          transform[key] = val;
        } else {
          styles[key] = val;
        }
      }
    }
    return { transform, styles, opacity };
  }

  // Sort keyframes by offset
  const sorted = [...keyframes].sort((a, b) => a.offset - b.offset);

  // Apply easing to progress
  const easedProgress = easingFn(progress);

  // Find the surrounding keyframes
  let from = sorted[0];
  let to = sorted[sorted.length - 1];
  let segmentT = easedProgress;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (easedProgress >= sorted[i].offset && easedProgress <= sorted[i + 1].offset) {
      from = sorted[i];
      to = sorted[i + 1];
      const range = to.offset - from.offset;
      segmentT = range > 0 ? (easedProgress - from.offset) / range : 0;
      break;
    }
  }

  // Apply segment easing if present
  if (from.easing) {
    segmentT = resolveEasingFn(from.easing)(segmentT);
  }

  // Interpolate all properties
  const allProps = new Set([...Object.keys(from.properties), ...Object.keys(to.properties)]);
  for (const prop of allProps) {
    const fromVal = from.properties[prop] ?? getDefaultForProp(prop);
    const toVal = to.properties[prop] ?? getDefaultForProp(prop);
    const interpolated = interpolateValue(fromVal, toVal, segmentT);

    if (prop === "opacity") {
      opacity = typeof interpolated === "number" ? interpolated : 1;
    } else if (isTransformProp(prop)) {
      transform[prop] = interpolated;
    } else {
      styles[prop] = interpolated;
    }
  }

  return { transform, styles, opacity };
}

function isTransformProp(prop: string): boolean {
  const transformProps = [
    "translateX", "translateY", "translateZ",
    "scale", "scaleX", "scaleY",
    "rotate", "rotateX", "rotateY", "rotateZ",
    "skewX", "skewY",
  ];
  return transformProps.includes(prop);
}

function getDefaultForProp(prop: string): KeyValue {
  const defaults: Record<string, KeyValue> = {
    opacity: 1,
    scale: 1,
    scaleX: 1,
    scaleY: 1,
    translateX: 0,
    translateY: 0,
    translateZ: 0,
    rotate: 0,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    skewX: 0,
    skewY: 0,
    blur: 0,
    width: "100%",
    height: "100%",
  };
  return defaults[prop] ?? 0;
}

/** Build a CSS transform string from resolved transform properties. */
function buildTransformCss(transform: Record<string, number | string>): string {
  const parts: string[] = [];
  const tx = transform.translateX;
  const ty = transform.translateY;
  const tz = transform.translateZ;

  if (tx !== undefined || ty !== undefined || tz !== undefined) {
    const x = formatTransformValue(tx, "px");
    const y = formatTransformValue(ty, "px");
    const z = formatTransformValue(tz, "px");
    if (z !== "0px") {
      parts.push(`translate3d(${x}, ${y}, ${z})`);
    } else if (y !== "0px") {
      parts.push(`translate(${x}, ${y})`);
    } else if (x !== "0px") {
      parts.push(`translateX(${x})`);
    }
  }

  const scale = transform.scale;
  const scaleX = transform.scaleX;
  const scaleY = transform.scaleY;
  if (scale !== undefined) {
    parts.push(`scale(${formatNum(scale)})`);
  } else if (scaleX !== undefined || scaleY !== undefined) {
    parts.push(`scale(${formatNum(scaleX ?? 1)}, ${formatNum(scaleY ?? 1)})`);
  }

  if (transform.rotate !== undefined) parts.push(`rotate(${formatTransformValue(transform.rotate, "deg")})`);
  if (transform.rotateX !== undefined) parts.push(`rotateX(${formatTransformValue(transform.rotateX, "deg")})`);
  if (transform.rotateY !== undefined) parts.push(`rotateY(${formatTransformValue(transform.rotateY, "deg")})`);
  if (transform.rotateZ !== undefined) parts.push(`rotateZ(${formatTransformValue(transform.rotateZ, "deg")})`);
  if (transform.skewX !== undefined) parts.push(`skewX(${formatTransformValue(transform.skewX, "deg")})`);
  if (transform.skewY !== undefined) parts.push(`skewY(${formatTransformValue(transform.skewY, "deg")})`);

  return parts.length > 0 ? parts.join(" ") : "none";
}

function formatTransformValue(val: number | string | undefined, unit: string): string {
  if (val === undefined) return `0${unit}`;
  if (typeof val === "string") {
    const { num, unit: existingUnit } = extractValueAndUnit(val);
    return `${num}${existingUnit || unit}`;
  }
  return `${val}${unit}`;
}

function formatNum(val: number | string | undefined): string {
  if (val === undefined) return "1";
  if (typeof val === "string") return extractValueAndUnit(val).num.toString();
  return val.toString();
}

/**
 * Compute a single component's snapshot at the given time.
 */
function computeComponentSnapshot(
  component: MotionComponent,
  entry: TimelineEntry,
  timeMs: number,
  layer: number,
  adapters: FrameAdapter[],
): ComponentSnapshot | null {
  const startMs = entry.startMs;
  const endMs = entry.endMs;
  const durationMs = entry.durationMs;

  // Check visibility
  const beforeStart = timeMs < startMs;
  const afterEnd = timeMs > endMs;

  // Handle fillMode
  if (beforeStart) {
    // Component hasn't started — check fillMode backwards/both
    if (component.fillMode !== "backwards" && component.fillMode !== "both") {
      return null;
    }
  }

  if (afterEnd) {
    // Component has ended — check fillMode forwards/both
    if (component.fillMode !== "forwards" && component.fillMode !== "both") {
      return null;
    }
  }

  // Calculate progress
  let progress: number;
  if (beforeStart) {
    progress = 0;
  } else if (afterEnd) {
    progress = 1;
  } else {
    progress = Math.max(0, Math.min(1, (timeMs - startMs) / durationMs));

    // Handle iteration count
    if (component.iterationCount !== "infinite" && component.iterationCount > 1) {
      const cycleProgress = progress * component.iterationCount;
      progress = cycleProgress % 1;
      // Handle direction
      if (component.direction === "reverse") {
        progress = 1 - progress;
      } else if (component.direction === "alternate") {
        const cycle = Math.floor(cycleProgress);
        if (cycle % 2 === 1) progress = 1 - progress;
      } else if (component.direction === "alternate-reverse") {
        const cycle = Math.floor(cycleProgress);
        if (cycle % 2 === 0) progress = 1 - progress;
      }
    } else if (component.direction === "reverse") {
      progress = 1 - progress;
    }
  }

  // Check for custom adapter
  const adapter = adapters.find((a) => a.matches(component));
  if (adapter) {
    const resolved = adapter.resolve(component, progress);
    return {
      componentId: component.id,
      name: component.name,
      visible: !beforeStart,
      progress,
      transform: resolved.transform ?? {},
      styles: resolved.styles ?? {},
      transformCss: resolved.transformCss ?? "none",
      opacity: resolved.opacity ?? 1,
      layer,
      startMs,
      endMs,
    };
  }

  // Default resolution via keyframes
  const easingFn = resolveEasingFn(component.easing);
  const { transform, styles, opacity } = resolveKeyframes(component, progress, easingFn);
  const transformCss = buildTransformCss(transform);

  // Merge static styles
  if (component.style) {
    for (const [key, val] of Object.entries(component.style)) {
      if (!styles[key] && !isTransformProp(key) && key !== "opacity") {
        styles[key] = val;
      }
    }
  }

  return {
    componentId: component.id,
    name: component.name,
    visible: !beforeStart,
    progress,
    transform,
    styles,
    transformCss,
    opacity,
    layer,
    startMs,
    endMs,
  };
}

/**
 * Seek to a specific frame and return the complete snapshot.
 * This is the core deterministic function — same frame always produces
 * the same output.
 */
export function seekToFrame(
  spec: MotionSpec,
  frame: number,
  config: RenderConfig = {},
): FrameSnapshot {
  const fps = config.fps ?? DEFAULT_FPS;
  const adapters = config.adapters ?? defaultAdapters;

  const composition = flattenToTimeline(buildCompositionTree(spec), fps);
  const timeMs = (frame / fps) * 1000;

  const componentMap = new Map<string, MotionComponent>();
  for (const comp of spec.components) {
    componentMap.set(comp.id, comp);
  }

  const snapshots: ComponentSnapshot[] = [];
  for (const entry of composition.timeline) {
    const component = componentMap.get(entry.componentId);
    if (!component) continue;

    const snapshot = computeComponentSnapshot(
      component,
      entry,
      timeMs,
      entry.layer,
      adapters,
    );
    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  // Sort by layer then by start time
  snapshots.sort((a, b) => {
    if (a.layer !== b.layer) return a.layer - b.layer;
    return a.startMs - b.startMs;
  });

  return {
    frame,
    timeMs,
    fps,
    totalFrames: composition.frameCount,
    components: snapshots,
    isComplete: frame >= composition.frameCount,
  };
}

/**
 * Render a range of frames from startFrame to endFrame (inclusive).
 * Returns all frame snapshots in order.
 */
export function renderFrameRange(
  spec: MotionSpec,
  startFrame: number,
  endFrame: number,
  config: RenderConfig = {},
): RenderResult {
  const fps = config.fps ?? DEFAULT_FPS;
  const frames: FrameSnapshot[] = [];
  let activeFrames = 0;

  for (let f = startFrame; f <= endFrame; f++) {
    const snapshot = seekToFrame(spec, f, config);
    frames.push(snapshot);
    if (snapshot.components.length > 0) activeFrames++;
  }

  const composition = flattenToTimeline(buildCompositionTree(spec), fps);

  return {
    frames,
    totalFrames: composition.frameCount,
    fps,
    durationMs: composition.totalDurationMs,
    activeFrames,
  };
}

/**
 * Render the entire composition from frame 0 to the last frame.
 */
export function renderAll(spec: MotionSpec, config: RenderConfig = {}): RenderResult {
  const fps = config.fps ?? DEFAULT_FPS;
  const composition = flattenToTimeline(buildCompositionTree(spec), fps);
  return renderFrameRange(spec, 0, composition.frameCount, config);
}

/**
 * Find the optimal thumbnail frame — the frame with the most active
 * components and highest visual interest.
 */
export function findThumbnailFrame(spec: MotionSpec, config: RenderConfig = {}): number {
  const fps = config.fps ?? DEFAULT_FPS;
  const composition = flattenToTimeline(buildCompositionTree(spec), fps);
  if (composition.frameCount === 0) return 0;

  let bestFrame = 0;
  let bestScore = 0;

  // Sample every 5th frame for efficiency
  const step = Math.max(1, Math.floor(composition.frameCount / 60));
  for (let f = 0; f < composition.frameCount; f += step) {
    const snapshot = seekToFrame(spec, f, config);
    const score = snapshot.components.reduce(
      (sum, c) => sum + c.progress * (1 - Math.abs(c.progress - 0.5) * 0.5),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestFrame = f;
    }
  }

  return bestFrame;
}

/**
 * Export a frame snapshot as a CSS-styleable HTML string.
 * This produces a static HTML representation of the frame that can
 * be rendered in any browser without JavaScript.
 */
export function snapshotToHtml(snapshot: FrameSnapshot, spec: MotionSpec, config: RenderConfig = {}): string {
  const width = config.width ?? spec.project?.tokens?.width ?? 1920;
  const height = config.height ?? spec.project?.tokens?.height ?? 1080;
  const background = config.background ?? "#000000";

  const componentHtml = snapshot.components
    .map((comp) => {
      const styleEntries = Object.entries(comp.styles)
        .map(([key, val]) => `${key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}: ${val}`)
        .join("; ");
      return `      <div data-component-id="${comp.componentId}" style="
        position: absolute;
        opacity: ${comp.opacity};
        transform: ${comp.transformCss};
        ${styleEntries}
      ">${comp.name}</div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Frame ${snapshot.frame} — ${spec.project?.name ?? "Motion"}</title>
  <style>
    body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #1a1a1a; }
    .stage { position: relative; width: ${width}px; height: ${height}px; background: ${background}; overflow: hidden; }
  </style>
</head>
<body>
  <div class="stage" data-frame="${snapshot.frame}" data-time="${snapshot.timeMs}ms">
${componentHtml}
  </div>
</body>
</html>`;
}

/**
 * Generate a sequence of key frames for timeline preview.
 * Returns snapshots at evenly-spaced intervals.
 */
export function generateKeyFrames(
  spec: MotionSpec,
  count: number,
  config: RenderConfig = {},
): FrameSnapshot[] {
  const fps = config.fps ?? DEFAULT_FPS;
  const composition = flattenToTimeline(buildCompositionTree(spec), fps);
  if (composition.frameCount === 0 || count <= 0) return [];

  const step = composition.frameCount / count;
  const frames: FrameSnapshot[] = [];
  for (let i = 0; i < count; i++) {
    const frame = Math.min(Math.round(i * step), composition.frameCount - 1);
    frames.push(seekToFrame(spec, frame, config));
  }
  return frames;
}
