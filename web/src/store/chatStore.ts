import { create } from "zustand";
import type { Message } from "@openmotion/shared";
import type { ChatEvent } from "@openmotion/shared";
import { streamChat } from "../api/sse.js";
import { listMessages, clearMessages, createComponent, patchComponent } from "../api/endpoints.js";
import { useProjectStore } from "./projectStore.js";
import { useUiStore } from "./uiStore.js";
import { useClipboardStore } from "./clipboardStore.js";

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

export interface ThinkingTrace {
  text: string;
  analysis: string;
  constraints: string[];
  options: { approach: string; tradeoffs: string }[];
  chosenApproach: string;
}

export interface GoalNode {
  id: string;
  label: string;
  status: "pending" | "in_progress" | "completed" | "skipped";
  tool?: string;
  children: GoalNode[];
}

export interface ProactiveSuggestion {
  title: string;
  reason: string;
  tool: string;
  prompt: string;
  kind: "refine" | "extend" | "diversify" | "interact" | "sequence" | "polish";
}

export interface SessionSummary {
  headline: string;
  intent: string;
  actions: string[];
  outcomes: string[];
  metrics: {
    toolCalls: number;
    successes: number;
    failures: number;
    goalsTotal: number;
    goalsCompleted: number;
  };
  nextSteps: string[];
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
  reasoningText: string;
  thinking: ThinkingTrace | null;
  reflection: { text: string; failedTools: string[]; suggestion?: string } | null;
  goal: GoalNode | null;
  proactiveSuggestions: ProactiveSuggestion[];
  sessionSummary: SessionSummary | null;
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
  reasoningText: "",
  thinking: null,
  reflection: null,
  goal: null,
  proactiveSuggestions: [],
  sessionSummary: null,
  error: null,
  abortController: null,

