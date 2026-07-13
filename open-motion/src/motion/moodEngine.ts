import type { Easing, MotionSpec } from "@openmotion/shared";

/**
 * Motion Mood Engine — translates between human emotional language and
 * technical motion parameters. Lets users say "make it feel premium" and
 * the agent knows to use slow smooth easing, long durations, and subtle
 * property changes. Also generates emotional narrative descriptions of
 * existing animations so the agent can describe motion in human terms.
 */

export type Mood =
  | "premium"
  | "playful"
  | "calm"
  | "energetic"
  | "dramatic"
  | "minimal"
  | "confident"
  | "gentle"
  | "urgent"
  | "nostalgic";

export interface MoodProfile {
  mood: Mood;
  label: string;
  description: string;
  easing: Easing;
  durationRange: [number, number];
  preferredProperties: string[];
  avoidProperties: string[];
  iterationHint: number | "infinite";
  directionHint: "normal" | "alternate";
  intensity: number;
}

export interface MoodAnalysis {
  dominantMood: Mood;
  moodScores: Partial<Record<Mood, number>>;
  narrative: string;
  energy: number;
  rhythm: "steady" | "irregular" | "crescendo" | "staccato";
  coherence: number;
}

const MOOD_PROFILES: Record<Mood, MoodProfile> = {
  premium: {
    mood: "premium",
    label: "Premium",
    description: "Slow, deliberate, smooth — conveys luxury and craftsmanship",
    easing: { type: "preset", name: "smooth" },
    durationRange: [800, 1600],
    preferredProperties: ["opacity", "translateY", "scale"],
    avoidProperties: ["rotate", "skewX", "skewY"],
    iterationHint: 1,
    directionHint: "normal",
    intensity: 0.3,
  },
  playful: {
    mood: "playful",
    label: "Playful",
    description: "Bouncy, energetic, multi-axis — feels fun and approachable",
    easing: { type: "preset", name: "bounce" },
    durationRange: [400, 900],
    preferredProperties: ["scale", "translateY", "rotate"],
    avoidProperties: [],
    iterationHint: 1,
    directionHint: "normal",
    intensity: 0.8,
  },
  calm: {
    mood: "calm",
    label: "Calm",
    description: "Soft, slow, gentle — creates a serene and peaceful feeling",
    easing: { type: "preset", name: "smooth" },
    durationRange: [1000, 2000],
    preferredProperties: ["opacity", "translateX", "translateY"],
    avoidProperties: ["rotate", "scale", "skewX"],
    iterationHint: 1,
    directionHint: "normal",
    intensity: 0.2,
  },
  energetic: {
    mood: "energetic",
    label: "Energetic",
    description: "Fast, snappy, multi-property — high impact and urgency",
    easing: { type: "preset", name: "snappy" },
    durationRange: [200, 600],
    preferredProperties: ["scale", "translateX", "translateY", "opacity"],
    avoidProperties: [],
    iterationHint: 1,
    directionHint: "normal",
    intensity: 1.0,
  },
  dramatic: {
    mood: "dramatic",
    label: "Dramatic",
    description: "Long buildups, bold transforms — creates tension and release",
    easing: { type: "preset", name: "ease-in" },
    durationRange: [1200, 3000],
    preferredProperties: ["scale", "rotate", "opacity", "translateY"],
    avoidProperties: [],
    iterationHint: 1,
    directionHint: "alternate",
    intensity: 0.9,
  },
  minimal: {
    mood: "minimal",
    label: "Minimal",
    description: "Subtle, short, single-property — understated elegance",
    easing: { type: "preset", name: "ease-out" },
    durationRange: [200, 500],
    preferredProperties: ["opacity"],
    avoidProperties: ["rotate", "skewX", "skewY", "scale"],
    iterationHint: 1,
    directionHint: "normal",
    intensity: 0.15,
  },
  confident: {
    mood: "confident",
    label: "Confident",
    description: "Crisp, decisive, purposeful — communicates authority",
    easing: { type: "preset", name: "snappy" },
    durationRange: [300, 700],
    preferredProperties: ["translateY", "scale", "opacity"],
    avoidProperties: ["skewX", "skewY"],
    iterationHint: 1,
    directionHint: "normal",
    intensity: 0.6,
  },
  gentle: {
    mood: "gentle",
    label: "Gentle",
    description: "Soft springs, low amplitude — tender and caring",
    easing: { type: "spring", stiffness: 80, damping: 14, mass: 1 },
    durationRange: [600, 1200],
    preferredProperties: ["opacity", "translateY", "scale"],
    avoidProperties: ["rotate", "skewX"],
    iterationHint: 1,
    directionHint: "normal",
    intensity: 0.25,
  },
  urgent: {
    mood: "urgent",
    label: "Urgent",
    description: "Rapid, repetitive, attention-grabbing — demands immediate action",
    easing: { type: "preset", name: "snappy" },
    durationRange: [150, 400],
    preferredProperties: ["scale", "translateX", "opacity"],
    avoidProperties: ["skewY"],
    iterationHint: "infinite",
    directionHint: "alternate",
    intensity: 1.0,
  },
  nostalgic: {
    mood: "nostalgic",
    label: "Nostalgic",
    description: "Slow fades, gentle drifts — evokes warmth and memory",
    easing: { type: "preset", name: "smooth" },
    durationRange: [1500, 3000],
    preferredProperties: ["opacity", "translateY", "scale"],
    avoidProperties: ["rotate", "skewX", "skewY"],
    iterationHint: 1,
    directionHint: "normal",
    intensity: 0.3,
  },
};

