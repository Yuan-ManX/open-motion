import { useEffect, useState } from "react";
import type { Skill, SkillSummary } from "@openmotion/shared";
import { EASING_PRESETS } from "@openmotion/shared";
import * as api from "../../api/endpoints.js";

/** Skills panel embedded in the RightPanel — vertical list with expandable detail. */
export function SkillsPanel() {
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
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setCodeHtml("");
      setInvokeHtml(null);
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

  return (
    <div className="h-full flex flex-col">
      {loading && <div className="p-4 text-xs text-gray-500">Loading…</div>}
      {!loading && skills.length === 0 && (
        <div className="p-4 text-[11px] text-gray-600">
          No skills yet. Package one from the editor via Export → Skill.
        </div>
      )}

      {/* Skills list */}
      <div className="flex-1 overflow-y-auto">
        {skills.map((s) => (
          <div key={s.id}>
            <button
              onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
              className={`w-full text-left px-2.5 py-2 border-b border-edge/50 transition-colors ${
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

            {/* Expanded detail */}
            {selectedId === s.id && detail && (
              <div className="px-2.5 py-2 bg-panel2/50 border-b border-edge/50 space-y-2">
                {/* Invoke controls */}
                <div>
                  <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-1">Invoke</div>
                  <div className="grid grid-cols-3 gap-1 mb-1.5">
                    <select
                      className="bg-panel border border-edge rounded px-1 py-0.5 text-[10px] text-gray-100"
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
                      className="bg-panel border border-edge rounded px-1 py-0.5 text-[10px] text-gray-100"
                      value={invDuration}
                      onChange={(e) => setInvDuration(Number(e.target.value))}
                    />
                    <input
                      type="number"
                      min={1}
                      className="bg-panel border border-edge rounded px-1 py-0.5 text-[10px] text-gray-100"
                      value={invIter}
                      onChange={(e) => setInvIter(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={handleInvoke}
                      disabled={busy}
                      className="px-2 py-0.5 rounded bg-accent hover:bg-accent2 disabled:opacity-40 text-black text-[10px] font-medium"
                    >
                      {busy ? "…" : "Invoke"}
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-2 py-0.5 rounded bg-panel border border-edge hover:border-red-500 text-red-400 text-[10px]"
                    >
                      Delete
                    </button>
                  </div>
                  {invokeHtml && (
                    <iframe
                      srcDoc={invokeHtml}
                      className="w-full h-16 mt-1.5 rounded border border-edge bg-ink"
                      title="invoke preview"
                      sandbox="allow-scripts"
                    />
                  )}
                </div>

                {/* Code preview */}
                {codeHtml && (
                  <div>
                    <div className="text-[9px] uppercase tracking-wide text-gray-500 mb-0.5">Code</div>
                    <pre className="bg-ink border border-edge rounded p-1.5 text-[9px] text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono max-h-24">
                      {codeHtml}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
