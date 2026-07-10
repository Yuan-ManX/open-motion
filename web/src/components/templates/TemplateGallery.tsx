import { useEffect, useState, useMemo } from "react";
import type { Template } from "@openmotion/shared";
import * as api from "../../api/endpoints.js";
import { useProjectStore } from "../../store/projectStore.js";

interface Props {
  compact?: boolean;
  limit?: number;
}

export function TemplateGallery({ compact = false, limit }: Props) {
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
    const base = activeCategory === "all" ? templates : templates.filter((t) => t.category === activeCategory);
    return limit ? base.slice(0, limit) : base;
  }, [templates, activeCategory, limit]);

  const handlePick = async (tpl: Template) => {
    const project = await api.createProject({ name: tpl.name, templateId: tpl.id });
    await loadProject(project.id);
  };

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading templates…</div>;

  return (
    <div>
      {/* Category filter */}
      <div className="flex gap-1.5 px-4 pt-3 pb-2 flex-wrap">
        <button
          onClick={() => setActiveCategory("all")}
          className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
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
            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors capitalize ${
              activeCategory === cat
                ? "border-accent text-accent"
                : "border-edge text-gray-500 hover:text-gray-300"
            }`}
          >
            {cat} ({count})
          </button>
        ))}
      </div>

      <div className={compact ? "grid grid-cols-2 gap-3 p-2" : "grid grid-cols-2 md:grid-cols-3 gap-4 p-6"}>
        {filtered.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => handlePick(tpl)}
            className="group text-left rounded-xl border border-edge bg-panel2 hover:border-accent transition-colors overflow-hidden"
          >
            <div className="h-28 bg-ink flex items-center justify-center overflow-hidden">
              {tpl.previewHtml ? (
                <iframe
                  srcDoc={tpl.previewHtml}
                  className="w-full h-full pointer-events-none scale-75 origin-center"
                  title={tpl.name}
                  sandbox="allow-scripts"
                />
              ) : (
                <span className="text-2xl">✦</span>
              )}
            </div>
            <div className="p-3">
              <h3 className="text-sm font-semibold text-gray-100 group-hover:text-accent">{tpl.name}</h3>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{tpl.description}</p>
              <div className="flex gap-1 mt-2 flex-wrap">
                {tpl.tags.slice(0, 3).map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-edge text-gray-400">{t}</span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
