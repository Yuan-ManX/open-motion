import { useUiStore } from "../../store/uiStore.js";

interface Shortcut {
  keys: string;
  action: string;
}

const SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: "Editing",
    items: [
      { keys: "⌘ Z", action: "Undo last change" },
      { keys: "⌘ ⇧ Z", action: "Redo" },
      { keys: "⌘ Y", action: "Redo (alternate)" },
      { keys: "Delete", action: "Remove selected layer" },
      { keys: "Esc", action: "Clear selection" },
    ],
  },
  {
    group: "Playback",
    items: [
      { keys: "⇧ R", action: "Replay animation" },
    ],
  },
  {
    group: "Panels",
    items: [
      { keys: "⌘ E", action: "Open export dialog" },
      { keys: "⌘ /", action: "Toggle this help" },
    ],
  },
];

export function ShortcutsModal() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-panel border border-edge rounded-xl w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge">
          <h2 className="text-sm font-semibold text-gray-200">Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-gray-500 hover:text-gray-300 text-lg leading-none"
            aria-label="Close shortcuts"
          >
            ×
          </button>
        </div>
        <div className="px-4 py-4 space-y-4">
          {SHORTCUTS.map((section) => (
            <div key={section.group}>
              <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">{section.group}</div>
              <div className="space-y-1.5">
                {section.items.map((item) => (
                  <div key={item.keys} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{item.action}</span>
                    <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-panel2 border border-edge text-gray-300">
                      {item.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
