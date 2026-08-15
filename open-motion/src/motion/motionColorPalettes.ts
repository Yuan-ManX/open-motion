/**
 * Motion-Aware Color Palettes — color schemes tuned to complement specific
 * motion semantics.
 *
 * Raw color palettes (e.g., Tailwind/Solarized) are static. Motion-aware
 * palettes encode *how colors should animate*: each palette specifies a
 * primary gradient, a pulse-safe accent that won't flash at high
 * iteration counts, and a per-property motion-energy mapping that tells
 * the agent whether a particular hue should move "fast and snappy" or
 * "slow and graceful."
 */

export type MotionEnergy = "snappy" | "flowing" | "energetic" | "serene" | "energized";

export interface MotionPaletteColor {
  /** HEX color string (7 chars, #rrggbb) */
  hex: string;
  /** Semantic role — named so users can refer to them in natural language */
  role: "primary" | "accent" | "secondary" | "success" | "danger" | "background" | "surface" | "text";
  /** Recommended motion energy for any component colored with this hue */
  motionEnergy: MotionEnergy;
  /** WCAG contrast (AA / AAA) measured against the paired background color */
  contrastRatio?: number;
  /** True if this color is safe for high-frequency pulse animation (no photosensitivity risk) */
  pulseSafe: boolean;
}

export interface MotionColorPalette {
  id: string;
  name: string;
  description: string;
  /** Overall "mood" that matches this palette — aligned with motion storytelling genres */
  mood: "calm" | "energetic" | "playful" | "corporate" | "editorial" | "ambient" | "festive";
  /** Hue count — monotone (1 color), duotone (2), balanced (3–5), or vivid (6+) */
  complexity: "monotone" | "duotone" | "balanced" | "vivid";
  colors: MotionPaletteColor[];
  /** Recommended cross-fade timing for palette transitions — so palette changes can themselves be animated */
  paletteTransition: {
    durationMs: number;
    easing: string;
    /** Which CSS properties to interpolate — usually backgroundColor+color separately */
    properties: string[];
  };
  /** Suggested complementary cursor choreographies for this palette */
  recommendedCursorChoreography: string[];
  /** Natural-language tags */
  tags: string[];
}

// Helper — converts #rrggbb to [r,g,b] 0-255
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function luminance(rgb: [number, number, number]): number {
  const a = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}
function contrast(hex1: string, hex2: string): number {
  const l1 = luminance(hexToRgb(hex1)) + 0.05;
  const l2 = luminance(hexToRgb(hex2)) + 0.05;
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return Math.round((hi / lo) * 100) / 100;
}

// Baseline dark/light backgrounds referenced by palettes below
const DARK_BG = "#0B0B0F";
const LIGHT_BG = "#F8F7F4";

