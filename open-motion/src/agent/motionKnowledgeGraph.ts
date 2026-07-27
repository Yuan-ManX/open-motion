/**
 * Motion Knowledge Graph — a semantic graph of motion concepts, relationships,
 * and patterns that lets the Agent make intelligent recommendations and discover
 * connections between motion ideas.
 *
 * This is an original AI-native module. It lifts the agent's understanding of
 * motion from isolated presets to a connected knowledge base where every
 * concept — easing, timing, transform, staging, narrative, emotion, physics,
 * accessibility, performance, style, pattern, principle, technique — links to
 * its neighbours through typed relationships (enables, complements, conflicts,
 * requires, specializes, alternative, combines, transitions, contrasts,
 * evolves).
 *
 * Core capabilities:
 * 1. Build a comprehensive knowledge graph of 60+ motion concepts.
 * 2. Query and traverse concepts by id, keyword, or category.
 * 3. Find the shortest path between any two concepts (BFS).
 * 4. Suggest non-obvious connections between a set of concepts.
 * 5. Analyze graph structure — centrality, clusters, bridges, density.
 * 6. Recommend the next concept to explore based on what has been used,
 *    weighing graph distance, relationship strength, and centrality.
 *
 * Rule-based — no LLM round-trip required.
 */

import { EASING_PRESETS, easingPreset, easingSpring, type Easing } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Graph data structures
// ---------------------------------------------------------------------------

export type MotionConceptCategory =
  | "easing"
  | "timing"
  | "transform"
  | "staging"
  | "narrative"
  | "emotion"
  | "physics"
  | "accessibility"
  | "performance"
  | "style"
  | "pattern"
  | "principle"
  | "technique";

export type MotionRelationship =
  | "enables"
  | "complements"
  | "conflicts"
  | "requires"
  | "specializes"
  | "alternative"
  | "combines"
  | "transitions"
  | "contrasts"
  | "evolves";

export interface MotionConceptNode {
  id: string;
  label: string;
  category: MotionConceptCategory;
  description: string;
  tags: string[];
  relatedToolNames: string[];
  metadata: Record<string, unknown>;
}

export interface MotionConceptEdge {
  source: string;
  target: string;
  relationship: MotionRelationship;
  strength: number; // 0-1
  description: string;
}

export interface MotionKnowledgeGraph {
  nodes: MotionConceptNode[];
  edges: MotionConceptEdge[];
}

export interface GraphSuggestion {
  sourceId: string;
  targetId: string;
  relationship: MotionRelationship;
  reason: string;
  confidence: number; // 0-1
}

export interface GraphAnalysis {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  centralNodes: Array<{ conceptId: string; centrality: number }>;
  clusters: Array<{ id: number; conceptIds: string[] }>;
  bridges: string[];
  connectedComponents: number;
  isolatedNodes: string[];
}

// ---------------------------------------------------------------------------
// Concept library
// ---------------------------------------------------------------------------

