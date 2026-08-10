/** Motion Topology Engine — analyzes the topological structure of a motion composition. */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A node in the topology graph. */
export interface TopologyNode {
  componentId: string;
  startTimeMs: number;
  endTimeMs: number;
  durationMs: number;
  /** Degree = number of overlapping neighbors. */
  degree: number;
  /** Whether this node is on the boundary (start or end of timeline). */
  isBoundary: boolean;
  /** Connected component id. */
  componentGroup: number;
}

/** An edge representing temporal overlap. */
export interface TopologyEdge {
  componentAId: string;
  componentBId: number;
  overlapMs: number;
  /** Strength of connection 0..1. */
  strength: number;
}

/** A connected component cluster. */
export interface ConnectedComponent {
  id: number;
  memberIds: string[];
  startTimeMs: number;
  endTimeMs: number;
  spanMs: number;
  /** Whether this cluster is isolated (no overlap with others). */
  isIsolated: boolean;
}

/** A temporal hole (gap) in the composition. */
export interface TemporalHole {
  startMs: number;
  endMs: number;
  durationMs: number;
  /** Components before the gap. */
  beforeIds: string[];
  /** Components after the gap. */
  afterIds: string[];
  /** Severity 0..1 (longer gaps = more severe). */
  severity: number;
}

/** Topological analysis result. */
export interface TopologyAnalysis {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  connectedComponents: ConnectedComponent[];
  temporalHoles: TemporalHole[];
  /** Euler characteristic: V - E + F. */
  eulerCharacteristic: number;
  /** Estimated genus (number of handles). */
  genus: number;
  /** Overall connectivity 0..1. */
  connectivity: number;
  /** Compactness 0..1 (how densely packed the timeline is). */
  compactness: number;
  /** Topological complexity. */
  complexity: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Graph Construction
// ---------------------------------------------------------------------------

/** Check if two components temporally overlap. */
function overlaps(a: MotionComponent, b: MotionComponent): boolean {
  return a.delayMs < b.delayMs + b.durationMs && b.delayMs < a.delayMs + a.durationMs;
}

/** Compute overlap duration in milliseconds. */
function overlapDuration(a: MotionComponent, b: MotionComponent): number {
  const start = Math.max(a.delayMs, b.delayMs);
  const end = Math.min(a.delayMs + a.durationMs, b.delayMs + b.durationMs);
  return Math.max(0, end - start);
}

// ---------------------------------------------------------------------------
// Connected Components (Union-Find)
// ---------------------------------------------------------------------------

/** Union-Find data structure for connected component detection. */
class UnionFind {
  private parent: Map<string, string> = new Map();

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      return x;
    }
    if (this.parent.get(x) === x) {
      return x;
    }
    const root = this.find(this.parent.get(x)!);
    this.parent.set(x, root);
    return root;
  }

  union(x: string, y: string): void {
    const rx = this.find(x);
    const ry = this.find(y);
    if (rx !== ry) {
      this.parent.set(rx, ry);
    }
  }
}

// ---------------------------------------------------------------------------
// Main Analysis
// ---------------------------------------------------------------------------

/**
 * Analyze the topological structure of a motion composition.
 */
