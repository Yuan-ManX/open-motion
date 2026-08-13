/** Extended Shader Library — procedural GLSL effects for the MotionMount runtime with CSS fallbacks. */

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
  {
    id: "fx-aurora-borealis",
    name: "Aurora Borealis Storm",
    category: "pattern",
    description: "Animated northern lights with flowing color waves, curtain shimmer, and a starlit sky tint. Tags: aurora, northern-lights, wave, nature, atmospheric.",
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
  float t = u_time * 0.25;
  // Multiple flowing wave bands at different frequencies
  float wave1 = sin(uv.x * 4.0 + t * 1.5 + noise(uv * 3.0 + t) * 2.0);
  float wave2 = sin(uv.x * 7.0 - t * 1.0 + noise(uv * 5.0 - t) * 2.5);
  float wave3 = sin(uv.x * 11.0 + t * 0.6 + noise(uv * 8.0 + t * 0.5) * 3.0);
  // Curtain band position
  float bandY = 0.4 + wave1 * 0.08 + wave2 * 0.05 + wave3 * 0.03;
  float vertical = smoothstep(0.45, 0.0, abs(uv.y - bandY));
  // Color palette: green, cyan, magenta, purple
  vec3 green = vec3(0.1, 0.95, 0.4);
  vec3 cyan = vec3(0.1, 0.7, 0.9);
  vec3 magenta = vec3(0.7, 0.2, 0.9);
  vec3 purple = vec3(0.4, 0.1, 0.85);
  float hueMix = wave1 * 0.5 + 0.5;
  vec3 col = mix(green, cyan, hueMix);
  col = mix(col, magenta, smoothstep(0.3, 0.7, wave2 * 0.5 + 0.5));
  col = mix(col, purple, smoothstep(0.5, 1.0, wave3 * 0.5 + 0.5));
  // Vertical curtain shimmer
  float streaks = noise(vec2(uv.x * 20.0 + wave1 * 4.0, uv.y * 0.3)) * vertical;
  col *= vertical * u_intensity;
  col += streaks * col * 0.5;
  // Night sky tint
  col += vec3(0.02, 0.02, 0.06) * (1.0 - vertical);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(180deg, rgba(10,10,30,0.6), rgba(30,200,140,0.35) 40%, rgba(140,80,200,0.25) 70%, rgba(10,10,30,0.6))",
      mixBlendMode: "screen",
      filter: "blur(1px) saturate(1.3)",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 2.5 },
    },
  },
  {
    id: "fx-hologram",
    name: "Hologram Projection",
    category: "light",
    description: "Sci-fi holographic projection with scan lines, chromatic aberration, electric flicker, and a moving scan band. Tags: hologram, sci-fi, scanline, projection, cyberpunk.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv;
  // Chromatic aberration offsets
  float aberr = 0.005 * u_intensity;
  // Three-channel rainbow offset
  float r = 0.5 + 0.5 * sin((uv.x + aberr) * 8.0 + u_time * 2.0);
  float g = 0.5 + 0.5 * sin(uv.x * 8.0 + u_time * 2.0 + 2.09);
  float b = 0.5 + 0.5 * sin((uv.x - aberr) * 8.0 + u_time * 2.0 + 4.18);
  vec3 col = vec3(r, g, b);
  // Cyan hologram tint
  col = mix(col, vec3(0.2, 0.9, 1.0), 0.5);
  // Horizontal scanlines
  float scan = sin(uv.y * 200.0) * 0.5 + 0.5;
  col *= 0.6 + 0.4 * scan;
  // Moving bright scan band
  float bandY = fract(u_time * 0.3);
  float band = smoothstep(0.05, 0.0, abs(uv.y - bandY)) * 0.5;
  col += band * vec3(0.3, 0.9, 1.0);
  // Electric flicker
  float flicker = sin(u_time * 30.0) * sin(u_time * 7.3) * 0.1 + 0.95;
  col *= flicker;
  // Edge falloff for projection feel
  float edge = smoothstep(0.0, 0.1, uv.x) * smoothstep(1.0, 0.9, uv.x);
  col *= edge;
  col *= u_intensity;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(135deg, rgba(0,255,255,0.3), rgba(0,150,255,0.25), rgba(150,0,255,0.2))",
      mixBlendMode: "screen",
      filter: "contrast(1.2) brightness(1.15)",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 2.5 },
    },
  },
  {
    id: "fx-liquid-mercury",
    name: "Liquid Mercury",
    category: "material",
    description: "Metallic liquid surface with rippling reflection, dynamic normal-based lighting, and specular highlights. Tags: mercury, metal, liquid, reflective, ripple.",
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
  vec2 uv = v_uv;
  float t = u_time * 0.4;
  // Ripple distortion on sampling coords
  vec2 dUv = uv;
  dUv.x += sin(uv.y * 15.0 + t * 2.0) * 0.02;
  dUv.y += cos(uv.x * 12.0 + t * 1.8) * 0.02;
  // Surface height variation
  float n = fbm(dUv * 4.0 + vec2(t, t * 0.7));
  float n2 = fbm(dUv * 8.0 - vec2(t * 0.3, t));
  float surface = n + 0.3 * n2;
  // Compute normal via finite-difference gradients
  float eps = 0.01;
  float hL = fbm((dUv - vec2(eps, 0.0)) * 4.0 + vec2(t, t * 0.7));
  float hR = fbm((dUv + vec2(eps, 0.0)) * 4.0 + vec2(t, t * 0.7));
  float hD = fbm((dUv - vec2(0.0, eps)) * 4.0 + vec2(t, t * 0.7));
  float hU = fbm((dUv + vec2(0.0, eps)) * 4.0 + vec2(t, t * 0.7));
  vec3 normal = normalize(vec3((hL - hR) * 8.0, (hD - hU) * 8.0, 1.0));
  vec3 lightDir = normalize(vec3(0.5, 0.7, 0.5));
  float diff = max(dot(normal, lightDir), 0.0);
  float spec = pow(max(dot(normal, lightDir), 0.0), 32.0);
  // Mercury base color
  vec3 base = vec3(0.72, 0.74, 0.78);
  vec3 col = base * (0.3 + 0.7 * diff);
  col += vec3(1.0) * spec * 0.8;
  // Environment reflection tint
  float reflTint = smoothstep(0.4, 0.7, surface);
  col = mix(col, vec3(0.85, 0.88, 0.95), reflTint * 0.4);
  col = mix(col, vec3(0.5, 0.55, 0.6), smoothstep(0.6, 0.3, surface) * 0.3);
  col *= u_intensity;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(135deg, #6a7080 0%, #c0c8d0 35%, #4a4f55 60%, #e0e6ec 100%)",
      filter: "contrast(1.35) brightness(1.1)",
    },
    parameters: {
      intensity: { default: 1, min: 0.4, max: 2 },
    },
  },
  {
    id: "fx-pixel-storm",
    name: "Pixel Storm",
    category: "distortion",
    description: "Pixelation effect that periodically dissolves into flying rainbow particles with per-cell drift. Tags: pixelation, particle, dissolve, storm, glitch.",
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
  // Dissolution cycle 0..1
  float dissolvePhase = sin(u_time * 0.5) * 0.5 + 0.5;
  float pixelSize = mix(8.0, 60.0, dissolvePhase) * u_intensity;
  // Pixelated grid
  vec2 grid = floor(uv * pixelSize) / pixelSize;
  vec2 cell = fract(uv * pixelSize);
  // Per-cell random identity
  float cellId = hash(grid * 13.37);
  float drift = sin(u_time * 2.0 + cellId * 6.28) * dissolvePhase;
  // Particle fly-out offset
  vec2 partOff = (vec2(cellId, fract(cellId * 17.3)) - 0.5) * drift * 0.15;
  vec2 sampledUv = grid + partOff;
  // Rainbow color from cell identity
  vec3 col = vec3(
    0.5 + 0.5 * sin(cellId * 6.28 + u_time),
    0.5 + 0.5 * sin(cellId * 6.28 + u_time + 2.09),
    0.5 + 0.5 * sin(cellId * 6.28 + u_time + 4.18)
  );
  // Dissolution alpha (fade as pixels fly out)
  float alpha = 1.0 - drift * 1.2;
  alpha = clamp(alpha, 0.0, 1.0);
  // Particle shape inside cell
  float particle = smoothstep(0.5, 0.3, length(cell - 0.5));
  // Mix solid pixelation with flying particles
  vec3 pixColor = vec3(cellId) * 0.8 + 0.2;
  col = mix(pixColor, col, drift);
  col *= particle + (1.0 - dissolvePhase) * 0.7;
  col *= alpha * u_intensity;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      filter: "contrast(1.3) saturate(1.4)",
      imageRendering: "pixelated",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 3 },
    },
  },
  {
    id: "fx-neon-glow",
    name: "Neon Glow Electric",
    category: "light",
    description: "Pulsing neon outline with multi-layer glow halo, electric flicker, and random spark bursts along the border. Tags: neon, glow, electric, pulse, outline.",
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
  // Distance to nearest border for outline glow
  vec2 d = abs(uv - 0.5) * 2.0;
  float border = max(d.x, d.y);
  // Multi-layer glow
  float glow1 = smoothstep(0.95, 1.0, border);
  float glow2 = smoothstep(0.85, 1.0, border) * 0.5;
  float glow3 = smoothstep(0.6, 1.0, border) * 0.2;
  // Pulse
  float pulse = sin(u_time * 3.0) * 0.5 + 0.5;
  // Electric flicker
  float flicker = hash(uv * 100.0 + floor(u_time * 30.0));
  flicker = step(0.85, flicker) * 0.4 + 0.6;
  // Neon palette: electric pink core, cyan halo
  vec3 coreCol = vec3(1.0, 0.2, 0.8);
  vec3 outerCol = vec3(0.2, 0.9, 1.0);
  vec3 col = coreCol * glow1 * (1.5 + pulse * 0.5);
  col += outerCol * glow2 * (1.0 + pulse * 0.3);
  col += outerCol * glow3 * pulse * 0.5;
  col *= flicker;
  // Inner electric sparks
  float spark = step(0.98, hash(uv * 50.0 + u_time * 5.0));
  col += vec3(1.0) * spark * 0.5;
  col *= u_intensity;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      boxShadow: "0 0 12px rgba(255,51,153,0.9), 0 0 24px rgba(0,200,255,0.6), 0 0 48px rgba(0,200,255,0.3)",
      mixBlendMode: "screen",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 3 },
    },
  },
  {
    id: "fx-frosted-glass",
    name: "Frosted Glass Refraction",
    category: "filter",
    description: "Glassmorphism effect with multi-sample backdrop blur, prismatic edge refraction, and moving light streaks across the surface. Tags: glass, frost, blur, refraction, glassmorphism.",
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
  float t = u_time * 0.2;
  // Multi-sample blur approximation
  vec3 col = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float angle = fi * 0.5236;
    vec2 dir = vec2(cos(angle), sin(angle));
    float radius = (0.01 + 0.02 * sin(t + fi)) * u_intensity;
    vec2 offset = dir * radius;
    float w = 1.0 / (1.0 + fi * 0.3);
    col += vec3(noise(uv + offset), noise(uv + offset + 5.0), noise(uv + offset + 9.0)) * w;
    total += w;
  }
  col /= total;
  // Frosted cool tint
  col = mix(col, vec3(0.85, 0.9, 0.95), 0.4);
  // Prismatic edge refraction
  float edge = max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0;
  float prism = smoothstep(0.85, 1.0, edge);
  col.r += prism * 0.15;
  col.g += prism * 0.1;
  col.b += prism * 0.2;
  // Moving light streaks
  float streak = sin(uv.x * 3.0 + uv.y * 2.0 + t * 2.0) * 0.5 + 0.5;
  streak = pow(streak, 8.0);
  col += vec3(0.9, 0.95, 1.0) * streak * 0.15;
  // Specular highlight (top-left light source)
  float spec = smoothstep(0.3, 0.0, distance(uv, vec2(0.2, 0.2)));
  col += vec3(1.0) * spec * 0.2;
  col *= u_intensity;
  gl_FragColor = vec4(col, 0.92);
}`.trim(),
    cssStyle: {
      backdropFilter: "blur(10px) saturate(1.1)",
      background: "rgba(220,230,240,0.35)",
      filter: "brightness(1.05)",
    },
    parameters: {
      intensity: { default: 1, min: 0.2, max: 3 },
    },
  },
  {
    id: "fx-vhs-distortion",
    name: "VHS Distortion",
    category: "distortion",
    description: "Retro analog video artifact with tracking errors, scanlines, chroma shift, tape noise, moving blanking bar, and random glitch lines. Tags: vhs, retro, analog, glitch, scanline.",
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
  // Tracking error - vertical shift in horizontal bands
  float band = floor(uv.y * 30.0);
  float tracking = (hash(vec2(band, floor(u_time * 3.0))) - 0.5) * 0.04 * u_intensity;
  uv.x += tracking;
  // Wavy horizontal sync distortion
  uv.x += sin(uv.y * 50.0 + u_time * 5.0) * 0.005 * u_intensity;
  // Procedural video content pattern
  vec3 baseCol = vec3(
    0.5 + 0.5 * sin(uv.x * 6.0 + u_time),
    0.5 + 0.5 * sin(uv.y * 5.0 + u_time * 1.3),
    0.5 + 0.5 * sin((uv.x + uv.y) * 4.0 - u_time * 0.7)
  );
  // Chroma separation - RGB channel offset
  float chromaShift = 0.01 * u_intensity;
  float r = 0.5 + 0.5 * sin((uv.x + chromaShift) * 6.0 + u_time);
  float b = 0.5 + 0.5 * sin((uv.x - chromaShift) * 6.0 + u_time);
  vec3 col = vec3(r, baseCol.g, b);
  // Scanlines
  float scan = sin(uv.y * 300.0) * 0.15;
  col -= scan;
  // Vertical blanking interval bar (moving down)
  float vbiY = fract(u_time * 0.2);
  float vbi = smoothstep(0.02, 0.0, abs(vbiY - uv.y));
  col -= vbi * 0.5;
  // Tape noise
  float noiseRow = step(0.97, hash(vec2(floor(uv.y * 200.0), floor(u_time * 10.0))));
  col += noiseRow * (hash(uv * 50.0 + u_time) - 0.5) * 0.4;
  // Random bright glitch lines
  float glitchLine = step(0.985, hash(vec2(floor(uv.y * 100.0), floor(u_time * 5.0))));
  col = mix(col, vec3(1.0), glitchLine * 0.3);
  // Vignette
  float vig = 1.0 - smoothstep(0.5, 1.0, distance(uv, vec2(0.5)));
  col *= 0.6 + 0.4 * vig;
  // Warm color tint
  col *= vec3(1.05, 1.0, 0.95);
  col *= u_intensity;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      filter: "contrast(1.2) saturate(0.9) hue-rotate(-5deg)",
      mixBlendMode: "normal",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 3 },
    },
  },
  {
    id: "fx-energy-field",
    name: "Energy Field",
    category: "pattern",
    description: "Force field effect with animated hexagonal grid pattern, pulsing cell centers, and a ripple emanating from screen center. Tags: force-field, hexagon, energy, shield, sci-fi.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv * 10.0;
  // Hexagonal grid coordinates
  const float SQRT3 = 1.7320508;
  vec2 s = vec2(1.0, SQRT3);
  vec2 h = vec2(0.5, SQRT3 / 3.0);
  vec2 a = mod(uv, s) - s * 0.5;
  vec2 b = mod(uv - h, s) - s * 0.5;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  float dist = length(g);
  // Grid lines
  float gridLine = smoothstep(0.45, 0.5, dist);
  // Pulsing energy
  float pulse = sin(u_time * 2.0) * 0.5 + 0.5;
  // Color - electric blue/cyan
  vec3 coreCol = vec3(0.2, 0.8, 1.0);
  vec3 edgeCol = vec3(0.1, 0.4, 0.9);
  vec3 col = mix(coreCol, edgeCol, gridLine);
  col *= 0.3 + 0.7 * (1.0 - gridLine);
  // Pulsing hex centers
  float centerGlow = smoothstep(0.3, 0.0, dist) * pulse;
  col += coreCol * centerGlow * 1.5;
  // Ripple emanating from screen center
  vec2 centerUv = v_uv - 0.5;
  float r = length(centerUv);
  float ripple = sin(r * 30.0 - u_time * 4.0) * 0.5 + 0.5;
  ripple = pow(ripple, 4.0);
  col += coreCol * ripple * 0.3;
  // Edge fade
  col *= 1.0 - smoothstep(0.3, 0.7, r);
  col *= u_intensity;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "radial-gradient(circle, rgba(50,180,255,0.5), rgba(20,80,180,0.3) 60%, rgba(10,30,80,0.6))",
      mixBlendMode: "screen",
      filter: "contrast(1.2) saturate(1.3)",
    },
    parameters: {
      intensity: { default: 1, min: 0.3, max: 2.5 },
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
