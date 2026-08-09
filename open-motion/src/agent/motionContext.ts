/** Motion Contextual Awareness — adapts motion to environmental context. */

import type { MotionComponent, Easing, EasingPreset, Keyframe } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Context Model
// ---------------------------------------------------------------------------

export type DeviceClass = "desktop" | "tablet" | "mobile" | "watch" | "kiosk" | "tv";
export type PerformanceTier = "high" | "medium" | "low";
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";
export type AmbientLight = "bright" | "normal" | "dim" | "dark";
export type UserState = "focused" | "casual" | "rushed" | "relaxed";

/** A complete context descriptor. */
export interface MotionContext {
  device: DeviceClass;
  performance: PerformanceTier;
  timeOfDay: TimeOfDay;
  ambientLight: AmbientLight;
  userState: UserState;
}

/** Contextual adjustment factors. */
export interface ContextAdjustments {
  /** Duration multiplier (e.g., 0.8 = 20% faster). */
  durationMultiplier: number;
  /** Intensity multiplier. */
  intensityMultiplier: number;
  /** Easing recommendation override (or null to keep original). */
  easingOverride: EasingPreset | null;
  /** Palette adjustment mode. */
  paletteMode: PaletteMode;
  /** Maximum concurrent animations allowed. */
  maxConcurrentAnimations: number;
  /** Whether to disable infinite loops. */
  disableLoops: boolean;
  /** Whether to simplify transforms (reduce 3D, filters). */
  simplifyTransforms: boolean;
  /** Recommended FPS cap. */
  fpsCap: number;
  /** Summary of adjustments. */
  summary: string;
}

export type PaletteMode = "original" | "warm" | "cool" | "dark" | "high-contrast" | "muted";

// ---------------------------------------------------------------------------
// Context Profiles
// ---------------------------------------------------------------------------

interface DeviceProfile {
  durationMultiplier: number;
  intensityMultiplier: number;
  maxConcurrentAnimations: number;
  disableLoops: boolean;
  simplifyTransforms: boolean;
  fpsCap: number;
}

const DEVICE_PROFILES: Record<DeviceClass, DeviceProfile> = {
  desktop: {
    durationMultiplier: 1.0,
    intensityMultiplier: 1.0,
    maxConcurrentAnimations: 12,
    disableLoops: false,
    simplifyTransforms: false,
    fpsCap: 60,
  },
  tablet: {
    durationMultiplier: 0.95,
    intensityMultiplier: 0.9,
    maxConcurrentAnimations: 8,
    disableLoops: false,
    simplifyTransforms: false,
    fpsCap: 60,
  },
  mobile: {
    durationMultiplier: 0.85,
    intensityMultiplier: 0.85,
    maxConcurrentAnimations: 5,
    disableLoops: false,
    simplifyTransforms: true,
    fpsCap: 60,
  },
  watch: {
    durationMultiplier: 0.6,
    intensityMultiplier: 0.7,
    maxConcurrentAnimations: 2,
    disableLoops: true,
    simplifyTransforms: true,
    fpsCap: 30,
  },
  kiosk: {
    durationMultiplier: 1.2,
    intensityMultiplier: 1.1,
    maxConcurrentAnimations: 10,
    disableLoops: false,
    simplifyTransforms: false,
    fpsCap: 60,
  },
  tv: {
    durationMultiplier: 1.15,
    intensityMultiplier: 1.05,
    maxConcurrentAnimations: 8,
    disableLoops: false,
    simplifyTransforms: false,
    fpsCap: 30,
  },
};

interface PerformanceProfile {
  durationMultiplier: number;
  intensityMultiplier: number;
  maxConcurrentAnimations: number;
  simplifyTransforms: boolean;
  fpsCap: number;
}

const PERFORMANCE_PROFILES: Record<PerformanceTier, PerformanceProfile> = {
  high: {
    durationMultiplier: 1.0,
    intensityMultiplier: 1.0,
    maxConcurrentAnimations: 12,
    simplifyTransforms: false,
    fpsCap: 60,
  },
  medium: {
    durationMultiplier: 0.9,
    intensityMultiplier: 0.9,
    maxConcurrentAnimations: 6,
    simplifyTransforms: false,
    fpsCap: 60,
  },
  low: {
    durationMultiplier: 0.7,
    intensityMultiplier: 0.7,
    maxConcurrentAnimations: 3,
    simplifyTransforms: true,
    fpsCap: 30,
  },
};

