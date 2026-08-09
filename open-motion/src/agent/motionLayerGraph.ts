import type { MotionSpec, MotionComponent } from "@openmotion/shared";

/** Layer-Graph Engine — hierarchical layer model analysis. */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A node in the layer tree. */
export interface LayerNode {
  /** Component id. */
  componentId: string;
  /** Display label. */
  label: string;
  /** Parent component id (null = root). */
  parentId: string | null;
  /** Depth in the tree (root = 0). */
  depth: number;
  /** Number of direct children. */
  childCount: number;
  /** Number of descendants (recursive). */
  descendantCount: number;
  /** Whether this node masks its children (overflow/clip/mask). */
  masksChildren: boolean;
  /** Mask reason (which style property triggered it). */
  maskReason: string | null;
  /** Whether this node's transform chain is broken. */
  brokenChain: boolean;
  /** Whether this node is an orphan (parent missing). */
  orphan: boolean;
}

/** A parent→child edge in the layer tree. */
export interface LayerEdge {
  /** Parent component id. */
  parent: string;
  /** Child component id. */
  child: string;
  /** Whether the parent masks the child. */
  masked: boolean;
}

/** A defect found in the layer graph. */
export interface LayerGraphIssue {
  /** "orphan" | "deep_nesting" | "broken_chain" | "wide_fanout" | "mask_without_transform". */
  kind: "orphan" | "deep_nesting" | "broken_chain" | "wide_fanout" | "mask_without_transform";
  /** Component id or "tree". */
  subject: string;
  /** Human-readable description. */
  detail: string;
  /** Severity 0..1. */
  severity: number;
}

