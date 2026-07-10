import { useEffect, useState, useCallback } from "react";
import type { ProjectResponse } from "@openmotion/shared";
import { useProjectStore } from "../store/projectStore.js";
import { useUiStore } from "../store/uiStore.js";
import { MotionCanvas } from "../components/canvas/MotionCanvas.js";
import { TimelineBar } from "../components/timeline/TimelineBar.js";
import { ChatPanel } from "../components/chat/ChatPanel.js";
import { RightPanel } from "../components/layout/RightPanel.js";
import { ResizableDivider } from "../components/layout/ResizableDivider.js";
import { ExportDialog } from "../components/export/ExportDialog.js";
import { PreviewOverlay } from "../components/canvas/PreviewOverlay.js";
import { ContextMenu } from "../components/canvas/ContextMenu.js";
import { ApiKeyButton } from "../components/settings/ApiKeyButton.js";
import { TemplateGallery } from "../components/templates/TemplateGallery.js";
import { useKeyboard } from "../hooks/useKeyboard.js";
import * as api from "../api/endpoints.js";

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
      {/* Left: Agent Chat (resizable) */}
      <aside
        className="bg-panel flex flex-col flex-shrink-0"
        style={{ width: chatWidth }}
      >
        <div className="px-4 py-2.5 border-b border-edge flex items-center gap-2 flex-shrink-0">
          {projectId && (
            <button
              onClick={() => reset()}
              className="text-xs text-gray-400 hover:text-accent transition-colors"
              title="Back to home"
              aria-label="Back to home"
            >
              ←
            </button>
          )}
          <span className="text-sm font-semibold text-gray-200 tracking-tight">Agent</span>
          <span className="text-[9px] text-gray-600 font-mono px-1.5 py-0.5 rounded border border-edge">
            AI
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] text-gray-600">ready</span>
          </div>
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

      {/* Right: Motion Editor */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-edge flex items-center gap-3 bg-panel flex-shrink-0">
          <span className="text-sm font-medium text-gray-200 truncate">
            {project?.name ?? "OpenMotion"}
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
            <button
              onClick={() => setExportOpen(true)}
              disabled={!projectId}
              className="px-3 py-1 rounded-md bg-accent hover:bg-accent2 disabled:opacity-30 disabled:cursor-not-allowed text-black text-xs font-medium transition-colors"
            >
              Export
            </button>
            <ApiKeyButton />
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
            {projectId ? <MotionCanvas /> : <HomePanel />}
          </div>
          <RightPanel />
        </div>

        {/* Timeline */}
        {projectId ? (
          <TimelineBar onReplay={triggerReplay} />
        ) : (
          <div className="bg-panel border-t border-edge px-4 py-3 text-center text-xs text-gray-600">
            Create a project to start animating.
          </div>
        )}
      </main>

      <ExportDialog />
      <PreviewOverlay />
      <ContextMenu />
    </div>
  );
}

/** Home panel shown in the canvas area when no project is loaded. */
function HomePanel() {
  const loadProject = useProjectStore((s) => s.loadProject);
  const setRightPanelTab = useUiStore((s) => s.setRightPanelTab);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listProjects();
      setProjects(list);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleNew = useCallback(async () => {
    const p = await api.createProject({ name: "Untitled motion" });
    await loadProject(p.id);
  }, [loadProject]);

  const handleOpen = useCallback(
    async (id: string) => {
      await loadProject(id);
    },
    [loadProject],
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      const p = await api.duplicateProject(id);
      await loadProject(p.id);
    },
    [loadProject],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await api.deleteProject(id);
      void refresh();
    },
    [refresh],
  );

  return (
    <div className="h-full overflow-y-auto bg-ink rounded-xl border border-edge">
      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="inline-block w-2 h-2 rounded-full bg-accent" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-gray-600">AI-native motion design</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-100 tracking-tight">OpenMotion</h1>
          <p className="text-sm text-gray-500 mt-2">
            Conversation as cursor, motion as code.
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={handleNew}
            className="px-5 py-2.5 rounded-lg bg-accent hover:bg-accent2 text-black text-sm font-medium transition-colors"
          >
            + New Project
          </button>
          <button
            onClick={() => setRightPanelTab("templates")}
            className="px-5 py-2.5 rounded-lg bg-panel2 border border-edge hover:border-accent text-gray-300 text-sm transition-colors"
          >
            Browse Templates
          </button>
          <button
            onClick={() => setRightPanelTab("skills")}
            className="px-5 py-2.5 rounded-lg bg-panel2 border border-edge hover:border-accent text-gray-300 text-sm transition-colors"
          >
            Skills
          </button>
        </div>

        {/* Featured Templates */}
        <div className="mb-10">
          <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-2">
            <span>Featured Templates</span>
            <span className="flex-1 h-px bg-edge" />
            <button
              onClick={() => setRightPanelTab("templates")}
              className="text-[10px] text-gray-600 hover:text-accent normal-case tracking-normal"
            >
              view all →
            </button>
          </h2>
          <div className="rounded-xl border border-edge bg-panel2 overflow-hidden">
            <TemplateGallery compact limit={6} />
          </div>
        </div>

        {/* Recent projects */}
        <div>
          <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3 flex items-center gap-2">
            <span>Recent Projects</span>
            <span className="flex-1 h-px bg-edge" />
          </h2>
          {loading && <div className="text-sm text-gray-600">Loading…</div>}
          {!loading && projects.length === 0 && (
            <div className="text-sm text-gray-600 py-8 text-center border border-dashed border-edge rounded-lg">
              No projects yet. Create one above to get started.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {projects.map((p) => {
              const spec = p.spec as { components?: unknown[] } | null;
              const compCount = spec?.components?.length ?? 0;
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-edge bg-panel2 hover:border-accent transition-colors p-4 group"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-200 truncate">{p.name}</div>
                      <div className="text-[10px] text-gray-600 font-mono mt-0.5">{p.id}</div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        {compCount} {compCount === 1 ? "layer" : "layers"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-3">
                    <button
                      onClick={() => handleOpen(p.id)}
                      className="px-3 py-1 rounded text-xs bg-accent hover:bg-accent2 text-black transition-colors"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => handleDuplicate(p.id)}
                      className="px-2 py-1 rounded text-xs bg-panel border border-edge hover:border-accent text-gray-400 transition-colors"
                    >
                      Duplicate
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="px-2 py-1 rounded text-xs bg-panel border border-edge hover:border-red-500 text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
