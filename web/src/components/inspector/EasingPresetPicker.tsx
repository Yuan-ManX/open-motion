import { useMemo } from "react";

interface EasingPresetPickerProps {
  value: string;
  onChange: (preset: string) => void;
}

const SVG_SIZE = 36;
const PADDING = 4;
const PLOT = SVG_SIZE - PADDING * 2;

/** CSS cubic-bezier values for native keywords and custom presets. */
const PRESET_BEZIER: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
  "ease-in-quad": [0.11, 0, 0.5, 0],
  "ease-out-quad": [0.5, 1, 0.89, 1],
  "ease-in-out-quad": [0.45, 0, 0.55, 1],
  "ease-in-cubic": [0.32, 0, 0.67, 0],
  "ease-out-cubic": [0.33, 1, 0.68, 1],
  "ease-in-out-cubic": [0.65, 0, 0.35, 1],
  bounce: [0.68, -0.6, 0.32, 1.6],
  back: [0.34, 1.56, 0.64, 1],
  elastic: [0.5, -0.6, 0.1, 1.4],
  snappy: [0.2, 0.8, 0.2, 1],
  smooth: [0.45, 0, 0.15, 1],
  soft: [0.4, 0, 0.6, 1],
};

/** Render a mini SVG cubic-bezier curve for the given preset name. */
function EasingCurveMini({ preset }: { preset: string }) {
  const [x1, y1, x2, y2] = PRESET_BEZIER[preset] ?? [0.25, 0.1, 0.25, 1];

  const toSvg = (px: number, py: number) => ({
    x: PADDING + px * PLOT,
    y: PADDING + (1 - py) * PLOT,
  });

  const start = toSvg(0, 0);
  const end = toSvg(1, 1);
  const p1 = toSvg(x1, y1);
  const p2 = toSvg(x2, y2);
  const path = `M ${start.x} ${start.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${end.x} ${end.y}`;

  return (
    <svg width={SVG_SIZE} height={SVG_SIZE} className="block">
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="#1a1a1a"
        strokeWidth={0.5}
        strokeDasharray="2 2"
      />
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

/**
 * Visual grid picker for easing presets. Shows a mini cubic-bezier curve
 * preview for each preset so users can choose by shape rather than name.
 */
export function EasingPresetPicker({ value, onChange }: EasingPresetPickerProps) {
  const presets = useMemo(
    () => Object.keys(PRESET_BEZIER),
    [],
  );

  return (
    <div className="grid grid-cols-4 gap-1 mt-2">
      {presets.map((preset) => {
        const isSelected = preset === value;
        return (
          <button
            key={preset}
            onClick={() => onChange(preset)}
            className={`flex flex-col items-center gap-0.5 p-1.5 rounded border transition-colors ${
              isSelected
                ? "border-accent text-accent bg-accent/10"
                : "border-edge text-gray-500 hover:text-gray-300 hover:border-gray-600"
            }`}
            title={preset}
            aria-label={`Easing preset ${preset}`}
            aria-pressed={isSelected}
          >
            <EasingCurveMini preset={preset} />
            <span className="text-[8px] truncate w-full text-center">{preset}</span>
          </button>
        );
      })}
    </div>
  );
}
