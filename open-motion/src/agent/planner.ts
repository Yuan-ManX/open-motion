import type { MotionSpec } from "@openmotion/shared";
import { classifyIntent, resolveTemplateId, resolvePresetName } from "./intents.js";

export interface PlanStep {
  tool: string;
  description: string;
}

export interface Plan {
  steps: PlanStep[];
  summary: string;
}

/**
 * Rule-based plan generation. Inspects the user message and current spec to
 * produce an ordered step list the orchestrator emits as a "plan" event before
 * tool execution. Works without an LLM so mock mode stays fully functional.
 */
export function buildPlan(userMessage: string, spec: MotionSpec): Plan {
  const text = userMessage.toLowerCase();
  const steps: PlanStep[] = [];
  const firstId = spec.components[0]?.id;

  // Create animation / layer by name — resolves to a template or a named layer.
  let createRaw: string | null = null;
  const createWithNounM = userMessage.match(
    /\b(?:create|make|build|generate|design|add)\s+(?:a\s+|an\s+|the\s+)?([\w][\w\s-]*?)\s+(?:animation|effect|motion|transition|layer|element|component)\b/i,
  );
  if (createWithNounM) {
    createRaw = createWithNounM[1].trim();
  } else {
    const createBareM = userMessage.match(
      /\b(?:create|make|build|generate|design)\s+(?:a\s+|an\s+|the\s+)?([\w][\w\s-]+)\s*$/i,
    );
    if (createBareM && resolveTemplateId(createBareM[1].trim())) {
      createRaw = createBareM[1].trim();
    }
  }
  if (createRaw) {
    const resolved = resolveTemplateId(createRaw);
    steps.push({
      tool: resolved ? "set_template" : "add_layer",
      description: resolved
        ? `Create a ${createRaw} animation from the ${resolved} template`
        : `Add a new layer called "${createRaw}"`,
    });
  }

  // Template application.
  const tplM = userMessage.match(/\b(?:use|apply|switch to)\s+(?:the\s+)?([\w\s-]+?)\s+template\b|使用\s*([\w\s-]+?)\s*模板/i);
  if (tplM) {
    const raw = (tplM[1] || tplM[2] || "").trim();
    const resolved = resolveTemplateId(raw);
    steps.push({
      tool: "set_template",
      description: resolved
        ? `Apply the ${resolved} template`
        : `Look up the "${raw}" template and apply it`,
    });
  }

  // Preset application.
  const presetM = userMessage.match(/\b(?:apply|use)\s+(?:the\s+)?(shake|wiggle|float|glow|heartbeat|typewriter)\s+(?:preset|effect|animation)?\b/i);
  if (presetM) {
    const name = resolvePresetName(presetM[1]);
    steps.push({
      tool: "apply_preset",
      description: `Apply the ${name ?? presetM[1]} preset to the selected component`,
    });
  }

  // Easing change.
  if (/\b(bouncy|bounce|springy|smooth|soft|snappy|sharp|crisp|elastic|back|linear|ease-in|ease-out)\b/i.test(text)) {
    if (firstId) {
      steps.push({
        tool: "set_easing",
        description: "Adjust the easing curve to match the requested feel",
      });
    }
  }

  // Spring physics.
  if (/\bspring\b/i.test(text)) {
    if (firstId) {
      steps.push({
        tool: "set_spring",
        description: "Tune spring stiffness, damping, and mass",
      });
    }
  }

  // Duration change.
  if (/\b(slower|faster|slow|fast|quick|speed|duration)\b/i.test(text)) {
    if (firstId) {
      steps.push({
        tool: "set_duration",
        description: "Adjust the animation duration",
      });
    }
  }

  // Loop.
  if (/\b(loop|repeat|forever)\b/i.test(text)) {
    if (firstId) {
      steps.push({
        tool: "set_loop",
        description: "Configure the loop count",
      });
    }
  }

  // Color change.
  if (/\b(red|blue|green|purple|orange|yellow|pink|white|black|gray|grey|color|colour)\b/i.test(text)) {
    if (firstId) {
      steps.push({
        tool: "set_color",
        description: "Update the text or background color",
      });
    }
  }

  // Transform animation.
  if (/\b(translateX|translateY|scale|rotate|opacity|transform|animate)\b/i.test(text)) {
    if (firstId) {
      steps.push({
        tool: "set_transform",
        description: "Animate a transform property from start to end value",
      });
    }
  }

  // Add layer.
  if (/\b(add|create|new)\s+(?:a\s+|an\s+)?(layer|element|component)\b/i.test(userMessage)) {
    steps.push({
      tool: "add_layer",
      description: "Create a new layer in the project",
    });
  }

  // Duplicate.
  if (/\b(duplicate|copy|clone)\b/i.test(text)) {
    if (firstId) {
      steps.push({
        tool: "duplicate_component",
        description: "Duplicate the selected component",
      });
    }
  }

  // Reorder.
  if (/\b(reorder|order|move to front|move to back|bring to front|send to back)\b/i.test(text)) {
    steps.push({
      tool: "reorder_components",
      description: "Reorder the component layers",
    });
  }

  // Batch update.
  if (/\b(all components|every component|everything|all layers|each layer)\b/i.test(text)) {
    steps.push({
      tool: "batch_update",
      description: "Apply the change to all components at once",
    });
  }

  // Playback control.
  if (/\b(pause|stop|resume|play)\b/i.test(text)) {
    steps.push({
      tool: "set_play_state",
      description: "Toggle the playback state",
    });
  }

  // Export.
  if (/\bexport\b/i.test(text)) {
    if (/\bhtml\b/i.test(text)) {
      steps.push({ tool: "export_html", description: "Export the project as a standalone HTML file" });
    } else if (/\b(css|样式)\b/i.test(text)) {
      steps.push({ tool: "export_code", description: "Export the animation as CSS code" });
    } else if (/\bjson\b/i.test(text)) {
      steps.push({ tool: "export_code", description: "Export the MotionSpec as JSON" });
    } else if (/\b(react|tsx|component)\b/i.test(text)) {
      steps.push({ tool: "export_code", description: "Export the animation as a React component" });
    } else if (/\b(video|mp4|gif|webm)\b/i.test(text)) {
      steps.push({ tool: "export_video", description: "Render the animation to a video file" });
    } else if (/\b(lottie|after\s*effects)\b/i.test(text)) {
      steps.push({ tool: "export_lottie", description: "Export the animation as a Lottie JSON file" });
    } else if (/\bskill\b/i.test(text)) {
      steps.push({ tool: "export_skill", description: "Package the motion as a reusable skill" });
    }
  }

  // Preview.
  if (/\bpreview\b/i.test(text)) {
    steps.push({ tool: "preview_url", description: "Generate a live preview URL" });
  }

  // Describe motion (Motion DNA).
  if (/\b(describe|what.*look|explain|dna|characterize)\b/i.test(text)) {
    steps.push({ tool: "describe_motion", description: "Analyze the motion and produce a Motion DNA signature" });
  }

  // Scene management.
  if (/\b(list|show|what)\b.*\bscenes?\b/i.test(text)) {
    steps.push({ tool: "list_scenes", description: "List all scenes with their component counts" });
  }
  if (/\b(remove|delete|drop)\s+scene\b/i.test(text)) {
    steps.push({ tool: "remove_scene", description: "Remove a scene and unassign its components" });
  }

  // Composition: stagger, match, variant.
  if (/\b(stagger|cascade|sequence|one by one)\b/i.test(text)) {
    steps.push({ tool: "stagger_components", description: "Apply cascading delays to all components" });
  }
  if (/\b(find|match|suggest)\b.*\btemplate\b/i.test(text)) {
    steps.push({ tool: "match_template", description: "Find the closest matching template" });
  }
  if (/\b(find.*similar|similar.*motion|what.*else.*like|search.*similar|are.*there.*other.*like|motion.*like.*this|dna.*search|similar.*dna)\b/i.test(text)) {
    steps.push({ tool: "find_similar_motion", description: "Search across all projects and templates for motions with similar DNA" });
  }
  if (/\b(generate.*docs?|motion.*docs?|spec.*document|documentation|document.*project|export.*spec|motion.*spec)\b/i.test(text)) {
    steps.push({ tool: "generate_motion_docs", description: "Generate comprehensive motion specification documentation" });
  }
  if (/\b(animation.*principles?|motion.*principles?|disney.*principles?|12.*principles?|check.*principles?|analyze.*principles?|principle.*score)\b/i.test(text)) {
    steps.push({ tool: "analyze_principles", description: "Analyze motion against Disney's 12 principles of animation" });
  }
  if (/\b(add|apply)\s+(?:the\s+)?(squash.?and.?stretch|anticipation|follow.?through|overlapping.?action|slow.?in.?out|arcs?|secondary.?action|exaggeration|solid.?drawing)\b/i.test(text)) {
    steps.push({ tool: "apply_principle", description: "Apply a specific animation principle to modify keyframes" });
  }
  if (/\b(synthesize.*easing|feel.*weighty|feel.*light|feel.*dramatic|feel.*playful|feather.?light|custom.*bezier|make.*feel.*like)\b/i.test(text)) {
    steps.push({ tool: "synthesize_easing", description: "Synthesize a custom easing curve from a semantic description" });
  }
  if (/\b(cascade|call.?and.?response|unison|counterpoint|wave.*pattern|canon|stagger.?grid|ripple.?out)\b/i.test(text)) {
    steps.push({ tool: "apply_choreography", description: "Apply a choreography pattern to orchestrate multiple components" });
  }
  if (/\b(variant|variation|alternative)\b/i.test(text)) {
    steps.push({ tool: "create_variant", description: "Create a variation of the current motion" });
  }

  // Motion intelligence: analysis, suggestions, and path animation.
  if (/\b(analyze|review|critique|quality|is this good)\b/i.test(text)) {
    steps.push({ tool: "analyze_motion", description: "Analyze motion quality, timing, and composition" });
  }
  if (/\b(suggest|ideas?|what next|what should i)\b/i.test(text)) {
    steps.push({ tool: "suggest_next", description: "Generate context-aware next-step suggestions" });
  }
  if (/\b(orbit|circle|ellipse|along.*path|trajectory|fly across|move in a)\b/i.test(text)) {
    if (firstId) {
      steps.push({ tool: "set_motion_path", description: "Animate the component along a custom path" });
    }
  }

  // Style presets: apply coordinated aesthetic across all components.
  if (/\b(playful|energetic|calm|professional|dramatic|minimal|style)\b/i.test(text)) {
    steps.push({ tool: "apply_style", description: "Apply a coordinated motion style across all components" });
  }

  // Pattern recognition: identify design patterns and anti-patterns.
  if (/\b(patterns?|composition balanced|what.s missing|monoton\w*)/i.test(text)) {
    steps.push({ tool: "recognize_pattern", description: "Identify motion design patterns and anti-patterns" });
  }

  // Color harmony: apply color theory.
  if (/\b(harmoniz\w*|color scheme|colors work together|palette)\b/i.test(text)) {
    steps.push({ tool: "harmonize_colors", description: "Apply color theory for visual harmony" });
  }

  // Choreography: multi-component sequencing.
  if (/\b(choreograph|orchestrat|wave pattern|ripple effect|cascade|canon|converge)\b/i.test(text)) {
    steps.push({ tool: "choreograph", description: "Apply a choreographic pattern across all components" });
  }

  // Motion refinement: qualitative descriptors.
  if (/\b(snappier|smoother|more dramatic|calmer|subtler|more energetic|bouncier|softer)\b/i.test(text)) {
    steps.push({ tool: "refine_motion", description: "Refine motion with a qualitative descriptor" });
  }

  // Custom bezier easing.
  if (/\b(custom.*easing|bezier|cubic.bezier|easing curve|control point)\b/i.test(text)) {
    steps.push({ tool: "set_custom_bezier", description: "Set a custom cubic-bezier easing curve" });
  }

  // Keyframe interpolation.
  if (/\b(interpolation|linear.*keyframe|hold.*keyframe|step.*keyframe)\b/i.test(text)) {
    steps.push({ tool: "set_interpolation", description: "Set keyframe interpolation type" });
  }

  // Per-property keyframe editing.
  if (/\b(add.*keyframe|keyframe.*opacity|keyframe.*scale|keyframe.*position|keyframe.*offset)\b/i.test(text)) {
    steps.push({ tool: "add_property_keyframe", description: "Add a keyframe for a specific property" });
  }
  if (/\b(remove.*keyframe|delete.*keyframe)\b/i.test(text)) {
    steps.push({ tool: "remove_keyframe", description: "Remove a keyframe at a specific index" });
  }

  // Trigger settings.
  if (/\b(trigger|on click|on hover|on scroll|on load|after delay|play on|animate on)\b/i.test(text)) {
    if (firstId) {
      steps.push({ tool: "set_trigger", description: "Set the animation trigger type" });
    }
  }

  // Onion skinning.
  if (/\b(onion.*skin|ghost frame|motion trail|onion skinning|show.*trail)\b/i.test(text)) {
    steps.push({ tool: "set_onion_skin", description: "Toggle onion skinning on the canvas" });
  }

  // Fullscreen preview.
  if (/\b(fullscreen|full screen|present|present mode|preview.*full|big preview)\b/i.test(text)) {
    steps.push({ tool: "preview_fullscreen", description: "Open fullscreen preview mode" });
  }

  // Canvas view control.
  if (/\b(zoom\s*(in|out)|fit.*screen|frame.*select|reset.*view|pan\s*canvas)\b/i.test(text)) {
    steps.push({ tool: "set_canvas_view", description: "Adjust the canvas view (zoom, pan, or fit)" });
  }
  // Layer lock.
  if (/\b(lock|unlock)\b/i.test(text)) {
    if (firstId) steps.push({ tool: "lock_layer", description: "Toggle layer lock state" });
  }
  // Z-order.
  if (/\b(bring.*front|send.*back|move.*forward|move.*backward|to.?front|to.?back)\b/i.test(text)) {
    if (firstId) steps.push({ tool: "set_z_order", description: "Reorder layer z-position" });
  }
  // Transform props.
  if (/\b(set.*position|set.*x\b|set.*y\b|set.*width|set.*height|set.*rotation|rotate.*deg|resize.*to)\b/i.test(text)) {
    if (firstId) steps.push({ tool: "set_transform_props", description: "Set transform properties (X/Y/W/H/rotation)" });
  }
  // Align.
  if (/\b(align|distribute)\b/i.test(text)) {
    steps.push({ tool: "align_components", description: "Align or distribute selected components" });
  }
  // Playback range.
  if (/\b(playback.*range|set.*range|trim|loop.*range|clear.*range)\b/i.test(text)) {
    steps.push({ tool: "set_playback_range", description: "Set playback in/out range" });
  }
  // Select.
  if (/\b(select.*all|select.*everything|multi.?select)\b/i.test(text)) {
    steps.push({ tool: "select_components", description: "Select multiple components" });
  }
  // Snap.
  if (/\b(snap.*grid|toggle.*snap|magnet)\b/i.test(text)) {
    steps.push({ tool: "toggle_snap", description: "Toggle snap-to-grid" });
  }
  // Shape.
  if (/\b(add.*rectangle|add.*circle|add.*text|add.*triangle|add.*star|add.*pentagon|add.*polygon|add.*line|add.*arrow|create.*shape|create.*rectangle|create.*circle|create.*triangle|create.*star)\b/i.test(text)) {
    steps.push({ tool: "add_shape", description: "Add a shape to the canvas" });
  }
  // Blend mode.
  if (/\b(blend.*mode|mix.*blend|set.*blend|blend.*with)\b/i.test(text)) {
    steps.push({ tool: "set_blend_mode", description: "Set component blend mode" });
  }
  // Artboard.
  if (/\b(canvas|artboard|stage.*size|canvas.*size|canvas.*background|artboard.*size)\b/i.test(text)) {
    steps.push({ tool: "set_artboard", description: "Set artboard properties" });
  }
  // Layer opacity.
  if (/\b(set.*opacity|layer.*opacity|make.*transparent|opacity.*to)\b/i.test(text)) {
    if (firstId) steps.push({ tool: "set_layer_opacity", description: "Set layer opacity" });
  }
  // Rulers.
  if (/\b(ruler|toggle.*ruler|show.*ruler|hide.*ruler)\b/i.test(text)) {
    steps.push({ tool: "set_rulers", description: "Toggle canvas rulers" });
  }

  // Nudge component.
  if (/\b(nudge|move by|shift by|pixel.*move)\b/i.test(text)) {
    if (firstId) steps.push({ tool: "nudge_component", description: "Nudge the component by a pixel delta" });
  }
  // Clipboard: copy / paste.
  if (/\b(copy to clipboard|copy selection)\b/i.test(text)) {
    steps.push({ tool: "copy_to_clipboard", description: "Copy selection to clipboard" });
  }
  if (/\b(paste from clipboard|paste here|paste a copy)\b/i.test(text)) {
    steps.push({ tool: "paste_from_clipboard", description: "Paste from clipboard" });
  }
  // State machine: capture, apply, transition, list, remove.
  if (/\b(capture.*state|save.*state|snapshot)\b/i.test(text)) {
    steps.push({ tool: "capture_state", description: "Capture current state as a named snapshot" });
  }
  if (/\b(apply.*state|go to state|switch to state|restore state)\b/i.test(text)) {
    steps.push({ tool: "apply_state", description: "Apply a captured state" });
  }
  if (/\b(add transition|connect states|transition from)\b/i.test(text)) {
    steps.push({ tool: "add_transition", description: "Add a transition between states" });
  }
  if (/\b(remove state|delete state)\b/i.test(text)) {
    steps.push({ tool: "remove_state", description: "Remove a state from the state machine" });
  }
  if (/\b(list states|show states|what states|state machine info)\b/i.test(text)) {
    steps.push({ tool: "list_states", description: "List all states and transitions" });
  }

  // Auto-keyframe mode.
  if (/\b(auto.?keyframe|auto.?key|keyframe.*mode|record.*keyframe)\b/i.test(text)) {
    steps.push({ tool: "toggle_auto_keyframe", description: "Toggle auto-keyframe mode" });
  }
  // Event listeners.
  if (/\b(add.*listener|event listener|on.*trigger.*action|attach.*listener)\b/i.test(text)) {
    steps.push({ tool: "add_listener", description: "Add an event listener to a component" });
  }
  if (/\b(remove.*listener|delete.*listener)\b/i.test(text)) {
    steps.push({ tool: "remove_listener", description: "Remove an event listener" });
  }
  if (/\b(list.*listener|show.*listener|what.*listener)\b/i.test(text)) {
    steps.push({ tool: "list_listeners", description: "List event listeners" });
  }
  // Keyframe offset.
  if (/\b(move.*keyframe|retime.*keyframe|keyframe.*offset|shift.*keyframe)\b/i.test(text)) {
    if (firstId) steps.push({ tool: "set_keyframe_offset", description: "Move a keyframe to a new offset" });
  }
  // Markers.
  if (/\b(add.*marker|mark.*position|bookmark)\b/i.test(text)) {
    steps.push({ tool: "add_marker", description: "Add a timeline marker" });
  }
  if (/\b(remove.*marker|delete.*marker)\b/i.test(text)) {
    steps.push({ tool: "remove_marker", description: "Remove a timeline marker" });
  }
  if (/\b(list.*marker|show.*marker|what.*marker)\b/i.test(text)) {
    steps.push({ tool: "list_markers", description: "List timeline markers" });
  }
  // Reverse keyframes.
  if (/\b(reverse.*keyframes?|play.*backward|flip.*keyframes?)\b/i.test(text)) {
    if (firstId) steps.push({ tool: "reverse_keyframes", description: "Reverse keyframe order" });
  }
  // Z-index.
  if (/\b(bring.*forward|send.*backward|bring.*front|send.*back|move.*front|move.*back)\b/i.test(text)) {
    if (firstId) {
      const act = /\bfront\b/i.test(text) && !/\bforward\b/i.test(text) ? "to-front"
        : /\bback\b/i.test(text) && !/\bbackward\b/i.test(text) ? "to-back"
        : /\bforward\b/i.test(text) ? "forward" : "backward";
      steps.push({ tool: "set_z_order", description: `Move layer ${act}` });
    }
  }
  // Solo.
  if (/\b(solo|isolate)\b/i.test(text)) {
    if (firstId) steps.push({ tool: "solo_layer", description: "Solo this layer" });
  }

  // Hierarchy: parent/child/rig.
  if (/\b(parent|child|rig|bone|attach|nest|hierarchy)\b/i.test(text)) {
    const firstName = spec.components[0]?.name;
    if (/\b(list|show|tree)\b/i.test(text)) {
      steps.push({ tool: "list_hierarchy", description: "List the layer hierarchy tree" });
    } else if (/\b(detach|remove|orphan)\b/i.test(text) && firstId) {
      steps.push({ tool: "remove_parent", description: `Detach "${firstName}" from its parent` });
    } else if (firstId && spec.components.length > 1) {
      steps.push({ tool: "set_parent", description: `Set parent-child relationship` });
    }
  }

  // Constraints.
  if (/\b(constraint|constrain|pin|look.?at|follow)\b/i.test(text)) {
    if (/\b(list|show)\b/i.test(text)) {
      steps.push({ tool: "list_constraints", description: "List all constraints" });
    } else if (/\b(remove|delete)\b/i.test(text)) {
      steps.push({ tool: "remove_constraint", description: "Remove a constraint" });
    } else if (firstId) {
      steps.push({ tool: "add_constraint", description: "Add a constraint between components" });
    }
  }

  // Timeline clips.
  if (/\b(clip|segment|section)\b/i.test(text) && !/\bplayback range\b/i.test(text)) {
    if (/\b(list|show)\b/i.test(text)) {
      steps.push({ tool: "list_clips", description: "List all timeline clips" });
    } else if (/\b(play|trigger)\b/i.test(text)) {
      steps.push({ tool: "play_clip", description: "Play a timeline clip" });
    } else if (/\b(remove|delete)\b/i.test(text)) {
      steps.push({ tool: "remove_clip", description: "Remove a timeline clip" });
    } else {
      steps.push({ tool: "add_clip", description: "Add a timeline clip" });
    }
  }

  // CSS filters / shader effects.
  if (/\b(blur|brightness|contrast|hue|saturate|grayscale|sepia|filter|shader|effect)\b/i.test(text)) {
    const firstName = spec.components[0]?.name;
    if (firstId) steps.push({ tool: "set_filter", description: `Apply filter effect to "${firstName}"` });
  }

  // 3D transforms.
  if (/\b(3d|perspective|rotateX|rotateY|rotateZ|translateZ|three.?d)\b/i.test(text)) {
    const firstName = spec.components[0]?.name;
    if (firstId) steps.push({ tool: "set_3d_transform", description: `Apply 3D transform to "${firstName}"` });
  }

  // Restraint analysis: motion density check.
  if (/\b(too much|too many|restraint|density|overwhelm\w*|clutter\w*|visual noise|competing for attention|is this too busy)\b/i.test(text)) {
    steps.push({ tool: "analyze_restraint", description: "Analyze motion density and produce a restraint score" });
  }

  // Motion recipes: browse or apply.
  if (/\b(recipe|recipes|gentle entrance|impact reveal|elastic bounce|cinematic fade|data pulse|ambient float|typewriter reveal|magnetic hover)\b/i.test(text)) {
    if (/\b(apply|use|try)\b/i.test(text) && firstId) {
      steps.push({ tool: "apply_recipe", description: "Apply a curated motion recipe to the component" });
    } else {
      steps.push({ tool: "list_recipes", description: "Browse the curated motion recipe library" });
    }
  }

  // Project recipes: save, list, apply, seed, delete.
  if (/\b(save.*as.*recipe|save.*recipe|capture.*recipe)\b/i.test(text) && firstId) {
    steps.push({ tool: "save_project_recipe", description: "Capture the component's current motion as a reusable project recipe" });
  }
  if (/\b(seed.*recipe|load.*recipe.*preset|preset recipe)\b/i.test(text)) {
    steps.push({ tool: "seed_project_recipes", description: "Seed the project with built-in recipe presets" });
  }
  if (/\b(list.*my recipe|my recipe|project recipe|show.*project recipe)\b/i.test(text) && !/\b(apply|delete|remove)\b/i.test(text)) {
    steps.push({ tool: "list_project_recipes", description: "List saved project recipes" });
  }
  if (/\b(apply.*project recipe|use.*project recipe)\b/i.test(text) && firstId) {
    steps.push({ tool: "apply_project_recipe", description: "Apply a project recipe to the component" });
  }
  if (/\b(delete.*recipe|remove.*recipe)\b/i.test(text)) {
    steps.push({ tool: "delete_project_recipe", description: "Delete a project recipe" });
  }

  // Brand packs: list, apply, seed, delete.
  if (/\b(seed.*brand|load.*brand.*preset|brand.*preset)\b/i.test(text)) {
    steps.push({ tool: "seed_brand_packs", description: "Seed the project with built-in brand pack presets" });
  }
  if (/\b(list.*brand|show.*brand|brand.*pack|motion.*identity)\b/i.test(text) && !/\b(apply|delete|seed)\b/i.test(text)) {
    steps.push({ tool: "list_brand_packs", description: "List motion identity brand packs" });
  }
  if (/\b(apply.*brand|make.*everything.*like|use.*brand.*pack)\b/i.test(text)) {
    steps.push({ tool: "apply_brand_pack", description: "Apply a brand pack to align all components with a motion identity" });
  }
  if (/\b(delete.*brand|remove.*brand)\b/i.test(text)) {
    steps.push({ tool: "delete_brand_pack", description: "Delete a brand pack" });
  }

  // Motion profiles: set, suggest, list, apply.
  if (/\b(make.*hero|set.*hero|hero.*element|make.*background|set.*background|background.*component|make.*cta|set.*cta|cta.*element|set.*role)\b/i.test(text) && firstId) {
    steps.push({ tool: "set_motion_profile", description: "Set the component's motion personality profile" });
  }
  if (/\b(suggest.*profile|auto.*profile|what.*role.*should)\b/i.test(text) && firstId) {
    steps.push({ tool: "suggest_motion_profile", description: "Auto-suggest a motion profile for the component" });
  }
  if (/\b(list.*profile|show.*profile|list.*role|all.*profile)\b/i.test(text) && !/\b(apply|set|suggest)\b/i.test(text)) {
    steps.push({ tool: "list_motion_profiles", description: "List all motion profiles in the project" });
  }
  if (/\b(apply.*profile|tune.*based.*profile|match.*motion.*personality)\b/i.test(text) && firstId) {
    steps.push({ tool: "apply_motion_profile", description: "Apply the component's motion profile to its motion parameters" });
  }

  // Motion captures: save, list, apply, seed, delete.
  if (/\b(seed.*captures?|example.*captures?|example.*path|captures?.*example)/i.test(text)) {
    steps.push({ tool: "seed_motion_captures", description: "Seed the project with example motion captures" });
  }
  if (/\b(list.*captures?|show.*captures?|list.*path|what.*captures?)/i.test(text) && !/\b(apply|delete|seed|save)\b/i.test(text)) {
    steps.push({ tool: "list_motion_captures", description: "List all saved motion captures" });
  }
  if (/\b(save.*captures?|record.*cursor|record.*path|captures?.*gesture|captures?.*trajectory|draw.*path|draw.*motion)/i.test(text)) {
    steps.push({ tool: "save_motion_capture", description: "Save the recorded cursor trajectory as a motion capture" });
  }
  if (/\b(apply.*captures?|use.*captures?|trace.*motion|apply.*path)/i.test(text) && firstId) {
    steps.push({ tool: "apply_motion_capture", description: "Apply the motion capture to the selected component" });
  }
  if (/\b(delete.*captures?|remove.*captures?|discard.*captures?)/i.test(text)) {
    steps.push({ tool: "delete_motion_capture", description: "Delete the motion capture" });
  }

  // Export presets: list, recommend, apply.
  if (/\b(list.*export.*presets?|export.*options?|export.*presets?|what.*format|export.*format)/i.test(text) && !/\b(apply|recommend)\b/i.test(text)) {
    steps.push({ tool: "list_export_presets", description: "List all available smart export presets" });
  }
  if (/\b(recommend.*export|best.*export|what.*format.*should|how.*should.*export|which.*export)\b/i.test(text)) {
    steps.push({ tool: "recommend_export_format", description: "Recommend the best export format for the project" });
  }
  if (/\b(export.*for|export.*as|apply.*export.*presets?|make.*lottie|export.*instagram|export.*tiktok|export.*react|export.*vue|export.*email|export.*mobile|export.*figma|export.*embed|export.*social|export.*story|export.*square)/i.test(text)) {
    steps.push({ tool: "apply_export_preset", description: "Apply the matching export preset for the target platform" });
  }

  // Session lineage: save, list, resume, get lineage, delete.
  if (/\b(save.*sessions?|fork.*sessions?|snapshot.*conversation|remember.*branch)/i.test(text)) {
    steps.push({ tool: "save_session_snapshot", description: "Save a snapshot of the current conversation as a session lineage node" });
  }
  if (/\b(list.*sessions?|show.*sessions?|sessions?.*history|what.*conversation)/i.test(text) && !/\b(delete|resume|save|fork)\b/i.test(text)) {
    steps.push({ tool: "list_session_snapshots", description: "List all session snapshots in the project" });
  }
  if (/\b(resume.*sessions?|continue.*sessions?|pick.*up.*where)/i.test(text)) {
    steps.push({ tool: "resume_session_snapshot", description: "Resume a previously saved session with new activity" });
  }
  if (/\b(lineage.*tree|sessions?.*lineage|conversation.*tree|how.*sessions?.*relate|what.*came.*before)/i.test(text)) {
    steps.push({ tool: "get_session_lineage", description: "Get the full session lineage tree with ancestry and statistics" });
  }
  if (/\b(delete.*sessions?|remove.*branch|discard.*sessions?)/i.test(text)) {
    steps.push({ tool: "delete_session_snapshot", description: "Delete the session snapshot from the lineage" });
  }

  // Accessibility check.
  if (/\b(check.*accessibility|accessibility.*check|is.*safe|vestibular|seizure.*risk|flashing.*risk|strobing|reduced.*motion|WCAG|a11y|motion.*safety|safe.*motion|accessibility)/i.test(text)) {
    steps.push({ tool: "check_accessibility", description: "Analyze motion for accessibility and safety issues" });
  }

  // Performance check.
  if (/\b(check.*performance|performance.*check|frame.*budget|is.*performant|fps|jank|optimize.*performance|performance.*issue|perf.*check|render.*cost|animation.*cost)/i.test(text)) {
    steps.push({ tool: "check_performance", description: "Analyze motion for performance and frame budget issues" });
  }

  // Storyboard beat management.
  if (/\b(create.*beat|add.*beat|new.*beat|storyboard.*beat|story.*beat|beat.*titled|narrative.*beat)/i.test(text)) {
    steps.push({ tool: "create_beat", description: "Create a storyboard beat to sequence the narrative" });
  }
  if (/\b(list.*beats|show.*beats|storyboard.*overview|story.*outline|what.*beats|narrative.*outline|storyboard.*summary)/i.test(text)) {
    steps.push({ tool: "list_beats", description: "List all storyboard beats with cumulative timing" });
  }
  if (/\b(update.*beat|edit.*beat|rename.*beat|change.*beat|modify.*beat|adjust.*beat)/i.test(text)) {
    steps.push({ tool: "update_beat", description: "Update a storyboard beat's content or timing" });
  }
  if (/\b(reorder.*beats|rearrange.*beats|reorder.*story|resequence.*beats|shuffle.*beats|move.*beats)/i.test(text)) {
    steps.push({ tool: "reorder_beats", description: "Reorder storyboard beats into a new sequence" });
  }
  if (/\b(delete.*beat|remove.*beat|drop.*beat)/i.test(text)) {
    steps.push({ tool: "delete_beat", description: "Delete a storyboard beat from the sequence" });
  }
  if (/\b(export.*storyboard|storyboard.*export|story.*export|narrative.*export|storyboard.*markdown|storyboard.*json)/i.test(text)) {
    steps.push({ tool: "export_storyboard", description: "Export the storyboard as Markdown or JSON" });
  }

  // Persistent memory: save, recall, or list.
  if (/\b(remember this|save.*memory|save.*note)\b/i.test(text)) {
    steps.push({ tool: "save_memory", description: "Save a persistent memory entry for this project" });
  }
  if (/\b(recall.*memory|what did we decide|what do you know|search.*memory)\b/i.test(text)) {
    steps.push({ tool: "recall_memory", description: "Search persistent project memory" });
  }

  // Generated skills: list what the agent has learned.
  if (/\b(generated skill|learned skill|what have you learned|auto.?generated|show.*skills)\b/i.test(text)) {
    steps.push({ tool: "list_generated_skills", description: "List auto-generated skills from past sessions" });
  }

  // Motion grammar compilation
  if (/\b(grammar|compile.*motion|motion.*expression)\b/i.test(text) && firstId) {
    steps.push({ tool: "compile_grammar", description: "Compile motion grammar expression into motion specs" });
  }

  // Natural language motion parsing
  if (/\b(parse.*motion|make.*bounce|make.*fade|make.*slide|natural language motion|describe.*animation|translate.*motion)\b/i.test(text)) {
    if (firstId) {
      steps.push({ tool: "parse_motion", description: "Parse natural language description into motion spec" });
    } else {
      steps.push({ tool: "parse_motion", description: "Parse natural language description into motion spec (no component to apply)" });
    }
  }

  // Shader effects
  if (/\b(shader|glitch effect|chromatic aberration|neon glow|plasma|pixelate|vignette|film grain|ripple effect|gradient shift)\b/i.test(text) && firstId) {
    steps.push({ tool: "set_shader_effect", description: "Apply WebGL shader effect to component" });
  }

  // Version history: capture, list, restore, delete snapshots.
  if (/\b(save|capture|snapshot)\s+(?:a\s+)?(?:version|snapshot|state)\b/i.test(text)) {
    steps.push({ tool: "save_version", description: "Capture current project state as a named version snapshot" });
  }
  if (/\b(list|show|view)\s+(?:versions?|snapshots?|history)\b/i.test(text)) {
    steps.push({ tool: "list_versions", description: "List all saved version snapshots" });
  }
  if (/\b(restore|revert|roll\s*back|go\s*back\s*to)\s+(?:version|snapshot|state)\b/i.test(text)) {
    steps.push({ tool: "list_versions", description: "List versions before restore" });
    steps.push({ tool: "restore_version", description: "Restore project to a previously captured version" });
  }
  if (/\b(delete|remove)\s+(?:version|snapshot)\b/i.test(text)) {
    steps.push({ tool: "list_versions", description: "List versions before delete" });
    steps.push({ tool: "delete_version", description: "Delete a version snapshot" });
  }

  // Design tokens: save, list, update, delete reusable values.
  if (/\b(save|create|define|add)\s+(?:a\s+)?(?:token|design\s+token|duration\s+token|color\s+token|easing\s+token)\b/i.test(text)) {
    steps.push({ tool: "save_token", description: "Create or upsert a design token" });
  }
  if (/\b(list|show|view)\s+(?:tokens?|design\s+tokens?)\b/i.test(text)) {
    steps.push({ tool: "list_tokens", description: "List all design tokens" });
  }
  if (/\b(update|change|set)\s+(?:token|the\s+\w+\s+token)\b/i.test(text)) {
    steps.push({ tool: "list_tokens", description: "List tokens before update" });
    steps.push({ tool: "update_token", description: "Update an existing design token value" });
  }
  if (/\b(delete|remove)\s+(?:token|the\s+\w+\s+token)\b/i.test(text)) {
    steps.push({ tool: "list_tokens", description: "List tokens before delete" });
    steps.push({ tool: "delete_token", description: "Delete a design token" });
  }

  // Tool pipelines: save, list, run, delete reusable tool-call sequences.
  if (/\b(save|record|create)\s+(?:a\s+)?(?:pipeline|workflow|sequence|macro)\b/i.test(text)) {
    steps.push({ tool: "save_pipeline", description: "Save a named sequence of tool calls as a reusable pipeline" });
  }
  if (/\b(list|show|view)\s+(?:pipelines?|workflows?|sequences?|macros?)\b/i.test(text)) {
    steps.push({ tool: "list_pipelines", description: "List all saved tool pipelines" });
  }
  if (/\b(run|replay|apply|execute)\s+(?:a\s+)?(?:pipeline|workflow|sequence|macro)\b/i.test(text)) {
    steps.push({ tool: "list_pipelines", description: "List pipelines before run" });
    steps.push({ tool: "run_pipeline", description: "Replay a saved pipeline on the current project" });
  }
  if (/\b(delete|remove)\s+(?:pipeline|workflow|sequence|macro)\b/i.test(text)) {
    steps.push({ tool: "list_pipelines", description: "List pipelines before delete" });
    steps.push({ tool: "delete_pipeline", description: "Delete a saved pipeline" });
  }

  // Mood intelligence: analyze or set emotional character of motion.
  if (/\b(what|which)\s+(?:feeling|emotion|mood|vibe)\b/i.test(text) || /\b(analyze|describe)\s+(?:the\s+)?(?:mood|emotion|feeling|vibe)\b/i.test(text)) {
    steps.push({ tool: "analyze_mood", description: "Analyze the emotional character of the current motion" });
  }
  if (/\b(make|set|give|apply)\s+(?:it|everything|this|all|the\s+\w+)?\s*(?:feel|vibe|mood)\s+/i.test(text) || /\b(premium|playful|calm|energetic|dramatic|minimal|confident|gentle|urgent|nostalgic)\s+(?:mood|vibe|feel|aesthetic)\b/i.test(text)) {
    steps.push({ tool: "set_mood", description: "Apply a mood profile to translate emotional language into motion parameters" });
  }

  // Creative suggestions: context-aware next-step ideas with surprise mode.
  if (/\b(surprise|creative|inspire|ideas?|suggest)\s+(?:me\s+)?/i.test(text) || /\bwhat\s+(?:should|could|would|can)\s+i\b/i.test(text)) {
    const wantsSurprise = /\bsurprise\b/i.test(text);
    steps.push({ tool: "suggest_creative", description: wantsSurprise ? "Generate creative surprise suggestions" : "Generate context-aware creative suggestions" });
  }

  // Visual context analysis: spatial layout review.
  if (/\b(visual.*context|layout.*balance|canvas.*look|composition.*review|visual.*review|spatial.*layout|visual.*balance|check.*layout|visual.*layout|how.*canvas.*look)\b/i.test(text)) {
    steps.push({ tool: "analyze_visual_context", description: "Analyze the canvas layout — balance, spacing, hierarchy, color, overlaps, alignment" });
  }

  // Code synthesis: generate standalone animation code.
  if (/\b(generate.*code|synthesize.*code|write.*code|give me.*css|give me.*react|give me.*html|give me.*javascript|code.*snippet|animation.*code|css.*for.*animation|react.*component.*animation|copy.*paste.*code)\b/i.test(text)) {
    const descMatch = userMessage.match(/\b(?:for|of)\s+(?:a|an)?\s*([\w][\w\s-]*?)(?:\s+animation|\s+effect|\s+motion|\s*$)/i);
    const description = descMatch ? descMatch[1] : "bounce in";
    const format = /react/i.test(text) ? "react" : /html/i.test(text) ? "html" : /javascript|js|vanilla/i.test(text) ? "vanilla" : "css";
    steps.push({ tool: "synthesize_code", description: `Generate ${format} code for a ${description} animation` });
  }

  // State machine composer.
  if (/\b(list|show|what)\b.*\bstate.*machines?\b/i.test(text)) {
    steps.push({ tool: "list_state_machines", description: "List all state machines in the project" });
  } else if (/\b(hover.*press|press.*hover)\b/i.test(text)) {
    steps.push({ tool: "compose_state_machine", description: "Compose a hover-press state machine (idle, hover, pressed states)" });
  } else if (/\btoggle\b/i.test(text) && /\b(state|on.*off)\b/i.test(text)) {
    steps.push({ tool: "compose_state_machine", description: "Compose a toggle state machine (on/off states)" });
  } else if (/\bloading\b/i.test(text) && /\b(flow|sequence|state)\b/i.test(text)) {
    steps.push({ tool: "compose_state_machine", description: "Compose a loading flow state machine (idle, loading, success, error)" });
  } else if (/\bcarousel\b/i.test(text)) {
    steps.push({ tool: "compose_state_machine", description: "Compose a carousel state machine with slide states" });
  } else if (/\btab.*(switch|navigation)\b/i.test(text)) {
    steps.push({ tool: "compose_state_machine", description: "Compose a tab switch state machine" });
  } else if (/\b(trigger|switch|transition|go to)\b.*\bstate\b/i.test(text) && !/\bcompose|create|build|add\b/i.test(text)) {
    steps.push({ tool: "trigger_state_machine", description: "Transition the state machine to a target state" });
  }

  // Get spec.
  if (/\b(spec|state|current|status)\b/i.test(text)) {
    steps.push({ tool: "get_motion_spec", description: "Read the current motion spec" });
  }

  // Fallback: classify the intent and produce a generic step.
  if (steps.length === 0) {
    const intent = classifyIntent(userMessage);
    if (intent !== "unknown") {
      steps.push({
        tool: "get_motion_spec",
        description: "Inspect the current state before making changes",
      });
    } else {
      steps.push({
        tool: "get_motion_spec",
        description: "Review the project and respond to the request",
      });
    }
  }

  const summary =
    steps.length === 1
      ? steps[0].description
      : `${steps.length} steps: ${steps.map((s) => s.description).join(", then ")}`;

  return { steps, summary };
}
