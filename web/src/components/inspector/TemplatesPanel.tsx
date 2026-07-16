import { useEffect, useState, useMemo, useCallback } from "react";
import type { Template } from "@openmotion/shared";
import * as api from "../../api/endpoints.js";
import { useProjectStore } from "../../store/projectStore.js";

type CodeFormat = "react" | "framer" | "html" | "css";

interface CodeModalState {
  templateId: string;
  templateName: string;
  format: CodeFormat;
  code: string;
  language: string;
  filename: string;
  loading: boolean;
  copied: boolean;
}

interface SearchResultItem extends Template {
  score: number;
  matchedFields: string[];
}

/** Templates panel with Originkit-style code export and live customization. */
export function TemplatesPanel() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [codeModal, setCodeModal] = useState<CodeModalState | null>(null);
  // Live customization controls
  const [customColor, setCustomColor] = useState<string>("");
  const [customSpeed, setCustomSpeed] = useState<number>(1);
  const [customScale, setCustomScale] = useState<number>(1);
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const loadProject = useProjectStore((s) => s.loadProject);
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);

  useEffect(() => {
    api.listTemplates().then((t) => {
      setTemplates(t);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Debounced search — calls the backend fuzzy search endpoint
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const handle = window.setTimeout(() => {
      api.searchTemplates(q, 30)
        .then((res) => setSearchResults(res.results))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 220);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const tpl of templates) {
      map.set(tpl.category, (map.get(tpl.category) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [templates]);

  // When a search is active, results come from the search endpoint; otherwise
  // filter locally by category.
  const filtered = useMemo(() => {
    if (searchResults) return searchResults;
    if (activeCategory === "all") return templates;
    return templates.filter((t) => t.category === activeCategory);
  }, [templates, activeCategory, searchResults]);

  const handlePick = async (tpl: Template) => {
    if (projectId) {
      await api.createComponent(projectId, { templateId: tpl.id, name: tpl.name });
      await loadProject(projectId);
    } else {
      const project = await api.createProject({ name: tpl.name, templateId: tpl.id });
      await loadProject(project.id);
    }
  };

  const fetchCode = useCallback(async (templateId: string, templateName: string, format: CodeFormat) => {
    setCodeModal({
      templateId,
      templateName,
      format,
      code: "",
      language: format === "react" || format === "framer" ? "tsx" : format,
      filename: "",
      loading: true,
      copied: false,
    });
    try {
      const result = await api.getTemplateCode(templateId, {
        format,
        color: customColor || undefined,
        speed: customSpeed !== 1 ? customSpeed : undefined,
        scale: customScale !== 1 ? customScale : undefined,
      });
      setCodeModal((prev) => prev ? {
        ...prev,
        code: result.code,
        language: result.language,
        filename: result.filename,
        loading: false,
      } : null);
    } catch {
      setCodeModal((prev) => prev ? { ...prev, loading: false, code: "// Failed to generate code" } : null);
    }
  }, [customColor, customSpeed, customScale]);

  const handleOpenCode = (tpl: Template, format: CodeFormat) => {
    fetchCode(tpl.id, tpl.name, format);
  };

  const handleFormatChange = (format: CodeFormat) => {
    if (!codeModal) return;
    fetchCode(codeModal.templateId, codeModal.templateName, format);
  };

  const handleCopyCode = async () => {
    if (!codeModal || !codeModal.code) return;
    try {
      await navigator.clipboard.writeText(codeModal.code);
      setCodeModal((prev) => prev ? { ...prev, copied: true } : null);
      setTimeout(() => setCodeModal((prev) => prev ? { ...prev, copied: false } : null), 1500);
    } catch { /* clipboard not available */ }
  };

  // Re-fetch code when customization changes
  const handleApplyCustomization = () => {
    if (!codeModal) return;
    fetchCode(codeModal.templateId, codeModal.templateName, codeModal.format);
  };

  if (loading) return <div className="p-4 text-xs text-gray-500">Loading templates…</div>;

  return (
    <div className="h-full flex flex-col">
      {/* Timeline context banner */}
      {projectId && (
        <div className="px-2 py-1.5 border-b border-edge bg-panel2 flex-shrink-0">
          <div className="text-[9px] text-gray-500 flex items-center gap-1">
            <span className="text-accent">●</span>
            <span>Adding to timeline ({components.length} tracks)</span>
          </div>
        </div>
      )}

      {/* Search input */}
      <div className="px-2 pt-2 pb-1.5 flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by name, tag, description…"
            className="w-full text-[11px] bg-ink border border-edge rounded-md pl-7 pr-7 py-1.5 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-accent transition-colors"
          />
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200 text-xs w-4 h-4 flex items-center justify-center"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
          {searching && (
            <div className="absolute right-7 top-1/2 -translate-y-1/2 w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        {searchResults && !searching && (
          <div className="text-[9px] text-gray-500 mt-1">
            {searchResults.length} match{searchResults.length === 1 ? "" : "es"} for "{searchQuery}"
          </div>
        )}
      </div>

      {/* Category filter — hidden while searching */}
      {!searchResults && (
        <div className="flex gap-1 px-2 pt-1 pb-1.5 flex-wrap flex-shrink-0">
          <button
            onClick={() => setActiveCategory("all")}
            className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
              activeCategory === "all"
                ? "border-accent text-accent"
                : "border-edge text-gray-500 hover:text-gray-300"
            }`}
          >
            All ({templates.length})
          </button>
          {categories.map(([cat, count]) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors capitalize ${
                activeCategory === cat
                  ? "border-accent text-accent"
                  : "border-edge text-gray-500 hover:text-gray-300"
              }`}
            >
              {cat} ({count})
            </button>
          ))}
        </div>
      )}

      {/* Template list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {filtered.map((tpl) => {
          const matchedFields = "matchedFields" in tpl ? (tpl as SearchResultItem).matchedFields : [];
          return (
          <div
            key={tpl.id}
            className="group w-full rounded-lg border border-edge bg-panel2 hover:border-accent transition-colors overflow-hidden"
          >
            {/* Preview area — click to add to timeline */}
            <button
              onClick={() => handlePick(tpl)}
              className="w-full text-left"
            >
              <div className="h-20 bg-ink flex items-center justify-center overflow-hidden relative">
                {tpl.previewHtml ? (
                  <iframe
                    srcDoc={tpl.previewHtml}
                    className="w-full h-full pointer-events-none scale-75 origin-center"
                    title={tpl.name}
                    sandbox="allow-scripts"
                  />
                ) : (
                  <span className="text-xl text-gray-600">✦</span>
                )}
                {matchedFields.length > 0 && (
                  <div className="absolute top-1 right-1 flex gap-0.5">
                    {matchedFields.map((f) => (
                      <span
                        key={f}
                        className="text-[8px] px-1 py-0.5 rounded bg-accent/20 text-accent border border-accent/40 uppercase tracking-wide"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-2">
                <h3 className="text-xs font-semibold text-gray-100 group-hover:text-accent truncate">{tpl.name}</h3>
                <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{tpl.description}</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {tpl.tags.slice(0, 3).map((t) => (
                    <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-edge text-gray-400">{t}</span>
                  ))}
                </div>
              </div>
            </button>

            {/* Code export buttons — Originkit style one-click copy */}
            <div className="flex items-center gap-1 px-2 pb-2 border-t border-edge/50 pt-1.5">
              <span className="text-[9px] text-gray-600 mr-1">Code:</span>
              {(["react", "framer", "html", "css"] as CodeFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleOpenCode(tpl, fmt)}
                  className="text-[9px] px-1.5 py-0.5 rounded border border-edge text-gray-400 hover:text-accent hover:border-accent transition-colors uppercase"
                >
                  {fmt === "framer" ? "Framer" : fmt}
                </button>
              ))}
            </div>
          </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-[11px] text-gray-600 py-8">
            {searchResults
              ? `No templates match "${searchQuery}".`
              : "No templates in this category."}
          </div>
        )}
      </div>

      {/* Code preview modal */}
      {codeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setCodeModal(null)}
        >
          <div
            className="w-[640px] max-w-[90vw] h-[80vh] flex flex-col bg-panel border border-edge rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-edge bg-panel2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-100">{codeModal.templateName}</span>
                <span className="text-[9px] text-gray-500">— Code Export</span>
              </div>
              <button
                onClick={() => setCodeModal(null)}
                className="text-gray-500 hover:text-gray-200 text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-edge"
              >
                ✕
              </button>
            </div>

            {/* Format selector tabs */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-edge bg-panel2/50">
              {(["react", "framer", "html", "css"] as CodeFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleFormatChange(fmt)}
                  className={`text-[10px] px-2 py-1 rounded uppercase tracking-wide transition-colors ${
                    codeModal.format === fmt
                      ? "bg-accent text-white"
                      : "text-gray-400 hover:text-gray-200 hover:bg-edge"
                  }`}
                >
                  {fmt === "framer" ? "Framer Motion" : fmt}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2">
                {/* Customization controls */}
                <div className="flex items-center gap-1.5">
                  <label className="text-[9px] text-gray-500">Color</label>
                  <input
                    type="color"
                    value={customColor || "#ffffff"}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-5 h-5 rounded border border-edge cursor-pointer bg-transparent"
                  />
                  {customColor && (
                    <button
                      onClick={() => setCustomColor("")}
                      className="text-[9px] text-gray-600 hover:text-gray-400"
                    >×</button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[9px] text-gray-500">Speed</label>
                  <input
                    type="range"
                    min="0.25"
                    max="3"
                    step="0.25"
                    value={customSpeed}
                    onChange={(e) => setCustomSpeed(parseFloat(e.target.value))}
                    className="w-12 h-1"
                  />
                  <span className="text-[9px] text-gray-400 w-6">{customSpeed}×</span>
                </div>
                <div className="flex items-center gap-1">
                  <label className="text-[9px] text-gray-500">Scale</label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={customScale}
                    onChange={(e) => setCustomScale(parseFloat(e.target.value))}
                    className="w-12 h-1"
                  />
                  <span className="text-[9px] text-gray-400 w-6">{customScale}×</span>
                </div>
                <button
                  onClick={handleApplyCustomization}
                  className="text-[9px] px-1.5 py-0.5 rounded border border-accent text-accent hover:bg-accent hover:text-white transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Code content */}
            <div className="flex-1 overflow-auto bg-ink relative">
              {codeModal.loading ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-500">
                  Generating code…
                </div>
              ) : (
                <>
                  <pre className="text-[11px] text-gray-300 p-3 font-mono leading-relaxed whitespace-pre-wrap break-words">
                    {codeModal.code}
                  </pre>
                  {/* Copy button */}
                  <button
                    onClick={handleCopyCode}
                    className={`absolute top-2 right-2 text-[10px] px-2 py-1 rounded border transition-colors ${
                      codeModal.copied
                        ? "border-accent text-accent bg-accent/10"
                        : "border-edge text-gray-400 hover:text-gray-200 hover:border-gray-400 bg-panel"
                    }`}
                  >
                    {codeModal.copied ? "✓ Copied" : "Copy"}
                  </button>
                  {/* Filename badge */}
                  {codeModal.filename && (
                    <div className="absolute bottom-2 right-2 text-[9px] text-gray-600 bg-panel/80 px-1.5 py-0.5 rounded">
                      {codeModal.filename}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
