/**
 * Motion Negotiation — when a user's intent conflicts with accessibility,
 * persona, or restraint constraints, this module finds a compromise that
 * preserves the user's creative direction while satisfying the constraints.
 *
 * This is the eleventh original AI-native module. Where Auto-Fix remediates
 * existing motion after the fact, Negotiation intervenes at intent time:
 * before the user's request becomes a spec, it negotiates a middle ground.
 *
 * Example: a user asks for "a really fast spin with bright rainbow flashing".
 * Auto-Fix would later cap the rotation and stretch the flashing. Negotiation
 * instead proposes upfront: "a swift spin (within vestibular limits) with a
 * smooth color cycle (within photosensitivity limits) — preserving the energy
 * you want while keeping it safe."
 *
 * The negotiation is rule-based and runs without an LLM round-trip.
 */

import type { MotionComponent, MotionSpec, Easing } from "@openmotion/shared";
import { easingPreset } from "../shared/motion/easing.js";

/** A constraint profile defines the upper bounds the negotiation must respect. */
export interface ConstraintProfile {
  /** Maximum animation duration in ms. */
  maxDurationMs: number;
  /** Minimum animation duration in ms (below this is too fast). */
  minDurationMs: number;
  /** Maximum translateX/translateY magnitude in px. */
  maxDisplacementPx: number;
  /** Maximum rotation magnitude in degrees. */
  maxRotationDeg: number;
  /** Maximum scale factor (1 = no scale, 2 = double size). */
  maxScale: number;
  /** Maximum opacity delta (0..1). */
  maxOpacityDelta: number;
  /** Easings that are forbidden under this profile. */
  forbiddenEasings: string[];
  /** Easings preferred under this profile. */
  preferredEasings: string[];
  /** Maximum loop iteration count (use a finite number to cap infinite loops). */
  maxLoops: number;
  /** Maximum number of components that may animate simultaneously. */
  maxConcurrentAnimations: number;
  /** Profile name for display. */
  name: string;
}

/** Built-in constraint profiles for common contexts. */
export const CONSTRAINT_PROFILES: Record<string, ConstraintProfile> = {
  "vestibular-safe": {
    name: "Vestibular-Safe",
    maxDurationMs: 1200,
    minDurationMs: 300,
    maxDisplacementPx: 100,
    maxRotationDeg: 90,
    maxScale: 1.5,
    maxOpacityDelta: 1,
    forbiddenEasings: ["bounce", "elastic", "back"],
    preferredEasings: ["smooth", "soft", "ease-in-out"],
    maxLoops: 3,
    maxConcurrentAnimations: 4,
  },
  "photosensitivity-safe": {
    name: "Photosensitivity-Safe",
    maxDurationMs: 2000,
    minDurationMs: 500, // Slower than 3Hz threshold
    maxDisplacementPx: 200,
    maxRotationDeg: 180,
    maxScale: 2,
    maxOpacityDelta: 0.5, // No full opacity flashing
    forbiddenEasings: ["linear", "bounce"],
    preferredEasings: ["smooth", "soft", "ease-in-out"],
    maxLoops: 5,
    maxConcurrentAnimations: 6,
  },
  "cognitive-safe": {
    name: "Cognitive-Safe",
    maxDurationMs: 1500,
    minDurationMs: 400,
    maxDisplacementPx: 150,
    maxRotationDeg: 120,
    maxScale: 1.8,
    maxOpacityDelta: 0.8,
    forbiddenEasings: ["bounce", "elastic"],
    preferredEasings: ["smooth", "ease-in-out", "ease-out"],
    maxLoops: 3,
    maxConcurrentAnimations: 3,
  },
  "reduced-motion": {
    name: "Reduced-Motion",
    maxDurationMs: 800,
    minDurationMs: 200,
    maxDisplacementPx: 30,
    maxRotationDeg: 30,
    maxScale: 1.1,
    maxOpacityDelta: 1,
    forbiddenEasings: ["bounce", "elastic", "back", "spring"],
    preferredEasings: ["smooth", "soft", "ease-out"],
    maxLoops: 1,
    maxConcurrentAnimations: 2,
  },
  "unconstrained": {
    name: "Unconstrained",
    maxDurationMs: 10000,
    minDurationMs: 50,
    maxDisplacementPx: 5000,
    maxRotationDeg: 1440,
    maxScale: 10,
    maxOpacityDelta: 1,
    forbiddenEasings: [],
    preferredEasings: [],
    maxLoops: 1000,
    maxConcurrentAnimations: 100,
  },
};

