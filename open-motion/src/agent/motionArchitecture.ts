/**
 * Motion Architecture Engine — applies architectural design principles to motion.
 *
 * This original AI-native module treats a motion composition as a built
 * structure. It analyzes the structural integrity, proportion, hierarchy,
 * spatial organization, and architectural style of the composition.
 *
 * Core concepts:
 * - Structural Roles: load-bearing (foundational) vs decorative (ornamental)
 * - Proportion: golden ratio, modular harmony, dimensional relationships
 * - Hierarchy: foundation → structure → facade → ornament → detail
 * - Spatial Organization: plan (timeline), section (intensity), elevation (layering)
 * - Architectural Style: classical, gothic, modern, brutalist, organic, etc.
 * - Structural Integrity: balance, stability, load distribution
 * - Material Honesty: whether motion properties express their true function
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The structural role of a component in the composition. */
export interface StructuralRole {
  componentId: string;
  componentName: string | null;
  /** Role classification. */
  role: "foundation" | "structure" | "facade" | "ornament" | "detail";
  /** Load-bearing capacity 0..1 (how much the composition depends on it). */
  loadBearing: number;
  /** Whether the component is essential to the composition's integrity. */
  essential: boolean;
  /** Description. */
  description: string;
}

/** Proportion analysis of the composition. */
export interface ProportionAnalysis {
  /** Golden ratio proximity 0..1 (how close durations are to phi=1.618). */
  goldenRatioProximity: number;
  /** Modular harmony 0..1 (how well durations align to a common module). */
  modularHarmony: number;
  /** The dominant duration module in ms. */
  dominantModule: number;
  /** Duration distribution. */
  durationDistribution: Array<{ bucket: string; count: number; percentage: number }>;
  /** Description. */
  description: string;
}

/** Hierarchy level in the composition. */
export interface HierarchyLevel {
  level: "foundation" | "structure" | "facade" | "ornament" | "detail";
  componentIds: string[];
  componentCount: number;
  /** Visual weight 0..1. */
  weight: number;
  description: string;
}

/** Spatial organization analysis. */
export interface SpatialOrganization {
  /** Plan (timeline layout) description. */
  plan: string;
  /** Section (intensity profile) description. */
  section: string;
  /** Elevation (layering depth) description. */
  elevation: string;
  /** Compactness 0..1 (how tightly packed the composition is). */
  compactness: number;
  /** Description. */
  description: string;
}

/** Architectural style classification. */
export interface ArchitecturalStyle {
  style: "classical" | "gothic" | "modernist" | "brutalist" | "organic" | "baroque" | "minimalist" | "deconstructivist";
  confidence: number;
  characteristics: string[];
  description: string;
}

/** Structural integrity analysis. */
export interface StructuralIntegrity {
  /** Overall stability 0..1. */
  stability: number;
  /** Balance 0..1 (left vs right, early vs late). */
  balance: number;
  /** Load distribution 0..1 (how evenly distributed the load is). */
  loadDistribution: number;
  /** Material honesty 0..1 (properties match function). */
  materialHonesty: number;
  /** Structural issues detected. */
  issues: Array<{ severity: "info" | "warning" | "critical"; message: string }>;
  description: string;
}

