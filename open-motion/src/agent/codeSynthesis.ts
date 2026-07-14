/**
 * Code Synthesis — generates standalone, copy-pasteable animation code from
 * natural language descriptions.
 *
 * Unlike parse_motion (which applies a parsed spec to a project component) and
 * export_code (which serializes the current project state), the synthesizer
 * produces fresh, self-contained code snippets the user can drop into any
 * codebase. It supports four output formats:
 *   - css       @keyframes + a CSS class
 *   - react     a React component using the Web Animations API
 *   - html      a standalone HTML file
 *   - vanilla   a vanilla JS snippet using element.animate()
 *
 * The synthesizer leans on parseNaturalMotion to detect the motion verb,
 * direction, easing, duration, and loop count from the description, then
 * renders the matching code template.
 */

import type { Easing, Keyframe } from "@openmotion/shared";
import { easingToCss } from "@openmotion/shared";
import { parseNaturalMotion } from "../motion/naturalParser.js";

export type CodeFormat = "css" | "react" | "html" | "vanilla";

export interface SynthesizedCode {
  format: CodeFormat;
  description: string;
  verb: string;
  direction: string | null;
  easing: Easing;
  durationMs: number;
  delayMs: number;
  loop: number | "infinite";
  keyframes: Keyframe[];
  /** The generated code string. */
  code: string;
  /** A short name suitable for a CSS class or component name. */
  animationName: string;
  isValid: boolean;
  errors: string[];
}

/** Convert a description like "bounce in playfully" to a class-safe name. */
function deriveAnimationName(verb: string, direction: string | null): string {
  const dir = direction ? `-${direction}` : "";
  return `om-${verb}${dir}`.replace(/[^a-zA-Z0-9-]/g, "");
}

