import { useState, useEffect } from "react";
import type { Template } from "@openmotion/shared";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";

export function LayersPanel() {
  const components = useProjectStore((s) => s.components);
  const projectId = useProjectStore((s) => s.projectId);
  const addComponentLocal = useProjectStore((s) => s.addComponentLocal);
  const removeComponentLocal = useProjectStore((s) => s.removeComponentLocal);
  const applySpecUpdate = useProjectStore((s) => s.applySpecUpdate);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const triggerReplay = useUiStore((s) => s.triggerReplay);
  const hiddenIds = useUiStore((s) => s.hiddenIds);
  const toggleHidden = useUiStore((s) => s.toggleHidden);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.listTemplates().then((t) => {
      if (alive) setTemplates(t);
    }).catch(() => { /* keep empty */ });
    return () => { alive = false; };
  }, []);

  const sorted = [...components].sort((a, b) => a.orderIndex - b.orderIndex);
  const grouped = templates.reduce<Record<string, Template[]>>((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {});

  const handleAdd = async () => {
    if (!projectId || !newName.trim()) return;
    try {
      const comp = await api.createComponent(projectId, {
        name: newName.trim(),
        templateId: newTemplate || undefined,
      });
      addComponentLocal(comp);
      setNewName("");
      setNewTemplate("");
      setAdding(false);
      triggerReplay();
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (componentId: string) => {
    if (!projectId) return;
    try {
      await api.removeComponent(projectId, componentId);
      removeComponentLocal(componentId);
      if (selectedId === componentId) selectComponent(null);
    } catch {
      /* ignore */
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleDuplicate = async (componentId: string) => {
    if (!projectId) return;
    try {
      const clone = await api.duplicateComponent(projectId, componentId);
      addComponentLocal(clone);
      triggerReplay();
    } catch {
      /* ignore */
    }
  };

  const handleReorder = async (componentId: string, direction: "up" | "down") => {
    if (!projectId) return;
    const orderedIds = sorted.map((c) => c.id);
    const index = orderedIds.indexOf(componentId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === orderedIds.length - 1) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [orderedIds[index], orderedIds[swapIndex]] = [orderedIds[swapIndex], orderedIds[index]];
    try {
      const updated = await api.reorderComponents(projectId, orderedIds);
      applySpecUpdate(updated);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="w-44 bg-panel border-r border-edge flex flex-col">
      <div className="px-3 py-2 border-b border-edge flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">Layers</span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-xs text-gray-500 hover:text-accent w-5 h-5 flex items-center justify-center rounded hover:bg-panel2"
          title="Add layer"
          aria-label="Add layer"
        >
          +
        </button>
      </div>

      {adding && (
        <div className="px-2 py-2 border-b border-edge space-y-1">
          <input
            type="text"
            placeholder="Layer name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full bg-panel2 border border-edge rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-accent"
          />
          <select
            value={newTemplate}
            onChange={(e) => setNewTemplate(e.target.value)}
            className="w-full bg-panel2 border border-edge rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-accent"
          >
            <option value="">— pick template —</option>
            {Object.entries(grouped).map(([cat, list]) => (
              <optgroup key={cat} label={cat}>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="w-full px-2 py-1 rounded bg-accent hover:bg-accent2 disabled:opacity-40 text-white text-[11px] transition-colors"
          >
            Add
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="px-3 py-4 text-xs text-gray-600">No layers yet.</div>
        )}
        {sorted.map((c) => {
          const isSelected = c.id === selectedId;
          const isHidden = hiddenIds.has(c.id);
          const isConfirming = confirmDeleteId === c.id;
          return (
            <div
              key={c.id}
              onClick={() => selectComponent(isSelected ? null : c.id)}
              className={`group flex items-center gap-1.5 px-2 py-1.5 border-b border-edge/50 cursor-pointer transition-colors ${
                isSelected ? "bg-accent/20" : "hover:bg-panel2"
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleHidden(c.id);
                }}
                className="text-[10px] text-gray-500 hover:text-gray-300 w-4 flex-shrink-0"
                title={isHidden ? "Show" : "Hide"}
                aria-label={isHidden ? `Show layer ${c.name}` : `Hide layer ${c.name}`}
              >
                {isHidden ? "○" : "●"}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-xs truncate ${isSelected ? "text-accent" : "text-gray-300"}`}>
                  {c.name}
                </div>
                <div className="text-[9px] text-gray-600 font-mono">
                  {c.durationMs}ms · {c.easing?.type === "preset" ? c.easing.name : c.easing?.type}
                </div>
              </div>
              {isConfirming ? (
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(c.id);
                    }}
                    className="text-[9px] px-1 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white"
                    aria-label={`Confirm delete ${c.name}`}
                  >
                    ✓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(null);
                    }}
                    className="text-[9px] px-1 py-0.5 rounded bg-panel2 border border-edge text-gray-400 hover:text-gray-200"
                    aria-label={`Cancel delete ${c.name}`}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleReorder(c.id, "up");
                    }}
                    className="text-[9px] text-gray-600 hover:text-accent w-3.5"
                    title="Move up"
                    aria-label={`Move layer ${c.name} up`}
                  >
                    ↑
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleReorder(c.id, "down");
                    }}
                    className="text-[9px] text-gray-600 hover:text-accent w-3.5"
                    title="Move down"
                    aria-label={`Move layer ${c.name} down`}
                  >
                    ↓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDuplicate(c.id);
                    }}
                    className="text-[9px] text-gray-600 hover:text-accent w-3.5"
                    title="Duplicate layer"
                    aria-label={`Duplicate layer ${c.name}`}
                  >
                    ⧉
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(c.id);
                    }}
                    className="text-[10px] text-gray-600 hover:text-red-400 w-3.5"
                    title="Delete layer"
                    aria-label={`Delete layer ${c.name}`}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
