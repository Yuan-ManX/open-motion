/**
 * Motion Flow State — tracks the creative flow and momentum of a motion design
 * session. Detects when the designer is in a "flow state" (rapid, focused
 * iteration) versus "exploration" (diverse, experimental) or "stagnation"
 * (stuck, repeating). Provides flow-based recommendations to maintain
 * creative momentum.
 */

import type { MotionSpec } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlowPhase = "warming_up" | "flow" | "exploration" | "stagnation" | "cooling_down";

export interface FlowStateSnapshot {
  phase: FlowPhase;
  momentum: number; // 0..1 — how fast changes are happening
  focusScore: number; // 0..1 — how concentrated on one area
  experimentationScore: number; // 0..1 — how diverse the actions are
  velocityActionsPerMin: number;
  totalTimeMs: number;
  phaseDurationMs: number;
  recommendations: string[];
}

export interface FlowEvent {
  timestamp: number;
  action: string;
  componentId?: string;
  category: "create" | "modify" | "delete" | "query" | "analyze" | "style" | "export";
}

// ---------------------------------------------------------------------------
// Session state — in-memory per project
// ---------------------------------------------------------------------------

interface SessionFlowState {
  events: FlowEvent[];
  startTime: number;
  lastActionTime: number;
  phase: FlowPhase;
  phaseStartTime: number;
  componentTouchCount: Map<string, number>;
  categoryCount: Map<string, number>;
}

const sessionStates = new Map<string, SessionFlowState>();

