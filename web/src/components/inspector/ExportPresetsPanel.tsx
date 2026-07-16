import { useState } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";

interface PresetSummary {
  id: string;
  name: string;
  platform: string;
  format: string;
  description: string;
  fileExtension: string;
  recommendedFor: string[];
}

const PRESETS: PresetSummary[] = [
  {
    id: "preset-web-standalone",
    name: "Web Standalone",
    platform: "web",
    format: "html",
    description: "Self-contained HTML page with inline CSS/JS — open in any browser, no build step.",
    fileExtension: "html",
    recommendedFor: ["Live demo link", "Standalone preview", "Full-fidelity with shaders"],
  },
  {
    id: "preset-react-component",
    name: "React Component",
    platform: "react",
    format: "react",
    description: "Drop-in React component using Web Animations API — no external library needed.",
    fileExtension: "tsx",
    recommendedFor: ["React/Next.js apps", "Component-driven dev", "TypeScript projects"],
  },
  {
    id: "preset-vue-component",
    name: "Vue Component",
    platform: "vue",
    format: "vue",
    description: "Vue 3 single-file component with scoped styles and Web Animations API.",
    fileExtension: "vue",
    recommendedFor: ["Vue 3 or Nuxt projects", "Component-driven dev"],
  },
  {
    id: "preset-mobile-lottie",
    name: "Mobile Lottie",
    platform: "mobile-lottie",
    format: "lottie",
    description: "Lottie JSON optimized for iOS/Android — 30fps, capped keyframes, minimal bundle.",
    fileExtension: "json",
    recommendedFor: ["Mobile app animations", "Cross-platform native", "Small bundle size"],
  },
  {
    id: "preset-social-square",
    name: "Social Square",
    platform: "social-video",
    format: "mp4",
    description: "1080×1080 square MP4 for Instagram feeds, Twitter, Facebook — infinite loop, 30fps.",
    fileExtension: "mp4",
    recommendedFor: ["Instagram feed", "Twitter/X video", "Facebook video ads"],
  },
  {
    id: "preset-social-story",
    name: "Social Story",
    platform: "social-video",
    format: "mp4",
    description: "1080×1920 vertical MP4 for Stories, TikTok, YouTube Shorts — infinite loop, 30fps.",
    fileExtension: "mp4",
    recommendedFor: ["Instagram Stories", "TikTok", "YouTube Shorts", "Vertical ads"],
  },
  {
    id: "preset-email-inline",
    name: "Email Inline CSS",
    platform: "email",
    format: "css",
    description: "CSS-only animation, all styles inlined, 8 keyframe cap — Apple Mail and Outlook compatible.",
    fileExtension: "css",
    recommendedFor: ["Email newsletters", "Apple Mail", "No-JS environments"],
  },
  {
    id: "preset-embed-snippet",
    name: "Embed Snippet",
    platform: "embed",
    format: "html",
    description: "Minimal HTML for iframe embedding — compact, self-contained, transparent background.",
    fileExtension: "html",
    recommendedFor: ["Blog embeds", "iframe widgets", "Overlay banners"],
  },
  {
    id: "preset-figma-spec",
    name: "Design Tool Spec",
    platform: "figma",
    format: "json",
    description: "Structured JSON matching design tool plugin schemas — import directly into design tools.",
    fileExtension: "json",
    recommendedFor: ["Design tool sync", "Design-to-dev handoff", "Plugin import"],
  },
];

function sendAgentMessage(projectId: string, prompt: string) {
  useChatStore.getState().send(projectId, prompt);
}

const PLATFORM_ICONS: Record<string, string> = {
  web: "🌐",
  react: "⚛",
  vue: "◆",
  "mobile-lottie": "📱",
  "social-video": "🎬",
  email: "✉",
  embed: "📦",
  figma: "◉",
};

export function ExportPresetsPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? PRESETS.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase()) ||
          p.platform.toLowerCase().includes(query.toLowerCase()) ||
          p.format.toLowerCase().includes(query.toLowerCase()),
      )
    : PRESETS;

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        No project loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Export Presets
          </span>
          <span className="text-[9px] text-gray-600 font-mono">{PRESETS.length}</span>
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search presets..."
            className="flex-1 bg-bg px-2 py-1 text-[10px] text-gray-300 border border-edge focus:border-gray-500 focus:outline-none"
          />
          <button
            onClick={() => sendAgentMessage(projectId, "Recommend the best export format for this project")}
            title="Analyze project and recommend best format"
            aria-label="Recommend best export format"
            className="px-2 py-1 text-[10px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
          >
            Recommend
          </button>
        </div>
      </div>

      {/* Preset list */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-4 py-6 text-center text-[10px] text-gray-600">
            No presets match your search.
          </div>
        ) : (
          <div className="divide-y divide-edge">
            {filtered.map((preset) => (
              <div key={preset.id} className="px-3 py-2 hover:bg-panel2 transition-colors">
                <div className="flex items-start gap-2 mb-1">
                  <span className="text-sm flex-shrink-0 mt-0.5">{PLATFORM_ICONS[preset.platform] ?? "📄"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-medium text-gray-200 truncate">
                        {preset.name}
                      </span>
                      <span className="text-[8px] text-gray-600 font-mono uppercase flex-shrink-0">
                        .{preset.fileExtension}
                      </span>
                    </div>
                    <p className="text-[9px] text-gray-500 line-clamp-2 mt-0.5">
                      {preset.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {preset.recommendedFor.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="text-[8px] px-1 py-0.5 bg-bg text-gray-600 border border-edge font-mono"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() =>
                    sendAgentMessage(
                      projectId,
                      `Apply the export preset "${preset.name}" to export this project`,
                    )
                  }
                  className="w-full px-2 py-1 text-[9px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-400 transition-colors"
                  title={`Export using the ${preset.name} preset`}
                >
                  Export as {preset.format.toUpperCase()}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
