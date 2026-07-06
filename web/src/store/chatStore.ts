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

let activeStreamId = 0;

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  streamingTokens: string;
  toolActivity: ToolActivity[];
  error: string | null;
  abortController: AbortController | null;

  loadMessages: (projectId: string) => Promise<void>;
  send: (projectId: string, text: string) => void;
  abort: () => void;
  clear: (projectId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingTokens: "",
  toolActivity: [],
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
      error: null,
    });

    const controller = streamChat(
      projectId,
      text,
      (event: ChatEvent) => {
        if (activeStreamId !== myStreamId) return;
        switch (event.type) {
          case "token":
            set({ streamingTokens: get().streamingTokens + event.delta });
            break;
          case "tool_call":
            set({
              toolActivity: [
                ...get().toolActivity,
                { callId: event.callId, tool: event.tool, args: event.args, done: false },
              ],
            });
            break;
          case "tool_result": {
            const activity = get().toolActivity.map((a) =>
              a.callId === event.callId
                ? { ...a, result: event.result, summary: event.summary, done: true }
                : a,
            );
            set({ toolActivity: activity });
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
              abortController: null,
            });
            break;
          }
          case "error":
            set({ isStreaming: false, streamingTokens: "", error: event.message, abortController: null });
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

  abort: () => {
    activeStreamId++;
    const { abortController } = get();
    if (abortController) abortController.abort();
    set({ isStreaming: false, streamingTokens: "", abortController: null });
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
      error: null,
      abortController: null,
      isStreaming: false,
    });
  },
}));
