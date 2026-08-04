import { useEffect, useState, useMemo, useCallback } from "react";
import * as api from "../../api/endpoints.js";
import type { ColorMotionPalette } from "../../api/endpoints.js";

/**
 * Color Motion Palettes panel — surfaces the curated palette library. Each
 * palette ships base + accent + ordered stops plus named motion pairs
 * (from → to with an emotional mood label) so the designer can pick
 * transitions by feeling rather than by hex code. Gradient previews are
 * rendered locally from the stops so no extra round trip is needed.
 */
export function ColorPalettesPanel() {
  const [palettes, setPalettes] = useState<ColorMotionPalette[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listColorPalettes()
      .then((r) => {
        if (!cancelled) setPalettes(r.palettes);
      })
      .catch(() => {
        if (!cancelled) setPalettes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const p of palettes) for (const t of p.tags) set.add(t);
    return Array.from(set).sort();
  }, [palettes]);

  const filtered = useMemo(() => {
    if (activeTag === "all") return palettes;
    return palettes.filter((p) => p.tags.includes(activeTag));
  }, [palettes, activeTag]);

  const handleCopyGradient = useCallback(async (palette: ColorMotionPalette) => {
    // Build the same CSS gradient the backend produces so the clipboard
    // holds a ready-to-paste value without a detail round trip.
    const gradient = `linear-gradient(135deg, ${palette.stops.join(", ")})`;
    try {
      await navigator.clipboard.writeText(gradient);
      setCopiedId(palette.id);
      setTimeout(
        () => setCopiedId((cur) => (cur === palette.id ? null : cur)),
        1400,
      );
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  const handleCopyId = useCallback(async (palette: ColorMotionPalette) => {
    try {
      await navigator.clipboard.writeText(palette.id);
      setCopiedId(`${palette.id}-id`);
      setTimeout(
        () => setCopiedId((cur) => (cur === `${palette.id}-id` ? null : cur)),
        1400,
      );
    } catch {
      /* clipboard unavailable */
    }
  }, []);

  if (loading) {
    return <div className="p-4 text-xs text-gray-500">Loading palettes…</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-edge bg-panel2 flex-shrink-0">
        <div className="text-[9px] text-gray-500 flex items-center gap-1">
          <span className="text-accent">●</span>
          <span>Motion palettes ({palettes.length})</span>
        </div>
      </div>

      {/* Tag filter */}
      {tags.length > 0 && (
        <div className="flex gap-1 px-2 pt-1.5 pb-1 flex-wrap flex-shrink-0">
          <button
            onClick={() => setActiveTag("all")}
            className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
              activeTag === "all"
                ? "border-accent text-accent"
                : "border-edge text-gray-500 hover:text-gray-300"
            }`}
          >
            All ({palettes.length})
          </button>
          {tags.map((t) => {
            const count = palettes.filter((p) => p.tags.includes(t)).length;
            return (
              <button
                key={t}
                onClick={() => setActiveTag(t)}
                className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors capitalize ${
                  activeTag === t
                    ? "border-accent text-accent"
                    : "border-edge text-gray-500 hover:text-gray-300"
                }`}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Palette list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {filtered.map((palette) => {
          const isExpanded = expandedId === palette.id;
          const gradient = `linear-gradient(135deg, ${palette.stops.join(", ")})`;
          const copiedGradient = copiedId === palette.id;
          const copiedIdState = copiedId === `${palette.id}-id`;
          return (
            <div
              key={palette.id}
              className="rounded-lg border border-edge bg-panel2 hover:border-accent transition-colors overflow-hidden"
            >
              {/* Gradient preview */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : palette.id)}
                className="w-full text-left"
              >
                <div
                  className="h-14 w-full"
                  style={{ background: gradient }}
                  aria-label={`${palette.name} gradient preview`}
                />
                <div className="px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-gray-200 flex-1 truncate">
                      {palette.name}
                    </span>
                    {/* Base + accent swatches */}
                    <span
                      className="w-3 h-3 rounded-full border border-edge"
                      style={{ background: palette.base }}
                      title={`base ${palette.base}`}
                    />
                    <span
                      className="w-3 h-3 rounded-full border border-edge"
                      style={{ background: palette.accent }}
                      title={`accent ${palette.accent}`}
                    />
                  </div>
                  <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-2">
                    {palette.description}
                  </p>
                </div>
              </button>

              {isExpanded && (
                <div className="px-2 pb-2 pt-0.5 border-t border-edge/50">
                  {/* Stop strip */}
                  <div className="text-[8px] uppercase tracking-wide text-gray-600 mt-1.5 mb-1">
                    Stops
                  </div>
                  <div className="flex h-4 rounded overflow-hidden border border-edge">
                    {palette.stops.map((s, i) => (
                      <div
                        key={i}
                        className="flex-1"
                        style={{ background: s }}
                        title={s}
                      />
                    ))}
                  </div>

                  {/* Motion pairs */}
                  <div className="text-[8px] uppercase tracking-wide text-gray-600 mt-2 mb-1">
                    Motion pairs
                  </div>
                  <div className="space-y-0.5">
                    {palette.motionPairs.map((pair, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-[9px]"
                      >
                        <span
                          className="w-3 h-3 rounded border border-edge flex-shrink-0"
                          style={{ background: pair.from }}
                        />
                        <span className="text-gray-600">→</span>
                        <span
                          className="w-3 h-3 rounded border border-edge flex-shrink-0"
                          style={{ background: pair.to }}
                        />
                        <span className="text-gray-400 ml-auto capitalize">
                          {pair.mood}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => void handleCopyGradient(palette)}
                      className="flex-1 text-[10px] px-1.5 py-1 rounded border border-accent text-accent hover:bg-accent hover:text-black transition-colors"
                    >
                      {copiedGradient ? "✓ Copied" : "Copy CSS gradient"}
                    </button>
                    <button
                      onClick={() => void handleCopyId(palette)}
                      className="text-[10px] px-1.5 py-1 rounded border border-edge text-gray-400 hover:text-gray-200 hover:border-gray-400 transition-colors"
                      title="Copy palette id for use in chat"
                    >
                      {copiedIdState ? "✓" : "Copy id"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-[11px] text-gray-600 py-8">
            No palettes match this tag.
          </div>
        )}
      </div>
    </div>
  );
}
