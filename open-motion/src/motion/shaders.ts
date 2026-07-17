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
  category: "distortion" | "color" | "noise" | "light" | "pattern" | "filter";
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
  {
    id: "shader-mesh-gradient",
    name: "Mesh Gradient",
    category: "color",
    description: "Animated multi-point gradient with distortion and swirl for organic color flows.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_distortion;
uniform float u_swirl;
varying vec2 v_uv;
vec3 hash3(vec2 p) {
  vec3 q = vec3(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)), dot(p, vec2(419.2, 371.9)));
  return fract(sin(q) * 43758.5453);
}
void main() {
  vec2 uv = v_uv - 0.5;
  float angle = u_swirl * length(uv) * 3.14159;
  float s = sin(angle), c = cos(angle);
  uv = mat2(c, -s, s, c) * uv + 0.5;
  uv += sin(u_time * 0.3 + uv.xyxy * u_distortion) * 0.1;
  vec3 c1 = vec3(0.32, 0.0, 1.0);
  vec3 c2 = vec3(0.0, 1.0, 0.5);
  vec3 c3 = vec3(1.0, 0.8, 0.0);
  vec3 c4 = vec3(0.92, 0.0, 1.0);
  float w1 = smoothstep(0.0, 1.0, 1.0 - distance(uv, vec2(0.2, 0.3)));
  float w2 = smoothstep(0.0, 1.0, 1.0 - distance(uv, vec2(0.8, 0.2)));
  float w3 = smoothstep(0.0, 1.0, 1.0 - distance(uv, vec2(0.7, 0.8)));
  float w4 = smoothstep(0.0, 1.0, 1.0 - distance(uv, vec2(0.3, 0.7)));
  float total = w1 + w2 + w3 + w4 + 0.001;
  vec3 col = (c1 * w1 + c2 * w2 + c3 * w3 + c4 * w4) / total;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "radial-gradient(circle at 20% 30%, #5100ff, transparent 40%), radial-gradient(circle at 80% 20%, #00ff80, transparent 40%), radial-gradient(circle at 70% 80%, #ffcc00, transparent 40%), radial-gradient(circle at 30% 70%, #ea00ff, transparent 40%), #0a0a0a",
      backgroundSize: "200% 200%",
      animation: "gradient-shift 6s ease infinite",
    },
    parameters: { distortion: { default: 1, min: 0, max: 3 }, swirl: { default: 0.8, min: 0, max: 2 } },
  },
  {
    id: "shader-dot-orbit",
    name: "Dot Orbit",
    category: "pattern",
    description: "Orbiting dots circling around center with configurable scale and color palette.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_scale;
varying vec2 v_uv;
void main() {
  vec2 p = v_uv - 0.5;
  float r = length(p);
  float a = atan(p.y, p.x);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float orbitR = (0.15 + fi * 0.06) * u_scale;
    float speed = 1.0 + fi * 0.3;
    float angle = u_time * speed + fi * 1.047;
    vec2 pos = vec2(cos(angle), sin(angle)) * orbitR;
    float d = distance(p, pos);
    float dot = smoothstep(0.02, 0.0, d);
    vec3 dotCol = vec3(0.82, 0.51, 0.18) + vec3(0.05, 0.24, 0.49) * fi;
    col += dotCol * dot;
  }
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "radial-gradient(circle, #d2822d 2px, transparent 3px), radial-gradient(circle, #0c3b7e 2px, transparent 3px), #000",
      backgroundSize: "60px 60px, 90px 90px, 100% 100%",
      animation: "spin 8s linear infinite",
    },
    parameters: { scale: { default: 0.3, min: 0.1, max: 1 } },
  },
  {
    id: "shader-dot-grid",
    name: "Dot Grid",
    category: "pattern",
    description: "Grid of dots modulated by wave patterns for a dynamic pointillism effect.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_scale;
varying vec2 v_uv;
void main() {
  vec2 grid = v_uv / u_scale;
  vec2 cell = fract(grid) - 0.5;
  vec2 id = floor(grid);
  float wave = sin(id.x * 0.5 + id.y * 0.3 + u_time * 1.5) * 0.5 + 0.5;
  float d = length(cell);
  float dot = smoothstep(0.1 + wave * 0.15, 0.0, d);
  vec3 col = vec3(0.5 + 0.5 * sin(id.x * 0.3), 0.4 + 0.4 * sin(id.y * 0.4 + u_time), 0.8) * dot;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "radial-gradient(circle, #fff 1px, transparent 2px)",
      backgroundSize: "20px 20px",
      backgroundColor: "#0a0a0a",
    },
    parameters: { scale: { default: 0.15, min: 0.05, max: 0.5 } },
  },
  {
    id: "shader-warp",
    name: "Warp Distortion",
    category: "distortion",
    description: "Spatial warp distortion that bends coordinates with sinusoidal displacement.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv;
  uv.x += sin(uv.y * 10.0 + u_time * 2.0) * u_intensity * 0.05;
  uv.y += cos(uv.x * 8.0 + u_time * 1.5) * u_intensity * 0.05;
  gl_FragColor = texture2D(u_tex, uv);
}`.trim(),
    cssStyle: {
      filter: "url(#warp)",
      transform: "perspective(500px) rotateY(5deg)",
    },
    parameters: { intensity: { default: 1, min: 0, max: 3 } },
  },
  {
    id: "shader-swirl",
    name: "Swirl",
    category: "distortion",
    description: "Swirl distortion rotating coordinates around center with adjustable radius.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 p = v_uv - 0.5;
  float r = length(p);
  float a = atan(p.y, p.x);
  a += u_intensity * (1.0 - smoothstep(0.0, 0.5, r)) * sin(u_time * 0.5);
  vec2 uv = vec2(cos(a), sin(a)) * r + 0.5;
  gl_FragColor = texture2D(u_tex, uv);
}`.trim(),
    cssStyle: {
      filter: "url(#swirl)",
    },
    parameters: { intensity: { default: 2, min: 0, max: 5 } },
  },
  {
    id: "shader-waves",
    name: "Waves",
    category: "pattern",
    description: "Layered sinusoidal wave patterns creating flowing organic motion.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv;
  float w1 = sin(uv.x * 8.0 + u_time * 1.5) * 0.5 + 0.5;
  float w2 = sin(uv.y * 6.0 - u_time * 1.0) * 0.5 + 0.5;
  float w3 = sin((uv.x + uv.y) * 5.0 + u_time * 0.7) * 0.5 + 0.5;
  float v = (w1 + w2 + w3) / 3.0 * u_intensity;
  vec3 col = mix(vec3(0.05, 0.1, 0.3), vec3(0.2, 0.6, 1.0), v);
  col = mix(col, vec3(0.8, 0.9, 1.0), pow(v, 3.0));
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(180deg, #0a1a3a, #2a6ada 50%, #a0c8ff 100%)",
      filter: "blur(1px)",
    },
    parameters: { intensity: { default: 1, min: 0.3, max: 2 } },
  },
  {
    id: "shader-perlin",
    name: "Perlin Noise",
    category: "noise",
    description: "Smooth Perlin noise generating organic flowing textures with controllable scale.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_scale;
varying vec2 v_uv;
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
}
float perlin(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dot(hash2(i), f);
  float b = dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0));
  float c = dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0));
  float d = dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