const CONCEPTS: MotionConceptNode[] = [
  // --- Easing ---
  {
    id: "linear",
    label: "Linear",
    category: "easing",
    description: "Constant velocity with no acceleration or deceleration. Mechanical and neutral.",
    tags: ["constant", "uniform", "mechanical"],
    relatedToolNames: [],
    metadata: { sampleEasingName: "linear" },
  },
  {
    id: "smooth",
    label: "Smooth",
    category: "easing",
    description: "Gentle acceleration and deceleration that feels natural and unobtrusive.",
    tags: ["natural", "gentle", "soft"],
    relatedToolNames: ["fade", "scrollReveal"],
    metadata: { sampleEasingName: "smooth" },
  },
  {
    id: "snappy",
    label: "Snappy",
    category: "easing",
    description: "Quick start that settles fast. Precise and responsive without overshoot.",
    tags: ["quick", "precise", "responsive"],
    relatedToolNames: ["hoverLift", "gestureTap"],
    metadata: { sampleEasingName: "snappy" },
  },
  {
    id: "bounce",
    label: "Bounce",
    category: "easing",
    description: "Overshoots the target then settles in discrete steps like a bouncing ball.",
    tags: ["playful", "overshoot", "energetic"],
    relatedToolNames: ["bounce"],
    metadata: { sampleEasingName: "bounce" },
  },
  {
    id: "elastic",
    label: "Elastic",
    category: "easing",
    description: "Springy overshoot with damped oscillation around the target value.",
    tags: ["springy", "oscillate", "lively"],
    relatedToolNames: ["elasticScale", "elasticCollapse"],
    metadata: { sampleEasingName: "elastic" },
  },
  {
    id: "spring",
    label: "Spring",
    category: "easing",
    description: "Physics-based spring response driven by stiffness, damping, and mass.",
    tags: ["physics", "dynamic", "responsive"],
    relatedToolNames: ["spring"],
    metadata: { easingType: "spring", stiffness: 170, damping: 26 },
  },
  {
    id: "overshoot",
    label: "Overshoot",
    category: "easing",
    description: "Exceeds the target value momentarily before settling back.",
    tags: ["exceed", "settle", "emphasis"],
    relatedToolNames: ["hoverLift"],
    metadata: { sampleEasingName: "back" },
  },
  {
    id: "anticipate",
    label: "Anticipate",
    category: "easing",
    description: "Winds up in the opposite direction before the main motion begins.",
    tags: ["wind-up", "prepare", "lead-in"],
    relatedToolNames: [],
    metadata: { sampleEasingName: "ease-in" },
  },

  // --- Timing ---
  {
    id: "stagger",
    label: "Stagger",
    category: "timing",
    description: "Offsets the start time of each element by a fixed interval for a cascading reveal.",
    tags: ["offset", "delay", "sequence"],
    relatedToolNames: ["scrollReveal", "splitText"],
    metadata: { typicalMs: 80 },
  },
  {
    id: "cascade",
    label: "Cascade",
    category: "timing",
    description: "Waterfall-style sequential reveal where each element begins before the previous ends.",
    tags: ["waterfall", "overlap", "flow"],
    relatedToolNames: ["scrollReveal"],
    metadata: { typicalMs: 120 },
  },
  {
    id: "sequence",
    label: "Sequence",
    category: "timing",
    description: "Ordered chain of motions that play one after another.",
    tags: ["ordered", "chain", "series"],
    relatedToolNames: ["pageTransition"],
    metadata: { typicalMs: 400 },
  },
  {
    id: "rhythm",
    label: "Rhythm",
    category: "timing",
    description: "Patterned timing with a musical feel, creating a beat across elements.",
    tags: ["beat", "musical", "pattern"],
    relatedToolNames: ["marquee", "pulse"],
    metadata: { typicalMs: 200 },
  },
  {
    id: "tempo",
    label: "Tempo",
    category: "timing",
    description: "Overall pace of a composition — how fast or slow the motion feels as a whole.",
    tags: ["pace", "speed", "global"],
    relatedToolNames: [],
    metadata: { typicalMs: 0 },
  },
  {
    id: "duration",
    label: "Duration",
    category: "timing",
    description: "Length of a single motion from start to finish, measured in milliseconds.",
    tags: ["length", "time", "ms"],
    relatedToolNames: [],
    metadata: { typicalMs: 800 },
  },

  // --- Transform ---
  {
    id: "translate",
    label: "Translate",
    category: "transform",
    description: "Moves an element along the x, y, or z axis without changing its shape.",
    tags: ["move", "position", "pan"],
    relatedToolNames: ["slide", "slideOut"],
    metadata: { properties: ["translateX", "translateY", "translateZ"] },
  },
  {
    id: "scale",
    label: "Scale",
    category: "transform",
    description: "Resizes an element uniformly or per-axis to convey weight and emphasis.",
    tags: ["resize", "grow", "shrink"],
    relatedToolNames: ["scale", "elasticScale"],
    metadata: { properties: ["scale", "scaleX", "scaleY"] },
  },
  {
    id: "rotate",
    label: "Rotate",
    category: "transform",
    description: "Spins an element around an axis to add energy and directional flow.",
    tags: ["spin", "turn", "rotate"],
    relatedToolNames: ["rotate", "spin", "orbit"],
    metadata: { properties: ["rotate", "rotateX", "rotateY"] },
  },
  {
    id: "skew",
    label: "Skew",
    category: "transform",
    description: "Shears an element along the x or y axis for a slanted, dynamic look.",
    tags: ["shear", "slant", "distort"],
    relatedToolNames: [],
    metadata: { properties: ["skewX", "skewY"] },
  },
  {
    id: "3d-transform",
    label: "3D Transform",
    category: "transform",
    description: "Perspective transforms that manipulate elements in three-dimensional space.",
    tags: ["perspective", "depth", "3d"],
    relatedToolNames: ["reveal3d", "flipCard", "origamiFold"],
    metadata: { properties: ["rotateX", "rotateY", "translateZ", "perspective"] },
  },
  {
    id: "morph",
    label: "Morph",
    category: "transform",
    description: "Smoothly transitions an element's shape from one form to another.",
    tags: ["shape", "transform", "blend"],
    relatedToolNames: ["morph", "liquidMorph"],
    metadata: { properties: ["clip-path", "border-radius"] },
  },

  // --- Staging ---
  {
    id: "focal-point",
    label: "Focal Point",
    category: "staging",
    description: "Directs viewer attention to a single dominant element through contrast and motion.",
    tags: ["attention", "focus", "hierarchy"],
    relatedToolNames: [],
    metadata: { technique: "contrast-isolation" },
  },
  {
    id: "layering",
    label: "Layering",
    category: "staging",
    description: "Overlaps elements at different depths to build visual hierarchy and richness.",
    tags: ["overlap", "depth", "hierarchy"],
    relatedToolNames: ["depthCard"],
    metadata: { layerCount: 3 },
  },
  {
    id: "depth",
    label: "Depth",
    category: "staging",
    description: "Simulates distance through scale, blur, and parallax to create a sense of space.",
    tags: ["distance", "perspective", "space"],
    relatedToolNames: ["depthCard", "reveal3d"],
    metadata: { technique: "scale-blur" },
  },
  {
    id: "parallax",
    label: "Parallax",
    category: "staging",
    description: "Differential movement of depth layers that creates an illusion of three dimensions.",
    tags: ["scroll", "depth", "illusion"],
    relatedToolNames: ["parallax", "mouseParallax"],
    metadata: { layerCount: 3 },
  },
  {
    id: "z-order",
    label: "Z-Order",
    category: "staging",
    description: "Stacking order along the z-axis that controls which elements appear in front.",
    tags: ["stack", "order", "occlusion"],
    relatedToolNames: [],
    metadata: { property: "z-index" },
  },

  // --- Narrative ---
  {
    id: "hero-journey",
    label: "Hero Journey",
    category: "narrative",
    description: "Full narrative arc from departure through challenge to return and transformation.",
    tags: ["arc", "story", "transformation"],
    relatedToolNames: ["logoReveal"],
    metadata: { stages: 3 },
  },
  {
    id: "build-up",
    label: "Build-Up",
    category: "narrative",
    description: "Gradual increase in intensity that prepares the viewer for a peak moment.",
    tags: ["escalate", "prepare", "rise"],
    relatedToolNames: [],
    metadata: { direction: "rising" },
  },
  {
    id: "climax",
    label: "Climax",
    category: "narrative",
    description: "Peak moment of maximum intensity where the composition reaches its highest energy.",
    tags: ["peak", "apex", "intensity"],
    relatedToolNames: ["confetti", "particleBurst"],
    metadata: { direction: "peak" },
  },
  {
    id: "resolution",
    label: "Resolution",
    category: "narrative",
    description: "Settling phase after the climax where energy decreases and the composition rests.",
    tags: ["settle", "decline", "rest"],
    relatedToolNames: ["fadeOut", "dissolveOut"],
    metadata: { direction: "falling" },
  },
  {
    id: "call-to-action",
    label: "Call to Action",
    category: "narrative",
    description: "Motion that prompts the viewer to take a specific action at the narrative peak.",
    tags: ["prompt", "convert", "direct"],
    relatedToolNames: ["notification", "progressBar"],
    metadata: { goal: "conversion" },
  },

  // --- Emotion ---
  {
    id: "trust",
    label: "Trust",
    category: "emotion",
    description: "Stability and reliability conveyed through slow, smooth, predictable motion.",
    tags: ["stable", "reliable", "secure"],
    relatedToolNames: [],
    metadata: { valence: 0.6, arousal: 0.3 },
  },
  {
    id: "urgency",
    label: "Urgency",
    category: "emotion",
    description: "Immediate attention and action driven by fast, sharp, high-contrast motion.",
    tags: ["fast", "alert", "immediate"],
    relatedToolNames: ["notification"],
    metadata: { valence: -0.2, arousal: 0.95 },
  },
  {
    id: "joy",
    label: "Joy",
    category: "emotion",
    description: "Happiness and delight expressed through bouncy, colorful, energetic motion.",
    tags: ["happy", "delight", "cheerful"],
    relatedToolNames: ["confetti", "particleBurst"],
    metadata: { valence: 0.9, arousal: 0.8 },
  },
  {
    id: "calm",
    label: "Calm",
    category: "emotion",
    description: "Peace and relaxation induced by slow, gentle, low-energy motion.",
    tags: ["peaceful", "gentle", "serene"],
    relatedToolNames: ["breathingLight"],
    metadata: { valence: 0.5, arousal: 0.15 },
  },
  {
    id: "excitement",
    label: "Excitement",
    category: "emotion",
    description: "High energy and anticipation created by fast, varied, overshooting motion.",
    tags: ["energetic", "thrill", "lively"],
    relatedToolNames: ["neonPulse", "chromaticPulse"],
    metadata: { valence: 0.7, arousal: 0.85 },
  },
  {
    id: "luxury",
    label: "Luxury",
    category: "emotion",
    description: "Exclusivity and refinement communicated through slow, deliberate, elegant motion.",
    tags: ["premium", "elegant", "refined"],
    relatedToolNames: ["shimmer", "gradientShift"],
    metadata: { valence: 0.6, arousal: 0.2 },
  },
  {
    id: "playful",
    label: "Playful",
    category: "emotion",
    description: "Fun and lighthearted energy expressed through bouncy, varied, colorful motion.",
    tags: ["fun", "lighthearted", "bouncy"],
    relatedToolNames: ["bounce", "elasticScale"],
    metadata: { valence: 0.85, arousal: 0.8 },
  },

  // --- Physics ---
  {
    id: "gravity",
    label: "Gravity",
    category: "physics",
    description: "Downward acceleration force that pulls elements toward the ground plane.",
    tags: ["acceleration", "downward", "fall"],
    relatedToolNames: ["gravityDrop", "collapseDown"],
    metadata: { unit: "m/s^2", value: 9.8 },
  },
  {
    id: "spring-force",
    label: "Spring Force",
    category: "physics",
    description: "Restorative force proportional to displacement that drives spring-based motion.",
    tags: ["restorative", "hooke", "displacement"],
    relatedToolNames: ["spring"],
    metadata: { law: "hooke", unit: "N/m" },
  },
  {
    id: "friction",
    label: "Friction",
    category: "physics",
    description: "Resistance that reduces velocity over time, causing motion to settle and stop.",
    tags: ["resistance", "damping", "drag"],
    relatedToolNames: [],
    metadata: { unit: "N", opposes: "motion" },
  },
  {
    id: "momentum",
    label: "Momentum",
    category: "physics",
    description: "Tendency of a moving element to continue in its direction unless acted upon.",
    tags: ["inertia", "continue", "carry"],
    relatedToolNames: ["gestureSwipe"],
    metadata: { unit: "kg*m/s" },
  },
  {
    id: "inertia",
    label: "Inertia",
    category: "physics",
    description: "Resistance to any change in motion state — the reason objects need force to start or stop.",
    tags: ["resist", "mass", "rest"],
    relatedToolNames: [],
    metadata: { unit: "kg" },
  },

  // --- Accessibility ---
  {
    id: "reduced-motion",
    label: "Reduced Motion",
    category: "accessibility",
    description: "Minimizes or removes motion for users with vestibular sensitivity via the prefers-reduced-motion query.",
    tags: ["vestibular", "sensitivity", "media-query"],
    relatedToolNames: [],
    metadata: { mediaQuery: "prefers-reduced-motion" },
  },
  {
    id: "contrast",
    label: "Contrast",
    category: "accessibility",
    description: "Sufficient luminance difference between foreground and background for legibility.",
    tags: ["luminance", "legibility", "wcag"],
    relatedToolNames: [],
    metadata: { wcag: "2.1", minRatio: 4.5 },
  },
  {
    id: "duration-limits",
    label: "Duration Limits",
    category: "accessibility",
    description: "Caps animation length to avoid discomfort and ensure content is perceivable.",
    tags: ["cap", "limit", "comfort"],
    relatedToolNames: [],
    metadata: { maxMs: 5000 },
  },
  {
    id: "vestibular-safety",
    label: "Vestibular Safety",
    category: "accessibility",
    description: "Avoids motion patterns that trigger motion sickness or vertigo in sensitive users.",
    tags: ["vertigo", "sickness", "safe"],
    relatedToolNames: [],
    metadata: { avoid: ["parallax", "spin", "large-scale"] },
  },

  // --- Performance ---
  {
    id: "gpu-acceleration",
    label: "GPU Acceleration",
    category: "performance",
    description: "Offloads compositing work to the GPU for smoother, jank-free animation.",
    tags: ["gpu", "hardware", "smooth"],
    relatedToolNames: [],
    metadata: { thread: "compositor" },
  },
  {
    id: "will-change",
    label: "Will-Change",
    category: "performance",
    description: "Hints the browser to prepare for upcoming changes by promoting elements to layers early.",
    tags: ["hint", "layer", "prepare"],
    relatedToolNames: [],
    metadata: { property: "will-change" },
  },
  {
    id: "compositor",
    label: "Compositor",
    category: "performance",
    description: "Runs transforms and opacity on a dedicated thread, separate from the main thread.",
    tags: ["thread", "layer", "off-main"],
    relatedToolNames: [],
    metadata: { thread: "compositor", properties: ["transform", "opacity"] },
  },
  {
    id: "paint-avoidance",
    label: "Paint Avoidance",
    category: "performance",
    description: "Avoids triggering layout and paint by sticking to compositor-friendly properties.",
    tags: ["paint", "layout", "avoid"],
    relatedToolNames: [],
    metadata: { avoid: ["width", "height", "top", "left"] },
  },

  // --- Style ---
  {
    id: "minimalist",
    label: "Minimalist",
    category: "style",
    description: "Fewer elements and restrained motion that lets content dominate over decoration.",
    tags: ["restrained", "clean", "simple"],
    relatedToolNames: ["fade"],
    metadata: { density: "low" },
  },
  {
    id: "maximalist",
    label: "Maximalist",
    category: "style",
    description: "Rich, dense, varied motion that fills the canvas with energy and detail.",
    tags: ["dense", "rich", "varied"],
    relatedToolNames: ["particleBurst", "quantumField"],
    metadata: { density: "high" },
  },
  {
    id: "organic",
    label: "Organic",
    category: "style",
    description: "Natural, flowing, slightly irregular motion that mimics living things.",
    tags: ["natural", "flowing", "alive"],
    relatedToolNames: ["liquidWave", "liquidMorph", "tidalFlow"],
    metadata: { quality: "flowing" },
  },
  {
    id: "mechanical",
    label: "Mechanical",
    category: "style",
    description: "Precise, uniform, industrial motion that feels engineered and repeatable.",
    tags: ["precise", "uniform", "industrial"],
    relatedToolNames: ["typewriter", "progressBar"],
    metadata: { quality: "precise" },
  },
  {
    id: "cinematic",
    label: "Cinematic",
    category: "style",
    description: "Film-like, dramatic, staged motion with depth, parallax, and deliberate pacing.",
    tags: ["film", "dramatic", "staged"],
    relatedToolNames: ["logoReveal", "pageTransition"],
    metadata: { quality: "dramatic" },
  },

  // --- Pattern ---
  {
    id: "loop",
    label: "Loop",
    category: "pattern",
    description: "Repeats a motion cycle indefinitely or a fixed number of times.",
    tags: ["repeat", "cycle", "iterate"],
    relatedToolNames: ["orbit", "marquee", "breathingLight"],
    metadata: { iteration: "infinite" },
  },
  {
    id: "mirror",
    label: "Mirror",
    category: "pattern",
    description: "Symmetric reflection of motion across an axis for balanced, paired effects.",
    tags: ["symmetric", "reflect", "balance"],
    relatedToolNames: [],
    metadata: { axis: "center" },
  },
  {
    id: "echo",
    label: "Echo",
    category: "pattern",
    description: "Delayed repetition of a motion that fades with each iteration.",
    tags: ["delayed", "repeat", "fade"],
    relatedToolNames: ["ripple", "magneticRipple"],
    metadata: { decay: 0.5 },
  },
  {
    id: "offset",
    label: "Offset",
    category: "pattern",
    description: "Parallel motion with a phase shift between elements for a flowing wave effect.",
    tags: ["phase", "shift", "parallel"],
    relatedToolNames: ["wave", "spectrumWave"],
    metadata: { phaseShift: 0.25 },
  },
  {
    id: "wave",
    label: "Wave",
    category: "pattern",
    description: "Sinusoidal motion that propagates across elements like a traveling wave.",
    tags: ["sinusoidal", "propagate", "travel"],
    relatedToolNames: ["wave", "liquidWave", "spectrumWave", "tidalFlow"],
    metadata: { function: "sine" },
  },

  // --- Principle ---
  {
    id: "squash-stretch",
    label: "Squash and Stretch",
    category: "principle",
    description: "Deforms an element along its motion axis to convey weight, flexibility, and impact.",
    tags: ["deform", "weight", "flexibility"],
    relatedToolNames: ["squashStretch"],
    metadata: { disney: true },
  },
  {
    id: "anticipation",
    label: "Anticipation",
    category: "principle",
    description: "Prepares the viewer for an upcoming action with a small opposing motion first.",
    tags: ["prepare", "wind-up", "lead"],
    relatedToolNames: [],
    metadata: { disney: true },
  },
  {
    id: "follow-through",
    label: "Follow-Through",
    category: "principle",
    description: "Parts of an object continue moving after the main body stops, conveying momentum.",
    tags: ["continue", "residual", "settle"],
    relatedToolNames: [],
    metadata: { disney: true },
  },
  {
    id: "arcs",
    label: "Arcs",
    category: "principle",
    description: "Natural curved motion paths that feel more organic than straight lines.",
    tags: ["curve", "organic", "path"],
    relatedToolNames: ["orbit"],
    metadata: { disney: true },
  },
  {
    id: "timing-principle",
    label: "Timing",
    category: "principle",
    description: "Pacing that gives meaning to action — slow feels deliberate, fast feels urgent.",
    tags: ["pacing", "meaning", "speed"],
    relatedToolNames: [],
    metadata: { disney: true },
  },

  // --- Technique ---
  {
    id: "keyframe-interpolation",
    label: "Keyframe Interpolation",
    category: "technique",
    description: "Animates between defined keyframes by interpolating property values over time.",
    tags: ["keyframe", "interpolate", "animate"],
    relatedToolNames: [],
    metadata: { method: "interpolation" },
  },
  {
    id: "expression",
    label: "Expression",
    category: "technique",
    description: "Drives motion via mathematical formulas rather than fixed keyframes.",
    tags: ["formula", "function", "calculate"],
    relatedToolNames: [],
    metadata: { method: "formula" },
  },
  {
    id: "data-driven",
    label: "Data-Driven",
    category: "technique",
    description: "Animates based on external data values, binding motion parameters to live inputs.",
    tags: ["data", "live", "bind"],
    relatedToolNames: ["counter", "dataStream"],
    metadata: { method: "data-binding" },
  },
  {
    id: "procedural",
    label: "Procedural",
    category: "technique",
    description: "Generates motion via algorithms rather than hand-authored keyframes.",
    tags: ["algorithm", "generate", "code"],
    relatedToolNames: ["quantumField", "magneticField"],
    metadata: { method: "algorithm" },
  },
];

