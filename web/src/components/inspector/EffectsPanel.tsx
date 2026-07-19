import { useCallback, useMemo } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import * as api from "../../api/endpoints.js";

/**
 * CSS filter effect definitions. Each effect maps to a CSS filter function
 * with a numeric range, unit, and default value.
 */
interface EffectDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
  /** Format the display value (e.g. percentages) */
  format?: (v: number) => string;
}

const EFFECTS: EffectDef[] = [
  { key: "blur", label: "Blur", min: 0, max: 20, step: 0.5, default: 0, unit: "px" },
  { key: "brightness", label: "Brightness", min: 0, max: 200, step: 5, default: 100, unit: "%", format: (v) => `${v}%` },
  { key: "contrast", label: "Contrast", min: 0, max: 200, step: 5, default: 100, unit: "%", format: (v) => `${v}%` },
  { key: "saturate", label: "Saturation", min: 0, max: 200, step: 5, default: 100, unit: "%", format: (v) => `${v}%` },
  { key: "hue-rotate", label: "Hue Rotate", min: 0, max: 360, step: 5, default: 0, unit: "deg" },
  { key: "grayscale", label: "Grayscale", min: 0, max: 100, step: 5, default: 0, unit: "%", format: (v) => `${v}%` },
  { key: "sepia", label: "Sepia", min: 0, max: 100, step: 5, default: 0, unit: "%", format: (v) => `${v}%` },
  { key: "invert", label: "Invert", min: 0, max: 100, step: 5, default: 0, unit: "%", format: (v) => `${v}%` },
];

/** Drop-shadow effect — separate from the main filter list because it has 4 parameters. */
interface DropShadow {
  x: number;
  y: number;
  blur: number;
  color: string;
}

const DEFAULT_SHADOW: DropShadow = { x: 0, y: 0, blur: 0, color: "#000000" };

/** Parsed filter values — numeric effects plus optional drop-shadow. */
interface ParsedFilters {
  [key: string]: number | DropShadow | undefined;
  dropShadow?: DropShadow;
}

/** Parse a CSS filter string into individual effect values. */
function parseFilters(filterStr: string): ParsedFilters {
  const result: ParsedFilters = {};
  if (!filterStr) return result;

  // Match blur(Npx), brightness(N%), etc.
  const regex = /(\w[\w-]*)\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(filterStr)) !== null) {
    const fn = match[1];
    const args = match[2].trim().split(/\s+/);

    if (fn === "drop-shadow") {
      // drop-shadow(x y blur color)
      const x = parseFloat(args[0]) || 0;
      const y = parseFloat(args[1]) || 0;
      const blur = parseFloat(args[2]) || 0;
      const color = args[3] || "#000000";
      result.dropShadow = { x, y, blur, color };
    } else {
      const val = parseFloat(args[0]) || 0;
      result[fn] = val;
    }
  }
  return result;
}

/** Build a CSS filter string from individual effect values. */
function buildFilterString(values: ParsedFilters): string {
  const parts: string[] = [];
  for (const def of EFFECTS) {
    const v = values[def.key] as number | undefined;
    if (v !== undefined && v !== def.default) {
      parts.push(`${def.key}(${v}${def.unit})`);
    }
  }
  if (values.dropShadow && (values.dropShadow.x !== 0 || values.dropShadow.y !== 0 || values.dropShadow.blur !== 0)) {
    const ds = values.dropShadow;
    parts.push(`drop-shadow(${ds.x}px ${ds.y}px ${ds.blur}px ${ds.color})`);
  }
  return parts.join(" ");
}

/**
 * Effects panel — professional filter controls with live sliders.
 * Applies CSS filter effects to the selected component in real time.
 * Supports adjustment layer mode via backdrop-filter (affects all layers below).
 */