void main() {
  float n = perlin(v_uv * u_scale * 10.0 + u_time * 0.3);
  n = n * 0.5 + 0.5;
  vec3 col = vec3(n);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "url(#perlin)",
      filter: "contrast(1.2)",
    },
    parameters: { scale: { default: 1, min: 0.2, max: 5 } },
  },
  {
    id: "shader-simplex",
    name: "Simplex Noise",
    category: "noise",
    description: "Computationally efficient simplex noise producing organic random patterns.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_scale;
varying vec2 v_uv;
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865, 0.366025403, -0.577350269, 0.024390243);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291 - 0.85373472 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
void main() {
  float n = snoise(v_uv * u_scale * 8.0 + u_time * 0.2);
  n = n * 0.5 + 0.5;
  vec3 col = vec3(n * 0.8, n * 0.9, n);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      filter: "contrast(1.1) brightness(0.95)",
    },
    parameters: { scale: { default: 1, min: 0.2, max: 5 } },
  },
  {
    id: "shader-voronoi",
    name: "Voronoi Cells",
    category: "pattern",
    description: "Voronoi cell pattern with distance-based coloring and animated seed points.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_scale;
varying vec2 v_uv;
vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}
void main() {
  vec2 uv = v_uv * u_scale * 10.0;
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  float minDist = 1.0;
  vec3 closestCol = vec3(0.0);
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash2(i + neighbor);
      point = 0.5 + 0.5 * sin(u_time * 0.5 + 6.2831 * point);
      vec2 diff = neighbor + point - f;
      float d = length(diff);
      if (d < minDist) {
        minDist = d;
        closestCol = vec3(hash2(i + neighbor), 0.8);
      }
    }
  }
  gl_FragColor = vec4(closestCol * (1.0 - minDist * 0.5), 1.0);
}`.trim(),
    cssStyle: {
      filter: "contrast(1.3) saturate(1.2)",
    },
    parameters: { scale: { default: 1, min: 0.3, max: 4 } },
  },
  {
    id: "shader-metaballs",
    name: "Metaballs",
    category: "pattern",
    description: "Organic metaball effect with merging liquid-like spheres and threshold marching.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  float v = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    vec2 c = vec2(
      sin(u_time * 0.3 + fi * 1.256) * 0.6,
      cos(u_time * 0.4 + fi * 1.256) * 0.6
    );
    float r = 0.15 + 0.05 * sin(u_time + fi);
    v += r * r / dot(p - c, p - c);
  }
  float t = smoothstep(u_intensity, u_intensity + 0.3, v);
  vec3 col = mix(vec3(0.1, 0.1, 0.15), vec3(0.3, 0.6, 1.0), t);
  col = mix(col, vec3(0.8, 0.9, 1.0), smoothstep(u_intensity + 0.3, u_intensity + 0.8, v));
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      filter: "blur(3px) contrast(8)",
    },
    parameters: { intensity: { default: 1, min: 0.5, max: 3 } },
  },
  {
    id: "shader-pulsing-border",
    name: "Pulsing Border",
    category: "light",
    description: "Pulsing luminous border with configurable width, speed, and color glow.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 p = abs(v_uv - 0.5) * 2.0;
  float edge = max(p.x, p.y);
  float pulse = sin(u_time * 2.0) * 0.5 + 0.5;
  float border = smoothstep(0.8, 1.0, edge) * (0.5 + pulse * 0.5) * u_intensity;
  vec3 inner = vec3(0.05, 0.05, 0.1);
  vec3 borderCol = vec3(0.4, 0.8, 1.0) * border;
  vec3 col = mix(inner, borderCol, border);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      boxShadow: "inset 0 0 20px rgba(100,200,255,0.5), 0 0 15px rgba(100,200,255,0.3)",
      animation: "pulse 2s ease-in-out infinite",
    },
    parameters: { intensity: { default: 1, min: 0.3, max: 3 } },
  },
  {
    id: "shader-smoke-ring",
    name: "Smoke Ring",
    category: "pattern",
    description: "Expanding smoke ring with turbulent distortion and soft particle fade.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = v_uv - 0.5;
  float r = length(p);
  float a = atan(p.y, p.x);
  float ring = sin(r * 20.0 - u_time * 2.0);
  float n = noise(p * 8.0 + u_time * 0.5);
  float smoke = ring * n * 0.5 + 0.5;
  smoke *= smoothstep(0.5, 0.1, r) * u_intensity;
  vec3 col = vec3(0.8, 0.8, 0.85) * smoke;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      filter: "blur(4px) contrast(1.5)",
    },
    parameters: { intensity: { default: 1, min: 0.3, max: 3 } },
  },
  {
    id: "shader-god-rays",
    name: "God Rays",
    category: "light",
    description: "Volumetric god rays streaming from a point with animated light shafts.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 p = v_uv - vec2(0.5, 0.1);
  float a = atan(p.y, p.x);
  float r = length(p);
  float rays = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float angle = a + fi * 0.3927 + sin(u_time * 0.3 + fi) * 0.1;
    rays += pow(max(0.0, cos(angle * 4.0 - fi)), 8.0);
  }
  rays *= u_intensity * smoothstep(1.0, 0.0, r);
  vec3 col = vec3(1.0, 0.95, 0.7) * rays * 0.3;
  col += vec3(0.02, 0.02, 0.05);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(180deg, rgba(255,240,200,0.3), transparent 60%)",
    },
    parameters: { intensity: { default: 1, min: 0.3, max: 3 } },
  },
  {
    id: "shader-heatmap",
    name: "Heatmap",
    category: "color",
    description: "Heatmap visualization with smooth color gradient from cold blue to hot red.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 p = v_uv;
  float heat = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(u_time * 0.2 + fi), cos(u_time * 0.15 + fi)) * 0.3 + 0.5;
    heat += 0.3 / (1.0 + 20.0 * distance(p, c));
  }
  heat *= u_intensity;
  heat = clamp(heat, 0.0, 1.0);
  vec3 col = mix(vec3(0.0, 0.0, 0.5), vec3(0.0, 1.0, 0.0), heat);
  col = mix(col, vec3(1.0, 1.0, 0.0), smoothstep(0.5, 0.75, heat));
  col = mix(col, vec3(1.0, 0.0, 0.0), smoothstep(0.75, 1.0, heat));
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "radial-gradient(circle, #ff0000, #ffff00 30%, #00ff00 60%, #0000ff 100%)",
      filter: "blur(10px)",
    },
    parameters: { intensity: { default: 1, min: 0.3, max: 3 } },
  },
  {
    id: "shader-liquid-metal",
    name: "Liquid Metal",
    category: "pattern",
    description: "Reflective liquid metal surface with flowing mercury-like distortion.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 uv = v_uv;
  uv.x += noise(uv * 5.0 + u_time * 0.3) * 0.1 * u_intensity;
  uv.y += noise(uv * 5.0 - u_time * 0.2) * 0.1 * u_intensity;
  float n = noise(uv * 8.0);
  vec3 metal = vec3(0.7, 0.72, 0.75);
  metal += vec3(0.2) * sin(n * 10.0 + u_time);
  metal = mix(metal, vec3(0.9, 0.92, 0.95), smoothstep(0.4, 0.6, n));
  gl_FragColor = vec4(metal, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(135deg, #b0b0b0, #e0e0e0, #909090, #c0c0c0)",
      filter: "contrast(1.3) brightness(1.1)",
    },
    parameters: { intensity: { default: 1, min: 0.3, max: 3 } },
  },
  {
    id: "shader-gem-smoke",
    name: "Gem Smoke",
    category: "pattern",
    description: "Crystalline gem with swirling smoke interior and prismatic color refraction.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = v_uv - 0.5;
  float r = length(p);
  float a = atan(p.y, p.x);
  float facets = abs(sin(a * 6.0));
  float smoke = noise(p * 6.0 + u_time * 0.5) * 0.5 + 0.5;
  smoke *= facets;
  vec3 gem = vec3(0.8, 0.2, 0.9) * smoke;
  gem += vec3(0.1, 0.7, 0.9) * (1.0 - smoke) * u_intensity;
  gem *= smoothstep(0.5, 0.3, r);
  gl_FragColor = vec4(gem, 1.0);
}`.trim(),
    cssStyle: {
      background: "radial-gradient(circle, #cc22ff, #11b5ee, transparent 70%)",
      filter: "blur(1px) saturate(1.5)",
    },
    parameters: { intensity: { default: 1, min: 0.3, max: 3 } },
  },
  {
    id: "shader-halftone-dots",
    name: "Halftone Dots",
    category: "filter",
    description: "Print-style halftone dot pattern with variable dot size based on luminance.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_scale;
varying vec2 v_uv;
void main() {
  vec2 grid = v_uv * u_scale * 50.0;
  vec2 cell = fract(grid) - 0.5;
  vec2 id = floor(grid);
  float lum = 0.5 + 0.3 * sin(id.x * 0.5 + id.y * 0.3);
  float d = length(cell);
  float dot = smoothstep(lum * 0.5, lum * 0.5 - 0.1, d);
  gl_FragColor = vec4(vec3(dot), 1.0);
}`.trim(),
    cssStyle: {
      background: "radial-gradient(circle, #000 30%, transparent 31%)",
      backgroundSize: "8px 8px",
    },
    parameters: { scale: { default: 1, min: 0.3, max: 3 } },
  },
  {
    id: "shader-halftone-cmyk",
    name: "Halftone CMYK",
    category: "filter",
    description: "Four-channel CMYK halftone pattern with offset dot screens per color channel.",
    glslSource: `
precision mediump float;
uniform float u_scale;
varying vec2 v_uv;
float dotScreen(vec2 uv, float angle, float scale) {
  vec2 t = vec2(cos(angle), sin(angle));
  vec2 p = uv * scale * 40.0;
  float c = dot(p, t);
  float grid = fract(c) - 0.5;
  return smoothstep(0.2, 0.0, abs(grid));
}
void main() {
  float c = dotScreen(v_uv, 0.0, u_scale) * 0.3;
  float m = dotScreen(v_uv, 1.5708, u_scale) * 0.3;
  float y = dotScreen(v_uv, 0.7854, u_scale) * 0.3;
  float k = dotScreen(v_uv, 2.3562, u_scale) * 0.2;
  vec3 col = vec3(1.0) - vec3(c, m, y) - k;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      filter: "contrast(1.5) saturate(1.3)",
    },
    parameters: { scale: { default: 1, min: 0.3, max: 3 } },
  },
  {
    id: "shader-dithering",
    name: "Dithering",
    category: "filter",
    description: "Bayer ordered dithering reducing color depth while preserving perceived gradients.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_intensity;
varying vec2 v_uv;
float bayer4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  float m[16];
  m[0]=0.0; m[1]=8.0; m[2]=2.0; m[3]=10.0;
  m[4]=12.0; m[5]=4.0; m[6]=14.0; m[7]=6.0;
  m[8]=3.0; m[9]=11.0; m[10]=1.0; m[11]=9.0;
  m[12]=15.0; m[13]=7.0; m[14]=13.0; m[15]=5.0;
  return m[y * 4 + x] / 16.0;
}
void main() {
  float lum = 0.5 + 0.3 * sin(v_uv.x * 5.0 + v_uv.y * 3.0);
  float threshold = bayer4(v_uv * 200.0) - 0.5;
  float dithered = step(threshold * u_intensity * 0.5, lum);
  vec3 col = vec3(dithered);
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      filter: "contrast(20)",
      imageRendering: "pixelated",
    },
    parameters: { intensity: { default: 1, min: 0.3, max: 3 } },
  },
  {
    id: "shader-grain-gradient",
    name: "Grain Gradient",
    category: "color",
    description: "Smooth color gradient overlaid with film grain for a textured organic look.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 a = vec3(0.9, 0.3, 0.5);
  vec3 b = vec3(0.2, 0.6, 0.9);
  vec3 col = mix(a, b, v_uv.x);
  float grain = hash(v_uv * 500.0 + u_time) * u_intensity;
  col += grain - u_intensity * 0.5;
  gl_FragColor = vec4(col, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(90deg, #e64b80, #3399e6)",
      filter: "contrast(1.05)",
    },
    parameters: { intensity: { default: 0.15, min: 0, max: 0.5 } },
  },
  {
    id: "shader-color-panels",
    name: "Color Panels",
    category: "pattern",
    description: "Animated grid of colored panels with shifting hues and configurable density.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_scale;
varying vec2 v_uv;
void main() {
  vec2 grid = v_uv * u_scale * 6.0;
  vec2 id = floor(grid);
  vec2 cell = fract(grid);
  float shift = sin(id.x * 0.5 + id.y * 0.3 + u_time) * 0.5 + 0.5;
  vec3 col = vec3(
    0.5 + 0.5 * sin(id.x * 0.8 + u_time * 0.5),
    0.5 + 0.5 * sin(id.y * 0.6 + u_time * 0.7),
    0.5 + 0.5 * sin((id.x + id.y) * 0.4 + u_time * 0.3)
  );
  float border = step(0.05, cell.x) * step(0.05, cell.y) * step(cell.x, 0.95) * step(cell.y, 0.95);
  col *= 0.3 + 0.7 * border;
  gl_FragColor = vec4(col * shift, 1.0);
}`.trim(),
    cssStyle: {
      background: "linear-gradient(45deg, #ff6644, #44aaff, #88ff44, #ff44aa)",
      backgroundSize: "60px 60px",
    },
    parameters: { scale: { default: 1, min: 0.3, max: 4 } },
  },
  {
    id: "shader-paper-texture",
    name: "Paper Texture",
    category: "filter",
    description: "Procedural paper fiber texture with grain, fibers, and subtle color variation.",
    glslSource: `
precision mediump float;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  float n = noise(v_uv * 300.0) * u_intensity;
  float fibers = noise(v_uv * vec2(800.0, 20.0)) * 0.3;
  vec3 paper = vec3(0.95, 0.93, 0.88);
  paper -= n * 0.15;
  paper -= fibers * u_intensity * 0.1;
  gl_FragColor = vec4(paper, 1.0);
}`.trim(),
    cssStyle: {
      background: "#f0ebe0",
      filter: "contrast(0.95) brightness(1.02)",
    },
    parameters: { intensity: { default: 0.5, min: 0, max: 2 } },
  },
  {
    id: "shader-fluted-glass",
    name: "Fluted Glass",
    category: "filter",
    description: "Refractive fluted glass effect with vertical ribbing distortion and light scattering.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
void main() {
  vec2 uv = v_uv;
  float rib = sin(uv.x * 40.0 + u_time * 0.5) * u_intensity * 0.015;
  uv.y += rib;
  vec4 col = texture2D(u_tex, uv);
  float highlight = smoothstep(0.7, 0.9, sin(uv.x * 40.0) * 0.5 + 0.5);
  col.rgb += highlight * 0.15;
  gl_FragColor = col;
}`.trim(),
    cssStyle: {
      backdropFilter: "blur(2px)",
      filter: "brightness(1.1) contrast(0.9)",
    },
    parameters: { intensity: { default: 1, min: 0.3, max: 3 } },
  },
  {
    id: "shader-water",
    name: "Water Surface",
    category: "filter",
    description: "Animated water surface with ripples, caustics, and refractive distortion.",
    glslSource: `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_intensity;
varying vec2 v_uv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 uv = v_uv;
  uv.x += sin(uv.y * 20.0 + u_time * 2.0) * 0.01 * u_intensity;
  uv.y += cos(uv.x * 15.0 + u_time * 1.5) * 0.01 * u_intensity;
  float caustic = noise(uv * 10.0 + u_time * 0.5);
  caustic = pow(caustic, 3.0) * u_intensity;
  vec4 col = texture2D(u_tex, uv);
  col.rgb += vec3(0.1, 0.2, 0.3) * caustic;
  gl_FragColor = col;
}`.trim(),
    cssStyle: {
      filter: "hue-rotate(10deg) brightness(1.05) contrast(1.05)",
    },
    parameters: { intensity: { default: 1, min: 0.3, max: 3 } },
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
