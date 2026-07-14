/**
 * Shader effect registry — WebGL GLSL fragment shaders with CSS fallbacks.
 *
 * Each effect defines:
 * - GLSL fragment shader source (for WebGL canvas rendering)
 * - CSS fallback (applied to component style for the preview/editor)
 * - Default parameters
 *
 * The agent tool `set_shader_effect` applies the CSS fallback to a component
 * and stores the shader ID for WebGL rendering in the preview.
 */

export interface ShaderEffect {
  id: string;
  name: string;
  category: "distortion" | "color" | "noise" | "light" | "pattern";
  description: string;
  glslSource: string;
  cssStyle: Record<string, string>;
  parameters: Record<string, { default: number; min: number; max: number }>;
}

export const SHADER_EFFECTS: ShaderEffect[] = [
  {
    id: "shader-chromatic",
    name: "Chromatic Aberration",
    category: "color",
    description: "RGB channel split with offset red/blue channels for a digital glitch aesthetic.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  float offset = u_intensity * 0.01;
  float r = texture2D(u_tex, v_uv + vec2(offset, 0.0)).r;
  float g = texture2D(u_tex, v_uv).g;
  float b = texture2D(u_tex, v_uv - vec2(offset, 0.0)).b;
  gl_FragColor = vec4(r, g, b, 1.0);
}`.trim(),
    cssStyle: {
      filter: "drop-shadow(2px 0 0 rgba(255,0,0,0.5)) drop-shadow(-2px 0 0 rgba(0,0,255,0.5))",
    },
    parameters: { intensity: { default: 1, min: 0, max: 5 } },
  },
  {
    id: "shader-glitch",
    name: "Glitch Displacement",
    category: "distortion",
    description: "Random horizontal displacement blocks for a cyberpunk digital fault effect.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float rand(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float block = floor(v_uv.y * 20.0);
  float displ = (rand(block + floor(u_time * 5.0)) - 0.5) * u_intensity * 0.05;
  vec2 uv = v_uv + vec2(displ, 0.0);
  gl_FragColor = texture2D(u_tex, uv);
}`.trim(),
    cssStyle: {
      filter: "hue-rotate(15deg) contrast(1.2)",
      clipPath: "polygon(0 0, 100% 0, 100% 45%, 0 48%, 0 52%, 100% 55%, 100% 100%, 0 100%)",
    },
    parameters: { intensity: { default: 1, min: 0, max: 3 } },
  },
  {
    id: "shader-plasma",
    name: "Plasma Field",
    category: "pattern",
    description: "Animated plasma field with sine wave interference patterns.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv * 4.0;
  float v = sin(uv.x + u_time);
  v += sin((uv.y + u_time) * 0.5);
  v += sin((uv.x + uv.y + u_time) * 0.5);
  v += sin(sqrt(uv.x * uv.x + uv.y * uv.y + 1.0) + u_time);
  v = v * 0.5;
  vec3 col = vec3(sin(v * 3.14159), sin(v * 3.14159 + 2.0), sin(v * 3.14159 + 4.0));
  gl_FragColor = vec4(col * 0.5 + 0.5, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(135deg, rgba(255,0,128,0.3), rgba(0,255,255,0.3), rgba(128,0,255,0.3))",
      backgroundSize: "200% 200%",
      animation: "plasma-shift 3s ease-in-out infinite alternate",
    },
    parameters: {},
  },
  {
    id: "shader-noise",
    name: "Noise Grain",
    category: "noise",
    description: "Film grain noise overlay with adjustable intensity.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec4 col = texture2D(u_tex, v_uv);
  float n = rand(v_uv + u_time * 0.001) * u_intensity;
  gl_FragColor = vec4(col.rgb + n, col.a);
}`.trim(),
    cssStyle: {
      filter: "contrast(1.05) brightness(1.02)",
    },
    parameters: { intensity: { default: 0.1, min: 0, max: 0.5 } },
  },
  {
    id: "shader-ripple",
    name: "Ripple Wave",
    category: "distortion",
    description: "Concentric ripple distortion from center point.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 center = vec2(0.5);
  float dist = distance(v_uv, center);
  float ripple = sin(dist * 30.0 - u_time * 3.0) * u_intensity * 0.01;
  vec2 uv = v_uv + normalize(v_uv - center) * ripple;
  gl_FragColor = texture2D(u_tex, uv);
}`.trim(),
    cssStyle: {
      filter: "url(#ripple)",
    },
    parameters: { intensity: { default: 1, min: 0, max: 5 } },
  },
  {
    id: "shader-vignette",
    name: "Vignette",
    category: "light",
    description: "Darkened edges with smooth falloff for cinematic focus.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec4 col = texture2D(u_tex, v_uv);
  float dist = distance(v_uv, vec2(0.5));
  float vignette = smoothstep(0.8, 0.3, dist * u_intensity);
  gl_FragColor = vec4(col.rgb * vignette, col.a);
}`.trim(),
    cssStyle: {
      boxShadow: "inset 0 0 60px 20px rgba(0,0,0,0.6)",
    },
    parameters: { intensity: { default: 1, min: 0, max: 3 } },
  },
  {
    id: "shader-neon-glow",
    name: "Neon Glow",
    category: "light",
    description: "Pulsing neon outline glow with adjustable color and intensity.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_intensity;
uniform vec3 u_color;
varying vec2 v_uv;
void main() {
  vec4 col = texture2D(u_tex, v_uv);
  float pulse = sin(u_time * 3.0) * 0.5 + 0.5;
  vec3 glow = u_color * pulse * u_intensity;
  gl_FragColor = vec4(col.rgb + glow * 0.3, col.a);
}`.trim(),
    cssStyle: {
      boxShadow: "0 0 10px rgba(255,255,255,0.8), 0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(255,255,255,0.3)",
    },
    parameters: { intensity: { default: 1, min: 0, max: 3 } },
  },
  {
    id: "shader-pixelate",
    name: "Pixelate",
    category: "distortion",
    description: "Low-resolution pixelation effect for a retro aesthetic.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_intensity;
uniform vec2 u_resolution;
varying vec2 v_uv;
void main() {
  float pixels = max(2.0, 64.0 / u_intensity);
  vec2 size = vec2(pixels) / u_resolution;
  vec2 uv = floor(v_uv / size) * size;
  gl_FragColor = texture2D(u_tex, uv);
}`.trim(),
    cssStyle: {
      filter: "blur(0.5px) contrast(1.1)",
      imageRendering: "pixelated",
    },
    parameters: { intensity: { default: 1, min: 0.5, max: 8 } },
  },
  {
    id: "shader-gradient-shift",
    name: "Gradient Shift",
    category: "color",
    description: "Animated multi-color gradient that shifts hue over time.",
    glslSource: `
precision mediump float;
uniform float u_time;
varying vec2 v_uv;
void main() {
  vec3 a = vec3(1.0, 0.0, 0.4);
  vec3 b = vec3(0.0, 0.8, 1.0);
  vec3 c = vec3(0.6, 0.0, 1.0);
  float t = sin(u_time * 0.5) * 0.5 + 0.5;
  vec3 col = mix(mix(a, b, v_uv.x), c, v_uv.y);
  col = mix(col, col.zxy, t * 0.3);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(45deg, #ff0066, #00ccff, #9900ff)",
      backgroundSize: "300% 300%",
      animation: "gradient-shift 4s ease infinite",
    },
    parameters: {},
  },
  {
    id: "shader-invert-pulse",
    name: "Invert Pulse",
    category: "color",
    description: "Pulsing color inversion for a strobe-like effect.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec4 col = texture2D(u_tex, v_uv);
  float pulse = step(0.5, fract(u_time * 0.5)) * u_intensity;
  gl_FragColor = mix(col, vec4(1.0 - col.rgb, col.a), pulse);
}`.trim(),
    cssStyle: {
      filter: "invert(0.1) hue-rotate(180deg)",
    },
    parameters: { intensity: { default: 0.3, min: 0, max: 1 } },
  },
  {
    id: "shader-aurora",
    name: "Aurora Borealis",
    category: "pattern",
    description: "Flowing northern lights with waving color bands of green, cyan, and purple.",
    glslSource: `
precision mediump float;
uniform float u_time;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv;
  float wave = sin(uv.x * 3.0 + u_time * 0.8) * 0.15;
  wave += sin(uv.x * 7.0 - u_time * 0.5) * 0.08;
  float band = smoothstep(0.04, 0.0, abs(uv.y - 0.5 - wave));
  vec3 green = vec3(0.1, 0.9, 0.4);
  vec3 col = green * band;
  gl_FragColor = vec4(col * 0.8, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(180deg, transparent 30%, rgba(26,230,102,0.3) 50%, transparent 70%)",
      filter: "blur(2px) saturate(1.3)",
    },
    parameters: {},
  },
  {
    id: "shader-vortex",
    name: "Vortex Spiral",
    category: "pattern",
    description: "Swirling spiral pattern with rotating arms emanating from center.",
    glslSource: `
precision mediump float;
uniform float u_time;
varying vec2 v_uv;
void main() {
  vec2 p = v_uv - 0.5;
  float r = length(p);
  float a = atan(p.y, p.x);
  float spiral = sin(a * 5.0 + r * 20.0 - u_time * 2.0);
  vec3 col = vec3(0.5 + 0.5 * sin(spiral + u_time), 0.3 + 0.4 * sin(spiral + u_time + 2.0), 0.8);
  gl_FragColor = vec4(col * smoothstep(0.5, 0.1, r), 1.0);
}`.trim(),
    cssStyle: {
      background: "conic-gradient(from 0deg, #ff0066, #00ccff, #9900ff, #ff0066)",
      animation: "spin 4s linear infinite",
    },
    parameters: {},
  },
];

const SHADER_MAP = new Map(SHADER_EFFECTS.map((s) => [s.id, s]));

/** Get a shader effect by ID. */
export function getShaderEffect(id: string): ShaderEffect | undefined {
  return SHADER_MAP.get(id);
}

/** List all shader effects, optionally filtered by category. */
export function listShaderEffects(category?: string): ShaderEffect[] {
  if (!category) return SHADER_EFFECTS;
  return SHADER_EFFECTS.filter((s) => s.category === category);
}

/** Get the CSS style to apply for a shader effect. */
export function getShaderCss(id: string): Record<string, string> | null {
  const effect = SHADER_MAP.get(id);
  return effect ? effect.cssStyle : null;
}