/** A parsed user intent — what the user wants, abstracted to axes. */
export interface IntentParse {
  /** Original intent string. */
  rawIntent: string;
  /** Detected speed axis. */
  speed?: "very-slow" | "slow" | "normal" | "fast" | "very-fast";
  /** Detected intensity axis. */
  intensity?: "subtle" | "moderate" | "bold" | "extreme";
  /** Whether the user wants looping animation. */
  looping?: boolean;
  /** Detected color intensity axis. */
  colorIntensity?: "monochrome" | "muted" | "vibrant" | "neon";
  /** Detected complexity axis. */
  complexity?: "minimal" | "simple" | "rich" | "maximal";
  /** Phrases that triggered extreme-axis detection. */
  extremeSignals: string[];
}

/** A single trade-off made during negotiation. */
export interface NegotiationTradeoff {
  /** Which axis was negotiated. */
  axis: string;
  /** What the user wanted on this axis. */
  userWanted: string;
  /** Which constraint forced the negotiation. */
  constraint: string;
  /** What the negotiation settled on. */
  negotiated: string;
  /** Why this compromise was chosen. */
  reason: string;
}

/** The result of a negotiation pass. */
export interface NegotiationResult {
  /** Original user intent. */
  intent: string;
  /** Parsed intent axes. */
  parsedIntent: IntentParse;
  /** Constraint profile used. */
  constraintProfile: ConstraintProfile;
  /** Trade-offs made. */
  tradeoffs: NegotiationTradeoff[];
  /** The negotiated spec — what would be applied if the user accepts. */
  negotiatedSpec: MotionSpec;
  /** How well the negotiated spec satisfies the constraint profile (0..100). */
  complianceScore: number;
  /** How well the negotiated spec preserves the user's original intent (0..100). */
  intentFidelityScore: number;
  /** Whether the user's intent could be fully satisfied without negotiation. */
  intentWasCompatible: boolean;
  /** Human-readable summary. */
  summary: string;
}

