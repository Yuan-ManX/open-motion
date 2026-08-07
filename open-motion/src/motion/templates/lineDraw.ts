import { easingPreset } from "@openmotion/shared";
import { draft, kf, type TemplateDef } from "./helper.js";

/**
 * Line draw — a chart line that draws itself left-to-right via clipPath
 * reveal, followed by an endpoint dot that pops in at the line's terminus.
 * Used for trend charts, analytics, and time-series visualizations.
 */
export const lineDrawTemplate: TemplateDef = {
  id: "tpl-line-draw",
  name: "Line Draw",
  category: "load",
  description: "Self-drawing trend line with a popping endpoint dot for time-series charts.",
  tags: ["line", "chart", "trend", "data", "analytics", "load"],
  build: () => [
    draft("Trend Line", {
      durationMs: 900,
      easing: easingPreset("ease-in-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { clipPath: "inset(0 100% 0 0)" }),
        kf(1, { clipPath: "inset(0 0 0 0)" }),
      ],
      style: {
        _content: "",
        width: 240,
        height: 80,
        backgroundColor: "transparent",
        backgroundImage: "linear-gradient(135deg, transparent 40%, #6366f1 40%, #6366f1 60%, transparent 60%)",
        backgroundSize: "100% 100%",
      },
    }),
    draft("Endpoint Dot", {
      durationMs: 350,
      delayMs: 750,
      easing: easingPreset("back"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { scale: 0, opacity: "0" }),
        kf(0.6, { scale: 1.4, opacity: "1" }),
        kf(1, { scale: 1 }),
      ],
      style: {
        _content: "",
        width: 12,
        height: 12,
        borderRadius: "50%",
        backgroundColor: "#818cf8",
        boxShadow: "0 0 0 4px rgba(99,102,241,0.25)",
      },
    }),
    draft("Axis Label", {
      durationMs: 400,
      delayMs: 200,
      easing: easingPreset("ease-out"),
      iterationCount: 1,
      fillMode: "forwards",
      keyframes: [
        kf(0, { opacity: "0", translateY: 6 }),
        kf(1, { opacity: "0.6", translateY: 0 }),
      ],
      style: {
        _content: "Growth trend",
        fontSize: 12,
        fontWeight: 400,
        color: "#8b92a8",
      },
    }),
  ],
};