/** Render a keyframe's properties as a CSS declaration block. */
function keyframeToCss(kf: Keyframe): string {
  const decls: string[] = [];
  const transformParts: string[] = [];
  for (const [prop, value] of Object.entries(kf.properties)) {
    const v = String(value);
    if (prop === "translateX" || prop === "translateY" || prop === "translateZ") {
      transformParts.push(`${prop}(${v})`);
    } else if (prop === "scale") {
      transformParts.push(`scale(${v})`);
    } else if (prop === "rotate") {
      transformParts.push(`rotate(${v})`);
    } else if (prop === "rotateX" || prop === "rotateY" || prop === "rotateZ") {
      transformParts.push(`${prop}(${v})`);
    } else if (prop === "opacity") {
      decls.push(`opacity: ${v};`);
    } else if (prop === "boxShadow") {
      decls.push(`box-shadow: ${v};`);
    } else if (prop === "filter") {
      decls.push(`filter: ${v};`);
    } else {
      decls.push(`${camelToKebab(prop)}: ${v};`);
    }
  }
  if (transformParts.length > 0) decls.push(`transform: ${transformParts.join(" ")};`);
  if (kf.easing && kf.easing.type !== "preset") {
    decls.push(`animation-timing-function: ${easingToCss(kf.easing)};`);
  }
  return decls.join(" ");
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function pct(offset: number): string {
  return `${(offset * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

/** Generate the @keyframes block + a CSS class. */
function generateCss(name: string, keyframes: Keyframe[], easing: Easing, durationMs: number, delayMs: number, loop: number | "infinite"): string {
  const kfBlock = keyframes
    .map((kf) => `  ${pct(kf.offset)} { ${keyframeToCss(kf)} }`)
    .join("\n");

  const iteration = loop === "infinite" ? "infinite" : String(loop);
  const easingCss = easingToCss(easing);

  return `@keyframes ${name} {
${kfBlock}
}

.${name} {
  animation: ${name} ${durationMs}ms ${easingCss} ${delayMs}ms ${iteration} both;
}`;
}

/** Generate a React component using the Web Animations API. */
function generateReact(name: string, keyframes: Keyframe[], easing: Easing, durationMs: number, delayMs: number, loop: number | "infinite"): string {
  const pascalName = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");

  const waaKeyframes = keyframes.map((kf) => {
    const obj: Record<string, string | number> = {};
    const transformParts: string[] = [];
    for (const [prop, value] of Object.entries(kf.properties)) {
      const v = typeof value === "number" ? value : String(value);
      if (prop === "translateX" || prop === "translateY" || prop === "translateZ") {
        const axis = prop.slice(-1).toLowerCase();
        transformParts.push(`translate${axis.toUpperCase()}(${v})`);
      } else if (prop === "scale") {
        transformParts.push(`scale(${v})`);
      } else if (prop === "rotate" || prop === "rotateX" || prop === "rotateY" || prop === "rotateZ") {
        transformParts.push(`${prop}(${v})`);
      } else if (prop === "opacity" || prop === "boxShadow" || prop === "filter") {
        obj[prop === "boxShadow" ? "boxShadow" : prop] = v;
      } else {
        obj[prop] = v;
      }
    }
    if (transformParts.length > 0) obj.transform = transformParts.join(" ");
    obj.offset = kf.offset;
    return obj;
  });

  const easingCss = easingToCss(easing);
  const iterationValue = loop === "infinite" ? "Infinity" : String(loop);
  const keyframesJson = JSON.stringify(waaKeyframes, null, 4).replace(/\n/g, "\n      ");

  return `import { useRef, useEffect } from "react";

export function ${pascalName}({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = el.animate(
      ${keyframesJson},
      {
        duration: ${durationMs},
        delay: ${delayMs},
        iterations: ${iterationValue},
        easing: "${easingCss}",
        fill: "both",
      },
    );
    return () => anim.cancel();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}`;
}

/** Generate a standalone HTML file with the animation. */
function generateHtml(name: string, keyframes: Keyframe[], easing: Easing, durationMs: number, delayMs: number, loop: number | "infinite"): string {
  const css = generateCss(name, keyframes, easing, durationMs, delayMs, loop);
  const iteration = loop === "infinite" ? "infinite" : String(loop);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} animation</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #0a0a0a;
      font-family: system-ui, sans-serif;
    }
    .stage {
      width: 120px;
      height: 120px;
      background: #ffffff;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0a0a0a;
      font-weight: 600;
    }
${css.split("\n").map((l) => `    ${l}`).join("\n")}
  </style>
</head>
<body>
  <div class="stage ${name}">Hover</div>
</body>
</html>`;
}

/** Generate a vanilla JS snippet using element.animate(). */
function generateVanilla(name: string, keyframes: Keyframe[], easing: Easing, durationMs: number, delayMs: number, loop: number | "infinite"): string {
  const waaKeyframes = keyframes.map((kf) => {
    const obj: Record<string, string | number> = {};
    const transformParts: string[] = [];
    for (const [prop, value] of Object.entries(kf.properties)) {
      const v = typeof value === "number" ? value : String(value);
      if (prop === "translateX" || prop === "translateY" || prop === "translateZ") {
        transformParts.push(`translate${prop.slice(-1).toUpperCase()}(${v})`);
      } else if (prop === "scale" || prop === "rotate" || prop === "rotateX" || prop === "rotateY" || prop === "rotateZ") {
        transformParts.push(`${prop}(${v})`);
      } else {
        obj[prop === "boxShadow" ? "boxShadow" : prop] = v;
      }
    }
    if (transformParts.length > 0) obj.transform = transformParts.join(" ");
    obj.offset = kf.offset;
    return obj;
  });

  const easingCss = easingToCss(easing);
  const iterationValue = loop === "infinite" ? "Infinity" : String(loop);
  const keyframesJson = JSON.stringify(waaKeyframes, null, 2);

  return `// ${name} — generated by OpenMotion
const element = document.querySelector(".${name}");

element.animate(
  ${keyframesJson},
  {
    duration: ${durationMs},
    delay: ${delayMs},
    iterations: ${iterationValue},
    easing: "${easingCss}",
    fill: "both",
  }
);`;
}

/**
 * Synthesize standalone animation code from a natural language description.
 *
 * @param description  e.g. "bounce in playfully with spring physics"
 * @param format       css | react | html | vanilla
 */
export function synthesizeCode(description: string, format: CodeFormat = "css"): SynthesizedCode {
  const parsed = parseNaturalMotion(description);

  if (!parsed.isValid) {
    return {
      format,
      description,
      verb: "unknown",
      direction: null,
      easing: parsed.easing,
      durationMs: parsed.durationMs,
      delayMs: parsed.delayMs,
      loop: parsed.loop,
      keyframes: [],
      code: `// Could not synthesize code: ${parsed.errors.join("; ")}`,
      animationName: "om-error",
      isValid: false,
      errors: parsed.errors,
    };
  }

  const name = deriveAnimationName(parsed.verb, parsed.direction);

  let code: string;
  switch (format) {
    case "css":
      code = generateCss(name, parsed.keyframes, parsed.easing, parsed.durationMs, parsed.delayMs, parsed.loop);
      break;
    case "react":
      code = generateReact(name, parsed.keyframes, parsed.easing, parsed.durationMs, parsed.delayMs, parsed.loop);
      break;
    case "html":
      code = generateHtml(name, parsed.keyframes, parsed.easing, parsed.durationMs, parsed.delayMs, parsed.loop);
      break;
    case "vanilla":
      code = generateVanilla(name, parsed.keyframes, parsed.easing, parsed.durationMs, parsed.delayMs, parsed.loop);
      break;
    default:
      code = generateCss(name, parsed.keyframes, parsed.easing, parsed.durationMs, parsed.delayMs, parsed.loop);
  }

  return {
    format,
    description,
    verb: parsed.verb,
    direction: parsed.direction,
    easing: parsed.easing,
    durationMs: parsed.durationMs,
    delayMs: parsed.delayMs,
    loop: parsed.loop,
    keyframes: parsed.keyframes,
    code,
    animationName: name,
    isValid: true,
    errors: [],
  };
}
