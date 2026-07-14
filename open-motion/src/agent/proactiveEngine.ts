import type { MotionSpec } from "@openmotion/shared";

/**
 * Proactive Suggestion Engine — generates short, contextual "next step"
 * suggestions immediately after a tool execution. Unlike suggest_next
 * (user-invoked, comprehensive) and suggestCreative (exhaustive + surprise),
 * this engine produces 1-3 focused prompts tied to the just-completed action
 * and the current spec state. Rule-based so it works in mock mode.
 */

export type SuggestionKind =
  | "refine"
  | "extend"
  | "diversify"
  | "interact"
  | "sequence"
  | "polish";

export interface ProactiveSuggestion {
  /** Short headline shown in the UI chip. */
  title: string;
  /** One-sentence reason explaining why this is suggested now. */
  reason: string;
  /** Tool the user could ask the agent to run. */
  tool: string;
  /** Suggested phrasing the user can send verbatim. */
  prompt: string;
  /** Classification controlling the chip color. */
  kind: SuggestionKind;
}

export interface ProactiveContext {
  spec: MotionSpec;
  lastTool: string | null;
  lastToolOk: boolean;
  lastComponentId?: string;
}

/**
 * Produce 0-3 proactive suggestions for the current state. Returns an empty
 * array when there is nothing useful to say — the UI hides the bar in that case.
 */
