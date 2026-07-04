import { useEffect, useState, useCallback } from "react";
import type { ProjectResponse } from "@openmotion/shared";
import { useProjectStore } from "../store/projectStore.js";
import { useUiStore } from "../store/uiStore.js";
import { MotionCanvas } from "../components/canvas/MotionCanvas.js";
import { TimelineBar } from "../components/timeline/TimelineBar.js";
import { ChatPanel } from "../components/chat/ChatPanel.js";
import { ComponentInspector } from "../components/inspector/ComponentInspector.js";
import { LayersPanel } from "../components/inspector/LayersPanel.js";
import { ExportDialog } from "../components/export/ExportDialog.js";
import { ApiKeyButton } from "../components/settings/ApiKeyButton.js";
import { useKeyboard } from "../hooks/useKeyboard.js";
import * as api from "../api/endpoints.js";

export function Editor() {
  const projectId = useProjectStore((s) => s.projectId);
  const project = useProjectStore((s) => s.project);
  const loadProject = useProjectStore((s) => s.loadProject);
  const reset = useProjectStore((s) => s.reset);
  const setExportOpen = useUiStore((s) => s.setExportOpen);
  const setTemplatesOpen = useUiStore((s) => s.setTemplatesOpen);
  const setSkillsOpen = useUiStore((s) => s.setSkillsOpen);
  const triggerReplay = useUiStore((s) => s.triggerReplay);

  useKeyboard();

  if (!projectId) return <WelcomeScreen />;

  return (
    <div className="flex h-full">
      {/* Left: Agent Chat */}
      <aside className="w-80 bg-panel border-r border-edge flex flex-col flex-shrink-0">
        <div className="px-4 py-2 border-b border-edge flex items-center gap-2">
          <button
            onClick={() => {
              reset();
            }}
            className="text-xs text-gray-400 hover:text-accent"
            title="Back to welcome"
          >
            ←
          </button>
          <span className="text-sm font-semibold text-gray-200">OpenMotion Agent</span>
        </div>
        <div className="flex-1 min-h-0">
          <ChatPanel />
        </div>
      </aside>

      {/* Right: Motion Editor */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-edge flex items-center gap-3 bg-panel flex-shrink-0">
          <span className="text-sm font-medium text-gray-200 truncate">{project?.name ?? "Untitled"}</span>
          <span className="text-[10px] text-gray-600 font-mono">{projectId}</span>
          <div className="ml-auto flex items-center gap-2">
            <ApiKeyButton />
            <button
              onClick={() => setTemplatesOpen(true)}
              className="px-3 py-1 rounded-md text-xs text-gray-300 bg-panel2 border border-edge hover:border-accent transition-colors"
            >
              Templates
            </button>
            <button
              onClick={() => setSkillsOpen(true)}
              className="px-3 py-1 rounded-md text-xs text-gray-300 bg-panel2 border border-edge hover:border-accent transition-colors"
            >
              Skills
            </button>
            <button
              onClick={() => triggerReplay()}
              className="px-3 py-1 rounded-md text-xs text-gray-300 bg-panel2 border border-edge hover:border-accent transition-colors"
              title="Replay (Shift+R)"
            >
              ↻ Replay
            </button>
            <button
              onClick={() => setExportOpen(true)}
              className="px-3 py-1 rounded-md bg-accent hover:bg-accent2 text-white text-xs font-medium transition-colors"
            >
              Export
            </button>
          </div>
        </div>

        {/* Editor body: Layers | Canvas | Inspector */}
        <div className="flex-1 min-h-0 flex">
          <LayersPanel />
          <div className="flex-1 min-w-0 p-3">
            <MotionCanvas />
          </div>
          <div className="w-72 border-l border-edge flex flex-col flex-shrink-0">
            <ComponentInspector />
          </div>
        </div>

        {/* Timeline */}
        <TimelineBar onReplay={triggerReplay} />
      </main>

      <ExportDialog />
    </div>
  );
}

/** Welcome screen shown when no project is loaded — template picker + recent projects. */
function WelcomeScreen() {
  const loadProject = useProjectStore((s) => s.loadProject);
  const setTemplatesOpen = useUiStore((s) => s.setTemplatesOpen);
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
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-gray-100">OpenMotion</h1>
          <p className="text-sm text-gray-500 mt-1">AI-native motion design — conversation as cursor, motion as code.</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <button
            onClick={handleNew}
            className="px-5 py-2 rounded-lg bg-accent hover:bg-accent2 text-white text-sm font-medium transition-colors"
          >
            + New Project
          </button>
          <button
            onClick={() => setTemplatesOpen(true)}
            className="px-5 py-2 rounded-lg bg-panel2 border border-edge hover:border-accent text-gray-300 text-sm transition-colors"
          >
            Browse Templates
          </button>
        </div>

        {/* Recent projects */}
        <div>
          <h2 className="text-xs uppercase tracking-wide text-gray-500 mb-3">Recent Projects</h2>
          {loading && <div className="text-sm text-gray-600">Loading…</div>}
          {!loading && projects.length === 0 && (
            <div className="text-sm text-gray-600">No projects yet. Create one above to get started.</div>
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
                      className="px-3 py-1 rounded text-xs bg-accent hover:bg-accent2 text-white transition-colors"
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
