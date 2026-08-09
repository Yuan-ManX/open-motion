/** Motion Codec — encodes and decodes motion compositions in multiple formats. */

import type { MotionSpec, MotionComponent, Easing } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CodecFormat = "lottie" | "css" | "waapi" | "smil" | "gsap" | "react-spring";

export interface CodecResult {
  format: CodecFormat;
  /** The encoded output as a string. */
  output: string;
  /** MIME type for the format. */
  mimeType: string;
  /** File extension for download. */
  fileExtension: string;
  /** Summary of what was encoded. */
  summary: string;
}

export interface CodecOptions {
  /** Include comments in output. Default true. */
  comments: boolean;
  /** Minify output. Default false. */
  minify: boolean;
  /** Indent size for pretty printing. Default 2. */
  indent: number;
}

// ---------------------------------------------------------------------------
// Easing conversion helpers
// ---------------------------------------------------------------------------

function easingToCss(easing: Easing): string {
  if (easing.type === "preset") {
    const map: Record<string, string> = {
      "ease-in": "ease-in",
      "ease-out": "ease-out",
      "ease-in-out": "ease-in-out",
      "linear": "linear",
      "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      "soft": "cubic-bezier(0.25, 0.1, 0.25, 1)",
      "snappy": "cubic-bezier(0.4, 0, 0.6, 1)",
      "sharp": "cubic-bezier(0.7, 0, 0.3, 1)",
      "bounce": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      "elastic": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
      "back": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    };
    return map[easing.name] ?? "ease";
  }
  if (easing.type === "spring") {
    // Approximate spring with a cubic-bezier using stiffness/damping ratio.
    const ratio = easing.damping / Math.max(easing.stiffness, 1);
    return `cubic-bezier(0.34, ${1 + ratio}, 0.64, 1)`;
  }
  if (easing.type === "bezier") {
    return `cubic-bezier(${easing.p1[0]}, ${easing.p1[1]}, ${easing.p2[0]}, ${easing.p2[1]})`;
  }
  return "ease";
}

function easingToLottie(easing: Easing): { c: { k: [number, number, number, number] }; i: { x: number[]; y: number[] }; o: { x: number[]; y: number[] } } {
  const linear: { c: { k: [number, number, number, number] }; i: { x: number[]; y: number[] }; o: { x: number[]; y: number[] } } = { c: { k: [0, 0, 0, 1] }, i: { x: [0.5], y: [0.5] }, o: { x: [0.5], y: [0.5] } };
  if (easing.type === "bezier") {
    return {
      c: { k: [0, 0, 0, 1] },
      i: { x: [easing.p1[0]], y: [easing.p1[1]] },
      o: { x: [easing.p2[0]], y: [easing.p2[1]] },
    };
  }
  return linear;
}

function getBezierPoints(easing: Easing): [number, number, number, number] {
  if (easing.type === "bezier") {
    return [easing.p1[0], easing.p1[1], easing.p2[0], easing.p2[1]];
  }
  if (easing.type === "preset") {
    const map: Record<string, [number, number, number, number]> = {
      "smooth": [0.4, 0, 0.2, 1],
      "soft": [0.25, 0.1, 0.25, 1],
      "snappy": [0.4, 0, 0.6, 1],
      "sharp": [0.7, 0, 0.3, 1],
      "bounce": [0.68, -0.55, 0.265, 1.55],
      "elastic": [0.68, -0.55, 0.265, 1.55],
      "back": [0.175, 0.885, 0.32, 1.275],
    };
    return map[easing.name] ?? [0.5, 0, 0.5, 1];
  }
  return [0.5, 0, 0.5, 1];
}

// ---------------------------------------------------------------------------
// Keyframe extraction
// ---------------------------------------------------------------------------

interface ExtractedKeyframe {
  time: number; // 0..1
  props: Record<string, string | number>;
}

