import { create } from "zustand";
import type { Message } from "@openmotion/shared";
import type { ChatEvent } from "@openmotion/shared";
import { streamChat } from "../api/sse.js";
import { listMessages, clearMessages, createComponent, patchComponent } from "../api/endpoints.js";
import { useProjectStore } from "./projectStore.js";
import { useUiStore } from "./uiStore.js";
import { useClipboardStore } from "./clipboardStore.js";
import { useGenerationStore } from "./generationStore.js";

export interface ToolActivity {
  callId: string;
  tool: string;
  args?: unknown;
  result?: unknown;
  summary?: string;
  done: boolean;
  /** Whether the tool execution succeeded. False when the orchestrator
      reports a failed tool; true otherwise (defaults to true for
      backward-compat with emitters that omit the field). */
  ok: boolean;
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
  // Guardrail warnings surfaced by the orchestrator's pre/post hooks. Each
  // entry ties the warnings to the tool call that triggered them so the UI
  // can show why a request was adjusted or blocked.
  hookWarnings: { tool: string; warnings: string[] }[];
  goal: GoalNode | null;
  proactiveSuggestions: ProactiveSuggestion[];
  sessionSummary: SessionSummary | null;
  // Agent self-assessed confidence (0..1) for the most recent `done` event.
  // Null before the first turn completes or when the agent omits the field.
  confidence: number | null;
  // Parallel tool batches emitted during the current turn. Each entry
  // records the batch size and the tools that ran concurrently, so the UI
  // can surface parallelism. Cleared on the next `send`.
  parallelBatches: { count: number; tools: string[] }[];
  // Token usage for the most recent turn — emitted by the `done` event.
  // Zero for composed-tool paths that bypass the LLM.
  tokensIn: number;
  tokensOut: number;
  // Last checkpoint captured by the orchestrator before a spec-mutating
  // tool. Surfaced so the user knows a rollback target exists.
  lastCheckpoint: {
    checkpointId: string;
    triggerTool: string;
    componentCount: number;
    label: string;
  } | null;
  // Subagent delegations emitted during the current turn. Each entry
  // tracks the sub-goal, status, and outcome so the UI can show the
  // agent's parallel decomposition work.
  subagentActivity: {
    goal: string;
    toolCount: number;
    status: "running" | "done";
    allSucceeded?: boolean;
    durationMs?: number;
    iterationsUsed?: number;
    summary?: string;
  }[];
  // Iteration budget for the current turn — emitted periodically by the
  // orchestrator so the user can see how much agency budget remains.
  budgetRemaining: {
    label: string;
    consumed: number;
    initial: number;
    remaining: number;
  } | null;
  error: string | null;
  abortController: AbortController | null;
  // Active provider for the current stream (e.g. "mock", "openai", "router").
  provider: string | null;

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
  hookWarnings: [],
  goal: null,
  proactiveSuggestions: [],
  sessionSummary: null,
  confidence: null,
  parallelBatches: [],
  tokensIn: 0,
  tokensOut: 0,
  lastCheckpoint: null,
  subagentActivity: [],
  budgetRemaining: null,
  error: null,
  abortController: null,
  provider: null,

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
      reflection: null,
      hookWarnings: [],
      goal: null,
      proactiveSuggestions: [],
      sessionSummary: null,
      confidence: null,
      parallelBatches: [],
      tokensIn: 0,
      tokensOut: 0,
      lastCheckpoint: null,
      subagentActivity: [],
      budgetRemaining: null,
      error: null,
    });
    useGenerationStore.getState().startGeneration(text);

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
          case "hook_warning":
            set({
              hookWarnings: [
                ...get().hookWarnings,
                { tool: event.tool, warnings: event.warnings },
              ],
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
                { callId: event.callId, tool: event.tool, args: event.args, done: false, ok: true },
              ],
              activeStepIndex: activeStep,
            });
            useGenerationStore.getState().recordToolCall(event.tool);
            break;
          }
          case "parallel_tool_batch": {
            set({
              parallelBatches: [
                ...get().parallelBatches,
                { count: event.count, tools: event.tools },
              ],
            });
            break;
          }
          case "tool_result": {
            const activity = get().toolActivity.map((a) =>
              a.callId === event.callId
                ? { ...a, result: event.result, summary: event.summary, done: true, ok: event.ok }
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
          case "spec_update": {
            // Track which components existed before the update so we can
            // auto-select newly created ones for immediate editing.
            const prevIds = new Set(useProjectStore.getState().components.map((c) => c.id));
            useProjectStore.getState().applySpecUpdate(event.components, event.project);
            if (event.project?.tokens) {
              const t = event.project.tokens;
              const w = Number(t.artboardWidth) || 0;
              const h = Number(t.artboardHeight) || 0;
              if (w && h) useUiStore.getState().setCanvasSize({ width: w, height: h });
            }
            // Auto-select the first newly created component so the user can
            // immediately edit it without manually finding it on the canvas.
            const newComp = event.components.find((c: { id: string }) => !prevIds.has(c.id));
            if (newComp) {
              useUiStore.getState().selectComponent((newComp as { id: string }).id);
            }
            // Auto-fit the canvas so generated content is centered for editing.
            useUiStore.getState().triggerFitToScreen();
            // Flash newly generated content on the canvas so the user's eye
            // is drawn to what the agent just created.
            useUiStore.getState().triggerGenerationFlash();
            // Commit generation record with the resulting component IDs.
            useGenerationStore.getState().commitGeneration(
              event.components.map((c: { id: string }) => c.id),
              event.components.length,
            );
            break;
          }
          case "proactive_suggestion":
            set({ proactiveSuggestions: event.suggestions });
            break;
          case "session_summary":
            set({ sessionSummary: event.summary });
            // Attach the session summary to the most recent generation.
            useGenerationStore.getState().updateLastGeneration({ summary: event.summary });
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
              confidence: event.confidence ?? null,
              tokensIn: event.tokensIn ?? 0,
              tokensOut: event.tokensOut ?? 0,
              abortController: null,
            });
            break;
          }
          case "checkpoint":
            set({
              lastCheckpoint: {
                checkpointId: event.checkpointId,
                triggerTool: event.triggerTool,
                componentCount: event.componentCount,
                label: event.label,
              },
            });
            break;
          case "subagent_started":
            set({
              subagentActivity: [
                ...get().subagentActivity,
                {
                  goal: event.goal,
                  toolCount: event.toolCount,
                  status: "running" as const,
                },
              ],
            });
            break;
          case "subagent_completed": {
            // Mark the most recent running subagent with the same goal as
            // completed. Matching by goal keeps the wiring resilient to
            // callId propagation gaps between subagent and orchestrator.
            const updated = get().subagentActivity;
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].goal === event.goal && updated[i].status === "running") {
                updated[i] = {
                  ...updated[i],
                  status: "done",
                  allSucceeded: event.allSucceeded,
                  durationMs: event.durationMs,
                  iterationsUsed: event.iterationsUsed,
                  summary: event.summary,
                };
                break;
              }
            }
            set({ subagentActivity: [...updated] });
            break;
          }
          case "budget":
            set({
              budgetRemaining: {
                label: event.label,
                consumed: event.consumed,
                initial: event.initial,
                remaining: event.remaining,
              },
            });
            break;
          case "error":
            set({ isStreaming: false, streamingTokens: "", plan: null, completedStepIndices: [], activeStepIndex: -1, reasoningText: "", thinking: null, reflection: null, goal: null, proactiveSuggestions: [], error: event.message, abortController: null });
            break;
          case "editor_command": {
            // Dispatch editor commands emitted by editor_* tools to the
            // corresponding uiStore / projectStore actions so the Agent can
            // drive the entire Motion editor UI through chat.
            const ui = useUiStore.getState();
            const project = useProjectStore.getState();
            const cmd = event.command;
            const a = event.args as Record<string, unknown>;
            switch (cmd) {
              case "setCanvasZoom":
                ui.setCanvasZoom(Number(a.zoom));
                break;
              case "setCanvasPan":
                ui.setCanvasPan({ x: Number(a.x), y: Number(a.y) });
                break;
              case "fitToScreen":
                ui.triggerFitToScreen();
                break;
              case "setPlayheadMs":
                ui.setPlayheadMs(Number(a.timeMs));
                break;
              case "setPlaybackSpeed":
                ui.setPlaybackSpeed(Number(a.speed));
                break;
              case "setPlaying":
                useUiStore.getState().setIsPlaying(Boolean(a.playing));
                break;
              case "setShowRulers":
                ui.setShowRulers(Boolean(a.show));
                break;
              case "toggleRulers":
                ui.setShowRulers(!ui.showRulers);
                break;
              case "setSnapToGrid":
                ui.setSnapToGrid(Boolean(a.enabled));
                break;
              case "toggleSnap":
                ui.setSnapToGrid(!ui.snapToGrid);
                break;
              case "setGridSize":
                ui.setSnapSize(Number(a.size));
                break;
              case "setAutoKeyframe":
                ui.setAutoKeyframe(Boolean(a.enabled));
                break;
              case "toggleAutoKeyframe":
                ui.setAutoKeyframe(!ui.autoKeyframe);
                break;
              case "setOnionSkin":
                ui.setOnionSkin({ enabled: Boolean(a.enabled) });
                break;
              case "toggleOnionSkin":
                ui.setOnionSkin({ enabled: !ui.onionSkin.enabled });
                break;
              case "setOnionSkinFrames":
                ui.setOnionSkin({ frames: Number(a.count) });
                break;
              case "setOnionSkinOpacity":
                ui.setOnionSkin({ opacity: Number(a.opacity) });
                break;
              case "selectComponent":
                ui.selectComponent(String(a.componentId));
                break;
              case "addToSelection":
                ui.addToSelection(String(a.componentId));
                break;
              case "setSelectedIds": {
                const ids = Array.isArray(a.ids) ? (a.ids as unknown[]).map(String) : [];
                ui.setSelectedIds(ids);
                break;
              }
              case "clearSelection":
                ui.clearSelection();
                break;
              case "toggleHidden":
                ui.toggleHidden(String(a.componentId));
                break;
              case "setLock":
                ui.setLock(String(a.componentId), Boolean(a.locked));
                break;
              case "toggleLock":
                ui.toggleLock(String(a.componentId));
                break;
              case "setRightPanelCategory":
                ui.setRightPanelCategory(a.category as "design" | "motion" | "intel" | "assets" | "output");
                break;
              case "setRightPanelTab":
                ui.setRightPanelTab(a.tab as Parameters<typeof ui.setRightPanelTab>[0]);
                break;
              case "setRightPanelCollapsed":
                ui.setRightPanelCollapsed(Boolean(a.collapsed));
                break;
              case "toggleRightPanel":
                ui.setRightPanelCollapsed(!ui.rightPanelCollapsed);
                break;
              case "setPreviewOpen":
                ui.setPreviewOpen(Boolean(a.open));
                break;
              case "setExportOpen":
                ui.setExportOpen(Boolean(a.open));
                break;
              case "setTemplatesOpen":
                ui.setTemplatesOpen(Boolean(a.open));
                break;
              case "setSettingsOpen":
                ui.setSettingsOpen(Boolean(a.open));
                break;
              case "setCommandPaletteOpen":
                ui.setCommandPaletteOpen(Boolean(a.open));
                break;
              case "setArtboard": {
                const w = Number(a.width);
                const h = Number(a.height);
                if (w && h) ui.setCanvasSize({ width: w, height: h });
                break;
              }
              case "undo":
                project.undo();
                break;
              case "redo":
                project.redo();
                break;
              case "triggerReplay":
                ui.triggerReplay();
                break;
              case "setShowMotionPaths":
                ui.setShowMotionPaths(Boolean(a.show));
                break;
              case "toggleMotionPaths":
                ui.setShowMotionPaths(!ui.showMotionPaths);
                break;
              case "setShowPerformanceMonitor":
                ui.setShowPerformanceMonitor(Boolean(a.show));
                break;
              case "togglePerformanceMonitor":
                ui.setShowPerformanceMonitor(!ui.showPerformanceMonitor);
                break;
              case "setSoloedId":
                ui.setSoloedId(a.id ? String(a.id) : null);
                break;
              case "setSidebarCollapsed":
                ui.setSidebarCollapsed(Boolean(a.collapsed));
                break;
              case "toggleSidebar":
                ui.setSidebarCollapsed(!ui.sidebarCollapsed);
                break;
              case "setTimelineCommand":
                ui.setTimelineCommand(String(a.action));
                break;
              case "toggleSelection":
                ui.toggleSelection(String(a.componentId));
                break;
              case "setSkillsOpen":
                ui.setSkillsOpen(Boolean(a.open));
                break;
              case "setShortcutsOpen":
                ui.setShortcutsOpen(Boolean(a.open));
                break;
              case "setTrackOrder": {
                const trackIds = Array.isArray(a.trackIds) ? (a.trackIds as unknown[]).map(String) : [];
                ui.setTrackOrder(trackIds);
                break;
              }
              case "setPlaybackRange": {
                const range = a.range as { startMs: number; endMs: number } | null;
                ui.setPlaybackRange(range);
                break;
              }
            }
            break;
          }
          case "meta":
            set({ provider: event.provider });
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
    set({ isStreaming: false, streamingTokens: "", plan: null, completedStepIndices: [], activeStepIndex: -1, reasoningText: "", thinking: null, reflection: null, goal: null, sessionSummary: null, parallelBatches: [], abortController: null });
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
      parallelBatches: [],
      tokensIn: 0,
      tokensOut: 0,
      lastCheckpoint: null,
      subagentActivity: [],
      budgetRemaining: null,
      error: null,
      abortController: null,
      isStreaming: false,
    });
  },
}));
