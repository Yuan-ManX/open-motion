import type { MotionComponent } from "@openmotion/shared";
import { easingToCss } from "@openmotion/shared";
import { buildTransformString, formatValue, isTransformProperty } from "../units.js";

export interface GeneratedCss {
  animationName: string;
  keyframesBlock: string;
  ruleBlock: string;
}

function percent(offset: number): string {
  return `${(offset * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

function styleToCss(style: Record<string, string | number>): string {
  return Object.entries(style)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => `${camelToKebab(k)}: ${typeof v === "number" ? `${v}px` : v};`)
    .join(" ");
}

export function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Generate @keyframes + the element rule for a single component. */
export function generateComponentCss(component: MotionComponent): GeneratedCss {
  const animationName = `om-anim-${component.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const selector = component.selector || `.om-c-${component.id}`;

  // ---- @keyframes ----
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
      if (isTransformProperty(prop)) continue;
      decls.push(`${camelToKebab(prop)}: ${formatValue(prop as never, value)};`);
    }
    if (filter) decls.push(`filter: ${filter};`);
    if (frame.easing && frame.easing.type !== "preset") {
      // per-keyframe easing (animation-timing-function inside keyframes)
      decls.push(`animation-timing-function: ${easingToCss(frame.easing)};`);
    }
    kfLines.push(`  ${percent(frame.offset)} { ${decls.join(" ")} }`);
  }
  const keyframesBlock = frames.length
    ? `@keyframes ${animationName} {\n${kfLines.join("\n")}\n}`
    : "";

  // ---- element rule ----
  const iteration =
    component.iterationCount === "infinite" ? "infinite" : String(component.iterationCount);
  const staticCss = styleToCss(component.style);
  const ruleDecls = [
    staticCss,
    `animation-name: ${frames.length ? animationName : "none"};`,
    `animation-duration: ${component.durationMs}ms;`,
    `animation-timing-function: ${easingToCss(component.easing)};`,
    `animation-delay: ${component.delayMs}ms;`,
    `animation-iteration-count: ${iteration};`,
    `animation-direction: ${component.direction};`,
    `animation-fill-mode: ${component.fillMode};`,
    `animation-play-state: ${component.playState};`,
  ].filter(Boolean);
  const ruleBlock = `${selector} { ${ruleDecls.join(" ")} }`;

  return { animationName, keyframesBlock, ruleBlock };
}

/** Generate the full stylesheet for a spec (all components). */
export function generateSpecCss(components: MotionComponent[]): string {
  const blocks = components
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((c) => {
      const g = generateComponentCss(c);
      return [g.keyframesBlock, g.ruleBlock].filter(Boolean).join("\n");
    })
    .filter(Boolean);
  return blocks.join("\n\n");
}
