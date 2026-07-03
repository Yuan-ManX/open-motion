import { useEffect, useState } from "react";
import type { Template } from "@openmotion/shared";
import * as api from "../../api/endpoints.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";

interface Props {
  compact?: boolean;
}

export function TemplateGallery({ compact = false }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const loadProject = useProjectStore((s) => s.loadProject);
  const setView = useUiStore((s) => s.setView);

  useEffect(() => {
    api.listTemplates().then((t) => {
      setTemplates(t);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handlePick = async (tpl: Template) => {
    const project = await api.createProject({ name: tpl.name, templateId: tpl.id });
    await loadProject(project.id);
    setView("editor");
  };

  if (loading) return <div className="p-4 text-sm text-gray-500">Loading templates…</div>;

  return (
    <div className={compact ? "grid grid-cols-2 gap-3 p-2" : "grid grid-cols-2 md:grid-cols-3 gap-4 p-6"}>
      {templates.map((tpl) => (
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
  );
}
