/**
 * Motion Choreography Patterns — pre-built multi-component orchestration
 * patterns that translate dance and music composition theory into motion. Each pattern
 * coordinates timing, delays, and motion properties across multiple components
 * to create cohesive group animations.
 *
 * Patterns: cascade, call-and-response, unison, counterpoint, wave,
 * canon, stagger-grid, ripple-out.
 */

import type { MotionComponent } from "@openmotion/shared";

export type ChoreographyPatternId =
  | "cascade"
  | "call_response"
  | "unison"
  | "counterpoint"
  | "wave"
  | "canon"
  | "stagger_grid"
  | "ripple_out";

export interface ChoreographyPatternInfo {
  id: ChoreographyPatternId;
  name: string;
  description: string;
  minComponents: number;
  category: "sequential" | "simultaneous" | "spatial" | "musical";
}

export const CHOREOGRAPHY_PATTERNS: ChoreographyPatternInfo[] = [
  { id: "cascade", name: "Cascade", description: "Components animate one after another with a fixed delay between each, creating a waterfall effect. Great for list entrances and staggered reveals.", minComponents: 2, category: "sequential" },
  { id: "call_response", name: "Call & Response", description: "First component performs a motion, then the second responds — like a musical call-and-response. Creates a conversational dynamic between elements.", minComponents: 2, category: "sequential" },
  { id: "unison", name: "Unison", description: "All components animate simultaneously with identical timing. Creates powerful, unified movement — use sparingly for maximum impact.", minComponents: 2, category: "simultaneous" },
  { id: "counterpoint", name: "Counterpoint", description: "Components animate in opposite directions simultaneously — one moves up while the other moves down. Creates visual tension and balance.", minComponents: 2, category: "simultaneous" },
  { id: "wave", name: "Wave", description: "Components animate with a sine-phase offset, creating a traveling wave through the group. Evokes stadium waves and fluid dynamics.", minComponents: 3, category: "spatial" },
  { id: "canon", name: "Canon (Round)", description: "Each component performs the same motion but starts at a different time, like a musical round. The motion ripples through the group with identical choreography.", minComponents: 3, category: "musical" },
  { id: "stagger_grid", name: "Stagger Grid", description: "Components in a grid layout stagger their entrance based on diagonal position, creating a diagonal sweep across the grid.", minComponents: 4, category: "spatial" },
  { id: "ripple_out", name: "Ripple Out", description: "Animation starts from the center component and ripples outward to surrounding components, creating an expanding wave effect.", minComponents: 3, category: "spatial" },
];

export interface ChoreographyResult {
  pattern: ChoreographyPatternId;
  patternName: string;
  componentCount: number;
  assignments: Array<{
    componentId: string;
    componentName: string;
    delayMs: number;
    durationMs: number;
    direction: string | null;
    role: string;
  }>;
  totalDurationMs: number;
  description: string;
}

/**
 * Apply a choreography pattern to a set of components, returning timing
 * assignments for each component.
 */
