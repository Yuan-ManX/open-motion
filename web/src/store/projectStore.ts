import { create } from "zustand";
import type { MotionComponent, MotionProject, MotionSpec, ProjectResponse } from "@openmotion/shared";
import * as api from "../api/endpoints.js";

let loadRequestId = 0;

interface ProjectState {
  projectId: string | null;
  project: MotionProject | null;
  components: MotionComponent[];
  loading: boolean;

  loadProject: (id: string) => Promise<void>;
  applySpecUpdate: (components: MotionComponent[], project?: MotionProject) => void;
  addComponentLocal: (component: MotionComponent) => void;
  patchComponentLocal: (componentId: string, patch: Partial<MotionComponent>) => void;
  removeComponentLocal: (componentId: string) => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projectId: null,
  project: null,
  components: [],
  loading: false,

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
      });
    } catch {
      if (myRequestId !== loadRequestId) return;
      set({ loading: false });
    }
  },

  applySpecUpdate: (components, project) => {
    set(project ? { components, project } : { components });
  },

  addComponentLocal: (component) => {
    set({ components: [...get().components, component] });
  },

  patchComponentLocal: (componentId, patch) => {
    const components = get().components.map((c) =>
      c.id === componentId ? { ...c, ...patch } : c,
    );
    set({ components });
  },

  removeComponentLocal: (componentId) => {
    set({ components: get().components.filter((c) => c.id !== componentId) });
  },

  reset: () => set({ projectId: null, project: null, components: [], loading: false }),
}));
