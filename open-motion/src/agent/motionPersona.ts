/**
 * Motion Persona — applies a complete design philosophy to a project's motion
 * DNA. Where the Mood Engine translates a single emotional state (premium,
 * playful) into motion parameters, a Persona is a holistic design system:
 * easing preferences, timing rhythm, intensity ceiling, signature patterns,
 * restraint level, and the kinds of transforms the persona favors.
 *
 * This is the seventh original AI-native module. Personas turn OpenMotion
 * from a motion editor into a motion authoring system with named,
 * distinguishable design languages — Bauhaus geometry, Apple HIG restraint,
 * Material expressiveness, Brutalist rawness, Memphis playfulness, Art Deco
 * symmetry, Swiss grid discipline, and Vaporwave nostalgia.
 *
 * Two core operations:
 * 1. applyPersona — transform a project's components so they embody a persona
 * 2. detectPersona — measure how closely a project matches each persona
 *
 * Both are rule-based and run without an LLM round-trip.
 */

import type { MotionComponent, MotionSpec, Easing } from "@openmotion/shared";
import { easingPreset } from "../shared/motion/easing.js";

/** A named design philosophy that defines how motion should feel. */
export interface MotionPersona {
  /** Stable identifier used in tool args. */
  id: PersonaId;
  /** Display name. */
  name: string;
  /** One-line description of the design language. */
  description: string;
  /** Historical / aesthetic origin for context. */
  origin: string;
  /** Easings this persona prefers, in priority order. */
  preferredEasings: Easing[];
  /** Easings this persona avoids. */
  avoidedEasings: string[];
  /** Duration range in ms that defines the persona's rhythm. */
  durationRange: [number, number];
  /** Intensity ceiling — the maximum transform magnitude the persona tolerates. */
  intensityCeiling: "subtle" | "moderate" | "bold" | "extreme";
  /** Whether the persona favors infinite loops. */
  favorsLoops: boolean;
  /** Whether the persona favors staggered choreography. */
  favorsStagger: boolean;
  /** Properties the persona prefers to animate. */
  preferredProperties: string[];
  /** Properties the persona avoids animating. */
  avoidedProperties: string[];
  /** Restraint level — how few simultaneous animations the persona wants. */
  restraintLevel: "minimal" | "balanced" | "expressive";
  /** Signature patterns — short human-readable phrases describing the look. */
  signatures: string[];
}

/** All available persona IDs. */
export type PersonaId =
  | "bauhaus"
  | "apple-hig"
  | "material"
  | "brutalist"
  | "memphis"
  | "art-deco"
  | "swiss"
  | "vaporwave";

