import { useEffect } from "react";
import { useProjectStore } from "../store/projectStore.js";
import { useUiStore } from "../store/uiStore.js";
import { MotionCanvas } from "../components/canvas/MotionCanvas.js";
import { TimelineBar } from "../components/timeline/TimelineBar.js";
import { ChatPanel } from "../components/chat/ChatPanel.js";
import { ComponentInspector } from "../components/inspector/ComponentInspector.js";
import { ExportDialog } from "../components/export/ExportDialog.js";
import { useKeyboard } from "../hooks/useKeyboard.js";

export function Editor() {
  const projectId = useProjectStore((s) => s.projectId);
  const project = useProjectStore((s) => s.project);
  const components = useProjectStore((s) => s.components);
  const reset = useProjectStore((s) => s.reset);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const setView = useUiStore((s) => s.setView);
  const setExportOpen = useUiStore((s) => s.setExportOpen);
  const triggerReplay = useUiStore((s) => s.triggerReplay);

  useEffect(() => {
    if (!projectId) setView("gallery");
  }, [projectId, setView]);

  useKeyboard();

  if (!projectId) return null;

  const sorted = [...components].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="flex h-full">
      {/* Left: layers */}
      <aside className="w-60 bg-panel border-r border-edge flex flex-col">
        <div className="px-3 py-2 border-b border-edge">
          <button
            onClick={() => {
              reset();
              setView("gallery");
            }}
            className="text-xs text-gray-400 hover:text-accent"
          >
            ← Gallery
          </button>
        </div>
        <div className="px-3 py-2 border-b border-edge text-[10px] uppercase tracking-wide text-gray-500">
          Layers
        </div>
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 && (
            <div className="px-3 py-4 text-xs text-gray-600">No layers yet.</div>
          )}
          {sorted.map((c) => (
            <button
              key={c.id}
              onClick={() => selectComponent(selectedId === c.id ? null : c.id)}
              className={`w-full text-left px-3 py-2 text-sm border-b border-edge/50 transition-colors ${
                selectedId === c.id
                  ? "bg-accent/20 text-accent"
                  : "text-gray-300 hover:bg-panel2"
              }`}
            >
              <div className="truncate">{c.name}</div>
              <div className="text-[10px] text-gray-600 font-mono">{c.id}</div>
            </button>
          ))}
        </div>
        <div className="px-3 py-2 border-t border-edge text-[10px] text-gray-600 truncate">
          {project?.name ?? "Untitled"}
        </div>
      </aside>

      {/* Center: canvas + timeline */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 min-h-0 p-3">
          <MotionCanvas />
        </div>
        <TimelineBar onReplay={triggerReplay} />
      </main>

      {/* Right: chat + inspector + export */}
      <aside className="w-96 bg-panel border-l border-edge flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col">
          <ChatPanel />
        </div>
        <ComponentInspector />
        <div className="p-3 border-t border-edge">
          <button
            onClick={() => setExportOpen(true)}
            className="w-full px-3 py-2 rounded-lg bg-accent hover:bg-accent2 text-white text-sm font-medium transition-colors"
          >
            Export
          </button>
        </div>
      </aside>

      <ExportDialog />
    </div>
  );
}
