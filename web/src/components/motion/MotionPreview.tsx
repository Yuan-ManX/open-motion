import { useState, useMemo, useCallback } from "react";

/**
 * MotionPreview — renders a live, self-contained CSS animation preview from
 * motion component data. Generates @keyframes from keyframe offsets and
 * properties, applies easing, and loops or plays once with a replay button.
 *
 * Used inline in chat messages, template galleries, and the intelligence
 * dashboard to give immediate visual feedback of motion designs.
 */

export interface PreviewKeyframe {
  offset: number;
  properties: Record<string, string | number>;
}

export interface MotionPreviewData {
  name?: string;
  templateId?: string;
  durationMs?: number;
  delayMs?: number;
  easing?: {
    type: "preset" | "linear" | "cubicBezier";
    name?: string;
    p1x?: number;
    p1y?: number;
    p2x?: number;
    p2y?: number;
  };
  keyframes?: PreviewKeyframe[];
  iterationCount?: number | "infinite";
  style?: Record<string, string | number>;
}

interface Props {
  data: MotionPreviewData;
  /** Preview box size in px. Default 120. */
  size?: number;
  /** Whether to auto-play on mount. Default true. */
  autoPlay?: boolean;
  /** Whether to loop. Overrides iterationCount. */
  loop?: boolean;
  /** Show metadata label below the preview. Default true. */
  showLabel?: boolean;
  className?: string;
}

/** Convert easing object to CSS timing-function string. */
function easingToCss(easing: MotionPreviewData["easing"]): string {
  if (!easing) return "ease-out";
  if (easing.type === "linear") return "linear";
  if (easing.type === "cubicBezier") {
    return `cubic-bezier(${easing.p1x ?? 0.25}, ${easing.p1y ?? 0.1}, ${easing.p2x ?? 0.25}, ${easing.p2y ?? 1})`;
  }
  // preset — map common names to CSS
  const presetMap: Record<string, string> = {
    "ease": "ease",
    "ease-in": "ease-in",
    "ease-out": "ease-out",
    "ease-in-out": "ease-in-out",
    "ease-in-quad": "cubic-bezier(0.55, 0.085, 0.68, 0.53)",
    "ease-out-quad": "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    "ease-in-out-quad": "cubic-bezier(0.455, 0.03, 0.515, 0.955)",
    "ease-in-cubic": "cubic-bezier(0.55, 0.055, 0.675, 0.19)",
    "ease-out-cubic": "cubic-bezier(0.215, 0.61, 0.355, 1)",
    "ease-in-out-cubic": "cubic-bezier(0.645, 0.045, 0.355, 1)",
    "ease-in-quart": "cubic-bezier(0.895, 0.03, 0.685, 0.22)",
    "ease-out-quart": "cubic-bezier(0.165, 0.84, 0.44, 1)",
    "ease-in-out-quart": "cubic-bezier(0.77, 0, 0.175, 1)",
    "ease-in-quint": "cubic-bezier(0.755, 0.05, 0.855, 0.06)",
    "ease-out-quint": "cubic-bezier(0.23, 1, 0.32, 1)",
    "ease-in-out-quint": "cubic-bezier(0.86, 0, 0.07, 1)",
    "ease-in-expo": "cubic-bezier(0.95, 0.05, 0.795, 0.035)",
    "ease-out-expo": "cubic-bezier(0.19, 1, 0.22, 1)",
    "ease-in-out-expo": "cubic-bezier(1, 0, 0, 1)",
    "ease-in-circ": "cubic-bezier(0.6, 0.04, 0.98, 0.335)",
    "ease-out-circ": "cubic-bezier(0.075, 0.82, 0.165, 1)",
    "ease-in-out-circ": "cubic-bezier(0.785, 0.135, 0.15, 0.86)",
    "ease-in-back": "cubic-bezier(0.6, -0.28, 0.735, 0.045)",
    "ease-out-back": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    "ease-in-out-back": "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    "spring": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    "bounce": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    "snappy": "cubic-bezier(0.15, 0.85, 0.25, 1)",
    "smooth": "cubic-bezier(0.25, 0.1, 0.25, 1)",
    "linear": "linear",
  };
  return presetMap[easing.name ?? "ease-out"] ?? "ease-out";
}

