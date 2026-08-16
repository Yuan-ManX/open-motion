/**
 * Workflow presets for common design/production tasks. Each preset packages
 * a set of sequential Agent prompts plus default tool flags so the user can
 * jump from "blank canvas" to "production-ready hero/onboarding/explainer"
 * with a single click.
 *
 * Presets are intentionally data-only so new presets can be registered by
 * end-users via plugins without writing code.
 */

export interface WorkflowStep {
  /** Human-readable step label, shown in the workflow HUD */
  label: string;
  /** User-facing prompt to send to the Agent chat (can include template vars like {{name}}) */
  prompt: string;
  /** Optional pre-selected template IDs to pre-load the component library picker */
  preferredTemplates?: string[];
  /** Optional cursor choreography ids to apply automatically after generation (mapped to CTA components) */
  preferredCursorChoreographies?: string[];
  /** Optional motion color palette id applied to the project tokens after generation */
  preferredPalette?: string;
  /** Scene transition id to apply to the output */
  preferredSceneTransition?: string;
  /** A11y profile id — applied to the whole project after generation */
  applyAccessibilityProfile?: string;
}

export interface WorkflowPreset {
  id: string;
  /** User-facing name, e.g. "Hero Launch" */
  name: string;
  /** Marketing copy shown on the preset card */
  tagline: string;
  /** Free-text description explaining the target audience + timeline */
  description: string;
  /** Total expected runtime estimate for the preset, displayed as guidance */
  estimatedDurationMin: number;
  /** Artboard size preset */
  artboardSize: { width: number; height: number };
  /** Semantic category for catalog filtering */
  category: "Marketing" | "Product" | "Onboarding" | "Explainer" | "Social" | "Editorial";
  /** Steps the orchestrator will execute in order */
  steps: WorkflowStep[];
  /** Tag vocab for preset search */
  tags: string[];
}

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: "workflow-hero-launch",
    name: "Hero Launch",
    tagline: "SaaS product hero with CTA, trust badges, and social proof.",
    description: "A 3-section animated hero: logo marquee, headline fade-in, and a CTA button with magnet interaction. Ships with accessibility profile tuned for vestibular-safe motion.",
    estimatedDurationMin: 5,
    artboardSize: { width: 1280, height: 720 },
    category: "Marketing",
    steps: [
      {
        label: "Compose layout",
        prompt: "Create a logo badge component at top-left, a headline with fade-up emphasis, a subheadline with stagger, and a CTA button. Keep vertical rhythm consistent.",
        preferredTemplates: ["tpl-fade-in-up", "tpl-text-stagger"],
        preferredPalette: "palette-midnight-gradient",
      },
      {
        label: "Choreograph interactions",
        prompt: "Apply a magnetic-pro cursor choreography to the CTA button. Add a subtle hover whisper to the subheadline links.",
        preferredCursorChoreographies: ["cursor-magnetic-pro", "cursor-subtle-whisper"],
      },
      {
        label: "Add social proof",
        prompt: "Create a marquee logo strip with 5 brand tiles scrolling continuously. Use an alternate iteration direction so it bounces gently.",
        preferredTemplates: ["tpl-ambient-marquee"],
      },
      {
        label: "Tune accessibility",
        prompt: "Apply the vestibular-safe accessibility profile to the entire project. Replace any infinite loops with a maximum of 3 iterations.",
        applyAccessibilityProfile: "vestibular-safe",
      },
    ],
    tags: ["hero", "saas", "launch", "cta", "marquee", "marketing"],
  },
  {
    id: "workflow-onboarding-flow",
    name: "Onboarding Flow",
    tagline: "4-step mobile onboarding with animated scene transitions.",
    description: "Four artboards that walk the user through welcome → feature A → feature B → signup. Each step transitions with a parallax push to reinforce progression.",
    estimatedDurationMin: 10,
    artboardSize: { width: 390, height: 844 },
    category: "Onboarding",
    steps: [
      {
        label: "Scene 1 — Welcome",
        prompt: "Create a welcome scene: an icon with scale-in elastic easing, a headline, and a 'Get Started' text link aligned bottom-right.",
        preferredTemplates: ["tpl-elastic-pop-in", "tpl-fade-in-up"],
        preferredPalette: "palette-pastel-breeze",
        preferredSceneTransition: "scene-parallax-push",
      },
      {
        label: "Scene 2 — Feature Showcase",
        prompt: "Create a feature screen with 3 benefits as individual cards. Each card enters with the stagger-3D template and a subtle underline cursor choreography.",
        preferredTemplates: ["tpl-stagger-3d-in"],
        preferredCursorChoreographies: ["cursor-professional-underline"],
      },
      {
        label: "Scene 3 — Progress summary",
        prompt: "Create a progress ring component (72% fill) combined with headline and CTA. Use an understroke cursor choreography on the CTA.",
        preferredTemplates: ["tpl-progress-reveal"],
        preferredCursorChoreographies: ["cursor-hover-hold-peek"],
      },
      {
        label: "Scene 4 — Signup",
        prompt: "Build a final signup scene: form fields with staggered entrance and a springy CTA button that emits confetti-like pulse when clicked.",
        preferredTemplates: ["tpl-text-stagger", "tpl-pulse-radiate"],
      },
    ],
    tags: ["onboarding", "mobile", "scene", "flow", "signup", "walkthrough"],
  },
  {
    id: "workflow-explainer-loop",
    name: "Explainer Loop",
    tagline: "30s social-media explainer loop with split sections and transitions.",
    description: "A vertical social (9:16) composition split into 4 sections, separated by cinematic scene transitions. Runs as a shareable loop that tells a micro-story: problem → solution → result.",
    estimatedDurationMin: 8,
    artboardSize: { width: 1080, height: 1920 },
    category: "Social",
    steps: [
      {
        label: "Scene 1 — Hook",
        prompt: "Build a bold opening hook: full-screen headline with kinetic-typography template, layered with blurred backgrounds. Use the sunrise palette.",
        preferredTemplates: ["tpl-kinetic-typography"],
        preferredPalette: "palette-sunrise-energized",
        preferredSceneTransition: "scene-iris",
      },
      {
        label: "Scene 2 — Problem",
        prompt: "Build the problem section: 3 icons in a column each using shake-and-calm to indicate a pain point. Transition via blur dissolve.",
        preferredTemplates: ["tpl-shake-and-calm"],
        preferredSceneTransition: "scene-blur-dissolve",
      },
      {
        label: "Scene 3 — Solution",
        prompt: "Build the solution section: 3 stacked cards with the slide-in-cascade template and the diagonal-wipe transition between each.",
        preferredTemplates: ["tpl-slide-in-cascade"],
        preferredSceneTransition: "scene-diagonal-wipe",
      },
      {
        label: "Scene 4 — CTA",
        prompt: "Build the final CTA scene: QR code placeholder, short copy and a lively springy cursor choreography for the link.",
        preferredTemplates: ["tpl-fade-in-up", "tpl-ambient-marquee"],
        preferredCursorChoreographies: ["cursor-lively-springy"],
      },
      {
        label: "Polish",
        prompt: "Apply the photosensitive-safe accessibility profile to avoid flash risk, and double-check the duration of every section stays under 8 seconds each.",
        applyAccessibilityProfile: "photosensitive-safe",
      },
    ],
    tags: ["social", "explainer", "loop", "9:16", "shareable", "micro-story"],
  },
  {
    id: "workflow-product-dashboard",
    name: "Product Dashboard",
    tagline: "Enterprise dashboard with chart reveals and data grid animation.",
    description: "An enterprise dashboard layout with sidebar navigation, top navigation, and two KPI cards plus a line chart reveal. Motion tuned for the cognitive-friendly profile to keep focus.",
    estimatedDurationMin: 7,
    artboardSize: { width: 1440, height: 900 },
    category: "Product",
    steps: [
      {
        label: "Build skeleton",
        prompt: "Create a sidebar nav, a top header, 2 KPI cards and one chart placeholder. Use the frost palette. Motion should be subtle whisper style to avoid visual noise.",
        preferredTemplates: ["tpl-fade-in-up", "tpl-progress-reveal"],
        preferredPalette: "palette-frost-professional",
        preferredCursorChoreographies: ["cursor-subtle-whisper"],
      },
      {
        label: "Chart reveal",
        prompt: "Use draw-on-svg template for the chart. Ease it gently to avoid distracting from the data.",
        preferredTemplates: ["tpl-draw-on-svg"],
      },
      {
        label: "Accessibility pass",
        prompt: "Apply the cognitive-friendly accessibility profile to all components to keep motion short and predictable.",
        applyAccessibilityProfile: "cognitive-friendly",
      },
    ],
    tags: ["dashboard", "product", "data", "enterprise", "charts", "kpi"],
  },
  {
    id: "workflow-editorial-feature",
    name: "Editorial Feature",
    tagline: "Long-form editorial page with chapter transitions and type-driven motion.",
    description: "Long-form article with a cover, two pull quotes, and section breaks using cinematic iris and grid-reveal transitions. Designed around kinetic typography and a warm editorial palette.",
    estimatedDurationMin: 9,
    artboardSize: { width: 1600, height: 900 },
    category: "Editorial",
    steps: [
      {
        label: "Cover scene",
        prompt: "Build the cover: big kinetic-typography headline, small byline. Use the warm-editorial palette and iris transition out of the cover.",
        preferredTemplates: ["tpl-kinetic-typography"],
        preferredPalette: "palette-warm-editorial",
        preferredSceneTransition: "scene-iris",
      },
      {
        label: "Chapters",
        prompt: "Create two chapter sections with staggered text entrances. Use underline cursor choreographies for links.",
        preferredTemplates: ["tpl-text-stagger"],
        preferredCursorChoreographies: ["cursor-professional-underline"],
        preferredSceneTransition: "scene-grid-reveal",
      },
      {
        label: "Pull quote emphasis",
        prompt: "Create two pull quotes with shake-and-calm to give them punch when they enter.",
        preferredTemplates: ["tpl-shake-and-calm"],
      },
    ],
    tags: ["editorial", "article", "long-form", "type", "magazine"],
  },
  {
    id: "workflow-brand-launch-kit",
    name: "Brand Launch Kit",
    tagline: "Complete brand micro-moment bundle for launch week.",
    description: "Packages a hero, a brand wordmark animation, two social variations, and a favicon pulse. Used end-to-end to generate all motion assets for a launch week.",
    estimatedDurationMin: 15,
    artboardSize: { width: 1920, height: 1080 },
    category: "Marketing",
    steps: [
      {
        label: "Wordmark reveal",
        prompt: "Create a draw-on-svg wordmark that reveals stroke then fill. Pair it with accent color from the forest palette.",
        preferredTemplates: ["tpl-draw-on-svg", "tpl-elastic-pop-in"],
        preferredPalette: "palette-forest-vibrant",
      },
      {
        label: "Hero page",
        prompt: "Compose a hero page with title, subheadline and CTA using magnetic-pro choreography.",
        preferredTemplates: ["tpl-fade-in-up", "tpl-text-stagger"],
        preferredCursorChoreographies: ["cursor-magnetic-pro", "cursor-subtle-whisper"],
        preferredSceneTransition: "scene-parallax-push",
      },
      {
        label: "Social variations",
        prompt: "Create two 1080x1920 social variants with kinetic type and pulse radiate for the CTA.",
        preferredTemplates: ["tpl-kinetic-typography", "tpl-pulse-radiate"],
      },
      {
        label: "Favicon micro-loop",
        prompt: "Create a tiny favicon-scale pulse-radiate loop, capped at 2 iterations and 400ms total. Apply mobile-save-battery profile to keep it efficient.",
        preferredTemplates: ["tpl-pulse-radiate"],
        applyAccessibilityProfile: "mobile-save-battery",
      },
    ],
    tags: ["brand", "launch", "kit", "wordmark", "social", "hero"],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Substitute template variables like {{name}} inside a step prompt.
 * Currently supported: {{name}} — replaced with `projectName`.
 */
export function renderStepPrompt(step: WorkflowStep, vars: Record<string, string>): string {
  let out = step.prompt;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

/** Search workflows by keywords (name, tag, category). */
export function searchWorkflows(query: string, opts: { category?: WorkflowPreset["category"] } = {}): WorkflowPreset[] {
  const q = query.trim().toLowerCase();
  return WORKFLOW_PRESETS.filter((p) => {
    if (opts.category && p.category !== opts.category) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.tagline.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q)
    );
  });
}
