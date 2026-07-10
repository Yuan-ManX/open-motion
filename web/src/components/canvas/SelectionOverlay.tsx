import { useCallback, useRef, useEffect, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";
import type { MotionComponent } from "@openmotion/shared";
import type { SmartGuide } from "../../store/uiStore.js";

type HandleId = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotate";

const MIN_SIZE = 20;
const SNAP_THRESHOLD = 5;
const ROTATE_HANDLE_OFFSET = 24;

function parsePx(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

function snapVal(v: number, snapSize: number, enabled: boolean): number {
  return enabled ? Math.round(v / snapSize) * snapSize : v;
}

/** Compute smart alignment guides for the dragged component against siblings and artboard. */
function computeGuides(
  draggedId: string,
  box: { left: number; top: number; width: number; height: number },
  components: MotionComponent[],
  canvasW: number,
  canvasH: number,
): { snapDx: number; snapDy: number; guides: SmartGuide[] } {
  const guides: SmartGuide[] = [];
  let snapDx = 0;
  let snapDy = 0;

  const draggedEdges = {
    left: box.left,
    centerX: box.left + box.width / 2,
    right: box.left + box.width,
    top: box.top,
    centerY: box.top + box.height / 2,
    bottom: box.top + box.height,
  };

  const targets: { left: number; centerX: number; right: number; top: number; centerY: number; bottom: number }[] = [];
  for (const c of components) {
    if (c.id === draggedId) continue;
    const s = c.style as Record<string, string | number> | undefined;
    const cl = parsePx(s?.left);
    const ct = parsePx(s?.top);
    const cw = parsePx(s?.width, 100);
    const ch = parsePx(s?.height, 100);
    targets.push({
      left: cl,
      centerX: cl + cw / 2,
      right: cl + cw,
      top: ct,
      centerY: ct + ch / 2,
      bottom: ct + ch,
    });
  }
  // Artboard edges
  targets.push({ left: 0, centerX: canvasW / 2, right: canvasW, top: 0, centerY: canvasH / 2, bottom: canvasH });

  // X-axis snapping
  let bestXDist = SNAP_THRESHOLD + 1;
  let bestXGuide: SmartGuide | null = null;
  let bestXTarget = 0;
  for (const dEdge of [draggedEdges.left, draggedEdges.centerX, draggedEdges.right]) {
    for (const t of targets) {
      for (const tEdge of [t.left, t.centerX, t.right]) {
        const dist = Math.abs(dEdge - tEdge);
        if (dist < bestXDist) {
          bestXDist = dist;
          bestXTarget = tEdge;
          snapDx = tEdge - dEdge;
        }
      }
    }
  }
  if (bestXDist <= SNAP_THRESHOLD) {
    // Find the vertical extent of the guide
    let minTop = Math.min(box.top, ...targets.map((t) => t.top));
    let maxBottom = Math.max(box.top + box.height, ...targets.map((t) => t.bottom));
    bestXGuide = { axis: "x", position: bestXTarget, start: minTop - 10, length: maxBottom - minTop + 20 };
    guides.push(bestXGuide);
  } else {
    snapDx = 0;
  }

  // Y-axis snapping
  let bestYDist = SNAP_THRESHOLD + 1;
  let bestYGuide: SmartGuide | null = null;
  let bestYTarget = 0;
  for (const dEdge of [draggedEdges.top, draggedEdges.centerY, draggedEdges.bottom]) {
    for (const t of targets) {
      for (const tEdge of [t.top, t.centerY, t.bottom]) {
        const dist = Math.abs(dEdge - tEdge);
        if (dist < bestYDist) {
          bestYDist = dist;
          bestYTarget = tEdge;
          snapDy = tEdge - dEdge;
        }
      }
    }
  }
  if (bestYDist <= SNAP_THRESHOLD) {
    let minLeft = Math.min(box.left, ...targets.map((t) => t.left));
    let maxRight = Math.max(box.left + box.width, ...targets.map((t) => t.right));
    bestYGuide = { axis: "y", position: bestYTarget, start: minLeft - 10, length: maxRight - minLeft + 20 };
    guides.push(bestYGuide);
  } else {
    snapDy = 0;
  }

  return { snapDx, snapDy, guides };
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
    </div>
  );
}
