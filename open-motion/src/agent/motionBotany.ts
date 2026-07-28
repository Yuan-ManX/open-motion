/**
 * Motion Botany Engine — analyzes motion as plant growth patterns.
 *
 * This original AI-native module treats a motion composition as a botanical
 * system. Components are organs (leaves, stems, flowers, roots); the timeline
 * is the growing season; easings determine phototropism (growth direction);
 * delays are germination periods; keyframe counts indicate branching.
 *
 * Core concepts:
 * - Organs: components mapped to plant organs by property type
 * - Phenology: growth stages (germination → seedling → vegetative → flowering → fruiting → senescence)
 * - Branching: fractal complexity from keyframe density
 * - Phototropism: directional growth bias from motion vectors
 * - Canopy: the upper layer of motion (final state)
 * - Root System: the foundational layer (initial state)
 * - Biomass: total motion energy
 * - Diversity: species richness from property variety
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A plant organ — a component mapped to a botanical structure. */
export interface PlantOrgan {
  componentId: string;
  componentName: string | null;
  /** Organ type. */
  type: "leaf" | "stem" | "flower" | "root" | "branch" | "fruit" | "seed" | "tendril" | "bark";
  /** Growth stage when this organ appears. */
  growthStage: GrowthStage;
  /** Branching order (0 = main trunk, 1 = primary branch, ...). */
  branchingOrder: number;
  /** Phototropism direction. */
  phototropism: "up" | "down" | "left" | "right" | "outward" | "inward";
  /** Biomass contribution 0..1. */
  biomass: number;
  /** Vitality 0..1. */
  vitality: number;
  /** Description. */
  description: string;
}

/** Growth stages (phenology). */
export type GrowthStage =
  | "germination"
  | "seedling"
  | "vegetative"
  | "flowering"
  | "fruiting"
  | "senescence";

/** A branching node. */
export interface BranchingNode {
  componentId: string;
  /** Children component IDs. */
  children: string[];
  /** Branching angle in degrees (deviation from parent). */
  angle: number;
  /** Branching order. */
  order: number;
  /** Description. */
  description: string;
}

/** Canopy analysis. */
export interface CanopyAnalysis {
  /** Canopy shape. */
  shape: "dome" | "conical" | "columnar" | "spreading" | "umbrella" | "irregular";
  /** Canopy density 0..1. */
  density: number;
  /** Canopy height (peak displacement). */
  height: number;
  /** Canopy width (spread). */
  width: number;
  /** Description. */
  description: string;
}

/** Root system analysis. */
export interface RootSystemAnalysis {
  /** Root type. */
  type: "taproot" | "fibrous" | "adventitious" | "aerial" | "tuberous";
  /** Root depth. */
  depth: number;
  /** Root spread. */
  spread: number;
  /** Root density 0..1. */
  density: number;
  /** Description. */
  description: string;
}

/** Phenology timeline. */
export interface PhenologyTimeline {
  /** Stage durations. */
  stages: Array<{
    stage: GrowthStage;
    startMs: number;
    endMs: number;
    durationMs: number;
    organCount: number;
    description: string;
  }>;
  /** Current stage (last active). */
  currentStage: GrowthStage;
  /** Description. */
  description: string;
}

