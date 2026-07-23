import { logger } from "../utils/logger.js";

/**
 * Skills router — structured routing system that maps user intents to
 * domain skills and production workflows.
 *
 * The router analyzes user input and determines which skill combination
 * is best suited to handle the request. Each skill is a self-contained
 * capability that can be composed into production loops.
 *
 * Architecture:
 * - Router skill: the entry point that reads user input and routes
 * - Workflow skills: multi-step production pipelines
 * - Domain skills: atomic capabilities that can be composed
 */

export type SkillCategory =
  | "creation"
  | "analysis"
  | "optimization"
  | "export"
  | "editing"
  | "intelligence";

export type SkillComplexity = "atomic" | "workflow" | "router";

export interface Skill {
  /** Unique skill identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** What this skill does. */
  description: string;
  /** Category for grouping. */
  category: SkillCategory;
  /** Complexity level. */
  complexity: SkillComplexity;
  /** Keywords that trigger this skill. */
  keywords: string[];
  /** Tools that this skill uses. */
  tools: string[];
  /** Prerequisite skills (for workflows). */
  prerequisites?: string[];
  /** Whether this skill is available without API configuration. */
  mockAvailable: boolean;
  /** Estimated steps to complete. */
  estimatedSteps: number;
}

export interface SkillRouteResult {
  /** The primary skill to activate. */
  primary: Skill;
  /** Supporting skills to compose. */
  supporting: Skill[];
  /** The detected intent category. */
  intent: string;
  /** Confidence score (0-1). */
  confidence: number;
  /** Suggested execution plan. */
  plan: string[];
}

