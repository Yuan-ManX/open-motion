import type { TransformProperty } from "@openmotion/shared";
import { isTransformProperty } from "@openmotion/shared";
import type { KeyValue } from "@openmotion/shared";

/** Default unit per property (numbers get this appended; strings pass through). */
const UNITS: Partial<Record<TransformProperty, string>> = {
  translateX: "px",
  translateY: "px",
  translateZ: "px",
  scale: "",
  scaleX: "",
  scaleY: "",
  rotate: "deg",
  rotateX: "deg",
  rotateY: "deg",
  rotateZ: "deg",
  skewX: "deg",
  skewY: "deg",
  opacity: "",
  borderRadius: "px",
  width: "px",
  height: "px",
  fontSize: "px",
  letterSpacing: "px",
  blur: "px",
  color: "",
  backgroundColor: "",
  boxShadow: "",
};

export function formatValue(prop: TransformProperty, value: KeyValue): string {
  if (typeof value === "string") return value;
  const unit = UNITS[prop] ?? "";
  return `${value}${unit}`;
}

/** Build a CSS `transform` string from transform-family properties present in a frame. */
export function buildTransformString(
  props: Partial<Record<TransformProperty, KeyValue>>,
): string | null {
  const order: TransformProperty[] = [
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
  ];
  const parts: string[] = [];
  for (const p of order) {
    const v = props[p];
    if (v === undefined) continue;
    parts.push(`${p}(${formatValue(p, v)})`);
  }
  return parts.length ? parts.join(" ") : null;
}

export function isFilterProperty(p: string): boolean {
  return p === "blur";
}

export { isTransformProperty };
