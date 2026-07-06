import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";

function componentSpan(durationMs: number, delayMs: number, iterationCount: number | "infinite"): number {
  const iters = iterationCount === "infinite" ? 1 : Number(iterationCount) || 1;
  return delayMs + durationMs * iters;
}

const SPEEDS = [0.5, 1, 2] as const;
const RULER_TICKS = 8;

interface Props {
  onReplay: () => void;
}

export function TimelineBar({ onReplay }: Props) {
  const components = useProjectStore((s) => s.components);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [loop, setLoop] = useState(false);
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
        const keyframes = c.keyframes.map((kf) => ({
          offset: kf.offset,
          leftPct: ((c.delayMs + kf.offset * c.durationMs) / max) * 100,
        }));
        return { component: c, leftPct, widthPct, keyframes };
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
      const delta = (ts - lastTsRef.current) * speed;
      lastTsRef.current = ts;
      setCurrentTime((prev) => {
        const next = prev + delta;
        if (next >= maxSpan) {
          if (loop) {
            onReplay();
            return 0;
          }
          stop();
          return maxSpan;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    },
    [maxSpan, speed, loop, onReplay, stop],
  );

  const play = useCallback(() => {
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
  const rulerTicks = Array.from({ length: RULER_TICKS + 1 }, (_, i) => i);

  return (
    <div className="bg-panel border-t border-edge flex flex-col" style={{ height: 180 }}>
      <div className="px-3 py-1 border-b border-edge flex items-center gap-2">
        <button
          onClick={isPlaying ? pause : play}
          className="w-7 h-7 flex items-center justify-center rounded-md bg-accent hover:bg-accent2 text-white text-xs transition-colors"
          title={isPlaying ? "Pause" : "Play"}
          aria-label={isPlaying ? "Pause animation" : "Play animation"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button
          onClick={() => setLoop((v) => !v)}
          className={`w-7 h-7 flex items-center justify-center rounded-md text-xs transition-colors ${
            loop ? "bg-accent2/30 text-accent2" : "bg-panel2 text-gray-500 hover:text-gray-300"
          }`}
          title="Loop"
          aria-label="Toggle loop"
          aria-pressed={loop}
        >
          ⟲
        </button>
        <div className="flex bg-panel2 rounded-md border border-edge overflow-hidden">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 text-[10px] transition-colors ${
                speed === s ? "bg-accent text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-gray-500 ml-1">Timeline</span>
        <span className="text-[10px] text-gray-600 font-mono ml-auto">
          {Math.round(currentTime)}ms / {maxSpan}ms
        </span>
      </div>

      <div ref={trackRef} className="flex-1 overflow-y-auto relative" onClick={scrub} style={{ cursor: "text" }}>
        <div
          className="absolute top-0 bottom-0 w-px bg-yellow-300/80 pointer-events-none z-10"
          style={{ left: `${playheadPct}%` }}
        >
          <div className="absolute -top-0 -left-1.5 w-3 h-3 bg-yellow-300 rotate-45" style={{ marginTop: 2 }} />
        </div>

        {rows.map(({ component, leftPct, widthPct, keyframes }) => {
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
              <div className="w-16 text-[10px] text-gray-400 truncate font-mono">{component.name}</div>
              <div className="flex-1 h-6 bg-panel2 rounded relative overflow-hidden border border-edge">
                <div
                  className={`absolute top-0 bottom-0 rounded ${isSelected ? "bg-accent/40" : "bg-accent2/30"}`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  title={`${component.durationMs}ms × ${component.iterationCount}`}
                />
                {keyframes.map((kf, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 w-2 h-2 bg-accent border border-white/60 rotate-45 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
                    style={{ left: `${kf.leftPct}%` }}
                    title={`keyframe @ ${Math.round(kf.offset * 100)}%`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-0.5 border-t border-edge flex justify-between">
        {rulerTicks.map((i) => (
          <span key={i} className="text-[9px] text-gray-600 font-mono">
            {Math.round((i / RULER_TICKS) * maxSpan)}ms
          </span>
        ))}
      </div>
    </div>
  );
}