const PERSONAS: Record<PersonaId, MotionPersona> = {
  bauhaus: {
    id: "bauhaus",
    name: "Bauhaus",
    description: "Geometric primary forms, strict grid, functional motion with no ornament.",
    origin: "Bauhaus school, 1919–1933 — form follows function.",
    preferredEasings: [easingPreset("linear"), easingPreset("ease-in-out")],
    avoidedEasings: ["bounce", "back", "elastic", "spring"],
    durationRange: [300, 600],
    intensityCeiling: "moderate",
    favorsLoops: false,
    favorsStagger: true,
    preferredProperties: ["translateX", "translateY", "scale", "opacity"],
    avoidedProperties: ["rotate", "skewX", "skewY"],
    restraintLevel: "minimal",
    signatures: ["primary-color blocks", "geometric transitions", "grid-aligned movement"],
  },
  "apple-hig": {
    id: "apple-hig",
    name: "Apple HIG",
    description: "Calm, deliberate motion with spring physics — content moves itself.",
    origin: "Apple Human Interface Guidelines — natural, responsive, intentional.",
    preferredEasings: [easingPreset("smooth"), easingPreset("soft"), easingPreset("ease-out")],
    avoidedEasings: ["linear", "bounce"],
    durationRange: [400, 800],
    intensityCeiling: "moderate",
    favorsLoops: false,
    favorsStagger: true,
    preferredProperties: ["translateX", "translateY", "scale", "opacity"],
    avoidedProperties: ["skewX", "skewY"],
    restraintLevel: "minimal",
    signatures: ["spring-driven", "depth via scale", "fade-through transitions"],
  },
  material: {
    id: "material",
    name: "Material",
    description: "Expressive physical motion — easing curves suggest weight and inertia.",
    origin: "Material Design — motion has meaning, suggests spatial relationships.",
    preferredEasings: [easingPreset("smooth"), easingPreset("snappy"), easingPreset("ease-in-out")],
    avoidedEasings: ["linear"],
    durationRange: [200, 500],
    intensityCeiling: "bold",
    favorsLoops: false,
    favorsStagger: true,
    preferredProperties: ["translateX", "translateY", "scale", "opacity", "rotate"],
    avoidedProperties: ["skewX", "skewY"],
    restraintLevel: "balanced",
    signatures: ["shared element transitions", "container transforms", "staggered list entrances"],
  },
  brutalist: {
    id: "brutalist",
    name: "Brutalist",
    description: "Raw, sudden, unapologetic — linear cuts, no easing, no ornament.",
    origin: "Brutalist web design — exposed structure, jarring transitions.",
    preferredEasings: [easingPreset("linear"), easingPreset("ease-in")],
    avoidedEasings: ["smooth", "soft", "bounce", "back", "elastic", "spring"],
    durationRange: [100, 300],
    intensityCeiling: "extreme",
    favorsLoops: false,
    favorsStagger: false,
    preferredProperties: ["opacity", "translateX", "translateY"],
    avoidedProperties: ["scale", "rotate", "skewX", "skewY"],
    restraintLevel: "expressive",
    signatures: ["hard cuts", "no transitions", "monochrome flash"],
  },
  memphis: {
    id: "memphis",
    name: "Memphis",
    description: "Playful, bouncy, maximal — patterns and colors in chaotic harmony.",
    origin: "Memphis Group, 1980s — postmodern playfulness, geometric patterns.",
    preferredEasings: [easingPreset("bounce"), easingPreset("back"), easingPreset("elastic")],
    avoidedEasings: ["linear"],
    durationRange: [400, 1000],
    intensityCeiling: "extreme",
    favorsLoops: true,
    favorsStagger: true,
    preferredProperties: ["rotate", "scale", "translateX", "translateY", "opacity"],
    avoidedProperties: [],
    restraintLevel: "expressive",
    signatures: ["bouncy entrances", "rotating shapes", "simultaneous bursts"],
  },
  "art-deco": {
    id: "art-deco",
    name: "Art Deco",
    description: "Symmetric, golden-ratio timing, geometric luxury — slow and ceremonial.",
    origin: "Art Deco, 1920s–30s — geometric luxury, sunburst patterns, symmetry.",
    preferredEasings: [easingPreset("smooth"), easingPreset("ease-in-out"), easingPreset("ease-out")],
    avoidedEasings: ["bounce", "back", "elastic", "linear"],
    durationRange: [600, 1200],
    intensityCeiling: "moderate",
    favorsLoops: false,
    favorsStagger: false,
    preferredProperties: ["scale", "opacity", "rotate", "translateY"],
    avoidedProperties: ["skewX", "skewY"],
    restraintLevel: "balanced",
    signatures: ["sunburst reveals", "symmetric pairs", "ceremonial timing"],
  },
  swiss: {
    id: "swiss",
    name: "Swiss",
    description: "Grid-disciplined, typography-first, motion in service of hierarchy.",
    origin: "International Typographic Style — grid systems, objective clarity.",
    preferredEasings: [easingPreset("smooth"), easingPreset("ease-out"), easingPreset("linear")],
    avoidedEasings: ["bounce", "back", "elastic"],
    durationRange: [200, 500],
    intensityCeiling: "moderate",
    favorsLoops: false,
    favorsStagger: true,
    preferredProperties: ["translateY", "translateX", "opacity"],
    avoidedProperties: ["rotate", "scale", "skewX", "skewY"],
    restraintLevel: "minimal",
    signatures: ["vertical rhythm", "grid snap", "left-aligned reveals"],
  },
  vaporwave: {
    id: "vaporwave",
    name: "Vaporwave",
    description: "Nostalgic, slow, looping — VHS aesthetics with chromatic drift.",
    origin: "Vaporwave, 2010s — retrofuturist nostalgia, analog drift.",
    preferredEasings: [easingPreset("smooth"), easingPreset("soft"), easingPreset("ease-in-out")],
    avoidedEasings: ["bounce", "linear"],
    durationRange: [800, 2000],
    intensityCeiling: "moderate",
    favorsLoops: true,
    favorsStagger: false,
    preferredProperties: ["opacity", "translateX", "translateY", "scale"],
    avoidedProperties: ["skewX", "skewY"],
    restraintLevel: "balanced",
    signatures: ["slow crossfades", "infinite loops", "chromatic drift"],
  },
};