function extractKeyframes(comp: MotionComponent): ExtractedKeyframe[] {
  const kfs = comp.keyframes ?? [];
  return kfs.map((kf) => {
    const props: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(kf.properties ?? {})) {
      if (typeof value === "number" || typeof value === "string") {
        props[key] = value;
      }
    }
    const time = typeof kf.offset === "number" ? kf.offset : 0;
    return { time, props };
  });
}

function formatValue(key: string, value: string | number): string {
  const transformKeys = ["translateX", "translateY", "translateZ", "scale", "scaleX", "scaleY", "rotate", "rotateX", "rotateY", "rotateZ", "skewX", "skewY"];
  if (transformKeys.includes(key)) {
    if (key.startsWith("translate")) return `${value}px`;
    if (key.startsWith("scale")) return `${value}`;
    if (key.startsWith("rotate") || key.startsWith("skew")) return `${value}deg`;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Encoders
// ---------------------------------------------------------------------------

/** Encode a MotionSpec to Lottie JSON format. */
export function encodeLottie(spec: MotionSpec, options: Partial<CodecOptions> = {}): CodecResult {
  const opts: CodecOptions = { comments: true, minify: false, indent: 2, ...options };
  const layers = spec.components.map((comp, idx) => {
    const kfs = extractKeyframes(comp);
    const transforms: Record<string, { k: Array<{ t: number; s: number[] }> }> = {};

    // Group keyframe properties
    const propNames = new Set<string>();
    kfs.forEach((kf) => Object.keys(kf.props).forEach((p) => propNames.add(p)));

    for (const prop of propNames) {
      const values = kfs.map((kf) => ({
        t: Math.round(kf.time * (comp.durationMs / 1000) * 1000),
        s: [typeof kf.props[prop] === "number" ? kf.props[prop] as number : 0],
      }));
      transforms[prop] = { k: values };
    }

    return {
      ddd: 0,
      ind: idx + 1,
      ty: 4, // shape layer
      nm: comp.name,
      sr: 1,
      ks: {
        o: { a: kfs.length > 1 ? 1 : 0, k: kfs.length > 1 ? kfs.map((kf) => ({ t: Math.round(kf.time * comp.durationMs), s: [kf.props.opacity ?? 100] })) : (kfs[0]?.props.opacity ?? 100) },
        r: { a: kfs.length > 1 ? 1 : 0, k: kfs.length > 1 ? kfs.map((kf) => ({ t: Math.round(kf.time * comp.durationMs), s: [kf.props.rotate ?? 0] })) : (kfs[0]?.props.rotate ?? 0) },
        p: { a: 0, k: [0, 0, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: kfs.length > 1 ? 1 : 0, k: kfs.length > 1 ? kfs.map((kf) => ({ t: Math.round(kf.time * comp.durationMs), s: [(Number(kf.props.scaleX ?? 1) * 100), (Number(kf.props.scaleY ?? 1) * 100), 100] })) : [100, 100, 100] },
      },
      ip: comp.delayMs,
      op: comp.delayMs + comp.durationMs,
      st: 0,
      bm: 0,
    };
  });

  const totalFrames = Math.ceil(spec.components.reduce((max, c) => Math.max(max, c.delayMs + c.durationMs), 2000) / (1000 / 60));

  const lottie = {
    v: "5.7.4",
    fr: 60,
    ip: 0,
    op: totalFrames,
    w: 800,
    h: 600,
    nm: spec.project?.name ?? "OpenMotion Export",
    ddd: 0,
    assets: [],
    layers,
  };

  const output = opts.minify
    ? JSON.stringify(lottie)
    : JSON.stringify(lottie, null, opts.indent);

  return {
    format: "lottie",
    output,
    mimeType: "application/json",
    fileExtension: "json",
    summary: `Lottie JSON: ${layers.length} layers, ${totalFrames} frames at 60fps`,
  };
}

/** Encode a MotionSpec to CSS @keyframes format. */
export function encodeCss(spec: MotionSpec, options: Partial<CodecOptions> = {}): CodecResult {
  const opts: CodecOptions = { comments: true, minify: false, indent: 2, ...options };
  const lines: string[] = [];
  const nl = opts.minify ? "" : "\n";
  const sp = opts.minify ? "" : " ";

  for (const comp of spec.components) {
    const kfs = extractKeyframes(comp);
    if (kfs.length === 0) continue;

    const animName = comp.name.replace(/\s+/g, "-").toLowerCase();
    if (opts.comments && !opts.minify) {
      lines.push(`/* ${comp.name} — ${comp.durationMs}ms */`);
    }
    lines.push(`@keyframes ${animName} {${nl}`);

    for (const kf of kfs) {
      const pct = Math.round(kf.time * 100);
      const props = Object.entries(kf.props)
        .map(([k, v]) => `${k}:${sp}${formatValue(k, v)}`)
        .join(`;${sp}`);
      lines.push(`${opts.minify ? "" : "  "}${pct}% {${sp}${props};${nl.length > 0 ? "" : ""}}${nl}`);
    }
    lines.push(`}${nl}${nl}`);

    // Animation declaration
    const easing = easingToCss(comp.easing);
    const iter = comp.iterationCount === "infinite" ? "infinite" : String(comp.iterationCount ?? 1);
    const dir = comp.direction ?? "normal";
    lines.push(`.${animName} {${nl}`);
    lines.push(`${opts.minify ? "" : "  "}animation:${sp}${animName}${sp}${comp.durationMs}ms${sp}${easing}${sp}${comp.delayMs}ms${sp}${iter}${sp}${dir};${nl}`);
    lines.push(`}${nl}${nl}`);
  }

  return {
    format: "css",
    output: lines.join(opts.minify ? "" : "\n").trim(),
    mimeType: "text/css",
    fileExtension: "css",
    summary: `CSS: ${spec.components.length} animations with @keyframes`,
  };
}

/** Encode a MotionSpec to Web Animations API format. */
export function encodeWAAPI(spec: MotionSpec, options: Partial<CodecOptions> = {}): CodecResult {
  const opts: CodecOptions = { comments: true, minify: false, indent: 2, ...options };
  const lines: string[] = [];

  if (opts.comments && !opts.minify) {
    lines.push("// Web Animations API — generated by OpenMotion");
    lines.push("");
  }

  for (const comp of spec.components) {
    const kfs = extractKeyframes(comp);
    if (kfs.length === 0) continue;

    const keyframeObjects = kfs.map((kf) => {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(kf.props)) {
        obj[k] = formatValue(k, v);
      }
      obj.offset = kf.time;
      return obj;
    });

    const [p1x, p1y, p2x, p2y] = getBezierPoints(comp.easing);
    const easing = `cubic-bezier(${p1x}, ${p1y}, ${p2x}, ${p2y})`;
    const iter = comp.iterationCount === "infinite" ? Infinity : (comp.iterationCount ?? 1);
    const dir = comp.direction ?? "normal";

    const varName = comp.name.replace(/\s+/g, "").replace(/^./, (c) => c.toLowerCase());
    lines.push(`const ${varName} = element.animate(`);
    lines.push(`  ${JSON.stringify(keyframeObjects, null, opts.indent)},`);
    lines.push(`  {`);
    lines.push(`    duration: ${comp.durationMs},`);
    lines.push(`    delay: ${comp.delayMs},`);
    lines.push(`    easing: "${easing}",`);
    lines.push(`    iterations: ${iter === Infinity ? "Infinity" : iter},`);
    lines.push(`    direction: "${dir}",`);
    lines.push(`    fill: "forwards",`);
    lines.push(`  }`);
    lines.push(`);`);
    lines.push("");
  }

  return {
    format: "waapi",
    output: lines.join("\n").trim(),
    mimeType: "text/javascript",
    fileExtension: "js",
    summary: `WAAPI: ${spec.components.length} animations as element.animate() calls`,
  };
}

/** Encode a MotionSpec to GSAP timeline format. */
export function encodeGsap(spec: MotionSpec, options: Partial<CodecOptions> = {}): CodecResult {
  const opts: CodecOptions = { comments: true, minify: false, indent: 2, ...options };
  const lines: string[] = [];

  if (opts.comments && !opts.minify) {
    lines.push("// GSAP Timeline — generated by OpenMotion");
    lines.push("");
  }

  lines.push(`const tl = gsap.timeline({`);
  lines.push(`  defaults: { ease: "power2.out" },`);
  lines.push(`});`);
  lines.push("");

  for (const comp of spec.components) {
    const kfs = extractKeyframes(comp);
    if (kfs.length === 0) continue;

    const varName = comp.name.replace(/\s+/g, "").replace(/^./, (c) => c.toLowerCase());
    const firstKf = kfs[0];
    const lastKf = kfs[kfs.length - 1];

    const fromProps: Record<string, unknown> = {};
    const toProps: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(firstKf.props)) {
      fromProps[k] = formatValue(k, v);
    }
    for (const [k, v] of Object.entries(lastKf.props)) {
      toProps[k] = formatValue(k, v);
    }

    const easing = easingToCss(comp.easing);
    lines.push(`tl.fromTo(".${varName}",`);
    lines.push(`  ${JSON.stringify(fromProps, null, opts.indent)},`);
    lines.push(`  {`);
    for (const [k, v] of Object.entries(toProps)) {
      lines.push(`    ${k}: "${v}",`);
    }
    lines.push(`    duration: ${comp.durationMs / 1000},`);
    lines.push(`    ease: "${easing}",`);
    lines.push(`  },`);
    lines.push(`  ${comp.delayMs / 1000}`);
    lines.push(`);`);
    lines.push("");
  }

  return {
    format: "gsap",
    output: lines.join("\n").trim(),
    mimeType: "text/javascript",
    fileExtension: "js",
    summary: `GSAP: ${spec.components.length} tweens in a timeline`,
  };
}

/** Encode a MotionSpec to React Spring format. */
export function encodeReactSpring(spec: MotionSpec, options: Partial<CodecOptions> = {}): CodecResult {
  const opts: CodecOptions = { comments: true, minify: false, indent: 2, ...options };
  const lines: string[] = [];

  if (opts.comments && !opts.minify) {
    lines.push("// React Spring — generated by OpenMotion");
    lines.push("");
  }

  lines.push(`import { useSpring, animated } from "@react-spring/web";`);
  lines.push("");

  for (const comp of spec.components) {
    const kfs = extractKeyframes(comp);
    if (kfs.length === 0) continue;

    const varName = comp.name.replace(/\s+/g, "").replace(/^./, (c) => c.toLowerCase());
    const lastKf = kfs[kfs.length - 1];

    const springProps: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(lastKf.props)) {
      springProps[k] = v;
    }

    // Map OpenMotion spring params (stiffness/damping/mass) to react-spring
    // tension/friction equivalents. The conversion is approximate but
    // preserves the feel of the original spring.
    const tension = comp.easing?.type === "spring" ? (comp.easing.stiffness ?? 170) : 170;
    const friction = comp.easing?.type === "spring" ? (comp.easing.damping ?? 26) : 26;

    lines.push(`const [styles_${varName}, api_${varName}] = useSpring(() => ({`);
    for (const [k, v] of Object.entries(springProps)) {
      lines.push(`  ${k}: ${typeof v === "number" ? v : `"${v}"`},`);
    }
    lines.push(`  config: {`);
    lines.push(`    tension: ${tension},`);
    lines.push(`    friction: ${friction},`);
    lines.push(`    duration: ${comp.durationMs},`);
    lines.push(`  },`);
    lines.push(`  delay: ${comp.delayMs},`);
    lines.push(`  loop: ${comp.iterationCount === "infinite" ? "true" : "false"},`);
    lines.push(`}));`);
    lines.push("");
  }

  return {
    format: "react-spring",
    output: lines.join("\n").trim(),
    mimeType: "text/javascript",
    fileExtension: "tsx",
    summary: `React Spring: ${spec.components.length} useSpring hooks`,
  };
}

