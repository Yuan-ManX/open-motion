import { createId } from "../utils/id.js";

export type GoalStatus = "pending" | "in_progress" | "completed" | "skipped";

export interface Goal {
  id: string;
  label: string;
  status: GoalStatus;
  tool?: string;
  children: Goal[];
}

export interface GoalTree {
  root: Goal;
}

interface PlanStep {
  tool: string;
  description: string;
}

/** Categorize a tool into a high-level goal category. */
function categorizeTool(tool: string): string {
  if (tool === "get_motion_spec" || tool === "describe_motion") return "Inspect";
  if (tool.startsWith("set_") || tool.startsWith("add_") || tool === "batch_update") return "Configure";
  if (tool === "set_template" || tool === "list_templates") return "Template";
  if (tool === "compile_grammar" || tool === "parse_motion") return "Parse";
  if (tool === "set_shader_effect") return "Shader";
  if (tool === "save_version" || tool === "restore_version") return "Version";
  if (tool.startsWith("save_token") || tool.startsWith("list_tokens")) return "Token";
  if (tool.startsWith("export_")) return "Export";
  if (tool === "preview_url") return "Preview";
  if (tool === "stagger_components" || tool === "create_variant") return "Compose";
  if (tool === "analyze_restraint" || tool === "list_recipes") return "Analyze";
  if (tool === "save_memory" || tool === "recall_memory") return "Memory";
  return "Action";
}

/**
 * Build a goal tree from a user message and the planned steps.
 * Consecutive steps of the same category are grouped under a shared subgoal
 * so the tree reads as a sequence of intent phases rather than a flat list.
 */
export function decomposeGoal(userMessage: string, steps: PlanStep[]): GoalTree {
  const rootId = createId("goal_");
  const rootLabel = extractRootLabel(userMessage);
  const root: Goal = {
    id: rootId,
    label: rootLabel,
    status: "pending",
    children: [],
  };

  if (steps.length === 0) {
    return { root };
  }

  let currentCategory: string | null = null;
  let currentSubgoal: Goal | null = null;

  for (const step of steps) {
    const category = categorizeTool(step.tool);

    if (category !== currentCategory) {
      // First step of a new category becomes its own leaf goal — this keeps
      // single-step categories as direct children of the root.
      currentSubgoal = {
        id: createId("goal_"),
        label: step.description,
        status: "pending",
        tool: step.tool,
        children: [],
      };
      root.children.push(currentSubgoal);
      currentCategory = category;
    } else if (currentSubgoal) {
      // Additional steps in the same category nest under a category group.
      // If the current subgoal has no children yet, it's a leaf — convert it
      // into a group by keeping its label as the category header.
      if (currentSubgoal.children.length === 0 && currentSubgoal.tool) {
        // Promote: keep the existing leaf as the first child of a new group.
        const firstLeaf: Goal = {
          id: currentSubgoal.id,
          label: currentSubgoal.label,
          status: currentSubgoal.status,
          tool: currentSubgoal.tool,
          children: [],
        };
        currentSubgoal.label = category;
        currentSubgoal.tool = undefined;
        currentSubgoal.children.push(firstLeaf);
      }
      currentSubgoal.children.push({
        id: createId("goal_"),
        label: step.description,
        status: "pending",
        tool: step.tool,
        children: [],
      });
    }
  }

  return { root };
}

/** Extract a concise root label from the user's message. */
function extractRootLabel(message: string): string {
  const trimmed = message.trim();
  if (trimmed.length <= 60) return trimmed;
  const cut = trimmed.slice(0, 60);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 30) return cut.slice(0, lastSpace) + "…";
  return cut + "…";
}

/** Mark a goal as in-progress (and its parent, if any). */
export function markInProgress(tree: GoalTree, goalId: string): void {
  const findAndMark = (goal: Goal): boolean => {
    if (goal.id === goalId) {
      goal.status = "in_progress";
      return true;
    }
    for (const child of goal.children) {
      if (findAndMark(child)) {
        if (goal.status === "pending") goal.status = "in_progress";
        return true;
      }
    }
    return false;
  };
  findAndMark(tree.root);
}

/** Mark a goal as completed and propagate to parent if all children are done. */
export function markCompleted(tree: GoalTree, goalId: string): void {
  const mark = (goal: Goal): boolean => {
    if (goal.id === goalId) {
      goal.status = "completed";
      return true;
    }
    for (const child of goal.children) {
      if (mark(child)) {
        const allDone = goal.children.every(
          (c) => c.status === "completed" || c.status === "skipped",
        );
        if (allDone && goal.status !== "completed") goal.status = "completed";
        return true;
      }
    }
    return false;
  };
  mark(tree.root);
}

/**
 * Find the next pending leaf goal whose tool matches, mark it in-progress,
 * and return its id. Used by the orchestrator to link tool calls to goals.
 */
export function startToolGoal(tree: GoalTree, tool: string): string | null {
  const find = (goal: Goal): Goal | null => {
    if (goal.children.length === 0) {
      if (goal.tool === tool && goal.status === "pending") return goal;
      return null;
    }
    for (const child of goal.children) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  };
  const target = find(tree.root);
  if (!target) return null;
  markInProgress(tree, target.id);
  return target.id;
}

/** Complete the goal identified by id (no-op if null). */
export function completeToolGoal(tree: GoalTree, goalId: string | null): void {
  if (!goalId) return;
  markCompleted(tree, goalId);
}

/** Count leaf goals by status for progress reporting. */
export function goalProgress(tree: GoalTree): {
  total: number;
  completed: number;
  inProgress: number;
} {
  let total = 0;
  let completed = 0;
  let inProgress = 0;
  const count = (goal: Goal) => {
    if (goal.children.length === 0) {
      total++;
      if (goal.status === "completed") completed++;
      else if (goal.status === "in_progress") inProgress++;
    } else {
      for (const child of goal.children) count(child);
    }
  };
  count(tree.root);
  return { total, completed, inProgress };
}

/** Serialize a goal tree for SSE transport (strips internal helpers). */
export function serializeGoal(tree: GoalTree): Goal {
  const ser = (g: Goal): Goal => ({
    id: g.id,
    label: g.label,
    status: g.status,
    ...(g.tool ? { tool: g.tool } : {}),
    children: g.children.map(ser),
  });
  return ser(tree.root);
}