export function listPersonas(): MotionPersona[] {
  return Object.values(PERSONAS);
}

export function getPersona(id: string): MotionPersona | null {
  return PERSONAS[id as PersonaId] ?? null;
}

/** A single transformation applied to a component to align it with a persona. */
export interface PersonaAdjustment {
  componentId: string;
  componentName: string;
  field: string;
  before: string;
  after: string;
  reason: string;
}

/** Result of applying a persona to a project. */
export interface PersonaApplicationResult {
  personaId: PersonaId;
  personaName: string;
  adjustments: PersonaAdjustment[];
  componentCount: number;
  adjustedCount: number;
  skippedCount: number;
  summary: string;
  /** The transformed components — deep clones, original spec not mutated. */
  transformedComponents: MotionComponent[];
}

/** Score 0..100 describing how closely a component matches a persona. */
export interface PersonaMatchScore {
  personaId: PersonaId;
  personaName: string;
  score: number;
  reasons: string[];
}

/** Result of detecting which persona a project matches. */
export interface PersonaDetectionResult {
  bestMatch: PersonaMatchScore | null;
  allScores: PersonaMatchScore[];
  summary: string;
}

/** Cap an intensity value to a persona's ceiling. */
function capIntensity(value: number, ceiling: MotionPersona["intensityCeiling"]): number {
  const limits: Record<MotionPersona["intensityCeiling"], number> = {
    subtle: 30,
    moderate: 80,
    bold: 150,
    extreme: 500,
  };
  const limit = limits[ceiling];
  if (Math.abs(value) <= limit) return value;
  return Math.sign(value) * limit;
}

/** Check if an easing is in a list of avoided easing names. */
function isAvoidedEasing(easing: Easing, avoided: string[]): boolean {
  if (easing.type !== "preset") return false;
  return avoided.includes(easing.name);
}

/** Pick the best easing from a persona's preferred list, given the original. */
function pickPreferredEasing(original: Easing, persona: MotionPersona): Easing {
  // If the original is already preferred, keep it.
  if (original.type === "preset" && persona.preferredEasings.some((e) => e.type === "preset" && e.name === original.name)) {
    return original;
  }
  // Use the first preferred easing as the default replacement.
  return persona.preferredEasings[0];
}

