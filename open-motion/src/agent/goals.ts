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
  // Inspection / query tools
  if (
    tool === "get_motion_spec" ||
    tool === "describe_motion" ||
    tool === "list_templates" ||
    tool === "list_scenes" ||
    tool === "list_states" ||
    tool === "list_listeners" ||
    tool === "list_markers" ||
    tool === "list_clips" ||
    tool === "list_hierarchy" ||
    tool === "list_constraints" ||
    tool === "list_recipes" ||
    tool === "list_project_recipes" ||
    tool === "list_brand_packs" ||
    tool === "list_motion_profiles" ||
    tool === "list_motion_captures" ||
    tool === "list_export_presets" ||
    tool === "list_session_snapshots" ||
    tool === "list_versions" ||
    tool === "list_tokens" ||
    tool === "list_pipelines" ||
    tool === "list_generated_skills" ||
    tool === "list_state_machines" ||
    tool === "list_models" ||
    tool === "get_motion_profile" ||
    tool === "get_session_lineage" ||
    tool === "match_template" ||
    tool === "find_similar_motion" ||
    tool === "recommend_export_format"
  ) {
    return "Inspect";
  }

  // Templates
  if (tool === "set_template") return "Template";

  // Tuning / configuration
  if (
    tool.startsWith("set_") ||
    tool.startsWith("add_") ||
    tool === "batch_update" ||
    tool === "remove_component" ||
    tool === "remove_scene" ||
    tool === "remove_keyframe" ||
    tool === "remove_marker" ||
    tool === "remove_clip" ||
    tool === "remove_state" ||
    tool === "remove_listener" ||
    tool === "remove_constraint" ||
    tool === "remove_parent" ||
    tool === "reverse_keyframes" ||
    tool === "duplicate_component" ||
    tool === "reorder_components" ||
    tool === "nudge_component" ||
    tool === "align_components" ||
    tool === "select_components" ||
    tool === "lock_layer" ||
    tool === "solo_layer" ||
    tool === "toggle_snap" ||
    tool === "toggle_auto_keyframe" ||
    tool === "copy_to_clipboard" ||
    tool === "paste_from_clipboard"
  ) {
    return "Configure";
  }

  // Composition / choreography
  if (
    tool === "stagger_components" ||
    tool === "choreograph" ||
    tool === "apply_choreography" ||
    tool === "blend_motions" ||
    tool === "interpolate_motion" ||
    tool === "merge_properties" ||
    tool === "create_variant" ||
    tool === "create_precomp" ||
    tool === "ungroup_precomp"
  ) {
    return "Compose";
  }

  // Presets / recipes / styles / brand packs
  if (
    tool === "apply_preset" ||
    tool === "apply_style" ||
    tool === "apply_recipe" ||
    tool === "apply_project_recipe" ||
    tool === "save_project_recipe" ||
    tool === "delete_project_recipe" ||
    tool === "seed_project_recipes" ||
    tool === "apply_brand_pack" ||
    tool === "delete_brand_pack" ||
    tool === "seed_brand_packs" ||
    tool === "apply_principle" ||
    tool === "apply_motion_profile" ||
    tool === "apply_motion_capture" ||
    tool === "apply_state" ||
    tool === "apply_story_plan" ||
    tool === "apply_export_preset"
  ) {
    return "Apply";
  }

  // Analysis
  if (
    tool === "analyze_motion" ||
    tool === "analyze_restraint" ||
    tool === "analyze_mood" ||
    tool === "analyze_emotion" ||
    tool === "analyze_rhythm" ||
    tool === "analyze_narrative" ||
    tool === "analyze_pacing" ||
    tool === "analyze_visual_context" ||
    tool === "analyze_principles" ||
    tool === "recognize_pattern" ||
    tool === "check_accessibility" ||
    tool === "check_performance" ||
    tool === "suggest_next" ||
    tool === "suggest_creative" ||
    tool === "suggest_motion_profile"
  ) {
    return "Analyze";
  }

  // Storytelling
  if (
    tool === "create_beat" ||
    tool === "update_beat" ||
    tool === "reorder_beats" ||
    tool === "delete_beat" ||
    tool === "create_story_arc" ||
    tool === "apply_story_plan" ||
    tool === "export_storyboard"
  ) {
    return "Story";
  }

  // Synthesis / generation
  if (
    tool === "synthesize_motion" ||
    tool === "synthesize_waveform" ||
    tool === "synthesize_easing" ||
    tool === "synthesize_code" ||
    tool === "morph_to_pattern" ||
    tool === "compile_grammar" ||
    tool === "parse_motion" ||
    tool === "generate_image" ||
    tool === "generate_speech" ||
    tool === "generate_video" ||
    tool === "generate_3d" ||
    tool === "generate_motion_docs" ||
    tool === "generate_responsive_css"
  ) {
    return "Synthesize";
  }

  // Adaptive / responsive
  if (tool === "adapt_motion" || tool === "preview_adaptations") {
    return "Adapt";
  }

  // State machine
  if (
    tool === "capture_state" ||
    tool === "compose_state_machine" ||
    tool === "trigger_state_machine" ||
    tool === "add_transition" ||
    tool === "add_listener"
  ) {
    return "State";
  }

  // Shader / filter / 3D
  if (
    tool === "set_shader_effect" ||
    tool === "set_filter" ||
    tool === "set_3d_transform" ||
    tool === "set_blend_mode" ||
    tool === "set_adjustment_layer" ||
    tool === "set_expression"
  ) {
    return "Effect";
  }

  // Versioning
  if (
    tool === "save_version" ||
    tool === "restore_version" ||
    tool === "delete_version" ||
    tool === "save_session_snapshot" ||
    tool === "resume_session_snapshot" ||
    tool === "delete_session_snapshot"
  ) {
    return "Version";
  }

  // Memory / skills
  if (
    tool === "save_memory" ||
    tool === "recall_memory" ||
    tool === "export_skill"
  ) {
    return "Memory";
  }

  // Design tokens
  if (
    tool === "save_token" ||
    tool === "update_token" ||
    tool === "delete_token"
  ) {
    return "Token";
  }

  // Pipelines
  if (
    tool === "save_pipeline" ||
    tool === "run_pipeline" ||
    tool === "delete_pipeline"
  ) {
    return "Pipeline";
  }

  // Motion profiles / captures
  if (
    tool === "set_motion_profile" ||
    tool === "save_motion_capture" ||
    tool === "delete_motion_capture" ||
    tool === "seed_motion_captures"
  ) {
    return "Profile";
  }

  // Mood
  if (tool === "set_mood") return "Mood";

  // Export
  if (
    tool.startsWith("export_") &&
    tool !== "export_storyboard" &&
    tool !== "export_skill"
  ) {
    return "Export";
  }

  // Preview
  if (tool === "preview_url" || tool === "preview_fullscreen") return "Preview";

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
