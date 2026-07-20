/**
 * Motion Values — reactive numeric/string values that drive animations.
 *
 * A MotionValue is the runtime primitive for declarative animation on the
 * OpenMotion canvas. Each value:
 *   - Holds a current value (number, string, or array of numbers)
 *   - Notifies subscribers on every change
 *   - Can be driven by a tween or spring animator
 *   - Can be composed with other values via derived functions
 *
 * The system is intentionally framework-agnostic: it has no React
 * dependency and can be used from any renderer (canvas/DOM/WebGL). React
 * hooks in `useMotionValue` connect a MotionValue to component state.
 */

export type MotionValueListener<T> = (value: T) => void;

export type EasingFn = (t: number) => number;

const DEFAULT_EASING: EasingFn = (t) => t;

/** Map an ease preset name to a function. */
export function easePreset(name: string): EasingFn {
  switch (name) {
    case "linear": return (t) => t;
    case "ease-in": return (t) => t * t;
    case "ease-out": return (t) => 1 - (1 - t) * (1 - t);
    case "ease-in-out": return (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    case "ease-in-cubic": return (t) => t * t * t;
    case "ease-out-cubic": return (t) => 1 - Math.pow(1 - t, 3);
    case "ease-in-out-cubic": return (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    case "ease-in-back": {
      const c1 = 1.70158, c3 = c1 + 1;
      return (t) => c3 * t * t * t - c1 * t * t;
    }
    case "ease-out-back": {
      const c1 = 1.70158, c3 = c1 + 1;
      return (t) => 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case "ease-in-out-back": {
      const c1 = 1.70158, c2 = c1 * 1.525;
      return (t) => t < 0.5
        ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
        : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    }
    default: return DEFAULT_EASING;
  }
}

/** Cubic bezier easing constructor (4 control points, p0=0 and p3=1 implicit). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  // Newton-Raphson iteration to solve for t given x.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  function solveT(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const xt = ((ax * t + bx) * t + cx) * t - x;
      if (Math.abs(xt) < 1e-6) return t;
      const d = (3 * ax * t + 2 * bx) * t + cx;
      if (Math.abs(d) < 1e-6) break;
      t -= xt / d;
    }
    // Fallback: bisection.
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const xt = ((ax * t + bx) * t + cx) * t;
      if (Math.abs(xt - x) < 1e-6) return t;
      if (xt < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  }

  return (t) => {
    const solved = solveT(t);
    return ((ay * solved + by) * solved + cy) * solved;
  };
}

export interface TweenOptions {
  duration: number; // ms
  easing?: EasingFn | string;
  delay?: number; // ms
  onComplete?: () => void;
}

export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
  velocity?: number;
  restThreshold?: number;
  onComplete?: () => void;
}

const DEFAULT_SPRING: Required<Omit<SpringConfig, "onComplete">> = {
  stiffness: 170,
  damping: 26,
  mass: 1,
  velocity: 0,
  restThreshold: 0.01,
};

/** Core MotionValue — a reactive container for a single animated scalar/string. */
export class MotionValue<T = number> {
  private _value: T;
  private _prev: T;
  private _listeners = new Set<MotionValueListener<T>>();
  private _driver: ((dt: number, now: number) => T | null) | null = null;
  private _driverCleanup: (() => void) | null = null;
  readonly id: string;

  constructor(initial: T, id?: string) {
    this._value = initial;
    this._prev = initial;
    this.id = id ?? `mv-${Math.random().toString(36).slice(2, 10)}`;
  }

  get(): T {
    return this._value;
  }

  getPrevious(): T {
    return this._prev;
  }

  set(next: T, silent = false): void {
    if (Object.is(next, this._value)) return;
    this._prev = this._value;
    this._value = next;
    if (!silent) this._emit();
  }

  /** Stop any active driver and jump to a value. */
  jump(value: T): void {
    this.stop();
    this.set(value);
  }

  subscribe(fn: MotionValueListener<T>): () => void {
    this._listeners.add(fn);
    fn(this._value);
    return () => this._listeners.delete(fn);
  }

  /** Internal: stop the current driver without firing listeners. */
  private stopDriver(): void {
    if (this._driverCleanup) {
      this._driverCleanup();
      this._driverCleanup = null;
    }
    this._driver = null;
  }

  /** Stop any active animation and freeze at the current value. */
  stop(): void {
    this.stopDriver();
  }

  /** Returns true when a tween/spring driver is currently animating. */
  isAnimating(): boolean {
    return this._driver !== null;
  }

  /** Drive this value with a custom per-frame function. Returns a stop handle. */
  drive(fn: (dt: number, now: number) => T | null): () => void {
    this.stopDriver();
    this._driver = fn;
    this._driverCleanup = () => {
      if (this._driver === fn) this._driver = null;
    };
    return () => this.stopDriver();
  }

  /** Animate to a target value over `duration` ms with the given easing. */
  tween(to: T, options: TweenOptions): () => void {
    if (typeof to !== "number" || typeof this._value !== "number") {
      // Non-numeric values can't interpolate — just snap.
      this.set(to);
      options.onComplete?.();
      return () => undefined;
    }
    const from = this._value as number;
    const target = to as number;
    const easing = typeof options.easing === "string"
      ? easePreset(options.easing)
      : (options.easing ?? DEFAULT_EASING);
    const delay = options.delay ?? 0;
    const duration = Math.max(1, options.duration);
    const startTime = performance.now() + delay;

    this.stopDriver();
    const driver = (dt: number, now: number): number | null => {
      if (now < startTime) return from;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = easing(t);
      return from + (target - from) * eased;
    };
    this._driver = driver as (dt: number, now: number) => T | null;
    this._driverCleanup = () => {
      if (this._driver === driver) this._driver = null;
    };
    return () => this.stopDriver();
  }

  /** Animate to `to` using a spring physics model. Spring stops itself. */
  spring(to: T, config: SpringConfig = {}): () => void {
    if (typeof to !== "number" || typeof this._value !== "number") {
      this.set(to);
      config.onComplete?.();
      return () => undefined;
    }
    const cfg = { ...DEFAULT_SPRING, ...config };
    let position = this._value as number;
    const target = to as number;
    let velocity = cfg.velocity;
    const k = cfg.stiffness;
    const c = cfg.damping;
    const m = cfg.mass;
    let lastTime = performance.now();
    let settled = false;

    this.stopDriver();
    const driver = (_dt: number, now: number): number | null => {
      if (settled) return null;
      const dt = Math.min(64, now - lastTime) / 1000;
      lastTime = now;
      const force = -k * (position - target);
      const damp = -c * velocity;
      const accel = (force + damp) / m;
      velocity += accel * dt;
      position += velocity * dt;
      if (Math.abs(position - target) < cfg.restThreshold && Math.abs(velocity) < cfg.restThreshold) {
        settled = true;
        // Schedule the completion callback after the value settles.
        queueMicrotask(() => cfg.onComplete?.());
        return target;
      }
      return position;
    };
    this._driver = driver as (dt: number, now: number) => T | null;
    this._driverCleanup = () => {
      if (this._driver === driver) this._driver = null;
    };
    return () => this.stopDriver();
  }

  private _emit(): void {
    for (const fn of this._listeners) {
      try { fn(this._value); } catch { /* listener errors are isolated */ }
    }
  }

  /** Internal: advance the active driver by one frame. Called by the global loop. */
  _tick(dt: number, now: number): void {
    if (!this._driver) return;
    const next = this._driver(dt, now);
    if (next === null) {
      this.stopDriver();
      return;
    }
    this.set(next);
  }
}

/** Compose multiple MotionValues into a derived output via a function. */
export function combine<TOut>(
  inputs: MotionValue<unknown>[],
  fn: (...values: unknown[]) => TOut,
): MotionValue<TOut> {
  const initial = fn(...inputs.map((i) => i.get()));
  const out = new MotionValue<TOut>(initial, `combined-${Math.random().toString(36).slice(2, 8)}`);
  for (const mv of inputs) {
    mv.subscribe(() => {
      out.set(fn(...inputs.map((i) => i.get())));
    });
  }
  return out;
}

// --- Global animation loop ---
// A single requestAnimationFrame loop drives all active MotionValues. This
// avoids the cost of many independent rAF loops and keeps the canvas
// animation system in sync with the renderer.

const registry = new Set<MotionValue<unknown>>();
let rafHandle: number | null = null;
let lastFrame = 0;

function loop(now: number): void {
  const dt = lastFrame === 0 ? 16 : now - lastFrame;
  lastFrame = now;
  for (const mv of registry) {
    mv._tick(dt, now);
  }
  if (registry.size > 0) {
    rafHandle = requestAnimationFrame(loop);
  } else {
    rafHandle = null;
    lastFrame = 0;
  }
}

/** Register a MotionValue with the global animation loop. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function startTicking(mv: MotionValue<any>): void {
  registry.add(mv);
  if (rafHandle === null) {
    lastFrame = 0;
    rafHandle = requestAnimationFrame(loop);
  }
}

/** Unregister a MotionValue from the global loop. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stopTicking(mv: MotionValue<any>): void {
  registry.delete(mv);
  if (registry.size === 0 && rafHandle !== null) {
    cancelAnimationFrame(rafHandle);
    rafHandle = null;
    lastFrame = 0;
  }
}

/** Convenience: create a number MotionValue and start ticking immediately. */
export function motionValue(initial: number, id?: string): MotionValue<number> {
  const mv = new MotionValue<number>(initial, id);
  startTicking(mv);
  return mv;
}

/** Convenience: create a string MotionValue and start ticking immediately. */
export function motionString(initial: string, id?: string): MotionValue<string> {
  const mv = new MotionValue<string>(initial, id);
  startTicking(mv);
  return mv;
}
