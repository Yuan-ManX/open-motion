import { useEffect, useState } from "react";
import type { Skill, SkillSummary } from "@openmotion/shared";
import { EASING_PRESETS } from "@openmotion/shared";
import * as api from "../../api/endpoints.js";
import { useUiStore } from "../../store/uiStore.js";

export function SkillsModal() {
  const open = useUiStore((s) => s.skillsOpen);
  const setOpen = useUiStore((s) => s.setSkillsOpen);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Skill | null>(null);
  const [codeHtml, setCodeHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const [invEasing, setInvEasing] = useState("ease-out");
  const [invDuration, setInvDuration] = useState(800);
  const [invIter, setInvIter] = useState(1);
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
    if (open) void refresh();
  }, [open]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setCodeHtml("");
      return;
    }
    api.getSkill(selectedId).then(setDetail).catch(() => setDetail(null));
    api.getSkillCode(selectedId).then((r) => setCodeHtml(r.codeHtml)).catch(() => setCodeHtml(""));
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-panel border border-edge rounded-2xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-edge flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-100">Skills</h2>
            <p className="text-[11px] text-gray-500">Reusable motion units — inspect, invoke, or delete.</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-200 hover:bg-panel2 text-lg"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 flex min-h-0">
          {/* List */}
          <aside className="w-64 border-r border-edge overflow-y-auto flex-shrink-0">
            {loading && <div className="p-4 text-sm text-gray-500">Loading…</div>}
            {!loading && skills.length === 0 && (
              <div className="p-4 text-xs text-gray-600">
                No skills yet. Package one from the editor via Export → Skill.
              </div>
            )}
            {skills.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`w-full text-left px-3 py-2.5 border-b border-edge/50 transition-colors ${
                  selectedId === s.id ? "bg-accent/20" : "hover:bg-panel2"
                }`}
              >
                <div className="text-xs font-medium text-gray-200 truncate">{s.name}</div>
                <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{s.description}</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] text-gray-600 font-mono">v{s.version}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-edge text-gray-400">{s.outputType}</span>
                </div>
              </button>
            ))}
          </aside>

          {/* Detail */}
          <main className="flex-1 overflow-y-auto p-5">
            {!detail && (
              <div className="text-center text-sm text-gray-600 py-12">
                Select a skill to inspect its manifest and code.
              </div>
            )}
            {detail && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-100">{detail.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">{detail.description}</p>
                </div>

                {/* Invoke */}
                <section className="bg-panel2 border border-edge rounded-lg p-3">
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-2">Invoke</div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <select
                      className="bg-panel border border-edge rounded px-2 py-1 text-xs text-gray-100"
                      value={invEasing}
                      onChange={(e) => setInvEasing(e.target.value)}
                    >
                      {EASING_PRESETS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={50}
                      step={50}
                      className="bg-panel border border-edge rounded px-2 py-1 text-xs text-gray-100"
                      value={invDuration}
                      onChange={(e) => setInvDuration(Number(e.target.value))}
                    />
                    <input
                      type="number"
                      min={1}
                      className="bg-panel border border-edge rounded px-2 py-1 text-xs text-gray-100"
                      value={invIter}
                      onChange={(e) => setInvIter(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleInvoke}
                      disabled={busy}
                      className="px-3 py-1 rounded bg-accent hover:bg-accent2 disabled:opacity-40 text-white text-xs font-medium"
                    >
                      {busy ? "Invoking…" : "Invoke"}
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-3 py-1 rounded bg-panel border border-edge hover:border-red-500 text-red-400 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                  {invokeHtml && (
                    <iframe
                      srcDoc={invokeHtml}
                      className="w-full h-32 mt-2 rounded border border-edge bg-ink"
                      title="invoke preview"
                      sandbox="allow-scripts"
                    />
                  )}
                </section>

                {/* Code */}
                {codeHtml && (
                  <section>
                    <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Generated code</div>
                    <pre className="bg-ink border border-edge rounded-lg p-3 text-[11px] text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono max-h-48">
                      {codeHtml}
                    </pre>
                  </section>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
