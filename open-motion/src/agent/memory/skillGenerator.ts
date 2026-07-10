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

  // Build trigger pattern from keywords
  const keywords = userMessage.toLowerCase().match(/\b(animate|bounce|fade|slide|rotate|scale|pulse|shake|float|glow|stagger|cascade|orbit|wave|spring|smooth|snappy|dramatic|playful|professional|minimal|color|easing|duration|delay|loop|trigger|hover|click|scroll)\b/g) ?? [];
  const triggerPattern = keywords.length > 0 ? keywords.join("|") : userMessage.slice(0, 80);

  // Categorize the skill
  const categories: string[] = [];
  if (toolNames.includes("add_layer") || toolNames.includes("add_shape")) categories.push("creation");
  if (toolNames.includes("set_easing") || toolNames.includes("set_spring")) categories.push("easing");
  if (toolNames.includes("set_duration") || toolNames.includes("set_delay")) categories.push("timing");
  if (toolNames.includes("set_transform") || toolNames.includes("set_keyframe")) categories.push("keyframes");
  if (toolNames.includes("stagger_components") || toolNames.includes("choreograph")) categories.push("choreography");
  if (toolNames.includes("apply_preset") || toolNames.includes("apply_style")) categories.push("style");
  if (toolNames.includes("set_color") || toolNames.includes("harmonize_colors")) categories.push("color");
  if (toolNames.includes("set_filter") || toolNames.includes("set_3d_transform")) categories.push("effects");

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
