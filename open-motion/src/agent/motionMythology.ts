/**
 * Motion Mythology Engine — maps motion to archetypal mythological narratives.
 *
 * This original AI-native module interprets motion compositions through the
 * lens of comparative mythology. It identifies the hero's journey stages,
 * detects archetypal patterns (the shadow, the mentor, the threshold
 * guardian), and maps the composition to a mythological narrative structure.
 *
 * Core concepts:
 * - Hero's Journey: Campbell's monomyth (departure, initiation, return)
 * - Archetypes: universal character patterns (hero, shadow, mentor, trickster)
 * - Threshold Crossing: moments of transformation in the motion
 * - Boon: the gift or realization the motion delivers
 * - Mythic Resonance: how strongly the composition evokes mythic patterns
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A hero's journey stage detected in the composition. */
export interface JourneyStage {
  /** Stage name. */
  name: string;
  /** Stage phase. */
  phase: "departure" | "initiation" | "return";
  /** Component ids in this stage. */
  componentIds: string[];
  /** Time range. */
  startMs: number;
  endMs: number;
  /** Description. */
  description: string;
}

/** An archetypal pattern detected. */
export interface Archetype {
  /** Archetype name. */
  name: "hero" | "shadow" | "mentor" | "trickster" | "threshold-guardian" | "shapeshifter" | "herald" | "ally";
  /** Component id embodying this archetype. */
  componentId: string;
  /** Confidence 0..1. */
  confidence: number;
  /** Description. */
  description: string;
}

