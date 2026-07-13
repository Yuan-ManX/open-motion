import { getProjectSpec } from "../db/repositories/projects.js";
import type { Easing, MotionComponent, MotionSpec } from "@openmotion/shared";

export interface LottieExport {
  code: string;
  language: "json";
  filename: string;
}

interface LottieKeyframe {
  t: number;
  s: number[];
  e?: number[];
  i?: { x: number[]; y: number[] };
  o?: { x: number[]; y: number[] };
}

interface LottieTransform {
  o?: { a: number; k: number | LottieKeyframe[] };
  p?: { a: number; k: number[] | LottieKeyframe[] };
  s?: { a: number; k: number[] | LottieKeyframe[] };
  r?: { a: number; k: number | LottieKeyframe[] };
}

interface LottieLayer {
  ty: number;
  nm: string;
  ip: number;
  op: number;
  st: number;
  ks: LottieTransform;
  shapes?: unknown[];
}

interface LottieAnimation {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm: string;
  ddd: number;
  assets: unknown[];
  layers: LottieLayer[];
}

const DEFAULT_FPS = 60;

/** Convert an OpenMotion easing to Lottie bezier handles [outX, outY, inX, inY]. */
function easingToLottie(easing: Easing | undefined): { x: number[]; y: number[] }[] {
  if (!easing) {
    return [{ x: [0.5], y: [0.5] }, { x: [0.5], y: [0.5] }];
  }
  if (easing.type === "bezier") {
    return [
      { x: [easing.p1[0]], y: [easing.p1[1]] },
      { x: [easing.p2[0]], y: [easing.p2[1]] },
    ];
  }
  if (easing.type === "spring") {
    // Approximate spring with a slight overshoot bezier.
    return [
      { x: [0.3], y: [1.2] },
      { x: [0.6], y: [0.0] },
    ];
  }
  // Preset easings → approximate Lottie bezier handles.
  const name = easing.name.toLowerCase();
  if (name.includes("bounce") || name.includes("elastic") || name.includes("back")) {
    return [{ x: [0.2], y: [1.4] }, { x: [0.6], y: [0.0] }];
  }
  if (name.includes("smooth") || name.includes("in-out")) {
    return [{ x: [0.42], y: [0.0] }, { x: [0.58], y: [1.0] }];
  }
  if (name.includes("snappy") || name.includes("ease-in")) {
    return [{ x: [0.7], y: [0.0] }, { x: [0.9], y: [0.3] }];
  }
  if (name.includes("ease-out")) {
    return [{ x: [0.0], y: [0.0] }, { x: [0.3], y: [1.0] }];
  }
  return [{ x: [0.5], y: [0.5] }, { x: [0.5], y: [0.5] }];
}

/** Extract keyframes for a specific property from a component. */
function extractKeyframes(
  comp: MotionComponent,
  prop: string,
): Array<{ offset: number; value: number | string }> {
  const frames: Array<{ offset: number; value: number | string }> = [];
  for (const kf of comp.keyframes) {
    const props = kf.properties as Record<string, string | number>;
    const val = props[prop];
    if (val !== undefined) {
      frames.push({ offset: kf.offset, value: val });
    }
  }
  return frames.sort((a, b) => a.offset - b.offset);
}

/** Parse a CSS-like transform value to extract a numeric component. */
function parseNumericValue(val: number | string): number {
  if (typeof val === "number") return val;
  const match = val.match(/-?\d+\.?\d*/);
  return match ? parseFloat(match[0]) : 0;
}