/** Registry of all available skills. */
const SKILLS: Skill[] = [
  // --- Router skill ---
  {
    id: "router",
    name: "Intent Router",
    description: "Analyzes user input and routes to the appropriate skill combination",
    category: "intelligence",
    complexity: "router",
    keywords: [],
    tools: [],
    mockAvailable: true,
    estimatedSteps: 1,
  },

  // --- Creation workflows ---
  {
    id: "motion-creation",
    name: "Motion Creation",
    description: "Create motion from natural language description — full pipeline from intent to spec",
    category: "creation",
    complexity: "workflow",
    keywords: ["create", "generate", "make", "build", "animate", "motion", "animation"],
    tools: ["run_motion_pipeline", "create_component", "apply_template", "set_easing"],
    mockAvailable: true,
    estimatedSteps: 5,
  },
  {
    id: "sequence-composition",
    name: "Sequence Composition",
    description: "Compose multiple components into a timed sequence with precise synchronization",
    category: "creation",
    complexity: "workflow",
    keywords: ["compose", "sequence", "arrange", "parallel", "stagger", "timeline"],
    tools: ["compose_sequence", "set_delay", "set_duration", "set_choreography"],
    mockAvailable: true,
    estimatedSteps: 4,
  },
  {
    id: "template-instantiation",
    name: "Template Instantiation",
    description: "Instantiate a motion template with custom parameters",
    category: "creation",
    complexity: "atomic",
    keywords: ["template", "preset", "instantiate", "apply"],
    tools: ["apply_template", "list_templates"],
    mockAvailable: true,
    estimatedSteps: 2,
  },
  {
    id: "choreography-design",
    name: "Choreography Design",
    description: "Design multi-component choreography with patterns like cascade, wave, ripple",
    category: "creation",
    complexity: "workflow",
    keywords: ["choreography", "cascade", "wave", "ripple", "unison", "canon", "stagger"],
    tools: ["set_choreography", "compose_sequence", "set_delay"],
    mockAvailable: true,
    estimatedSteps: 3,
  },

  // --- Analysis skills ---
  {
    id: "motion-analysis",
    name: "Motion Analysis",
    description: "Analyze motion principles, accessibility, and performance",
    category: "analysis",
    complexity: "atomic",
    keywords: ["analyze", "check", "validate", "review", "audit", "principles"],
    tools: ["analyze_principles", "check_accessibility", "profile_performance"],
    mockAvailable: true,
    estimatedSteps: 2,
  },
  {
    id: "similarity-search",
    name: "Similarity Search",
    description: "Find similar motions and compare component DNA",
    category: "analysis",
    complexity: "atomic",
    keywords: ["similar", "compare", "find like", "match", "dna"],
    tools: ["find_similar", "compare_motions", "score_similarity"],
    mockAvailable: true,
    estimatedSteps: 2,
  },
  {
    id: "catalog-search",
    name: "Catalog Search",
    description: "Search the unified motion catalog for recipes, presets, shaders, and patterns",
    category: "analysis",
    complexity: "atomic",
    keywords: ["search", "find", "browse", "catalog", "library", "recipe", "preset", "shader"],
    tools: ["search_catalog", "list_recipes", "list_styles", "list_shaders"],
    mockAvailable: true,
    estimatedSteps: 1,
  },

  // --- Optimization skills ---
  {
    id: "motion-optimization",
    name: "Motion Optimization",
    description: "Optimize motion for performance, accessibility, and visual quality",
    category: "optimization",
    complexity: "workflow",
    keywords: ["optimize", "improve", "fix", "refine", "tune", "performance"],
    tools: ["profile_performance", "check_accessibility", "apply_principle", "set_easing"],
    mockAvailable: true,
    estimatedSteps: 4,
  },
  {
    id: "easing-synthesis",
    name: "Easing Synthesis",
    description: "Synthesize custom easing curves from natural language descriptions",
    category: "optimization",
    complexity: "atomic",
    keywords: ["easing", "curve", "bezier", "spring", "smooth", "timing"],
    tools: ["synthesize_easing", "set_easing"],
    mockAvailable: true,
    estimatedSteps: 2,
  },
  {
    id: "color-harmony",
    name: "Color Harmony",
    description: "Generate harmonious color palettes for motion components",
    category: "optimization",
    complexity: "atomic",
    keywords: ["color", "harmony", "palette", "scheme", "complementary", "analogous"],
    tools: ["generate_harmony", "set_style"],
    mockAvailable: true,
    estimatedSteps: 2,
  },

  // --- Export skills ---
  {
    id: "code-export",
    name: "Code Export",
    description: "Export motion as CSS, React, or HTML composition",
    category: "export",
    complexity: "workflow",
    keywords: ["export", "code", "css", "react", "html", "generate"],
    tools: ["export_css", "export_react", "export_html"],
    mockAvailable: true,
    estimatedSteps: 3,
  },
  {
    id: "frame-rendering",
    name: "Frame Rendering",
    description: "Render specific frames or frame ranges for preview and capture",
    category: "export",
    complexity: "workflow",
    keywords: ["render", "frame", "capture", "snapshot", "seek", "preview"],
    tools: ["seek_to_frame", "render_frame_range", "find_thumbnail", "export_html"],
    mockAvailable: true,
    estimatedSteps: 3,
  },
  {
    id: "video-export",
    name: "Video Export",
    description: "Export motion as video with audio and effects",
    category: "export",
    complexity: "workflow",
    keywords: ["video", "mp4", "webm", "render", "encode", "film"],
    tools: ["render_all", "generate_media", "export_video"],
    mockAvailable: true,
    estimatedSteps: 5,
  },

  // --- Editing skills ---
  {
    id: "component-editing",
    name: "Component Editing",
    description: "Edit component properties, keyframes, and styles",
    category: "editing",
    complexity: "atomic",
    keywords: ["edit", "update", "modify", "change", "set", "property", "style"],
    tools: ["update_component", "set_style", "set_keyframes", "set_duration", "set_delay"],
    mockAvailable: true,
    estimatedSteps: 2,
  },
  {
    id: "motion-blending",
    name: "Motion Blending",
    description: "Blend two motions together with interpolation",
    category: "editing",
    complexity: "atomic",
    keywords: ["blend", "merge", "interpolate", "mix", "combine"],
    tools: ["blend_motions", "interpolate_motion", "merge_properties"],
    mockAvailable: true,
    estimatedSteps: 2,
  },
  {
    id: "pattern-synthesis",
    name: "Pattern Synthesis",
    description: "Synthesize generative motion patterns like waves, pulses, and spirals",
    category: "editing",
    complexity: "atomic",
    keywords: ["synthesize", "pattern", "wave", "pulse", "spiral", "generate"],
    tools: ["synthesize_motion", "morph_to_pattern", "synthesize_waveform"],
    mockAvailable: true,
    estimatedSteps: 2,
  },

  // --- Intelligence skills ---
  {
    id: "storytelling",
    name: "Storytelling",
    description: "Plan motion as a narrative with pacing and story arcs",
    category: "intelligence",
    complexity: "workflow",
    keywords: ["story", "narrative", "arc", "pacing", "scene", "beat"],
    tools: ["create_story_plan", "analyze_pacing", "apply_story_plan"],
    mockAvailable: true,
    estimatedSteps: 4,
  },
  {
    id: "mood-intelligence",
    name: "Mood Intelligence",
    description: "Apply mood and emotion to motion components",
    category: "intelligence",
    complexity: "atomic",
    keywords: ["mood", "emotion", "feeling", "tone", "vibe"],
    tools: ["apply_mood", "list_moods"],
    mockAvailable: true,
    estimatedSteps: 2,
  },
  {
    id: "brand-application",
    name: "Brand Application",
    description: "Apply brand identity packs to motion components",
    category: "intelligence",
    complexity: "atomic",
    keywords: ["brand", "identity", "pack", "style", "logo"],
    tools: ["apply_brand_pack", "list_brand_packs"],
    mockAvailable: true,
    estimatedSteps: 2,
  },
  {
    id: "media-resolution",
    name: "Media Resolution",
    description: "Resolve media needs (audio, images, voice) for compositions",
    category: "intelligence",
    complexity: "workflow",
    keywords: ["media", "audio", "music", "voice", "image", "sound", "sfx"],
    tools: ["resolve_media", "generate_voiceover", "generate_music"],
    mockAvailable: true,
    estimatedSteps: 3,
  },
  {
    id: "adaptive-design",
    name: "Adaptive Design",
    description: "Generate responsive CSS and adapt motion for different viewports",
    category: "intelligence",
    complexity: "atomic",
    keywords: ["adaptive", "responsive", "viewport", "breakpoint", "mobile", "desktop"],
    tools: ["adapt_motion", "generate_responsive_css", "preview_adaptations"],
    mockAvailable: true,
    estimatedSteps: 2,
  },
];

