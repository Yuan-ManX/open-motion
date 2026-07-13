import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";

/**
 * Real-time performance overlay — measures FPS via requestAnimationFrame,
 * counts active animations, and reports JS heap memory if available.
 * Toggled via showPerformanceMonitor in uiStore.
 */
export function PerformanceMonitor() {
  const show = useUiStore((s) => s.showPerformanceMonitor);
  const components = useProjectStore((s) => s.components);
  const [fps, setFps] = useState(0);
  const [memMb, setMemMb] = useState<number | null>(null);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    if (!show) return;
    let raf = 0;
    const tick = () => {
      frameCount.current++;
      const now = performance.now();
      const elapsed = now - lastTime.current;
      if (elapsed >= 500) {
        const measured = Math.round((frameCount.current * 1000) / elapsed);
        setFps(measured);
        frameCount.current = 0;
        lastTime.current = now;
        const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
        if (mem) {
          setMemMb(Math.round(mem.usedJSHeapSize / 1024 / 1024));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show]);

  if (!show) return null;

  const activeCount = components.filter((c) => c.playState === "running").length;
  const loopCount = components.filter((c) => c.iterationCount === "infinite").length;
  const fpsColor = fps >= 50 ? "text-gray-400" : fps >= 30 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="absolute top-2 right-2 z-[60] bg-black/80 border border-edge rounded-md px-2.5 py-1.5 font-mono text-[10px] leading-tight pointer-events-none">
      <div className="flex items-center gap-2">
        <span className="text-gray-600">FPS</span>
        <span className={fpsColor}>{fps}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-600">ANI</span>
        <span className="text-gray-300">{activeCount}</span>
      </div>
      {loopCount > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-gray-600">LOOP</span>
          <span className="text-gray-300">{loopCount}</span>
        </div>
      )}
      {memMb !== null && (
        <div className="flex items-center gap-2">
          <span className="text-gray-600">MEM</span>
          <span className="text-gray-300">{memMb}MB</span>
        </div>
      )}
    </div>
  );
}
