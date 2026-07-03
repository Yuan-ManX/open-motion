import type { MotionComponent, Easing, KeyValue, TransformProperty } from "@openmotion/shared";
import { easingToCss, isTransformProperty } from "@openmotion/shared";

const RESERVED_STYLE_KEYS = new Set(["_content", "_tag", "_label"]);

interface SplitStyle {
  css: Record<string, string | number>;
  content: string;
  tag: string;
}

function splitStyle(style: Record<string, string | number>): SplitStyle {
  const css: Record<string, string | number> = {};
  let content = "";
  let tag = "div";
  for (const [k, v] of Object.entries(style)) {
    if (k === "_content") content = String(v);
    else if (k === "_tag") tag = String(v);
    else if (RESERVED_STYLE_KEYS.has(k)) continue;
    else css[k] = v;
  }
  return { css, content, tag };
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

const UNITS: Partial<Record<TransformProperty, string>> = {
  translateX: "px", translateY: "px", translateZ: "px",
  scale: "", scaleX: "", scaleY: "",
  rotate: "deg", rotateX: "deg", rotateY: "deg", rotateZ: "deg",
  skewX: "deg", skewY: "deg",
  opacity: "", borderRadius: "px", width: "px", height: "px",
  fontSize: "px", letterSpacing: "px", blur: "px",
  color: "", backgroundColor: "", boxShadow: "",
};

function formatValue(prop: TransformProperty, value: KeyValue): string {
  if (typeof value === "string") return value;
  return `${value}${UNITS[prop] ?? ""}`;
}

function buildTransformString(props: Partial<Record<TransformProperty, KeyValue>>): string | null {
  const order: TransformProperty[] = [
    "translateX", "translateY", "translateZ", "scale", "scaleX", "scaleY",
    "rotate", "rotateX", "rotateY", "rotateZ", "skewX", "skewY",
  ];
  const parts: string[] = [];
  for (const p of order) {
    const v = props[p];
    if (v === undefined) continue;
    parts.push(`${p}(${formatValue(p, v)})`);
  }
  return parts.length ? parts.join(" ") : null;
}

function percent(offset: number): string {
  return `${(offset * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function styleToCss(style: Record<string, string | number>): string {
  return Object.entries(style)
    .map(([k, v]) => `${camelToKebab(k)}: ${typeof v === "number" ? `${v}px` : v};`)
    .join(" ");
}

export interface RenderedNode {
  tag: string;
  className: string;
  content: string;
  name: string;
  componentId: string;
}

export interface RenderedSpec {
  css: string;
  nodes: RenderedNode[];
}

/** Render a MotionSpec into a CSS string + DOM node descriptors, aligned with the backend generator. */
export function renderSpec(components: MotionComponent[]): RenderedSpec {
  const sorted = [...components].sort((a, b) => a.orderIndex - b.orderIndex);
  const cssBlocks: string[] = [];
  const nodes: RenderedNode[] = [];

  for (const component of sorted) {
    const animationName = `om-anim-${component.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const className = `om-c-${component.id}`;
    const { css: cssStyle, content, tag } = splitStyle(component.style);

    // @keyframes
    const frames = [...component.keyframes].sort((a, b) => a.offset - b.offset);
    const kfLines: string[] = [];
    for (const frame of frames) {
      const decls: string[] = [];
      const transform = buildTransformString(frame.properties);
      if (transform) decls.push(`transform: ${transform};`);
      let filter: string | null = null;
      for (const [prop, value] of Object.entries(frame.properties)) {
        if (prop === "blur") {
          filter = `blur(${formatValue("blur", value)})`;
          continue;
        }
        if (isTransformProperty(prop as TransformProperty)) continue;
        decls.push(`${camelToKebab(prop)}: ${formatValue(prop as TransformProperty, value)};`);
      }
      if (filter) decls.push(`filter: ${filter};`);
      if (frame.easing && frame.easing.type !== "preset") {
        decls.push(`animation-timing-function: ${easingToCss(frame.easing as Easing)};`);
      }
      kfLines.push(`  ${percent(frame.offset)} { ${decls.join(" ")} }`);
    }
    if (frames.length) {
      cssBlocks.push(`@keyframes ${animationName} {\n${kfLines.join("\n")}\n}`);
    }

    // element rule
    const iteration =
      component.iterationCount === "infinite" ? "infinite" : String(component.iterationCount);
    const ruleDecls = [
      styleToCss(cssStyle),
      `animation-name: ${frames.length ? animationName : "none"};`,
      `animation-duration: ${component.durationMs}ms;`,
      `animation-timing-function: ${easingToCss(component.easing)};`,
      `animation-delay: ${component.delayMs}ms;`,
      `animation-iteration-count: ${iteration};`,
      `animation-direction: ${component.direction};`,
      `animation-fill-mode: ${component.fillMode};`,
      `animation-play-state: ${component.playState};`,
    ].filter(Boolean);
    cssBlocks.push(`.${className} { ${ruleDecls.join(" ")} }`);

    nodes.push({
      tag,
      className,
      content: content || component.name,
      name: component.name,
      componentId: component.id,
    });
  }

  return { css: cssBlocks.join("\n\n"), nodes };
}
