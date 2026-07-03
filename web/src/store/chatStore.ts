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

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  streamingTokens: string;
  toolActivity: ToolActivity[];
  error: string | null;

  loadMessages: (projectId: string) => Promise<void>;
  send: (projectId: string, text: string) => void;
  clear: (projectId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  streamingTokens: "",
  toolActivity: [],
  error: null,

  loadMessages: async (projectId) => {
    try {
      const msgs = await listMessages(projectId);
      set({ messages: msgs });
    } catch {
      /* ignore */
    }
  },

  send: (projectId, text) => {
    if (get().isStreaming) return;
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

    streamChat(
      projectId,
      text,
      (event: ChatEvent) => {
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
            useProjectStore.getState().applySpecUpdate(event.components);
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
            });
            break;
          }
          case "error":
            set({ isStreaming: false, error: event.message });
            break;
          case "meta":
            break;
        }
      },
      (err) => set({ isStreaming: false, error: err.message }),
    );
  },

  clear: async (projectId) => {
    await clearMessages(projectId);
    set({ messages: [], toolActivity: [], streamingTokens: "", error: null });
  },
}));
