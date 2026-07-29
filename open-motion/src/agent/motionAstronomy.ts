/**
 * Motion Astronomy Engine — maps motion as celestial phenomena.
 *
 * This original AI-native module treats a motion composition as a cosmos.
 * Each component is classified as a celestial body (star, planet, moon,
 * asteroid, comet, black hole, nebula), assigned a spectral type based on
 * easing, grouped into constellations, and analyzed for cosmic events
 * (supernovae, eclipses, conjunctions). The overall composition is
 * classified as a galactic structure type.
 *
 * Core concepts:
 * - Celestial Bodies: components mapped to astronomical objects
 * - Spectral Type: easing mapped to stellar classification (O/B/A/F/G/K/M)
 * - Constellations: temporal clusters forming recognizable patterns
 * - Cosmic Events: supernovae (peaks), eclipses (overlaps), conjunctions (simultaneous)
 * - Galactic Structure: overall composition type (spiral/elliptical/irregular/lenticular)
 * - Cosmic Distance: temporal distance mapped to astronomical scale
 * - Luminosity: intensity mapped to stellar magnitude
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A celestial body representation of a component. */
export interface CelestialBody {
  componentId: string;
  componentName: string | null;
  /** Body type. */
  type: "star" | "planet" | "moon" | "asteroid" | "comet" | "black-hole" | "nebula" | "pulsar";
  /** Spectral type (star classification). */
  spectralType: "O" | "B" | "A" | "F" | "G" | "K" | "M";
  /** Luminosity 0..1 (intensity as brightness). */
  luminosity: number;
  /** Orbital period in ms (duration for one cycle). */
  orbitalPeriod: number;
  /** Cosmic distance (temporal position from start, in "light-years"). */
  cosmicDistance: number;
  /** Apparent magnitude (inverse of luminosity, astronomical scale). */
  magnitude: number;
  /** Description. */
  description: string;
}

/** A constellation (pattern group of related components). */
export interface Constellation {
  name: string;
  componentIds: string[];
  /** Star count. */
  starCount: number;
  /** Brightness 0..1. */
  brightness: number;
  /** Pattern type. */
  pattern: "linear" | "triangular" | "quadrilateral" | "cluster" | "scattered";
  /** Description. */
  description: string;
}

/** A cosmic event detected in the composition. */
export interface CosmicEvent {
  type: "supernova" | "eclipse" | "conjunction" | "meteor-shower" | "alignment" | "big-bang";
  timeMs: number;
  componentIds: string[];
  intensity: number;
  description: string;
}

/** Galactic structure classification. */
export interface GalacticStructure {
  type: "spiral" | "elliptical" | "irregular" | "lenticular" | "ring";
  /** Diameter in "light-years" (timeline duration). */
  diameter: number;
  /** Star count. */
  starCount: number;
  /** Galactic brightness 0..1. */
  brightness: number;
  /** Rotation direction. */
  rotation: "clockwise" | "counterclockwise" | "static";
  description: string;
}

