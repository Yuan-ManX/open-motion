import type { MotionSpec, MotionComponent, Trigger } from "@openmotion/shared";

/**
 * State-Graph Engine — models a motion spec as a finite-state machine.
 *
 * Each component carries a `trigger` (onLoad / onClick / onHover / onScroll /
 * afterDelay) that determines when its state becomes active. Treating the
 * composition as a directed graph — where trigger relationships and timing
 * order define edges between component-states — exposes structural defects a
 * flat timeline cannot reveal: unreachable states, dead-end states, missing
 * transition coverage, and orchestration complexity beyond a viewer's working
 * memory.
 *
 * Core concepts:
 * - State: a component treated as a node in the state machine. Its label is
 *   the component name; its entry trigger is the transition that activates it.
 * - Edge: a directed relationship from one state to another. Edges are
 *   derived from (a) explicit trigger chains (an `afterDelay` component
 *   whose delay matches another's end forms a temporal edge) and (b) shared
 *   trigger groups (components that activate on the same user gesture are
 *   parallel siblings, not sequential).
 * - Reachability: a state is reachable if a path exists from any entry
 *   state (onLoad / onScroll, which fire without user interaction) or from
 *   an interactive entry (onClick / onHover) that itself is reachable.
 * - Dead-end: a state with no outgoing edges when the composition still has
 *   unactivated siblings — the viewer is left with no continuation.
 *
 * Rule-based — no LLM round-trip required, so mock mode stays functional.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Entry classification for a trigger. */
export type EntryKind = "auto" | "interactive" | "deferred";

/** A single state (component node) in the state graph. */
export interface StateNode {
  /** Component id this state represents. */
  componentId: string;
  /** Display label (component name or id). */
  label: string;
  /** Trigger that activates this state. */
  trigger: Trigger;
  /** How this state enters the graph. */
  entryKind: EntryKind;
  /** Out-degree — number of outgoing edges. */
  outDegree: number;
  /** In-degree — number of incoming edges. */
  inDegree: number;
  /** Whether a path exists from any entry state to this state. */
  reachable: boolean;
  /** Whether this state has no outgoing continuation. */
  deadEnd: boolean;
}

/** A directed edge between two states. */
export interface StateEdge {
  /** Source component id. */
  from: string;
  /** Target component id. */
  to: string;
  /** Edge derivation: "temporal" (delay chains) or "sibling" (shared trigger). */
  kind: "temporal" | "sibling";
  /** Lag in milliseconds for temporal edges (target.delayMs - source end). */
  lagMs?: number;
}

/** A structural defect found in the graph. */
export interface StateGraphIssue {
  /** "unreachable" | "dead_end" | "orphan_trigger" | "complex_entry". */
  kind: "unreachable" | "dead_end" | "orphan_trigger" | "complex_entry";
  /** Component id or trigger name the issue concerns. */
  subject: string;
  /** Human-readable description. */
  detail: string;
  /** Severity 0..1 — how much the defect impedes perceived coherence. */
  severity: number;
}

/** Coverage of each trigger type across the composition. */
export interface TriggerCoverage {
  trigger: Trigger;
  count: number;
  /** Fraction of components using this trigger. */
  share: number;
}

