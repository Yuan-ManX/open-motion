/**
 * Session Summary Generator — produces a human-readable recap of what was
 * accomplished during an Agent conversation session.
 *
 * Unlike session lineage (which tracks ancestry) and memory compression
 * (which condenses the transcript), the summary generator synthesizes a
 * narrative from tool calls, goal outcomes, and spec deltas. It answers:
 *   - What did the user ask for?
 *   - What did the Agent do?
 *   - What changed in the project?
 *   - What should the user consider next?
 *
 * Rule-based so it works in mock mode without an LLM.
 */

import type { LlmToolCall } from "./provider/types.js";
import type { ToolResult } from "./tools/registry.js";
import type { GoalTree } from "./goals.js";
import { goalProgress } from "./goals.js";

export interface SessionSummary {
  /** One-sentence headline capturing the session's outcome. */
  headline: string;
  /** What the user originally requested. */
  intent: string;
  /** Key actions the Agent took, in order. */
  actions: string[];
  /** Net changes to the project spec. */
  outcomes: string[];
  /** Metrics: tool calls, goals completed, iterations. */
  metrics: {
    toolCalls: number;
    successes: number;
    failures: number;
    goalsTotal: number;
    goalsCompleted: number;
  };
  /** Suggested next steps. */
  nextSteps: string[];
}

interface SummaryInput {
  userMessage: string;
  toolCalls: LlmToolCall[];
  toolResults: ToolResult[];
  goalTree: GoalTree | null;
  componentCountBefore: number;
  componentCountAfter: number;
}

/** Generate a session summary from the conversation artifacts. */
export function generateSessionSummary(input: SummaryInput): SessionSummary {
  const { userMessage, toolCalls, toolResults, goalTree, componentCountBefore, componentCountAfter } = input;

  const intent = extractIntent(userMessage);
  const actions = extractActions(toolCalls, toolResults);
  const outcomes = extractOutcomes(toolResults, componentCountBefore, componentCountAfter);
  const metrics = computeMetrics(toolCalls, toolResults, goalTree);
  const headline = buildHeadline(intent, outcomes, metrics);
  const nextSteps = suggestNextSteps(outcomes, toolCalls);

  return { headline, intent, actions, outcomes, metrics, nextSteps };
}

function extractIntent(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= 120) return trimmed;
  return trimmed.slice(0, 120).replace(/\s+\S*$/, "") + "…";
}

function extractActions(calls: LlmToolCall[], results: ToolResult[]): string[] {
  const actions: string[] = [];
  const toolLabel: Record<string, string> = {
    set_template: "Applied template",
    add_layer: "Added layer",
    add_shape: "Added shape",
    add_image: "Added image",
    add_video: "Added video",
    add_audio: "Added audio",
    add_scene: "Created scene",
    remove_component: "Removed component",
    set_easing: "Adjusted easing",
    set_spring: "Configured spring physics",
    set_duration: "Changed duration",
    set_delay: "Set delay",
    set_color: "Updated color",
    set_keyframe: "Edited keyframe",
    set_transform: "Applied transform",
    batch_update: "Batch-updated components",
    stagger_components: "Staggered components",
    choreograph: "Choreographed sequence",
    apply_preset: "Applied preset",
    apply_style: "Applied style preset",
    apply_recipe: "Applied motion recipe",
    duplicate_component: "Duplicated component",
    reorder_components: "Reordered components",
    export_html: "Exported HTML",
    export_code: "Exported code",
    export_video: "Exported video",
    save_version: "Saved version",
    save_memory: "Saved to memory",
    save_pipeline: "Saved pipeline",
    set_shader_effect: "Applied shader effect",
    create_variant: "Created variant",
    harmonize_colors: "Harmonized colors",
    refine_motion: "Refined motion",
    analyze_motion: "Analyzed motion",
    recognize_pattern: "Recognized patterns",
  };

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    const result = results[i];
    const label = toolLabel[call.tool] ?? call.tool.replace(/_/g, " ");
    const status = result?.ok ? "" : " (failed)";
    const detail = extractDetail(call);
    actions.push(`${label}${detail ? `: ${detail}` : ""}${status}`);
  }

  return actions;
}

