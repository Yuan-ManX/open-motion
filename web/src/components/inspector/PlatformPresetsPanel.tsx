import { useEffect, useState, useMemo } from "react";
import * as api from "../../api/endpoints.js";
import type {
  PlatformMotionPreset,
  MotionPlatform,
  PlatformPresetMatchResult,
} from "../../api/endpoints.js";

const PLATFORMS: MotionPlatform[] = ["ios", "android", "macos", "web", "windows"];

const PLATFORM_GLYPH: Record<MotionPlatform, string> = {
  ios: "",
  android: "▣",
  macos: "",
  web: "◈",
  windows: "⊞",
};

/**
 * Platform Motion Presets panel — surfaces the native motion dialect of each
 * target platform (iOS spring, Android Material, macOS elastic, Web standard,
 * Windows Fluent). Each preset exposes its easing curves, spring constants,
 * corner radius, shadow idiom, and stagger timing so a project can switch
 * motion languages by selecting a platform. Includes a free-text matcher that
 * resolves a natural-language hint to the closest preset.
 */
export function PlatformPresetsPanel() {
  const [presets, setPresets] = useState<PlatformMotionPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePlatform, setActivePlatform] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [matchQuery, setMatchQuery] = useState<string>("");
  const [matchResult, setMatchResult] = useState<PlatformPresetMatchResult | null>(null);
  const [matching, setMatching] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listPlatformPresets()
      .then((r) => {
        if (!cancelled) setPresets(r.presets);
      })
      .catch(() => {
        if (!cancelled) setPresets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (activePlatform === "all") return presets;
    return presets.filter((p) => p.platform === activePlatform);
  }, [presets, activePlatform]);

  const handleMatch = () => {
    const q = matchQuery.trim();
    if (!q) {
      setMatchResult(null);
      return;
    }
    setMatching(true);
    api
      .matchPlatformPreset(q)
      .then(setMatchResult)
      .catch(() => setMatchResult({ query: q, match: null }))
      .finally(() => setMatching(false));
  };

  const handleCopyId = async (preset: PlatformMotionPreset) => {
    try {
      await navigator.clipboard.writeText(preset.id);
      setCopiedId(preset.id);
      setTimeout(
        () => setCopiedId((cur) => (cur === preset.id ? null : cur)),
        1400,
      );
    } catch {
      /* clipboard unavailable */
    }
  };

  if (loading) {
    return <div className="p-4 text-xs text-gray-500">Loading platform presets…</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-edge bg-panel2 flex-shrink-0">
        <div className="text-[9px] text-gray-500 flex items-center gap-1">
          <span className="text-accent">●</span>
          <span>Platform motion dialects ({presets.length})</span>
        </div>
      </div>

      {/* Free-text matcher */}
      <div className="px-2 pt-2 pb-1.5 border-b border-edge flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            value={matchQuery}
            onChange={(e) => setMatchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleMatch();
            }}
            placeholder="Describe a platform feel — “ios app”, “material”, “fluent”…"
            className="w-full text-[11px] bg-ink border border-edge rounded-md pl-2 pr-7 py-1.5 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={handleMatch}
            disabled={matching || !matchQuery.trim()}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded text-accent hover:bg-accent hover:text-black disabled:opacity-40 transition-colors"
            aria-label="Match platform preset"
          >
            {matching ? "…" : "match"}
          </button>
        </div>
        {matchResult && (
          <div className="mt-1 text-[9px] text-gray-500">
            {matchResult.match ? (
              <span>
                Best match:{" "}
                <span className="text-gray-300">{matchResult.match.name}</span>{" "}
                ({matchResult.match.platform})
              </span>
            ) : (
              <span>No preset matched “{matchResult.query}”.</span>
            )}
          </div>
        )}
      </div>

      {/* Platform filter */}
      <div className="flex gap-1 px-2 pt-1.5 pb-1 flex-wrap flex-shrink-0">
        <button
          onClick={() => setActivePlatform("all")}
          className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
            activePlatform === "all"
              ? "border-accent text-accent"
              : "border-edge text-gray-500 hover:text-gray-300"
          }`}
        >
          All ({presets.length})
        </button>
        {PLATFORMS.map((p) => {
          const count = presets.filter((x) => x.platform === p).length;
          if (count === 0) return null;
          return (
            <button
              key={p}
              onClick={() => setActivePlatform(p)}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors capitalize ${
                activePlatform === p
                  ? "border-accent text-accent"
                  : "border-edge text-gray-500 hover:text-gray-300"
              }`}
            >
              {PLATFORM_GLYPH[p]} {p} ({count})
            </button>
          );
        })}
      </div>

      {/* Preset list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {filtered.map((preset) => {
          const isExpanded = expandedId === preset.id;
          const isMatch = matchResult?.match?.id === preset.id;
          return (
            <div
              key={preset.id}
              className={`rounded-lg border bg-panel2 hover:border-accent transition-colors overflow-hidden ${
                isMatch ? "border-accent" : "border-edge"
              }`}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : preset.id)}
                className="w-full text-left px-2 py-1.5"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-400 flex-shrink-0">
                    {PLATFORM_GLYPH[preset.platform]}
                  </span>
                  <span className="text-[8px] px-1 py-0.5 rounded bg-edge text-gray-400 uppercase tracking-wide flex-shrink-0">
                    {preset.platform}
                  </span>
                  <span className="text-[11px] font-medium text-gray-200 flex-1 truncate">
                    {preset.name}
                  </span>
                  {isMatch && (
                    <span className="text-[8px] text-accent font-mono">★ match</span>
                  )}
                </div>
                <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-2">
                  {preset.description}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[8px] text-gray-600 font-mono">
                  <span>⌛ {preset.durationMs}ms</span>
                  <span>▢ r{preset.cornerRadius}</span>
                  <span>↦ {preset.staggerStepMs}ms</span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-2 pb-2 pt-0.5 border-t border-edge/50 space-y-1.5">
                  {/* Easing trio */}
                  <div>
                    <div className="text-[8px] uppercase tracking-wide text-gray-600 mb-1">
                      Easing
                    </div>
                    <div className="space-y-0.5 text-[9px]">
                      <EasingRow label="standard" easing={preset.easing} />
                      <EasingRow label="entrance" easing={preset.entranceEasing} />
                      <EasingRow label="exit" easing={preset.exitEasing} />
                    </div>
                  </div>

                  {/* Spring config */}
                  {preset.spring && (
                    <div>
                      <div className="text-[8px] uppercase tracking-wide text-gray-600 mb-1">
                        Spring
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[9px]">
                        <SpringStat label="stiffness" value={preset.spring.stiffness} />
                        <SpringStat label="damping" value={preset.spring.damping} />
                        <SpringStat label="mass" value={preset.spring.mass} />
                      </div>
                    </div>
                  )}

                  {/* Shadow preview */}
                  <div>
                    <div className="text-[8px] uppercase tracking-wide text-gray-600 mb-1">
                      Shadow
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-10 h-8 rounded bg-panel"
                        style={{ boxShadow: preset.shadowStyle }}
                      />
                      <span className="text-[9px] text-gray-500 font-mono break-all">
                        {preset.shadowStyle}
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex gap-1 flex-wrap">
                    {preset.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[9px] px-1 py-0.5 rounded bg-edge text-gray-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={() => void handleCopyId(preset)}
                    className="w-full text-[10px] px-2 py-1 rounded border border-edge text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors"
                  >
                    {copiedId === preset.id ? "✓ Copied id" : "Copy preset id"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-[11px] text-gray-600 py-8">
            No presets for this platform.
          </div>
        )}
      </div>
    </div>
  );
}

function EasingRow({
  label,
  easing,
}: {
  label: string;
  easing: { type: string; name?: string; p1?: [number, number]; p2?: [number, number]; stiffness?: number; damping?: number; mass?: number };
}) {
  let detail = "";
  if (easing.type === "preset") {
    detail = easing.name ?? "";
  } else if (easing.type === "bezier") {
    detail = `(${easing.p1?.[0]}, ${easing.p1?.[1]}) → (${easing.p2?.[0]}, ${easing.p2?.[1]})`;
  } else if (easing.type === "spring") {
    detail = `stiffness=${easing.stiffness} damping=${easing.damping} mass=${easing.mass}`;
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-500 w-14 flex-shrink-0">{label}</span>
      <span className="text-[8px] px-1 py-0.5 rounded bg-edge text-gray-500 uppercase tracking-wide flex-shrink-0">
        {easing.type}
      </span>
      <span className="text-gray-400 font-mono truncate">{detail}</span>
    </div>
  );
}

function SpringStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-1.5 py-0.5 rounded border border-edge">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300 font-mono">{value}</span>
    </div>
  );
}
