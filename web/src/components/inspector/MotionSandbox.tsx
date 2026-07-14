import { useState, useMemo } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useChatStore } from "../../store/chatStore.js";
import { PRESET_BEZIER } from "@openmotion/shared";
import type { Easing } from "@openmotion/shared";

const PRESET_NAMES = [
  "linear", "ease", "ease-in", "ease-out", "ease-in-out",
  "ease-in-quad", "ease-out-quad", "ease-in-out-quad",
  "ease-in-cubic", "ease-out-cubic", "ease-in-out-cubic",
  "bounce", "back", "elastic", "snappy", "smooth", "soft",
];

const QUALITY_PRESETS: { label: string; bezier: [number, number, number, number] }[] = [
  { label: "Weighty", bezier: [0.34, 1.56, 0.64, 1] },
  { label: "Featherlight", bezier: [0.22, 0.61, 0.36, 1] },
  { label: "Snappy", bezier: [0.2, 0.8, 0.2, 1] },
  { label: "Dramatic", bezier: [0.7, 0, 0.3, 1] },
  { label: "Playful", bezier: [0.68, -0.55, 0.265, 1.55] },
  { label: "Elegant", bezier: [0.25, 0.1, 0.25, 1] },
  { label: "Organic", bezier: [0.37, 0, 0.63, 1] },
  { label: "Mechanical", bezier: [0, 0, 1, 1] },
];

/**
 * Experimental scratchpad for testing motion parameters before applying them.
 * Lets the user pick an easing preset or custom bezier, adjust duration,
 * preview the animation curve visually, and apply it to a component via
 * the Agent.
 */
