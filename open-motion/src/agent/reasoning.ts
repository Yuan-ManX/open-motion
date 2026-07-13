import type { MotionSpec, Easing } from "@openmotion/shared";

/**
 * Structured thinking trace produced before plan generation.
 * The agent analyzes the request, evaluates constraints, considers
 * multiple approaches, and commits to one — surfacing the reasoning
 * to the user so the agent's decision process is transparent.
 */
export interface ThinkingTrace {
  text: string;
  analysis: string;
  constraints: string[];
  options: { approach: string; tradeoffs: string }[];
  chosenApproach: string;
}

interface EasingProfile {
  family: string;
  bouncy: boolean;
  smooth: boolean;
  snappy: boolean;
}

function profileEasing(easing: Easing): EasingProfile {
  if (easing.type === "preset") {
    const n = easing.name.toLowerCase();
    return {
      family: easing.name,
      bouncy: /bounce|elastic|back|spring/.test(n),
      smooth: /smooth|ease-in-out|ease-out/.test(n),
      snappy: /snappy|ease-in|linear/.test(n),
    };
  }
  if (easing.type === "spring") return { family: "spring", bouncy: true, smooth: false, snappy: false };
  return { family: "bezier", bouncy: false, smooth: true, snappy: false };
}

function countInfiniteLoops(spec: MotionSpec): number {
  return spec.components.filter((c) => c.iterationCount === "infinite").length;
}

function countSimultaneous(spec: MotionSpec): number {
  return spec.components.filter((c) => c.delayMs < 200 && c.playState === "running").length;
}

function detectEasingMonotony(spec: MotionSpec): boolean {
  if (spec.components.length < 3) return false;
  const families = new Set(spec.components.map((c) => profileEasing(c.easing).family));
  return families.size === 1;
}

/**
 * Rule-based reasoning engine. Analyzes the user message against the
 * current spec state to produce a structured thinking trace. Works
 * without an LLM so mock mode stays fully functional.
 */
export function think(userMessage: string, spec: MotionSpec): ThinkingTrace {
  const text = userMessage.toLowerCase();
  const analysis = analyzeRequest(text, spec);
  const constraints = evaluateConstraints(text, spec);
  const options = considerOptions(text, spec, constraints);
  const chosenApproach = selectApproach(text, options, spec);

  const traceText = buildTraceText(analysis, constraints, options, chosenApproach);

  return {
    text: traceText,
    analysis,
    constraints,
    options,
    chosenApproach,
  };
}

function analyzeRequest(text: string, spec: MotionSpec): string {
  const parts: string[] = [];

  if (/\b(create|make|build|add|generate|design)\b/.test(text)) {
    const hasLayer = /\b(layer|element|component)\b/.test(text);
    const hasAnimation = /\b(animation|effect|motion|transition)\b/.test(text);
    if (hasLayer || hasAnimation) {
      parts.push(`User wants to create a new ${hasAnimation ? "animation" : "layer"}.`);
    }
  }

  if (/\b(bouncy|smooth|snappy|elastic|spring|dramatic|calm|energetic|playful)\b/.test(text)) {
    const feel = text.match(/\b(bouncy|smooth|snappy|elastic|spring|dramatic|calm|energetic|playful)\b/i)?.[1];
    parts.push(`Tactile feel requested: ${feel}. This maps to an easing family change.`);
  }

  if (/\b(slower|faster|duration|quick|slow)\b/.test(text)) {
    parts.push("Timing adjustment requested — will modify duration.");
  }

  if (/\b(loop|repeat|forever)\b/.test(text)) {
    parts.push("Loop behavior requested — will set iteration count.");
  }

  if (/\b(color|red|blue|green|purple|background)\b/.test(text)) {
    parts.push("Visual style (color) change requested.");
  }

  if (/\b(stagger|cascade|choreograph|sequence|wave|ripple)\b/.test(text)) {
    parts.push(`Multi-component choreography requested across ${spec.components.length} component(s).`);
  }

  if (/\b(analyze|review|critique|quality|pattern|restraint)\b/.test(text)) {
    parts.push("Analytical request — will inspect and report on motion quality.");
  }

  if (/\b(export|download|render|package)\b/.test(text)) {
    parts.push("Export/delivery request — will produce an output artifact.");
  }

  if (/\b(shader|glitch|neon|plasma|chromatic)\b/.test(text)) {
    parts.push("Shader/visual effect requested — will apply a WebGL effect.");
  }

  if (/\b(3d|perspective|rotateX|rotateY)\b/.test(text)) {
    parts.push("3D transform requested — will apply perspective and depth.");
  }

  if (parts.length === 0) {
    parts.push(`Evaluating request against current project "${spec.project.name}" with ${spec.components.length} component(s).`);
  }

  parts.push(`Current state: ${spec.components.length} component(s), ${countInfiniteLoops(spec)} infinite loop(s), ${countSimultaneous(spec)} near-simultaneous start(s).`);

  return parts.join(" ");
}

