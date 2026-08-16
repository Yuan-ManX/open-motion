import { useState, useEffect, useMemo, useCallback } from "react";
import { listTemplates } from "../../api/endpoints.js";
import type { Template } from "@openmotion/shared";
import { MotionPreview, type MotionPreviewData } from "./MotionPreview.js";

/**
 * Template Gallery — browsable grid of all motion templates with live animated
 * previews. Users can filter by category, search by name/tag, and click any
 * template to apply it via the Agent chat.
 */

interface Props {
  onApply?: (templateId: string, templateName: string) => void;
  className?: string;
}

/** Extract preview data from a template's spec. */
function templateToPreview(tpl: Template): MotionPreviewData {
  const spec = tpl.spec as Record<string, unknown> | null;
  const components = (spec?.components as Array<Record<string, unknown>>) ?? [];
  const comp = components[0];

  if (comp) {
    return {
      name: tpl.name,
      templateId: tpl.id,
      durationMs: (comp.durationMs as number) ?? 800,
      delayMs: (comp.delayMs as number) ?? 0,
      easing: comp.easing as MotionPreviewData["easing"],
      keyframes: (comp.keyframes as MotionPreviewData["keyframes"]) ?? [],
      iterationCount: comp.iterationCount as number | "infinite" | undefined,
      style: comp.style as Record<string, string | number> | undefined,
    };
  }

  // Fallback: synthesize a preview from category
  const categoryPreviews: Record<string, MotionPreviewData> = {
    entrance: {
      name: tpl.name,
      templateId: tpl.id,
      durationMs: 800,
      easing: { type: "preset", name: "ease-out" },
      keyframes: [
        { offset: 0, properties: { opacity: 0, transform: "translateY(20px) scale(0.9)" } },
        { offset: 1, properties: { opacity: 1, transform: "translateY(0) scale(1)" } },
      ],
    },
    emphasis: {
      name: tpl.name,
      templateId: tpl.id,
      durationMs: 600,
      easing: { type: "preset", name: "ease-in-out" },
      iterationCount: "infinite",
      keyframes: [
        { offset: 0, properties: { transform: "scale(1)" } },
        { offset: 50, properties: { transform: "scale(1.1)" } },
        { offset: 100, properties: { transform: "scale(1)" } },
      ],
    },
    exit: {
      name: tpl.name,
      templateId: tpl.id,
      durationMs: 500,
      easing: { type: "preset", name: "ease-in" },
      keyframes: [
        { offset: 0, properties: { opacity: 1, transform: "scale(1)" } },
        { offset: 1, properties: { opacity: 0, transform: "scale(0.8) translateY(-20px)" } },
      ],
    },
    transition: {
      name: tpl.name,
      templateId: tpl.id,
      durationMs: 700,
      easing: { type: "preset", name: "ease-in-out" },
      keyframes: [
        { offset: 0, properties: { opacity: 0, transform: "translateX(30px)" } },
        { offset: 1, properties: { opacity: 1, transform: "translateX(0)" } },
      ],
    },
    load: {
      name: tpl.name,
      templateId: tpl.id,
      durationMs: 1000,
      easing: { type: "preset", name: "ease-out-quart" },
      keyframes: [
        { offset: 0, properties: { opacity: 0, transform: "scaleY(0)" } },
        { offset: 1, properties: { opacity: 1, transform: "scaleY(1)" } },
      ],
    },
  };

  return categoryPreviews[tpl.category] ?? categoryPreviews.entrance;
}

export function TemplateGallery({ onApply, className = "" }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTemplates()
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch(() => {
        // offline — leave empty
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const t of templates) cats.add(t.category);
    return ["all", ...Array.from(cats).sort()];
  }, [templates]);

  const filtered = useMemo(() => {
    let result = templates;
    if (activeCategory !== "all") {
      result = result.filter((t) => t.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [templates, activeCategory, search]);

  const handleApply = useCallback(
    (tpl: Template) => {
      onApply?.(tpl.id, tpl.name);
    },
    [onApply],
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 text-xs text-gray-600 ${className}`}>
        Loading templates...
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Search bar */}
      <div className="px-3 py-2 border-b border-edge">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="w-full text-xs bg-bg border border-edge rounded px-2 py-1.5 text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-accent"
        />
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-px border-b border-edge bg-panel">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-2 py-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              activeCategory === cat
                ? "bg-panel3 text-white border-b border-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="text-center text-xs text-gray-600 py-4">
            No templates match "{search}"
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => handleApply(tpl)}
                className="flex flex-col items-center p-2 rounded-lg bg-panel2 border border-edge hover:border-accent hover:bg-panel1 transition-all group"
                title={tpl.description}
              >
                <MotionPreview
                  data={templateToPreview(tpl)}
                  size={80}
                  showLabel={true}
                  className="group-hover:scale-105 transition-transform"
                />
                <div className="mt-1 text-[9px] text-gray-600 group-hover:text-accent transition-colors truncate max-w-[100px]">
                  {tpl.tags.slice(0, 2).join(" · ")}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer count */}
      <div className="px-3 py-1 border-t border-edge text-[9px] text-gray-700 text-center">
        {filtered.length} / {templates.length} templates
      </div>
    </div>
  );
}
