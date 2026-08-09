/**
 * Motion Geology Engine — analyzes motion as geological formations.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A stratum — a component mapped to a rock layer. */
export interface GeologicalStratum {
  componentId: string;
  componentName: string | null;
  /** Rock type. */
  rockType: "sedimentary" | "igneous" | "metamorphic" | "volcanic" | "alluvial";
  /** Rock name. */
  rockName: string;
  /** Layer depth (1 = topmost, higher = deeper). */
  depth: number;
  /** Layer thickness (from duration). */
  thickness: number;
  /** Hardness (Mohs scale 1..10). */
  hardness: number;
  /** Age (in "millions of years" = ms / 1000). */
  age: number;
  /** Fossil content (number of preserved motion patterns). */
  fossilCount: number;
  /** Description. */
  description: string;
}

/** A tectonic event. */
export interface TectonicEvent {
  /** Time in ms. */
  timeMs: number;
  /** Event type. */
  type: "earthquake" | "uplift" | "subsidence" | "volcanic-eruption" | "faulting" | "folding" | "intrusion";
  /** Magnitude 0..10. */
  magnitude: number;
  /** Affected component IDs. */
  affectedIds: string[];
  /** Description. */
  description: string;
}

/** A fault line — discontinuity between components. */
export interface FaultLine {
  /** Component A ID. */
  componentA: string;
  /** Component B ID. */
  componentB: string;
  /** Fault type. */
  type: "normal" | "reverse" | "strike-slip" | "thrust";
  /** Displacement magnitude. */
  displacement: number;
  /** Description. */
  description: string;
}

/** Mineral composition. */
export interface MineralComposition {
  /** Mineral name. */
  mineral: string;
  /** Percentage 0..100. */
  percentage: number;
  /** Source property. */
  sourceProperty: string;
  /** Description. */
  description: string;
}

/** Geological epoch. */
export interface GeologicalEpoch {
  /** Epoch name. */
  name: string;
  /** Start time in ms. */
  startMs: number;
  /** End time in ms. */
  endMs: number;
  /** Strata count in this epoch. */
  strataCount: number;
  /** Description. */
  description: string;
}

/** Topology analysis. */
export interface TopologyAnalysis {
  /** Surface type. */
  surface: "plain" | "plateau" | "mountain" | "valley" | "canyon" | "coastline" | "archipelago";
  /** Maximum elevation. */
  maxElevation: number;
  /** Minimum elevation. */
  minElevation: number;
  /** Relief (max - min). */
  relief: number;
  /** Roughness 0..1. */
  roughness: number;
  /** Description. */
  description: string;
}

