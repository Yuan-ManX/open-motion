import { useEffect } from "react";
import { useUiStore } from "./store/uiStore.js";
import * as api from "./api/endpoints.js";
import { Gallery } from "./routes/Gallery.js";
import { Editor } from "./routes/Editor.js";
import { Skills } from "./routes/Skills.js";

export default function App() {
  const view = useUiStore((s) => s.view);
  const setView = useUiStore((s) => s.setView);
  const health = useUiStore((s) => s.health);
  const setHealth = useUiStore((s) => s.setHealth);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [setHealth]);

  const ok = !!health;
  const tabs: Array<{ key: typeof view; label: string }> = [
    { key: "gallery", label: "Gallery" },
    { key: "editor", label: "Editor" },
    { key: "skills", label: "Skills" },
  ];

  return (
    <div className="h-screen flex flex-col bg-ink text-gray-100">
      {/* Top nav */}
      <nav className="flex items-center justify-between px-4 py-2 border-b border-edge bg-panel">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold tracking-tight">OpenMotion</span>
        </div>
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setView(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                view === t.key
                  ? "bg-accent text-white"
                  : "text-gray-400 hover:text-gray-200 hover:bg-panel2"
              }`}
            >
              {t.label}
            </button>
          ))}
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
        {view === "gallery" && <Gallery />}
        {view === "editor" && <Editor />}
        {view === "skills" && <Skills />}
      </div>
    </div>
  );
}
