import { now } from "../../utils/id.js";

/**
 * Goal Continuity — cross-turn intent tracking.
 *
 * The orchestrator's `goalTree` is per-turn: it is decomposed from the user
 * message at the start of a turn and discarded when the turn ends. When a user
 * issues a multi-step directive across several turns ("make it bouncy, then add
 * a gradient, then export for mobile"), each turn is isolated and the agent
 * loses the broader trajectory.
 *
 * This module persists a lightweight goal ledger per project so the agent
 * retains the multi-turn arc. Each goal is a short phrase with a status
 * (pending / in_progress / done / abandoned). The ledger is surfaced in the
 * system prompt so the agent can pick up where the previous turn left off and
 * recognize when a new user message advances an existing goal.
 *
 * Detection is rule-based: the user message is scanned for sequencing
 * vocabulary ("then", "after that", "next", "also", "finally") and for
 * recognizable action categories (timing, color, choreography, export, etc.).
 * Goals are appended when the message introduces a new step; the orchestrator
 * marks a goal in_progress / done as the corresponding tools succeed.
 */

export type GoalStatus = "pending" | "in_progress" | "done" | "abandoned";

export interface ContinuityGoal {
  id: string;
  /** Short label, e.g. "Make motion bouncy" or "Export for mobile". */
  label: string;
  /** Category used by the orchestrator to advance status from tool calls. */
  category: GoalCategory;
  status: GoalStatus;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of the most recent status change. */
  updatedAt: string;
}

export type GoalCategory =
  | "timing"
  | "easing"
  | "color"
  | "choreography"
  | "style"
  | "layout"
  | "shader"
  | "path"
  | "accessibility"
  | "performance"
  | "export"
  | "narrative"
  | "creation"
  | "other";

interface CategoryRule {
  category: GoalCategory;
  pattern: RegExp;
  label: (msg: string) => string;
}

const CATEGORY_RULES: CategoryRule[] = [
  { category: "easing", pattern: /\b(bouncy|smooth|snappy|elastic|spring|easing|feel)\b/i, label: () => "Tune easing / tactile feel" },
  { category: "timing", pattern: /\b(duration|slower|faster|delay|timing|speed|quick|slow)\b/i, label: () => "Adjust timing" },
  { category: "color", pattern: /\b(color|colour|background|palette|harmoniz)\b/i, label: () => "Set color / palette" },
  { category: "choreography", pattern: /\b(stagger|cascade|choreograph|wave|ripple|sequence|orchestrat)\b/i, label: () => "Apply choreography" },
  { category: "style", pattern: /\b(style|preset|brand.*pack|aesthetic|vibe|mood)\b/i, label: () => "Apply style / aesthetic" },
  { category: "layout", pattern: /\b(layout|align|distribute|position|canvas|artboard)\b/i, label: () => "Arrange layout" },
  { category: "shader", pattern: /\b(shader|glitch|neon|plasma|chromatic|filter)\b/i, label: () => "Apply shader effect" },
  { category: "path", pattern: /\b(orbit|circle|ellipse|path|trajectory|fly across)\b/i, label: () => "Animate along a path" },
  { category: "accessibility", pattern: /\b(accessib|a11y|vestibular|reduced.*motion|wcag)\b/i, label: () => "Check accessibility" },
  { category: "performance", pattern: /\b(performance|fps|jank|frame.*budget|optimize)\b/i, label: () => "Profile performance" },
  { category: "export", pattern: /\b(export|download|render|package|mp4|gif|lottie|html)\b/i, label: () => "Export the project" },
  { category: "narrative", pattern: /\b(story|narrative|arc|beat|storyboard|pacing)\b/i, label: () => "Shape the narrative" },
  { category: "creation", pattern: /\b(create|add|make|build|generate|insert)\b/i, label: () => "Create a new element" },
];

const SEQUENCE_PATTERN = /\b(then|after that|next|also|finally|lastly|afterwards|step \d+)\b/i;

const ledger = new Map<string, ContinuityGoal[]>();
const MAX_GOALS = 8;

/**
 * Inspect a user message and append a continuity goal when the message
 * introduces a recognizable step. The first goal of a multi-step sequence is
 * always recorded; subsequent messages are recorded when they either use
 * sequencing vocabulary or introduce a new category.
 *
 * Returns the goal that was added, or null when the message did not produce a
 * new goal.
 */
export function recordGoalFromMessage(projectId: string, userMessage: string): ContinuityGoal | null {
  const list = ledger.get(projectId) ?? [];
  const trimmed = userMessage.trim();

  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(trimmed)) {
      const hasSequence = SEQUENCE_PATTERN.test(trimmed);
      const last = list[list.length - 1];
      // Avoid duplicate adjacent goals of the same category unless the user
      // explicitly sequences them ("then make it bouncy too").
      const isDuplicateAdjacent = last && last.category === rule.category && last.status !== "done";
      if (isDuplicateAdjacent && !hasSequence) continue;

      const ts = now();
      const goal: ContinuityGoal = {
        id: `g_${ts}_${Math.random().toString(36).slice(2, 8)}`,
        label: rule.label(trimmed),
        category: rule.category,
        status: "pending",
        createdAt: ts,
        updatedAt: ts,
      };
      list.push(goal);
      if (list.length > MAX_GOALS) list.splice(0, list.length - MAX_GOALS);
      ledger.set(projectId, list);
      return goal;
    }
  }
  return null;
}

/** List the current goal ledger for a project (oldest first). */
export function listGoals(projectId: string): ContinuityGoal[] {
  return ledger.get(projectId) ?? [];
}

/** Mark the first pending goal of a category as in_progress. */
export function startGoalByCategory(projectId: string, category: GoalCategory): ContinuityGoal | null {
  const list = ledger.get(projectId);
  if (!list) return null;
  const goal = list.find((g) => g.category === category && g.status === "pending");
  if (!goal) return null;
  goal.status = "in_progress";
  goal.updatedAt = now();
  return goal;
}

/** Mark the first in_progress goal of a category as done. */
export function completeGoalByCategory(projectId: string, category: GoalCategory): ContinuityGoal | null {
  const list = ledger.get(projectId);
  if (!list) return null;
  const goal = list.find((g) => g.category === category && g.status === "in_progress");
  if (!goal) return null;
  goal.status = "done";
  goal.updatedAt = now();
  return goal;
}

/** Abandon all pending/in_progress goals (used on project reset). */
export function clearGoals(projectId: string): void {
  ledger.delete(projectId);
}

/** Clear every ledger (used by tests). */
export function clearAllGoals(): void {
  ledger.clear();
}

/**
 * Format the active goal ledger for the system prompt. Only pending and
 * in_progress goals are surfaced — completed goals are dropped to keep the
 * prompt focused on what remains. Returns an empty string when the ledger is
 * empty or fully completed.
 */
export function formatGoalContinuity(projectId: string): string {
  const list = ledger.get(projectId);
  if (!list || list.length === 0) return "";
  const active = list.filter((g) => g.status === "pending" || g.status === "in_progress");
  if (active.length === 0) return "";
  const lines = active.map((g) => `- [${g.status === "in_progress" ? "doing" : "todo"}] ${g.label} (${g.category})`);
  return `\nMulti-turn goal ledger:\n${lines.join("\n")}\n`;
}
