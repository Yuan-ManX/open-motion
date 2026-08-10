/** Motion Sequence Planner — plans multi-scene narrative motion sequences with ordered scenes and unified timelines. */

import type { MotionSpec } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Emotional tone for a scene — drives easing, timing, and intensity. */
export type EmotionalTone =
  | "calm"
  | "playful"
  | "dramatic"
  | "mysterious"
  | "energetic"
  | "nostalgic"
  | "triumphant"
  | "tense"
  | "hopeful"
  | "melancholic";

/** Scene transition type — how one scene connects to the next. */
export type TransitionType =
  | "cut"
  | "dissolve"
  | "fade-to-black"
  | "fade-to-white"
  | "wipe-left"
  | "wipe-right"
  | "slide-up"
  | "slide-down"
  | "zoom-in"
  | "zoom-out"
  | "morph";

/** Narrative arc template — predefined story structures. */
export type NarrativeArcId =
  | "hero-journey"
  | "product-launch"
  | "tutorial"
  | "product-reveal"
  | "emotional-arc"
  | "action-sequence"
  | "documentary"
  | "celebration";

/** A single scene in a motion sequence. */
export interface Scene {
  /** Unique scene identifier. */
  id: string;
  /** Scene name/title. */
  name: string;
  /** Emotional tone of the scene. */
  tone: EmotionalTone;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Transition to use when entering this scene. */
  entryTransition: TransitionType;
  /** Transition duration in milliseconds. */
  transitionMs: number;
  /** Scene description / intent. */
  description: string;
  /** Key moments within the scene (as fractions of scene duration 0-1). */
  beats: SceneBeat[];
  /** Component IDs that belong to this scene. */
  componentIds: string[];
}

/** A key moment within a scene. */
export interface SceneBeat {
  /** Beat label. */
  label: string;
  /** Position within the scene as a fraction (0-1). */
  position: number;
  /** Beat intensity (0-1). */
  intensity: number;
}

/** A complete planned motion sequence. */
export interface PlannedSequence {
  /** Sequence identifier. */
  id: string;
  /** Sequence name. */
  name: string;
  /** Narrative arc used for planning. */
  arc: NarrativeArcId;
  /** Ordered list of scenes. */
  scenes: Scene[];
  /** Total duration in milliseconds. */
  totalDurationMs: number;
  /** Total frame count at 60fps. */
  totalFrames: number;
  /** Pacing analysis. */
  pacing: PacingAnalysis;
  /** Emotional arc data points. */
  emotionalArc: EmotionalArcPoint[];
  /** Assembly timeline with absolute positions. */
  timeline: SequenceTimelineEntry[];
}

/** A timeline entry with absolute scene positioning. */
export interface SequenceTimelineEntry {
  componentId: string;
  name: string;
  sceneId: string;
  sceneIndex: number;
  sceneName: string;
  startMs: number;
  endMs: number;
  startFrame: number;
  endFrame: number;
  durationMs: number;
  delayMs: number;
  layer: number;
}

/** Pacing analysis for a sequence. */
export interface PacingAnalysis {
  /** Average scene duration in ms. */
  avgSceneDurationMs: number;
  /** Pacing rhythm: how scene durations vary. */
  rhythm: "uniform" | "accelerating" | "decelerating" | "varied";
  /** Energy curve — intensity over time. */
  energyCurve: { time: number; energy: number }[];
  /** Recommended tempo in BPM. */
  recommendedBpm: number;
  /** Pacing score (0-100, higher is better). */
  score: number;
  /** Pacing notes. */
  notes: string[];
}

/** A point on the emotional arc. */
export interface EmotionalArcPoint {
  /** Time in milliseconds. */
  timeMs: number;
  /** Scene index. */
  sceneIndex: number;
  /** Scene name. */
  sceneName: string;
  /** Emotional valence (-1 to 1, negative=sad, positive=happy). */
  valence: number;
  /** Emotional arousal (0-1, calm to excited). */
  arousal: number;
  /** Tone label. */
  tone: EmotionalTone;
}

