/**
 * Motion Genesis Engine — generates original motion from mathematical
 * first principles.
 *
 * This original AI-native module derives motion keyframes from pure
 * mathematics rather than presets. Each generator takes a small set of
 * parameters and produces a keyframe track that encodes a natural phenomenon:
 * Lissajous curves, golden-ratio spirals, wave interference, damped
 * oscillators, strange attractors, and phyllotactic patterns. The output is
 * a set of component drafts ready to drop into a MotionSpec.
 *
 * Core concepts:
 * - Lissajous Figure: parametric curve (x = A·sin(at+δ), y = B·sin(bt))
 * - Golden Spiral: logarithmic spiral with growth factor φ
 * - Wave Interference: superposition of two sine waves
 * - Damped Oscillator: x(t) = A·e^(-γt)·cos(ωt)
 * - Phyllotaxis: sunflower-seed packing on a Fermat spiral
 * - Strange Attractor: Lorenz-system projection to 2D
 *
 * Rule-based — no LLM round-trip required. Deterministic given parameters.
 */

import type { Easing, Keyframe } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import type { ComponentDraft } from "../motion/templates/helper.js";
import { draft, kf, resetOrder } from "../motion/templates/helper.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenesisKind =
  | "lissajous"
  | "goldenSpiral"
  | "waveInterference"
  | "dampedOscillator"
  | "phyllotaxis"
  | "lorenzAttractor";

export interface GenesisParams {
  /** Number of keyframes to sample. Default 24. */
  samples?: number;
  /** Animation duration in ms. Default 2000. */
  durationMs?: number;
  /** Frequency ratio a:b for Lissajous, wave count for interference. Default 3. */
  a?: number;
  /** Frequency b for Lissajous. Default 2. */
  b?: number;
  /** Phase delta for Lissajous. Default Math.PI / 2. */
  delta?: number;
  /** Amplitude in pixels. Default 120. */
  amplitude?: number;
  /** Damping coefficient for oscillator. Default 0.15. */
  damping?: number;
  /** Angular frequency for oscillator. Default 4. */
  omega?: number;
  /** Seed offset. Default 0. */
  seed?: number;
}

