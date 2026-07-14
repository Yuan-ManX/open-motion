/**
 * Motion Capture system — record cursor trajectories and convert them into
 * component keyframes. A capture session samples pointer positions at regular
 * intervals; the resulting path can be smoothed, normalized, and applied to
 * any component as a translateX/translateY animation track.
 *
 * This enables a "draw the motion" workflow: the user moves their cursor
 * across the canvas, and the Agent materializes that gesture as a precise,
 * editable keyframe sequence.
 */

import type { Easing, Keyframe, MotionComponent } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";

export interface CaptureSample {
  /** Milliseconds from capture start. */
  t: number;
  /** Canvas x coordinate. */
  x: number;
  /** Canvas y coordinate. */
  y: number;
}

export interface MotionCapture {
  id: string;
  name: string;
  description: string;
  samples: CaptureSample[];
  /** Total recorded duration in milliseconds. */
  durationMs: number;
  /** Whether coordinates were normalized to a 0..100 bounding box. */
  normalized: boolean;
  /** Smoothing window applied during conversion (0 = raw). */
  smoothing: number;
  /** Optional easing applied across the whole track. */
  easing: Easing;
  /** Origin x for absolute captures (canvas coordinate). */
  originX: number;
  /** Origin y for absolute captures (canvas coordinate). */
  originY: number;
  createdAt: string;
}

export interface MotionCaptureSummary {
  id: string;
  name: string;
  description: string;
  sampleCount: number;
  durationMs: number;
  normalized: boolean;
}

export interface CaptureConvertOptions {
  /** Normalize samples to a 0..100 box centered on origin. */
  normalize?: boolean;
  /** Moving-average window size (0 disables smoothing). */
  smoothing?: number;
  /** Snap each sample to the nearest N pixels (0 disables). */
  snap?: number;
  /** Maximum number of keyframes to emit (downsamples if exceeded). */
  maxKeyframes?: number;
  /** Easing applied across the converted track. */
  easing?: Easing;
}

const CAPTURES_KEY = "__motionCaptures";

