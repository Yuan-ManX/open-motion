/**
 * AnimatePresence — animates children enter and exit transitions.
 *
 * When a child mounts, it plays an enter animation (fade + scale up).
 * When a child unmounts, the component is held in place via a portal
 * while the exit animation plays, then removed from the DOM.
 *
 * Children are matched by their `key` prop. Each child must be a direct
 * element with a unique key for AnimatePresence to track it.
 *
 * The implementation avoids React Portal complexity by keeping a
 * "pending exit" map of elements that should animate out. The parent
 * renders the live children plus any exiting children, with the exiting
 * ones positioned absolutely so they don't affect layout.
 */

import { useEffect, useRef, useState, useCallback, Children, isValidElement, cloneElement, type ReactNode, type ReactElement } from "react";
import { enterElement, exitElement } from "../motion/layoutAnimations.js";

export interface AnimatePresenceProps {
  children: ReactNode;
  /** Duration of enter/exit animations in ms. */
  duration?: number;
  /** Easing function as a CSS cubic-bezier string. */
  easing?: string;
  /** Initial scale for enter animation (1 = no scale). */
  enterFromScale?: number;
  /** Target scale for exit animation. */
  exitToScale?: number;
  /** Whether to animate the initial mount of all children. Default: false. */
  initial?: boolean;
}

interface ExitingChild {
  key: string;
  element: ReactElement;
  node: HTMLElement | null;
}

/**
 * Track child elements by key. When a key disappears from the children
 * list, hold the last known element in state and animate it out before
 * removing it from the DOM.
 */
export function AnimatePresence(props: AnimatePresenceProps): ReactNode {
  const {
    children,
    duration = 220,
    easing = "cubic-bezier(0.22, 1, 0.36, 1)",
    enterFromScale = 0.96,
    exitToScale = 0.96,
    initial = false,
  } = props;

  const childArray = Children.toArray(children).filter(isValidElement) as ReactElement[];
  const childKeys = new Set(childArray.map((c) => String(c.key ?? "")));

  const [exiting, setExiting] = useState<ExitingChild[]>([]);
  const exitingRef = useRef<ExitingChild[]>([]);
  const previousKeys = useRef<Set<string>>(new Set());
  const isFirstRender = useRef(true);

  // Detect removed children and add them to the exiting list.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = !initial;
      previousKeys.current = new Set(childKeys);
      return;
    }

    const removed: string[] = [];
    for (const key of previousKeys.current) {
      if (!childKeys.has(key)) removed.push(key);
    }
    if (removed.length > 0) {
      // Find the last rendered element for each removed key. We rely on the
      // previous render's children — which we don't have directly, so we
      // look up from the exitingRef map (populated by the ref callback).
      const newExiting: ExitingChild[] = removed.map((key) => {
        const existing = exitingRef.current.find((e) => e.key === key);
        return existing ?? { key, element: <div key={key} />, node: null };
      });
      exitingRef.current = [...exitingRef.current, ...newExiting];
      setExiting(exitingRef.current);

      // Start the exit animation on each node.
      for (const ex of newExiting) {
        if (ex.node) {
          exitElement(ex.node, { duration, easing, toScale: exitToScale }).then(() => {
            exitingRef.current = exitingRef.current.filter((e) => e.key !== ex.key);
            setExiting(exitingRef.current);
          });
        } else {
          // No node to animate — remove immediately.
          exitingRef.current = exitingRef.current.filter((e) => e.key !== ex.key);
          setExiting(exitingRef.current);
        }
      }
    }
    previousKeys.current = new Set(childKeys);
  }, [childKeys, duration, easing, exitToScale, initial]);

  // Register exiting element nodes via ref callback.
  const registerExiting = useCallback((key: string) => (el: HTMLElement | null) => {
    const entry = exitingRef.current.find((e) => e.key === key);
    if (entry) {
      entry.node = el;
    }
  }, []);

  // Run enter animation on newly-mounted live children.
  const liveEnterRefs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const enterOptions = { duration, easing, fromScale: enterFromScale };

  for (const child of childArray) {
    const key = String(child.key ?? "");
    if (!liveEnterRefs.current.has(key)) {
      const ref = (el: HTMLElement | null) => {
        if (el) {
          enterElement(el, enterOptions);
        }
      };
      liveEnterRefs.current.set(key, ref);
    }
  }
  // Clean up refs for removed live children.
  for (const key of liveEnterRefs.current.keys()) {
    if (!childKeys.has(key)) {
      liveEnterRefs.current.delete(key);
    }
  }

  return (
    <>
      {childArray.map((child) => {
        const key = String(child.key ?? "");
        const enterRef = liveEnterRefs.current.get(key);
        return cloneElement(child, { ref: enterRef, key });
      })}
      {exiting.map((ex) => (
        <div
          key={`exiting-${ex.key}`}
          ref={registerExiting(ex.key)}
          style={{ position: "absolute", pointerEvents: "none" }}
          aria-hidden="true"
        >
          {ex.element}
        </div>
      ))}
    </>
  );
}
