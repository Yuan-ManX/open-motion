/** Smart alignment guide computation shared by canvas drag handlers. */

import type { MotionComponent } from "@openmotion/shared";
import type { SmartGuide } from "../store/uiStore.js";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function parsePx(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

/**
 * Compute smart alignment guides for a dragged box against sibling components
 * and the artboard edges. Returns the snap delta to apply and the guide lines
 * to render. Snaps left/center/right on X and top/center/bottom on Y.
 */
export function computeGuides(
  draggedId: string | null,
  box: Box,
  components: MotionComponent[],
  canvasW: number,
  canvasH: number,
  threshold = 5,
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
  let bestXDist = threshold + 1;
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
  if (bestXDist <= threshold) {
    const minTop = Math.min(box.top, ...targets.map((t) => t.top));
    const maxBottom = Math.max(box.top + box.height, ...targets.map((t) => t.bottom));
    guides.push({ axis: "x", position: bestXTarget, start: minTop - 10, length: maxBottom - minTop + 20 });
  } else {
    snapDx = 0;
  }

  // Y-axis snapping
  let bestYDist = threshold + 1;
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
  if (bestYDist <= threshold) {
    const minLeft = Math.min(box.left, ...targets.map((t) => t.left));
    const maxRight = Math.max(box.left + box.width, ...targets.map((t) => t.right));
    guides.push({ axis: "y", position: bestYTarget, start: minLeft - 10, length: maxRight - minLeft + 20 });
  } else {
    snapDy = 0;
  }

  return { snapDx, snapDy, guides };
}
