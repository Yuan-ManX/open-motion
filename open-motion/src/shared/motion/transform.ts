import { z } from "zod";

/**
 * Animatable properties. Transform-family props are folded into a single
 * CSS `transform` string by the generator; the rest map to their own CSS keys.
 */
export const TRANSFORM_PROPERTIES = [
  "translateX",
  "translateY",
  "translateZ",
  "scale",
  "scaleX",
  "scaleY",
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ",
  "skewX",
  "skewY",
] as const;

export const NON_TRANSFORM_PROPERTIES = [
  "opacity",
  "blur",
  "color",
  "backgroundColor",
  "width",
  "height",
  "borderRadius",
  "fontSize",
  "letterSpacing",
  "boxShadow",
] as const;

export const TransformPropertySchema = z.enum([
  ...TRANSFORM_PROPERTIES,
  ...NON_TRANSFORM_PROPERTIES,
]);
export type TransformProperty = z.infer<typeof TransformPropertySchema>;

export const isTransformProperty = (p: string): boolean =>
  (TRANSFORM_PROPERTIES as readonly string[]).includes(p);

/** A keyframe value: numbers are unitless (interpreted per-property), strings pass through. */
export const KeyValueSchema = z.union([z.number(), z.string()]);
export type KeyValue = z.infer<typeof KeyValueSchema>;