/** Build Lottie opacity keyframes from component keyframes. */
function buildOpacityKeyframes(
  comp: MotionComponent,
  fps: number,
): { a: number; k: number | LottieKeyframe[] } {
  const frames = extractKeyframes(comp, "opacity");
  if (frames.length === 0) {
    return { a: 0, k: 100 };
  }
  if (frames.length === 1) {
    return { a: 0, k: parseNumericValue(frames[0].value) * 100 };
  }
  const handles = easingToLottie(comp.easing);
  const kfs: LottieKeyframe[] = frames.slice(0, -1).map((f, i) => {
    const next = frames[i + 1];
    return {
      t: Math.round(f.offset * (comp.durationMs / 1000) * fps),
      s: [parseNumericValue(f.value) * 100],
      e: [parseNumericValue(next.value) * 100],
      i: { x: handles[0].x, y: handles[0].y },
      o: { x: handles[1].x, y: handles[1].y },
    };
  });
  const last = frames[frames.length - 1];
  kfs.push({ t: Math.round(last.offset * (comp.durationMs / 1000) * fps), s: [parseNumericValue(last.value) * 100] });
  return { a: 1, k: kfs };
}

/** Build Lottie position keyframes from translateX/translateY. */
function buildPositionKeyframes(
  comp: MotionComponent,
  fps: number,
  baseX: number,
  baseY: number,
): { a: number; k: number[] | LottieKeyframe[] } {
  const xFrames = extractKeyframes(comp, "translateX");
  const yFrames = extractKeyframes(comp, "translateY");
  if (xFrames.length === 0 && yFrames.length === 0) {
    return { a: 0, k: [baseX, baseY, 0] };
  }
  const allOffsets = Array.from(new Set([...xFrames, ...yFrames].map((f) => f.offset))).sort((a, b) => a - b);
  if (allOffsets.length === 1) {
    const x = xFrames.length > 0 ? parseNumericValue(xFrames[0].value) : 0;
    const y = yFrames.length > 0 ? parseNumericValue(yFrames[0].value) : 0;
    return { a: 0, k: [baseX + x, baseY + y, 0] };
  }
  const handles = easingToLottie(comp.easing);
  const kfs: LottieKeyframe[] = allOffsets.slice(0, -1).map((offset, i) => {
    const xAt = xFrames.find((f) => f.offset === offset);
    const yAt = yFrames.find((f) => f.offset === offset);
    const nextOffset = allOffsets[i + 1];
    const xNext = xFrames.find((f) => f.offset === nextOffset);
    const yNext = yFrames.find((f) => f.offset === nextOffset);
    return {
      t: Math.round(offset * (comp.durationMs / 1000) * fps),
      s: [baseX + (xAt ? parseNumericValue(xAt.value) : 0), baseY + (yAt ? parseNumericValue(yAt.value) : 0), 0],
      e: [baseX + (xNext ? parseNumericValue(xNext.value) : 0), baseY + (yNext ? parseNumericValue(yNext.value) : 0), 0],
      i: { x: handles[0].x, y: handles[0].y },
      o: { x: handles[1].x, y: handles[1].y },
    };
  });
  const lastOffset = allOffsets[allOffsets.length - 1];
  const xLast = xFrames.find((f) => f.offset === lastOffset);
  const yLast = yFrames.find((f) => f.offset === lastOffset);
  kfs.push({
    t: Math.round(lastOffset * (comp.durationMs / 1000) * fps),
    s: [baseX + (xLast ? parseNumericValue(xLast.value) : 0), baseY + (yLast ? parseNumericValue(yLast.value) : 0), 0],
  });
  return { a: 1, k: kfs };
}

/** Build Lottie scale keyframes (percentages, 100 = 1.0). */
function buildScaleKeyframes(comp: MotionComponent, fps: number): { a: number; k: number[] | LottieKeyframe[] } {
  const frames = extractKeyframes(comp, "scale");
  if (frames.length === 0) {
    return { a: 0, k: [100, 100, 100] };
  }
  if (frames.length === 1) {
    const v = parseNumericValue(frames[0].value) * 100;
    return { a: 0, k: [v, v, 100] };
  }
  const handles = easingToLottie(comp.easing);
  const kfs: LottieKeyframe[] = frames.slice(0, -1).map((f, i) => {
    const next = frames[i + 1];
    const sv = parseNumericValue(f.value) * 100;
    const ev = parseNumericValue(next.value) * 100;
    return {
      t: Math.round(f.offset * (comp.durationMs / 1000) * fps),
      s: [sv, sv, 100],
      e: [ev, ev, 100],
      i: { x: handles[0].x, y: handles[0].y },
      o: { x: handles[1].x, y: handles[1].y },
    };
  });
  const last = frames[frames.length - 1];
  const lv = parseNumericValue(last.value) * 100;
  kfs.push({ t: Math.round(last.offset * (comp.durationMs / 1000) * fps), s: [lv, lv, 100] });
  return { a: 1, k: kfs };
}

