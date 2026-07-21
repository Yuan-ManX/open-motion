import { useState, useCallback, useRef, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import * as api from "../../api/endpoints.js";
import { StateMachineGraph } from "./StateMachineGraph.js";
import {
  transitionMultiple,
  type TransitionEasingSpec,
  type TransitionHandle,
  type StyleSnapshot,
} from "../../motion/stateTransitions.js";

interface MotionState {
  id: string;
  name: string;
  components: Record<string, { style: Record<string, string | number> }>;
  x?: number;
  y?: number;
}

type TransitionTrigger = "onClick" | "onHover" | "onLoad" | "manual";

interface StateTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  trigger: TransitionTrigger;
  durationMs: number;
  /** Easing curve for the transition. Omit means "ease-out" preset. */
  easing?: TransitionEasingSpec;
}

const EASING_PRESETS: Array<{ label: string; value: TransitionEasingSpec }> = [
  { label: "ease-out", value: { type: "preset", name: "ease-out" } },
  { label: "ease-in-out", value: { type: "preset", name: "ease-in-out" } },
  { label: "ease-in-back", value: { type: "preset", name: "ease-in-back" } },
  { label: "ease-out-back", value: { type: "preset", name: "ease-out-back" } },
  { label: "linear", value: { type: "preset", name: "linear" } },
  { label: "snappy", value: { type: "bezier", p1: [0.2, 0.8], p2: [0.2, 1] } },
  { label: "dramatic", value: { type: "bezier", p1: [0.7, 0], p2: [0.3, 1] } },
  { label: "spring", value: { type: "spring", stiffness: 180, damping: 14, mass: 1 } },
];

interface StateMachineData {
  states: MotionState[];
  transitions: StateTransition[];
  activeStateId: string | null;
}

function getStateMachine(tokens: Record<string, string | number> | undefined): StateMachineData {
  const raw = tokens?.stateMachine;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as StateMachineData;
    } catch {
      /* ignore */
    }
  }
  return { states: [], transitions: [], activeStateId: null };
}

