import type { MotionSpec, MotionComponent, Easing } from "@openmotion/shared";

/**
 * Motion Thermodynamics — a thermal model of motion energy.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-component heat reading. */
export interface ComponentHeat {
  /** Component id. */
  componentId: string;
  /** Component name (or id fallback). */
  componentName: string;
  /** 0..1 — normalized motion intensity from transform magnitudes. */
  intensity: number;
  /** Duration in seconds. */
  durationSec: number;
  /** Multiplier from the iteration strategy (infinite=2, multi=1.5, once=1). */
  loopFactor: number;
  /** Absolute heat emitted by this component. */
  heat: number;
  /** Share of the project's total heat (0..1). */
  heatShare: number;
  /** Whether this component is a top hotspot. */
  isHotspot: boolean;
  /** Whether this component is a bottom coldspot (and not static). */
  isColdspot: boolean;
}

export type ThermalPhase = "solid" | "liquid" | "gas" | "plasma";

/** The full thermodynamic report. */
export interface ThermalReport {
  /** Component count the analysis ran against. */
  componentCount: number;
  /** Per-component heat readings, sorted by heat descending. */
  components: ComponentHeat[];
  /** Sum of all component heat. */
  totalHeat: number;
  /** Average temperature per component (totalHeat / count). */
  averageTemperature: number;
  /** 0..1 — Shannon entropy of the heat distribution. */
  entropy: number;
  /** The phase the project is currently in. */
  phase: ThermalPhase;
  /** Why the phase was chosen. */
  phaseReason: string;
  /** Variance of heat across components (0 = perfect equilibrium). */
  equilibriumDistance: number;
  /** 0..1 — how much heat can be added before the project enters plasma. */
  heatCapacityRemaining: number;
  /** Components that emit the most heat. */
  hotspots: ComponentHeat[];
  /** Components that emit the least heat (and are not static). */
  coldspots: ComponentHeat[];
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Heat computation
// ---------------------------------------------------------------------------

interface EasingProfile {
  family: string;
  bouncy: boolean;
}

function profileEasing(easing: Easing): EasingProfile {
  if (easing.type === "preset") {
    const n = easing.name.toLowerCase();
    return { family: easing.name, bouncy: /bounce|elastic|back|spring/.test(n) };
  }
  if (easing.type === "spring") return { family: "spring", bouncy: true };
  return { family: "bezier", bouncy: false };
}

/** Maximum transform magnitude across the standard transform properties. */
function magnitudeOf(c: MotionComponent): number {
  let maxMag = 0;
  for (const kf of c.keyframes) {
    for (const prop of ["translateX", "translateY", "rotate", "scale"] as const) {
      const v = kf.properties[prop];
      if (typeof v === "number") maxMag = Math.max(maxMag, Math.abs(v));
      else if (typeof v === "string") {
        const m = v.match(/-?\d+\.?\d*/);
        if (m) maxMag = Math.max(maxMag, Math.abs(parseFloat(m[0])));
      }
    }
  }
  return maxMag;
}

/**
 * Normalize a raw magnitude into a 0..1 intensity score. Magnitudes are
 * squashed log-style so a 1000px slide does not dwarf a 50px slide by 20×.
 */
function intensityFromMagnitude(mag: number, bouncy: boolean): number {
  if (mag <= 0) return 0;
  // log2(1 + mag/30) maps 30 -> 1, 90 -> 2, 210 -> 3, ... then squashed to 0..1.
  const raw = Math.log2(1 + mag / 30);
  let intensity = Math.min(1, raw / 4);
  // Bouncy easings radiate more energy for the same magnitude.
  if (bouncy) intensity = Math.min(1, intensity * 1.15);
  return Math.round(intensity * 100) / 100;
}

/** Loop factor — infinite loops radiate indefinitely, multi-repeat partially. */
function loopFactorOf(c: MotionComponent): number {
  if (c.iterationCount === "infinite") return 2;
  if (typeof c.iterationCount === "number" && c.iterationCount > 1) return 1.5;
  return 1;
}

/** Compute per-component heat readings for a spec. */
function computeComponentHeat(spec: MotionSpec): ComponentHeat[] {
  const raw = spec.components.map((c) => {
    const profile = profileEasing(c.easing);
    const intensity = intensityFromMagnitude(magnitudeOf(c), profile.bouncy);
    const durationSec = c.durationMs / 1000;
    const loopFactor = loopFactorOf(c);
    const heat = intensity * durationSec * loopFactor;
    return {
      componentId: c.id,
      componentName: c.name || c.id,
      intensity,
      durationSec,
      loopFactor,
      heat,
    };
  });
  const totalHeat = raw.reduce((s, r) => s + r.heat, 0);
  return raw
    .map((r) => ({
      ...r,
      heatShare: totalHeat > 0 ? r.heat / totalHeat : 0,
      isHotspot: false,
      isColdspot: false,
    }))
    .sort((a, b) => b.heat - a.heat);
}

// ---------------------------------------------------------------------------
// Entropy, phase, equilibrium, capacity
// ---------------------------------------------------------------------------

/** Shannon entropy of the heat distribution, normalized to 0..1. */
function shannonEntropy(components: ComponentHeat[]): number {
  if (components.length === 0) return 0;
  let entropy = 0;
  for (const c of components) {
    if (c.heatShare <= 0) continue;
    entropy -= c.heatShare * Math.log2(c.heatShare);
  }
  // Normalize by log2(n) so the result is in 0..1 regardless of count.
  const maxEntropy = Math.log2(components.length);
  return maxEntropy > 0 ? Math.round((entropy / maxEntropy) * 100) / 100 : 0;
}

/**
 * Phase classification from heat + entropy.
 * - solid:    low average temperature, any entropy (cold / sparse).
 * - liquid:   moderate temperature, moderate-to-high entropy (warm, well-spread).
 * - gas:      high temperature, low entropy (hot but concentrated in few spots).
 * - plasma:   high temperature, high entropy (hot and uniform-bright).
 */
function classifyPhase(
  averageTemperature: number,
  entropy: number,
): { phase: ThermalPhase; reason: string } {
  const HOT_THRESHOLD = 0.6;
  const LOW_ENTROPY = 0.4;
  const HIGH_ENTROPY = 0.7;
  if (averageTemperature < HOT_THRESHOLD) {
    return {
      phase: "solid",
      reason: `Average temperature ${averageTemperature.toFixed(2)} is below the heat threshold (${HOT_THRESHOLD}) — the composition reads as cool and ordered.`,
    };
  }
  if (entropy >= HIGH_ENTROPY) {
    return {
      phase: "plasma",
      reason: `Average temperature ${averageTemperature.toFixed(2)} is high and entropy ${entropy.toFixed(2)} is high — energy is radiating uniformly across components.`,
    };
  }
  if (entropy <= LOW_ENTROPY) {
    return {
      phase: "gas",
      reason: `Average temperature ${averageTemperature.toFixed(2)} is high but entropy ${entropy.toFixed(2)} is low — energy is concentrated in a few hotspots.`,
    };
  }
  return {
    phase: "liquid",
    reason: `Average temperature ${averageTemperature.toFixed(2)} is warm and entropy ${entropy.toFixed(2)} is moderate — energy flows in a balanced way.`,
  };
}

/** Variance of heat values — 0 means perfect equilibrium. */
function equilibriumDistance(components: ComponentHeat[]): number {
  if (components.length === 0) return 0;
  const mean = components.reduce((s, c) => s + c.heat, 0) / components.length;
  const variance = components.reduce((s, c) => s + (c.heat - mean) ** 2, 0) / components.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

/**
 * How much heat can be added before the project enters the plasma phase.
 * Plasma requires both high average temperature and high entropy, so the
 * remaining capacity is the smaller of (a) headroom to the heat threshold and
 * (b) headroom to the entropy threshold. Returned as a 0..1 fraction of the
 * current total heat.
 */
function heatCapacityRemaining(
  totalHeat: number,
  averageTemperature: number,
  entropy: number,
  phase: ThermalPhase,
): number {
  if (phase === "plasma") return 0;
  // Heat headroom: how much more average temperature can climb.
  const heatHeadroom = Math.max(0, 1 - averageTemperature);
  // Entropy headroom: how much more entropy can climb before saturating.
  const entropyHeadroom = Math.max(0, 1 - entropy);
  // Convert to a fraction of current total heat (so a hot project has less
  // relative capacity than a cold one even at the same headroom).
  if (totalHeat <= 0) return 1;
  const ratio = Math.min(heatHeadroom, entropyHeadroom * 0.5);
  return Math.round(Math.min(1, ratio) * 100) / 100;
}

/** Mark the top and bottom heat components as hotspots / coldspots. */
function markExtremes(components: ComponentHeat[]): void {
  if (components.length === 0) return;
  const hotspotCount = Math.max(1, Math.min(3, Math.floor(components.length * 0.2)));
  for (let i = 0; i < hotspotCount && i < components.length; i++) {
    components[i].isHotspot = true;
  }
  // Coldspots are the lowest-heat components that are NOT fully static
  // (static components are trivially cold and uninteresting).
  const nonStatic = components.filter((c) => c.heat > 0);
  nonStatic.sort((a, b) => a.heat - b.heat);
  const coldspotCount = Math.max(1, Math.min(3, Math.floor(nonStatic.length * 0.2)));
  for (let i = 0; i < coldspotCount && i < nonStatic.length; i++) {
    const cold = nonStatic[i];
    const target = components.find((c) => c.componentId === cold.componentId);
    if (target) target.isColdspot = true;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Run the thermodynamic analysis on a project spec. */
export function analyzeThermodynamics(spec: MotionSpec): ThermalReport {
  if (spec.components.length === 0) {
    return {
      componentCount: 0,
      components: [],
      totalHeat: 0,
      averageTemperature: 0,
      entropy: 0,
      phase: "solid",
      phaseReason: "Empty project — no heat sources.",
      equilibriumDistance: 0,
      heatCapacityRemaining: 1,
      hotspots: [],
      coldspots: [],
      summary: "Empty project — no heat sources.",
    };
  }

  const components = computeComponentHeat(spec);
  markExtremes(components);
  const totalHeat = Math.round(components.reduce((s, c) => s + c.heat, 0) * 100) / 100;
  const averageTemperature =
    Math.round((totalHeat / components.length) * 100) / 100;
  const entropy = shannonEntropy(components);
  const { phase, reason: phaseReason } = classifyPhase(averageTemperature, entropy);
  const equilibriumDist = equilibriumDistance(components);
  const heatCapacityRemainingVal = heatCapacityRemaining(totalHeat, averageTemperature, entropy, phase);
  const hotspots = components.filter((c) => c.isHotspot);
  const coldspots = components.filter((c) => c.isColdspot);

  const summary = `Phase: ${phase.toUpperCase()}. Total heat ${totalHeat.toFixed(2)} across ${components.length} component(s), average temperature ${averageTemperature.toFixed(2)}, entropy ${entropy.toFixed(2)}. ${hotspots.length} hotspot(s), ${coldspots.length} coldspot(s). Capacity remaining: ${heatCapacityRemainingVal}.`;

  return {
    componentCount: components.length,
    components,
    totalHeat,
    averageTemperature,
    entropy,
    phase,
    phaseReason,
    equilibriumDistance: equilibriumDist,
    heatCapacityRemaining: heatCapacityRemainingVal,
    hotspots,
    coldspots,
    summary,
  };
}

/** Format a thermal report as a human-readable string. */
export function formatThermalReport(report: ThermalReport): string {
  const lines: string[] = [];
  lines.push("=== Motion Thermodynamics ===");
  lines.push("");
  lines.push(`Components: ${report.componentCount}`);
  lines.push("");
  lines.push("--- Aggregate ---");
  lines.push(`total heat:          ${report.totalHeat.toFixed(2)}`);
  lines.push(`average temperature: ${report.averageTemperature.toFixed(2)}`);
  lines.push(`entropy:             ${report.entropy.toFixed(2)}`);
  lines.push(`equilibrium distance: ${report.equilibriumDistance.toFixed(2)}`);
  lines.push(`heat capacity left:  ${report.heatCapacityRemaining}`);
  lines.push("");
  lines.push("--- Phase ---");
  lines.push(`phase: ${report.phase.toUpperCase()}`);
  lines.push(report.phaseReason);
  lines.push("");
  if (report.components.length > 0) {
    lines.push("--- Component Heat (top 10) ---");
    for (const c of report.components.slice(0, 10)) {
      const tags: string[] = [];
      if (c.isHotspot) tags.push("HOT");
      if (c.isColdspot) tags.push("COLD");
      const tagStr = tags.length > 0 ? ` [${tags.join(",")}]` : "";
      lines.push(
        `• ${c.componentName.padEnd(16)} heat=${c.heat.toFixed(2)} share=${Math.round(c.heatShare * 100)}% intensity=${c.intensity} loop×${c.loopFactor}${tagStr}`,
      );
    }
    lines.push("");
  }
  if (report.hotspots.length > 0) {
    lines.push("--- Hotspots ---");
    for (const h of report.hotspots) {
      lines.push(`• ${h.componentName}: heat ${h.heat.toFixed(2)} (${Math.round(h.heatShare * 100)}% of total)`);
    }
    lines.push("");
  }
  if (report.coldspots.length > 0) {
    lines.push("--- Coldspots ---");
    for (const c of report.coldspots) {
      lines.push(`• ${c.componentName}: heat ${c.heat.toFixed(2)} (${Math.round(c.heatShare * 100)}% of total)`);
    }
    lines.push("");
  }
  lines.push(`Summary: ${report.summary}`);
  return lines.join("\n");
}
