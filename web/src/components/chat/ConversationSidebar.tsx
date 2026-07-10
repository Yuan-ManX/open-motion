import { useState, useEffect, useCallback, useRef } from "react";
import type { ProjectResponse } from "@openmotion/shared";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";

interface ConversationItem {
  id: string;
  name: string;
  layerCount: number;
  updatedAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * ChatGPT-style leftmost sidebar for managing all conversations.
 * Each project maps to one conversation thread. Supports creating,
 * searching, renaming, and deleting conversations.
 */
export function ConversationSidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const setRightPanelTab = useUiStore((s) => s.setRightPanelTab);

  const projectId = useProjectStore((s) => s.projectId);
  const loadProject = useProjectStore((s) => s.loadProject);
  const reset = useProjectStore((s) => s.reset);

  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await api.listProjects();
      const mapped: ConversationItem[] = list.map((p: ProjectResponse) => {
        const spec = p.spec as { components?: unknown[] } | null;
        return {
          id: p.id,
          name: p.name,
          layerCount: spec?.components?.length ?? 0,
          updatedAt: p.updatedAt ?? p.createdAt ?? new Date().toISOString(),
        };
      });
      mapped.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setItems(mapped);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto-refresh when project changes (new project may have been created)
  useEffect(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => void refresh(), 500);
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [projectId, refresh]);

  const handleNew = useCallback(async () => {
    const p = await api.createProject({ name: "Untitled motion" });
    await loadProject(p.id);
  }, [loadProject]);

  const handleOpen = useCallback(async (id: string) => {
    if (id === projectId) return;
    await loadProject(id);
  }, [projectId, loadProject]);

  const handleStartRename = useCallback((id: string, name: string) => {
    setRenamingId(id);
    setRenameValue(name);
  }, []);

  const handleCommitRename = useCallback(async () => {
    if (!renamingId) return;
    const name = renameValue.trim();
    const id = renamingId;
    setRenamingId(null);
    if (!name) return;
    try {
      await api.updateProject(id, { name });
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    } catch {
      /* ignore */
    }
  }, [renamingId, renameValue]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await api.deleteProject(id);
      if (id === projectId) reset();
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* ignore */
    }
    setConfirmDeleteId(null);
  }, [projectId, reset]);

  const handleClearAll = useCallback(async () => {
    setClearingAll(true);
    try {
      await Promise.all(items.map((c) => api.deleteProject(c.id).catch(() => {})));
      reset();
      setItems([]);
    } catch {
      /* ignore */
    } finally {
      setClearingAll(false);
      setConfirmClearAll(false);
    }
  }, [items, reset]);

  const handleTemplate = useCallback(() => {
    setRightPanelTab("templates");
  }, [setRightPanelTab]);

  const handleSkills = useCallback(() => {
    setRightPanelTab("skills");
  }, [setRightPanelTab]);

  const filtered = search.trim()
    ? items.filter((c) => c.name.toLowerCase().includes(search.toLowerCase().trim()))
    : items;

  // Collapsed state: thin strip with expand button
  if (collapsed) {
    return (
      <div className="w-12 bg-panel border-r border-edge flex flex-col items-center py-3 gap-3 flex-shrink-0">
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="w-8 h-8 rounded-lg bg-panel2 border border-edge hover:border-accent flex items-center justify-center text-gray-400 hover:text-gray-200 transition-colors"
          title="Expand sidebar"
          aria-label="Expand sidebar"
        >
          <span className="text-sm">≣</span>
        </button>
        <button
          onClick={handleNew}
          className="w-8 h-8 rounded-lg bg-accent hover:bg-accent2 flex items-center justify-center text-black transition-colors"
          title="New conversation"
          aria-label="New conversation"
        >
          +
        </button>
        <div className="flex-1" />
      </div>
    );
  }

  return (
    <div
      className="bg-panel border-r border-edge flex flex-col flex-shrink-0"
      style={{ width: sidebarWidth }}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-edge flex items-center gap-2 flex-shrink-0">
        <span className="text-xs font-semibold text-gray-300 tracking-tight">Conversations</span>
        <button
          onClick={() => setSidebarCollapsed(true)}
          className="ml-auto w-6 h-6 rounded text-gray-500 hover:text-gray-300 hover:bg-panel2 flex items-center justify-center transition-colors"
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <span className="text-xs">‹</span>
        </button>
      </div>

      {/* New conversation + quick actions */}
      <div className="px-2.5 py-2 space-y-1.5 flex-shrink-0 border-b border-edge">
        <button
          onClick={handleNew}
          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-accent hover:bg-accent2 text-black text-xs font-medium transition-colors"
        >
          <span className="text-sm leading-none">+</span>
          <span>New conversation</span>
        </button>
        <div className="flex gap-1.5">
          <button
            onClick={handleTemplate}
            className="flex-1 px-2 py-1.5 rounded-md bg-panel2 border border-edge hover:border-accent text-gray-400 hover:text-gray-200 text-[11px] transition-colors"
          >
            Templates
          </button>
          <button
            onClick={handleSkills}
            className="flex-1 px-2 py-1.5 rounded-md bg-panel2 border border-edge hover:border-accent text-gray-400 hover:text-gray-200 text-[11px] transition-colors"
          >
            Skills
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-2.5 py-2 flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full bg-panel2 border border-edge rounded-md pl-7 pr-8 py-1.5 text-xs text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-accent transition-colors"
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs">⌕</span>
          {items.length > 0 && !search && (
            <button
              onClick={() => setConfirmClearAll(true)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded text-gray-600 hover:text-red-400 flex items-center justify-center text-[11px] transition-colors"
              title="Clear all conversations"
              aria-label="Clear all conversations"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
        {confirmClearAll && (
          <div className="mb-1.5 px-2.5 py-2.5 space-y-2 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-[11px] text-gray-300">
              Clear all <span className="text-red-400 font-medium">{items.length}</span> conversations? This cannot be undone.
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={handleClearAll}
                disabled={clearingAll}
                className="flex-1 px-2 py-1.5 rounded text-[10px] bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium transition-colors"
              >
                {clearingAll ? "Clearing…" : "Clear all"}
              </button>
              <button
                onClick={() => setConfirmClearAll(false)}
                disabled={clearingAll}
                className="flex-1 px-2 py-1.5 rounded text-[10px] bg-panel2 border border-edge text-gray-400 hover:text-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {loading && (
          <div className="text-center text-gray-600 text-xs py-6">Loading…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center text-gray-600 text-xs py-6 px-3">
            {search ? "No matches found." : "No conversations yet."}
          </div>
        )}
        {filtered.map((c) => {
          const isActive = c.id === projectId;
          const isRenaming = renamingId === c.id;
          const isConfirming = confirmDeleteId === c.id;
          return (
            <div
              key={c.id}
              className={`group relative rounded-lg transition-colors ${
                isActive
                  ? "bg-panel2 border border-edge"
                  : "border border-transparent hover:bg-panel2/60"
              }`}
            >
              {isRenaming ? (
                <div className="px-2 py-1.5">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={handleCommitRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCommitRename();
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    autoFocus
                    className="w-full bg-ink border border-accent rounded px-1.5 py-1 text-xs text-gray-200 focus:outline-none"
                  />
                </div>
              ) : isConfirming ? (
                <div className="px-2 py-2 space-y-1.5">
                  <p className="text-[10px] text-gray-500">Delete this conversation?</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="flex-1 px-2 py-1 rounded text-[10px] bg-red-500 hover:bg-red-600 text-white transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 px-2 py-1 rounded text-[10px] bg-panel2 border border-edge text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleOpen(c.id)}
                    className="w-full text-left px-2.5 py-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs truncate flex-1 ${
                          isActive ? "text-gray-100 font-medium" : "text-gray-400"
                        }`}
                      >
                        {c.name}
                      </span>
                      {c.layerCount > 0 && (
                        <span className="text-[9px] text-gray-600 font-mono flex-shrink-0">
                          {c.layerCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-600">
                      {timeAgo(c.updatedAt)}
                    </span>
                  </button>
                  {/* Hover actions */}
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-panel2/90 rounded px-0.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(c.id, c.name);
                      }}
                      className="w-5 h-5 rounded text-gray-500 hover:text-gray-200 flex items-center justify-center text-[10px]"
                      title="Rename"
                      aria-label="Rename conversation"
                    >
                      ✎
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(c.id);
                      }}
                      className="w-5 h-5 rounded text-gray-500 hover:text-red-400 flex items-center justify-center text-[10px]"
                      title="Delete"
                      aria-label="Delete conversation"
                    >
                      ✕
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