function getOrCreateState(projectId: string): SessionFlowState {
  let state = sessionStates.get(projectId);
  if (!state) {
    const now = Date.now();
    state = {
      events: [],
      startTime: now,
      lastActionTime: now,
      phase: "warming_up",
      phaseStartTime: now,
      componentTouchCount: new Map(),
      categoryCount: new Map(),
    };
    sessionStates.set(projectId, state);
  }
  return state;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Record a creative action into the flow state tracker. */
export function recordFlowEvent(
  projectId: string,
  action: string,
  category: FlowEvent["category"],
  componentId?: string,
): void {
  const state = getOrCreateState(projectId);
  const now = Date.now();
  const event: FlowEvent = { timestamp: now, action, componentId, category };
  state.events.push(event);
  state.lastActionTime = now;

  // Track component touches
  if (componentId) {
    state.componentTouchCount.set(
      componentId,
      (state.componentTouchCount.get(componentId) ?? 0) + 1,
    );
  }

  // Track category distribution
  state.categoryCount.set(category, (state.categoryCount.get(category) ?? 0) + 1);

  // Keep only last 200 events
  if (state.events.length > 200) {
    state.events = state.events.slice(-200);
  }

  // Recompute phase
  updatePhase(projectId);
}

/** Get the current flow state snapshot for a project. */
export function getFlowState(projectId: string, _spec?: MotionSpec): FlowStateSnapshot {
  const state = getOrCreateState(projectId);
  const now = Date.now();
  const recentEvents = state.events.filter((e) => now - e.timestamp < 5 * 60 * 1000); // last 5 min
  const totalTimeMs = now - state.startTime;

  // Velocity: actions per minute in recent 5-minute window
  const firstRecent = recentEvents[0]?.timestamp ?? now;
  const windowMs = Math.max(1, now - firstRecent);
  const velocityActionsPerMin = recentEvents.length > 0
    ? (recentEvents.length / Math.min(windowMs, 5 * 60 * 1000)) * 60 * 1000
    : 0;

  // Focus score: how concentrated on one component
  const componentTouches = Array.from(state.componentTouchCount.values());
  const totalTouches = componentTouches.reduce((a, b) => a + b, 0);
  const focusScore = totalTouches > 0 && componentTouches.length > 0
    ? Math.max(...componentTouches) / totalTouches
    : 0;

  // Experimentation score: diversity of categories
  const categories = Array.from(state.categoryCount.values());
  const categoryEntropy = categories.length > 0
    ? categories.reduce((sum, count) => {
        const p = count / totalTouches;
        return sum - (p > 0 ? p * Math.log2(p) : 0);
      }, 0)
    : 0;
  const maxEntropy = Math.log2(7); // 7 categories
  const experimentationScore = Math.min(1, categoryEntropy / maxEntropy);

  // Momentum: recent velocity normalized
  const momentum = Math.min(1, velocityActionsPerMin / 10); // 10 actions/min = max momentum

  // Phase duration
  const phaseDurationMs = now - state.phaseStartTime;

  // Recommendations
  const recommendations = generateRecommendations(state.phase, momentum, focusScore, experimentationScore, state.events.length);

  return {
    phase: state.phase,
    momentum,
    focusScore,
    experimentationScore,
    velocityActionsPerMin,
    totalTimeMs,
    phaseDurationMs,
    recommendations,
  };
}

/** Reset the flow state for a project (e.g., when project is cleared). */
export function resetFlowState(projectId: string): void {
  sessionStates.delete(projectId);
}

// ---------------------------------------------------------------------------
// Phase detection logic
// ---------------------------------------------------------------------------

function updatePhase(projectId: string): void {
  const state = getOrCreateState(projectId);
  const now = Date.now();
  const recentEvents = state.events.filter((e) => now - e.timestamp < 3 * 60 * 1000); // 3 min window
  const timeSinceLastAction = now - state.lastActionTime;

  let newPhase: FlowPhase;

  if (state.events.length < 3) {
    newPhase = "warming_up";
  } else if (timeSinceLastAction > 2 * 60 * 1000) {
    // No action for 2+ minutes
    newPhase = "cooling_down";
  } else if (recentEvents.length >= 8 && state.componentTouchCount.size <= 3) {
    // Fast iteration on few components
    newPhase = "flow";
  } else if (recentEvents.length >= 5 && state.componentTouchCount.size >= 5) {
    // Diverse exploration
    newPhase = "exploration";
  } else if (recentEvents.length < 2 && state.events.length > 10) {
    // Stuck — many past events but few recent
    newPhase = "stagnation";
  } else {
    newPhase = state.phase; // maintain
  }

  if (newPhase !== state.phase) {
    state.phase = newPhase;
    state.phaseStartTime = now;
  }
}

function generateRecommendations(
  phase: FlowPhase,
  momentum: number,
  focus: number,
  experimentation: number,
  totalEvents: number,
): string[] {
  const recs: string[] = [];

  switch (phase) {
    case "warming_up":
      recs.push("Start by applying a template or preset to establish a baseline motion.");
      recs.push("Try describing the mood you want — the Agent can match it to a semantic concept.");
      break;
    case "flow":
      if (focus > 0.7) {
        recs.push("You're in deep flow on one component — consider running a reflection loop to polish it.");
      }
      recs.push("Use keyboard shortcuts to maintain momentum while iterating.");
      break;
    case "exploration":
      recs.push("You're exploring broadly — try the motion debate tool to evaluate different directions.");
      recs.push("Generate A/B variants to compare design directions systematically.");
      break;
    case "stagnation":
      recs.push("Try a completely different template or style archetype to break out of the rut.");
      recs.push("Ask the Agent to evolve the motion with a mutation strategy.");
      recs.push("Run the chronopath prediction to see if attention flow reveals a new direction.");
      break;
    case "cooling_down":
      recs.push("Wrap up with a quality pipeline check before saving.");
      recs.push("Export a preview to review the current state.");
      break;
  }

  if (momentum > 0.7 && experimentation < 0.3) {
    recs.push("High momentum but low diversity — try exploring a different motion category.");
  }
  if (momentum < 0.2 && totalEvents > 20) {
    recs.push("Momentum is low — the Agent can suggest next steps based on your session.");
  }

  return recs.slice(0, 3);
}

/** Format a flow state snapshot as a human-readable report. */
export function formatFlowStateReport(snap: FlowStateSnapshot): string {
  const phaseEmoji: Record<FlowPhase, string> = {
    warming_up: "Warming Up",
    flow: "Flow",
    exploration: "Exploration",
    stagnation: "Stagnation",
    cooling_down: "Cooling Down",
  };

  const lines = [
    `Flow Phase: ${phaseEmoji[snap.phase]}`,
    `Momentum: ${(snap.momentum * 100).toFixed(0)}% (${snap.velocityActionsPerMin.toFixed(1)} act/min)`,
    `Focus: ${(snap.focusScore * 100).toFixed(0)}% | Experimentation: ${(snap.experimentationScore * 100).toFixed(0)}%`,
  ];

  if (snap.recommendations.length > 0) {
    lines.push("Recommendations:");
    for (const r of snap.recommendations) {
      lines.push(`  - ${r}`);
    }
  }

  return lines.join("\n");
}
