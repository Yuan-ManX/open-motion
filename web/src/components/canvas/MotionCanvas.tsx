import { useMemo, useState, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { renderSpec } from "../../motion/cssRenderer.js";
import { ReplayBar } from "./ReplayBar.js";

export function MotionCanvas() {
  const components = useProjectStore((s) => s.components);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const triggerReplay = useUiStore((s) => s.triggerReplay);
  const replayTrigger = useUiStore((s) => s.replayTrigger);
  const [replayKey, setReplayKey] = useState(0);

  // Any trigger bump (ReplayBar button, timeline Play, Shift+R) restarts the animation.
  useEffect(() => {
    setReplayKey((k) => k + 1);
  }, [replayTrigger]);

  const { css, nodes } = useMemo(() => renderSpec(components), [components, replayKey]);

  const totalDuration = components.reduce(
    (max, c) => Math.max(max, c.delayMs + c.durationMs * (c.iterationCount === "infinite" ? 1 : Number(c.iterationCount) || 1)),
    0,
  );

  return (
    <div className="flex flex-col h-full">
      <ReplayBar onReplay={triggerReplay} totalDurationMs={totalDuration} />
      <div
        key={replayKey}
        className="flex-1 overflow-auto flex items-center justify-center flex-wrap gap-6 p-12"
        style={{
          background: "radial-gradient(120% 120% at 50% 0%, #1b2230 0%, #0b0e14 60%)",
          borderRadius: 12,
        }}
      >
        <style>{css}</style>
        {nodes.length === 0 && (
          <p className="text-gray-500 text-sm">No components yet — pick a template or ask the agent.</p>
        )}
        {nodes.map((node) => {
          const Tag = node.tag as keyof JSX.IntrinsicElements;
          const isSelected = node.componentId === selectedId;
          return (
            <Tag
              key={node.componentId}
              className={`${node.className} cursor-pointer transition-outline`}
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
    </div>
  );
}
