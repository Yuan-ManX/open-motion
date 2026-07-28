/**
 * Motion Cartography Engine — maps motion as cartographic terrain.
 *
 * This original AI-native module treats a motion composition as a
 * cartographic landscape. It computes elevation from motion intensity,
 * traces contour lines of equal density, identifies landmarks (peak
 * moments), maps routes (temporal trajectories), classifies territories
 * (biomes of similar character), and determines the compass direction
 * of overall motion tendency.
 *
 * Core concepts:
 * - Elevation: motion intensity mapped to altitude (peaks = high intensity)
 * - Contour Lines: iso-density curves connecting regions of equal activity
 * - Landmarks: peak moments that serve as navigational reference points
 * - Routes: temporal trajectories through the composition space
 * - Territories: regions sharing similar motion character (biomes)
 * - Compass: overall directional tendency (N=expand, S=contract, E=accelerate, W=decelerate)
 * - Scale: composition zoom level (micro/meso/macro)
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Elevation point in the motion terrain. */
export interface ElevationPoint {
  /** Time in ms. */
  timeMs: number;
  /** Elevation 0..1 (intensity as altitude). */
  elevation: number;
  /** Component IDs contributing to this elevation. */
  contributingComponents: string[];
}

/** A contour line connecting points of equal density. */
export interface ContourLine {
  /** Contour level 0..1. */
  level: number;
  /** Time ranges where this density level is reached. */
  ranges: Array<{ startMs: number; endMs: number }>;
  /** Description. */
  description: string;
}

/** A landmark (peak moment) in the composition. */
export interface Landmark {
  /** Landmark name. */
  name: string;
  /** Time in ms. */
  timeMs: number;
  /** Peak elevation 0..1. */
  elevation: number;
  /** Component IDs at the peak. */
  componentIds: string[];
  /** Landmark type. */
  type: "summit" | "ridge" | "plateau" | "col" | "spur";
  /** Description. */
  description: string;
}

/** A route through the composition. */
export interface Route {
  /** Route name. */
  name: string;
  /** Component ID that traces this route. */
  componentId: string;
  /** Waypoints (time, elevation pairs). */
  waypoints: Array<{ timeMs: number; elevation: number }>;
  /** Route difficulty 0..1. */
  difficulty: number;
  /** Description. */
  description: string;
}

/** A territory (biome) of similar motion character. */
export interface Territory {
  /** Territory name. */
  name: string;
  /** Biome type. */
  biome: "tundra" | "forest" | "desert" | "grassland" | "mountain" | "wetland" | "volcanic";
  /** Time range. */
  startMs: number;
  endMs: number;
  /** Component IDs in this territory. */
  componentIds: string[];
  /** Average elevation. */
  avgElevation: number;
  /** Description. */
  description: string;
}

/** Compass direction analysis. */
export interface CompassAnalysis {
  /** Primary direction. */
  direction: "north" | "south" | "east" | "west" | "northeast" | "southeast" | "southwest" | "northwest" | "still";
  /** Direction meaning. */
  meaning: string;
  /** Intensity of direction 0..1. */
  intensity: number;
  /** Description. */
  description: string;
}

/** Scale analysis. */
export interface ScaleAnalysis {
  level: "micro" | "meso" | "macro";
  /** Total timeline duration in ms. */
  duration: number;
  /** Component density (components per second). */
  density: number;
  /** Description. */
  description: string;
}