/** Normalize a string for keyword matching. */
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Parse a natural-language intent into structured axes. */
export function parseIntent(intent: string): IntentParse {
  const msg = norm(intent);
  const extremeSignals: string[] = [];

  // Speed detection.
  let speed: IntentParse["speed"] = "normal";
  if (has(msg, "really fast", "super fast", "very fast", "extremely fast", "lightning", "instant", "blazing")) {
    speed = "very-fast";
    extremeSignals.push(findPhrase(msg, ["really fast", "super fast", "very fast", "extremely fast", "lightning", "instant", "blazing"]) ?? "very fast");
  } else if (has(msg, "fast", "quick", "rapid", "swift", "snappy")) {
    speed = "fast";
  } else if (has(msg, "really slow", "very slow", "extremely slow", "glacial", "crawling")) {
    speed = "very-slow";
    extremeSignals.push(findPhrase(msg, ["really slow", "very slow", "extremely slow", "glacial", "crawling"]) ?? "very slow");
  } else if (has(msg, "slow", "gradual", "unhurried")) {
    speed = "slow";
  }

  // Intensity detection.
  let intensity: IntentParse["intensity"] = "moderate";
  if (has(msg, "extreme", "maximum", "intense", "violent", "explosive", "extreme intensity")) {
    intensity = "extreme";
    extremeSignals.push(findPhrase(msg, ["extreme", "maximum", "intense", "violent", "explosive"]) ?? "extreme");
  } else if (has(msg, "bold", "strong", "dramatic", "powerful")) {
    intensity = "bold";
  } else if (has(msg, "subtle", "gentle", "soft", "whisper", "hint")) {
    intensity = "subtle";
  }

  // Looping detection.
  const looping = has(msg, "loop", "infinite", "forever", "continuous", "endless", "repeating");

  // Color intensity detection.
  let colorIntensity: IntentParse["colorIntensity"] = "vibrant";
  if (has(msg, "rainbow", "neon", "psychedelic", "saturated", "ultra-bright")) {
    colorIntensity = "neon";
    extremeSignals.push(findPhrase(msg, ["rainbow", "neon", "psychedelic", "saturated", "ultra-bright"]) ?? "neon");
  } else if (has(msg, "monochrome", "grayscale", "black and white", "single color")) {
    colorIntensity = "monochrome";
  } else if (has(msg, "muted", "pastel", "soft color", "faded")) {
    colorIntensity = "muted";
  }

  // Complexity detection.
  let complexity: IntentParse["complexity"] = "simple";
  if (has(msg, "lots of", "many", "complex", "elaborate", "maximalist", "everything", "all the")) {
    complexity = "maximal";
    extremeSignals.push(findPhrase(msg, ["lots of", "many", "complex", "elaborate", "maximalist", "everything", "all the"]) ?? "maximalist");
  } else if (has(msg, "rich", "layered", "detailed", "intricate")) {
    complexity = "rich";
  } else if (has(msg, "minimal", "simple", "clean", "sparse")) {
    complexity = "minimal";
  }

  return {
    rawIntent: intent,
    speed,
    intensity,
    looping,
    colorIntensity,
    complexity,
    extremeSignals,
  };
}

/** Check if a message contains any of the keywords. */
function has(msg: string, ...keywords: string[]): boolean {
  return keywords.some((k) => msg.includes(k));
}

/** Find which phrase from a list appears in a message. */
function findPhrase(msg: string, phrases: string[]): string | null {
  for (const phrase of phrases) {
    if (msg.includes(phrase)) return phrase;
  }
  return null;
}

/** Map a speed axis to a target duration. */
function speedToDuration(speed: IntentParse["speed"]): number {
  switch (speed) {
    case "very-fast": return 150;
    case "fast": return 300;
    case "normal": return 600;
    case "slow": return 1200;
    case "very-slow": return 2400;
    default: return 600;
  }
}

/** Map an intensity axis to a target displacement magnitude. */
function intensityToDisplacement(intensity: IntentParse["intensity"]): number {
  switch (intensity) {
    case "subtle": return 15;
    case "moderate": return 60;
    case "bold": return 150;
    case "extreme": return 400;
    default: return 60;
  }
}

/** Map an intensity axis to a target rotation magnitude. */
function intensityToRotation(intensity: IntentParse["intensity"]): number {
  switch (intensity) {
    case "subtle": return 10;
    case "moderate": return 45;
    case "bold": return 180;
    case "extreme": return 720;
    default: return 45;
  }
}

/** Map an intensity axis to a target scale factor. */
function intensityToScale(intensity: IntentParse["intensity"]): number {
  switch (intensity) {
    case "subtle": return 1.05;
    case "moderate": return 1.2;
    case "bold": return 1.6;
    case "extreme": return 3;
    default: return 1.2;
  }
}

/** Map a color intensity axis to a target opacity delta. */
function colorToIntensityDelta(color: IntentParse["colorIntensity"]): number {
  switch (color) {
    case "monochrome": return 0.3;
    case "muted": return 0.5;
    case "vibrant": return 0.8;
    case "neon": return 1.0;
    default: return 0.8;
  }
}

/** Map a complexity axis to a target number of concurrent animations. */
function complexityToConcurrency(complexity: IntentParse["complexity"]): number {
  switch (complexity) {
    case "minimal": return 1;
    case "simple": return 2;
    case "rich": return 5;
    case "maximal": return 12;
    default: return 2;
  }
}

