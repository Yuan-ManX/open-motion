import { useState, useEffect, useCallback } from "react";
import {
  EASING_PRESETS,
  type MotionComponent,
  type Easing,
  type Keyframe,
  type TransformProperty,
  TRANSFORM_PROPERTIES,
  NON_TRANSFORM_PROPERTIES,
} from "@openmotion/shared";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";
import { EasingCurveEditor } from "./EasingCurveEditor.js";

type Direction = MotionComponent["direction"];
type FillMode = MotionComponent["fillMode"];
type PlayState = MotionComponent["playState"];

const DIRECTIONS: Direction[] = ["normal", "reverse", "alternate", "alternate-reverse"];
const FILL_MODES: FillMode[] = ["none", "forwards", "backwards", "both"];
const PLAY_STATES: PlayState[] = ["running", "paused"];

function easingPresetName(e: Easing | undefined): string {
  if (!e) return "ease-out";
  return e.type === "preset" ? e.name : e.type;
}

export function ComponentInspector() {
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const components = useProjectStore((s) => s.components);
  const projectId = useProjectStore((s) => s.projectId);
  const patchComponentLocal = useProjectStore((s) => s.patchComponentLocal);

  const component = selectedId ? components.find((c) => c.id === selectedId) : null;

  const [easingType, setEasingType] = useState<string>("preset");
  const [easingName, setEasingName] = useState<string>("ease-out");
  const [bezier, setBezier] = useState<[number, number, number, number]>([0.33, 1, 0.68, 1]);
  const [spring, setSpring] = useState<{ stiffness: number; damping: number; mass: number }>({
    stiffness: 100,
    damping: 10,
    mass: 1,
  });
  const [durationMs, setDurationMs] = useState<number>(800);
  const [delayMs, setDelayMs] = useState<number>(0);
  const [iterationCount, setIterationCount] = useState<number>(1);
  const [infinite, setInfinite] = useState<boolean>(false);
  const [direction, setDirection] = useState<Direction>("normal");
  const [fillMode, setFillMode] = useState<FillMode>("forwards");
  const [playState, setPlayState] = useState<PlayState>("running");
  const [bgColor, setBgColor] = useState<string>("#6366f1");
  const [textColor, setTextColor] = useState<string>("#ffffff");
  const [saving, setSaving] = useState(false);
  const [keyframesOpen, setKeyframesOpen] = useState(true);

  useEffect(() => {
    if (!component) return;
    setEasingType(component.easing?.type ?? "preset");
    setEasingName(easingPresetName(component.easing));
    if (component.easing?.type === "bezier") {
      setBezier([...component.easing.p1, ...component.easing.p2]);
    }
    if (component.easing?.type === "spring") {
      setSpring({
        stiffness: component.easing.stiffness,
        damping: component.easing.damping,
        mass: component.easing.mass,
      });
    }
    setDurationMs(component.durationMs);
    setDelayMs(component.delayMs);
    setInfinite(component.iterationCount === "infinite");
    setIterationCount(
      component.iterationCount === "infinite" ? 1 : (component.iterationCount as number),
    );
    setDirection(component.direction);
    setFillMode(component.fillMode);
    setPlayState(component.playState);
    setBgColor(String(component.style?.backgroundColor ?? "#6366f1"));
    setTextColor(String(component.style?.color ?? "#ffffff"));
  }, [component?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildEasing = useCallback((): Easing => {
    if (easingType === "bezier") {
      return { type: "bezier", p1: [bezier[0], bezier[1]], p2: [bezier[2], bezier[3]] };
    }
    if (easingType === "spring") {
      return { type: "spring", stiffness: spring.stiffness, damping: spring.damping, mass: spring.mass };
    }
    return { type: "preset", name: easingName as (typeof EASING_PRESETS)[number] };
  }, [easingType, easingName, bezier, spring]);

  const persist = useCallback(
    async (patch: Partial<MotionComponent>) => {
      if (!projectId || !component) return;
      setSaving(true);
      try {
        await api.patchComponent(projectId, component.id, patch);
        patchComponentLocal(component.id, patch);
      } catch {
        /* ignore — local state stays as-is */
      } finally {
        setSaving(false);
      }
    },
    [projectId, component, patchComponentLocal],
  );

  const persistStyle = useCallback(
    (next: Record<string, string | number>) => {
      if (!component) return;
      const merged = { ...component.style, ...next };
      void persist({ style: merged });
    },
    [component, persist],
  );

  if (!component) {
    return (
      <div className="bg-panel border-t border-edge px-4 py-6 text-center text-xs text-gray-500">
        Select a component on the canvas to tune its motion.
      </div>
    );
  }

  const labelCls = "text-[11px] uppercase tracking-wide text-gray-500 mb-1";
  const inputCls =
    "w-full bg-panel2 border border-edge rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-accent";
  const selectCls = inputCls;

  return (
    <div className="bg-panel border-t border-edge flex flex-col" style={{ minHeight: 280 }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-edge">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-200 truncate">{component.name}</div>
          <div className="text-[10px] text-gray-600 font-mono">{component.id}</div>
        </div>
        {saving && <span className="text-[10px] text-accent2">saving…</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div>
          <div className={labelCls}>Easing</div>
          <select
            className={selectCls}
            value={easingType}
            onChange={(e) => {
              setEasingType(e.target.value);
              void persist({ easing: buildEasing() });
            }}
          >
            <option value="preset">preset</option>
            <option value="bezier">bezier</option>
            <option value="spring">spring</option>
          </select>
          {easingType === "preset" && (
            <select
              className={`${selectCls} mt-2`}
              value={easingName}
              onChange={(e) => {
                setEasingName(e.target.value);
                void persist({
                  easing: { type: "preset", name: e.target.value as (typeof EASING_PRESETS)[number] },
                });
              }}
            >
              {EASING_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
          {easingType === "bezier" && (
            <>
              <EasingCurveEditor
                bezier={bezier}
                onChange={(next) => {
                  setBezier(next);
                  void persist({ easing: buildEasing() });
                }}
              />
              <div className="grid grid-cols-4 gap-1 mt-1">
                {bezier.map((v, i) => (
                  <input
                    key={i}
                    type="number"
                    step="0.05"
                    className={inputCls}
                    value={v}
                    onChange={(e) => {
                      const next = [...bezier] as [number, number, number, number];
                      next[i] = Number(e.target.value);
                      setBezier(next);
                    }}
                    onBlur={() => void persist({ easing: buildEasing() })}
                  />
                ))}
              </div>
            </>
          )}
          {easingType === "spring" && (
            <SpringEditor
              spring={spring}
              onChange={(next) => {
                setSpring(next);
                void persist({
                  easing: { type: "spring", stiffness: next.stiffness, damping: next.damping, mass: next.mass },
                });
              }}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className={labelCls}>Duration (ms)</div>
            <input
              type="number"
              min={50}
              step={50}
              className={inputCls}
              value={durationMs}
              onChange={(e) => setDurationMs(Number(e.target.value))}
              onBlur={() => void persist({ durationMs })}
            />
          </div>
          <div>
            <div className={labelCls}>Delay (ms)</div>
            <input
              type="number"
              min={0}
              step={50}
              className={inputCls}
              value={delayMs}
              onChange={(e) => setDelayMs(Number(e.target.value))}
              onBlur={() => void persist({ delayMs })}
            />
          </div>
        </div>

        <div>
          <div className={labelCls}>Iteration</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={1}
              className={inputCls}
              value={iterationCount}
              disabled={infinite}
              onChange={(e) => setIterationCount(Number(e.target.value))}
              onBlur={() =>
                !infinite && void persist({ iterationCount: iterationCount })
              }
            />
            <label className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
              <input
                type="checkbox"
                checked={infinite}
                onChange={(e) => {
                  setInfinite(e.target.checked);
                  void persist({
                    iterationCount: e.target.checked ? "infinite" : iterationCount,
                  });
                }}
              />
              ∞
            </label>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className={labelCls}>Direction</div>
            <select
              className={selectCls}
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value as Direction);
                void persist({ direction: e.target.value as Direction });
              }}
            >
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className={labelCls}>Fill</div>
            <select
              className={selectCls}
              value={fillMode}
              onChange={(e) => {
                setFillMode(e.target.value as FillMode);
                void persist({ fillMode: e.target.value as FillMode });
              }}
            >
              {FILL_MODES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className={labelCls}>Play</div>
            <select
              className={selectCls}
              value={playState}
              onChange={(e) => {
                setPlayState(e.target.value as PlayState);
                void persist({ playState: e.target.value as PlayState });
              }}
            >
              {PLAY_STATES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className={labelCls}>Background</div>
            <div className="flex gap-1">
              <input
                type="color"
                className="h-8 w-8 rounded border border-edge bg-panel2 p-0"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                onBlur={() => persistStyle({ backgroundColor: bgColor })}
              />
              <input
                type="text"
                className={inputCls}
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                onBlur={() => persistStyle({ backgroundColor: bgColor })}
              />
            </div>
          </div>
          <div>
            <div className={labelCls}>Text color</div>
            <div className="flex gap-1">
              <input
                type="color"
                className="h-8 w-8 rounded border border-edge bg-panel2 p-0"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                onBlur={() => persistStyle({ color: textColor })}
              />
              <input
                type="text"
                className={inputCls}
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                onBlur={() => persistStyle({ color: textColor })}
              />
            </div>
          </div>
        </div>

        {/* Appearance: blur, borderRadius, boxShadow */}
        <div>
          <div className={labelCls}>Appearance</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-14">blur</span>
              <input
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={Number(String(component.style?.filter ?? "").match(/blur\(([\d.]+)px\)/)?.[1] ?? 0)}
                onChange={(e) => {
                  const v = e.target.value;
                  persistStyle({ filter: `blur(${v}px)` });
                }}
                className="flex-1 accent-accent"
              />
              <span className="text-[10px] text-gray-400 font-mono w-8 text-right">
                {String(component.style?.filter ?? "").match(/blur\(([\d.]+)px\)/)?.[1] ?? 0}px
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-14">radius</span>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={Number(component.style?.borderRadius ?? 8)}
                onChange={(e) => persistStyle({ borderRadius: `${e.target.value}px` })}
                className="flex-1 accent-accent"
              />
              <span className="text-[10px] text-gray-400 font-mono w-8 text-right">
                {component.style?.borderRadius ?? 8}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-14">shadow</span>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={Number(String(component.style?.boxShadow ?? "").match(/^(\d+)/)?.[1] ?? 0)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  persistStyle({ boxShadow: v > 0 ? `0 ${v / 2}px ${v}px rgba(0,0,0,0.3)` : "none" });
                }}
                className="flex-1 accent-accent"
              />
              <span className="text-[10px] text-gray-400 font-mono w-8 text-right">
                {String(component.style?.boxShadow ?? "").match(/^(\d+)/)?.[1] ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Keyframes */}
        <div className="border-t border-edge pt-3">
          <button
            onClick={() => setKeyframesOpen((v) => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <span className={labelCls} style={{ marginBottom: 0 }}>
              Keyframes ({component.keyframes.length})
            </span>
            <span className="text-[10px] text-gray-500">{keyframesOpen ? "▾" : "▸"}</span>
          </button>

          {keyframesOpen && (
            <div className="mt-2 space-y-2">
              {component.keyframes.length === 0 && (
                <p className="text-[11px] text-gray-600">No keyframes. Add one to script property steps.</p>
              )}
              {component.keyframes.map((kf, idx) => (
                <KeyframeRow
                  key={idx}
                  keyframe={kf}
                  onChange={(next) => {
                    const arr = component.keyframes.map((k, i) => (i === idx ? next : k));
                    void persist({ keyframes: arr });
                  }}
                  onRemove={() => {
                    const arr = component.keyframes.filter((_, i) => i !== idx);
                    void persist({ keyframes: arr });
                  }}
                />
              ))}
              <button
                onClick={() => {
                  const arr: Keyframe[] = [
                    ...component.keyframes,
                    { offset: 0.5, properties: {} },
                  ];
                  void persist({ keyframes: arr });
                }}
                className="w-full px-2 py-1 rounded border border-edge bg-panel2 hover:border-accent text-[11px] text-gray-300 transition-colors"
              >
                + Add keyframe
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const ALL_PROPERTIES: readonly TransformProperty[] = [
  ...TRANSFORM_PROPERTIES,
  ...NON_TRANSFORM_PROPERTIES,
];

function SpringEditor({
  spring,
  onChange,
}: {
  spring: { stiffness: number; damping: number; mass: number };
  onChange: (next: { stiffness: number; damping: number; mass: number }) => void;
}) {
  const r = spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass));
  const behavior = r >= 1 ? "over-damped" : r >= 0.7 ? "critically damped" : r >= 0.4 ? "under-damped" : "bouncy";
  const behaviorColor =
    r >= 1 ? "text-gray-400" : r >= 0.7 ? "text-green-400" : r >= 0.4 ? "text-yellow-400" : "text-orange-400";

  const sliderCls = "flex-1 accent-accent";

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-edge bg-panel2 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">damping ratio</span>
        <span className={`text-[10px] font-mono ${behaviorColor}`}>
          ζ={r.toFixed(2)} · {behavior}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-16">stiffness</span>
        <input
          type="range"
          min={1}
          max={300}
          step={1}
          value={spring.stiffness}
          onChange={(e) => onChange({ ...spring, stiffness: Number(e.target.value) })}
          className={sliderCls}
        />
        <input
          type="number"
          className="w-14 bg-panel border border-edge rounded px-1 py-0.5 text-[10px] text-gray-100 text-right"
          value={spring.stiffness}
          onChange={(e) => onChange({ ...spring, stiffness: Number(e.target.value) })}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-16">damping</span>
        <input
          type="range"
          min={0}
          max={40}
          step={0.5}
          value={spring.damping}
          onChange={(e) => onChange({ ...spring, damping: Number(e.target.value) })}
          className={sliderCls}
        />
        <input
          type="number"
          className="w-14 bg-panel border border-edge rounded px-1 py-0.5 text-[10px] text-gray-100 text-right"
          value={spring.damping}
          onChange={(e) => onChange({ ...spring, damping: Number(e.target.value) })}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-16">mass</span>
        <input
          type="range"
          min={0.1}
          max={10}
          step={0.1}
          value={spring.mass}
          onChange={(e) => onChange({ ...spring, mass: Number(e.target.value) })}
          className={sliderCls}
        />
        <input
          type="number"
          className="w-14 bg-panel border border-edge rounded px-1 py-0.5 text-[10px] text-gray-100 text-right"
          value={spring.mass}
          onChange={(e) => onChange({ ...spring, mass: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}

function KeyframeRow({
  keyframe,
  onChange,
  onRemove,
}: {
  keyframe: Keyframe;
  onChange: (next: Keyframe) => void;
  onRemove: () => void;
}) {
  const inputCls =
    "w-full bg-panel2 border border-edge rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-accent";

  const setOffset = (offset: number) => onChange({ ...keyframe, offset: Math.max(0, Math.min(1, offset)) });
  const setEasing = (name: string) => {
    if (name === "none") {
      const { easing: _easing, ...rest } = keyframe;
      void _easing;
      onChange({ ...rest });
    } else {
      onChange({ ...keyframe, easing: { type: "preset", name: name as (typeof EASING_PRESETS)[number] } });
    }
  };
  const setPropKey = (oldKey: string, newKey: TransformProperty) => {
    const entries = Object.entries(keyframe.properties);
    const rebuilt: Record<string, string | number> = {};
    for (const [k, v] of entries) {
      rebuilt[k === oldKey ? newKey : k] = v;
    }
    onChange({ ...keyframe, properties: rebuilt });
  };
  const setPropValue = (key: string, value: string) => {
    const numeric = Number(value);
    const next = Number.isFinite(numeric) && value !== "" ? numeric : value;
    onChange({ ...keyframe, properties: { ...keyframe.properties, [key]: next } });
  };
  const addProp = () => {
    const used = new Set(Object.keys(keyframe.properties));
    const free = ALL_PROPERTIES.find((p) => !used.has(p));
    if (!free) return;
    onChange({ ...keyframe, properties: { ...keyframe.properties, [free]: 0 } });
  };
  const removeProp = (key: string) => {
    const next: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(keyframe.properties)) {
      if (k !== key) next[k] = v;
    }
    onChange({ ...keyframe, properties: next });
  };

  const easingName = keyframe.easing?.type === "preset" ? keyframe.easing.name : "none";

  return (
    <div className="rounded border border-edge bg-panel2 p-2 space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="text-[10px] text-gray-500 mb-0.5">offset (0–1)</div>
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className={inputCls}
            value={keyframe.offset}
            onChange={(e) => setOffset(Number(e.target.value))}
          />
        </div>
        <div className="flex-1">
          <div className="text-[10px] text-gray-500 mb-0.5">easing</div>
          <select className={inputCls} value={easingName} onChange={(e) => setEasing(e.target.value)}>
            <option value="none">none</option>
            {EASING_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={onRemove}
          className="self-end px-2 py-1 rounded border border-edge bg-panel hover:border-red-400 text-[10px] text-gray-400"
          title="Remove keyframe"
        >
          ✕
        </button>
      </div>

      {Object.entries(keyframe.properties).map(([key, value]) => (
        <div key={key} className="flex items-center gap-1">
          <select
            className={`${inputCls} flex-1`}
            value={key}
            onChange={(e) => setPropKey(key, e.target.value as TransformProperty)}
          >
            {ALL_PROPERTIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            type="text"
            className={`${inputCls} flex-1`}
            value={String(value)}
            onChange={(e) => setPropValue(key, e.target.value)}
          />
          <button
            onClick={() => removeProp(key)}
            className="px-1.5 py-1 rounded border border-edge bg-panel hover:border-red-400 text-[10px] text-gray-400"
            title="Remove property"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={addProp}
        className="w-full px-2 py-0.5 rounded border border-edge bg-panel hover:border-accent text-[10px] text-gray-500"
      >
        + property
      </button>
    </div>
  );
}
