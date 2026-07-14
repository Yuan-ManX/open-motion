import type { Easing, Keyframe, MotionComponent, MotionSpec } from "@openmotion/shared";
import { easingPreset } from "../shared/motion/easing.js";
import { createId } from "../utils/id.js";

/**
 * Real-time Motion Synthesis — procedural motion generation from semantic
 * descriptions, mathematical functions, and generative patterns. Instead of
 * hand-authoring every keyframe, the agent can request "a heartbeat pulse at
 * 120bpm" or "a sine wave oscillation on the Y axis" and the engine produces
 * a fully-formed motion component.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WaveformType = "sine" | "square" | "triangle" | "sawtooth" | "noise" | "pulse";

export interface WaveformParams {
  type: WaveformType;
  amplitude: number;
  frequency: number; // Hz — cycles per second
  phase: number; // radians, 0 = start at zero crossing
  offset: number; // DC offset added to the wave
}

export type GenerativePattern =
  | "heartbeat"
  | "breathing"
  | "walk-cycle"
  | "bounce-ball"
  | "pendulum"
  | "ocean-wave"
  | "tremor"
  | "fidget"
  | "heartbeat-fast"
  | "shake-violent"
  | "sway-gentle"
  | "orbit-elliptical";

export interface SynthesisRequest {
  pattern: GenerativePattern;
  durationMs: number;
  loopCount: number | "infinite";
  amplitudeScale: number; // 0..2, 1 = default
  speedScale: number; // 0.1..5, 1 = default
  componentName: string;
  projectId: string;
}

export interface MorphRequest {
  sourceSpec: MotionSpec;
  targetPattern: GenerativePattern;
  morphSteps: number; // 2..20
  durationMs: number;
  projectId: string;
}

export interface SynthesisResult {
  component: MotionComponent;
  description: string;
  waveform: WaveformParams;
  keyframeCount: number;
}

export interface MorphResult {
  steps: MotionComponent[];
  description: string;
}

// ---------------------------------------------------------------------------
// Waveform generators — produce a value at time t (0..1 normalized)
// ---------------------------------------------------------------------------

function waveformValue(params: WaveformParams, t: number): number {
  const { type, amplitude, frequency, phase, offset } = params;
  const angle = 2 * Math.PI * frequency * t + phase;

  switch (type) {
    case "sine":
      return offset + amplitude * Math.sin(angle);
    case "square":
      return offset + amplitude * (Math.sin(angle) >= 0 ? 1 : -1);
    case "triangle":
      return offset + amplitude * (2 / Math.PI) * Math.asin(Math.sin(angle));
    case "sawtooth": {
      const frac = (frequency * t + phase / (2 * Math.PI)) % 1;
      return offset + amplitude * (2 * frac - 1);
    }
    case "pulse": {
      const duty = 0.3;
      const frac = (frequency * t + phase / (2 * Math.PI)) % 1;
      return offset + amplitude * (frac < duty ? 1 : 0);
    }
    case "noise":
      return offset + amplitude * (Math.sin(angle) * 0.5 + Math.sin(angle * 2.7) * 0.3 + Math.sin(angle * 5.3) * 0.2);
    default:
      return offset;
  }
}

// ---------------------------------------------------------------------------
// Pattern definitions — each generative pattern maps to waveform parameters
// and a set of animated properties
// ---------------------------------------------------------------------------

interface PatternDefinition {
  waveform: WaveformParams;
  properties: string[]; // translateX, translateY, scale, rotate, opacity
  durationMs: number;
  easing: Easing;
  description: string;
  keyframeCount: number;
}

const PATTERN_DEFS: Record<GenerativePattern, PatternDefinition> = {
  heartbeat: {
    waveform: { type: "pulse", amplitude: 0.15, frequency: 2, phase: 0, offset: 1 },
    properties: ["scale"],
    durationMs: 1000,
    easing: easingPreset("ease-out"),
    description: "Double-pulse heartbeat — two quick scale beats per cycle",
    keyframeCount: 8,
  },
  "heartbeat-fast": {
    waveform: { type: "pulse", amplitude: 0.2, frequency: 3, phase: 0, offset: 1 },
    properties: ["scale"],
    durationMs: 700,
    easing: easingPreset("ease-out"),
    description: "Rapid heartbeat — elevated pulse rate for urgency",
    keyframeCount: 8,
  },
  breathing: {
    waveform: { type: "sine", amplitude: 0.08, frequency: 0.25, phase: 0, offset: 1 },
    properties: ["scale", "opacity"],
    durationMs: 4000,
    easing: easingPreset("ease-in-out"),
    description: "Slow breathing cycle — gentle scale and opacity oscillation",
    keyframeCount: 12,
  },
  "walk-cycle": {
    waveform: { type: "sine", amplitude: 8, frequency: 1, phase: 0, offset: 0 },
    properties: ["translateY", "rotate"],
    durationMs: 800,
    easing: easingPreset("ease-in-out"),
    description: "Walking gait — vertical bob with slight rotation sway",
    keyframeCount: 10,
  },
  "bounce-ball": {
    waveform: { type: "triangle", amplitude: 60, frequency: 1, phase: 0, offset: 0 },
    properties: ["translateY"],
    durationMs: 600,
    easing: easingPreset("bounce"),
    description: "Ball bounce — gravity-driven vertical oscillation",
    keyframeCount: 8,
  },
  pendulum: {
    waveform: { type: "sine", amplitude: 15, frequency: 0.5, phase: 0, offset: 0 },
    properties: ["rotate"],
    durationMs: 2000,
    easing: easingPreset("ease-in-out"),
    description: "Pendulum swing — smooth rotational oscillation",
    keyframeCount: 10,
  },
  "ocean-wave": {
    waveform: { type: "sine", amplitude: 20, frequency: 0.3, phase: 0, offset: 0 },
    properties: ["translateY", "translateX"],
    durationMs: 3000,
    easing: easingPreset("ease-in-out"),
    description: "Ocean wave — dual-axis fluid motion",
    keyframeCount: 14,
  },
  tremor: {
    waveform: { type: "noise", amplitude: 3, frequency: 8, phase: 0, offset: 0 },
    properties: ["translateX", "translateY"],
    durationMs: 500,
    easing: easingPreset("linear"),
    description: "Tremor — high-frequency irregular micro-shake",
    keyframeCount: 16,
  },
  fidget: {
    waveform: { type: "noise", amplitude: 2, frequency: 2, phase: 0, offset: 0 },
    properties: ["translateX", "rotate"],
    durationMs: 1500,
    easing: easingPreset("ease-in-out"),
    description: "Fidget — restless low-amplitude micro-movements",
    keyframeCount: 12,
  },
  "shake-violent": {
    waveform: { type: "square", amplitude: 10, frequency: 6, phase: 0, offset: 0 },
    properties: ["translateX", "translateY"],
    durationMs: 400,
    easing: easingPreset("linear"),
    description: "Violent shake — sharp alternating displacement",
    keyframeCount: 14,
  },
  "sway-gentle": {
    waveform: { type: "sine", amplitude: 5, frequency: 0.4, phase: 0, offset: 0 },
    properties: ["rotate", "translateX"],
    durationMs: 2500,
    easing: easingPreset("ease-in-out"),
    description: "Gentle sway — calm rocking motion",
    keyframeCount: 10,
  },
  "orbit-elliptical": {
    waveform: { type: "sine", amplitude: 40, frequency: 0.5, phase: 0, offset: 0 },
    properties: ["translateX", "translateY"],
    durationMs: 2000,
    easing: easingPreset("linear"),
    description: "Elliptical orbit — circular path with phase-offset axes",
    keyframeCount: 16,
  },
};

// ---------------------------------------------------------------------------
// Keyframe generation from waveform
// ---------------------------------------------------------------------------

function generateKeyframes(
  def: PatternDefinition,
  durationMs: number,
  amplitudeScale: number,
  speedScale: number,
  keyframeCount: number,
): Keyframe[] {
  const keyframes: Keyframe[] = [];
  const wf: WaveformParams = {
    ...def.waveform,
    amplitude: def.waveform.amplitude * amplitudeScale,
    frequency: def.waveform.frequency * speedScale,
  };

  for (let i = 0; i < keyframeCount; i++) {
    const t = i / (keyframeCount - 1);
    const properties: Record<string, unknown> = {};

    for (let pi = 0; pi < def.properties.length; pi++) {
      const prop = def.properties[pi];
      const phaseOffset = (pi * Math.PI) / 2;
      const wfWithPhase = { ...wf, phase: wf.phase + phaseOffset };
      properties[prop] = waveformValue(wfWithPhase, t);
    }

    keyframes.push({
      offset: t,
      properties,
      easing: def.easing,
    });
  }

  return keyframes;
}

// ---------------------------------------------------------------------------
// Main synthesis function
// ---------------------------------------------------------------------------

export function synthesizeMotion(req: SynthesisRequest): SynthesisResult {
  const def = PATTERN_DEFS[req.pattern];
  if (!def) throw new Error(`Unknown generative pattern: ${req.pattern}`);

  const durationMs = Math.round(req.durationMs || def.durationMs);
  const keyframes = generateKeyframes(
    def,
    durationMs,
    req.amplitudeScale,
    req.speedScale,
    def.keyframeCount,
  );

  const now = new Date().toISOString();
  const component: MotionComponent = {
    id: createId("c_"),
    projectId: req.projectId,
    name: req.componentName || req.pattern,
    selector: `[data-motion="${req.pattern}"]`,
    templateId: null,
    durationMs,
    delayMs: 0,
    iterationCount: req.loopCount,
    direction: "normal",
    fillMode: "both",
    playState: "running",
    trigger: "onLoad",
    easing: def.easing,
    keyframes,
    style: {},
    orderIndex: 0,
    sceneId: null,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };

  return {
    component,
    description: def.description,
    waveform: { ...def.waveform, amplitude: def.waveform.amplitude * req.amplitudeScale },
    keyframeCount: keyframes.length,
  };
}

// ---------------------------------------------------------------------------
// Motion morphing — smoothly transition a spec toward a generative pattern
// ---------------------------------------------------------------------------

export function morphToPattern(req: MorphRequest): MorphResult {
  const def = PATTERN_DEFS[req.targetPattern];
  if (!def) throw new Error(`Unknown generative pattern: ${req.targetPattern}`);

  const sourceComponents = req.sourceSpec.components;
  if (sourceComponents.length === 0) {
    return { steps: [], description: "No source components to morph." };
  }

  const steps: MotionComponent[] = [];
  const morphSteps = Math.max(2, Math.min(20, req.morphSteps));

  for (let step = 0; step < morphSteps; step++) {
    const ratio = step / (morphSteps - 1);
    const source = sourceComponents[0];

    const targetKeyframes = generateKeyframes(
      def,
      req.durationMs || def.durationMs,
      1,
      1,
      def.keyframeCount,
    );

    // Blend keyframes: interpolate between source keyframes and target keyframes
    const maxKf = Math.max(source.keyframes.length, targetKeyframes.length);
    const blendedKeyframes: Keyframe[] = [];

    for (let i = 0; i < maxKf; i++) {
      const sT = i / (maxKf - 1);
      const sourceKf = source.keyframes[Math.round(sT * (source.keyframes.length - 1))];
      const targetKf = targetKeyframes[Math.round(sT * (targetKeyframes.length - 1))];

      if (!sourceKf || !targetKf) continue;

      const properties: Record<string, number | string> = {};
      const allKeys = new Set([...Object.keys(sourceKf.properties), ...Object.keys(targetKf.properties)]);

      for (const key of allKeys) {
        const sv = sourceKf.properties[key as keyof typeof sourceKf.properties];
        const tv = targetKf.properties[key as keyof typeof targetKf.properties];
        if (typeof sv === "number" && typeof tv === "number") {
          properties[key] = sv * (1 - ratio) + tv * ratio;
        } else if (tv !== undefined) {
          properties[key] = tv;
        } else if (sv !== undefined) {
          properties[key] = sv;
        }
      }

      blendedKeyframes.push({
        offset: sT,
        properties,
        easing: ratio > 0.5 ? def.easing : source.easing,
      });
    }

    const now = new Date().toISOString();
    const morphedComponent: MotionComponent = {
      ...source,
      id: createId("c_"),
      projectId: req.projectId,
      name: `${source.name} → ${req.targetPattern} (${Math.round(ratio * 100)}%)`,
      keyframes: blendedKeyframes,
      durationMs: Math.round(source.durationMs * (1 - ratio) + (req.durationMs || def.durationMs) * ratio),
      easing: ratio > 0.5 ? def.easing : source.easing,
      createdAt: now,
      updatedAt: now,
    };

    steps.push(morphedComponent);
  }

  return {
    steps,
    description: `Morphed ${sourceComponents.length} component(s) toward ${req.targetPattern} in ${morphSteps} steps.`,
  };
}

// ---------------------------------------------------------------------------
// Generative pattern catalog
// ---------------------------------------------------------------------------

export function listGenerativePatterns(): { id: GenerativePattern; description: string; defaultDurationMs: number }[] {
  return (Object.keys(PATTERN_DEFS) as GenerativePattern[]).map((id) => ({
    id,
    description: PATTERN_DEFS[id].description,
    defaultDurationMs: PATTERN_DEFS[id].durationMs,
  }));
}

// ---------------------------------------------------------------------------
// Custom waveform synthesis — let the agent define arbitrary waveforms
// ---------------------------------------------------------------------------

export interface CustomWaveformRequest {
  waveform: WaveformType;
  amplitude: number;
  frequency: number;
  phase: number;
  offset: number;
  property: string; // translateX, translateY, scale, rotate, opacity
  durationMs: number;
  loopCount: number | "infinite";
  componentName: string;
  keyframeCount: number;
  projectId: string;
}

export function synthesizeCustomWaveform(req: CustomWaveformRequest): SynthesisResult {
  const params: WaveformParams = {
    type: req.waveform,
    amplitude: req.amplitude,
    frequency: req.frequency,
    phase: req.phase,
    offset: req.offset,
  };

  const kfCount = Math.max(4, Math.min(32, req.keyframeCount || 12));
  const keyframes: Keyframe[] = [];

  for (let i = 0; i < kfCount; i++) {
    const t = i / (kfCount - 1);
    keyframes.push({
      offset: t,
      properties: { [req.property]: waveformValue(params, t) },
      easing: easingPreset("ease-in-out"),
    });
  }

  const now = new Date().toISOString();
  const component: MotionComponent = {
    id: createId("c_"),
    projectId: req.projectId,
    name: req.componentName || `${req.waveform}-${req.property}`,
    selector: `[data-motion="custom-${req.waveform}"]`,
    templateId: null,
    durationMs: req.durationMs,
    delayMs: 0,
    iterationCount: req.loopCount,
    direction: "normal",
    fillMode: "both",
    playState: "running",
    trigger: "onLoad",
    easing: easingPreset("ease-in-out"),
    keyframes,
    style: {},
    orderIndex: 0,
    sceneId: null,
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };

  return {
    component,
    description: `Custom ${req.waveform} wave on ${req.property} — amplitude ${req.amplitude}, frequency ${req.frequency}Hz`,
    waveform: params,
    keyframeCount: keyframes.length,
  };
}
