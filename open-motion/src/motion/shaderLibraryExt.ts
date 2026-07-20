/**
 * Extended Shader Library — procedural GLSL effects for the MotionMount runtime.
 *
 * Each entry is a self-contained GLSL fragment shader paired with a CSS
 * fallback and tunable parameters. The shaders are designed for real-time
 * preview at 60fps on consumer hardware.
 *
 * Categories:
 *   - pattern:  procedural textures (voronoi, flow field, caustics)
 *   - light:    lighting effects (iridescent, holographic, aurora)
 *   - material: surface materials (liquid metal, crystal, glass)
 *   - noise:    noise-based effects (perlin, simplectic, fractal)
 *
 * The MotionMount runtime compiles these shaders to WebGL and exposes the
 * parameters as live-tunable controls in the Shader Studio panel.
 */

import { SHADER_EFFECTS, type ShaderEffect } from "./shaders.js";

export const SHADER_EFFECTS_EXT: ShaderEffect[] = [
  {
    id: "shader-voronoi",
    name: "Voronoi Cells",
    category: "pattern",
    description: "Procedural Voronoi cell pattern with distance-based coloring.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
uniform vec2 u_resolution;
varying vec2 v_uv;
vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
void main() {
  vec2 uv = v_uv * 10.0 * u_intensity;
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  float minDist = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash22(i + neighbor);
      point = 0.5 + 0.5 * sin(u_time * 0.5 + 6.2831 * point);
      vec2 diff = neighbor + point - f;
      minDist = min(minDist, length(diff));
    }
  }
  vec3 col = vec3(minDist) * vec3(0.5, 0.7, 1.0);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "radial-gradient(circle at 30% 30%, rgba(80,120,200,0.5), rgba(20,40,80,0.7))",
      backgroundSize: "30px 30px",
    },
    parameters: {
      intensity: { default: 1, min: 0.5, max: 4 },
    },
  },
  {
    id: "shader-flow-field",
    name: "Flow Field",
    category: "pattern",
    description: "Curled noise flow field with particle trails for organic motion.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
uniform vec2 u_resolution;
varying vec2 v_uv;
float noise(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float smoothNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(noise(i), noise(i + vec2(1.0, 0.0)), f.x),
    mix(noise(i + vec2(0.0, 1.0)), noise(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}
void main() {
  vec2 uv = v_uv * 4.0;
  float t = u_time * 0.2;
  float field = smoothNoise(uv + vec2(t, t * 0.7));
  field += 0.5 * smoothNoise(uv * 2.0 - vec2(t * 0.3, t));
  vec3 col = vec3(field * 0.8, field * 0.4, 1.0 - field * 0.5) * u_intensity;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(45deg, rgba(40,80,180,0.4), rgba(80,200,180,0.4), rgba(180,120,40,0.4))",
      backgroundSize: "300% 300%",
      animation: "flow-field-shift 8s ease-in-out infinite",
    },
    parameters: {
      intensity: { default: 1, min: 0.2, max: 2.5 },
    },
  },
  {
    id: "shader-caustics",
    name: "Caustics",
    category: "light",
    description: "Underwater caustic light pattern with layered sine interference.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv * 6.0;
  float t = u_time * 0.8;
  float c = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 offset = vec2(sin(t + fi * 1.7), cos(t * 1.3 + fi * 2.1)) * 0.5;
    c += sin(length(uv + offset) - t) * 0.25;
  }
  c = pow(max(c, 0.0), 3.0) * u_intensity;
  vec3 col = vec3(c * 0.6, c * 0.9, c);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "radial-gradient(circle at 50% 50%, rgba(80,200,255,0.4), rgba(20,80,140,0.6))",
      mixBlendMode: "screen",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 3 },
    },
  },
  {
    id: "shader-iridescent",
    name: "Iridescent",
    category: "light",
    description: "Iridescent thin-film interference with viewing-angle color shift.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
void main() {
  vec2 uv = v_uv;
  float hue = uv.x + uv.y * 0.5 + u_time * 0.1;
  float sat = 0.7 + 0.3 * sin(u_time * 0.5 + uv.x * 3.0);
  float val = 0.8 + 0.2 * cos(u_time + uv.y * 4.0);
  vec3 col = hsv2rgb(vec3(hue, sat, val)) * u_intensity;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(135deg, #ff006e, #fb5607, #ffbe0b, #8338ec, #3a86ff)",
      backgroundSize: "300% 300%",
      animation: "iridescent-shift 6s ease-in-out infinite",
      mixBlendMode: "screen",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 2 },
    },
  },
  {
    id: "shader-holographic",
    name: "Holographic",
    category: "light",
    description: "Holographic diffraction grating with rainbow spectral splitting.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv;
  float grating = sin((uv.x + uv.y + u_time * 0.3) * 40.0) * 0.5 + 0.5;
  float spectralShift = uv.x + u_time * 0.05;
  vec3 col;
  col.r = sin(grating * 6.28 + spectralShift * 6.28) * 0.5 + 0.5;
  col.g = sin(grating * 6.28 + spectralShift * 6.28 + 2.09) * 0.5 + 0.5;
  col.b = sin(grating * 6.28 + spectralShift * 6.28 + 4.18) * 0.5 + 0.5;
  col *= u_intensity;
  float scanline = sin(uv.y * 200.0) * 0.05;
  col += scanline;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(135deg, rgba(255,0,255,0.4), rgba(0,255,255,0.4), rgba(255,255,0,0.4))",
      mixBlendMode: "screen",
      filter: "contrast(1.2) brightness(1.1)",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 2.5 },
    },
  },
  {
    id: "shader-aurora",
    name: "Aurora Borealis",
    category: "light",
    description: "Animated aurora curtain with vertical light streaks and color drift.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec2 uv = v_uv;
  float t = u_time * 0.3;
  float curtain = noise(vec2(uv.x * 3.0 + t, uv.y * 0.5));
  curtain += 0.5 * noise(vec2(uv.x * 6.0 - t * 1.3, uv.y * 1.0 + t));
  float mask = smoothstep(0.3, 0.8, curtain) * (1.0 - uv.y * 0.7);
  vec3 col = vec3(0.2, 0.8, 0.4) * mask;
  col += vec3(0.3, 0.4, 0.9) * mask * smoothstep(0.5, 0.9, curtain);
  col += vec3(0.6, 0.2, 0.8) * mask * smoothstep(0.7, 1.0, curtain);
  col *= u_intensity;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(180deg, rgba(30,80,180,0.4), rgba(80,200,140,0.5), rgba(140,80,200,0.3))",
      mixBlendMode: "screen",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 2.5 },
    },
  },
  {
    id: "shader-liquid-metal",
    name: "Liquid Metal",
    category: "material",
    description: "Chrome-like liquid metal surface with environmental reflection.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float noise(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}
void main() {
  vec2 uv = v_uv * 2.0;
  float t = u_time * 0.4;
  float n = fbm(uv + vec2(t, t * 0.7));
  n += 0.5 * fbm(uv * 2.0 - vec2(t * 0.3, t));
  float metallic = sin(n * 10.0 + u_time) * 0.5 + 0.5;
  vec3 col = mix(vec3(0.4, 0.45, 0.55), vec3(0.9, 0.92, 0.95), metallic);
  col += vec3(0.1, 0.05, 0.0) * sin(u_time + uv.x * 5.0);
  col *= u_intensity;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(135deg, #4a4f55 0%, #b8c0c8 30%, #6a7080 60%, #d0d8e0 100%)",
      filter: "contrast(1.3) brightness(1.1)",
    },
    parameters: {
      intensity: { default: 1, min: 0.4, max: 2 },
    },
  },
  {
    id: "shader-crystal",
    name: "Crystal Refraction",
    category: "material",
    description: "Faceted crystal refraction with chromatic dispersion and internal reflections.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv;
  float facet = abs(sin(uv.x * 8.0 + u_time * 0.3)) * abs(sin(uv.y * 6.0 - u_time * 0.2));
  float dispersion = sin(facet * 6.28 + u_time) * 0.5 + 0.5;
  vec3 col;
  col.r = dispersion;
  col.g = sin(facet * 6.28 + u_time + 2.09) * 0.5 + 0.5;
  col.b = sin(facet * 6.28 + u_time + 4.18) * 0.5 + 0.5;
  col = mix(vec3(0.8, 0.85, 0.95), col, facet * 0.7);
  col *= u_intensity;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(135deg, rgba(180,200,255,0.6), rgba(255,200,220,0.5), rgba(180,255,220,0.5))",
      filter: "contrast(1.4) brightness(1.15)",
      mixBlendMode: "screen",
    },
    parameters: {
      intensity: { default: 1, min: 0.4, max: 2 },
    },
  },
  {
    id: "shader-glass",
    name: "Frosted Glass",
    category: "material",
    description: "Frosted glass with depth-of-field blur and subtle refraction.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
void main() {
  vec2 uv = v_uv;
  float blur = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec2 offset = vec2(hash(uv + fi), hash(uv + fi + 1.0)) - 0.5;
    blur += hash(uv + offset * 0.05 * u_intensity);
  }
  blur /= 8.0;
  vec3 col = mix(vec3(0.85, 0.9, 0.95), vec3(0.7, 0.75, 0.85), blur);
  col += vec3(0.1) * sin(u_time + uv.x * 5.0);
  gl_FragColor = vec4(col, 0.85);
}`.trim(),
    cssStyle: {
      backdropFilter: "blur(8px) saturate(0.9)",
      background: "rgba(220,230,240,0.4)",
    },
    parameters: {
      intensity: { default: 1, min: 0.2, max: 3 },
    },
  },
  {
    id: "shader-perlin-noise",
    name: "Perlin Noise",
    category: "noise",
    description: "Classic Perlin noise field with smooth gradient transitions.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}
float perlin(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}
void main() {
  vec2 uv = v_uv * 4.0;
  float n = perlin(uv + u_time * 0.2) * 0.5 + 0.5;
  n *= u_intensity;
  vec3 col = vec3(n * 0.8, n * 0.6, n);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "radial-gradient(circle at 40% 60%, rgba(50,80,180,0.6), rgba(20,30,60,0.8))",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 2.5 },
    },
  },
  {
    id: "shader-fractal-brownian",
    name: "Fractal Brownian Motion",
    category: "noise",
    description: "Layered fractal brownian motion for organic, cloud-like textures.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}
float perlin(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash22(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash22(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash22(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash22(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * perlin(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}
void main() {
  vec2 uv = v_uv * 3.0;
  float n = fbm(uv + u_time * 0.15);
  n = n * 0.5 + 0.5;
  n *= u_intensity;
  vec3 col = vec3(n * 0.6, n * 0.5, n * 0.9);
  col += vec3(0.3, 0.2, 0.0) * smoothstep(0.6, 1.0, n);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "radial-gradient(circle at 60% 30%, rgba(100,80,180,0.5), rgba(40,30,80,0.7))",
      filter: "contrast(1.2) saturate(1.2)",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 2.5 },
    },
  },
  {
    id: "shader-simplectic",
    name: "Simplectic Noise",
    category: "noise",
    description: "Simplectic noise with cellular structure for organic textures.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
vec2 hash22(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
void main() {
  vec2 uv = v_uv * 5.0;
  float t = u_time * 0.3;
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  float n = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash22(i + neighbor);
      point = 0.5 + 0.5 * sin(t + 6.2831 * point);
      vec2 diff = neighbor + point - f;
      n += 1.0 / (dot(diff, diff) + 0.1);
    }
  }
  n = n / 9.0;
  n = clamp(n * u_intensity, 0.0, 1.0);
  vec3 col = vec3(n * 0.7, n * 0.9, n);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "radial-gradient(circle at 50% 50%, rgba(80,150,200,0.5), rgba(30,60,100,0.7))",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 3 },
    },
  },
];

/** Combined list of base + extended shader effects. */
export function listAllShaderEffects(category?: string): ShaderEffect[] {
  const combined = [...SHADER_EFFECTS, ...SHADER_EFFECTS_EXT];
  if (!category) return combined;
  return combined.filter((s) => s.category === category);
}

/** Get an extended shader effect by ID. */
export function getExtendedShaderEffect(id: string): ShaderEffect | undefined {
  return SHADER_EFFECTS_EXT.find((s) => s.id === id);
}
