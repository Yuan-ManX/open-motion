import { useState, useEffect, useCallback } from "react";
import type { ProjectResponse } from "@openmotion/shared";
import { useUiStore } from "../store/uiStore.js";
import { useProjectStore } from "../store/projectStore.js";
import * as api from "../api/endpoints.js";
import { TemplateGallery } from "../components/templates/TemplateGallery.js";

export function Gallery() {
  const setView = useUiStore((s) => s.setView);
  const health = useUiStore((s) => s.health);
  const loadProject = useProjectStore((s) => s.loadProject);
  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listProjects();
      setProjects(list);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openProject = useCallback(
    async (id: string) => {
      await loadProject(id);
      setView("editor");
    },
    [loadProject, setView],
  );

  const duplicate = useCallback(
    async (id: string) => {
      try {
        await api.duplicateProject(id);
        await refresh();
      } catch {
        /* ignore */
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await api.deleteProject(id);
        await refresh();
      } catch {
        /* ignore */
      }
    },
    [refresh],
  );

  const rename = useCallback(
    async (id: string, oldName: string) => {
      const name = window.prompt("Rename project", oldName);
      if (!name || !name.trim() || name === oldName) return;
      try {
        await api.updateProject(id, { name: name.trim() });
        await refresh();
      } catch {
        /* ignore */
      }
    },
    [refresh],
  );

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-5 border-b border-edge flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">OpenMotion</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            AI-native motion design — pick a template or resume a project.
          </p>
        </div>
        <button
          onClick={() => setView("skills")}
          className="px-3 py-1.5 rounded-lg bg-panel2 border border-edge hover:border-accent text-sm text-gray-300 transition-colors"
        >
          Skills
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {/* Recent Projects */}
        <section className="px-6 py-5 border-b border-edge">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Recent Projects</h2>
            <button
              onClick={() => void refresh()}
              className="text-[11px] text-gray-500 hover:text-accent"
            >
              refresh
            </button>
          </div>
          {loading ? (
            <p className="text-xs text-gray-600">Loading…</p>
          ) : projects.length === 0 ? (
            <p className="text-xs text-gray-600">
              No projects yet — pick a template below to start.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {projects.map((p) => {
                const spec = p.spec as { components?: unknown[] } | undefined;
                const count = Array.isArray(spec?.components) ? spec!.components!.length : 0;
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border border-edge bg-panel2 p-3 flex flex-col gap-2 hover:border-accent transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-gray-200 truncate">{p.name || "Untitled"}</div>
                      <div className="text-[10px] text-gray-600 font-mono truncate">{p.id}</div>
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {count} layer{count === 1 ? "" : "s"}
                      {p.updatedAt ? ` · ${new Date(p.updatedAt).toLocaleDateString()}` : ""}
                    </div>
                    <div className="flex items-center gap-1 mt-auto">
                      <button
                        onClick={() => void openProject(p.id)}
                        className="flex-1 px-2 py-1 rounded bg-accent hover:bg-accent2 text-white text-[11px] transition-colors"
                      >
                        Open
                      </button>
                      <button
                        onClick={() => void duplicate(p.id)}
                        className="px-2 py-1 rounded border border-edge bg-panel hover:border-accent text-[11px] text-gray-300"
                        title="Duplicate"
                      >
                        ⧉
                      </button>
                      <button
                        onClick={() => void rename(p.id, p.name || "Untitled")}
                        className="px-2 py-1 rounded border border-edge bg-panel hover:border-accent text-[11px] text-gray-300"
                        title="Rename"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => void remove(p.id)}
                        className="px-2 py-1 rounded border border-edge bg-panel hover:border-red-400 text-[11px] text-gray-400"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Templates */}
        <section className="px-6 py-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Templates</h2>
          <TemplateGallery />
        </section>
      </div>

      <footer className="px-6 py-2 border-t border-edge flex items-center gap-4 text-[10px] text-gray-600">
        <span>provider: <span className="text-gray-400">{health?.provider ?? "—"}</span></span>
        <span>db: <span className={health?.db ? "text-green-400" : "text-red-400"}>{health?.db ? "ok" : "down"}</span></span>
        <span>puppeteer: <span className={health?.puppeteer ? "text-green-400" : "text-gray-500"}>{health?.puppeteer ? "yes" : "no"}</span></span>
        <span>ffmpeg: <span className={health?.ffmpeg ? "text-green-400" : "text-gray-500"}>{health?.ffmpeg ? "yes" : "no"}</span></span>
      </footer>
    </div>
  );
}
