import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { renderSpec } from "../../motion/cssRenderer.js";

/**
 * Fullscreen preview overlay. Renders the animation in isolation without
 * editor chrome. Closes on Esc, backdrop click, or the close button.
 */
export function PreviewOverlay() {
  const open = useUiStore((s) => s.previewOpen);
  const setOpen = useUiStore((s) => s.setPreviewOpen);
  const components = useProjectStore((s) => s.components);
  const canvasSize = useUiStore((s) => s.canvasSize);
  const playbackSpeed = useUiStore((s) => s.playbackSpeed);
  const [replayKey, setReplayKey] = useState(0);

  const visibleComponents = useMemo(
    () => components.filter((c) => c.playState !== "paused"),
    [components],
  );

  const { css, nodes } = useMemo(
    () => renderSpec(visibleComponents, playbackSpeed),
    [visibleComponents, replayKey, playbackSpeed],
  );

  useEffect(() => {
    if (!open) return;
    setReplayKey((k) => k + 1);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const maxDim = Math.min(window.innerWidth - 80, window.innerHeight - 120);
  const scale = Math.min(1, maxDim / Math.max(canvasSize.width, canvasSize.height));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm fade-in-up"
      onClick={() => setOpen(false)}
    >
      <style>{css}</style>

      {/* Close button */}
      <button
        onClick={() => setOpen(false)}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-lg transition-colors"
        title="Close preview (Esc)"
        aria-label="Close fullscreen preview"
      >
        ✕
      </button>

      {/* Replay button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setReplayKey((k) => k + 1);
        }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
        title="Replay animation"
        aria-label="Replay animation"
      >
        ▶ Replay
      </button>

      {/* Canvas */}
      <div
        key={replayKey}
        onClick={(e) => e.stopPropagation()}
        className="relative"
        style={{
          width: canvasSize.width,
          height: canvasSize.height,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          background: "radial-gradient(120% 120% at 50% 0%, #161616 0%, #000000 60%)",
          borderRadius: 12,
          border: "1px solid #262626",
          boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center flex-wrap gap-4 p-8">
          {nodes.map((node) => {
            const Tag = node.tag as keyof JSX.IntrinsicElements;
            return (
              <Tag key={node.componentId} className={node.className} data-om-name={node.name}>
                {node.content}
              </Tag>
            );
          })}
        </div>
      </div>

      {/* Info badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2 text-white/60 text-xs">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        <span>Preview Mode</span>
        <span className="text-white/30">·</span>
        <span className="font-mono">{canvasSize.width}×{canvasSize.height}</span>
        <span className="text-white/30">·</span>
        <span className="font-mono">{playbackSpeed}×</span>
      </div>
    </div>
  );
}
