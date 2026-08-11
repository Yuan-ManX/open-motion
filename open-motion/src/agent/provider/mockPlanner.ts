/** Mock planner — produces intent-aware reasoning narratives and post-tool summaries for mock-mode sessions. */

import type { LlmMessage, LlmToolCall } from "./types.js";
import { extractText } from "./types.js";

/** Phrases that indicate a tool result represents a failure. */
const FAILURE_MARKERS = [
  "error",
  "failed",
  "not found",
  "invalid",
  "cannot",
  "can't",
  "unable",
  "missing",
  "does not exist",
  "doesn't exist",
  "rejected",
  "unsupported",
  "out of range",
  "must be",
  "expected",
];

/** Detect whether a tool result summary indicates failure. */
function isFailureSummary(summary: string): boolean {
  const lower = summary.toLowerCase();
  return FAILURE_MARKERS.some((m) => lower.includes(m));
}

/** Truncate a result sentence to a readable length for the summary line. */
function clip(text: string, max = 120): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  // Try to cut at a sentence boundary first.
  const sentenceEnd = trimmed.slice(0, max).search(/[.!?]\s/);
  if (sentenceEnd > 30) return trimmed.slice(0, sentenceEnd + 1);
  return trimmed.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Classify the high-level intent of a user message so the narrative can
 * open with a goal-oriented framing. Returns null when no clear intent.
 */
function classifyGoalIntent(userText: string): string | null {
  const t = userText.toLowerCase();
  if (/\b(animate|add motion|make it move|bring to life)\b/.test(t)) return "animate";
  if (/\b(tune|adjust|tweak|change|make it|slower|faster|snappier|smoother)\b/.test(t)) return "tune";
  if (/\b(apply|use|set)\s+(a\s+|an\s+)?(template|preset|style|easing)/.test(t)) return "apply";
  if (/\b(export|download|generate|render)\b/.test(t)) return "export";
  if (/\b(analyze|review|critique|score|inspect|audit)\b/.test(t)) return "analyze";
  if (/\b(choreograph|cascade|wave|stagger|sequence)\b/.test(t)) return "choreograph";
  if (/\b(create|add|new)\s+(a\s+|an\s+)?(layer|element|component|scene|text|shape)/.test(t)) return "create";
  if (/\b(describe|what.*look|dna|characterize|explain)\b/.test(t)) return "describe";
  if (/\b(suggest|ideas?|what next|recommend)\b/.test(t)) return "suggest";
  return null;
}

/** Map a tool name to a short verb phrase used in the narrative. */
function toolVerbPhrase(tool: string): string {
  const v: Record<string, string> = {
    set_template: "apply the template",
    set_easing: "set the easing",
    set_duration: "set the duration",
    set_spring: "tune the spring physics",
    set_delay: "set the delay",
    set_loop: "configure the loop",
    set_fill: "set the fill mode",
    set_color: "set the color",
    set_background: "set the background",
    set_border_radius: "round the corners",
    set_transform: "set the transform",
    add_keyframe: "add a keyframe",
    add_layer: "add a layer",
    add_scene: "add a scene",
    add_scene_transition: "add a scene transition",
    remove_layer: "remove the layer",
    set_template_by_name: "apply the named template",
    apply_preset: "apply the preset",
    apply_style_preset: "apply the style preset",
    choreograph: "choreograph the components",
    export_html: "export HTML",
    export_css: "export CSS",
    export_video: "export video",
    export_lottie: "export Lottie",
    export_skill: "package as a skill",
    describe_motion: "describe the motion",
    analyze_motion: "analyze the motion",
    analyze_principles: "analyze animation principles",
    self_correct: "self-correct the motion",
    verify_motion: "verify the motion",
    suggest_next: "suggest next steps",
    translate_lexicon: "translate the intent",
    set_global_timing: "set global timing",
    set_tempo: "set the tempo",
    set_phase: "set the phase",
  };
  return v[tool] ?? tool.replace(/_/g, " ");
}

/**
 * Phase 1 — build a structured reasoning narrative for a planned tool sequence.
 * Falls back to the joined per-call replies when only one call is planned.
 */