  loadMessages: async (projectId) => {
    if (get().isStreaming) return;
    set({ messages: [] });
    try {
      const msgs = await listMessages(projectId);
      if (get().isStreaming) return;
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
      reasoningText: "",
      thinking: null,
      goal: null,
      proactiveSuggestions: [],
      sessionSummary: null,
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
          case "thinking":
            set({
              thinking: {
                text: event.text,
                analysis: event.analysis,
                constraints: event.constraints,
                options: event.options,
                chosenApproach: event.chosenApproach,
              },
            });
            break;
          case "token":
            set({ streamingTokens: get().streamingTokens + event.delta });
            break;
          case "reasoning":
            set({ reasoningText: get().reasoningText + event.text });
            break;
          case "reflection":
            set({
              reflection: {
                text: event.text,
                failedTools: event.failedTools,
                suggestion: event.suggestion,
              },
            });
            break;
          case "goal":
            set({ goal: event.root as GoalNode });
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

            // Handle UI-action tool results that don't change the spec but update editor state
            const toolActivityEntry = activity.find((a) => a.callId === event.callId);
            if (toolActivityEntry?.result && typeof toolActivityEntry.result === "object") {
              const resultData = toolActivityEntry.result as { uiAction?: string };
              if (resultData.uiAction === "set_onion_skin") {
                const d = resultData as { enabled: boolean; frames: number; opacity: number };
                useUiStore.getState().setOnionSkin({ enabled: d.enabled, frames: d.frames, opacity: d.opacity });
              } else if (resultData.uiAction === "preview_fullscreen") {
                useUiStore.getState().setPreviewOpen(true);
              } else if (resultData.uiAction === "set_canvas_view") {
                const d = resultData as { pan?: { x: number; y: number }; zoom?: number; fit?: boolean };
                if (d.fit) {
                  useUiStore.getState().resetCanvasView();
                } else {
                  if (d.pan) useUiStore.getState().setCanvasPan(d.pan);
                  if (d.zoom != null) useUiStore.getState().setCanvasZoom(d.zoom);
                }
              } else if (resultData.uiAction === "lock_layer") {
                const d = resultData as { componentId: string; locked: boolean };
                useUiStore.getState().setLock(d.componentId, d.locked);
              } else if (resultData.uiAction === "set_playback_range") {
                const d = resultData as { startMs: number; endMs: number; clear?: boolean };
                useUiStore.getState().setPlaybackRange(d.clear ? null : { startMs: d.startMs, endMs: d.endMs });
              } else if (resultData.uiAction === "select_components") {
                const d = resultData as { componentIds: string[]; clear: boolean };
                if (d.clear) useUiStore.getState().clearSelection();
                if (d.componentIds.length > 0) useUiStore.getState().setSelectedIds(d.componentIds);
              } else if (resultData.uiAction === "toggle_snap") {
                const d = resultData as { enabled: boolean; size?: number };
                useUiStore.getState().setSnapToGrid(d.enabled);
                if (d.size != null) useUiStore.getState().setSnapSize(d.size);
              } else if (resultData.uiAction === "set_rulers") {
                const d = resultData as { show: boolean };
                useUiStore.getState().setShowRulers(d.show);
              } else if (resultData.uiAction === "copy_to_clipboard") {
                const components = useProjectStore.getState().components;
                const selectedIds = useUiStore.getState().selectedIds;
                const selected = components.filter((c) => selectedIds.has(c.id));
                if (selected.length > 0) {
                  useClipboardStore.getState().copy(selected);
                }
              } else if (resultData.uiAction === "paste_from_clipboard") {
                const d = resultData as { x?: number; y?: number };
                void (async () => {
                  const entries = useClipboardStore.getState().entries;
                  const projectId = useProjectStore.getState().project?.id;
                  if (entries.length === 0 || !projectId) return;
                  for (const entry of entries) {
                    const clone = await createComponent(projectId, { name: `${entry.name} (paste)` });
                    const newStyle = { ...entry.style };
                    const left = typeof newStyle.left === "number" ? newStyle.left : parseFloat(String(newStyle.left ?? "0")) || 0;
                    const top = typeof newStyle.top === "number" ? newStyle.top : parseFloat(String(newStyle.top ?? "0")) || 0;
                    newStyle.left = left + (d.x ?? 20);
                    newStyle.top = top + (d.y ?? 20);
                    await patchComponent(projectId, clone.id, {
                      easing: entry.easing,
                      durationMs: entry.durationMs,
                      delayMs: entry.delayMs,
                      iterationCount: entry.iterationCount,
                      direction: entry.direction,
                      keyframes: entry.keyframes,
                      style: newStyle,
                      trigger: entry.trigger,
                    });
                    useProjectStore.getState().addComponentLocal(clone);
                  }
                })();
              } else if (resultData.uiAction === "toggle_auto_keyframe") {
                const d = resultData as { enabled: boolean };
                useUiStore.getState().setAutoKeyframe(d.enabled);
              } else if (resultData.uiAction === "solo_layer") {
                const d = resultData as { componentId: string };
                const current = useUiStore.getState().soloedId;
                useUiStore.getState().setSoloedId(current === d.componentId ? null : d.componentId);
              } else if (resultData.uiAction === "play_clip") {
                const d = resultData as { startMs: number; endMs: number };
                useUiStore.getState().setPlaybackRange({ startMs: d.startMs, endMs: d.endMs });
                useUiStore.getState().setPlayheadMs(d.startMs);
                useUiStore.getState().setTimelineCommand("play");
              }
            }
            break;
          }
          case "spec_update":
            useProjectStore.getState().applySpecUpdate(event.components, event.project);
            if (event.project?.tokens) {
              const t = event.project.tokens;
              const w = Number(t.artboardWidth) || 0;
              const h = Number(t.artboardHeight) || 0;
              if (w && h) useUiStore.getState().setCanvasSize({ width: w, height: h });
            }
            break;
          case "proactive_suggestion":
            set({ proactiveSuggestions: event.suggestions });
            break;
          case "session_summary":
            set({ sessionSummary: event.summary });
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
              reasoningText: "",
              thinking: null,
              reflection: null,
              goal: null,
              proactiveSuggestions: [],
              abortController: null,
            });
            break;
          }
          case "error":
            set({ isStreaming: false, streamingTokens: "", plan: null, completedStepIndices: [], activeStepIndex: -1, reasoningText: "", thinking: null, reflection: null, goal: null, proactiveSuggestions: [], error: event.message, abortController: null });
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
    set({ isStreaming: false, streamingTokens: "", plan: null, completedStepIndices: [], activeStepIndex: -1, reasoningText: "", thinking: null, reflection: null, goal: null, sessionSummary: null, abortController: null });
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
      reasoningText: "",
      thinking: null,
      reflection: null,
      goal: null,
      sessionSummary: null,
      error: null,
      abortController: null,
      isStreaming: false,
    });
  },
}));
