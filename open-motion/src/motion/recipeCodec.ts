/**
 * Triple-Encoding Recipe Codec
 *
 * Each motion recipe lives in three encodings, all derived from a single
 * canonical form. The codec converts between them so the Agent can pick the
 * most efficient execution path for any given context.
 *
 *   Encoding 1 — Natural Language (description + skillMarkdown)
 *       Human-readable intent. Used when the LLM needs to reason about
 *       which recipe to apply.
 *
 *   Encoding 2 — Structured Spec (recipe field)
 *       JSON object with keyframes, easing, duration, loop. Used by the
 *       restraint engine and the analysis pipeline.
 *
 *   Encoding 3 — Tool Call Sequence (executable)
 *       Ordered list of {tool, args} pairs that, when executed in order,
 *       reproduces the recipe on a target component. This is the executable
 *       form — the Agent can invoke the recipe with one apply_recipe call
 *       and the runtime expands it into the underlying tool sequence.
 *
 * The triple encoding means a recipe is simultaneously:
 *   - searchable by description (encoding 1)
 *   - analyzable by structure (encoding 2)
 *   - directly executable without LLM round-trips (encoding 3)
 */

import type { ToolName } from "@openmotion/shared";
import type { MotionRecipe } from "./recipes.js";

export interface ToolCallAtom {
  tool: ToolName;
  args: Record<string, unknown>;
  reason: string;
}

export interface TripleEncodedRecipe {
  recipeId: string;
  name: string;
  category: string;
  /** Encoding 1: human-readable description. */
  description: string;
  skillMarkdown: string;
  /** Encoding 2: structured motion spec. */
  spec: Record<string, unknown>;
  /** Encoding 3: executable tool call sequence. */
  toolCalls: ToolCallAtom[];
  /** Total cost: number of tool calls + restraint cost. */
  executionCost: number;
}

interface RecipeSpec {
  easing?: { type: string; name?: string; stiffness?: number; damping?: number; mass?: number };
  durationMs?: number;
  iterationCount?: string | number;
  direction?: string;
  keyframes?: Array<{ offset: number; properties: Record<string, unknown> }>;
  trigger?: string;
}

/**
 * Convert a recipe's structured spec into an executable tool call sequence.
 * This is the core of the triple encoding: spec → tool calls.
 *
 * The sequence is:
 *   1. (optional) set_easing or set_spring — if easing is specified
 *   2. (optional) set_duration — if durationMs is specified
 *   3. (optional) set_loop — if iterationCount is specified
 *   4. set_transform — one call per animated property in the keyframes
 *
 * The componentId is left as a placeholder "${componentId}" so the runtime
 * can substitute the actual target component when the recipe is applied.
 */
