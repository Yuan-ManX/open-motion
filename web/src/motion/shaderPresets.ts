/**
 * Shader preset definitions for frontend WebGL rendering.
 * Each preset contains GLSL fragment source and tunable uniform parameters.
 * The backend applies CSS fallbacks; this file powers the live WebGL preview.
 */

export interface ShaderParameter {
  default: number;
  min: number;
  max: number;
}

export interface ShaderPreset {
  id: string;
  name: string;
  category: "distortion" | "color" | "noise" | "light" | "pattern";
  description: string;
  glslSource: string;
  parameters: Record<string, ShaderParameter>;
}

const VERTEX_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  v_uv.y = 1.0 - v_uv.y;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`.trim();

export const SHADER_VERTEX_SOURCE = VERTEX_SOURCE;

export const SHADER_PRESETS: ShaderPreset[] = [
  {
    id: "shader-chromatic",
    name: "Chromatic Aberration",
    category: "color",
    description: "RGB channel split with offset red/blue channels for a digital glitch aesthetic.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  float offset = u_intensity * 0.01;
  float r = 0.5 + 0.5 * sin(v_uv.x * 10.0 + u_time + offset * 50.0);
  float g = 0.5 + 0.5 * sin(v_uv.y * 8.0 + u_time * 0.7);
  float b = 0.5 + 0.5 * sin((v_uv.x + v_uv.y) * 6.0 + u_time * 1.3 - offset * 50.0);
  gl_FragColor = vec4(r, g, b, 1.0);
}`.trim(),
    parameters: { intensity: { default: 1, min: 0, max: 5 } },
  },
  {
    id: "shader-glitch",
    name: "Glitch Displacement",
    category: "distortion",
    description: "Random horizontal displacement blocks for a cyberpunk digital fault effect.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float rand(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  float block = floor(v_uv.y * 20.0);
  float displ = (rand(block + floor(u_time * 5.0)) - 0.5) * u_intensity * 0.1;
  vec2 uv = v_uv + vec2(displ, 0.0);
  float r = 0.5 + 0.5 * sin(uv.x * 8.0 + u_time);
  float g = 0.4 + 0.4 * sin(uv.y * 6.0 + u_time * 1.2);
  float b = 0.6 + 0.3 * sin(uv.x * 4.0 + u_time * 0.8);
  gl_FragColor = vec4(r, g, b, 1.0);
}`.trim(),
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
    parameters: {},
  },
  {
    id: "shader-noise",
    name: "Noise Grain",
    category: "noise",
    description: "Film grain noise overlay with adjustable intensity.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float n = rand(v_uv + u_time * 0.001) * u_intensity;
  float base = 0.5 + 0.3 * sin(v_uv.x * 3.0 + u_time * 0.5);
  vec3 col = vec3(base + n);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    parameters: { intensity: { default: 0.15, min: 0, max: 0.5 } },
  },
  {
    id: "shader-ripple",
    name: "Ripple Wave",
    category: "distortion",
    description: "Concentric ripple distortion from center point.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 center = vec2(0.5);
  float dist = distance(v_uv, center);
  float ripple = sin(dist * 30.0 - u_time * 3.0) * u_intensity * 0.5;
  float val = 0.5 + ripple * 0.3;
  vec3 col = vec3(val, val * 0.8, val * 1.1);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    parameters: { intensity: { default: 1, min: 0, max: 5 } },
  },
  {
    id: "shader-vignette",
    name: "Vignette",
    category: "light",
    description: "Darkened edges with smooth falloff for cinematic focus.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  float dist = distance(v_uv, vec2(0.5));
  float vignette = smoothstep(0.8, 0.3, dist * u_intensity);
  float base = 0.6 + 0.2 * sin(u_time + v_uv.x * 5.0);
  vec3 col = vec3(base) * vignette;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    parameters: { intensity: { default: 1, min: 0, max: 3 } },
  },
  {
    id: "shader-neon-glow",
    name: "Neon Glow",
    category: "light",
    description: "Pulsing neon outline glow with adjustable intensity.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  float pulse = sin(u_time * 3.0) * 0.5 + 0.5;
  float dist = distance(v_uv, vec2(0.5));
  float ring = smoothstep(0.3, 0.28, dist) - smoothstep(0.28, 0.26, dist);
  vec3 glow = vec3(0.0, 1.0, 0.8) * pulse * u_intensity;
  vec3 col = glow * ring * 3.0 + vec3(0.05);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    parameters: { intensity: { default: 1, min: 0, max: 3 } },
  },
  {
    id: "shader-pixelate",
    name: "Pixelate",
    category: "distortion",
    description: "Low-resolution pixelation effect for a retro aesthetic.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  float pixels = max(2.0, 64.0 / u_intensity);
  vec2 size = vec2(1.0) / pixels;
  vec2 uv = floor(v_uv / size) * size;
  float r = 0.5 + 0.5 * sin(uv.x * 5.0 + u_time);
  float g = 0.5 + 0.5 * sin(uv.y * 7.0 + u_time * 0.8);
  float b = 0.5 + 0.5 * sin(uv.x * 3.0 + uv.y * 4.0 + u_time * 1.2);
  gl_FragColor = vec4(r, g, b, 1.0);
}`.trim(),
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
    parameters: {},
  },
  {
    id: "shader-invert-pulse",
    name: "Invert Pulse",
    category: "color",
    description: "Pulsing color inversion for a strobe-like effect.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  float pulse = step(0.5, fract(u_time * 0.5)) * u_intensity;
  float base = 0.5 + 0.3 * sin(v_uv.x * 5.0 + v_uv.y * 3.0);
  vec3 col = vec3(base);
  col = mix(col, 1.0 - col, pulse);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    parameters: { intensity: { default: 0.3, min: 0, max: 1 } },
  },
  {
    id: "shader-aurora",
    name: "Aurora Borealis",
    category: "pattern",
    description: "Flowing northern lights with waving color bands.",
    glslSource: `
precision mediump float;
uniform float u_time;
varying vec2 v_uv;
float noise(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = v_uv;
  float wave = sin(uv.x * 3.0 + u_time * 0.8) * 0.15;
  wave += sin(uv.x * 7.0 - u_time * 0.5) * 0.08;
  float band = smoothstep(0.04, 0.0, abs(uv.y - 0.5 - wave));
  float band2 = smoothstep(0.06, 0.0, abs(uv.y - 0.6 - wave * 1.3));
  float band3 = smoothstep(0.05, 0.0, abs(uv.y - 0.4 - wave * 0.7));
  vec3 green = vec3(0.1, 0.9, 0.4);
  vec3 cyan = vec3(0.2, 0.7, 1.0);
  vec3 purple = vec3(0.6, 0.2, 1.0);
  vec3 col = green * band + cyan * band2 + purple * band3;
  col *= 0.8;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    parameters: {},
  },
  {
    id: "shader-vortex",
    name: "Vortex Spiral",
    category: "pattern",
    description: "Swirling spiral pattern with rotating arms.",
    glslSource: `
precision mediump float;
uniform float u_time;
varying vec2 v_uv;
void main() {
  vec2 p = v_uv - 0.5;
  float r = length(p);
  float a = atan(p.y, p.x);
  float spiral = sin(a * 5.0 + r * 20.0 - u_time * 2.0);
  spiral += sin(a * 3.0 - r * 15.0 + u_time * 1.5);
  spiral = spiral * 0.5;
  vec3 col = vec3(0.5 + 0.5 * sin(spiral + u_time), 0.3 + 0.4 * sin(spiral + u_time + 2.0), 0.8 + 0.2 * sin(spiral + u_time + 4.0));
  col *= smoothstep(0.5, 0.1, r);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    parameters: {},
  },
];

const SHADER_MAP = new Map(SHADER_PRESETS.map((s) => [s.id, s]));

export function getShaderPreset(id: string): ShaderPreset | undefined {
  return SHADER_MAP.get(id);
}

export function listShaderPresets(category?: string): ShaderPreset[] {
  if (!category) return SHADER_PRESETS;
  return SHADER_PRESETS.filter((s) => s.category === category);
}

export const SHADER_CATEGORIES: Array<ShaderPreset["category"]> = [
  "distortion", "color", "noise", "light", "pattern",
];
