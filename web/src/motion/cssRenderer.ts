import type { MotionComponent, Easing, KeyValue, TransformProperty } from "@openmotion/shared";
import { easingToCss, isTransformProperty } from "@openmotion/shared";

const RESERVED_STYLE_KEYS = new Set([
  "_content", "_tag", "_label", "_src", "_poster", "_loop", "_muted", "_autoplay", "_controls",
  // Effect metadata tokens — stored on style for renderer/tool
  // coordination but never emitted as CSS properties themselves.
  "_motionBlur", "_motionBlurIntensity", "_motionBlurShutter",
  "_nullObject",
  "_trimPath", "_trimStart", "_trimEnd", "_trimOffset", "_trimAnimate", "_trimPathLength",
  "_trimPathMultiple",
  "_repeaterSource", "_repeaterIndex",
  "_echoSource", "_echoIndex",
  "_timeRemap", "_timeRemapRate", "_timeRemapFreezeAt",
  "_layerEffects",
  "_masks", "_trackMatte",
  "_shapeType", "_svgPath", "_svgFill", "_svgStroke", "_svgStrokeWidth",
  "_pathOp", "_pathOpAmount", "_pathOpParams",
  "_posterizeFps",
  "_textAnimators",
  "_gradientFill", "_gradientStroke",
  "_particleConfig",
  "_audioBinding",
  "_puppetPins", "_meshWarp",
  "_compId", "_compName",
  // 3D lighting system tokens.
  "_lightId", "_lightType", "_lightColor", "_lightIntensity", "_lightCone",
  "_castShadow", "_shadowOpacity", "_shadowBlur", "_shadowOffsetX", "_shadowOffsetY",
  "_cameraDOF", "_dofFocusDistance", "_dofAperture", "_dofBlurAmount",
  // Advanced color correction tokens (rendered as SVG feComponentTransfer chains).
  "_levels", "_curves", "_colorBalance", "_hueSaturation", "_vibrance",
  "_exposure", "_shadowHighlight", "_selectiveColor",
  // Data-driven animation tokens.
  "_dataBinding", "_dataSourceName", "_dataColumn", "_dataMapping",
]);

/** Check whether a style key is a private metadata token (underscore-prefixed)
 *  that should never be rendered directly as a CSS property. */
function isPrivateToken(key: string): boolean {
  return RESERVED_STYLE_KEYS.has(key) || key.startsWith("_expr") || key.startsWith("_");
}

interface SplitStyle {
  css: Record<string, string | number>;
  content: string;
  tag: string;
  src: string | null;
  poster: string | null;
  loop: boolean;
  muted: boolean;
  autoplay: boolean;
  controls: boolean;
}

function splitStyle(style: Record<string, string | number>): SplitStyle {
  const css: Record<string, string | number> = {};
  let content = "";
  let tag = "div";
  let src: string | null = null;
  let poster: string | null = null;
  let loop = false;
  let muted = false;
  let autoplay = true;
  let controls = false;
  for (const [k, v] of Object.entries(style)) {
    if (k === "_content") content = String(v);
    else if (k === "_tag") tag = String(v);
    else if (k === "_src") src = String(v);
    else if (k === "_poster") poster = String(v);
    else if (k === "_loop") loop = Boolean(v);
    else if (k === "_muted") muted = Boolean(v);
    else if (k === "_autoplay") autoplay = Boolean(v);
    else if (k === "_controls") controls = Boolean(v);
    else if (isPrivateToken(k)) continue;
    else css[k] = v;
  }
  return { css, content, tag, src, poster, loop, muted, autoplay, controls };
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
  src: string | null;
  poster: string | null;
  loop: boolean;
  muted: boolean;
  autoplay: boolean;
  controls: boolean;
  /** When present, the layer is driven by a JS runtime loop instead of (or in
   *  addition to) CSS keyframes. The frontend mounts a `<RuntimeLayer>` that
   *  reads this config and runs the appropriate animation driver. */
  runtime?: RuntimeLayerSpec;
}

/** Configuration for a JS-driven animation layer. */
export type RuntimeLayerSpec =
  | { kind: "particle"; config: Record<string, unknown> }
  | { kind: "audio"; config: Record<string, unknown> }
  | { kind: "expression"; config: { property: string; expression: string } };

export interface RenderedSpec {
  css: string;
  nodes: RenderedNode[];
  /** Inline SVG defs block (hidden) containing mask/filter/gradient
   *  definitions emitted by effect tools. Empty string when no defs. */
  svgDefs?: string;
  /** CSS declarations to apply to the canvas viewport container (e.g.
   *  perspective + perspective-origin for 3D camera). Empty when no camera. */
  cameraStyle?: string;
}

