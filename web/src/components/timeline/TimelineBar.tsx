import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { useClipboardStore } from "../../store/clipboardStore.js";
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
const FPS = 60;
type TimeFormat = "ms" | "s" | "frames";

/** Format a millisecond value for the timeline ruler and status display. */
function formatTime(ms: number, fmt: TimeFormat): string {
  if (fmt === "s") {
    return ms >= 1000 ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 2)}s` : `${ms}ms`;
  }
  if (fmt === "frames") {
    return `${Math.round((ms / 1000) * FPS)}f`;
  }
  return `${Math.round(ms)}ms`;
}

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
  const selectedIds = useUiStore((s) => s.selectedIds);
  const toggleSelection = useUiStore((s) => s.toggleSelection);
  const clearSelection = useUiStore((s) => s.clearSelection);
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
  const setSnapToGrid = useUiStore((s) => s.setSnapToGrid);

  const isPlaying = useUiStore((s) => s.isPlaying);
  const setIsPlaying = useUiStore((s) => s.setIsPlaying);
  const [currentTime, setCurrentTime] = useState(0);
  const [loop, setLoop] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>("ms");
  const [draggingKf, setDraggingKf] = useState<{ compId: string; kfIndex: number; barLeft: number; barWidth: number } | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [draggingRange, setDraggingRange] = useState<"in" | "out" | null>(null);
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const [graphMode, setGraphMode] = useState(false);
  // Non-linear edit drag state — move, trim-left, trim-right on component bars
  const [draggingBar, setDraggingBar] = useState<{
    compId: string;
    mode: "move" | "trim-left" | "trim-right";
    startClientX: number;
    trackLeft: number;
    trackWidth: number;
    origDelayMs: number;
    origDurationMs: number;
  } | null>(null);
  // Right-click context menu on component bars
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; compId: string } | null>(null);
  // Inline rename state for component names
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
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

  /** Drag-to-reorder state: which component ID is being dragged. */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  /** Handle drag start on a component row. */
  const handleDragStart = useCallback((e: React.DragEvent, compId: string) => {
    setDraggingId(compId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", compId);
  }, []);

  /** Handle drag over a component row — allow drop. */
  const handleDragOver = useCallback((e: React.DragEvent, compId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== compId) setDragOverId(compId);
  }, [dragOverId]);

  /** Handle drop on a component row — reorder tracks. */
  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggingId ?? e.dataTransfer.getData("text/plain");
    setDraggingId(null);
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;

    const orderedIds = components
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((c) => c.id);
    const fromIdx = orderedIds.indexOf(sourceId);
    const toIdx = orderedIds.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    orderedIds.splice(fromIdx, 1);
    orderedIds.splice(toIdx, 0, sourceId);

    useProjectStore.getState().reorderComponentsLocal(orderedIds);
    if (projectId) {
      void api.reorderComponents(projectId, orderedIds).catch(() => {});
    }
  }, [draggingId, components, projectId]);

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

  /** Split the selected component at the playhead position. */
  const handleSplitAtPlayhead = useCallback(async () => {
    if (!projectId || !selectedId) return;
    const comp = components.find((c) => c.id === selectedId);
    if (!comp) return;
    // Calculate the split offset within the component's timeline
    const splitMs = currentTime - comp.delayMs;
    if (splitMs <= 0 || splitMs >= comp.durationMs) return;
    const splitOffset = splitMs / comp.durationMs;

    // Patch the original: shorten duration to the split point
    const firstDuration = splitMs;
    const firstKeyframes = comp.keyframes
      .filter((kf) => kf.offset <= splitOffset)
      .map((kf) => ({ ...kf, offset: kf.offset / splitOffset }));

    try {
      await api.patchComponent(projectId, comp.id, {
        durationMs: firstDuration,
        keyframes: firstKeyframes.length > 0 ? firstKeyframes : comp.keyframes,
      });

      // Create the second half
      const clone = await api.createComponent(projectId, { name: `${comp.name} (split)` });
      const secondDuration = comp.durationMs - splitMs;
      const secondKeyframes = comp.keyframes
        .filter((kf) => kf.offset >= splitOffset)
        .map((kf) => ({ ...kf, offset: (kf.offset - splitOffset) / (1 - splitOffset) }));
      await api.patchComponent(projectId, clone.id, {
        easing: comp.easing,
        durationMs: secondDuration,
        delayMs: comp.delayMs + splitMs,
        iterationCount: comp.iterationCount,
        direction: comp.direction,
        keyframes: secondKeyframes.length > 0 ? secondKeyframes : comp.keyframes,
        style: comp.style,
        trigger: comp.trigger,
      });
      await loadProject(projectId);
    } catch { /* ignore */ }
  }, [projectId, selectedId, components, currentTime, loadProject]);

  /** Ripple delete — remove selected component and shift subsequent components left. */
  const handleRippleDelete = useCallback(async () => {
    if (!projectId || !selectedId) return;
    const comp = components.find((c) => c.id === selectedId);
    if (!comp) return;
    const removedSpan = componentSpan(comp.durationMs, comp.delayMs, comp.iterationCount);
    const removedDelay = comp.delayMs;

    // Shift components that start after the removed component's delay
    const toShift = components.filter((c) => c.id !== selectedId && c.delayMs >= removedDelay);
    try {
      await api.removeComponent(projectId, selectedId);
      for (const c of toShift) {
        const newDelay = Math.max(0, c.delayMs - removedSpan);
        await api.patchComponent(projectId, c.id, { delayMs: newDelay });
      }
      useProjectStore.getState().removeComponentLocal(selectedId);
      selectComponent(null);
      await loadProject(projectId);
    } catch { /* ignore */ }
  }, [projectId, selectedId, components, loadProject, selectComponent]);

  /** Duplicate the selected component via the API. */
  const handleDuplicate = useCallback(async () => {
    if (!projectId || !selectedId) return;
    const comp = components.find((c) => c.id === selectedId);
    if (!comp) return;
    try {
      const clone = await api.createComponent(projectId, { name: `${comp.name} (copy)` });
      await api.patchComponent(projectId, clone.id, {
        easing: comp.easing,
        durationMs: comp.durationMs,
        delayMs: comp.delayMs + comp.durationMs,
        iterationCount: comp.iterationCount,
        direction: comp.direction,
        keyframes: comp.keyframes,
        style: comp.style,
        trigger: comp.trigger,
      });
      await loadProject(projectId);
      selectComponent(clone.id);
    } catch { /* ignore */ }
  }, [projectId, selectedId, components, loadProject, selectComponent]);

  /** Commit an inline rename of a component. */
  const commitRename = useCallback(async () => {
    if (!projectId || !renamingId) return;
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setRenamingId(null);
      return;
    }
    const comp = components.find((c) => c.id === renamingId);
    if (comp && comp.name !== trimmed) {
      try {
        await api.patchComponent(projectId, renamingId, { name: trimmed });
        await loadProject(projectId);
      } catch { /* ignore */ }
    }
    setRenamingId(null);
    setRenameValue("");
  }, [projectId, renamingId, renameValue, components, loadProject]);

  /** Start inline rename for a component. */
  const startRename = useCallback((compId: string) => {
    const comp = components.find((c) => c.id === compId);
    if (!comp) return;
    setRenamingId(compId);
    setRenameValue(comp.name);
    // Focus the input on the next tick after it renders
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 0);
  }, [components]);

  /** Simple delete without rippling — just remove the component. */
  const handleDelete = useCallback(async (compId: string) => {
    if (!projectId) return;
    try {
      await api.removeComponent(projectId, compId);
      useProjectStore.getState().removeComponentLocal(compId);
      if (selectedId === compId) selectComponent(null);
      await loadProject(projectId);
    } catch { /* ignore */ }
  }, [projectId, selectedId, selectComponent, loadProject]);

  /** Open the context menu at the cursor position for a component. */
  const openContextMenu = useCallback((e: React.MouseEvent, compId: string) => {
    e.preventDefault();
    e.stopPropagation();
    selectComponent(compId);
    setContextMenu({ x: e.clientX, y: e.clientY, compId });
  }, [selectComponent]);

  /** Run a context menu action and close the menu. */
  const runMenuAction = useCallback((action: () => void) => {
    setContextMenu(null);
    action();
  }, []);

  /** Copy the selected component(s) to the clipboard. */
  const handleCopy = useCallback(() => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : (selectedId ? [selectedId] : []);
    const selectedComps = components.filter((c) => ids.includes(c.id));
    if (selectedComps.length > 0) {
      useClipboardStore.getState().copy(selectedComps);
    }
  }, [selectedIds, selectedId, components]);

  /** Paste clipboard contents as new components. */
  const handlePaste = useCallback(async () => {
    if (!projectId) return;
    const entries = useClipboardStore.getState().entries;
    if (entries.length === 0) return;
    for (const entry of entries) {
      try {
        const clone = await api.createComponent(projectId, { name: `${entry.name} (paste)` });
        const newStyle = { ...entry.style };
        const left = typeof newStyle.left === "number" ? newStyle.left : parseFloat(String(newStyle.left ?? "0")) || 0;
        const top = typeof newStyle.top === "number" ? newStyle.top : parseFloat(String(newStyle.top ?? "0")) || 0;
        newStyle.left = left + 20;
        newStyle.top = top + 20;
        await api.patchComponent(projectId, clone.id, {
          easing: entry.easing,
          durationMs: entry.durationMs,
          delayMs: entry.delayMs,
          iterationCount: entry.iterationCount,
          direction: entry.direction,
          keyframes: entry.keyframes,
          style: newStyle,
          trigger: entry.trigger,
        });
        useProjectStore.getState().addComponentLocal(clone);
        selectComponent(clone.id);
      } catch { /* ignore */ }
    }
  }, [projectId, selectComponent]);

  /** Whether the clipboard has content to paste. */
  const canPaste = useClipboardStore((s) => s.entries.length > 0);

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
    } else if (action === "fitView") {
      setZoom(1);
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

  // Close the context menu on any outside click or Escape key
  useEffect(() => {
    if (!contextMenu) return;
    const onDown = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    // Defer one tick so the opening right-click doesn't immediately close it
    const t = setTimeout(() => {
      window.addEventListener("mousedown", onDown);
      window.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  // Escape cancels inline rename; Enter commits it
  useEffect(() => {
    if (!renamingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setRenamingId(null);
        setRenameValue("");
      } else if (e.key === "Enter") {
        e.preventDefault();
        void commitRename();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [renamingId, commitRename]);

  /** Start dragging a component bar — mode controls move vs trim. */
  const startBarDrag = useCallback(
    (e: React.MouseEvent, compId: string, mode: "move" | "trim-left" | "trim-right") => {
      e.stopPropagation();
      e.preventDefault();
      const comp = components.find((c) => c.id === compId);
      if (!comp) return;
      const trackEl = trackInnerRef.current;
      if (!trackEl) return;
      const rect = trackEl.getBoundingClientRect();
      setDraggingBar({
        compId,
        mode,
        startClientX: e.clientX,
        trackLeft: rect.left,
        trackWidth: rect.width,
        origDelayMs: comp.delayMs,
        origDurationMs: comp.durationMs,
      });
      document.body.style.cursor = mode === "move" ? "grabbing" : "ew-resize";
      document.body.style.userSelect = "none";
    },
    [components],
  );

  /** Snap a millisecond value to nearby edges when snap-to-grid is on. */
  const snapMs = useCallback(
    (ms: number, excludeId: string, thresholdMs = 80): number => {
      if (!snapToGrid) return ms;
      const snapPoints: number[] = [0, currentTime, maxSpan];
      for (const c of components) {
        if (c.id === excludeId) continue;
        const span = componentSpan(c.durationMs, c.delayMs, c.iterationCount);
        snapPoints.push(c.delayMs, span);
      }
      for (const m of markers) snapPoints.push(m.timeMs);
      let best = ms;
      let bestDist = thresholdMs;
      for (const p of snapPoints) {
        const d = Math.abs(p - ms);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      return best;
    },
    [snapToGrid, currentTime, maxSpan, components, markers],
  );

  /** Handle component bar drag — move, trim-left, trim-right with snap. */
  useEffect(() => {
    if (!draggingBar) return;
    const { compId, mode, startClientX, trackLeft, trackWidth, origDelayMs, origDurationMs } = draggingBar;

    const onMouseMove = (e: MouseEvent) => {
      const deltaRatio = (e.clientX - startClientX) / trackWidth;
      const deltaMs = deltaRatio * maxSpan;

      useProjectStore.setState((s) => ({
        components: s.components.map((c) => {
          if (c.id !== compId) return c;
          if (mode === "move") {
            const newDelay = Math.max(0, snapMs(origDelayMs + deltaMs, compId));
            return { ...c, delayMs: newDelay };
          }
          if (mode === "trim-left") {
            // Adjust delay and duration — duration shrinks as left edge moves right
            const maxTrim = origDurationMs - 50; // keep at least 50ms
            const rawDelay = Math.max(0, origDelayMs + deltaMs);
            const newDelay = Math.min(rawDelay, origDelayMs + maxTrim);
            const newDuration = Math.max(50, origDurationMs - (newDelay - origDelayMs));
            return { ...c, delayMs: snapMs(newDelay, compId), durationMs: newDuration };
          }
          // trim-right — adjust duration only
          const newDuration = Math.max(50, snapMs(origDurationMs + deltaMs, compId) - origDelayMs);
          return { ...c, durationMs: newDuration };
        }),
      }));
    };

    const onMouseUp = async () => {
      setDraggingBar(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      // Persist the dragged component to the backend
      const comp = useProjectStore.getState().components.find((c) => c.id === compId);
      if (comp && projectId) {
        try {
          await api.patchComponent(projectId, compId, {
            delayMs: comp.delayMs,
            durationMs: comp.durationMs,
          } as Partial<MotionComponent>);
          void loadProject(projectId);
        } catch {
          /* ignore */
        }
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [draggingBar, maxSpan, snapMs, projectId, loadProject]);

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
        {/* Empty tracks area — inviting call-to-action with shortcut hints */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl text-gray-700 mb-1">◂▸</div>
            <p className="text-sm text-gray-400">No layers on the timeline</p>
            <p className="text-[11px] text-gray-600 mt-1">Pick a template from the Assets panel or ask the agent to add motion.</p>
            <div className="mt-3 flex items-center justify-center gap-2 text-[9px] text-gray-700 font-mono">
              <span className="bg-panel2 px-1.5 py-0.5 rounded border border-edge">Space</span>
              <span>play</span>
              <span className="text-edge mx-0.5">·</span>
              <span className="bg-panel2 px-1.5 py-0.5 rounded border border-edge">S</span>
              <span>split</span>
              <span className="text-edge mx-0.5">·</span>
              <span className="bg-panel2 px-1.5 py-0.5 rounded border border-edge">D</span>
              <span>duplicate</span>
              <span className="text-edge mx-0.5">·</span>
              <span className="bg-panel2 px-1.5 py-0.5 rounded border border-edge">F</span>
              <span>fit view</span>
            </div>
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
          <button
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
            className="w-5 h-5 flex items-center justify-center text-[9px] text-gray-500 hover:text-accent bg-panel2 border border-edge rounded disabled:opacity-30"
            title="Fit to view (F)"
            aria-label="Fit timeline to view"
          >
            ⤢
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
        <button
          onClick={() => setSnapToGrid(!snapToGrid)}
          className={`px-1.5 py-0.5 text-[10px] rounded ${snapToGrid ? "bg-accent/20 text-accent" : "text-gray-500 hover:text-gray-300 bg-panel2 border border-edge"}`}
          title="Toggle snap-to-grid — aligns drags to playhead, marker, and component edges"
          aria-label="Toggle snap to grid"
          aria-pressed={snapToGrid}
        >
          ⊞
        </button>
        {/* Non-linear edit tools: split / ripple delete / duplicate */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleSplitAtPlayhead}
            disabled={!selectedId}
            className="px-1.5 py-0.5 text-[9px] text-gray-500 hover:text-accent bg-panel2 border border-edge rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Split at playhead (S)"
            aria-label="Split at playhead"
          >
            ⫼
          </button>
          <button
            onClick={handleRippleDelete}
            disabled={!selectedId}
            className="px-1.5 py-0.5 text-[9px] text-gray-500 hover:text-red-400 bg-panel2 border border-edge rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Ripple delete (Shift+Del)"
            aria-label="Ripple delete selected component"
          >
            ✕
          </button>
          <button
            onClick={handleDuplicate}
            disabled={!selectedId}
            className="px-1.5 py-0.5 text-[9px] text-gray-500 hover:text-accent bg-panel2 border border-edge rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Duplicate (Cmd+D)"
            aria-label="Duplicate selected component"
          >
            ⧉
          </button>
        </div>
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
          {selectedIds.size > 1 && (
            <span className="text-[10px] text-accent bg-accent/10 border border-accent/30 px-1.5 py-0.5 rounded font-mono">
              {selectedIds.size} selected
            </span>
          )}
          <button
            onClick={() => setTimeFormat((f) => f === "ms" ? "s" : f === "s" ? "frames" : "ms")}
            className="text-[10px] text-gray-600 font-mono hover:text-gray-300 transition-colors bg-panel2 px-1.5 py-0.5 rounded"
            title={`Time format: ${timeFormat} — click to toggle (ms → s → frames)`}
            aria-label="Toggle time format"
          >
            <span className="text-gray-300">{formatTime(currentTime, timeFormat)}</span>
            <span className="text-gray-700"> / {formatTime(maxSpan, timeFormat)}</span>
          </button>
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
                const label = formatTime(ms, timeFormat);
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
            const isSelected = selectedIds.has(component.id) || component.id === selectedId;
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
                  className={`flex items-center gap-1 px-3 py-1 cursor-pointer transition-colors ${isSelected ? "bg-panel2" : "hover:bg-panel2/50"} ${dragOverId === component.id && draggingId !== component.id ? "border-t-2 border-accent" : ""} ${draggingId === component.id ? "opacity-50" : ""}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, component.id)}
                  onDragOver={(e) => handleDragOver(e, component.id)}
                  onDrop={(e) => handleDrop(e, component.id)}
                  onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.shiftKey) {
                      toggleSelection(component.id);
                    } else {
                      selectComponent(isSelected ? null : component.id);
                    }
                  }}
                  onContextMenu={(e) => openContextMenu(e, component.id)}
                >
                  {/* Drag handle for reordering tracks */}
                  <span className="text-[10px] text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing flex-shrink-0 select-none" title="Drag to reorder">⠿</span>
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
                    {renamingId === component.id ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => void commitRename()}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 bg-panel2 border border-accent text-gray-200 text-[10px] font-mono px-0.5 py-0 outline-none rounded"
                        aria-label={`Rename ${component.name}`}
                      />
                    ) : (
                      <span
                        className="truncate cursor-text"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          startRename(component.id);
                        }}
                        title="Double-click to rename"
                      >
                        {component.name}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 h-7 bg-panel2 rounded relative overflow-hidden border border-edge">
                    <div
                      className={`absolute top-0 bottom-0 rounded border ${barColor} ${isLocked ? "" : "cursor-grab"} group/bar`}
                      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                      title={`${component.durationMs}ms × ${component.iterationCount} — DNA: ${dna}${isLocked ? "" : " — drag to move"}`}
                      onMouseDown={(e) => {
                        if (isLocked) return;
                        startBarDrag(e, component.id, "move");
                      }}
                    >
                      {/* Left trim handle — drag to adjust delay/duration from the start */}
                      {!isLocked && (
                        <div
                          className="absolute top-0 bottom-0 left-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-white/40 transition-colors z-20"
                          onMouseDown={(e) => startBarDrag(e, component.id, "trim-left")}
                          title="Drag to trim start"
                        />
                      )}
                      {/* Right trim handle — drag to adjust duration from the end */}
                      {!isLocked && (
                        <div
                          className="absolute top-0 bottom-0 right-0 w-1.5 cursor-ew-resize bg-white/0 hover:bg-white/40 transition-colors z-20"
                          onMouseDown={(e) => startBarDrag(e, component.id, "trim-right")}
                          title="Drag to trim end"
                        />
                      )}
                    </div>
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
      {/* Right-click context menu for component bars */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[170px] bg-panel border border-edge rounded-md shadow-xl py-1 text-[11px] text-gray-300 font-mono"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 190),
            top: Math.min(contextMenu.y, window.innerHeight - 340),
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            className="w-full text-left px-3 py-1 hover:bg-panel2 text-gray-300"
            onClick={() => runMenuAction(() => void handleSplitAtPlayhead())}
            role="menuitem"
          >
            <span className="inline-block w-4 text-gray-600">S</span> Split at playhead
          </button>
          <button
            className="w-full text-left px-3 py-1 hover:bg-panel2 text-gray-300"
            onClick={() => runMenuAction(() => void handleDuplicate())}
            role="menuitem"
          >
            <span className="inline-block w-4 text-gray-600">D</span> Duplicate
          </button>
          <button
            className="w-full text-left px-3 py-1 hover:bg-panel2 text-gray-300"
            onClick={() => runMenuAction(handleCopy)}
            role="menuitem"
          >
            <span className="inline-block w-4 text-gray-600">C</span> Copy
          </button>
          <button
            className="w-full text-left px-3 py-1 hover:bg-panel2 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
            onClick={() => runMenuAction(() => void handlePaste())}
            disabled={!canPaste}
            role="menuitem"
          >
            <span className="inline-block w-4 text-gray-600">V</span> Paste
          </button>
          <button
            className="w-full text-left px-3 py-1 hover:bg-panel2 text-gray-300"
            onClick={() => runMenuAction(() => startRename(contextMenu.compId))}
            role="menuitem"
          >
            <span className="inline-block w-4 text-gray-600">R</span> Rename
          </button>
          <div className="my-1 border-t border-edge" />
          <button
            className="w-full text-left px-3 py-1 hover:bg-panel2 text-gray-300"
            onClick={() => runMenuAction(() => toggleLock(contextMenu.compId))}
            role="menuitem"
          >
            <span className="inline-block w-4 text-gray-600">L</span> {lockedIds.has(contextMenu.compId) ? "Unlock" : "Lock"}
          </button>
          <button
            className="w-full text-left px-3 py-1 hover:bg-panel2 text-gray-300"
            onClick={() => runMenuAction(() => toggleHidden(contextMenu.compId))}
            role="menuitem"
          >
            <span className="inline-block w-4 text-gray-600">H</span> {hiddenIds.has(contextMenu.compId) ? "Show" : "Hide"}
          </button>
          <div className="my-1 border-t border-edge" />
          <button
            className="w-full text-left px-3 py-1 hover:bg-panel2 text-gray-300"
            onClick={() => runMenuAction(() => void handleRippleDelete())}
            role="menuitem"
          >
            <span className="inline-block w-4 text-gray-600">⌫</span> Ripple delete
          </button>
          <button
            className="w-full text-left px-3 py-1 hover:bg-panel2 hover:text-red-400 text-red-400/90"
            onClick={() => runMenuAction(() => void handleDelete(contextMenu.compId))}
            role="menuitem"
          >
            <span className="inline-block w-4 text-red-400/60">×</span> Delete
          </button>
        </div>
      )}
    </div>
  );
}
