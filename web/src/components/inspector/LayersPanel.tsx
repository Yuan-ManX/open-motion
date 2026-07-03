import { useState } from "react";
import { EASING_PRESETS } from "@openmotion/shared";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";

export function LayersPanel() {
  const components = useProjectStore((s) => s.components);
  const projectId = useProjectStore((s) => s.projectId);
  const patchComponentLocal = useProjectStore((s) => s.patchComponentLocal);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const selectComponent = useUiStore((s) => s.selectComponent);
  const triggerReplay = useUiStore((s) => s.triggerReplay);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState("");

  const sorted = [...components].sort((a, b) => a.orderIndex - b.orderIndex);

  const toggleVisible = (id: string) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHidden(next);
  };

  const handleAdd = async () => {
    if (!projectId || !newName.trim()) return;
    try {
      const comp = await api.createComponent(projectId, {
        name: newName.trim(),
        templateId: newTemplate || undefined,
      });
      patchComponentLocal(comp.id, comp);
      setNewName("");
      setNewTemplate("");
      setAdding(false);
      triggerReplay();
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
            {EASING_PRESETS.map((t) => (
              <option key={t} value={`tpl-${t.replace(/_/g, "-")}`}>
                {t}
              </option>
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
          const isHidden = hidden.has(c.id);
          return (
            <div
              key={c.id}
              onClick={() => selectComponent(isSelected ? null : c.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 border-b border-edge/50 cursor-pointer transition-colors ${
                isSelected ? "bg-accent/20" : "hover:bg-panel2"
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleVisible(c.id);
                }}
                className="text-[10px] text-gray-500 hover:text-gray-300 w-4 flex-shrink-0"
                title={isHidden ? "Show" : "Hide"}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
