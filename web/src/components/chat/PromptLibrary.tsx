import { useState, useMemo } from "react";

/**
 * Curated Prompt Library — categorized prompt templates that users can click
 * to quickly populate the chat input. Designed to showcase the Agent's full
 * capability surface without requiring users to memorize tool names.
 */

export interface PromptEntry {
  title: string;
  prompt: string;
  description: string;
}

export interface PromptCategory {
  id: string;
  label: string;
  icon: string;
  prompts: PromptEntry[];
}

const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: "entrance",
    label: "Entrance",
    icon: "→",
    prompts: [
      { title: "Cinematic hero", prompt: "Create a cinematic hero entrance with a slow scale-up, fade-in, and subtle blur-to-sharp transition over 1200ms", description: "Premium reveal for landing pages" },
      { title: "Bouncy card flip", prompt: "Add a 3D card flip-in entrance with a bouncy spring easing at 600ms", description: "Playful card reveal" },
      { title: "Staggered list", prompt: "Create a staggered list entrance where each item slides up and fades in with 80ms delay between items", description: "Cascade reveal for lists" },
      { title: "Liquid morph", prompt: "Generate a liquid morph entrance that transitions from a circle to a rounded rectangle with a smooth filter blur", description: "Organic shape reveal" },
    ],
  },
  {
    id: "emphasis",
    label: "Emphasis",
    icon: "!",
    prompts: [
      { title: "Heartbeat pulse", prompt: "Add a heartbeat pulse animation to the selected component — two quick scale bumps at 60 BPM", description: "Attention-grabbing pulse" },
      { title: "Error shake", prompt: "Apply an error shake animation — 4 rapid horizontal translations with decreasing amplitude", description: "Form validation feedback" },
      { title: "Glow halo", prompt: "Add a pulsing glow halo effect around the component using a box-shadow animation", description: "Highlight active elements" },
      { title: "Magnetic attract", prompt: "Create a magnetic attraction effect where the component subtly moves toward the cursor on hover", description: "Interactive hover feedback" },
    ],
  },
  {
    id: "transition",
    label: "Transition",
    icon: "↔",
    prompts: [
      { title: "Smooth page fade", prompt: "Create a smooth page transition with a 400ms cross-fade and subtle vertical slide", description: "Route change transition" },
      { title: "Shape morph", prompt: "Morph the component from a square to a circle over 800ms with an organic easing curve", description: "Geometric shape change" },
      { title: "Iris wipe", prompt: "Create an iris wipe transition that reveals content through an expanding circular mask", description: "Cinematic scene reveal" },
      { title: "Liquid dissolve", prompt: "Apply a liquid dissolve transition with a SVG turbulence filter for an organic melt effect", description: "Organic state change" },
    ],
  },
  {
    id: "sequence",
    label: "Sequence",
    icon: "↠",
    prompts: [
      { title: "Cascade reveal", prompt: "Stagger all components in a cascade reveal with 100ms delay between each, starting from the top-left", description: "Orchestrated multi-component reveal" },
      { title: "Choreograph scene", prompt: "Choreograph the scene so the hero enters first, then badges fade in, then the CTA button slides up", description: "Story-driven sequence" },
      { title: "Beat sync", prompt: "Create a beat-synced sequence at 120 BPM where each component enters on the downbeat", description: "Music-synced choreography" },
      { title: "Reverse exit", prompt: "Create a reverse exit sequence where components leave in the opposite order they entered", description: "Symmetrical teardown" },
    ],
  },
  {
    id: "polish",
    label: "Polish",
    icon: "✧",
    prompts: [
      { title: "Make it snappier", prompt: "Make the selected component's motion snappier — reduce duration by 30% and switch to a snappy easing", description: "Quick refinement" },
      { title: "Accessibility check", prompt: "Check accessibility of the current motion — verify reduced-motion support and vestibular safety", description: "A11y audit" },
      { title: "Performance audit", prompt: "Run a performance analysis and suggest optimizations for 60fps playback", description: "Perf profiling" },
      { title: "Analyze principles", prompt: "Analyze the motion principles at work in this composition and suggest improvements", description: "Design critique" },
    ],
  },
  {
    id: "intelligence",
    label: "Intel",
    icon: "◎",
    prompts: [
      { title: "Run collaboration", prompt: "Run a multi-engine collaboration on the current scene to produce a unified motion design", description: "Cross-discipline synthesis" },
      { title: "Analyze physics", prompt: "Analyze the physics of the current motion — check forces, energy, and momentum", description: "Physics simulation audit" },
      { title: "Motion DNA", prompt: "Extract and analyze the motion DNA of this composition — show easing families and property distribution", description: "Genomic analysis" },
      { title: "Prophecy forecast", prompt: "Forecast the motion design trajectory and predict the next design era for this project", description: "Trend prediction" },
    ],
  },
  {
    id: "export",
    label: "Export",
    icon: "↗",
    prompts: [
      { title: "Export HTML", prompt: "Export the current animation as a self-contained HTML file with inline CSS", description: "Standalone HTML export" },
      { title: "Save as Lottie", prompt: "Export the current motion as a Lottie JSON file", description: "Lottie format export" },
      { title: "Render video", prompt: "Render the current animation as an MP4 video at 60fps", description: "Video render" },
      { title: "Save version", prompt: "Save the current project state as a named version snapshot", description: "Version checkpoint" },
    ],
  },
];