// ---------------------------------------------------------------------------
// Edge library
// ---------------------------------------------------------------------------

const EDGES: MotionConceptEdge[] = [
  // Easing family relationships
  { source: "elastic", target: "overshoot", relationship: "specializes", strength: 0.85, description: "Elastic is a specific form of overshoot with damped oscillation." },
  { source: "bounce", target: "overshoot", relationship: "specializes", strength: 0.8, description: "Bounce overshoots the target then settles in discrete steps." },
  { source: "spring", target: "elastic", relationship: "alternative", strength: 0.7, description: "Both produce springy motion; spring is physics-based while elastic is a preset curve." },
  { source: "smooth", target: "linear", relationship: "alternative", strength: 0.6, description: "Smooth adds acceleration where linear stays at constant velocity." },
  { source: "snappy", target: "smooth", relationship: "alternative", strength: 0.65, description: "Snappy is faster and sharper than smooth." },
  { source: "anticipate", target: "overshoot", relationship: "combines", strength: 0.7, description: "Anticipation winds up before the overshoot carries the motion forward." },
  { source: "overshoot", target: "spring", relationship: "requires", strength: 0.75, description: "True overshoot relies on spring-like restoring physics to settle." },
  { source: "bounce", target: "anticipate", relationship: "combines", strength: 0.6, description: "Bounce frequently pairs with a wind-up to feel grounded." },

  // Easing enables emotion
  { source: "bounce", target: "joy", relationship: "enables", strength: 0.8, description: "Bouncy motion conveys happiness and delight." },
  { source: "bounce", target: "playful", relationship: "enables", strength: 0.85, description: "Bounce is the signature easing of playful interfaces." },
  { source: "smooth", target: "calm", relationship: "enables", strength: 0.8, description: "Smooth motion feels peaceful and unobtrusive." },
  { source: "snappy", target: "urgency", relationship: "enables", strength: 0.85, description: "Sharp, quick motion drives a sense of urgency." },
  { source: "elastic", target: "excitement", relationship: "enables", strength: 0.7, description: "Elastic overshoot creates excitement and energy." },
  { source: "spring", target: "excitement", relationship: "enables", strength: 0.65, description: "Spring energy reads as excitement and liveliness." },
  { source: "anticipate", target: "excitement", relationship: "enables", strength: 0.6, description: "Wind-up builds anticipation that reads as excitement." },

  // Easing complements style
  { source: "smooth", target: "minimalist", relationship: "complements", strength: 0.75, description: "Smooth easing suits restrained minimalist design." },
  { source: "snappy", target: "mechanical", relationship: "complements", strength: 0.7, description: "Snappy timing fits precise mechanical aesthetics." },
  { source: "elastic", target: "maximalist", relationship: "complements", strength: 0.65, description: "Elastic variety suits rich maximalist compositions." },
  { source: "spring", target: "organic", relationship: "complements", strength: 0.7, description: "Spring physics feel natural and organic." },
  { source: "linear", target: "mechanical", relationship: "complements", strength: 0.6, description: "Constant velocity suits uniform industrial motion." },

  // Timing relationships
  { source: "stagger", target: "cascade", relationship: "complements", strength: 0.9, description: "Staggered start times produce cascade effects." },
  { source: "cascade", target: "sequence", relationship: "specializes", strength: 0.8, description: "Cascade is a sequence with overlapping element timing." },
  { source: "sequence", target: "duration", relationship: "requires", strength: 0.7, description: "A sequence needs a defined duration per step." },
  { source: "rhythm", target: "stagger", relationship: "combines", strength: 0.75, description: "Rhythm is built from staggered timing intervals." },
  { source: "tempo", target: "duration", relationship: "contrasts", strength: 0.5, description: "Tempo is overall pace while duration is per-element length." },
  { source: "stagger", target: "offset", relationship: "combines", strength: 0.8, description: "Stagger is essentially offset timing applied across elements." },
  { source: "rhythm", target: "tempo", relationship: "requires", strength: 0.7, description: "Rhythm depends on a consistent tempo to form a beat." },

  // Transform relationships
  { source: "scale", target: "rotate", relationship: "combines", strength: 0.6, description: "Scale and rotate often animate together for emphasis." },
  { source: "3d-transform", target: "depth", relationship: "requires", strength: 0.7, description: "3D transforms rely on depth staging to read correctly." },
  { source: "morph", target: "keyframe-interpolation", relationship: "requires", strength: 0.8, description: "Morphing needs interpolated keyframes between shapes." },
  { source: "skew", target: "translate", relationship: "contrasts", strength: 0.5, description: "Skew shears in place where translate moves position." },

  // Staging relationships
  { source: "parallax", target: "layering", relationship: "requires", strength: 0.8, description: "Parallax needs distinct depth layers to move independently." },
  { source: "depth", target: "z-order", relationship: "complements", strength: 0.7, description: "Depth and z-order together organize three-dimensional space." },
  { source: "focal-point", target: "layering", relationship: "contrasts", strength: 0.5, description: "A focal point simplifies where layering adds density." },
  { source: "parallax", target: "reduced-motion", relationship: "conflicts", strength: 0.9, description: "Parallax movement can trigger vestibular discomfort." },

  // Narrative relationships
  { source: "build-up", target: "climax", relationship: "transitions", strength: 0.85, description: "The build-up leads directly into the climax." },
  { source: "climax", target: "resolution", relationship: "transitions", strength: 0.85, description: "The climax resolves into a settling phase." },
  { source: "hero-journey", target: "build-up", relationship: "requires", strength: 0.7, description: "A hero journey needs a build-up phase before the peak." },
  { source: "call-to-action", target: "climax", relationship: "requires", strength: 0.7, description: "A call to action lands most effectively after the climax." },
  { source: "resolution", target: "calm", relationship: "complements", strength: 0.65, description: "Resolution settles the composition into a calm state." },
  { source: "focal-point", target: "call-to-action", relationship: "enables", strength: 0.65, description: "A focal point directs attention toward the call to action." },

  // Emotion relationships
  { source: "joy", target: "excitement", relationship: "combines", strength: 0.7, description: "Joy and excitement share high energy and positive valence." },
  { source: "urgency", target: "calm", relationship: "contrasts", strength: 0.85, description: "Urgency is the emotional opposite of calm." },
  { source: "luxury", target: "minimalist", relationship: "complements", strength: 0.7, description: "Luxury often achieves elegance through minimalist restraint." },
  { source: "trust", target: "calm", relationship: "complements", strength: 0.75, description: "Trust and calm share stable, low-arousal qualities." },
  { source: "excitement", target: "snappy", relationship: "requires", strength: 0.6, description: "Excitement uses snappy timing to sustain energy." },
  { source: "trust", target: "smooth", relationship: "requires", strength: 0.7, description: "Trust relies on smooth, predictable easing." },
  { source: "luxury", target: "smooth", relationship: "requires", strength: 0.65, description: "Luxury uses slow, smooth easing to feel deliberate." },

  // Physics relationships
  { source: "spring-force", target: "friction", relationship: "requires", strength: 0.7, description: "Springs settle to rest because friction damps the oscillation." },
  { source: "gravity", target: "momentum", relationship: "enables", strength: 0.65, description: "Gravity accelerates objects and builds downward momentum." },
  { source: "momentum", target: "inertia", relationship: "requires", strength: 0.7, description: "Momentum is inertia in motion — mass resisting change." },
  { source: "friction", target: "momentum", relationship: "conflicts", strength: 0.8, description: "Friction opposes and reduces momentum over time." },
  { source: "gravity", target: "follow-through", relationship: "complements", strength: 0.65, description: "Gravity influences how secondary parts follow through after impact." },
  { source: "spring", target: "spring-force", relationship: "requires", strength: 0.8, description: "Spring easing is driven by the underlying spring force physics." },

  // Principle relationships
  { source: "squash-stretch", target: "scale", relationship: "requires", strength: 0.8, description: "Squash and stretch is implemented through scale deformation." },
  { source: "squash-stretch", target: "inertia", relationship: "requires", strength: 0.6, description: "Inertia explains why an object squashes on impact and stretches in flight." },
  { source: "anticipation", target: "anticipate", relationship: "requires", strength: 0.85, description: "The anticipation principle uses anticipate easing for its wind-up." },
  { source: "follow-through", target: "momentum", relationship: "requires", strength: 0.7, description: "Follow-through is residual momentum in secondary parts." },
  { source: "arcs", target: "rotate", relationship: "requires", strength: 0.6, description: "Arcs are built from a combination of rotation and translation." },
  { source: "timing-principle", target: "duration", relationship: "requires", strength: 0.7, description: "Timing as a principle governs the duration of every action." },
  { source: "squash-stretch", target: "bounce", relationship: "complements", strength: 0.7, description: "Squash and stretch pairs naturally with bounce easing." },
  { source: "follow-through", target: "spring", relationship: "complements", strength: 0.65, description: "Follow-through settles like a damped spring." },
  { source: "anticipation", target: "build-up", relationship: "complements", strength: 0.6, description: "The anticipation principle supports a narrative build-up." },

  // Accessibility relationships
  { source: "reduced-motion", target: "vestibular-safety", relationship: "complements", strength: 0.85, description: "Both protect users with vestibular sensitivity." },
  { source: "reduced-motion", target: "duration-limits", relationship: "requires", strength: 0.75, description: "Reduced-motion mode requires enforcing duration limits." },
  { source: "vestibular-safety", target: "reduced-motion", relationship: "requires", strength: 0.8, description: "Vestibular safety depends on reduced-motion support." },
  { source: "contrast", target: "focal-point", relationship: "enables", strength: 0.6, description: "High contrast directs focal attention to an element." },
  { source: "duration-limits", target: "climax", relationship: "conflicts", strength: 0.5, description: "Long climactic sequences may exceed safe duration limits." },
  { source: "loop", target: "reduced-motion", relationship: "conflicts", strength: 0.6, description: "Infinite loops can bother users with motion sensitivity." },

  // Performance relationships
  { source: "gpu-acceleration", target: "compositor", relationship: "requires", strength: 0.8, description: "GPU acceleration runs animation on the compositor thread." },
  { source: "will-change", target: "gpu-acceleration", relationship: "enables", strength: 0.7, description: "will-change hints prompt the browser to create GPU layers." },
  { source: "compositor", target: "paint-avoidance", relationship: "complements", strength: 0.7, description: "Compositor-thread work avoids main-thread paint cost." },
  { source: "paint-avoidance", target: "gpu-acceleration", relationship: "complements", strength: 0.65, description: "Both keep animation off the main thread and avoid repaints." },
  { source: "will-change", target: "maximalist", relationship: "conflicts", strength: 0.5, description: "Heavy will-change on many elements hurts maximalist scenes." },
  { source: "gpu-acceleration", target: "3d-transform", relationship: "enables", strength: 0.6, description: "GPU acceleration is needed for smooth 3D transforms." },
  { source: "maximalist", target: "paint-avoidance", relationship: "conflicts", strength: 0.6, description: "Maximalist scenes are paint-heavy and resist paint avoidance." },

  // Style relationships
  { source: "minimalist", target: "maximalist", relationship: "contrasts", strength: 0.9, description: "Minimalist and maximalist are opposing aesthetic philosophies." },
  { source: "organic", target: "wave", relationship: "complements", strength: 0.75, description: "Organic motion often takes the form of flowing waves." },
  { source: "cinematic", target: "parallax", relationship: "requires", strength: 0.7, description: "Cinematic staging uses parallax to create depth." },
  { source: "minimalist", target: "focal-point", relationship: "enables", strength: 0.65, description: "Minimalism naturally creates focal points through isolation." },
  { source: "cinematic", target: "hero-journey", relationship: "enables", strength: 0.65, description: "Cinematic style suits full narrative arcs." },
  { source: "cinematic", target: "layering", relationship: "complements", strength: 0.6, description: "Cinematic staging relies on layered depth composition." },

  // Pattern relationships
  { source: "loop", target: "rhythm", relationship: "complements", strength: 0.7, description: "Loops establish a repeating rhythm across the composition." },
  { source: "mirror", target: "offset", relationship: "combines", strength: 0.65, description: "Mirrored motion is symmetric offset across an axis." },
  { source: "echo", target: "stagger", relationship: "combines", strength: 0.7, description: "Echo repeats a motion with staggered, decaying timing." },
  { source: "offset", target: "cascade", relationship: "combines", strength: 0.7, description: "Offset phase shifts across elements create cascading reveals." },
  { source: "loop", target: "duration", relationship: "requires", strength: 0.5, description: "A loop needs a defined cycle duration." },
  { source: "morph", target: "organic", relationship: "complements", strength: 0.6, description: "Morphing suits organic, naturally changing shapes." },

  // Technique relationships
  { source: "keyframe-interpolation", target: "duration", relationship: "requires", strength: 0.7, description: "Interpolation animates across a defined duration." },
  { source: "expression", target: "data-driven", relationship: "enables", strength: 0.7, description: "Expressions can drive motion from live data inputs." },
  { source: "data-driven", target: "expression", relationship: "specializes", strength: 0.7, description: "Data-driven motion is a specialized form of expression-based animation." },
  { source: "procedural", target: "keyframe-interpolation", relationship: "alternative", strength: 0.6, description: "Procedural generation replaces hand-authored keyframes with algorithms." },
  { source: "procedural", target: "wave", relationship: "enables", strength: 0.6, description: "Waves are often generated procedurally via sine functions." },
  { source: "expression", target: "procedural", relationship: "enables", strength: 0.6, description: "Expressions are a lightweight form of procedural motion." },
  { source: "data-driven", target: "sequence", relationship: "requires", strength: 0.6, description: "Data-driven motion often forms sequences tied to data points." },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type AdjacencyEntry = { neighbor: string; edgeIndex: number };

/** Build an undirected adjacency list from the graph edges. */
function buildUndirectedAdjacency(
  graph: MotionKnowledgeGraph,
): Map<string, AdjacencyEntry[]> {
  const adj = new Map<string, AdjacencyEntry[]>();
  for (let i = 0; i < graph.edges.length; i++) {
    const edge = graph.edges[i];
    if (!adj.has(edge.source)) adj.set(edge.source, []);
    if (!adj.has(edge.target)) adj.set(edge.target, []);
    adj.get(edge.source)!.push({ neighbor: edge.target, edgeIndex: i });
    adj.get(edge.target)!.push({ neighbor: edge.source, edgeIndex: i });
  }
  // Ensure every node appears, even isolated ones.
  for (const node of graph.nodes) {
    if (!adj.has(node.id)) adj.set(node.id, []);
  }
  return adj;
}

/** Compute degree centrality for every node (degree / (n - 1)). */
function computeDegreeCentrality(
  graph: MotionKnowledgeGraph,
): Map<string, number> {
  const adj = buildUndirectedAdjacency(graph);
  const n = graph.nodes.length;
  const maxDegree = Math.max(1, n - 1);
  const centrality = new Map<string, number>();
  for (const node of graph.nodes) {
    const degree = (adj.get(node.id) ?? []).length;
    centrality.set(node.id, degree / maxDegree);
  }
  return centrality;
}

/** Compute the shortest-path distance between two nodes (BFS). Returns -1 if unreachable. */
function bfsDistance(
  adj: Map<string, AdjacencyEntry[]>,
  fromId: string,
  toId: string,
): number {
  if (fromId === toId) return 0;
  const visited = new Set<string>([fromId]);
  const queue: Array<{ id: string; dist: number }> = [{ id: fromId, dist: 0 }];
  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    for (const { neighbor } of adj.get(id) ?? []) {
      if (neighbor === toId) return dist + 1;
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ id: neighbor, dist: dist + 1 });
      }
    }
  }
  return -1;
}