/** Geology analysis result. */
export interface GeologyAnalysis {
  strata: GeologicalStratum[];
  tectonicEvents: TectonicEvent[];
  faultLines: FaultLine[];
  mineralComposition: MineralComposition[];
  epochs: GeologicalEpoch[];
  topology: TopologyAnalysis;
  /** Overall rock type. */
  primaryRockType: "sedimentary" | "igneous" | "metamorphic" | "volcanic" | "alluvial";
  /** Geological stability 0..1. */
  stability: number;
  /** Erosion rate 0..1. */
  erosionRate: number;
  /** Deposition rate 0..1. */
  depositionRate: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Stratum Classification
// ---------------------------------------------------------------------------

/** Classify a component as a rock type based on its properties. */
function classifyRockType(comp: MotionComponent): GeologicalStratum["rockType"] {
  const firstKf = comp.keyframes?.[0];
  const props = (firstKf?.properties ?? {}) as Record<string, string | number>;
  const kfCount = comp.keyframes?.length ?? 0;

  // Igneous: fast, intense (volcanic origin)
  if (comp.durationMs < 500 && kfCount <= 2) return "igneous";
  // Volcanic: very fast with color/brightness changes
  if (comp.durationMs < 300 && ("color" in props || "brightness" in props)) return "volcanic";
  // Metamorphic: many keyframes (transformed under pressure)
  if (kfCount >= 5) return "metamorphic";
  // Alluvial: long duration with smooth easing (deposited slowly)
  const easingName =
    typeof comp.easing === "object" && comp.easing !== null && "name" in comp.easing
      ? String((comp.easing as { name?: unknown }).name ?? "ease")
      : "ease";
  if (comp.durationMs > 2000 && (easingName.includes("smooth") || easingName.includes("soft"))) {
    return "alluvial";
  }
  // Sedimentary: default (layered, gradual)
  return "sedimentary";
}

/** Get a rock name from rock type and properties. */
function getRockName(rockType: GeologicalStratum["rockType"], comp: MotionComponent): string {
  const firstKf = comp.keyframes?.[0];
  const props = (firstKf?.properties ?? {}) as Record<string, string | number>;

  switch (rockType) {
    case "sedimentary":
      if ("scale" in props) return "sandstone";
      if ("opacity" in props) return "shale";
      if ("color" in props) return "limestone";
      return "siltstone";
    case "igneous":
      if (comp.durationMs < 300) return "obsidian";
      if ((comp.keyframes?.length ?? 0) <= 1) return "basalt";
      return "granite";
    case "metamorphic":
      if ("scale" in props) return "marble";
      if ("rotate" in props) return "schist";
      if ("color" in props) return "quartzite";
      return "gneiss";
    case "volcanic":
      return "pumice";
    case "alluvial":
      return "conglomerate";
    default:
      return "bedrock";
  }
}

// ---------------------------------------------------------------------------
// Stratum Extraction
// ---------------------------------------------------------------------------

/** Extract strata from components. */
function extractStrata(spec: MotionSpec): GeologicalStratum[] {
  if (spec.components.length === 0) return [];

  const timelineEnd = Math.max(
    ...spec.components.map((c) => c.delayMs + c.durationMs),
    1,
  );

  // Sort by delay (earlier = shallower)
  const sorted = [...spec.components].sort((a, b) => a.delayMs - b.delayMs);

  return sorted.map((comp, index) => {
    const rockType = classifyRockType(comp);
    const rockName = getRockName(rockType, comp);

    // Hardness: based on duration (longer = harder)
    const hardness = Math.min(10, Math.max(1, Math.round(comp.durationMs / 500)));

    // Age: based on delay (earlier = younger in geological time, but deeper = older)
    // We use the reverse: earlier in timeline = younger (more recent deposition)
    const age = Math.round((timelineEnd - comp.delayMs) / 1000);

    // Fossils: keyframe count indicates preserved patterns
    const fossilCount = (comp.keyframes?.length ?? 0) - 1;

    return {
      componentId: comp.id,
      componentName: comp.name,
      rockType,
      rockName,
      depth: index + 1,
      thickness: comp.durationMs,
      hardness,
      age: Math.max(0, age),
      fossilCount: Math.max(0, fossilCount),
      description: `${rockName} (${rockType}) layer ${index + 1} — hardness ${hardness}, age ${age}Ma, ${fossilCount} fossil(s)`,
    };
  });
}

// ---------------------------------------------------------------------------
// Tectonic Event Detection
// ---------------------------------------------------------------------------

/** Detect tectonic events from keyframe transitions. */
function detectTectonicEvents(spec: MotionSpec): TectonicEvent[] {
  const events: TectonicEvent[] = [];

  for (const comp of spec.components) {
    const kfs = comp.keyframes ?? [];
    for (let i = 1; i < kfs.length; i++) {
      const prev = kfs[i - 1];
      const curr = kfs[i];
      const timeMs = comp.delayMs + curr.offset * comp.durationMs;

      // Compute displacement between keyframes
      let displacement = 0;
      const prevProps = prev.properties as Record<string, string | number>;
      const currProps = curr.properties as Record<string, string | number>;
      for (const key of Object.keys(currProps)) {
        if (typeof currProps[key] === "number" && typeof prevProps[key] === "number") {
          displacement += Math.abs(
            (currProps[key] as number) - (prevProps[key] as number),
          );
        }
      }

      if (displacement > 50) {
        const magnitude = Math.min(10, displacement / 50);
        let type: TectonicEvent["type"] = "earthquake";
        const props = curr.properties as Record<string, string | number>;
        if ("translateY" in props) {
          if ((props.translateY as number) < 0) type = "uplift";
          else type = "subsidence";
        } else if ("translateX" in props) {
          type = "strike-slip" as TectonicEvent["type"];
        } else if ("scale" in props) {
          type = "folding";
        } else if ("rotate" in props) {
          type = "faulting";
        } else if ("color" in props || "brightness" in props) {
          type = "volcanic-eruption";
        }

        events.push({
          timeMs,
          type,
          magnitude,
          affectedIds: [comp.id],
          description: `${type} (M${magnitude.toFixed(1)}) at ${timeMs}ms — displacement ${displacement.toFixed(0)}`,
        });
      }
    }
  }

  return events.sort((a, b) => a.timeMs - b.timeMs);
}

// ---------------------------------------------------------------------------
// Fault Line Detection
// ---------------------------------------------------------------------------

/** Detect fault lines (discontinuities between adjacent components). */
function detectFaultLines(spec: MotionSpec): FaultLine[] {
  const faults: FaultLine[] = [];
  const components = [...spec.components].sort((a, b) => a.delayMs - b.delayMs);

  for (let i = 0; i < components.length - 1; i++) {
    const a = components[i];
    const b = components[i + 1];
    const gap = b.delayMs - (a.delayMs + a.durationMs);

    // A fault exists if there's a temporal gap OR abrupt property change
    if (gap > 200) {
      const displacement = gap;
      let type: FaultLine["type"] = "normal";
      // Determine fault type from property changes
      const aProps = (a.keyframes?.[0]?.properties ?? {}) as Record<string, string | number>;
      const bProps = (b.keyframes?.[0]?.properties ?? {}) as Record<string, string | number>;
      if ("translateY" in aProps && "translateY" in bProps) {
        const diff = (bProps.translateY as number) - (aProps.translateY as number);
        if (diff > 0) type = "normal";
        else type = "reverse";
      } else if ("translateX" in aProps && "translateX" in bProps) {
        type = "strike-slip";
      } else if ("scale" in aProps && "scale" in bProps) {
        type = "thrust";
      }

      faults.push({
        componentA: a.id,
        componentB: b.id,
        type,
        displacement,
        description: `${type} fault between ${a.name ?? a.id} and ${b.name ?? b.id} — displacement ${displacement.toFixed(0)}`,
      });
    }
  }

  return faults;
}

// ---------------------------------------------------------------------------
// Mineral Composition
// ---------------------------------------------------------------------------

/** Analyze mineral composition from property distribution. */
function analyzeMinerals(spec: MotionSpec): MineralComposition[] {
  const mineralMap: Record<string, { mineral: string; count: number }> = {
    translateX: { mineral: "quartz", count: 0 },
    translateY: { mineral: "feldspar", count: 0 },
    scale: { mineral: "mica", count: 0 },
    rotate: { mineral: "calcite", count: 0 },
    opacity: { mineral: "halite", count: 0 },
    color: { mineral: "hematite", count: 0 },
    backgroundColor: { mineral: "kaolinite", count: 0 },
    boxShadow: { mineral: "pyrite", count: 0 },
    blur: { mineral: "gypsum", count: 0 },
    brightness: { mineral: "sulfur", count: 0 },
  };

  let total = 0;
  for (const comp of spec.components) {
    const firstKf = comp.keyframes?.[0];
    const props = (firstKf?.properties ?? {}) as Record<string, string | number>;
    for (const key of Object.keys(props)) {
      const entry = mineralMap[key];
      if (entry) {
        entry.count++;
        total++;
      }
    }
  }

  if (total === 0) {
    return [{ mineral: "bedrock", percentage: 100, sourceProperty: "default", description: "Default bedrock composition" }];
  }

  return Object.entries(mineralMap)
    .filter(([, v]) => v.count > 0)
    .map(([key, v]) => ({
      mineral: v.mineral,
      percentage: Math.round((v.count / total) * 100),
      sourceProperty: key,
      description: `${v.mineral} (${key}) — ${Math.round((v.count / total) * 100)}%`,
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

// ---------------------------------------------------------------------------
// Epoch Division
// ---------------------------------------------------------------------------

/** Divide the timeline into geological epochs. */
function divideEpochs(spec: MotionSpec): GeologicalEpoch[] {
  if (spec.components.length === 0) return [];

  const timelineEnd = Math.max(
    ...spec.components.map((c) => c.delayMs + c.durationMs),
    1,
  );

  const epochNames = ["Holocene", "Pleistocene", "Pliocene", "Miocene", "Oligocene", "Eocene", "Paleocene"];
  const epochCount = Math.min(epochNames.length, Math.max(1, Math.floor(spec.components.length / 2)));
  const epochDuration = timelineEnd / epochCount;

  const epochs: GeologicalEpoch[] = [];
  for (let i = 0; i < epochCount; i++) {
    const startMs = i * epochDuration;
    const endMs = (i + 1) * epochDuration;
    const strataInEpoch = spec.components.filter(
      (c) => c.delayMs >= startMs && c.delayMs < endMs,
    );
    epochs.push({
      name: epochNames[i],
      startMs,
      endMs,
      strataCount: strataInEpoch.length,
      description: `${epochNames[i]} — ${strataInEpoch.length} stratum/strata`,
    });
  }

  return epochs;
}

// ---------------------------------------------------------------------------
// Topology Analysis
// ---------------------------------------------------------------------------

/** Analyze the surface topology. */
function analyzeTopology(spec: MotionSpec): TopologyAnalysis {
  if (spec.components.length === 0) {
    return { surface: "plain", maxElevation: 0, minElevation: 0, relief: 0, roughness: 0, description: "No topology" };
  }

  // Sample elevations across the timeline
  const samples: number[] = [];
  const sampleCount = 20;
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));

  for (let i = 0; i < sampleCount; i++) {
    const time = (i / sampleCount) * timelineEnd;
    let elevation = 0;
    for (const comp of spec.components) {
      if (comp.delayMs <= time && comp.delayMs + comp.durationMs >= time) {
        // Active component contributes elevation
        const progress = (time - comp.delayMs) / Math.max(1, comp.durationMs);
        elevation += Math.sin(progress * Math.PI) * 50;
      }
    }
    samples.push(elevation);
  }

  const maxElevation = Math.max(...samples);
  const minElevation = Math.min(...samples);
  const relief = maxElevation - minElevation;

  // Roughness: standard deviation of samples
  const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
  const variance = samples.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / samples.length;
  const roughness = Math.min(1, Math.sqrt(variance) / 50);

  // Surface type
  let surface: TopologyAnalysis["surface"] = "plain";
  if (relief > 100 && roughness > 0.5) surface = "mountain";
  else if (relief > 80 && roughness < 0.3) surface = "plateau";
  else if (relief > 60 && avg < 0) surface = "valley";
  else if (relief > 100 && roughness > 0.7) surface = "canyon";
  else if (roughness > 0.6) surface = "archipelago";
  else if (relief > 40) surface = "coastline";

  return {
    surface,
    maxElevation,
    minElevation,
    relief,
    roughness,
    description: `${surface} — relief ${relief.toFixed(0)}, roughness ${(roughness * 100).toFixed(0)}%`,
  };
}

// ---------------------------------------------------------------------------
// System Metrics
// ---------------------------------------------------------------------------

/** Determine primary rock type. */
function computePrimaryRockType(strata: GeologicalStratum[]): GeologyAnalysis["primaryRockType"] {
  if (strata.length === 0) return "sedimentary";
  const counts = new Map<string, number>();
  for (const s of strata) {
    counts.set(s.rockType, (counts.get(s.rockType) ?? 0) + 1);
  }
  let max = 0;
  let primary: GeologyAnalysis["primaryRockType"] = "sedimentary";
  for (const [type, count] of counts) {
    if (count > max) {
      max = count;
      primary = type as GeologyAnalysis["primaryRockType"];
    }
  }
  return primary;
}

/** Compute geological stability (inverse of tectonic activity). */
function computeStability(events: TectonicEvent[], spec: MotionSpec): number {
  if (spec.components.length === 0) return 1;
  const avgEvents = events.length / spec.components.length;
  return Math.max(0, 1 - avgEvents / 3);
}

/** Compute erosion rate (from smooth easings). */
function computeErosionRate(spec: MotionSpec): number {
  if (spec.components.length === 0) return 0;
  let smoothCount = 0;
  for (const comp of spec.components) {
    const easingName =
      typeof comp.easing === "object" && comp.easing !== null && "name" in comp.easing
        ? String((comp.easing as { name?: unknown }).name ?? "ease")
        : "ease";
    if (easingName.includes("smooth") || easingName.includes("soft") || easingName.includes("ease")) {
      smoothCount++;
    }
  }
  return smoothCount / spec.components.length;
}

/** Compute deposition rate (from delays). */
function computeDepositionRate(spec: MotionSpec): number {
  if (spec.components.length === 0) return 0;
  let delayCount = 0;
  for (const comp of spec.components) {
    if (comp.delayMs > 100) delayCount++;
  }
  return delayCount / spec.components.length;
}

// ---------------------------------------------------------------------------
// Main Analysis
// ---------------------------------------------------------------------------

/** Analyze the geology of a motion composition. */
export function analyzeGeology(spec: MotionSpec): GeologyAnalysis {
  if (spec.components.length === 0) {
    return {
      strata: [],
      tectonicEvents: [],
      faultLines: [],
      mineralComposition: [],
      epochs: [],
      topology: { surface: "plain", maxElevation: 0, minElevation: 0, relief: 0, roughness: 0, description: "No topology" },
      primaryRockType: "sedimentary",
      stability: 1,
      erosionRate: 0,
      depositionRate: 0,
      summary: "No components — the landscape is barren.",
    };
  }

  const strata = extractStrata(spec);
  const tectonicEvents = detectTectonicEvents(spec);
  const faultLines = detectFaultLines(spec);
  const mineralComposition = analyzeMinerals(spec);
  const epochs = divideEpochs(spec);
  const topology = analyzeTopology(spec);

  const primaryRockType = computePrimaryRockType(strata);
  const stability = computeStability(tectonicEvents, spec);
  const erosionRate = computeErosionRate(spec);
  const depositionRate = computeDepositionRate(spec);

  const summary =
    `Geology: ${primaryRockType} formation, ${topology.surface} topology, ` +
    `${strata.length} stratum/strata, ${tectonicEvents.length} tectonic event(s), ` +
    `${faultLines.length} fault(s), ${epochs.length} epoch(s), ` +
    `stability ${(stability * 100).toFixed(0)}%, erosion ${(erosionRate * 100).toFixed(0)}%`;

  return {
    strata,
    tectonicEvents,
    faultLines,
    mineralComposition,
    epochs,
    topology,
    primaryRockType,
    stability,
    erosionRate,
    depositionRate,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a geology analysis as a human-readable report. */
export function formatGeologyReport(analysis: GeologyAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Geology Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  // Formation
  lines.push("## Formation");
  lines.push(`- Primary rock: ${analysis.primaryRockType}`);
  lines.push(`- Surface: ${analysis.topology.surface}`);
  lines.push(`- Stability: ${(analysis.stability * 100).toFixed(0)}%`);
  lines.push(`- Erosion rate: ${(analysis.erosionRate * 100).toFixed(0)}%`);
  lines.push(`- Deposition rate: ${(analysis.depositionRate * 100).toFixed(0)}%`);
  lines.push("");

  // Strata
  lines.push("## Strata");
  if (analysis.strata.length === 0) {
    lines.push("- No strata detected");
  } else {
    for (const s of analysis.strata) {
      lines.push(`- Layer ${s.depth}: ${s.rockName} (${s.rockType}) — hardness ${s.hardness}, age ${s.age}Ma, ${s.fossilCount} fossil(s)`);
    }
  }
  lines.push("");

  // Tectonic Events
  lines.push("## Tectonic Events");
  if (analysis.tectonicEvents.length === 0) {
    lines.push("- No tectonic events detected");
  } else {
    for (const e of analysis.tectonicEvents) {
      lines.push(`- ${e.type} M${e.magnitude.toFixed(1)} at ${e.timeMs}ms — ${e.description}`);
    }
  }
  lines.push("");

  // Fault Lines
  lines.push("## Fault Lines");
  if (analysis.faultLines.length === 0) {
    lines.push("- No fault lines detected");
  } else {
    for (const f of analysis.faultLines) {
      lines.push(`- ${f.type} fault — displacement ${f.displacement.toFixed(0)}`);
    }
  }
  lines.push("");

  // Mineral Composition
  lines.push("## Mineral Composition");
  if (analysis.mineralComposition.length === 0) {
    lines.push("- No minerals detected");
  } else {
    for (const m of analysis.mineralComposition) {
      lines.push(`- ${m.mineral} (${m.sourceProperty}) — ${m.percentage}%`);
    }
  }
  lines.push("");

  // Epochs
  lines.push("## Geological Epochs");
  if (analysis.epochs.length === 0) {
    lines.push("- No epochs detected");
  } else {
    for (const e of analysis.epochs) {
      lines.push(`- ${e.name}: ${e.strataCount} stratum/strata`);
    }
  }
  lines.push("");

  // Topology
  lines.push("## Topology");
  lines.push(`- Surface: ${analysis.topology.surface}`);
  lines.push(`- Max elevation: ${analysis.topology.maxElevation.toFixed(0)}`);
  lines.push(`- Min elevation: ${analysis.topology.minElevation.toFixed(0)}`);
  lines.push(`- Relief: ${analysis.topology.relief.toFixed(0)}`);
  lines.push(`- Roughness: ${(analysis.topology.roughness * 100).toFixed(0)}%`);

  return lines.join("\n");
}
