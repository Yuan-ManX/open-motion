import type { MotionComponent, MotionSpec } from "@openmotion/shared";

/**
 * Component composition engine — tree-based motion composition
 * with sequence, parallel, and staggered arrangements.
 *
 * Components are organized into a composition tree where each node
 * defines how its children are arranged in time. The engine calculates
 * precise start times, durations, and frame-level positions.
 */

export type CompositionType = "sequence" | "parallel" | "stagger" | "single";

export interface CompositionNode {
  id: string;
  type: CompositionType;
  componentId?: string;
  children?: CompositionNode[];
  /** Delay before this node starts (ms). */
  delayMs?: number;
  /** Duration override (ms). If omitted, computed from children. */
  durationMs?: number;
  /** Stagger step between children (ms). Only for "stagger" type. */
  stepMs?: number;
}

export interface TimelineEntry {
  componentId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  delayMs: number;
  layer: number;
}

export interface CompositionResult {
  tree: CompositionNode;
  timeline: TimelineEntry[];
  totalDurationMs: number;
  frameCount: number;
  fps: number;
}

const DEFAULT_FPS = 60;

/** Build a composition tree from a MotionSpec's components. */
export function buildCompositionTree(spec: MotionSpec): CompositionNode {
  const components = spec.components;
  if (components.length === 0) {
    return { id: "root", type: "single" };
  }

  // Group by parentId to build tree structure
  const byParent = new Map<string | null, MotionComponent[]>();
  for (const comp of components) {
    const parent = comp.parentId;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(comp);
  }

  // Sort each group by orderIndex
  for (const group of byParent.values()) {
    group.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  // Build tree recursively
  function buildNode(parentId: string | null, depth: number): CompositionNode {
    const children = byParent.get(parentId) ?? [];
    if (children.length === 0) {
      return { id: `node-${depth}`, type: "single" };
    }

    // If only one child, return as single node
    if (children.length === 1) {
      const child = children[0];
      const childNode = buildNode(child.id, depth + 1);
      return {
        id: `node-${child.id}`,
        type: "single",
        componentId: child.id,
        delayMs: child.delayMs,
        durationMs: child.durationMs,
        children: childNode.children,
      };
    }

    // Determine composition type from delays
    const hasStagger = children.every((c, i) => i === 0 || c.delayMs > 0);
    const hasSequence = children.every((c, i) => i === 0 || c.delayMs >= (children[i - 1]?.durationMs ?? 0));

    let type: CompositionType = "parallel";
    if (hasStagger && !hasSequence) type = "stagger";
    else if (hasSequence) type = "sequence";

    const childNodes = children.map((child) => {
      const childTree = buildNode(child.id, depth + 1);
      return {
        ...childTree,
        id: `node-${child.id}`,
        componentId: child.id,
        delayMs: child.delayMs,
        durationMs: child.durationMs,
      };
    });

    // Compute stagger step
    let stepMs: number | undefined;
    if (type === "stagger" && children.length > 1) {
      const delays = children.slice(1).map((c) => c.delayMs);
      stepMs = delays.length > 0 ? Math.min(...delays) : 80;
    }

    return {
      id: `node-${depth}`,
      type,
      children: childNodes,
      stepMs,
    };
  }

  return buildNode(null, 0);
}

/** Flatten a composition tree into a timeline with precise start/end times. */
export function flattenToTimeline(node: CompositionNode, fps = DEFAULT_FPS): CompositionResult {
  const timeline: TimelineEntry[] = [];
  let totalDurationMs = 0;

  function processNode(node: CompositionNode, startMs: number, layer: number): number {
    const nodeDelay = node.delayMs ?? 0;
    const nodeStart = startMs + nodeDelay;

    if (node.type === "single" || !node.children || node.children.length === 0) {
      const duration = node.durationMs ?? 800;
      if (node.componentId) {
        timeline.push({
          componentId: node.componentId,
          startMs: nodeStart,
          endMs: nodeStart + duration,
          durationMs: duration,
          delayMs: nodeDelay,
          layer,
        });
      }
      return nodeStart + duration;
    }

    if (node.type === "sequence") {
      let currentMs = nodeStart;
      for (const child of node.children) {
        const childEnd = processNode(child, currentMs, layer);
        currentMs = childEnd;
      }
      return currentMs;
    }

    if (node.type === "parallel") {
      let maxEnd = nodeStart;
      for (const child of node.children) {
        const childEnd = processNode(child, nodeStart, layer + 1);
        maxEnd = Math.max(maxEnd, childEnd);
      }
      return maxEnd;
    }

    if (node.type === "stagger") {
      const step = node.stepMs ?? 80;
      let maxEnd = nodeStart;
      for (let i = 0; i < node.children.length; i++) {
        const childStart = nodeStart + i * step;
        const childEnd = processNode(node.children[i], childStart, layer);
        maxEnd = Math.max(maxEnd, childEnd);
      }
      return maxEnd;
    }

    return nodeStart;
  }

  totalDurationMs = processNode(node, 0, 0);
  const frameCount = Math.ceil((totalDurationMs / 1000) * fps);

  return {
    tree: node,
    timeline: timeline.sort((a, b) => a.startMs - b.startMs),
    totalDurationMs,
    frameCount,
    fps,
  };
}

/** Get the component that should be visible at a specific frame. */
export function getComponentsAtFrame(
  timeline: TimelineEntry[],
  frame: number,
  fps = DEFAULT_FPS,
): TimelineEntry[] {
  const timeMs = (frame / fps) * 1000;
  return timeline.filter((entry) => timeMs >= entry.startMs && timeMs <= entry.endMs);
}

/** Generate a React component string (Remotion-style) from a composition. */
export function generateCompositionReact(
  spec: MotionSpec,
  composition: CompositionResult,
  componentName = "MotionComposition",
): string {
  const { fps, frameCount, totalDurationMs } = composition;
  const components = spec.components;

  const componentImports = new Set<string>();
  const componentRender: string[] = [];

  for (const comp of components) {
    const entry = composition.timeline.find((t) => t.componentId === comp.id);
    if (!entry) continue;

    const startFrame = Math.round((entry.startMs / 1000) * fps);
    const durationFrames = Math.round((entry.durationMs / 1000) * fps);
    componentImports.add("Sequence");

    componentRender.push(`      <Sequence from={${startFrame}} durationInFrames={${durationFrames}}>
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: '${comp.name}-${entry.componentId} ${entry.durationMs}ms ${typeof comp.easing === "string" ? comp.easing : "ease-out"} ${entry.delayMs}ms ${comp.iterationCount === "infinite" ? "infinite" : comp.iterationCount} ${comp.direction} ${comp.fillMode}',
        }}>
          ${comp.name}
        </div>
      </Sequence>`);
  }

  return `import { Composition, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';

const ${componentName}: React.FC = () => {
  return (
    <>
${componentRender.join("\n")}
    </>
  );
};

export default ${componentName};`;
}

/** Create a composition from a list of components with a specified arrangement. */
export function createComposition(
  components: MotionComponent[],
  type: CompositionType,
  options?: { stepMs?: number; gapMs?: number },
): CompositionNode {
  if (components.length === 0) {
    return { id: "root", type: "single" };
  }

  if (components.length === 1) {
    return {
      id: `node-${components[0].id}`,
      type: "single",
      componentId: components[0].id,
      delayMs: components[0].delayMs,
      durationMs: components[0].durationMs,
    };
  }

  const children = components.map((comp) => ({
    id: `node-${comp.id}`,
    type: "single" as CompositionType,
    componentId: comp.id,
    delayMs: comp.delayMs,
    durationMs: comp.durationMs,
  }));

  // Apply stagger delays
  if (type === "stagger") {
    const step = options?.stepMs ?? 80;
    for (let i = 1; i < children.length; i++) {
      children[i].delayMs = (children[i].delayMs ?? 0) + step * i;
    }
  }

  // Apply sequence gaps
  if (type === "sequence") {
    const gap = options?.gapMs ?? 0;
    let cumulativeEnd = children[0].durationMs ?? 800;
    for (let i = 1; i < children.length; i++) {
      children[i].delayMs = cumulativeEnd + gap;
      cumulativeEnd += (children[i].durationMs ?? 800) + gap;
    }
  }

  return {
    id: "root",
    type,
    children,
    stepMs: type === "stagger" ? options?.stepMs ?? 80 : undefined,
  };
}
