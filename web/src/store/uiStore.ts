import { create } from "zustand";
import type { HealthResponse } from "@openmotion/shared";

export type View = "editor" | "gallery" | "skills";

interface UiState {
  view: View;
  selectedComponentId: string | null;
  exportOpen: boolean;
  templatesOpen: boolean;
  skillsOpen: boolean;
  health: HealthResponse | null;
  replayTrigger: number;

  setView: (v: View) => void;
  selectComponent: (id: string | null) => void;
  setExportOpen: (open: boolean) => void;
  setTemplatesOpen: (open: boolean) => void;
  setSkillsOpen: (open: boolean) => void;
  setHealth: (h: HealthResponse | null) => void;
  triggerReplay: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: "editor",
  selectedComponentId: null,
  exportOpen: false,
  templatesOpen: false,
  skillsOpen: false,
  health: null,
  replayTrigger: 0,

  setView: (v) => set({ view: v }),
  selectComponent: (id) => set({ selectedComponentId: id }),
  setExportOpen: (open) => set({ exportOpen: open }),
  setTemplatesOpen: (open) => set({ templatesOpen: open }),
  setSkillsOpen: (open) => set({ skillsOpen: open }),
  setHealth: (h) => set({ health: h }),
  triggerReplay: () => set((s) => ({ replayTrigger: s.replayTrigger + 1 })),
}));
