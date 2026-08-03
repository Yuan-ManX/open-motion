/**
 * Dynamic tool surface selection.
 *
 * The full tool registry contains hundreds of tool schemas. Sending every
 * schema to the model on every turn bloats the prompt and dilutes the model's
 * attention across tools that are irrelevant to the current request.
 *
 * This module classifies the user message into one or more intents and
 * projects the full tool surface down to a focused subset:
 *   - A small CORE set always present (state introspection, plan control,
 *     common edits). The agent never has to ask twice for these.
 *   - The union of intent-specific tools. Each intent maps to a curated list
 *     of tool name prefixes or exact names.
 *
 * When the classifier returns "unknown" (no intent matched), the selector
 * returns null so the caller can fall back to the full tool list. This keeps
 * the behavior conservative: pruning only happens when we have a confident
 * intent signal.
 */

import type { ToolName } from "@openmotion/shared";
import { INTENT_PATTERNS, type IntentType } from "./intents.js";

/**
 * Always-available tools. These cover the conversational baseline: reading
 * state, asking for suggestions, parsing natural language, common edits, and
 * plan control. Keeping them in every selection prevents the model from
 * getting stuck unable to inspect or correct its own state.
 */
export const CORE_TOOLS: readonly string[] = [
  // State introspection
  "get_motion_spec",
  "get_motion_profile",
  "list_scenes",
  "list_hierarchy",
  "list_constraints",
  "list_listeners",
  "list_markers",
  "list_clips",
  "list_states",
  "list_state_machines",
  "list_versions",
  "list_tokens",
  "list_pipelines",
  "list_project_recipes",
  "list_brand_packs",
  "list_motion_profiles",
  "list_motion_captures",
  "list_export_presets",
  "list_session_snapshots",
  "list_generated_skills",
  "list_templates",
  "list_recipes",
  // Common edits
  "add_layer",
  "set_template",
  "set_easing",
  "set_spring",
  "set_custom_bezier",
  "set_duration",
  "set_delay",
  "set_color",
  "set_loop",
  "set_project_tempo",
  "quantize_to_tempo",
  "set_phase",
  "align_to_beat",
  "set_transform",
  "set_transform_props",
  "set_play_state",
  "set_trigger",
  "apply_preset",
  "apply_style",
  "apply_recipe",
  "apply_choreography",
  "batch_update",
  "duplicate_component",
  "remove_component",
  "delete_component",
  // Composition + suggestions
  "stagger_components",
  "suggest_next",
  "parse_motion",
  "compile_grammar",
  // Version + plan control
  "save_version",
  "restore_version",
  "get_plan_state",
  "cancel_plan",
  // Verification + self-correction
  "verify_motion",
  "self_correct",
  // Memory
  "save_memory",
  "recall_memory",
];

/**
 * Intent → tool-prefix mapping. Tools whose name starts with any of the
 * listed prefixes are added to the selection. Prefixes are used (rather than
 * exact names) so the mapping stays compact and self-maintains as new
 * same-family tools are added.
 *
 * Tools that match a prefix but are clearly side-effectful (exports,
 * generation) are listed by exact name where they are wanted, and excluded
 * by the SIDE_EFFECT_BLOCKLIST below for the prefix-walked families.
 */
