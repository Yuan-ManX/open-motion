import { useState, useEffect, useRef } from "react";
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
  const patchComponentLocal = useProjectStore((s) => s.patchComponentLocal);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const triggerReplay = useUiStore((s) => s.triggerReplay);
  const hiddenIds = useUiStore((s) => s.hiddenIds);
  const toggleHidden = useUiStore((s) => s.toggleHidden);
  const lockedIds = useUiStore((s) => s.lockedIds);
  const toggleLock = useUiStore((s) => s.toggleLock);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

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

  const handleZOrder = async (componentId: string, action: "to-front" | "to-back" | "forward" | "backward") => {
    if (!projectId) return;
    const orderedIds = sorted.map((c) => c.id);
    const index = orderedIds.indexOf(componentId);
    if (index === -1) return;
    if (action === "to-front") {
      orderedIds.splice(index, 1);
      orderedIds.push(componentId);
    } else if (action === "to-back") {
      orderedIds.splice(index, 1);
      orderedIds.unshift(componentId);
    } else if (action === "forward" && index < orderedIds.length - 1) {
      [orderedIds[index], orderedIds[index + 1]] = [orderedIds[index + 1], orderedIds[index]];
    } else if (action === "backward" && index > 0) {
      [orderedIds[index], orderedIds[index - 1]] = [orderedIds[index - 1], orderedIds[index]];
    } else {
      return;
    }
    try {
      const updated = await api.reorderComponents(projectId, orderedIds);
      applySpecUpdate(updated);
    } catch {
      /* ignore */
    }
  };

  const handleDragStart = (e: React.DragEvent, componentId: string) => {
    setDraggedId(componentId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", componentId);
  };

  const handleDragOver = (e: React.DragEvent, componentId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedId && draggedId !== componentId) {
      setDragOverId(componentId);
    }
  };

  const handleDragLeave = (_componentId: string) => {
    // Only clear if leaving to a different element
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!projectId || !draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const orderedIds = sorted.map((c) => c.id);
    const fromIndex = orderedIds.indexOf(draggedId);
    const toIndex = orderedIds.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    orderedIds.splice(fromIndex, 1);
    orderedIds.splice(toIndex, 0, draggedId);
    try {
      const updated = await api.reorderComponents(projectId, orderedIds);
      applySpecUpdate(updated);
    } catch {
      /* ignore */
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const startRename = (componentId: string, currentName: string) => {
    setRenamingId(componentId);
    setRenameValue(currentName);
  };

  const commitRename = async () => {
    if (!projectId || !renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      try {
        await api.patchComponent(projectId, renamingId, { name: trimmed });
        patchComponentLocal(renamingId, { name: trimmed });
      } catch {
        /* ignore */
      }
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b border-edge flex items-center justify-end">
        {projectId && (
          <button
            onClick={() => setAdding((v) => !v)}
            className="text-xs text-gray-500 hover:text-accent w-5 h-5 flex items-center justify-center rounded hover:bg-panel2"
            title="Add layer"
            aria-label="Add layer"
          >
            +
          </button>
        )}
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
            className="w-full px-2 py-1 rounded bg-accent hover:bg-accent2 disabled:opacity-40 text-black text-[11px] transition-colors"
          >
            Add
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="px-3 py-4 text-xs text-gray-600">
            {projectId ? "No layers yet." : "No project loaded."}
          </div>
        )}
        {(() => {
          // Build tree from flat list using parentId
          const roots = sorted.filter((c) => !c.parentId);
          const childrenOf = (id: string) => sorted.filter((c) => c.parentId === id);
          const rendered: React.ReactNode[] = [];
          const renderLayer = (c: typeof sorted[number], depth: number) => {
            const isSelected = c.id === selectedId;
            const isHidden = hiddenIds.has(c.id);
            const isLocked = lockedIds.has(c.id);
            const isConfirming = confirmDeleteId === c.id;
            const isRenaming = renamingId === c.id;
            const isDragged = draggedId === c.id;
            const isDragOver = dragOverId === c.id;
            const kids = childrenOf(c.id);
            rendered.push(
              <div
                key={c.id}
                draggable={!isRenaming}
                onDragStart={(e) => handleDragStart(e, c.id)}
                onDragOver={(e) => handleDragOver(e, c.id)}
                onDragLeave={() => handleDragLeave(c.id)}
                onDrop={(e) => handleDrop(e, c.id)}
                onDragEnd={handleDragEnd}
                onClick={() => !isRenaming && selectComponent(isSelected ? null : c.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(c.id, c.name);
                }}
                className={`group flex items-center gap-1.5 px-2 py-1.5 border-b border-edge/50 cursor-pointer transition-colors ${depth > 0 ? "pl-" + (4 + depth * 3) : ""} ${
                  isSelected ? "bg-accent/20" : "hover:bg-panel2"
                } ${isDragged ? "opacity-40" : ""} ${isDragOver ? "border-t-2 border-t-accent" : ""}`}
                style={depth > 0 ? { paddingLeft: `${8 + depth * 16}px` } : undefined}
              >
                {depth > 0 && <span className="text-gray-700 text-[10px] flex-shrink-0">↳</span>}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLock(c.id);
                  }}
                  className={`text-[10px] w-4 flex-shrink-0 ${isLocked ? "text-accent" : "text-gray-600 hover:text-gray-300"}`}
                  title={isLocked ? "Unlock" : "Lock"}
                  aria-label={isLocked ? `Unlock layer ${c.name}` : `Lock layer ${c.name}`}
                  aria-pressed={isLocked}
                >
                  {isLocked ? "🔒" : "🔓"}
                </button>
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
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onBlur={() => void commitRename()}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full bg-panel2 border border-accent rounded px-1 py-0.5 text-xs text-gray-100 focus:outline-none"
                      aria-label="Rename layer"
                    />
                  ) : (
                    <>
                      <div className={`text-xs truncate ${isSelected ? "text-accent" : "text-gray-300"}`}>
                        {c.name}
                      </div>
                      <div className="text-[9px] text-gray-600 font-mono">
                        {c.durationMs}ms · {c.easing?.type === "preset" ? c.easing.name : c.easing?.type}
                      </div>
                    </>
                  )}
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
                        void handleZOrder(c.id, "to-front");
                      }}
                      className="text-[9px] text-gray-600 hover:text-accent w-3.5"
                      title="Bring to front"
                      aria-label={`Bring layer ${c.name} to front`}
                    >
                      ⤒
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleZOrder(c.id, "to-back");
                      }}
                      className="text-[9px] text-gray-600 hover:text-accent w-3.5"
                      title="Send to back"
                      aria-label={`Send layer ${c.name} to back`}
                    >
                      ⤓
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
            kids.forEach((k) => renderLayer(k, depth + 1));
          };
          roots.forEach((r) => renderLayer(r, 0));
          return rendered;
        })()}
      </div>
      {sorted.length > 0 && (
        <div className="px-3 py-1 border-t border-edge text-[9px] text-gray-700">
          Drag to reorder · double-click to rename
        </div>
      )}
    </div>
  );
}
