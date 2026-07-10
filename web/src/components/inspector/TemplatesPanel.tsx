import { useEffect, useState, useMemo } from "react";
import type { Template } from "@openmotion/shared";
import * as api from "../../api/endpoints.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";

/** Templates panel embedded in the RightPanel — narrow single-column layout. */
export function TemplatesPanel() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const loadProject = useProjectStore((s) => s.loadProject);

  useEffect(() => {
    api.listTemplates().then((t) => {
      setTemplates(t);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const tpl of templates) {
      map.set(tpl.category, (map.get(tpl.category) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [templates]);

  const filtered = useMemo(() => {
    if (activeCategory === "all") return templates;
    return templates.filter((t) => t.category === activeCategory);
  }, [templates, activeCategory]);

  const handlePick = async (tpl: Template) => {
    const project = await api.createProject({ name: tpl.name, templateId: tpl.id });
    await loadProject(project.id);
  };

  if (loading) return <div className="p-4 text-xs text-gray-500">Loading templates…</div>;

  return (
    <div className="h-full flex flex-col">
      {/* Category filter */}
      <div className="flex gap-1 px-2 pt-2 pb-1.5 flex-wrap flex-shrink-0">
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

      {/* Template list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        {filtered.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => handlePick(tpl)}
            className="group w-full text-left rounded-lg border border-edge bg-panel2 hover:border-accent transition-colors overflow-hidden"
          >
            <div className="h-20 bg-ink flex items-center justify-center overflow-hidden">
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
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-[11px] text-gray-600 py-8">No templates in this category.</div>
        )}
      </div>
    </div>
  );
}
