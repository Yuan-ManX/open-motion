/**
 * Motion Lineage — genealogy tracking for motion components.
 *
 * Records the derivation history of every component in a project, building a
 * directed acyclic graph (DAG) of parent-child relationships. Each record
 * captures the operation that produced the component (original creation,
 * variation, style transfer, story beat) along with the source component(s)
 * and operation parameters.
 *
 * Original systems:
 *
 * 1. Lineage Store
 *    In-memory DAG keyed by projectId. Each component has at most one
 *    lineage record pointing to its parent(s) and the operation that
 *    created it. The store is ephemeral (per-server-lifetime) and does
 *    not persist to the database — it captures the live evolution of a
 *    project during an editing session.
 *
 * 2. Lineage Queries
 *    - getLineage(componentId) — the direct record
 *    - getAncestors(componentId) — chain of all ancestors back to originals
 *    - getDescendants(componentId) — all components derived from this one
 *    - getLineageTree(projectId) — full tree for visualization
 *    - getOperationHistory(projectId) — chronological list of all operations
 *
 * 3. Generation Tracking
 *    Each component has a "generation" number: originals are generation 0,
 *    their direct children are generation 1, grandchildren are generation 2,
 *    etc. This enables depth-bounded queries and visualization.
 *
 * 4. Lineage Report
 *    A human-readable summary of a component's heritage, including the
 *    operation chain, generation depth, and sibling count.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LineageOperation =
  | "original"
  | "variation"
  | "style-transfer"
  | "story-beat"
  | "template"
  | "duplicate"
  | "import";

export interface LineageRecord {
  componentId: string;
  projectId: string;
  operation: LineageOperation;
  /** Parent component IDs (empty for originals). */
  parentIds: string[];
  /** Generation depth (0 = original, 1 = direct child, etc.). */
  generation: number;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** Human-readable label for the operation. */
  label: string;
  /** Operation-specific parameters (axis for variation, intent for story, etc.). */
  params: Record<string, unknown>;
  /** Component name at time of creation. */
  componentName: string;
}

export interface LineageTreeNode {
  record: LineageRecord;
  children: LineageTreeNode[];
  depth: number;
}

export interface LineageReport {
  componentId: string;
  componentName: string;
  operation: LineageOperation;
  generation: number;
  ancestorChain: LineageRecord[];
  descendantCount: number;
  siblingCount: number;
  summary: string;
}

export interface ProjectLineageSummary {
  projectId: string;
  totalComponents: number;
  totalOperations: number;
  operationBreakdown: Record<LineageOperation, number>;
  maxGeneration: number;
  averageGeneration: number;
  rootCount: number;
}

// ---------------------------------------------------------------------------
// Lineage Store
// ---------------------------------------------------------------------------

// Map: projectId -> componentId -> LineageRecord
const store = new Map<string, Map<string, LineageRecord>>();

function getProjectStore(projectId: string): Map<string, LineageRecord> {
  let projectStore = store.get(projectId);
  if (!projectStore) {
    projectStore = new Map();
    store.set(projectId, projectStore);
  }
  return projectStore;
}

// ---------------------------------------------------------------------------
// Recording operations
// ---------------------------------------------------------------------------

/**
 * Record the creation of a new component in the lineage store.
 * Call this whenever a component is created — whether original, variation,
 * style transfer result, story beat, or template instantiation.
 */
export function recordLineage(
  projectId: string,
  componentId: string,
  componentName: string,
  operation: LineageOperation,
  parentIds: string[] = [],
  params: Record<string, unknown> = {},
  label?: string,
): LineageRecord {
  const projectStore = getProjectStore(projectId);

  // Calculate generation: max(generation of parents) + 1, or 0 for originals.
  let generation = 0;
  for (const parentId of parentIds) {
    const parentRecord = projectStore.get(parentId);
    if (parentRecord && parentRecord.generation >= generation) {
      generation = parentRecord.generation + 1;
    }
  }

  const record: LineageRecord = {
    componentId,
    projectId,
    operation,
    parentIds,
    generation,
    createdAt: new Date().toISOString(),
    label: label ?? defaultLabel(operation, params),
    params,
    componentName,
  };

  projectStore.set(componentId, record);
  return record;
}