/** The full state-graph report. */
export interface StateGraphReport {
  /** All state nodes. */
  nodes: StateNode[];
  /** All directed edges. */
  edges: StateEdge[];
  /** Defects found. */
  issues: StateGraphIssue[];
  /** Per-trigger coverage. */
  triggerCoverage: TriggerCoverage[];
  /** 0..1 — fraction of states that are reachable. */
  reachabilityRatio: number;
  /** 0..1 — graph density (edges / max possible edges). */
  density: number;
  /** Cyclomatic-style complexity: edges - nodes + connected-components. */
  complexity: number;
  /** Number of connected components in the undirected projection. */
  connectedComponents: number;
  /** Component count the analysis ran against. */
  componentCount: number;
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Trigger classification
// ---------------------------------------------------------------------------

function classifyEntry(trigger: Trigger): EntryKind {
  // onLoad and onScroll fire without explicit user intent on the component
  // itself — they are auto-entry states. onClick / onHover require a direct
  // gesture on the element. afterDelay is deferred: it activates only once
  // its delay elapses, so its reachability depends on a preceding state.
  switch (trigger) {
    case "onLoad":
    case "onScroll":
      return "auto";
    case "onClick":
    case "onHover":
      return "interactive";
    case "afterDelay":
      return "deferred";
  }
}

// ---------------------------------------------------------------------------
// Edge derivation
// ---------------------------------------------------------------------------

interface ComponentTiming {
  id: string;
  startMs: number;
  endMs: number;
  trigger: Trigger;
}

function componentTiming(c: MotionComponent): ComponentTiming {
  const startMs = c.delayMs;
  const endMs = c.delayMs + c.durationMs * (c.iterationCount === "infinite" ? 1 : (c.iterationCount as number));
  return { id: c.id, startMs, endMs, trigger: c.trigger };
}

/**
 * Derive edges. Two kinds:
 * 1. Temporal: component B starts within a small window after component A
 *    ends — the end of A naturally triggers B. Lag must be small (<=400ms)
 *    and positive (B starts after A ends) to count as a continuation.
 * 2. Sibling: components sharing an interactive trigger (onClick / onHover)
 *    on the same target element are parallel siblings — modelled as edges
 *    from the earliest-fired sibling to the others so the graph stays
 *    weakly connected without implying false ordering.
 */
function deriveEdges(components: MotionComponent[]): StateEdge[] {
  const edges: StateEdge[] = [];
  const timings = components.map(componentTiming);

  // Temporal edges.
  for (const a of timings) {
    for (const b of timings) {
      if (a.id === b.id) continue;
      const lag = b.startMs - a.endMs;
      if (lag >= 0 && lag <= 400) {
        edges.push({ from: a.id, to: b.id, kind: "temporal", lagMs: lag });
      }
    }
  }

  // Sibling edges — group by trigger, connect earliest to the rest.
  const interactiveGroups = new Map<Trigger, ComponentTiming[]>();
  for (const t of timings) {
    if (t.trigger === "onClick" || t.trigger === "onHover") {
      const arr = interactiveGroups.get(t.trigger) ?? [];
      arr.push(t);
      interactiveGroups.set(t.trigger, arr);
    }
  }
  for (const [, group] of interactiveGroups) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.startMs - b.startMs);
    const earliest = group[0];
    for (let i = 1; i < group.length; i++) {
      // Avoid duplicating a temporal edge that already exists.
      const exists = edges.some(
        (e) => e.from === earliest.id && e.to === group[i].id && e.kind === "temporal",
      );
      if (!exists) {
        edges.push({ from: earliest.id, to: group[i].id, kind: "sibling" });
      }
    }
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Reachability (BFS from auto + interactive entries)
// ---------------------------------------------------------------------------

function computeReachability(
  components: MotionComponent[],
  edges: StateEdge[],
): Map<string, boolean> {
  const reachable = new Map<string, boolean>();
  // Entry states: auto entries are always reachable (they fire on their own).
  // Interactive entries are reachable in principle — a viewer can click them.
  // Deferred entries are reachable only if an edge points to them.
  const queue: string[] = [];
  for (const c of components) {
    const kind = classifyEntry(c.trigger);
    if (kind === "auto" || kind === "interactive") {
      reachable.set(c.id, true);
      queue.push(c.id);
    } else {
      reachable.set(c.id, false);
    }
  }
  const adjacency = new Map<string, string[]>();
  for (const c of components) adjacency.set(c.id, []);
  for (const e of edges) adjacency.get(e.from)?.push(e.to);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adjacency.get(cur) ?? []) {
      if (!reachable.get(next)) {
        reachable.set(next, true);
        queue.push(next);
      }
    }
  }
  return reachable;
}

