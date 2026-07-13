import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";
import type { MotionComponent } from "@openmotion/shared";

function parsePx(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

interface ComponentBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Multi-select transform gizmo — renders a bounding box around all selected
 * components and supports dragging them as a group. Shown when more than one
 * component is selected. Renders inside the canvas div (which already has
 * pan/zoom transform), so raw canvas coordinates are used and handle sizes
 * are scaled by 1/zoom to stay constant on screen.
 */
export function MultiSelectGizmo() {
  const selectedIds = useUiStore((s) => s.selectedIds);
  const components = useProjectStore((s) => s.components);
  const projectId = useProjectStore((s) => s.projectId);
  const loadProject = useProjectStore((s) => s.loadProject);
  const updateComponentLive = useProjectStore((s) => s.updateComponentLive);
  const canvasZoom = useUiStore((s) => s.canvasZoom);
  const snapToGrid = useUiStore((s) => s.snapToGrid);
  const snapSize = useUiStore((s) => s.snapSize);

  const [dragStart, setDragStart] = useState<{
    mouseX: number;
    mouseY: number;
    origBoxes: ComponentBox[];
  } | null>(null);

  const dragStartRef = useRef(dragStart);
  dragStartRef.current = dragStart;

  // Compute bounding boxes for all selected components.
  const boxes: ComponentBox[] = [];
  for (const id of selectedIds) {
    const comp = components.find((c) => c.id === id);
    if (!comp) continue;
    const s = comp.style as Record<string, string | number> | undefined;
    boxes.push({
      id,
      left: parsePx(s?.left),
      top: parsePx(s?.top),
      width: parsePx(s?.width, 100),
      height: parsePx(s?.height, 100),
    });
  }

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (boxes.length === 0) return;
      setDragStart({
        mouseX: e.clientX,
        mouseY: e.clientY,
        origBoxes: boxes.map((b) => ({ ...b })),
      });
      document.body.style.cursor = "move";
      document.body.style.userSelect = "none";
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedIds, components],
  );

  useEffect(() => {
    if (!dragStart) return;

    const onMouseMove = (e: MouseEvent) => {
      const ds = dragStartRef.current;
      if (!ds) return;
      let dx = (e.clientX - ds.mouseX) / canvasZoom;
      let dy = (e.clientY - ds.mouseY) / canvasZoom;
      if (snapToGrid) {
        dx = Math.round(dx / snapSize) * snapSize;
        dy = Math.round(dy / snapSize) * snapSize;
      }
      for (const orig of ds.origBoxes) {
        updateComponentLive(orig.id, {
          left: orig.left + dx,
          top: orig.top + dy,
        });
      }
    };

    const onMouseUp = async () => {
      const ds = dragStartRef.current;
      setDragStart(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (!ds || !projectId) return;
      // Persist all moved components to the backend.
      const currentComps = useProjectStore.getState().components;
      for (const orig of ds.origBoxes) {
        const comp = currentComps.find((c) => c.id === orig.id) as MotionComponent | undefined;
        if (comp) {
          try {
            await api.patchComponent(projectId, orig.id, {
              style: comp.style,
            } as Partial<MotionComponent>);
          } catch {
            /* ignore individual failures */
          }
        }
      }
      void loadProject(projectId);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragStart, projectId, canvasZoom, snapToGrid, snapSize, updateComponentLive, loadProject]);

  if (boxes.length < 2) return null;

  // Compute the combined bounding box.
  const minX = Math.min(...boxes.map((b) => b.left));
  const minY = Math.min(...boxes.map((b) => b.top));
  const maxX = Math.max(...boxes.map((b) => b.left + b.width));
  const maxY = Math.max(...boxes.map((b) => b.top + b.height));
  const bw = maxX - minX;
  const bh = maxY - minY;

  const handleScale = 1 / canvasZoom;
  const handleSize = 8 * handleScale;
  const borderWidth = Math.max(1 / canvasZoom, 1 / canvasZoom);

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: 0, top: 0, width: "100%", height: "100%", zIndex: 48 }}
    >
      {/* Bounding box border */}
      <div
        className="absolute border border-white pointer-events-none"
        style={{
          left: minX,
          top: minY,
          width: bw,
          height: bh,
          borderWidth,
        }}
      />
      {/* Individual component outlines (lighter) */}
      {boxes.map((b) => (
        <div
          key={b.id}
          className="absolute border border-white/40 pointer-events-none"
          style={{
            left: b.left,
            top: b.top,
            width: b.width,
            height: b.height,
            borderWidth,
          }}
        />
      ))}
      {/* Drag body overlay — captures group move drags */}
      <div
        className="absolute pointer-events-auto cursor-move"
        style={{
          left: minX,
          top: minY,
          width: bw,
          height: bh,
        }}
        onMouseDown={startDrag}
      />
      {/* Corner handles (visual only — resize not supported for groups) */}
      {[
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ].map((corner, i) => (
        <div
          key={i}
          className="absolute bg-white border border-black pointer-events-none"
          style={{
            left: corner.x - handleSize / 2,
            top: corner.y - handleSize / 2,
            width: handleSize,
            height: handleSize,
          }}
        />
      ))}
      {/* Count badge */}
      <div
        className="absolute bg-white text-black font-mono font-semibold pointer-events-none flex items-center justify-center"
        style={{
          left: minX,
          top: minY - 20 * handleScale,
          height: 16 * handleScale,
          padding: `0 ${4 * handleScale}px`,
          fontSize: 10 * handleScale,
          borderRadius: 2 * handleScale,
        }}
      >
        {boxes.length}
      </div>
    </div>
  );
}