/**
 * Find bridge edges using a DFS-based algorithm (Tarjan's bridge finding).
 * An edge is a bridge if removing it increases the number of connected
 * components. The graph is treated as undirected, and parallel edges are
 * handled correctly (two edges between the same pair means neither is a bridge).
 */
function findBridges(graph: MotionKnowledgeGraph): string[] {
  const adj = buildUndirectedAdjacency(graph);
  const visited = new Set<string>();
  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const bridges: string[] = [];
  let time = 0;

  const edgeKeys = graph.edges.map(
    (e, i) => `${e.source} --${e.relationship}--> ${e.target} #${i}`,
  );

  function dfs(u: string, parentEdgeIndex: number): void {
    visited.add(u);
    disc.set(u, time);
    low.set(u, time);
    time++;
    const neighbors = adj.get(u) ?? [];
    for (const { neighbor, edgeIndex } of neighbors) {
      if (edgeIndex === parentEdgeIndex) continue;
      if (!visited.has(neighbor)) {
        dfs(neighbor, edgeIndex);
        low.set(u, Math.min(low.get(u)!, low.get(neighbor)!));
        if (low.get(neighbor)! > disc.get(u)!) {
          bridges.push(edgeKeys[edgeIndex]);
        }
      } else {
        low.set(u, Math.min(low.get(u)!, disc.get(neighbor)!));
      }
    }
  }

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, -1);
    }
  }
  return bridges;
}

