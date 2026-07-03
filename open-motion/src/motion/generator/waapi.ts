import type { Easing, MotionComponent, TransformProperty } from "@openmotion/shared";
import { easingToCss, isTransformProperty } from "@openmotion/shared";
import { buildTransformString } from "../units.js";

/**
 * Produce Web Animations API keyframe sets for a component. The frontend can
 * use these for interactive scrubbing / playback control on the timeline.
 */
export interface WaapiTrack {
  property: "transform" | TransformProperty | "filter";
  keyframes: { offset: number; value: string | number; easing?: string }[];
}

const easingStr = (e?: Easing) => (e ? easingToCss(e) : undefined);

export function toWaapiTracks(component: MotionComponent): WaapiTrack[] {
  const tracks: WaapiTrack[] = [];
  const transformFrames: { offset: number; value: string; easing?: string }[] = [];
  const filterFrames: { offset: number; value: string; easing?: string }[] = [];
  const propFrames: Record<string, { offset: number; value: string | number; easing?: string }[]> =
    {};

  const frames = [...component.keyframes].sort((a, b) => a.offset - b.offset);
  for (const f of frames) {
    const t = buildTransformString(f.properties);
    if (t) transformFrames.push({ offset: f.offset, value: t, easing: easingStr(f.easing) });
    for (const [p, v] of Object.entries(f.properties)) {
      if (isTransformProperty(p)) continue;
      if (p === "blur") {
        filterFrames.push({ offset: f.offset, value: `blur(${v})`, easing: easingStr(f.easing) });
        continue;
      }
      (propFrames[p] ??= []).push({
        offset: f.offset,
        value: v as string | number,
        easing: easingStr(f.easing),
      });
    }
  }
  if (transformFrames.length)
    tracks.push({ property: "transform", keyframes: transformFrames });
  if (filterFrames.length) tracks.push({ property: "filter", keyframes: filterFrames });
  for (const [p, kfs] of Object.entries(propFrames)) {
    tracks.push({ property: p as TransformProperty, keyframes: kfs });
  }
  return tracks;
}
