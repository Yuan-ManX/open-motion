import { useCallback } from "react";
import { useUiStore } from "../../store/uiStore.js";
import { useProjectStore } from "../../store/projectStore.js";
import * as api from "../../api/endpoints.js";
import type { MotionComponent } from "@openmotion/shared";

type AlignAction =
  | "left"
  | "center-h"
  | "right"
  | "top"
  | "middle-v"
  | "bottom"
  | "distribute-h"
  | "distribute-v";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

function parsePx(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

function getBox(style: Record<string, string | number> | undefined): Box {
  const s = style ?? {};
  return {
    left: parsePx(s.left),
    top: parsePx(s.top),
    width: parsePx(s.width, 100),
    height: parsePx(s.height, 100),
  };
}

const BUTTONS: { action: AlignAction; icon: string; label: string }[] = [
  { action: "left", icon: "⫛◀", label: "Align left" },
  { action: "center-h", icon: "↔", label: "Align center horizontally" },
  { action: "right", icon: "▶⫛", label: "Align right" },
  { action: "top", icon: "⫛▲", label: "Align top" },
  { action: "middle-v", icon: "↕", label: "Align middle vertically" },
  { action: "bottom", icon: "▼⫛", label: "Align bottom" },
  { action: "distribute-h", icon: "⇠▶⇢", label: "Distribute horizontally" },
  { action: "distribute-v", icon: "⇡▲⇣", label: "Distribute vertically" },
];

export function AlignmentToolbar() {
  const selectedIds = useUiStore((s) => s.selectedIds);
  const components = useProjectStore((s) => s.components);
  const projectId = useProjectStore((s) => s.projectId);
  const loadProject = useProjectStore((s) => s.loadProject);

  const handleAlign = useCallback(
    async (action: AlignAction) => {
      if (!projectId || selectedIds.size < 2) return;
      const targets = components.filter((c) => selectedIds.has(c.id));
      if (targets.length < 2) return;

      const boxes = targets.map((c) => ({
        id: c.id,
        box: getBox(c.style as Record<string, string | number> | undefined),
        comp: c,
      }));

      const patches: { id: string; style: Record<string, string | number> }[] = [];

      if (action === "left") {
        const minLeft = Math.min(...boxes.map((b) => b.box.left));
        boxes.forEach((b) => {
          patches.push({ id: b.id, style: { ...b.comp.style, left: minLeft } });
        });
      } else if (action === "right") {
        const maxRight = Math.max(...boxes.map((b) => b.box.left + b.box.width));
        boxes.forEach((b) => {
          patches.push({ id: b.id, style: { ...b.comp.style, left: maxRight - b.box.width } });
        });
      } else if (action === "center-h") {
        const minLeft = Math.min(...boxes.map((b) => b.box.left));
        const maxRight = Math.max(...boxes.map((b) => b.box.left + b.box.width));
        const center = (minLeft + maxRight) / 2;
        boxes.forEach((b) => {
          patches.push({ id: b.id, style: { ...b.comp.style, left: center - b.box.width / 2 } });
        });
      } else if (action === "top") {
        const minTop = Math.min(...boxes.map((b) => b.box.top));
        boxes.forEach((b) => {
          patches.push({ id: b.id, style: { ...b.comp.style, top: minTop } });
        });
      } else if (action === "bottom") {
        const maxBottom = Math.max(...boxes.map((b) => b.box.top + b.box.height));
        boxes.forEach((b) => {
          patches.push({ id: b.id, style: { ...b.comp.style, top: maxBottom - b.box.height } });
        });
      } else if (action === "middle-v") {
        const minTop = Math.min(...boxes.map((b) => b.box.top));
        const maxBottom = Math.max(...boxes.map((b) => b.box.top + b.box.height));
        const middle = (minTop + maxBottom) / 2;
        boxes.forEach((b) => {
          patches.push({ id: b.id, style: { ...b.comp.style, top: middle - b.box.height / 2 } });
        });
      } else if (action === "distribute-h") {
        const sorted = [...boxes].sort((a, b) => a.box.left - b.box.left);
        const firstLeft = sorted[0].box.left;
        const lastRight = sorted[sorted.length - 1].box.left + sorted[sorted.length - 1].box.width;
        const totalWidth = sorted.reduce((sum, b) => sum + b.box.width, 0);
        const gap = sorted.length > 1 ? (lastRight - firstLeft - totalWidth) / (sorted.length - 1) : 0;
        let cursor = firstLeft;
        sorted.forEach((b) => {
          patches.push({ id: b.id, style: { ...b.comp.style, left: cursor } });
          cursor += b.box.width + gap;
        });
      } else if (action === "distribute-v") {
        const sorted = [...boxes].sort((a, b) => a.box.top - b.box.top);
        const firstTop = sorted[0].box.top;
        const lastBottom = sorted[sorted.length - 1].box.top + sorted[sorted.length - 1].box.height;
        const totalHeight = sorted.reduce((sum, b) => sum + b.box.height, 0);
        const gap = sorted.length > 1 ? (lastBottom - firstTop - totalHeight) / (sorted.length - 1) : 0;
        let cursor = firstTop;
        sorted.forEach((b) => {
          patches.push({ id: b.id, style: { ...b.comp.style, top: cursor } });
          cursor += b.box.height + gap;
        });
      }

      await Promise.all(
        patches.map((p) => api.patchComponent(projectId, p.id, { style: p.style } as Partial<MotionComponent>)),
      );
      await loadProject(projectId);
    },
    [projectId, selectedIds, components, loadProject],
  );

  if (selectedIds.size < 2) return null;

  return (
    <div
      className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-0.5 px-1.5 py-1 bg-panel border border-edge rounded-lg shadow-xl"
      style={{ pointerEvents: "auto" }}
    >
      <span className="text-[9px] uppercase tracking-wide text-gray-600 mr-1">Align</span>
      {BUTTONS.map((btn) => (
        <button
          key={btn.action}
          onClick={() => void handleAlign(btn.action)}
          className="w-7 h-7 flex items-center justify-center text-[11px] text-gray-400 hover:text-accent hover:bg-panel2 rounded transition-colors"
          title={btn.label}
          aria-label={btn.label}
        >
          {btn.icon}
        </button>
      ))}
    </div>
  );
}