/** Encode a MotionSpec to SMIL (SVG animation) format. */
export function encodeSmil(spec: MotionSpec, options: Partial<CodecOptions> = {}): CodecResult {
  const opts: CodecOptions = { comments: true, minify: false, indent: 2, ...options };
  const lines: string[] = [];

  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">`);

  for (const comp of spec.components) {
    const kfs = extractKeyframes(comp);
    if (kfs.length === 0) continue;

    lines.push(`  <g id="${comp.name.replace(/\s+/g, "-").toLowerCase()}">`);

    // Animate transform
    const transformValues = kfs.map((kf) => {
      const tx = kf.props.translateX ?? 0;
      const ty = kf.props.translateY ?? 0;
      const scale = kf.props.scale ?? 1;
      const rotate = kf.props.rotate ?? 0;
      return `translate(${tx} ${ty}) scale(${scale}) rotate(${rotate})`;
    });
    const transformTimes = kfs.map((kf) => (kf.time * comp.durationMs / 1000).toFixed(2)).join(";");

    lines.push(`    <animateTransform`);
    lines.push(`      attributeName="transform"`);
    lines.push(`      type="translate"`);
    lines.push(`      values="${transformValues.join(";")}"`);
    lines.push(`      keyTimes="${kfs.map((kf) => kf.time.toFixed(2)).join(";")}"`);
    lines.push(`      dur="${comp.durationMs}ms"`);
    lines.push(`      begin="${comp.delayMs}ms"`);
    lines.push(`      fill="freeze"`);
    lines.push(`    />`);

    // Animate opacity
    const opacityValues = kfs.map((kf) => (kf.props.opacity ?? 1));
    if (opacityValues.some((v) => v !== 1)) {
      lines.push(`    <animate`);
      lines.push(`      attributeName="opacity"`);
      lines.push(`      values="${opacityValues.join(";")}"`);
      lines.push(`      dur="${comp.durationMs}ms"`);
      lines.push(`      begin="${comp.delayMs}ms"`);
      lines.push(`      fill="freeze"`);
      lines.push(`    />`);
    }

    lines.push(`  </g>`);
  }

  lines.push(`</svg>`);

  return {
    format: "smil",
    output: lines.join("\n"),
    mimeType: "image/svg+xml",
    fileExtension: "svg",
    summary: `SMIL: ${spec.components.length} animated groups in SVG`,
  };
}