export function applyChoreography(
  components: MotionComponent[],
  patternId: ChoreographyPatternId,
  options?: { baseDelayMs?: number; baseDurationMs?: number },
): ChoreographyResult {
  const baseDelay = options?.baseDelayMs ?? 120;
  const baseDuration = options?.baseDurationMs ?? 600;
  const count = components.length;

  const patternInfo = CHOREOGRAPHY_PATTERNS.find((p) => p.id === patternId);
  const patternName = patternInfo?.name ?? patternId;
  const assignments: ChoreographyResult["assignments"] = [];

  switch (patternId) {
    case "cascade": {
      for (let i = 0; i < count; i++) {
        assignments.push({
          componentId: components[i].id,
          componentName: components[i].name,
          delayMs: i * baseDelay,
          durationMs: baseDuration,
          direction: null,
          role: i === 0 ? "leader" : `follower-${i}`,
        });
      }
      return {
        pattern: patternId,
        patternName,
        componentCount: count,
        assignments,
        totalDurationMs: (count - 1) * baseDelay + baseDuration,
        description: `Cascade: ${count} components animate with ${baseDelay}ms delay between each, creating a waterfall effect from first to last.`,
      };
    }

    case "call_response": {
      const half = Math.ceil(count / 2);
      for (let i = 0; i < count; i++) {
        const isFirstGroup = i < half;
        assignments.push({
          componentId: components[i].id,
          componentName: components[i].name,
          delayMs: isFirstGroup ? 0 : baseDuration + baseDelay,
          durationMs: baseDuration,
          direction: isFirstGroup ? "forward" : "response",
          role: isFirstGroup ? "call" : "response",
        });
      }
      return {
        pattern: patternId,
        patternName,
        componentCount: count,
        assignments,
        totalDurationMs: baseDuration * 2 + baseDelay,
        description: `Call & Response: first ${half} component(s) perform, then the remaining ${count - half} respond after a ${baseDelay}ms pause — creating a conversational dynamic.`,
      };
    }

    case "unison": {
      for (let i = 0; i < count; i++) {
        assignments.push({
          componentId: components[i].id,
          componentName: components[i].name,
          delayMs: 0,
          durationMs: baseDuration,
          direction: null,
          role: "unison",
        });
      }
      return {
        pattern: patternId,
        patternName,
        componentCount: count,
        assignments,
        totalDurationMs: baseDuration,
        description: `Unison: all ${count} components animate simultaneously with identical timing for maximum impact.`,
      };
    }

    case "counterpoint": {
      for (let i = 0; i < count; i++) {
        const isUp = i % 2 === 0;
        assignments.push({
          componentId: components[i].id,
          componentName: components[i].name,
          delayMs: 0,
          durationMs: baseDuration,
          direction: isUp ? "up" : "down",
          role: isUp ? "upper-voice" : "lower-voice",
        });
      }
      return {
        pattern: patternId,
        patternName,
        componentCount: count,
        assignments,
        totalDurationMs: baseDuration,
        description: `Counterpoint: ${count} components animate in opposite directions simultaneously — even-indexed go up, odd-indexed go down — creating visual tension and balance.`,
      };
    }

    case "wave": {
      const phaseStep = (Math.PI * 2) / count;
      for (let i = 0; i < count; i++) {
        const phase = i * phaseStep;
        const delayOffset = Math.round((1 - Math.cos(phase)) / 2 * baseDuration);
        assignments.push({
          componentId: components[i].id,
          componentName: components[i].name,
          delayMs: delayOffset,
          durationMs: baseDuration,
          direction: Math.sin(phase) > 0 ? "up" : "down",
          role: `phase-${i}`,
        });
      }
      return {
        pattern: patternId,
        patternName,
        componentCount: count,
        assignments,
        totalDurationMs: baseDuration + baseDuration / 2,
        description: `Wave: ${count} components animate with a sine-phase offset, creating a traveling wave through the group.`,
      };
    }

    case "canon": {
      const canonDelay = Math.round(baseDuration / count);
      for (let i = 0; i < count; i++) {
        assignments.push({
          componentId: components[i].id,
          componentName: components[i].name,
          delayMs: i * canonDelay,
          durationMs: baseDuration,
          direction: null,
          role: i === 0 ? "leader" : `voice-${i}`,
        });
      }
      return {
        pattern: patternId,
        patternName,
        componentCount: count,
        assignments,
        totalDurationMs: (count - 1) * canonDelay + baseDuration,
        description: `Canon: each of ${count} components performs the same motion starting ${canonDelay}ms apart, like a musical round.`,
      };
    }

    case "stagger_grid": {
      const gridCols = Math.ceil(Math.sqrt(count));
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / gridCols);
        const col = i % gridCols;
        const diagonal = row + col;
        assignments.push({
          componentId: components[i].id,
          componentName: components[i].name,
          delayMs: diagonal * baseDelay,
          durationMs: baseDuration,
          direction: "diagonal",
          role: `r${row}c${col}`,
        });
      }
      const maxDiagonal = Math.floor((count - 1) / gridCols) + ((count - 1) % gridCols);
      return {
        pattern: patternId,
        patternName,
        componentCount: count,
        assignments,
        totalDurationMs: maxDiagonal * baseDelay + baseDuration,
        description: `Stagger Grid: ${count} components in a ${gridCols}x${Math.ceil(count / gridCols)} grid stagger by diagonal position, creating a diagonal sweep.`,
      };
    }

    case "ripple_out": {
      const center = Math.floor(count / 2);
      for (let i = 0; i < count; i++) {
        const distance = Math.abs(i - center);
        assignments.push({
          componentId: components[i].id,
          componentName: components[i].name,
          delayMs: distance * baseDelay,
          durationMs: baseDuration,
          direction: i === center ? "center" : "outward",
          role: distance === 0 ? "center" : `ring-${distance}`,
        });
      }
      const maxDist = Math.max(...Array.from({ length: count }, (_, i) => Math.abs(i - center)));
      return {
        pattern: patternId,
        patternName,
        componentCount: count,
        assignments,
        totalDurationMs: maxDist * baseDelay + baseDuration,
        description: `Ripple Out: animation starts from the center component and ripples outward, creating an expanding wave across ${count} components.`,
      };
    }

    default:
      return {
        pattern: patternId,
        patternName,
        componentCount: count,
        assignments,
        totalDurationMs: 0,
        description: `Unknown choreography pattern: ${patternId}`,
      };
  }
}
