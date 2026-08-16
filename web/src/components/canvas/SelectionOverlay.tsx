import { useCallback, useRef, useEffect, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";
import type { MotionComponent } from "@openmotion/shared";
import { computeGuides, parsePx } from "../../motion/smartGuides.js";

type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotate" | "body";

const MIN_SIZE = 20;
const ROTATE_HANDLE_OFFSET = 24;

function snapVal(v: number, snapSize: number, enabled: boolean): number {
  return enabled ? Math.round(v / snapSize) * snapSize : v;
}

const HANDLE_CURSORS: Record<HandleId, string> = {
  nw: "nwse-resize",
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
  rotate: "grab",
  body: "move",
};

export function SelectionOverlay() {
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const components = useProjectStore((s) => s.components);
  const projectId = useProjectStore((s) => s.projectId);
  const loadProject = useProjectStore((s) => s.loadProject);
  const updateComponentLive = useProjectStore((s) => s.updateComponentLive);
  const patchComponentLocal = useProjectStore((s) => s.patchComponentLocal);
  const canvasZoom = useUiStore((s) => s.canvasZoom);
  const snapToGrid = useUiStore((s) => s.snapToGrid);
  const snapSize = useUiStore((s) => s.snapSize);
  const canvasSize = useUiStore((s) => s.canvasSize);
  const setSmartGuides = useUiStore((s) => s.setSmartGuides);

  const [dragState, setDragState] = useState<{
    handle: HandleId;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    origWidth: number;
    origHeight: number;
    origRotate: number;
  } | null>(null);

  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  const component = selectedId ? components.find((c) => c.id === selectedId) : null;
  if (!component || !selectedId) return null;

  const style = component.style as Record<string, string | number> | undefined;
  const left = parsePx(style?.left);
  const top = parsePx(style?.top);
  const width = parsePx(style?.width, 100);
  const height = parsePx(style?.height, 100);
  const rotate = parsePx(style?.rotate, 0);

  const startDrag = useCallback(
    (e: React.MouseEvent, handle: HandleId) => {
      e.stopPropagation();
      e.preventDefault();
      if (!selectedId) return;
      // Push one history snapshot at drag start
      patchComponentLocal(selectedId, {});
      setDragState({
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: left,
        origTop: top,
        origWidth: width,
        origHeight: height,
        origRotate: rotate,
      });
      document.body.style.cursor = HANDLE_CURSORS[handle];
      document.body.style.userSelect = "none";
    },
    [selectedId, left, top, width, height, rotate, patchComponentLocal],
  );

  useEffect(() => {
    if (!dragState || !selectedId) return;

    const onMouseMove = (e: MouseEvent) => {
      const ds = dragStateRef.current;
      if (!ds || !selectedId) return;
      const dx = (e.clientX - ds.startX) / canvasZoom;
      const dy = (e.clientY - ds.startY) / canvasZoom;
      const patch: Record<string, string | number> = {};

      if (ds.handle === "rotate") {
        const comp = useProjectStore.getState().components.find((c) => c.id === selectedId);
        if (!comp) return;
        const s = comp.style as Record<string, string | number> | undefined;
        const cl = parsePx(s?.left);
        const ct = parsePx(s?.top);
        const cw = parsePx(s?.width, 100);
        const ch = parsePx(s?.height, 100);
        const cx = cl + cw / 2;
        const cy = ct + ch / 2;
        // Get canvas element to adjust for zoom/pan
        const canvasEl = document.querySelector("[data-om-canvas]") as HTMLElement | null;
        let screenCx = cx;
        let screenCy = cy;
        if (canvasEl) {
          const rect = canvasEl.getBoundingClientRect();
          screenCx = rect.left + (cx + 0) * canvasZoom;
          screenCy = rect.top + (cy + 0) * canvasZoom;
        }
        const angle = (Math.atan2(e.clientY - screenCy, e.clientX - screenCx) * 180) / Math.PI + 90;
        const snapped = snapToGrid ? Math.round(angle / 15) * 15 : Math.round(angle);
        patch.rotate = snapped;
        updateComponentLive(selectedId, patch);
        return;
      }

      let newLeft = ds.origLeft;
      let newTop = ds.origTop;
      let newWidth = ds.origWidth;
      let newHeight = ds.origHeight;

      if (ds.handle.includes("w")) {
        newLeft = ds.origLeft + dx;
        newWidth = ds.origWidth - dx;
        if (newWidth < MIN_SIZE) {
          newLeft = ds.origLeft + ds.origWidth - MIN_SIZE;
          newWidth = MIN_SIZE;
        }
      }
      if (ds.handle.includes("e")) {
        newWidth = ds.origWidth + dx;
        if (newWidth < MIN_SIZE) newWidth = MIN_SIZE;
      }
      if (ds.handle.includes("n")) {
        newTop = ds.origTop + dy;
        newHeight = ds.origHeight - dy;
        if (newHeight < MIN_SIZE) {
          newTop = ds.origTop + ds.origHeight - MIN_SIZE;
          newHeight = MIN_SIZE;
        }
      }
      if (ds.handle.includes("s")) {
        newHeight = ds.origHeight + dy;
        if (newHeight < MIN_SIZE) newHeight = MIN_SIZE;
      }

      // Snap to grid
      if (snapToGrid) {
        newLeft = snapVal(newLeft, snapSize, true);
        newTop = snapVal(newTop, snapSize, true);
        newWidth = snapVal(newWidth, snapSize, true);
        newHeight = snapVal(newHeight, snapSize, true);
      }

      // Smart guides for move (body drag)
      if (ds.handle === "body") {
        const guideResult = computeGuides(
          selectedId,
          { left: newLeft, top: newTop, width: newWidth, height: newHeight },
          useProjectStore.getState().components,
          canvasSize.width,
          canvasSize.height,
        );
        newLeft += guideResult.snapDx;
        newTop += guideResult.snapDy;
        setSmartGuides(guideResult.guides);
      }

      patch.left = newLeft;
      patch.top = newTop;
      patch.width = newWidth;
      patch.height = newHeight;
      updateComponentLive(selectedId, patch);
    };

    const onMouseUp = async () => {
      const ds = dragStateRef.current;
      setDragState(null);
      setSmartGuides([]);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (ds && selectedId && projectId) {
        const comp = useProjectStore.getState().components.find((c) => c.id === selectedId);
        if (comp) {
          try {
            await api.patchComponent(projectId, selectedId, {
              style: comp.style,
            } as Partial<MotionComponent>);
            await loadProject(projectId);
          } catch {
            /* ignore */
          }
        }
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragState, selectedId, projectId, canvasZoom, snapToGrid, snapSize, canvasSize, updateComponentLive, loadProject, setSmartGuides]);

  const handles: { id: HandleId; x: number; y: number }[] = [
    { id: "nw", x: left, y: top },
    { id: "n", x: left + width / 2, y: top },
    { id: "ne", x: left + width, y: top },
    { id: "e", x: left + width, y: top + height / 2 },
    { id: "se", x: left + width, y: top + height },
    { id: "s", x: left + width / 2, y: top + height },
    { id: "sw", x: left, y: top + height },
    { id: "w", x: left, y: top + height / 2 },
  ];

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        zIndex: 50,
      }}
    >
      {/* Selection border */}
      <div
        className="absolute border border-white pointer-events-none"
        style={{
          left,
          top,
          width,
          height,
          transform: rotate ? `rotate(${rotate}deg)` : undefined,
          transformOrigin: "center center",
        }}
      />
      {/* Drag body overlay (transparent, captures move drags) */}
      <div
        className="absolute pointer-events-auto cursor-move"
        style={{
          left,
          top,
          width,
          height,
          transform: rotate ? `rotate(${rotate}deg)` : undefined,
          transformOrigin: "center center",
        }}
        onMouseDown={(e) => startDrag(e, "body")}
      />
      {/* Resize handles */}
      {handles.map((h) => (
        <div
          key={h.id}
          className="absolute w-2 h-2 bg-white border border-black pointer-events-auto"
          style={{
            left: h.x - 4,
            top: h.y - 4,
            cursor: HANDLE_CURSORS[h.id],
            transform: rotate ? `rotate(${rotate}deg)` : undefined,
            transformOrigin: "center center",
          }}
          onMouseDown={(e) => startDrag(e, h.id)}
        />
      ))}
      {/* Rotation handle */}
      <div
        className="absolute pointer-events-auto"
        style={{
          left: left + width / 2 - 5,
          top: top - ROTATE_HANDLE_OFFSET,
        }}
        onMouseDown={(e) => startDrag(e, "rotate")}
      >
        <div
          className="absolute left-1/2 top-full w-px bg-white/50"
          style={{ height: ROTATE_HANDLE_OFFSET - 8 }}
        />
        <div
          className="w-2.5 h-2.5 rounded-full bg-white border border-black cursor-grab"
        />
      </div>
      {/* Dimension readout — appears below the selection while dragging.
          Shows live W×H so the user can hit a target size without
          switching to the inspector. Hidden when idle to avoid clutter. */}
      {dragState && dragState.handle !== "rotate" && (
        <div
          className="absolute pointer-events-none font-mono text-[10px] text-black bg-white px-1.5 py-0.5 rounded"
          style={{
            left: left + width / 2 - 28,
            top: top + height + 6,
            minWidth: 56,
            textAlign: "center",
          }}
        >
          {Math.round(width)}×{Math.round(height)}
        </div>
      )}
    </div>
  );
}
