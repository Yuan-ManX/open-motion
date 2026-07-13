import { useMemo } from "react";
import { useProjectStore } from "../../store/projectStore.js";
import { useUiStore } from "../../store/uiStore.js";
import type { Keyframe, MotionComponent } from "@openmotion/shared";

/** Parse a numeric value from a keyframe property (may be number or string). */
function num(v: unknown, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

/** Interpolate a property value at a given offset using easing. */
function interpolate(kfs: Keyframe[], prop: string, offset: number): number {
  if (kfs.length === 0) return 0;
  const sorted = [...kfs].sort((a, b) => a.offset - b.offset);
  const getProp = (kf: Keyframe): number => num((kf.properties as Record<string, string | number>)[prop]);
  if (offset <= sorted[0].offset) return getProp(sorted[0]);
  if (offset >= sorted[sorted.length - 1].offset) return getProp(sorted[sorted.length - 1]);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (offset >= a.offset && offset <= b.offset) {
      const t = (offset - a.offset) / (b.offset - a.offset || 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      return getProp(a) + (getProp(b) - getProp(a)) * eased;
    }
  }
  return 0;
}

/** Build an SVG path string for a component's motion trajectory. */
function buildPath(comp: MotionComponent, samples = 40): { d: string; points: Array<{ x: number; y: number; t: number }> } {
  const hasTranslateX = comp.keyframes.some((kf) => "translateX" in kf.properties);
  const hasTranslateY = comp.keyframes.some((kf) => "translateY" in kf.properties);
  if (!hasTranslateX && !hasTranslateY) return { d: "", points: [] };

  const style = comp.style as Record<string, string | number> | undefined;
  const baseX = num(style?.left, 0) + num(style?.width, 100) / 2;
  const baseY = num(style?.top, 0) + num(style?.height, 100) / 2;

  const points: Array<{ x: number; y: number; t: number }> = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const dx = hasTranslateX ? interpolate(comp.keyframes, "translateX", t) : 0;
    const dy = hasTranslateY ? interpolate(comp.keyframes, "translateY", t) : 0;
    points.push({ x: baseX + dx, y: baseY + dy, t });
  }

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return { d, points };
}

/** Easing-based color for path strokes. */
function pathColor(comp: MotionComponent): string {
  const e = comp.easing;
  if (e.type === "preset") {
    if (/bounce|elastic|back|spring/.test(e.name)) return "#f97316";
    if (/smooth|ease-in-out/.test(e.name)) return "#3b82f6";
    if (/snappy|ease-in/.test(e.name)) return "#eab308";
    return "#888";
  }
  if (e.type === "spring") return "#22c55e";
  if (e.type === "bezier") return "#a855f7";
  return "#888";
}

/**
 * Renders animation trajectory paths on the canvas as colored SVG lines with
 * direction arrows and keyframe markers. Toggled via showMotionPaths in uiStore.
 */
export function MotionPathOverlay() {
  const showMotionPaths = useUiStore((s) => s.showMotionPaths);
  const components = useProjectStore((s) => s.components);
  const selectedId = useUiStore((s) => s.selectedComponentId);

  const paths = useMemo(() => {
    if (!showMotionPaths) return [];
    return components
      .map((comp) => {
        const { d, points } = buildPath(comp);
        if (!d) return null;
        return { comp, d, points, color: pathColor(comp) };
      })
      .filter(Boolean) as Array<{ comp: MotionComponent; d: string; points: Array<{ x: number; y: number; t: number }>; color: string }>;
  }, [components, showMotionPaths]);

  if (!showMotionPaths || paths.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ width: "100%", height: "100%", zIndex: 40 }}
    >
      {paths.map(({ comp, d, points, color }) => {
        const isSelected = comp.id === selectedId;
        const opacity = isSelected ? 0.9 : 0.4;
        const strokeWidth = isSelected ? 2 : 1;

        // Keyframe marker positions
        const kfPoints = comp.keyframes
          .slice()
          .sort((a, b) => a.offset - b.offset)
          .map((kf) => {
            const idx = Math.round(kf.offset * (points.length - 1));
            return points[idx] ?? points[0];
          });

        // Direction arrow at the end
        const lastPt = points[points.length - 1];
        const prevPt = points[Math.max(0, points.length - 3)];
        const angle = Math.atan2(lastPt.y - prevPt.y, lastPt.x - prevPt.x);
        const arrowLen = 8;
        const ax1 = lastPt.x - arrowLen * Math.cos(angle - Math.PI / 6);
        const ay1 = lastPt.y - arrowLen * Math.sin(angle - Math.PI / 6);
        const ax2 = lastPt.x - arrowLen * Math.cos(angle + Math.PI / 6);
        const ay2 = lastPt.y - arrowLen * Math.sin(angle + Math.PI / 6);

        return (
          <g key={comp.id} opacity={opacity}>
            {/* Trajectory line */}
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={isSelected ? "0" : "4 3"}
            />
            {/* Keyframe markers */}
            {kfPoints.map((pt, i) => (
              <circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={isSelected ? 3 : 2}
                fill={color}
                stroke="#000"
                strokeWidth={0.5}
              />
            ))}
            {/* Direction arrow */}
            {isSelected && (
              <>
                <line
                  x1={lastPt.x}
                  y1={lastPt.y}
                  x2={ax1}
                  y2={ay1}
                  stroke={color}
                  strokeWidth={1.5}
                />
                <line
                  x1={lastPt.x}
                  y1={lastPt.y}
                  x2={ax2}
                  y2={ay2}
                  stroke={color}
                  strokeWidth={1.5}
                />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