/**
 * Remove a component from the lineage store (e.g., when deleted).
 * Also removes it from any parent's child references.
 */
export function removeLineage(projectId: string, componentId: string): void {
  const projectStore = store.get(projectId);
  if (!projectStore) return;
  projectStore.delete(componentId);
}

/**
 * Clear all lineage records for a project.
 */
export function clearProjectLineage(projectId: string): void {
  store.delete(projectId);
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get the direct lineage record for a component.
 */
export function getLineage(projectId: string, componentId: string): LineageRecord | null {
  const projectStore = store.get(projectId);
  if (!projectStore) return null;
  return projectStore.get(componentId) ?? null;
}

/**
 * Get all ancestors of a component, ordered from immediate parent back to
 * the original root(s).
 */
export function getAncestors(projectId: string, componentId: string): LineageRecord[] {
  const projectStore = store.get(projectId);
  if (!projectStore) return [];

  const ancestors: LineageRecord[] = [];
  const visited = new Set<string>();
  const queue = [componentId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const record = projectStore.get(currentId);
    if (!record) continue;

    for (const parentId of record.parentIds) {
      const parent = projectStore.get(parentId);
      if (parent) {
        ancestors.push(parent);
        queue.push(parentId);
      }
    }
  }

  return ancestors;
}

/**
 * Get all descendants of a component (children, grandchildren, etc.).
 */
export function getDescendants(projectId: string, componentId: string): LineageRecord[] {
  const projectStore = store.get(projectId);
  if (!projectStore) return [];

  const descendants: LineageRecord[] = [];
  const visited = new Set<string>();

  // Scan all records and find those whose parentIds include componentId.
  const findChildren = (parentId: string): LineageRecord[] => {
    const children: LineageRecord[] = [];
    for (const record of projectStore.values()) {
      if (record.parentIds.includes(parentId)) {
        children.push(record);
      }
    }
    return children;
  };

  const queue = [componentId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const children = findChildren(currentId);
    for (const child of children) {
      descendants.push(child);
      queue.push(child.componentId);
    }
  }

  return descendants;
}

/**
 * Get the full lineage tree for a project, rooted at all original components.
 */
export function getLineageTree(projectId: string): LineageTreeNode[] {
  const projectStore = store.get(projectId);
  if (!projectStore) return [];

  // Find all roots (generation 0 or no parents in store).
  const roots: LineageRecord[] = [];
  for (const record of projectStore.values()) {
    if (record.generation === 0 || record.parentIds.length === 0) {
      roots.push(record);
    }
  }

  const buildNode = (record: LineageRecord, depth: number): LineageTreeNode => {
    const children: LineageTreeNode[] = [];
    for (const r of projectStore.values()) {
      if (r.parentIds.includes(record.componentId)) {
        children.push(buildNode(r, depth + 1));
      }
    }
    return { record, children, depth };
  };

  return roots.map((r) => buildNode(r, 0));
}

/**
 * Get the chronological operation history for a project.
 */
export function getOperationHistory(projectId: string): LineageRecord[] {
  const projectStore = store.get(projectId);
  if (!projectStore) return [];
  return Array.from(projectStore.values()).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
}

/**
 * Get siblings of a component (components sharing at least one parent).
 */
export function getSiblings(projectId: string, componentId: string): LineageRecord[] {
  const projectStore = store.get(projectId);
  if (!projectStore) return [];
  const record = projectStore.get(componentId);
  if (!record || record.parentIds.length === 0) return [];

  const siblings: LineageRecord[] = [];
  for (const r of projectStore.values()) {
    if (r.componentId === componentId) continue;
    if (r.parentIds.some((pid) => record.parentIds.includes(pid))) {
      siblings.push(r);
    }
  }
  return siblings;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable lineage report for a component.
 */
export function generateLineageReport(projectId: string, componentId: string): LineageReport | null {
  const record = getLineage(projectId, componentId);
  if (!record) return null;

  const ancestorChain = getAncestors(projectId, componentId);
  const descendants = getDescendants(projectId, componentId);
  const siblings = getSiblings(projectId, componentId);

  const chainLabels = [record, ...ancestorChain]
    .reverse()
    .map((r) => `[gen ${r.generation}] ${r.componentName} (${r.operation})`);

  const summary = [
    `Component "${record.componentName}" is generation ${record.generation}.`,
    `Created via ${record.operation} operation.`,
    ancestorChain.length > 0
      ? `Ancestry chain (${ancestorChain.length} ancestors): ${chainLabels.join(" → ")}.`
      : "No ancestors — this is an original component.",
    descendants.length > 0
      ? `Has ${descendants.length} descendant(s).`
      : "No descendants.",
    siblings.length > 0
      ? `Has ${siblings.length} sibling(s).`
      : "No siblings.",
  ].join(" ");

  return {
    componentId,
    componentName: record.componentName,
    operation: record.operation,
    generation: record.generation,
    ancestorChain,
    descendantCount: descendants.length,
    siblingCount: siblings.length,
    summary,
  };
}

/**
 * Get a summary of the lineage state for an entire project.
 */
export function getProjectLineageSummary(projectId: string): ProjectLineageSummary {
  const projectStore = store.get(projectId);
  if (!projectStore) {
    return {
      projectId,
      totalComponents: 0,
      totalOperations: 0,
      operationBreakdown: {
        original: 0, variation: 0, "style-transfer": 0, "story-beat": 0,
        template: 0, duplicate: 0, import: 0,
      },
      maxGeneration: 0,
      averageGeneration: 0,
      rootCount: 0,
    };
  }

  const records = Array.from(projectStore.values());
  const operationBreakdown: Record<LineageOperation, number> = {
    original: 0, variation: 0, "style-transfer": 0, "story-beat": 0,
    template: 0, duplicate: 0, import: 0,
  };

  let maxGeneration = 0;
  let totalGeneration = 0;
  let rootCount = 0;

  for (const r of records) {
    operationBreakdown[r.operation]++;
    if (r.generation > maxGeneration) maxGeneration = r.generation;
    totalGeneration += r.generation;
    if (r.generation === 0) rootCount++;
  }

  return {
    projectId,
    totalComponents: records.length,
    totalOperations: records.length,
    operationBreakdown,
    maxGeneration,
    averageGeneration: records.length > 0 ? totalGeneration / records.length : 0,
    rootCount,
  };
}

/**
 * Format a lineage tree as an indented text tree.
 */
export function formatLineageTree(tree: LineageTreeNode[]): string {
  const lines: string[] = ["Lineage Tree:", ""];

  const formatNode = (node: LineageTreeNode, indent: string, isLast: boolean): void => {
    const prefix = indent + (isLast ? "└─ " : "├─ ");
    const r = node.record;
    lines.push(`${prefix}[gen ${r.generation}] ${r.componentName} (${r.operation})`);

    const childIndent = indent + (isLast ? "   " : "│  ");
    for (let i = 0; i < node.children.length; i++) {
      formatNode(node.children[i], childIndent, i === node.children.length - 1);
    }
  };

  for (let i = 0; i < tree.length; i++) {
    formatNode(tree[i], "", i === tree.length - 1);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultLabel(operation: LineageOperation, params: Record<string, unknown>): string {
  switch (operation) {
    case "original":
      return "Created as original component";
    case "variation":
      return `Variation on ${String(params.axis ?? "unknown")} axis`;
    case "style-transfer":
      return "Style transferred from source";
    case "story-beat":
      return `Story beat: ${String(params.act ?? "unknown")}`;
    case "template":
      return `Instantiated from template ${String(params.templateId ?? "unknown")}`;
    case "duplicate":
      return "Duplicated from source";
    case "import":
      return "Imported from external source";
  }
}
