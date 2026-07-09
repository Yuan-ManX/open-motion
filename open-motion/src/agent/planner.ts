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