/** Pick the best easing given the user's intent and the constraint profile. */
function pickEasing(parsed: IntentParse, profile: ConstraintProfile): Easing {
  // If the user wants very fast / extreme, default to snappy — but check if forbidden.
  const wantedEasings: string[] = [];
  if (parsed.speed === "very-fast" || parsed.speed === "fast") wantedEasings.push("snappy");
  if (parsed.intensity === "extreme" || parsed.intensity === "bold") wantedEasings.push("bounce", "elastic");
  if (parsed.speed === "slow" || parsed.speed === "very-slow") wantedEasings.push("smooth", "soft");
  if (parsed.intensity === "subtle") wantedEasings.push("soft");

  // Find the first wanted easing that isn't forbidden.
  for (const name of wantedEasings) {
    if (!profile.forbiddenEasings.includes(name)) {
      return easingPreset(name as never);
    }
  }
  // Fall back to the first preferred easing.
  if (profile.preferredEasings.length > 0) {
    return easingPreset(profile.preferredEasings[0] as never);
  }
  // Final fallback.
  return easingPreset("ease-out");
}

/** Deep-clone a component. */
function cloneComponent(comp: MotionComponent): MotionComponent {
  return {
    ...comp,
    keyframes: comp.keyframes.map((kf) => ({
      ...kf,
      properties: { ...kf.properties },
      easing: kf.easing ? { ...kf.easing } : undefined,
    })),
    easing: { ...comp.easing },
    style: { ...comp.style },
  };
}

/**
 * Negotiate a user's intent against a constraint profile. Returns a new spec
 * where each component has been adjusted to satisfy the constraints while
 * preserving as much of the user's intent as possible.
 *
 * If the existing spec already has components, they are renegotiated. If the
 * spec is empty, a single new component is created from the intent.
 */