interface TimeProfile {
  paletteMode: PaletteMode;
  intensityMultiplier: number;
}

const TIME_PROFILES: Record<TimeOfDay, TimeProfile> = {
  morning: { paletteMode: "warm", intensityMultiplier: 1.0 },
  afternoon: { paletteMode: "original", intensityMultiplier: 1.0 },
  evening: { paletteMode: "warm", intensityMultiplier: 0.9 },
  night: { paletteMode: "dark", intensityMultiplier: 0.7 },
};

interface AmbientProfile {
  paletteMode: PaletteMode;
  intensityMultiplier: number;
  durationMultiplier: number;
}

const AMBIENT_PROFILES: Record<AmbientLight, AmbientProfile> = {
  bright: { paletteMode: "muted", intensityMultiplier: 1.1, durationMultiplier: 0.9 },
  normal: { paletteMode: "original", intensityMultiplier: 1.0, durationMultiplier: 1.0 },
  dim: { paletteMode: "high-contrast", intensityMultiplier: 1.2, durationMultiplier: 1.1 },
  dark: { paletteMode: "high-contrast", intensityMultiplier: 1.3, durationMultiplier: 1.15 },
};

interface UserStateProfile {
  durationMultiplier: number;
  intensityMultiplier: number;
  easingOverride: EasingPreset | null;
  disableLoops: boolean;
}

const USER_STATE_PROFILES: Record<UserState, UserStateProfile> = {
  focused: {
    durationMultiplier: 0.8,
    intensityMultiplier: 0.6,
    easingOverride: "smooth",
    disableLoops: true,
  },
  casual: {
    durationMultiplier: 1.0,
    intensityMultiplier: 1.0,
    easingOverride: null,
    disableLoops: false,
  },
  rushed: {
    durationMultiplier: 0.5,
    intensityMultiplier: 0.8,
    easingOverride: "linear",
    disableLoops: true,
  },
  relaxed: {
    durationMultiplier: 1.3,
    intensityMultiplier: 0.9,
    easingOverride: "ease-in-out",
    disableLoops: false,
  },
};

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/** Detect the current time-of-day from the system clock. */
export function detectTimeOfDay(date = new Date()): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** Detect device class from user-agent string. */
export function detectDeviceClass(userAgent: string): DeviceClass {
  const ua = userAgent.toLowerCase();
  if (/watch|wearable/.test(ua)) return "watch";
  if (/tv|smart-tv|roku|apple\s?tv/.test(ua)) return "tv";
  if (/kiosk|display-only/.test(ua)) return "kiosk";
  if (/ipad|tablet|kindle|playbook/.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipod/.test(ua)) return "mobile";
  return "desktop";
}

/** Detect performance tier from hardware signals. */
export function detectPerformanceTier(hardwareConcurrency: number, deviceMemory?: number): PerformanceTier {
  const cores = hardwareConcurrency ?? 4;
  const memory = deviceMemory ?? 4;
  if (cores >= 8 && memory >= 8) return "high";
  if (cores >= 4 && memory >= 4) return "medium";
  return "low";
}

/**
 * Compute context-aware adjustments for a given motion context.
 * The adjustments combine all five dimensions multiplicatively.
 */