/** Render a MotionSpec into a CSS string + DOM node descriptors, aligned with the backend generator. */
export function renderSpec(components: MotionComponent[], speed = 1): RenderedSpec {
  const speedFactor = speed > 0 ? 1 / speed : 1;
  const sorted = [...components].sort((a, b) => a.orderIndex - b.orderIndex);
  const cssBlocks: string[] = [];
  const nodes: RenderedNode[] = [];
  // SVG defs collect <mask> / <filter> / <linearGradient> elements emitted by
  // tools (mask system, track matte, etc.) — they're concatenated into a
  // single <svg defs> block that precedes the rendered nodes.
  const svgDefs: string[] = [];

  for (const component of sorted) {
    const rawStyle = component.style as Record<string, string | number>;
    // Null objects never paint — skip them entirely. They exist only as
    // transform parents for other layers.
    if (String(rawStyle._nullObject ?? "0") === "1") {
      continue;
    }
    const animationName = `om-anim-${component.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const className = `om-c-${component.id}`;
    const { css: cssStyle, content, tag, src, poster, loop, muted, autoplay, controls } = splitStyle(rawStyle);

    // Motion blur: when enabled, apply a baseline blur filter to the element
    // rule so fast-moving segments streak. The shutter-angle weighting scales
    // the effective radius (180° = full intensity, 360° = double, 45° = quarter).
    const motionBlurEnabled = String(rawStyle._motionBlur ?? "0") === "1";
    const mbIntensity = Number(rawStyle._motionBlurIntensity ?? 4);
    const mbShutter = Number(rawStyle._motionBlurShutter ?? 180);
    const motionBlurRadius = motionBlurEnabled ? (mbIntensity * mbShutter) / 180 : 0;

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
      `animation-duration: ${Math.round(component.durationMs * speedFactor)}ms;`,
      `animation-timing-function: ${easingToCss(component.easing)};`,
      `animation-delay: ${Math.round(component.delayMs * speedFactor)}ms;`,
      `animation-iteration-count: ${iteration};`,
      `animation-direction: ${component.direction};`,
      `animation-fill-mode: ${component.fillMode};`,
      `animation-play-state: ${component.playState};`,
    ].filter(Boolean);
    // Inject motion blur as a base filter on the element rule. If the layer
    // already has a `filter` style (e.g. an authored blur), the motion-blur
    // filter is prepended so both effects compose.
    if (motionBlurEnabled && motionBlurRadius > 0) {
      const existingFilter = typeof cssStyle.filter === "string" ? cssStyle.filter : "";
      const mbFilter = `blur(${motionBlurRadius.toFixed(2)}px)`;
      const mergedFilter = existingFilter ? `${mbFilter} ${existingFilter}` : mbFilter;
      // Replace or insert the filter declaration.
      const filterIdx = ruleDecls.findIndex((d) => d.startsWith("filter:"));
      if (filterIdx >= 0) {
        ruleDecls[filterIdx] = `filter: ${mergedFilter};`;
      } else {
        ruleDecls.push(`filter: ${mergedFilter};`);
      }
    }

    // Posterize time: quantize the animation to N fps via CSS steps().
    // The number of steps is derived from the layer's duration and target fps.
    const posterizeFps = Number(rawStyle._posterizeFps ?? 0);
    if (posterizeFps > 0) {
      const steps = Math.max(1, Math.round((component.durationMs / 1000) * posterizeFps));
      const tfIdx = ruleDecls.findIndex((d) => d.startsWith("animation-timing-function:"));
      if (tfIdx >= 0) {
        ruleDecls[tfIdx] = `animation-timing-function: steps(${steps}, jump-none);`;
      } else {
        ruleDecls.push(`animation-timing-function: steps(${steps}, jump-none);`);
      }
    }

    // Mask system: emit CSS mask-image / -webkit-mask-image for each mask.
    // Multiple masks compose via mask-composite (add subtract intersect).
    if (typeof rawStyle._masks === "string") {
      try {
        const masks = JSON.parse(rawStyle._masks) as Array<{
          shape: string; mode: string; x: number; y: number;
          width: number; height: number; path?: string;
          feather: number; expansion: number; inverted: boolean; enabled: boolean;
        }>;
        const enabledMasks = masks.filter((m) => m.enabled !== false);
        if (enabledMasks.length > 0) {
          // Use a single SVG mask that combines all mask shapes via light/dark
          // compositing. Each mask shape is rendered as an SVG primitive inside
          // a <mask> element; the renderer emits the SVG mask def + mask-image.
          const maskId = `om-mask-${component.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
          const shapes = enabledMasks.map((m) => {
            const cx = m.x + m.width / 2 + m.expansion;
            const cy = m.y + m.height / 2 + m.expansion;
            const w = Math.max(1, m.width + m.expansion * 2);
            const h = Math.max(1, m.height + m.expansion * 2);
            // subtract/difference/darken produce holes (black); others produce fills (white).
            const fill = m.mode === "subtract" || m.mode === "difference" || m.mode === "darken" ? "black" : "white";
            const filter = m.feather > 0 ? ` filter="url(#${maskId}-blur)"` : "";
            if (m.shape === "ellipse") {
              return `<ellipse cx="${cx}" cy="${cy}" rx="${w / 2}" ry="${h / 2}" fill="${fill}"${filter}/>`;
            }
            if (m.shape === "path" && m.path) {
              return `<path d="${m.path}" fill="${fill}"${filter} transform="translate(${m.x} ${m.y})"/>`;
            }
            return `<rect x="${m.x - m.expansion}" y="${m.y - m.expansion}" width="${w}" height="${h}" fill="${fill}"${filter}/>`;
          }).join("");
          const blurDef = enabledMasks.some((m) => m.feather > 0)
            ? `<filter id="${maskId}-blur"><feGaussianBlur stdDeviation="${Math.max(...enabledMasks.map((m) => m.feather))}"/></filter>`
            : "";
          const invertFlag = enabledMasks.every((m) => m.inverted) ? ' mask-type="luminance"' : "";
          svgDefs.push(`<mask id="${maskId}"${invertFlag}>${blurDef}${shapes}</mask>`);
          const invertCss = enabledMasks.some((m) => m.inverted) ? "" : "";
          ruleDecls.push(`-webkit-mask-image: url(#${maskId});${invertCss}`);
          ruleDecls.push(`mask-image: url(#${maskId});`);
        }
      } catch { /* malformed mask JSON — skip */ }
    }

    // Track matte: reference another layer's rendered output as a CSS mask.
    // The matte layer's alpha or luminance controls this layer's visibility.
    if (typeof rawStyle._trackMatte === "string") {
      try {
        const tm = JSON.parse(rawStyle._trackMatte) as { matteId: string; mode: string };
        const matteMaskId = `om-matte-${tm.matteId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
        const mode = tm.mode ?? "alpha";
        const maskType = mode === "luma" || mode === "luma-inverted" ? "luminance" : "alpha";
        const inverted = mode === "alpha-inverted" || mode === "luma-inverted";
        ruleDecls.push(`-webkit-mask-image: url(#${matteMaskId});`);
        ruleDecls.push(`mask-image: url(#${matteMaskId});`);
        ruleDecls.push(`mask-type: ${maskType};`);
        if (inverted) ruleDecls.push(`mask-mode: ${maskType};`);
      } catch { /* malformed track matte JSON — skip */ }
    }

    // Gradient fill: emit linear-gradient() or radial-gradient() CSS directly.
    // Radial gradients can also be emitted as SVG defs for finer control,
    // but CSS radial-gradient handles the common cases cleanly.
    if (typeof rawStyle._gradientFill === "string") {
      try {
        const g = JSON.parse(rawStyle._gradientFill) as {
          type: "linear" | "radial"; angle: number;
          stops: Array<{ color: string; position: number }>;
          cx: number; cy: number; radius: number;
        };
        const stopsCss = g.stops
          .map((s) => `${s.color} ${(s.position ?? 0).toFixed(1)}%`)
          .join(", ");
        if (g.type === "radial") {
          ruleDecls.push(
            `background: radial-gradient(circle ${g.radius.toFixed(1)}% at ${g.cx.toFixed(1)}% ${g.cy.toFixed(1)}%, ${stopsCss});`,
          );
        } else {
          ruleDecls.push(`background: linear-gradient(${g.angle}deg, ${stopsCss});`);
        }
      } catch { /* malformed gradient JSON — skip */ }
    }

    // Gradient stroke: use border-image with a linear-gradient. This is the
    // cleanest CSS-only way to gradient-color a border without SVG.
    if (typeof rawStyle._gradientStroke === "string") {
      try {
        const g = JSON.parse(rawStyle._gradientStroke) as {
          type: "linear" | "radial"; angle: number; width: number;
          stops: Array<{ color: string; position: number }>;
        };
        const stopsCss = g.stops
          .map((s) => `${s.color} ${(s.position ?? 0).toFixed(1)}%`)
          .join(", ");
        const grad = g.type === "radial"
          ? `radial-gradient(circle, ${stopsCss})`
          : `linear-gradient(${g.angle}deg, ${stopsCss})`;
        ruleDecls.push(`border: ${g.width}px solid transparent;`);
        ruleDecls.push(`border-image: ${grad} 1;`);
        // Fallback for browsers without border-image support: Webkit line.
        ruleDecls.push(`-webkit-border-image: ${grad} 1;`);
      } catch { /* malformed gradient stroke JSON — skip */ }
    }

    // Mesh warp: emit an SVG filter with feTurbulence + feDisplacementMap.
    // The filter is referenced via `filter: url(#id)` on the layer rule.
    if (typeof rawStyle._meshWarp === "string") {
      try {
        const w = JSON.parse(rawStyle._meshWarp) as {
          turbulence: number; scale: number; octaves: number;
          animated: boolean; speed: number; seed: number;
        };
        const filterId = `om-warp-${component.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
        const dispScale = (w.turbulence * 100).toFixed(1);
        // animated turbulence uses <animate> inside feTurbulence to vary
        // the baseFrequency over time, producing a flowing distortion.
        const animTag = w.animated
          ? `<animate attributeName="baseFrequency" dur="${(1 / Math.max(0.001, w.speed)).toFixed(2)}s" values="0;${(w.turbulence * 0.1).toFixed(4)};0" repeatCount="indefinite"/>`
          : "";
        svgDefs.push(
          `<filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%">` +
          `<feTurbulence type="fractalNoise" baseFrequency="${(w.turbulence * 0.1).toFixed(4)}" numOctaves="${w.octaves}" seed="${w.seed}" result="noise">${animTag}</feTurbulence>` +
          `<feDisplacementMap in="SourceGraphic" in2="noise" scale="${dispScale}" xChannelSelector="R" yChannelSelector="G"/>` +
          `</filter>`,
        );
        const filterDecl = `filter: url(#${filterId});`;
        const filterIdx = ruleDecls.findIndex((d) => d.startsWith("filter:"));
        if (filterIdx >= 0) {
          // Compose with any existing filter (motion blur, etc.).
          ruleDecls[filterIdx] = ruleDecls[filterIdx].replace(/filter:\s*([^;]+);/, `filter: $1 ${filterDecl.replace(/filter:\s*/, "").replace(/;$/, "")};`);
        } else {
          ruleDecls.push(filterDecl);
        }
      } catch { /* malformed mesh warp JSON — skip */ }
    }

    cssBlocks.push(`.${className} { ${ruleDecls.join(" ")} }`);

    // Determine if this layer needs a JS runtime driver. Multiple drivers
    // can coexist on a single layer (e.g. expression + audio binding), but
    // for simplicity we pick the first matching one in priority order.
    let runtime: RuntimeLayerSpec | undefined;
    if (typeof rawStyle._particleConfig === "string") {
      try {
        const config = JSON.parse(rawStyle._particleConfig) as Record<string, unknown>;
        runtime = { kind: "particle", config };
      } catch { /* malformed */ }
    } else if (typeof rawStyle._audioBinding === "string") {
      try {
        const config = JSON.parse(rawStyle._audioBinding) as Record<string, unknown>;
        runtime = { kind: "audio", config };
      } catch { /* malformed */ }
    } else {
      // Expression v2: scan for any enabled _expr:<prop> token. The first
      // enabled expression drives the runtime layer; multiple expressions
      // on the same component are batched by the runtime driver.
      for (const [key, value] of Object.entries(rawStyle)) {
        const m = key.match(/^_exprEnabled:(.+)$/);
        if (m && Number(value) === 1) {
          const prop = m[1];
          const exprKey = `_expr:${prop}`;
          const exprVal = rawStyle[exprKey];
          if (typeof exprVal === "string") {
            runtime = { kind: "expression", config: { property: prop, expression: exprVal } };
            break;
          }
        }
      }
    }

    nodes.push({
      tag,
      className,
      content: content || component.name,
      name: component.name,
      componentId: component.id,
      src,
      poster,
      loop,
      muted,
      autoplay,
      controls,
      runtime,
    });
  }

  // SVG defs (mask/filter/gradient definitions emitted by effect tools)
  // are prepended as a hidden <svg> block so url(#id) references resolve.
  const svgDefsBlock = svgDefs.length > 0
    ? `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${svgDefs.join("")}</defs></svg>`
    : "";
  return { css: cssBlocks.join("\n\n"), nodes, svgDefs: svgDefsBlock };
}