/** Clamp a duration into a persona's preferred range. */
function clampDuration(durationMs: number, range: [number, number]): number {
  const [min, max] = range;
  if (durationMs < min) return min;
  if (durationMs > max) return max;
  return durationMs;
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
 * Apply a persona to a project spec, returning the transformed components
 * and a list of every adjustment made. The original spec is not mutated.
 */
export function applyPersona(
  spec: MotionSpec,
  personaId: string,
): PersonaApplicationResult {
  const persona = getPersona(personaId);
  if (!persona) {
    return {
      personaId: personaId as PersonaId,
      personaName: "Unknown",
      adjustments: [],
      componentCount: spec.components.length,
      adjustedCount: 0,
      skippedCount: spec.components.length,
      summary: `Unknown persona: ${personaId}`,
      transformedComponents: spec.components.map(cloneComponent),
    };
  }

  const adjustments: PersonaAdjustment[] = [];
  const transformed = spec.components.map(cloneComponent);
  let adjusted = 0;
  let skipped = 0;

  for (const comp of transformed) {
    let componentAdjusted = false;

    // 1. Easing alignment — replace avoided easings with preferred ones.
    if (isAvoidedEasing(comp.easing, persona.avoidedEasings)) {
      const before = JSON.stringify(comp.easing);
      comp.easing = pickPreferredEasing(comp.easing, persona);
      adjustments.push({
        componentId: comp.id,
        componentName: comp.name,
        field: "easing",
        before,
        after: JSON.stringify(comp.easing),
        reason: `${persona.name} avoids ${persona.avoidedEasings.join(", ")}`,
      });
      componentAdjusted = true;
    }

    // 2. Duration clamping — pull into persona's preferred range.
    const clampedDuration = clampDuration(comp.durationMs, persona.durationRange);
    if (clampedDuration !== comp.durationMs) {
      const before = String(comp.durationMs);
      comp.durationMs = clampedDuration;
      adjustments.push({
        componentId: comp.id,
        componentName: comp.name,
        field: "durationMs",
        before,
        after: String(comp.durationMs),
        reason: `${persona.name} timing rhythm is ${persona.durationRange[0]}-${persona.durationRange[1]}ms`,
      });
      componentAdjusted = true;
    }

    // 3. Loop alignment — cap infinite loops if persona doesn't favor them.
    if (!persona.favorsLoops && comp.iterationCount === "infinite") {
      const before = String(comp.iterationCount);
      comp.iterationCount = 1;
      adjustments.push({
        componentId: comp.id,
        componentName: comp.name,
        field: "iterationCount",
        before,
        after: "1",
        reason: `${persona.name} prefers single-play motion`,
      });
      componentAdjusted = true;
    }
    // Conversely, if persona favors loops and component plays once, leave it —
    // we don't force loops onto every component.

    // 4. Property alignment — strip avoided properties from keyframes.
    if (persona.avoidedProperties.length > 0) {
      for (const kf of comp.keyframes) {
        for (const avoided of persona.avoidedProperties) {
          if (avoided in kf.properties) {
            const before = String(kf.properties[avoided]);
            delete kf.properties[avoided];
            adjustments.push({
              componentId: comp.id,
              componentName: comp.name,
              field: `keyframe.${avoided}`,
              before,
              after: "(removed)",
              reason: `${persona.name} avoids animating ${avoided}`,
            });
            componentAdjusted = true;
          }
        }
      }
    }

    // 5. Intensity capping — clamp transform magnitudes to persona ceiling.
    for (const kf of comp.keyframes) {
      for (const prop of ["translateX", "translateY"] as const) {
        const v = kf.properties[prop];
        if (typeof v === "number" || (typeof v === "string" && /^-?\d+/.test(v))) {
          const num = typeof v === "number" ? v : parseFloat(v);
          const capped = capIntensity(num, persona.intensityCeiling);
          if (capped !== num) {
            const before = String(v);
            kf.properties[prop] = typeof v === "number" ? capped : `${capped}${String(v).replace(/^-?\d+\.?\d*/, "")}`;
            adjustments.push({
              componentId: comp.id,
              componentName: comp.name,
              field: `keyframe.${prop}`,
              before,
              after: String(kf.properties[prop]),
              reason: `${persona.name} intensity ceiling is ${persona.intensityCeiling}`,
            });
            componentAdjusted = true;
          }
        }
      }
    }

    if (componentAdjusted) adjusted++;
    else skipped++;
  }

  // 6. Stagger — if persona favors stagger and there are simultaneous starts,
  // redistribute delays so components enter in sequence.
  if (persona.favorsStagger && transformed.length > 1) {
    const sorted = [...transformed].sort((a, b) => a.orderIndex - b.orderIndex);
    const stepMs = Math.max(60, Math.round(persona.durationRange[0] / 4));
    const adjustedIds = new Set(adjustments.map((a) => a.componentId));
    for (let i = 0; i < sorted.length; i++) {
      const target = i * stepMs;
      if (sorted[i].delayMs !== target) {
        const before = String(sorted[i].delayMs);
        sorted[i].delayMs = target;
        adjustments.push({
          componentId: sorted[i].id,
          componentName: sorted[i].name,
          field: "delayMs",
          before,
          after: String(target),
          reason: `${persona.name} favors staggered choreography (${stepMs}ms step)`,
        });
        // Only count as newly adjusted if this component had no other adjustments.
        if (!adjustedIds.has(sorted[i].id)) {
          adjustedIds.add(sorted[i].id);
          adjusted++;
          skipped--;
        }
      }
    }
  }

  const result: PersonaApplicationResult = {
    personaId: persona.id,
    personaName: persona.name,
    adjustments,
    componentCount: spec.components.length,
    adjustedCount: adjusted,
    skippedCount: skipped,
    summary: `Applied ${persona.name} persona — ${adjustments.length} adjustment(s) across ${adjusted} component(s), ${skipped} unchanged.`,
    transformedComponents: transformed,
  };
  return result;
}

/** Format an apply-persona result as a human-readable report. */
export function formatPersonaApplicationReport(result: PersonaApplicationResult): string {
  const lines: string[] = [];
  lines.push(`=== Motion Persona: ${result.personaName} ===`);
  lines.push("");
  lines.push(`Components: ${result.componentCount} (${result.adjustedCount} adjusted, ${result.skippedCount} unchanged)`);
  lines.push(`Total adjustments: ${result.adjustments.length}`);
  lines.push("");
  if (result.adjustments.length > 0) {
    lines.push("--- Adjustments ---");
    for (const adj of result.adjustments) {
      lines.push(`[${adj.componentName}] ${adj.field}: ${adj.before} -> ${adj.after}`);
      lines.push(`  reason: ${adj.reason}`);
    }
    lines.push("");
  }
  lines.push(`Summary: ${result.summary}`);
  return lines.join("\n");
}

/** Compute a single component's match score against a persona. */
function scoreComponent(comp: MotionComponent, persona: MotionPersona): { score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  // Easing alignment.
  if (comp.easing.type === "preset") {
    if (persona.preferredEasings.some((e) => e.type === "preset" && e.name === comp.easing.name)) {
      score += 15;
      reasons.push(`easing ${comp.easing.name} is preferred`);
    } else if (persona.avoidedEasings.includes(comp.easing.name)) {
      score -= 20;
      reasons.push(`easing ${comp.easing.name} is avoided`);
    }
  }

  // Duration alignment.
  const [min, max] = persona.durationRange;
  if (comp.durationMs >= min && comp.durationMs <= max) {
    score += 10;
    reasons.push(`duration ${comp.durationMs}ms in preferred range`);
  } else if (comp.durationMs < min) {
    score -= 8;
    reasons.push(`duration ${comp.durationMs}ms too fast for persona`);
  } else {
    score -= 5;
    reasons.push(`duration ${comp.durationMs}ms too slow for persona`);
  }

  // Loop alignment.
  if (persona.favorsLoops && comp.iterationCount === "infinite") {
    score += 8;
    reasons.push("infinite loop aligns with persona");
  } else if (!persona.favorsLoops && comp.iterationCount === "infinite") {
    score -= 10;
    reasons.push("infinite loop conflicts with persona");
  }

  // Property alignment.
  const animatedProps = new Set<string>();
  for (const kf of comp.keyframes) {
    for (const key of Object.keys(kf.properties)) animatedProps.add(key);
  }
  for (const preferred of persona.preferredProperties) {
    if (animatedProps.has(preferred)) {
      score += 3;
    }
  }
  for (const avoided of persona.avoidedProperties) {
    if (animatedProps.has(avoided)) {
      score -= 8;
      reasons.push(`animating avoided property ${avoided}`);
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

/**
 * Detect which persona a project most closely matches.
 * Returns scores for every persona, with the best match highlighted.
 */
export function detectPersona(spec: MotionSpec): PersonaDetectionResult {
  if (spec.components.length === 0) {
    return {
      bestMatch: null,
      allScores: [],
      summary: "No components to analyze.",
    };
  }

  const allScores: PersonaMatchScore[] = [];
  for (const persona of listPersonas()) {
    let total = 0;
    const aggregatedReasons: string[] = [];
    for (const comp of spec.components) {
      const { score, reasons } = scoreComponent(comp, persona);
      total += score;
      if (reasons.length > 0) aggregatedReasons.push(...reasons.slice(0, 2));
    }
    const avg = Math.round(total / spec.components.length);
    allScores.push({
      personaId: persona.id,
      personaName: persona.name,
      score: avg,
      reasons: aggregatedReasons.slice(0, 5),
    });
  }

  allScores.sort((a, b) => b.score - a.score);
  const best = allScores[0] ?? null;
  const summary = best
    ? `Best match: ${best.personaName} (${best.score}/100). ${allScores.length} personas evaluated.`
    : "No persona matched.";

  return { bestMatch: best, allScores, summary };
}

/** Format a detection result as a human-readable report. */
export function formatPersonaDetectionReport(result: PersonaDetectionResult): string {
  const lines: string[] = [];
  lines.push("=== Motion Persona Detection ===");
  lines.push("");
  if (!result.bestMatch) {
    lines.push(result.summary);
    return lines.join("\n");
  }
  lines.push(`Best match: ${result.bestMatch.personaName} (${result.bestMatch.score}/100)`);
  lines.push("");
  lines.push("--- All Personas ---");
  for (const score of result.allScores) {
    const bar = "█".repeat(Math.round(score.score / 5)).padEnd(20, "░");
    lines.push(`${score.personaName.padEnd(12)} ${bar} ${score.score}`);
  }
  lines.push("");
  if (result.bestMatch.reasons.length > 0) {
    lines.push("--- Top Reasons ---");
    for (const reason of result.bestMatch.reasons) {
      lines.push(`• ${reason}`);
    }
    lines.push("");
  }
  lines.push(`Summary: ${result.summary}`);
  return lines.join("\n");
}