export function EffectsPanel() {
  const components = useProjectStore((s) => s.components);
  const projectId = useProjectStore((s) => s.projectId);
  const selectedId = useUiStore((s) => s.selectedComponentId);
  const updateComponentLive = useProjectStore((s) => s.updateComponentLive);

  const comp = useMemo(
    () => components.find((c) => c.id === selectedId),
    [components, selectedId],
  );

  // Check if this component is an adjustment layer (uses backdrop-filter)
  const isAdjustmentLayer = useMemo(() => {
    if (!comp) return false;
    const style = comp.style as Record<string, string | number>;
    return typeof style.backdropFilter === "string" && style.backdropFilter !== "";
  }, [comp]);

  const currentFilter = useMemo(() => {
    if (!comp) return "";
    const style = comp.style as Record<string, string | number>;
    const key = isAdjustmentLayer ? "backdropFilter" : "filter";
    return typeof style[key] === "string" ? (style[key] as string) : "";
  }, [comp, isAdjustmentLayer]);

  const parsed = useMemo(() => parseFilters(currentFilter), [currentFilter]);

  const applyFilter = useCallback(
    (newFilter: string) => {
      if (!comp || !projectId) return;
      const styleKey = isAdjustmentLayer ? "backdropFilter" : "filter";
      const clearKey = isAdjustmentLayer ? "filter" : "backdropFilter";
      const newStyle = {
        ...comp.style,
        [styleKey]: newFilter,
        [clearKey]: undefined,
      } as Record<string, string | number>;
      // Remove the undefined key
      delete newStyle[clearKey];
      updateComponentLive(comp.id, newStyle);
      void api.patchComponent(projectId, comp.id, { style: newStyle }).catch(() => {});
    },
    [comp, projectId, updateComponentLive, isAdjustmentLayer],
  );

  const handleEffectChange = useCallback(
    (def: EffectDef, value: number) => {
      const newValues = { ...parsed, [def.key]: value };
      applyFilter(buildFilterString(newValues));
    },
    [parsed, applyFilter],
  );

  const handleShadowChange = useCallback(
    (field: keyof DropShadow, value: number | string) => {
      const ds = parsed.dropShadow ?? { ...DEFAULT_SHADOW };
      const newDs = { ...ds, [field]: value };
      const newValues = { ...parsed, dropShadow: newDs };
      applyFilter(buildFilterString(newValues));
    },
    [parsed, applyFilter],
  );

  const handleReset = useCallback(() => {
    applyFilter("");
  }, [applyFilter]);

  const toggleAdjustmentLayer = useCallback(() => {
    if (!comp || !projectId) return;
    const style = comp.style as Record<string, string | number>;
    const newStyle = { ...style };
    if (isAdjustmentLayer) {
      // Switch back to regular filter
      newStyle.filter = newStyle.backdropFilter;
      delete newStyle.backdropFilter;
    } else {
      // Switch to adjustment layer (backdrop-filter)
      newStyle.backdropFilter = newStyle.filter || "blur(0px)";
      delete newStyle.filter;
    }
    updateComponentLive(comp.id, newStyle);
    void api.patchComponent(projectId, comp.id, { style: newStyle }).catch(() => {});
  }, [comp, projectId, updateComponentLive, isAdjustmentLayer]);

  if (!comp) {
    return (
      <div className="px-4 py-8 text-center text-xs text-gray-600">
        Select a component to adjust its effects.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-edge flex-shrink-0">
        <span className="text-[11px] font-medium tracking-wider uppercase text-gray-500">
          Effects
        </span>
        <div className="flex items-center gap-3">
          {/* Adjustment layer toggle */}
          <button
            onClick={toggleAdjustmentLayer}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              isAdjustmentLayer
                ? "bg-accent2/20 text-accent2 border border-accent2/40"
                : "text-gray-500 hover:text-gray-300 border border-transparent"
            }`}
            title="Adjustment layer — applies effects to all layers below"
          >
            {isAdjustmentLayer ? "● Adj Layer" : "○ Adj Layer"}
          </button>
          <button
            onClick={handleReset}
            className="text-[10px] text-gray-500 hover:text-gray-200 transition-colors"
            title="Reset all effects"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Adjustment layer indicator */}
      {isAdjustmentLayer && (
        <div className="px-3 py-1.5 bg-accent2/10 border-b border-edge/50 flex-shrink-0">
          <span className="text-[10px] text-accent2/80">
            Adjustment Layer — effects apply to all layers below
          </span>
        </div>
      )}

      {/* Scrollable effect list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {/* Color filters */}
        <div className="space-y-2">
          {EFFECTS.map((def) => {
            const value = (parsed[def.key] as number | undefined) ?? def.default;
            const isModified = value !== def.default;
            return (
              <div key={def.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className={`text-[11px] ${isModified ? "text-gray-200" : "text-gray-500"}`}>
                    {def.label}
                  </label>
                  <span className="text-[10px] text-gray-600 font-mono">
                    {def.format ? def.format(value) : `${value}${def.unit}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={def.min}
                  max={def.max}
                  step={def.step}
                  value={value}
                  onChange={(e) => handleEffectChange(def, parseFloat(e.target.value))}
                  className="w-full h-1 bg-panel2 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-edge/50" />

        {/* Drop Shadow */}
        <div className="space-y-2">
          <span className="text-[11px] text-gray-400 font-medium">Drop Shadow</span>
          {(["x", "y", "blur"] as const).map((field) => {
            const ds = parsed.dropShadow ?? DEFAULT_SHADOW;
            const max = field === "blur" ? 50 : 100;
            return (
              <div key={field} className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-gray-500 uppercase">{field}</label>
                  <span className="text-[10px] text-gray-600 font-mono">{ds[field]}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={max}
                  step={1}
                  value={ds[field]}
                  onChange={(e) => handleShadowChange(field, parseInt(e.target.value))}
                  className="w-full h-1 bg-panel2 rounded-full appearance-none cursor-pointer accent-white"
                />
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-gray-500 uppercase">Color</label>
            <input
              type="color"
              value={(parsed.dropShadow ?? DEFAULT_SHADOW).color}
              onChange={(e) => handleShadowChange("color", e.target.value)}
              className="w-8 h-6 rounded border border-edge bg-transparent cursor-pointer"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-edge/50" />

        {/* Blend mode */}
        <div className="space-y-1">
          <label className="text-[11px] text-gray-400 font-medium">Blend Mode</label>
          <select
            value={typeof (comp.style as Record<string, string | number>).mixBlendMode === "string"
              ? (comp.style as Record<string, string>).mixBlendMode
              : "normal"}
            onChange={(e) => {
              if (!comp || !projectId) return;
              const newStyle = { ...comp.style, mixBlendMode: e.target.value } as Record<string, string | number>;
              updateComponentLive(comp.id, newStyle);
              void api.patchComponent(projectId, comp.id, { style: newStyle }).catch(() => {});
            }}
            className="w-full bg-panel2 border border-edge rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-gray-500"
          >
            {["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"].map((mode) => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </div>

        {/* Opacity */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-gray-400 font-medium">Opacity</label>
            <span className="text-[10px] text-gray-600 font-mono">
              {typeof (comp.style as Record<string, string | number>).opacity === "number"
                ? `${(comp.style as Record<string, number>).opacity}`
                : "1"}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={typeof (comp.style as Record<string, string | number>).opacity === "number"
              ? (comp.style as Record<string, number>).opacity
              : 1}
            onChange={(e) => {
              if (!comp || !projectId) return;
              const newStyle = { ...comp.style, opacity: parseFloat(e.target.value) } as Record<string, string | number>;
              updateComponentLive(comp.id, newStyle);
              void api.patchComponent(projectId, comp.id, { style: newStyle }).catch(() => {});
            }}
            className="w-full h-1 bg-panel2 rounded-full appearance-none cursor-pointer accent-white"
          />
        </div>
      </div>
    </div>
  );
}