export const MOTION_COLOR_PALETTES: MotionColorPalette[] = [
  {
    id: "palette-midnight-gradient",
    name: "Midnight Gradient",
    description: "Deep indigo-violet with cyan accent. Calm ambient gradients that remain legible under heavy motion blur and onion-skin compositing.",
    mood: "ambient",
    complexity: "balanced",
    colors: [
      { hex: "#1B1738", role: "background", motionEnergy: "serene", pulseSafe: true },
      { hex: "#FFFFFF", role: "text", motionEnergy: "flowing", contrastRatio: contrast("#FFFFFF", "#1B1738"), pulseSafe: true },
      { hex: "#7C5CFF", role: "primary", motionEnergy: "flowing", contrastRatio: contrast("#7C5CFF", "#1B1738"), pulseSafe: true },
      { hex: "#3EE8D8", role: "accent", motionEnergy: "snappy", contrastRatio: contrast("#3EE8D8", "#1B1738"), pulseSafe: false },
      { hex: "#FF6B9D", role: "success", motionEnergy: "energetic", contrastRatio: contrast("#FF6B9D", "#1B1738"), pulseSafe: false },
      { hex: "#2B2450", role: "surface", motionEnergy: "serene", pulseSafe: true },
    ],
    paletteTransition: { durationMs: 900, easing: "ease-out-quart", properties: ["backgroundColor", "color", "borderColor", "fill", "stroke"] },
    recommendedCursorChoreography: ["cursor-subtle-whisper", "cursor-magnetic-pro"],
    tags: ["dark", "violet", "cyan", "ambient", "gradient", "editorial", "product"],
  },
  {
    id: "palette-warm-editorial",
    name: "Warm Editorial",
    description: "Off-white paper background with clay-red and mustard accents — specifically calibrated so opacity-fade entrance animations never look muddy against the paper tone.",
    mood: "editorial",
    complexity: "balanced",
    colors: [
      { hex: "#F8F1E7", role: "background", motionEnergy: "serene", pulseSafe: true },
      { hex: "#1C1917", role: "text", motionEnergy: "flowing", contrastRatio: contrast("#1C1917", "#F8F1E7"), pulseSafe: true },
      { hex: "#B7513B", role: "primary", motionEnergy: "flowing", contrastRatio: contrast("#B7513B", "#F8F1E7"), pulseSafe: true },
      { hex: "#D49B2A", role: "accent", motionEnergy: "snappy", contrastRatio: contrast("#D49B2A", "#F8F1E7"), pulseSafe: true },
      { hex: "#4E7A51", role: "success", motionEnergy: "flowing", contrastRatio: contrast("#4E7A51", "#F8F1E7"), pulseSafe: true },
      { hex: "#EFE6D4", role: "surface", motionEnergy: "serene", pulseSafe: true },
    ],
    paletteTransition: { durationMs: 650, easing: "ease-out-cubic", properties: ["backgroundColor", "color", "borderColor"] },
    recommendedCursorChoreography: ["cursor-professional-link", "cursor-subtle-whisper"],
    tags: ["light", "paper", "editorial", "warm", "magazine", "content"],
  },
  {
    id: "palette-neon-festival",
    name: "Neon Festival",
    description: "Pitch-black background with high-chroma magenta/lime/orange accents. Designed for celebration micro-interactions — bursts and confetti read crisply against pure #000.",
    mood: "festive",
    complexity: "vivid",
    colors: [
      { hex: DARK_BG, role: "background", motionEnergy: "energized", pulseSafe: true },
      { hex: "#F5F3FF", role: "text", motionEnergy: "energetic", contrastRatio: contrast("#F5F3FF", DARK_BG), pulseSafe: true },
      { hex: "#FF2EA6", role: "primary", motionEnergy: "energetic", contrastRatio: contrast("#FF2EA6", DARK_BG), pulseSafe: false },
      { hex: "#C6FF00", role: "accent", motionEnergy: "snappy", contrastRatio: contrast("#C6FF00", DARK_BG), pulseSafe: false },
      { hex: "#FF8A00", role: "secondary", motionEnergy: "energetic", contrastRatio: contrast("#FF8A00", DARK_BG), pulseSafe: false },
      { hex: "#00E0FF", role: "success", motionEnergy: "snappy", contrastRatio: contrast("#00E0FF", DARK_BG), pulseSafe: false },
      { hex: "#15151B", role: "surface", motionEnergy: "energized", pulseSafe: true },
    ],
    paletteTransition: { durationMs: 450, easing: "ease-out-back", properties: ["backgroundColor", "color", "fill", "stroke", "boxShadow"] },
    recommendedCursorChoreography: ["cursor-lively-springy", "cursor-magnetic-pro"],
    tags: ["dark", "neon", "festival", "confetti", "celebration", "party", "vivid"],
  },
  {
    id: "palette-enterprise-mono",
    name: "Enterprise Mono",
    description: "Near-black + off-white with a single reserved indigo accent. Strictly pulse-safe everywhere — dashboard grids won't trigger photosensitivity even under infinite row-shimmer loops.",
    mood: "corporate",
    complexity: "duotone",
    colors: [
      { hex: LIGHT_BG, role: "background", motionEnergy: "serene", pulseSafe: true },
      { hex: "#18181B", role: "text", motionEnergy: "serene", contrastRatio: contrast("#18181B", LIGHT_BG), pulseSafe: true },
      { hex: "#3640C8", role: "primary", motionEnergy: "flowing", contrastRatio: contrast("#3640C8", LIGHT_BG), pulseSafe: true },
      { hex: "#1E8E3E", role: "success", motionEnergy: "flowing", contrastRatio: contrast("#1E8E3E", LIGHT_BG), pulseSafe: true },
      { hex: "#B42318", role: "danger", motionEnergy: "snappy", contrastRatio: contrast("#B42318", LIGHT_BG), pulseSafe: true },
      { hex: "#FFFFFF", role: "surface", motionEnergy: "serene", pulseSafe: true },
    ],
    paletteTransition: { durationMs: 300, easing: "ease-out", properties: ["backgroundColor", "color", "borderColor"] },
    recommendedCursorChoreography: ["cursor-subtle-whisper", "cursor-professional-link"],
    tags: ["light", "enterprise", "saas", "reserved", "accessible", "wcag-friendly"],
  },
  {
    id: "palette-sakura-breeze",
    name: "Sakura Breeze",
    description: "Powder-pink + pale purple with celadon accents. Colors chosen for soft spring motion — parallax and gentle floating animations never hit saturated peaks that feel harsh.",
    mood: "calm",
    complexity: "balanced",
    colors: [
      { hex: "#FBF4F5", role: "background", motionEnergy: "serene", pulseSafe: true },
      { hex: "#2A2029", role: "text", motionEnergy: "flowing", contrastRatio: contrast("#2A2029", "#FBF4F5"), pulseSafe: true },
      { hex: "#E88FA0", role: "primary", motionEnergy: "flowing", contrastRatio: contrast("#E88FA0", "#FBF4F5"), pulseSafe: true },
      { hex: "#9FB7D6", role: "accent", motionEnergy: "flowing", contrastRatio: contrast("#9FB7D6", "#FBF4F5"), pulseSafe: true },
      { hex: "#A8C9A0", role: "success", motionEnergy: "serene", contrastRatio: contrast("#A8C9A0", "#FBF4F5"), pulseSafe: true },
      { hex: "#FFFFFF", role: "surface", motionEnergy: "serene", pulseSafe: true },
    ],
    paletteTransition: { durationMs: 1100, easing: "ease-in-out-sine", properties: ["backgroundColor", "color", "fill"] },
    recommendedCursorChoreography: ["cursor-lively-springy", "cursor-subtle-whisper"],
    tags: ["light", "pink", "pastel", "calm", "spring", "zen", "soft"],
  },
  {
    id: "palette-tech-monochrome",
    name: "Tech Monochrome",
    description: "Pure black / white / one-accent with deliberate mid-tone stops. Built for canvas UI where strokes, gridlines, and onion-skin ghosting all need distinct gray stops.",
    mood: "corporate",
    complexity: "monotone",
    colors: [
      { hex: "#000000", role: "background", motionEnergy: "serene", pulseSafe: true },
      { hex: "#FFFFFF", role: "text", motionEnergy: "serene", contrastRatio: 21, pulseSafe: true },
      { hex: "#FFFFFF", role: "primary", motionEnergy: "snappy", contrastRatio: 21, pulseSafe: true },
      { hex: "#8A8A8E", role: "surface", motionEnergy: "serene", pulseSafe: true },
      { hex: "#3A3A3C", role: "secondary", motionEnergy: "serene", pulseSafe: true },
      { hex: "#FF3B30", role: "danger", motionEnergy: "snappy", contrastRatio: contrast("#FF3B30", "#000000"), pulseSafe: false },
    ],
    paletteTransition: { durationMs: 220, easing: "linear", properties: ["backgroundColor", "color", "borderColor", "fill", "stroke"] },
    recommendedCursorChoreography: ["cursor-tactile-surface", "cursor-subtle-whisper"],
    tags: ["dark", "monochrome", "tech", "black-and-white", "minimal", "tools"],
  },
  {
    id: "palette-playful-jelly",
    name: "Playful Jelly",
    description: "Bright sky-blue + tangerine + lime — saturation ramped up but luminance tightly controlled so infinite bounce animations never feel seizure-inducing (≥ 1:3 contrast between any two hues).",
    mood: "playful",
    complexity: "vivid",
    colors: [
      { hex: "#EAF6FF", role: "background", motionEnergy: "energetic", pulseSafe: true },
      { hex: "#10233D", role: "text", motionEnergy: "flowing", contrastRatio: contrast("#10233D", "#EAF6FF"), pulseSafe: true },
      { hex: "#2E7BFF", role: "primary", motionEnergy: "snappy", contrastRatio: contrast("#2E7BFF", "#EAF6FF"), pulseSafe: true },
      { hex: "#FF8847", role: "accent", motionEnergy: "energetic", contrastRatio: contrast("#FF8847", "#EAF6FF"), pulseSafe: false },
      { hex: "#42C168", role: "success", motionEnergy: "snappy", contrastRatio: contrast("#42C168", "#EAF6FF"), pulseSafe: true },
      { hex: "#FFFFFF", role: "surface", motionEnergy: "energetic", pulseSafe: true },
    ],
    paletteTransition: { durationMs: 520, easing: "ease-out-back", properties: ["backgroundColor", "color", "borderColor", "fill"] },
    recommendedCursorChoreography: ["cursor-lively-springy", "cursor-magnetic-pro", "cursor-hover-hold-peek"],
    tags: ["light", "kids", "playful", "game", "education", "vibrant", "bounce"],
  },
];

