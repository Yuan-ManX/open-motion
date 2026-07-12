import { useMemo } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";

function parsePx(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

const MINIMAP_SIZE = 120;

/**
 * Canvas minimap — shows a scaled overview of all components and the current viewport.
 * Click to navigate. Renders in the bottom-right corner of the canvas area.
 */
export function CanvasMinimap() {
  const components = useProjectStore((s) => s.components);
  const projectId = useProjectStore((s) => s.projectId);
  const canvasSize = useUiStore((s) => s.canvasSize);
  const canvasZoom = useUiStore((s) => s.canvasZoom);
  const canvasPan = useUiStore((s) => s.canvasPan);
  const setCanvasPan = useUiStore((s) => s.setCanvasPan);
  const selectedId = useUiStore((s) => s.selectedComponentId);

  const { scale, offsetX, offsetY } = useMemo(() => {
    const maxDim = Math.max(canvasSize.width, canvasSize.height, 800);
    const s = MINIMAP_SIZE / maxDim;
    return {
      scale: s,
      offsetX: 0,
      offsetY: 0,
    };
  }, [canvasSize]);

  if (!projectId || components.length === 0) return null;

  // Estimate viewport bounds (canvas viewport is ~600x400 at zoom 1)
  const viewportW = 600 / canvasZoom;
  const viewportH = 400 / canvasZoom;
  const viewportX = -canvasPan.x / canvasZoom;
  const viewportY = -canvasPan.y / canvasZoom;

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    // Center the viewport on the clicked point
    setCanvasPan({
      x: -(x - viewportW / 2) * canvasZoom,
      y: -(y - viewportH / 2) * canvasZoom,
    });
  };

  return (
    <div
      className="absolute bottom-2 right-2 z-40 bg-panel/90 border border-edge rounded-md overflow-hidden pointer-events-auto"
      style={{ width: `${MINIMAP_SIZE}px`, height: `${MINIMAP_SIZE}px` }}
    >
      <div
        className="relative w-full h-full cursor-pointer"
        onClick={handleClick}
        title="Click to navigate"
      >
        {/* Artboard background */}
        <div
          className="absolute bg-edge/30 border border-edge/50"
          style={{
            left: `${offsetX}px`,
            top: `${offsetY}px`,
            width: `${canvasSize.width * scale}px`,
            height: `${canvasSize.height * scale}px`,
          }}
        />

        {/* Components */}
        {components.map((c) => {
          const left = parsePx(c.style.left);
          const top = parsePx(c.style.top);
          const width = parsePx(c.style.width, 50);
          const height = parsePx(c.style.height, 50);
          const isSelected = c.id === selectedId;

          return (
            <div
              key={c.id}
              className={`absolute ${isSelected ? "border border-white" : "border border-gray-600"}`}
              style={{
                left: `${(left + offsetX) * scale}px`,
                top: `${(top + offsetY) * scale}px`,
                width: `${Math.max(2, width * scale)}px`,
                height: `${Math.max(2, height * scale)}px`,
                backgroundColor: isSelected ? "rgba(255,255,255,0.3)" : "rgba(128,128,128,0.2)",
              }}
            />
          );
        })}

        {/* Viewport rectangle */}
        <div
          className="absolute border border-white/60 pointer-events-none"
          style={{
            left: `${(viewportX + offsetX) * scale}px`,
            top: `${(viewportY + offsetY) * scale}px`,
            width: `${viewportW * scale}px`,
            height: `${viewportH * scale}px`,
          }}
        />
      </div>
    </div>
  );
}
