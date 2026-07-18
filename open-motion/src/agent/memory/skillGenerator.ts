import type { LlmToolCall } from "../provider/types.js";
import type { ToolResult } from "../tools/registry.js";
import { saveGeneratedSkill, incrementSkillUsage, searchGeneratedSkills, type GeneratedSkill } from "../../db/repositories/memory.js";

/**
 * Self-learning skill generator.
 *
 * After a successful multi-step tool sequence, the agent synthesizes the
 * interaction into a portable skill document. Future requests matching the
 * trigger pattern retrieve and apply the learned skill, reducing tool calls
 * and improving response quality over time.
 */

interface SkillExtraction {
  name: string;
  description: string;
  triggerPattern: string;
  toolSequence: string;
  skillMarkdown: string;
  tags: string[];
}

/** Determine if a tool sequence is complex enough to warrant skill generation. */
export function shouldGenerateSkill(toolCalls: LlmToolCall[], results: ToolResult[]): boolean {
  // Only generate skills for sequences with 2+ spec-changing tools
  const specChangingTools = results.filter((r) => r.specChanged);
  return toolCalls.length >= 2 && specChangingTools.length >= 2;
}

/** Extract a skill document from a completed tool sequence. */
export function extractSkill(
  userMessage: string,
  toolCalls: LlmToolCall[],
  results: ToolResult[],
  projectId: string | null,
): GeneratedSkill | null {
  if (!shouldGenerateSkill(toolCalls, results)) return null;

  const extraction = analyzeSequence(userMessage, toolCalls, results);
  if (!extraction) return null;

  return saveGeneratedSkill({
    projectId,
    name: extraction.name,
    description: extraction.description,
    triggerPattern: extraction.triggerPattern,
    toolSequence: extraction.toolSequence,
    skillMarkdown: extraction.skillMarkdown,
    tags: extraction.tags,
  });
}