/** Build Lottie rotation keyframes (degrees). */
function buildRotationKeyframes(comp: MotionComponent, fps: number): { a: number; k: number | LottieKeyframe[] } {
  const frames = extractKeyframes(comp, "rotate");
  if (frames.length === 0) {
    return { a: 0, k: 0 };
  }
  if (frames.length === 1) {
    return { a: 0, k: parseNumericValue(frames[0].value) };
  }
  const handles = easingToLottie(comp.easing);
  const kfs: LottieKeyframe[] = frames.slice(0, -1).map((f, i) => {
    const next = frames[i + 1];
    return {
      t: Math.round(f.offset * (comp.durationMs / 1000) * fps),
      s: [parseNumericValue(f.value)],
      e: [parseNumericValue(next.value)],
      i: { x: handles[0].x, y: handles[0].y },
      o: { x: handles[1].x, y: handles[1].y },
    };
  });
  const last = frames[frames.length - 1];
  kfs.push({ t: Math.round(last.offset * (comp.durationMs / 1000) * fps), s: [parseNumericValue(last.value)] });
  return { a: 1, k: kfs };
}

/** Convert a single MotionComponent to a Lottie layer. */
function componentToLayer(comp: MotionComponent, fps: number, canvasW: number, canvasH: number): LottieLayer {
  const durationFrames = Math.round((comp.durationMs / 1000) * fps);
  const delayFrames = Math.round((comp.delayMs / 1000) * fps);
  const totalFrames = durationFrames + delayFrames;

  // Base position: center of canvas, offset by component style if available.
  const styleX = comp.style?.left ? parseNumericValue(String(comp.style.left)) : canvasW / 2;
  const styleY = comp.style?.top ? parseNumericValue(String(comp.style.top)) : canvasH / 2;
  const baseX = typeof styleX === "number" ? styleX : canvasW / 2;
  const baseY = typeof styleY === "number" ? styleY : canvasH / 2;

  const ks: LottieTransform = {
    o: buildOpacityKeyframes(comp, fps),
    p: buildPositionKeyframes(comp, fps, baseX, baseY),
    s: buildScaleKeyframes(comp, fps),
    r: buildRotationKeyframes(comp, fps),
  };

  return {
    ty: 4, // shape layer
    nm: comp.name,
    ip: delayFrames,
    op: delayFrames + totalFrames,
    st: 0,
    ks,
  };
}

/** Export a project's MotionSpec as a Lottie JSON animation. */
export function exportProjectLottie(projectId: string, fps = DEFAULT_FPS): LottieExport | null {
  const spec = getProjectSpec(projectId);
  if (!spec) return null;

  const tokens = spec.project.tokens ?? {};
  const canvasW = Number(tokens.artboardWidth) || 640;
  const canvasH = Number(tokens.artboardHeight) || 360;
  const globalDuration = spec.project.globalTiming?.totalDurationMs ?? 3000;
  const totalFrames = Math.round((globalDuration / 1000) * fps);

  const layers = spec.components
    .sort((a, b) => b.orderIndex - a.orderIndex) // Lottie renders layers top-to-bottom
    .map((c) => componentToLayer(c, fps, canvasW, canvasH));

  const animation: LottieAnimation = {
    v: "5.7.4",
    fr: fps,
    ip: 0,
    op: totalFrames,
    w: canvasW,
    h: canvasH,
    nm: spec.project.name,
    ddd: 0,
    assets: [],
    layers,
  };

  const code = JSON.stringify(animation, null, 2);
  return {
    code,
    language: "json",
    filename: `${slug(spec.project.name)}.lottie.json`,
  };
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "openmotion";
}