export function negotiateIntent(
  intent: string,
  spec: MotionSpec,
  profile: ConstraintProfile,
): NegotiationResult {
  const parsed = parseIntent(intent);
  const tradeoffs: NegotiationTradeoff[] = [];

  // Compute target values from intent.
  const targetDuration = speedToDuration(parsed.speed);
  const targetDisplacement = intensityToDisplacement(parsed.intensity);
  const targetRotation = intensityToRotation(parsed.intensity);
  const targetScale = intensityToScale(parsed.intensity);
  const targetOpacityDelta = colorToIntensityDelta(parsed.colorIntensity);
  const targetConcurrency = complexityToConcurrency(parsed.complexity);
  const targetEasing = pickEasing(parsed, profile);

  // Negotiate duration.
  let negotiatedDuration = targetDuration;
  if (targetDuration < profile.minDurationMs) {
    negotiatedDuration = profile.minDurationMs;
    tradeoffs.push({
      axis: "duration",
      userWanted: `${targetDuration}ms (very fast)`,
      constraint: `${profile.name} requires minimum ${profile.minDurationMs}ms`,
      negotiated: `${negotiatedDuration}ms`,
      reason: "Below this threshold the animation is too fast for safe perception.",
    });
  } else if (targetDuration > profile.maxDurationMs) {
    negotiatedDuration = profile.maxDurationMs;
    tradeoffs.push({
      axis: "duration",
      userWanted: `${targetDuration}ms (very slow)`,
      constraint: `${profile.name} caps duration at ${profile.maxDurationMs}ms`,
      negotiated: `${negotiatedDuration}ms`,
      reason: "Longer durations exceed the profile's attention budget.",
    });
  }

  // Negotiate displacement.
  let negotiatedDisplacement = targetDisplacement;
  if (targetDisplacement > profile.maxDisplacementPx) {
    negotiatedDisplacement = profile.maxDisplacementPx;
    tradeoffs.push({
      axis: "displacement",
      userWanted: `${targetDisplacement}px (${parsed.intensity})`,
      constraint: `${profile.name} caps displacement at ${profile.maxDisplacementPx}px`,
      negotiated: `${negotiatedDisplacement}px`,
      reason: "Larger displacements risk vestibular discomfort under this profile.",
    });
  }

  // Negotiate rotation.
  let negotiatedRotation = targetRotation;
  if (targetRotation > profile.maxRotationDeg) {
    negotiatedRotation = profile.maxRotationDeg;
    tradeoffs.push({
      axis: "rotation",
      userWanted: `${targetRotation}deg (${parsed.intensity})`,
      constraint: `${profile.name} caps rotation at ${profile.maxRotationDeg}deg`,
      negotiated: `${negotiatedRotation}deg`,
      reason: "Larger rotations risk vestibular discomfort under this profile.",
    });
  }

  // Negotiate scale.
  let negotiatedScale = targetScale;
  if (targetScale > profile.maxScale) {
    negotiatedScale = profile.maxScale;
    tradeoffs.push({
      axis: "scale",
      userWanted: `${targetScale}x (${parsed.intensity})`,
      constraint: `${profile.name} caps scale at ${profile.maxScale}x`,
      negotiated: `${negotiatedScale}x`,
      reason: "Larger scale changes can disorient under this profile.",
    });
  }

  // Negotiate opacity delta.
  let negotiatedOpacityDelta = targetOpacityDelta;
  if (targetOpacityDelta > profile.maxOpacityDelta) {
    negotiatedOpacityDelta = profile.maxOpacityDelta;
    tradeoffs.push({
      axis: "opacity",
      userWanted: `${targetOpacityDelta} delta (${parsed.colorIntensity})`,
      constraint: `${profile.name} caps opacity delta at ${profile.maxOpacityDelta}`,
      negotiated: `${negotiatedOpacityDelta}`,
      reason: "Full opacity flashing risks photosensitive seizures under this profile.",
    });
  }

  // Negotiate easing.
  let negotiatedEasing = targetEasing;
  if (targetEasing.type === "preset" && profile.forbiddenEasings.includes(targetEasing.name)) {
    negotiatedEasing = profile.preferredEasings.length > 0
      ? easingPreset(profile.preferredEasings[0] as never)
      : easingPreset("ease-out");
    tradeoffs.push({
      axis: "easing",
      userWanted: targetEasing.name,
      constraint: `${profile.name} forbids ${profile.forbiddenEasings.join(", ")}`,
      negotiated: negotiatedEasing.type === "preset" ? negotiatedEasing.name : "ease-out",
      reason: "This easing can trigger discomfort under the profile.",
    });
  }

  // Negotiate concurrency.
  let negotiatedConcurrency = targetConcurrency;
  if (targetConcurrency > profile.maxConcurrentAnimations) {
    negotiatedConcurrency = profile.maxConcurrentAnimations;
    tradeoffs.push({
      axis: "concurrency",
      userWanted: `${targetConcurrency} simultaneous`,
      constraint: `${profile.name} caps concurrency at ${profile.maxConcurrentAnimations}`,
      negotiated: `${negotiatedConcurrency}`,
      reason: "More simultaneous animations increase cognitive load under this profile.",
    });
  }

  // Negotiate loops.
  let negotiatedLoops: number = parsed.looping ? profile.maxLoops : 1;
  if (parsed.looping && profile.maxLoops <= 1) {
    tradeoffs.push({
      axis: "loop",
      userWanted: "infinite",
      constraint: `${profile.name} forbids infinite loops`,
      negotiated: `${negotiatedLoops}`,
      reason: "Infinite loops can overwhelm under this profile.",
    });
  } else if (parsed.looping && profile.maxLoops > 1) {
    tradeoffs.push({
      axis: "loop",
      userWanted: "infinite",
      constraint: `${profile.name} caps loops at ${profile.maxLoops}`,
      negotiated: `${negotiatedLoops}`,
      reason: "Capped to prevent endless stimulation under this profile.",
    });
  }

  // Build the negotiated spec.
  const negotiatedSpec: MotionSpec = {
    ...spec,
    components: spec.components.length > 0
      ? spec.components.map((c, i) => {
          const cloned = cloneComponent(c);
          cloned.durationMs = negotiatedDuration;
          cloned.easing = negotiatedEasing;
          cloned.iterationCount = negotiatedLoops as never;
          // Apply negotiated magnitudes to keyframes.
          for (const kf of cloned.keyframes) {
            if ("translateX" in kf.properties) {
              const v = kf.properties.translateX;
              if (typeof v === "number") kf.properties.translateX = Math.sign(v) * negotiatedDisplacement;
            }
            if ("translateY" in kf.properties) {
              const v = kf.properties.translateY;
              if (typeof v === "number") kf.properties.translateY = Math.sign(v) * negotiatedDisplacement;
            }
            if ("rotate" in kf.properties) {
              const v = kf.properties.rotate;
              if (typeof v === "number") kf.properties.rotate = Math.sign(v) * negotiatedRotation;
            }
            if ("scale" in kf.properties) {
              const v = kf.properties.scale;
              if (typeof v === "number") kf.properties.scale = v >= 0 ? negotiatedScale : -negotiatedScale;
            }
            if ("opacity" in kf.properties) {
              const v = kf.properties.opacity;
              if (typeof v === "number") {
                // Clamp opacity delta to negotiated value.
                const base = 1;
                const delta = Math.abs(v - base);
                if (delta > negotiatedOpacityDelta) {
                  kf.properties.opacity = v < base ? base - negotiatedOpacityDelta : base;
                }
              }
            }
          }
          // Stagger delays to respect concurrency cap.
          cloned.delayMs = (i % negotiatedConcurrency) * Math.round(negotiatedDuration / negotiatedConcurrency);
          return cloned;
        })
      : [],
  };

  // If the spec was empty, create a single negotiated component from intent.
  if (spec.components.length === 0) {
    const now = new Date().toISOString();
    const newComp: MotionComponent = {
      id: `negotiated-${Date.now()}`,
      projectId: spec.project.id,
      sceneId: null,
      name: `Negotiated: ${intent.slice(0, 30)}${intent.length > 30 ? "…" : ""}`,
      selector: null,
      templateId: null,
      durationMs: negotiatedDuration,
      delayMs: 0,
      iterationCount: negotiatedLoops as never,
      direction: "normal",
      fillMode: "forwards",
      playState: "running",
      trigger: "onLoad",
      easing: negotiatedEasing,
      keyframes: [
        {
          offset: 0,
          properties: {
            opacity: 1 - negotiatedOpacityDelta,
            ...(parsed.intensity !== "subtle" ? { translateY: negotiatedDisplacement } : {}),
            ...(parsed.intensity === "bold" || parsed.intensity === "extreme" ? { rotate: 0 } : {}),
          },
        },
        {
          offset: 1,
          properties: {
            opacity: 1,
            ...(parsed.intensity !== "subtle" ? { translateY: 0 } : {}),
            ...(parsed.intensity === "bold" || parsed.intensity === "extreme" ? { rotate: negotiatedRotation } : {}),
            ...(parsed.intensity === "bold" || parsed.intensity === "extreme" ? { scale: negotiatedScale } : {}),
          },
        },
      ],
      style: {},
      orderIndex: 0,
      parentId: null,
      createdAt: now,
      updatedAt: now,
    };
    negotiatedSpec.components = [newComp];
  }

  // Compute compliance score — how well the negotiated spec satisfies constraints.
  let complianceScore = 100;
  for (const comp of negotiatedSpec.components) {
    if (comp.durationMs < profile.minDurationMs || comp.durationMs > profile.maxDurationMs) complianceScore -= 10;
    if (comp.iterationCount === "infinite" && profile.maxLoops < 100) complianceScore -= 15;
    if (comp.easing.type === "preset" && profile.forbiddenEasings.includes(comp.easing.name)) complianceScore -= 15;
    for (const kf of comp.keyframes) {
      for (const prop of ["translateX", "translateY"] as const) {
        const v = kf.properties[prop];
        if (typeof v === "number" && Math.abs(v) > profile.maxDisplacementPx) complianceScore -= 5;
      }
      const r = kf.properties.rotate;
      if (typeof r === "number" && Math.abs(r) > profile.maxRotationDeg) complianceScore -= 5;
      const s = kf.properties.scale;
      if (typeof s === "number" && Math.abs(s) > profile.maxScale) complianceScore -= 5;
    }
  }
  complianceScore = Math.max(0, complianceScore);

  // Compute intent fidelity — how well the negotiated spec preserves intent.
  let intentFidelityScore = 100;
  if (tradeoffs.length > 0) {
    // Each trade-off reduces fidelity.
    intentFidelityScore -= tradeoffs.length * 8;
  }
  // Extreme signals that couldn't be fully honored reduce fidelity further.
  if (parsed.extremeSignals.length > 0 && tradeoffs.length > 0) {
    intentFidelityScore -= parsed.extremeSignals.length * 5;
  }
  intentFidelityScore = Math.max(0, intentFidelityScore);

  const intentWasCompatible = tradeoffs.length === 0;

  const summary = intentWasCompatible
    ? `Intent "${intent}" is compatible with the ${profile.name} profile — no negotiation needed.`
    : `Negotiated "${intent}" against ${profile.name}: ${tradeoffs.length} trade-off(s). Compliance ${complianceScore}/100, intent fidelity ${intentFidelityScore}/100.`;

  return {
    intent,
    parsedIntent: parsed,
    constraintProfile: profile,
    tradeoffs,
    negotiatedSpec,
    complianceScore,
    intentFidelityScore,
    intentWasCompatible,
    summary,
  };
}