/** Intent patterns for routing. */
const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: string; skillIds: string[] }> = [
  {
    pattern: /\b(create|generate|make|build)\b.*\b(motion|animation|effect|sequence)\b/i,
    intent: "create-motion",
    skillIds: ["motion-creation", "template-instantiation"],
  },
  {
    pattern: /\b(compose|arrange|sequence|stagger|parallel)\b/i,
    intent: "compose-sequence",
    skillIds: ["sequence-composition", "choreography-design"],
  },
  {
    pattern: /\b(analyze|check|validate|audit|review)\b/i,
    intent: "analyze-motion",
    skillIds: ["motion-analysis", "similarity-search"],
  },
  {
    pattern: /\b(search|find|browse|show)\b.*\b(preset|recipe|shader|pattern|catalog|library)\b/i,
    intent: "search-catalog",
    skillIds: ["catalog-search"],
  },
  {
    pattern: /\b(optimize|improve|fix|refine|tune)\b/i,
    intent: "optimize-motion",
    skillIds: ["motion-optimization", "easing-synthesis", "color-harmony"],
  },
  {
    pattern: /\b(export|render|capture|snapshot)\b.*\b(css|react|html|code|frame|video)\b/i,
    intent: "export-code",
    skillIds: ["code-export", "frame-rendering"],
  },
  {
    pattern: /\b(render|capture|seek)\b.*\b(frame|preview)\b/i,
    intent: "render-frame",
    skillIds: ["frame-rendering"],
  },
  {
    pattern: /\b(video|mp4|webm|film|encode)\b/i,
    intent: "export-video",
    skillIds: ["video-export", "media-resolution"],
  },
  {
    pattern: /\b(edit|update|modify|change)\b.*\b(component|property|style|keyframe)\b/i,
    intent: "edit-component",
    skillIds: ["component-editing"],
  },
  {
    pattern: /\b(blend|merge|interpolate|mix)\b/i,
    intent: "blend-motion",
    skillIds: ["motion-blending"],
  },
  {
    pattern: /\b(story|narrative|arc|pacing|scene|beat)\b/i,
    intent: "plan-story",
    skillIds: ["storytelling", "mood-intelligence"],
  },
  {
    pattern: /\b(brand|identity|logo)\b/i,
    intent: "apply-brand",
    skillIds: ["brand-application"],
  },
  {
    pattern: /\b(music|audio|sound|voice|sfx|bgm)\b/i,
    intent: "resolve-media",
    skillIds: ["media-resolution"],
  },
  {
    pattern: /\b(responsive|adaptive|mobile|viewport|breakpoint)\b/i,
    intent: "adapt-design",
    skillIds: ["adaptive-design"],
  },
  {
    pattern: /\b(choreography|cascade|wave|ripple|unison|canon)\b/i,
    intent: "design-choreography",
    skillIds: ["choreography-design"],
  },
  {
    pattern: /\b(synthesize|generate)\b.*\b(pattern|wave|pulse|spiral)\b/i,
    intent: "synthesize-pattern",
    skillIds: ["pattern-synthesis"],
  },
  {
    pattern: /\b(easing|curve|bezier|spring|smooth)\b/i,
    intent: "synthesize-easing",
    skillIds: ["easing-synthesis"],
  },
  {
    pattern: /\b(color|palette|harmony|scheme)\b/i,
    intent: "generate-color",
    skillIds: ["color-harmony"],
  },
  {
    pattern: /\b(mood|emotion|feeling|tone|vibe)\b/i,
    intent: "apply-mood",
    skillIds: ["mood-intelligence"],
  },
];

