import { create } from "zustand";
import type { Message } from "@openmotion/shared";
import type { ChatEvent } from "@openmotion/shared";
import { streamChat } from "../api/sse.js";
import { listMessages, clearMessages } from "../api/endpoints.js";
import { useProjectStore } from "./projectStore.js";

export interface ToolActivity {
  callId: string;
  tool: string;
  args?: unknown;
  result?: unknown;
  summary?: string;
  done: boolean;
}

export interface PlanStep {
  tool: string;
  description: string;
}

export interface AgentPlan {
  steps: PlanStep[];
  summary: string;
}

let activeStreamId = 0;

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  streamingTokens: string;
  toolActivity: ToolActivity[];
  plan: AgentPlan | null;
  completedStepIndices: number[];
  activeStepIndex: number;
  error: string | null;
  abortController: AbortController | null;

  loadMessages: (projectId: string) => Promise<void>;
  send: (projectId: string, text: string) => void;
  regenerate: (projectId: string) => void;
  abort: () => void;
  clear: (projectId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingTokens: "",
  toolActivity: [],
  plan: null,
  completedStepIndices: [],
  activeStepIndex: -1,
  error: null,
  abortController: null,

  loadMessages: async (projectId) => {
    set({ messages: [] });
    try {
      const msgs = await listMessages(projectId);
      set({ messages: msgs });
    } catch {
      /* ignore */
    }
  },

  send: (projectId, text) => {
    if (get().isStreaming) return;
    const myStreamId = ++activeStreamId;
    const userMsg: Message = {
      id: `local-${Date.now()}`,
      projectId,
      role: "user",
      content: text,
      toolName: null,
      createdAt: new Date().toISOString(),
    };
    set({
      messages: [...get().messages, userMsg],
      isStreaming: true,
      streamingTokens: "",
      toolActivity: [],
      plan: null,
      completedStepIndices: [],
      activeStepIndex: -1,
      error: null,
    });

    const controller = streamChat(
      projectId,
      text,
      (event: ChatEvent) => {
        if (activeStreamId !== myStreamId) return;
        switch (event.type) {
          case "plan":
            set({ plan: { steps: event.steps, summary: event.summary }, completedStepIndices: [], activeStepIndex: -1 });
            break;
          case "token":
            set({ streamingTokens: get().streamingTokens + event.delta });
            break;
          case "tool_call": {
            const state = get();
            const plan = state.plan;
            let activeStep = state.activeStepIndex;
            if (plan && activeStep === -1) {
              const nextIdx = plan.steps.findIndex(
                (s, i) => s.tool === event.tool && !state.completedStepIndices.includes(i),
              );
              if (nextIdx !== -1) activeStep = nextIdx;
            }
            set({
              toolActivity: [
                ...state.toolActivity,
                { callId: event.callId, tool: event.tool, args: event.args, done: false },
              ],
              activeStepIndex: activeStep,
            });
            break;
          }
          case "tool_result": {
            const activity = get().toolActivity.map((a) =>
              a.callId === event.callId
                ? { ...a, result: event.result, summary: event.summary, done: true }
                : a,
            );
            const state = get();
            const completed = state.activeStepIndex !== -1 && !state.completedStepIndices.includes(state.activeStepIndex)
              ? [...state.completedStepIndices, state.activeStepIndex]
              : state.completedStepIndices;
            const plan = state.plan;
            let nextActive = -1;
            if (plan) {
              const nextIdx = plan.steps.findIndex(
                (s, i) => !completed.includes(i),
              );
              nextActive = nextIdx;
            }
            set({ toolActivity: activity, completedStepIndices: completed, activeStepIndex: nextActive });
            break;
          }
          case "spec_update":
            useProjectStore.getState().applySpecUpdate(event.components, event.project);
            break;
          case "done": {
            const assistantMsg: Message = {
              id: `local-${Date.now()}`,
              projectId,
              role: "assistant",
              content: event.message,
              toolName: null,
              createdAt: new Date().toISOString(),
            };
            set({
              messages: [...get().messages, assistantMsg],
              isStreaming: false,
              streamingTokens: "",
              plan: null,
              completedStepIndices: [],
              activeStepIndex: -1,
              abortController: null,
            });
            break;
          }
          case "error":
            set({ isStreaming: false, streamingTokens: "", plan: null, completedStepIndices: [], activeStepIndex: -1, error: event.message, abortController: null });
            break;
          case "meta":
            break;
        }
      },
      (err) => {
        if (activeStreamId !== myStreamId) return;
        set({ isStreaming: false, error: err.message, abortController: null });
      },
    );
    set({ abortController: controller });
  },

  regenerate: (projectId) => {
    if (get().isStreaming) return;
    const msgs = get().messages;
    // Find the last user message.
    let lastUserText: string | null = null;
    let cutIndex = msgs.length;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "user") {
        lastUserText = msgs[i].content;
        cutIndex = i;
        break;
      }
    }
    if (!lastUserText) return;
    // Remove everything from the last user message onward, then re-send.
    set({ messages: msgs.slice(0, cutIndex) });
    get().send(projectId, lastUserText);
  },

  abort: () => {
    activeStreamId++;
    const { abortController } = get();
    if (abortController) abortController.abort();
    set({ isStreaming: false, streamingTokens: "", plan: null, completedStepIndices: [], activeStepIndex: -1, abortController: null });
  },

  clear: async (projectId) => {
    activeStreamId++;
    const { abortController } = get();
    if (abortController) abortController.abort();
    await clearMessages(projectId);
    set({
      messages: [],
      toolActivity: [],
      streamingTokens: "",
      plan: null,
      completedStepIndices: [],
      activeStepIndex: -1,
      error: null,
      abortController: null,
      isStreaming: false,
    });
  },
}));
