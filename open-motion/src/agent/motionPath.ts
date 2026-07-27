/**
 * Motion Path Generator — generates motion keyframes along mathematical paths.
 *
 * This is an original AI-native module that creates motion by sampling
 * positions along parametric curves. Instead of linear point-to-point
 * animation, the generator traces complex paths (bezier curves, Lissajous
 * figures, spirals, figure-eights, heart curves, and custom SVG paths) and
 * converts the sampled positions into keyframes.
 *
 * Seven path types:
 * 1. Bezier curve — cubic bezier with 4 control points
 * 2. Lissajous figure — parametric curves with frequency ratios (x = A*sin(at+δ), y = B*sin(bt))
 * 3. Spiral — Archimedean or logarithmic spiral from center outward
 * 4. Figure-eight — lemniscate of Bernoulli
 * 5. Heart curve — parametric heart shape
 * 6. Circle/Ellipse — closed loop circular or elliptical path
 * 7. SVG path — sample positions along an SVG path data string
 *
 * Each path is sampled at a configurable resolution and converted into
 * translateX/translateY keyframes that trace the path over time.
 *
 * Rule-based — no LLM round-trip required.
 */

import { easingPreset } from "@openmotion/shared";
import type { Keyframe } from "@openmotion/shared";
import { draft, kf, type ComponentDraft } from "../motion/templates/helper.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PathType =
  | "bezier"
  | "lissajous"
  | "spiral"
  | "figure-eight"
  | "heart"
  | "circle"
  | "svg-path";

export interface PathConfig {
  /** Path type. */
  type: PathType;
  /** Duration in ms. Default 2000. */
  durationMs: number;
  /** Number of samples (keyframes). Default 60. */
  samples: number;
  /** Scale factor for the path. Default 1. */
  scale: number;
  /** X offset. Default 0. */
  offsetX: number;
  /** Y offset. Default 0. */
  offsetY: number;
  /** Whether to loop the animation. Default true. */
  loop: boolean;
  /** Component name. Default "Path Motion". */
  name: string;
  /** Type-specific parameters. */
  params: PathParams;
}

export interface PathParams {
  // Bezier
  p0x?: number; p0y?: number;
  p1x?: number; p1y?: number;
  p2x?: number; p2y?: number;
  p3x?: number; p3y?: number;
  // Lissajous
  freqA?: number; freqB?: number;
  amplitudeX?: number; amplitudeY?: number;
  phaseDelta?: number;
  // Spiral
  spiralTurns?: number;
  spiralGrowth?: number;
  // Circle
  radiusX?: number; radiusY?: number;
  // SVG path
  pathData?: string;
}

export interface PathResult {
  component: ComponentDraft;
  points: Array<{ x: number; y: number; t: number }>;
  summary: string;
}

// ---------------------------------------------------------------------------
// Path sampling functions
// ---------------------------------------------------------------------------

/** Sample a cubic bezier curve at parameter t (0..1). */
function sampleBezier(p0x: number, p0y: number, p1x: number, p1y: number,
  p2x: number, p2y: number, p3x: number, p3y: number, t: number): { x: number; y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  const x = uuu * p0x + 3 * uu * t * p1x + 3 * u * tt * p2x + ttt * p3x;
  const y = uuu * p0y + 3 * uu * t * p1y + 3 * u * tt * p2y + ttt * p3y;
  return { x, y };
}

/** Sample a Lissajous figure at parameter t (0..1). */
function sampleLissajous(
  freqA: number, freqB: number,
  ampX: number, ampY: number,
  phaseDelta: number, t: number,
): { x: number; y: number } {
  const angle = t * Math.PI * 2;
  return {
    x: ampX * Math.sin(freqA * angle + phaseDelta),
    y: ampY * Math.sin(freqB * angle),
  };
}

/** Sample an Archimedean spiral at parameter t (0..1). */
function sampleSpiral(turns: number, growth: number, t: number): { x: number; y: number } {
  const angle = t * Math.PI * 2 * turns;
  const r = growth * t;
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}

/** Sample a lemniscate (figure-eight) at parameter t (0..1). */
function sampleFigureEight(t: number, scale: number): { x: number; y: number } {
  const angle = t * Math.PI * 2;
  const denom = 1 + Math.sin(angle) * Math.sin(angle);
  return {
    x: (scale * Math.cos(angle)) / denom,
    y: (scale * Math.sin(angle) * Math.cos(angle)) / denom,
  };
}

/** Sample a heart curve at parameter t (0..1). */
function sampleHeart(t: number, scale: number): { x: number; y: number } {
  const angle = t * Math.PI * 2;
  const x = scale * 16 * Math.pow(Math.sin(angle), 3);
  const y = -scale * (13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle));
  return { x: x / 16, y: y / 16 };
}

/** Sample a circle/ellipse at parameter t (0..1). */
function sampleCircle(radiusX: number, radiusY: number, t: number): { x: number; y: number } {
  const angle = t * Math.PI * 2;
  return { x: radiusX * Math.cos(angle), y: radiusY * Math.sin(angle) };
}

