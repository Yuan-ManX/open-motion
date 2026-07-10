import { useState, useCallback } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import * as api from "../../api/endpoints.js";
import type { MotionComponent } from "@openmotion/shared";

interface ListenerAction {
  type: "applyState" | "playAnimation" | "setProperty";
  target: string;
  property?: string;
  value?: string | number;
}

interface Listener {
  id: string;
  componentId: string;
  eventType: "pointerEnter" | "pointerLeave" | "pointerDown" | "pointerUp" | "click";
  action: ListenerAction;
}

interface ListenerData {
  listeners: Listener[];
}

function getListeners(tokens: Record<string, string | number> | undefined): ListenerData {
  const raw = tokens?.listeners;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as ListenerData;
    } catch {
      /* ignore */
    }
  }
  return { listeners: [] };
}

function genId(): string {
  return `ls_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

const EVENT_TYPES: Listener["eventType"][] = ["click", "pointerEnter", "pointerLeave", "pointerDown", "pointerUp"];
const ACTION_TYPES: ListenerAction["type"][] = ["applyState", "playAnimation", "setProperty"];

const EVENT_LABELS: Record<Listener["eventType"], string> = {
  click: "Click",
  pointerEnter: "Hover Enter",
  pointerLeave: "Hover Leave",
  pointerDown: "Press Down",
  pointerUp: "Press Up",
};

interface Props {
  component: MotionComponent;
}

export function ListenerPanel({ component }: Props) {
  const project = useProjectStore((s) => s.project);
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const loadProject = useProjectStore((s) => s.loadProject);

  const tokens = project?.tokens ?? {};
  const data = getListeners(tokens);
  const componentListeners = data.listeners.filter((l) => l.componentId === component.id);

  const [newEvent, setNewEvent] = useState<Listener["eventType"]>("click");
  const [newAction, setNewAction] = useState<ListenerAction["type"]>("playAnimation");
  const [newTarget, setNewTarget] = useState("");
  const [newProperty, setNewProperty] = useState("opacity");
  const [newValue, setNewValue] = useState("1");

  const persistListeners = useCallback(
    async (listeners: Listener[]) => {
      if (!projectId || !project) return;
      const allListeners = data.listeners.filter((l) => l.componentId !== component.id);
      const merged = [...allListeners, ...listeners];
      const newTokens = { ...project.tokens, listeners: JSON.stringify({ listeners: merged }) };
      useProjectStore.setState((s) => ({
        project: s.project ? { ...s.project, tokens: newTokens } : s.project,
      }));
      try {
        await api.updateProject(projectId, { tokens: newTokens });
      } catch {
        /* ignore */
      }
    },
    [projectId, project, data.listeners, component.id],
  );

  const handleAdd = useCallback(async () => {
    if (!newTarget) return;
    const listener: Listener = {
      id: genId(),
      componentId: component.id,
      eventType: newEvent,
      action: {
        type: newAction,
        target: newTarget,
        ...(newAction === "setProperty" ? { property: newProperty, value: newValue } : {}),
      },
    };
    await persistListeners([...componentListeners, listener]);
    setNewTarget("");
    if (projectId) void loadProject(projectId);
  }, [newTarget, newEvent, newAction, newProperty, newValue, component.id, componentListeners, persistListeners, projectId, loadProject]);

  const handleRemove = useCallback(
    async (listenerId: string) => {
      await persistListeners(componentListeners.filter((l) => l.id !== listenerId));
      if (projectId) void loadProject(projectId);
    },
    [componentListeners, persistListeners, projectId, loadProject],
  );

  const targetName = (id: string) => {
    const comp = components.find((c) => c.id === id);
    if (comp) return comp.name;
    return id.length > 10 ? id.slice(0, 8) + "…" : id;
  };

  const labelCls = "text-[11px] uppercase tracking-wide text-gray-500 mb-1";

  return (
    <div className="border-t border-edge pt-3">
      <div className="flex items-center justify-between mb-2">
        <span className={labelCls} style={{ marginBottom: 0 }}>
          Listeners ({componentListeners.length})
        </span>
      </div>

      {/* Existing listeners */}
      {componentListeners.length === 0 && (
        <div className="text-[10px] text-gray-600 py-1.5 text-center mb-2">
          No event listeners. Add one below.
        </div>
      )}
      {componentListeners.map((l) => (
        <div
          key={l.id}
          className="group flex items-center gap-1.5 px-2 py-1.5 rounded border-b border-edge/50 hover:bg-panel2 mb-0.5"
        >
          <span className="text-[9px] text-accent2 font-mono w-16 flex-shrink-0">{EVENT_LABELS[l.eventType]}</span>
          <span className="text-[9px] text-gray-500">→</span>
          <span className="text-[10px] text-gray-300 truncate flex-1">
            {l.action.type === "setProperty"
              ? `${l.action.property}=${l.action.value}`
              : l.action.type}
          </span>
          <span className="text-[9px] text-gray-600 truncate max-w-16">{targetName(l.action.target)}</span>
          <button
            onClick={() => void handleRemove(l.id)}
            className="text-[10px] text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 flex-shrink-0"
            aria-label="Remove listener"
          >
            ×
          </button>
        </div>
      ))}

      {/* Add new listener form */}
      <div className="space-y-1 mt-2 p-2 bg-panel2 rounded border border-edge">
        <select
          value={newEvent}
          onChange={(e) => setNewEvent(e.target.value as Listener["eventType"])}
          className="w-full bg-panel border border-edge rounded px-1.5 py-1 text-[11px] text-gray-100 focus:outline-none focus:border-accent"
          aria-label="Event type"
        >
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{EVENT_LABELS[t]}</option>
          ))}
        </select>
        <select
          value={newAction}
          onChange={(e) => setNewAction(e.target.value as ListenerAction["type"])}
          className="w-full bg-panel border border-edge rounded px-1.5 py-1 text-[11px] text-gray-100 focus:outline-none focus:border-accent"
          aria-label="Action type"
        >
          {ACTION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          value={newTarget}
          onChange={(e) => setNewTarget(e.target.value)}
          className="w-full bg-panel border border-edge rounded px-1.5 py-1 text-[11px] text-gray-100 focus:outline-none focus:border-accent"
          aria-label="Target component"
        >
          <option value="">Target component…</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {newAction === "setProperty" && (
          <div className="flex gap-1">
            <input
              type="text"
              value={newProperty}
              onChange={(e) => setNewProperty(e.target.value)}
              placeholder="property"
              className="flex-1 bg-panel border border-edge rounded px-1.5 py-1 text-[11px] text-gray-100 focus:outline-none focus:border-accent"
              aria-label="Property name"
            />
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="value"
              className="w-16 bg-panel border border-edge rounded px-1.5 py-1 text-[11px] text-gray-100 font-mono focus:outline-none focus:border-accent"
              aria-label="Property value"
            />
          </div>
        )}
        <button
          onClick={handleAdd}
          disabled={!newTarget}
          className="w-full px-2 py-1 rounded bg-accent hover:bg-accent2 disabled:opacity-40 text-black text-[11px] transition-colors"
        >
          + Add Listener
        </button>
      </div>
    </div>
  );
}
