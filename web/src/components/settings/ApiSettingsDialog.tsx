import { useState, useEffect, useMemo, useCallback } from "react";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";
import type { ProviderKeySpec, ProviderHealthEntry, TestProviderResponse } from "../../api/endpoints.js";
import { getApiKey, setApiKey } from "../../api/auth.js";

type Tab = "providers" | "models" | "health";

const CATEGORY_LABELS: Record<string, string> = {
  llm: "LLM / Chat",
  image: "Image Generation",
  video: "Video Generation",
  audio: "Audio / Speech",
  "3d": "3D Generation",
  embedding: "Embedding",
};

const CATEGORY_ORDER = ["llm", "image", "video", "audio", "3d", "embedding"];

const LLM_MODES = ["auto", "openai", "anthropic", "gemini", "ollama"] as const;

interface TestState {
  loading: boolean;
  result: TestProviderResponse | null;
}

export function ApiSettingsDialog() {
  const open = useUiStore((s) => s.settingsOpen);
  const setOpen = useUiStore((s) => s.setSettingsOpen);

  const [tab, setTab] = useState<Tab>("providers");
  const [specs, setSpecs] = useState<ProviderKeySpec[]>([]);
  const [mode, setMode] = useState<string>("");
  const [configs, setConfigs] = useState<api.ProviderConfigInfo[]>([]);
  const [models, setModels] = useState<api.RegistryModel[]>([]);
  const [health, setHealth] = useState<ProviderHealthEntry[]>([]);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [providerSearch, setProviderSearch] = useState<string>("");
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});
  const [omApiKey, setOmApiKey] = useState<string>("");
  const [llmMode, setLlmMode] = useState<string>("auto");
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [showOmKey, setShowOmKey] = useState<boolean>(false);
  const [testingAll, setTestingAll] = useState<boolean>(false);

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
      api.listProviderHealth().catch(() => ({ providers: [] })),
    ])
      .then(([keysRes, providersRes, modelsRes, healthRes]) => {
        if (cancelled) return;
        setSpecs(keysRes.specs);
        setMode(providersRes.mode);
        setConfigs(providersRes.configs);
        setModels(modelsRes.models);
        setHealth(healthRes.providers);
        const inputs: Record<string, string> = {};
        for (const spec of keysRes.specs) {
          inputs[spec.envVar] = "";
        }
        setKeyInputs(inputs);
        setOmApiKey(getApiKey() ?? "");
        // Sync llmMode selector with the effective provider mode
        const effective = providersRes.mode === "mock" ? "auto" : providersRes.mode;
        setLlmMode(effective);
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
    // Apply search filter
    if (providerSearch) {
      const q = providerSearch.toLowerCase();
      for (const cat of Object.keys(groups)) {
        groups[cat] = groups[cat].filter(
          (s) =>
            s.label.toLowerCase().includes(q) ||
            s.envVar.toLowerCase().includes(q),
        );
      }
    }
    return groups;
  }, [specs, providerSearch]);

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

  // Map of providerName -> config info (baseUrl, model, hasKey)
  const configMap = useMemo(() => {
    const m: Record<string, api.ProviderConfigInfo> = {};
    for (const c of configs) {
      const name = c.providerName ?? c.type;
      m[name] = c;
    }
    return m;
  }, [configs]);

  const toggleCollapse = useCallback((cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const handleSave = async () => {
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
      setSpecs((prev) =>
        prev.map((s) => {
          const updated = result.keyStatus.find((k) => k.envVar === s.envVar);
          return updated ? { ...s, configured: updated.configured } : s;
        }),
      );
      // Refresh configs to show new providers
      const providersRes = await api.listProviders();
      setConfigs(providersRes.configs);
      setMode(providersRes.mode);
      // Sync llmMode selector with the new effective mode
      const effective = providersRes.mode === "mock" ? "auto" : providersRes.mode;
      setLlmMode(effective);
      // Clear inputs
      const cleared: Record<string, string> = {};
      for (const spec of specs) cleared[spec.envVar] = "";
      setKeyInputs(cleared);
      setSuccess(`Configuration saved — provider mode: ${providersRes.mode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleClearKey = async (envVar: string) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      // Send empty string to clear the key
      const result = await api.configureProviders({ [envVar]: "" });
      setMode(result.mode);
      setSpecs((prev) =>
        prev.map((s) => {
          const updated = result.keyStatus.find((k) => k.envVar === s.envVar);
          return updated ? { ...s, configured: updated.configured } : s;
        }),
      );
      const providersRes = await api.listProviders();
      setConfigs(providersRes.configs);
      setMode(providersRes.mode);
      const effective = providersRes.mode === "mock" ? "auto" : providersRes.mode;
      setLlmMode(effective);
      setSuccess(`Key cleared — ${envVar}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async (providerName: string) => {
    setTestStates((prev) => ({
      ...prev,
      [providerName]: { loading: true, result: null },
    }));
    try {
      const result = await api.testProvider(providerName);
      setTestStates((prev) => ({
        ...prev,
        [providerName]: { loading: false, result },
      }));
    } catch (e) {
      setTestStates((prev) => ({
        ...prev,
        [providerName]: {
          loading: false,
          result: {
            ok: false,
            provider: providerName,
            model: "",
            latencyMs: 0,
            error: e instanceof Error ? e.message : String(e),
          },
        },
      }));
    }
  };

  const handleSaveOmKey = () => {
    setApiKey(omApiKey.trim());
    setSuccess(omApiKey.trim() ? "OpenMotion API key saved to browser" : "OpenMotion API key cleared");
  };

  const handleModeChange = async (newMode: string) => {
    setLlmMode(newMode);
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api.setProviderMode(newMode);
      setMode(result.mode);
      setSuccess(`Provider mode set to ${newMode} — effective: ${result.mode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleTestAll = async () => {
    const llmSpecs = specs.filter((s) => s.category === "llm" && s.configured);
    if (llmSpecs.length === 0) {
      setError("No configured LLM providers to test");
      return;
    }
    setTestingAll(true);
    setError(null);
    setSuccess(null);
    const names = llmSpecs.map((s) => s.envVar.replace("_API_KEY", "").toLowerCase());
    // Mark all as loading
    const loadingStates: Record<string, TestState> = {};
    for (const n of names) loadingStates[n] = { loading: true, result: null };
    setTestStates((prev) => ({ ...prev, ...loadingStates }));
    // Run tests in parallel
    await Promise.all(
      names.map(async (n) => {
        try {
          const result = await api.testProvider(n);
          setTestStates((prev) => ({ ...prev, [n]: { loading: false, result } }));
        } catch (e) {
          setTestStates((prev) => ({
            ...prev,
            [n]: {
              loading: false,
              result: {
                ok: false,
                provider: n,
                model: "",
                latencyMs: 0,
                error: e instanceof Error ? e.message : String(e),
              },
            },
          }));
        }
      }),
    );
    setTestingAll(false);
    setSuccess(`Tested ${names.length} LLM provider(s)`);
  };

  const toggleKeyVisibility = (envVar: string) => {
    setShowKeys((prev) => ({ ...prev, [envVar]: !prev[envVar] }));
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
        className="bg-panel border border-edge rounded-xl w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] flex flex-col"
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
          <button className={tabCls(tab === "health")} onClick={() => setTab("health")}>
            Health
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
            <div className="space-y-4">
              {/* General section */}
              <section className="bg-panel2/30 border border-edge/50 rounded-lg p-3 space-y-3">
                <div className="text-xs uppercase tracking-wide text-gray-500">General</div>

                {/* OpenMotion API Key */}
                <div className="flex items-center gap-2">
                  <div className="w-44 flex-shrink-0">
                    <div className="text-xs text-gray-300">OpenMotion API Key</div>
                    <div className="text-[9px] text-gray-600 font-mono">X-API-Key header</div>
                  </div>
                  <input
                    type={showOmKey ? "text" : "password"}
                    className={inputCls}
                    placeholder={omApiKey ? "•••••••• (enter new to replace)" : "optional — for backend auth"}
                    value={omApiKey}
                    onChange={(e) => setOmApiKey(e.target.value)}
                  />
                  <button
                    onClick={() => setShowOmKey((v) => !v)}
                    className="px-2 py-1 text-[10px] rounded bg-panel2 border border-edge text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0"
                    title={showOmKey ? "Hide" : "Show"}
                  >
                    {showOmKey ? "◉" : "◯"}
                  </button>
                  <button
                    onClick={handleSaveOmKey}
                    className="px-2 py-1 text-[10px] rounded bg-panel2 border border-edge text-gray-300 hover:border-accent transition-colors flex-shrink-0"
                  >
                    Save
                  </button>
                </div>

                {/* LLM Provider Mode */}
                <div className="flex items-center gap-2">
                  <div className="w-44 flex-shrink-0">
                    <div className="text-xs text-gray-300">Provider Mode</div>
                    <div className="text-[9px] text-gray-600 font-mono">LLM_PROVIDER runtime</div>
                  </div>
                  <select
                    className="bg-panel2 border border-edge rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-accent flex-1 disabled:opacity-50"
                    value={llmMode}
                    onChange={(e) => handleModeChange(e.target.value)}
                    disabled={busy}
                  >
                    {LLM_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <span className="text-[9px] text-gray-600 flex-shrink-0">
                    effective: <span className="text-gray-400 font-mono">{mode}</span>
                  </span>
                </div>

                {/* Test all configured LLM providers */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="w-44 flex-shrink-0">
                    <div className="text-xs text-gray-300">Connection Test</div>
                    <div className="text-[9px] text-gray-600 font-mono">ping all configured LLMs</div>
                  </div>
                  <button
                    onClick={handleTestAll}
                    disabled={testingAll || specs.filter((s) => s.category === "llm" && s.configured).length === 0}
                    className="px-3 py-1 text-[10px] rounded bg-panel2 border border-edge text-gray-300 hover:border-accent disabled:opacity-40 transition-colors"
                  >
                    {testingAll ? "Testing…" : `Test all (${specs.filter((s) => s.category === "llm" && s.configured).length})`}
                  </button>
                </div>
              </section>

              {/* Search bar */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search providers…"
                  className={inputCls}
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                />
                {providerSearch && (
                  <button
                    onClick={() => setProviderSearch("")}
                    className="text-gray-500 hover:text-gray-300 text-xs flex-shrink-0"
                  >
                    clear
                  </button>
                )}
              </div>

              {/* Provider categories */}
              {CATEGORY_ORDER.filter((cat) => groupedSpecs[cat]?.length).map((cat) => {
                const isCollapsed = collapsedCats.has(cat);
                const catSpecs = groupedSpecs[cat];
                const catConfigured = catSpecs.filter((s) => s.configured).length;
                return (
                  <section key={cat} className="border border-edge/50 rounded-lg overflow-hidden">
                    {/* Category header — clickable to collapse */}
                    <button
                      onClick={() => toggleCollapse(cat)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-panel2/50 hover:bg-panel2 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-600">
                          {isCollapsed ? "▸" : "▾"}
                        </span>
                        <span className="text-xs uppercase tracking-wide text-gray-400">
                          {CATEGORY_LABELS[cat] ?? cat}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-600 font-mono">
                        {catConfigured}/{catSpecs.length}
                      </span>
                    </button>

                    {/* Provider rows */}
                    {!isCollapsed && (
                      <div className="px-3 py-2 space-y-2">
                        {catSpecs.map((spec) => {
                          const configName = spec.envVar.replace("_API_KEY", "").toLowerCase();
                          const cfg = configMap[configName];
                          const testState = testStates[configName];
                          const canTest = spec.configured && cat === "llm";
                          const isShown = showKeys[spec.envVar];
                          return (
                            <div key={spec.envVar} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="w-40 flex-shrink-0">
                                  <div className="text-xs text-gray-300 flex items-center gap-1.5">
                                    {spec.label}
                                    {spec.configured && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" title="configured" />
                                    )}
                                  </div>
                                  <div className="text-[9px] text-gray-600 font-mono">{spec.envVar}</div>
                                </div>
                                <input
                                  type={isShown ? "text" : "password"}
                                  className={inputCls}
                                  placeholder={spec.configured ? "•••••••• (enter new to replace)" : "enter API key"}
                                  value={keyInputs[spec.envVar] ?? ""}
                                  onChange={(e) =>
                                    setKeyInputs((prev) => ({ ...prev, [spec.envVar]: e.target.value }))
                                  }
                                  disabled={busy}
                                />
                                {/* Toggle visibility */}
                                <button
                                  onClick={() => toggleKeyVisibility(spec.envVar)}
                                  className="px-1.5 py-1 text-[10px] rounded bg-panel2 border border-edge text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                                  title={isShown ? "Hide" : "Show"}
                                >
                                  {isShown ? "◉" : "◯"}
                                </button>
                                {/* Test button — only for LLM providers */}
                                {canTest && (
                                  <button
                                    onClick={() => handleTest(configName)}
                                    disabled={testState?.loading || testingAll}
                                    className="px-2 py-1 text-[10px] rounded bg-panel2 border border-edge text-gray-300 hover:border-accent disabled:opacity-40 transition-colors flex-shrink-0"
                                    title="Test connection"
                                  >
                                    {testState?.loading ? "…" : "Test"}
                                  </button>
                                )}
                                {/* Clear key button */}
                                {spec.configured && !keyInputs[spec.envVar]?.trim() && (
                                  <button
                                    onClick={() => handleClearKey(spec.envVar)}
                                    disabled={busy}
                                    className="px-1.5 py-1 text-[10px] rounded bg-panel2 border border-edge text-gray-500 hover:text-red-400 hover:border-red-500/50 disabled:opacity-40 transition-colors flex-shrink-0"
                                    title="Clear key"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>

                              {/* Base URL and model info */}
                              {(spec.baseUrl || cfg) && (
                                <div className="flex items-center gap-3 pl-40 text-[9px] text-gray-600 font-mono">
                                  {spec.baseUrl && (
                                    <span title="base URL">
                                      <span className="text-gray-700">url:</span> {spec.baseUrl}
                                    </span>
                                  )}
                                  {(cfg?.model || spec.defaultModel) && (
                                    <span title="default model">
                                      <span className="text-gray-700">model:</span> {cfg?.model ?? spec.defaultModel}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Test result */}
                              {testState?.result && (
                                <div
                                  className={`ml-40 text-[10px] rounded px-2 py-1 border ${
                                    testState.result.ok
                                      ? "text-green-400 bg-green-500/10 border-green-500/30"
                                      : "text-red-400 bg-red-500/10 border-red-500/30"
                                  }`}
                                >
                                  {testState.result.ok ? (
                                    <>
                                      ✓ {testState.result.latencyMs}ms
                                      {testState.result.tokensOut != null &&
                                        ` · ${testState.result.tokensOut} tokens`}
                                      {testState.result.response &&
                                        ` · "${testState.result.response.slice(0, 60)}${testState.result.response.length > 60 ? "…" : ""}"`}
                                    </>
                                  ) : (
                                    <>✕ {testState.result.error}</>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })}

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
                  Keys are stored in server memory at runtime. Restart the server to persist via environment variables.
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
                            {m.contextWindow != null && (
                              <div className="text-[9px] text-gray-700">
                                ctx: {(m.contextWindow / 1000).toFixed(0)}k
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 flex-shrink-0">
                            {m.capabilities.vision && <Cap label="vision" />}
                            {m.capabilities.toolUse && <Cap label="tools" />}
                            {m.capabilities.streaming && <Cap label="stream" />}
                            {m.capabilities.reasoning && <Cap label="reason" />}
                            {m.capabilities.imageGeneration && <Cap label="img-gen" />}
                            {m.capabilities.videoGeneration && <Cap label="vid-gen" />}
                            {m.capabilities.embedding && <Cap label="embed" />}
                            {m.generationModality && <Cap label={m.generationModality} highlight />}
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

          {tab === "health" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-gray-600">
                  Runtime health metrics for circuit-breaker and latency routing. Updates on each request.
                </p>
                <button
                  onClick={() => {
                    api.listProviderHealth().then((r) => setHealth(r.providers)).catch(() => {});
                  }}
                  className="px-2 py-1 text-[10px] rounded bg-panel2 border border-edge text-gray-300 hover:border-accent transition-colors"
                >
                  Refresh
                </button>
              </div>

              {health.length === 0 ? (
                <div className="text-center text-xs text-gray-600 py-12">
                  No health data yet. Send a chat request to populate metrics.
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_1fr_60px_60px_60px_70px_60px] gap-2 px-2 py-1 text-[9px] uppercase tracking-wide text-gray-600 font-mono">
                    <span>Provider</span>
                    <span>Model</span>
                    <span className="text-right">Success</span>
                    <span className="text-right">Fail</span>
                    <span className="text-right">Consec</span>
                    <span className="text-right">Avg ms</span>
                    <span className="text-center">Circuit</span>
                  </div>
                  {health.map((h, i) => (
                    <div
                      key={`${h.provider}-${i}`}
                      className="grid grid-cols-[1fr_1fr_60px_60px_60px_70px_60px] gap-2 px-2 py-1.5 rounded bg-panel2/50 border border-edge/50 text-[10px] font-mono items-center"
                    >
                      <span className="text-gray-300 truncate">{h.provider}</span>
                      <span className="text-gray-500 truncate">{h.model}</span>
                      <span className="text-right text-green-400">{h.successCount}</span>
                      <span className="text-right text-red-400">{h.failureCount}</span>
                      <span className={`text-right ${h.consecutiveFailures > 0 ? "text-yellow-400" : "text-gray-600"}`}>
                        {h.consecutiveFailures}
                      </span>
                      <span className="text-right text-gray-400">
                        {h.avgLatencyMs > 0 ? Math.round(h.avgLatencyMs) : "—"}
                      </span>
                      <span className="text-center">
                        {h.circuitOpen ? (
                          <span className="text-red-400" title={h.lastError}>open</span>
                        ) : (
                          <span className="text-green-400">closed</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Last errors */}
              {health.some((h) => h.lastError) && (
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Recent Errors</div>
                  <div className="space-y-1">
                    {health
                      .filter((h) => h.lastError)
                      .map((h, i) => (
                        <div
                          key={`err-${i}`}
                          className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1 font-mono"
                        >
                          <span className="text-gray-500">{h.provider}:</span> {h.lastError}
                        </div>
                      ))}
                  </div>
                </div>
              )}
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