/** Botany analysis result. */
export interface BotanyAnalysis {
  organs: PlantOrgan[];
  branching: BranchingNode[];
  canopy: CanopyAnalysis;
  rootSystem: RootSystemAnalysis;
  phenology: PhenologyTimeline;
  /** Total biomass. */
  totalBiomass: number;
  /** Species diversity 0..1. */
  diversity: number;
  /** Overall vitality 0..1. */
  vitality: number;
  /** Plant type (life form). */
  lifeForm: "tree" | "shrub" | "herb" | "vine" | "grass" | "succulent" | "epiphyte";
  /** Growth rhythm. */
  growthRhythm: "annual" | "perennial" | "biennial" | "evergreen" | "deciduous";
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Organ Classification
// ---------------------------------------------------------------------------

/** Classify a component as a plant organ based on its properties. */
function classifyOrgan(comp: MotionComponent): PlantOrgan["type"] {
  const firstKf = comp.keyframes?.[0];
  const props = (firstKf?.properties ?? {}) as Record<string, string | number>;

  // Flower: color/brightness changes (decorative, eye-catching)
  if ("color" in props || "backgroundColor" in props || "brightness" in props) return "flower";
  // Leaf: scale/translateY (foliage, vertical growth)
  if ("scale" in props || "scaleY" in props) return "leaf";
  // Stem: translateY (vertical growth)
  if ("translateY" in props) return "stem";
  // Root: translateY negative (downward growth)
  if ("translateY" in props) {
    const v = (firstKf?.properties as Record<string, string | number>).translateY;
    if (typeof v === "number" && v < 0) return "root";
  }
  // Tendril: rotate (twining growth)
  if ("rotate" in props) return "tendril";
  // Fruit: scale + opacity (swelling and ripening)
  if ("opacity" in props) return "fruit";
  // Seed: small duration, initial component
  if (comp.durationMs < 300) return "seed";
  // Branch: longer duration with multiple keyframes
  if ((comp.keyframes?.length ?? 0) >= 4) return "branch";
  // Bark: very long duration (protective)
  if (comp.durationMs > 3000) return "bark";
  return "leaf";
}

/** Determine growth stage from delay time. */
function classifyGrowthStage(comp: MotionComponent, timelineEnd: number): GrowthStage {
  const position = timelineEnd > 0 ? comp.delayMs / timelineEnd : 0;
  if (position < 0.1) return "germination";
  if (position < 0.25) return "seedling";
  if (position < 0.5) return "vegetative";
  if (position < 0.75) return "flowering";
  if (position < 0.9) return "fruiting";
  return "senescence";
}

/** Determine phototropism from motion vectors. */
function classifyPhototropism(comp: MotionComponent): PlantOrgan["phototropism"] {
  for (const kf of comp.keyframes ?? []) {
    const props = kf.properties as Record<string, string | number>;
    if ("translateY" in props && typeof props.translateY === "number") {
      if (props.translateY < 0) return "up";
      if (props.translateY > 0) return "down";
    }
    if ("translateX" in props && typeof props.translateX === "number") {
      if (props.translateX > 0) return "right";
      if (props.translateX < 0) return "left";
    }
  }
  // Check easing for outward/inward bias
  const easingName =
    typeof comp.easing === "object" && comp.easing !== null && "name" in comp.easing
      ? String((comp.easing as { name?: unknown }).name ?? "ease")
      : "ease";
  if (easingName.includes("bounce") || easingName.includes("elastic")) return "outward";
  if (easingName.includes("smooth")) return "inward";
  return "up";
}

// ---------------------------------------------------------------------------
// Organ Extraction
// ---------------------------------------------------------------------------

/** Extract organs from components. */
function extractOrgans(spec: MotionSpec): PlantOrgan[] {
  if (spec.components.length === 0) return [];

  const timelineEnd = Math.max(
    ...spec.components.map((c) => c.delayMs + c.durationMs),
    1,
  );

  return spec.components.map((comp, index) => {
    const type = classifyOrgan(comp);
    const growthStage = classifyGrowthStage(comp, timelineEnd);
    const phototropism = classifyPhototropism(comp);

    // Branching order: based on component index (earlier = lower order)
    const branchingOrder = Math.min(5, Math.floor(index / 2));

    // Biomass: longer duration and more keyframes = more biomass
    const kfCount = comp.keyframes?.length ?? 0;
    const biomass = Math.min(1, (comp.durationMs / 3000) * 0.6 + (kfCount / 8) * 0.4);

    // Vitality: shorter duration and more energetic easing = higher vitality
    const easingName =
      typeof comp.easing === "object" && comp.easing !== null && "name" in comp.easing
        ? String((comp.easing as { name?: unknown }).name ?? "ease")
        : "ease";
    const vitality = Math.min(
      1,
      (comp.durationMs < 500 ? 0.8 : 0.4) +
        (easingName.includes("bounce") || easingName.includes("elastic") ? 0.2 : 0),
    );

    return {
      componentId: comp.id,
      componentName: comp.name,
      type,
      growthStage,
      branchingOrder,
      phototropism,
      biomass,
      vitality,
      description: `${type} at ${growthStage} stage, order ${branchingOrder}, ${phototropism} growth, biomass ${(biomass * 100).toFixed(0)}%`,
    };
  });
}

// ---------------------------------------------------------------------------
// Branching Detection
// ---------------------------------------------------------------------------

/** Detect branching structure from component timing. */
function detectBranching(spec: MotionSpec, organs: PlantOrgan[]): BranchingNode[] {
  const nodes: BranchingNode[] = [];

  for (let i = 0; i < spec.components.length; i++) {
    const parent = spec.components[i];
    const parentEnd = parent.delayMs + parent.durationMs;
    const children: string[] = [];

    for (let j = 0; j < spec.components.length; j++) {
      if (i === j) continue;
      const child = spec.components[j];
      // A child starts when the parent is still active or just ending
      if (child.delayMs >= parent.delayMs && child.delayMs <= parentEnd + 100) {
        children.push(child.id);
      }
    }

    if (children.length > 0) {
      const organ = organs[i];
      const angle = organ.branchingOrder * 30; // Each order branches at 30° more
      nodes.push({
        componentId: parent.id,
        children,
        angle,
        order: organ.branchingOrder,
        description: `Order ${organ.branchingOrder} branch with ${children.length} child(ren) at ${angle}°`,
      });
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Canopy Analysis
// ---------------------------------------------------------------------------

/** Analyze the canopy (upper layer). */
function analyzeCanopy(spec: MotionSpec, organs: PlantOrgan[]): CanopyAnalysis {
  if (organs.length === 0) {
    return { shape: "irregular", density: 0, height: 0, width: 0, description: "No canopy" };
  }

  // Find organs with upward/outward phototropism (canopy organs)
  const canopyOrgans = organs.filter((o) => o.phototropism === "up" || o.phototropism === "outward");
  const canopyCount = canopyOrgans.length || organs.length;

  // Height: peak negative translateY
  let height = 0;
  let width = 0;
  for (const comp of spec.components) {
    for (const kf of comp.keyframes ?? []) {
      const props = kf.properties as Record<string, string | number>;
      if ("translateY" in props && typeof props.translateY === "number") {
        height = Math.max(height, Math.abs(props.translateY));
      }
      if ("translateX" in props && typeof props.translateX === "number") {
        width = Math.max(width, Math.abs(props.translateX));
      }
    }
  }

  const density = Math.min(1, canopyCount / 8);

  // Shape: based on height/width ratio
  let shape: CanopyAnalysis["shape"] = "irregular";
  if (height > 0 && width > 0) {
    const ratio = height / width;
    if (ratio > 2) shape = "columnar";
    else if (ratio > 1.3) shape = "conical";
    else if (ratio < 0.5) shape = "spreading";
    else if (density > 0.7) shape = "dome";
    else if (density < 0.3) shape = "umbrella";
  }

  return {
    shape,
    density,
    height,
    width,
    description: `${shape} canopy — height ${height.toFixed(0)}, width ${width.toFixed(0)}, density ${(density * 100).toFixed(0)}%`,
  };
}

// ---------------------------------------------------------------------------
// Root System Analysis
// ---------------------------------------------------------------------------

/** Analyze the root system (foundational layer). */
function analyzeRootSystem(spec: MotionSpec, organs: PlantOrgan[]): RootSystemAnalysis {
  const rootOrgans = organs.filter((o) => o.type === "root" || o.phototropism === "down");
  const rootCount = rootOrgans.length;

  if (rootCount === 0) {
    return { type: "fibrous", depth: 0, spread: 0, density: 0, description: "No root system detected" };
  }

  // Depth: peak positive translateY (downward)
  let depth = 0;
  let spread = 0;
  for (const organ of rootOrgans) {
    const comp = spec.components.find((c) => c.id === organ.componentId);
    if (!comp) continue;
    for (const kf of comp.keyframes ?? []) {
      const props = kf.properties as Record<string, string | number>;
      if ("translateY" in props && typeof props.translateY === "number") {
        depth = Math.max(depth, Math.abs(props.translateY));
      }
      if ("translateX" in props && typeof props.translateX === "number") {
        spread = Math.max(spread, Math.abs(props.translateX));
      }
    }
  }

  const density = Math.min(1, rootCount / 5);

  // Type: based on root count and depth
  let type: RootSystemAnalysis["type"] = "fibrous";
  if (rootCount === 1 && depth > 100) type = "taproot";
  else if (rootCount >= 4) type = "fibrous";
  else if (depth > 200) type = "tuberous";
  else if (spread > depth) type = "adventitious";

  return {
    type,
    depth,
    spread,
    density,
    description: `${type} root system — depth ${depth.toFixed(0)}, spread ${spread.toFixed(0)}, density ${(density * 100).toFixed(0)}%`,
  };
}

// ---------------------------------------------------------------------------
// Phenology Timeline
// ---------------------------------------------------------------------------

/** Build the phenology timeline. */
function buildPhenology(spec: MotionSpec, organs: PlantOrgan[]): PhenologyTimeline {
  if (organs.length === 0) {
    return {
      stages: [],
      currentStage: "germination",
      description: "No phenology",
    };
  }

  const timelineEnd = Math.max(
    ...spec.components.map((c) => c.delayMs + c.durationMs),
    1,
  );

  const stages: GrowthStage[] = [
    "germination",
    "seedling",
    "vegetative",
    "flowering",
    "fruiting",
    "senescence",
  ];
  const stageBoundaries = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];

  const stageData = stages.map((stage, i) => {
    const startMs = stageBoundaries[i] * timelineEnd;
    const endMs = stageBoundaries[i + 1] * timelineEnd;
    const organsInStage = organs.filter((o) => o.growthStage === stage);
    return {
      stage,
      startMs,
      endMs,
      durationMs: endMs - startMs,
      organCount: organsInStage.length,
      description: `${stage}: ${organsInStage.length} organ(s)`,
    };
  });

  // Current stage: the stage with the most organs, or the last active
  const currentStage = stages.reduce((max, stage) => {
    const count = organs.filter((o) => o.growthStage === stage).length;
    const maxCount = organs.filter((o) => o.growthStage === max).length;
    return count > maxCount ? stage : max;
  }, "germination" as GrowthStage);

  return {
    stages: stageData,
    currentStage,
    description: `Current stage: ${currentStage}, ${stages.length} stages over ${timelineEnd.toFixed(0)}ms`,
  };
}

// ---------------------------------------------------------------------------
// System Metrics
// ---------------------------------------------------------------------------

/** Compute total biomass. */
function computeTotalBiomass(organs: PlantOrgan[]): number {
  return organs.reduce((sum, o) => sum + o.biomass, 0);
}

/** Compute species diversity (organ type variety). */
function computeDiversity(organs: PlantOrgan[]): number {
  if (organs.length === 0) return 0;
  const types = new Set(organs.map((o) => o.type));
  return Math.min(1, types.size / 9); // 9 possible organ types
}

/** Compute overall vitality. */
function computeVitality(organs: PlantOrgan[]): number {
  if (organs.length === 0) return 0;
  return organs.reduce((sum, o) => sum + o.vitality, 0) / organs.length;
}

/** Determine life form from organ distribution. */
function determineLifeForm(organs: PlantOrgan[], canopy: CanopyAnalysis): BotanyAnalysis["lifeForm"] {
  if (organs.length === 0) return "herb";

  const stemCount = organs.filter((o) => o.type === "stem").length;
  const flowerCount = organs.filter((o) => o.type === "flower").length;
  const leafCount = organs.filter((o) => o.type === "leaf").length;
  const tendrilCount = organs.filter((o) => o.type === "tendril").length;

  if (tendrilCount > 0 && tendrilCount >= stemCount * 0.5) return "vine";
  if (canopy.height > 200 && stemCount > 0) return "tree";
  if (canopy.shape === "spreading" && leafCount > 3) return "shrub";
  if (flowerCount > 2) return "herb";
  if (organs.length <= 2) return "grass";
  if (canopy.shape === "columnar") return "succulent";
  return "herb";
}

/** Determine growth rhythm from phenology. */
function determineGrowthRhythm(spec: MotionSpec, organs: PlantOrgan[]): BotanyAnalysis["growthRhythm"] {
  if (organs.length === 0) return "annual";

  const senescenceOrgans = organs.filter((o) => o.growthStage === "senescence");
  const floweringOrgans = organs.filter((o) => o.growthStage === "flowering");

  if (senescenceOrgans.length > 0 && senescenceOrgans.length >= organs.length * 0.2) return "deciduous";
  if (floweringOrgans.length > 0) return "perennial";
  if (spec.components.length > 6) return "evergreen";
  return "annual";
}

// ---------------------------------------------------------------------------
// Main Analysis
// ---------------------------------------------------------------------------

/** Analyze the botany of a motion composition. */
export function analyzeBotany(spec: MotionSpec): BotanyAnalysis {
  if (spec.components.length === 0) {
    return {
      organs: [],
      branching: [],
      canopy: { shape: "irregular", density: 0, height: 0, width: 0, description: "No canopy" },
      rootSystem: { type: "fibrous", depth: 0, spread: 0, density: 0, description: "No root system" },
      phenology: { stages: [], currentStage: "germination", description: "No phenology" },
      totalBiomass: 0,
      diversity: 0,
      vitality: 0,
      lifeForm: "herb",
      growthRhythm: "annual",
      summary: "No components — the garden is empty.",
    };
  }

  const organs = extractOrgans(spec);
  const branching = detectBranching(spec, organs);
  const canopy = analyzeCanopy(spec, organs);
  const rootSystem = analyzeRootSystem(spec, organs);
  const phenology = buildPhenology(spec, organs);

  const totalBiomass = computeTotalBiomass(organs);
  const diversity = computeDiversity(organs);
  const vitality = computeVitality(organs);
  const lifeForm = determineLifeForm(organs, canopy);
  const growthRhythm = determineGrowthRhythm(spec, organs);

  const summary =
    `Botany: ${lifeForm} (${growthRhythm}), ${organs.length} organ(s), ` +
    `${branching.length} branch node(s), ${canopy.shape} canopy, ${rootSystem.type} roots, ` +
    `stage: ${phenology.currentStage}, biomass ${totalBiomass.toFixed(2)}, ` +
    `diversity ${(diversity * 100).toFixed(0)}%, vitality ${(vitality * 100).toFixed(0)}%`;

  return {
    organs,
    branching,
    canopy,
    rootSystem,
    phenology,
    totalBiomass,
    diversity,
    vitality,
    lifeForm,
    growthRhythm,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a botany analysis as a human-readable report. */
export function formatBotanyReport(analysis: BotanyAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Botany Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  // Plant Profile
  lines.push("## Plant Profile");
  lines.push(`- Life form: ${analysis.lifeForm}`);
  lines.push(`- Growth rhythm: ${analysis.growthRhythm}`);
  lines.push(`- Current stage: ${analysis.phenology.currentStage}`);
  lines.push(`- Total biomass: ${analysis.totalBiomass.toFixed(2)}`);
  lines.push(`- Diversity: ${(analysis.diversity * 100).toFixed(0)}%`);
  lines.push(`- Vitality: ${(analysis.vitality * 100).toFixed(0)}%`);
  lines.push("");

  // Organs
  lines.push("## Organs");
  if (analysis.organs.length === 0) {
    lines.push("- No organs detected");
  } else {
    for (const o of analysis.organs) {
      lines.push(`- [${o.type}] ${o.componentName ?? o.componentId} — ${o.growthStage}, order ${o.branchingOrder}, ${o.phototropism}, biomass ${(o.biomass * 100).toFixed(0)}%`);
    }
  }
  lines.push("");

  // Branching
  lines.push("## Branching Structure");
  if (analysis.branching.length === 0) {
    lines.push("- No branching detected");
  } else {
    for (const b of analysis.branching) {
      lines.push(`- Order ${b.order} at ${b.angle}° — ${b.children.length} child(ren)`);
    }
  }
  lines.push("");

  // Canopy
  lines.push("## Canopy");
  lines.push(`- Shape: ${analysis.canopy.shape}`);
  lines.push(`- Density: ${(analysis.canopy.density * 100).toFixed(0)}%`);
  lines.push(`- Height: ${analysis.canopy.height.toFixed(0)}`);
  lines.push(`- Width: ${analysis.canopy.width.toFixed(0)}`);
  lines.push("");

  // Root System
  lines.push("## Root System");
  lines.push(`- Type: ${analysis.rootSystem.type}`);
  lines.push(`- Depth: ${analysis.rootSystem.depth.toFixed(0)}`);
  lines.push(`- Spread: ${analysis.rootSystem.spread.toFixed(0)}`);
  lines.push(`- Density: ${(analysis.rootSystem.density * 100).toFixed(0)}%`);
  lines.push("");

  // Phenology
  lines.push("## Phenology");
  for (const stage of analysis.phenology.stages) {
    lines.push(`- ${stage.stage}: ${stage.organCount} organ(s) (${stage.durationMs.toFixed(0)}ms)`);
  }

  return lines.join("\n");
}