/** Full architecture analysis result. */
export interface ArchitectureAnalysis {
  structuralRoles: StructuralRole[];
  proportion: ProportionAnalysis;
  hierarchy: HierarchyLevel[];
  spatialOrganization: SpatialOrganization;
  style: ArchitecturalStyle;
  integrity: StructuralIntegrity;
  /** Overall architectural quality 0..1. */
  quality: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Compute the visual weight of a component. */
function computeWeight(comp: MotionComponent): number {
  let weight = 0;
  // Duration contributes (longer = heavier)
  weight += Math.min(1, comp.durationMs / 3000) * 0.3;
  // Keyframe count contributes (more complex = heavier)
  const kfCount = comp.keyframes?.length ?? 0;
  weight += Math.min(1, kfCount / 6) * 0.3;
  // Iteration count contributes
  const iter = comp.iterationCount === "infinite" ? 5 : Math.min(5, comp.iterationCount ?? 1);
  weight += (iter / 5) * 0.2;
  // Easing complexity contributes
  const easing = comp.easing;
  if (easing && typeof easing === "object") {
    if (easing.type === "spring") weight += 0.2;
    else if (easing.type === "bezier") weight += 0.15;
    else weight += 0.05;
  }
  return Math.min(1, weight);
}

/** Classify the structural role of a component. */
function classifyRole(comp: MotionComponent, allComponents: MotionComponent[]): StructuralRole {
  const weight = computeWeight(comp);
  const duration = comp.durationMs;
  const timelineStart = Math.min(...allComponents.map((c) => c.delayMs));
  const timelineEnd = Math.max(...allComponents.map((c) => c.delayMs + c.durationMs));
  const timelineDuration = timelineEnd - timelineStart;
  const componentStart = comp.delayMs - timelineStart;
  const relativeStart = timelineDuration > 0 ? componentStart / timelineDuration : 0;

  // Foundation: early start, long duration, high weight
  if (relativeStart < 0.2 && duration > 1500 && weight > 0.4) {
    return {
      componentId: comp.id,
      componentName: comp.name ?? null,
      role: "foundation",
      loadBearing: weight,
      essential: true,
      description: `${comp.name ?? comp.id}: foundation — establishes the structural base early with substantial duration and weight`,
    };
  }

  // Structure: mid-timeline, medium duration, moderate weight
  if (relativeStart >= 0.2 && relativeStart < 0.6 && duration > 800 && weight > 0.3) {
    return {
      componentId: comp.id,
      componentName: comp.name ?? null,
      role: "structure",
      loadBearing: weight * 0.8,
      essential: weight > 0.5,
      description: `${comp.name ?? comp.id}: structure — supports the composition through the middle section`,
    };
  }

  // Facade: visible, medium-to-high weight, primary visual layer
  if (weight > 0.5) {
    return {
      componentId: comp.id,
      componentName: comp.name ?? null,
      role: "facade",
      loadBearing: weight * 0.6,
      essential: false,
      description: `${comp.name ?? comp.id}: facade — the visible face of the composition, high visual presence`,
    };
  }

  // Ornament: decorative, low weight, adds flourish
  if (weight > 0.2) {
    return {
      componentId: comp.id,
      componentName: comp.name ?? null,
      role: "ornament",
      loadBearing: weight * 0.3,
      essential: false,
      description: `${comp.name ?? comp.id}: ornament — decorative element adding visual interest without structural load`,
    };
  }

  // Detail: minimal weight, subtle accent
  return {
    componentId: comp.id,
    componentName: comp.name ?? null,
    role: "detail",
    loadBearing: weight * 0.1,
    essential: false,
    description: `${comp.name ?? comp.id}: detail — subtle accent, the finest grain of the composition`,
  };
}

/** Analyze the proportion of the composition. */
function analyzeProportion(spec: MotionSpec): ProportionAnalysis {
  if (spec.components.length === 0) {
    return {
      goldenRatioProximity: 0,
      modularHarmony: 0,
      dominantModule: 0,
      durationDistribution: [],
      description: "No components — proportion cannot be analyzed.",
    };
  }

  const durations = spec.components.map((c) => c.durationMs);
  const phi = 1.618;

  // Golden ratio proximity: check if duration ratios approach phi
  let phiScore = 0;
  let phiCount = 0;
  for (let i = 0; i < durations.length - 1; i++) {
    const ratio = Math.max(durations[i], durations[i + 1]) / Math.min(durations[i], durations[i + 1]);
    if (ratio > 0) {
      phiScore += 1 - Math.min(1, Math.abs(ratio - phi) / phi);
      phiCount++;
    }
  }
  const goldenRatioProximity = phiCount > 0 ? phiScore / phiCount : 0;

  // Modular harmony: find the GCD-like module
  const sortedDurations = [...durations].sort((a, b) => a - b);
  const minDuration = sortedDurations[0];
  let bestModule = minDuration;
  let bestHarmony = 0;

  for (const candidate of [100, 200, 250, 300, 400, 500, 800, 1000, 1500, 2000]) {
    let harmonicCount = 0;
    for (const d of durations) {
      const ratio = d / candidate;
      const nearest = Math.round(ratio);
      if (Math.abs(ratio - nearest) < 0.2) harmonicCount++;
    }
    const harmony = harmonicCount / durations.length;
    if (harmony > bestHarmony) {
      bestHarmony = harmony;
      bestModule = candidate;
    }
  }

  // Duration distribution
  const buckets = [
    { name: "very-short (<500ms)", min: 0, max: 500 },
    { name: "short (500-1000ms)", min: 500, max: 1000 },
    { name: "medium (1000-2000ms)", min: 1000, max: 2000 },
    { name: "long (2000-4000ms)", min: 2000, max: 4000 },
    { name: "very-long (>4000ms)", min: 4000, max: Infinity },
  ];

  const durationDistribution = buckets.map((b) => {
    const count = durations.filter((d) => d >= b.min && d < b.max).length;
    return {
      bucket: b.name,
      count,
      percentage: count / durations.length,
    };
  }).filter((b) => b.count > 0);

  const description = `Proportion: golden ratio proximity ${(goldenRatioProximity * 100).toFixed(0)}%, ` +
    `modular harmony ${(bestHarmony * 100).toFixed(0)}% (module=${bestModule}ms)`;

  return {
    goldenRatioProximity,
    modularHarmony: bestHarmony,
    dominantModule: bestModule,
    durationDistribution,
    description,
  };
}

/** Analyze the hierarchy of the composition. */
function analyzeHierarchy(spec: MotionSpec): HierarchyLevel[] {
  if (spec.components.length === 0) return [];

  const roles = spec.components.map((c) => classifyRole(c, spec.components));
  const levels: HierarchyLevel["level"][] = ["foundation", "structure", "facade", "ornament", "detail"];
  const levelDescriptions: Record<HierarchyLevel["level"], string> = {
    foundation: "the base layer — sets the structural foundation and timing baseline",
    structure: "the supporting frame — carries the composition through its middle",
    facade: "the visible face — the primary visual layer the viewer perceives",
    ornament: "the decorative layer — adds flourish and visual interest",
    detail: "the finest grain — subtle accents that complete the composition",
  };

  const hierarchy: HierarchyLevel[] = [];
  for (const level of levels) {
    const levelRoles = roles.filter((r) => r.role === level);
    if (levelRoles.length === 0) continue;
    const avgWeight = levelRoles.reduce((sum, r) => sum + r.loadBearing, 0) / levelRoles.length;
    hierarchy.push({
      level,
      componentIds: levelRoles.map((r) => r.componentId),
      componentCount: levelRoles.length,
      weight: avgWeight,
      description: `${level} (${levelRoles.length} component(s), weight ${(avgWeight * 100).toFixed(0)}%) — ${levelDescriptions[level]}`,
    });
  }

  return hierarchy;
}

/** Analyze the spatial organization of the composition. */
function analyzeSpatialOrganization(spec: MotionSpec): SpatialOrganization {
  if (spec.components.length === 0) {
    return {
      plan: "Empty plan — no timeline structure",
      section: "Empty section — no intensity profile",
      elevation: "Empty elevation — no layering",
      compactness: 0,
      description: "No components — spatial organization is undefined.",
    };
  }

  const timelineStart = Math.min(...spec.components.map((c) => c.delayMs));
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const timelineDuration = timelineEnd - timelineStart;

  // Plan: timeline layout
  const overlapping = spec.components.filter((c) => {
    return spec.components.some((other) => other.id !== c.id &&
      c.delayMs < other.delayMs + other.durationMs &&
      c.delayMs + c.durationMs > other.delayMs);
  }).length;
  const planType = overlapping > spec.components.length / 2 ? "layered" : "sequential";
  const plan = `${planType} plan — ${spec.components.length} element(s) across ${timelineDuration}ms with ${overlapping} overlapping`;

  // Section: intensity profile
  const weights = spec.components.map((c) => computeWeight(c));
  const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
  const maxWeight = Math.max(...weights);
  const minWeight = Math.min(...weights);
  const weightRange = maxWeight - minWeight;
  const sectionType = weightRange > 0.5 ? "dramatic" : weightRange > 0.2 ? "varied" : "uniform";
  const section = `${sectionType} section — weight range ${(minWeight * 100).toFixed(0)}%-${(maxWeight * 100).toFixed(0)}%, average ${(avgWeight * 100).toFixed(0)}%`;

  // Elevation: layering depth (max simultaneous components)
  let maxSimultaneous = 0;
  const samplePoints = 20;
  for (let i = 0; i <= samplePoints; i++) {
    const t = timelineStart + (timelineDuration * i) / samplePoints;
    const count = spec.components.filter((c) => c.delayMs <= t && c.delayMs + c.durationMs >= t).length;
    maxSimultaneous = Math.max(maxSimultaneous, count);
  }
  const elevationType = maxSimultaneous > 5 ? "deep" : maxSimultaneous > 2 ? "medium" : "shallow";
  const elevation = `${elevationType} elevation — max ${maxSimultaneous} simultaneous layer(s)`;

  // Compactness
  const totalDuration = spec.components.reduce((sum, c) => sum + c.durationMs, 0);
  const compactness = timelineDuration > 0 ? Math.min(1, totalDuration / (timelineDuration * maxSimultaneous)) : 0;

  const description = `Spatial: ${planType} plan, ${sectionType} section, ${elevationType} elevation, compactness ${(compactness * 100).toFixed(0)}%`;

  return { plan, section, elevation, compactness, description };
}

/** Classify the architectural style of the composition. */
function classifyStyle(spec: MotionSpec): ArchitecturalStyle {
  if (spec.components.length === 0) {
    return {
      style: "minimalist",
      confidence: 0,
      characteristics: [],
      description: "No components — style cannot be classified.",
    };
  }

  const weights = spec.components.map((c) => computeWeight(c));
  const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
  const durations = spec.components.map((c) => c.durationMs);
  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const durationVariance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
  const durationStdDev = Math.sqrt(durationVariance);
  const durationCV = avgDuration > 0 ? durationStdDev / avgDuration : 0;

  const timelineStart = Math.min(...spec.components.map((c) => c.delayMs));
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const timelineDuration = timelineEnd - timelineStart;
  const totalDuration = spec.components.reduce((sum, c) => sum + c.durationMs, 0);
  const density = timelineDuration > 0 ? totalDuration / timelineDuration : 0;

  const hasSpring = spec.components.some((c) => {
    const e = c.easing;
    return e && typeof e === "object" && e.type === "spring";
  });
  const hasBounce = spec.components.some((c) => {
    const e = c.easing;
    return e && typeof e === "object" && e.type === "preset" && e.name === "bounce";
  });

  const characteristics: string[] = [];
  let style: ArchitecturalStyle["style"] = "minimalist";
  let confidence = 0.5;

  // Brutalist: high density, high weight, uniform durations
  if (density > 2 && avgWeight > 0.5 && durationCV < 0.3) {
    style = "brutalist";
    confidence = 0.8;
    characteristics.push("high density", "heavy weight", "uniform durations");
  }
  // Baroque: high weight, high variance, many components
  else if (avgWeight > 0.5 && durationCV > 0.5 && spec.components.length > 5) {
    style = "baroque";
    confidence = 0.75;
    characteristics.push("ornate complexity", "dramatic variation", "rich layering");
  }
  // Gothic: vertical emphasis (spring), dramatic variance
  else if (hasSpring && durationCV > 0.4) {
    style = "gothic";
    confidence = 0.7;
    characteristics.push("vertical aspiration", "dramatic variation", "spring dynamics");
  }
  // Organic: spring easing, moderate density
  else if (hasSpring && density > 0.8 && density < 2) {
    style = "organic";
    confidence = 0.75;
    characteristics.push("natural motion", "spring dynamics", "moderate density");
  }
  // Modernist: moderate weight, low variance, clean structure
  else if (avgWeight > 0.3 && avgWeight < 0.6 && durationCV < 0.4) {
    style = "modernist";
    confidence = 0.7;
    characteristics.push("clean structure", "balanced weight", "consistent rhythm");
  }
  // Classical: golden ratio proximity, balanced
  else if (durationCV < 0.3 && density > 0.5 && density < 1.5) {
    style = "classical";
    confidence = 0.65;
    characteristics.push("balanced proportion", "harmonious rhythm", "moderate density");
  }
  // Deconstructivist: high variance, low density
  else if (durationCV > 0.6 && density < 0.8) {
    style = "deconstructivist";
    confidence = 0.7;
    characteristics.push("fragmented structure", "irregular rhythm", "low density");
  }
  // Minimalist: few components, low weight
  else {
    style = "minimalist";
    confidence = 0.6;
    characteristics.push("reduced elements", "sparse composition", "essential focus");
  }

  if (hasBounce) characteristics.push("playful detail");

  const description = `Style: ${style} (confidence ${(confidence * 100).toFixed(0)}%) — ${characteristics.join(", ")}`;

  return { style, confidence, characteristics, description };
}

/** Analyze the structural integrity of the composition. */
function analyzeIntegrity(spec: MotionSpec, roles: StructuralRole[]): StructuralIntegrity {
  if (spec.components.length === 0) {
    return {
      stability: 0,
      balance: 0,
      loadDistribution: 0,
      materialHonesty: 0,
      issues: [],
      description: "No components — integrity is undefined.",
    };
  }

  const issues: StructuralIntegrity["issues"] = [];

  // Balance: early vs late distribution
  const timelineStart = Math.min(...spec.components.map((c) => c.delayMs));
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const timelineMid = (timelineStart + timelineEnd) / 2;
  const earlyWeight = spec.components
    .filter((c) => c.delayMs + c.durationMs / 2 < timelineMid)
    .reduce((sum, c) => sum + computeWeight(c), 0);
  const lateWeight = spec.components
    .filter((c) => c.delayMs + c.durationMs / 2 >= timelineMid)
    .reduce((sum, c) => sum + computeWeight(c), 0);
  const totalWeight = earlyWeight + lateWeight;
  const balance = totalWeight > 0 ? 1 - Math.abs(earlyWeight - lateWeight) / totalWeight : 0;

  if (balance < 0.4) {
    issues.push({
      severity: "warning",
      message: `Composition is unbalanced — ${earlyWeight > lateWeight ? "early" : "late"} half carries ${(Math.abs(earlyWeight - lateWeight) / totalWeight * 100).toFixed(0)}% more weight`,
    });
  }

  // Load distribution: how evenly the load is spread
  const loads = roles.map((r) => r.loadBearing);
  const avgLoad = loads.reduce((a, b) => a + b, 0) / loads.length;
  const loadVariance = loads.reduce((sum, l) => sum + Math.pow(l - avgLoad, 2), 0) / loads.length;
  const loadStdDev = Math.sqrt(loadVariance);
  const loadDistribution = avgLoad > 0 ? Math.max(0, 1 - loadStdDev / avgLoad) : 0;

  if (loadDistribution < 0.3) {
    issues.push({
      severity: "info",
      message: "Load is concentrated on few components — consider distributing weight more evenly",
    });
  }

  // Stability: based on foundation presence and integrity
  const hasFoundation = roles.some((r) => r.role === "foundation");
  const hasStructure = roles.some((r) => r.role === "structure");
  const foundationWeight = roles.filter((r) => r.role === "foundation").reduce((sum, r) => sum + r.loadBearing, 0);
  const stability = hasFoundation
    ? Math.min(1, foundationWeight * 0.5 + (hasStructure ? 0.3 : 0) + balance * 0.2)
    : Math.min(0.5, balance * 0.3 + loadDistribution * 0.2);

  if (!hasFoundation) {
    issues.push({
      severity: "warning",
      message: "No foundation component detected — the composition lacks a structural base",
    });
  }

  // Material honesty: do motion properties express their function?
  let honestCount = 0;
  for (const role of roles) {
    const comp = spec.components.find((c) => c.id === role.componentId);
    if (!comp) continue;
    // Foundation should be long and stable
    if (role.role === "foundation" && comp.durationMs > 1000) honestCount++;
    // Ornament should be short and light
    else if (role.role === "ornament" && comp.durationMs < 2000) honestCount++;
    // Detail should be minimal
    else if (role.role === "detail" && comp.durationMs < 1500) honestCount++;
    // Facade should be visually prominent
    else if (role.role === "facade" && computeWeight(comp) > 0.4) honestCount++;
    // Structure should be mid-range
    else if (role.role === "structure" && comp.durationMs > 500 && comp.durationMs < 4000) honestCount++;
  }
  const materialHonesty = roles.length > 0 ? honestCount / roles.length : 0;

  if (materialHonesty < 0.5) {
    issues.push({
      severity: "info",
      message: "Low material honesty — some components' motion properties don't express their structural role",
    });
  }

  const description = `Integrity: stability ${(stability * 100).toFixed(0)}%, balance ${(balance * 100).toFixed(0)}%, ` +
    `load distribution ${(loadDistribution * 100).toFixed(0)}%, material honesty ${(materialHonesty * 100).toFixed(0)}%`;

  return {
    stability,
    balance,
    loadDistribution,
    materialHonesty,
    issues,
    description,
  };
}

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Analyze a motion composition through the architectural lens.
 *
 * Treats the composition as a built structure and evaluates its structural
 * integrity, proportion, hierarchy, spatial organization, and style.
 */
export function analyzeArchitecture(spec: MotionSpec): ArchitectureAnalysis {
  if (spec.components.length === 0) {
    return {
      structuralRoles: [],
      proportion: {
        goldenRatioProximity: 0,
        modularHarmony: 0,
        dominantModule: 0,
        durationDistribution: [],
        description: "No components — proportion is undefined.",
      },
      hierarchy: [],
      spatialOrganization: {
        plan: "Empty",
        section: "Empty",
        elevation: "Empty",
        compactness: 0,
        description: "No components — spatial organization is undefined.",
      },
      style: {
        style: "minimalist",
        confidence: 0,
        characteristics: [],
        description: "No components — style is undefined.",
      },
      integrity: {
        stability: 0,
        balance: 0,
        loadDistribution: 0,
        materialHonesty: 0,
        issues: [],
        description: "No components — integrity is undefined.",
      },
      quality: 0,
      summary: "No components — the structure is empty.",
    };
  }

  const structuralRoles = spec.components.map((c) => classifyRole(c, spec.components));
  const proportion = analyzeProportion(spec);
  const hierarchy = analyzeHierarchy(spec);
  const spatialOrganization = analyzeSpatialOrganization(spec);
  const style = classifyStyle(spec);
  const integrity = analyzeIntegrity(spec, structuralRoles);

  // Overall quality = weighted average of key metrics
  const quality = (
    integrity.stability * 0.3 +
    integrity.balance * 0.2 +
    integrity.loadDistribution * 0.15 +
    integrity.materialHonesty * 0.15 +
    proportion.modularHarmony * 0.1 +
    spatialOrganization.compactness * 0.1
  );

  const summary = `Architecture: ${style.style} style (${(style.confidence * 100).toFixed(0)}%), ` +
    `${hierarchy.length} hierarchy level(s), ` +
    `stability ${(integrity.stability * 100).toFixed(0)}%, balance ${(integrity.balance * 100).toFixed(0)}%, ` +
    `quality ${(quality * 100).toFixed(0)}%`;

  return {
    structuralRoles,
    proportion,
    hierarchy,
    spatialOrganization,
    style,
    integrity,
    quality,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format an architecture analysis as a human-readable report. */
export function formatArchitectureReport(analysis: ArchitectureAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Architecture Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  // Style
  lines.push("## Architectural Style");
  lines.push(`- Style: ${analysis.style.style} (confidence ${(analysis.style.confidence * 100).toFixed(0)}%)`);
  lines.push(`- Characteristics: ${analysis.style.characteristics.join(", ")}`);
  lines.push("");

  // Hierarchy
  lines.push("## Structural Hierarchy");
  if (analysis.hierarchy.length === 0) {
    lines.push("- No hierarchy detected");
  } else {
    for (const level of analysis.hierarchy) {
      lines.push(`- ${level.description}`);
    }
  }
  lines.push("");

  // Structural Roles
  lines.push("## Component Roles");
  if (analysis.structuralRoles.length === 0) {
    lines.push("- No components");
  } else {
    for (const role of analysis.structuralRoles) {
      lines.push(`- [${role.role}] ${role.componentName ?? role.componentId} — load ${(role.loadBearing * 100).toFixed(0)}%${role.essential ? " (essential)" : ""}`);
    }
  }
  lines.push("");

  // Proportion
  lines.push("## Proportion");
  lines.push(`- Golden ratio proximity: ${(analysis.proportion.goldenRatioProximity * 100).toFixed(0)}%`);
  lines.push(`- Modular harmony: ${(analysis.proportion.modularHarmony * 100).toFixed(0)}% (module: ${analysis.proportion.dominantModule}ms)`);
  if (analysis.proportion.durationDistribution.length > 0) {
    lines.push("- Duration distribution:");
    for (const bucket of analysis.proportion.durationDistribution) {
      lines.push(`  - ${bucket.bucket}: ${bucket.count} (${(bucket.percentage * 100).toFixed(0)}%)`);
    }
  }
  lines.push("");

  // Spatial Organization
  lines.push("## Spatial Organization");
  lines.push(`- Plan: ${analysis.spatialOrganization.plan}`);
  lines.push(`- Section: ${analysis.spatialOrganization.section}`);
  lines.push(`- Elevation: ${analysis.spatialOrganization.elevation}`);
  lines.push(`- Compactness: ${(analysis.spatialOrganization.compactness * 100).toFixed(0)}%`);
  lines.push("");

  // Integrity
  lines.push("## Structural Integrity");
  lines.push(`- Stability: ${(analysis.integrity.stability * 100).toFixed(0)}%`);
  lines.push(`- Balance: ${(analysis.integrity.balance * 100).toFixed(0)}%`);
  lines.push(`- Load distribution: ${(analysis.integrity.loadDistribution * 100).toFixed(0)}%`);
  lines.push(`- Material honesty: ${(analysis.integrity.materialHonesty * 100).toFixed(0)}%`);
  if (analysis.integrity.issues.length > 0) {
    lines.push("- Issues:");
    for (const issue of analysis.integrity.issues) {
      lines.push(`  - [${issue.severity}] ${issue.message}`);
    }
  }
  lines.push("");

  lines.push(`## Overall Quality: ${(analysis.quality * 100).toFixed(0)}%`);

  return lines.join("\n");
}
