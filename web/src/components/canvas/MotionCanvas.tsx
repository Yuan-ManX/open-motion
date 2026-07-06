import { useMemo, useState, useEffect, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { renderSpec } from "../../motion/cssRenderer.js";

const MIN_DIM = 64;
const MAX_DIM = 4096;

export function MotionCanvas() {
  const components = useProjectStore((s) => s.components);
  const loading = useProjectStore((s) => s.loading);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const triggerReplay = useUiStore((s) => s.triggerReplay);
  const replayTrigger = useUiStore((s) => s.replayTrigger);
  const hiddenIds = useUiStore((s) => s.hiddenIds);
  const canvasSize = useUiStore((s) => s.canvasSize);
  const setCanvasSize = useUiStore((s) => s.setCanvasSize);
  const CANVAS_W = canvasSize.width;
  const CANVAS_H = canvasSize.height;

  const visibleComponents = components.filter((c) => !hiddenIds.has(c.id));
  const [replayKey, setReplayKey] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);

  useEffect(() => {
    setReplayKey((k) => k + 1);
  }, [replayTrigger]);

  const { css, nodes } = useMemo(() => renderSpec(visibleComponents), [visibleComponents, replayKey]);

  const totalDuration = visibleComponents.reduce(
    (max, c) =>
      Math.max(
        max,
        c.delayMs +
          c.durationMs * (c.iterationCount === "infinite" ? 1 : Number(c.iterationCount) || 1),
      ),
    0,
  );

  const zoomIn = useCallback(() => setZoom((z) => Math.min(3, z + 0.25)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.25, z - 0.25)), []);
  const zoomFit = useCallback(() => setZoom(1), []);

  return (
    <div className="flex flex-col h-full bg-ink rounded-xl border border-edge overflow-hidden">
      {/* Canvas toolbar */}
      <div className="px-3 py-1.5 border-b border-edge flex items-center gap-2 bg-panel flex-shrink-0">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">Canvas</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={MIN_DIM}
            max={MAX_DIM}
            step={16}
            value={CANVAS_W}
            onChange={(e) => {
              const w = Math.min(MAX_DIM, Math.max(MIN_DIM, Number(e.target.value) || MIN_DIM));
              setCanvasSize({ width: w, height: CANVAS_H });
            }}
            className="w-14 bg-panel2 border border-edge rounded px-1 py-0.5 text-[10px] text-gray-100 font-mono focus:outline-none focus:border-accent"
            aria-label="Canvas width in pixels"
          />
          <span className="text-[10px] text-gray-600">×</span>
          <input
            type="number"
            min={MIN_DIM}
            max={MAX_DIM}
            step={16}
            value={CANVAS_H}
            onChange={(e) => {
              const h = Math.min(MAX_DIM, Math.max(MIN_DIM, Number(e.target.value) || MIN_DIM));
              setCanvasSize({ width: CANVAS_W, height: h });
            }}
            className="w-14 bg-panel2 border border-edge rounded px-1 py-0.5 text-[10px] text-gray-100 font-mono focus:outline-none focus:border-accent"
            aria-label="Canvas height in pixels"
          />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setShowGrid((v) => !v)}
            className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
              showGrid ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-gray-300"
            }`}
            title="Toggle grid"
            aria-label="Toggle grid"
            aria-pressed={showGrid}
          >
            ⊞
          </button>
          <button
            onClick={zoomOut}
            className="w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-accent bg-panel2 rounded"
            title="Zoom out"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="text-[10px] text-gray-500 font-mono w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="w-6 h-6 flex items-center justify-center text-xs text-gray-400 hover:text-accent bg-panel2 rounded"
            title="Zoom in"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={zoomFit}
            className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-accent bg-panel2 rounded"
            title="Fit"
            aria-label="Fit to screen"
          >
            Fit
          </button>
          <button
            onClick={triggerReplay}
            className="ml-1 px-2 py-0.5 text-[10px] rounded bg-accent hover:bg-accent2 text-white transition-colors"
            title="Replay (Shift+R)"
            aria-label="Replay animation"
          >
            ▶ Replay
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-8 relative">
        <style>{css}</style>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-gray-500 text-sm animate-pulse">Loading project…</div>
          </div>
        )}
        {!loading && nodes.length === 0 && (
          <p className="text-gray-500 text-sm">No components yet — pick a template or ask the agent.</p>
        )}
        <div
          key={replayKey}
          className="relative"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
            background: showGrid
              ? `
                linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px),
                radial-gradient(120% 120% at 50% 0%, #1b2230 0%, #0b0e14 60%)
              `
              : "radial-gradient(120% 120% at 50% 0%, #1b2230 0%, #0b0e14 60%)",
            backgroundSize: showGrid ? "20px 20px, 20px 20px, 100% 100%" : "100% 100%",
            borderRadius: 8,
            border: "1px solid #222a3a",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          {/* Dimension labels */}
          <div className="absolute -top-5 left-0 right-0 flex justify-center text-[9px] text-gray-600 font-mono">
            {CANVAS_W}px
          </div>
          <div
            className="absolute top-0 bottom-0 -left-5 flex items-center text-[9px] text-gray-600 font-mono"
            style={{ writingMode: "vertical-rl" }}
          >
            {CANVAS_H}px
          </div>

          {/* Rendered components */}
          <div className="absolute inset-0 flex items-center justify-center flex-wrap gap-4 p-8">
            {nodes.map((node) => {
              const Tag = node.tag as keyof JSX.IntrinsicElements;
              const isSelected = node.componentId === selectedId;
              return (
                <Tag
                  key={node.componentId}
                  className={`${node.className} cursor-pointer`}
                  data-om-name={node.name}
                  style={isSelected ? { outline: "2px solid #6366f1", outlineOffset: "4px" } : undefined}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectComponent(isSelected ? null : node.componentId);
                  }}
                >
                  {node.content}
                </Tag>
              );
            })}
          </div>

          {/* Selection bounding box label */}
          {selectedId && (
            <div
              className="absolute -top-5 right-0 text-[9px] text-accent font-mono bg-ink/80 px-1.5 py-0.5 rounded"
              style={{ pointerEvents: "none" }}
            >
              {components.find((c) => c.id === selectedId)?.name ?? "selected"}
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="px-3 py-1 border-t border-edge flex items-center gap-3 text-[10px] text-gray-600 bg-panel flex-shrink-0">
        <span>{components.length} layers</span>
        <span>·</span>
        <span>{totalDuration > 0 ? `${totalDuration}ms total` : "empty"}</span>
        <span>·</span>
        <span>{visibleComponents.length} rendered</span>
        {selectedId && (
          <>
            <span>·</span>
            <span className="text-accent">
              ▸ {components.find((c) => c.id === selectedId)?.name}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