export function buildPlanNarrative(
  calls: LlmToolCall[],
  replies: string[],
  userText: string,
): string {
  if (calls.length === 0) return "";
  if (calls.length === 1) {
    return replies[0] ?? `I'll ${toolVerbPhrase(calls[0].tool)} now.`;
  }

  const goal = classifyGoalIntent(userText);
  const opener = goal
    ? `Plan to ${goal}: `
    : "Here's the plan: ";

  const steps = calls.map((c, i) => {
    const verb = toolVerbPhrase(c.tool);
    const detail = replies[i] ? clip(replies[i], 90) : "";
    const num = i + 1;
    const label = i === 0 ? "first"
      : i === calls.length - 1 ? "finally"
      : "then";
    return `(${num}) ${label}, ${verb}${detail ? " — " + detail : ""}`;
  });

  return opener + steps.join("; ") + ". Starting now.";
}

/** A single tool outcome extracted from the message history. */
interface ToolOutcome {
  tool: string;
  callId: string;
  ok: boolean;
  summary: string;
}

/**
 * Collect the tool outcomes that correspond to the last assistant tool-call
 * batch. Returns an ordered list matching the order of `lastToolCalls`.
 */
function collectOutcomes(
  messages: LlmMessage[],
  lastToolCalls: LlmToolCall[],
): ToolOutcome[] {
  if (lastToolCalls.length === 0) return [];
  const wanted = new Set(lastToolCalls.map((c) => c.callId));
  const byId = new Map<string, ToolOutcome>();
  for (const m of messages) {
    if (m.role !== "tool" || !m.toolCallId || !wanted.has(m.toolCallId)) continue;
    if (byId.has(m.toolCallId)) continue; // first occurrence wins
    const summary = extractText(m.content);
    byId.set(m.toolCallId, {
      tool: m.toolName ?? "tool",
      callId: m.toolCallId,
      ok: !isFailureSummary(summary),
      summary,
    });
  }
  // Preserve the order of the original tool calls.
  return lastToolCalls
    .map((c) => byId.get(c.callId))
    .filter((o): o is ToolOutcome => o !== undefined);
}

/**
 * Phase 2 — compose an adaptive summary after tools have executed.
 * Inspects each tool result, reports success/failure concretely, and
 * offers a context-aware follow-up (retry on failure, refinement on success).
 */
export function summarizeAfterTools(
  messages: LlmMessage[],
  lastAssistantToolCalls: LlmToolCall[],
  userText: string,
): string {
  const outcomes = collectOutcomes(messages, lastAssistantToolCalls);

  if (outcomes.length === 0) {
    return "Done. Anything else you'd like to adjust?";
  }

  const succeeded = outcomes.filter((o) => o.ok);
  const failed = outcomes.filter((o) => !o.ok);

  // Single-tool fast path — keep it conversational.
  if (outcomes.length === 1) {
    const o = outcomes[0];
    const detail = clip(o.summary, 140);
    if (o.ok) {
      return `${detail} Anything else you'd like to tune?`;
    }
    return `That didn't quite work — ${detail}. Want me to try a different approach?`;
  }

  // Multi-tool path — summarize per outcome.
  const parts: string[] = [];
  if (succeeded.length > 0) {
    const details = succeeded.map((o) => {
      const verb = toolVerbPhrase(o.tool);
      return `${verb}: ${clip(o.summary, 80)}`;
    });
    parts.push(`${succeeded.length}/${outcomes.length} steps completed — ${details.join("; ")}`);
  }
  if (failed.length > 0) {
    const details = failed.map((o) => {
      const verb = toolVerbPhrase(o.tool);
      return `${verb} failed (${clip(o.summary, 80)})`;
    });
    parts.push(`${failed.length} need attention: ${details.join("; ")}`);
  }

  let summary = parts.join(". ");
  if (failed.length > 0) {
    summary += ". Want me to retry the failed step with adjusted parameters?";
  } else {
    summary += ". Anything else?";
  }
  return summary;
}
