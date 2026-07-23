/**
 * Motion Choreographer — auto-choreography sequencing engine.
 *
 * This is the eighteenth original AI-native module. Where Storytelling
 * generates new narrative beats and Remix transforms component properties,
 * the Choreographer takes EXISTING components and rearranges their timing
 * (delays, durations, stagger intervals) to create a coherent multi-component
 * sequence. It analyzes the functional role of each component, determines the
 * optimal order, assigns staggered delays based on the chosen rhythm pattern,
 * and produces a choreography plan that can be applied to the project.
 *
 * Five choreography modes:
 * 1. Cascade — components appear in sequence with a steady stagger interval.
 * 2. Wave — components appear in a sinusoidal pattern, creating a rolling effect.
 * 3. Cluster — components are grouped into clusters that appear simultaneously.
 * 4. Climax — components build from subtle to dramatic, peaking at a focal point.
 * 5. Symphony — components are orchestrated into a multi-act structure with
 *    parallel groups, sequential chains, and rest periods.
 *
 * The Choreographer also produces a dependency graph showing which components
 * must complete before others can start, and a timing timeline visualization.
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionComponent, MotionSpec } from "@openmotion/shared";

/** Choreography modes. */
export type ChoreographyMode = "cascade" | "wave" | "cluster" | "climax" | "symphony";

/** A single component's choreographed timing. */
export interface ChoreographedComponent {
  componentId: string;
  componentName: string;
  /** Assigned delay in ms. */
  delayMs: number;
  /** Assigned duration in ms (may be adjusted from original). */
  durationMs: number;
  /** Which act/group this component belongs to. */
  act: number;
  /** Role in the choreography. */
  role: "lead" | "support" | "background" | "finale";
  /** Whether this component runs in parallel with others. */
  parallelGroup: number;
}

/** A dependency between components. */
export interface ComponentDependency {
  /** Component that must finish first. */
  beforeId: string;
  beforeName: string;
  /** Component that depends on the first. */
  afterId: string;
  afterName: string;
  /** Why the dependency exists. */
  reason: string;
}

/** A timing act in the choreography. */
export interface ChoreographyAct {
  index: number;
  name: string;
  /** Start time of this act in ms. */
  startMs: number;
  /** End time of this act in ms. */
  endMs: number;
  /** Component IDs in this act. */
  componentIds: string[];
  /** Description of this act's purpose. */
  description: string;
}

/** The complete choreography plan. */
export interface ChoreographyPlan {
  mode: ChoreographyMode;
  /** Total duration of the choreography in ms. */
  totalDurationMs: number;
  /** Stagger interval used. */
  staggerIntervalMs: number;
  /** Choreographed components with new timing. */
  components: ChoreographedComponent[];
  /** Acts in the choreography. */
  acts: ChoreographyAct[];
  /** Dependencies between components. */
  dependencies: ComponentDependency[];
  /** Whether the choreography includes rest periods. */
  hasRests: boolean;
  /** Peak moment description. */
  peakMoment: string;
  /** Human-readable summary. */
  summary: string;
}

/** Default stagger intervals per mode. */
const MODE_STAGGER: Record<ChoreographyMode, number> = {
  cascade: 120,
  wave: 80,
  cluster: 200,
  climax: 150,
  symphony: 100,
};

/** Act names per mode. */
const MODE_ACTS: Record<ChoreographyMode, string[]> = {
  cascade: ["Opening", "Development", "Conclusion"],
  wave: ["Trough", "Rising", "Crest", "Falling"],
  cluster: ["Cluster A", "Cluster B", "Cluster C"],
  climax: ["Setup", "Build", "Peak", "Resolution"],
  symphony: ["Overture", "Movement I", "Movement II", "Finale"],
};

/**
 * Classify a component into a choreography role.
 */
function classifyRole(component: MotionComponent): "lead" | "support" | "background" | "finale" {
  const name = component.name.toLowerCase();

  // Finale components
  if (/final|conclusion|end|climax|peak|celebrat|success/.test(name)) return "finale";

  // Background components (loops, ambient)
  if (component.iterationCount === "infinite") return "background";
  if (/ambient|background|idle|breath|float/.test(name)) return "background";

  // Lead components (hero, main, primary)
  if (/hero|main|primary|title|headline|feature/.test(name)) return "lead";

  // Everything else is support
  return "support";
}

/**
 * Detect dependencies between components.
 */