export function encodeSpecToToolCalls(spec: Record<string, unknown>): ToolCallAtom[] {
  const atoms: ToolCallAtom[] = [];
  const recipe = spec as RecipeSpec;

  // Easing
  if (recipe.easing) {
    if (recipe.easing.type === "spring") {
      atoms.push({
        tool: "set_spring" as ToolName,
        args: {
          componentId: "${componentId}",
          stiffness: recipe.easing.stiffness ?? 170,
          damping: recipe.easing.damping ?? 12,
          mass: recipe.easing.mass ?? 1,
        },
        reason: `apply spring easing (stiffness=${recipe.easing.stiffness ?? 170})`,
      });
    } else if (recipe.easing.type === "preset" && recipe.easing.name) {
      atoms.push({
        tool: "set_easing" as ToolName,
        args: {
          componentId: "${componentId}",
          preset: recipe.easing.name,
        },
        reason: `apply ${recipe.easing.name} easing`,
      });
    } else if (recipe.easing.type === "cubic-bezier") {
      atoms.push({
        tool: "set_custom_bezier" as ToolName,
        args: {
          componentId: "${componentId}",
          x1: recipe.easing.name === "cubic-bezier" ? 0.4 : 0.4,
          y1: 0,
          x2: 0.2,
          y2: 1,
        },
        reason: "apply cubic-bezier easing",
      });
    }
  }

  // Duration
  if (typeof recipe.durationMs === "number") {
    atoms.push({
      tool: "set_duration" as ToolName,
      args: {
        componentId: "${componentId}",
        durationMs: recipe.durationMs,
      },
      reason: `set duration to ${recipe.durationMs}ms`,
    });
  }

  // Loop
  if (recipe.iterationCount !== undefined || recipe.direction !== undefined) {
    atoms.push({
      tool: "set_loop" as ToolName,
      args: {
        componentId: "${componentId}",
        iterationCount: recipe.iterationCount ?? 1,
        ...(recipe.direction ? { direction: recipe.direction } : {}),
      },
      reason: `set loop to ${recipe.iterationCount ?? 1}${recipe.direction ? ` (${recipe.direction})` : ""}`,
    });
  }

  // Keyframes — group by property, then emit one set_transform per property.
  if (Array.isArray(recipe.keyframes) && recipe.keyframes.length > 0) {
    const propertyMap = new Map<string, Array<{ offset: number; value: unknown }>>();
    for (const kf of recipe.keyframes) {
      for (const [prop, value] of Object.entries(kf.properties ?? {})) {
        if (!propertyMap.has(prop)) propertyMap.set(prop, []);
        propertyMap.get(prop)!.push({ offset: kf.offset, value });
      }
    }

    for (const [property, frames] of propertyMap) {
      atoms.push({
        tool: "set_transform" as ToolName,
        args: {
          componentId: "${componentId}",
          property,
          keyframes: frames.map((f) => ({ offset: f.offset, value: f.value })),
        },
        reason: `animate ${property} across ${frames.length} keyframe(s)`,
      });
    }
  }

  return atoms;
}

/**
 * Produce the full triple encoding for a recipe.
 * All three encodings are derived from the canonical recipe record.
 */
export function encodeRecipeTriple(recipe: MotionRecipe): TripleEncodedRecipe {
  const toolCalls = encodeSpecToToolCalls(recipe.recipe);
  const restraintCost = recipe.restraintCost;
  return {
    recipeId: recipe.id,
    name: recipe.name,
    category: recipe.category,
    description: recipe.description,
    skillMarkdown: recipe.skillMarkdown,
    spec: recipe.recipe,
    toolCalls,
    executionCost: toolCalls.length + restraintCost,
  };
}

/**
 * Batch-encode a list of recipes into their triple-encoded form.
 * Useful for precomputing the executable library at startup.
 */
export function encodeRecipeLibrary(recipes: MotionRecipe[]): TripleEncodedRecipe[] {
  return recipes.map(encodeRecipeTriple);
}

/**
 * Substitute the placeholder componentId in a tool call sequence with an
 * actual component id. Returns a new array — the input is not mutated.
 */
export function substituteComponentId(
  atoms: ToolCallAtom[],
  componentId: string,
): ToolCallAtom[] {
  return atoms.map((atom) => ({
    tool: atom.tool,
    args: Object.fromEntries(
      Object.entries(atom.args).map(([k, v]) => [
        k,
        v === "${componentId}" ? componentId : v,
      ]),
    ) as Record<string, unknown>,
    reason: atom.reason,
  }));
}

/**
 * Reverse encoding: given a sequence of executed tool calls, derive a
 * structured spec. This is used to capture user-driven compositions back
 * into the recipe library as new recipes.
 */
