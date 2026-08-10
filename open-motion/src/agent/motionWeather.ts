/** Motion Weather Engine — models motion compositions as weather systems. */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A weather front (transition between densities). */
export interface WeatherFront {
  /** Time of the front in ms. */
  timeMs: number;
  /** Front type. */
  type: "warm" | "cold" | "occluded" | "stationary";
  /** Intensity change. */
  intensityChange: number;
  /** Description. */
  description: string;
}

/** A storm (peak activity period). */
export interface Storm {
  /** Start time in ms. */
  startMs: number;
  /** End time in ms. */
  endMs: number;
  /** Peak intensity 0..1. */
  peakIntensity: number;
  /** Storm category. */
  category: "shower" | "thunderstorm" | "squall" | "hurricane" | "tornado";
  /** Description. */
  description: string;
}

/** A calm period. */
export interface CalmPeriod {
  startMs: number;
  endMs: number;
  durationMs: number;
  /** Description. */
  description: string;
}

/** Weather analysis result. */
export interface WeatherAnalysis {
  /** Atmospheric pressure 0..1. */
  pressure: number;
  /** Wind speed 0..1. */
  windSpeed: number;
  /** Wind direction. */
  windDirection: "northerly" | "easterly" | "southerly" | "westerly" | "variable" | "still";
  /** Temperature classification. */
  temperature: "frigid" | "cold" | "cool" | "mild" | "warm" | "hot";
  /** Humidity 0..1 (motion density). */
  humidity: number;
  /** Detected weather fronts. */
  fronts: WeatherFront[];
  /** Detected storms. */
  storms: Storm[];
  /** Detected calm periods. */
  calmPeriods: CalmPeriod[];
  /** Overall climate classification. */
  climate: "tropical" | "temperate" | "arid" | "polar" | "mountainous" | "maritime";
  /** Weather forecast (emotional prediction). */
  forecast: string;
  /** Visibility 0..1 (clarity of the composition). */
  visibility: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Pressure and Wind
// ---------------------------------------------------------------------------

/** Compute atmospheric pressure from average motion intensity. */
function computePressure(spec: MotionSpec): number {
  if (spec.components.length === 0) return 0.5;

  let totalIntensity = 0;
  for (const comp of spec.components) {
    const durationFactor = comp.durationMs < 500 ? 0.9 : comp.durationMs < 1500 ? 0.6 : 0.3;
    const keyframeFactor = Math.min(1, (comp.keyframes?.length ?? 2) / 8);
    totalIntensity += durationFactor * 0.5 + keyframeFactor * 0.5;
  }

  return Math.min(1, totalIntensity / spec.components.length);
}

/** Compute wind speed from average motion velocity. */
function computeWindSpeed(spec: MotionSpec): number {
  if (spec.components.length === 0) return 0;

  let totalSpeed = 0;
  for (const comp of spec.components) {
    // Shorter duration = faster wind
    const speed = comp.durationMs < 200 ? 1.0 :
      comp.durationMs < 500 ? 0.8 :
      comp.durationMs < 1000 ? 0.6 :
      comp.durationMs < 2000 ? 0.4 :
      comp.durationMs < 4000 ? 0.2 : 0.1;
    totalSpeed += speed;
  }

  return totalSpeed / spec.components.length;
}

/** Determine wind direction from motion patterns. */
function computeWindDirection(spec: MotionSpec): WeatherAnalysis["windDirection"] {
  if (spec.components.length === 0) return "still";

  // Check for directional bias in keyframes
  let northCount = 0;  // translateY negative
  let southCount = 0;  // translateY positive
  let eastCount = 0;   // translateX positive
  let westCount = 0;   // translateX negative

  for (const comp of spec.components) {
    for (const kf of comp.keyframes ?? []) {
      const props = kf.properties as Record<string, string | number>;
      if ("translateY" in props && typeof props.translateY === "number") {
        if (props.translateY < 0) northCount++;
        else if (props.translateY > 0) southCount++;
      }
      if ("translateX" in props && typeof props.translateX === "number") {
        if (props.translateX > 0) eastCount++;
        else if (props.translateX < 0) westCount++;
      }
    }
  }

  const max = Math.max(northCount, southCount, eastCount, westCount);
  if (max === 0) return "variable";
  if (max === northCount) return "northerly";
  if (max === southCount) return "southerly";
  if (max === eastCount) return "easterly";
  return "westerly";
}

// ---------------------------------------------------------------------------
// Front Detection
// ---------------------------------------------------------------------------

/** Detect weather fronts (density transitions). */
function detectFronts(spec: MotionSpec): WeatherFront[] {
  if (spec.components.length < 2) return [];

  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const sampleCount = 20;
  const fronts: WeatherFront[] = [];

  let prevDensity = 0;
  for (let i = 0; i < sampleCount; i++) {
    const time = (i / sampleCount) * timelineEnd;
    const active = spec.components.filter(
      (c) => c.delayMs <= time && c.delayMs + c.durationMs >= time,
    );
    const density = active.length / Math.max(1, spec.components.length);

    if (i > 0) {
      const change = density - prevDensity;
      if (Math.abs(change) > 0.1) {
        const type: WeatherFront["type"] =
          change > 0.2 ? "warm" :       // Increasing activity = warm front
          change < -0.2 ? "cold" :      // Decreasing activity = cold front
          Math.abs(change) > 0.15 ? "occluded" : "stationary";

        fronts.push({
          timeMs: time,
          type,
          intensityChange: change,
          description: `${type} front at ${time.toFixed(0)}ms — density ${prevDensity.toFixed(2)} → ${density.toFixed(2)}`,
        });
      }
    }
    prevDensity = density;
  }

  return fronts;
}

// ---------------------------------------------------------------------------
// Storm Detection
// ---------------------------------------------------------------------------

/** Detect storms (peak activity periods). */
function detectStorms(spec: MotionSpec): Storm[] {
  if (spec.components.length === 0) return [];

  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const windowMs = 500;
  const storms: Storm[] = [];

  for (let time = 0; time < timelineEnd; time += windowMs) {
    const active = spec.components.filter(
      (c) => c.delayMs <= time + windowMs && c.delayMs + c.durationMs >= time,
    );

    if (active.length >= 3) {
      // This is a storm
      const peakIntensity = Math.min(1, active.length / 8);
      const category: Storm["category"] =
        active.length >= 8 ? "tornado" :
        active.length >= 6 ? "hurricane" :
        active.length >= 5 ? "squall" :
        active.length >= 4 ? "thunderstorm" :
        "shower";

      storms.push({
        startMs: time,
        endMs: time + windowMs,
        peakIntensity,
        category,
        description: `${category} at ${time}-${time + windowMs}ms with ${active.length} active component(s)`,
      });
    }
  }

  // Merge adjacent storms
  const merged: Storm[] = [];
  for (const storm of storms) {
    const last = merged[merged.length - 1];
    if (last && storm.startMs <= last.endMs) {
      last.endMs = storm.endMs;
      last.peakIntensity = Math.max(last.peakIntensity, storm.peakIntensity);
      // Upgrade category if needed
      const catOrder: Storm["category"][] = ["shower", "thunderstorm", "squall", "hurricane", "tornado"];
      if (catOrder.indexOf(storm.category) > catOrder.indexOf(last.category)) {
        last.category = storm.category;
      }
    } else {
      merged.push({ ...storm });
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Calm Detection
// ---------------------------------------------------------------------------

/** Detect calm periods (minimal activity). */
function detectCalmPeriods(spec: MotionSpec): CalmPeriod[] {
  if (spec.components.length === 0) return [];

  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const windowMs = 500;
  const calmPeriods: CalmPeriod[] = [];

  for (let time = 0; time < timelineEnd; time += windowMs) {
    const active = spec.components.filter(
      (c) => c.delayMs <= time + windowMs && c.delayMs + c.durationMs >= time,
    );

    if (active.length <= 1) {
      calmPeriods.push({
        startMs: time,
        endMs: time + windowMs,
        durationMs: windowMs,
        description: `Calm at ${time}-${time + windowMs}ms with ${active.length} active component(s)`,
      });
    }
  }

  // Merge adjacent calm periods
  const merged: CalmPeriod[] = [];
  for (const calm of calmPeriods) {
    const last = merged[merged.length - 1];
    if (last && calm.startMs <= last.endMs) {
      last.endMs = calm.endMs;
      last.durationMs = last.endMs - last.startMs;
    } else {
      merged.push({ ...calm });
    }
  }

  return merged;
}

// ---------------------------------------------------------------------------
// Climate and Forecast
// ---------------------------------------------------------------------------

/** Classify the overall climate. */
function classifyClimate(
  pressure: number,
  windSpeed: number,
  humidity: number,
): WeatherAnalysis["climate"] {
  if (humidity > 0.7 && pressure > 0.6) return "tropical";
  if (humidity < 0.3 && windSpeed > 0.5) return "arid";
  if (pressure < 0.3) return "polar";
  if (windSpeed > 0.7) return "mountainous";
  if (humidity > 0.5) return "maritime";
  return "temperate";
}

/** Generate a weather forecast (emotional prediction). */
function generateForecast(
  climate: WeatherAnalysis["climate"],
  storms: Storm[],
  calmPeriods: CalmPeriod[],
  pressure: number,
): string {
  const hasStorm = storms.length > 0;
  const hasCalm = calmPeriods.length > 0;
  const hasTornado = storms.some((s) => s.category === "tornado");
  const hasHurricane = storms.some((s) => s.category === "hurricane");

  if (hasTornado) {
    return "Expect emotional turbulence — the composition builds to a vortex of intense activity that may overwhelm unprepared viewers";
  }
  if (hasHurricane) {
    return "A storm of motion approaches — brace for sustained high-intensity sequences that will command full attention";
  }
  if (hasStorm && hasCalm) {
    return "Mixed conditions — periods of intense activity interspersed with welcome calm, creating a dynamic emotional rhythm";
  }
  if (hasStorm) {
    return "Active weather ahead — the composition maintains consistent energy with periodic bursts of intensity";
  }
  if (hasCalm && pressure < 0.4) {
    return "Fair skies — a gentle, contemplative composition that invites reflection rather than excitement";
  }
  if (climate === "tropical") {
    return "Warm and humid — the composition envelops the viewer in rich, layered motion that feels lush and immersive";
  }
  if (climate === "polar") {
    return "Cold and clear — the composition is sparse and crystalline, each motion standing alone in stark clarity";
  }
  if (climate === "arid") {
    return "Dry and windy — the composition moves quickly with minimal decoration, creating a sense of urgency";
  }
  return "Mild conditions — a balanced composition with neither extreme intensity nor pronounced stillness";
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/** Analyze a motion composition as a weather system. */
export function analyzeWeather(spec: MotionSpec): WeatherAnalysis {
  if (spec.components.length === 0) {
    return {
      pressure: 0.5,
      windSpeed: 0,
      windDirection: "still",
      temperature: "mild",
      humidity: 0,
      fronts: [],
      storms: [],
      calmPeriods: [],
      climate: "temperate",
      forecast: "No forecast — empty sky.",
      visibility: 1,
      summary: "No components — clear sky.",
    };
  }

  const pressure = computePressure(spec);
  const windSpeed = computeWindSpeed(spec);
  const windDirection = computeWindDirection(spec);

  // Humidity = motion density (how many components overlap on average)
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const timelineStart = Math.min(...spec.components.map((c) => c.delayMs));
  const totalDuration = spec.components.reduce((sum, c) => sum + c.durationMs, 0);
  const humidity = timelineEnd > timelineStart ? totalDuration / (timelineEnd - timelineStart) : 1;

  // Temperature from pressure
  const temperature: WeatherAnalysis["temperature"] =
    pressure < 0.2 ? "frigid" :
    pressure < 0.35 ? "cold" :
    pressure < 0.5 ? "cool" :
    pressure < 0.65 ? "mild" :
    pressure < 0.8 ? "warm" : "hot";

  const fronts = detectFronts(spec);
  const storms = detectStorms(spec);
  const calmPeriods = detectCalmPeriods(spec);
  const climate = classifyClimate(pressure, windSpeed, humidity);
  const forecast = generateForecast(climate, storms, calmPeriods, pressure);

  // Visibility = inverse of density (more density = lower visibility)
  const visibility = Math.max(0.2, 1 - humidity * 0.5);

  const summary = `Weather: ${climate} climate, ${temperature}, pressure ${(pressure * 100).toFixed(0)}%, ` +
    `wind ${(windSpeed * 100).toFixed(0)}% (${windDirection}), humidity ${(humidity * 100).toFixed(0)}%, ` +
    `${fronts.length} front(s), ${storms.length} storm(s), ${calmPeriods.length} calm period(s)`;

  return {
    pressure,
    windSpeed,
    windDirection,
    temperature,
    humidity,
    fronts,
    storms,
    calmPeriods,
    climate,
    forecast,
    visibility,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a weather analysis as a human-readable report. */
export function formatWeatherReport(analysis: WeatherAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Weather Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  lines.push("## Current Conditions");
  lines.push(`- Climate: ${analysis.climate}`);
  lines.push(`- Temperature: ${analysis.temperature}`);
  lines.push(`- Pressure: ${(analysis.pressure * 100).toFixed(0)}%`);
  lines.push(`- Wind: ${(analysis.windSpeed * 100).toFixed(0)}% (${analysis.windDirection})`);
  lines.push(`- Humidity: ${(analysis.humidity * 100).toFixed(0)}%`);
  lines.push(`- Visibility: ${(analysis.visibility * 100).toFixed(0)}%`);
  lines.push("");

  if (analysis.fronts.length > 0) {
    lines.push("## Weather Fronts");
    for (const f of analysis.fronts) {
      lines.push(`- ${f.description}`);
    }
    lines.push("");
  }

  if (analysis.storms.length > 0) {
    lines.push("## Storms");
    for (const s of analysis.storms) {
      lines.push(`- ${s.description}`);
    }
    lines.push("");
  }

  if (analysis.calmPeriods.length > 0) {
    lines.push("## Calm Periods");
    for (const c of analysis.calmPeriods) {
      lines.push(`- ${c.description}`);
    }
    lines.push("");
  }

  lines.push("## Forecast");
  lines.push(analysis.forecast);

  return lines.join("\n");
}
