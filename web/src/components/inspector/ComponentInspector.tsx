import { useState, useEffect, useCallback, useMemo } from "react";
import {
  EASING_PRESETS,
  type MotionComponent,
  type Easing,
  type Keyframe,
  type TransformProperty,
  TRANSFORM_PROPERTIES,
  NON_TRANSFORM_PROPERTIES,
} from "@openmotion/shared";
import { buildMotionDna } from "../../motion/dna.js";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";
import { EasingCurveEditor } from "./EasingCurveEditor.js";
import { EasingPresetPicker } from "./EasingPresetPicker.js";
import { PropertyKeyframes } from "./PropertyKeyframes.js";
import { ColorPicker } from "./ColorPicker.js";
import { ListenerPanel } from "./ListenerPanel.js";

type Direction = MotionComponent["direction"];
type FillMode = MotionComponent["fillMode"];
type PlayState = MotionComponent["playState"];
type Trigger = MotionComponent["trigger"];

const DIRECTIONS: Direction[] = ["normal", "reverse", "alternate", "alternate-reverse"];
const FILL_MODES: FillMode[] = ["none", "forwards", "backwards", "both"];
const PLAY_STATES: PlayState[] = ["running", "paused"];
const TRIGGERS: Trigger[] = ["onLoad", "onClick", "onHover", "onScroll", "afterDelay"];

/** Animation presets that can be applied with one click from the inspector. */
const QUICK_PRESETS: Record<string, {
  label: string;
  keyframes: Keyframe[];
  easing: Easing;
  durationMs: number;
  iterationCount: number | "infinite";
  direction: Direction;
}> = {
  shake: {
    label: "Shake",
    keyframes: [
      { offset: 0, properties: { translateX: 0 }, easing: { type: "preset", name: "linear" } },
      { offset: 0.25, properties: { translateX: -10 } },
      { offset: 0.5, properties: { translateX: 10 } },
      { offset: 0.75, properties: { translateX: -8 } },
      { offset: 1, properties: { translateX: 0 } },
    ],
    easing: { type: "preset", name: "linear" },
    durationMs: 500,
    iterationCount: "infinite",
    direction: "normal",
  },
  wiggle: {
    label: "Wiggle",
    keyframes: [
      { offset: 0, properties: { rotate: 0 }, easing: { type: "preset", name: "ease-in-out" } },
      { offset: 0.5, properties: { rotate: 8 } },
      { offset: 1, properties: { rotate: 0 } },
    ],
    easing: { type: "preset", name: "ease-in-out" },
    durationMs: 1000,
    iterationCount: "infinite",
    direction: "alternate",
  },
  float: {
    label: "Float",
    keyframes: [
      { offset: 0, properties: { translateY: 0 }, easing: { type: "preset", name: "ease-in-out" } },
      { offset: 0.5, properties: { translateY: -16 } },
      { offset: 1, properties: { translateY: 0 } },
    ],
    easing: { type: "preset", name: "ease-in-out" },
    durationMs: 2000,
    iterationCount: "infinite",
    direction: "alternate",
  },
  glow: {
    label: "Glow",
    keyframes: [
      { offset: 0, properties: { opacity: 0.6 }, easing: { type: "preset", name: "ease-in-out" } },
      { offset: 0.5, properties: { opacity: 1 } },
      { offset: 1, properties: { opacity: 0.6 } },
    ],
    easing: { type: "preset", name: "ease-in-out" },
    durationMs: 1500,
    iterationCount: "infinite",
    direction: "alternate",
  },
  heartbeat: {
    label: "Heartbeat",
    keyframes: [
      { offset: 0, properties: { scale: 1 }, easing: { type: "preset", name: "ease-in-out" } },
      { offset: 0.15, properties: { scale: 1.15 } },
      { offset: 0.3, properties: { scale: 1 } },
      { offset: 0.45, properties: { scale: 1.15 } },
      { offset: 0.6, properties: { scale: 1 } },
      { offset: 1, properties: { scale: 1 } },
    ],
    easing: { type: "preset", name: "ease-in-out" },
    durationMs: 1300,
    iterationCount: "infinite",
    direction: "normal",
  },
  typewriter: {
    label: "Typewriter",
    keyframes: [
      { offset: 0, properties: { width: "0%" }, easing: { type: "preset", name: "linear" } },
      { offset: 1, properties: { width: "100%" } },
    ],
    easing: { type: "preset", name: "linear" },
    durationMs: 1500,
    iterationCount: 1,
    direction: "normal",
  },
};