export function suggestProactive(ctx: ProactiveContext): ProactiveSuggestion[] {
  const { spec, lastTool, lastToolOk } = ctx;
  const out: ProactiveSuggestion[] = [];
  const comps = spec.components;
  const compCount = comps.length;
  const last = ctx.lastComponentId ? comps.find((c) => c.id === ctx.lastComponentId) : comps[comps.length - 1];

  // Tool-specific nudges --------------------------------------------------
  if (lastToolOk && lastTool) {
    pushToolSpecific(out, lastTool, spec, last?.id);
  }

  // State-based nudges ----------------------------------------------------
  pushStateBased(out, spec);

  // De-duplicate by tool + title and cap at 3.
  const seen = new Set<string>();
  const unique: ProactiveSuggestion[] = [];
  for (const s of out) {
    const key = `${s.tool}|${s.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
    if (unique.length >= 3) break;
  }
  return unique;
}

function pushToolSpecific(
  out: ProactiveSuggestion[],
  tool: string,
  spec: MotionSpec,
  lastId?: string,
): void {
  const compCount = spec.components.length;
  const target = lastId ? ` on the new layer` : "";

  switch (tool) {
    case "add_layer":
    case "add_shape":
      out.push({
        title: "Give it motion",
        reason: "A new layer without keyframes sits still — animate it to bring the scene to life.",
        tool: "apply_preset",
        prompt: "Apply a subtle float preset to the newest layer",
        kind: "extend",
      });
      out.push({
        title: "Set the easing",
        reason: "Choosing the easing curve early defines the layer's personality.",
        tool: "set_easing",
        prompt: "Make the newest layer use a smooth easing",
        kind: "refine",
      });
      break;

    case "set_template":
      out.push({
        title: "Tune the duration",
        reason: "Template durations are starting points — adjust to fit your scene pacing.",
        tool: "set_duration",
        prompt: "Shorten the newest layer to 500ms",
        kind: "refine",
      });
      out.push({
        title: "Customize the easing",
        reason: "Swap the easing to give the template a different feel.",
        tool: "set_easing",
        prompt: "Switch the newest layer to a bouncy easing",
        kind: "refine",
      });
      break;

    case "set_easing":
      if (compCount >= 2) {
        out.push({
          title: "Apply to all layers",
          reason: "Sharing the easing across components creates a cohesive aesthetic.",
          tool: "batch_update",
          prompt: "Apply this easing to every component",
          kind: "polish",
        });
      }
      out.push({
        title: "Pair with a duration",
        reason: "Easing and duration work together — tune the duration to match the new feel.",
        tool: "set_duration",
        prompt: "Set the duration to complement the new easing",
        kind: "refine",
      });
      break;

    case "set_duration":
      out.push({
        title: "Add a delay",
        reason: "A short delay sequences the animation relative to others.",
        tool: "set_delay",
        prompt: "Add a 200ms delay to the selected layer",
        kind: "sequence",
      });
      if (compCount >= 2) {
        out.push({
          title: "Stagger the layers",
          reason: "Cascading delays across components create a polished entrance.",
          tool: "stagger_components",
          prompt: "Stagger all components with 120ms steps",
          kind: "sequence",
        });
      }
      break;

    case "set_transform":
      out.push({
        title: "Refine with keyframes",
        reason: "Add intermediate keyframes for finer control over the motion arc.",
        tool: "add_property_keyframe",
        prompt: "Add a midpoint keyframe to the selected layer",
        kind: "refine",
      });
      break;

    case "apply_preset":
      out.push({
        title: "Set a trigger",
        reason: "Interactive triggers transform passive animations into engaging moments.",
        tool: "set_trigger",
        prompt: "Make the layer animate on hover",
        kind: "interact",
      });
      out.push({
        title: "Adjust intensity",
        reason: "Tune duration or easing to dial the preset's intensity up or down.",
        tool: "set_duration",
        prompt: "Soften the preset by lengthening the duration",
        kind: "refine",
      });
      break;

    case "duplicate_component":
      if (compCount >= 2) {
        out.push({
          title: "Stagger the duplicate",
          reason: "Offset the duplicate's delay so it follows the original in sequence.",
          tool: "stagger_components",
          prompt: "Stagger the components with 150ms steps",
          kind: "sequence",
        });
      }
      break;

    case "set_color":
      if (compCount >= 2) {
        out.push({
          title: "Harmonize the palette",
          reason: "Apply color theory so all components sit in the same visual family.",
          tool: "harmonize_colors",
          prompt: "Harmonize colors across all components",
          kind: "polish",
        });
      }
      break;

    case "set_motion_path":
      out.push({
        title: "Tune the path speed",
        reason: "Path duration controls how fast the element travels — adjust to taste.",
        tool: "set_duration",
        prompt: "Slow down the path animation to 2000ms",
        kind: "refine",
      });
      break;

    case "choreograph":
      out.push({
        title: "Preview the sequence",
        reason: "Watch the choreography play back to confirm the rhythm feels right.",
        tool: "preview_url",
        prompt: "Open a preview of the choreography",
        kind: "polish",
      });
      break;

    case "create_variant":
      out.push({
        title: "Compare side by side",
        reason: "Preview both variants to decide which feel fits the scene.",
        tool: "preview_url",
        prompt: "Preview the project to compare variants",
        kind: "polish",
      });
      break;

    case "add_scene":
      out.push({
        title: "Populate the new scene",
        reason: "A fresh scene is empty — add a layer or apply a template to start it.",
        tool: "set_template",
        prompt: "Apply a fade-in template to the new scene",
        kind: "extend",
      });
      break;
  }

  // Avoid unused-parameter lint when target is empty.
  void target;
}

function pushStateBased(out: ProactiveSuggestion[], spec: MotionSpec): void {
  const comps = spec.components;
  const compCount = comps.length;

  // Single component → suggest company.
  if (compCount === 1) {
    out.push({
      title: "Add another layer",
      reason: "A single component has no relationships — adding a second layer unlocks sequencing.",
      tool: "add_layer",
      prompt: "Add a second layer to compose with",
      kind: "extend",
    });
  }

  // Easing monotony.
  if (compCount >= 3) {
    const easingTypes = new Set(comps.map((c) => c.easing.type));
    if (easingTypes.size === 1) {
      out.push({
        title: "Diversify the easings",
        reason: `All ${compCount} components share the same easing — variation creates visual interest.`,
        tool: "set_easing",
        prompt: "Vary the easing across components",
        kind: "diversify",
      });
    }
  }

  // Duration uniformity.
  if (compCount >= 3) {
    const durations = new Set(comps.map((c) => Math.round(c.durationMs / 100)));
    if (durations.size === 1) {
      out.push({
        title: "Vary the timing",
        reason: "Identical durations feel mechanical — stagger the timing for organic rhythm.",
        tool: "stagger_components",
        prompt: "Stagger the components to vary their timing",
        kind: "diversify",
      });
    }
  }

  // No interactive triggers.
  if (compCount >= 2 && comps.every((c) => c.trigger === "onLoad")) {
    out.push({
      title: "Add an interactive trigger",
      reason: "Every animation plays on load — adding onClick or onHover creates engagement.",
      tool: "set_trigger",
      prompt: "Make the first layer animate on click",
      kind: "interact",
    });
  }

  // Component with no keyframes.
  const staticComp = comps.find((c) => c.keyframes.length === 0);
  if (staticComp) {
    out.push({
      title: `Animate "${staticComp.name}"`,
      reason: `"${staticComp.name}" has no keyframes — it sits still while others move.`,
      tool: "apply_preset",
      prompt: `Apply a preset to ${staticComp.name}`,
      kind: "extend",
    });
  }
}