/**
 * Suggest a relationship type and base confidence from two concept categories.
 * Used by suggestConnections when no direct edge exists between two concepts.
 */
function suggestRelationship(
  catA: MotionConceptCategory,
  catB: MotionConceptCategory,
): { relationship: MotionRelationship; baseConfidence: number } {
  if (catA === catB) {
    return { relationship: "alternative", baseConfidence: 0.5 };
  }
  const pair = [catA, catB].sort().join("+");
  const map: Record<string, { relationship: MotionRelationship; baseConfidence: number }> = {
    "easing+emotion": { relationship: "enables", baseConfidence: 0.6 },
    "easing+physics": { relationship: "requires", baseConfidence: 0.6 },
    "easing+style": { relationship: "complements", baseConfidence: 0.55 },
    "accessibility+staging": { relationship: "conflicts", baseConfidence: 0.55 },
    "accessibility+pattern": { relationship: "conflicts", baseConfidence: 0.5 },
    "emotion+style": { relationship: "complements", baseConfidence: 0.5 },
    "narrative+style": { relationship: "complements", baseConfidence: 0.5 },
    "narrative+timing": { relationship: "requires", baseConfidence: 0.5 },
    "pattern+style": { relationship: "complements", baseConfidence: 0.5 },
    "pattern+timing": { relationship: "combines", baseConfidence: 0.55 },
    "performance+style": { relationship: "conflicts", baseConfidence: 0.45 },
    "performance+transform": { relationship: "requires", baseConfidence: 0.5 },
    "physics+principle": { relationship: "enables", baseConfidence: 0.55 },
    "principle+timing": { relationship: "requires", baseConfidence: 0.55 },
    "principle+transform": { relationship: "requires", baseConfidence: 0.6 },
    "technique+transform": { relationship: "enables", baseConfidence: 0.55 },
    "easing+timing": { relationship: "complements", baseConfidence: 0.45 },
    "staging+transform": { relationship: "requires", baseConfidence: 0.5 },
  };
  return map[pair] ?? { relationship: "complements", baseConfidence: 0.35 };
}

