import { useEffect } from "react";
import { useUiStore } from "./store/uiStore.js";
import * as api from "./api/endpoints.js";
import { Editor } from "./routes/Editor.js";
import { ShortcutsModal } from "./components/modals/ShortcutsModal.js";
import { CommandPalette } from "./components/modals/CommandPalette.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";

export default function App() {
  const health = useUiStore((s) => s.health);
  const setHealth = useUiStore((s) => s.setHealth);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [setHealth]);

  const ok = !!health;

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-ink text-gray-100">
        <nav className="flex items-center justify-between px-4 py-1.5 border-b border-edge bg-panel flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-7 h-7 rounded-md text-gray-400 hover:text-gray-200 hover:bg-panel2 flex items-center justify-center transition-colors"
              title={sidebarCollapsed ? "Show conversations" : "Hide conversations"}
              aria-label={sidebarCollapsed ? "Show conversations" : "Hide conversations"}
              aria-expanded={!sidebarCollapsed}
            >
              <span className="text-sm">≣</span>
            </button>
            <span className="text-sm font-semibold tracking-tight">OpenMotion</span>
            <span className="text-[10px] text-gray-600">AI-Native Motion Design Platform</span>
          </div>
        </nav>

        {!ok && (
          <div className="bg-red-950/60 border-b border-red-900 px-4 py-1.5 text-xs text-red-300 text-center">
            Backend unavailable on :7000 — start it with `npm -w @openmotion/server run dev`.
          </div>
        )}

        <div className="flex-1 min-h-0">
          <Editor />
        </div>

        <ShortcutsModal />
        <CommandPalette />
      </div>
    </ErrorBoundary>
  );
}
