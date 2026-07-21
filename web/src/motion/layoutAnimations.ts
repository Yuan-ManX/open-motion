/**
 * Layout animations — smooth transitions when DOM elements change position
 * or size due to data changes (reorder, insert, remove, resize).
 *
 * Implements the FLIP technique:
 *   First  — record the element's bounding rect before the change
 *   Last   — let the browser paint the new layout
 *   Invert — apply a transform that visually restores the old position
 *   Play   — animate the transform back to identity
 *
 * The OpenMotion canvas re-renders components whenever the project spec
 * changes (tool calls, drag operations, layer reorder). Without layout
 * animations these jumps are visible as abrupt repositioning. The
 * `useLayoutFlip` hook records positions across renders and animates
 * the transition for any element whose rect changed.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FlipEntry {
  element: HTMLElement;
  prevRect: Rect;
  // Snapshot of inline transform/opacity so we can restore after animation.
  prevTransform: string;
  prevOpacity: string;
  // Set when the element is newly mounted (no previous rect).
  isNew: boolean;
}

const FLIP_DURATION_DEFAULT = 220; // ms
const FLIP_EASING_DEFAULT = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Read the element's screen-space rect as a plain object. */
function readRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, width: r.width, height: r.height };
}

/** Compute the inverse transform that maps `last` back onto `first`. */
function inverseTransform(first: Rect, last: Rect): { translateX: number; translateY: number; scaleX: number; scaleY: number } {
  const dx = first.x - last.x;
  const dy = first.y - last.y;
  const sx = last.width > 0 ? first.width / last.width : 1;
  const sy = last.height > 0 ? first.height / last.height : 1;
  return { translateX: dx, translateY: dy, scaleX: sx, scaleY: sy };
}

/** Apply a FLIP animation to a single element. */
export function flipElement(
  element: HTMLElement,
  first: Rect,
  last: Rect,
  options: { duration?: number; easing?: string } = {},
): void {
  const { translateX, translateY, scaleX, scaleY } = inverseTransform(first, last);
  // Skip when the change is sub-pixel — animating it would create jitter.
  if (Math.abs(translateX) < 0.5 && Math.abs(translateY) < 0.5 &&
      Math.abs(scaleX - 1) < 0.01 && Math.abs(scaleY - 1) < 0.01) {
    return;
  }

  const duration = options.duration ?? FLIP_DURATION_DEFAULT;
  const easing = options.easing ?? FLIP_EASING_DEFAULT;
  const prevTransition = element.style.transition;
  const prevTransform = element.style.transform;

  // Invert: instantly apply the transform that makes the element appear in
  // its old position. transform-origin must be 0 0 so scaling pivots from
  // the top-left corner (matching the inverse translate).
  element.style.transition = "none";
  element.style.transformOrigin = "0 0";
  element.style.transform =
    `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`;

  // Force the browser to commit the inverted state before transitioning.
  // Reading layout (getBoundingClientRect) forces a reflow.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  element.getBoundingClientRect();

  // Play: animate back to the natural (no-transform) state.
  element.style.transition = `transform ${duration}ms ${easing}`;
  element.style.transform = prevTransform || "none";

  const cleanup = () => {
    element.style.transition = prevTransition;
    element.style.transformOrigin = "";
    element.removeEventListener("transitionend", cleanup);
    element.removeEventListener("transitioncancel", cleanup);
  };
  element.addEventListener("transitionend", cleanup, { once: true });
  element.addEventListener("transitioncancel", cleanup, { once: true });
}

/** Animate a newly-mounted element from opacity 0 to 1. */
export function enterElement(
  element: HTMLElement,
  options: { duration?: number; easing?: string; fromScale?: number } = {},
): void {
  const duration = options.duration ?? FLIP_DURATION_DEFAULT;
  const easing = options.easing ?? FLIP_EASING_DEFAULT;
  const fromScale = options.fromScale ?? 0.96;
  const prevTransition = element.style.transition;
  const prevTransform = element.style.transform;
  const prevOpacity = element.style.opacity;

  element.style.transition = "none";
  element.style.opacity = "0";
  element.style.transform = `${prevTransform || ""} scale(${fromScale})`.trim();
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  element.getBoundingClientRect();

  element.style.transition = `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}`;
  element.style.opacity = prevOpacity || "1";
  element.style.transform = prevTransform || "none";

  const cleanup = () => {
    element.style.transition = prevTransition;
    element.removeEventListener("transitionend", cleanup);
    element.removeEventListener("transitioncancel", cleanup);
  };
  element.addEventListener("transitionend", cleanup, { once: true });
  element.addEventListener("transitioncancel", cleanup, { once: true });
}

