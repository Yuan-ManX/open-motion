/**
 * Color Motion Palettes — curated, named color systems designed for motion.
 *
 * Each palette pairs a base + accent + ordered stops with a list of motion
 * pairs (from → to) that define how colors should transition when animated.
 * Motion pairs carry a mood label so the agent can choose transitions that
 * match the intended emotional register (e.g. "awaken" for sunrise, "cool"
 * for ambient drift).
 *
 * Distinct from colorHarmony.ts (which generates HSL-derived palettes from a
 * base color algorithmically): this file ships hand-curated, named palettes
 * with motion-specific transition semantics.
 *
 * Original to OpenMotion — bridges color theory with motion choreography by
 * encoding the emotional intent of each color transition.
 */

/** A from/to color pair with an emotional mood label. */
export interface ColorMotionPair {
  /** Starting color (hex). */
  from: string;
  /** Ending color (hex). */
  to: string;
  /** Emotional register of this transition. */
  mood: string;
}

/** A curated, named palette designed for motion. */
export interface ColorMotionPalette {
  /** Unique palette identifier. */
  id: string;
  /** Human-readable palette name. */
  name: string;
  /** Short description of the palette's emotional and visual character. */
  description: string;
  /** Base background color (hex). */
  base: string;
  /** Primary accent color (hex). */
  accent: string;
  /** Ordered color stops (hex) for gradients and staggers. */
  stops: string[];
  /** Curated from/to transitions for animated color changes. */
  motionPairs: ColorMotionPair[];
  /** Tags for search and filtering. */
  tags: string[];
}

