import { create } from "zustand";
import type { HealthResponse } from "@openmotion/shared";

export type View = "editor" | "gallery" | "skills";

interface UiState {
  view: View;
  selectedComponentId: string | null;
  exportOpen: boolean;
  health: HealthResponse | null;
  replayTrigger: number;

  setView: (v: View) => void;
  selectComponent: (id: string | null) => void;
  setExportOpen: (open: boolean) => void;
  setHealth: (h: HealthResponse | null) => void;
  triggerReplay: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: "gallery",
  selectedComponentId: null,
  exportOpen: false,
  health: null,
  replayTrigger: 0,

  setView: (v) => set({ view: v }),
  selectComponent: (id) => set({ selectedComponentId: id }),
  setExportOpen: (open) => set({ exportOpen: open }),
  setHealth: (h) => set({ health: h }),
  triggerReplay: () => set((s) => ({ replayTrigger: s.replayTrigger + 1 })),
}));