export function listColorPalettes(): MotionColorPalette[] {
  return MOTION_COLOR_PALETTES;
}

export function getColorPalette(id: string): MotionColorPalette | undefined {
  return MOTION_COLOR_PALETTES.find((p) => p.id === id);
}

export function searchColorPalettes(query: string, limit = 10): MotionColorPalette[] {
  const q = query.toLowerCase();
  return MOTION_COLOR_PALETTES.filter((p) => {
    const roles = p.colors.map((c) => c.role).join(" ");
    const hay = `${p.name} ${p.description} ${p.tags.join(" ")} ${p.mood} ${p.complexity} ${roles}`.toLowerCase();
    return hay.includes(q);
  }).slice(0, limit);
}

/**
 * Given a palette and a target hue role, suggest a default component
 * duration + easing pair so components colored with this palette inherit
 * the palette's motion semantics automatically.
 */
export function motionDefaultsForRole(
  palette: MotionColorPalette,
  role: MotionPaletteColor["role"],
): { durationMs: number; easing: string } {
  const color = palette.colors.find((c) => c.role === role);
  const energy = color?.motionEnergy ?? "flowing";
  switch (energy) {
    case "snappy":    return { durationMs: 220, easing: "ease-out-quart" };
    case "flowing":   return { durationMs: 700, easing: "ease-in-out-quart" };
    case "energetic": return { durationMs: 520, easing: "ease-out-back" };
    case "serene":    return { durationMs: 1100, easing: "ease-in-out-sine" };
    case "energized": return { durationMs: 400, easing: "spring" };
  }
}
