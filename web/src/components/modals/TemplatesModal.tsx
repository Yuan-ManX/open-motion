import { useUiStore } from "../../store/uiStore.js";
import { TemplateGallery } from "../templates/TemplateGallery.js";

export function TemplatesModal() {
  const open = useUiStore((s) => s.templatesOpen);
  const setOpen = useUiStore((s) => s.setTemplatesOpen);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-panel border border-edge rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-edge flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-100">Templates</h2>
            <p className="text-[11px] text-gray-500">Pick a starting point — creates a new project instantly.</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-200 hover:bg-panel2 text-lg"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <TemplateGallery />
        </div>
      </div>
    </div>
  );
}
