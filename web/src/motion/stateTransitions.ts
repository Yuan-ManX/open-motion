/**
 * State Transitions — animated interpolation between two state snapshots.
 *
 * When the user (or the Agent) triggers a state change, the StateMachinePanel
 * needs to move every affected component's style values from their current
 * values to the target state's values over the transition's duration. This
 * module owns that interpolation logic.
 *
 * The animation is driven by MotionValue tween/spring animators, so it
 * integrates with the global rAF loop and respects easing curves. Non-
 * numeric values (e.g. display, flex-direction) snap instantly.
 *
 * The module is framework-agnostic — it accepts a getter/setter pair per
 * component so it can be driven from React state, the canvas renderer, or
 * any other surface.
 */

import { MotionValue, easePreset, cubicBezier, startTicking, stopTicking, type EasingFn } from "./motionValues.js";

/** A flat snapshot of one component's style values. */
export type StyleSnapshot = Record<string, string | number>;

/** Easing spec accepted by the transition engine. */
export type TransitionEasingSpec =
  | { type: "preset"; name: string }
  | { type: "bezier"; p1: [number, number]; p2: [number, number] }
  | { type: "spring"; stiffness: number; damping: number; mass: number };

export interface TransitionOptions {
  durationMs: number;
  easing?: TransitionEasingSpec;
  /** Called for every frame with the interpolated snapshot. */
  onFrame: (snapshot: StyleSnapshot) => void;
  /** Called when the transition completes (or is cancelled). */
  onComplete?: () => void;
  /** Optional starting snapshot; if omitted, the getter is used. */
  from?: StyleSnapshot;
}

export interface TransitionHandle {
  /** Stop the transition at the current frame. */
  cancel: () => void;
  /** True if the transition is still running. */
  running: boolean;
}

/** Parse a color string into [r, g, b, a] components. Returns null if not a color. */
function parseColor(value: string): [number, number, number, number] | null {
  const v = value.trim();
  if (v.startsWith("#")) {
    const hex = v.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return [r, g, b, 1];
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return [r, g, b, a];
    }
    return null;
  }
  const rgbMatch = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgbMatch) {
    return [
      Number(rgbMatch[1]),
      Number(rgbMatch[2]),
      Number(rgbMatch[3]),
      rgbMatch[4] !== undefined ? Number(rgbMatch[4]) : 1,
    ];
  }
  return null;
}

/** Resolve an easing spec to an easing function. */
function resolveEasing(spec: TransitionEasingSpec | undefined): EasingFn {
  if (!spec) return easePreset("ease-out");
  if (spec.type === "preset") return easePreset(spec.name);
  if (spec.type === "bezier") return cubicBezier(spec.p1[0], spec.p1[1], spec.p2[0], spec.p2[1]);
  // Spring is handled separately by the spring animator; fall back to a snappy ease.
  return easePreset("ease-out");
}

/** Determine whether a style value is numeric (or a numeric unit like "12px"). */
interface NumericValue {
  value: number;
  unit: string;
}
function parseNumeric(value: string | number): NumericValue | null {
  if (typeof value === "number") return { value, unit: "" };
  const match = value.match(/^(-?\d*\.?\d+)(px|deg|%|em|rem|vh|vw|s|ms)?$/);
  if (match) return { value: Number(match[1]), unit: match[2] ?? "" };
  return null;
}

/** Merge the union of keys from two snapshots. */
function allKeys(from: StyleSnapshot, to: StyleSnapshot): string[] {
  const set = new Set<string>();
  for (const k of Object.keys(from)) set.add(k);
  for (const k of Object.keys(to)) set.add(k);
  return [...set];
}

/**
 * Animate a single component's style from its current values to a target
 * snapshot. Numeric and color values are interpolated; other values snap
 * at the midpoint.
 */
