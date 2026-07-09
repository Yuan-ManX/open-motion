import { create } from "zustand";
import type { MotionComponent, MotionProject, MotionSpec, ProjectResponse } from "@openmotion/shared";
import * as api from "../api/endpoints.js";

let loadRequestId = 0;

const HISTORY_LIMIT = 50;

interface Snapshot {
  components: MotionComponent[];
  project: MotionProject | null;
}

interface ProjectState {
  projectId: string | null;
  project: MotionProject | null;
  components: MotionComponent[];
  loading: boolean;
  past: Snapshot[];
  future: Snapshot[];

  loadProject: (id: string) => Promise<void>;
  applySpecUpdate: (components: MotionComponent[], project?: MotionProject) => void;
  addComponentLocal: (component: MotionComponent) => void;
  patchComponentLocal: (componentId: string, patch: Partial<MotionComponent>) => void;
  removeComponentLocal: (componentId: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

function snapshot(state: ProjectState): Snapshot {
  return { components: state.components, project: state.project };
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectId: null,
  project: null,
  components: [],
  loading: false,
  past: [],
  future: [],

  loadProject: async (id) => {
    const myRequestId = ++loadRequestId;
    set({ loading: true });
    try {
      const resp = await api.getProject(id);
      if (myRequestId !== loadRequestId) return;
      const spec = resp.spec as MotionSpec;
      set({
        projectId: id,
        project: spec.project ?? (resp as unknown as MotionProject),
        components: spec.components ?? [],
        loading: false,
        past: [],
        future: [],
      });
    } catch {
      if (myRequestId !== loadRequestId) return;
      set({ loading: false });
    }
  },

  applySpecUpdate: (components, project) => {
    const state = get();
    const past = [...state.past, snapshot(state)].slice(-HISTORY_LIMIT);
    set(project ? { components, project, past, future: [] } : { components, past, future: [] });
  },

  addComponentLocal: (component) => {
    const state = get();
    const past = [...state.past, snapshot(state)].slice(-HISTORY_LIMIT);
    set({ components: [...state.components, component], past, future: [] });
  },

  patchComponentLocal: (componentId, patch) => {
    const state = get();
    const past = [...state.past, snapshot(state)].slice(-HISTORY_LIMIT);
    const components = state.components.map((c) =>
      c.id === componentId ? { ...c, ...patch } : c,
    );
    set({ components, past, future: [] });
  },

  removeComponentLocal: (componentId) => {
    const state = get();
    const past = [...state.past, snapshot(state)].slice(-HISTORY_LIMIT);
    set({ components: state.components.filter((c) => c.id !== componentId), past, future: [] });
  },

  undo: () => {
    const state = get();
    if (state.past.length === 0) return;
    const previous = state.past[state.past.length - 1];
    const past = state.past.slice(0, -1);
    const future = [snapshot(state), ...state.future].slice(0, HISTORY_LIMIT);
    set({ components: previous.components, project: previous.project, past, future });
  },

  redo: () => {
    const state = get();
    if (state.future.length === 0) return;
    const next = state.future[0];
    const future = state.future.slice(1);
    const past = [...state.past, snapshot(state)].slice(-HISTORY_LIMIT);
    set({ components: next.components, project: next.project, past, future });
  },

  reset: () => set({
    projectId: null,
    project: null,
    components: [],
    loading: false,
    past: [],
    future: [],
  }),
}));