export function analyzeTopology(spec: MotionSpec): TopologyAnalysis {
  const components = spec.components;
  if (components.length === 0) {
    return {
      nodes: [],
      edges: [],
      connectedComponents: [],
      temporalHoles: [],
      eulerCharacteristic: 0,
      genus: 0,
      connectivity: 0,
      compactness: 0,
      complexity: 0,
      summary: "No components — empty topological space.",
    };
  }

  // Build edges (temporal overlaps)
  const edges: TopologyEdge[] = [];
  const uf = new UnionFind();
  const degreeMap = new Map<string, number>();

  for (let i = 0; i < components.length; i++) {
    degreeMap.set(components[i].id, 0);
    for (let j = i + 1; j < components.length; j++) {
      if (overlaps(components[i], components[j])) {
        const overlap = overlapDuration(components[i], components[j]);
        const minDuration = Math.min(components[i].durationMs, components[j].durationMs);
        const strength = minDuration > 0 ? overlap / minDuration : 0;
        edges.push({
          componentAId: components[i].id,
          componentBId: j,
          overlapMs: overlap,
          strength,
        });
        uf.union(components[i].id, components[j].id);
        degreeMap.set(components[i].id, (degreeMap.get(components[i].id) ?? 0) + 1);
        degreeMap.set(components[j].id, (degreeMap.get(components[j].id) ?? 0) + 1);
      }
    }
  }

  // Find connected components
  const groupMap = new Map<string, string[]>();
  for (const comp of components) {
    const root = uf.find(comp.id);
    if (!groupMap.has(root)) {
      groupMap.set(root, []);
    }
    groupMap.get(root)!.push(comp.id);
  }

  const timelineStart = Math.min(...components.map((c) => c.delayMs));
  const timelineEnd = Math.max(...components.map((c) => c.delayMs + c.durationMs));

  const connectedComponents: ConnectedComponent[] = Array.from(groupMap.entries()).map(
    ([root, memberIds], idx) => {
      const members = components.filter((c) => memberIds.includes(c.id));
      const start = Math.min(...members.map((m) => m.delayMs));
      const end = Math.max(...members.map((m) => m.delayMs + m.durationMs));
      return {
        id: idx,
        memberIds,
        startTimeMs: start,
        endTimeMs: end,
        spanMs: end - start,
        isIsolated: memberIds.length === 1,
      };
    },
  );

  // Detect temporal holes (gaps between connected components)
  const temporalHoles: TemporalHole[] = [];
  const sortedClusters = [...connectedComponents].sort((a, b) => a.startTimeMs - b.startTimeMs);
  for (let i = 1; i < sortedClusters.length; i++) {
    const gapStart = sortedClusters[i - 1].endTimeMs;
    const gapEnd = sortedClusters[i].startTimeMs;
    if (gapEnd > gapStart) {
      const gapDuration = gapEnd - gapStart;
      const severity = Math.min(1, gapDuration / 2000);
      temporalHoles.push({
        startMs: gapStart,
        endMs: gapEnd,
        durationMs: gapDuration,
        beforeIds: sortedClusters[i - 1].memberIds,
        afterIds: sortedClusters[i].memberIds,
        severity,
      });
    }
  }

  // Build nodes
  const nodes: TopologyNode[] = components.map((c) => ({
    componentId: c.id,
    startTimeMs: c.delayMs,
    endTimeMs: c.delayMs + c.durationMs,
    durationMs: c.durationMs,
    degree: degreeMap.get(c.id) ?? 0,
    isBoundary: c.delayMs === timelineStart || c.delayMs + c.durationMs === timelineEnd,
    componentGroup: connectedComponents.findIndex((cc) => cc.memberIds.includes(c.id)),
  }));

  // Euler characteristic: V - E + F
  // V = vertices (components), E = edges (overlaps), F = faces (triangles of mutual overlap)
  const V = components.length;
  const E = edges.length;
  let F = 0;
  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      for (let k = j + 1; k < components.length; k++) {
        if (overlaps(components[i], components[j]) &&
            overlaps(components[j], components[k]) &&
            overlaps(components[i], components[k])) {
          F++;
        }
      }
    }
  }
  const eulerCharacteristic = V - E + F;

  // Genus: for a connected graph, genus = 1 - (Euler / 2) when Euler is even
  // Simplified: genus = max(0, (E - V + 1) / 2) for connected graphs
  const genus = connectedComponents.length > 0
    ? Math.max(0, Math.floor((E - V + connectedComponents.length) / 2))
    : 0;

  // Connectivity: ratio of actual edges to possible edges
  const maxPossibleEdges = (V * (V - 1)) / 2;
  const connectivity = maxPossibleEdges > 0 ? E / maxPossibleEdges : 0;

  // Compactness: ratio of filled time to total timeline
  const totalTimeline = timelineEnd - timelineStart;
  const filledTime = components.reduce((sum, c) => sum + c.durationMs, 0);
  const compactness = totalTimeline > 0 ? Math.min(1, filledTime / totalTimeline) : 0;

  // Complexity: combination of connectivity, genus, and hole count
  const complexity = Math.min(
    1,
    connectivity * 0.4 + (genus / 5) * 0.3 + (temporalHoles.length / 5) * 0.3,
  );

  const summary = `Topology: ${V} vertices, ${E} edges, ${F} faces, ` +
    `${connectedComponents.length} connected component(s), ${temporalHoles.length} hole(s), ` +
    `Euler=${eulerCharacteristic}, genus=${genus}, ` +
    `connectivity=${(connectivity * 100).toFixed(0)}%, compactness=${(compactness * 100).toFixed(0)}%`;

  return {
    nodes,
    edges,
    connectedComponents,
    temporalHoles,
    eulerCharacteristic,
    genus,
    connectivity,
    compactness,
    complexity,
    summary,
  };
}

/**
 * Find the shortest temporal path between two components.
 */
export function findTemporalPath(spec: MotionSpec, fromId: string, toId: string): {
  path: string[];
  totalOverlapMs: number;
} | null {
  const components = spec.components;
  const from = components.find((c) => c.id === fromId);
  const to = components.find((c) => c.id === toId);
  if (!from || !to) return null;

  // BFS through overlapping components
  const visited = new Set<string>([fromId]);
  const queue: Array<{ id: string; path: string[]; overlap: number }> = [
    { id: fromId, path: [fromId], overlap: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.id === toId) {
      return { path: current.path, totalOverlapMs: current.overlap };
    }
    const currentComp = components.find((c) => c.id === current.id);
    if (!currentComp) continue;
    for (const next of components) {
      if (visited.has(next.id)) continue;
      if (overlaps(currentComp, next)) {
        visited.add(next.id);
        queue.push({
          id: next.id,
          path: [...current.path, next.id],
          overlap: current.overlap + overlapDuration(currentComp, next),
        });
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a topology analysis as a human-readable report. */
export function formatTopologyReport(analysis: TopologyAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Topology Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  lines.push("## Connected Components");
  for (const cc of analysis.connectedComponents) {
    lines.push(
      `- Component ${cc.id}: ${cc.memberIds.length} member(s), span ${cc.spanMs}ms` +
      (cc.isIsolated ? " (isolated)" : ""),
    );
  }
  lines.push("");

  if (analysis.temporalHoles.length > 0) {
    lines.push("## Temporal Holes");
    for (const hole of analysis.temporalHoles) {
      lines.push(
        `- Gap ${hole.startMs}-${hole.endMs}ms (${hole.durationMs}ms, severity ${(hole.severity * 100).toFixed(0)}%)`,
      );
    }
    lines.push("");
  }

  lines.push("## Topological Invariants");
  lines.push(`- Euler characteristic: ${analysis.eulerCharacteristic}`);
  lines.push(`- Genus: ${analysis.genus}`);
  lines.push(`- Connectivity: ${(analysis.connectivity * 100).toFixed(0)}%`);
  lines.push(`- Compactness: ${(analysis.compactness * 100).toFixed(0)}%`);
  lines.push(`- Complexity: ${(analysis.complexity * 100).toFixed(0)}%`);

  return lines.join("\n");
}