// ---------------------------------------------------------------------------
// Master encode function
// ---------------------------------------------------------------------------

export function encodeMotion(spec: MotionSpec, format: CodecFormat, options: Partial<CodecOptions> = {}): CodecResult {
  switch (format) {
    case "lottie": return encodeLottie(spec, options);
    case "css": return encodeCss(spec, options);
    case "waapi": return encodeWAAPI(spec, options);
    case "smil": return encodeSmil(spec, options);
    case "gsap": return encodeGsap(spec, options);
    case "react-spring": return encodeReactSpring(spec, options);
    default:
      return {
        format,
        output: "",
        mimeType: "text/plain",
        fileExtension: "txt",
        summary: `Unknown format: ${format}`,
      };
  }
}

export function listCodecFormats(): Array<{ id: CodecFormat; name: string; description: string; mimeType: string; fileExtension: string }> {
  return [
    { id: "lottie", name: "Lottie JSON", description: "Bodymovin/Lottie format for web and mobile playback", mimeType: "application/json", fileExtension: "json" },
    { id: "css", name: "CSS Animation", description: "Standard CSS @keyframes with animation properties", mimeType: "text/css", fileExtension: "css" },
    { id: "waapi", name: "Web Animations API", description: "JavaScript element.animate() constructor calls", mimeType: "text/javascript", fileExtension: "js" },
    { id: "smil", name: "SMIL", description: "SVG declarative animation format", mimeType: "image/svg+xml", fileExtension: "svg" },
    { id: "gsap", name: "GSAP", description: "GreenSock timeline configuration", mimeType: "text/javascript", fileExtension: "js" },
    { id: "react-spring", name: "React Spring", description: "React component props for spring-based animation", mimeType: "text/javascript", fileExtension: "tsx" },
  ];
}