/**
 * Parse a simple SVG path data string and sample points along it.
 * Supports M (moveto), L (lineto), C (cubic bezier), Q (quadratic bezier).
 */
function sampleSvgPath(pathData: string, t: number): { x: number; y: number } {
  // Parse commands
  const commands = pathData.match(/[MLCQZ][^MLCQZ]*/gi) || [];
  const segments: Array<{ type: string; pts: number[] }> = [];
  let curX = 0, curY = 0;
  let startX = 0, startY = 0;

  for (const cmd of commands) {
    const type = cmd[0].toUpperCase();
    const nums = (cmd.slice(1).trim().match(/-?\d+\.?\d*/g) || []).map(Number);
    if (type === "M") {
      curX = nums[0]; curY = nums[1];
      startX = curX; startY = curY;
    } else if (type === "L") {
      segments.push({ type: "L", pts: [curX, curY, nums[0], nums[1]] });
      curX = nums[0]; curY = nums[1];
    } else if (type === "C") {
      segments.push({ type: "C", pts: [curX, curY, nums[0], nums[1], nums[2], nums[3], nums[4], nums[5]] });
      curX = nums[4]; curY = nums[5];
    } else if (type === "Q") {
      segments.push({ type: "Q", pts: [curX, curY, nums[0], nums[1], nums[2], nums[3]] });
      curX = nums[2]; curY = nums[3];
    } else if (type === "Z") {
      segments.push({ type: "L", pts: [curX, curY, startX, startY] });
      curX = startX; curY = startY;
    }
  }

  if (segments.length === 0) return { x: 0, y: 0 };

  // Sample at parameter t across all segments
  const segIdx = Math.floor(t * segments.length);
  const seg = segments[Math.min(segIdx, segments.length - 1)];
  const localT = (t * segments.length) % 1;

  if (seg.type === "L") {
    return {
      x: seg.pts[0] + (seg.pts[2] - seg.pts[0]) * localT,
      y: seg.pts[1] + (seg.pts[3] - seg.pts[1]) * localT,
    };
  } else if (seg.type === "C") {
    return sampleBezier(seg.pts[0], seg.pts[1], seg.pts[2], seg.pts[3],
      seg.pts[4], seg.pts[5], seg.pts[6], seg.pts[7], localT);
  } else if (seg.type === "Q") {
    const u = 1 - localT;
    return {
      x: u * u * seg.pts[0] + 2 * u * localT * seg.pts[2] + localT * localT * seg.pts[4],
      y: u * u * seg.pts[1] + 2 * u * localT * seg.pts[3] + localT * localT * seg.pts[5],
    };
  }
  return { x: 0, y: 0 };
}

// ---------------------------------------------------------------------------
// Main generation function
// ---------------------------------------------------------------------------

export function generatePathMotion(config: Partial<PathConfig> = {}): PathResult {
  const c: PathConfig = {
    type: "lissajous",
    durationMs: 2000,
    samples: 60,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    loop: true,
    name: "Path Motion",
    params: {},
    ...config,
  };
  const p = c.params;

  const points: Array<{ x: number; y: number; t: number }> = [];
  const keyframes: Keyframe[] = [];

  for (let i = 0; i <= c.samples; i++) {
    const t = i / c.samples;
    let pt: { x: number; y: number } = { x: 0, y: 0 };

    switch (c.type) {
      case "bezier":
        pt = sampleBezier(
          p.p0x ?? 0, p.p0y ?? 0,
          p.p1x ?? 100, p.p1y ?? 200,
          p.p2x ?? 200, p.p2y ?? 0,
          p.p3x ?? 300, p.p3y ?? 100,
          t,
        );
        break;
      case "lissajous":
        pt = sampleLissajous(
          p.freqA ?? 3, p.freqB ?? 2,
          p.amplitudeX ?? 100, p.amplitudeY ?? 100,
          p.phaseDelta ?? Math.PI / 2,
          t,
        );
        break;
      case "spiral":
        pt = sampleSpiral(p.spiralTurns ?? 3, p.spiralGrowth ?? 100, t);
        break;
      case "figure-eight":
        pt = sampleFigureEight(t, 100);
        break;
      case "heart":
        pt = sampleHeart(t, c.scale * 5);
        break;
      case "circle":
        pt = sampleCircle(p.radiusX ?? 100, p.radiusY ?? 100, t);
        break;
      case "svg-path":
        pt = sampleSvgPath(p.pathData ?? "M0,0 L100,0 L100,100 L0,100 Z", t);
        break;
    }

    // Apply scale and offset
    const x = Math.round(pt.x * c.scale + c.offsetX);
    const y = Math.round(pt.y * c.scale + c.offsetY);
    points.push({ x, y, t });
    keyframes.push(kf(t, { translateX: x, translateY: y }));
  }

  const component = draft(c.name, {
    durationMs: c.durationMs,
    easing: easingPreset("linear"),
    iterationCount: c.loop ? "infinite" : 1,
    keyframes,
    style: {
      _content: "",
      _tag: "div",
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      backgroundColor: "#ffffff",
      boxShadow: "0 0 12px rgba(255,255,255,0.6)",
    },
  });

  const summary = `Path motion: ${c.type}, ${c.samples} samples over ${c.durationMs}ms${c.loop ? " (loop)" : ""}`;

  return { component, points, summary };
}

