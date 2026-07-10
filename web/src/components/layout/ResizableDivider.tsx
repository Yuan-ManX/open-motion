import { useCallback, useEffect, useRef } from "react";

interface ResizableDividerProps {
  /** Current size in pixels of the panel being resized. */
  size: number;
  /** Callback fired with the new size during drag. */
  onResize: (size: number) => void;
  /** Minimum size in pixels. */
  min: number;
  /** Maximum size in pixels. */
  max: number;
  /** Layout direction — "horizontal" divides left/right, "vertical" divides top/bottom. */
  orientation?: "horizontal" | "vertical";
  /** Which side the resized panel is on. "left" = drag right to grow, "right" = drag left to grow. */
  side?: "left" | "right";
}

/**
 * A thin drag handle that resizes the adjacent panel. Uses pointer events
 * for smooth dragging and a global overlay to capture the cursor outside
 * the handle bounds.
 */
export function ResizableDivider({
  size,
  onResize,
  min,
  max,
  orientation = "horizontal",
  side = "left",
}: ResizableDividerProps) {
  const draggingRef = useRef(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(size);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      startPosRef.current = orientation === "horizontal" ? e.clientX : e.clientY;
      startSizeRef.current = size;
      document.body.style.cursor = orientation === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [size, orientation],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const pos = orientation === "horizontal" ? e.clientX : e.clientY;
      const rawDelta = pos - startPosRef.current;
      const delta = side === "right" ? -rawDelta : rawDelta;
      const next = Math.round(startSizeRef.current + delta);
      onResize(Math.max(min, Math.min(max, next)));
    };

    const onMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onResize, min, max, orientation, side]);

  if (orientation === "vertical") {
    return (
      <div
        onMouseDown={onMouseDown}
        className="h-1 bg-edge hover:bg-accent cursor-row-resize flex-shrink-0 transition-colors group relative"
        role="separator"
        aria-orientation="horizontal"
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 group-hover:bg-accent/10" />
      </div>
    );
  }

  return (
    <div
      onMouseDown={onMouseDown}
      className="w-px bg-edge hover:bg-accent cursor-col-resize flex-shrink-0 transition-colors group relative"
      role="separator"
      aria-orientation="vertical"
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-3 group-hover:bg-accent/10" />
    </div>
  );
}
