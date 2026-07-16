import { useEffect, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";

/**
 * Thin status bar pinned to the bottom of the editor main area.
 * Surfaces project info, zoom, FPS, selection, playback and provider mode.
 */
export function StatusBar() {
  const project = useProjectStore((s) => s.project);
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectedIds = useUiStore((s) => s.selectedIds);
  const canvasZoom = useUiStore((s) => s.canvasZoom);
  const isPlaying = useUiStore((s) => s.isPlaying);
  const playheadMs = useUiStore((s) => s.playheadMs);

  const [fps, setFps] = useState(0);
  const [providerMode, setProviderMode] = useState<string>("");

  // Fetch provider mode once on mount.
  useEffect(() => {
    let cancelled = false;
    api
      .listProviders()
      .then((status) => {
        if (!cancelled) setProviderMode(status.mode);
      })
      .catch(() => {
        /* ignore — status bar is non-critical */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // FPS meter driven by requestAnimationFrame.
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId = 0;
    const loop = (now: number) => {
      frameCount++;
      const elapsed = now - lastTime;
      if (elapsed >= 1000) {
        setFps(Math.round((frameCount * 1000) / elapsed));
        frameCount = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const selectedComponent = components.find((c) => c.id === selectedId);

  // Compute total animation duration across all components
  const totalDuration = components.reduce((max, c) => {
    const iters = c.iterationCount === "infinite" ? 1 : Number(c.iterationCount) || 1;
    return Math.max(max, c.delayMs + c.durationMs * iters);
  }, 0);

  return (
    <div className="h-6 bg-panel border-t border-edge text-[10px] text-gray-500 font-mono flex items-center gap-3 px-3 flex-shrink-0 overflow-hidden">
      <span className="text-gray-400 truncate max-w-[180px]" title={project?.name}>
        {project?.name ?? "No project"}
      </span>
      <Sep />
      <span>{components.length} {components.length === 1 ? "comp" : "comps"}</span>
      <Sep />
      <span>{Math.round(canvasZoom * 100)}%</span>
      <Sep />
      <span>{fps} fps</span>
      <Sep />
      <span className={isPlaying ? "text-accent" : "text-gray-500"}>
        {isPlaying ? "▶ playing" : "⏸ paused"}
      </span>
      {playheadMs != null && (
        <>
          <Sep />
          <span className="text-gray-400">{Math.round(playheadMs)}ms</span>
        </>
      )}
      {totalDuration > 0 && (
        <>
          <Sep />
          <span className="text-gray-700">/ {Math.round(totalDuration)}ms</span>
        </>
      )}
      {selectedIds.size > 1 && (
        <>
          <Sep />
          <span className="text-accent">{selectedIds.size} selected</span>
        </>
      )}
      {selectedComponent && (
        <>
          <Sep />
          <span className="truncate max-w-[140px]" title={selectedComponent.name}>
            {selectedComponent.name}
          </span>
          <span className="text-gray-700">{selectedComponent.id.slice(0, 8)}</span>
        </>
      )}
      {projectId && (
        <>
          <Sep />
          <span className="text-gray-700">{projectId.slice(0, 8)}</span>
        </>
      )}
      <div className="ml-auto flex items-center gap-3">
        {providerMode && (
          <span className="uppercase tracking-wide text-gray-500">{providerMode}</span>
        )}
      </div>
    </div>
  );
}

function Sep() {
  return <span className="text-gray-700">·</span>;
}