/** The full layer-graph report. */
export interface LayerGraphReport {
  /** All layer nodes. */
  nodes: LayerNode[];
  /** All parent→child edges. */
  edges: LayerEdge[];
  /** Defects found. */
  issues: LayerGraphIssue[];
  /** Number of root nodes (parentId === null). */
  rootCount: number;
  /** Maximum tree depth. */
  maxDepth: number;
  /** Average tree depth. */
  avgDepth: number;
  /** Number of mask relationships. */
  maskCount: number;
  /** Number of orphan components. */
  orphanCount: number;
  /** Number of broken transform chains. */
  brokenChainCount: number;
  /** Tree fanout: max children of any single parent. */
  maxFanout: number;
  /** Component count the analysis ran against. */
  componentCount: number;
  /** Human-readable summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Transform / mask detection
// ---------------------------------------------------------------------------

function hasTransform(c: MotionComponent): boolean {
  const style = c.style ?? {};
  if (Object.keys(style).some((k) => /transform|translate|rotate|scale/i.test(k))) return true;
  for (const kf of c.keyframes) {
    for (const key of Object.keys(kf.properties)) {
      if (/translate|rotate|scale/i.test(key)) return true;
    }
  }
  return false;
}

function hasAbsolutePosition(c: MotionComponent): boolean {
  const style = c.style ?? {};
  if (typeof style.position === "string" && style.position === "absolute") return true;
  if (typeof style.position === "string" && style.position === "fixed") return true;
  return false;
}

function maskInfo(c: MotionComponent): { masks: boolean; reason: string | null } {
  const style = c.style ?? {};
  if (typeof style.overflow === "string" && (style.overflow === "hidden" || style.overflow === "clip")) {
    return { masks: true, reason: `overflow: ${style.overflow}` };
  }
  if (typeof style.clipPath === "string" && style.clipPath.length > 0) {
    return { masks: true, reason: `clip-path: ${style.clipPath}` };
  }
  if (typeof style.maskImage === "string" && style.maskImage.length > 0) {
    return { masks: true, reason: `mask-image set` };
  }
  if (typeof style.webkitMaskImage === "string" && style.webkitMaskImage.length > 0) {
    return { masks: true, reason: `-webkit-mask-image set` };
  }
  return { masks: false, reason: null };
}

// ---------------------------------------------------------------------------
// Tree construction
// ---------------------------------------------------------------------------

interface BuiltNode {
  component: MotionComponent;
  depth: number;
  children: string[];
  descendantCount: number;
  orphan: boolean;
}

function buildTree(components: MotionComponent[]): {
  nodes: Map<string, BuiltNode>;
  roots: string[];
  orphans: string[];
} {
  const byId = new Map<string, MotionComponent>();
  for (const c of components) byId.set(c.id, c);

  const childrenMap = new Map<string, string[]>();
  const roots: string[] = [];
  const orphans: string[] = [];

  for (const c of components) {
    const pid = c.parentId;
    if (pid === null) {
      roots.push(c.id);
    } else if (byId.has(pid)) {
      const arr = childrenMap.get(pid) ?? [];
      arr.push(c.id);
      childrenMap.set(pid, arr);
    } else {
      // parentId set but parent does not exist — treat as orphan.
      orphans.push(c.id);
    }
  }

  // Compute depth + descendant count via memoized DFS.
  const nodes = new Map<string, BuiltNode>();
  const depthMemo = new Map<string, number>();
  const descMemo = new Map<string, number>();

  function depthOf(id: string, seen: Set<string>): number {
    if (depthMemo.has(id)) return depthMemo.get(id)!;
    if (seen.has(id)) return 0; // cycle guard
    seen.add(id);
    const c = byId.get(id)!;
    if (c.parentId === null || !byId.has(c.parentId)) return 0;
    const d = 1 + depthOf(c.parentId, seen);
    depthMemo.set(id, d);
    return d;
  }

  function descendantsOf(id: string, seen: Set<string>): number {
    if (descMemo.has(id)) return descMemo.get(id)!;
    if (seen.has(id)) return 0; // cycle guard
    seen.add(id);
    const kids = childrenMap.get(id) ?? [];
    let total = kids.length;
    for (const k of kids) total += descendantsOf(k, seen);
    descMemo.set(id, total);
    return total;
  }

  for (const c of components) {
    const d = depthOf(c.id, new Set());
    const desc = descendantsOf(c.id, new Set());
    nodes.set(c.id, {
      component: c,
      depth: d,
      children: childrenMap.get(c.id) ?? [],
      descendantCount: desc,
      orphan: c.parentId !== null && !byId.has(c.parentId),
    });
  }

  return { nodes, roots, orphans };
}

// ---------------------------------------------------------------------------
// Issue detection
// ---------------------------------------------------------------------------

function detectIssues(
  nodes: Map<string, BuiltNode>,
  layerNodes: LayerNode[],
): LayerGraphIssue[] {
  const issues: LayerGraphIssue[] = [];

  // Orphans.
  for (const n of layerNodes) {
    if (n.orphan) {
      issues.push({
        kind: "orphan",
        subject: n.label,
        detail: `"${n.label}" references parent "${nodes.get(n.componentId)?.component.parentId}" which does not exist — the layer is dangling.`,
        severity: 0.7,
      });
    }
  }

  // Deep nesting — beyond 5 levels the transform compounding becomes
  // hard to reason about and tiny parent shifts produce large child
  // displacements.
  for (const n of layerNodes) {
    if (n.depth >= 5) {
      issues.push({
        kind: "deep_nesting",
        subject: n.label,
        detail: `"${n.label}" is nested ${n.depth} levels deep — transform compounding will be hard to control.`,
        severity: Math.min(1, 0.4 + (n.depth - 5) * 0.12),
      });
    }
  }

  // Broken chains — parent has transform, child uses absolute position.
  for (const n of layerNodes) {
    if (n.brokenChain) {
      issues.push({
        kind: "broken_chain",
        subject: n.label,
        detail: `"${n.label}" uses absolute positioning under a transformed parent — the two coordinate systems conflict.`,
        severity: 0.6,
      });
    }
  }

  // Wide fanout — a single parent with too many direct children makes
  // the composition hard to scan and stress the compositor when siblings
  // animate simultaneously.
  let maxFanout = 0;
  let fanoutParent = "";
  for (const [id, built] of nodes) {
    if (built.children.length > maxFanout) {
      maxFanout = built.children.length;
      fanoutParent = id;
    }
  }
  if (maxFanout >= 8) {
    const label = nodes.get(fanoutParent)?.component.name || fanoutParent;
    issues.push({
      kind: "wide_fanout",
      subject: label,
      detail: `"${label}" has ${maxFanout} direct children — wide fanout stresses the compositor when siblings animate together.`,
      severity: Math.min(1, 0.35 + (maxFanout - 8) * 0.05),
    });
  }

  // Mask without transform — a masking parent without its own transform
  // still clips, but if the children animate outside the mask the clip
  // is visually surprising. Flag so the author can confirm intent.
  for (const n of layerNodes) {
    if (n.masksChildren) {
      const built = nodes.get(n.componentId);
      const parentHasTransform = built ? hasTransform(built.component) : false;
      if (!parentHasTransform && built && built.children.length > 0) {
        issues.push({
          kind: "mask_without_transform",
          subject: n.label,
          detail: `"${n.label}" masks its children (${built.children.length}) but has no transform — animated children may clip unexpectedly.`,
          severity: 0.3,
        });
      }
    }
  }

  issues.sort((a, b) => b.severity - a.severity);
  return issues;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Build a layer-graph report for a project spec. */
export function analyzeLayerGraph(spec: MotionSpec): LayerGraphReport {
  const components = spec.components;
  if (components.length === 0) {
    return {
      nodes: [],
      edges: [],
      issues: [],
      rootCount: 0,
      maxDepth: 0,
      avgDepth: 0,
      maskCount: 0,
      orphanCount: 0,
      brokenChainCount: 0,
      maxFanout: 0,
      componentCount: 0,
      summary: "Empty project — no layers to analyze.",
    };
  }

  const { nodes, roots, orphans } = buildTree(components);

  // Build the public node list with mask + broken-chain flags.
  const layerNodes: LayerNode[] = [];
  const edges: LayerEdge[] = [];
  let maskCount = 0;
  let brokenChainCount = 0;
  let depthSum = 0;
  let maxDepth = 0;
  let maxFanout = 0;

  for (const [id, built] of nodes) {
    const c = built.component;
    const { masks, reason } = maskInfo(c);
    if (masks) maskCount += 1;
    if (built.children.length > maxFanout) maxFanout = built.children.length;

    // Broken chain: parent has transform AND child uses absolute position.
    const parent = c.parentId ? nodes.get(c.parentId)?.component : null;
    const brokenChain = parent !== null && parent !== undefined && hasTransform(parent) && hasAbsolutePosition(c);
    if (brokenChain) brokenChainCount += 1;

    if (built.depth > maxDepth) maxDepth = built.depth;
    depthSum += built.depth;

    layerNodes.push({
      componentId: id,
      label: c.name || c.id,
      parentId: c.parentId,
      depth: built.depth,
      childCount: built.children.length,
      descendantCount: built.descendantCount,
      masksChildren: masks,
      maskReason: reason,
      brokenChain,
      orphan: built.orphan,
    });

    for (const childId of built.children) {
      edges.push({ parent: id, child: childId, masked: masks });
    }
  }

  const issues = detectIssues(nodes, layerNodes);
  const avgDepth = Math.round((depthSum / components.length) * 100) / 100;

  const summary = `${roots.length} root(s), ${components.length} layer(s), max depth ${maxDepth}, avg depth ${avgDepth}; ${maskCount} mask(s), ${orphans.length} orphan(s), ${brokenChainCount} broken chain(s); max fanout ${maxFanout}.`;

  return {
    nodes: layerNodes,
    edges,
    issues,
    rootCount: roots.length,
    maxDepth,
    avgDepth,
    maskCount,
    orphanCount: orphans.length,
    brokenChainCount,
    maxFanout,
    componentCount: components.length,
    summary,
  };
}

/** Format a layer-graph report as a human-readable string. */
export function formatLayerGraphReport(report: LayerGraphReport): string {
  const lines: string[] = [];
  lines.push("=== Motion Layer-Graph ===");
  lines.push("");
  lines.push(`Components: ${report.componentCount}`);
  lines.push(`Roots: ${report.rootCount}`);
  lines.push(`Max depth: ${report.maxDepth}`);
  lines.push(`Avg depth: ${report.avgDepth}`);
  lines.push(`Masks: ${report.maskCount}`);
  lines.push(`Orphans: ${report.orphanCount}`);
  lines.push(`Broken chains: ${report.brokenChainCount}`);
  lines.push(`Max fanout: ${report.maxFanout}`);
  lines.push("");

  if (report.nodes.length > 0) {
    lines.push("--- Layers (top 12 by depth) ---");
    const sorted = [...report.nodes].sort((a, b) => b.depth - a.depth);
    for (const n of sorted.slice(0, 12)) {
      const flag = n.orphan ? "!" : n.brokenChain ? "~" : n.masksChildren ? "#" : " ";
      const mask = n.masksChildren ? ` [mask:${n.maskReason}]` : "";
      lines.push(`[${flag}] ${"  ".repeat(n.depth)}${n.label} (depth ${n.depth}, ${n.childCount} children, ${n.descendantCount} desc)${mask}`);
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
