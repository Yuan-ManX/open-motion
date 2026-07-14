import { Router } from "express";
import { listPresets as listStateMachinePresetIds, getPreset } from "../../motion/stateMachine.js";

export const catalogRouter = Router();

const CHOREOGRAPHY_PATTERNS = [
  { id: "cascade", name: "Cascade", description: "Sequential staggered entrance — each component starts after the previous with a fixed delay." },
  { id: "wave", name: "Wave", description: "Sine-based delay distribution creating a fluid wave-like ripple across components." },
  { id: "ripple", name: "Ripple", description: "Center-out delay based on distance from the centroid, simulating a ripple effect." },
  { id: "canon", name: "Canon", description: "Fugue-like overlap where each component starts before the previous finishes." },
  { id: "converge", name: "Converge", description: "All components animate toward a synchronized climax point from different start times." },
  { id: "spiral", name: "Spiral", description: "Golden-angle delay distribution creating a spiral entry pattern." },
  { id: "explosion", name: "Explosion", description: "Center-out burst with bounce easing — components explode outward from the centroid." },
  { id: "assembly", name: "Assembly", description: "Edge-to-center convergence — components assemble from scattered positions to their final spots." },
  { id: "breathing", name: "Breathing", description: "Phase-offset opacity/scale oscillation creating a breathing organism effect." },
  { id: "domino", name: "Domino", description: "Alternating-direction cascade with linear easing — domino-topple sequential reveal." },
  { id: "scatter", name: "Scatter", description: "Reverse explosion — components scatter from center to their positions with overshoot easing." },
] as const;

/**
 * GET /api/choreography — list all choreography patterns with descriptions.
 */
catalogRouter.get("/choreography", (_req, res) => {
  res.json({ patterns: CHOREOGRAPHY_PATTERNS, count: CHOREOGRAPHY_PATTERNS.length });
});

/**
 * GET /api/state-machine-presets — list all available state machine presets.
 */
catalogRouter.get("/state-machine-presets", (_req, res) => {
  const ids = listStateMachinePresetIds();
  const presets = ids.map((id) => {
    const p = getPreset(id);
    return p
      ? {
          id,
          name: p.name,
          description: p.description,
          stateCount: p.states.length,
          transitionCount: p.transitions.length,
          inputCount: p.inputs.length,
        }
      : null;
  }).filter((p): p is NonNullable<typeof p> => p !== null);
  res.json({ presets, count: presets.length });
});