const MOOD_KEYWORDS: Record<Mood, string[]> = {
  premium: ["premium", "luxury", "luxurious", "elegant", "high-end", "sophisticated", "refined", "classy"],
  playful: ["playful", "fun", "bouncy", "cheerful", "whimsical", "lively", "joyful", "bubbly"],
  calm: ["calm", "peaceful", "serene", "tranquil", "soft", "relaxing", "gentle calm", "meditative"],
  energetic: ["energetic", "dynamic", "vibrant", "lively", "fast-paced", "high-energy", "electric"],
  dramatic: ["dramatic", "cinematic", "epic", "bold", "intense", "theatrical", "powerful"],
  minimal: ["minimal", "subtle", "understated", "clean", "simple", "restrained", "quiet"],
  confident: ["confident", "assertive", "decisive", "bold", "strong", "authoritative", "purposeful"],
  gentle: ["gentle", "tender", "soft", "delicate", "caring", "warm", "soothing"],
  urgent: ["urgent", "alert", "attention", "critical", "important", "flash", "pulsing"],
  nostalgic: ["nostalgic", "retro", "vintage", "warm", "memory", "classic", "old-school"],
};

/** Detect mood keywords in a natural-language string. Returns matched moods by confidence. */
export function detectMood(text: string): Mood[] {
  const lower = text.toLowerCase();
  const scores: Array<{ mood: Mood; score: number }> = [];
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS) as [Mood, string[]][]) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score += kw.length > 5 ? 2 : 1;
    }
    if (score > 0) scores.push({ mood, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.map((s) => s.mood);
}

/** Get the technical profile for a mood. */
export function getMoodProfile(mood: Mood): MoodProfile {
  return MOOD_PROFILES[mood];
}

/** List all available moods with labels. */
export function listMoods(): Array<{ mood: Mood; label: string; description: string }> {
  return Object.values(MOOD_PROFILES).map((p) => ({
    mood: p.mood,
    label: p.label,
    description: p.description,
  }));
}

/** Classify an easing into a mood-relevant family. */
function easingMoodScore(easing: Easing): Partial<Record<Mood, number>> {
  if (easing.type === "preset") {
    const n = easing.name;
    if (/bounce|elastic|back/.test(n)) return { playful: 0.8, energetic: 0.4 };
    if (/spring/.test(n)) return { playful: 0.6, gentle: 0.3 };
    if (/smooth|ease-in-out/.test(n)) return { calm: 0.7, premium: 0.5, nostalgic: 0.4 };
    if (/snappy|ease-in/.test(n)) return { energetic: 0.7, confident: 0.5, urgent: 0.3 };
    if (/ease-out/.test(n)) return { minimal: 0.5, confident: 0.4, gentle: 0.3 };
    return { minimal: 0.3 };
  }
  if (easing.type === "spring") {
    if (easing.damping < 10) return { playful: 0.8, energetic: 0.5 };
    if (easing.damping < 16) return { gentle: 0.6, playful: 0.3 };
    return { confident: 0.5, calm: 0.4 };
  }
  if (easing.type === "bezier") {
    const [, y1] = easing.p1;
    const [, y2] = easing.p2;
    if (y1 > 1 || y2 > 1) return { playful: 0.6, dramatic: 0.4 };
    if (y1 < 0.3 && y2 > 0.7) return { energetic: 0.6, confident: 0.4 };
    return { calm: 0.4, minimal: 0.3 };
  }
  return { minimal: 0.2 };
}

/** Score duration against mood expectations. */
function durationMoodScore(ms: number): Partial<Record<Mood, number>> {
  if (ms < 300) return { energetic: 0.7, urgent: 0.6, minimal: 0.4 };
  if (ms < 600) return { confident: 0.5, playful: 0.4, minimal: 0.3 };
  if (ms < 1000) return { playful: 0.5, confident: 0.4, premium: 0.3 };
  if (ms < 1600) return { premium: 0.6, calm: 0.5, nostalgic: 0.3 };
  if (ms < 2500) return { dramatic: 0.6, calm: 0.5, nostalgic: 0.5 };
  return { nostalgic: 0.7, dramatic: 0.5, calm: 0.4 };
}

/** Score animated properties against mood expectations. */
function propertiesMoodScore(props: Set<string>): Partial<Record<Mood, number>> {
  const scores: Partial<Record<Mood, number>> = {};
  const hasRotate = props.has("rotate");
  const hasScale = props.has("scale");
  const hasSkew = props.has("skewX") || props.has("skewY");
  const hasOpacity = props.has("opacity");
  const count = props.size;

  if (hasRotate && hasScale) { scores.playful = (scores.playful ?? 0) + 0.4; scores.energetic = (scores.energetic ?? 0) + 0.3; }
  if (hasSkew) { scores.dramatic = (scores.dramatic ?? 0) + 0.4; }
  if (hasOpacity && count === 1) { scores.minimal = (scores.minimal ?? 0) + 0.6; scores.calm = (scores.calm ?? 0) + 0.3; }
  if (count >= 3) { scores.energetic = (scores.energetic ?? 0) + 0.4; scores.dramatic = (scores.dramatic ?? 0) + 0.2; }
  if (hasScale && !hasRotate && !hasSkew) { scores.premium = (scores.premium ?? 0) + 0.3; scores.gentle = (scores.gentle ?? 0) + 0.2; }
  return scores;
}

/** Determine rhythm pattern from component delays and durations. */
function detectRhythm(spec: MotionSpec): MoodAnalysis["rhythm"] {
  if (spec.components.length < 2) return "steady";
  const delays = spec.components.map((c) => c.delayMs);
  const durations = spec.components.map((c) => c.durationMs);
  const delayGaps = delays.slice(1).map((d, i) => d - delays[i]);
  const allSameGap = delayGaps.every((g) => Math.abs(g - delayGaps[0]) < 50);
  const increasingGaps = delayGaps.every((g, i) => i === 0 || g >= delayGaps[i - 1]);
  const shortGaps = delayGaps.filter((g) => g < 100).length;

  if (allSameGap && delayGaps[0] > 0) return "steady";
  if (increasingGaps) return "crescendo";
  if (shortGaps > delayGaps.length / 2) return "staccato";
  return "irregular";
}

/**
 * Analyze the mood of a motion spec or a single component.
 * Returns the dominant mood, a full mood score breakdown, an emotional
 * narrative description, energy level (0-1), rhythm pattern, and coherence.
 */
export function analyzeMood(spec: MotionSpec, componentId?: string): MoodAnalysis {
  const components = componentId
    ? spec.components.filter((c) => c.id === componentId)
    : spec.components;

  if (components.length === 0) {
    return {
      dominantMood: "minimal",
      moodScores: { minimal: 1 },
      narrative: "An empty canvas — no motion to characterize yet.",
      energy: 0,
      rhythm: "steady",
      coherence: 1,
    };
  }

  const moodTotals: Partial<Record<Mood, number>> = {};
  let totalEnergy = 0;

  for (const comp of components) {
    const props = new Set<string>();
    for (const kf of comp.keyframes) {
      for (const key of Object.keys(kf.properties)) props.add(key);
    }

    const easingScores = easingMoodScore(comp.easing);
    const durScores = durationMoodScore(comp.durationMs);
    const propScores = propertiesMoodScore(props);

    for (const [mood, score] of Object.entries(easingScores) as [Mood, number][]) {
      moodTotals[mood] = (moodTotals[mood] ?? 0) + score * 0.4;
    }
    for (const [mood, score] of Object.entries(durScores) as [Mood, number][]) {
      moodTotals[mood] = (moodTotals[mood] ?? 0) + score * 0.35;
    }
    for (const [mood, score] of Object.entries(propScores) as [Mood, number][]) {
      moodTotals[mood] = (moodTotals[mood] ?? 0) + score * 0.25;
    }

    const isLooping = comp.iterationCount === "infinite";
    const intensity = Math.min(1, (props.size / 3) * (comp.durationMs < 500 ? 1.2 : 0.8) * (isLooping ? 1.3 : 1));
    totalEnergy += intensity;
  }

  const avgEnergy = totalEnergy / components.length;
  const sorted = (Object.entries(moodTotals) as [Mood, number][]).sort((a, b) => b[1] - a[1]);
  const dominantMood = sorted[0]?.[0] ?? "minimal";
  const moodScores: Partial<Record<Mood, number>> = {};
  const total = sorted.reduce((sum, [, v]) => sum + v, 0) || 1;
  for (const [mood, score] of sorted) {
    moodScores[mood] = Math.round((score / total) * 100) / 100;
  }

  const rhythm = detectRhythm(spec);

  const easingFamilies = new Set(components.map((c) => c.easing.type));
  const coherence = components.length <= 1 ? 1 : Math.round((1 - (easingFamilies.size - 1) / components.length) * 100) / 100;

  const narrative = buildNarrative(dominantMood, avgEnergy, rhythm, coherence, components.length);

  return {
    dominantMood,
    moodScores,
    narrative,
    energy: Math.round(avgEnergy * 100) / 100,
    rhythm,
    coherence,
  };
}

/** Generate a human-readable emotional narrative for the animation. */
function buildNarrative(
  mood: Mood,
  energy: number,
  rhythm: MoodAnalysis["rhythm"],
  coherence: number,
  count: number,
): string {
  const profile = MOOD_PROFILES[mood];
  const energyLabel = energy > 0.7 ? "high-energy" : energy > 0.4 ? "moderate-energy" : "low-energy";
  const rhythmLabel = rhythm === "steady" ? "with a steady rhythmic pulse" : rhythm === "crescendo" ? "building in a crescendo" : rhythm === "staccato" ? "in quick staccato bursts" : "with an irregular, organic rhythm";
  const coherenceLabel = coherence > 0.7 ? "coherent and unified" : coherence > 0.4 ? "somewhat varied" : "eclectic and diverse";

  const parts: string[] = [];
  parts.push(`This composition feels ${profile.label.toLowerCase()} — ${profile.description.toLowerCase()}.`);
  parts.push(`The overall character is ${energyLabel} ${rhythmLabel}.`);
  if (count > 1) {
    parts.push(`Across ${count} components, the motion vocabulary is ${coherenceLabel}.`);
  }
  return parts.join(" ");
}

/**
 * Translate a mood into a partial component spec patch.
 * The agent uses this to apply mood-driven defaults.
 */
export function moodToSpecPatch(mood: Mood): {
  easing: Easing;
  durationMs: number;
  direction: "normal" | "alternate";
  iterationCount: number | "infinite";
} {
  const p = MOOD_PROFILES[mood];
  const durationMs = Math.round((p.durationRange[0] + p.durationRange[1]) / 2);
  return {
    easing: p.easing,
    durationMs,
    direction: p.directionHint,
    iterationCount: p.iterationHint,
  };
}