export function decodeToolCallsToSpec(
  atoms: Array<{ tool: string; args: Record<string, unknown> }>,
): Record<string, unknown> {
  const spec: RecipeSpec = {};
  const propertyFrames = new Map<string, Array<{ offset: number; value: unknown }>>();

  for (const atom of atoms) {
    if (atom.tool === "set_easing") {
      spec.easing = { type: "preset", name: String(atom.args.preset ?? "ease") };
    } else if (atom.tool === "set_spring") {
      spec.easing = {
        type: "spring",
        stiffness: Number(atom.args.stiffness ?? 170),
        damping: Number(atom.args.damping ?? 12),
        mass: Number(atom.args.mass ?? 1),
      };
    } else if (atom.tool === "set_custom_bezier") {
      spec.easing = { type: "cubic-bezier" };
    } else if (atom.tool === "set_duration") {
      spec.durationMs = Number(atom.args.durationMs ?? 600);
    } else if (atom.tool === "set_loop") {
      spec.iterationCount = (atom.args.iterationCount as string | number) ?? 1;
      if (atom.args.direction) spec.direction = String(atom.args.direction);
    } else if (atom.tool === "set_transform") {
      const property = String(atom.args.property ?? "");
      const keyframes = (atom.args.keyframes as Array<{ offset: number; value: unknown }>) ?? [];
      propertyFrames.set(property, keyframes);
    }
  }

  if (propertyFrames.size > 0) {
    // Reconstruct combined keyframes from per-property tracks.
    const offsets = new Set<number>();
    for (const frames of propertyFrames.values()) {
      for (const f of frames) offsets.add(f.offset);
    }
    const sortedOffsets = Array.from(offsets).sort((a, b) => a - b);
    spec.keyframes = sortedOffsets.map((offset) => {
      const properties: Record<string, unknown> = {};
      for (const [property, frames] of propertyFrames) {
        const frame = frames.find((f) => f.offset === offset);
        if (frame) properties[property] = frame.value;
      }
      return { offset, properties };
    });
  }

  return spec as Record<string, unknown>;
}

/**
 * Compose a human-readable description from a structured spec.
 * Used when capturing user-driven tool sequences as new recipes.
 */
export function composeDescriptionFromSpec(spec: Record<string, unknown>): string {
  const parts: string[] = [];
  const recipe = spec as RecipeSpec;

  if (recipe.durationMs) {
    parts.push(`${recipe.durationMs}ms`);
  }
  if (recipe.easing) {
    if (recipe.easing.type === "spring") {
      parts.push(`spring (stiffness ${recipe.easing.stiffness ?? 170})`);
    } else if (recipe.easing.name) {
      parts.push(recipe.easing.name);
    }
  }
  if (recipe.iterationCount === "infinite" || recipe.iterationCount === -1) {
    parts.push("infinite loop");
  } else if (typeof recipe.iterationCount === "number" && recipe.iterationCount > 1) {
    parts.push(`repeat ${recipe.iterationCount}x`);
  }
  if (Array.isArray(recipe.keyframes) && recipe.keyframes.length > 0) {
    const properties = new Set<string>();
    for (const kf of recipe.keyframes) {
      for (const prop of Object.keys(kf.properties ?? {})) properties.add(prop);
    }
    parts.push(`${properties.size} animated prop(s)`);
  }

  return parts.length > 0 ? `Motion recipe: ${parts.join(", ")}` : "Motion recipe";
}

/**
 * Build a skill markdown document from a triple-encoded recipe.
 * This is the portable form — a self-contained markdown file that
 * documents the recipe for cross-project use.
 */
export function buildSkillMarkdown(triple: TripleEncodedRecipe): string {
  const lines: string[] = [];
  lines.push(`# ${triple.name}`);
  lines.push("");
  lines.push(`**Category:** ${triple.category}`);
  lines.push(`**Execution cost:** ${triple.executionCost} (${triple.toolCalls.length} tool calls)`);
  lines.push("");
  lines.push("## Description");
  lines.push("");
  lines.push(triple.description);
  lines.push("");
  lines.push("## Structured Spec");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(triple.spec, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("## Tool Call Sequence");
  lines.push("");
  for (let i = 0; i < triple.toolCalls.length; i++) {
    const atom = triple.toolCalls[i];
    lines.push(`${i + 1}. \`${atom.tool}\` — ${atom.reason}`);
  }
  lines.push("");
  lines.push("## SKILL Export");
  lines.push("");
  lines.push("This recipe is exported as a SKILL document for cross-project portability.");
  return lines.join("\n");
}