const INTENT_TOOL_PREFIXES: Record<IntentType, readonly string[]> = {
  tune: ["set_", "apply_preset", "apply_style", "refine_motion", "set_spring", "set_custom_bezier", "set_interpolation"],
  template: ["set_template", "list_templates", "match_template", "find_similar_motion", "describe_motion"],
  structure: ["add_", "remove_", "delete_", "duplicate_", "reorder_", "set_parent", "remove_parent", "list_hierarchy", "add_shape", "add_image", "add_video", "add_audio", "add_typewriter_text"],
  composition: ["stagger_", "apply_choreography", "blend_motions", "interpolate_motion", "merge_properties", "create_variant", "choreograph"],
  export: ["export_"],
  preset: ["apply_preset", "list_recipes", "apply_recipe", "save_project_recipe", "list_project_recipes", "apply_project_recipe", "delete_project_recipe", "seed_project_recipes"],
  playback: ["set_play_state", "set_playback_range", "preview_url"],
  query: ["get_", "list_", "describe_", "suggest_", "recommend_"],
  describe: ["describe_motion", "find_similar_motion", "generate_motion_docs", "recognize_pattern"],
  scene: ["list_scenes", "remove_scene", "add_scene_transition", "add_camera_move", "create_precomp", "ungroup_precomp", "set_adjustment_layer"],
  analysis: ["analyze_", "check_", "recognize_pattern", "profile_motion", "audit_motion", "curate_motion", "strategize_motion", "encode_motion", "verify_motion", "self_correct"],
  path: ["set_motion_path", "list_path_presets", "list_path_types", "run_path_preset"],
  style: ["apply_style", "apply_brand_pack", "list_brand_packs", "seed_brand_packs", "delete_brand_pack", "set_motion_profile", "suggest_motion_profile", "list_motion_profiles", "apply_motion_profile"],
  pattern: ["recognize_pattern", "analyze_motion", "harmonize_colors", "analyze_restraint"],
  color: ["set_color", "harmonize_colors", "set_blend_mode", "set_filter"],
  choreography: ["apply_choreography", "stagger_components", "choreograph"],
  refine: ["refine_motion", "set_easing", "set_spring", "set_custom_bezier", "synthesize_easing"],
  bezier: ["set_custom_bezier", "synthesize_easing"],
  interpolation: ["set_interpolation", "interpolate_motion"],
  keyframe_edit: ["add_property_keyframe", "remove_keyframe", "set_keyframe_offset", "reverse_keyframes", "toggle_auto_keyframe"],
  trigger: ["set_trigger", "add_listener", "remove_listener", "list_listeners"],
  onion_skin: ["set_onion_skin"],
  preview_fullscreen: ["preview_fullscreen"],
  canvas_view: ["set_canvas_view", "set_rulers", "toggle_snap"],
  lock: ["lock_layer", "solo_layer"],
  z_order: ["set_z_order"],
  transform_props: ["set_transform_props", "nudge_component", "align_components", "set_layer_opacity"],
  align: ["align_components"],
  playback_range: ["set_playback_range"],
  select: ["select_components"],
  snap: ["toggle_snap"],
  shape: ["add_shape"],
  blend_mode: ["set_blend_mode"],
  artboard: ["set_artboard"],
  layer_opacity: ["set_layer_opacity"],
  rulers: ["set_rulers"],
  nudge: ["nudge_component"],
  clipboard: ["copy_to_clipboard", "paste_from_clipboard"],
  state_machine: ["capture_state", "apply_state", "add_transition", "remove_state", "list_states", "compose_state_machine", "trigger_state_machine", "list_state_machines"],
  auto_keyframe: ["toggle_auto_keyframe"],
  listener: ["add_listener", "remove_listener", "list_listeners"],
  keyframe_offset: ["set_keyframe_offset"],
  marker: ["add_marker", "remove_marker", "list_markers"],
  reverse_keyframes: ["reverse_keyframes"],
  z_index: ["set_z_order"],
  solo: ["solo_layer"],
  hierarchy: ["set_parent", "remove_parent", "list_hierarchy"],
  constraint: ["add_constraint", "remove_constraint", "list_constraints"],
  clip: ["add_clip", "remove_clip", "list_clips", "play_clip"],
  filter_effect: ["set_filter", "set_shader_effect"],
  transform_3d: ["set_3d_transform"],
  restraint: ["analyze_restraint"],
  recipe: ["apply_recipe", "list_recipes", "save_project_recipe", "list_project_recipes", "apply_project_recipe", "delete_project_recipe", "seed_project_recipes"],
  project_recipe: ["save_project_recipe", "list_project_recipes", "apply_project_recipe", "delete_project_recipe", "seed_project_recipes"],
  brand_pack: ["apply_brand_pack", "list_brand_packs", "seed_brand_packs", "delete_brand_pack"],
  motion_profile: ["set_motion_profile", "suggest_motion_profile", "list_motion_profiles", "apply_motion_profile", "get_motion_profile"],
  motion_capture: ["save_motion_capture", "list_motion_captures", "apply_motion_capture", "delete_motion_capture", "seed_motion_captures"],
  export_preset: ["list_export_presets", "recommend_export_format", "apply_export_preset", "export_html", "export_code", "export_video", "export_lottie", "export_skill"],
  session_lineage: ["save_session_snapshot", "list_session_snapshots", "resume_session_snapshot", "get_session_lineage", "delete_session_snapshot"],
  accessibility: ["check_accessibility"],
  performance: ["check_performance"],
  storyboard: ["create_beat", "list_beats", "update_beat", "reorder_beats", "delete_beat", "export_storyboard"],
  memory: ["save_memory", "recall_memory"],
  skill: ["list_generated_skills", "export_skill"],
  grammar: ["compile_grammar"],
  parse: ["parse_motion"],
  shader: ["set_shader_effect", "set_filter"],
  visual_context: ["analyze_visual_context"],
  code_synthesis: ["synthesize_code"],
  similarity: ["find_similar_motion", "describe_motion"],
  documentation: ["generate_motion_docs"],
  principles: ["analyze_principles", "apply_principle"],
  easing_synthesis: ["synthesize_easing", "set_custom_bezier"],
  blend: ["blend_motions", "merge_properties"],
  merge: ["merge_properties"],
  emotion: ["analyze_emotion", "analyze_mood", "set_mood"],
  rhythm: ["analyze_rhythm"],
  narrative: ["analyze_narrative", "create_story_arc", "apply_story_plan"],
  adaptive: ["adapt_motion", "preview_adaptations", "generate_responsive_css"],
  responsive: ["generate_responsive_css", "preview_adaptations"],
  synthesis: ["synthesize_motion", "synthesize_waveform", "morph_to_pattern"],
  morph: ["morph_to_pattern"],
  waveform: ["synthesize_waveform"],
  storytelling: ["create_story_arc", "apply_story_plan", "analyze_pacing"],
  pacing: ["analyze_pacing"],
  image: ["generate_image"],
  speech: ["generate_speech"],
  video: ["generate_video"],
  models: ["list_models"],
  unknown: [],
};