function genId(): string {
  return `st_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function StateMachinePanel() {
  const project = useProjectStore((s) => s.project);
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const loadProject = useProjectStore((s) => s.loadProject);
  const updateComponentLive = useProjectStore((s) => s.updateComponentLive);

  const tokens = project?.tokens ?? {};
  const sm = getStateMachine(tokens);
  const [newStateName, setNewStateName] = useState("");
  const [newFromState, setNewFromState] = useState("");
  const [newToState, setNewToState] = useState("");
  const [newTrigger, setNewTrigger] = useState<TransitionTrigger>("manual");
  const [newDuration, setNewDuration] = useState(500);
  const [newEasingIdx, setNewEasingIdx] = useState(0);
  // Active transition handle — when set, a state-to-state animation is running.
  const activeTransitionRef = useRef<TransitionHandle | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingLabel, setPlayingLabel] = useState<string | null>(null);
  const playbackStopRef = useRef(false);

  // Cancel any in-flight transition when the panel unmounts.
  useEffect(() => {
    return () => {
      activeTransitionRef.current?.cancel();
      playbackStopRef.current = true;
    };
  }, []);

  const persistStateMachine = useCallback(
    async (data: StateMachineData) => {
      if (!projectId || !project) return;
      const newTokens = { ...project.tokens };
      newTokens.stateMachine = JSON.stringify(data);
      useProjectStore.setState((s) => ({
        project: s.project ? { ...s.project, tokens: newTokens } : s.project,
      }));
      try {
        await api.updateProject(projectId, { tokens: newTokens });
      } catch {
        /* ignore */
      }
    },
    [projectId, project],
  );

  const handleCaptureState = useCallback(async () => {
    if (!newStateName.trim()) return;
    const compStyles: Record<string, { style: Record<string, string | number> }> = {};
    for (const c of components) {
      compStyles[c.id] = { style: { ...(c.style as Record<string, string | number>) } };
    }
    const idx = sm.states.length;
    const angle = (idx * 72 - 90) * (Math.PI / 180);
    const radius = 70;
    const x = 115 + radius * Math.cos(angle);
    const y = 90 + radius * Math.sin(angle);
    const newState: MotionState = {
      id: genId(),
      name: newStateName.trim(),
      components: compStyles,
      x,
      y,
    };
    const data: StateMachineData = {
      ...sm,
      states: [...sm.states, newState],
      activeStateId: newState.id,
    };
    await persistStateMachine(data);
    setNewStateName("");
  }, [newStateName, components, sm, persistStateMachine]);

  const handleRepositionState = useCallback(
    async (stateId: string, x: number, y: number) => {
      const data: StateMachineData = {
        ...sm,
        states: sm.states.map((s) => (s.id === stateId ? { ...s, x, y } : s)),
      };
      await persistStateMachine(data);
    },
    [sm, persistStateMachine],
  );

  const handleApplyState = useCallback(
    async (stateId: string) => {
      const state = sm.states.find((s) => s.id === stateId);
      if (!state) return;
      // Look for a transition from the current active state to the target.
      const transition = sm.activeStateId
        ? sm.transitions.find(
            (t) => t.fromStateId === sm.activeStateId && t.toStateId === stateId,
          )
        : undefined;

      if (transition && transition.durationMs > 0) {
        // Cancel any in-flight transition first.
        activeTransitionRef.current?.cancel();
        // Build the per-component transition list. We snapshot the current
        // component styles as the "from" values and the target state's
        // stored styles as the "to" values.
        const compTransitions = components
          .map((c) => {
            const target = state.components[c.id]?.style;
            if (!target) return null;
            const current = (c.style as StyleSnapshot) ?? {};
            return {
              componentId: c.id,
              getCurrent: () => current,
              target: { ...target },
            };
          })
          .filter((x): x is { componentId: string; getCurrent: () => StyleSnapshot; target: StyleSnapshot } => x !== null);

        if (compTransitions.length === 0) {
          // No components to animate — fall through to instant apply.
          await instantApply(state, stateId);
          return;
        }

        const handle = transitionMultiple(compTransitions, {
          durationMs: transition.durationMs,
          easing: transition.easing,
          onFrame: (compId, snapshot) => {
            updateComponentLive(compId, snapshot);
          },
          onComplete: async () => {
            // Persist the final styles to the backend so they survive reload.
            if (projectId) {
              for (const [compId, data] of Object.entries(state.components)) {
                void api.patchComponent(projectId, compId, { style: data.style }).catch(() => {});
              }
            }
            const data: StateMachineData = { ...sm, activeStateId: stateId };
            await persistStateMachine(data);
            activeTransitionRef.current = null;
            setPlayingLabel(null);
          },
        });
        activeTransitionRef.current = handle;
        const fromName = sm.states.find((s) => s.id === transition.fromStateId)?.name ?? "?";
        setPlayingLabel(`${fromName} → ${state.name}`);
        return;
      }

      await instantApply(state, stateId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sm, components, updateComponentLive, projectId, persistStateMachine],
  );

  const instantApply = useCallback(
    async (state: MotionState, stateId: string) => {
      for (const [compId, data] of Object.entries(state.components)) {
        updateComponentLive(compId, data.style);
        if (projectId) {
          void api.patchComponent(projectId, compId, { style: data.style }).catch(() => {});
        }
      }
      const data: StateMachineData = { ...sm, activeStateId: stateId };
      await persistStateMachine(data);
    },
    [sm, updateComponentLive, projectId, persistStateMachine],
  );

  const handleDeleteState = useCallback(
    async (stateId: string) => {
      const data: StateMachineData = {
        states: sm.states.filter((s) => s.id !== stateId),
        transitions: sm.transitions.filter((t) => t.fromStateId !== stateId && t.toStateId !== stateId),
        activeStateId: sm.activeStateId === stateId ? null : sm.activeStateId,
      };
      await persistStateMachine(data);
    },
    [sm, persistStateMachine],
  );

  const handleAddTransition = useCallback(async () => {
    if (!newFromState || !newToState || newFromState === newToState) return;
    const transition: StateTransition = {
      id: genId(),
      fromStateId: newFromState,
      toStateId: newToState,
      trigger: newTrigger,
      durationMs: newDuration,
      easing: EASING_PRESETS[newEasingIdx]?.value,
    };
    const data: StateMachineData = {
      ...sm,
      transitions: [...sm.transitions, transition],
    };
    await persistStateMachine(data);
    setNewFromState("");
    setNewToState("");
  }, [newFromState, newToState, newTrigger, newDuration, newEasingIdx, sm, persistStateMachine]);

  // Auto-play through a chain of transitions starting from the active state.
  // Walks the first available outgoing transition at each step until no more
  // transitions exist or we hit a cycle.
  const handlePlayback = useCallback(async () => {
    if (isPlaying) {
      // Stop playback.
      playbackStopRef.current = true;
      activeTransitionRef.current?.cancel();
      setIsPlaying(false);
      setPlayingLabel(null);
      return;
    }
    if (!sm.activeStateId) return;
    playbackStopRef.current = false;
    setIsPlaying(true);

    let currentId = sm.activeStateId;
    const visited = new Set<string>([currentId]);
    // Read the latest state machine from the store on each iteration so we
    // pick up any changes made mid-playback.
    const tick = async () => {
      if (playbackStopRef.current) {
        setIsPlaying(false);
        setPlayingLabel(null);
        return;
      }
      const latestTokens = useProjectStore.getState().project?.tokens ?? {};
      const latestSm = getStateMachine(latestTokens);
      const next = latestSm.transitions.find((t) => t.fromStateId === currentId);
      if (!next || visited.has(next.toStateId)) {
        setIsPlaying(false);
        setPlayingLabel(null);
        return;
      }
      visited.add(next.toStateId);
      const targetState = latestSm.states.find((s) => s.id === next.toStateId);
      if (!targetState) {
        setIsPlaying(false);
        setPlayingLabel(null);
        return;
      }
      const fromName = latestSm.states.find((s) => s.id === currentId)?.name ?? "?";
      setPlayingLabel(`${fromName} → ${targetState.name}`);
      // Build the transition list from current component styles to target.
      const latestComponents = useProjectStore.getState().components;
      const compTransitions = latestComponents
        .map((c) => {
          const target = targetState.components[c.id]?.style;
          if (!target) return null;
          const current = (c.style as StyleSnapshot) ?? {};
          return {
            componentId: c.id,
            getCurrent: () => current,
            target: { ...target },
          };
        })
        .filter((x): x is { componentId: string; getCurrent: () => StyleSnapshot; target: StyleSnapshot } => x !== null);

      if (compTransitions.length === 0) {
        // Nothing to animate — just advance state and continue.
        const data: StateMachineData = { ...latestSm, activeStateId: next.toStateId };
        await persistStateMachine(data);
        currentId = next.toStateId;
        setTimeout(tick, 50);
        return;
      }

      activeTransitionRef.current?.cancel();
      const handle = transitionMultiple(compTransitions, {
        durationMs: next.durationMs,
        easing: next.easing,
        onFrame: (compId, snapshot) => {
          updateComponentLive(compId, snapshot);
        },
        onComplete: async () => {
          if (projectId) {
            for (const [compId, data] of Object.entries(targetState.components)) {
              void api.patchComponent(projectId, compId, { style: data.style }).catch(() => {});
            }
          }
          const data: StateMachineData = { ...latestSm, activeStateId: next.toStateId };
          await persistStateMachine(data);
          activeTransitionRef.current = null;
          currentId = next.toStateId;
          // Schedule the next hop after a short pause so the user can perceive the state.
          setTimeout(tick, 120);
        },
      });
      activeTransitionRef.current = handle;
    };
    tick();
  }, [isPlaying, sm.activeStateId, persistStateMachine, updateComponentLive, projectId]);

  const handleStopTransition = useCallback(() => {
    activeTransitionRef.current?.cancel();
    activeTransitionRef.current = null;
    setPlayingLabel(null);
    setIsPlaying(false);
    playbackStopRef.current = true;
  }, []);

  const handleDeleteTransition = useCallback(
    async (transitionId: string) => {
      const data: StateMachineData = {
        ...sm,
        transitions: sm.transitions.filter((t) => t.id !== transitionId),
      };
      await persistStateMachine(data);
    },
    [sm, persistStateMachine],
  );

  const stateName = (id: string) => sm.states.find((s) => s.id === id)?.name ?? "?";

  return (
    <div className="h-full flex flex-col overflow-y-auto">
      {/* States section */}
      <div className="px-3 py-2 border-b border-edge">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-wide text-gray-500">States</span>
          <span className="text-[9px] text-gray-700 font-mono">{sm.states.length}</span>
        </div>
        {/* Capture new state */}
        <div className="flex gap-1 mb-2">
          <input
            type="text"
            placeholder="State name…"
            value={newStateName}
            onChange={(e) => setNewStateName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCaptureState()}
            className="flex-1 bg-panel2 border border-edge rounded px-2 py-1 text-xs text-gray-100 focus:outline-none focus:border-accent"
            aria-label="New state name"
          />
          <button
            onClick={handleCaptureState}
            disabled={!newStateName.trim()}
            className="px-2 py-1 rounded bg-accent hover:bg-accent2 disabled:opacity-40 text-black text-[11px] transition-colors"
            aria-label="Capture state"
          >
            ⚲
          </button>
        </div>
        {/* Visual state machine graph */}
        {sm.states.length > 0 && (
          <div className="mb-2">
            <StateMachineGraph
              states={sm.states.map((s) => ({
                id: s.id,
                name: s.name,
                x: s.x ?? 115,
                y: s.y ?? 90,
                componentCount: Object.keys(s.components).length,
                isActive: sm.activeStateId === s.id,
              }))}
              transitions={sm.transitions.map((t) => ({
                id: t.id,
                fromStateId: t.fromStateId,
                toStateId: t.toStateId,
                trigger: t.trigger,
                durationMs: t.durationMs,
              }))}
              activeStateId={sm.activeStateId}
              onSelectState={(id) => void handleApplyState(id)}
              onRepositionState={(id, x, y) => void handleRepositionState(id, x, y)}
              onDeleteState={(id) => void handleDeleteState(id)}
            />
          </div>
        )}
        {/* State list */}
        {sm.states.length === 0 && (
          <div className="text-[10px] text-gray-600 py-2 text-center">
            No states captured. Position your components and capture a state.
          </div>
        )}
        {sm.states.map((state) => (
          <div
            key={state.id}
            className={`group flex items-center gap-1.5 px-2 py-1.5 rounded border-b border-edge/50 cursor-pointer transition-colors ${
              sm.activeStateId === state.id ? "bg-accent/20" : "hover:bg-panel2"
            }`}
            onClick={() => handleApplyState(state.id)}
          >
            <span className="text-[10px] text-gray-500">{sm.activeStateId === state.id ? "●" : "○"}</span>
            <span className="flex-1 text-xs text-gray-200 truncate">{state.name}</span>
            <span className="text-[9px] text-gray-600 font-mono">{Object.keys(state.components).length} layers</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleDeleteState(state.id);
              }}
              className="text-[10px] text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
              aria-label={`Delete state ${state.name}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Transitions section */}
      <div className="px-3 py-2 flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] uppercase tracking-wide text-gray-500">Transitions</span>
          <span className="text-[9px] text-gray-700 font-mono">{sm.transitions.length}</span>
          <div className="ml-auto flex items-center gap-1">
            {(playingLabel || activeTransitionRef.current) && (
              <button
                onClick={handleStopTransition}
                className="text-[9px] px-1.5 py-0.5 border border-edge text-gray-400 hover:text-gray-200 hover:border-gray-500 rounded transition-colors"
                aria-label="Stop transition"
                title="Stop the active transition"
              >
                ■
              </button>
            )}
            <button
              onClick={handlePlayback}
              disabled={!sm.activeStateId || sm.transitions.length === 0}
              className={`text-[9px] px-1.5 py-0.5 border rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                isPlaying
                  ? "border-accent text-accent bg-accent/10"
                  : "border-edge text-gray-400 hover:text-gray-200 hover:border-gray-500"
              }`}
              aria-label={isPlaying ? "Stop playback" : "Play transitions"}
              title={isPlaying ? "Stop auto-playback" : "Auto-play through the transition chain"}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
          </div>
        </div>
        {(playingLabel || activeTransitionRef.current) && (
          <div className="mb-2 px-2 py-1 bg-accent/10 border border-accent/30 rounded text-[10px] text-accent font-mono flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 bg-accent rounded-full animate-pulse" aria-hidden="true" />
            <span className="truncate">{playingLabel ?? "transitioning…"}</span>
          </div>
        )}
        {/* Add transition form */}
        {sm.states.length >= 2 && (
          <div className="space-y-1 mb-2 p-2 bg-panel2 rounded border border-edge">
            <select
              value={newFromState}
              onChange={(e) => setNewFromState(e.target.value)}
              className="w-full bg-panel border border-edge rounded px-1.5 py-1 text-[11px] text-gray-100 focus:outline-none focus:border-accent"
              aria-label="From state"
            >
              <option value="">From state…</option>
              {sm.states.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={newToState}
              onChange={(e) => setNewToState(e.target.value)}
              className="w-full bg-panel border border-edge rounded px-1.5 py-1 text-[11px] text-gray-100 focus:outline-none focus:border-accent"
              aria-label="To state"
            >
              <option value="">To state…</option>
              {sm.states.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="flex gap-1">
              <select
                value={newTrigger}
                onChange={(e) => setNewTrigger(e.target.value as TransitionTrigger)}
                className="flex-1 bg-panel border border-edge rounded px-1.5 py-1 text-[11px] text-gray-100 focus:outline-none focus:border-accent"
                aria-label="Trigger"
              >
                <option value="manual">manual</option>
                <option value="onClick">onClick</option>
                <option value="onHover">onHover</option>
                <option value="onLoad">onLoad</option>
              </select>
              <input
                type="number"
                min={50}
                max={10000}
                step={50}
                value={newDuration}
                onChange={(e) => setNewDuration(Number(e.target.value) || 500)}
                className="w-16 bg-panel border border-edge rounded px-1.5 py-1 text-[11px] text-gray-100 font-mono focus:outline-none focus:border-accent"
                aria-label="Duration in ms"
              />
            </div>
            <select
              value={newEasingIdx}
              onChange={(e) => setNewEasingIdx(Number(e.target.value))}
              className="w-full bg-panel border border-edge rounded px-1.5 py-1 text-[11px] text-gray-100 focus:outline-none focus:border-accent"
              aria-label="Easing curve"
            >
              {EASING_PRESETS.map((p, i) => (
                <option key={p.label} value={i}>{p.label}</option>
              ))}
            </select>
            <button
              onClick={handleAddTransition}
              disabled={!newFromState || !newToState || newFromState === newToState}
              className="w-full px-2 py-1 rounded bg-accent hover:bg-accent2 disabled:opacity-40 text-black text-[11px] transition-colors"
            >
              Add Transition
            </button>
          </div>
        )}
        {/* Transition list */}
        {sm.transitions.length === 0 && sm.states.length >= 2 && (
          <div className="text-[10px] text-gray-600 py-2 text-center">
            No transitions defined.
          </div>
        )}
        {sm.transitions.map((t) => {
          const easingLabel = t.easing
            ? (EASING_PRESETS.find((p) => p.value === t.easing)?.label ??
              (t.easing.type === "preset" ? t.easing.name :
               t.easing.type === "bezier" ? "bezier" : "spring"))
            : "ease-out";
          return (
            <div
              key={t.id}
              className="group flex items-center gap-1.5 px-2 py-1.5 rounded border-b border-edge/50 hover:bg-panel2"
            >
              <span className="text-[10px] text-gray-300 truncate flex-1">
                <span className="text-gray-100">{stateName(t.fromStateId)}</span>
                <span className="text-gray-600 mx-1">→</span>
                <span className="text-gray-100">{stateName(t.toStateId)}</span>
              </span>
              <span className="text-[9px] text-gray-600 font-mono">{t.trigger}</span>
              <span className="text-[9px] text-gray-700 font-mono">{t.durationMs}ms</span>
              <span className="text-[9px] text-gray-700 font-mono">{easingLabel}</span>
              <button
                onClick={() => void handleDeleteTransition(t.id)}
                className="text-[10px] text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100"
                aria-label="Delete transition"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {/* Help text */}
      <div className="px-3 py-1.5 border-t border-edge text-[9px] text-gray-700">
        Capture states to snapshot component positions. Apply states to restore them. Define transitions for interactive flows.
      </div>
    </div>
  );
}
