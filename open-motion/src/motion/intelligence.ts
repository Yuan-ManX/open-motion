import type { Easing, MotionComponent, MotionSpec } from "@openmotion/shared";

/**
 * Motion Intelligence Engine — semantic analysis of motion beyond technical
 * parameters. Reads the emotional impact, visual rhythm, narrative coherence,
 * personality, and attention flow of a motion composition.
 *
 * This module treats motion as a language: every easing choice, duration, and
 * keyframe carries meaning. The engine decodes that meaning into structured
 * insights the agent can reason about and the user can understand.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Emotion =
  | "anticipation"
  | "surprise"
  | "delight"
  | "tension"
  | "release"
  | "curiosity"
  | "satisfaction"
  | "urgency"
  | "calm"
  | "joy"
  | "trust"
  | "confusion";

export interface EmotionalBeat {
  timeMs: number;
  emotion: Emotion;
  intensity: number; // 0..1
  source: string; // which component / property triggered this
}

export interface EmotionalAnalysis {
  journey: EmotionalBeat[];
  dominantEmotion: Emotion;
  emotionalRange: number; // 0..1 — how many distinct emotions are present
  emotionalArc: "flat" | "rising" | "falling" | "peaked" | "oscillating";
  peakIntensity: number;
  narrativeDescription: string;
}

export type RhythmType =
  | "steady"
  | "syncopated"
  | "rubato"
  | "accelerando"
  | "decelerando"
  | "chaotic"
  | "static";

export interface RhythmBeat {
  timeMs: number;
  strength: number; // 0..1 — how strong the beat is
  componentId: string;
}

export interface RhythmAnalysis {
  beats: RhythmBeat[];
  tempoBpm: number; // estimated beats per minute
  rhythmType: RhythmType;
  regularity: number; // 0..1 — how consistent the beat intervals are
  groove: number; // 0..1 — how musical / groovy the rhythm feels
  conflicts: string[]; // rhythmic conflict descriptions
  description: string;
}

export type NarrativeAct = "setup" | "rising" | "climax" | "falling" | "resolution";

export interface NarrativeSegment {
  act: NarrativeAct;
  startMs: number;
  endMs: number;
  componentIds: string[];
  description: string;
}

export interface NarrativeAnalysis {
  segments: NarrativeSegment[];
  hasCompleteArc: boolean;
  missingActs: NarrativeAct[];
  pacingScore: number; // 0..100
  coherenceScore: number; // 0..100
  description: string;
  suggestions: string[];
}

export type PersonalityTrait =
  | "bold"
  | "timid"
  | "graceful"
  | "clumsy"
  | "precise"
  | "chaotic"
  | "energetic"
  | "lethargic"
  | "playful"
  | "serious"
  | "elegant"
  | "raw";

export interface PersonalityProfile {
  traits: Partial<Record<PersonalityTrait, number>>; // 0..1
  dominantTraits: PersonalityTrait[];
  archetype: string; // e.g., "The Dancer", "The Sprinter", "The Sage"
  description: string;
}

export interface AttentionPoint {
  timeMs: number;
  componentId: string;
  intensity: number; // 0..1
  reason: string;
}

export interface AttentionFlow {
  points: AttentionPoint[];
  focalComponentId: string | null;
  conflicts: string[];
  coverageScore: number; // 0..100 — how well-distributed attention is
  description: string;
}

export interface IntelligenceReport {
  emotion: EmotionalAnalysis;
  rhythm: RhythmAnalysis;
  narrative: NarrativeAnalysis;
  personality: PersonalityProfile;
  attention: AttentionFlow;
  overallIntelligence: number; // 0..100
  summary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function easingFamily(e: Easing | undefined): string {
  if (!e) return "linear";
  if (e.type === "preset") {
    const n = e.name;
    if (/bounce|back|elastic|spring/.test(n)) return "bounce";
    if (/smooth|ease-in-out/.test(n)) return "smooth";
    if (/snappy|ease-in$/.test(n)) return "snappy";
    if (/ease-out/.test(n)) return "smooth";
    return n;
  }
  if (e.type === "spring") return "bounce";
  if (e.type === "bezier") return "bezier";
  return "linear";
}

function animatedProps(comp: MotionComponent): Set<string> {
  const s = new Set<string>();
  for (const kf of comp.keyframes) for (const k of Object.keys(kf.properties)) s.add(k);
  return s;
}

function maxDuration(spec: MotionSpec): number {
  return spec.components.reduce((m, c) => Math.max(m, c.delayMs + c.durationMs), 0);
}

// ---------------------------------------------------------------------------
// Emotional Impact Analysis
// ---------------------------------------------------------------------------

function analyzeEmotion(spec: MotionSpec): EmotionalAnalysis {
  const beats: EmotionalBeat[] = [];

  for (const comp of spec.components) {
    const family = easingFamily(comp.easing);
    const props = animatedProps(comp);

    // Delay creates anticipation
    if (comp.delayMs > 100) {
      beats.push({
        timeMs: 0,
        emotion: "anticipation",
        intensity: Math.min(1, comp.delayMs / 1000),
        source: `${comp.name} delayed ${comp.delayMs}ms`,
      });
    }

    // Bounce / spring creates delight and surprise
    if (family === "bounce") {
      beats.push({
        timeMs: comp.delayMs + comp.durationMs * 0.6,
        emotion: "delight",
        intensity: 0.7,
        source: `${comp.name} bounce easing`,
      });
      beats.push({
        timeMs: comp.delayMs + comp.durationMs * 0.3,
        emotion: "surprise",
        intensity: 0.5,
        source: `${comp.name} overshoot`,
      });
    }

    // Scale up creates urgency or joy
    if (props.has("scale")) {
      beats.push({
        timeMs: comp.delayMs + comp.durationMs * 0.5,
        emotion: comp.durationMs < 400 ? "urgency" : "joy",
        intensity: 0.6,
        source: `${comp.name} scale animation`,
      });
    }

    // Opacity fade creates calm or curiosity
    if (props.has("opacity") && !props.has("scale") && !props.has("translateY")) {
      beats.push({
        timeMs: comp.delayMs + comp.durationMs * 0.5,
        emotion: comp.durationMs > 1000 ? "calm" : "curiosity",
        intensity: 0.4,
        source: `${comp.name} opacity fade`,
      });
    }

    // Translate creates tension (movement = energy)
    if (props.has("translateY") || props.has("translateX")) {
      beats.push({
        timeMs: comp.delayMs + comp.durationMs * 0.5,
        emotion: family === "snappy" ? "tension" : "satisfaction",
        intensity: 0.55,
        source: `${comp.name} translate animation`,
      });
    }

    // Loops create trust through repetition
    if (comp.iterationCount === "infinite" || (typeof comp.iterationCount === "number" && comp.iterationCount > 3)) {
      beats.push({
        timeMs: comp.delayMs + comp.durationMs,
        emotion: "trust",
        intensity: 0.3,
        source: `${comp.name} looping`,
      });
    }

    // Smooth easing creates release
    if (family === "smooth" && comp.durationMs > 600) {
      beats.push({
        timeMs: comp.delayMs + comp.durationMs,
        emotion: "release",
        intensity: 0.4,
        source: `${comp.name} smooth settle`,
      });
    }
  }

  beats.sort((a, b) => a.timeMs - b.timeMs);

  // Determine dominant emotion
  const emotionCounts: Record<string, number> = {};
  for (const b of beats) emotionCounts[b.emotion] = (emotionCounts[b.emotion] || 0) + b.intensity;
  const sorted = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]);
  const dominantEmotion = (sorted[0]?.[0] as Emotion) || "calm";

  // Emotional range: how many distinct emotions
  const distinctEmotions = Object.keys(emotionCounts).length;
  const emotionalRange = Math.min(1, distinctEmotions / 8);

  // Emotional arc: analyze intensity over time
  const intensities = beats.map((b) => b.intensity);
  let arc: EmotionalAnalysis["emotionalArc"] = "flat";
  if (intensities.length > 1) {
    const firstHalf = intensities.slice(0, Math.floor(intensities.length / 2));
    const secondHalf = intensities.slice(Math.floor(intensities.length / 2));
    const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;
    if (Math.abs(diff) < 0.1) {
      // Check for oscillation
      let changes = 0;
      for (let i = 1; i < intensities.length; i++) {
        if (Math.abs(intensities[i] - intensities[i - 1]) > 0.2) changes++;
      }
      arc = changes > intensities.length * 0.4 ? "oscillating" : "flat";
    } else if (diff > 0.15) {
      arc = "rising";
    } else {
      arc = "falling";
    }
    // Check for peak (rises then falls)
    const maxIdx = intensities.indexOf(Math.max(...intensities));
    if (maxIdx > 0 && maxIdx < intensities.length - 1 && intensities[maxIdx] > firstAvg && intensities[maxIdx] > secondAvg) {
      arc = "peaked";
    }
  }

  const peakIntensity = intensities.length ? Math.max(...intensities) : 0;

  const arcLabels: Record<string, string> = {
    flat: "maintains a steady emotional tone throughout",
    rising: "builds emotional intensity as it progresses",
    falling: "starts with high intensity and gradually settles",
    peaked: "reaches an emotional peak in the middle, creating a satisfying arc",
    oscillating: "shifts between different emotional states, creating dynamic tension",
  };

  const emotionLabels: Record<string, string> = {
    anticipation: "anticipation",
    surprise: "surprise",
    delight: "delight",
    tension: "tension",
    release: "release",
    curiosity: "curiosity",
    satisfaction: "satisfaction",
    urgency: "urgency",
    calm: "calm",
    joy: "joy",
    trust: "trust",
    confusion: "confusion",
  };

  const narrativeDescription = beats.length === 0
    ? "This composition has minimal emotional content — consider adding motion to create emotional engagement."
    : `The motion ${arcLabels[arc]}. The dominant emotion is ${emotionLabels[dominantEmotion]}, ` +
      `with ${distinctEmotions} distinct emotional states across ${beats.length} beats. ` +
      `Peak intensity reaches ${(peakIntensity * 100).toFixed(0)}%.`;

  return {
    journey: beats,
    dominantEmotion,
    emotionalRange,
    emotionalArc: arc,
    peakIntensity,
    narrativeDescription,
  };
}

// ---------------------------------------------------------------------------
// Visual Rhythm Analysis
// ---------------------------------------------------------------------------

function analyzeRhythm(spec: MotionSpec): RhythmAnalysis {
  const beats: RhythmBeat[] = [];

  for (const comp of spec.components) {
    // Each keyframe is a rhythmic event
    for (const kf of comp.keyframes) {
      const t = comp.delayMs + kf.offset * comp.durationMs;
      const propCount = Object.keys(kf.properties).length;
      beats.push({
        timeMs: t,
        strength: Math.min(1, 0.3 + propCount * 0.2),
        componentId: comp.id,
      });
    }
    // Component start is a beat
    if (comp.keyframes.length === 0) {
      beats.push({
        timeMs: comp.delayMs,
        strength: 0.4,
        componentId: comp.id,
      });
    }
  }

  beats.sort((a, b) => a.timeMs - b.timeMs);

  // Calculate intervals between beats
  const intervals: number[] = [];
  for (let i = 1; i < beats.length; i++) {
    intervals.push(beats[i].timeMs - beats[i - 1].timeMs);
  }

  // Tempo estimation: average interval → BPM
  let tempoBpm = 0;
  let regularity = 0;
  if (intervals.length > 0) {
    const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    tempoBpm = avgInterval > 0 ? Math.round(60000 / avgInterval) : 0;
    // Regularity: low variance in intervals = high regularity
    if (intervals.length > 1) {
      const mean = avgInterval;
      const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length;
      const stdDev = Math.sqrt(variance);
      regularity = Math.max(0, 1 - stdDev / (mean || 1));
    } else {
      regularity = 0.5;
    }
  }

  // Rhythm type classification
  let rhythmType: RhythmType = "static";
  if (intervals.length === 0) {
    rhythmType = "static";
  } else if (regularity > 0.8) {
    rhythmType = "steady";
  } else if (intervals.length > 2) {
    // Check for accelerando (decreasing intervals) or decelerando (increasing)
    const first3 = intervals.slice(0, Math.min(3, intervals.length));
    const last3 = intervals.slice(-Math.min(3, intervals.length));
    const firstAvg = first3.reduce((s, v) => s + v, 0) / first3.length;
    const lastAvg = last3.reduce((s, v) => s + v, 0) / last3.length;
    if (lastAvg < firstAvg * 0.7) {
      rhythmType = "accelerando";
    } else if (lastAvg > firstAvg * 1.3) {
      rhythmType = "decelerando";
    } else if (regularity < 0.3) {
      rhythmType = "chaotic";
    } else {
      // Check for syncopation: off-beat patterns
      const offBeat = intervals.filter((v, i) => i % 2 === 1).reduce((s, v) => s + v, 0);
      const onBeat = intervals.filter((v, i) => i % 2 === 0).reduce((s, v) => s + v, 0);
      const offCount = intervals.filter((_, i) => i % 2 === 1).length;
      const onCount = intervals.filter((_, i) => i % 2 === 0).length;
      const offAvg = offBeat / (offCount || 1);
      const onAvg = onBeat / (onCount || 1);
      if (Math.abs(offAvg - onAvg) > onAvg * 0.3) {
        rhythmType = "syncopated";
      } else {
        rhythmType = regularity > 0.5 ? "rubato" : "chaotic";
      }
    }
  }

  // Groove: combination of regularity and beat strength
  const avgStrength = beats.length > 0 ? beats.reduce((s, b) => s + b.strength, 0) / beats.length : 0;
  const groove = Math.min(1, regularity * 0.6 + avgStrength * 0.4);

  // Conflicts: too many simultaneous beats
  const conflicts: string[] = [];
  const timeBuckets: Record<number, number> = {};
  for (const b of beats) {
    const bucket = Math.floor(b.timeMs / 100);
    timeBuckets[bucket] = (timeBuckets[bucket] || 0) + 1;
  }
  for (const [bucket, count] of Object.entries(timeBuckets)) {
    if (count > 4) {
      conflicts.push(`${count} events fire within ${Number(bucket) * 100}-${(Number(bucket) + 1) * 100}ms — consider staggering`);
    }
  }

  const rhythmLabels: Record<string, string> = {
    steady: "steady and metronomic",
    syncopated: "syncopated with off-be accents",
    rubato: "rubato — expressive timing with flexible tempo",
    accelerando: "accelerating — speeding up over time",
    decelerando: "decelerating — slowing down toward the end",
    chaotic: "chaotic and irregular",
    static: "minimal rhythmic activity",
  };

  const description = beats.length === 0
    ? "No rhythmic activity detected — add keyframes or animations to create rhythm."
    : `The motion has a ${rhythmLabels[rhythmType]} rhythm at approximately ${tempoBpm} BPM ` +
      `with ${(regularity * 100).toFixed(0)}% regularity. ` +
      (conflicts.length > 0 ? `${conflicts.length} rhythmic conflict(s) detected.` : "No rhythmic conflicts.");

  return {
    beats,
    tempoBpm,
    rhythmType,
    regularity,
    groove,
    conflicts,
    description,
  };
}

// ---------------------------------------------------------------------------
// Narrative Coherence Analysis
// ---------------------------------------------------------------------------

function analyzeNarrative(spec: MotionSpec): NarrativeAnalysis {
  const maxMs = maxDuration(spec) || 1000;
  const segments: NarrativeSegment[] = [];
  const suggestions: string[] = [];

  if (spec.components.length === 0) {
    return {
      segments: [],
      hasCompleteArc: false,
      missingActs: ["setup", "rising", "climax", "falling", "resolution"],
      pacingScore: 0,
      coherenceScore: 0,
      description: "No components to analyze.",
      suggestions: ["Add components to create a narrative arc."],
    };
  }

  // Divide timeline into 5 acts
  const actBoundaries = [0, maxMs * 0.2, maxMs * 0.5, maxMs * 0.7, maxMs * 0.85, maxMs];
  const actNames: NarrativeAct[] = ["setup", "rising", "climax", "falling", "resolution"];

  for (let i = 0; i < 5; i++) {
    const startMs = actBoundaries[i];
    const endMs = actBoundaries[i + 1];
    const comps = spec.components.filter((c) => {
      const mid = c.delayMs + c.durationMs / 2;
      return mid >= startMs && mid < endMs;
    });

    if (comps.length > 0) {
      const descriptions: Record<NarrativeAct, string> = {
        setup: `${comps.length} component(s) establish the initial state`,
        rising: `${comps.length} component(s) build energy and anticipation`,
        climax: `${comps.length} component(s) deliver the peak moment`,
        falling: `${comps.length} component(s) begin to settle`,
        resolution: `${comps.length} component(s) provide closure`,
      };
      segments.push({
        act: actNames[i],
        startMs,
        endMs,
        componentIds: comps.map((c) => c.id),
        description: descriptions[actNames[i]],
      });
    }
  }

  const presentActs = new Set(segments.map((s) => s.act));
  const missingActs = actNames.filter((a) => !presentActs.has(a));
  const hasCompleteArc = missingActs.length === 0;

  // Pacing score: based on how evenly distributed the acts are
  let pacingScore = 50;
  if (hasCompleteArc) pacingScore += 30;
  if (segments.length >= 3) pacingScore += 10;
  // Check if climax is in the right position (middle-ish)
  const climaxSeg = segments.find((s) => s.act === "climax");
  if (climaxSeg) {
    const climaxPos = climaxSeg.startMs / maxMs;
    if (climaxPos > 0.3 && climaxPos < 0.7) pacingScore += 10;
  }
  pacingScore = Math.min(100, pacingScore);

  // Coherence score: based on component count per act and easing consistency
  let coherenceScore = 60;
  const allEasings = spec.components.map((c) => easingFamily(c.easing));
  const uniqueEasings = new Set(allEasings);
  if (uniqueEasings.size <= 3) coherenceScore += 15; // consistent easing
  if (spec.components.length >= 3) coherenceScore += 10;
  if (missingActs.length <= 2) coherenceScore += 15;
  coherenceScore = Math.min(100, coherenceScore);

  // Suggestions
  if (missingActs.includes("setup")) {
    suggestions.push("Add an opening animation to establish the scene before the main action begins.");
  }
  if (missingActs.includes("climax")) {
    suggestions.push("Introduce a peak moment — a bold scale, color change, or particle burst in the middle of the timeline.");
  }
  if (missingActs.includes("resolution")) {
    suggestions.push("Add a settling animation at the end to provide closure and completion.");
  }
  if (uniqueEasings.size > 4) {
    suggestions.push(`Simplify easing — ${uniqueEasings.size} different easing families creates visual inconsistency.`);
  }
  const totalDelay = spec.components.reduce((s, c) => s + c.delayMs, 0);
  const avgDelay = totalDelay / spec.components.length;
  if (avgDelay < 50 && spec.components.length > 2) {
    suggestions.push("Add staggered delays between components to create a sequential narrative flow.");
  }

  const description = `The composition has ${segments.length}/5 narrative acts. ` +
    (hasCompleteArc
      ? "Complete narrative arc detected — setup, rising action, climax, falling action, and resolution are all present."
      : `Missing acts: ${missingActs.join(", ")}.`) +
    ` Pacing: ${pacingScore}/100. Coherence: ${coherenceScore}/100.`;

  return {
    segments,
    hasCompleteArc,
    missingActs,
    pacingScore,
    coherenceScore,
    description,
    suggestions,
  };
}

// ---------------------------------------------------------------------------
// Motion Personality
// ---------------------------------------------------------------------------

function analyzePersonality(spec: MotionSpec): PersonalityProfile {
  const traits: Partial<Record<PersonalityTrait, number>> = {};
  const comps = spec.components;
  if (comps.length === 0) {
    return {
      traits: {},
      dominantTraits: [],
      archetype: "The Void",
      description: "No motion to analyze.",
    };
  }

  const avgDuration = comps.reduce((s, c) => s + c.durationMs, 0) / comps.length;
  const bounceCount = comps.filter((c) => easingFamily(c.easing) === "bounce").length;
  const smoothCount = comps.filter((c) => easingFamily(c.easing) === "smooth").length;
  const snappyCount = comps.filter((c) => easingFamily(c.easing) === "snappy").length;
  const loopCount = comps.filter((c) => c.iterationCount === "infinite").length;
  const propVariety = new Set(comps.flatMap((c) => Array.from(animatedProps(c)))).size;
  const avgDelay = comps.reduce((s, c) => s + c.delayMs, 0) / comps.length;

  // Bold: fast + scale/rotate, many properties
  traits.bold = Math.min(1, (propVariety / 5) * 0.5 + (comps.filter((c) => animatedProps(c).has("scale") || animatedProps(c).has("rotate")).length / comps.length) * 0.5);

  // Timid: long delays, slow, opacity-only
  traits.timid = Math.min(1, (avgDelay / 500) * 0.4 + (comps.filter((c) => animatedProps(c).has("opacity") && animatedProps(c).size === 1).length / comps.length) * 0.6);

  // Graceful: smooth easing, long duration, few properties
  traits.graceful = Math.min(1, (smoothCount / comps.length) * 0.5 + Math.max(0, (avgDuration - 500) / 1000) * 0.3 + Math.max(0, 1 - propVariety / 4) * 0.2);

  // Clumsy: chaotic easing mix, many simultaneous animations
  const uniqueEasings = new Set(comps.map((c) => easingFamily(c.easing))).size;
  traits.clumsy = Math.min(1, Math.max(0, (uniqueEasings - 3) / 4) * 0.6 + (loopCount / comps.length) * 0.4);

  // Precise: snappy easing, consistent timing, linear
  traits.precise = Math.min(1, (snappyCount / comps.length) * 0.5 + (comps.filter((c) => easingFamily(c.easing) === "linear").length / comps.length) * 0.3 + Math.max(0, 1 - propVariety / 3) * 0.2);

  // Chaotic: many different easings, many properties, infinite loops
  traits.chaotic = Math.min(1, (uniqueEasings / 5) * 0.4 + (propVariety / 6) * 0.3 + (loopCount / comps.length) * 0.3);

  // Energetic: short duration, bounce, many components
  traits.energetic = Math.min(1, Math.max(0, (600 - avgDuration) / 500) * 0.4 + (bounceCount / comps.length) * 0.4 + Math.min(1, comps.length / 8) * 0.2);

  // Lethargic: very long duration, smooth, no loops
  traits.lethargic = Math.min(1, Math.max(0, (avgDuration - 1200) / 1000) * 0.6 + (smoothCount / comps.length) * 0.2 + Math.max(0, 1 - loopCount / comps.length) * 0.2);

  // Playful: bounce + scale + short duration
  traits.playful = Math.min(1, (bounceCount / comps.length) * 0.4 + (comps.filter((c) => animatedProps(c).has("scale")).length / comps.length) * 0.3 + Math.max(0, (500 - avgDuration) / 400) * 0.3);

  // Serious: long duration, smooth/linear, opacity/translateY only
  traits.serious = Math.min(1, Math.max(0, (avgDuration - 800) / 800) * 0.4 + ((smoothCount + comps.filter((c) => easingFamily(c.easing) === "linear").length) / comps.length) * 0.3 + Math.max(0, 1 - propVariety / 3) * 0.3);

  // Elegant: smooth, translateY/opacity, long duration, no loops
  traits.elegant = Math.min(1, (smoothCount / comps.length) * 0.3 + (comps.filter((c) => { const p = animatedProps(c); return p.has("translateY") || p.has("opacity"); }).length / comps.length) * 0.3 + Math.max(0, (avgDuration - 600) / 800) * 0.2 + Math.max(0, 1 - loopCount / comps.length) * 0.2);

  // Raw: linear easing, short duration, many properties
  traits.raw = Math.min(1, (comps.filter((c) => easingFamily(c.easing) === "linear").length / comps.length) * 0.5 + Math.max(0, (400 - avgDuration) / 300) * 0.3 + (propVariety / 5) * 0.2);

  // Find dominant traits (top 3)
  const sortedTraits = Object.entries(traits).sort((a, b) => b[1] - a[1]);
  const dominantTraits = sortedTraits.slice(0, 3).filter(([, v]) => v > 0.3).map(([k]) => k as PersonalityTrait);

  // Archetype: combine dominant traits into a character
  const archetypes: Record<string, string> = {
    "bold:energetic": "The Sprinter",
    "graceful:elegant": "The Dancer",
    "precise:serious": "The Architect",
    "playful:energetic": "The Jester",
    "chaotic:raw": "The Storm",
    "timid:lethargic": "The Observer",
    "bold:playful": "The Catalyst",
    "graceful:calm": "The Sage",
    "elegant:serious": "The Diplomat",
    "energetic:raw": "The Rebel",
  };
  const topTwo = dominantTraits.slice(0, 2).join(":");
  const archetype = archetypes[topTwo] || archetypes[dominantTraits[0] + ":"] || "The Creator";

  const traitLabels: Record<string, string> = {
    bold: "bold", timid: "timid", graceful: "graceful", clumsy: "clumsy",
    precise: "precise", chaotic: "chaotic", energetic: "energetic", lethargic: "lethargic",
    playful: "playful", serious: "serious", elegant: "elegant", raw: "raw",
  };

  const description = dominantTraits.length > 0
    ? `This motion personality is ${archetype} — characterized by ${dominantTraits.map((t) => traitLabels[t]).join(", ")}. ` +
      `Average duration ${Math.round(avgDuration)}ms, ${uniqueEasings} easing families, ${propVariety} animated properties.`
    : "This motion has no discernible personality — add more animation parameters to define its character.";

  return { traits, dominantTraits, archetype, description };
}

// ---------------------------------------------------------------------------
// Attention Flow Analysis
// ---------------------------------------------------------------------------

function analyzeAttention(spec: MotionSpec): AttentionFlow {
  const points: AttentionPoint[] = [];
  const conflicts: string[] = [];

  for (const comp of spec.components) {
    const family = easingFamily(comp.easing);
    const props = animatedProps(comp);

    // Scale and rotate attract the most attention
    if (props.has("scale")) {
      points.push({
        timeMs: comp.delayMs + comp.durationMs * 0.5,
        componentId: comp.id,
        intensity: 0.9,
        reason: "scale transformation",
      });
    }
    if (props.has("rotate")) {
      points.push({
        timeMs: comp.delayMs + comp.durationMs * 0.5,
        componentId: comp.id,
        intensity: 0.7,
        reason: "rotation",
      });
    }
    // Bounce/overshoot attracts attention
    if (family === "bounce") {
      points.push({
        timeMs: comp.delayMs + comp.durationMs * 0.6,
        componentId: comp.id,
        intensity: 0.8,
        reason: "bounce overshoot",
      });
    }
    // Color changes attract attention
    if (props.has("color") || props.has("backgroundColor")) {
      points.push({
        timeMs: comp.delayMs + comp.durationMs * 0.5,
        componentId: comp.id,
        intensity: 0.6,
        reason: "color change",
      });
    }
    // Translate attracts moderate attention
    if (props.has("translateX") || props.has("translateY")) {
      points.push({
        timeMs: comp.delayMs + comp.durationMs * 0.5,
        componentId: comp.id,
        intensity: 0.5,
        reason: "position change",
      });
    }
    // Opacity is subtle
    if (props.has("opacity") && props.size === 1) {
      points.push({
        timeMs: comp.delayMs + comp.durationMs * 0.5,
        componentId: comp.id,
        intensity: 0.3,
        reason: "opacity fade",
      });
    }
  }

  points.sort((a, b) => a.timeMs - b.timeMs);

  // Focal component: the one with the highest cumulative attention
  const attentionByComp: Record<string, number> = {};
  for (const p of points) attentionByComp[p.componentId] = (attentionByComp[p.componentId] || 0) + p.intensity;
  const focalEntry = Object.entries(attentionByComp).sort((a, b) => b[1] - a[1])[0];
  const focalComponentId = focalEntry?.[0] || null;

  // Conflicts: multiple high-intensity points at the same time
  const timeBuckets: Record<number, AttentionPoint[]> = {};
  for (const p of points) {
    const bucket = Math.floor(p.timeMs / 200);
    if (!timeBuckets[bucket]) timeBuckets[bucket] = [];
    timeBuckets[bucket].push(p);
  }
  for (const [bucket, pts] of Object.entries(timeBuckets)) {
    const highIntensity = pts.filter((p) => p.intensity > 0.6);
    if (highIntensity.length > 2) {
      const compNames = highIntensity.map((p) => {
        const c = spec.components.find((c) => c.id === p.componentId);
        return c?.name || p.componentId;
      });
      conflicts.push(`Attention conflict at ${Number(bucket) * 200}ms: ${compNames.join(", ")} compete for focus`);
    }
  }

  // Coverage: how well-distributed attention is across the timeline
  const maxMs = maxDuration(spec) || 1000;
  const bucketCount = Object.keys(timeBuckets).length;
  const totalBuckets = Math.ceil(maxMs / 200);
  const coverageScore = totalBuckets > 0 ? Math.min(100, (bucketCount / totalBuckets) * 100) : 0;

  const focalName = focalComponentId ? spec.components.find((c) => c.id === focalComponentId)?.name : null;
  const description = points.length === 0
    ? "No attention-grabbing motion detected."
    : `Primary focal point: ${focalName || "none"}. ` +
      `${points.length} attention events across the timeline. ` +
      `${conflicts.length} attention conflict(s). ` +
      `Timeline coverage: ${coverageScore.toFixed(0)}%.`;

  return { points, focalComponentId, conflicts, coverageScore, description };
}

// ---------------------------------------------------------------------------
// Full Intelligence Report
// ---------------------------------------------------------------------------

export function analyzeIntelligence(spec: MotionSpec): IntelligenceReport {
  const emotion = analyzeEmotion(spec);
  const rhythm = analyzeRhythm(spec);
  const narrative = analyzeNarrative(spec);
  const personality = analyzePersonality(spec);
  const attention = analyzeAttention(spec);

  // Overall intelligence score: weighted combination
  const overallIntelligence = Math.round(
    emotion.emotionalRange * 20 +
    rhythm.groove * 20 +
    narrative.coherenceScore * 0.2 +
    personality.dominantTraits.length * 5 +
    attention.coverageScore * 0.15,
  );

  const summary = `Motion Intelligence Report: ${personality.archetype} personality, ` +
    `${emotion.dominantEmotion} dominant emotion, ` +
    `${rhythm.tempoBpm} BPM ${rhythm.rhythmType} rhythm, ` +
    `${narrative.segments.length}/5 narrative acts, ` +
    `${attention.conflicts.length} attention conflicts. ` +
    `Overall intelligence: ${overallIntelligence}/100.`;

  return { emotion, rhythm, narrative, personality, attention, overallIntelligence, summary };
}