// ---------------------------------------------------------------------------
// Connected components (undirected projection)
// ---------------------------------------------------------------------------

function countConnectedComponents(components: MotionComponent[], edges: StateEdge[]): number {
  if (components.length === 0) return 0;
  const parent = new Map<string, string>();
  for (const c of components) parent.set(c.id, c.id);
  const find = (id: string): string => {
    while (parent.get(id) !== id) {
      parent.set(id, parent.get(parent.get(id)!)!);
      id = parent.get(id)!;
    }
    return id;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const e of edges) union(e.from, e.to);
  const roots = new Set<string>();
  for (const c of components) roots.add(find(c.id));
  return roots.size;
}

// ---------------------------------------------------------------------------
// Issue detection
// ---------------------------------------------------------------------------

function detectIssues(
  components: MotionComponent[],
  nodes: StateNode[],
  triggerCoverage: TriggerCoverage[],
): StateGraphIssue[] {
  const issues: StateGraphIssue[] = [];

  // Unreachable states — only meaningful for deferred (afterDelay) states
  // since auto/interactive are seeded as reachable.
  for (const n of nodes) {
    if (!n.reachable) {
      issues.push({
        kind: "unreachable",
        subject: n.label,
        detail: `"${n.label}" uses afterDelay but no temporal or sibling edge reaches it — viewers may never see it activate.`,
        severity: 0.8,
      });
    }
  }

  // Dead-end states — a state with no outgoing edges while siblings still
  // have content to show. Only flag when the composition has >1 component
  // so a single isolated element is not misreported.
  if (components.length > 1) {
    for (const n of nodes) {
      if (n.outDegree === 0 && n.entryKind !== "auto") {
        issues.push({
          kind: "dead_end",
          subject: n.label,
          detail: `"${n.label}" terminates without a continuation — the composition ends abruptly at this state.`,
          severity: 0.45,
        });
      }
    }
  }

  // Orphan trigger — a trigger type used by exactly one component when the
  // composition has 3+ components. Solo trigger types rarely pay off because
  // the viewer does not learn the gesture's meaning.
  if (components.length >= 3) {
    for (const cov of triggerCoverage) {
      if (cov.count === 1) {
        issues.push({
          kind: "orphan_trigger",
          subject: cov.trigger,
          detail: `Trigger "${cov.trigger}" is used by only one component — solo trigger types are hard for viewers to learn.`,
          severity: 0.35,
        });
      }
    }
  }

  // Complex entry — too many auto-entry states compete for the viewer's
  // attention at t=0. Flag when 4+ auto states fire simultaneously.
  const autoCount = nodes.filter((n) => n.entryKind === "auto").length;
  if (autoCount >= 4) {
    issues.push({
      kind: "complex_entry",
      subject: `${autoCount} simultaneous auto-entry states`,
      detail: `${autoCount} components fire on auto-entry at near-t=0 — the viewer cannot parse that many simultaneous activations.`,
      severity: Math.min(1, 0.4 + (autoCount - 4) * 0.15),
    });
  }

  issues.sort((a, b) => b.severity - a.severity);
  return issues;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Build a state-graph report for a project spec. */
export function analyzeStateGraph(spec: MotionSpec): StateGraphReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      nodes: [],
      edges: [],
      issues: [],
      triggerCoverage: [],
      reachabilityRatio: 1,
      density: 0,
      complexity: 0,
      connectedComponents: 0,
      componentCount: 0,
      summary: "Empty project — no states to analyze.",
    };
  }

  const edges = deriveEdges(components);
  const reachability = computeReachability(components, edges);

  // Build node-level degree counts.
  const outDeg = new Map<string, number>();
  const inDeg = new Map<string, number>();
  for (const c of components) {
    outDeg.set(c.id, 0);
    inDeg.set(c.id, 0);
  }
  for (const e of edges) {
    outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }

  const nodes: StateNode[] = components.map((c) => {
    const reachable = reachability.get(c.id) ?? false;
    const outDegree = outDeg.get(c.id) ?? 0;
    return {
      componentId: c.id,
      label: c.name || c.id,
      trigger: c.trigger,
      entryKind: classifyEntry(c.trigger),
      outDegree,
      inDegree: inDeg.get(c.id) ?? 0,
      reachable,
      deadEnd: outDegree === 0,
    };
  });

  // Trigger coverage.
  const triggerCounts = new Map<Trigger, number>();
  for (const c of components) {
    triggerCounts.set(c.trigger, (triggerCounts.get(c.trigger) ?? 0) + 1);
  }
  const triggerCoverage: TriggerCoverage[] = [];
  const allTriggers: Trigger[] = ["onLoad", "onClick", "onHover", "onScroll", "afterDelay"];
  for (const t of allTriggers) {
    const count = triggerCounts.get(t) ?? 0;
    triggerCoverage.push({
      trigger: t,
      count,
      share: components.length > 0 ? Math.round((count / components.length) * 100) / 100 : 0,
    });
  }

  const issues = detectIssues(components, nodes, triggerCoverage);

  const reachableCount = nodes.filter((n) => n.reachable).length;
  const reachabilityRatio = Math.round((reachableCount / nodes.length) * 100) / 100;
  const maxEdges = nodes.length * (nodes.length - 1);
  const density = maxEdges > 0 ? Math.round((edges.length / maxEdges) * 100) / 100 : 0;
  const connectedComponents = countConnectedComponents(components, edges);
  // Cyclomatic-style complexity for a directed graph: E - V + C.
  const complexity = edges.length - nodes.length + connectedComponents;

  const issueCount = issues.length;
  const summary = `${nodes.length} state(s), ${edges.length} edge(s), ${connectedComponents} component(s). Reachability ${reachabilityRatio}. ${issueCount} issue(s) detected.`;

  return {
    nodes,
    edges,
    issues,
    triggerCoverage,
    reachabilityRatio,
    density,
    complexity,
    connectedComponents,
    componentCount: components.length,
    summary,
  };
}