export function MotionSandbox() {
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const [duration, setDuration] = useState(800);
  const [easingType, setEasingType] = useState<"preset" | "bezier" | "spring">("preset");
  const [presetName, setPresetName] = useState<string>("ease-out");
  const [bezier, setBezier] = useState<[number, number, number, number]>([0.25, 0.1, 0.25, 1]);
  const [spring, setSpring] = useState({ stiffness: 180, damping: 14, mass: 1 });
  const [loop, setLoop] = useState<number | "infinite">(1);

  const easing: Easing = useMemo(() => {
    if (easingType === "preset") return { type: "preset", name: presetName as any };
    if (easingType === "bezier") return { type: "bezier", p1: [bezier[0], bezier[1]], p2: [bezier[2], bezier[3]] };
    return { type: "spring", ...spring };
  }, [easingType, presetName, bezier, spring]);

  const cssEasing = useMemo(() => {
    if (easing.type === "preset") {
      const native = ["linear", "ease", "ease-in", "ease-out", "ease-in-out"];
      if (native.includes(easing.name)) return easing.name;
      const bz = PRESET_BEZIER[easing.name];
      return bz ? `cubic-bezier(${bz.join(", ")})` : "ease";
    }
    if (easing.type === "bezier") return `cubic-bezier(${easing.p1.join(", ")}, ${easing.p2.join(", ")})`;
    const r = easing.damping / (2 * Math.sqrt(easing.stiffness * easing.mass));
    return r >= 1 ? "cubic-bezier(0.22, 1, 0.36, 1)" : "cubic-bezier(0.34, 1.56, 0.64, 1)";
  }, [easing]);

  if (!projectId) {
    return (
      <div className="px-4 py-6 text-center text-xs text-gray-600">
        No project loaded.
      </div>
    );
  }

  const send = useChatStore.getState().send;
  const hasComponents = components.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-edge flex-shrink-0">
        <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">
          Motion Sandbox
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-3 space-y-3">
          {/* Easing type selector */}
          <div>
            <label className="text-[8px] font-mono uppercase text-gray-600 block mb-1">Easing Type</label>
            <div className="grid grid-cols-3 gap-1">
              {(["preset", "bezier", "spring"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setEasingType(t)}
                  className={`px-2 py-1 text-[9px] border transition-colors ${
                    easingType === t
                      ? "border-gray-400 text-gray-200 bg-panel2"
                      : "border-edge text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Easing controls */}
          {easingType === "preset" && (
            <div>
              <label className="text-[8px] font-mono uppercase text-gray-600 block mb-1">Preset</label>
              <select
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="w-full bg-panel2 border border-edge text-[10px] text-gray-300 px-1.5 py-1 focus:outline-none focus:border-gray-500"
              >
                {PRESET_NAMES.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          )}

          {easingType === "bezier" && (
            <div className="space-y-2">
              <div>
                <label className="text-[8px] font-mono uppercase text-gray-600 block mb-1">Quality Presets</label>
                <div className="grid grid-cols-4 gap-1">
                  {QUALITY_PRESETS.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => setBezier(q.bezier)}
                      className="px-1 py-1 text-[8px] border border-edge text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors"
                      title={q.bezier.join(", ")}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
              <BezierControl label="P1 X" value={bezier[0]} onChange={(v) => setBezier([v, bezier[1], bezier[2], bezier[3]])} />
              <BezierControl label="P1 Y" value={bezier[1]} onChange={(v) => setBezier([bezier[0], v, bezier[2], bezier[3]])} />
              <BezierControl label="P2 X" value={bezier[2]} onChange={(v) => setBezier([bezier[0], bezier[1], v, bezier[3]])} />
              <BezierControl label="P2 Y" value={bezier[3]} onChange={(v) => setBezier([bezier[0], bezier[1], bezier[2], v])} />
            </div>
          )}

          {easingType === "spring" && (
            <div className="space-y-2">
              <BezierControl label="Stiffness" value={spring.stiffness} onChange={(v) => setSpring({ ...spring, stiffness: v })} min={1} max={1000} />
              <BezierControl label="Damping" value={spring.damping} onChange={(v) => setSpring({ ...spring, damping: v })} min={0} max={100} />
              <BezierControl label="Mass" value={spring.mass} onChange={(v) => setSpring({ ...spring, mass: v })} min={0.1} max={10} step={0.1} />
            </div>
          )}

          {/* Duration */}
          <div>
            <label className="text-[8px] font-mono uppercase text-gray-600 block mb-1">
              Duration: {duration}ms
            </label>
            <input
              type="range"
              min={100}
              max={5000}
              step={50}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full accent-gray-400"
            />
          </div>

          {/* Loop */}
          <div>
            <label className="text-[8px] font-mono uppercase text-gray-600 block mb-1">
              Loop: {loop === "infinite" ? "∞" : loop}
            </label>
            <div className="flex gap-1">
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={loop === "infinite" ? 0 : loop}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLoop(v === 0 ? "infinite" : v);
                }}
                className="flex-1 accent-gray-400"
              />
              <button
                onClick={() => setLoop("infinite")}
                className="px-2 py-0.5 text-[8px] border border-edge text-gray-500 hover:text-gray-300"
              >
                ∞
              </button>
            </div>
          </div>

          {/* Easing curve preview */}
          <div className="border border-edge p-2">
            <div className="text-[8px] font-mono uppercase text-gray-600 mb-1">Curve Preview</div>
            <EasingCurvePreview bezier={easingType === "bezier" ? bezier : easingType === "preset" ? (PRESET_BEZIER[presetName] ?? [0.25, 0.1, 0.25, 1]) : [0.34, 1.56, 0.64, 1]} />
            <div className="mt-1.5 text-[8px] font-mono text-gray-500 break-all">{cssEasing}</div>
          </div>

          {/* Animated preview box */}
          <div className="border border-edge p-2">
            <div className="text-[8px] font-mono uppercase text-gray-600 mb-1.5">Live Preview</div>
            <div className="h-12 flex items-center justify-center bg-panel2 relative overflow-hidden">
              <div
                className="w-6 h-6 bg-gray-300"
                style={{
                  animation: `sandboxPulse ${duration}ms ${cssEasing} ${loop === "infinite" ? "infinite" : loop}`,
                }}
              />
            </div>
            <style>{`
              @keyframes sandboxPulse {
                0% { transform: scale(0.5); opacity: 0.3; }
                100% { transform: scale(1.5); opacity: 1; }
              }
            `}</style>
          </div>

          {/* Apply to component */}
          <div className="space-y-1.5">
            <button
              onClick={() => send(projectId, `Set the easing to ${easingType === "preset" ? presetName : cssEasing} and duration to ${duration}ms on the selected component`)}
              disabled={!hasComponents}
              className="w-full px-2 py-1.5 text-[10px] text-gray-200 bg-panel2 border border-edge hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Apply sandbox parameters to the selected component via the Agent"
            >
              Apply to Selected
            </button>
            <button
              onClick={() => send(projectId, `Set the easing to ${easingType === "preset" ? presetName : cssEasing} and duration to ${duration}ms on all components`)}
              disabled={!hasComponents}
              className="w-full px-2 py-1.5 text-[10px] text-gray-300 border border-edge hover:text-gray-100 hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Apply sandbox parameters to all components via the Agent"
            >
              Apply to All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BezierControl({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[8px] font-mono text-gray-600">{label}</span>
        <span className="text-[8px] font-mono text-gray-400">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-gray-400"
      />
    </div>
  );
}

function EasingCurvePreview({ bezier }: { bezier: [number, number, number, number] }) {
  const [x1, y1, x2, y2] = bezier;
  const path = `M 0 100 C ${x1 * 100} ${100 - y1 * 100}, ${x2 * 100} ${100 - y2 * 100}, 100 0`;

  return (
    <svg viewBox="0 0 100 100" className="w-full h-20" preserveAspectRatio="none">
      {/* Grid */}
      <line x1="0" y1="100" x2="100" y2="100" stroke="#333" strokeWidth="0.5" />
      <line x1="0" y1="0" x2="0" y2="100" stroke="#333" strokeWidth="0.5" />
      <line x1="0" y1="0" x2="100" y2="0" stroke="#222" strokeWidth="0.3" />
      <line x1="100" y1="0" x2="100" y2="100" stroke="#222" strokeWidth="0.3" />

      {/* Control point lines */}
      <line x1="0" y1="100" x2={x1 * 100} y2={100 - y1 * 100} stroke="#444" strokeWidth="0.3" strokeDasharray="2" />
      <line x1="100" y1="0" x2={x2 * 100} y2={100 - y2 * 100} stroke="#444" strokeWidth="0.3" strokeDasharray="2" />

      {/* Control points */}
      <circle cx={x1 * 100} cy={100 - y1 * 100} r="1.5" fill="#666" />
      <circle cx={x2 * 100} cy={100 - y2 * 100} r="1.5" fill="#666" />

      {/* Curve */}
      <path d={path} fill="none" stroke="#ccc" strokeWidth="1" />
    </svg>
  );
}