function extractDetail(call: LlmToolCall): string {
  const args = call.args as Record<string, unknown>;
  if (typeof args.name === "string") return args.name;
  if (typeof args.templateId === "string") return args.templateId;
  if (typeof args.preset === "string") return args.preset;
  if (typeof args.styleId === "string") return args.styleId;
  if (typeof args.shape === "string") return args.shape;
  if (typeof args.pattern === "string") return args.pattern;
  if (typeof args.refinement === "string") return args.refinement;
  if (typeof args.scheme === "string") return args.scheme;
  return "";
}

function extractOutcomes(results: ToolResult[], before: number, after: number): string[] {
  const outcomes: string[] = [];
  const delta = after - before;

  if (delta > 0) {
    outcomes.push(`Added ${delta} component(s) to the project`);
  } else if (delta < 0) {
    outcomes.push(`Removed ${Math.abs(delta)} component(s) from the project`);
  }

  const specChangedCount = results.filter((r) => r.specChanged).length;
  if (specChangedCount > 0) {
    outcomes.push(`Modified project spec ${specChangedCount} time(s)`);
  }

  const exportCount = results.filter((r) => /export/i.test(r.summary)).length;
  if (exportCount > 0) {
    outcomes.push(`Generated ${exportCount} export artifact(s)`);
  }

  if (outcomes.length === 0) {
    const anySuccess = results.some((r) => r.ok);
    if (anySuccess) {
      outcomes.push("Project state updated");
    } else {
      outcomes.push("No changes applied — all operations failed");
    }
  }

  return outcomes;
}

function computeMetrics(
  calls: LlmToolCall[],
  results: ToolResult[],
  goalTree: GoalTree | null,
): SessionSummary["metrics"] {
  const successes = results.filter((r) => r.ok).length;
  const failures = results.length - successes;
  const progress = goalTree ? goalProgress(goalTree) : { total: 0, completed: 0, inProgress: 0 };

  return {
    toolCalls: calls.length,
    successes,
    failures,
    goalsTotal: progress.total,
    goalsCompleted: progress.completed,
  };
}

function buildHeadline(intent: string, outcomes: string[], metrics: SessionSummary["metrics"]): string {
  if (metrics.failures === metrics.toolCalls && metrics.toolCalls > 0) {
    return `Unable to complete: ${intent.slice(0, 60)}…`;
  }
  if (outcomes.length === 0) {
    return "Session completed";
  }
  const primary = outcomes[0];
  const successRate = metrics.toolCalls > 0 ? Math.round((metrics.successes / metrics.toolCalls) * 100) : 100;
  return `${primary} (${successRate}% success rate)`;
}

function suggestNextSteps(outcomes: string[], calls: LlmToolCall[]): string[] {
  const steps: string[] = [];
  const toolsUsed = new Set(calls.map((c) => c.tool));

  if (outcomes.some((o) => /Added.*component/i.test(o))) {
    steps.push("Preview the animation to verify the new components look correct");
  }
  if (toolsUsed.has("set_template") || toolsUsed.has("add_layer")) {
    steps.push("Fine-tune the timing and easing to match your desired feel");
  }
  if (toolsUsed.has("stagger_components") || toolsUsed.has("choreograph")) {
    steps.push("Review the choreography in the timeline and adjust stagger if needed");
  }
  if (toolsUsed.has("set_easing") || toolsUsed.has("set_spring")) {
    steps.push("Compare the new motion feel with the previous version");
  }
  if (!toolsUsed.has("export_html") && !toolsUsed.has("export_code")) {
    steps.push("Export the result when you're satisfied with the motion");
  }
  if (toolsUsed.has("save_version")) {
    steps.push("Continue iterating — you can always restore the saved version");
  }

  if (steps.length === 0) {
    steps.push("Continue refining the motion or ask for suggestions");
  }

  return steps.slice(0, 4);
}