/** Format a state-graph report as a human-readable string. */
export function formatStateGraphReport(report: StateGraphReport): string {
  const lines: string[] = [];
  lines.push("=== Motion State-Graph ===");
  lines.push("");
  lines.push(`Components: ${report.componentCount}`);
  lines.push(`Reachability: ${report.reachabilityRatio}`);
  lines.push(`Density: ${report.density}`);
  lines.push(`Complexity: ${report.complexity}`);
  lines.push(`Connected components: ${report.connectedComponents}`);
  lines.push("");

  if (report.triggerCoverage.length > 0) {
    lines.push("--- Trigger Coverage ---");
    for (const cov of report.triggerCoverage) {
      lines.push(`• ${cov.trigger.padEnd(12)} ${cov.count} (${Math.round(cov.share * 100)}%)`);
    }
    lines.push("");
  }

  if (report.nodes.length > 0) {
    lines.push("--- States (top 8) ---");
    for (const n of report.nodes.slice(0, 8)) {
      const flag = n.reachable ? (n.deadEnd ? "·" : "+") : "!";
      lines.push(`[${flag}] ${n.label.padEnd(16)} trigger=${n.trigger} in=${n.inDegree} out=${n.outDegree}`);
    }
    lines.push("");
  }

  if (report.issues.length > 0) {
    lines.push("--- Issues ---");
    for (const i of report.issues) {
      lines.push(`• [${i.kind}] ${i.subject} — severity ${i.severity}`);
      lines.push(`    ${i.detail}`);
    }
    lines.push("");
  }

  lines.push(`Summary: ${report.summary}`);
  return lines.join("\n");
}