interface Props {
  onPick: (prompt: string) => void;
  onClose: () => void;
}

export function PromptLibrary({ onPick, onClose }: Props) {
  const [activeCategory, setActiveCategory] = useState(PROMPT_CATEGORIES[0].id);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return PROMPT_CATEGORIES;
    const q = search.toLowerCase();
    return PROMPT_CATEGORIES.map((cat) => ({
      ...cat,
      prompts: cat.prompts.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.prompt.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.prompts.length > 0);
  }, [search]);

  const currentCat = filtered.find((c) => c.id === activeCategory) ?? filtered[0];

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-panel border border-edge rounded-xl shadow-2xl overflow-hidden z-50 max-h-[340px] flex flex-col">
      {/* Header with search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-edge bg-panel2">
        <span className="text-xs text-gray-400 font-medium flex-shrink-0">Prompts</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prompts..."
          className="flex-1 text-xs bg-bg border border-edge rounded px-2 py-1 text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-accent"
          autoFocus
        />
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-300 text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-panel1"
          aria-label="Close prompt library"
        >
          ✕
        </button>
      </div>

      {/* Category tabs + prompt grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Category sidebar */}
        <div className="w-24 flex-shrink-0 border-r border-edge bg-panel2/50 overflow-y-auto">
          {filtered.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`w-full text-left px-2 py-2 text-[11px] flex items-center gap-1.5 transition-colors ${
                currentCat?.id === cat.id
                  ? "bg-panel1 text-accent border-l-2 border-accent"
                  : "text-gray-400 hover:bg-panel1/50 hover:text-gray-200 border-l-2 border-transparent"
              }`}
            >
              <span className="flex-shrink-0">{cat.icon}</span>
              <span className="truncate">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Prompt cards */}
        <div className="flex-1 overflow-y-auto p-2">
          {currentCat && currentCat.prompts.length > 0 ? (
            <div className="grid grid-cols-1 gap-1.5">
              {currentCat.prompts.map((p) => (
                <button
                  key={p.title}
                  onClick={() => {
                    onPick(p.prompt);
                    onClose();
                  }}
                  className="text-left p-2 rounded-lg bg-panel2/50 border border-edge hover:border-accent hover:bg-panel1 transition-all group"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs text-gray-200 font-medium group-hover:text-accent transition-colors">
                      {p.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed">
                    {p.description}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-gray-600">
              No prompts match "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