// ---------------------------------------------------------------------------
// Core graph functions
// ---------------------------------------------------------------------------

/** Build and return the complete motion knowledge graph. */
export function buildKnowledgeGraph(): MotionKnowledgeGraph {
  return {
    nodes: CONCEPTS.map((n) => ({ ...n, tags: [...n.tags], relatedToolNames: [...n.relatedToolNames], metadata: { ...n.metadata } })),
    edges: EDGES.map((e) => ({ ...e })),
  };
}

/** Look up a concept node by id. */
export function queryConcept(
  graph: MotionKnowledgeGraph,
  conceptId: string,
): MotionConceptNode | undefined {
  return graph.nodes.find((n) => n.id === conceptId);
}

/** Find concepts directly related to the given concept, optionally filtered by relationship. */
export function findRelated(
  graph: MotionKnowledgeGraph,
  conceptId: string,
  relationship?: MotionRelationship,
): MotionConceptNode[] {
  const adj = buildUndirectedAdjacency(graph);
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const neighbors = adj.get(conceptId) ?? [];
  const result: MotionConceptNode[] = [];
  const seen = new Set<string>();
  for (const { neighbor, edgeIndex } of neighbors) {
    if (seen.has(neighbor)) continue;
    if (relationship) {
      const edge = graph.edges[edgeIndex];
      if (edge.relationship !== relationship) continue;
    }
    const node = nodeMap.get(neighbor);
    if (node) {
      result.push(node);
      seen.add(neighbor);
    }
  }
  return result;
}

