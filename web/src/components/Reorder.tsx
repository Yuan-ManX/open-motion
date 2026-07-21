/**
 * Reorder — a list component that animates position changes via FLIP when
 * the order of items changes. Items can be reordered via drag-and-drop or
 * via external state changes (e.g., move up/down buttons).
 *
 * Unlike a generic drag-and-drop library, this component is agnostic to
 * the reordering trigger — it just observes the `items` prop and animates
 * any position change between renders.
 *
 * Usage:
 *   <Reorder items={layers} getKey={(l) => l.id}>
 *     {(layer) => <LayerRow layer={layer} />}
 *   </Reorder>
 *
 * The component manages its own FlipRegistry scoped to the list, so it
 * works independently of the canvas-level canvasFlipRegistry.
 */

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { FlipRegistry } from "../motion/layoutAnimations.js";

export interface ReorderProps<T> {
  items: T[];
  getKey: (item: T) => string;
  children: (item: T, index: number) => ReactNode;
  /** Animation duration in ms. Default: 220. */
  duration?: number;
  /** CSS easing for the position transition. */
  easing?: string;
  /** Whether to animate new items entering the list. Default: true. */
  enterNew?: boolean;
  /** Class name for the container element. */
  className?: string;
}

export function Reorder<T>(props: ReorderProps<T>): ReactNode {
  const {
    items,
    getKey,
    children,
    duration = 220,
    easing = "cubic-bezier(0.22, 1, 0.36, 1)",
    enterNew = true,
    className,
  } = props;

  const registryRef = useRef<FlipRegistry | null>(null);
  if (registryRef.current === null) {
    registryRef.current = new FlipRegistry();
  }
  const registry = registryRef.current;

  // Snapshot before the DOM updates.
  const trigger = items.map(getKey).join("|");
  useLayoutEffect(() => {
    registry.snapshot();
  }, [trigger, registry]);

  // Play after the browser paints the new layout.
  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => {
      registry.play({ duration, easing, enterNew });
    });
    return () => cancelAnimationFrame(raf);
  }, [trigger, registry, duration, easing, enterNew]);

  return (
    <div className={className} data-reorder-root="">
      {items.map((item, index) => {
        const key = getKey(item);
        return (
          <ReorderItem key={key} itemKey={key} registry={registry}>
            {children(item, index)}
          </ReorderItem>
        );
      })}
    </div>
  );
}

interface ReorderItemProps {
  itemKey: string;
  registry: FlipRegistry;
  children: ReactNode;
}

function ReorderItem(props: ReorderItemProps): ReactNode {
  const { itemKey, registry, children } = props;
  const setRef = (el: HTMLElement | null) => {
    registry.register(itemKey, el);
  };
  return (
    <div ref={setRef} data-reorder-item={itemKey}>
      {children}
    </div>
  );
}
