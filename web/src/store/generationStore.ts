import { create } from "zustand";

export interface GenerationRecord {
  id: string;
  timestamp: number;
  prompt: string;
  toolCalls: { tool: string; summary?: string }[];
  componentIds: string[];
  componentCount: number;
  summary?: {
    headline?: string;
    intent?: string;
    actions?: string[];
    outcomes?: string[];
    nextSteps?: string[];
  };
}

interface GenerationState {
  generations: GenerationRecord[];
  activeGenerationId: string | null;
  pendingPrompt: string | null;
  pendingToolCalls: { tool: string; summary?: string }[];

  startGeneration: (prompt: string) => void;
  recordToolCall: (tool: string, summary?: string) => void;
  commitGeneration: (componentIds: string[], componentCount: number, summary?: GenerationRecord["summary"]) => void;
  updateLastGeneration: (patch: Partial<GenerationRecord>) => void;
  clearGenerations: () => void;
  setActiveGeneration: (id: string | null) => void;
  getGenerationById: (id: string) => GenerationRecord | undefined;
}

export const useGenerationStore = create<GenerationState>((set, get) => ({
  generations: [],
  activeGenerationId: null,
  pendingPrompt: null,
  pendingToolCalls: [],

  startGeneration: (prompt) => set({ pendingPrompt: prompt, pendingToolCalls: [] }),

  recordToolCall: (tool, summary) =>
    set((s) => ({ pendingToolCalls: [...s.pendingToolCalls, { tool, summary }] })),

  commitGeneration: (componentIds, componentCount, summary) => {
    const state = get();
    if (!state.pendingPrompt) return;
    const record: GenerationRecord = {
      id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      prompt: state.pendingPrompt,
      toolCalls: state.pendingToolCalls,
      componentIds,
      componentCount,
      summary,
    };
    set((s) => ({
      generations: [...s.generations, record],
      activeGenerationId: record.id,
      pendingPrompt: null,
      pendingToolCalls: [],
    }));
  },

  clearGenerations: () => set({ generations: [], activeGenerationId: null, pendingPrompt: null, pendingToolCalls: [] }),

  updateLastGeneration: (patch) =>
    set((s) => {
      if (s.generations.length === 0) return s;
      const updated = [...s.generations];
      updated[updated.length - 1] = { ...updated[updated.length - 1], ...patch };
      return { generations: updated };
    }),

  setActiveGeneration: (id) => set({ activeGenerationId: id }),

  getGenerationById: (id) => get().generations.find((g) => g.id === id),
}));
