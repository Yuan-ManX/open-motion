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

    // --- Spring physics follow-up ---
    case "set_spring":
      out.push({
        title: "Pair with a duration",
        reason: "Spring physics interact with duration — tune both for the right settle time.",
        tool: "set_duration",
        prompt: "Set the spring duration to 1200ms",
        kind: "refine",
      });
      if (compCount >= 2) {
        out.push({
          title: "Apply the spring to all layers",
          reason: "Sharing the spring response across components creates a unified feel.",
          tool: "batch_update",
          prompt: "Apply this spring response to every component",
          kind: "polish",
        });
      }
      break;

    // --- Loop follow-up ---
    case "set_loop":
      out.push({
        title: "Pick a direction",
        reason: "Loop direction changes the rhythm — alternate creates a back-and-forth feel.",
        tool: "batch_update",
        prompt: "Set the loop direction to alternate",
        kind: "refine",
      });
      out.push({
        title: "Check accessibility",
        reason: "Infinite loops can cause vestibular discomfort — verify the motion is safe.",
        tool: "check_accessibility",
        prompt: "Check accessibility of the looping motion",
        kind: "polish",
      });
      break;

    // --- Delay follow-up ---
    case "set_delay":
      if (compCount >= 2) {
        out.push({
          title: "Stagger the rest",
          reason: "Now that one component is delayed, stagger the others to complete the cascade.",
          tool: "stagger_components",
          prompt: "Stagger all components with 120ms steps",
          kind: "sequence",
        });
      }
      break;

    // --- Color change follow-up (extends the existing set_color case) ---
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
      out.push({
        title: "Apply a style preset",
        reason: "A style preset coordinates color, easing, and timing for a cohesive aesthetic.",
        tool: "apply_style",
        prompt: "Apply a minimal style preset to the project",
        kind: "polish",
      });
      break;

    // --- Filter / shader effect follow-up ---
    case "set_filter":
    case "set_shader_effect":
      out.push({
        title: "Check performance",
        reason: "Shader and filter effects compound render cost — verify the frame budget.",
        tool: "check_performance",
        prompt: "Check performance of the filtered components",
        kind: "polish",
      });
      out.push({
        title: "Tune the intensity",
        reason: "Shader intensity often needs a small duration or opacity tweak to feel right.",
        tool: "set_duration",
        prompt: "Lengthen the shader effect to 1000ms",
        kind: "refine",
      });
      break;

    // --- 3D transform follow-up ---
    case "set_3d_transform":
      out.push({
        title: "Add depth with perspective",
        reason: "3D transforms feel flat without a perspective context — tune the scene perspective.",
        tool: "set_artboard",
        prompt: "Set the artboard perspective to 1200px",
        kind: "refine",
      });
      break;

    // --- Recipe apply follow-up ---
    case "apply_recipe":
      out.push({
        title: "Save as a project recipe",
        reason: "If this recipe fits your brand, capture it for reuse across the project.",
        tool: "save_project_recipe",
        prompt: "Save the current motion as a project recipe",
        kind: "polish",
      });
      out.push({
        title: "Apply to other layers",
        reason: "Apply the same recipe to other components for a consistent feel.",
        tool: "apply_recipe",
        prompt: "Apply the same recipe to the next component",
        kind: "extend",
      });
      break;

    // --- Style preset follow-up ---
    case "apply_style":
      out.push({
        title: "Preview the styled scene",
        reason: "Style presets change many parameters at once — preview to confirm the feel.",
        tool: "preview_url",
        prompt: "Preview the project to see the styled scene",
        kind: "polish",
      });
      if (compCount >= 2) {
        out.push({
          title: "Vary one component for contrast",
          reason: "A single component that breaks the style creates a focal point.",
          tool: "apply_preset",
          prompt: "Apply a contrasting preset to the hero component",
          kind: "diversify",
        });
      }
      break;

    // --- Refine motion follow-up ---
    case "refine_motion":
      out.push({
        title: "Preview the refined motion",
        reason: "Refinements change timing and easing — preview to confirm the feel.",
        tool: "preview_url",
        prompt: "Preview the refined motion",
        kind: "polish",
      });
      break;

    // --- Choreograph (covered above) — also nudge toward restraint check ---
    case "apply_choreography":
      out.push({
        title: "Check restraint",
        reason: "Choreographed multi-component motion can feel busy — verify the restraint score.",
        tool: "analyze_restraint",
        prompt: "Analyze restraint of the choreographed scene",
        kind: "polish",
      });
      break;

    // --- Blend / interpolate motion follow-up ---
    case "blend_motions":
    case "interpolate_motion":
      out.push({
        title: "Preview the blended motion",
        reason: "Blended motion is hard to predict — preview to confirm the result feels right.",
        tool: "preview_url",
        prompt: "Preview the blended motion",
        kind: "polish",
      });
      break;

    // --- Mood profile follow-up ---
    case "set_mood":
    case "analyze_mood":
      out.push({
        title: "Apply a matching style preset",
        reason: "A style preset complements the mood by coordinating easing and timing.",
        tool: "apply_style",
        prompt: "Apply a style preset that matches the mood",
        kind: "polish",
      });
      break;

    // --- Animation principle follow-up ---
    case "apply_principle":
      out.push({
        title: "Preview the principled motion",
        reason: "Principles change keyframe shape — preview to confirm the improvement.",
        tool: "preview_url",
        prompt: "Preview the motion with the applied principle",
        kind: "polish",
      });
      break;

    // --- Accessibility check follow-up ---
    case "check_accessibility":
      out.push({
        title: "Adapt for reduced motion",
        reason: "If issues were found, adapt the motion to respect prefers-reduced-motion.",
        tool: "adapt_motion",
        prompt: "Adapt the motion for reduced-motion users",
        kind: "polish",
      });
      break;

    // --- Performance check follow-up ---
    case "check_performance":
      out.push({
        title: "Adapt for low-end devices",
        reason: "If the frame budget is tight, adapt the motion for lower performance tiers.",
        tool: "adapt_motion",
        prompt: "Adapt the motion for low-performance devices",
        kind: "polish",
      });
      break;

    // --- Storyboard beat follow-up ---
    case "create_beat":
      out.push({
        title: "Add another beat",
        reason: "A single beat is a starting point — add more to structure the narrative arc.",
        tool: "create_beat",
        prompt: "Add a second storyboard beat",
        kind: "extend",
      });
      out.push({
        title: "Apply beats to components",
        reason: "Align component timing with the story beats to reinforce the narrative.",
        tool: "apply_story_plan",
        prompt: "Apply the story plan to align components with beats",
        kind: "sequence",
      });
      break;

    // --- Version snapshot follow-up ---
    case "save_version":
      out.push({
        title: "Continue editing",
        reason: "Now that a snapshot is captured, you can experiment freely and roll back if needed.",
        tool: "set_template",
        prompt: "Apply a new template to experiment",
        kind: "extend",
      });
      break;

    // --- Motion capture follow-up ---
    case "save_motion_capture":
      if (compCount >= 1) {
        out.push({
          title: "Apply the capture",
          reason: "A captured trajectory comes alive when applied to a component.",
          tool: "apply_motion_capture",
          prompt: "Apply the motion capture to the selected component",
          kind: "extend",
        });
      }
      break;

    // --- Brand pack follow-up ---
    case "apply_brand_pack":
      out.push({
        title: "Preview the branded scene",
        reason: "Brand packs change motion identity across all components — preview to verify.",
        tool: "preview_url",
        prompt: "Preview the project to see the branded motion",
        kind: "polish",
      });
      break;

    // --- Motion profile follow-up ---
    case "set_motion_profile":
      out.push({
        title: "Apply the profile",
        reason: "Setting a profile is the first step — apply it to tune the component's motion parameters.",
        tool: "apply_motion_profile",
        prompt: "Apply the motion profile to the component",
        kind: "refine",
      });
      break;

    // --- Generative synthesis follow-up ---
    case "synthesize_motion":
    case "synthesize_waveform":
      out.push({
        title: "Tune the duration",
        reason: "Generative patterns often need a duration tweak to match the scene's tempo.",
        tool: "set_duration",
        prompt: "Set the synthesized motion duration to 1500ms",
        kind: "refine",
      });
      break;

    // --- Code synthesis follow-up ---
    case "synthesize_code":
      out.push({
        title: "Export the project",
        reason: "You have standalone code — export the full project to package it for delivery.",
        tool: "export_html",
        prompt: "Export the project as a standalone HTML file",
        kind: "polish",
      });
      break;

    // --- Documentation follow-up ---
    case "generate_motion_docs":
      out.push({
        title: "Save a version snapshot",
        reason: "Documentation pairs well with a version snapshot for handoff.",
        tool: "save_version",
        prompt: "Save a version snapshot for handoff",
        kind: "polish",
      });
      break;

    // --- State machine compose follow-up ---
    case "compose_state_machine":
      out.push({
        title: "Trigger a state",
        reason: "Test the state machine by transitioning to one of the composed states.",
        tool: "trigger_state_machine",
        prompt: "Trigger the state machine to the next state",
        kind: "interact",
      });
      break;

    // --- Media insertion: animate the new asset ---
    case "add_image":
    case "add_video":
    case "add_audio":
      out.push({
        title: "Animate the media",
        reason: "New media layers benefit from an entrance animation to draw attention.",
        tool: "apply_preset",
        prompt: "Apply a fade-in preset to the new media layer",
        kind: "extend",
      });
      break;

    // --- Timeline clip: play it to verify ---
    case "add_clip":
      out.push({
        title: "Play the clip",
        reason: "Trigger the new clip to verify its timing and content.",
        tool: "play_clip",
        prompt: "Play the newly created clip",
        kind: "interact",
      });
      break;

    // --- Listener: test the interaction ---
    case "add_listener":
      out.push({
        title: "Test the listener",
        reason: "Wire a state transition or animation to verify the listener fires correctly.",
        tool: "trigger_state_machine",
        prompt: "Trigger the action the listener is wired to",
        kind: "interact",
      });
      break;

    // --- Parenting: rig the hierarchy ---
    case "set_parent":
      out.push({
        title: "Add a constraint",
        reason: "Parented layers can be linked with position or rotation constraints for rigging.",
        tool: "add_constraint",
        prompt: "Add a position constraint between the parent and child",
        kind: "extend",
      });
      break;

    // --- Token: apply it ---
    case "save_token":
      out.push({
        title: "Apply the token",
        reason: "Tokens are most useful when referenced by components — apply it to a layer.",
        tool: "set_static_style",
        prompt: "Apply the new token to the first component",
        kind: "polish",
      });
      break;

    // --- Pipeline: run it ---
    case "save_pipeline":
      out.push({
        title: "Run the pipeline",
        reason: "Execute the saved pipeline to verify the automated workflow.",
        tool: "run_pipeline",
        prompt: "Run the newly saved pipeline",
        kind: "interact",
      });
      break;

    // --- Precomp: animate the group ---
    case "create_precomp":
      out.push({
        title: "Animate the precomp",
        reason: "Grouped layers can be animated as a unit — apply a transform to the precomp.",
        tool: "set_transform",
        prompt: "Animate the precomp as a group",
        kind: "extend",
      });
      break;

    // --- Expression: preview the result ---
    case "set_expression":
      out.push({
        title: "Preview the expression",
        reason: "Procedural expressions need visual verification to confirm the formula behaves as expected.",
        tool: "preview_fullscreen",
        prompt: "Preview the animation fullscreen",
        kind: "polish",
      });
      break;

    // --- Scene transition: preview ---
    case "add_scene_transition":
    case "add_camera_move":
      out.push({
        title: "Preview the staging",
        reason: "Scene transitions and camera moves are spatial — preview to verify the cinematic flow.",
        tool: "preview_fullscreen",
        prompt: "Preview the scene transition fullscreen",
        kind: "polish",
      });
      break;

    // --- Typewriter text: tune the typing speed ---
    case "add_typewriter_text":
      out.push({
        title: "Tune typing speed",
        reason: "Typewriter effects depend on cadence — adjust the speed to match the desired mood.",
        tool: "set_duration",
        prompt: "Make the typewriter effect faster",
        kind: "refine",
      });
      break;

    // --- Ungroup precomp: re-layer the freed components ---
    case "ungroup_precomp":
      out.push({
        title: "Reorder the freed layers",
        reason: "After ungrouping, the individual layers may need z-order adjustments.",
        tool: "set_z_order",
        prompt: "Bring the first layer to the front",
        kind: "extend",
      });
      break;

    // --- Adjustment layer: refine the filter intensity ---
    case "set_adjustment_layer":
      out.push({
        title: "Refine the filter intensity",
        reason: "Adjustment layers affect all layers below — verify the filter value looks right.",
        tool: "set_filter",
        prompt: "Reduce the blur intensity on the adjustment layer",
        kind: "refine",
      });
      break;

    // --- Remove clip: close the gap ---
    case "remove_clip":
      out.push({
        title: "Close the timeline gap",
        reason: "Removing a clip leaves a gap — ripple-delete subsequent clips to close it.",
        tool: "reorder_components",
        prompt: "Shift subsequent clips left to close the gap",
        kind: "extend",
      });
      break;

    // --- Remove constraint: verify motion is unconstrained ---
    case "remove_constraint":
      out.push({
        title: "Preview unconstrained motion",
        reason: "After removing a constraint, the layer can move freely — preview to verify the new behavior.",
        tool: "preview_fullscreen",
        prompt: "Preview the animation after removing the constraint",
        kind: "polish",
      });
      break;

    // --- Get motion profile: apply or tune based on the profile ---
    case "get_motion_profile":
      out.push({
        title: "Apply the profile to motion",
        reason: "Now that the component's role and temperament are known, apply the profile to tune its motion parameters.",
        tool: "apply_motion_profile",
        prompt: "Apply the motion profile to tune this component",
        kind: "extend",
      });
      break;

    // --- Multimodal: integrate the asset ---
    case "generate_image":
    case "generate_speech":
    case "generate_video":
    case "generate_3d":
      out.push({
        title: "Integrate the asset",
        reason: "Generated assets are ready to layer into the composition — add them to the canvas.",
        tool: "add_layer",
        prompt: "Add a new layer to host the generated asset",
        kind: "extend",
      });
      break;

    // --- Principles analysis: apply a fix ---
    case "analyze_principles":
      out.push({
        title: "Apply a principle",
        reason: "The analysis identified improvement areas — apply a specific principle to address one.",
        tool: "apply_principle",
        prompt: "Apply anticipation to the primary component",
        kind: "refine",
      });
      break;

    // --- Story arc: apply to timeline ---
    case "create_story_arc":
      out.push({
        title: "Apply the story plan",
        reason: "The story arc defines beats — apply it to align component timing with the narrative.",
        tool: "apply_story_plan",
        prompt: "Apply the story plan to the timeline",
        kind: "sequence",
      });
      break;

    // --- Adaptation: preview on device ---
    case "adapt_motion":
      out.push({
        title: "Preview adaptations",
        reason: "See how the adapted motion looks across breakpoints and devices.",
        tool: "preview_adaptations",
        prompt: "Preview the motion across all breakpoints",
        kind: "polish",
      });
      break;

    // --- Version save: continue or restore ---
    case "save_version":
      out.push({
        title: "Continue editing",
        reason: "A version checkpoint is saved — continue iterating with confidence.",
        tool: "apply_preset",
        prompt: "Try a different preset on the next component",
        kind: "extend",
      });
      break;

    // --- Docs: export the spec ---
    case "generate_motion_docs":
      out.push({
        title: "Export the project",
        reason: "Documentation is ready — pair it with an HTML export for a complete handoff.",
        tool: "export_html",
        prompt: "Export the project as HTML",
        kind: "polish",
      });
      break;

    // --- Synthesis: refine the result ---
    case "synthesize_motion":
    case "synthesize_waveform":
    case "morph_to_pattern":
      out.push({
        title: "Refine the synthesis",
        reason: "Generated motion can be fine-tuned — adjust the easing or duration to taste.",
        tool: "refine_motion",
        prompt: "Make the synthesized motion smoother",
        kind: "refine",
      });
      break;

    // --- Blend/interpolate: preview the result ---
    case "blend_motions":
    case "interpolate_motion":
    case "merge_properties":
      out.push({
        title: "Preview the blend",
        reason: "Composite motions benefit from visual verification.",
        tool: "preview_fullscreen",
        prompt: "Preview the blended motion fullscreen",
        kind: "polish",
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