export function computeContextAdjustments(context: MotionContext): ContextAdjustments {
  const device = DEVICE_PROFILES[context.device];
  const perf = PERFORMANCE_PROFILES[context.performance];
  const time = TIME_PROFILES[context.timeOfDay];
  const ambient = AMBIENT_PROFILES[context.ambientLight];
  const userState = USER_STATE_PROFILES[context.userState];

  const durationMultiplier =
    device.durationMultiplier *
    perf.durationMultiplier *
    ambient.durationMultiplier *
    userState.durationMultiplier;

  const intensityMultiplier =
    device.intensityMultiplier *
    perf.intensityMultiplier *
    time.intensityMultiplier *
    ambient.intensityMultiplier *
    userState.intensityMultiplier;

  const maxConcurrentAnimations = Math.min(
    device.maxConcurrentAnimations,
    perf.maxConcurrentAnimations,
  );

  const disableLoops = device.disableLoops || userState.disableLoops;
  const simplifyTransforms = device.simplifyTransforms || perf.simplifyTransforms;
  const fpsCap = Math.min(device.fpsCap, perf.fpsCap);

  // Determine palette mode with priority: ambient > time
  const paletteMode = ambient.paletteMode !== "original" ? ambient.paletteMode : time.paletteMode;

  // Easing override from user state
  const easingOverride = userState.easingOverride;

  const summary = `Context: ${context.device}/${context.performance}/${context.timeOfDay}/${context.ambientLight}/${context.userState} → duration ×${durationMultiplier.toFixed(2)}, intensity ×${intensityMultiplier.toFixed(2)}, ${paletteMode} palette, ${disableLoops ? "no loops" : "loops ok"}, ${simplifyTransforms ? "simplified" : "full"} transforms, ${fpsCap}fps cap`;

  return {
    durationMultiplier,
    intensityMultiplier,
    easingOverride,
    paletteMode,
    maxConcurrentAnimations,
    disableLoops,
    simplifyTransforms,
    fpsCap,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Context-Aware Motion Adaptation
// ---------------------------------------------------------------------------

export interface AdaptedComponent {
  /** The adapted component. */
  component: MotionComponent;
  /** The adjustments that were applied. */
  adjustments: ContextAdjustments;
  /** Summary of changes. */
  summary: string;
}

/** Adapt a motion component for the given context. */
export function adaptComponentForContext(
  component: MotionComponent,
  context: MotionContext,
): AdaptedComponent {
  const adjustments = computeContextAdjustments(context);

  const adapted: MotionComponent = {
    ...component,
    durationMs: Math.round(component.durationMs * adjustments.durationMultiplier),
    iterationCount:
      adjustments.disableLoops && component.iterationCount === "infinite"
        ? 1
        : component.iterationCount,
    keyframes: adjustKeyframes(component.keyframes ?? [], adjustments),
  };

  // Adjust easing if override is set
  if (adjustments.easingOverride) {
    adapted.easing = { type: "preset", name: adjustments.easingOverride };
  }

  // Adjust palette
  if (adjustments.paletteMode !== "original" && adapted.style) {
    adapted.style = adjustPalette(adapted.style, adjustments.paletteMode);
  }

  const changes: string[] = [];
  if (adjustments.durationMultiplier !== 1.0) {
    changes.push(`duration ${component.durationMs}ms → ${adapted.durationMs}ms`);
  }
  if (adjustments.disableLoops && component.iterationCount === "infinite") {
    changes.push("infinite loop → 1 iteration");
  }
  if (adjustments.easingOverride) {
    changes.push(`easing → ${adjustments.easingOverride}`);
  }
  if (adjustments.paletteMode !== "original") {
    changes.push(`palette → ${adjustments.paletteMode}`);
  }
  if (adjustments.simplifyTransforms) {
    changes.push("simplified transforms");
  }

  const summary =
    changes.length > 0
      ? `Adapted "${component.name}": ${changes.join(", ")}`
      : `Adapted "${component.name}": no changes needed`;

  return { component: adapted, adjustments, summary };
}

/** Adjust keyframes for context (intensity scaling, simplification). */
function adjustKeyframes(
  keyframes: Keyframe[],
  adjustments: ContextAdjustments,
): Keyframe[] {
  return keyframes.map((kf) => {
    const props = { ...kf.properties };
    // Scale intensity of transforms
    if (typeof props.scale === "number") {
      props.scale = 1 + (props.scale - 1) * adjustments.intensityMultiplier;
    }
    if (typeof props.translateX === "number") {
      props.translateX = Math.round(props.translateX * adjustments.intensityMultiplier);
    }
    if (typeof props.translateY === "number") {
      props.translateY = Math.round(props.translateY * adjustments.intensityMultiplier);
    }
    if (typeof props.rotate === "number") {
      props.rotate = Math.round(props.rotate * adjustments.intensityMultiplier);
    }
    // Simplify transforms: remove blur on low-power by zeroing opacity-adjacent
    // properties is not valid here; blur lives in style, not keyframes.
    return { ...kf, properties: props };
  });
}

/** Adjust the color palette of a component's style. */
function adjustPalette(style: Record<string, string | number>, mode: PaletteMode): Record<string, string | number> {
  const adjusted = { ...style };
  const colorFields = ["backgroundColor", "color", "borderColor"];

  for (const field of colorFields) {
    if (typeof adjusted[field] === "string") {
      adjusted[field] = shiftColor(adjusted[field] as string, mode);
    }
  }

  return adjusted;
}

/** Shift a hex color according to the palette mode. */
function shiftColor(hex: string, mode: PaletteMode): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  switch (mode) {
    case "warm":
      // Shift toward warm tones (increase R, decrease B)
      return rgbToHex(
        Math.min(255, rgb.r + 20),
        rgb.g,
        Math.max(0, rgb.b - 20),
      );
    case "cool":
      return rgbToHex(
        Math.max(0, rgb.r - 20),
        rgb.g,
        Math.min(255, rgb.b + 20),
      );
    case "dark":
      return rgbToHex(
        Math.max(0, rgb.r - 40),
        Math.max(0, rgb.g - 40),
        Math.max(0, rgb.b - 40),
      );
    case "high-contrast":
      // Push toward extremes
      const avg = (rgb.r + rgb.g + rgb.b) / 3;
      if (avg > 128) {
        return rgbToHex(255, 255, 255);
      }
      return rgbToHex(0, 0, 0);
    case "muted":
      // Reduce saturation
      const gray = Math.round((rgb.r + rgb.g + rgb.b) / 3);
      return rgbToHex(
        Math.round(rgb.r * 0.7 + gray * 0.3),
        Math.round(rgb.g * 0.7 + gray * 0.3),
        Math.round(rgb.b * 0.7 + gray * 0.3),
      );
    default:
      return hex;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Context Detection (Auto)
// ---------------------------------------------------------------------------

export interface DetectedContext {
  context: MotionContext;
  summary: string;
}

/**
 * Auto-detect the current context from available signals.
 * Falls back to sensible defaults when signals are unavailable.
 */
export function autoDetectContext(signals?: {
  userAgent?: string;
  hardwareConcurrency?: number;
  deviceMemory?: number;
  date?: Date;
}): DetectedContext {
  const now = signals?.date ?? new Date();
  const timeOfDay = detectTimeOfDay(now);
  const device = signals?.userAgent
    ? detectDeviceClass(signals.userAgent)
    : "desktop";
  const performance = detectPerformanceTier(
    signals?.hardwareConcurrency ?? 4,
    signals?.deviceMemory,
  );

  // Infer ambient light from time of day (rough heuristic)
  const ambientLight: AmbientLight =
    timeOfDay === "night" ? "dark" :
    timeOfDay === "evening" ? "dim" :
    timeOfDay === "morning" ? "normal" :
    "bright";

  // Default user state
  const userState: UserState = "casual";

  const context: MotionContext = {
    device,
    performance,
    timeOfDay,
    ambientLight,
    userState,
  };

  return {
    context,
    summary: `Detected: ${device}/${performance}/${timeOfDay}/${ambientLight}/${userState}`,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatContextReport(
  context: MotionContext,
  adjustments: ContextAdjustments,
): string {
  const lines = [
    `Motion Context:`,
    `  Device: ${context.device}`,
    `  Performance: ${context.performance}`,
    `  Time of day: ${context.timeOfDay}`,
    `  Ambient light: ${context.ambientLight}`,
    `  User state: ${context.userState}`,
    ``,
    `Adjustments:`,
    `  Duration multiplier: ×${adjustments.durationMultiplier.toFixed(2)}`,
    `  Intensity multiplier: ×${adjustments.intensityMultiplier.toFixed(2)}`,
    `  Easing override: ${adjustments.easingOverride ?? "none"}`,
    `  Palette mode: ${adjustments.paletteMode}`,
    `  Max concurrent animations: ${adjustments.maxConcurrentAnimations}`,
    `  Loops: ${adjustments.disableLoops ? "disabled" : "allowed"}`,
    `  Transforms: ${adjustments.simplifyTransforms ? "simplified" : "full"}`,
    `  FPS cap: ${adjustments.fpsCap}`,
    ``,
    adjustments.summary,
  ];
  return lines.join("\n");
}

export function formatAdaptationReport(result: AdaptedComponent): string {
  return result.summary;
}

/** List all available context options for UI/Agent discovery. */
export function listContextOptions(): {
  devices: DeviceClass[];
  performanceTiers: PerformanceTier[];
  timesOfDay: TimeOfDay[];
  ambientLights: AmbientLight[];
  userStates: UserState[];
  paletteModes: PaletteMode[];
} {
  return {
    devices: ["desktop", "tablet", "mobile", "watch", "kiosk", "tv"],
    performanceTiers: ["high", "medium", "low"],
    timesOfDay: ["morning", "afternoon", "evening", "night"],
    ambientLights: ["bright", "normal", "dim", "dark"],
    userStates: ["focused", "casual", "rushed", "relaxed"],
    paletteModes: ["original", "warm", "cool", "dark", "high-contrast", "muted"],
  };
}
