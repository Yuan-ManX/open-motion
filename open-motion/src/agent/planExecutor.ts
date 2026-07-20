/**
 * Plan-then-Execute Mode — structured decomposition with reviewable steps.
 *
 * Distinct from the existing ReAct loop (which interleaves planning and
 * execution), Plan-then-Execute produces a complete typed plan UP FRONT,
 * surfaces it for user review, and then executes the steps sequentially
 * with live progress and cancel support.
 *
 * The mode is opt-in: simple requests (single tool calls, composed
 * patterns) skip this path and go directly through the existing loop.
 * Complex multi-step requests — identified by intent classification —
 * route through here for a reviewable, cancellable experience.
 *
 * Action vocabulary (inspired by professional editing workflows):
 *   - create_layer      Add a new layer (text, shape, image, video, audio)
 *   - apply_template    Apply a named template
 *   - apply_preset      Apply a stackable preset (entrance/emphasis/exit)
 *   - set_easing        Change the easing curve
 *   - set_timing        Adjust duration / delay / loop
 *   - set_transform     Position / rotation / scale / anchor
 *   - set_color         Fill / stroke / background color
 *   - set_style         Style preset (playful, dramatic, etc.)
 *   - choreograph       Multi-component choreography pattern
 *   - apply_effect      Filter / shader / 3D / lighting effect
 *   - apply_recipe      Reusable motion recipe
 *   - capture_state     Snapshot current state for state machine
 *   - add_transition    Wire a transition between states
 *   - export            Export to HTML / CSS / React / Lottie / video
 *   - analyze           Run an analysis tool (mood, principles, etc.)
 *   - synthesize        Generate code / easing / motion from description
 *
 * Each action maps to one or more concrete tool calls. The plan is a tree
 * (actions can have sub-actions) so the UI can show phase hierarchy.
 */

import type { MotionSpec, ToolName } from "@openmotion/shared";
import { classifyIntent, resolveTemplateId, resolvePresetName } from "./intents.js";

export type ActionType =
  | "create_layer"
  | "apply_template"
  | "apply_preset"
  | "set_easing"
  | "set_timing"
  | "set_transform"
  | "set_color"
  | "set_style"
  | "choreograph"
  | "apply_effect"
  | "apply_recipe"
  | "capture_state"
  | "add_transition"
  | "export"
  | "analyze"
  | "synthesize";

export interface PlanAction {
  /** Unique id within the plan. */
  id: string;
  /** Action type from the vocabulary. */
  type: ActionType;
  /** Human-readable description for UI display. */
  description: string;
  /** Concrete tool calls this action resolves to. */
  toolCalls: Array<{ tool: ToolName; args: Record<string, unknown>; reason: string }>;
  /** Whether this action mutates the spec (vs. read-only analysis). */
  mutatesSpec: boolean;
  /** Estimated complexity 1-5 (drives UI affordances). */
  complexity: 1 | 2 | 3 | 4 | 5;
  /** Optional child actions (for hierarchical plans). */
  children?: PlanAction[];
}

export interface StructuredPlan {
  actions: PlanAction[];
  /** Short summary for the plan header. */
  summary: string;
  /** Total tool calls across all actions. */
  totalToolCalls: number;
  /** Whether any action mutates the spec. */
  mutatesSpec: boolean;
  /** Estimated total complexity (sum of action complexities). */
  totalComplexity: number;
}