export function transitionComponentStyle(
  getCurrent: () => StyleSnapshot,
  target: StyleSnapshot,
  options: TransitionOptions,
): TransitionHandle {
  const start = options.from ?? getCurrent();
  const easing = resolveEasing(options.easing);
  const useSpring = options.easing?.type === "spring";
  const duration = Math.max(1, options.durationMs);
  const startTime = performance.now();

  // Pre-compute per-key interpolation metadata.
  const keys = allKeys(start, target);
  type KeyPlan =
    | { kind: "numeric"; from: number; to: number; unit: string; mv: MotionValue<number> }
    | { kind: "color"; from: [number, number, number, number]; to: [number, number, number, number]; mvs: [MotionValue<number>, MotionValue<number>, MotionValue<number>, MotionValue<number>] }
    | { kind: "snap"; value: string | number; snapAt: number };
  const plans: KeyPlan[] = [];
  // Track every MotionValue we create so we can start/stop the global loop.
  const allMvs: MotionValue<number>[] = [];

  for (const key of keys) {
    const fromVal = start[key];
    const toVal = target[key];
    if (fromVal === undefined) {
      plans.push({ kind: "snap", value: toVal, snapAt: 0 });
      continue;
    }
    if (toVal === undefined) {
      plans.push({ kind: "snap", value: fromVal, snapAt: 1 });
      continue;
    }
    if (typeof fromVal === "string" && typeof toVal === "string") {
      const fromColor = parseColor(fromVal);
      const toColor = parseColor(toVal);
      if (fromColor && toColor) {
        const mvs: [MotionValue<number>, MotionValue<number>, MotionValue<number>, MotionValue<number>] = [
          new MotionValue(fromColor[0]),
          new MotionValue(fromColor[1]),
          new MotionValue(fromColor[2]),
          new MotionValue(fromColor[3]),
        ];
        allMvs.push(...mvs);
        plans.push({ kind: "color", from: fromColor, to: toColor, mvs });
        continue;
      }
      const fromNum = parseNumeric(fromVal);
      const toNum = parseNumeric(toVal);
      if (fromNum && toNum && fromNum.unit === toNum.unit) {
        const mv = new MotionValue(fromNum.value);
        allMvs.push(mv);
        plans.push({ kind: "numeric", from: fromNum.value, to: toNum.value, unit: fromNum.unit, mv });
        continue;
      }
    }
    if (typeof fromVal === "number" && typeof toVal === "number") {
      const mv = new MotionValue(fromVal);
      allMvs.push(mv);
      plans.push({ kind: "numeric", from: fromVal, to: toVal, unit: "", mv });
      continue;
    }
    plans.push({ kind: "snap", value: toVal, snapAt: 0.5 });
  }

  // Register all MotionValues with the global rAF loop so their drivers advance.
  for (const mv of allMvs) startTicking(mv);

  // Drive each numeric/color channel with a tween or spring.
  for (const plan of plans) {
    if (plan.kind === "numeric") {
      if (useSpring && options.easing?.type === "spring") {
        plan.mv.spring(plan.to, {
          stiffness: options.easing.stiffness,
          damping: options.easing.damping,
          mass: options.easing.mass,
        });
      } else {
        plan.mv.tween(plan.to, { duration, easing });
      }
    } else if (plan.kind === "color") {
      const springCfg = useSpring && options.easing?.type === "spring" ? options.easing : null;
      for (let i = 0; i < 4; i++) {
        if (springCfg) {
          plan.mvs[i].spring(plan.to[i], {
            stiffness: springCfg.stiffness,
            damping: springCfg.damping,
            mass: springCfg.mass,
          });
        } else {
          plan.mvs[i].tween(plan.to[i], { duration, easing });
        }
      }
    }
  }

  let cancelled = false;
  const cleanup = () => {
    for (const mv of allMvs) {
      mv.stop();
      stopTicking(mv);
    }
  };
  const handle: TransitionHandle = {
    running: true,
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      handle.running = false;
      cleanup();
      options.onComplete?.();
    },
  };

  // Per-frame sampling: read the current MotionValue state and emit a snapshot.
  function sample(t: number): StyleSnapshot {
    const out: StyleSnapshot = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const plan = plans[i];
      if (plan.kind === "numeric") {
        const v = plan.mv.get();
        out[key] = plan.unit ? `${v}${plan.unit}` : v;
      } else if (plan.kind === "color") {
        const r = Math.round(plan.mvs[0].get());
        const g = Math.round(plan.mvs[1].get());
        const b = Math.round(plan.mvs[2].get());
        const a = plan.mvs[3].get();
        out[key] = a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
      } else {
        // Snap value at the configured midpoint.
        out[key] = t >= plan.snapAt ? plan.value : (start[key] ?? plan.value);
      }
    }
    return out;
  }

  function tick(): void {
    if (cancelled) return;
    const now = performance.now();
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const snapshot = sample(t);
    options.onFrame(snapshot);
    if (t >= 1 && !useSpring) {
      handle.running = false;
      cleanup();
      options.onComplete?.();
      return;
    }
    // For spring, keep ticking until all MotionValues settle.
    if (useSpring) {
      const allSettled = plans.every((p) => {
        if (p.kind === "numeric") return !p.mv.isAnimating();
        if (p.kind === "color") return p.mvs.every((mv) => !mv.isAnimating());
        return true;
      });
      if (allSettled) {
        handle.running = false;
        cleanup();
        options.onComplete?.();
        return;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return handle;
}

/**
 * Transition multiple components in parallel. Each component gets its own
 * interpolator, all driven by the same duration and easing. Returns a single
 * handle that cancels all component transitions.
 */
export interface ComponentTransition {
  componentId: string;
  getCurrent: () => StyleSnapshot;
  target: StyleSnapshot;
}
export function transitionMultiple(
  transitions: ComponentTransition[],
  options: Omit<TransitionOptions, "onFrame"> & {
    onFrame: (componentId: string, snapshot: StyleSnapshot) => void;
  },
): TransitionHandle {
  const handles = transitions.map((t) =>
    transitionComponentStyle(t.getCurrent, t.target, {
      durationMs: options.durationMs,
      easing: options.easing,
      from: options.from,
      onFrame: (snapshot) => options.onFrame(t.componentId, snapshot),
    }),
  );
  let cancelled = false;
  return {
    get running() {
      return handles.some((h) => h.running);
    },
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      handles.forEach((h) => h.cancel());
      options.onComplete?.();
    },
  };
}
