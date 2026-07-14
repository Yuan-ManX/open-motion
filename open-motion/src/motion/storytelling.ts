import type { MotionSpec, MotionComponent } from "@openmotion/shared";

/**
 * Motion Storytelling Engine — maps narrative structure onto motion timelines.
 * Translates story beats, emotional arcs, and dramatic pacing into concrete
 * motion parameters: delays, durations, easing curves, and intensity scales.
 * The agent can request "a 3-act hero journey" or "build tension to a climax"
 * and the engine produces a beat-by-beat motion plan.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StoryAct = "setup" | "rising" | "climax" | "falling" | "resolution";
export type StoryGenre = "hero" | "mystery" | "romance" | "comedy" | "thriller" | "documentary" | "fantasy" | "horror";
export type EmotionalTone = "calm" | "curious" | "tense" | "joyful" | "sad" | "angry" | "fearful" | "surprised" | "triumphant" | "contemplative";

export interface StoryBeat {
  id: string;
  name: string;
  act: StoryAct;
  startMs: number;
  durationMs: number;
  emotionalTone: EmotionalTone;
  intensity: number; // 0..1
  componentIds: string[]; // components active in this beat
  description: string;
}

export interface StoryArc {
  id: string;
  name: string;
  genre: StoryGenre;
  beats: StoryBeat[];
  totalDurationMs: number;
  emotionalArc: EmotionalTone[];
  climaxPosition: number; // 0..1 — where the climax falls
  pacingScore: number; // 0..100
  description: string;
}

export interface PacingAnalysis {
  tempoCurve: { time: number; tempo: number }[];
  avgTempo: number;
  tempoVariance: number;
  slowSegments: { startMs: number; endMs: number; reason: string }[];
  fastSegments: { startMs: number; endMs: number; reason: string }[];
  recommendations: string[];
  overallScore: number;
}

export interface SceneTransition {
  id: string;
  fromBeatId: string;
  toBeatId: string;
  type: "cut" | "fade" | "dissolve" | "wipe" | "zoom" | "slide";
  durationMs: number;
  easing: string;
  description: string;
}

export interface StorytellingPlan {
  arc: StoryArc;
  transitions: SceneTransition[];
  pacing: PacingAnalysis;
  componentAssignments: { componentId: string; beatIds: string[]; role: string }[];
  description: string;
}

// ---------------------------------------------------------------------------
// Genre templates — predefined story structures
// ---------------------------------------------------------------------------

interface GenreTemplate {
  name: string;
  acts: { act: StoryAct; weight: number; intensity: number; tone: EmotionalTone }[];
  climaxAct: StoryAct;
  description: string;
}

const GENRE_TEMPLATES: Record<StoryGenre, GenreTemplate> = {
  hero: {
    name: "Hero's Journey",
    acts: [
      { act: "setup", weight: 0.15, intensity: 0.2, tone: "calm" },
      { act: "rising", weight: 0.35, intensity: 0.5, tone: "curious" },
      { act: "climax", weight: 0.2, intensity: 1.0, tone: "triumphant" },
      { act: "falling", weight: 0.15, intensity: 0.6, tone: "contemplative" },
      { act: "resolution", weight: 0.15, intensity: 0.3, tone: "joyful" },
    ],
    climaxAct: "climax",
    description: "Classic hero journey — ordinary world, call to adventure, ordeal, transformation, return.",
  },
  mystery: {
    name: "Mystery Unfolding",
    acts: [
      { act: "setup", weight: 0.2, intensity: 0.3, tone: "curious" },
      { act: "rising", weight: 0.4, intensity: 0.6, tone: "tense" },
      { act: "climax", weight: 0.15, intensity: 0.9, tone: "surprised" },
      { act: "falling", weight: 0.15, intensity: 0.4, tone: "contemplative" },
      { act: "resolution", weight: 0.1, intensity: 0.2, tone: "calm" },
    ],
    climaxAct: "climax",
    description: "Mystery structure — clues accumulate, tension builds, revelation, aftermath.",
  },
  romance: {
    name: "Romantic Arc",
    acts: [
      { act: "setup", weight: 0.15, intensity: 0.3, tone: "calm" },
      { act: "rising", weight: 0.3, intensity: 0.6, tone: "joyful" },
      { act: "climax", weight: 0.2, intensity: 0.9, tone: "joyful" },
      { act: "falling", weight: 0.2, intensity: 0.5, tone: "contemplative" },
      { act: "resolution", weight: 0.15, intensity: 0.4, tone: "joyful" },
    ],
    climaxAct: "climax",
    description: "Romantic journey — meeting, growing connection, peak moment, reflection, togetherness.",
  },
  comedy: {
    name: "Comedic Rhythm",
    acts: [
      { act: "setup", weight: 0.15, intensity: 0.4, tone: "joyful" },
      { act: "rising", weight: 0.3, intensity: 0.6, tone: "joyful" },
      { act: "climax", weight: 0.2, intensity: 0.95, tone: "surprised" },
      { act: "falling", weight: 0.2, intensity: 0.5, tone: "joyful" },
      { act: "resolution", weight: 0.15, intensity: 0.3, tone: "joyful" },
    ],
    climaxAct: "climax",
    description: "Comedic structure — setup, escalation, punchline, cooldown, button.",
  },
  thriller: {
    name: "Thriller Escalation",
    acts: [
      { act: "setup", weight: 0.1, intensity: 0.3, tone: "calm" },
      { act: "rising", weight: 0.35, intensity: 0.7, tone: "tense" },
      { act: "climax", weight: 0.25, intensity: 1.0, tone: "fearful" },
      { act: "falling", weight: 0.15, intensity: 0.5, tone: "tense" },
      { act: "resolution", weight: 0.15, intensity: 0.2, tone: "calm" },
    ],
    climaxAct: "climax",
    description: "Thriller structure — false calm, escalating dread, peak terror, aftermath, release.",
  },
  documentary: {
    name: "Documentary Flow",
    acts: [
      { act: "setup", weight: 0.2, intensity: 0.3, tone: "calm" },
      { act: "rising", weight: 0.3, intensity: 0.5, tone: "curious" },
      { act: "climax", weight: 0.2, intensity: 0.7, tone: "surprised" },
      { act: "falling", weight: 0.15, intensity: 0.4, tone: "contemplative" },
      { act: "resolution", weight: 0.15, intensity: 0.3, tone: "contemplative" },
    ],
    climaxAct: "climax",
    description: "Documentary structure — context, evidence building, key revelation, analysis, conclusion.",
  },
  fantasy: {
    name: "Fantasy Quest",
    acts: [
      { act: "setup", weight: 0.15, intensity: 0.25, tone: "calm" },
      { act: "rising", weight: 0.3, intensity: 0.55, tone: "curious" },
      { act: "climax", weight: 0.25, intensity: 0.95, tone: "triumphant" },
      { act: "falling", weight: 0.15, intensity: 0.5, tone: "joyful" },
      { act: "resolution", weight: 0.15, intensity: 0.35, tone: "calm" },
    ],
    climaxAct: "climax",
    description: "Fantasy quest — ordinary world, magical call, epic confrontation, reward, new balance.",
  },
  horror: {
    name: "Horror Descent",
    acts: [
      { act: "setup", weight: 0.15, intensity: 0.2, tone: "calm" },
      { act: "rising", weight: 0.3, intensity: 0.65, tone: "fearful" },
      { act: "climax", weight: 0.25, intensity: 1.0, tone: "fearful" },
      { act: "falling", weight: 0.15, intensity: 0.6, tone: "tense" },
      { act: "resolution", weight: 0.15, intensity: 0.25, tone: "calm" },
    ],
    climaxAct: "climax",
    description: "Horror descent — false safety, growing dread, terrifying peak, lingering dread, uneasy calm.",
  },
};

// ---------------------------------------------------------------------------
// Beat name generation
// ---------------------------------------------------------------------------

const BEAT_NAMES: Record<StoryAct, string[]> = {
  setup: ["Opening", "Introduction", "Setting the Scene", "The Ordinary World", "Establishing"],
  rising: ["Building Tension", "The Call", "Rising Action", "Complication", "Escalation"],
  climax: ["The Peak", "The Turning Point", "Climax", "The Confrontation", "The Revelation"],
  falling: ["Aftermath", "Cooling Down", "The Descent", "Unwinding", "Reflection"],
  resolution: ["Conclusion", "Resolution", "The New Normal", "Final Note", "Closing"],
};

function pickBeatName(act: StoryAct, index: number): string {
  const names = BEAT_NAMES[act];
  return names[index % names.length];
}

// ---------------------------------------------------------------------------
// Story arc creation
// ---------------------------------------------------------------------------

let beatCounter = 0;
function nextBeatId(): string {
  beatCounter++;
  return `beat_${beatCounter.toString().padStart(3, "0")}`;
}

export function createStoryArc(
  genre: StoryGenre,
  totalDurationMs: number,
  components: MotionComponent[],
): StoryArc {
  const template = GENRE_TEMPLATES[genre];
  const beats: StoryBeat[] = [];
  const emotionalArc: EmotionalTone[] = [];

  let currentTime = 0;
  for (const actDef of template.acts) {
    const actDuration = Math.round(totalDurationMs * actDef.weight);
    const beatCount = actDef.act === "climax" ? 1 : 2;
    const beatDuration = Math.round(actDuration / beatCount);

    for (let i = 0; i < beatCount; i++) {
      const beatStart = currentTime + i * beatDuration;
      const intensity = actDef.intensity * (0.8 + 0.2 * (i / beatCount));
      const beat: StoryBeat = {
        id: nextBeatId(),
        name: pickBeatName(actDef.act, i),
        act: actDef.act,
        startMs: beatStart,
        durationMs: beatDuration,
        emotionalTone: actDef.tone,
        intensity: Math.min(1, intensity),
        componentIds: components.slice(i, i + 2).map((c) => c.id),
        description: `${actDef.act} beat — ${actDef.tone} tone at ${Math.round(intensity * 100)}% intensity`,
      };
      beats.push(beat);
      emotionalArc.push(actDef.tone);
    }

    currentTime += actDuration;
  }

  const climaxBeat = beats.find((b) => b.act === "climax");
  const climaxPosition = climaxBeat ? climaxBeat.startMs / totalDurationMs : 0.5;

  // Pacing score: higher if climax is at 40-60% and beats have varied intensity
  const intensities = beats.map((b) => b.intensity);
  const variance = intensities.reduce((s, v) => s + Math.pow(v - intensities.reduce((a, b) => a + b, 0) / intensities.length, 2), 0) / intensities.length;
  const climaxPositionScore = climaxPosition >= 0.35 && climaxPosition <= 0.65 ? 30 : 15;
  const varianceScore = Math.min(30, variance * 100);
  const completenessScore = template.acts.every((a) => beats.some((b) => b.act === a.act)) ? 25 : 10;
  const pacingScore = Math.min(100, 20 + climaxPositionScore + varianceScore + completenessScore);

  return {
    id: `arc_${genre}_${Date.now()}`,
    name: template.name,
    genre,
    beats,
    totalDurationMs,
    emotionalArc,
    climaxPosition,
    pacingScore,
    description: template.description,
  };
}

// ---------------------------------------------------------------------------
// Pacing analysis
// ---------------------------------------------------------------------------

export function analyzePacing(arc: StoryArc): PacingAnalysis {
  const tempoCurve: { time: number; tempo: number }[] = [];
  const tempos: number[] = [];

  for (const beat of arc.beats) {
    const tempo = beat.intensity * 120 + 40; // 40-160 BPM range
    tempoCurve.push({ time: beat.startMs, tempo });
    tempos.push(tempo);
  }

  const avgTempo = tempos.reduce((a, b) => a + b, 0) / tempos.length;
  const tempoVariance = tempos.reduce((s, t) => s + Math.pow(t - avgTempo, 2), 0) / tempos.length;

  const slowSegments: { startMs: number; endMs: number; reason: string }[] = [];
  const fastSegments: { startMs: number; endMs: number; reason: string }[] = [];

  for (const beat of arc.beats) {
    const tempo = beat.intensity * 120 + 40;
    if (tempo < avgTempo * 0.7) {
      slowSegments.push({
        startMs: beat.startMs,
        endMs: beat.startMs + beat.durationMs,
        reason: `${beat.name} runs at ${Math.round(tempo)} BPM — well below the average ${Math.round(avgTempo)} BPM`,
      });
    }
    if (tempo > avgTempo * 1.4) {
      fastSegments.push({
        startMs: beat.startMs,
        endMs: beat.startMs + beat.durationMs,
        reason: `${beat.name} runs at ${Math.round(tempo)} BPM — well above the average ${Math.round(avgTempo)} BPM`,
      });
    }
  }

  const recommendations: string[] = [];
  if (slowSegments.length > fastSegments.length) {
    recommendations.push("Consider tightening the slow segments — the story drags in the middle acts.");
  }
  if (fastSegments.length > slowSegments.length) {
    recommendations.push("Consider adding breathing room — too many fast beats may overwhelm the viewer.");
  }
  if (arc.climaxPosition < 0.3) {
    recommendations.push("The climax arrives too early — build more rising action before the peak.");
  }
  if (arc.climaxPosition > 0.7) {
    recommendations.push("The climax arrives too late — the viewer may lose interest before the peak.");
  }
  const missingActs = (["setup", "rising", "climax", "falling", "resolution"] as StoryAct[]).filter(
    (a) => !arc.beats.some((b) => b.act === a),
  );
  if (missingActs.length > 0) {
    recommendations.push(`Missing acts: ${missingActs.join(", ")} — add beats for a complete story arc.`);
  }
  if (recommendations.length === 0) {
    recommendations.push("Pacing is well-balanced — the story flows naturally from setup to resolution.");
  }

  const overallScore = Math.max(0, 100 - slowSegments.length * 10 - fastSegments.length * 5 - missingActs.length * 15);

  return { tempoCurve, avgTempo, tempoVariance, slowSegments, fastSegments, recommendations, overallScore };
}

// ---------------------------------------------------------------------------
// Scene transitions
// ---------------------------------------------------------------------------

export function generateTransitions(arc: StoryArc): SceneTransition[] {
  const transitions: SceneTransition[] = [];

  for (let i = 0; i < arc.beats.length - 1; i++) {
    const from = arc.beats[i];
    const to = arc.beats[i + 1];
    const intensityChange = Math.abs(to.intensity - from.intensity);

    let type: SceneTransition["type"];
    if (intensityChange > 0.5) {
      type = "cut";
    } else if (intensityChange > 0.3) {
      type = "zoom";
    } else if (intensityChange > 0.15) {
      type = "slide";
    } else if (from.act !== to.act) {
      type = "dissolve";
    } else {
      type = "fade";
    }

    const durationMs = type === "cut" ? 0 : Math.round(200 + intensityChange * 400);
    const easing = type === "cut" ? "linear" : intensityChange > 0.3 ? "ease-in-out" : "ease-out";

    transitions.push({
      id: `trans_${i + 1}`,
      fromBeatId: from.id,
      toBeatId: to.id,
      type,
      durationMs,
      easing,
      description: `${type} transition from "${from.name}" to "${to.name}" — ${durationMs}ms ${easing}`,
    });
  }

  return transitions;
}

// ---------------------------------------------------------------------------
// Component assignment — map components to beats based on their timing
// ---------------------------------------------------------------------------

export function assignComponentsToBeats(arc: StoryArc, components: MotionComponent[]): { componentId: string; beatIds: string[]; role: string }[] {
  const assignments: { componentId: string; beatIds: string[]; role: string }[] = [];

  for (const comp of components) {
    const compEnd = comp.delayMs + comp.durationMs;
    const activeBeats = arc.beats.filter((beat) => {
      const beatEnd = beat.startMs + beat.durationMs;
      return comp.delayMs < beatEnd && compEnd > beat.startMs;
    });

    let role = "background";
    const climaxBeat = activeBeats.find((b) => b.act === "climax");
    if (climaxBeat) role = "protagonist";
    else if (activeBeats.some((b) => b.act === "rising")) role = "supporting";
    else if (activeBeats.some((b) => b.act === "setup")) role = "introduction";

    assignments.push({
      componentId: comp.id,
      beatIds: activeBeats.map((b) => b.id),
      role,
    });
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// Main storytelling plan generator
// ---------------------------------------------------------------------------

export function createStorytellingPlan(
  genre: StoryGenre,
  totalDurationMs: number,
  components: MotionComponent[],
): StorytellingPlan {
  const arc = createStoryArc(genre, totalDurationMs, components);
  const transitions = generateTransitions(arc);
  const pacing = analyzePacing(arc);
  const componentAssignments = assignComponentsToBeats(arc, components);

  return {
    arc,
    transitions,
    pacing,
    componentAssignments,
    description: `${arc.name} — ${arc.beats.length} beats across ${arc.totalDurationMs}ms. Climax at ${Math.round(arc.climaxPosition * 100)}%. Pacing score: ${arc.pacingScore}/100.`,
  };
}

// ---------------------------------------------------------------------------
// Apply storytelling plan to motion spec — adjusts component timing to match beats
// ---------------------------------------------------------------------------

export interface AppliedChange {
  componentId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
}

export function applyStorytellingPlan(spec: MotionSpec, plan: StorytellingPlan): { changes: AppliedChange[] } {
  const changes: AppliedChange[] = [];

  for (const assignment of plan.componentAssignments) {
    const comp = spec.components.find((c) => c.id === assignment.componentId);
    if (!comp) continue;

    const firstBeat = plan.arc.beats.find((b) => b.id === assignment.beatIds[0]);
    if (!firstBeat) continue;

    // Align component delay to beat start
    if (comp.delayMs !== firstBeat.startMs) {
      changes.push({
        componentId: comp.id,
        field: "delayMs",
        oldValue: `${comp.delayMs}ms`,
        newValue: `${firstBeat.startMs}ms`,
        reason: `Aligned to ${firstBeat.name} beat start`,
      });
    }

    // Scale duration by beat intensity (higher intensity = faster motion)
    const avgIntensity = assignment.beatIds.reduce((s, bid) => {
      const b = plan.arc.beats.find((x) => x.id === bid);
      return s + (b?.intensity ?? 0.5);
    }, 0) / Math.max(1, assignment.beatIds.length);

    const intensityScale = 1.5 - avgIntensity * 0.8; // high intensity → shorter duration
    const newDuration = Math.round(comp.durationMs * intensityScale);
    if (Math.abs(newDuration - comp.durationMs) > 50) {
      changes.push({
        componentId: comp.id,
        field: "durationMs",
        oldValue: `${comp.durationMs}ms`,
        newValue: `${newDuration}ms`,
        reason: `Scaled by intensity ${Math.round(avgIntensity * 100)}% (role: ${assignment.role})`,
      });
    }
  }

  return { changes };
}

// ---------------------------------------------------------------------------
// List available genres
// ---------------------------------------------------------------------------

export function listStoryGenres(): { id: StoryGenre; name: string; description: string }[] {
  return (Object.keys(GENRE_TEMPLATES) as StoryGenre[]).map((id) => ({
    id,
    name: GENRE_TEMPLATES[id].name,
    description: GENRE_TEMPLATES[id].description,
  }));
}