function evaluateConstraints(text: string, spec: MotionSpec): string[] {
  const constraints: string[] = [];

  const infiniteLoops = countInfiniteLoops(spec);
  const simultaneous = countSimultaneous(spec);

  if (infiniteLoops >= 3 && !/\b(stop|remove.*loop|once|single)\b/.test(text)) {
    constraints.push(`Restraint budget: ${infiniteLoops} components loop infinitely — adding more motion risks visual overload.`);
  }

  if (simultaneous >= 4) {
    constraints.push(`${simultaneous} components start within 200ms — consider staggering to reduce attention competition.`);
  }

  if (detectEasingMonotony(spec) && spec.components.length >= 3) {
    constraints.push("Easing monotony detected: all components share one easing family. Varying easing improves rhythm.");
  }

  if (/\b(accessib|reduced motion|vestibular|prefers-reduced)\b/.test(text)) {
    constraints.push("Accessibility: user mentioned reduced-motion — large-scale or parallax motion should be gated.");
  }

  if (/\b(fast|quick|snappy)\b/.test(text) && spec.components.some((c) => c.durationMs < 200)) {
    constraints.push("Some durations are already under 200ms — going faster may cause jank or be imperceptible.");
  }

  if (spec.components.length === 0) {
    constraints.push("Empty project — must add a component before any tuning is possible.");
  }

  if (spec.components.length > 12) {
    constraints.push(`Dense scene (${spec.components.length} components) — restraint budget is tight.`);
  }

  return constraints;
}

function considerOptions(text: string, spec: MotionSpec, constraints: string[]): { approach: string; tradeoffs: string }[] {
  const options: { approach: string; tradeoffs: string }[] = [];
  const hasComponents = spec.components.length > 0;

  if (/\b(bouncy|smooth|snappy|elastic|spring)\b/.test(text) && hasComponents) {
    options.push({
      approach: "Adjust easing on the first component only",
      tradeoffs: "Fast, surgical change. Other components keep their feel — may create easing inconsistency.",
    });
    if (spec.components.length > 1) {
      options.push({
        approach: "Apply easing to all components via batch_update",
        tradeoffs: "Coherent feel across the scene. Higher blast radius — affects motion the user did not mention.",
      });
    }
  }

  if (/\b(stagger|cascade|choreograph)\b/.test(text) && spec.components.length > 1) {
    options.push({
      approach: "Apply stagger with forward direction",
      tradeoffs: "Natural entrance order. Predictable but less dynamic than center-out.",
    });
    options.push({
      approach: "Apply choreograph with wave pattern",
      tradeoffs: "More organic rhythm. Slightly harder to predict timing for individual layers.",
    });
  }

  if (/\b(slower|faster|duration)\b/.test(text) && hasComponents) {
    options.push({
      approach: "Change duration on the primary component",
      tradeoffs: "Targeted timing shift. Project total duration stays as-is.",
    });
    options.push({
      approach: "Adjust global timing via set_global_timing",
      tradeoffs: "Rescales the whole project. Good for tempo changes, bad for per-element tuning.",
    });
  }

  if (/\b(export|download|render)\b/.test(text)) {
    options.push({
      approach: "Export as standalone HTML",
      tradeoffs: "Self-contained, opens in any browser. Larger file, no code reusability.",
    });
    options.push({
      approach: "Export as CSS code snippet",
      tradeoffs: "Lightweight, drops into existing projects. Requires manual integration.",
    });
    options.push({
      approach: "Export as React component",
      tradeoffs: "Framework-native for React apps. Less portable to non-React contexts.",
    });
  }

  if (constraints.some((c) => c.includes("Restraint budget")) && !/\b(remove|delete|simplif)\b/.test(text)) {
    options.push({
      approach: "Proceed with the requested addition despite restraint warning",
      tradeoffs: "Fulfills the literal request. May push the scene past healthy motion density.",
    });
    options.push({
      approach: "Suggest simplifying existing motion first",
      tradeoffs: "Keeps restraint budget healthy. Slower — requires a second conversational turn.",
    });
  }

  if (options.length === 0) {
    options.push({
      approach: "Execute the direct matching tool for the request",
      tradeoffs: "Minimal surface area. May miss opportunities for a more coherent result.",
    });
  }

  return options;
}

function selectApproach(text: string, options: { approach: string; tradeoffs: string }[], spec: MotionSpec): string {
  if (options.length === 0) return "Execute the direct matching tool.";

  // Prefer batch/coherent approaches when the user says "all" or "everything".
  if (/\b(all|every|each|whole|entire|project)\b/.test(text)) {
    const batch = options.find((o) => /batch|global|all components/i.test(o.approach));
    if (batch) return batch.approach;
  }

  // Prefer restraint-preserving approaches when the budget is tight.
  if (/\b(calm|subtle|minimal|gentle|soft)\b/.test(text)) {
    const gentle = options.find((o) => /simplif|stagger|wave|gentle/i.test(o.approach));
    if (gentle) return gentle.approach;
  }

  // Prefer the first option (most targeted) by default.
  return options[0].approach;
}

function buildTraceText(
  analysis: string,
  constraints: string[],
  options: { approach: string; tradeoffs: string }[],
  chosen: string,
): string {
  const lines: string[] = [];
  lines.push(`Analysis: ${analysis}`);
  if (constraints.length > 0) {
    lines.push(`Constraints: ${constraints.join(" ")}`);
  }
  if (options.length > 1) {
    lines.push(`Considered ${options.length} approaches: ${options.map((o) => o.approach).join("; ")}.`);
  }
  lines.push(`Chosen: ${chosen}.`);
  return lines.join(" ");
}
