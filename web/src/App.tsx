import { useEffect } from "react";
import { useUiStore } from "./store/uiStore.js";
import * as api from "./api/endpoints.js";
import { Editor } from "./routes/Editor.js";
import { TemplatesModal } from "./components/modals/TemplatesModal.js";
import { SkillsModal } from "./components/modals/SkillsModal.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";

export default function App() {
  const health = useUiStore((s) => s.health);
  const setHealth = useUiStore((s) => s.setHealth);

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
            <span className="text-sm font-semibold tracking-tight">OpenMotion</span>
            <span className="text-[10px] text-gray-600">AI-native motion design</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                ok ? "bg-green-400" : "bg-red-500"
              }`}
            />
            <span className="text-gray-500">
              {ok ? `backend · ${health?.provider}` : "backend unavailable"}
            </span>
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

        <TemplatesModal />
        <SkillsModal />
      </div>
    </ErrorBoundary>
  );
}