/** Options for planning a sequence. */
export interface SequencePlanOptions {
  /** Natural language description of the desired sequence. */
  description: string;
  /** Narrative arc template. */
  arc?: NarrativeArcId;
  /** Target total duration in milliseconds. */
  totalDurationMs?: number;
  /** Number of scenes. */
  sceneCount?: number;
  /** Frames per second. */
  fps?: number;
  /** Existing spec to organize into scenes. */
  baseSpec?: MotionSpec;
}

// ---------------------------------------------------------------------------
// Narrative Arc Templates
// ---------------------------------------------------------------------------

interface ArcTemplate {
  id: NarrativeArcId;
  name: string;
  description: string;
  /** Default scene count. */
  defaultSceneCount: number;
  /** Tone progression for each scene. */
  toneProgression: EmotionalTone[];
  /** Beat structure per scene. */
  beatStructure: { label: string; position: number; intensity: number }[];
}

const ARC_TEMPLATES: ArcTemplate[] = [
  {
    id: "hero-journey",
    name: "Hero Journey",
    description: "Classic hero's journey — ordinary world, call to adventure, trials, climax, and return.",
    defaultSceneCount: 5,
    toneProgression: ["calm", "mysterious", "tense", "triumphant", "hopeful"],
    beatStructure: [
      { label: "Status Quo", position: 0.1, intensity: 0.3 },
      { label: "Inciting Incident", position: 0.35, intensity: 0.6 },
      { label: "Rising Action", position: 0.6, intensity: 0.7 },
      { label: "Climax", position: 0.85, intensity: 1.0 },
      { label: "Resolution", position: 1.0, intensity: 0.4 },
    ],
  },
  {
    id: "product-launch",
    name: "Product Launch",
    description: "Build anticipation, reveal the product, showcase features, and end with a call to action.",
    defaultSceneCount: 4,
    toneProgression: ["mysterious", "energetic", "playful", "triumphant"],
    beatStructure: [
      { label: "Tease", position: 0.15, intensity: 0.5 },
      { label: "Reveal", position: 0.4, intensity: 0.9 },
      { label: "Features", position: 0.7, intensity: 0.7 },
      { label: "CTA", position: 1.0, intensity: 0.8 },
    ],
  },
  {
    id: "tutorial",
    name: "Tutorial",
    description: "Clear, paced tutorial — intro, step-by-step guidance, recap, and encouragement.",
    defaultSceneCount: 4,
    toneProgression: ["calm", "hopeful", "calm", "hopeful"],
    beatStructure: [
      { label: "Introduction", position: 0.1, intensity: 0.3 },
      { label: "Step 1", position: 0.35, intensity: 0.5 },
      { label: "Step 2", position: 0.65, intensity: 0.5 },
      { label: "Recap", position: 1.0, intensity: 0.4 },
    ],
  },
  {
    id: "product-reveal",
    name: "Product Reveal",
    description: "Dramatic product reveal — mystery, buildup, climax reveal, and celebration.",
    defaultSceneCount: 3,
    toneProgression: ["mysterious", "dramatic", "triumphant"],
    beatStructure: [
      { label: "Mystery", position: 0.2, intensity: 0.4 },
      { label: "Buildup", position: 0.6, intensity: 0.7 },
      { label: "Reveal", position: 1.0, intensity: 1.0 },
    ],
  },
  {
    id: "emotional-arc",
    name: "Emotional Arc",
    description: "Emotional journey from low to high — struggle, turning point, and uplifting resolution.",
    defaultSceneCount: 4,
    toneProgression: ["melancholic", "tense", "hopeful", "triumphant"],
    beatStructure: [
      { label: "Struggle", position: 0.15, intensity: 0.4 },
      { label: "Crisis", position: 0.4, intensity: 0.6 },
      { label: "Turning Point", position: 0.7, intensity: 0.8 },
      { label: "Resolution", position: 1.0, intensity: 0.7 },
    ],
  },
  {
    id: "action-sequence",
    name: "Action Sequence",
    description: "High-energy action sequence — buildup, peak action, climax, and cool-down.",
    defaultSceneCount: 4,
    toneProgression: ["energetic", "tense", "dramatic", "calm"],
    beatStructure: [
      { label: "Buildup", position: 0.15, intensity: 0.5 },
      { label: "Action", position: 0.45, intensity: 0.9 },
      { label: "Climax", position: 0.75, intensity: 1.0 },
      { label: "Cool-down", position: 1.0, intensity: 0.3 },
    ],
  },
  {
    id: "documentary",
    name: "Documentary",
    description: "Documentary-style — calm introduction, exploration, insight, and reflection.",
    defaultSceneCount: 4,
    toneProgression: ["calm", "nostalgic", "hopeful", "calm"],
    beatStructure: [
      { label: "Context", position: 0.1, intensity: 0.3 },
      { label: "Exploration", position: 0.4, intensity: 0.5 },
      { label: "Insight", position: 0.75, intensity: 0.6 },
      { label: "Reflection", position: 1.0, intensity: 0.3 },
    ],
  },
  {
    id: "celebration",
    name: "Celebration",
    description: "Festive celebration — anticipation, joy, peak celebration, and warm closing.",
    defaultSceneCount: 3,
    toneProgression: ["hopeful", "energetic", "playful"],
    beatStructure: [
      { label: "Anticipation", position: 0.2, intensity: 0.4 },
      { label: "Celebration", position: 0.6, intensity: 0.9 },
      { label: "Warm Close", position: 1.0, intensity: 0.5 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tone-to-Easing/Transition Mapping
// ---------------------------------------------------------------------------

const TONE_CONFIG: Record<EmotionalTone, {
  easing: string;
  transition: TransitionType;
  intensity: number;
  valence: number;
  arousal: number;
}> = {
  calm:         { easing: "ease-in-out", transition: "dissolve",     intensity: 0.3, valence:  0.3, arousal: 0.2 },
  playful:      { easing: "ease-out-back", transition: "slide-up",    intensity: 0.7, valence:  0.8, arousal: 0.7 },
  dramatic:     { easing: "cubic-bezier(0.7, 0, 0.3, 1)", transition: "fade-to-black", intensity: 0.9, valence: -0.2, arousal: 0.8 },
  mysterious:   { easing: "ease-in", transition: "fade-to-black", intensity: 0.5, valence: -0.3, arousal: 0.4 },
  energetic:    { easing: "ease-out", transition: "wipe-right",  intensity: 0.8, valence:  0.7, arousal: 0.9 },
  nostalgic:    { easing: "ease-in-out", transition: "dissolve",     intensity: 0.4, valence:  0.2, arousal: 0.3 },
  triumphant:   { easing: "ease-out-back", transition: "zoom-in",    intensity: 1.0, valence:  0.9, arousal: 0.8 },
  tense:        { easing: "cubic-bezier(0.4, 0, 0.6, 1)", transition: "cut", intensity: 0.7, valence: -0.4, arousal: 0.7 },
  hopeful:      { easing: "ease-out", transition: "fade-to-white", intensity: 0.6, valence:  0.6, arousal: 0.5 },
  melancholic:  { easing: "ease-in", transition: "dissolve",     intensity: 0.3, valence: -0.5, arousal: 0.2 },
};

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Plan a multi-scene motion sequence from a high-level description.
 * Analyzes the description, selects a narrative arc, and produces
 * a complete scene-by-scene plan with timing, transitions, and pacing.
 */
export function planSequence(options: SequencePlanOptions): PlannedSequence {
  const {
    description,
    arc = detectArc(description),
    totalDurationMs = 8000,
    sceneCount,
    fps = 60,
    baseSpec,
  } = options;

  const template = getArcTemplate(arc);
  const numScenes = sceneCount ?? template.defaultSceneCount;
  const sceneDuration = Math.round(totalDurationMs / numScenes);

  // Build scenes from the template
  const scenes: Scene[] = [];
  for (let i = 0; i < numScenes; i++) {
    const tone = template.toneProgression[i % template.toneProgression.length];
    const toneConfig = TONE_CONFIG[tone];
    const isFirst = i === 0;

    // Distribute components to scenes if a base spec is provided
    let componentIds: string[] = [];
    if (baseSpec && baseSpec.components.length > 0) {
      const perScene = Math.ceil(baseSpec.components.length / numScenes);
      componentIds = baseSpec.components
        .slice(i * perScene, (i + 1) * perScene)
        .map((c) => c.id);
    }

    scenes.push({
      id: `scene-${i + 1}`,
      name: `${template.name} — Scene ${i + 1}`,
      tone,
      durationMs: sceneDuration,
      entryTransition: isFirst ? "fade-to-black" : toneConfig.transition,
      transitionMs: Math.min(500, Math.round(sceneDuration * 0.15)),
      description: `${tone} scene ${i + 1} of ${numScenes}`,
      beats: template.beatStructure.map((b) => ({
        label: b.label,
        position: b.position,
        intensity: b.intensity * toneConfig.intensity,
      })),
      componentIds,
    });
  }

  // Build the emotional arc
  const emotionalArc = buildEmotionalArc(scenes);

  // Analyze pacing
  const pacing = analyzePacing(scenes);

  // Assemble the timeline
  const timeline = assembleTimeline(scenes, baseSpec, fps);

  const totalFrames = Math.round(totalDurationMs / (1000 / fps));

  return {
    id: `seq-${Date.now()}`,
    name: `${template.name} Sequence`,
    arc,
    scenes,
    totalDurationMs,
    totalFrames,
    pacing,
    emotionalArc,
    timeline,
  };
}

/**
 * Detect the most appropriate narrative arc from a text description.
 * Uses keyword matching against arc template descriptions.
 */
export function detectArc(description: string): NarrativeArcId {
  const lower = description.toLowerCase();

  if (/\b(hero|journey|adventure|quest|transformation)\b/.test(lower)) return "hero-journey";
  if (/\b(launch|product|reveal|announce|release)\b/.test(lower)) return "product-launch";
  if (/\b(tutorial|guide|how.?to|step|learn|teach)\b/.test(lower)) return "tutorial";
  if (/\b(reveal|unveil|surprise|debut)\b/.test(lower)) return "product-reveal";
  if (/\b(emotion|feeling|journey|struggle|overcome)\b/.test(lower)) return "emotional-arc";
  if (/\b(action|fight|chase|battle|combat)\b/.test(lower)) return "action-sequence";
  if (/\b(documentary|explore|discover|nature|science)\b/.test(lower)) return "documentary";
  if (/\b(celebrat|party|festive|joy|birthday|anniversary)\b/.test(lower)) return "celebration";

  // Default to product-launch for generic motion descriptions
  return "product-launch";
}

/** Get an arc template by id. */
export function getArcTemplate(id: NarrativeArcId): ArcTemplate {
  return ARC_TEMPLATES.find((t) => t.id === id) ?? ARC_TEMPLATES[0];
}

/** List all available arc templates. */
export function listArcTemplates(): ArcTemplate[] {
  return ARC_TEMPLATES;
}

/**
 * Build the emotional arc from scene tones.
 * Produces valence/arousal data points for visualization.
 */
function buildEmotionalArc(scenes: Scene[]): EmotionalArcPoint[] {
  const points: EmotionalArcPoint[] = [];
  let currentTime = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const config = TONE_CONFIG[scene.tone];

    // Add a point at the start and end of each scene
    points.push({
      timeMs: currentTime,
      sceneIndex: i,
      sceneName: scene.name,
      valence: config.valence,
      arousal: config.arousal,
      tone: scene.tone,
    });

    currentTime += scene.durationMs;

    points.push({
      timeMs: currentTime,
      sceneIndex: i,
      sceneName: scene.name,
      valence: config.valence * 0.8, // Slight decay at scene end
      arousal: config.arousal * 0.9,
      tone: scene.tone,
    });
  }

  return points;
}

/**
 * Analyze the pacing of a sequence.
 * Evaluates rhythm, energy curve, and recommended tempo.
 */
function analyzePacing(scenes: Scene[]): PacingAnalysis {
  const durations = scenes.map((s) => s.durationMs);
  const avgSceneDurationMs = durations.reduce((a, b) => a + b, 0) / durations.length;

  // Detect rhythm pattern
  let rhythm: PacingAnalysis["rhythm"] = "uniform";
  if (durations.length >= 3) {
    const increasing = durations.every((d, i) => i === 0 || d >= durations[i - 1] - 50);
    const decreasing = durations.every((d, i) => i === 0 || d <= durations[i - 1] + 50);
    const variance = durations.some((d) => Math.abs(d - avgSceneDurationMs) > avgSceneDurationMs * 0.3);

    if (increasing) rhythm = "accelerating";
    else if (decreasing) rhythm = "decelerating";
    else if (variance) rhythm = "varied";
  }

  // Build energy curve from scene beats
  const energyCurve: { time: number; energy: number }[] = [];
  let currentTime = 0;
  for (const scene of scenes) {
    for (const beat of scene.beats) {
      energyCurve.push({
        time: currentTime + beat.position * scene.durationMs,
        energy: beat.intensity,
      });
    }
    currentTime += scene.durationMs;
  }
  energyCurve.sort((a, b) => a.time - b.time);

  // Calculate recommended BPM from average scene duration
  // A scene typically spans 2-4 musical bars at the recommended tempo
  const barsPerScene = 2;
  const beatsPerBar = 4;
  const totalBeats = scenes.length * barsPerScene * beatsPerBar;
  const totalMinutes = (scenes.reduce((a, s) => a + s.durationMs, 0)) / 60000;
  const recommendedBpm = Math.round(totalBeats / totalMinutes / 2) * 2;

  // Calculate pacing score
  const notes: string[] = [];
  let score = 70;

  if (rhythm === "varied") {
    score += 10;
    notes.push("Varied scene durations create natural pacing rhythm.");
  } else if (rhythm === "accelerating") {
    score += 5;
    notes.push("Accelerating pacing builds momentum toward the climax.");
  } else if (rhythm === "uniform") {
    score -= 5;
    notes.push("Consider varying scene durations for more dynamic pacing.");
  }

  const avgEnergy = energyCurve.length > 0
    ? energyCurve.reduce((a, e) => a + e.energy, 0) / energyCurve.length
    : 0.5;
  if (avgEnergy > 0.6) {
    score += 5;
    notes.push("High average energy maintains viewer engagement.");
  } else if (avgEnergy < 0.3) {
    score -= 5;
    notes.push("Low energy may reduce viewer engagement — consider more intense beats.");
  }

  if (recommendedBpm >= 100 && recommendedBpm <= 140) {
    score += 10;
    notes.push(`Tempo of ${recommendedBpm} BPM aligns with optimal engagement range.`);
  }

  score = Math.max(0, Math.min(100, score));

  return {
    avgSceneDurationMs: Math.round(avgSceneDurationMs),
    rhythm,
    energyCurve,
    recommendedBpm,
    score,
    notes,
  };
}

/**
 * Assemble the complete timeline with absolute positions.
 * Maps scenes and their components to a unified timeline.
 */
function assembleTimeline(
  scenes: Scene[],
  baseSpec: MotionSpec | undefined,
  fps: number,
): SequenceTimelineEntry[] {
  const timeline: SequenceTimelineEntry[] = [];
  let sceneStart = 0;

  for (let sceneIdx = 0; sceneIdx < scenes.length; sceneIdx++) {
    const scene = scenes[sceneIdx];

    if (baseSpec && scene.componentIds.length > 0) {
      // Map actual components to this scene
      const sceneComponents = baseSpec.components.filter((c) => scene.componentIds.includes(c.id));
      for (const comp of sceneComponents) {
        timeline.push({
          componentId: comp.id,
          name: comp.name,
          sceneId: scene.id,
          sceneIndex: sceneIdx,
          sceneName: scene.name,
          startMs: sceneStart + comp.delayMs,
          endMs: sceneStart + comp.delayMs + comp.durationMs,
          startFrame: Math.round((sceneStart + comp.delayMs) / (1000 / fps)),
          endFrame: Math.round((sceneStart + comp.delayMs + comp.durationMs) / (1000 / fps)),
          durationMs: comp.durationMs,
          delayMs: comp.delayMs,
          layer: sceneIdx,
        });
      }
    } else {
      // Create placeholder timeline entries for the scene
      for (let b = 0; b < scene.beats.length; b++) {
        const beat = scene.beats[b];
        const beatTime = sceneStart + beat.position * scene.durationMs;
        const beatDuration = Math.round(scene.durationMs / scene.beats.length);
        timeline.push({
          componentId: `${scene.id}-beat-${b + 1}`,
          name: `${scene.name} — ${beat.label}`,
          sceneId: scene.id,
          sceneIndex: sceneIdx,
          sceneName: scene.name,
          startMs: beatTime,
          endMs: beatTime + beatDuration,
          startFrame: Math.round(beatTime / (1000 / fps)),
          endFrame: Math.round((beatTime + beatDuration) / (1000 / fps)),
          durationMs: beatDuration,
          delayMs: beatTime - sceneStart,
          layer: sceneIdx,
        });
      }
    }

    sceneStart += scene.durationMs;
  }

  return timeline;
}

/**
 * Optimize scene transitions for a planned sequence.
 * Adjusts transition types and durations based on adjacent scene tones.
 */
export function optimizeTransitions(sequence: PlannedSequence): PlannedSequence {
  const optimizedScenes = sequence.scenes.map((scene, i) => {
    if (i === 0) return scene; // Keep first scene's entry

    const prevScene = sequence.scenes[i - 1];
    const prevTone = TONE_CONFIG[prevScene.tone];
    const currTone = TONE_CONFIG[scene.tone];

    // Choose transition based on tone contrast
    const toneContrast = Math.abs(currTone.valence - prevTone.valence);
    let transition: TransitionType;

    if (toneContrast > 0.5) {
      // High contrast — use a hard cut for dramatic effect
      transition = "cut";
    } else if (toneContrast > 0.3) {
      // Medium contrast — use dissolve
      transition = "dissolve";
    } else {
      // Low contrast — use a smooth transition matching the current tone
      transition = currTone.transition;
    }

    // Adjust transition duration based on intensity
    const transitionMs = Math.round(
      Math.max(150, Math.min(800, scene.durationMs * 0.12 * currTone.intensity)),
    );

    return { ...scene, entryTransition: transition, transitionMs };
  });

  return { ...sequence, scenes: optimizedScenes };
}

/**
 * Get a summary of the planned sequence as human-readable text.
 */
export function summarizeSequence(sequence: PlannedSequence): string {
  const lines: string[] = [];
  lines.push(`Sequence: "${sequence.name}" (${sequence.arc})`);
  lines.push(`Duration: ${(sequence.totalDurationMs / 1000).toFixed(1)}s, ${sequence.totalFrames} frames`);
  lines.push(`Scenes: ${sequence.scenes.length}`);
  lines.push(`Pacing: ${sequence.pacing.rhythm}, ${sequence.pacing.recommendedBpm} BPM, score ${sequence.pacing.score}/100`);
  lines.push("");
  lines.push("Scene breakdown:");
  for (let i = 0; i < sequence.scenes.length; i++) {
    const s = sequence.scenes[i];
    lines.push(`  ${i + 1}. ${s.name} — ${s.tone}, ${(s.durationMs / 1000).toFixed(1)}s, enters via ${s.entryTransition}`);
  }
  if (sequence.pacing.notes.length > 0) {
    lines.push("");
    lines.push("Pacing notes:");
    for (const note of sequence.pacing.notes) {
      lines.push(`  • ${note}`);
    }
  }
  return lines.join("\n");
}