/**
 * Find the shortest path between two concepts using breadth-first search.
 * Returns an array of concept ids from fromId to toId, or an empty array if
 * no path exists.
 */
export function findPath(
  graph: MotionKnowledgeGraph,
  fromId: string,
  toId: string,
): string[] {
  if (fromId === toId) return [fromId];
  const adj = buildUndirectedAdjacency(graph);
  if (!adj.has(fromId) || !adj.has(toId)) return [];
  const visited = new Set<string>([fromId]);
  const queue: string[][] = [[fromId]];
  while (queue.length > 0) {
    const path = queue.shift()!;
    const node = path[path.length - 1];
    for (const { neighbor } of adj.get(node) ?? []) {
      if (neighbor === toId) return [...path, neighbor];
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return [];
}

/**
 * Suggest connections between a set of concepts. For each pair that is not
 * already directly connected, the function looks for shared neighbours and
 * category complementarity to propose a relationship with a confidence score.
 */
export function suggestConnections(
  graph: MotionKnowledgeGraph,
  conceptIds: string[],
): GraphSuggestion[] {
  const adj = buildUndirectedAdjacency(graph);
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  const neighborSet = (id: string): Set<string> =>
    new Set((adj.get(id) ?? []).map((n) => n.neighbor));

  const suggestions: GraphSuggestion[] = [];

  for (let i = 0; i < conceptIds.length; i++) {
    for (let j = i + 1; j < conceptIds.length; j++) {
      const a = conceptIds[i];
      const b = conceptIds[j];
      if (!nodeMap.has(a) || !nodeMap.has(b)) continue;
      // Skip pairs that already share a direct edge.
      if (neighborSet(a).has(b)) continue;

      const neighborsA = neighborSet(a);
      const neighborsB = neighborSet(b);
      const common = [...neighborsA].filter((n) => neighborsB.has(n));

      const nodeA = nodeMap.get(a)!;
      const nodeB = nodeMap.get(b)!;
      const { relationship, baseConfidence } = suggestRelationship(
        nodeA.category,
        nodeB.category,
      );
      const confidence = Math.min(1, baseConfidence + common.length * 0.15);
      if (confidence < 0.3) continue;

      const reason =
        common.length > 0
          ? `${nodeA.label} and ${nodeB.label} share ${common.length} related concept(s): ${common
              .map((c) => nodeMap.get(c)?.label ?? c)
              .join(", ")}.`
          : `${nodeA.label} (${nodeA.category}) and ${nodeB.label} (${nodeB.category}) may connect.`;

      suggestions.push({
        sourceId: a,
        targetId: b,
        relationship,
        reason,
        confidence: Math.round(confidence * 100) / 100,
      });
    }
  }
  return suggestions.sort((x, y) => y.confidence - x.confidence);
}

/** Search concepts by keyword across id, label, description, category, and tags. */
export function searchConcepts(
  graph: MotionKnowledgeGraph,
  query: string,
): MotionConceptNode[] {
  const q = query.toLowerCase().trim();
  if (q === "") return [];
  return graph.nodes.filter((node) => {
    if (node.label.toLowerCase().includes(q)) return true;
    if (node.id.toLowerCase().includes(q)) return true;
    if (node.description.toLowerCase().includes(q)) return true;
    if (node.category.toLowerCase().includes(q)) return true;
    return node.tags.some((t) => t.toLowerCase().includes(q));
  });
}

/** Return a subgraph containing only nodes of the given category and edges between them. */
export function getSubgraph(
  graph: MotionKnowledgeGraph,
  category: MotionConceptCategory,
): MotionKnowledgeGraph {
  const nodes = graph.nodes.filter((n) => n.category === category);
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
  );
  return { nodes, edges };
}

/**
 * Analyze the graph structure: degree centrality, connected components
 * (clusters), bridge edges, density, and isolated nodes.
 */
export function analyzeGraph(graph: MotionKnowledgeGraph): GraphAnalysis {
  const n = graph.nodes.length;
  const e = graph.edges.length;
  const adj = buildUndirectedAdjacency(graph);

  // Degree centrality.
  const degree = new Map<string, number>();
  for (const node of graph.nodes) {
    degree.set(node.id, (adj.get(node.id) ?? []).length);
  }
  const maxDegree = Math.max(1, n - 1);
  const centralNodes = graph.nodes
    .map((node) => ({
      conceptId: node.id,
      centrality: Math.round(((degree.get(node.id) ?? 0) / maxDegree) * 100) / 100,
    }))
    .sort((a, b) => b.centrality - a.centrality);

  // Connected components via BFS.
  const visited = new Set<string>();
  const clusters: Array<{ id: number; conceptIds: string[] }> = [];
  let clusterId = 0;
  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;
    const component: string[] = [];
    const queue = [node.id];
    visited.add(node.id);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      component.push(cur);
      for (const { neighbor } of adj.get(cur) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    clusters.push({ id: clusterId++, conceptIds: component });
  }

  // Bridges.
  const bridges = findBridges(graph);

  // Isolated nodes.
  const isolatedNodes = graph.nodes
    .filter((node) => (degree.get(node.id) ?? 0) === 0)
    .map((node) => node.id);

  // Density and average degree (undirected).
  const density = n > 1 ? (2 * e) / (n * (n - 1)) : 0;
  const averageDegree = n > 0 ? (2 * e) / n : 0;

  return {
    nodeCount: n,
    edgeCount: e,
    density: Math.round(density * 1000) / 1000,
    averageDegree: Math.round(averageDegree * 100) / 100,
    centralNodes: centralNodes.slice(0, 10),
    clusters,
    bridges,
    connectedComponents: clusters.length,
    isolatedNodes,
  };
}

/**
 * Recommend the next concept to explore based on what has already been used.
 *
 * The recommendation engine scores every unused concept by combining:
 * - Graph distance to each used concept (closer scores higher).
 * - Relationship strength along direct edges (stronger edges score higher).
 * - A bridging bonus for concepts that connect to multiple used concepts.
 * - A centrality bonus for fundamental, well-connected concepts.
 *
 * Returns the top concepts ranked by score, filtering out anything already used.
 */
export function recommendNext(
  graph: MotionKnowledgeGraph,
  usedConceptIds: string[],
): MotionConceptNode[] {
  const usedSet = new Set(usedConceptIds);
  const unusedNodes = graph.nodes.filter((n) => !usedSet.has(n.id));
  if (unusedNodes.length === 0 || usedConceptIds.length === 0) return [];

  const adj = buildUndirectedAdjacency(graph);
  const centrality = computeDegreeCentrality(graph);
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  const scored = unusedNodes.map((node) => {
    let score = 0;
    let adjacentUsedCount = 0;

    for (const usedId of usedConceptIds) {
      if (!nodeMap.has(usedId)) continue;
      const distance = bfsDistance(adj, node.id, usedId);
      if (distance === 1) {
        // Directly adjacent — use the strongest connecting edge.
        const neighbors = adj.get(node.id) ?? [];
        const matching = neighbors.filter((nn) => nn.neighbor === usedId);
        const maxStrength =
          matching.length > 0
            ? Math.max(...matching.map((m) => graph.edges[m.edgeIndex].strength))
            : 0.5;
        score += maxStrength;
        adjacentUsedCount++;
      } else if (distance > 1 && distance <= 4) {
        // Reachable within a few hops — contribute a decaying score.
        score += (1 / distance) * 0.3;
      }
    }

    // Bridging bonus: a concept adjacent to several used concepts is a hub.
    if (adjacentUsedCount >= 2) {
      score *= 1 + 0.2 * adjacentUsedCount;
    }

    // Centrality bonus: fundamental concepts are worth exploring.
    const c = centrality.get(node.id) ?? 0;
    score *= 1 + c * 0.3;

    return { node, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s) => s.node);
}

/** Format the graph as a human-readable report with stats, categories, centrality, and clusters. */
export function formatGraphReport(graph: MotionKnowledgeGraph): string {
  const analysis = analyzeGraph(graph);
  const lines: string[] = [];
  lines.push("=== Motion Knowledge Graph ===");
  lines.push("");
  lines.push(`Nodes: ${analysis.nodeCount}`);
  lines.push(`Edges: ${analysis.edgeCount}`);
  lines.push(`Density: ${analysis.density}`);
  lines.push(`Average degree: ${analysis.averageDegree}`);
  lines.push(`Connected components: ${analysis.connectedComponents}`);
  lines.push(`Bridges: ${analysis.bridges.length}`);
  if (analysis.isolatedNodes.length > 0) {
    lines.push(`Isolated nodes: ${analysis.isolatedNodes.join(", ")}`);
  }
  lines.push("");

  // Category breakdown.
  const byCategory = new Map<string, number>();
  for (const node of graph.nodes) {
    byCategory.set(node.category, (byCategory.get(node.category) ?? 0) + 1);
  }
  lines.push("--- Concepts by Category ---");
  for (const [cat, count] of byCategory) {
    lines.push(`${cat.padEnd(16)} ${count}`);
  }
  lines.push("");

  // Top central nodes.
  lines.push("--- Most Central Concepts ---");
  for (const cn of analysis.centralNodes) {
    const node = graph.nodes.find((n) => n.id === cn.conceptId);
    lines.push(
      `${cn.conceptId.padEnd(22)} centrality=${cn.centrality}  ${node?.label ?? ""}`,
    );
  }
  lines.push("");

  // Clusters.
  lines.push("--- Clusters (Connected Components) ---");
  for (const cluster of analysis.clusters) {
    lines.push(`Cluster ${cluster.id}: ${cluster.conceptIds.length} concept(s)`);
    if (cluster.conceptIds.length <= 10) {
      lines.push(`  ${cluster.conceptIds.join(", ")}`);
    }
  }
  lines.push("");

  // Bridges.
  if (analysis.bridges.length > 0) {
    lines.push("--- Bridge Edges ---");
    for (const b of analysis.bridges) {
      lines.push(`  ${b}`);
    }
    lines.push("");
  }

  lines.push(
    `Summary: ${analysis.nodeCount} concepts across ${analysis.connectedComponents} component(s), ${analysis.edgeCount} relationships, density ${analysis.density}.`,
  );
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Easing bridge
// ---------------------------------------------------------------------------

/**
 * Convert an easing-category concept node into a concrete Easing object.
 * Returns undefined for non-easing concepts or concepts without a valid easing
 * mapping in their metadata.
 */
export function easingConceptToEasing(
  node: MotionConceptNode,
): Easing | undefined {
  if (node.category !== "easing") return undefined;
  const name = node.metadata?.sampleEasingName;
  if (
    typeof name === "string" &&
    (EASING_PRESETS as readonly string[]).includes(name)
  ) {
    return easingPreset(name as (typeof EASING_PRESETS)[number]);
  }
  if (node.metadata?.easingType === "spring") {
    const stiffness =
      typeof node.metadata.stiffness === "number" ? node.metadata.stiffness : 170;
    const damping =
      typeof node.metadata.damping === "number" ? node.metadata.damping : 26;
    return easingSpring(stiffness, damping);
  }
  return undefined;
}