function detectDependencies(components: MotionComponent[]): ComponentDependency[] {
  const deps: ComponentDependency[] = [];

  for (let i = 0; i < components.length; i++) {
    for (let j = 0; j < components.length; j++) {
      if (i === j) continue;
      const a = components[i];
      const b = components[j];

      // "Enter" components must come before "Exit" components
      const aEnters = /enter|appear|show|reveal|fade.?in|slide.?in|load/.test(a.name.toLowerCase());
      const bExits = /exit|disappear|hide|fade.?out|slide.?out|leave|close/.test(b.name.toLowerCase());
      if (aEnters && bExits) {
        deps.push({
          beforeId: a.id,
          beforeName: a.name,
          afterId: b.id,
          afterName: b.name,
          reason: "Entrance must precede exit",
        });
      }

      // "Loading" must come before "content"
      const aLoads = /load|progress|skeleton|spinner/.test(a.name.toLowerCase());
      const bContent = /content|data|result|display/.test(b.name.toLowerCase());
      if (aLoads && bContent) {
        deps.push({
          beforeId: a.id,
          beforeName: a.name,
          afterId: b.id,
          afterName: b.name,
          reason: "Loading state must complete before content appears",
        });
      }
    }
  }

  return deps;
}

/**
 * Choreograph components in cascade mode.
 * Components appear one after another with a steady stagger.
 */
function choreographCascade(
  components: MotionComponent[],
  stagger: number,
): { timed: ChoreographedComponent[]; acts: ChoreographyAct[] } {
  const timed: ChoreographedComponent[] = components.map((c, i) => ({
    componentId: c.id,
    componentName: c.name,
    delayMs: i * stagger,
    durationMs: c.durationMs,
    act: i < components.length / 3 ? 0 : i < (components.length * 2) / 3 ? 1 : 2,
    role: classifyRole(c),
    parallelGroup: i,
  }));

  const actNames = MODE_ACTS.cascade;
  const acts: ChoreographyAct[] = [0, 1, 2].map((actIdx) => {
    const actComponents = timed.filter((t) => t.act === actIdx);
    const start = actComponents.length > 0 ? Math.min(...actComponents.map((c) => c.delayMs)) : 0;
    const end = actComponents.length > 0 ? Math.max(...actComponents.map((c) => c.delayMs + c.durationMs)) : 0;
    return {
      index: actIdx,
      name: actNames[actIdx],
      startMs: start,
      endMs: end,
      componentIds: actComponents.map((c) => c.componentId),
      description: actIdx === 0 ? "Initial components enter" : actIdx === 1 ? "Core content develops" : "Sequence concludes",
    };
  });

  return { timed, acts };
}

/**
 * Choreograph components in wave mode.
 * Components appear in a sinusoidal pattern.
 */
function choreographWave(
  components: MotionComponent[],
  stagger: number,
): { timed: ChoreographedComponent[]; acts: ChoreographyAct[] } {
  const n = components.length;
  const timed: ChoreographedComponent[] = components.map((c, i) => {
    // Sinusoidal delay: components near the middle get less delay
    const wave = Math.sin((i / n) * Math.PI);
    const delay = Math.round((i * stagger) * (1.2 - wave * 0.4));
    return {
      componentId: c.id,
      componentName: c.name,
      delayMs: delay,
      durationMs: c.durationMs,
      act: i < n / 4 ? 0 : i < n / 2 ? 1 : i < (3 * n) / 4 ? 2 : 3,
      role: classifyRole(c),
      parallelGroup: Math.floor(i / 2),
    };
  });

  const actNames = MODE_ACTS.wave;
  const acts: ChoreographyAct[] = [0, 1, 2, 3].map((actIdx) => {
    const actComponents = timed.filter((t) => t.act === actIdx);
    const start = actComponents.length > 0 ? Math.min(...actComponents.map((c) => c.delayMs)) : 0;
    const end = actComponents.length > 0 ? Math.max(...actComponents.map((c) => c.delayMs + c.durationMs)) : 0;
    return {
      index: actIdx,
      name: actNames[actIdx],
      startMs: start,
      endMs: end,
      componentIds: actComponents.map((c) => c.componentId),
      description: actIdx === 0 ? "Wave begins" : actIdx === 1 ? "Wave rises" : actIdx === 2 ? "Wave crests" : "Wave falls",
    };
  });

  return { timed, acts };
}

/**
 * Choreograph components in cluster mode.
 * Components are grouped into clusters that appear simultaneously.
 */
