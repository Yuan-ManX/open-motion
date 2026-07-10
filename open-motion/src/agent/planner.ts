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
