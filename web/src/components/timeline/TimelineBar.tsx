import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { buildMotionDna } from "../../motion/dna.js";
import * as api from "../../api/endpoints.js";
import type { MotionComponent } from "@openmotion/shared";

function componentSpan(durationMs: number, delayMs: number, iterationCount: number | "infinite"): number {
  const iters = iterationCount === "infinite" ? 1 : Number(iterationCount) || 1;
  return delayMs + durationMs * iters;
}

/** Map a Motion DNA easing token to a Tailwind color class for the timeline bar. */
function dnaEasingColor(dna: string): string {
  const easing = dna.split("|")[0];
  const colorMap: Record<string, string> = {
    BOUNCE: "bg-white/40 border-white/50",
    SMOOTH: "bg-white/25 border-white/30",
    SNAPPY: "bg-white/35 border-white/40",
    SPRING: "bg-white/20 border-white/25",
    BEZIER: "bg-white/15 border-white/20",
    LINEAR: "bg-white/10 border-white/15",
  };
  return colorMap[easing] ?? "bg-accent2/30 border-edge";
}

const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
const ZOOM_LEVELS = [1, 2, 4, 8] as const;

interface Props {
  onReplay: () => void;
}

export function TimelineBar({ onReplay }: Props) {
  const components = useProjectStore((s) => s.components);
  const projectId = useProjectStore((s) => s.projectId);
  const loadProject = useProjectStore((s) => s.loadProject);
  const project = useProjectStore((s) => s.project);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const speed = useUiStore((s) => s.playbackSpeed);
  const setSpeed = useUiStore((s) => s.setPlaybackSpeed);
  const triggerReplay = useUiStore((s) => s.triggerReplay);
  const playbackRange = useUiStore((s) => s.playbackRange);
  const setPlaybackRange = useUiStore((s) => s.setPlaybackRange);
  const autoKeyframe = useUiStore((s) => s.autoKeyframe);
  const setAutoKeyframe = useUiStore((s) => s.setAutoKeyframe);
  const setPlayheadMs = useUiStore((s) => s.setPlayheadMs);
  const timelineCommand = useUiStore((s) => s.timelineCommand);
  const hiddenIds = useUiStore((s) => s.hiddenIds);
  const toggleHidden = useUiStore((s) => s.toggleHidden);
  const lockedIds = useUiStore((s) => s.lockedIds);
  const toggleLock = useUiStore((s) => s.toggleLock);
  const soloedId = useUiStore((s) => s.soloedId);
  const setSoloedId = useUiStore((s) => s.setSoloedId);
  const snapToGrid = useUiStore((s) => s.snapToGrid);

  const isPlaying = useUiStore((s) => s.isPlaying);
  const setIsPlaying = useUiStore((s) => s.setIsPlaying);
  const [currentTime, setCurrentTime] = useState(0);
  const [loop, setLoop] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [draggingKf, setDraggingKf] = useState<{ compId: string; kfIndex: number; barLeft: number; barWidth: number } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [draggingRange, setDraggingRange] = useState<"in" | "out" | null>(null);
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const [graphMode, setGraphMode] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const trackInnerRef = useRef<HTMLDivElement | null>(null);

  const toggleExpand = useCallback((compId: string) => {
    setExpandedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(compId)) next.delete(compId);
      else next.add(compId);
      return next;
    });
  }, []);

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
          properties: kf.properties as Record<string, string | number>,
        }));
        const dna = buildMotionDna(c);
        const isLoop = c.iterationCount === "infinite" || (typeof c.iterationCount === "number" && c.iterationCount > 1);
        const propNames = Array.from(new Set(c.keyframes.flatMap((kf) => Object.keys(kf.properties as Record<string, unknown>))));
        const propTracks = propNames.map((prop) => ({
          name: prop,
          keyframes: c.keyframes
            .map((kf, idx) => ({ kf, idx }))
            .filter(({ kf }) => prop in (kf.properties as Record<string, unknown>))
            .map(({ kf, idx }) => ({
              offset: kf.offset,
              leftPct: ((c.delayMs + kf.offset * c.durationMs) / max) * 100,
              kfIndex: idx,
            })),
        }));
        return { component: c, leftPct, widthPct, keyframes, dna, isLoop, propTracks };
      }),
    };
  }, [components]);

  // Parse timeline markers from project tokens
  const markers = useMemo(() => {
    const raw = project?.tokens?.markers;
    if (typeof raw !== "string") return [];
    try {
      const parsed = JSON.parse(raw) as { markers: Array<{ id: string; timeMs: number; label: string }> };
      return parsed.markers ?? [];
    } catch {
      return [];
    }
  }, [project?.tokens?.markers]);

  // Parse timeline clips from project tokens
  const clips = useMemo(() => {
    const raw = project?.tokens?.clips;
    if (typeof raw !== "string") return [];
    try {
      const parsed = JSON.parse(raw) as Array<{ id: string; name: string; startMs: number; endMs: number; color?: string }>;
      return parsed ?? [];
    } catch {
      return [];
    }
  }, [project?.tokens?.clips]);

  const handlePlayClip = useCallback((clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    setPlaybackRange({ startMs: clip.startMs, endMs: clip.endMs });
    setCurrentTime(clip.startMs);
    setPlayheadMs(clip.startMs);
    onReplay();
    setIsPlaying(true);
  }, [clips, setPlaybackRange, setPlayheadMs, onReplay]);

  const handleRemoveClip = useCallback(async (clipId: string) => {
    if (!projectId || !project) return;
    const remaining = clips.filter((c) => c.id !== clipId);
    const tokens = { ...project.tokens, clips: JSON.stringify(remaining) };
    useProjectStore.setState((s) => ({ project: s.project ? { ...s.project, tokens } : s.project }));
    try {
      await api.updateProject(projectId, { tokens });
    } catch { /* ignore */ }
  }, [projectId, project, clips]);

  const handleAddMarker = useCallback(async () => {
    if (!projectId || !project) return;
    const timeMs = Math.round(currentTime);
    const tokens = { ...project.tokens };
    let data: { markers: Array<{ id: string; timeMs: number; label: string }> };
    try {
      data = typeof tokens.markers === "string" ? JSON.parse(tokens.markers) : { markers: [] };
    } catch {
      data = { markers: [] };
    }
    data.markers.push({ id: `mk_${Date.now().toString(36)}`, timeMs, label: `Marker ${data.markers.length + 1}` });
    data.markers.sort((a, b) => a.timeMs - b.timeMs);
    tokens.markers = JSON.stringify(data);
    useProjectStore.setState((s) => ({ project: s.project ? { ...s.project, tokens } : s.project }));
    try {
      await api.updateProject(projectId, { tokens });
    } catch { /* ignore */ }
  }, [projectId, project, currentTime]);

  const handleRemoveMarker = useCallback(async (markerId: string) => {
    if (!projectId || !project) return;
    const tokens = { ...project.tokens };
    let data: { markers: Array<{ id: string }> };
    try {
      data = typeof tokens.markers === "string" ? JSON.parse(tokens.markers) : { markers: [] };
    } catch {
      data = { markers: [] };
    }
    data.markers = data.markers.filter((m) => m.id !== markerId);
    tokens.markers = JSON.stringify(data);
    useProjectStore.setState((s) => ({ project: s.project ? { ...s.project, tokens } : s.project }));
    try {
      await api.updateProject(projectId, { tokens });
    } catch { /* ignore */ }
  }, [projectId, project]);

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
      const rangeStart = playbackRange?.startMs ?? 0;
      const rangeEnd = playbackRange?.endMs ?? maxSpan;
      setCurrentTime((prev) => {
        const next = prev + delta;
        if (next >= rangeEnd) {
          if (loop) {
            onReplay();
            setPlayheadMs(rangeStart);
            return rangeStart;
          }
          stop();
          setPlayheadMs(rangeEnd);
          return rangeEnd;
        }
        if (next < rangeStart) return rangeStart;
        setPlayheadMs(next);
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    },
    [maxSpan, speed, loop, onReplay, stop, playbackRange],
  );

  const play = useCallback(() => {
    const rangeStart = playbackRange?.startMs ?? 0;
    const rangeEnd = playbackRange?.endMs ?? maxSpan;
    setCurrentTime((prev) => (prev >= rangeEnd || prev < rangeStart ? rangeStart : prev));
    setIsPlaying(true);
    onReplay();
  }, [maxSpan, onReplay, playbackRange]);

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

  // Handle keyboard commands from useKeyboard
  useEffect(() => {
    if (!timelineCommand) return;
    const { action, nonce } = timelineCommand;
    if (nonce === 0) return;
    const rangeStart = playbackRange?.startMs ?? 0;
    const rangeEnd = playbackRange?.endMs ?? maxSpan;
    if (action === "togglePlay") {
      if (isPlaying) stop();
      else play();
    } else if (action === "stepForward") {
      stop();
      const next = Math.min(rangeEnd, currentTime + 50);
      setCurrentTime(next);
      setPlayheadMs(next);
    } else if (action === "stepBackward") {
      stop();
      const next = Math.max(rangeStart, currentTime - 50);
      setCurrentTime(next);
      setPlayheadMs(next);
    } else if (action === "jumpStart") {
      stop();
      setCurrentTime(rangeStart);
      setPlayheadMs(rangeStart);
    } else if (action === "jumpEnd") {
      stop();
      setCurrentTime(rangeEnd);
      setPlayheadMs(rangeEnd);
    } else if (action === "addMarker") {
      void handleAddMarker();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineCommand]);

  /** Start a drag-scrub on the timeline track. */
  const startScrub = useCallback(
    (e: React.MouseEvent) => {
      if (draggingKf) return;
      e.preventDefault();
      setIsScrubbing(true);
      const el = trackInnerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const rangeStart = playbackRange?.startMs ?? 0;
      const rangeEnd = playbackRange?.endMs ?? maxSpan;
      const clampedMs = Math.max(rangeStart, Math.min(rangeEnd, ratio * maxSpan));
      setCurrentTime(clampedMs);
      setPlayheadMs(clampedMs);
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    },
    [maxSpan, draggingKf, playbackRange, setPlayheadMs],
  );

  /** Handle drag-scrub movement and release. */
  useEffect(() => {
    if (!isScrubbing) return;

    const onMouseMove = (e: MouseEvent) => {
      const el = trackInnerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const rangeStart = playbackRange?.startMs ?? 0;
      const rangeEnd = playbackRange?.endMs ?? maxSpan;
      setCurrentTime(Math.max(rangeStart, Math.min(rangeEnd, ratio * maxSpan)));
      setPlayheadMs(Math.max(rangeStart, Math.min(rangeEnd, ratio * maxSpan)));
    };

    const onMouseUp = () => {
      setIsScrubbing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isScrubbing, maxSpan, playbackRange, setPlayheadMs]);

  /** Handle range marker dragging. */
  useEffect(() => {
    if (!draggingRange) return;

    const onMouseMove = (e: MouseEvent) => {
      const el = trackInnerRef.current;
      if (!el || !playbackRange) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const ms = Math.round(ratio * maxSpan);
      if (draggingRange === "in") {
        setPlaybackRange({ startMs: Math.min(ms, playbackRange.endMs - 1), endMs: playbackRange.endMs });
      } else {
        setPlaybackRange({ startMs: playbackRange.startMs, endMs: Math.max(ms, playbackRange.startMs + 1) });
      }
    };

    const onMouseUp = () => {
      setDraggingRange(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [draggingRange, playbackRange, maxSpan, setPlaybackRange]);

  /** Start dragging a keyframe diamond to retime it. */
  const startKfDrag = useCallback(
    (e: React.MouseEvent, compId: string, kfIndex: number) => {
      e.stopPropagation();
      e.preventDefault();
      const barEl = (e.currentTarget.parentElement as HTMLElement);
      if (!barEl) return;
      const barRect = barEl.getBoundingClientRect();
      setDraggingKf({ compId, kfIndex, barLeft: barRect.left, barWidth: barRect.width });
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    },
    [],
  );

  /** Handle keyframe drag — updates offset in real-time, persists on mouseup. */
  useEffect(() => {
    if (!draggingKf) return;

    const onMouseMove = (e: MouseEvent) => {
      const { barLeft, barWidth, compId, kfIndex } = draggingKf;
      const ratio = Math.max(0, Math.min(1, (e.clientX - barLeft) / barWidth));
      const comp = components.find((c) => c.id === compId);
      if (!comp) return;
      const nextKfs = comp.keyframes.map((kf, i) =>
        i === kfIndex ? { ...kf, offset: Math.round(ratio * 1000) / 1000 } : kf,
      );
      // Update local store immediately for visual feedback
      useProjectStore.setState((s) => ({
        components: s.components.map((c) =>
          c.id === compId ? { ...c, keyframes: nextKfs } : c,
        ),
      }));
    };

    const onMouseUp = async () => {
      const { compId, kfIndex } = draggingKf;
      setDraggingKf(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Persist to backend
      const comp = useProjectStore.getState().components.find((c) => c.id === compId);
      if (comp && projectId) {
        const kf = comp.keyframes[kfIndex];
        if (kf) {
          try {
            await api.patchComponent(projectId, compId, {
              keyframes: comp.keyframes,
            } as Partial<MotionComponent>);
            void loadProject(projectId);
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
  }, [draggingKf, components, projectId, loadProject]);

  const renderGraphEditor = (): React.ReactNode => {
    if (!selectedId) return <div className="px-3 py-4 text-center text-[10px] text-gray-600">Select a component to view its animation graph.</div>;
    const comp = components.find((c) => c.id === selectedId);
    if (!comp || comp.keyframes.length === 0) return <div className="px-3 py-4 text-center text-[10px] text-gray-600">Select a component with keyframes to view graph.</div>;
    const allProps = Array.from(new Set(comp.keyframes.flatMap((kf) => Object.keys(kf.properties as Record<string, unknown>))));
    if (allProps.length === 0) return <div className="px-3 py-4 text-center text-[10px] text-gray-600">No animatable properties.</div>;
    const GRAPH_W = 600;
    const GRAPH_H = 100;
    const PAD_L = 40;
    const PAD_R = 10;
    const PAD_T = 10;
    const PAD_B = 15;
    const plotW = GRAPH_W - PAD_L - PAD_R;
    const plotH = GRAPH_H - PAD_T - PAD_B;
    const propData: { prop: string; kfs: { offset: number; value: number }[]; opacity: number }[] = [];
    allProps.forEach((prop, pi) => {
      const kfs = comp.keyframes
        .filter((kf) => prop in (kf.properties as Record<string, unknown>))
        .map((kf) => ({ offset: kf.offset, value: Number((kf.properties as Record<string, unknown>)[prop]) }))
        .filter((k) => !isNaN(k.value));
      if (kfs.length > 0) propData.push({ prop, kfs, opacity: 1 - pi * 0.2 });
    });
    if (propData.length === 0) return <div className="px-3 py-4 text-center text-[10px] text-gray-600">No numeric properties.</div>;
    const allValues = propData.flatMap((p) => p.kfs.map((k) => k.value));
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const valRange = maxVal - minVal || 1;
    const xFor = (offset: number) => PAD_L + offset * plotW;
    const yFor = (val: number) => PAD_T + plotH - ((val - minVal) / valRange) * plotH;
    return (
      <div className="px-3 py-2">
        <svg width="100%" viewBox={`0 0 ${GRAPH_W} ${GRAPH_H}`} className="bg-panel2 rounded border border-edge">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line key={`h${t}`} x1={PAD_L} y1={PAD_T + t * plotH} x2={GRAPH_W - PAD_R} y2={PAD_T + t * plotH} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line key={`v${t}`} x1={PAD_L + t * plotW} y1={PAD_T} x2={PAD_L + t * plotW} y2={GRAPH_H - PAD_B} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}
          <text x={PAD_L - 4} y={PAD_T + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" style={{ fontSize: 7, fontFamily: "monospace" }}>{maxVal.toFixed(0)}</text>
          <text x={PAD_L - 4} y={GRAPH_H - PAD_B} textAnchor="end" fill="rgba(255,255,255,0.3)" style={{ fontSize: 7, fontFamily: "monospace" }}>{minVal.toFixed(0)}</text>
          <text x={PAD_L} y={GRAPH_H - 3} textAnchor="middle" fill="rgba(255,255,255,0.3)" style={{ fontSize: 7, fontFamily: "monospace" }}>0</text>
          <text x={GRAPH_W - PAD_R} y={GRAPH_H - 3} textAnchor="middle" fill="rgba(255,255,255,0.3)" style={{ fontSize: 7, fontFamily: "monospace" }}>{maxSpan}ms</text>
          {propData.map(({ prop, kfs, opacity }) => {
            const pathD = kfs.map((kf, i) => `${i === 0 ? "M" : "L"} ${xFor(kf.offset)} ${yFor(kf.value)}`).join(" ");
            return (
              <g key={prop}>
                <path d={pathD} fill="none" stroke={`rgba(255,255,255,${opacity * 0.6})`} strokeWidth="1.5" />
                {kfs.map((kf, i) => (
                  <circle key={i} cx={xFor(kf.offset)} cy={yFor(kf.value)} r="3" fill={`rgba(255,255,255,${opacity})`} stroke="rgba(0,0,0,0.5)" strokeWidth="0.5" className="cursor-grab">
                    <title>{prop} @ {Math.round(kf.offset * 100)}% = {kf.value}</title>
                  </circle>
                ))}
                <text x={xFor(kfs[0].offset)} y={yFor(kfs[0].value) - 6} fill={`rgba(255,255,255,${opacity * 0.5})`} style={{ fontSize: 7, fontFamily: "monospace" }}>{prop}</text>
              </g>
            );
          })}
          {maxSpan > 0 && (
            <line x1={xFor(currentTime / maxSpan)} y1={PAD_T} x2={xFor(currentTime / maxSpan)} y2={GRAPH_H - PAD_B} stroke="rgba(255,255,255,0.8)" strokeWidth="1" strokeDasharray="2 2" />
          )}
        </svg>
      </div>
    );
  };

  if (rows.length === 0) {
    return (
      <div className="bg-panel border-t border-edge flex flex-col" style={{ height: 200 }}>
        {/* Toolbar — transport controls grouped with separators */}
        <div className="px-3 py-1.5 border-b border-edge flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button className="w-7 h-7 flex items-center justify-center rounded-md bg-panel2 text-gray-700 text-xs" disabled title="Play">▶</button>
            <button className="w-7 h-7 flex items-center justify-center rounded-md bg-panel2 text-gray-700 text-xs" disabled title="Loop">⟲</button>
          </div>
          <div className="w-0.5 h-5 bg-white/20" />
          <div className="flex bg-panel2 rounded-md border border-edge overflow-hidden">
            {SPEEDS.map((s) => (
              <span key={s} className={`px-2 py-0.5 text-[10px] ${s === 1 ? "text-gray-400" : "text-gray-700"}`}>{s}×</span>
            ))}
          </div>
          <div className="w-0.5 h-5 bg-white/20" />
          <span className="text-[9px] text-gray-700 font-mono w-7 text-center">1×</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-gray-600">Timeline</span>
            <span className="text-[10px] text-gray-700 bg-panel2 px-1.5 py-0.5 rounded font-mono">0 layers</span>
            <button
              onClick={onReplay}
              className="px-2.5 py-1 rounded-md text-xs text-gray-400 bg-panel2 border border-edge hover:border-accent hover:text-gray-300 transition-colors"
              title="Replay (Shift+R)"
              aria-label="Replay"
            >
              ↻
            </button>
          </div>
        </div>
        {/* Ruler */}
        <div className="px-3 py-1 border-b border-edge flex items-center gap-2">
          <span className="text-[9px] font-mono text-gray-700 w-8">0ms</span>
          <div className="flex-1 h-4 bg-panel2 rounded relative overflow-hidden">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="absolute top-0 bottom-0 border-l border-edge/50" style={{ left: `${(i / 8) * 100}%` }} />
            ))}
          </div>
        </div>
        {/* Empty tracks area — inviting call-to-action */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl text-gray-700 mb-1">◂▸</div>
            <p className="text-sm text-gray-400">No layers on the timeline</p>
            <p className="text-[11px] text-gray-600 mt-1">Pick a template from the Assets panel or ask the agent to add motion.</p>
          </div>
        </div>
      </div>
    );
  }

  const playheadPct = maxSpan > 0 ? (currentTime / maxSpan) * 100 : 0;
  const rulerTickCount = Math.min(40, 8 * zoom);
  const rulerTicks = Array.from({ length: rulerTickCount + 1 }, (_, i) => i);
  const zoomIndex = ZOOM_LEVELS.indexOf(zoom as typeof ZOOM_LEVELS[number]);

  return (
    <div className="bg-panel border-t border-edge flex flex-col" style={{ height: 200 }}>
      <div className="px-3 py-1.5 border-b border-edge flex items-center gap-2">
        {/* Transport group: play / loop / auto-keyframe */}
        <div className="flex items-center gap-1">
          <button
            onClick={isPlaying ? pause : play}
            className="w-7 h-7 flex items-center justify-center rounded-md bg-accent hover:bg-accent2 text-black text-xs"
            title={isPlaying ? "Pause" : "Play"}
            aria-label={isPlaying ? "Pause animation" : "Play animation"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            onClick={() => setLoop((v) => !v)}
            className={`w-7 h-7 flex items-center justify-center rounded-md text-xs ${
              loop ? "bg-accent2/30 text-accent2" : "bg-panel2 text-gray-500 hover:text-gray-300"
            }`}
            title="Loop"
            aria-label="Toggle loop"
            aria-pressed={loop}
          >
            ⟲
          </button>
          <button
            onClick={() => setAutoKeyframe(!autoKeyframe)}
            className={`w-7 h-7 flex items-center justify-center rounded-md text-xs ${
              autoKeyframe ? "bg-accent2/30 text-accent2" : "bg-panel2 text-gray-500 hover:text-gray-300"
            }`}
            title={autoKeyframe ? "Auto-keyframe ON — style changes at playhead create keyframes" : "Auto-keyframe OFF"}
            aria-label="Toggle auto-keyframe mode"
            aria-pressed={autoKeyframe}
          >
            ●
          </button>
        </div>
        <div className="w-0.5 h-5 bg-white/20" />
        {/* Speed group */}
        <div className="flex bg-panel2 rounded-md border border-edge overflow-hidden">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSpeed(s);
                triggerReplay();
              }}
              className={`px-2 py-0.5 text-[10px] ${
                speed === s ? "bg-accent text-black font-medium" : "text-gray-500 hover:text-gray-300"
              }`}
              title={`Playback speed ${s}x`}
              aria-label={`Set playback speed to ${s}x`}
              aria-pressed={speed === s}
            >
              {s}×
            </button>
          ))}
        </div>
        <div className="w-0.5 h-5 bg-white/20" />
        {/* Zoom group */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setZoom(ZOOM_LEVELS[Math.max(0, zoomIndex - 1)])}
            disabled={zoomIndex <= 0}
            className="w-5 h-5 flex items-center justify-center text-[10px] text-gray-500 hover:text-accent bg-panel2 border border-edge rounded disabled:opacity-30"
            title="Zoom out timeline"
            aria-label="Zoom out timeline"
          >
            −
          </button>
          <span className="text-[9px] text-gray-600 font-mono w-7 text-center">{zoom}×</span>
          <button
            onClick={() => setZoom(ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, zoomIndex + 1)])}
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
            className="w-5 h-5 flex items-center justify-center text-[10px] text-gray-500 hover:text-accent bg-panel2 border border-edge rounded disabled:opacity-30"
            title="Zoom in timeline"
            aria-label="Zoom in timeline"
          >
            +
          </button>
        </div>
        <div className="w-0.5 h-5 bg-white/20" />
        {/* Edit group: graph / range / markers */}
        <button
          onClick={() => setGraphMode((v) => !v)}
          className={`px-1.5 py-0.5 text-[10px] rounded ${graphMode ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-gray-300 bg-panel2 border border-edge"}`}
          title="Toggle graph editor (value vs time curve view)"
          aria-label="Toggle graph editor"
          aria-pressed={graphMode}
        >
          ◜
        </button>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              const endMs = playbackRange?.endMs ?? maxSpan;
              setPlaybackRange({ startMs: Math.min(currentTime, endMs - 1), endMs });
            }}
            className="px-1.5 py-0.5 text-[9px] text-gray-500 hover:text-accent bg-panel2 border border-edge rounded"
            title="Set in point at playhead"
            aria-label="Set in point at playhead"
          >
            {`[`}
          </button>
          <button
            onClick={() => {
              const startMs = playbackRange?.startMs ?? 0;
              setPlaybackRange({ startMs, endMs: Math.max(currentTime, startMs + 1) });
            }}
            className="px-1.5 py-0.5 text-[9px] text-gray-500 hover:text-accent bg-panel2 border border-edge rounded"
            title="Set out point at playhead"
            aria-label="Set out point at playhead"
          >
            {`]`}
          </button>
          {playbackRange && (
            <button
              onClick={() => setPlaybackRange(null)}
              className="px-1.5 py-0.5 text-[9px] text-gray-500 hover:text-red-400 bg-panel2 border border-edge rounded"
              title="Clear playback range"
              aria-label="Clear playback range"
            >
              ×
            </button>
          )}
        </div>
        <button
          onClick={handleAddMarker}
          className="px-1.5 py-0.5 text-[9px] text-gray-500 hover:text-accent bg-panel2 border border-edge rounded"
          title="Add marker at playhead"
          aria-label="Add marker at playhead"
        >
          ⚑
        </button>
        {/* Info group: label + time */}
        <div className="ml-auto flex items-center gap-2">
          {snapToGrid && (
            <span
              className="text-[9px] text-accent bg-accent/10 border border-accent/30 px-1 py-0.5 rounded font-mono uppercase tracking-wide"
              title="Snap to grid is enabled"
            >
              Snap
            </span>
          )}
          <span className="text-[10px] uppercase tracking-wide text-gray-500">Timeline</span>
          <span className="text-[10px] text-gray-600 bg-panel2 px-1.5 py-0.5 rounded font-mono">
            {rows.length} {rows.length === 1 ? "layer" : "layers"}
          </span>
          <span className="text-[10px] text-gray-600 font-mono">
            <span className="text-gray-300">{Math.round(currentTime)}</span>
            <span className="text-gray-700"> / {maxSpan}ms</span>
          </span>
        </div>
      </div>

      <div ref={trackRef} className="flex-1 overflow-auto relative" onMouseDown={startScrub} style={{ cursor: isScrubbing ? "grabbing" : "text" }}>
        <div
          ref={trackInnerRef}
          className="relative"
          style={{ minWidth: "100%", width: `${zoom * 100}%` }}
        >
          {/* Time ruler with labels */}
          <div className="flex items-center px-3 py-0.5 border-b border-edge/50 select-none">
            <div className="w-4 flex-shrink-0" />
            <div className="w-16 flex-shrink-0" />
            <div className="flex-1 h-4 relative">
              {rulerTicks.map((i) => {
                const pct = (i / rulerTickCount) * 100;
                const ms = Math.round((i / rulerTickCount) * maxSpan);
                const label = ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s` : `${ms}ms`;
                return (
                  <div key={i} className="absolute top-0 h-full flex flex-col items-center" style={{ left: `${pct}%`, transform: "translateX(-50%)" }}>
                    <span className="text-[8px] text-gray-600 font-mono">{label}</span>
                    <div className="w-px h-1.5 bg-gray-700 mt-0.5" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Playhead — prominent with glow */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-10"
            style={{ left: `${playheadPct}%`, top: "20px", boxShadow: "0 0 6px rgba(255,255,255,0.5)" }}
          >
            <div className="absolute -top-0 -left-1 w-2.5 h-2.5 bg-white rotate-45" style={{ marginTop: 2, boxShadow: "0 0 4px rgba(255,255,255,0.4)" }} />
          </div>

          {/* Timeline markers */}
          {markers.map((m) => {
            const pct = maxSpan > 0 ? (m.timeMs / maxSpan) * 100 : 0;
            return (
              <div
                key={m.id}
                className="group absolute top-0 bottom-0 z-15"
                style={{ left: `${pct}%` }}
              >
                <div className="w-0.5 h-full bg-accent2/60" />
                <div
                  className="absolute top-0 -left-6 w-12 text-center cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentTime(m.timeMs);
                    setPlayheadMs(m.timeMs);
                  }}
                >
                  <span className="text-[8px] text-accent2 font-mono bg-panel2 px-0.5 rounded group-hover:bg-accent2/20">
                    {m.label.length > 6 ? m.label.slice(0, 5) + "…" : m.label}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleRemoveMarker(m.id);
                    }}
                    className="block mx-auto text-[8px] text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                    aria-label="Remove marker"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}

          {/* Playback range highlight + markers */}
          {playbackRange && (
            <>
              <div
                className="absolute top-0 bottom-0 bg-white/5 pointer-events-none border-l border-r border-white/20"
                style={{
                  left: `${(playbackRange.startMs / maxSpan) * 100}%`,
                  width: `${((playbackRange.endMs - playbackRange.startMs) / maxSpan) * 100}%`,
                }}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-white/60 cursor-ew-resize z-20 hover:bg-white"
                style={{ left: `${(playbackRange.startMs / maxSpan) * 100}%`, marginLeft: "-2px" }}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setDraggingRange("in"); }}
                title={`In: ${Math.round(playbackRange.startMs)}ms`}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-white/60 cursor-ew-resize z-20 hover:bg-white"
                style={{ left: `${(playbackRange.endMs / maxSpan) * 100}%`, marginLeft: "-2px" }}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setDraggingRange("out"); }}
                title={`Out: ${Math.round(playbackRange.endMs)}ms`}
              />
            </>
          )}

          {/* Clips track — colored bands showing animation segments */}
          {clips.length > 0 && !graphMode && (
            <div className="flex items-center gap-1 px-3 py-0.5 border-b border-edge/30">
              <div className="w-4 flex-shrink-0" />
              <div className="w-16 flex-shrink-0 text-[8px] text-gray-600 uppercase tracking-wide">Clips</div>
              <div className="flex-1 h-5 relative">
                {clips.map((clip) => {
                  const leftPct = maxSpan > 0 ? (clip.startMs / maxSpan) * 100 : 0;
                  const widthPct = maxSpan > 0 ? ((clip.endMs - clip.startMs) / maxSpan) * 100 : 0;
                  return (
                    <div
                      key={clip.id}
                      className="group absolute top-0 bottom-0 rounded-sm border border-white/30 bg-white/15 hover:bg-white/25 cursor-pointer flex items-center justify-center overflow-hidden transition-colors"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayClip(clip.id);
                      }}
                      title={`${clip.name} (${clip.startMs}ms–${clip.endMs}ms) — click to play`}
                    >
                      <span className="text-[8px] text-white/80 font-mono truncate px-1">
                        {clip.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRemoveClip(clip.id);
                        }}
                        className="absolute top-0 right-0 w-3 h-3 flex items-center justify-center text-[8px] text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100"
                        aria-label={`Remove clip ${clip.name}`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {graphMode && renderGraphEditor()}

          {!graphMode && rows.map(({ component, leftPct, widthPct, keyframes, dna, isLoop, propTracks }) => {
            const isSelected = component.id === selectedId;
            const isExpanded = expandedTracks.has(component.id);
            const hasKeyframes = propTracks.length > 0;
            const barColor = isSelected ? "bg-accent/50 border-accent/60" : dnaEasingColor(dna);
            const isHidden = hiddenIds.has(component.id);
            const isLocked = lockedIds.has(component.id);
            const isSoloed = soloedId === component.id;
            const isDimmed = soloedId !== null && !isSoloed;
            return (
              <div key={component.id} className={isDimmed ? "opacity-30" : ""}>
                <div
                  className={`flex items-center gap-1 px-3 py-1 cursor-pointer transition-colors ${isSelected ? "bg-panel2" : "hover:bg-panel2/50"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectComponent(isSelected ? null : component.id);
                  }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleExpand(component.id); }}
                    className={`w-3 flex items-center justify-center text-[10px] text-gray-500 hover:text-accent flex-shrink-0 ${hasKeyframes ? "" : "opacity-30"}`}
                    title={hasKeyframes ? (isExpanded ? "Collapse tracks" : "Expand tracks") : "No keyframes"}
                    aria-label={isExpanded ? "Collapse tracks" : "Expand tracks"}
                  >
                    {hasKeyframes ? (isExpanded ? "▾" : "▸") : ""}
                  </button>
                  {/* Solo / Mute / Lock controls */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setSoloedId(isSoloed ? null : component.id); }}
                    className={`w-3.5 flex items-center justify-center text-[9px] flex-shrink-0 ${isSoloed ? "text-accent" : "text-gray-700 hover:text-gray-400"}`}
                    title={isSoloed ? "Un-solo" : "Solo this layer"}
                    aria-label="Solo layer"
                    aria-pressed={isSoloed}
                  >
                    {/* eye icon — use a filled circle when soloed */}
                    {isSoloed ? "◉" : "○"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleHidden(component.id); }}
                    className={`w-3.5 flex items-center justify-center text-[9px] flex-shrink-0 ${isHidden ? "text-gray-600" : "text-gray-500 hover:text-gray-300"}`}
                    title={isHidden ? "Show layer" : "Hide layer"}
                    aria-label={isHidden ? "Show layer" : "Hide layer"}
                    aria-pressed={isHidden}
                  >
                    {isHidden ? "◌" : "●"}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleLock(component.id); }}
                    className={`w-3.5 flex items-center justify-center text-[9px] flex-shrink-0 ${isLocked ? "text-accent" : "text-gray-700 hover:text-gray-400"}`}
                    title={isLocked ? "Unlock layer" : "Lock layer"}
                    aria-label={isLocked ? "Unlock layer" : "Lock layer"}
                    aria-pressed={isLocked}
                  >
                    {isLocked ? "🔒" : "🔓"}
                  </button>
                  <div className="w-14 text-[10px] text-gray-400 truncate font-mono flex items-center gap-0.5 flex-shrink-0">
                    {isLoop && <span className="text-white/70 flex-shrink-0" title="loops">↻</span>}
                    <span className="truncate">{component.name}</span>
                  </div>
                  <div className="flex-1 h-7 bg-panel2 rounded relative overflow-hidden border border-edge">
                    <div
                      className={`absolute top-0 bottom-0 rounded border ${barColor}`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      title={`${component.durationMs}ms × ${component.iterationCount} — DNA: ${dna}`}
                    />
                    {keyframes.map((kf, i) => (
                      <div
                        key={i}
                        className={`absolute top-1/2 w-2.5 h-2.5 border rotate-45 -translate-y-1/2 -translate-x-1/2 cursor-grab hover:scale-125 hover:z-20 ${
                          isSelected
                            ? "bg-accent border-white"
                            : "bg-accent border-white/60"
                        }`}
                        style={{ left: `${kf.leftPct}%` }}
                        title={`keyframe @ ${Math.round(kf.offset * 100)}% — drag to retime`}
                        onMouseDown={(e) => startKfDrag(e, component.id, i)}
                      />
                    ))}
                  </div>
                </div>
                {isExpanded && hasKeyframes && propTracks.map((pt) => (
                  <div
                    key={pt.name}
                    className="flex items-center gap-2 px-3 py-0.5 bg-ink/30"
                  >
                    <div className="w-4 flex-shrink-0" />
                    <div className="w-16 text-[9px] text-gray-600 truncate font-mono flex-shrink-0 pl-2">
                      {pt.name}
                    </div>
                    <div className="flex-1 h-4 relative">
                      {pt.keyframes.map((kf, i) => (
                        <div
                          key={i}
                          className="absolute top-1/2 w-2 h-2 border rotate-45 -translate-y-1/2 -translate-x-1/2 bg-white/80 border-white cursor-grab hover:scale-150 hover:bg-white hover:z-20 transition-transform"
                          style={{ left: `${kf.leftPct}%` }}
                          title={`${pt.name} @ ${Math.round(kf.offset * 100)}% — drag to retime, click to jump`}
                          onMouseDown={(e) => startKfDrag(e, component.id, kf.kfIndex)}
                          onClick={(e) => {
                            e.stopPropagation();
                            const ms = component.delayMs + kf.offset * component.durationMs;
                            setCurrentTime(ms);
                            setPlayheadMs(ms);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
