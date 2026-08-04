import { useEffect, useState, useMemo, useCallback } from "react";
import * as api from "../../api/endpoints.js";
import type {
  ScenePack,
  SceneVertical,
  SceneApplyResult,
} from "../../api/endpoints.js";
import { useProjectStore } from "../../store/projectStore.js";

const VERTICALS: SceneVertical[] = [
  "marketing",
  "dashboard",
  "ecommerce",
  "onboarding",
  "states",
  "communication",
  "presentation",
];

/**
 * Scene Packs panel — surfaces the vertical scene pack library. Each pack
 * orchestrates a sequence of template-driven slots into a cohesive product
 * moment (hero, dashboard load, checkout success, etc.). Clicking a pack
 * materializes every slot into the open project via the apply endpoint.
 */
export function ScenePacksPanel() {
  const [packs, setPacks] = useState<ScenePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVertical, setActiveVertical] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectId = useProjectStore((s) => s.projectId);
  const loadProject = useProjectStore((s) => s.loadProject);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listScenes()
      .then((r) => {
        if (!cancelled) setPacks(r.packs);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load scene packs.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (activeVertical === "all") return packs;
    return packs.filter((p) => p.vertical === activeVertical);
  }, [packs, activeVertical]);

  const handleApply = useCallback(
    async (pack: ScenePack) => {
      if (!projectId || applyingId) return;
      setApplyingId(pack.id);
      setError(null);
      try {
        const result: SceneApplyResult = await api.applyScene(projectId, pack.id);
        await loadProject(projectId);
        setAppliedId(pack.id);
        setTimeout(
          () => setAppliedId((cur) => (cur === pack.id ? null : cur)),
          1800,
        );
        // Surface skipped slots so the user knows if any template was missing.
        if (result.skippedSlotCount > 0) {
          setError(
            `${result.skippedSlotCount} slot(s) skipped — template ids could not be resolved.`,
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to apply scene pack.");
      } finally {
        setApplyingId(null);
      }
    },
    [projectId, applyingId, loadProject],
  );

  if (loading) {
    return <div className="p-4 text-xs text-gray-500">Loading scene packs…</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-2 py-1.5 border-b border-edge bg-panel2 flex-shrink-0">
        <div className="text-[9px] text-gray-500 flex items-center gap-1">
          <span className="text-accent">●</span>
          <span>Vertical scene library ({packs.length} packs)</span>
        </div>
      </div>

      {/* Vertical filter */}
      <div className="flex gap-1 px-2 pt-1.5 pb-1 flex-wrap flex-shrink-0">
        <button
          onClick={() => setActiveVertical("all")}
          className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
            activeVertical === "all"
              ? "border-accent text-accent"
              : "border-edge text-gray-500 hover:text-gray-300"
          }`}
        >
          All ({packs.length})
        </button>
        {VERTICALS.map((v) => {
          const count = packs.filter((p) => p.vertical === v).length;
          if (count === 0) return null;
          return (
            <button
              key={v}
              onClick={() => setActiveVertical(v)}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors capitalize ${
                activeVertical === v
                  ? "border-accent text-accent"
                  : "border-edge text-gray-500 hover:text-gray-300"
              }`}
            >
              {v} ({count})
            </button>
          );
        })}
      </div>

      {error && (
        <div className="px-2 py-1 text-[10px] text-yellow-400 border-b border-edge flex-shrink-0">
          {error}
        </div>
      )}

      {/* Pack list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5">
        {filtered.map((pack) => {
          const isExpanded = expandedId === pack.id;
          const isApplying = applyingId === pack.id;
          const isApplied = appliedId === pack.id;
          return (
            <div
              key={pack.id}
              className="rounded-lg border border-edge bg-panel2 hover:border-accent transition-colors overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : pack.id)}
                className="w-full text-left px-2 py-1.5"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] px-1 py-0.5 rounded bg-edge text-gray-400 uppercase tracking-wide flex-shrink-0">
                    {pack.vertical}
                  </span>
                  <span className="text-[11px] font-medium text-gray-200 flex-1 truncate">
                    {pack.name}
                  </span>
                  <span className="text-[9px] text-gray-600 font-mono flex-shrink-0">
                    {pack.slots.length} slots
                  </span>
                </div>
                <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-2">
                  {pack.description}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[8px] text-gray-600 font-mono">
                    ⬗ {pack.choreography}
                  </span>
                  <span className="text-[8px] text-gray-600 font-mono">
                    ⌛ {pack.totalDurationMs}ms
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-2 pb-2 pt-0.5 border-t border-edge/50">
                  {/* Slot timeline */}
                  <div className="text-[8px] uppercase tracking-wide text-gray-600 mt-1.5 mb-1">
                    Slot sequence
                  </div>
                  <div className="space-y-0.5">
                    {pack.slots.map((slot, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-[9px] py-0.5"
                      >
                        <span className="text-gray-600 font-mono w-8 flex-shrink-0">
                          +{slot.delayMs}ms
                        </span>
                        <span className="text-gray-400 w-24 flex-shrink-0 truncate">
                          {slot.role}
                        </span>
                        <span className="text-gray-600 font-mono truncate flex-1">
                          {slot.templateId}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Recommended styles */}
                  {pack.recommendedStyles.length > 0 && (
                    <div className="mt-1.5">
                      <div className="text-[8px] uppercase tracking-wide text-gray-600 mb-1">
                        Pairs with
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {pack.recommendedStyles.map((s) => (
                          <span
                            key={s}
                            className="text-[9px] px-1 py-0.5 rounded bg-edge text-gray-400"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Apply action */}
                  <button
                    onClick={() => void handleApply(pack)}
                    disabled={!projectId || isApplying}
                    className="mt-2 w-full text-[10px] px-2 py-1 rounded bg-accent hover:bg-accent2 disabled:opacity-40 text-black font-medium transition-colors"
                    title={
                      projectId
                        ? "Materialize every slot into the current project"
                        : "Open a project first"
                    }
                  >
                    {isApplying
                      ? "Applying…"
                      : isApplied
                        ? "✓ Applied"
                        : `Apply ${pack.slots.length} slots to timeline`}
                  </button>
                  {!projectId && (
                    <div className="text-[9px] text-gray-600 mt-1 text-center">
                      Open a project to apply
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-[11px] text-gray-600 py-8">
            No scene packs in this vertical.
          </div>
        )}
      </div>
    </div>
  );
}
