/**
 * Scene Transition Library — page-level reveal and transition patterns.
 *
 * These are higher-level than per-component templates: each scene transition
 * specifies a pair of exit+entrance animations that should be applied
 * together (to outgoing and incoming views) for a cohesive cut.
 */

export type SceneTransitionCategory = "wipe" | "fade" | "morph" | "parallax" | "reveal" | "cinematic";

export interface SceneTransition {
  id: string;
  name: string;
  category: SceneTransitionCategory;
  description: string;
  /** Duration for the whole transition (exit + entrance overlap handled by staggerDelayMs) */
  totalDurationMs: number;
  /** How much exit and entrance overlap — 0 = sequential, 1 = simultaneous */
  overlap: number;
  /** Exit spec for the leaving view */
  exit: {
    easing: string;
    durationMs: number;
    keyframes: Array<{ offset: number; properties: Record<string, unknown> }>;
  };
  /** Entrance spec for the arriving view */
  entrance: {
    easing: string;
    durationMs: number;
    keyframes: Array<{ offset: number; properties: Record<string, unknown> }>;
  };
  /** Suggested delay between exit and entrance (computed from overlap — for reference) */
  staggerDelayMs: number;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** List all scene transitions with optional category filter. */
export function listSceneTransitions(category?: SceneTransitionCategory): SceneTransition[] {
  if (!category) return SCENE_TRANSITIONS.slice();
  return SCENE_TRANSITIONS.filter((t) => t.category === category);
}

/** Fetch a single scene transition by its id. */
export function getSceneTransition(id: string): SceneTransition | null {
  return SCENE_TRANSITIONS.find((t) => t.id === id) ?? null;
}

/**
 * Pick the best scene transition via free-text keyword matching. Uses
 * simple keyword-to-tag matching with a few common synonyms so prompts
 * like "cinematic fade" reliably land on the iris transition.
 */
export function matchSceneTransition(query: string): SceneTransition | null {
  const q = query.toLowerCase();
  if (!q.trim()) return null;
  let best: { t: SceneTransition; score: number } | null = null;
  const terms = q.split(/\s+/).filter(Boolean);
  for (const t of SCENE_TRANSITIONS) {
    let score = 0;
    const haystack = [t.name.toLowerCase(), t.description.toLowerCase(), ...t.tags.map((x) => x.toLowerCase()), t.category.toLowerCase()].join(" ");
    for (const term of terms) {
      if (haystack.includes(term)) score += 10;
    }
    if (score === 0) continue;
    if (!best || score > best.score) best = { t, score };
  }
  return best?.t ?? null;
}

export const SCENE_TRANSITIONS: SceneTransition[] = [
  {
    id: "scene-iris",
    name: "Iris Cinematic Cut",
    category: "cinematic",
    description: "Circular iris closes over old scene, then opens to reveal new one. Inspired by classic film scene transitions with gentle easing.",
    totalDurationMs: 900,
    overlap: 0.2,
    exit: {
      easing: "ease-in-out-cubic",
      durationMs: 450,
      keyframes: [
        { offset: 0, properties: { clipPath: "circle(150% at 50% 50%)" } },
        { offset: 100, properties: { clipPath: "circle(0% at 50% 50%)" } },
      ],
    },
    entrance: {
      easing: "ease-out-quart",
      durationMs: 450,
      keyframes: [
        { offset: 0, properties: { clipPath: "circle(0% at 50% 50%)", opacity: 0.8 } },
        { offset: 100, properties: { clipPath: "circle(150% at 50% 50%)", opacity: 1 } },
      ],
    },
    staggerDelayMs: 360,
    tags: ["cinematic", "film", "iris", "reveal", "dramatic"],
  },
  {
    id: "scene-diagonal-wipe",
    name: "Diagonal Sweep",
    category: "wipe",
    description: "A 15-degree diagonal sweeps across the viewport, revealing the next scene behind it. Smooth and brand-forward for product tours.",
    totalDurationMs: 700,
    overlap: 0.5,
    exit: {
      easing: "ease-in-out-quad",
      durationMs: 500,
      keyframes: [
        { offset: 0, properties: { clipPath: "polygon(0 0, 150% 0, 150% 150%, 0 150%)" } },
        { offset: 100, properties: { clipPath: "polygon(120% 0, 150% 0, 150% 150%, 120% 150%)" } },
      ],
    },
    entrance: {
      easing: "ease-in-out-quad",
      durationMs: 500,
      keyframes: [
        { offset: 0, properties: { clipPath: "polygon(-20% 0, 0 0, 0 150%, -20% 150%)" } },
        { offset: 100, properties: { clipPath: "polygon(-50% 0, 150% 0, 150% 150%, -50% 150%)" } },
      ],
    },
    staggerDelayMs: 250,
    tags: ["wipe", "sweep", "diagonal", "product", "clean"],
  },
  {
    id: "scene-stack-pop",
    name: "Stack Pop Reveal",
    category: "reveal",
    description: "Old scene lifts slightly, fades out, and reveals new scene beneath it. Good for drill-down navigation flows.",
    totalDurationMs: 650,
    overlap: 0.4,
    exit: {
      easing: "ease-in-cubic",
      durationMs: 400,
      keyframes: [
        { offset: 0, properties: { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0)" } },
        { offset: 100, properties: { opacity: 0, transform: "translateY(-24px) scale(1.03)", filter: "blur(6px)" } },
      ],
    },
    entrance: {
      easing: "ease-out-quart",
      durationMs: 450,
      keyframes: [
        { offset: 0, properties: { opacity: 0, transform: "translateY(8px) scale(0.97)" } },
        { offset: 100, properties: { opacity: 1, transform: "translateY(0) scale(1)" } },
      ],
    },
    staggerDelayMs: 240,
    tags: ["reveal", "stack", "drill-down", "navigation", "soft"],
  },
  {
    id: "scene-blur-dissolve",
    name: "Blur Dissolve",
    category: "fade",
    description: "Soft crossfade with defocus on exit and refocus on entrance. Ideal for ambient, calm brand experiences.",
    totalDurationMs: 800,
    overlap: 0.7,
    exit: {
      easing: "ease-out",
      durationMs: 600,
      keyframes: [
        { offset: 0, properties: { opacity: 1, filter: "blur(0) saturate(1)" } },
        { offset: 100, properties: { opacity: 0, filter: "blur(12px) saturate(0.4)" } },
      ],
    },
    entrance: {
      easing: "ease-out",
      durationMs: 600,
      keyframes: [
        { offset: 0, properties: { opacity: 0, filter: "blur(16px) saturate(0.5)" } },
        { offset: 100, properties: { opacity: 1, filter: "blur(0) saturate(1)" } },
      ],
    },
    staggerDelayMs: 180,
    tags: ["fade", "dissolve", "blur", "calm", "ambient"],
  },
  {
    id: "scene-parallax-push",
    name: "Parallax Push",
    category: "parallax",
    description: "Multi-layered horizontal push with depth — foreground layers travel further than background layers for a 3D spatial feel.",
    totalDurationMs: 750,
    overlap: 0.6,
    exit: {
      easing: "ease-in-out-quart",
      durationMs: 600,
      keyframes: [
        { offset: 0, properties: { opacity: 1, transform: "translateX(0)" } },
        { offset: 100, properties: { opacity: 0, transform: "translateX(-80%)" } },
      ],
    },
    entrance: {
      easing: "ease-out-quart",
      durationMs: 600,
      keyframes: [
        { offset: 0, properties: { opacity: 0, transform: "translateX(60%) scale(0.95)" } },
        { offset: 100, properties: { opacity: 1, transform: "translateX(0) scale(1)" } },
      ],
    },
    staggerDelayMs: 240,
    tags: ["parallax", "push", "slide", "depth", "3d", "navigation"],
  },
  {
    id: "scene-grid-reveal",
    name: "Grid Tile Reveal",
    category: "reveal",
    description: "View is divided into a 4×4 grid whose tiles reveal the next scene in diagonal wave order. Great for dashboards and product feature spots.",
    totalDurationMs: 850,
    overlap: 0.8,
    exit: {
      easing: "ease-out-cubic",
      durationMs: 600,
      keyframes: [
        { offset: 0, properties: { opacity: 1, transform: "scale(1)" } },
        { offset: 100, properties: { opacity: 0.3, transform: "scale(0.98)" } },
      ],
    },
    entrance: {
      easing: "ease-out-back",
      durationMs: 700,
      keyframes: [
        { offset: 0, properties: { opacity: 0, transform: "scale(0.94)", filter: "contrast(0.3)" } },
        { offset: 100, properties: { opacity: 1, transform: "scale(1)", filter: "contrast(1)" } },
      ],
    },
    staggerDelayMs: 120,
    tags: ["grid", "tile", "reveal", "dashboard", "product", "stagger"],
  },
];

export function searchSceneTransitions(query: string, limit = 10): SceneTransition[] {
  const q = query.toLowerCase();
  return SCENE_TRANSITIONS.filter((t) => {
    const hay = `${t.name} ${t.description} ${t.tags.join(" ")} ${t.category}`.toLowerCase();
    return hay.includes(q);
  }).slice(0, limit);
}