function easingPresetName(e: Easing | undefined): string {
  if (!e) return "ease-out";
  return e.type === "preset" ? e.name : e.type;
}

interface FilterValues {
  blur: number;
  brightness: number;
  contrast: number;
  saturate: number;
  hueRotate: number;
}

const DEFAULT_FILTERS: FilterValues = {
  blur: 0,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  hueRotate: 0,
};

function parseFilter(raw: string | number | undefined): FilterValues {
  const s = String(raw ?? "");
  const out = { ...DEFAULT_FILTERS };
  const m = s.match(/blur\(([\d.]+)px\)/);
  if (m) out.blur = Number(m[1]);
  const b = s.match(/brightness\(([\d.]+)%?\)/);
  if (b) out.brightness = Number(b[1]);
  const c = s.match(/contrast\(([\d.]+)%?\)/);
  if (c) out.contrast = Number(c[1]);
  const sa = s.match(/saturate\(([\d.]+)%?\)/);
  if (sa) out.saturate = Number(sa[1]);
  const h = s.match(/hue-rotate\(([\d.]+)deg\)/);
  if (h) out.hueRotate = Number(h[1]);
  return out;
}

function buildFilter(v: FilterValues): string {
  const parts: string[] = [];
  if (v.blur > 0) parts.push(`blur(${v.blur}px)`);
  if (v.brightness !== 100) parts.push(`brightness(${v.brightness}%)`);
  if (v.contrast !== 100) parts.push(`contrast(${v.contrast}%)`);
  if (v.saturate !== 100) parts.push(`saturate(${v.saturate}%)`);
  if (v.hueRotate !== 0) parts.push(`hue-rotate(${v.hueRotate}deg)`);
  return parts.length ? parts.join(" ") : "none";
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
  const [trigger, setTrigger] = useState<Trigger>("onLoad");
  const [bgColor, setBgColor] = useState<string>("#e5e5e5");
  const [textColor, setTextColor] = useState<string>("#0a0a0a");
  const [saving, setSaving] = useState(false);
  const [keyframesOpen, setKeyframesOpen] = useState(true);

  // Signature of the fields synced from the store — when the agent mutates the
  // component via chat (spec_update), this signature changes and triggers a resync
  // of local form state. Using a signature instead of the whole object avoids
  // feedback loops: user typing updates local state without changing the signature.
  const syncSignature = component
    ? JSON.stringify({
        id: component.id,
        easing: component.easing,
        durationMs: component.durationMs,
        delayMs: component.delayMs,
        iterationCount: component.iterationCount,
        direction: component.direction,
        fillMode: component.fillMode,
        playState: component.playState,
        trigger: component.trigger,
        bg: component.style?.backgroundColor,
        color: component.style?.color,
      })
    : "";

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
    setTrigger(component.trigger ?? "onLoad");
    setBgColor(String(component.style?.backgroundColor ?? "#e5e5e5"));
    setTextColor(String(component.style?.color ?? "#0a0a0a"));
  }, [syncSignature]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const autoKf = useUiStore.getState().autoKeyframe;
      const animatableProps = new Set<string>([...TRANSFORM_PROPERTIES, ...NON_TRANSFORM_PROPERTIES]);
      const kfProps: Record<string, string | number> = {};
      const staticProps: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(next)) {
        if (autoKf && animatableProps.has(k)) kfProps[k] = v;
        else staticProps[k] = v;
      }
      const merged = { ...component.style, ...staticProps };
      if (!autoKf || Object.keys(kfProps).length === 0) {
        void persist({ style: merged });
        return;
      }
      const playheadMs = useUiStore.getState().playheadMs;
      const offset = component.durationMs > 0
        ? Math.max(0, Math.min(1, (playheadMs - component.delayMs) / component.durationMs))
        : 0;
      const existing = component.keyframes ?? [];
      const atOffset = existing.find((kf) => Math.abs(kf.offset - offset) < 0.001);
      let updatedKeyframes: Keyframe[];
      if (atOffset) {
        updatedKeyframes = existing.map((kf) =>
          kf === atOffset ? { ...kf, properties: { ...kf.properties, ...kfProps } } : kf,
        );
      } else {
        const newKf: Keyframe = { offset, properties: kfProps as Record<TransformProperty, string | number> };
        updatedKeyframes = [...existing, newKf].sort((a, b) => a.offset - b.offset);
      }
      void persist({ style: merged, keyframes: updatedKeyframes });
    },
    [component, persist],
  );

  const applyPreset = useCallback(
    (presetKey: string) => {
      const preset = QUICK_PRESETS[presetKey];
      if (!preset || !component) return;
      void persist({
        keyframes: preset.keyframes,
        easing: preset.easing,
        durationMs: preset.durationMs,
        iterationCount: preset.iterationCount,
        direction: preset.direction,
      });
    },
    [component, persist],
  );

  if (!component) {
    return <ArtboardPanel />;
  }

  const labelCls = "text-[11px] uppercase tracking-wide text-gray-500 mb-1";
  const inputCls =
    "w-full bg-panel2 border border-edge rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-accent";
  const selectCls = inputCls;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-edge flex-shrink-0">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-200 truncate">{component.name}</div>
          <div className="text-[10px] text-gray-600 font-mono">{component.id}</div>
          <div className="text-[9px] text-accent2/70 font-mono mt-0.5" title="Motion DNA signature">
            {buildMotionDna(component)}
          </div>
        </div>
        {saving && <span className="text-[10px] text-accent2">saving…</span>}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Transform: X/Y/W/H/Rotation */}
        <div>
          <div className={labelCls}>Transform</div>
          <div className="grid grid-cols-2 gap-1.5">
            {(() => {
              const parsePx = (val: unknown) => {
                const s = String(val ?? "0").replace(/px$/, "").replace(/%$/, "");
                const n = Number(s);
                return isNaN(n) ? 0 : n;
              };
              const xVal = parsePx(component.style?.left);
              const yVal = parsePx(component.style?.top);
              const wVal = parsePx(component.style?.width) || 100;
              const hVal = parsePx(component.style?.height) || 100;
              const rotMatch = String(component.style?.transform ?? "").match(/rotate\((-?[\d.]+)deg\)/);
              const rotVal = rotMatch ? Number(rotMatch[1]) : 0;
              return (
                <>
                  <div>
                    <span className="text-[9px] text-gray-600">X</span>
                    <input
                      type="number"
                      className={inputCls}
                      defaultValue={xVal}
                      key={`x-${xVal}`}
                      onBlur={(e) => persistStyle({ position: "absolute", left: `${Number(e.target.value) || 0}px` })}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-600">Y</span>
                    <input
                      type="number"
                      className={inputCls}
                      defaultValue={yVal}
                      key={`y-${yVal}`}
                      onBlur={(e) => persistStyle({ position: "absolute", top: `${Number(e.target.value) || 0}px` })}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-600">W</span>
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      defaultValue={wVal}
                      key={`w-${wVal}`}
                      onBlur={(e) => persistStyle({ width: Number(e.target.value) || 100 })}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-600">H</span>
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      defaultValue={hVal}
                      key={`h-${hVal}`}
                      onBlur={(e) => persistStyle({ height: Number(e.target.value) || 100 })}
                    />
                  </div>
                  <div className="col-span-2">
                    <span className="text-[9px] text-gray-600">Rotation (°)</span>
                    <input
                      type="number"
                      step={15}
                      className={inputCls}
                      defaultValue={rotVal}
                      key={`rot-${rotVal}`}
                      onBlur={(e) => {
                        const existing = String(component.style?.transform ?? "");
                        const withoutRotate = existing.replace(/rotate\([^)]*\)\s*/g, "");
                        const rot = `rotate(${Number(e.target.value) || 0}deg)`;
                        persistStyle({ transform: `${withoutRotate} ${rot}`.trim() });
                      }}
                    />
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* 3D Transform: perspective, rotateX/Y/Z, translateZ */}
        <div>
          <div className={labelCls}>3D Transform</div>
          <div className="space-y-1.5">
            {(() => {
              const parseDeg = (val: unknown) => {
                const s = String(val ?? "0").replace(/deg$/, "");
                const n = Number(s);
                return isNaN(n) ? 0 : n;
              };
              const parsePx = (val: unknown) => {
                const s = String(val ?? "0").replace(/px$/, "");
                const n = Number(s);
                return isNaN(n) ? 0 : n;
              };
              const perspectiveVal = parsePx(component.style?.perspective) || 0;
              const rotXVal = parseDeg(component.style?.rotateX);
              const rotYVal = parseDeg(component.style?.rotateY);
              const rotZVal = parseDeg(component.style?.rotateZ);
              const transZVal = parsePx(component.style?.translateZ);
              const sliders: {
                key: string;
                label: string;
                val: number;
                min: number;
                max: number;
                step: number;
                unit: string;
              }[] = [
                { key: "perspective", label: "persp", val: perspectiveVal, min: 0, max: 2000, step: 50, unit: "px" },
                { key: "rotateX", label: "rot X", val: rotXVal, min: -180, max: 180, step: 5, unit: "°" },
                { key: "rotateY", label: "rot Y", val: rotYVal, min: -180, max: 180, step: 5, unit: "°" },
                { key: "rotateZ", label: "rot Z", val: rotZVal, min: -180, max: 180, step: 5, unit: "°" },
                { key: "translateZ", label: "trans Z", val: transZVal, min: -500, max: 500, step: 10, unit: "px" },
              ];
              return (
                <>
                  {sliders.map((s) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-14">{s.label}</span>
                      <input
                        type="range"
                        min={s.min}
                        max={s.max}
                        step={s.step}
                        value={s.val}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          const valStr = s.unit === "°" ? `${v}deg` : `${v}px`;
                          persistStyle({ [s.key]: valStr });
                        }}
                        className="flex-1 accent-accent"
                      />
                      <span className="text-[10px] text-gray-400 font-mono w-12 text-right">
                        {s.val}{s.unit}
                      </span>
                    </div>
                  ))}
                  {(perspectiveVal > 0 || rotXVal !== 0 || rotYVal !== 0 || rotZVal !== 0 || transZVal !== 0) && (
                    <button
                      onClick={() => {
                        const next = { ...component.style };
                        delete next.perspective;
                        delete next.rotateX;
                        delete next.rotateY;
                        delete next.rotateZ;
                        delete next.translateZ;
                        void persist({ style: next });
                      }}
                      className="w-full text-[10px] text-gray-500 hover:text-red-400 border border-edge rounded py-0.5 transition-colors"
                    >
                      Reset 3D
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>

        <div>
          <div className={labelCls}>Quick Presets</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(QUICK_PRESETS).map(([key, p]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className="text-[10px] px-2 py-1 rounded bg-panel2 border border-edge text-gray-400 hover:text-accent hover:border-accent transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className={labelCls}>Easing</div>
          <select
            className={selectCls}
            value={easingType}
            onChange={(e) => {
              const newType = e.target.value;
              setEasingType(newType);
              let nextEasing: Easing;
              if (newType === "bezier") {
                nextEasing = { type: "bezier", p1: [bezier[0], bezier[1]], p2: [bezier[2], bezier[3]] };
              } else if (newType === "spring") {
                nextEasing = { type: "spring", stiffness: spring.stiffness, damping: spring.damping, mass: spring.mass };
              } else {
                nextEasing = { type: "preset", name: easingName as (typeof EASING_PRESETS)[number] };
              }
              void persist({ easing: nextEasing });
            }}
          >
            <option value="preset">preset</option>
            <option value="bezier">bezier</option>
            <option value="spring">spring</option>
          </select>
          {easingType === "preset" && (
            <EasingPresetPicker
              value={easingName}
              onChange={(name) => {
                setEasingName(name);
                void persist({
                  easing: { type: "preset", name: name as (typeof EASING_PRESETS)[number] },
                });
              }}
            />
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

        <div>
          <div className={labelCls}>Trigger</div>
          <select
            className={selectCls}
            value={trigger}
            onChange={(e) => {
              setTrigger(e.target.value as Trigger);
              void persist({ trigger: e.target.value as Trigger });
            }}
          >
            {TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className={labelCls}>Background</div>
            <div className="flex gap-1">
              <ColorPicker
                value={bgColor}
                onChange={(hex) => { setBgColor(hex); persistStyle({ backgroundColor: hex }); }}
                label="Background"
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
              <ColorPicker
                value={textColor}
                onChange={(hex) => { setTextColor(hex); persistStyle({ color: hex }); }}
                label="Text color"
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

        {/* Appearance: filters, borderRadius, boxShadow */}
        <div>
          <div className={labelCls}>Appearance</div>
          <div className="space-y-2">
            {(() => {
              const fv = parseFilter(component.style?.filter);
              const updateFilter = (patch: Partial<FilterValues>) => {
                const next = { ...fv, ...patch };
                persistStyle({ filter: buildFilter(next) });
              };
              const sliders: {
                key: keyof FilterValues;
                label: string;
                min: number;
                max: number;
                step: number;
                unit: string;
              }[] = [
                { key: "blur", label: "blur", min: 0, max: 20, step: 0.5, unit: "px" },
                { key: "brightness", label: "bright", min: 0, max: 200, step: 5, unit: "%" },
                { key: "contrast", label: "contrast", min: 0, max: 200, step: 5, unit: "%" },
                { key: "saturate", label: "saturate", min: 0, max: 200, step: 5, unit: "%" },
                { key: "hueRotate", label: "hue", min: 0, max: 360, step: 5, unit: "°" },
              ];
              return (
                <>
                  {sliders.map((s) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-14">{s.label}</span>
                      <input
                        type="range"
                        min={s.min}
                        max={s.max}
                        step={s.step}
                        value={fv[s.key]}
                        onChange={(e) => updateFilter({ [s.key]: Number(e.target.value) } as Partial<FilterValues>)}
                        className="flex-1 accent-accent"
                      />
                      <span className="text-[10px] text-gray-400 font-mono w-10 text-right">
                        {fv[s.key]}{s.unit}
                      </span>
                    </div>
                  ))}
                </>
              );
            })()}
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
              <span className="text-[10px] text-gray-400 font-mono w-10 text-right">
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
              <span className="text-[10px] text-gray-400 font-mono w-10 text-right">
                {String(component.style?.boxShadow ?? "").match(/^(\d+)/)?.[1] ?? 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-14">opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={(() => { const n = Number(component.style?.opacity); return isNaN(n) ? 1 : n; })()}
                onChange={(e) => persistStyle({ opacity: Number(e.target.value) })}
                className="flex-1 accent-accent"
              />
              <span className="text-[10px] text-gray-400 font-mono w-10 text-right">
                {Math.round(((() => { const n = Number(component.style?.opacity); return isNaN(n) ? 1 : n; })()) * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 w-14">blend</span>
              <select
                className="flex-1 bg-panel2 border border-edge rounded px-1 py-0.5 text-[10px] text-gray-100 focus:outline-none focus:border-accent"
                value={String(component.style?.mixBlendMode ?? "normal")}
                onChange={(e) => persistStyle({ mixBlendMode: e.target.value })}
              >
                {["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Per-property keyframe tracks */}
        <div className="border-t border-edge pt-3">
          <div className={labelCls} style={{ marginBottom: 6 }}>Property Tracks</div>
          <PropertyKeyframes
            component={component}
            onChange={(kfs) => void persist({ keyframes: kfs })}
          />
        </div>

        {/* Event Listeners (Rive-style) */}
        <ListenerPanel component={component} />

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
              {component.keyframes.length >= 2 && (
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const reversed = component.keyframes
                        .map((kf) => ({ ...kf, offset: 1 - kf.offset }))
                        .sort((a, b) => a.offset - b.offset);
                      void persist({ keyframes: reversed });
                    }}
                    className="flex-1 px-2 py-1 rounded border border-edge bg-panel2 hover:border-accent text-[10px] text-gray-400 transition-colors"
                    title="Reverse keyframe order (swap offsets)"
                    aria-label="Reverse keyframes"
                  >
                    ⇄ Reverse
                  </button>
                  <button
                    onClick={() => {
                      const mirrored = component.keyframes.map((kf) => {
                        const props = { ...kf.properties } as Record<string, string | number>;
                        for (const [k, v] of Object.entries(props)) {
                          if (typeof v === "number" && ["translateX", "translateY", "scale", "scaleX", "scaleY", "rotate", "skewX", "skewY"].includes(k)) {
                            props[k] = -v;
                          }
                        }
                        return { ...kf, properties: props };
                      });
                      void persist({ keyframes: mirrored });
                    }}
                    className="flex-1 px-2 py-1 rounded border border-edge bg-panel2 hover:border-accent text-[10px] text-gray-400 transition-colors"
                    title="Mirror keyframe values (negate transform numbers)"
                    aria-label="Mirror keyframes"
                  >
                    ⊟ Mirror
                  </button>
                </div>
              )}
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
    r >= 1 ? "text-gray-500" : r >= 0.7 ? "text-white" : r >= 0.4 ? "text-gray-300" : "text-accent";

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
          aria-label="Remove keyframe"
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
            aria-label={`Remove property ${key}`}
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

/** Artboard properties panel shown when no component is selected. */
function ArtboardPanel() {
  const project = useProjectStore((s) => s.project);
  const projectId = useProjectStore((s) => s.projectId);
  const components = useProjectStore((s) => s.components);
  const setArtboard = useProjectStore((s) => s.setArtboard);
  const canvasSize = useUiStore((s) => s.canvasSize);
  const setCanvasSize = useUiStore((s) => s.setCanvasSize);
  const [bgColor, setBgColor] = useState("");

  const tokens = project?.tokens ?? {};
  const storedBg = String(tokens.artboardBackground ?? "");

  useEffect(() => {
    if (storedBg) setBgColor(storedBg);
  }, [storedBg]);

  const labelCls = "text-[11px] uppercase tracking-wide text-gray-500 mb-1";
  const inputCls = "w-full bg-panel2 border border-edge rounded px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-accent";

  const handleWidthBlur = () => {
    void setArtboard({ width: canvasSize.width, height: canvasSize.height });
  };
  const handleHeightBlur = () => {
    void setArtboard({ width: canvasSize.width, height: canvasSize.height });
  };
  const handleBgBlur = () => {
    void setArtboard({ width: canvasSize.width, height: canvasSize.height }, bgColor || undefined);
  };

  // Parse constraints from tokens
  const constraints = useMemo(() => {
    const raw = tokens.constraints;
    if (typeof raw !== "string") return [];
    try {
      return JSON.parse(raw) as Array<{ id: string; type: string; componentId: string; targetId?: string }>;
    } catch {
      return [];
    }
  }, [tokens.constraints]);

  // Parse clips from tokens
  const clips = useMemo(() => {
    const raw = tokens.clips;
    if (typeof raw !== "string") return [];
    try {
      return JSON.parse(raw) as Array<{ id: string; name: string; startMs: number; endMs: number; color?: string }>;
    } catch {
      return [];
    }
  }, [tokens.clips]);

  const handleRemoveConstraint = useCallback(async (constraintId: string) => {
    if (!projectId || !project) return;
    const remaining = constraints.filter((c) => c.id !== constraintId);
    const newTokens = { ...project.tokens, constraints: JSON.stringify(remaining) };
    useProjectStore.setState((s) => ({ project: s.project ? { ...s.project, tokens: newTokens } : s.project }));
    try {
      await api.updateProject(projectId, { tokens: newTokens });
    } catch { /* ignore */ }
  }, [projectId, project, constraints]);

  const handleRemoveClip = useCallback(async (clipId: string) => {
    if (!projectId || !project) return;
    const remaining = clips.filter((c) => c.id !== clipId);
    const newTokens = { ...project.tokens, clips: JSON.stringify(remaining) };
    useProjectStore.setState((s) => ({ project: s.project ? { ...s.project, tokens: newTokens } : s.project }));
    try {
      await api.updateProject(projectId, { tokens: newTokens });
    } catch { /* ignore */ }
  }, [projectId, project, clips]);

  const compName = (id: string) => components.find((c) => c.id === id)?.name ?? id.slice(0, 8);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 py-2 border-b border-edge flex-shrink-0">
        <div className="text-sm font-semibold text-gray-200">Artboard</div>
        <div className="text-[10px] text-gray-600">Canvas properties</div>
      </div>

      <div className="flex-1 px-4 py-3 space-y-4">
        <div>
          <div className={labelCls}>Dimensions</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={64}
              max={4096}
              step={16}
              className={inputCls}
              value={canvasSize.width}
              onChange={(e) => setCanvasSize({ width: Number(e.target.value) || 64, height: canvasSize.height })}
              onBlur={handleWidthBlur}
              aria-label="Canvas width"
            />
            <span className="text-gray-600 text-xs">×</span>
            <input
              type="number"
              min={64}
              max={4096}
              step={16}
              className={inputCls}
              value={canvasSize.height}
              onChange={(e) => setCanvasSize({ width: canvasSize.width, height: Number(e.target.value) || 64 })}
              onBlur={handleHeightBlur}
              aria-label="Canvas height"
            />
          </div>
        </div>

        <div>
          <div className={labelCls}>Background</div>
          <div className="flex gap-1">
            <ColorPicker
              value={bgColor || "#0a0a0a"}
              onChange={(hex) => { setBgColor(hex); void setArtboard({ width: canvasSize.width, height: canvasSize.height }, hex); }}
              label="Background"
            />
            <input
              type="text"
              className={inputCls}
              value={bgColor}
              placeholder="transparent"
              onChange={(e) => setBgColor(e.target.value)}
              onBlur={handleBgBlur}
            />
          </div>
        </div>

        {/* Clips management */}
        <div className="pt-2 border-t border-edge">
          <div className={labelCls}>Timeline Clips</div>
          {clips.length === 0 ? (
            <p className="text-[11px] text-gray-600">No clips. Ask the agent to create animation segments.</p>
          ) : (
            <div className="space-y-1">
              {clips.map((clip) => (
                <div key={clip.id} className="flex items-center gap-2 bg-panel2 border border-edge rounded px-2 py-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-gray-300 truncate">{clip.name}</div>
                    <div className="text-[9px] text-gray-600 font-mono">{clip.startMs}ms–{clip.endMs}ms</div>
                  </div>
                  <button
                    onClick={() => void handleRemoveClip(clip.id)}
                    className="text-[10px] text-gray-600 hover:text-red-400 px-1"
                    aria-label={`Remove clip ${clip.name}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Constraints management */}
        <div className="pt-2 border-t border-edge">
          <div className={labelCls}>Constraints</div>
          {constraints.length === 0 ? (
            <p className="text-[11px] text-gray-600">No constraints. Ask the agent to link components.</p>
          ) : (
            <div className="space-y-1">
              {constraints.map((con) => (
                <div key={con.id} className="flex items-center gap-2 bg-panel2 border border-edge rounded px-2 py-1">
                  <span className="text-[9px] text-accent2 font-mono flex-shrink-0">{con.type}</span>
                  <div className="flex-1 min-w-0 text-[10px] text-gray-400 truncate">
                    {compName(con.componentId)}
                    {con.targetId && <span className="text-gray-600"> → {compName(con.targetId)}</span>}
                  </div>
                  <button
                    onClick={() => void handleRemoveConstraint(con.id)}
                    className="text-[10px] text-gray-600 hover:text-red-400 px-1"
                    aria-label="Remove constraint"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-edge">
          <div className="text-[10px] text-gray-600">
            No component selected. Pick one on the canvas to tune its motion.
          </div>
        </div>
      </div>
    </div>
  );
}
