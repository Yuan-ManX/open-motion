import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";

function componentSpan(durationMs: number, delayMs: number, iterationCount: number | "infinite"): number {
  const iters = iterationCount === "infinite" ? 1 : Number(iterationCount) || 1;
  return delayMs + durationMs * iters;
}

interface Props {
  onReplay: () => void;
}

export function TimelineBar({ onReplay }: Props) {
  const components = useProjectStore((s) => s.components);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const { maxSpan, rows } = useMemo(() => {
    const sorted = [...components].sort((a, b) => a.orderIndex - b.orderIndex);
    const spans = sorted.map((c) => componentSpan(c.durationMs, c.delayMs, c.iterationCount));
    const max = Math.max(1, ...spans);
    return {
      maxSpan: max,
      rows: sorted.map((c) => {
        const span = componentSpan(c.durationMs, c.delayMs, c.iterationCount);
        const leftPct = (c.delayMs / max) * 100;
        const widthPct = (span / max) * 100;
        return { component: c, leftPct, widthPct };
      }),
    };
  }, [components]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTsRef.current = null;
    setIsPlaying(false);
  }, []);

  const tick = useCallback(
    (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const delta = ts - lastTsRef.current;
      lastTsRef.current = ts;
      setCurrentTime((prev) => {
        const next = prev + delta;
        if (next >= maxSpan) {
          stop();
          return maxSpan;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    },
    [maxSpan, stop],
  );

  const play = useCallback(() => {
    // Starting a play always restarts the animation from the current playhead.
    // If we were at the end, rewind to 0 first.
    setCurrentTime((prev) => (prev >= maxSpan ? 0 : prev));
    setIsPlaying(true);
    onReplay();
  }, [maxSpan, onReplay]);

  const pause = useCallback(() => {
    stop();
  }, [stop]);

  useEffect(() => {
    if (!isPlaying) return;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTsRef.current = null;
    };
  }, [isPlaying, tick]);

  // Reset playhead when the project changes or components shrink.
  useEffect(() => {
    setCurrentTime((prev) => Math.min(prev, maxSpan));
    if (isPlaying && currentTime >= maxSpan) stop();
  }, [maxSpan]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setCurrentTime(ratio * maxSpan);
    },
    [maxSpan],
  );

  if (rows.length === 0) {
    return (
      <div className="bg-panel border-t border-edge px-4 py-3 text-center text-xs text-gray-600">
        No layers on the timeline.
      </div>
    );
  }

  const playheadPct = maxSpan > 0 ? (currentTime / maxSpan) * 100 : 0;

  return (
    <div className="bg-panel border-t border-edge flex flex-col" style={{ height: 160 }}>
      <div className="px-3 py-1 border-b border-edge flex items-center gap-3">
        <button
          onClick={isPlaying ? pause : play}
          className="w-7 h-7 flex items-center justify-center rounded-md bg-accent hover:bg-accent2 text-white text-xs transition-colors"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <span className="text-[10px] uppercase tracking-wide text-gray-500">Timeline</span>
        <span className="text-[10px] text-gray-600 font-mono ml-auto">
          {Math.round(currentTime)}ms / {maxSpan}ms
        </span>
      </div>
      <div
        ref={trackRef}
        className="flex-1 overflow-y-auto relative"
        onClick={scrub}
        style={{ cursor: "text" }}
      >
        {/* Playhead overlay spanning the track area */}
        <div
          className="absolute top-0 bottom-0 w-px bg-yellow-300/80 pointer-events-none z-10"
          style={{ left: `${playheadPct}%` }}
        />
        {rows.map(({ component, leftPct, widthPct }) => {
          const isSelected = component.id === selectedId;
          return (
            <div
              key={component.id}
              className="flex items-center gap-2 px-3 py-1 hover:bg-panel2 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                selectComponent(isSelected ? null : component.id);
              }}
            >
              <div className="w-20 text-xs text-gray-400 truncate font-mono">{component.name}</div>
              <div className="flex-1 h-5 bg-panel2 rounded relative overflow-hidden border border-edge">
                <div
                  className={`absolute top-0 bottom-0 rounded ${
                    isSelected ? "bg-accent" : "bg-accent2/60"
                  }`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={`${component.durationMs}ms × ${component.iterationCount}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
