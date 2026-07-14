import { useProjectStore } from "../store/projectStore.js";
import { useUiStore } from "../store/uiStore.js";
import { MotionCanvas } from "../components/canvas/MotionCanvas.js";
import { TimelineBar } from "../components/timeline/TimelineBar.js";
import { ChatPanel } from "../components/chat/ChatPanel.js";
import { ConversationSidebar } from "../components/chat/ConversationSidebar.js";
import { RightPanel } from "../components/layout/RightPanel.js";
import { ResizableDivider } from "../components/layout/ResizableDivider.js";
import { StatusBar } from "../components/layout/StatusBar.js";
import { ExportDialog } from "../components/export/ExportDialog.js";
import { PreviewOverlay } from "../components/canvas/PreviewOverlay.js";
import { ContextMenu } from "../components/canvas/ContextMenu.js";
import { useKeyboard } from "../hooks/useKeyboard.js";

export function Editor() {
  const projectId = useProjectStore((s) => s.projectId);
  const project = useProjectStore((s) => s.project);
  const reset = useProjectStore((s) => s.reset);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const setExportOpen = useUiStore((s) => s.setExportOpen);
  const setRightPanelTab = useUiStore((s) => s.setRightPanelTab);
  const setShortcutsOpen = useUiStore((s) => s.setShortcutsOpen);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const triggerReplay = useUiStore((s) => s.triggerReplay);
  const chatWidth = useUiStore((s) => s.chatWidth);
  const setChatWidth = useUiStore((s) => s.setChatWidth);

  useKeyboard();

  return (
    <div className="flex h-full">
      {/* Far left: Conversation sidebar (ChatGPT-style) */}
      <ConversationSidebar />

      {/* Agent Chat (resizable) */}
      <aside
        className="bg-panel flex flex-col flex-shrink-0"
        style={{ width: chatWidth }}
      >
        <div className="px-4 py-2.5 border-b border-edge flex items-center gap-2 flex-shrink-0">
          {projectId && (
            <button
              onClick={() => reset()}
              className="text-xs text-gray-400 hover:text-accent transition-colors"
              title="Close project"
              aria-label="Close project"
            >
              ←
            </button>
          )}
          <span className="text-sm font-semibold text-gray-200 tracking-tight">Agent</span>
        </div>
        <div className="flex-1 min-h-0">
          <ChatPanel />
        </div>
      </aside>

      {/* Resizable divider */}
      <ResizableDivider
        size={chatWidth}
        onResize={setChatWidth}
        min={280}
        max={560}
        side="left"
      />

      {/* Motion Editor */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-edge flex items-center gap-3 bg-panel flex-shrink-0">
          <span className="text-sm font-medium text-gray-200 truncate">
            {project?.name ?? "Editor"}
          </span>
          {projectId && (
            <span className="text-[10px] text-gray-600 font-mono">{projectId}</span>
          )}

          <div className="w-px h-4 bg-edge" />

          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-gray-500 bg-panel2 border border-edge hover:border-accent hover:text-gray-300 transition-colors"
            title="Command palette (Cmd+K)"
            aria-label="Open command palette"
          >
            <span>⌕</span>
            <span className="hidden lg:inline">Search…</span>
            <span className="text-[9px] font-mono text-gray-600 border border-edge rounded px-1 py-0.5">⌘K</span>
          </button>

          {projectId && (
            <div className="flex items-center border border-edge rounded-md overflow-hidden">
              <button
                onClick={undo}
                disabled={!canUndo}
                className="px-2 py-1 text-xs text-gray-300 bg-panel2 hover:bg-panel disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Undo (Cmd+Z)"
                aria-label="Undo"
              >
                ↶
              </button>
              <button
                onClick={redo}
                disabled={!canRedo}
                className="px-2 py-1 text-xs text-gray-300 bg-panel2 hover:bg-panel disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-l border-edge"
                title="Redo (Cmd+Shift+Z)"
                aria-label="Redo"
              >
                ↷
              </button>
            </div>
          )}

          {projectId && (
            <button
              onClick={() => triggerReplay()}
              className="px-2.5 py-1 rounded-md text-xs text-gray-300 bg-panel2 border border-edge hover:border-accent transition-colors"
              title="Replay (Shift+R)"
              aria-label="Replay"
            >
              ↻
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {!projectId && (
              <button
                onClick={() => setRightPanelTab("templates")}
                className="px-2.5 py-1 rounded-md text-xs text-gray-400 bg-panel2 border border-edge hover:border-accent hover:text-gray-300 transition-colors"
              >
                Templates
              </button>
            )}
            <button
              onClick={() => setExportOpen(true)}
              disabled={!projectId}
              className="px-3 py-1 rounded-md bg-accent hover:bg-accent2 disabled:opacity-30 disabled:cursor-not-allowed text-black text-xs font-medium transition-colors"
            >
              Export
            </button>
            <button
              onClick={() => setShortcutsOpen(true)}
              className="px-2 py-1 rounded-md text-xs text-gray-400 bg-panel2 border border-edge hover:border-accent transition-colors"
              title="Keyboard shortcuts (Cmd+/)"
              aria-label="Keyboard shortcuts"
            >
              ?
            </button>
          </div>
        </div>

        {/* Editor body: Canvas | Right Panel */}
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 p-3">
            <MotionCanvas />
          </div>
          <RightPanel />
        </div>

        {/* Timeline — always visible as the default non-linear editor */}
        <TimelineBar onReplay={triggerReplay} />

        {/* Status bar — project info, zoom, fps, playback, provider */}
        <StatusBar />
      </main>

      <ExportDialog />
      <PreviewOverlay />
      <ContextMenu />
    </div>
  );
}