function analyzeSequence(
  userMessage: string,
  toolCalls: LlmToolCall[],
  results: ToolResult[],
): SkillExtraction | null {
  const toolNames = toolCalls.map((c) => c.tool);
  const summaries = results.map((r) => r.summary).filter(Boolean);

  // Generate a concise name from the user's intent
  const nameWords = userMessage.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 4);
  const name = nameWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  // Build trigger pattern from a comprehensive keyword set covering the full
  // motion-design surface: templates, easing, timing, choreography, styles,
  // recipes, shaders, 3D, mood, principles, storytelling, adaptation, export,
  // state machines, synthesis, and multimodal generation.
  const keywords = userMessage.toLowerCase().match(/\b(animate|animation|bounce|fade|slide|rotate|scale|pulse|shake|float|glow|stagger|cascade|orbit|wave|ripple|canon|converge|spiral|explosion|assembly|breathing|domino|scatter|spring|smooth|snappy|soft|elastic|dramatic|playful|professional|minimal|cinematic|glassy|retro|futuristic|organic|mechanical|luxury|calm|energetic|color|easing|duration|delay|loop|trigger|hover|click|scroll|parallax|typewriter|shimmer|confetti|kinetic|reveal|recipe|brand|profile|capture|shader|glitch|neon|plasma|chromatic|3d|perspective|mood|emotion|principle|anticipation|follow|through|overlapping|story|narrative|arc|beat|pacing|adapt|responsive|mobile|reduced|motion|export|html|react|css|video|lottie|skill|state|machine|transition|synthesize|generative|heartbeat|breathing|pendulum|image|speech|voice|model)\b/g) ?? [];
  const triggerPattern = keywords.length > 0 ? keywords.join("|") : userMessage.slice(0, 80);

  // Categorize the skill across the full tool surface so retrieval can route
  // by intent domain. Each category maps to a cluster of related tools.
  const categories: string[] = [];
  if (toolNames.includes("add_layer") || toolNames.includes("add_shape") || toolNames.includes("add_image") || toolNames.includes("add_video") || toolNames.includes("add_audio") || toolNames.includes("add_typewriter_text")) categories.push("creation");
  if (toolNames.includes("set_easing") || toolNames.includes("set_spring") || toolNames.includes("set_custom_bezier") || toolNames.includes("synthesize_easing")) categories.push("easing");
  if (toolNames.includes("set_duration") || toolNames.includes("set_delay") || toolNames.includes("set_global_timing") || toolNames.includes("set_loop") || toolNames.includes("set_fill_mode")) categories.push("timing");
  if (toolNames.includes("set_transform") || toolNames.includes("set_keyframe") || toolNames.includes("add_property_keyframe") || toolNames.includes("set_motion_path") || toolNames.includes("set_interpolation")) categories.push("keyframes");
  if (toolNames.includes("stagger_components") || toolNames.includes("choreograph") || toolNames.includes("apply_choreography") || toolNames.includes("blend_motions") || toolNames.includes("interpolate_motion")) categories.push("choreography");
  if (toolNames.includes("apply_preset") || toolNames.includes("apply_style") || toolNames.includes("apply_brand_pack")) categories.push("style");
  if (toolNames.includes("set_color") || toolNames.includes("harmonize_colors")) categories.push("color");
  if (toolNames.includes("set_filter") || toolNames.includes("set_shader_effect") || toolNames.includes("set_3d_transform") || toolNames.includes("set_blend_mode") || toolNames.includes("set_adjustment_layer")) categories.push("effects");
  if (toolNames.includes("apply_recipe") || toolNames.includes("apply_project_recipe") || toolNames.includes("save_project_recipe")) categories.push("recipe");
  if (toolNames.includes("set_motion_profile") || toolNames.includes("apply_motion_profile") || toolNames.includes("save_motion_capture") || toolNames.includes("apply_motion_capture")) categories.push("profile");
  if (toolNames.includes("capture_state") || toolNames.includes("apply_state") || toolNames.includes("compose_state_machine") || toolNames.includes("trigger_state_machine") || toolNames.includes("add_transition")) categories.push("state-machine");
  if (toolNames.includes("analyze_motion") || toolNames.includes("analyze_restraint") || toolNames.includes("analyze_mood") || toolNames.includes("analyze_emotion") || toolNames.includes("analyze_rhythm") || toolNames.includes("analyze_narrative") || toolNames.includes("analyze_pacing") || toolNames.includes("analyze_visual_context") || toolNames.includes("analyze_principles") || toolNames.includes("check_accessibility") || toolNames.includes("check_performance") || toolNames.includes("recognize_pattern")) categories.push("analysis");
  if (toolNames.includes("create_beat") || toolNames.includes("create_story_arc") || toolNames.includes("apply_story_plan") || toolNames.includes("export_storyboard")) categories.push("storytelling");
  if (toolNames.includes("adapt_motion") || toolNames.includes("generate_responsive_css") || toolNames.includes("preview_adaptations")) categories.push("adaptive");
  if (toolNames.includes("synthesize_motion") || toolNames.includes("synthesize_waveform") || toolNames.includes("synthesize_code") || toolNames.includes("morph_to_pattern") || toolNames.includes("compile_grammar") || toolNames.includes("parse_motion")) categories.push("synthesis");
  if (toolNames.includes("apply_principle")) categories.push("principles");
  if (toolNames.includes("set_mood") || toolNames.includes("analyze_mood")) categories.push("mood");
  if (toolNames.includes("export_html") || toolNames.includes("export_code") || toolNames.includes("export_video") || toolNames.includes("export_lottie") || toolNames.includes("export_skill") || toolNames.includes("apply_export_preset")) categories.push("export");
  if (toolNames.includes("save_version") || toolNames.includes("save_session_snapshot") || toolNames.includes("restore_version")) categories.push("versioning");
  if (toolNames.includes("save_memory") || toolNames.includes("recall_memory")) categories.push("memory");
  if (toolNames.includes("save_token") || toolNames.includes("update_token")) categories.push("tokens");
  if (toolNames.includes("save_pipeline") || toolNames.includes("run_pipeline")) categories.push("pipeline");
  if (toolNames.includes("generate_image") || toolNames.includes("generate_speech") || toolNames.includes("generate_video") || toolNames.includes("generate_3d")) categories.push("multimodal");
  if (toolNames.includes("generate_motion_docs")) categories.push("documentation");

  const description = `${categories.join(" + ")} sequence: ${summaries.slice(0, 3).join("; ")}`;

  // Build the skill markdown document
  const toolList = toolNames.map((t, i) => `${i + 1}. \`${t}\` — ${summaries[i] ?? "executed"}`).join("\n");
  const skillMarkdown = `# ${name}

## Description
${description}

## Trigger
When the user says something matching: \`${triggerPattern}\`

## Tool Sequence
${toolList}

## Original Request
> ${userMessage}

## Usage
Apply this sequence when a similar request is received. Adapt component IDs and
parameters to the current project context.

## Tags
${categories.map((c) => `#${c}`).join(" ")}
`;

  return {
    name: name || "Untitled Skill",
    description,
    triggerPattern,
    toolSequence: JSON.stringify(toolNames),
    skillMarkdown,
    tags: categories,
  };
}

/** Find and optionally apply a previously learned skill for the given request. */
export function recallSkill(userMessage: string): GeneratedSkill | null {
  const skills = searchGeneratedSkills(userMessage, 1);
  if (skills.length === 0) return null;
  incrementSkillUsage(skills[0].id);
  return skills[0];
}

/** Get a hint about whether a skill exists for the current request. */
export function hasSkillFor(userMessage: string): boolean {
  return searchGeneratedSkills(userMessage, 1).length > 0;
}