/** Full astronomy analysis result. */
export interface AstronomyAnalysis {
  celestialBodies: CelestialBody[];
  constellations: Constellation[];
  cosmicEvents: CosmicEvent[];
  galacticStructure: GalacticStructure;
  /** Total luminosity of the cosmos. */
  totalLuminosity: number;
  /** Average magnitude. */
  averageMagnitude: number;
  /** Cosmic density 0..1. */
  cosmicDensity: number;
  /** Entropy of the cosmos 0..1. */
  cosmicEntropy: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Compute the luminosity (intensity) of a component. */
function computeLuminosity(comp: MotionComponent): number {
  let lum = 0;
  lum += Math.min(1, comp.durationMs / 3000) * 0.2;
  const kfCount = comp.keyframes?.length ?? 0;
  lum += Math.min(1, kfCount / 6) * 0.3;
  const iter = comp.iterationCount === "infinite" ? 5 : Math.min(5, comp.iterationCount ?? 1);
  lum += (iter / 5) * 0.2;
  const easing = comp.easing;
  if (easing && typeof easing === "object") {
    if (easing.type === "spring") lum += 0.3;
    else if (easing.type === "preset") {
      const energetic = ["bounce", "elastic", "snappy"];
      if (energetic.includes(easing.name as string)) lum += 0.25;
      else lum += 0.1;
    } else if (easing.type === "bezier") lum += 0.15;
  }
  return Math.min(1, lum);
}

/** Classify a component as a celestial body type. */
function classifyBodyType(comp: MotionComponent, luminosity: number): CelestialBody["type"] {
  const isInf = comp.iterationCount === "infinite";
  const duration = comp.durationMs;
  const kfCount = comp.keyframes?.length ?? 0;

  // Black hole: infinite loop + high luminosity (absorbs all attention)
  if (isInf && luminosity > 0.6) return "black-hole";
  // Pulsar: infinite loop + moderate luminosity (regular pulsing)
  if (isInf && luminosity > 0.3) return "pulsar";
  // Star: high luminosity, moderate-to-long duration
  if (luminosity > 0.5 && duration > 800) return "star";
  // Comet: long duration + high keyframe count (eccentric orbit)
  if (duration > 2000 && kfCount > 3) return "comet";
  // Nebula: very long duration + low luminosity (diffuse cloud)
  if (duration > 3000 && luminosity < 0.4) return "nebula";
  // Planet: medium duration, medium luminosity
  if (duration > 500 && luminosity > 0.2) return "planet";
  // Asteroid: very short duration
  if (duration < 500) return "asteroid";
  // Moon: low luminosity, short-medium duration
  if (luminosity < 0.3) return "moon";
  // Default to planet
  return "planet";
}

/** Classify the spectral type based on easing. */
function classifySpectralType(comp: MotionComponent): CelestialBody["spectralType"] {
  const easing = comp.easing;
  if (!easing || typeof easing !== "object") return "M"; // Dimmest

  if (easing.type === "spring") return "O"; // Hottest, most energetic
  if (easing.type === "bezier") return "B";
  if (easing.type === "preset") {
    const name = easing.name as string;
    // Energetic presets = hot stars
    if (["bounce", "elastic", "snappy"].includes(name)) return "A";
    if (["back", "ease-in-out", "smooth"].includes(name)) return "F";
    if (["ease", "ease-out", "soft"].includes(name)) return "G";
    if (["ease-in", "linear"].includes(name)) return "K";
    return "M";
  }
  return "M";
}

/** Compute apparent magnitude from luminosity (astronomical scale). */
function computeMagnitude(luminosity: number): number {
  // Apparent magnitude: brighter objects have lower (more negative) magnitudes
  // Map luminosity 0..1 to magnitude -2 (very bright) to +6 (barely visible)
  if (luminosity <= 0) return 6;
  return -2 + (1 - luminosity) * 8;
}

// ---------------------------------------------------------------------------
// Celestial Body Mapping
// ---------------------------------------------------------------------------

/** Map all components to celestial bodies. */
function mapCelestialBodies(spec: MotionSpec): CelestialBody[] {
  if (spec.components.length === 0) return [];

  const timelineStart = Math.min(...spec.components.map((c) => c.delayMs));

  return spec.components.map((comp) => {
    const luminosity = computeLuminosity(comp);
    const type = classifyBodyType(comp, luminosity);
    const spectralType = classifySpectralType(comp);
    const orbitalPeriod = comp.durationMs;
    const cosmicDistance = (comp.delayMs - timelineStart) / 1000; // "light-years"
    const magnitude = computeMagnitude(luminosity);

    const typeDescriptions: Record<CelestialBody["type"], string> = {
      "star": "a luminous main-sequence star radiating steady motion energy",
      "planet": "a stable planet orbiting the compositional center",
      "moon": "a subtle moon reflecting motion from larger bodies",
      "asteroid": "a brief asteroid streaking across the compositional sky",
      "comet": "a dramatic comet with an eccentric, high-energy orbit",
      "black-hole": "an infinite-loop black hole drawing all attention into its gravitational well",
      "nebula": "a diffuse nebula spread across a vast temporal expanse",
      "pulsar": "a rhythmic pulsar emitting regular beats of motion energy",
    };

    return {
      componentId: comp.id,
      componentName: comp.name ?? null,
      type,
      spectralType,
      luminosity,
      orbitalPeriod,
      cosmicDistance,
      magnitude,
      description: `${comp.name ?? comp.id}: ${spectralType}-type ${type} — ${typeDescriptions[type]}, ` +
        `luminosity ${(luminosity * 100).toFixed(0)}%, magnitude ${magnitude.toFixed(1)}, ` +
        `orbital period ${orbitalPeriod}ms, distance ${cosmicDistance.toFixed(1)} ly`,
    };
  });
}

// ---------------------------------------------------------------------------
// Constellation Detection
// ---------------------------------------------------------------------------

/** Detect constellations (temporal clusters of related components). */
function detectConstellations(bodies: CelestialBody[]): Constellation[] {
  if (bodies.length === 0) return [];

  // Group by proximity in cosmic distance
  const sorted = [...bodies].sort((a, b) => a.cosmicDistance - b.cosmicDistance);
  const constellations: Constellation[] = [];
  let currentGroup: CelestialBody[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentGroup[currentGroup.length - 1];
    const gap = sorted[i].cosmicDistance - prev.cosmicDistance;
    // If gap is small (< 1 light-year), add to current constellation
    if (gap < 1.0) {
      currentGroup.push(sorted[i]);
    } else {
      // Close current constellation if it has 2+ members
      if (currentGroup.length >= 2) {
        constellations.push(formConstellation(currentGroup, constellations.length));
      }
      currentGroup = [sorted[i]];
    }
  }
  if (currentGroup.length >= 2) {
    constellations.push(formConstellation(currentGroup, constellations.length));
  }

  return constellations;
}

/** Form a constellation from a group of celestial bodies. */
function formConstellation(group: CelestialBody[], index: number): Constellation {
  const count = group.length;
  const brightness = group.reduce((sum, b) => sum + b.luminosity, 0) / count;
  const componentIds = group.map((b) => b.componentId);

  let pattern: Constellation["pattern"];
  if (count === 2) pattern = "linear";
  else if (count === 3) pattern = "triangular";
  else if (count === 4) pattern = "quadrilateral";
  else if (count <= 8 && brightness > 0.4) pattern = "cluster";
  else pattern = "scattered";

  const names = ["Lyra", "Orion", "Cassiopeia", "Cygnus", "Draco", "Andromeda", "Pegasus", "Ursa"];
  const name = names[Math.min(names.length - 1, index)] ?? `Constellation-${index + 1}`;

  return {
    name,
    componentIds,
    starCount: count,
    brightness,
    pattern,
    description: `Constellation ${name}: ${count} star(s), ${pattern} pattern, brightness ${(brightness * 100).toFixed(0)}%`,
  };
}

// ---------------------------------------------------------------------------
// Cosmic Event Detection
// ---------------------------------------------------------------------------

/** Detect cosmic events (supernovae, eclipses, conjunctions). */
function detectCosmicEvents(spec: MotionSpec, bodies: CelestialBody[]): CosmicEvent[] {
  const events: CosmicEvent[] = [];

  // Big Bang: the first component's start
  if (spec.components.length > 0) {
    const firstStart = Math.min(...spec.components.map((c) => c.delayMs));
    events.push({
      type: "big-bang",
      timeMs: firstStart,
      componentIds: spec.components.filter((c) => c.delayMs === firstStart).map((c) => c.id),
      intensity: 1,
      description: `Big Bang at ${firstStart}ms — the cosmos ignites with ${spec.components.length} element(s)`,
    });
  }

  // Supernovae: peak intensity moments (highest luminosity bodies)
  const stars = bodies.filter((b) => b.type === "star" || b.type === "black-hole" || b.type === "pulsar");
  for (const star of stars) {
    if (star.luminosity > 0.6) {
      const comp = spec.components.find((c) => c.id === star.componentId);
      if (comp) {
        const peakTime = comp.delayMs + comp.durationMs / 2;
        events.push({
          type: "supernova",
          timeMs: peakTime,
          componentIds: [star.componentId],
          intensity: star.luminosity,
          description: `Supernova at ${peakTime}ms — ${star.componentName ?? star.componentId} explodes with ${(star.luminosity * 100).toFixed(0)}% luminosity`,
        });
      }
    }
  }

  // Eclipses: temporal overlaps between high and low luminosity bodies
  for (let i = 0; i < spec.components.length; i++) {
    for (let j = i + 1; j < spec.components.length; j++) {
      const a = spec.components[i];
      const b = spec.components[j];
      const overlapStart = Math.max(a.delayMs, b.delayMs);
      const overlapEnd = Math.min(a.delayMs + a.durationMs, b.delayMs + b.durationMs);
      if (overlapEnd > overlapStart) {
        const lumA = computeLuminosity(a);
        const lumB = computeLuminosity(b);
        // Eclipse: one much brighter than the other during overlap
        if (Math.abs(lumA - lumB) > 0.3) {
          events.push({
            type: "eclipse",
            timeMs: overlapStart,
            componentIds: [a.id, b.id],
            intensity: Math.max(lumA, lumB),
            description: `Eclipse at ${overlapStart}ms — ${a.name ?? a.id} and ${b.name ?? b.id} align, one obscures the other`,
          });
        }
      }
    }
  }

  // Conjunctions: components starting at the same time
  const startGroups = new Map<number, MotionComponent[]>();
  for (const comp of spec.components) {
    const group = startGroups.get(comp.delayMs) ?? [];
    group.push(comp);
    startGroups.set(comp.delayMs, group);
  }
  for (const [time, group] of startGroups) {
    if (group.length > 1) {
      events.push({
        type: "conjunction",
        timeMs: time,
        componentIds: group.map((c) => c.id),
        intensity: group.length / spec.components.length,
        description: `Conjunction at ${time}ms — ${group.length} bodies align simultaneously`,
      });
    }
  }

  // Sort by time
  events.sort((a, b) => a.timeMs - b.timeMs);
  return events;
}

// ---------------------------------------------------------------------------
// Galactic Structure Classification
// ---------------------------------------------------------------------------

/** Classify the galactic structure of the composition. */
function classifyGalaxy(spec: MotionSpec, bodies: CelestialBody[]): GalacticStructure {
  if (bodies.length === 0) {
    return {
      type: "irregular",
      diameter: 0,
      starCount: 0,
      brightness: 0,
      rotation: "static",
      description: "Empty cosmos — no galactic structure.",
    };
  }

  const timelineStart = Math.min(...spec.components.map((c) => c.delayMs));
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const diameter = (timelineEnd - timelineStart) / 1000; // light-years
  const starCount = bodies.length;
  const brightness = bodies.reduce((sum, b) => sum + b.luminosity, 0) / bodies.length;

  // Check for rotation (components getting progressively later = rotation)
  const sortedByStart = [...spec.components].sort((a, b) => a.delayMs - b.delayMs);
  const intensityTrend = sortedByStart.map((c) => computeLuminosity(c));
  let increasing = 0, decreasing = 0;
  for (let i = 1; i < intensityTrend.length; i++) {
    if (intensityTrend[i] > intensityTrend[i - 1]) increasing++;
    else if (intensityTrend[i] < intensityTrend[i - 1]) decreasing++;
  }
  const rotation: GalacticStructure["rotation"] = increasing > decreasing ? "clockwise" : decreasing > increasing ? "counterclockwise" : "static";

  // Classify galaxy type
  let type: GalacticStructure["type"];
  const density = starCount / Math.max(1, diameter);

  if (density > 1.5 && rotation !== "static") type = "spiral";
  else if (density > 1.5 && rotation === "static") type = "elliptical";
  else if (density > 0.8 && density <= 1.5) type = "lenticular";
  else if (density <= 0.3) type = "ring";
  else type = "irregular";

  const typeDescriptions: Record<GalacticStructure["type"], string> = {
    "spiral": "a rotating spiral galaxy with arms of motion sweeping outward",
    "elliptical": "a stable elliptical galaxy with evenly distributed motion",
    "irregular": "an irregular galaxy with chaotic, unstructured motion distribution",
    "lenticular": "a lenticular galaxy with a central bulge and surrounding disk",
    "ring": "a ring galaxy with a sparse, hollow central region",
  };

  const description = `Galactic structure: ${type} — ${typeDescriptions[type]}, ` +
    `diameter ${diameter.toFixed(1)} ly, ${starCount} star(s), brightness ${(brightness * 100).toFixed(0)}%, ` +
    `rotation=${rotation}`;

  return { type, diameter, starCount, brightness, rotation, description };
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Analyze a motion composition through the astronomical lens.
 *
 * Maps components as celestial bodies, detects constellations and cosmic
 * events, and classifies the galactic structure of the composition.
 */
export function analyzeAstronomy(spec: MotionSpec): AstronomyAnalysis {
  if (spec.components.length === 0) {
    return {
      celestialBodies: [],
      constellations: [],
      cosmicEvents: [],
      galacticStructure: {
        type: "irregular",
        diameter: 0,
        starCount: 0,
        brightness: 0,
        rotation: "static",
        description: "Empty cosmos.",
      },
      totalLuminosity: 0,
      averageMagnitude: 0,
      cosmicDensity: 0,
      cosmicEntropy: 0,
      summary: "No components — the cosmos is empty.",
    };
  }

  const celestialBodies = mapCelestialBodies(spec);
  const constellations = detectConstellations(celestialBodies);
  const cosmicEvents = detectCosmicEvents(spec, celestialBodies);
  const galacticStructure = classifyGalaxy(spec, celestialBodies);

  const totalLuminosity = celestialBodies.reduce((sum, b) => sum + b.luminosity, 0);
  const averageMagnitude = celestialBodies.reduce((sum, b) => sum + b.magnitude, 0) / celestialBodies.length;

  // Cosmic density: components per light-year
  const cosmicDensity = galacticStructure.diameter > 0
    ? Math.min(1, celestialBodies.length / (galacticStructure.diameter * 2))
    : 0;

  // Cosmic entropy: diversity of body types
  const typeCounts = new Map<string, number>();
  for (const body of celestialBodies) {
    typeCounts.set(body.type, (typeCounts.get(body.type) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of typeCounts.values()) {
    const p = count / celestialBodies.length;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(typeCounts.size || 1);
  const cosmicEntropy = maxEntropy > 0 ? entropy / maxEntropy : 0;

  const summary = `Astronomy: ${galacticStructure.type} galaxy, ${celestialBodies.length} body(ies), ` +
    `${constellations.length} constellation(s), ${cosmicEvents.length} cosmic event(s), ` +
    `total luminosity ${(totalLuminosity * 100).toFixed(0)}%, avg magnitude ${averageMagnitude.toFixed(1)}, ` +
    `density ${(cosmicDensity * 100).toFixed(0)}%, entropy ${(cosmicEntropy * 100).toFixed(0)}%`;

  return {
    celestialBodies,
    constellations,
    cosmicEvents,
    galacticStructure,
    totalLuminosity,
    averageMagnitude,
    cosmicDensity,
    cosmicEntropy,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format an astronomy analysis as a human-readable report. */
export function formatAstronomyReport(analysis: AstronomyAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Astronomy Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  // Galactic Structure
  lines.push("## Galactic Structure");
  lines.push(`- Type: ${analysis.galacticStructure.type}`);
  lines.push(`- Diameter: ${analysis.galacticStructure.diameter.toFixed(1)} light-years`);
  lines.push(`- Star count: ${analysis.galacticStructure.starCount}`);
  lines.push(`- Brightness: ${(analysis.galacticStructure.brightness * 100).toFixed(0)}%`);
  lines.push(`- Rotation: ${analysis.galacticStructure.rotation}`);
  lines.push("");

  // Celestial Bodies
  lines.push("## Celestial Bodies");
  if (analysis.celestialBodies.length === 0) {
    lines.push("- No celestial bodies detected");
  } else {
    for (const body of analysis.celestialBodies) {
      lines.push(`- [${body.spectralType}-type ${body.type}] ${body.componentName ?? body.componentId} — luminosity ${(body.luminosity * 100).toFixed(0)}%, magnitude ${body.magnitude.toFixed(1)}, period ${body.orbitalPeriod}ms, distance ${body.cosmicDistance.toFixed(1)} ly`);
    }
  }
  lines.push("");

  // Constellations
  lines.push("## Constellations");
  if (analysis.constellations.length === 0) {
    lines.push("- No constellations detected");
  } else {
    for (const c of analysis.constellations) {
      lines.push(`- ${c.name}: ${c.starCount} star(s), ${c.pattern} pattern, brightness ${(c.brightness * 100).toFixed(0)}%`);
    }
  }
  lines.push("");

  // Cosmic Events
  lines.push("## Cosmic Events");
  if (analysis.cosmicEvents.length === 0) {
    lines.push("- No cosmic events detected");
  } else {
    for (const e of analysis.cosmicEvents) {
      lines.push(`- [${e.type}] at ${e.timeMs}ms — ${e.description}`);
    }
  }
  lines.push("");

  // Cosmic Metrics
  lines.push("## Cosmic Metrics");
  lines.push(`- Total luminosity: ${(analysis.totalLuminosity * 100).toFixed(0)}%`);
  lines.push(`- Average magnitude: ${analysis.averageMagnitude.toFixed(1)}`);
  lines.push(`- Cosmic density: ${(analysis.cosmicDensity * 100).toFixed(0)}%`);
  lines.push(`- Cosmic entropy: ${(analysis.cosmicEntropy * 100).toFixed(0)}%`);

  return lines.join("\n");
}