/**
 * Route a user input to the best skill combination.
 * Returns the primary skill, supporting skills, and an execution plan.
 */
export function routeSkill(userInput: string): SkillRouteResult {
  const input = userInput.toLowerCase();

  // Find matching intent patterns
  let bestMatch: { intent: string; skillIds: string[]; score: number } | null = null;
  let bestScore = 0;

  for (const { pattern, intent, skillIds } of INTENT_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      // Score based on match length relative to input
      const score = match[0].length / input.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { intent, skillIds, score };
      }
    }
  }

  // Also check keyword matches
  for (const skill of SKILLS) {
    if (skill.complexity === "router") continue;
    for (const keyword of skill.keywords) {
      if (input.includes(keyword.toLowerCase())) {
        const score = keyword.length / input.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            intent: `${skill.id}-keyword`,
            skillIds: [skill.id],
            score,
          };
        }
      }
    }
  }

  if (!bestMatch) {
    // Default to motion creation
    const defaultSkill = getSkill("motion-creation")!;
    return {
      primary: defaultSkill,
      supporting: [],
      intent: "default",
      confidence: 0.3,
      plan: generatePlan(defaultSkill, []),
    };
  }

  const primary = getSkill(bestMatch.skillIds[0]);
  if (!primary) {
    const fallback = getSkill("motion-creation")!;
    return {
      primary: fallback,
      supporting: [],
      intent: bestMatch.intent,
      confidence: bestMatch.score,
      plan: generatePlan(fallback, []),
    };
  }

  const supporting = bestMatch.skillIds
    .slice(1)
    .map(getSkill)
    .filter((s): s is Skill => s !== null && s !== undefined);

  return {
    primary,
    supporting,
    intent: bestMatch.intent,
    confidence: Math.min(1, bestMatch.score * 2),
    plan: generatePlan(primary, supporting),
  };
}

/** Get a skill by ID. */
export function getSkill(id: string): Skill | null {
  return SKILLS.find((s) => s.id === id) ?? null;
}

/** List all available skills. */
export function listSkills(category?: SkillCategory): Skill[] {
  if (category) {
    return SKILLS.filter((s) => s.category === category);
  }
  return SKILLS;
}

/** List skills by complexity. */
export function listSkillsByComplexity(complexity: SkillComplexity): Skill[] {
  return SKILLS.filter((s) => s.complexity === complexity);
}

/** Generate an execution plan for a skill combination. */
function generatePlan(primary: Skill, supporting: Skill[]): string[] {
  const steps: string[] = [];

  // Add prerequisite steps
  if (primary.prerequisites) {
    for (const prereq of primary.prerequisites) {
      steps.push(`Load prerequisite: ${prereq}`);
    }
  }

  // Add primary skill steps
  steps.push(`Activate skill: ${primary.name}`);
  for (const tool of primary.tools) {
    steps.push(`Execute tool: ${tool}`);
  }

  // Add supporting skill steps
  for (const skill of supporting) {
    steps.push(`Compose with: ${skill.name}`);
    for (const tool of skill.tools) {
      if (!primary.tools.includes(tool)) {
        steps.push(`Execute tool: ${tool}`);
      }
    }
  }

  return steps;
}

/** Get a summary of the skills system for the agent. */
export function getSkillsSummary(): {
  totalSkills: number;
  byCategory: Record<string, number>;
  byComplexity: Record<string, number>;
  mockAvailable: number;
} {
  const byCategory: Record<string, number> = {};
  const byComplexity: Record<string, number> = {};

  for (const skill of SKILLS) {
    byCategory[skill.category] = (byCategory[skill.category] ?? 0) + 1;
    byComplexity[skill.complexity] = (byComplexity[skill.complexity] ?? 0) + 1;
  }

  return {
    totalSkills: SKILLS.length,
    byCategory,
    byComplexity,
    mockAvailable: SKILLS.filter((s) => s.mockAvailable).length,
  };
}

/** Log the routing decision for debugging. */
export function logRoute(result: SkillRouteResult, userInput: string): void {
  logger.info("Skill routed", {
    intent: result.intent,
    primary: result.primary.id,
    supporting: result.supporting.map((s) => s.id),
    confidence: result.confidence,
    inputPreview: userInput.slice(0, 80),
  });
}
