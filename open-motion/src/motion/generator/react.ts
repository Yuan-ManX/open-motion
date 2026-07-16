import type { MotionComponent, TransformProperty } from "@openmotion/shared";
import { easingToCss } from "@openmotion/shared";
import { isTransformProperty, buildTransformString, formatValue } from "../units.js";

const RESERVED_STYLE_KEYS = new Set(["_content", "_tag", "_label", "_src", "_poster", "_loop", "_muted", "_autoplay", "_controls", "_compId", "_compName"]);

interface SplitStyle {
  cssStyle: Record<string, string | number>;
  content: string;
  tag: string;
  src: string | null;
}

function splitStyle(style: Record<string, string | number>): SplitStyle {
  const cssStyle: Record<string, string | number> = {};
  let content = "";
  let tag = "div";
  let src: string | null = null;
  for (const [k, v] of Object.entries(style)) {
    if (k === "_content") content = String(v);
    else if (k === "_tag") tag = String(v);
    else if (k === "_src") src = String(v);
    else if (RESERVED_STYLE_KEYS.has(k)) continue;
    else cssStyle[k] = v;
  }
  return { cssStyle, content, tag, src };
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function styleToJsxObject(style: Record<string, string | number>): string {
  const entries = Object.entries(style);
  if (entries.length === 0) return "{}";
  const pairs = entries.map(([k, v]) => {
    const camelKey = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (typeof v === "number") return `${camelKey}: ${v}`;
    return `${camelKey}: "${v}"`;
  });
  return `{ ${pairs.join(", ")} }`;
}

function percent(offset: number): string {
  return `${(offset * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

/** Generate a unique animation name from a component. */
function animationName(name: string): string {
  return `anim_${name.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

/** Convert keyframe properties to CSS keyframe declaration body. */
function keyframeToCss(properties: Record<string, string | number>): string {
  const decls: string[] = [];
  const transform = buildTransformString(properties as Partial<Record<TransformProperty, string | number>>);
  if (transform) decls.push(`transform: ${transform};`);
  let filter: string | null = null;
  for (const [prop, value] of Object.entries(properties)) {
    if (prop === "blur") {
      filter = `blur(${formatValue("blur", value)})`;
      continue;
    }
    if (isTransformProperty(prop)) continue;
    const cssProp = camelToKebab(prop);
    const formatted = formatValue(prop as TransformProperty, value);
    decls.push(`${cssProp}: ${formatted};`);
  }
  if (filter) decls.push(`filter: ${filter};`);
  return decls.join(" ");
}

/** Generate CSS keyframes block for a component. */
function generateKeyframes(component: MotionComponent): string {
  const name = animationName(component.name);
  if (component.keyframes.length === 0) return "";
  const blocks = component.keyframes.map((kf) => {
    const body = keyframeToCss(kf.properties as Record<string, string | number>);
    return `  ${percent(kf.offset)} { ${body} }`;
  });
  return `@keyframes ${name} {\n${blocks.join("\n")}\n}`;
}

/** Generate the animation shorthand CSS property. */
function animationProperty(component: MotionComponent): string {
  const name = animationName(component.name);
  const duration = `${component.durationMs}ms`;
  const easing = easingToCss(component.easing);
  const delay = `${component.delayMs}ms`;
  const iterations = component.iterationCount === "infinite" ? "infinite" : String(component.iterationCount);
  const direction = component.direction;
  const fillMode = component.fillMode;
  const playState = component.playState;
  return `${name} ${duration} ${easing} ${delay} ${iterations} ${direction} ${fillMode} ${playState}`;
}

export interface ReactCodeOptions {
  /** Output format: "react" for standard React + CSS, "framer" for Framer Motion. */
  format?: "react" | "framer";
  /** Component name override. */
  componentName?: string;
  /** Include TypeScript types. */
  typescript?: boolean;
}

/** Generate a React component from a single MotionComponent. */
export function generateReactComponent(
  component: MotionComponent,
  opts: ReactCodeOptions = {},
): string {
  const format = opts.format ?? "react";
  const componentName = opts.componentName || component.name.replace(/[^a-zA-Z0-9]/g, "") || "MotionElement";
  const ts = opts.typescript ?? true;
  const { cssStyle, content, tag, src } = splitStyle(component.style as Record<string, string | number>);

  if (format === "framer") {
    return generateFramerComponent(component, componentName, cssStyle, content, tag, src, ts);
  }

  return generateStandardReact(component, componentName, cssStyle, content, tag, src, ts);
}

/** Generate standard React component with CSS animations. */
function generateStandardReact(
  component: MotionComponent,
  componentName: string,
  cssStyle: Record<string, string | number>,
  content: string,
  tag: string,
  src: string | null,
  ts: boolean,
): string {
  const animName = animationName(component.name);
  const keyframes = generateKeyframes(component);
  const animation = animationProperty(component);
  const fullStyle = { ...cssStyle, animation };
  const styleStr = styleToJsxObject(fullStyle);

  const propsType = ts ? `: React.FC<{ className?: string; style?: React.CSSProperties }>` : "";
  const propsSig = ts ? `({ className, style }: { className?: string; style?: React.CSSProperties })` : `({ className, style })`;

  const mediaTag = tag === "img" && src ? `    <img src="${src}" alt="${component.name}" className={className} style={{ ...baseStyle, ...style }} />`
    : tag === "video" && src ? `    <video src="${src}" autoPlay loop muted playsInline className={className} style={{ ...baseStyle, ...style }} />`
    : content ? `    <${tag} className={className} style={{ ...baseStyle, ...style }}>${content}</${tag}>`
    : `    <${tag} className={className} style={{ ...baseStyle, ...style}} />`;

  return `import React from "react";

const baseStyle${ts ? ": React.CSSProperties" : ""} = ${styleStr};

const keyframesCss = \`
${keyframes}
\`;

// Inject keyframes into document head
if (typeof document !== "undefined") {
  const styleEl = document.createElement("style");
  styleEl.textContent = keyframesCss;
  document.head.appendChild(styleEl);
}

export const ${componentName}${propsType} = ${propsSig} => (
${mediaTag}
);

export default ${componentName};
`;
}

/** Generate Framer Motion component using motion components. */
function generateFramerComponent(
  component: MotionComponent,
  componentName: string,
  cssStyle: Record<string, string | number>,
  content: string,
  tag: string,
  src: string | null,
  ts: boolean,
): string {
  const propsType = ts ? `: React.FC<{ className?: string }>` : "";
  const propsSig = ts ? `({ className }: { className?: string })` : `({ className })`;

  // Convert keyframes to Framer Motion variants
  const initial: Record<string, string | number> = {};
  const animate: Record<string, string | number> = {};

  if (component.keyframes.length > 0) {
    const first = component.keyframes[0];
    const last = component.keyframes[component.keyframes.length - 1];
    for (const [prop, value] of Object.entries(first.properties)) {
      if (prop === "translateX") initial.x = value;
      else if (prop === "translateY") initial.y = value;
      else if (prop === "scale") initial.scale = value;
      else if (prop === "scaleX") initial.scaleX = value;
      else if (prop === "scaleY") initial.scaleY = value;
      else if (prop === "rotate") initial.rotate = value;
      else if (prop === "opacity") initial.opacity = value;
      else if (prop === "blur") initial.filter = `blur(${value}px)`;
    }
    for (const [prop, value] of Object.entries(last.properties)) {
      if (prop === "translateX") animate.x = value;
      else if (prop === "translateY") animate.y = value;
      else if (prop === "scale") animate.scale = value;
      else if (prop === "scaleX") animate.scaleX = value;
      else if (prop === "scaleY") animate.scaleY = value;
      else if (prop === "rotate") animate.rotate = value;
      else if (prop === "opacity") animate.opacity = value;
      else if (prop === "blur") animate.filter = `blur(${value}px)`;
    }
  }

  // Build easing config
  const easing = component.easing;
  let transition = `{ duration: ${(component.durationMs / 1000).toFixed(2)}, delay: ${(component.delayMs / 1000).toFixed(2)}`;
  if (easing.type === "preset") {
    const presetMap: Record<string, string> = {
      "ease": "easeInOut",
      "ease-in": "easeIn",
      "ease-out": "easeOut",
      "ease-in-out": "easeInOut",
      "linear": "linear",
      "bounce": "backOut",
      "spring": "spring",
    };
    transition += `, ease: "${presetMap[easing.name] || "easeOut"}"`;
  } else if (easing.type === "spring") {
    transition = `{ type: "spring", stiffness: ${easing.stiffness}, damping: ${easing.damping}, delay: ${(component.delayMs / 1000).toFixed(2)}`;
  }
  if (component.iterationCount === "infinite") transition += ", repeat: Infinity";
  else if (typeof component.iterationCount === "number" && component.iterationCount > 1) transition += `, repeat: ${component.iterationCount - 1}`;
  transition += " }";

  const initialStr = Object.entries(initial).map(([k, v]) => `${k}: ${v}`).join(", ");
  const animateStr = Object.entries(animate).map(([k, v]) => `${k}: ${v}`).join(", ");
  const styleStr = Object.entries(cssStyle).map(([k, v]) => {
    const camelKey = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    return `${camelKey}: ${typeof v === "number" ? v : `"${v}"`}`;
  }).join(", ");

  const motionTag = tag === "img" ? "motion.img"
    : tag === "video" ? "motion.video"
    : `motion.${tag}`;

  const mediaProps = tag === "img" && src ? ` src="${src}" alt="${component.name}"`
    : tag === "video" && src ? ` src="${src}" autoPlay loop muted playsInline`
    : "";

  return `import React from "react";
import { motion } from "framer-motion";

export const ${componentName}${propsType} = ${propsSig} => (
  <${motionTag}
${mediaProps ? `${mediaProps}\n` : ""}    className={className}
    style={{ ${styleStr} }}
    initial={{ ${initialStr} }}
    animate={{ ${animateStr} }}
    transition={${transition}}
  >
${content ? `    ${content}\n  ` : "  "}</${motionTag}>
);

export default ${componentName};
`;
}

/** Generate a complete React component file from multiple MotionComponents. */
export function generateReactFile(
  components: MotionComponent[],
  opts: ReactCodeOptions = {},
): string {
  if (components.length === 1) {
    return generateReactComponent(components[0], opts);
  }

  const componentDefs = components.map((c, i) => {
    const name = c.name.replace(/[^a-zA-Z0-9]/g, "") || `Element${i}`;
    return generateReactComponent(c, { ...opts, componentName: name });
  }).join("\n\n");

  return componentDefs;
}
