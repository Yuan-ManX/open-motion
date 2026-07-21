/**
 * Motion Storytelling — narrative-to-motion synthesis engine.
 *
 * Decomposes a narrative intent into a 5-act structure (exposition, rising
 * action, climax, falling action, resolution) and maps each act to a motion
 * pattern with appropriate easing, timing, intensity, and choreography.
 *
 * Original systems:
 *
 * 1. Narrative Intent Library
 *    Pre-defined narrative archetypes (hero-entrance, celebration,
 *    dramatic-reveal, conflict, transformation, journey, resolution) each
 *    with a unique 5-act decomposition profile.
 *
 * 2. Act-to-Motion Mapping
 *    Each act is mapped to a motion template with:
 *    - Easing family matching the emotional tone of the act
 *    - Duration proportional to the act's narrative weight
 *    - Intensity curve following Freytag's pyramid
 *    - Transform signature matching the act's dramatic function
 *
 * 3. Choreography Generator
 *    Arranges the acts into a timed sequence with staggered delays,
 *    creating a cohesive narrative flow rather than isolated animations.
 *
 * 4. Story Beat Cards
 *    Each beat includes a human-readable description, emotional tone,
 *    and dramatic function — making the motion sequence explainable.
 */

import type { Easing } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NarrativeIntent =
  | "hero-entrance"
  | "celebration"
  | "dramatic-reveal"
  | "conflict"
  | "transformation"
  | "journey"
  | "resolution";

export type ActName = "exposition" | "rising-action" | "climax" | "falling-action" | "resolution";

export type EmotionalTone =
  | "calm"
  | "curious"
  | "tense"
  | "explosive"
  | "triumphant"
  | "melancholic"
  | "joyful"
  | "mysterious"
  | "resolved"
  | "anticipatory";

export interface StoryBeat {
  act: ActName;
  orderIndex: number;
  label: string;
  description: string;
  emotionalTone: EmotionalTone;
  intensity: number; // 0..1
  durationMs: number;
  delayMs: number; // delay from sequence start
  easing: Easing;
  transformHint: string; // human-readable transform description
  templateId: string; // suggested motion template
}

export interface StorySequence {
  intent: NarrativeIntent;
  title: string;
  summary: string;
  totalDurationMs: number;
  beats: StoryBeat[];
  intensityCurve: number[]; // intensity per beat, for visualization
  themes: string[];
}

export interface StorytellingOptions {
  /** Total duration of the sequence in milliseconds. Default: 4000. */
  totalDurationMs?: number;
  /** Intensity multiplier (0.5 = subtle, 1.0 = normal, 1.5 = dramatic). Default: 1.0. */
  intensityScale?: number;
  /** Override the base selector for generated components. */
  baseSelector?: string;
}

// ---------------------------------------------------------------------------
// Narrative Intent Library
// ---------------------------------------------------------------------------

interface IntentProfile {
  title: string;
  summary: string;
  themes: string[];
  /** Duration weights for each act (must sum to 1.0). */
  actWeights: Record<ActName, number>;
  /** Intensity per act (0..1). */
  actIntensities: Record<ActName, number>;
  /** Emotional tone per act. */
  actTones: Record<ActName, EmotionalTone>;
  /** Transform hint per act. */
  actTransforms: Record<ActName, string>;
  /** Template ID per act. */
  actTemplates: Record<ActName, string>;
  /** Easing family per act. */
  actEasings: Record<ActName, Easing>;
  /** Beat labels per act. */
  actLabels: Record<ActName, string>;
  /** Beat descriptions per act. */
  actDescriptions: Record<ActName, string>;
}