// ---------------------------------------------------------------------------
// Preset configurations
// ---------------------------------------------------------------------------

export interface PathPreset {
  id: string;
  name: string;
  description: string;
  type: PathType;
  config: Partial<PathConfig>;
}

export const PATH_PRESETS: PathPreset[] = [
  {
    id: "lissajous-3-2",
    name: "Lissajous 3:2",
    description: "Classic Lissajous figure with 3:2 frequency ratio — creates a smooth, closed loop curve.",
    type: "lissajous",
    config: {
      type: "lissajous",
      durationMs: 3000,
      samples: 80,
      name: "Lissajous 3:2",
      params: { freqA: 3, freqB: 2, amplitudeX: 120, amplitudeY: 80, phaseDelta: Math.PI / 2 },
    },
  },
  {
    id: "lissajous-5-4",
    name: "Lissajous 5:4",
    description: "Complex Lissajous figure with 5:4 ratio — intricate woven pattern.",
    type: "lissajous",
    config: {
      type: "lissajous",
      durationMs: 4000,
      samples: 100,
      name: "Lissajous 5:4",
      params: { freqA: 5, freqB: 4, amplitudeX: 100, amplitudeY: 100, phaseDelta: Math.PI / 3 },
    },
  },
  {
    id: "spiral-archimedean",
    name: "Archimedean Spiral",
    description: "Spiral expanding outward from center — 4 turns with linear growth.",
    type: "spiral",
    config: {
      type: "spiral",
      durationMs: 2500,
      samples: 80,
      name: "Archimedean Spiral",
      params: { spiralTurns: 4, spiralGrowth: 120 },
    },
  },
  {
    id: "figure-eight",
    name: "Figure Eight",
    description: "Lemniscate curve — smooth figure-eight loop with elegant crossings.",
    type: "figure-eight",
    config: {
      type: "figure-eight",
      durationMs: 2000,
      samples: 60,
      name: "Figure Eight",
    },
  },
  {
    id: "heart-curve",
    name: "Heart Curve",
    description: "Parametric heart shape — romantic motion tracing a heart outline.",
    type: "heart",
    config: {
      type: "heart",
      durationMs: 3000,
      samples: 80,
      scale: 1.5,
      name: "Heart Curve",
    },
  },
  {
    id: "circle-orbit",
    name: "Circular Orbit",
    description: "Simple circular orbit — clean, continuous rotation path.",
    type: "circle",
    config: {
      type: "circle",
      durationMs: 2000,
      samples: 60,
      name: "Circular Orbit",
      params: { radiusX: 100, radiusY: 100 },
    },
  },
  {
    id: "ellipse-orbit",
    name: "Elliptical Orbit",
    description: "Elliptical orbit — stretched circle creating a flattened loop.",
    type: "circle",
    config: {
      type: "circle",
      durationMs: 2500,
      samples: 60,
      name: "Elliptical Orbit",
      params: { radiusX: 150, radiusY: 60 },
    },
  },
  {
    id: "bezier-s-curve",
    name: "S-Curve Bezier",
    description: "Smooth S-shaped cubic bezier path — elegant flowing motion.",
    type: "bezier",
    config: {
      type: "bezier",
      durationMs: 1500,
      samples: 50,
      name: "S-Curve Bezier",
      params: { p0x: 0, p0y: 0, p1x: 50, p1y: 100, p2x: 150, p2y: -100, p3x: 200, p3y: 0 },
    },
  },
];

export function listPathPresets(): PathPreset[] {
  return [...PATH_PRESETS];
}

export function runPathPreset(presetId: string): PathResult | null {
  const preset = PATH_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  return generatePathMotion(preset.config);
}

export function listPathTypes(): Array<{ id: PathType; name: string; description: string }> {
  return [
    { id: "bezier", name: "Bezier Curve", description: "Cubic bezier with 4 control points" },
    { id: "lissajous", name: "Lissajous Figure", description: "Parametric curve with frequency ratios" },
    { id: "spiral", name: "Spiral", description: "Archimedean spiral expanding outward" },
    { id: "figure-eight", name: "Figure Eight", description: "Lemniscate of Bernoulli" },
    { id: "heart", name: "Heart Curve", description: "Parametric heart shape" },
    { id: "circle", name: "Circle/Ellipse", description: "Circular or elliptical orbit" },
    { id: "svg-path", name: "SVG Path", description: "Sample positions along an SVG path data string" },
  ];
}