/** Generate a unique animation name for this preview instance. */
let previewCounter = 0;
function uniqueAnimationName(): string {
  previewCounter++;
  return `motion-preview-${Date.now()}-${previewCounter}`;
}

/** Convert keyframes to CSS @keyframes string. */
function keyframesToCss(
  name: string,
  keyframes: PreviewKeyframe[],
): string {
  if (keyframes.length === 0) {
    // Default: subtle pulse
    return `@keyframes ${name} {
      0% { opacity: 0.3; transform: scale(0.8); }
      100% { opacity: 1; transform: scale(1); }
    }`;
  }

  const sorted = [...keyframes].sort((a, b) => a.offset - b.offset);
  const stops = sorted.map((kf) => {
    const pct = Math.round(kf.offset * 100);
    const props = Object.entries(kf.properties)
      .map(([k, v]) => {
        // Convert camelCase to kebab-case
        const cssKey = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
        return `${cssKey}: ${v}`;
      })
      .join("; ");
    return `${pct}% { ${props} }`;
  });

  return `@keyframes ${name} {\n  ${stops.join("\n  ")}\n}`;
}

/** Determine the initial properties (first keyframe or defaults). */
function getInitialStyle(keyframes: PreviewKeyframe[]): Record<string, string | number> {
  if (keyframes.length === 0) return { opacity: 0.3, transform: "scale(0.8)" };
  const sorted = [...keyframes].sort((a, b) => a.offset - b.offset);
  return sorted[0]?.properties ?? { opacity: 0 };
}

export function MotionPreview({
  data,
  size = 120,
  autoPlay = true,
  loop = false,
  showLabel = true,
  className = "",
}: Props) {
  const [playKey, setPlayKey] = useState(0);

  const animName = useMemo(() => uniqueAnimationName(), [playKey]);

  const keyframesCss = useMemo(
    () => keyframesToCss(animName, data.keyframes ?? []),
    [animName, data.keyframes],
  );

  const easingCss = useMemo(() => easingToCss(data.easing), [data.easing]);

  const duration = data.durationMs ?? 800;
  const delay = data.delayMs ?? 0;
  const shouldLoop = loop || data.iterationCount === "infinite";

  const initialStyle = useMemo(() => getInitialStyle(data.keyframes ?? []), [data.keyframes]);

  const animationCss = shouldLoop
    ? `${animName} ${duration}ms ${easingCss} ${delay}ms infinite`
    : `${animName} ${duration}ms ${easingCss} ${delay}ms 1 forwards`;

  const replay = useCallback(() => {
    setPlayKey((k) => k + 1);
  }, []);

  // Convert initial style to CSS
  const initialCss: Record<string, string> = {};
  for (const [k, v] of Object.entries(initialStyle)) {
    const cssKey = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    initialCss[cssKey] = String(v);
  }

  // Merge with user style
  if (data.style) {
    for (const [k, v] of Object.entries(data.style)) {
      const cssKey = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      initialCss[cssKey] = String(v);
    }
  }

  const easingLabel = data.easing?.type === "cubicBezier"
    ? "bezier"
    : data.easing?.name ?? "ease-out";

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <style>{keyframesCss}</style>
      <div
        className="relative flex items-center justify-center bg-panel2 rounded-lg border border-edge overflow-hidden group"
        style={{ width: size, height: size }}
      >
        <div
          key={playKey}
          style={{
            ...initialCss,
            animation: autoPlay || playKey > 0 ? animationCss : undefined,
            width: size * 0.5,
            height: size * 0.5,
            background: "linear-gradient(135deg, #ffffff 0%, #a0a0a0 100%)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        />
        {/* Replay button overlay */}
        {!shouldLoop && (
          <button
            onClick={replay}
            className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-all opacity-0 group-hover:opacity-100"
            aria-label="Replay animation"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
        )}
        {/* Loop indicator */}
        {shouldLoop && (
          <div className="absolute top-1 right-1 text-[8px] text-gray-600">↻</div>
        )}
      </div>
      {showLabel && (
        <div className="text-center">
          <div className="text-[10px] text-gray-400 font-medium truncate max-w-[120px]">
            {data.name ?? data.templateId ?? "motion"}
          </div>
          <div className="text-[9px] text-gray-600">
            {duration}ms · {easingLabel}
          </div>
        </div>
      )}
    </div>
  );
}
