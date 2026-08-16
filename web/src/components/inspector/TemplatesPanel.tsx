import { useEffect, useState, useMemo, useCallback } from "react";
import type { Template } from "@openmotion/shared";
import * as api from "../../api/endpoints.js";
import type { PresetPack, CatalogSearchResult, CatalogSummary } from "../../api/endpoints.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import { TemplateGallery } from "../motion/TemplateGallery.js";

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

// Unified catalog browse mode — searches every motion resource type
// (recipes, templates, styles, preset-packs, animation presets, export
// presets, rhythms, motion themes, narrative arcs, shaders, brand packs,
// choreography patterns, story genres) through the single /catalog/search
// endpoint. Lets users discover resources the agent can already see.
type BrowseMode = "templates" | "catalog";

// Short label and accent category for each catalog resource type, used by
// the catalog browse mode to render compact type badges on every result.
const CATALOG_TYPE_LABEL: Record<CatalogSearchResult["type"], string> = {
  recipe: "Recipe",
  template: "Template",
  style: "Style",
  "preset-pack": "Pack",
  "animation-preset": "Anim",
  "export-preset": "Export",
  rhythm: "Rhythm",
  "motion-theme": "Theme",
  "narrative-arc": "Arc",
  shader: "Shader",
  "brand-pack": "Brand",
  choreography: "Choreo",
  "story-genre": "Genre",
  "scene-pack": "Scene",
  "color-palette": "Palette",
  "platform-preset": "Platform",
  "a11y-profile": "A11y",
  "cursor-choreography": "Cursor",
};

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
  // Curated preset packs — fetched once on mount so the user can apply a
  // themed bundle of templates in one click instead of picking each one.
  const [packs, setPacks] = useState<PresetPack[]>([]);
  const [packsOpen, setPacksOpen] = useState(false);
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);
  const [applyingPack, setApplyingPack] = useState(false);
  // Unified catalog browse mode state. The catalog summary is fetched once
  // on mount so the user always sees how many resources of each type exist,
  // even before searching. Catalog search is debounced separately from the
  // template-only search so the two modes never interfere. Browse mode is
  // backed by uiStore so the Cmd+K command palette can switch this panel to
  // catalog mode remotely.
  const browseMode = useUiStore((s) => s.templatesBrowseMode);
  const setBrowseMode = useUiStore((s) => s.setTemplatesBrowseMode);
  const [catalogQuery, setCatalogQuery] = useState<string>("");
  const [catalogResults, setCatalogResults] = useState<CatalogSearchResult[] | null>(null);
  const [catalogSummary, setCatalogSummary] = useState<CatalogSummary | null>(null);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [copiedCatalogId, setCopiedCatalogId] = useState<string | null>(null);
  const [appliedCatalogId, setAppliedCatalogId] = useState<string | null>(null);
  const loadProject = useProjectStore((s) => s.loadProject);
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const selectedComponentId = useUiStore((s) => s.selectedComponentId);
  const [galleryView, setGalleryView] = useState(false);

  useEffect(() => {
    api.listTemplates().then((t) => {
      setTemplates(t);
      setLoading(false);
    }).catch(() => setLoading(false));
    api.listPacks().then((r) => setPacks(r.packs)).catch(() => setPacks([]));
    api.getCatalogSummary().then(setCatalogSummary).catch(() => setCatalogSummary(null));
  }, []);

  // Debounced unified catalog search — only runs while in catalog mode so
  // typing in template mode never triggers a cross-catalog round trip.
  useEffect(() => {
    if (browseMode !== "catalog") return;
    const q = catalogQuery.trim();
    if (!q) {
      setCatalogResults(null);
      setCatalogSearching(false);
      return;
    }
    setCatalogSearching(true);
    const handle = window.setTimeout(() => {
      api.searchCatalog(q, 50)
        .then((res) => setCatalogResults(res.results))
        .catch(() => setCatalogResults([]))
        .finally(() => setCatalogSearching(false));
    }, 220);
    return () => window.clearTimeout(handle);
  }, [catalogQuery, browseMode]);

  // Catalog results grouped by type, sorted by category size descending so
  // the most relevant cluster surfaces first. Empty groups are omitted.
  const catalogGrouped = useMemo(() => {
    if (!catalogResults) return [];
    const map = new Map<CatalogSearchResult["type"], CatalogSearchResult[]>();
    for (const r of catalogResults) {
      const arr = map.get(r.type) ?? [];
      arr.push(r);
      map.set(r.type, arr);
    }
    return Array.from(map.entries())
      .map(([type, items]) => ({ type, items }))
      .sort((a, b) => b.items.length - a.items.length);
  }, [catalogResults]);

  // Template results in catalog mode can be added to the timeline directly
  // because their id maps to a known Template. Other resource types only
  // expose a "copy id" affordance so the user can paste the id into chat.
  const handleCatalogPick = useCallback(async (result: CatalogSearchResult) => {
    if (result.type === "template") {
      const tpl = templates.find((t) => t.id === result.id);
      if (tpl) {
        if (projectId) {
          await api.createComponent(projectId, { templateId: tpl.id, name: tpl.name });
          await loadProject(projectId);
        } else {
          const project = await api.createProject({ name: tpl.name, templateId: tpl.id });
          await loadProject(project.id);
        }
        return;
      }
    }
    // Style preset → apply across every component in the open project so the
    // whole composition shares one easing/duration/direction feel.
    if (result.type === "style") {
      if (!projectId) return;
      try {
        await api.applyStylePreset(projectId, result.id);
        await loadProject(projectId);
        setAppliedCatalogId(result.id);
        setTimeout(() => setAppliedCatalogId((cur) => (cur === result.id ? null : cur)), 1600);
      } catch { /* apply failed — ignore */ }
      return;
    }
    // Recipe → resolve + execute the recipe's tool call sequence against the
    // selected component (or the most recent one) so easing/duration/transforms
    // land on a real component in the current project.
    if (result.type === "recipe") {
      if (!projectId) return;
      try {
        await api.applyRecipe(projectId, result.id, selectedComponentId ?? undefined);
        await loadProject(projectId);
        setAppliedCatalogId(result.id);
        setTimeout(() => setAppliedCatalogId((cur) => (cur === result.id ? null : cur)), 1600);
      } catch { /* apply failed — ignore */ }
      return;
    }
    // For all other resource types, copy the id to the clipboard so the user
    // can reference it in an agent prompt (e.g. "apply rhythm pulse-4").
    try {
      await navigator.clipboard.writeText(result.id);
      setCopiedCatalogId(result.id);
      setTimeout(() => setCopiedCatalogId((cur) => (cur === result.id ? null : cur)), 1400);
    } catch { /* clipboard unavailable */ }
  }, [templates, projectId, loadProject, selectedComponentId]);

  const handleApplyPack = async (pack: PresetPack) => {
    if (!projectId || applyingPack) return;
    setApplyingPack(true);
    try {
      // Resolve each pack template ID to its Template (for the display name),
      // then create a component for each. Unknown IDs are skipped silently so
      // a stale pack never blocks the rest of the bundle.
      const byId = new Map(templates.map((t) => [t.id, t]));
      for (const tplId of pack.templateIds) {
        const tpl = byId.get(tplId);
        const name = tpl?.name ?? tplId;
        try {
          await api.createComponent(projectId, { templateId: tplId, name });
        } catch {
          // Skip individual failures so one bad template doesn't abort the pack.
        }
      }
      await loadProject(projectId);
    } finally {
      setApplyingPack(false);
    }
  };

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

      {/* Browse mode toggle — Templates (curated gallery with live preview
          and code export) vs Catalog (unified search across every motion
          resource type the agent can see). Catalog mode lets users discover
          recipes, styles, shaders, themes, arcs, rhythms, preset packs,
          export presets, animation presets, brand packs, choreography, and
          story genres in one place. */}
      <div className="flex items-center gap-0.5 px-2 pt-1.5 pb-1 border-b border-edge flex-shrink-0">
        {(["templates", "catalog"] as BrowseMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setBrowseMode(m)}
            className={`text-[10px] px-2 py-1 rounded transition-colors ${
              browseMode === m
                ? "bg-panel3 text-gray-100"
                : "text-gray-500 hover:text-gray-300"
            }`}
            aria-pressed={browseMode === m}
          >
            {m === "templates" ? "Templates" : "Catalog"}
          </button>
        ))}
        {browseMode === "templates" && (
          <button
            onClick={() => setGalleryView(!galleryView)}
            className={`ml-auto text-[10px] px-1.5 py-1 rounded transition-colors ${
              galleryView
                ? "bg-panel3 text-accent"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title={galleryView ? "Switch to list view" : "Switch to gallery view with live previews"}
            aria-pressed={galleryView}
          >
            {galleryView ? "▦" : "☰"}
          </button>
        )}
        {browseMode === "catalog" && catalogSummary && (
          <span className="ml-auto text-[9px] text-gray-600 font-mono">{catalogSummary.total} resources</span>
        )}
      </div>

      {browseMode === "catalog" ? (
        <>
          {/* Unified catalog search input */}
          <div className="px-2 pt-2 pb-1.5 flex-shrink-0">
            <div className="relative">
              <input
                type="text"
                value={catalogQuery}
                onChange={(e) => setCatalogQuery(e.target.value)}
                placeholder="Search all resources — recipes, styles, shaders, themes, arcs…"
                className="w-full text-[11px] bg-ink border border-edge rounded-md pl-7 pr-7 py-1.5 text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-accent transition-colors"
              />
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              {catalogQuery && (
                <button
                  onClick={() => setCatalogQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-200 text-xs w-4 h-4 flex items-center justify-center"
                  aria-label="Clear catalog search"
                >
                  ✕
                </button>
              )}
              {catalogSearching && (
                <div className="absolute right-7 top-1/2 -translate-y-1/2 w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            {catalogResults && !catalogSearching && (
              <div className="text-[9px] text-gray-500 mt-1">
                {catalogResults.length} match{catalogResults.length === 1 ? "" : "es"} across {catalogGrouped.length} type{catalogGrouped.length === 1 ? "" : "s"}
              </div>
            )}
          </div>

          {/* Catalog inventory — shown when no query, so the user sees the
              full resource inventory at a glance before searching. Each chip
              shows a category and its live count from /catalog/summary. */}
          {!catalogResults && catalogSummary && (
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              <div className="text-[9px] uppercase tracking-wide text-gray-600 mt-1 mb-1.5">
                All resources ({catalogSummary.total})
              </div>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(catalogSummary.categories).map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between px-1.5 py-1 rounded border border-edge bg-panel2">
                    <span className="text-[10px] text-gray-400">
                      {cat.replace(/([A-Z])/g, " $1").trim().toLowerCase()}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">{count}</span>
                  </div>
                ))}
              </div>
              <div className="text-[9px] text-gray-600 mt-2 leading-snug">
                Type above to search across every resource. Click a template result to add it to the timeline; click a style or recipe result to apply it to the project; click any other result to copy its id for use in chat.
              </div>
            </div>
          )}

          {/* Catalog search results — grouped by type, largest cluster first */}
          {catalogResults && (
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
              {catalogGrouped.map(({ type, items }) => (
                <div key={type}>
                  <div className="text-[9px] uppercase tracking-wide text-gray-600 mt-1 mb-1 flex items-center gap-1.5">
                    <span>{CATALOG_TYPE_LABEL[type]}</span>
                    <span className="text-gray-700">·</span>
                    <span className="text-gray-700 font-mono">{items.length}</span>
                  </div>
                  <div className="space-y-1">
                    {items.map((r) => {
                      const isApplyType = r.type === "style" || r.type === "recipe";
                      const actionLabel = r.type === "template"
                        ? "+ add"
                        : isApplyType
                          ? "apply"
                          : "copy";
                      const doneLabel = isApplyType ? "✓ applied" : "✓ copied";
                      const title = r.type === "template"
                        ? "Add to timeline"
                        : r.type === "style"
                          ? "Apply style preset to all components"
                          : r.type === "recipe"
                            ? "Apply recipe to selected component"
                            : "Copy id to clipboard";
                      return (
                      <button
                        key={`${r.type}-${r.id}`}
                        onClick={() => void handleCatalogPick(r)}
                        className="w-full text-left rounded border border-edge bg-panel2 hover:border-accent transition-colors px-2 py-1.5 group"
                        title={title}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] px-1 py-0.5 rounded bg-edge text-gray-400 uppercase tracking-wide flex-shrink-0">
                            {CATALOG_TYPE_LABEL[r.type]}
                          </span>
                          <span className="text-[11px] font-medium text-gray-200 group-hover:text-accent truncate flex-1">{r.name}</span>
                          <span className="text-[8px] text-gray-600 font-mono flex-shrink-0">
                            {appliedCatalogId === r.id || copiedCatalogId === r.id ? doneLabel : actionLabel}
                          </span>
                        </div>
                        <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-2">{r.description}</p>
                      </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {catalogResults.length === 0 && (
                <div className="text-center text-[11px] text-gray-600 py-8">
                  No resources match "{catalogQuery}".
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
      {/* Preset packs — curated themed bundles of existing templates.
          Collapsed by default; click a pack to expand its description and
          an "Add all" action that instantiates every template in the pack. */}
      {packs.length > 0 && (
        <div className="border-b border-edge bg-panel2/30 flex-shrink-0">
          <button
            onClick={() => setPacksOpen((v) => !v)}
            className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-panel2 transition-colors"
          >
            <span className="text-[10px] uppercase tracking-wide text-gray-400">Packs</span>
            <span className="text-[9px] font-mono text-gray-500">{packs.length} bundles</span>
          </button>
          {packsOpen && (
            <div className="px-2 pb-2 space-y-1">
              {packs.map((pack) => (
                <div key={pack.id} className="border border-edge/60 rounded bg-panel">
                  <button
                    onClick={() => setExpandedPackId(expandedPackId === pack.id ? null : pack.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-panel2 transition-colors"
                  >
                    <span className="text-[11px] font-medium text-gray-200">{pack.name}</span>
                    <span className="text-[9px] text-gray-500 font-mono">{pack.templateIds.length} templates</span>
                  </button>
                  {expandedPackId === pack.id && (
                    <div className="px-2 pb-2 pt-0.5">
                      <p className="text-[10px] text-gray-400 mb-1.5 leading-snug">{pack.description}</p>
                      <div className="flex gap-1 flex-wrap mb-1.5">
                        {pack.tags.map((t) => (
                          <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-edge text-gray-400">{t}</span>
                        ))}
                      </div>
                      <button
                        onClick={() => void handleApplyPack(pack)}
                        disabled={!projectId || applyingPack}
                        className="text-[10px] px-2 py-0.5 rounded bg-accent hover:bg-accent2 disabled:opacity-40 text-black font-medium"
                      >
                        {applyingPack ? "Adding…" : `Add all ${pack.templateIds.length} to timeline`}
                      </button>
                      {!projectId && (
                        <span className="text-[9px] text-gray-600 ml-1.5">Open a project first</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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

      {/* Gallery view — live animated previews powered by MotionPreview.
          The gallery component manages its own search and category filter,
          so we only render it (and skip the search/category section above)
          when galleryView is active. Clicking a template routes through
          the same handlePick path as the list view so it lands on the
          timeline identically. */}
      {galleryView ? (
        <div className="flex-1 overflow-hidden">
          <TemplateGallery
            onApply={(id) => {
              const tpl = templates.find((t) => t.id === id);
              if (tpl) void handlePick(tpl);
            }}
            className="h-full"
          />
        </div>
      ) : (
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
      )}
        </>
      )}

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