/** Animate an element about to be unmounted: fade + slight scale-down. Returns a Promise that
 *  resolves when the animation finishes, so the caller can remove the element after. */
export function exitElement(
  element: HTMLElement,
  options: { duration?: number; easing?: string; toScale?: number } = {},
): Promise<void> {
  return new Promise((resolve) => {
    const duration = options.duration ?? FLIP_DURATION_DEFAULT;
    const easing = options.easing ?? FLIP_EASING_DEFAULT;
    const toScale = options.toScale ?? 0.96;
    const prevTransition = element.style.transition;
    const prevTransform = element.style.transform;
    const prevOpacity = element.style.opacity;

    element.style.transition = `opacity ${duration}ms ${easing}, transform ${duration}ms ${easing}`;
    element.style.opacity = "0";
    element.style.transform = `${prevTransform || ""} scale(${toScale})`.trim();

    const cleanup = () => {
      element.style.transition = prevTransition;
      element.style.opacity = prevOpacity;
      element.style.transform = prevTransform;
      element.removeEventListener("transitionend", cleanup);
      element.removeEventListener("transitioncancel", cleanup);
      resolve();
    };
    element.addEventListener("transitionend", cleanup, { once: true });
    element.addEventListener("transitioncancel", cleanup, { once: true });
    // Safety: resolve after duration + buffer even if no event fires.
    setTimeout(cleanup, duration + 50);
  });
}

/**
 * FLIP registry — tracks the last known rect for each keyed element. The
 * caller records rects before the DOM update and reads them after the
 * browser paints to compute the inverse transform.
 */
export class FlipRegistry {
  private rects = new Map<string, Rect>();
  private elements = new Map<string, HTMLElement>();

  /** Record the current rect for each registered element. Call BEFORE the
   *  React update that will reposition them. */
  snapshot(): void {
    for (const [key, el] of this.elements) {
      this.rects.set(key, readRect(el));
    }
  }

  /** Animate every registered element from its previous rect to its current
   *  rect. Call AFTER React commits the update and the browser has painted. */
  play(options: { duration?: number; easing?: string; enterNew?: boolean } = {}): void {
    const enterNew = options.enterNew ?? true;
    for (const [key, el] of this.elements) {
      const prev = this.rects.get(key);
      const next = readRect(el);
      if (!prev) {
        if (enterNew) enterElement(el, options);
        this.rects.set(key, next);
        continue;
      }
      flipElement(el, prev, next, options);
      this.rects.set(key, next);
    }
  }

  /** Register an element under a stable key. Returns a cleanup function.
   *  Passing null unregisters the element but keeps the last known rect so
   *  a future re-mount of the same key animates from the previous position. */
  register(key: string, el: HTMLElement | null): () => void {
    if (!el) {
      // Keep the rect for exit/enter continuity — only the live element
      // reference is removed.
      this.elements.delete(key);
      return () => undefined;
    }
    this.elements.set(key, el);
    if (!this.rects.has(key)) {
      this.rects.set(key, readRect(el));
    }
    return () => {
      this.elements.delete(key);
    };
  }

  /** Forget a key entirely so its next mount won't animate from the old rect. */
  forget(key: string): void {
    this.elements.delete(key);
    this.rects.delete(key);
  }

  /** Clear all entries. */
  clear(): void {
    this.elements.clear();
    this.rects.clear();
  }

  /** Number of currently registered elements. */
  get size(): number {
    return this.elements.size;
  }
}

/** Create a singleton FlipRegistry for the canvas. The MotionCanvas component
 *  snapshots before each render and plays after the browser paints. */
export const canvasFlipRegistry = new FlipRegistry();