/** Mythological analysis result. */
export interface MythologyAnalysis {
  /** Detected journey stages. */
  journeyStages: JourneyStage[];
  /** Detected archetypes. */
  archetypes: Archetype[];
  /** Narrative structure classification. */
  narrativeStructure: "monomyth" | "circular" | "linear" | "fragmented" | "episodic";
  /** Mythic theme. */
  theme: "creation" | "destruction" | "transformation" | "quest" | "rebirth" | "sacrifice" | "union" | "descent";
  /** Mythic resonance 0..1. */
  resonance: number;
  /** The boon (gift) the composition offers. */
  boon: string;
  /** Dramatic tension curve. */
  tensionCurve: Array<{ timeMs: number; tension: number }>;
  /** Catharsis level 0..1. */
  catharsis: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Hero's Journey Detection
// ---------------------------------------------------------------------------

/** Detect hero's journey stages by dividing the timeline into three acts. */
function detectJourneyStages(spec: MotionSpec): JourneyStage[] {
  if (spec.components.length === 0) return [];

  const sorted = [...spec.components].sort((a, b) => a.delayMs - b.delayMs);
  const timelineEnd = Math.max(...sorted.map((c) => c.delayMs + c.durationMs));
  const third = timelineEnd / 3;

  const stages: JourneyStage[] = [];

  // Act 1: Departure (Ordinary World → Call to Adventure → Crossing Threshold)
  const departureComponents = sorted.filter((c) => c.delayMs < third);
  if (departureComponents.length > 0) {
    stages.push({
      name: "Departure",
      phase: "departure",
      componentIds: departureComponents.map((c) => c.id),
      startMs: departureComponents[0].delayMs,
      endMs: Math.max(...departureComponents.map((c) => c.delayMs + c.durationMs)),
      description: `Departure phase — ${departureComponents.length} component(s) establish the ordinary world and the call to adventure`,
    });
  }

  // Act 2: Initiation (Road of Trials → Abyss → Revelation → Transformation)
  const initiationComponents = sorted.filter(
    (c) => c.delayMs >= third && c.delayMs < third * 2,
  );
  if (initiationComponents.length > 0) {
    stages.push({
      name: "Initiation",
      phase: "initiation",
      componentIds: initiationComponents.map((c) => c.id),
      startMs: initiationComponents[0].delayMs,
      endMs: Math.max(...initiationComponents.map((c) => c.delayMs + c.durationMs)),
      description: `Initiation phase — ${initiationComponents.length} component(s) form the road of trials and transformation`,
    });
  }

  // Act 3: Return (Refusal of Return → Crossing Return Threshold → Master of Two Worlds → Freedom)
  const returnComponents = sorted.filter((c) => c.delayMs >= third * 2);
  if (returnComponents.length > 0) {
    stages.push({
      name: "Return",
      phase: "return",
      componentIds: returnComponents.map((c) => c.id),
      startMs: returnComponents[0].delayMs,
      endMs: Math.max(...returnComponents.map((c) => c.delayMs + c.durationMs)),
      description: `Return phase — ${returnComponents.length} component(s) deliver the boon and restore the world`,
    });
  }

  return stages;
}

// ---------------------------------------------------------------------------
// Archetype Detection
// ---------------------------------------------------------------------------

/** Detect archetypal patterns in components. */
function detectArchetypes(spec: MotionSpec): Archetype[] {
  const archetypes: Archetype[] = [];

  for (const comp of spec.components) {
    // Hero: the largest/most prominent component
    const isHero = isHeroComponent(comp, spec);
    if (isHero.confidence > 0.5) {
      archetypes.push({
        name: "hero",
        componentId: comp.id,
        confidence: isHero.confidence,
        description: `Hero archetype — ${isHero.reason}`,
      });
      continue;
    }

    // Shadow: dark/intense component
    const isShadow = isShadowComponent(comp);
    if (isShadow.confidence > 0.5) {
      archetypes.push({
        name: "shadow",
        componentId: comp.id,
        confidence: isShadow.confidence,
        description: `Shadow archetype — ${isShadow.reason}`,
      });
      continue;
    }

    // Mentor: smooth/guiding component
    const isMentor = isMentorComponent(comp);
    if (isMentor.confidence > 0.5) {
      archetypes.push({
        name: "mentor",
        componentId: comp.id,
        confidence: isMentor.confidence,
        description: `Mentor archetype — ${isMentor.reason}`,
      });
      continue;
    }

    // Trickster: bouncy/erratic component
    const isTrickster = isTricksterComponent(comp);
    if (isTrickster.confidence > 0.5) {
      archetypes.push({
        name: "trickster",
        componentId: comp.id,
        confidence: isTrickster.confidence,
        description: `Trickster archetype — ${isTrickster.reason}`,
      });
    }
  }

  return archetypes;
}

/** Check if a component embodies the Hero archetype. */
function isHeroComponent(comp: MotionComponent, spec: MotionSpec): { confidence: number; reason: string } {
  const avgDuration = spec.components.reduce((sum, c) => sum + c.durationMs, 0) / spec.components.length;
  if (comp.durationMs > avgDuration * 1.5) {
    return { confidence: 0.8, reason: "longest duration commands attention as the hero" };
  }
  if (comp.iterationCount === "infinite") {
    return { confidence: 0.7, reason: "infinite loop makes it the central focus" };
  }
  return { confidence: 0.3, reason: "standard component" };
}

/** Check if a component embodies the Shadow archetype. */
function isShadowComponent(comp: MotionComponent): { confidence: number; reason: string } {
  if (comp.easing && typeof comp.easing === "object" && comp.easing.type === "preset") {
    if (comp.easing.name === "bounce" || comp.easing.name === "elastic") {
      return { confidence: 0.4, reason: "erratic motion suggests the shadow's chaos" };
    }
  }
  // Check for low opacity (shadowy)
  const firstKf = comp.keyframes?.[0];
  if (firstKf) {
    const props = firstKf.properties as Record<string, string | number>;
    if ("opacity" in props && typeof props.opacity === "number" && props.opacity < 0.5) {
      return { confidence: 0.75, reason: "low opacity evokes the shadow's hidden nature" };
    }
  }
  return { confidence: 0.2, reason: "no shadow qualities" };
}

/** Check if a component embodies the Mentor archetype. */
function isMentorComponent(comp: MotionComponent): { confidence: number; reason: string } {
  if (comp.easing && typeof comp.easing === "object") {
    if (comp.easing.type === "preset") {
      if (comp.easing.name === "smooth" || comp.easing.name === "soft" || comp.easing.name === "ease-in-out") {
        return { confidence: 0.8, reason: "smooth easing guides like a mentor" };
      }
    }
    if (comp.easing.type === "spring") {
      return { confidence: 0.6, reason: "spring physics guides with natural wisdom" };
    }
  }
  return { confidence: 0.2, reason: "no mentor qualities" };
}

/** Check if a component embodies the Trickster archetype. */
function isTricksterComponent(comp: MotionComponent): { confidence: number; reason: string } {
  if (comp.easing && typeof comp.easing === "object" && comp.easing.type === "preset") {
    if (comp.easing.name === "bounce") {
      return { confidence: 0.9, reason: "bounce easing embodies the trickster's playfulness" };
    }
    if (comp.easing.name === "elastic") {
      return { confidence: 0.85, reason: "elastic easing reflects the trickster's elasticity" };
    }
    if (comp.easing.name === "snappy") {
      return { confidence: 0.7, reason: "snappy motion is the trickster's quick wit" };
    }
  }
  if (comp.direction === "alternate") {
    return { confidence: 0.6, reason: "alternate direction is the trickster's back-and-forth" };
  }
  return { confidence: 0.2, reason: "no trickster qualities" };
}

// ---------------------------------------------------------------------------
// Narrative Analysis
// ---------------------------------------------------------------------------

/** Classify the narrative structure. */
function classifyNarrative(stages: JourneyStage[], spec: MotionSpec): MythologyAnalysis["narrativeStructure"] {
  if (stages.length === 0) return "fragmented";
  if (stages.length === 3) {
    // Check if the last stage returns to the beginning (circular)
    const firstStart = stages[0].startMs;
    const lastEnd = stages[2].endMs;
    // Check for looping (circular)
    const hasInfinite = spec.components.some((c) => c.iterationCount === "infinite");
    if (hasInfinite) return "circular";
    return "monomyth";
  }
  if (stages.length === 1) return "linear";
  return "episodic";
}

/** Determine the mythic theme. */
function determineTheme(spec: MotionSpec): MythologyAnalysis["theme"] {
  // Analyze easing patterns for theme
  const easings = spec.components
    .map((c) => c.easing)
    .filter((e): e is NonNullable<typeof e> => e !== undefined && typeof e === "object");

  const hasSpring = easings.some((e) => e.type === "spring");
  const hasBounce = easings.some((e) => e.type === "preset" && e.name === "bounce");
  const hasSmooth = easings.some((e) => e.type === "preset" && (e.name === "smooth" || e.name === "soft"));

  // Check for fade in/out (creation/rebirth)
  const hasFadeIn = spec.components.some((c) => {
    const kf = c.keyframes?.[0];
    if (!kf) return false;
    const props = kf.properties as Record<string, string | number>;
    return "opacity" in props && typeof props.opacity === "number" && props.opacity === 0;
  });

  if (hasFadeIn && hasSpring) return "rebirth";
  if (hasFadeIn) return "creation";
  if (hasBounce) return "transformation";
  if (hasSpring && hasSmooth) return "union";
  if (hasSpring) return "quest";
  if (hasSmooth) return "transformation";

  return "transformation";
}

/** Compute the tension curve across the timeline. */
function computeTensionCurve(spec: MotionSpec): Array<{ timeMs: number; tension: number }> {
  if (spec.components.length === 0) return [];

  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const sampleCount = 10;
  const samples: Array<{ timeMs: number; tension: number }> = [];

  for (let i = 0; i < sampleCount; i++) {
    const time = (i / (sampleCount - 1)) * timelineEnd;
    // Tension = number of active components + intensity
    const active = spec.components.filter(
      (c) => c.delayMs <= time && c.delayMs + c.durationMs >= time,
    );
    const tension = Math.min(1, active.length / 5);
    samples.push({ timeMs: time, tension });
  }

  return samples;
}

/** Compute catharsis level from the tension curve. */
function computeCatharsis(tensionCurve: Array<{ timeMs: number; tension: number }>): number {
  if (tensionCurve.length < 2) return 0;

  // Find peak tension
  const peakTension = Math.max(...tensionCurve.map((t) => t.tension));
  const peakIdx = tensionCurve.findIndex((t) => t.tension === peakTension);

  // Find final tension
  const finalTension = tensionCurve[tensionCurve.length - 1].tension;

  // Catharsis = how much tension was released
  const release = peakTension - finalTension;
  return Math.max(0, Math.min(1, release));
}

/** Determine the boon (gift) the composition offers. */
function determineBoon(spec: MotionSpec, theme: MythologyAnalysis["theme"]): string {
  const boonMap: Record<MythologyAnalysis["theme"], string> = {
    creation: "the gift of emergence — new forms brought into being from stillness",
    destruction: "the gift of release — old patterns dissolved to make way for the new",
    transformation: "the gift of change — the viewer witnesses motion becoming other motion",
    quest: "the gift of purpose — each component strives toward its destination",
    rebirth: "the gift of renewal — what faded returns, transformed and alive",
    sacrifice: "the gift of meaning — one motion gives itself so others may shine",
    union: "the gift of harmony — disparate motions find their shared rhythm",
    descent: "the gift of depth — the viewer is taken below the surface into the hidden",
  };
  return boonMap[theme] ?? "the gift of motion itself — the dance of existence made visible";
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/** Analyze a motion composition through the mythological lens. */
export function analyzeMythology(spec: MotionSpec): MythologyAnalysis {
  if (spec.components.length === 0) {
    return {
      journeyStages: [],
      archetypes: [],
      narrativeStructure: "fragmented",
      theme: "transformation",
      resonance: 0,
      boon: "No boon — the void has nothing to offer.",
      tensionCurve: [],
      catharsis: 0,
      summary: "No components — silent myth.",
    };
  }

  const journeyStages = detectJourneyStages(spec);
  const archetypes = detectArchetypes(spec);
  const narrativeStructure = classifyNarrative(journeyStages, spec);
  const theme = determineTheme(spec);
  const tensionCurve = computeTensionCurve(spec);
  const catharsis = computeCatharsis(tensionCurve);
  const boon = determineBoon(spec, theme);

  // Resonance: how strongly the composition evokes mythic patterns
  const stageCompleteness = journeyStages.length / 3; // Full journey = 1.0
  const archetypeRichness = Math.min(1, archetypes.length / 4);
  const tensionDrama = tensionCurve.length > 0
    ? Math.max(...tensionCurve.map((t) => t.tension))
    : 0;
  const resonance = stageCompleteness * 0.4 + archetypeRichness * 0.3 + tensionDrama * 0.3;

  const summary = `Mythology: ${narrativeStructure} narrative, theme=${theme}, ` +
    `${journeyStages.length} stage(s), ${archetypes.length} archetype(s), ` +
    `resonance ${(resonance * 100).toFixed(0)}%, catharsis ${(catharsis * 100).toFixed(0)}%`;

  return {
    journeyStages,
    archetypes,
    narrativeStructure,
    theme,
    resonance,
    boon,
    tensionCurve,
    catharsis,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a mythology analysis as a human-readable report. */
export function formatMythologyReport(analysis: MythologyAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Mythology Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  lines.push("## Hero's Journey");
  for (const stage of analysis.journeyStages) {
    lines.push(`- [${stage.phase}] ${stage.name}: ${stage.description}`);
  }
  lines.push("");

  if (analysis.archetypes.length > 0) {
    lines.push("## Archetypes");
    for (const a of analysis.archetypes) {
      lines.push(`- ${a.name} (${(a.confidence * 100).toFixed(0)}%): ${a.description}`);
    }
    lines.push("");
  }

  lines.push("## Narrative");
  lines.push(`- Structure: ${analysis.narrativeStructure}`);
  lines.push(`- Theme: ${analysis.theme}`);
  lines.push(`- Resonance: ${(analysis.resonance * 100).toFixed(0)}%`);
  lines.push(`- Catharsis: ${(analysis.catharsis * 100).toFixed(0)}%`);
  lines.push(`- Boon: ${analysis.boon}`);

  return lines.join("\n");
}