/** List available constraint profile names. */
export function listConstraintProfiles(): ConstraintProfile[] {
  return Object.values(CONSTRAINT_PROFILES);
}

/** Get a constraint profile by name. */
export function getConstraintProfile(name: string): ConstraintProfile | null {
  return CONSTRAINT_PROFILES[name] ?? null;
}

/** Format a negotiation result as a human-readable report. */
export function formatNegotiationReport(result: NegotiationResult): string {
  const lines: string[] = [];
  lines.push(`=== Motion Negotiation ===`);
  lines.push("");
  lines.push(`Intent: "${result.intent}"`);
  lines.push(`Profile: ${result.constraintProfile.name}`);
  lines.push(`Compatible: ${result.intentWasCompatible ? "yes" : "no — negotiation applied"}`);
  lines.push(`Compliance: ${result.complianceScore}/100`);
  lines.push(`Intent fidelity: ${result.intentFidelityScore}/100`);
  lines.push("");

  // Parsed intent.
  lines.push("--- Parsed Intent ---");
  const p = result.parsedIntent;
  lines.push(`speed: ${p.speed ?? "default"}`);
  lines.push(`intensity: ${p.intensity ?? "default"}`);
  lines.push(`looping: ${p.looping ? "yes" : "no"}`);
  lines.push(`colorIntensity: ${p.colorIntensity ?? "default"}`);
  lines.push(`complexity: ${p.complexity ?? "default"}`);
  if (p.extremeSignals.length > 0) {
    lines.push(`extreme signals: ${p.extremeSignals.join(", ")}`);
  }
  lines.push("");

  // Trade-offs.
  if (result.tradeoffs.length > 0) {
    lines.push("--- Trade-offs ---");
    for (const t of result.tradeoffs) {
      lines.push(`[${t.axis}] ${t.userWanted} -> ${t.negotiated}`);
      lines.push(`  constraint: ${t.constraint}`);
      lines.push(`  reason: ${t.reason}`);
    }
    lines.push("");
  }

  lines.push(`Summary: ${result.summary}`);
  return lines.join("\n");
}