export const COLOR_MOTION_PALETTES: ColorMotionPalette[] = [
  {
    id: "palette-sunrise-awaken",
    name: "Sunrise Awaken",
    description: "Warm dawn gradient — soft amber rising into bright coral. Use for optimistic entrances and morning onboarding.",
    base: "#1a0f0a",
    accent: "#ff7a59",
    stops: ["#1a0f0a", "#4a1c12", "#8a2c1f", "#c63d2a", "#ff7a59", "#ffb88a"],
    motionPairs: [
      { from: "#1a0f0a", to: "#4a1c12", mood: "stir" },
      { from: "#4a1c12", to: "#8a2c1f", mood: "warm" },
      { from: "#8a2c1f", to: "#c63d2a", mood: "awaken" },
      { from: "#c63d2a", to: "#ff7a59", mood: "rise" },
      { from: "#ff7a59", to: "#ffb88a", mood: "glow" },
    ],
    tags: ["warm", "sunrise", "dawn", "optimistic", "morning"],
  },
  {
    id: "palette-ocean-depth",
    name: "Ocean Depth",
    description: "Cool blue descent — surface teal diving into deep navy. Use for calm, focused dashboards and data visualizations.",
    base: "#0a1628",
    accent: "#4dd0e1",
    stops: ["#0a1628", "#0d2238", "#10304a", "#1a4a6b", "#3a7a9a", "#4dd0e1"],
    motionPairs: [
      { from: "#0a1628", to: "#0d2238", mood: "settle" },
      { from: "#0d2238", to: "#10304a", mood: "drift" },
      { from: "#10304a", to: "#1a4a6b", mood: "cool" },
      { from: "#1a4a6b", to: "#3a7a9a", mood: "rise" },
      { from: "#3a7a9a", to: "#4dd0e1", mood: "surface" },
    ],
    tags: ["cool", "ocean", "depth", "calm", "data"],
  },
  {
    id: "palette-neon-night",
    name: "Neon Night",
    description: "Cyberpunk neon on near-black — electric magenta and cyan over deep void. Use for futuristic and glitch aesthetics.",
    base: "#050510",
    accent: "#ff00aa",
    stops: ["#050510", "#0a0a1f", "#1a0a2f", "#2a0a4f", "#ff00aa", "#00ffff"],
    motionPairs: [
      { from: "#050510", to: "#0a0a1f", mood: "boot" },
      { from: "#0a0a1f", to: "#1a0a2f", mood: "charge" },
      { from: "#1a0a2f", to: "#2a0a4f", mood: "surge" },
      { from: "#2a0a4f", to: "#ff00aa", mood: "pulse" },
      { from: "#ff00aa", to: "#00ffff", mood: "glitch" },
    ],
    tags: ["neon", "cyberpunk", "night", "electric", "futuristic"],
  },
  {
    id: "palette-forest-canopy",
    name: "Forest Canopy",
    description: "Organic green gradient — mossy floor rising into sunlit canopy. Use for nature, sustainability, and wellness themes.",
    base: "#0a1a0e",
    accent: "#7cb342",
    stops: ["#0a1a0e", "#142a18", "#1e3a22", "#2e5a32", "#5a8a42", "#7cb342"],
    motionPairs: [
      { from: "#0a1a0e", to: "#142a18", mood: "root" },
      { from: "#142a18", to: "#1e3a22", mood: "grow" },
      { from: "#1e3a22", to: "#2e5a32", mood: "branch" },
      { from: "#2e5a32", to: "#5a8a42", mood: "leaf" },
      { from: "#5a8a42", to: "#7cb342", mood: "bloom" },
    ],
    tags: ["organic", "forest", "green", "nature", "wellness"],
  },
  {
    id: "palette-monochrome-ink",
    name: "Monochrome Ink",
    description: "Pure black-to-white ink wash — high-contrast minimalism with a single accent gray. Use for editorial and professional work.",
    base: "#000000",
    accent: "#ffffff",
    stops: ["#000000", "#1a1a1a", "#3a3a3a", "#6a6a6a", "#a0a0a0", "#ffffff"],
    motionPairs: [
      { from: "#000000", to: "#1a1a1a", mood: "whisper" },
      { from: "#1a1a1a", to: "#3a3a3a", mood: "soften" },
      { from: "#3a3a3a", to: "#6a6a6a", mood: "reveal" },
      { from: "#6a6a6a", to: "#a0a0a0", mood: "lift" },
      { from: "#a0a0a0", to: "#ffffff", mood: "clarify" },
    ],
    tags: ["monochrome", "ink", "minimal", "editorial", "professional"],
  },
  {
    id: "palette-sunset-bloom",
    name: "Sunset Bloom",
    description: "Romantic dusk gradient — peach, rose, and violet bloom. Use for lifestyle, beauty, and celebration moments.",
    base: "#1a0a1a",
    accent: "#ff6b9d",
    stops: ["#1a0a1a", "#3a0f2a", "#6a1a3a", "#aa3060", "#ff6b9d", "#ffa3c4"],
    motionPairs: [
      { from: "#1a0a1a", to: "#3a0f2a", mood: "dim" },
      { from: "#3a0f2a", to: "#6a1a3a", mood: "bloom" },
      { from: "#6a1a3a", to: "#aa3060", mood: "warm" },
      { from: "#aa3060", to: "#ff6b9d", mood: "blossom" },
      { from: "#ff6b9d", to: "#ffa3c4", mood: "glow" },
    ],
    tags: ["sunset", "romantic", "dusk", "lifestyle", "celebration"],
  },
  {
    id: "palette-arctic-aurora",
    name: "Arctic Aurora",
    description: "Polar aurora gradient — green and violet ribbons over glacial blue. Use for cinematic, dreamlike, and ambient scenes.",
    base: "#020812",
    accent: "#7affc8",
    stops: ["#020812", "#051a24", "#0a2a3a", "#1a4a5a", "#7affc8", "#9a7aff"],
    motionPairs: [
      { from: "#020812", to: "#051a24", mood: "drift" },
      { from: "#051a24", to: "#0a2a3a", mood: "cool" },
      { from: "#0a2a3a", to: "#1a4a5a", mood: "shimmer" },
      { from: "#1a4a5a", to: "#7affc8", mood: "aurora" },
      { from: "#7affc8", to: "#9a7aff", mood: "dream" },
    ],
    tags: ["arctic", "aurora", "polar", "dream", "cinematic"],
  },
  {
    id: "palette-ember-forge",
    name: "Ember Forge",
    description: "Molten metal gradient — coal black through orange ember to white-hot. Use for industrial, gaming, and energy themes.",
    base: "#0a0505",
    accent: "#ff7a00",
    stops: ["#0a0505", "#1f0a05", "#3a140a", "#7a2a0a", "#ff7a00", "#ffdda0"],
    motionPairs: [
      { from: "#0a0505", to: "#1f0a05", mood: "heat" },
      { from: "#1f0a05", to: "#3a140a", mood: "smolder" },
      { from: "#3a140a", to: "#7a2a0a", mood: "kindle" },
      { from: "#7a2a0a", to: "#ff7a00", mood: "forge" },
      { from: "#ff7a00", to: "#ffdda0", mood: "white-hot" },
    ],
    tags: ["ember", "forge", "molten", "industrial", "gaming"],
  },
  {
    id: "palette-lavender-mist",
    name: "Lavender Mist",
    description: "Soft pastel wash — lavender, pink, and powder blue. Use for friendly, approachable, and gentle interfaces.",
    base: "#1a1525",
    accent: "#c8a8ff",
    stops: ["#1a1525", "#2a2040", "#3f3060", "#6a5a9a", "#c8a8ff", "#ffd0f0"],
    motionPairs: [
      { from: "#1a1525", to: "#2a2040", mood: "soften" },
      { from: "#2a2040", to: "#3f3060", mood: "lift" },
      { from: "#3f3060", to: "#6a5a9a", mood: "bloom" },
      { from: "#6a5a9a", to: "#c8a8ff", mood: "mist" },
      { from: "#c8a8ff", to: "#ffd0f0", mood: "warm" },
    ],
    tags: ["pastel", "lavender", "soft", "friendly", "gentle"],
  },
  {
    id: "palette-citrus-burst",
    name: "Citrus Burst",
    description: "Energetic citrus gradient — lime, orange, and lemon zest. Use for playful, energetic, and food-related content.",
    base: "#1a1a05",
    accent: "#ffcc00",
    stops: ["#1a1a05", "#2a2a0a", "#3a3a0f", "#8aa020", "#ffcc00", "#ff8a00"],
    motionPairs: [
      { from: "#1a1a05", to: "#2a2a0a", mood: "warm" },
      { from: "#2a2a0a", to: "#3a3a0f", mood: "zest" },
      { from: "#3a3a0f", to: "#8aa020", mood: "lime" },
      { from: "#8aa020", to: "#ffcc00", mood: "lemon" },
      { from: "#ffcc00", to: "#ff8a00", mood: "orange" },
    ],
    tags: ["citrus", "energetic", "playful", "food", "vibrant"],
  },
];

/** List all color motion palettes, optionally filtered by tag. */
export function listColorMotionPalettes(tag?: string): ColorMotionPalette[] {
  if (!tag) return COLOR_MOTION_PALETTES;
  return COLOR_MOTION_PALETTES.filter((p) => p.tags.includes(tag));
}

/** Get a single palette by id. */
export function getColorMotionPalette(id: string): ColorMotionPalette | undefined {
  return COLOR_MOTION_PALETTES.find((p) => p.id === id);
}

/** Pick the motion pair whose mood best matches a target mood string. */
export function pickMotionPair(palette: ColorMotionPalette, mood: string): ColorMotionPair | undefined {
  const lower = mood.toLowerCase();
  return palette.motionPairs.find((p) => p.mood.toLowerCase() === lower)
    ?? palette.motionPairs.find((p) => p.mood.toLowerCase().includes(lower));
}

/** Build a CSS linear-gradient string from a palette's stops at a given angle. */
export function paletteToCssGradient(palette: ColorMotionPalette, angleDeg = 135): string {
  const stops = palette.stops.join(", ");
  return `linear-gradient(${angleDeg}deg, ${stops})`;
}