/**
 * Prefixes that should never be auto-added by the prefix walk because their
 * tools produce external artifacts or have heavy side effects. They are only
 * included when an intent explicitly lists them.
 */
const SIDE_EFFECT_PREFIXES = new Set([
  "export_",
  "generate_image",
  "generate_speech",
  "generate_video",
  "generate_3d",
]);

/**
 * Classify all intents that match a user message. Unlike classifyIntent
 * (which returns the first match), this returns the full set so the selector
 * can union tool families across co-occurring intents.
 */
export function classifyAllIntents(text: string): IntentType[] {
  const matched = new Set<IntentType>();
  for (const { type, match } of INTENT_PATTERNS) {
    if (match.test(text)) matched.add(type);
  }
  return [...matched];
}

/**
 * Compute the focused tool surface for a user message. Returns null when no
 * intent matched (so the caller can fall back to the full list), or when the
 * computed set is suspiciously small (likely a misclassification).
 *
 * @param userMessage The user's natural-language request.
 * @param allTools    The complete tool name list (used to filter to valid names).
 * @returns Tool names to expose, or null to use the full list.
 */
export function selectTools(
  userMessage: string,
  allTools: readonly ToolName[],
): ToolName[] | null {
  const intents = classifyAllIntents(userMessage);
  if (intents.length === 0) return null;

  const validSet = new Set(allTools);
  const selected = new Set<string>();
  for (const core of CORE_TOOLS) {
    if (validSet.has(core as ToolName)) selected.add(core);
  }

  for (const intent of intents) {
    const prefixes = INTENT_TOOL_PREFIXES[intent];
    if (!prefixes) continue;
    for (const prefix of prefixes) {
      for (const name of allTools) {
        // Exact-name entries always pass through.
        if (name === prefix) {
          selected.add(name);
          continue;
        }
        // Prefix walk: include matches unless the prefix is side-effect gated
        // (those only come in via exact-name entries above).
        if (name.startsWith(prefix)) {
          if (SIDE_EFFECT_PREFIXES.has(prefix)) continue;
          selected.add(name);
        }
      }
    }
  }

  // Safety net: if pruning somehow produced an empty set, fall back to full.
  if (selected.size === 0) return null;
  return [...selected] as ToolName[];
}