const INTENT_PROFILES: Record<NarrativeIntent, IntentProfile> = {
  "hero-entrance": {
    title: "Hero Entrance",
    summary: "A dramatic introduction where the hero element arrives with authority and presence.",
    themes: ["arrival", "authority", "presence"],
    actWeights: { exposition: 0.1, "rising-action": 0.2, climax: 0.4, "falling-action": 0.15, resolution: 0.15 },
    actIntensities: { exposition: 0.1, "rising-action": 0.4, climax: 0.9, "falling-action": 0.5, resolution: 0.2 },
    actTones: { exposition: "calm", "rising-action": "anticipatory", climax: "explosive", "falling-action": "triumphant", resolution: "resolved" },
    actTransforms: {
      exposition: "subtle ambient breathing",
      "rising-action": "slow rise from below",
      climax: "bold scale-up with overshoot",
      "falling-action": "gentle settle",
      resolution: "subtle pulse of presence",
    },
    actTemplates: {
      exposition: "tpl-breathing-light",
      "rising-action": "tpl-slide-up",
      climax: "tpl-scale-in",
      "falling-action": "tpl-fade-in",
      resolution: "tpl-pulse",
    },
    actEasings: {
      exposition: easingPreset("smooth"),
      "rising-action": easingPreset("ease-in"),
      climax: { type: "spring", stiffness: 200, damping: 12, mass: 1 },
      "falling-action": easingPreset("ease-out"),
      resolution: easingPreset("ease-in-out"),
    },
    actLabels: {
      exposition: "The Stage Set",
      "rising-action": "Approach",
      climax: "The Arrival",
      "falling-action": "Settle",
      resolution: "Presence Established",
    },
    actDescriptions: {
      exposition: "The scene is set with subtle ambient motion, establishing the space.",
      "rising-action": "The hero begins to emerge, building anticipation with a slow rise.",
      climax: "The hero arrives with a bold scale-up and overshoot — the moment of maximum impact.",
      "falling-action": "The hero settles into position, the energy gently dissipating.",
      resolution: "A subtle pulse confirms the hero's established presence.",
    },
  },

  celebration: {
    title: "Celebration",
    summary: "A joyous, energetic sequence of motion celebrating an achievement or milestone.",
    themes: ["joy", "energy", "achievement"],
    actWeights: { exposition: 0.1, "rising-action": 0.15, climax: 0.45, "falling-action": 0.15, resolution: 0.15 },
    actIntensities: { exposition: 0.2, "rising-action": 0.5, climax: 1.0, "falling-action": 0.6, resolution: 0.3 },
    actTones: { exposition: "calm", "rising-action": "anticipatory", climax: "joyful", "falling-action": "joyful", resolution: "resolved" },
    actTransforms: {
      exposition: "gentle glow",
      "rising-action": "quickening pulse",
      climax: "explosive confetti burst",
      "falling-action": "bouncing celebration",
      resolution: "warm fade",
    },
    actTemplates: {
      exposition: "tpl-breathing-light",
      "rising-action": "tpl-pulse",
      climax: "tpl-confetti",
      "falling-action": "tpl-bounce-in",
      resolution: "tpl-fade-in",
    },
    actEasings: {
      exposition: easingPreset("smooth"),
      "rising-action": easingPreset("ease-in"),
      climax: { type: "spring", stiffness: 300, damping: 8, mass: 1 },
      "falling-action": easingPreset("bounce"),
      resolution: easingPreset("ease-out"),
    },
    actLabels: {
      exposition: "Calm Before",
      "rising-action": "Building Excitement",
      climax: "The Celebration",
      "falling-action": "Joyful Aftermath",
      resolution: "Warm Conclusion",
    },
    actDescriptions: {
      exposition: "A gentle glow sets the stage, calm before the excitement.",
      "rising-action": "A quickening pulse builds anticipation for the celebration.",
      climax: "An explosive confetti burst marks the peak moment of joy.",
      "falling-action": "Bouncing elements continue the celebration with playful energy.",
      resolution: "A warm fade brings the celebration to a satisfying close.",
    },
  },

  "dramatic-reveal": {
    title: "Dramatic Reveal",
    summary: "A slow, tension-building sequence culminating in a dramatic reveal of hidden content.",
    themes: ["mystery", "tension", "reveal"],
    actWeights: { exposition: 0.15, "rising-action": 0.35, climax: 0.25, "falling-action": 0.15, resolution: 0.1 },
    actIntensities: { exposition: 0.1, "rising-action": 0.3, climax: 0.85, "falling-action": 0.4, resolution: 0.15 },
    actTones: { exposition: "mysterious", "rising-action": "tense", climax: "explosive", "falling-action": "curious", resolution: "resolved" },
    actTransforms: {
      exposition: "dark fade-in",
      "rising-action": "slow blur reduction",
      climax: "sharp blur-to-focus snap",
      "falling-action": "gentle scale adjustment",
      resolution: "soft settle",
    },
    actTemplates: {
      exposition: "tpl-fade-in",
      "rising-action": "tpl-blur-reveal",
      climax: "tpl-blur-reveal",
      "falling-action": "tpl-scale-in",
      resolution: "tpl-fade-in",
    },
    actEasings: {
      exposition: easingPreset("ease-in"),
      "rising-action": easingPreset("ease-in-out"),
      climax: easingPreset("snappy"),
      "falling-action": easingPreset("ease-out"),
      resolution: easingPreset("smooth"),
    },
    actLabels: {
      exposition: "The Veil",
      "rising-action": "Tension Building",
      climax: "The Reveal",
      "falling-action": "Processing",
      resolution: "Understanding",
    },
    actDescriptions: {
      exposition: "A dark fade-in establishes the mysterious atmosphere.",
      "rising-action": "Slow blur reduction builds tension as the reveal approaches.",
      climax: "A sharp blur-to-focus snap reveals the hidden content with maximum impact.",
      "falling-action": "A gentle scale adjustment lets the viewer process the reveal.",
      resolution: "A soft settle confirms the content is now fully visible.",
    },
  },

  conflict: {
    title: "Conflict",
    summary: "A tense sequence where opposing forces clash, creating visual tension and dramatic friction.",
    themes: ["tension", "opposition", "friction"],
    actWeights: { exposition: 0.1, "rising-action": 0.25, climax: 0.35, "falling-action": 0.2, resolution: 0.1 },
    actIntensities: { exposition: 0.15, "rising-action": 0.5, climax: 0.95, "falling-action": 0.4, resolution: 0.1 },
    actTones: { exposition: "calm", "rising-action": "tense", climax: "explosive", "falling-action": "tense", resolution: "melancholic" },
    actTransforms: {
      exposition: "opposing subtle drift",
      "rising-action": "shaking tension",
      climax: "violent collision",
      "falling-action": "aftershock tremor",
      resolution: "stillness",
    },
    actTemplates: {
      exposition: "tpl-fade-in",
      "rising-action": "tpl-glitch",
      climax: "tpl-shimmer",
      "falling-action": "tpl-glitch",
      resolution: "tpl-fade-in",
    },
    actEasings: {
      exposition: easingPreset("linear"),
      "rising-action": easingPreset("snappy"),
      climax: { type: "spring", stiffness: 400, damping: 5, mass: 1 },
      "falling-action": easingPreset("snappy"),
      resolution: easingPreset("ease-out"),
    },
    actLabels: {
      exposition: "Calm Before Storm",
      "rising-action": "Rising Tension",
      climax: "The Clash",
      "falling-action": "Aftershock",
      resolution: "Stillness",
    },
    actDescriptions: {
      exposition: "Opposing elements drift subtly, hinting at the coming conflict.",
      "rising-action": "Shaking motion builds tension as the forces approach collision.",
      climax: "A violent collision of elements creates the peak of dramatic friction.",
      "falling-action": "An aftershock tremor ripples through the aftermath.",
      resolution: "Stillness settles as the conflict subsides into uneasy peace.",
    },
  },

  transformation: {
    title: "Transformation",
    summary: "A metamorphic sequence where an element evolves from one state to another.",
    themes: ["change", "evolution", "metamorphosis"],
    actWeights: { exposition: 0.15, "rising-action": 0.2, climax: 0.3, "falling-action": 0.2, resolution: 0.15 },
    actIntensities: { exposition: 0.1, "rising-action": 0.35, climax: 0.7, "falling-action": 0.4, resolution: 0.15 },
    actTones: { exposition: "calm", "rising-action": "curious", climax: "explosive", "falling-action": "joyful", resolution: "resolved" },
    actTransforms: {
      exposition: "original state",
      "rising-action": "morphing begins",
      climax: "complete transformation",
      "falling-action": "stabilization",
      resolution: "new state confirmed",
    },
    actTemplates: {
      exposition: "tpl-fade-in",
      "rising-action": "tpl-gradient-shift",
      climax: "tpl-scale-in",
      "falling-action": "tpl-fade-in",
      resolution: "tpl-pulse",
    },
    actEasings: {
      exposition: easingPreset("smooth"),
      "rising-action": easingPreset("ease-in-out"),
      climax: { type: "spring", stiffness: 180, damping: 15, mass: 1 },
      "falling-action": easingPreset("ease-out"),
      resolution: easingPreset("ease-in-out"),
    },
    actLabels: {
      exposition: "Original Form",
      "rising-action": "The Shift",
      climax: "The Metamorphosis",
      "falling-action": "Stabilizing",
      resolution: "New Form",
    },
    actDescriptions: {
      exposition: "The element appears in its original state, calm and stable.",
      "rising-action": "The transformation begins as colors and shapes start to shift.",
      climax: "The metamorphosis completes with a dramatic scale and color transformation.",
      "falling-action": "The new form stabilizes as the transformation energy fades.",
      resolution: "A subtle pulse confirms the new state is permanent.",
    },
  },

  journey: {
    title: "Journey",
    summary: "A hero's journey from departure through challenge to return, told through motion.",
    themes: ["adventure", "growth", "return"],
    actWeights: { exposition: 0.15, "rising-action": 0.3, climax: 0.25, "falling-action": 0.15, resolution: 0.15 },
    actIntensities: { exposition: 0.15, "rising-action": 0.5, climax: 0.8, "falling-action": 0.35, resolution: 0.2 },
    actTones: { exposition: "calm", "rising-action": "anticipatory", climax: "triumphant", "falling-action": "joyful", resolution: "resolved" },
    actTransforms: {
      exposition: "departure slide",
      "rising-action": "ascending arc",
      climax: "summit reach",
      "falling-action": "descent",
      resolution: "homecoming",
    },
    actTemplates: {
      exposition: "tpl-slide-up",
      "rising-action": "tpl-orbit",
      climax: "tpl-scale-in",
      "falling-action": "tpl-fade-in",
      resolution: "tpl-fade-in",
    },
    actEasings: {
      exposition: easingPreset("ease-in"),
      "rising-action": easingPreset("ease-in-out"),
      climax: { type: "spring", stiffness: 200, damping: 14, mass: 1 },
      "falling-action": easingPreset("ease-out"),
      resolution: easingPreset("smooth"),
    },
    actLabels: {
      exposition: "Departure",
      "rising-action": "The Ascent",
      climax: "The Summit",
      "falling-action": "The Descent",
      resolution: "Homecoming",
    },
    actDescriptions: {
      exposition: "The journey begins with a departure slide as the hero leaves the familiar.",
      "rising-action": "An ascending arc builds as the hero climbs through challenges.",
      climax: "The summit is reached with a triumphant scale-up — the journey's peak.",
      "falling-action": "The descent begins as the hero starts the return journey.",
      resolution: "A warm homecoming fade marks the completion of the journey.",
    },
  },

  resolution: {
    title: "Resolution",
    summary: "A peaceful, concluding sequence that brings closure and calm after intensity.",
    themes: ["peace", "closure", "calm"],
    actWeights: { exposition: 0.1, "rising-action": 0.15, climax: 0.25, "falling-action": 0.25, resolution: 0.25 },
    actIntensities: { exposition: 0.3, "rising-action": 0.2, climax: 0.15, "falling-action": 0.1, resolution: 0.05 },
    actTones: { exposition: "melancholic", "rising-action": "calm", climax: "calm", "falling-action": "resolved", resolution: "resolved" },
    actTransforms: {
      exposition: "fading energy",
      "rising-action": "slowing motion",
      climax: "final breath",
      "falling-action": "gentle fade",
      resolution: "stillness",
    },
    actTemplates: {
      exposition: "tpl-fade-in",
      "rising-action": "tpl-fade-in",
      climax: "tpl-breathing-light",
      "falling-action": "tpl-fade-in",
      resolution: "tpl-fade-in",
    },
    actEasings: {
      exposition: easingPreset("ease-out"),
      "rising-action": easingPreset("ease-in-out"),
      climax: easingPreset("smooth"),
      "falling-action": easingPreset("ease-out"),
      resolution: easingPreset("ease-in"),
    },
    actLabels: {
      exposition: "Fading Energy",
      "rising-action": "Slowing Down",
      climax: "The Final Breath",
      "falling-action": "Gentle Fade",
      resolution: "Stillness",
    },
    actDescriptions: {
      exposition: "The residual energy from the preceding intensity begins to fade.",
      "rising-action": "Motion slows as the system moves toward rest.",
      climax: "A final, gentle breath marks the last movement before stillness.",
      "falling-action": "A gentle fade brings everything to a soft close.",
      resolution: "Perfect stillness settles as the resolution completes.",
    },
  },
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Generate a story sequence from a narrative intent.
 *
 * The sequence follows the 5-act Freytag pyramid, with each act's duration,
 * intensity, and easing determined by the intent profile.
 */
export function generateStorySequence(
  intent: NarrativeIntent,
  options?: StorytellingOptions,
): StorySequence {
  const profile = INTENT_PROFILES[intent];
  const totalDurationMs = options?.totalDurationMs ?? 4000;
  const intensityScale = options?.intensityScale ?? 1.0;

  const acts: ActName[] = ["exposition", "rising-action", "climax", "falling-action", "resolution"];
  const beats: StoryBeat[] = [];
  const intensityCurve: number[] = [];
  let currentDelay = 0;

  for (let i = 0; i < acts.length; i++) {
    const act = acts[i];
    const weight = profile.actWeights[act];
    const durationMs = Math.round(totalDurationMs * weight);
    const rawIntensity = profile.actIntensities[act];
    const intensity = Math.min(1, rawIntensity * intensityScale);

    beats.push({
      act,
      orderIndex: i,
      label: profile.actLabels[act],
      description: profile.actDescriptions[act],
      emotionalTone: profile.actTones[act],
      intensity,
      durationMs,
      delayMs: currentDelay,
      easing: profile.actEasings[act],
      transformHint: profile.actTransforms[act],
      templateId: profile.actTemplates[act],
    });

    intensityCurve.push(intensity);
    currentDelay += durationMs;
  }

  return {
    intent,
    title: profile.title,
    summary: profile.summary,
    totalDurationMs: currentDelay,
    beats,
    intensityCurve,
    themes: profile.themes,
  };
}

/**
 * List all available narrative intents with their titles and summaries.
 */
export function listNarrativeIntents(): Array<{
  intent: NarrativeIntent;
  title: string;
  summary: string;
  themes: string[];
}> {
  return (Object.keys(INTENT_PROFILES) as NarrativeIntent[]).map((intent) => ({
    intent,
    title: INTENT_PROFILES[intent].title,
    summary: INTENT_PROFILES[intent].summary,
    themes: INTENT_PROFILES[intent].themes,
  }));
}

/**
 * Parse a natural-language message to detect a narrative intent.
 * Returns the matched intent or null.
 */
export function detectNarrativeIntent(message: string): NarrativeIntent | null {
  const msg = message.toLowerCase();
  if (/(hero|entrance|grand intro|make an entrance)/.test(msg)) return "hero-entrance";
  if (/(celebrat|confetti|party|achievement|milestone|victory)/.test(msg)) return "celebration";
  if (/(reveal|unveil|discov|surprise|mystery)/.test(msg)) return "dramatic-reveal";
  if (/(conflict|clash|battle|versus|oppos|fight)/.test(msg)) return "conflict";
  if (/(transform|metamorph|evolve|morph|change shape)/.test(msg)) return "transformation";
  if (/(journey|adventure|quest|travel|odyssey)/.test(msg)) return "journey";
  if (/(resolution|peace|closure|calm|settle down|wind down|conclude)/.test(msg)) return "resolution";
  return null;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatStoryReport(sequence: StorySequence): string {
  const lines: string[] = [];
  lines.push(`Story Sequence: ${sequence.title}`);
  lines.push(`  Intent: ${sequence.intent}`);
  lines.push(`  Themes: ${sequence.themes.join(", ")}`);
  lines.push(`  Total duration: ${sequence.totalDurationMs}ms`);
  lines.push(`  Summary: ${sequence.summary}`);
  lines.push("");
  lines.push("  5-Act Structure:");

  for (const beat of sequence.beats) {
    const intensityBar = "█".repeat(Math.round(beat.intensity * 10)).padEnd(10, "░");
    lines.push(`    [Act ${beat.orderIndex + 1}] ${beat.label}`);
    lines.push(`      ${beat.description}`);
    lines.push(`      Tone: ${beat.emotionalTone} | Intensity: ${intensityBar} ${Math.round(beat.intensity * 100)}%`);
    lines.push(`      Duration: ${beat.durationMs}ms | Delay: ${beat.delayMs}ms | Easing: ${easingLabel(beat.easing)}`);
    lines.push(`      Transform: ${beat.transformHint} | Template: ${beat.templateId}`);
  }

  lines.push("");
  lines.push("  Intensity Curve:");
  const curveBar = sequence.intensityCurve
    .map((v) => {
      const height = Math.round(v * 5);
      const levels = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
      return levels[Math.min(7, height)];
    })
    .join("");
  lines.push(`    ${curveBar}`);

  return lines.join("\n");
}

function easingLabel(easing: Easing): string {
  if (easing.type === "preset") return easing.name;
  if (easing.type === "spring") return `spring(${easing.stiffness}/${easing.damping})`;
  if (easing.type === "bezier") return `bezier(${easing.p1.join(",")},${easing.p2.join(",")})`;
  return "custom";
}