function choreographCluster(
  components: MotionComponent[],
  stagger: number,
): { timed: ChoreographedComponent[]; acts: ChoreographyAct[] } {
  const clusterSize = Math.max(2, Math.ceil(components.length / 3));
  const timed: ChoreographedComponent[] = components.map((c, i) => {
    const clusterIdx = Math.floor(i / clusterSize);
    const withinCluster = i % clusterSize;
    return {
      componentId: c.id,
      componentName: c.name,
      delayMs: clusterIdx * stagger * 2 + withinCluster * 20,
      durationMs: c.durationMs,
      act: clusterIdx,
      role: classifyRole(c),
      parallelGroup: clusterIdx,
    };
  });

  const actNames = MODE_ACTS.cluster;
  const numActs = Math.ceil(components.length / clusterSize);
  const acts: ChoreographyAct[] = Array.from({ length: Math.min(numActs, 3) }, (_, actIdx) => {
    const actComponents = timed.filter((t) => t.act === actIdx);
    const start = actComponents.length > 0 ? Math.min(...actComponents.map((c) => c.delayMs)) : 0;
    const end = actComponents.length > 0 ? Math.max(...actComponents.map((c) => c.delayMs + c.durationMs)) : 0;
    return {
      index: actIdx,
      name: actNames[actIdx] || `Cluster ${actIdx + 1}`,
      startMs: start,
      endMs: end,
      componentIds: actComponents.map((c) => c.componentId),
      description: `Cluster ${actIdx + 1} components appear together`,
    };
  });

  return { timed, acts };
}

/**
 * Choreograph components in climax mode.
 * Components build from subtle to dramatic, peaking at a focal point.
 */
function choreographClimax(
  components: MotionComponent[],
  stagger: number,
): { timed: ChoreographedComponent[]; acts: ChoreographyAct[] } {
  const n = components.length;
  const peakIdx = Math.floor(n * 0.7); // Peak at 70% through

  const timed: ChoreographedComponent[] = components.map((c, i) => {
    // Duration increases toward the peak, then decreases
    const intensity = 1 - Math.abs(i - peakIdx) / n;
    const adjustedDuration = Math.round(c.durationMs * (0.7 + intensity * 0.6));

    let act = 0;
    if (i < n * 0.25) act = 0; // Setup
    else if (i < n * 0.5) act = 1; // Build
    else if (i < n * 0.85) act = 2; // Peak
    else act = 3; // Resolution

    return {
      componentId: c.id,
      componentName: c.name,
      delayMs: i * stagger,
      durationMs: adjustedDuration,
      act,
      role: i === peakIdx ? "lead" : classifyRole(c),
      parallelGroup: i === peakIdx ? -1 : Math.floor(i / 3),
    };
  });

  const actNames = MODE_ACTS.climax;
  const acts: ChoreographyAct[] = [0, 1, 2, 3].map((actIdx) => {
    const actComponents = timed.filter((t) => t.act === actIdx);
    const start = actComponents.length > 0 ? Math.min(...actComponents.map((c) => c.delayMs)) : 0;
    const end = actComponents.length > 0 ? Math.max(...actComponents.map((c) => c.delayMs + c.durationMs)) : 0;
    return {
      index: actIdx,
      name: actNames[actIdx],
      startMs: start,
      endMs: end,
      componentIds: actComponents.map((c) => c.componentId),
      description: actIdx === 0 ? "Subtle setup" : actIdx === 1 ? "Energy builds" : actIdx === 2 ? "Climax peaks" : "Resolution and calm",
    };
  });

  return { timed, acts };
}

/**
 * Choreograph components in symphony mode.
 * Multi-act structure with parallel groups, sequential chains, and rests.
 */
function choreographSymphony(
  components: MotionComponent[],
  stagger: number,
): { timed: ChoreographedComponent[]; acts: ChoreographyAct[] } {
  const n = components.length;
  const actSize = Math.ceil(n / 4);

  const timed: ChoreographedComponent[] = components.map((c, i) => {
    const act = Math.min(3, Math.floor(i / actSize));
    const withinAct = i % actSize;

    // Add a rest period between acts
    const actStartDelay = act * stagger * actSize * 1.5;
    const withinActDelay = withinAct * stagger;

    return {
      componentId: c.id,
      componentName: c.name,
      delayMs: Math.round(actStartDelay + withinActDelay),
      durationMs: c.durationMs,
      act,
      role: i === 0 ? "lead" : i === n - 1 ? "finale" : classifyRole(c),
      parallelGroup: withinAct < actSize / 2 ? act * 2 : act * 2 + 1,
    };
  });

  const actNames = MODE_ACTS.symphony;
  const acts: ChoreographyAct[] = [0, 1, 2, 3].map((actIdx) => {
    const actComponents = timed.filter((t) => t.act === actIdx);
    const start = actComponents.length > 0 ? Math.min(...actComponents.map((c) => c.delayMs)) : 0;
    const end = actComponents.length > 0 ? Math.max(...actComponents.map((c) => c.delayMs + c.durationMs)) : 0;
    return {
      index: actIdx,
      name: actNames[actIdx],
      startMs: start,
      endMs: end,
      componentIds: actComponents.map((c) => c.componentId),
      description: actIdx === 0 ? "Overture sets the tone" : actIdx === 1 ? "First movement develops the theme" : actIdx === 2 ? "Second movement adds complexity" : "Finale brings everything together",
    };
  });

  return { timed, acts };
}

