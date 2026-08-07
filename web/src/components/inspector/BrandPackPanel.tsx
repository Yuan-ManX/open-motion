import { useMemo, useState, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";
import * as api from "../../api/endpoints.js";

interface BrandPackSummary {
  id: string;
  name: string;
  description: string;
  energy: number;
  formality: number;
  playfulness: number;
  precision: number;
  defaultTrigger: string;
  loopPhilosophy: string;
}

const PACKS_KEY = "__brandPacks";

function readPacksFromTokens(tokens: Record<string, string | number> | undefined): BrandPackSummary[] {
  if (!tokens) return [];
  const raw = tokens[PACKS_KEY];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as BrandPackSummary[];
  } catch {
    return [];
  }
}

function sendAgentMessage(projectId: string, prompt: string) {
  useChatStore.getState().send(projectId, prompt);
}

function PersonalityBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] text-gray-600 w-12 font-mono uppercase">{label}</span>
      <div className="flex-1 h-1 bg-bg border border-edge">
        <div className="h-full bg-gray-400" style={{ width: `${value * 10}%` }} />
      </div>
      <span className="text-[8px] text-gray-600 font-mono w-4 text-right">{value}</span>
    </div>
  );
}

export function BrandPackPanel() {
  const project = useProjectStore((s) => s.project);
  const projectId = useProjectStore((s) => s.projectId);
  const loadProject = useProjectStore((s) => s.loadProject);

  const packs = useMemo(() => readPacksFromTokens(project?.tokens), [project?.tokens]);

  // Style presets — shared baseline motion feel (easing, duration, direction).
  // Applied directly via the style/apply endpoint so the user gets a response
  // in a single round trip instead of waiting for an LLM turn.
  const [stylePresets, setStylePresets] = useState<api.StylePreset[]>([]);
  const [applyingStyleId, setApplyingStyleId] = useState<string | null>(null);
  const [appliedStyleId, setAppliedStyleId] = useState<string | null>(null);

  // Motion themes — full identity presets with easing family, timing scale,
  // and vocabulary guidance. Shipped as a separate section from style
  // presets because themes are higher-order: they tune the agent's language
  // and motion personality together, not just the raw easing math.
  const [themes, setThemes] = useState<api.MotionThemeInfo[]>([]);
  const [themesLoading, setThemesLoading] = useState(true);
  const [applyingThemeId, setApplyingThemeId] = useState<string | null>(null);
  const [appliedThemeId, setAppliedThemeId] = useState<string | null>(null);
  const [themeQuery, setThemeQuery] = useState("");
  const [personalityFilter, setPersonalityFilter] = useState<string>("all");

  useEffect(() => {
    api.listStylePresets()
      .then(setStylePresets)
      .catch(() => setStylePresets([]));
    setThemesLoading(true);
    api.listMotionThemes()
      .then((r) => setThemes(r.themes))
      .catch(() => setThemes([]))
      .finally(() => setThemesLoading(false));
  }, []);

  const personalities = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of themes) map.set(t.personality, (map.get(t.personality) ?? 0) + 1);
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [themes]);

  const themesFiltered = useMemo(() => {
    const q = themeQuery.trim().toLowerCase();
    const base = personalityFilter === "all" ? themes : themes.filter((t) => t.personality === personalityFilter);
    if (!q) return base;
    return base.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((x) => x.toLowerCase().includes(q)) ||
        t.personality.toLowerCase().includes(q),
    );
  }, [themes, personalityFilter, themeQuery]);

  // Apply a style preset directly (no LLM). Updates every component in the
  // project so the whole composition shares one motion feel.
  const applyStyle = async (presetId: string) => {
    if (!projectId || applyingStyleId) return;
    setApplyingStyleId(presetId);
    try {
      await api.applyStylePreset(projectId, presetId, true);
      await loadProject(projectId);
      setAppliedStyleId(presetId);
      setTimeout(() => setAppliedStyleId((cur) => (cur === presetId ? null : cur)), 1600);
    } finally {
      setApplyingStyleId(null);
    }
  };

  // Apply a motion theme directly — updates components' easing, durations,
  // and returns a compatibility report so the user can see how well the
  // theme's personality matches their current composition.
  const applyTheme = async (themeId: string) => {
    if (!projectId || applyingThemeId) return;
    setApplyingThemeId(themeId);
    try {
      const res = await api.applyMotionTheme(projectId, { themeId, apply: true });
      if (res.applied) {
        await loadProject(projectId);
        setAppliedThemeId(themeId);
        setTimeout(() => setAppliedThemeId((cur) => (cur === themeId ? null : cur)), 1600);
      }
    } finally {
      setApplyingThemeId(null);
    }
  };

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        No project loaded.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Style Presets section — one-click apply directly to components */}
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Style Presets
          </span>
          <span className="text-[9px] text-gray-600 font-mono">{stylePresets.length}</span>
        </div>
        <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
          {stylePresets.map((preset) => {
            const isApplying = applyingStyleId === preset.id;
            const isApplied = appliedStyleId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => void applyStyle(preset.id)}
                disabled={!!applyingStyleId}
                className={`px-1.5 py-1 text-[9px] border transition-colors text-left disabled:opacity-40 ${
                  isApplied
                    ? "bg-accent/15 border-accent text-accent"
                    : "border-edge text-gray-400 hover:text-gray-100 hover:border-gray-400"
                }`}
                title={`${preset.description}\n${preset.easing.type === "preset" ? preset.easing.name : preset.easing.type} / ${preset.durationMs}ms / ${preset.iterationCount}x / ${preset.direction}`}
              >
                <div className="flex items-center gap-1">
                  <span className="font-medium text-gray-300 truncate flex-1">{preset.name}</span>
                  {isApplying && <span className="text-[8px] text-gray-500 animate-pulse">…</span>}
                  {isApplied && <span className="text-[8px] text-accent">✓</span>}
                </div>
                <span className="block text-[8px] text-gray-600 font-mono">{preset.durationMs}ms</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Motion Themes section — full motion identity presets */}
      <div className="border-b border-edge flex-shrink-0">
        <div className="px-3 py-2 flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Motion Themes
          </span>
          <span className="text-[9px] text-gray-600 font-mono">
            {themesLoading ? "…" : `${themes.length} total`}
          </span>
        </div>
        <div className="px-3 pb-2 space-y-1">
          <div className="relative">
            <input
              type="text"
              value={themeQuery}
              onChange={(e) => setThemeQuery(e.target.value)}
              placeholder="Search themes — playful, calm, cinematic…"
              className="w-full text-[10px] bg-bg border border-edge rounded px-2 py-1 text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-gray-500"
            />
            {themeQuery && (
              <button
                onClick={() => setThemeQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-[10px]"
                aria-label="Clear theme search"
              >
                ✕
              </button>
            )}
          </div>
          {!themeQuery && personalities.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <button
                onClick={() => setPersonalityFilter("all")}
                className={`text-[8px] px-1.5 py-0.5 rounded-full border transition-colors ${
                  personalityFilter === "all" ? "border-accent text-accent" : "border-edge text-gray-500 hover:text-gray-300"
                }`}
              >
                All ({themes.length})
              </button>
              {personalities.map(([p, count]) => (
                <button
                  key={p}
                  onClick={() => setPersonalityFilter(p)}
                  className={`text-[8px] px-1.5 py-0.5 rounded-full border capitalize transition-colors ${
                    personalityFilter === p ? "border-accent text-accent" : "border-edge text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {p} ({count})
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-3 pb-2 max-h-48 overflow-y-auto space-y-1">
          {themesFiltered.length === 0 ? (
            <div className="text-center text-[10px] text-gray-600 py-3">
              {themesLoading ? "Loading themes…" : "No themes match your search."}
            </div>
          ) : (
            themesFiltered.map((t) => {
              const isApplying = applyingThemeId === t.id;
              const isApplied = appliedThemeId === t.id;
              return (
                <div
                  key={t.id}
                  className="group w-full rounded border border-edge bg-panel2/40 hover:border-accent transition-colors px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[8px] px-1 py-0.5 rounded bg-edge text-gray-400 uppercase tracking-wide flex-shrink-0">
                      {t.personality}
                    </span>
                    <span className="text-[10px] font-medium text-gray-200 group-hover:text-accent truncate flex-1">
                      {t.name}
                    </span>
                    <span className="text-[8px] text-gray-600 font-mono">
                      ×{t.timingScale.standard.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[8px] text-gray-500 line-clamp-1 mb-1">{t.description}</p>
                  <div className="flex items-center gap-1 mb-1 flex-wrap">
                    {t.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[7px] px-1 py-0.5 rounded bg-bg text-gray-500 border border-edge font-mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void applyTheme(t.id)}
                      disabled={!!applyingThemeId}
                      className={`flex-1 text-[9px] px-2 py-0.5 rounded border transition-colors ${
                        isApplied
                          ? "bg-accent/15 border-accent text-accent"
                          : "border-edge text-gray-400 hover:text-gray-100 hover:border-gray-400 disabled:opacity-40"
                      }`}
                      title="Apply this motion identity to all components"
                    >
                      {isApplying ? "Applying…" : isApplied ? "✓ Applied" : "Apply Identity"}
                    </button>
                    <button
                      onClick={() =>
                        sendAgentMessage(
                          projectId,
                          `Explain the "${t.name}" motion theme identity and suggest content that fits its ${t.personality} personality.`,
                        )
                      }
                      className="text-[9px] px-2 py-0.5 rounded border border-edge text-gray-600 hover:text-gray-300 hover:border-gray-400 transition-colors"
                      title="Ask the agent about this theme"
                    >
                      Ask
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Brand Packs header */}
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
            Brand Packs
          </span>
          <span className="text-[9px] text-gray-600 font-mono">{packs.length}</span>
        </div>
        <button
          onClick={() => sendAgentMessage(projectId, "Seed brand packs")}
          title="Load built-in brand pack presets"
          aria-label="Seed brand pack presets"
          className="w-full px-2 py-1 text-[10px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors"
        >
          + Seed Presets
        </button>
      </div>

      {/* Saved brand pack list — stored on project tokens */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {packs.length === 0 ? (
          <div className="px-4 py-6 text-center text-[10px] text-gray-600 leading-relaxed">
            No brand packs yet. Click Seed Presets to load 5 built-in motion identities:
            Minimal Reserve, Material Expressive, Playful Dynamic, Cinematic Flow, Technical Precision.
          </div>
        ) : (
          <div className="divide-y divide-edge">
            {packs.map((pack) => (
              <div key={pack.id} className="px-3 py-2.5 hover:bg-panel2 transition-colors group">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-[11px] font-medium text-gray-200">{pack.name}</span>
                  <button
                    onClick={() =>
                      sendAgentMessage(projectId, `Delete the brand pack "${pack.name}"`)
                    }
                    title="Delete brand pack"
                    aria-label={`Delete brand pack ${pack.name}`}
                    className="text-[10px] text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                </div>
                {pack.description && (
                  <p className="text-[9px] text-gray-500 mb-2 line-clamp-2">{pack.description}</p>
                )}
                <div className="space-y-1 mb-2">
                  <PersonalityBar label="Energy" value={pack.energy} />
                  <PersonalityBar label="Formal" value={pack.formality} />
                  <PersonalityBar label="Play" value={pack.playfulness} />
                  <PersonalityBar label="Precis" value={pack.precision} />
                </div>
                <div className="flex items-center gap-2 text-[9px] text-gray-600 font-mono mb-2">
                  <span title="Default trigger">{pack.defaultTrigger}</span>
                  <span>·</span>
                  <span title="Loop philosophy">{pack.loopPhilosophy}</span>
                </div>
                <button
                  onClick={() =>
                    sendAgentMessage(
                      projectId,
                      `Apply the "${pack.name}" brand pack to all components`,
                    )
                  }
                  className="w-full px-2 py-1 text-[9px] text-gray-400 border border-edge hover:text-gray-100 hover:border-gray-400 transition-colors"
                  title="Apply this brand pack to all components"
                >
                  Apply to All
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
