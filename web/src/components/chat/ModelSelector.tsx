import { useState, useEffect, useRef, useMemo } from "react";
import * as api from "../../api/endpoints.js";
import type { RegistryModel, ProvidersStatus } from "../../api/endpoints.js";

const STORAGE_KEY = "openmotion.selectedModel";

/** Persist the user's model choice across sessions. */
export function getSelectedModel(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveSelectedModel(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* localStorage may be unavailable in private contexts */
  }
}

/** Short human label for a model id (strips version suffixes). */
function shortName(model: RegistryModel): string {
  return model.name || model.id;
}

/** Compact capability tags rendered next to each model entry. */
function capabilityTags(m: RegistryModel): string[] {
  const tags: string[] = [];
  if (m.capabilities.vision) tags.push("vision");
  if (m.capabilities.toolUse) tags.push("tools");
  if (m.capabilities.reasoning) tags.push("reason");
  if (m.capabilities.imageGeneration) tags.push("image");
  if (m.capabilities.videoGeneration) tags.push("video");
  if (m.capabilities.audioOutput) tags.push("voice");
  return tags;
}

/**
 * ChatGPT-style model picker. Sits at the top of the chat form and lists
 * every model registered in the backend provider registry, grouped by
 * provider. Configured providers (those with API keys) are surfaced first.
 * The selection persists in localStorage and is forwarded with each chat
 * request so the backend router can honour it.
 */
export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<RegistryModel[]>([]);
  const [status, setStatus] = useState<ProvidersStatus | null>(null);
  const [selected, setSelected] = useState<string | null>(getSelectedModel());
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load the provider status and full model registry on mount.
  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listProviders(), api.listProviderModels()])
      .then(([s, m]) => {
        if (cancelled) return;
        setStatus(s);
        setModels(m.models);
        // Default to the active provider's configured model when nothing is
        // stored yet, so the picker reflects the real backend state.
        if (!selected && s.configs.length > 0) {
          setSelected(s.configs[0].model);
        }
      })
      .catch(() => {
        /* backend may be unreachable; selector stays empty */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Group models by provider, configured providers first.
  const grouped = useMemo(() => {
    const configuredTypes = new Set(status?.configs.map((c) => c.type) ?? []);
    const groups = new Map<string, RegistryModel[]>();
    for (const m of models) {
      const list = groups.get(m.provider) ?? [];
      list.push(m);
      groups.set(m.provider, list);
    }
    const entries = Array.from(groups.entries());
    // Sort so configured providers appear at the top, then alphabetically.
    entries.sort((a, b) => {
      const ac = configuredTypes.has(a[0]) ? 0 : 1;
      const bc = configuredTypes.has(b[0]) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [models, status]);

  const configuredTypes = new Set(status?.configs.map((c) => c.type) ?? []);
  const selectedModel = models.find((m) => m.id === selected || m.name === selected);

  const handlePick = (m: RegistryModel) => {
    setSelected(m.id);
    saveSelectedModel(m.id);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-gray-400 hover:text-gray-200 hover:bg-panel transition-colors"
        title="Select model"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="text-gray-500">◇</span>
        <span className="font-medium truncate max-w-[160px]">
          {loading ? "Loading…" : selectedModel ? shortName(selectedModel) : "Select model"}
        </span>
        <span className={`text-gray-600 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 w-72 max-h-80 overflow-y-auto bg-panel border border-edge rounded-lg shadow-xl z-50">
          {/* Active provider indicator */}
          {status && (
            <div className="px-3 py-2 border-b border-edge flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] text-gray-500 uppercase tracking-wide">Mode</span>
              <span className="text-[11px] text-gray-200 font-mono">{status.mode}</span>
              <span className="text-[10px] text-gray-600 ml-auto">
                {status.configs.length} configured
              </span>
            </div>
          )}

          {grouped.length === 0 && !loading && (
            <div className="px-3 py-4 text-center text-xs text-gray-600">
              No models available. Start the backend to load the registry.
            </div>
          )}

          {grouped.map(([provider, providerModels]) => {
            const isConfigured = configuredTypes.has(provider);
            return (
              <div key={provider}>
                <div className="px-3 py-1.5 flex items-center gap-1.5 sticky top-0 bg-panel2/95 backdrop-blur">
                  <span className={`w-1.5 h-1.5 rounded-full ${isConfigured ? "bg-accent" : "bg-gray-700"}`} />
                  <span className="text-[10px] uppercase tracking-wide font-semibold text-gray-400">{provider}</span>
                  <span className="text-[9px] text-gray-700 ml-auto">{providerModels.length}</span>
                </div>
                {providerModels.map((m) => {
                  const isSelected = selected === m.id;
                  const tags = capabilityTags(m);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handlePick(m)}
                      className={`w-full text-left px-3 py-1.5 flex items-start gap-2 transition-colors ${
                        isSelected ? "bg-accent/10" : "hover:bg-panel2"
                      }`}
                      role="option"
                      aria-selected={isSelected}
                    >
                      <span className={`mt-0.5 text-[10px] ${isSelected ? "text-accent" : "text-transparent"}`}>✓</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs truncate ${isSelected ? "text-gray-100 font-medium" : "text-gray-300"}`}>
                            {shortName(m)}
                          </span>
                          {!m.available && (
                            <span className="text-[8px] text-gray-700 border border-edge rounded px-0.5">offline</span>
                          )}
                        </div>
                        {m.description && (
                          <p className="text-[10px] text-gray-600 line-clamp-1">{m.description}</p>
                        )}
                        {tags.length > 0 && (
                          <div className="flex gap-1 mt-0.5 flex-wrap">
                            {tags.map((t) => (
                              <span key={t} className="text-[8px] text-gray-500 bg-panel2 border border-edge rounded px-1 py-0.5">
                                {t}
                              </span>
                            ))}
                            {m.contextWindow > 0 && (
                              <span className="text-[8px] text-gray-700 font-mono">
                                {(m.contextWindow / 1000).toFixed(0)}k ctx
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