let actionCounter = 0;
function nextActionId(): string {
  actionCounter = (actionCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `a_${actionCounter.toString(36)}`;
}

/**
 * Compose a structured plan from a user message and the current spec.
 * Rule-based so it works in mock mode without an LLM round-trip.
 *
 * The plan is decomposed into typed actions, each mapping to concrete tool
 * calls. The orchestrator can surface this plan for review before executing.
 */
export function composeStructuredPlan(userMessage: string, spec: MotionSpec): StructuredPlan {
  const text = userMessage.toLowerCase();
  const actions: PlanAction[] = [];
  const firstId = spec.components[0]?.id;
  const intent = classifyIntent(userMessage);

  // 1. Create / template
  const createM = userMessage.match(
    /\b(?:create|make|build|generate|design|add)\s+(?:a\s+|an\s+|the\s+)?([\w][\w\s-]*?)\s+(?:animation|effect|motion|transition|layer|element|component)\b/i,
  );
  if (createM) {
    const raw = createM[1].trim();
    const resolved = resolveTemplateId(raw);
    actions.push({
      id: nextActionId(),
      type: resolved ? "apply_template" : "create_layer",
      description: resolved
        ? `Create a ${raw} animation from the ${resolved} template`
        : `Add a new layer called "${raw}"`,
      toolCalls: resolved
        ? [{ tool: "set_template" as ToolName, args: { templateId: resolved }, reason: `apply ${resolved} template` }]
        : [{ tool: "add_layer" as ToolName, args: { name: raw }, reason: `create ${raw} layer` }],
      mutatesSpec: true,
      complexity: 2,
    });
  }

  // 2. Style preset
  const styleM = userMessage.match(/\b(?:playful|energetic|calm|professional|dramatic|minimal|cinematic|glassy|retro|futuristic|organic|mechanical|luxury)\b/i);
  if (styleM && firstId) {
    actions.push({
      id: nextActionId(),
      type: "set_style",
      description: `Apply the ${styleM[0]} style preset`,
      toolCalls: [{ tool: "apply_style" as ToolName, args: { style: styleM[0].toLowerCase() }, reason: `${styleM[0]} style` }],
      mutatesSpec: true,
      complexity: 1,
    });
  }

  // 3. Easing
  const easingM = userMessage.match(/\b(bouncy|bounce|springy|smooth|soft|snappy|sharp|crisp|elastic|back|linear|ease-in-out|ease-in|ease-out)\b/i);
  if (easingM && firstId) {
    actions.push({
      id: nextActionId(),
      type: "set_easing",
      description: `Set easing to ${easingM[1]}`,
      toolCalls: [{ tool: "set_easing" as ToolName, args: { preset: easingM[1] }, reason: `${easingM[1]} easing` }],
      mutatesSpec: true,
      complexity: 1,
    });
  }

  // 4. Spring physics
  if (/\bspring\b/i.test(text) && firstId) {
    actions.push({
      id: nextActionId(),
      type: "set_easing",
      description: "Apply spring physics",
      toolCalls: [{ tool: "set_spring" as ToolName, args: {}, reason: "spring physics" }],
      mutatesSpec: true,
      complexity: 2,
    });
  }

  // 5. Duration / timing
  const durM = userMessage.match(/(\d+)\s*(ms|seconds?|s)\b/i);
  if (durM && firstId) {
    const value = parseInt(durM[1], 10);
    const ms = /ms/i.test(durM[2]) ? value : value * 1000;
    actions.push({
      id: nextActionId(),
      type: "set_timing",
      description: `Set duration to ${ms}ms`,
      toolCalls: [{ tool: "set_duration" as ToolName, args: { durationMs: ms }, reason: `${ms}ms duration` }],
      mutatesSpec: true,
      complexity: 1,
    });
  } else if (/\b(slower|faster|slow|fast|quick|speed)\b/i.test(text) && firstId) {
    actions.push({
      id: nextActionId(),
      type: "set_timing",
      description: "Adjust the animation duration",
      toolCalls: [{ tool: "set_duration" as ToolName, args: {}, reason: "duration adjustment" }],
      mutatesSpec: true,
      complexity: 1,
    });
  }

  // 6. Color
  const hexM = userTextHex(userMessage);
  if (hexM && firstId) {
    actions.push({
      id: nextActionId(),
      type: "set_color",
      description: `Set color to ${hexM}`,
      toolCalls: [{ tool: "set_color" as ToolName, args: { color: hexM }, reason: `${hexM} color` }],
      mutatesSpec: true,
      complexity: 1,
    });
  }

  // 7. Choreography
  const choreoM = userMessage.match(/\b(cascade|wave|ripple|canon|converge|spiral|explosion|assembly|breathing|domino|scatter)\b/i);
  if (choreoM && spec.components.length >= 2) {
    actions.push({
      id: nextActionId(),
      type: "choreograph",
      description: `Apply ${choreoM[1]} choreography to ${spec.components.length} components`,
      toolCalls: [{ tool: "apply_choreography" as ToolName, args: { pattern: choreoM[1].toLowerCase() }, reason: `${choreoM[1]} pattern` }],
      mutatesSpec: true,
      complexity: 3,
    });
  }

  // 8. Preset
  const presetM = userMessage.match(/\b(shake|wiggle|float|glow|heartbeat|typewriter)\b/i);
  if (presetM && firstId) {
    const name = resolvePresetName(presetM[1]);
    actions.push({
      id: nextActionId(),
      type: "apply_preset",
      description: `Apply the ${name ?? presetM[1]} preset`,
      toolCalls: [{ tool: "apply_preset" as ToolName, args: { preset: name ?? presetM[1].toLowerCase() }, reason: `${presetM[1]} preset` }],
      mutatesSpec: true,
      complexity: 2,
    });
  }

  // 9. Export
  const exportM = userMessage.match(/\bexport\s+(?:to\s+)?(html|css|react|lottie|video|code)\b/i);
  if (exportM) {
    actions.push({
      id: nextActionId(),
      type: "export",
      description: `Export to ${exportM[1].toUpperCase()}`,
      toolCalls: [{ tool: `export_${exportM[1]}` as ToolName, args: {}, reason: `${exportM[1]} export` }],
      mutatesSpec: false,
      complexity: 1,
    });
  }

  // 10. Analysis
  if (/\b(analyze|analyse|check|inspect|evaluate)\b/i.test(text)) {
    const analysisType = userMessage.match(/\b(mood|emotion|principles|pacing|rhythm|narrative|accessibility|performance|restraint)\b/i)?.[1] ?? "motion";
    actions.push({
      id: nextActionId(),
      type: "analyze",
      description: `Analyze ${analysisType}`,
      toolCalls: [{ tool: `analyze_${analysisType}` as ToolName, args: {}, reason: `${analysisType} analysis` }],
      mutatesSpec: false,
      complexity: 1,
    });
  }

  // Fallback: if no actions matched, emit a single "synthesize" action
  // so the plan is never empty.
  if (actions.length === 0) {
    actions.push({
      id: nextActionId(),
      type: "synthesize",
      description: `Process request: "${userMessage.slice(0, 80)}"`,
      toolCalls: [],
      mutatesSpec: false,
      complexity: 1,
    });
  }

  const totalToolCalls = actions.reduce((sum, a) => sum + a.toolCalls.length, 0);
  const totalComplexity = actions.reduce((sum, a) => sum + a.complexity, 0);
  const mutatesSpec = actions.some((a) => a.mutatesSpec);

  const summary = actions.length === 1
    ? actions[0].description
    : `${actions.length} steps: ${actions.map((a) => a.description).join(" → ")}`;

  return { actions, summary, totalToolCalls, mutatesSpec, totalComplexity };
}

function userTextHex(text: string): string | null {
  const m = text.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  return m ? `#${m[1]}` : null;
}

/**
 * Determine whether a request is complex enough to warrant the
 * Plan-then-Execute path (vs. the simpler ReAct loop).
 *
 * Heuristics:
 *   - Multiple action keywords (e.g., "create + style + easing")
 *   - Explicit "plan" / "step by step" / "first...then..." language
 *   - Choreography requests (always multi-step)
 *   - Requests with 3+ distinct intent keywords
 */
export function shouldUsePlanMode(userMessage: string, spec: MotionSpec): boolean {
  const text = userMessage.toLowerCase();

  // Explicit plan language
  if (/\b(plan|step\s+by\s+step|first\s+.*\s+then|pipeline|workflow)\b/i.test(text)) return true;

  // Count action keywords
  const actionKeywords = [
    /\b(create|make|build|generate|design|add)\b/i,
    /\b(apply|use)\b/i,
    /\b(set|change|adjust)\b/i,
    /\b(animate|animation|motion)\b/i,
    /\b(style|easing|duration|color|preset|template)\b/i,
    /\b(export|analyze|synthesize)\b/i,
  ];
  let matchCount = 0;
  for (const re of actionKeywords) {
    if (re.test(text)) matchCount++;
  }
  if (matchCount >= 3) return true;

  // Choreography always benefits from a plan
  if (/\b(cascade|wave|ripple|canon|converge|spiral|explosion|assembly|breathing|domino|scatter)\b/i.test(text)) {
    return spec.components.length >= 2;
  }

  return false;
}

/**
 * Execution state for a running plan. The orchestrator updates this as
 * each action completes; the UI reads it to render live progress.
 */
export interface PlanExecutionState {
  plan: StructuredPlan;
  /** Index of the currently-executing action. */
  currentActionIndex: number;
  /** IDs of completed actions. */
  completedActionIds: Set<string>;
  /** IDs of failed actions. */
  failedActionIds: Set<string>;
  /** Whether the user has requested cancellation. */
  cancelRequested: boolean;
  /** Wall-clock start time. */
  startedAt: number;
  /** Wall-clock end time (set when plan completes or cancels). */
  endedAt: number | null;
}

export function initPlanExecution(plan: StructuredPlan): PlanExecutionState {
  return {
    plan,
    currentActionIndex: -1,
    completedActionIds: new Set(),
    failedActionIds: new Set(),
    cancelRequested: false,
    startedAt: Date.now(),
    endedAt: null,
  };
}

/** Mark an action as completed. */
export function completeAction(state: PlanExecutionState, actionId: string): void {
  state.completedActionIds.add(actionId);
}

/** Mark an action as failed. */
export function failAction(state: PlanExecutionState, actionId: string): void {
  state.failedActionIds.add(actionId);
}

/** Request cancellation — the executor checks this between actions. */
export function requestCancel(state: PlanExecutionState): void {
  state.cancelRequested = true;
}

/** Percentage complete (0-1). */
export function planProgress(state: PlanExecutionState): number {
  if (state.plan.actions.length === 0) return 0;
  return state.completedActionIds.size / state.plan.actions.length;
}

/** Whether the plan is finished (all actions completed/failed or cancelled). */
export function isPlanFinished(state: PlanExecutionState): boolean {
  if (state.cancelRequested) return true;
  const total = state.plan.actions.length;
  const done = state.completedActionIds.size + state.failedActionIds.size;
  return done >= total;
}
