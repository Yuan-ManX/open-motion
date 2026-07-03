import { useEffect, useState } from "react";
import type { Skill, SkillSummary } from "@openmotion/shared";
import { EASING_PRESETS } from "@openmotion/shared";
import * as api from "../api/endpoints.js";
import { useUiStore } from "../store/uiStore.js";

export function Skills() {
  const setView = useUiStore((s) => s.setView);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Skill | null>(null);
  const [codeHtml, setCodeHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // invoke form state
  const [invEasing, setInvEasing] = useState<string>("ease-out");
  const [invDuration, setInvDuration] = useState<number>(800);
  const [invIter, setInvIter] = useState<number>(1);
  const [invokeHtml, setInvokeHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await api.listSkills();
      setSkills(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setCodeHtml("");
      return;
    }
    api.getSkill(selectedId).then(setDetail).catch(() => setDetail(null));
    api
      .getSkillCode(selectedId)
      .then((r) => setCodeHtml(r.codeHtml))
      .catch(() => setCodeHtml(""));
  }, [selectedId]);

  const handleInvoke = async () => {
    if (!selectedId) return;
    setBusy(true);
    setInvokeHtml(null);
    try {
      const result = await api.invokeSkill(selectedId, {
        easing: { type: "preset", name: invEasing as (typeof EASING_PRESETS)[number] },
        durationMs: invDuration,
        iterationCount: invIter,
      });
      setInvokeHtml(result.html);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    await api.deleteSkill(selectedId);
    setSelectedId(null);
    void refresh();
  };

  return (
    <div className="h-full flex flex-col">
      <header className="px-6 py-4 border-b border-edge flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("gallery")}
            className="text-xs text-gray-400 hover:text-accent"
          >
            ← Gallery
          </button>
          <h1 className="text-lg font-semibold text-gray-100">Skills</h1>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* List */}
        <aside className="w-72 border-r border-edge overflow-y-auto">
          {loading && <div className="p-4 text-sm text-gray-500">Loading…</div>}
          {!loading && skills.length === 0 && (
            <div className="p-4 text-xs text-gray-600">
              No skills yet. Package one from the editor.
            </div>
          )}
          {skills.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left px-4 py-3 border-b border-edge/50 transition-colors ${
                selectedId === s.id ? "bg-accent/20" : "hover:bg-panel2"
              }`}
            >
              <div className="text-sm font-medium text-gray-200 truncate">{s.name}</div>
              <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.description}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-gray-600 font-mono">v{s.version}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-edge text-gray-400">
                  {s.outputType}
                </span>
                {s.tags.slice(0, 2).map((t) => (
                  <span key={t} className="text-[10px] text-gray-500">
                    #{t}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </aside>

        {/* Detail */}
        <main className="flex-1 overflow-y-auto p-6">
          {!detail && (
            <div className="text-center text-sm text-gray-600 py-12">
              Select a skill to inspect its manifest and code.
            </div>
          )}
          {detail && (
            <div className="space-y-5 max-w-3xl">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">{detail.name}</h2>
                <p className="text-sm text-gray-400 mt-1">{detail.description}</p>
                <div className="flex gap-3 mt-2 text-[11px] text-gray-600">
                  <span>id: <span className="font-mono">{detail.id}</span></span>
                  <span>version: {detail.version}</span>
                  <span>output: {detail.manifest.outputType}</span>
                </div>
              </div>

              {/* Invoke */}
              <section className="bg-panel2 border border-edge rounded-lg p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-3">Invoke</div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div>
                    <label className="text-[10px] text-gray-500">Easing</label>
                    <select
                      className="w-full bg-panel border border-edge rounded px-2 py-1 text-sm text-gray-100"
                      value={invEasing}
                      onChange={(e) => setInvEasing(e.target.value)}
                    >
                      {EASING_PRESETS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Duration (ms)</label>
                    <input
                      type="number"
                      min={50}
                      step={50}
                      className="w-full bg-panel border border-edge rounded px-2 py-1 text-sm text-gray-100"
                      value={invDuration}
                      onChange={(e) => setInvDuration(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Iterations</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full bg-panel border border-edge rounded px-2 py-1 text-sm text-gray-100"
                      value={invIter}
                      onChange={(e) => setInvIter(Number(e.target.value))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleInvoke}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-lg bg-accent hover:bg-accent2 disabled:opacity-40 text-white text-sm font-medium"
                  >
                    {busy ? "Invoking…" : "Invoke"}
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-3 py-1.5 rounded-lg bg-panel border border-edge hover:border-red-500 text-red-400 text-sm"
                  >
                    Delete
                  </button>
                </div>
                {invokeHtml && (
                  <div className="mt-3">
                    <iframe
                      srcDoc={invokeHtml}
                      className="w-full h-48 rounded border border-edge bg-ink"
                      title="invoke preview"
                      sandbox="allow-scripts"
                    />
                  </div>
                )}
              </section>

              {/* Code */}
              {codeHtml && (
                <section>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                    Generated code
                  </div>
                  <pre className="bg-ink border border-edge rounded-lg p-4 text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono">
                    {codeHtml}
                  </pre>
                </section>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
