import { useState, useEffect, useMemo } from "react";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";
import type { ProviderKeySpec } from "../../api/endpoints.js";

type Tab = "providers" | "models";

const CATEGORY_LABELS: Record<string, string> = {
  llm: "LLM / Chat",
  image: "Image Generation",
  video: "Video Generation",
  audio: "Audio / Speech",
  "3d": "3D Generation",
  embedding: "Embedding",
};

const CATEGORY_ORDER = ["llm", "image", "video", "audio", "3d", "embedding"];

export function ApiSettingsDialog() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);

  const [tab, setTab] = useState<Tab>("providers");
  const [specs, setSpecs] = useState<ProviderKeySpec[]>([]);
  const [mode, setMode] = useState<string>("");
  const [models, setModels] = useState<api.RegistryModel[]>([]);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  // Load provider key specs and models when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setSuccess(null);
    Promise.all([
      api.listProviderKeys(),
      api.listProviders(),
      api.listProviderModels(),
    ])
      .then(([keysRes, providersRes, modelsRes]) => {
        if (cancelled) return;
        setSpecs(keysRes.specs);
        setMode(providersRes.mode);
        setModels(modelsRes.models);
        // Initialize key inputs as empty (never expose existing keys)
        const inputs: Record<string, string> = {};
        for (const spec of keysRes.specs) {
          inputs[spec.envVar] = "";
        }
        setKeyInputs(inputs);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Group specs by category
  const groupedSpecs = useMemo(() => {
    const groups: Record<string, ProviderKeySpec[]> = {};
    for (const spec of specs) {
      if (!groups[spec.category]) groups[spec.category] = [];
      groups[spec.category].push(spec);
    }
    return groups;
  }, [specs]);

  // Group models by provider
  const groupedModels = useMemo(() => {
    const groups: Record<string, api.RegistryModel[]> = {};
    const filtered = models.filter((m) => {
      if (providerFilter !== "all" && m.provider !== providerFilter) return false;
      if (modelFilter) {
        const q = modelFilter.toLowerCase();
        return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
      }
      return true;
    });
    for (const m of filtered) {
      if (!groups[m.provider]) groups[m.provider] = [];
      groups[m.provider].push(m);
    }
    return groups;
  }, [models, modelFilter, providerFilter]);

  const allProviders = useMemo(() => {
    return Array.from(new Set(models.map((m) => m.provider))).sort();
  }, [models]);

  const configuredCount = specs.filter((s) => s.configured).length;

  const handleSave = async () => {
    // Collect only non-empty inputs (changed keys)
    const keys: Record<string, string> = {};
    let hasChanges = false;
    for (const [envVar, value] of Object.entries(keyInputs)) {
      if (value.trim()) {
        keys[envVar] = value.trim();
        hasChanges = true;
      }
    }
    if (!hasChanges) {
      setError("Enter at least one API key to save");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api.configureProviders(keys);
      setMode(result.mode);
      // Update local specs with new configured status
      setSpecs((prev) =>
        prev.map((s) => {
          const updated = result.keyStatus.find((k) => k.envVar === s.envVar);
          return updated ? { ...s, configured: updated.configured } : s;
        }),
      );
      // Clear inputs after successful save
      const cleared: Record<string, string> = {};
      for (const spec of specs) cleared[spec.envVar] = "";
      setKeyInputs(cleared);
      setSuccess(`Configuration saved — provider mode: ${result.mode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const inputCls =
    "w-full bg-panel2 border border-edge rounded px-2 py-1 text-sm text-gray-100 font-mono focus:outline-none focus:border-accent placeholder:text-gray-600";

  const tabCls = (active: boolean) =>
    `px-3 py-1 text-xs rounded transition-colors ${
      active
        ? "bg-accent text-black"
        : "bg-panel2 border border-edge text-gray-400 hover:text-gray-200"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-panel border border-edge rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-200">API Settings</h2>
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wide">
              mode: {mode}
            </span>
            {configuredCount > 0 && (
              <span className="text-[10px] text-accent2 font-mono">
                {configuredCount} configured
              </span>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none"
            aria-label="Close settings dialog"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-edge flex-shrink-0">
          <button className={tabCls(tab === "providers")} onClick={() => setTab("providers")}>
            Providers ({specs.length})
          </button>
          <button className={tabCls(tab === "models")} onClick={() => setTab("models")}>
            Models ({models.length})
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
          {error && (
            <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-3 text-xs text-green-400 bg-green-500/10 border border-green-500/30 rounded px-3 py-2">
              {success}
            </div>
          )}

          {tab === "providers" && (
            <div className="space-y-5">
              {CATEGORY_ORDER.filter((cat) => groupedSpecs[cat]?.length).map((cat) => (
                <section key={cat}>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                    {CATEGORY_LABELS[cat] ?? cat}
                  </div>
                  <div className="space-y-2">
                    {groupedSpecs[cat].map((spec) => (
                      <div key={spec.envVar} className="flex items-center gap-2">
                        <div className="w-44 flex-shrink-0">
                          <div className="text-xs text-gray-300 flex items-center gap-1.5">
                            {spec.label}
                            {spec.configured && (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="configured" />
                            )}
                          </div>
                          <div className="text-[9px] text-gray-600 font-mono">{spec.envVar}</div>
                        </div>
                        <input
                          type="password"
                          className={inputCls}
                          placeholder={spec.configured ? "•••••••• (enter new to replace)" : "enter API key"}
                          value={keyInputs[spec.envVar] ?? ""}
                          onChange={(e) =>
                            setKeyInputs((prev) => ({ ...prev, [spec.envVar]: e.target.value }))
                          }
                          disabled={busy}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              {/* Save button */}
              <div className="border-t border-edge pt-4">
                <button
                  onClick={handleSave}
                  disabled={busy}
                  className="w-full px-3 py-2 rounded-lg bg-accent hover:bg-accent2 disabled:opacity-40 text-black text-sm font-medium transition-colors"
                >
                  {busy ? "Saving…" : "Save Configuration"}
                </button>
                <p className="text-[10px] text-gray-600 mt-2 text-center">
                  Keys are stored in server memory at runtime. Restart the server to persist changes via environment variables.
                </p>
              </div>
            </div>
          )}

          {tab === "models" && (
            <div className="space-y-3">
              {/* Filters */}
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Filter models…"
                  className={inputCls}
                  value={modelFilter}
                  onChange={(e) => setModelFilter(e.target.value)}
                />
                <select
                  className="bg-panel2 border border-edge rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-accent flex-shrink-0"
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                >
                  <option value="all">All providers</option>
                  {allProviders.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model list grouped by provider */}
              {Object.entries(groupedModels)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([provider, providerModels]) => (
                  <div key={provider}>
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1.5 sticky top-0 bg-panel py-1">
                      {provider} ({providerModels.length})
                    </div>
                    <div className="space-y-1">
                      {providerModels.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-start gap-2 px-2 py-1.5 rounded bg-panel2/50 border border-edge/50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-gray-200 font-medium truncate">{m.name}</div>
                            <div className="text-[9px] text-gray-600 font-mono truncate">{m.id}</div>
                          </div>
                          <div className="flex flex-wrap gap-1 flex-shrink-0">
                            {m.capabilities.vision && (
                              <Cap label="vision" />
                            )}
                            {m.capabilities.toolUse && (
                              <Cap label="tools" />
                            )}
                            {m.capabilities.streaming && (
                              <Cap label="stream" />
                            )}
                            {m.capabilities.reasoning && (
                              <Cap label="reason" />
                            )}
                            {m.capabilities.imageGeneration && (
                              <Cap label="img-gen" />
                            )}
                            {m.capabilities.videoGeneration && (
                              <Cap label="vid-gen" />
                            )}
                            {m.capabilities.embedding && (
                              <Cap label="embed" />
                            )}
                            {m.generationModality && (
                              <Cap label={m.generationModality} highlight />
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            {m.available ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" title="available" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-600 inline-block" title="not configured" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Cap({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <span
      className={`text-[8px] px-1 py-0.5 rounded font-mono uppercase tracking-wide ${
        highlight
          ? "bg-accent2/20 text-accent2 border border-accent2/30"
          : "bg-black/40 text-gray-500 border border-edge"
      }`}
    >
      {label}
    </span>
  );
}
