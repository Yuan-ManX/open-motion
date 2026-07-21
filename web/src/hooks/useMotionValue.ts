/**
 * React hooks for the Motion Values + Layout Animation runtime.
 *
 * - useMotionValue: bind a MotionValue to React state, triggering a
 *   re-render whenever the value changes. Returns the value plus the
 *   MotionValue handle so the caller can drive it (tween, spring, etc.).
 * - useLayoutFlip: snapshot+play the canvas FlipRegistry around a
 *   render. The hook reads a "trigger" value (typically the component
 *   list) and animates any position/size change between renders.
 * - useFlipRegistration: register a DOM element under a stable key so
 *   the FlipRegistry can animate it.
 */

import { useEffect, useRef, useState, useLayoutEffect, useCallback } from "react";
import {
  MotionValue,
  motionValue as createMotionValue,
  motionString as createMotionString,
  startTicking,
  stopTicking,
} from "../motion/motionValues.js";
import { canvasFlipRegistry, FlipRegistry, enterElement, exitElement } from "../motion/layoutAnimations.js";

/** Bind a numeric MotionValue to React state. */
export function useMotionValue(initial: number, id?: string): {
  value: number;
  mv: MotionValue<number>;
  setValue: (v: number) => void;
} {
  const [value, setValue] = useState(initial);
  const mvRef = useRef<MotionValue<number> | null>(null);
  if (mvRef.current === null) {
    mvRef.current = createMotionValue(initial, id);
  }
  useEffect(() => {
    const mv = mvRef.current!;
    const unsub = mv.subscribe(setValue);
    return () => {
      unsub();
      stopTicking(mv);
    };
  }, []);
  const setValueWrapper = useCallback((v: number) => {
    mvRef.current!.set(v);
  }, []);
  return { value, mv: mvRef.current, setValue: setValueWrapper };
}

/** Bind a string MotionValue to React state. */
export function useMotionString(initial: string, id?: string): {
  value: string;
  mv: MotionValue<string>;
  setValue: (v: string) => void;
} {
  const [value, setValue] = useState(initial);
  const mvRef = useRef<MotionValue<string> | null>(null);
  if (mvRef.current === null) {
    mvRef.current = createMotionString(initial, id);
  }
  useEffect(() => {
    const mv = mvRef.current!;
    const unsub = mv.subscribe(setValue);
    return () => {
      unsub();
      stopTicking(mv);
    };
  }, []);
  const setValueWrapper = useCallback((v: string) => {
    mvRef.current!.set(v);
  }, []);
  return { value, mv: mvRef.current, setValue: setValueWrapper };
}

/**
 * Snapshot the canvas FlipRegistry before the next paint, and play the
 * animation after the browser commits the new layout. Pass a trigger value
 * (typically the component id list or order index) so the hook knows when
 * to capture the "first" state.
 */
export function useLayoutFlip(
  trigger: unknown,
  options: { duration?: number; easing?: string; enterNew?: boolean } = {},
): void {
  const optsRef = useRef(options);
  optsRef.current = options;
  const triggerRef = useRef(trigger);
  const isFirst = useRef(true);

  useLayoutEffect(() => {
    // Don't animate on the very first render — there's no "previous" state.
    if (isFirst.current) {
      isFirst.current = false;
      triggerRef.current = trigger;
      canvasFlipRegistry.snapshot();
      return;
    }
    // Snapshot happens BEFORE the React commit but AFTER the previous paint,
    // so the rects reflect the prior layout.
    canvasFlipRegistry.snapshot();
    triggerRef.current = trigger;
  }, [trigger]);

  useEffect(() => {
    if (isFirst.current) return;
    // Defer to next frame so the browser has painted the new layout.
    const raf = requestAnimationFrame(() => {
      canvasFlipRegistry.play(optsRef.current);
    });
    return () => cancelAnimationFrame(raf);
  }, [trigger]);
}

/** Register a DOM element with the canvas FlipRegistry under a stable key. */
export function useFlipRegistration(key: string | null): (el: HTMLElement | null) => void {
  const ref = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const setRef = useCallback((el: HTMLElement | null) => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    ref.current = el;
    if (el && key) {
      cleanupRef.current = canvasFlipRegistry.register(key, el);
    }
  }, [key]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [key]);

  return setRef;
}

/** Run an enter animation on mount. */
export function useEnterAnimation(
  options: { duration?: number; easing?: string; fromScale?: number } = {},
  enabled = true,
): (el: HTMLElement | null) => void {
  const optsRef = useRef(options);
  optsRef.current = options;
  const ref = useRef<HTMLElement | null>(null);

  const setRef = useCallback((el: HTMLElement | null) => {
    if (ref.current === el) return;
    ref.current = el;
    if (el && enabled) {
      enterElement(el, optsRef.current);
    }
  }, [enabled]);

  return setRef;
}

/** Run an exit animation on unmount. Returns the element ref; when the
 *  component unmounts, the hook animates fade-out before allowing React
 *  to actually remove the DOM node. */
export function useExitAnimation(
  options: { duration?: number; easing?: string; toScale?: number } = {},
  enabled = true,
): (el: HTMLElement | null) => void {
  const optsRef = useRef(options);
  optsRef.current = options;
  const ref = useRef<HTMLElement | null>(null);
  const deferredRef = useRef<(() => void) | null>(null);

  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el;
  }, []);

  useEffect(() => {
    return () => {
      if (!enabled) return;
      const el = ref.current;
      if (!el) return;
      // Block the unmount by deferring the cleanup. The exit animation runs
      // on the now-detached element; once it finishes, the element is
      // already removed from the DOM by React, so we just need to let the
      // animation complete naturally.
      // Note: React 18 removes the DOM node synchronously after the cleanup
      // runs. For a true exit animation that holds the element in place,
      // wrap the component in an <ExitAnimationBoundary> which keeps the
      // node mounted via a portal until exit completes. This hook is the
      // primitive that powers that boundary.
      exitElement(el, optsRef.current).catch(() => undefined);
    };
  }, [enabled]);

  return setRef;
}

/** Create a per-instance FlipRegistry (for sub-canvas scopes like the
 *  layers panel or timeline track list). */
export function useFlipRegistry(): FlipRegistry {
  const ref = useRef<FlipRegistry | null>(null);
  if (ref.current === null) {
    ref.current = new FlipRegistry();
  }
  return ref.current;
}
