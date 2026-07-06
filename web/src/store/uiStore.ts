import { create } from "zustand";
import type { HealthResponse } from "@openmotion/shared";

interface UiState {
  selectedComponentId: string | null;
  exportOpen: boolean;
  templatesOpen: boolean;
  skillsOpen: boolean;
  health: HealthResponse | null;
  replayTrigger: number;
  hiddenIds: Set<string>;
  canvasSize: { width: number; height: number };

  selectComponent: (id: string | null) => void;
  setExportOpen: (open: boolean) => void;
  setTemplatesOpen: (open: boolean) => void;
  setSkillsOpen: (open: boolean) => void;
  setHealth: (h: HealthResponse | null) => void;
  triggerReplay: () => void;
  toggleHidden: (id: string) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  selectedComponentId: null,
  exportOpen: false,
  templatesOpen: false,
  skillsOpen: false,
  health: null,
  replayTrigger: 0,
  hiddenIds: new Set<string>(),
  canvasSize: { width: 640, height: 360 },

  selectComponent: (id) => set({ selectedComponentId: id }),
  setExportOpen: (open) => set({ exportOpen: open }),
  setTemplatesOpen: (open) => set({ templatesOpen: open }),
  setSkillsOpen: (open) => set({ skillsOpen: open }),
  setHealth: (h) => set({ health: h }),
  triggerReplay: () => set((s) => ({ replayTrigger: s.replayTrigger + 1 })),
  toggleHidden: (id) => {
    const next = new Set(get().hiddenIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ hiddenIds: next });
  },
  setCanvasSize: (size) => set({ canvasSize: size }),
}));