/**
 * Generate the choreography plan.
 */
export function choreographMotion(
  spec: MotionSpec,
  mode: ChoreographyMode = "cascade",
): ChoreographyPlan {
  const components = spec.components;
  if (components.length === 0) {
    return {
      mode,
      totalDurationMs: 0,
      staggerIntervalMs: MODE_STAGGER[mode],
      components: [],
      acts: [],
      dependencies: [],
      hasRests: mode === "symphony",
      peakMoment: "No components to choreograph.",
      summary: "Empty project — no components to choreograph.",
    };
  }

  const stagger = MODE_STAGGER[mode];
  let result: { timed: ChoreographedComponent[]; acts: ChoreographyAct[] };

  switch (mode) {
    case "wave": result = choreographWave(components, stagger); break;
    case "cluster": result = choreographCluster(components, stagger); break;
    case "climax": result = choreographClimax(components, stagger); break;
    case "symphony": result = choreographSymphony(components, stagger); break;
    default: result = choreographCascade(components, stagger); break;
  }

  const dependencies = detectDependencies(components);
  const totalDurationMs = Math.max(...result.timed.map((t) => t.delayMs + t.durationMs));
  const hasRests = mode === "symphony" || mode === "climax";

  // Find peak moment
  const leadComponent = result.timed.find((t) => t.role === "lead");
  const peakTime = leadComponent ? leadComponent.delayMs + leadComponent.durationMs / 2 : totalDurationMs / 2;
  const peakMoment = leadComponent
    ? `Peak at ${Math.round(peakTime)}ms — "${leadComponent.componentName}" takes center stage.`
    : `Peak at ${Math.round(peakTime)}ms — maximum visual density.`;

  const summary = `Mode: ${mode}. ${components.length} components in ${result.acts.length} act(s). Total duration: ${totalDurationMs}ms. Stagger: ${stagger}ms. ${dependencies.length} dependency/dependencies. ${hasRests ? "Includes rest periods." : "No rest periods."} ${peakMoment}`;

  return {
    mode,
    totalDurationMs,
    staggerIntervalMs: stagger,
    components: result.timed,
    acts: result.acts,
    dependencies,
    hasRests,
    peakMoment,
    summary,
  };
}

/**
 * List all choreography modes.
 */
export function listChoreographyModes(): Array<{ mode: ChoreographyMode; name: string; description: string }> {
  return [
    { mode: "cascade", name: "Cascade", description: "Sequential appearance with steady stagger — reliable and clear." },
    { mode: "wave", name: "Wave", description: "Sinusoidal timing creating a rolling, organic feel." },
    { mode: "cluster", name: "Cluster", description: "Grouped appearance — components arrive in simultaneous bursts." },
    { mode: "climax", name: "Climax", description: "Building intensity from subtle to dramatic, peaking at 70%." },
    { mode: "symphony", name: "Symphony", description: "Multi-act orchestration with parallel groups, chains, and rests." },
  ];
}

/**
 * Format the choreography plan as a human-readable string.
 */
export function formatChoreographyReport(plan: ChoreographyPlan): string {
  const lines: string[] = [];
  lines.push(`# Motion Choreographer Report`);
  lines.push("");
  lines.push(`**Mode: ${plan.mode}** | Duration: ${plan.totalDurationMs}ms | Stagger: ${plan.staggerIntervalMs}ms`);
  lines.push(plan.summary);
  lines.push("");

  if (plan.acts.length > 0) {
    lines.push(`## Acts`);
    for (const act of plan.acts) {
      lines.push(`- **${act.name}** (${act.startMs}ms–${act.endMs}ms): ${act.description}`);
      lines.push(`  Components: ${act.componentIds.length}`);
    }
    lines.push("");
  }

  lines.push(`## Component Timing`);
  for (const c of plan.components) {
    lines.push(`- ${c.componentName}: delay ${c.delayMs}ms, duration ${c.durationMs}ms, act ${c.act}, role ${c.role}`);
  }
  lines.push("");

  if (plan.dependencies.length > 0) {
    lines.push(`## Dependencies`);
    for (const d of plan.dependencies) {
      lines.push(`- ${d.beforeName} → ${d.afterName}: ${d.reason}`);
    }
    lines.push("");
  }

  lines.push(`## Peak Moment`);
  lines.push(plan.peakMoment);

  return lines.join("\n");
}