export interface GenesisResult {
  kind: GenesisKind;
  params: Required<GenesisParams>;
  components: ComponentDraft[];
  description: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveParams(p: GenesisParams | undefined): Required<GenesisParams> {
  return {
    samples: p?.samples ?? 24,
    durationMs: p?.durationMs ?? 2000,
    a: p?.a ?? 3,
    b: p?.b ?? 2,
    delta: p?.delta ?? Math.PI / 2,
    amplitude: p?.amplitude ?? 120,
    damping: p?.damping ?? 0.15,
    omega: p?.omega ?? 4,
    seed: p?.seed ?? 0,
  };
}

function easeInOutCubic(): Easing {
  return easingPreset("ease-in-out-cubic");
}

/** Build a translate keyframe set from an array of [x, y] pixel positions. */
function buildTranslateTrack(
  positions: Array<[number, number]>,
  durationMs: number,
): Keyframe[] {
  const n = positions.length;
  if (n === 0) return [];
  return positions.map(([x, y], i) =>
    kf(i / Math.max(1, n - 1), { translateX: `${x.toFixed(2)}px`, translateY: `${y.toFixed(2)}px` }),
  );
}

function buildScaleTrack(scales: number[]): Keyframe[] {
  const n = scales.length;
  if (n === 0) return [];
  return scales.map((s, i) => kf(i / Math.max(1, n - 1), { scale: String(s.toFixed(4)) }));
}

function buildOpacityTrack(opacities: number[]): Keyframe[] {
  const n = opacities.length;
  if (n === 0) return [];
  return opacities.map((o, i) => kf(i / Math.max(1, n - 1), { opacity: String(o.toFixed(4)) }));
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Lissajous figure — parametric curve from two perpendicular sinusoids. */
function generateLissajous(p: Required<GenesisParams>): ComponentDraft[] {
  resetOrder();
  const positions: Array<[number, number]> = [];
  for (let i = 0; i < p.samples; i++) {
    const t = (i / p.samples) * Math.PI * 2;
    const x = p.amplitude * Math.sin(p.a * t + p.delta);
    const y = p.amplitude * Math.sin(p.b * t);
    positions.push([x, y]);
  }
  return [
    draft("Lissajous Trace", {
      durationMs: p.durationMs,
      easing: easeInOutCubic(),
      iterationCount: "infinite",
      keyframes: buildTranslateTrack(positions, p.durationMs),
      style: { _content: "•", fontSize: 64, color: "#f4f6fb" },
    }),
  ];
}

/** Golden spiral — logarithmic spiral with growth factor φ. */
function generateGoldenSpiral(p: Required<GenesisParams>): ComponentDraft[] {
  resetOrder();
  const phi = (1 + Math.sqrt(5)) / 2;
  const positions: Array<[number, number]> = [];
  const scales: number[] = [];
  for (let i = 0; i < p.samples; i++) {
    const t = (i / p.samples) * Math.PI * 4;
    const r = (p.amplitude / 4) * Math.pow(phi, t / Math.PI);
    const x = r * Math.cos(t);
    const y = r * Math.sin(t);
    positions.push([x, y]);
    scales.push(0.5 + (i / p.samples) * 1.5);
  }
  return [
    draft("Golden Spiral", {
      durationMs: p.durationMs,
      easing: easeInOutCubic(),
      iterationCount: 1,
      keyframes: [
        ...buildTranslateTrack(positions, p.durationMs),
        ...buildScaleTrack(scales),
      ],
      style: { _content: "✦", fontSize: 32, color: "#f4f6fb" },
    }),
  ];
}

/** Wave interference — superposition of two sine waves on the x-axis. */
function generateWaveInterference(p: Required<GenesisParams>): ComponentDraft[] {
  resetOrder();
  const positions: Array<[number, number]> = [];
  for (let i = 0; i < p.samples; i++) {
    const t = (i / p.samples) * Math.PI * 2;
    const wave1 = Math.sin(p.a * t);
    const wave2 = Math.sin(p.b * t + p.delta);
    const x = (i / p.samples - 0.5) * p.amplitude * 4;
    const y = p.amplitude * 0.6 * (wave1 + wave2);
    positions.push([x, y]);
  }
  return [
    draft("Wave Interference", {
      durationMs: p.durationMs,
      easing: easeInOutCubic(),
      iterationCount: "infinite",
      keyframes: buildTranslateTrack(positions, p.durationMs),
      style: { _content: "≈", fontSize: 48, color: "#f4f6fb" },
    }),
  ];
}

/** Damped oscillator — exponential decay envelope on a cosine. */
function generateDampedOscillator(p: Required<GenesisParams>): ComponentDraft[] {
  resetOrder();
  const positions: Array<[number, number]> = [];
  const opacities: number[] = [];
  for (let i = 0; i < p.samples; i++) {
    const t = (i / p.samples) * Math.PI * 2;
    const envelope = Math.exp(-p.damping * (i / p.samples) * 4);
    const x = p.amplitude * envelope * Math.cos(p.omega * t);
    positions.push([x, 0]);
    opacities.push(0.3 + 0.7 * envelope);
  }
  return [
    draft("Damped Oscillator", {
      durationMs: p.durationMs,
      easing: easeInOutCubic(),
      iterationCount: 1,
      keyframes: [
        ...buildTranslateTrack(positions, p.durationMs),
        ...buildOpacityTrack(opacities),
      ],
      style: { _content: "◯", fontSize: 56, color: "#f4f6fb" },
    }),
  ];
}

/** Phyllotaxis — sunflower-seed packing on a Fermat spiral. */
function generatePhyllotaxis(p: Required<GenesisParams>): ComponentDraft[] {
  resetOrder();
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const components: ComponentDraft[] = [];
  const count = Math.min(p.samples, 24);
  for (let i = 0; i < count; i++) {
    const t = i * goldenAngle;
    const r = Math.sqrt(i) * (p.amplitude / 8);
    const x = r * Math.cos(t);
    const y = r * Math.sin(t);
    const scale = 0.4 + (i / count) * 0.6;
    components.push(
      draft(`Seed ${i + 1}`, {
        durationMs: p.durationMs,
        delayMs: i * 30,
        easing: easeInOutCubic(),
        keyframes: [
          kf(0, { translateX: "0px", translateY: "0px", scale: "0", opacity: "0" }),
          kf(1, {
            translateX: `${x.toFixed(2)}px`,
            translateY: `${y.toFixed(2)}px`,
            scale: scale.toFixed(4),
            opacity: "1",
          }),
        ],
        style: { _content: "•", fontSize: 24, color: "#f4f6fb" },
      }),
    );
  }
  return components;
}

/** Lorenz attractor — project the chaotic 3D system to 2D keyframes. */
function generateLorenzAttractor(p: Required<GenesisParams>): ComponentDraft[] {
  resetOrder();
  // Classic Lorenz parameters.
  const sigma = 10;
  const rho = 28;
  const beta = 8 / 3;
  const dt = 0.01;
  let x = 0.1 + p.seed * 0.001;
  let y = 0;
  let z = 0;
  const positions: Array<[number, number]> = [];
  for (let i = 0; i < p.samples; i++) {
    // Step a few sub-iterations per sample for smoother coverage.
    for (let s = 0; s < 8; s++) {
      const dx = sigma * (y - x);
      const dy = x * (rho - z) - y;
      const dz = x * y - beta * z;
      x += dx * dt;
      y += dy * dt;
      z += dz * dt;
    }
    // Project x-z plane and scale to pixel space.
    positions.push([(x - 8) * p.amplitude * 0.06, (z - 25) * p.amplitude * 0.04]);
  }
  return [
    draft("Lorenz Attractor", {
      durationMs: p.durationMs,
      easing: easeInOutCubic(),
      iterationCount: "infinite",
      keyframes: buildTranslateTrack(positions, p.durationMs),
      style: { _content: "◆", fontSize: 40, color: "#f4f6fb" },
    }),
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const GENERATORS: Record<
  GenesisKind,
  { generate: (p: Required<GenesisParams>) => ComponentDraft[]; description: string }
> = {
  lissajous: {
    generate: generateLissajous,
    description: "Parametric Lissajous figure from two perpendicular sinusoids.",
  },
  goldenSpiral: {
    generate: generateGoldenSpiral,
    description: "Logarithmic spiral with golden-ratio growth factor.",
  },
  waveInterference: {
    generate: generateWaveInterference,
    description: "Superposition of two sine waves producing beat patterns.",
  },
  dampedOscillator: {
    generate: generateDampedOscillator,
    description: "Exponential-decay envelope on a cosine — settles to rest.",
  },
  phyllotaxis: {
    generate: generatePhyllotaxis,
    description: "Sunflower-seed packing on a Fermat spiral with golden angle.",
  },
  lorenzAttractor: {
    generate: generateLorenzAttractor,
    description: "2D projection of the chaotic Lorenz strange attractor.",
  },
};

/** List all available genesis kinds with descriptions. */
export function listGenesisKinds(): Array<{ kind: GenesisKind; description: string }> {
  return (Object.keys(GENERATORS) as GenesisKind[]).map((kind) => ({
    kind,
    description: GENERATORS[kind].description,
  }));
}

/**
 * Generate original motion from a mathematical first-principle.
 *
 * @param kind Which generator to run.
 * @param params Optional parameters; sensible defaults are filled in.
 */
export function genesis(kind: GenesisKind, params?: GenesisParams): GenesisResult {
  const resolved = resolveParams(params);
  const entry = GENERATORS[kind];
  const components = entry.generate(resolved);
  const summary = `Genesis ${kind}: ${components.length} component(s), ${resolved.samples} samples, ${resolved.durationMs}ms.`;
  return {
    kind,
    params: resolved,
    components,
    description: entry.description,
    summary,
  };
}

/** Format a genesis result as a readable multi-line string. */
export function formatGenesisReport(result: GenesisResult): string {
  const lines: string[] = [
    result.summary,
    `Description: ${result.description}`,
    `Parameters: a=${result.params.a}, b=${result.params.b}, amplitude=${result.params.amplitude}, samples=${result.params.samples}`,
  ];
  lines.push(`Components:`);
  for (const c of result.components.slice(0, 8)) {
    lines.push(`  • ${c.name} — ${c.keyframes.length} keyframe(s), ${c.durationMs}ms`);
  }
  if (result.components.length > 8) {
    lines.push(`  ... and ${result.components.length - 8} more.`);
  }
  return lines.join("\n");
}
