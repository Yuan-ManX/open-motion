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
    // Query / inspection
    get_motion_spec: "Inspected spec",
    list_templates: "Listed templates",
    describe_motion: "Described motion",
    list_scenes: "Listed scenes",
    list_states: "Listed states",
    list_listeners: "Listed listeners",
    list_markers: "Listed markers",
    list_clips: "Listed clips",
    list_hierarchy: "Listed hierarchy",
    list_constraints: "Listed constraints",
    list_recipes: "Listed recipes",
    list_project_recipes: "Listed project recipes",
    list_brand_packs: "Listed brand packs",
    list_motion_profiles: "Listed motion profiles",
    list_motion_captures: "Listed motion captures",
    list_export_presets: "Listed export presets",
    list_session_snapshots: "Listed session snapshots",
    list_versions: "Listed versions",
    list_tokens: "Listed tokens",
    list_pipelines: "Listed pipelines",
    list_generated_skills: "Listed generated skills",
    list_state_machines: "Listed state machines",
    list_models: "Listed AI models",
    // Structure
    set_template: "Applied template",
    add_layer: "Added layer",
    add_shape: "Added shape",
    add_image: "Added image",
    add_video: "Added video",
    add_audio: "Added audio",
    add_typewriter_text: "Added typewriter text",
    add_scene: "Created scene",
    add_scene_transition: "Added scene transition",
    add_camera_move: "Added camera move",
    remove_component: "Removed component",
    remove_scene: "Removed scene",
    duplicate_component: "Duplicated component",
    reorder_components: "Reordered components",
    create_precomp: "Created precomp",
    ungroup_precomp: "Ungrouped precomp",
    // Tuning
    set_easing: "Adjusted easing",
    set_spring: "Configured spring physics",
    set_duration: "Changed duration",
    set_delay: "Set delay",
    set_loop: "Set loop",
    set_fill_mode: "Set fill mode",
    set_color: "Updated color",
    set_static_style: "Updated style",
    set_global_timing: "Set global timing",
    set_keyframe: "Edited keyframe",
    set_transform: "Applied transform",
    set_transform_props: "Set transform props",
    set_motion_path: "Set motion path",
    set_custom_bezier: "Set custom bezier",
    set_interpolation: "Set interpolation",
    set_trigger: "Set trigger",
    set_play_state: "Toggled playback",
    set_playback_range: "Set playback range",
    set_layer_opacity: "Set layer opacity",
    set_blend_mode: "Set blend mode",
    set_artboard: "Set artboard",
    set_canvas_view: "Adjusted canvas view",
    set_filter: "Applied filter",
    set_3d_transform: "Applied 3D transform",
    set_shader_effect: "Applied shader effect",
    set_adjustment_layer: "Set adjustment layer",
    set_expression: "Set expression",
    set_parent: "Set parent",
    remove_parent: "Removed parent",
    add_constraint: "Added constraint",
    remove_constraint: "Removed constraint",
    set_z_order: "Reordered z-index",
    set_keyframe_offset: "Moved keyframe",
    set_rulers: "Toggled rulers",
    set_onion_skin: "Toggled onion skin",
    // Composition
    batch_update: "Batch-updated components",
    stagger_components: "Staggered components",
    choreograph: "Choreographed sequence",
    apply_choreography: "Applied choreography",
    blend_motions: "Blended motions",
    interpolate_motion: "Interpolated motion",
    merge_properties: "Merged properties",
    create_variant: "Created variant",
    align_components: "Aligned components",
    select_components: "Selected components",
    add_property_keyframe: "Added keyframe",
    remove_keyframe: "Removed keyframe",
    reverse_keyframes: "Reversed keyframes",
    add_clip: "Added clip",
    remove_clip: "Removed clip",
    play_clip: "Played clip",
    add_marker: "Added marker",
    remove_marker: "Removed marker",
    nudge_component: "Nudged component",
    lock_layer: "Toggled lock",
    solo_layer: "Soloed layer",
    toggle_snap: "Toggled snap",
    toggle_auto_keyframe: "Toggled auto-keyframe",
    copy_to_clipboard: "Copied to clipboard",
    paste_from_clipboard: "Pasted from clipboard",
    // Presets / recipes / styles
    apply_preset: "Applied preset",
    apply_style: "Applied style preset",
    apply_recipe: "Applied motion recipe",
    apply_project_recipe: "Applied project recipe",
    save_project_recipe: "Saved project recipe",
    delete_project_recipe: "Deleted project recipe",
    seed_project_recipes: "Seeded project recipes",
    apply_brand_pack: "Applied brand pack",
    delete_brand_pack: "Deleted brand pack",
    seed_brand_packs: "Seeded brand packs",
    apply_principle: "Applied animation principle",
    analyze_principles: "Analyzed principles",
    // Profiles, captures, packs
    set_motion_profile: "Set motion profile",
    get_motion_profile: "Got motion profile",
    suggest_motion_profile: "Suggested motion profile",
    apply_motion_profile: "Applied motion profile",
    save_motion_capture: "Saved motion capture",
    apply_motion_capture: "Applied motion capture",
    delete_motion_capture: "Deleted motion capture",
    seed_motion_captures: "Seeded motion captures",
    // State machine
    capture_state: "Captured state",
    apply_state: "Applied state",
    add_transition: "Added transition",
    remove_state: "Removed state",
    compose_state_machine: "Composed state machine",
    trigger_state_machine: "Triggered state machine",
    add_listener: "Added listener",
    remove_listener: "Removed listener",
    // Analysis
    analyze_motion: "Analyzed motion",
    analyze_restraint: "Analyzed restraint",
    analyze_mood: "Analyzed mood",
    set_mood: "Set mood",
    analyze_emotion: "Analyzed emotion",
    analyze_rhythm: "Analyzed rhythm",
    analyze_narrative: "Analyzed narrative",
    analyze_pacing: "Analyzed pacing",
    analyze_visual_context: "Analyzed visual context",
    recognize_pattern: "Recognized patterns",
    check_accessibility: "Checked accessibility",
    check_performance: "Checked performance",
    suggest_next: "Suggested next steps",
    suggest_creative: "Suggested creative ideas",
    find_similar_motion: "Found similar motion",
    match_template: "Matched template",
    // Storytelling
    create_beat: "Created beat",
    update_beat: "Updated beat",
    reorder_beats: "Reordered beats",
    delete_beat: "Deleted beat",
    export_storyboard: "Exported storyboard",
    create_story_arc: "Created story arc",
    apply_story_plan: "Applied story plan",
    // Adaptive / responsive
    adapt_motion: "Adapted motion",
    preview_adaptations: "Previewed adaptations",
    generate_responsive_css: "Generated responsive CSS",
    // Synthesis
    synthesize_motion: "Synthesized motion",
    synthesize_waveform: "Synthesized waveform",
    synthesize_easing: "Synthesized easing",
    synthesize_code: "Synthesized code",
    morph_to_pattern: "Morphed to pattern",
    compile_grammar: "Compiled grammar",
    parse_motion: "Parsed motion",
    // Export
    export_html: "Exported HTML",
    export_code: "Exported code",
    export_video: "Exported video",
    export_lottie: "Exported Lottie",
    export_skill: "Exported skill",
    apply_export_preset: "Applied export preset",
    recommend_export_format: "Recommended export format",
    // Versioning / memory / tokens / pipelines
    save_version: "Saved version",
    restore_version: "Restored version",
    delete_version: "Deleted version",
    save_memory: "Saved to memory",
    recall_memory: "Recalled memory",
    save_token: "Saved token",
    update_token: "Updated token",
    delete_token: "Deleted token",
    save_pipeline: "Saved pipeline",
    run_pipeline: "Ran pipeline",
    delete_pipeline: "Deleted pipeline",
    // Session lineage
    save_session_snapshot: "Saved session snapshot",
    resume_session_snapshot: "Resumed session snapshot",
    get_session_lineage: "Got session lineage",
    delete_session_snapshot: "Deleted session snapshot",
    // Docs
    generate_motion_docs: "Generated motion docs",
    // Multimodal
    generate_image: "Generated image",
    generate_speech: "Generated speech",
    generate_video: "Generated video",
    generate_3d: "Generated 3D model",
    // Preview
    preview_url: "Generated preview URL",
    preview_fullscreen: "Opened fullscreen preview",
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
  if (typeof args.recipeId === "string") return args.recipeId;
  if (typeof args.brandPackId === "string") return args.brandPackId;
  if (typeof args.profileId === "string") return args.profileId;
  if (typeof args.captureId === "string") return args.captureId;
  if (typeof args.presetId === "string") return args.presetId;
  if (typeof args.principle === "string") return args.principle;
  if (typeof args.mood === "string") return args.mood;
  if (typeof args.device === "string") return args.device;
  if (typeof args.format === "string") return args.format;
  if (typeof args.genre === "string") return args.genre;
  if (typeof args.effect === "string") return args.effect;
  if (typeof args.property === "string") return args.property;
  if (typeof args.trigger === "string") return args.trigger;
  if (typeof args.direction === "string") return args.direction;
  if (typeof args.fillMode === "string") return args.fillMode;
  if (typeof args.easing === "object" && args.easing && typeof (args.easing as { name?: string }).name === "string") {
    return (args.easing as { name: string }).name;
  }
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
  if (toolsUsed.has("stagger_components") || toolsUsed.has("choreograph") || toolsUsed.has("apply_choreography")) {
    steps.push("Review the choreography in the timeline and adjust stagger if needed");
  }
  if (toolsUsed.has("set_easing") || toolsUsed.has("set_spring") || toolsUsed.has("set_custom_bezier")) {
    steps.push("Compare the new motion feel with the previous version");
  }
  // Accessibility follow-up: any motion change benefits from an a11y check.
  if (!toolsUsed.has("check_accessibility") && (toolsUsed.has("set_loop") || toolsUsed.has("set_shader_effect") || toolsUsed.has("set_3d_transform"))) {
    steps.push("Run an accessibility check — loops and shaders can trigger vestibular issues");
  }
  // Performance follow-up: heavy effects warrant a performance check.
  if (!toolsUsed.has("check_performance") && (toolsUsed.has("set_filter") || toolsUsed.has("set_shader_effect") || toolsUsed.has("set_3d_transform"))) {
    steps.push("Profile performance — filters and shaders compound render cost");
  }
  // Choreography + restraint: multi-component motion should be sanity-checked.
  if (toolsUsed.has("apply_choreography") || toolsUsed.has("choreograph")) {
    steps.push("Analyze restraint to confirm the choreographed scene isn't visually overloaded");
  }
  // Recipe / style applied — suggest preview to verify the holistic feel.
  if (toolsUsed.has("apply_recipe") || toolsUsed.has("apply_style") || toolsUsed.has("apply_brand_pack")) {
    steps.push("Preview the project to verify the coordinated aesthetic feels right");
  }
  // Adaptation applied — suggest previewing on the target device.
  if (toolsUsed.has("adapt_motion") || toolsUsed.has("generate_responsive_css")) {
    steps.push("Preview the adapted motion on the target device to confirm the tuning");
  }
  // Synthesis — suggest tuning the generated motion.
  if (toolsUsed.has("synthesize_motion") || toolsUsed.has("synthesize_waveform") || toolsUsed.has("synthesize_easing")) {
    steps.push("Tune the synthesized motion's duration to match the scene's tempo");
  }
  // Storytelling — suggest adding more beats to complete the arc.
  if (toolsUsed.has("create_beat") || toolsUsed.has("create_story_arc")) {
    steps.push("Add more storyboard beats to complete the narrative arc");
  }
  // Version saved — encourage continued experimentation.
  if (toolsUsed.has("save_version") || toolsUsed.has("save_session_snapshot")) {
    steps.push("Continue iterating — you can restore the saved version anytime");
  }
  // Multimodal generation — suggest integrating the asset.
  if (toolsUsed.has("generate_image") || toolsUsed.has("generate_video") || toolsUsed.has("generate_3d")) {
    steps.push("Integrate the generated asset into the scene");
  }
  // Export — suggest packaging for delivery.
  if (!toolsUsed.has("export_html") && !toolsUsed.has("export_code") && !toolsUsed.has("export_video")) {
    steps.push("Export the result when you're satisfied with the motion");
  }
  // Docs generated — suggest pairing with a version snapshot.
  if (toolsUsed.has("generate_motion_docs")) {
    steps.push("Pair the docs with a version snapshot for handoff");
  }

  if (steps.length === 0) {
    steps.push("Continue refining the motion or ask for suggestions");
  }

  return steps.slice(0, 5);
}