function genId(): string {
  return `cap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Read motion captures from project tokens. */
export function readCaptures(tokens: Record<string, string | number>): MotionCapture[] {
  const raw = tokens[CAPTURES_KEY];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as MotionCapture[];
  } catch {
    return [];
  }
}

/** Write motion captures to project tokens. */
export function writeCaptures(
  tokens: Record<string, string | number>,
  captures: MotionCapture[],
): Record<string, string | number> {
  return { ...tokens, [CAPTURES_KEY]: JSON.stringify(captures) };
}

/** Find a single capture by id. */
export function findCapture(
  tokens: Record<string, string | number>,
  captureId: string,
): MotionCapture | undefined {
  return readCaptures(tokens).find((c) => c.id === captureId);
}

/** Delete a capture by id. */
export function deleteCapture(
  tokens: Record<string, string | number>,
  captureId: string,
): Record<string, string | number> {
  const remaining = readCaptures(tokens).filter((c) => c.id !== captureId);
  return writeCaptures(tokens, remaining);
}

/** Summarize captures for compact listing. */
export function summarizeCaptures(tokens: Record<string, string | number>): MotionCaptureSummary[] {
  return readCaptures(tokens).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    sampleCount: c.samples.length,
    durationMs: c.durationMs,
    normalized: c.normalized,
  }));
}

/**
 * Finalize raw samples into a MotionCapture record. Computes durationMs,
 * applies optional normalization and smoothing, and stores the result.
 */
export function finalizeCapture(
  samples: CaptureSample[],
  options: {
    name: string;
    description?: string;
    originX?: number;
    originY?: number;
    normalize?: boolean;
    smoothing?: number;
    easing?: Easing;
  },
  tokens: Record<string, string | number>,
): { capture: MotionCapture; tokens: Record<string, string | number> } {
  if (samples.length < 2) {
    throw new Error("capture requires at least 2 samples");
  }
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const durationMs = Math.max(1, sorted[sorted.length - 1].t - sorted[0].t);
  const capture: MotionCapture = {
    id: genId(),
    name: options.name,
    description: options.description ?? "",
    samples: sorted,
    durationMs,
    normalized: options.normalize ?? false,
    smoothing: options.smoothing ?? 0,
    easing: options.easing ?? easingPreset("linear"),
    originX: options.originX ?? 0,
    originY: options.originY ?? 0,
    createdAt: new Date().toISOString(),
  };
  const next = writeCaptures(tokens, [...readCaptures(tokens), capture]);
  return { capture, tokens: next };
}

/**
 * Apply moving-average smoothing to a sample series. Window is the number of
 * neighboring samples averaged on each side (0 returns input unchanged).
 */
export function smoothSamples(samples: CaptureSample[], window: number): CaptureSample[] {
  if (window <= 0 || samples.length < 3) return samples;
  const out: CaptureSample[] = [];
  for (let i = 0; i < samples.length; i++) {
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (let j = Math.max(0, i - window); j <= Math.min(samples.length - 1, i + window); j++) {
      sx += samples[j].x;
      sy += samples[j].y;
      count++;
    }
    out.push({ t: samples[i].t, x: sx / count, y: sy / count });
  }
  return out;
}

/** Snap sample coordinates to the nearest N pixels. */
export function snapSamples(samples: CaptureSample[], grid: number): CaptureSample[] {
  if (grid <= 0) return samples;
  return samples.map((s) => ({
    t: s.t,
    x: Math.round(s.x / grid) * grid,
    y: Math.round(s.y / grid) * grid,
  }));
}

/**
 * Normalize samples to a 0..100 bounding box, preserving aspect ratio and
 * centering the path on (0, 0) so the resulting translateX/translateY values
 * are percentage-like offsets from the component's rest position.
 */
export function normalizeSamples(samples: CaptureSample[]): CaptureSample[] {
  if (samples.length === 0) return samples;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const s of samples) {
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const span = Math.max(spanX, spanY);
  return samples.map((s) => ({
    t: s.t,
    x: ((s.x - minX) / span) * 100 - spanX / span * 50,
    y: ((s.y - minY) / span) * 100 - spanY / span * 50,
  }));
}

/**
 * Downsample a sample series so that no more than `max` points remain,
 * preserving the first and last samples and evenly distributing the rest.
 */
export function downsample(samples: CaptureSample[], max: number): CaptureSample[] {
  if (max <= 0 || samples.length <= max) return samples;
  const stride = (samples.length - 1) / (max - 1);
  const out: CaptureSample[] = [];
  for (let i = 0; i < max; i++) {
    out.push(samples[Math.round(i * stride)]);
  }
  return out;
}

/**
 * Convert a capture into a keyframe track suitable for patching a component.
 * Returns separate translateX and translateY keyframe arrays plus the easing
 * and computed durationMs.
 */
export function captureToKeyframes(
  capture: MotionCapture,
  options: CaptureConvertOptions = {},
): {
  translateXKeyframes: Keyframe[];
  translateYKeyframes: Keyframe[];
  durationMs: number;
  easing: Easing;
} {
  let samples = [...capture.samples];
  const snap = options.snap ?? 0;
  if (snap > 0) samples = snapSamples(samples, snap);
  const smoothing = options.smoothing ?? capture.smoothing ?? 0;
  if (smoothing > 0) samples = smoothSamples(samples, smoothing);
  const normalize = options.normalize ?? capture.normalized;
  if (normalize) samples = normalizeSamples(samples);
  const maxKf = options.maxKeyframes ?? 24;
  samples = downsample(samples, maxKf);

  const durationMs = options.easing ? capture.durationMs : capture.durationMs;
  const easing = options.easing ?? capture.easing;

  const startT = samples[0]?.t ?? 0;
  const span = Math.max(1, capture.durationMs);

  const translateXKeyframes: Keyframe[] = samples.map((s) => ({
    offset: Math.min(1, Math.max(0, (s.t - startT) / span)),
    properties: { translateX: normalize ? `${s.x.toFixed(2)}` : `${(s.x - capture.originX).toFixed(2)}px` },
    easing,
  }));
  const translateYKeyframes: Keyframe[] = samples.map((s) => ({
    offset: Math.min(1, Math.max(0, (s.t - startT) / span)),
    properties: { translateY: normalize ? `${s.y.toFixed(2)}` : `${(s.y - capture.originY).toFixed(2)}px` },
    easing,
  }));

  return { translateXKeyframes, translateYKeyframes, durationMs, easing };
}

/**
 * Apply a capture to an existing component, replacing its keyframes with the
 * captured trajectory. Returns a patch object suitable for patchComponent().
 */
export function applyCaptureToComponent(
  capture: MotionCapture,
  component: MotionComponent,
  options: CaptureConvertOptions = {},
): {
  keyframes: Keyframe[];
  durationMs: number;
  easing: Easing;
} {
  const { translateXKeyframes, translateYKeyframes, durationMs, easing } = captureToKeyframes(capture, options);
  // Merge translateX and translateY tracks into a single keyframe array,
  // combining entries that share the same offset.
  const byOffset = new Map<number, Keyframe>();
  for (const kx of translateXKeyframes) {
    const existing = byOffset.get(kx.offset);
    if (existing) {
      existing.properties = { ...existing.properties, ...kx.properties };
    } else {
      byOffset.set(kx.offset, { ...kx, properties: { ...kx.properties } });
    }
  }
  for (const ky of translateYKeyframes) {
    const existing = byOffset.get(ky.offset);
    if (existing) {
      existing.properties = { ...existing.properties, ...ky.properties };
    } else {
      byOffset.set(ky.offset, { ...ky, properties: { ...ky.properties } });
    }
  }
  const merged = Array.from(byOffset.values()).sort((a, b) => a.offset - b.offset);
  return { keyframes: merged, durationMs, easing };
}

/** Seed a few example captures for demonstration and onboarding. */
export function seedCaptures(
  tokens: Record<string, string | number>,
): { captures: MotionCapture[]; tokens: Record<string, string | number> } {
  const now = Date.now();
  const existing = readCaptures(tokens);
  if (existing.length > 0) return { captures: existing, tokens };

  const makeWave = (name: string, amplitude: number, periods: number, samples: number): CaptureSample[] => {
    const out: CaptureSample[] = [];
    for (let i = 0; i < samples; i++) {
      const t = (i / (samples - 1)) * 2000;
      const x = (i / (samples - 1)) * 200 - 100;
      const y = Math.sin((i / (samples - 1)) * Math.PI * 2 * periods) * amplitude;
      out.push({ t, x, y });
    }
    return out;
  };

  const makeSpiral = (name: string, radius: number, turns: number, samples: number): CaptureSample[] => {
    const out: CaptureSample[] = [];
    for (let i = 0; i < samples; i++) {
      const t = (i / (samples - 1)) * 2400;
      const angle = (i / (samples - 1)) * Math.PI * 2 * turns;
      const r = radius * (1 - i / (samples - 1) * 0.3);
      out.push({ t, x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return out;
  };

  const makeBounce = (name: string, samples: number): CaptureSample[] => {
    const out: CaptureSample[] = [];
    for (let i = 0; i < samples; i++) {
      const t = (i / (samples - 1)) * 1500;
      const x = (i / (samples - 1)) * 160 - 80;
      const phase = (i / (samples - 1)) * 3;
      const y = -Math.abs(Math.sin(phase * Math.PI)) * 80;
      out.push({ t, x, y });
    }
    return out;
  };

  const presets: MotionCapture[] = [
    {
      id: `cap_seed_wave_${now.toString(36)}`,
      name: "Sine Wave Path",
      description: "Smooth sinusoidal horizontal traversal — a gentle wave motion across the canvas.",
      samples: makeWave("wave", 60, 2, 32),
      durationMs: 2000,
      normalized: true,
      smoothing: 1,
      easing: easingPreset("linear"),
      originX: 0,
      originY: 0,
      createdAt: new Date(now).toISOString(),
    },
    {
      id: `cap_seed_spiral_${now.toString(36)}`,
      name: "Spiral Inward",
      description: "Tightening spiral converging toward center — a hypnotic vortex pull.",
      samples: makeSpiral("spiral", 80, 2.5, 40),
      durationMs: 2400,
      normalized: true,
      smoothing: 0,
      easing: easingPreset("ease-in"),
      originX: 0,
      originY: 0,
      createdAt: new Date(now + 1).toISOString(),
    },
    {
      id: `cap_seed_bounce_${now.toString(36)}`,
      name: "Bounce Trail",
      description: "Forward bounce with three diminishing hops — a playful traversal.",
      samples: makeBounce("bounce", 28),
      durationMs: 1500,
      normalized: true,
      smoothing: 0,
      easing: easingPreset("ease-out"),
      originX: 0,
      originY: 0,
      createdAt: new Date(now + 2).toISOString(),
    },
  ];

  return { captures: presets, tokens: writeCaptures(tokens, presets) };
}
