import { useMemo, useState, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { useChatStore } from "../../store/chatStore.js";
import { reorderComponents } from "../../api/endpoints.js";
import { buildMotionDna } from "../../motion/dna.js";
import type { MotionComponent } from "@openmotion/shared";

const EASING_COLORS: Record<string, string> = {
  BOUNCE: "bg-orange-400",
  SMOOTH: "bg-blue-400",
  SNAPPY: "bg-yellow-400",
  SPRING: "bg-green-400",
  BEZIER: "bg-purple-400",
  LINEAR: "bg-gray-500",
};

/**
 * Multi-track timeline sequencer panel. Shows each component as a horizontal
 * track with its delay/duration as a colored bar. Supports click-to-select,
 * drag-to-reorder, and one-click Agent actions for timing adjustments.
 */
export function TimelineSequencer() {
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const sorted = useMemo(() => {
    return [...components].sort((a, b) => a.orderIndex - b.orderIndex);
  }, [components]);

  const totalDuration = useMemo(() => {
    if (sorted.length === 0) return 0;
    return Math.max(...sorted.map((c) => c.delayMs + c.durationMs));
  }, [sorted]);

  const handleReorder = useCallback(
    async (fromIdx: number, toIdx: number) => {
      if (fromIdx === toIdx || !projectId) return;
      const reordered = [...sorted];
      const [moved] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, moved);
      const orderedIds = reordered.map((c) => c.id);
      try {
        await reorderComponents(projectId, orderedIds);
        await useProjectStore.getState().loadProject(projectId);
      } catch { /* ignore reorder errors */ }
    },
    [sorted, projectId],
  );

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        No project loaded.
      </div>
    );
  }

  const send = useChatStore.getState().send;
  const maxDuration = Math.max(totalDuration, 1000);
  const rulerMarks = useMemo(() => {
    const step = maxDuration > 5000 ? 1000 : maxDuration > 2000 ? 500 : 250;
    const marks: number[] = [];
    for (let t = 0; t <= maxDuration; t += step) marks.push(t);
    return marks;
  }, [maxDuration]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Timeline Sequencer
          </span>
          <span className="text-[9px] font-mono text-gray-600">
            {(totalDuration / 1000).toFixed(1)}s total
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="px-4 py-6 text-center text-[10px] text-gray-600">
            Add components to see the timeline.
          </div>
        ) : (
          <div className="p-2">
            {/* Time ruler */}
            <div className="flex items-end h-4 mb-1 border-b border-edge relative">
              <div className="w-20 flex-shrink-0" />
              <div className="flex-1 relative">
                {rulerMarks.map((t) => (
                  <div
                    key={t}
                    className="absolute flex flex-col items-center"
                    style={{ left: `${(t / maxDuration) * 100}%` }}
                  >
                    <div className="w-px h-2 bg-gray-700" />
                    <span className="text-[7px] font-mono text-gray-700 mt-0.5">
                      {t >= 1000 ? `${(t / 1000).toFixed(1)}s` : `${t}ms`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tracks */}
            <div className="space-y-0.5">
              {sorted.map((comp, idx) => (
                <TimelineTrack
                  key={comp.id}
                  component={comp}
                  index={idx}
                  maxDuration={maxDuration}
                  isSelected={selectedId === comp.id}
                  isDragOver={dragOverIndex === idx}
                  isDragging={dragIndex === idx}
                  onSelect={() => selectComponent(comp.id)}
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverIndex(idx);
                  }}
                  onDrop={() => {
                    if (dragIndex !== null) handleReorder(dragIndex, idx);
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                />
              ))}
            </div>

            {/* Quick actions */}
            <div className="mt-3 space-y-1.5">
              <button
                onClick={() => send(projectId, "Stagger all components with 100ms cascade delays")}
                className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
                title="Apply cascade stagger via the Agent"
              >
                Stagger All (Cascade)
              </button>
              <button
                onClick={() => send(projectId, "Apply ripple out choreography to all components")}
                className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
                title="Apply ripple-out choreography via the Agent"
              >
                Ripple from Center
              </button>
              <button
                onClick={() => send(projectId, "Set all components to the same duration as the first component")}
                className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
                title="Unify durations via the Agent"
              >
                Unify Durations
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineTrack({
  component,
  index,
  maxDuration,
  isSelected,
  isDragOver,
  isDragging,
  onSelect,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  component: MotionComponent;
  index: number;
  maxDuration: number;
  isSelected: boolean;
  isDragOver: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const dna = buildMotionDna(component);
  const easingToken = dna.split("|")[0] ?? "LINEAR";
  const barColor = EASING_COLORS[easingToken] ?? "bg-gray-500";
  const startPct = (component.delayMs / maxDuration) * 100;
  const widthPct = (component.durationMs / maxDuration) * 100;
  const hasLoop = component.iterationCount === "infinite" || (typeof component.iterationCount === "number" && component.iterationCount > 1);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={onSelect}
      className={`flex items-center h-6 group cursor-pointer transition-colors ${
        isSelected ? "bg-panel2" : isDragOver ? "bg-panel2/50" : "hover:bg-panel2/30"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      {/* Track label */}
      <div className="w-20 flex-shrink-0 px-1.5 flex items-center gap-1">
        <span className="text-[8px] font-mono text-gray-700 cursor-grab active:cursor-grabbing" title="Drag to reorder">⠿</span>
        <span className={`text-[9px] truncate flex-1 ${isSelected ? "text-gray-200" : "text-gray-500"}`}>
          {component.name}
        </span>
      </div>

      {/* Track bar area */}
      <div className="flex-1 relative h-4">
        {/* Track background */}
        <div className="absolute inset-0 border-t border-b border-edge/30" />

        {/* Delay indicator */}
        {component.delayMs > 0 && (
          <div
            className="absolute top-0 bottom-0 border-r border-dashed border-gray-700"
            style={{ left: `${startPct}%` }}
          />
        )}

        {/* Duration bar */}
        <div
          className={`absolute top-0.5 bottom-0.5 ${barColor} ${hasLoop ? "opacity-70" : "opacity-90"} group-hover:opacity-100 transition-opacity`}
          style={{
            left: `${startPct}%`,
            width: `${Math.max(widthPct, 1)}%`,
          }}
          title={`${component.name}: ${component.delayMs}ms delay, ${component.durationMs}ms duration, ${easingToken}`}
        >
          {hasLoop && (
            <span className="absolute right-0.5 top-0 text-[7px] text-black/60">↻</span>
          )}
        </div>

        {/* Keyframe markers */}
        {component.keyframes.map((kf, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-white/40"
            style={{ left: `${((component.delayMs + kf.offset * component.durationMs) / maxDuration) * 100}%` }}
          />
        ))}
      </div>

      {/* Duration label */}
      <div className="w-12 flex-shrink-0 px-1 text-right">
        <span className="text-[8px] font-mono text-gray-600">
          {component.durationMs}ms
        </span>
      </div>
    </div>
  );
}