/** Full cartography analysis result. */
export interface CartographyAnalysis {
  elevationProfile: ElevationPoint[];
  contourLines: ContourLine[];
  landmarks: Landmark[];
  routes: Route[];
  territories: Territory[];
  compass: CompassAnalysis;
  scale: ScaleAnalysis;
  /** Highest peak elevation. */
  highestPeak: number;
  /** Lowest valley elevation. */
  lowestValley: number;
  /** Average elevation. */
  averageElevation: number;
  /** Terrain roughness 0..1. */
  roughness: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Compute the intensity (elevation) of a component. */
function componentElevation(comp: MotionComponent): number {
  let elevation = 0;
  elevation += Math.min(1, comp.durationMs / 3000) * 0.2;
  const kfCount = comp.keyframes?.length ?? 0;
  elevation += Math.min(1, kfCount / 6) * 0.3;
  const iter = comp.iterationCount === "infinite" ? 5 : Math.min(5, comp.iterationCount ?? 1);
  elevation += (iter / 5) * 0.2;
  const easing = comp.easing;
  if (easing && typeof easing === "object") {
    if (easing.type === "spring") elevation += 0.3;
    else if (easing.type === "preset") {
      const energetic = ["bounce", "elastic", "snappy"];
      if (energetic.includes(easing.name as string)) elevation += 0.25;
      else elevation += 0.1;
    } else if (easing.type === "bezier") elevation += 0.15;
  }
  return Math.min(1, elevation);
}

/** Sample the elevation profile at regular intervals. */
function computeElevationProfile(spec: MotionSpec, sampleCount = 20): ElevationPoint[] {
  if (spec.components.length === 0) return [];

  const timelineStart = Math.min(...spec.components.map((c) => c.delayMs));
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const duration = timelineEnd - timelineStart;
  if (duration <= 0) return [];

  const points: ElevationPoint[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const t = timelineStart + (duration * i) / sampleCount;
    const activeComponents = spec.components.filter(
      (c) => c.delayMs <= t && c.delayMs + c.durationMs >= t,
    );

    let elevation = 0;
    for (const comp of activeComponents) {
      elevation = Math.max(elevation, componentElevation(comp));
    }

    points.push({
      timeMs: Math.round(t),
      elevation,
      contributingComponents: activeComponents.map((c) => c.id),
    });
  }

  return points;
}

/** Compute contour lines from the elevation profile. */
function computeContours(profile: ElevationPoint[]): ContourLine[] {
  if (profile.length === 0) return [];

  const levels = [0.2, 0.4, 0.6, 0.8];
  const contours: ContourLine[] = [];

  for (const level of levels) {
    const ranges: Array<{ startMs: number; endMs: number }> = [];
    let inRange = false;
    let rangeStart = 0;

    for (const point of profile) {
      if (point.elevation >= level && !inRange) {
        inRange = true;
        rangeStart = point.timeMs;
      } else if (point.elevation < level && inRange) {
        inRange = false;
        ranges.push({ startMs: rangeStart, endMs: point.timeMs });
      }
    }
    if (inRange) {
      ranges.push({ startMs: rangeStart, endMs: profile[profile.length - 1].timeMs });
    }

    if (ranges.length > 0) {
      const levelLabels: Record<number, string> = {
        0.2: "lowlands — gentle motion terrain",
        0.4: "foothills — moderate motion activity",
        0.6: "highlands — intense motion zone",
        0.8: "alpine — peak motion intensity",
      };
      contours.push({
        level,
        ranges,
        description: `Contour ${level}: ${ranges.length} range(s) — ${levelLabels[level] ?? "elevation zone"}`,
      });
    }
  }

  return contours;
}

/** Identify landmarks (peak moments) from the elevation profile. */
function identifyLandmarks(spec: MotionSpec, profile: ElevationPoint[]): Landmark[] {
  if (profile.length === 0) return [];

  const landmarks: Landmark[] = [];
  const visited = new Set<number>();

  // Find local maxima
  for (let i = 1; i < profile.length - 1; i++) {
    if (profile[i].elevation > profile[i - 1].elevation &&
        profile[i].elevation >= profile[i + 1].elevation &&
        profile[i].elevation > 0.3 &&
        !visited.has(i)) {

      // Determine landmark type
      const elevation = profile[i].elevation;
      const leftDrop = profile[i].elevation - profile[i - 1].elevation;
      const rightDrop = profile[i].elevation - profile[i + 1].elevation;

      let type: Landmark["type"] = "summit";
      if (leftDrop < 0.1 && rightDrop < 0.1) type = "plateau";
      else if (leftDrop > 0.2 && rightDrop > 0.2) type = "summit";
      else if (leftDrop > 0.2 || rightDrop > 0.2) type = "ridge";
      else if (leftDrop < 0.05 || rightDrop < 0.05) type = "spur";
      else type = "col";

      const comp = spec.components.find((c) =>
        c.delayMs <= profile[i].timeMs && c.delayMs + c.durationMs >= profile[i].timeMs
      );

      landmarks.push({
        name: `${type === "summit" ? "Peak" : type === "plateau" ? "Plateau" : type === "ridge" ? "Ridge" : type === "spur" ? "Spur" : "Col"} at ${profile[i].timeMs}ms`,
        timeMs: profile[i].timeMs,
        elevation,
        componentIds: profile[i].contributingComponents,
        type,
        description: `${type} landmark at ${profile[i].timeMs}ms — elevation ${(elevation * 100).toFixed(0)}%, ${profile[i].contributingComponents.length} active component(s)${comp ? ` (${comp.name ?? comp.id})` : ""}`,
      });

      // Mark nearby points as visited
      for (let j = Math.max(0, i - 2); j <= Math.min(profile.length - 1, i + 2); j++) {
        visited.add(j);
      }
    }
  }

  // Sort by elevation descending
  landmarks.sort((a, b) => b.elevation - a.elevation);
  return landmarks.slice(0, 5); // Top 5 landmarks
}

/** Map routes (trajectories) for each component. */
function mapRoutes(spec: MotionSpec): Route[] {
  const routes: Route[] = [];

  for (const comp of spec.components) {
    const startElevation = 0;
    const peakElevation = componentElevation(comp);
    const endElevation = 0;

    const waypoints = [
      { timeMs: comp.delayMs, elevation: startElevation },
      { timeMs: comp.delayMs + comp.durationMs / 2, elevation: peakElevation },
      { timeMs: comp.delayMs + comp.durationMs, elevation: endElevation },
    ];

    // Difficulty based on elevation gain and duration
    const elevationGain = peakElevation;
    const durationFactor = Math.min(1, comp.durationMs / 3000);
    const difficulty = (elevationGain * 0.6 + durationFactor * 0.4);

    const routeTypes = ["ascent", "traverse", "expedition", "climb", "trek"];
    const routeType = routeTypes[Math.min(routeTypes.length - 1, Math.floor(difficulty * routeTypes.length))];

    routes.push({
      name: `${routeType.charAt(0).toUpperCase() + routeType.slice(1)}: ${comp.name ?? comp.id}`,
      componentId: comp.id,
      waypoints,
      difficulty,
      description: `${routeType} route — ${comp.durationMs}ms duration, peak elevation ${(peakElevation * 100).toFixed(0)}%, difficulty ${(difficulty * 100).toFixed(0)}%`,
    });
  }

  return routes.sort((a, b) => b.difficulty - a.difficulty);
}

/** Classify territories (biomes) in the composition. */
function classifyTerritories(spec: MotionSpec): Territory[] {
  if (spec.components.length === 0) return [];

  // Group components by time segments
  const timelineStart = Math.min(...spec.components.map((c) => c.delayMs));
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const duration = timelineEnd - timelineStart;
  if (duration <= 0) return [];

  const segmentCount = Math.min(5, Math.max(1, Math.ceil(duration / 2000)));
  const segmentDuration = duration / segmentCount;
  const territories: Territory[] = [];

  const biomeDescriptions: Record<Territory["biome"], string> = {
    tundra: "cold, sparse motion — minimal activity, vast empty stretches",
    forest: "rich, layered motion — dense vegetation of overlapping components",
    desert: "arid, isolated motion — sparse, dramatic features standing alone",
    grassland: "gentle, flowing motion — uniform, undulating activity",
    mountain: "dramatic, peaked motion — high-elevation summits and deep valleys",
    wetland: "fluid, adaptive motion — smooth, flowing transitions",
    volcanic: "explosive, intense motion — high-energy eruptions of activity",
  };

  for (let i = 0; i < segmentCount; i++) {
    const segStart = timelineStart + segmentDuration * i;
    const segEnd = segStart + segmentDuration;
    const segmentComponents = spec.components.filter(
      (c) => c.delayMs < segEnd && c.delayMs + c.durationMs > segStart,
    );

    if (segmentComponents.length === 0) continue;

    const avgElevation = segmentComponents.reduce((sum, c) => sum + componentElevation(c), 0) / segmentComponents.length;
    const elevationVariance = segmentComponents.reduce((sum, c) => sum + Math.pow(componentElevation(c) - avgElevation, 2), 0) / segmentComponents.length;
    const elevationStdDev = Math.sqrt(elevationVariance);

    // Classify biome based on elevation and variance
    let biome: Territory["biome"];
    if (avgElevation < 0.2 && segmentComponents.length <= 1) biome = "tundra";
    else if (avgElevation < 0.3) biome = "grassland";
    else if (avgElevation < 0.4 && segmentComponents.length > 3) biome = "forest";
    else if (avgElevation < 0.4) biome = "desert";
    else if (avgElevation > 0.6 && elevationStdDev > 0.2) biome = "volcanic";
    else if (avgElevation > 0.5) biome = "mountain";
    else if (elevationStdDev < 0.1) biome = "wetland";
    else biome = "forest";

    const segmentName = String.fromCharCode(65 + i); // A, B, C, ...
    territories.push({
      name: `Region ${segmentName}`,
      biome,
      startMs: Math.round(segStart),
      endMs: Math.round(segEnd),
      componentIds: segmentComponents.map((c) => c.id),
      avgElevation,
      description: `Region ${segmentName}: ${biome} — ${biomeDescriptions[biome]}, avg elevation ${(avgElevation * 100).toFixed(0)}%, ${segmentComponents.length} component(s)`,
    });
  }

  return territories;
}

/** Compute the compass direction of the composition. */
function computeCompass(spec: MotionSpec, profile: ElevationPoint[]): CompassAnalysis {
  if (profile.length < 2) {
    return {
      direction: "still",
      meaning: "No motion — the compass needle is still",
      intensity: 0,
      description: "No directional tendency detected.",
    };
  }

  // Compare first half vs second half elevation
  const midPoint = Math.floor(profile.length / 2);
  const firstHalfAvg = profile.slice(0, midPoint).reduce((sum, p) => sum + p.elevation, 0) / midPoint;
  const secondHalfAvg = profile.slice(midPoint).reduce((sum, p) => sum + p.elevation, 0) / (profile.length - midPoint);

  // Compare early vs late component counts (density shift)
  const timelineStart = Math.min(...spec.components.map((c) => c.delayMs));
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const timelineMid = (timelineStart + timelineEnd) / 2;
  const earlyCount = spec.components.filter((c) => c.delayMs + c.durationMs / 2 < timelineMid).length;
  const lateCount = spec.components.filter((c) => c.delayMs + c.durationMs / 2 >= timelineMid).length;

  // Direction: N=expansion (elevation increasing), S=contraction (decreasing)
  // E=acceleration (density increasing), W=deceleration (density decreasing)
  const elevationDelta = secondHalfAvg - firstHalfAvg;
  const densityDelta = lateCount - earlyCount;

  let direction: CompassAnalysis["direction"] = "still";
  let meaning = "";

  if (Math.abs(elevationDelta) < 0.05 && Math.abs(densityDelta) <= 0) {
    direction = "still";
    meaning = "Equilibrium — the terrain is level";
  } else if (elevationDelta > 0.05 && densityDelta > 0) {
    direction = "northeast";
    meaning = "Expansion and acceleration — the terrain rises and densifies";
  } else if (elevationDelta > 0.05 && densityDelta < 0) {
    direction = "northwest";
    meaning = "Expansion with deceleration — the terrain rises but thins";
  } else if (elevationDelta < -0.05 && densityDelta > 0) {
    direction = "southeast";
    meaning = "Contraction with acceleration — the terrain descends but densifies";
  } else if (elevationDelta < -0.05 && densityDelta < 0) {
    direction = "southwest";
    meaning = "Contraction and deceleration — the terrain descends and thins";
  } else if (elevationDelta > 0.05) {
    direction = "north";
    meaning = "Expansion — the terrain rises toward a summit";
  } else if (elevationDelta < -0.05) {
    direction = "south";
    meaning = "Contraction — the terrain descends into a valley";
  } else if (densityDelta > 0) {
    direction = "east";
    meaning = "Acceleration — activity increases over time";
  } else {
    direction = "west";
    meaning = "Deceleration — activity decreases over time";
  }

  const intensity = Math.min(1, Math.abs(elevationDelta) * 2 + Math.abs(densityDelta) * 0.15);

  return {
    direction,
    meaning,
    intensity,
    description: `Compass: ${direction} — ${meaning} (intensity ${(intensity * 100).toFixed(0)}%)`,
  };
}

/** Determine the scale of the composition. */
function determineScale(spec: MotionSpec): ScaleAnalysis {
  if (spec.components.length === 0) {
    return {
      level: "micro",
      duration: 0,
      density: 0,
      description: "No components — scale is undefined.",
    };
  }

  const timelineStart = Math.min(...spec.components.map((c) => c.delayMs));
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const duration = timelineEnd - timelineStart;
  const density = duration > 0 ? (spec.components.length / (duration / 1000)) : 0;

  let level: ScaleAnalysis["level"];
  if (duration < 2000 || spec.components.length <= 3) level = "micro";
  else if (duration < 8000 || spec.components.length <= 8) level = "meso";
  else level = "macro";

  const description = `Scale: ${level} — ${duration}ms duration, ${spec.components.length} component(s), ${density.toFixed(2)} components/sec`;

  return { level, duration, density, description };
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Analyze a motion composition through the cartographic lens.
 *
 * Maps the composition as a terrain with elevation, contours, landmarks,
 * routes, territories, compass direction, and scale.
 */
export function analyzeCartography(spec: MotionSpec): CartographyAnalysis {
  if (spec.components.length === 0) {
    return {
      elevationProfile: [],
      contourLines: [],
      landmarks: [],
      routes: [],
      territories: [],
      compass: {
        direction: "still",
        meaning: "No motion",
        intensity: 0,
        description: "No components — the map is blank.",
      },
      scale: {
        level: "micro",
        duration: 0,
        density: 0,
        description: "No components — scale is undefined.",
      },
      highestPeak: 0,
      lowestValley: 0,
      averageElevation: 0,
      roughness: 0,
      summary: "No components — the cartographic map is empty.",
    };
  }

  const elevationProfile = computeElevationProfile(spec);
  const contourLines = computeContours(elevationProfile);
  const landmarks = identifyLandmarks(spec, elevationProfile);
  const routes = mapRoutes(spec);
  const territories = classifyTerritories(spec);
  const compass = computeCompass(spec, elevationProfile);
  const scale = determineScale(spec);

  const elevations = elevationProfile.map((p) => p.elevation);
  const highestPeak = Math.max(...elevations);
  const lowestValley = Math.min(...elevations);
  const averageElevation = elevations.reduce((a, b) => a + b, 0) / elevations.length;

  // Roughness: average absolute difference between consecutive points
  let totalDiff = 0;
  for (let i = 1; i < elevations.length; i++) {
    totalDiff += Math.abs(elevations[i] - elevations[i - 1]);
  }
  const roughness = elevations.length > 1 ? totalDiff / (elevations.length - 1) : 0;

  const summary = `Cartography: ${scale.level} scale, ${territories.length} territory(ies), ` +
    `${landmarks.length} landmark(s), ${contourLines.length} contour level(s), ` +
    `compass=${compass.direction}, peak ${(highestPeak * 100).toFixed(0)}%, ` +
    `roughness ${(roughness * 100).toFixed(0)}%`;

  return {
    elevationProfile,
    contourLines,
    landmarks,
    routes,
    territories,
    compass,
    scale,
    highestPeak,
    lowestValley,
    averageElevation,
    roughness,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a cartography analysis as a human-readable report. */
export function formatCartographyReport(analysis: CartographyAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Cartography Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  // Scale
  lines.push("## Scale");
  lines.push(`- Level: ${analysis.scale.level}`);
  lines.push(`- Duration: ${analysis.scale.duration}ms`);
  lines.push(`- Density: ${analysis.scale.density.toFixed(2)} components/sec`);
  lines.push("");

  // Compass
  lines.push("## Compass Direction");
  lines.push(`- Direction: ${analysis.compass.direction}`);
  lines.push(`- Meaning: ${analysis.compass.meaning}`);
  lines.push(`- Intensity: ${(analysis.compass.intensity * 100).toFixed(0)}%`);
  lines.push("");

  // Elevation
  lines.push("## Elevation Profile");
  lines.push(`- Highest peak: ${(analysis.highestPeak * 100).toFixed(0)}%`);
  lines.push(`- Lowest valley: ${(analysis.lowestValley * 100).toFixed(0)}%`);
  lines.push(`- Average elevation: ${(analysis.averageElevation * 100).toFixed(0)}%`);
  lines.push(`- Terrain roughness: ${(analysis.roughness * 100).toFixed(0)}%`);
  lines.push("");

  // Landmarks
  lines.push("## Landmarks");
  if (analysis.landmarks.length === 0) {
    lines.push("- No landmarks detected");
  } else {
    for (const lm of analysis.landmarks) {
      lines.push(`- [${lm.type}] ${lm.name} — elevation ${(lm.elevation * 100).toFixed(0)}% at ${lm.timeMs}ms`);
    }
  }
  lines.push("");

  // Contour Lines
  lines.push("## Contour Lines");
  if (analysis.contourLines.length === 0) {
    lines.push("- No contour lines detected");
  } else {
    for (const cl of analysis.contourLines) {
      lines.push(`- Level ${(cl.level * 100).toFixed(0)}%: ${cl.ranges.length} range(s) — ${cl.description}`);
    }
  }
  lines.push("");

  // Territories
  lines.push("## Territories (Biomes)");
  if (analysis.territories.length === 0) {
    lines.push("- No territories classified");
  } else {
    for (const t of analysis.territories) {
      lines.push(`- ${t.name}: ${t.biome} — ${t.description}`);
    }
  }
  lines.push("");

  // Routes
  lines.push("## Routes");
  if (analysis.routes.length === 0) {
    lines.push("- No routes mapped");
  } else {
    for (const r of analysis.routes.slice(0, 5)) {
      lines.push(`- ${r.name} — difficulty ${(r.difficulty * 100).toFixed(0)}%`);
    }
  }

  return lines.join("\n");
}
