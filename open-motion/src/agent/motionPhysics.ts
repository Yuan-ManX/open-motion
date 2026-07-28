/**
 * Motion Physics Engine — analyzes motion through physics principles.
 *
 * This original AI-native module applies classical and modern physics to
 * motion compositions. Each component is a physical body; keyframes are
 * states; easings determine force profiles; the timeline is the laboratory.
 *
 * Core concepts:
 * - Kinematics: displacement, velocity, acceleration profiles
 * - Dynamics: forces (applied, friction, gravity, spring, normal)
 * - Energy: kinetic, potential, total, dissipation
 * - Momentum: linear and angular momentum conservation
 * - Work: force × displacement over the timeline
 * - Power: energy transfer rate
 * - Inertia: resistance to motion change
 * - Equilibrium: static and dynamic balance
 *
 * Rule-based — no LLM round-trip required.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";
import { easingPreset } from "@openmotion/shared";
import { draft, kf, type ComponentDraft } from "../motion/templates/helper.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Kinematic state of a component at a point in time. */
export interface KinematicState {
  componentId: string;
  timeMs: number;
  /** Displacement (px). */
  displacement: number;
  /** Velocity (px/s). */
  velocity: number;
  /** Acceleration (px/s²). */
  acceleration: number;
  /** Jerk (px/s³) — rate of acceleration change. */
  jerk: number;
}

/** Force analysis for a component. */
export interface ForceAnalysis {
  componentId: string;
  componentName: string | null;
  /** Net force (N, arbitrary units). */
  netForce: number;
  /** Applied force. */
  appliedForce: number;
  /** Friction force (opposing motion). */
  frictionForce: number;
  /** Gravitational force (downward bias). */
  gravitationalForce: number;
  /** Spring force (restoring). */
  springForce: number;
  /** Force type. */
  dominantForce: "applied" | "friction" | "gravity" | "spring" | "normal";
  /** Description. */
  description: string;
}

/** Energy analysis. */
export interface EnergyAnalysis {
  componentId: string;
  componentName: string | null;
  /** Kinetic energy (J, arbitrary units). */
  kineticEnergy: number;
  /** Potential energy. */
  potentialEnergy: number;
  /** Total mechanical energy. */
  totalEnergy: number;
  /** Energy dissipation (lost to friction/damping). */
  dissipation: number;
  /** Energy efficiency 0..1. */
  efficiency: number;
  /** Description. */
  description: string;
}

/** Momentum analysis. */
export interface MomentumAnalysis {
  componentId: string;
  componentName: string | null;
  /** Linear momentum (kg·px/s). */
  linearMomentum: number;
  /** Angular momentum (kg·px²/s). */
  angularMomentum: number;
  /** Impulse (change in momentum). */
  impulse: number;
  /** Description. */
  description: string;
}

/** Collision detection between components. */
export interface CollisionEvent {
  componentA: string;
  componentB: string;
  timeMs: number;
  /** Collision type. */
  type: "elastic" | "inelastic" | "partially-elastic" | "near-miss";
  /** Relative velocity at collision. */
  relativeVelocity: number;
  /** Coefficient of restitution 0..1. */
  restitution: number;
  /** Description. */
  description: string;
}

/** System equilibrium analysis. */
export interface EquilibriumAnalysis {
  /** Equilibrium type. */
  type: "static" | "dynamic" | "unstable" | "metastable" | "none";
  /** Balance score 0..1 (1 = perfectly balanced). */
  balance: number;
  /** Center of mass offset. */
  centerOfMassOffset: number;
  /** Net system force. */
  netSystemForce: number;
  /** Description. */
  description: string;
}

/** Physics analysis result. */
export interface PhysicsAnalysis {
  kinematics: KinematicState[];
  forces: ForceAnalysis[];
  energy: EnergyAnalysis[];
  momentum: MomentumAnalysis[];
  collisions: CollisionEvent[];
  equilibrium: EquilibriumAnalysis;
  /** Total system energy. */
  totalSystemEnergy: number;
  /** Average velocity. */
  averageVelocity: number;
  /** Peak acceleration. */
  peakAcceleration: number;
  /** System inertia. */
  systemInertia: number;
  /** Total work done. */
  totalWork: number;
  /** Average power. */
  averagePower: number;
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Kinematics
// ---------------------------------------------------------------------------

/** Compute kinematic states for all components across the timeline. */
function computeKinematics(spec: MotionSpec): KinematicState[] {
  const states: KinematicState[] = [];

  for (const comp of spec.components) {
    const kfs = comp.keyframes ?? [];
    if (kfs.length === 0) continue;

    for (let i = 0; i < kfs.length; i++) {
      const kf = kfs[i];
      const timeMs = comp.delayMs + kf.offset * comp.durationMs;
      const timeS = timeMs / 1000;

      // Compute displacement from first keyframe
      const firstProps = (kfs[0].properties ?? {}) as Record<string, string | number>;
      const currProps = (kf.properties ?? {}) as Record<string, string | number>;
      let displacement = 0;
      for (const key of Object.keys(currProps)) {
        if (typeof currProps[key] === "number" && typeof firstProps[key] === "number") {
          displacement += Math.abs((currProps[key] as number) - (firstProps[key] as number));
        }
      }

      // Velocity: displacement from previous keyframe / time delta
      let velocity = 0;
      let acceleration = 0;
      let jerk = 0;

      if (i > 0) {
        const prevKf = kfs[i - 1];
        const prevTimeMs = comp.delayMs + prevKf.offset * comp.durationMs;
        const dt = Math.max(0.001, (timeMs - prevTimeMs) / 1000);
        const prevProps = (prevKf.properties ?? {}) as Record<string, string | number>;
        let prevDisplacement = 0;
        for (const key of Object.keys(currProps)) {
          if (typeof currProps[key] === "number" && typeof prevProps[key] === "number") {
            prevDisplacement += Math.abs((currProps[key] as number) - (prevProps[key] as number));
          }
        }
        velocity = prevDisplacement / dt;
      }

      if (i > 1) {
        const prevKf = kfs[i - 1];
        const prevTimeMs = comp.delayMs + prevKf.offset * comp.durationMs;
        const dt = Math.max(0.001, (timeMs - prevTimeMs) / 1000);
        // Estimate acceleration from velocity change
        const prevPrevKf = kfs[i - 2];
        const prevPrevTimeMs = comp.delayMs + prevPrevKf.offset * comp.durationMs;
        const prevDt = Math.max(0.001, (prevTimeMs - prevPrevTimeMs) / 1000);

        const prevProps = (prevKf.properties ?? {}) as Record<string, string | number>;
        const prevPrevProps = (prevPrevKf.properties ?? {}) as Record<string, string | number>;
        let prevDisp = 0;
        let prevPrevDisp = 0;
        for (const key of Object.keys(prevProps)) {
          if (typeof prevProps[key] === "number" && typeof prevPrevProps[key] === "number") {
            prevPrevDisp += Math.abs((prevProps[key] as number) - (prevPrevProps[key] as number));
          }
        }
        const prevVel = prevDisp / prevDt;
        acceleration = (velocity - prevVel) / dt;
        jerk = acceleration / Math.max(0.001, dt);
      }

      states.push({
        componentId: comp.id,
        timeMs,
        displacement,
        velocity,
        acceleration,
        jerk,
      });
    }
  }

  return states.sort((a, b) => a.timeMs - b.timeMs);
}

// ---------------------------------------------------------------------------
// Force Analysis
// ---------------------------------------------------------------------------

/** Analyze forces acting on each component. */
function analyzeForces(spec: MotionSpec): ForceAnalysis[] {
  return spec.components.map((comp) => {
    const easingName =
      typeof comp.easing === "object" && comp.easing !== null && "name" in comp.easing
        ? String((comp.easing as { name?: unknown }).name ?? "ease")
        : "ease";

    // Estimate mass from duration (longer = heavier)
    const mass = Math.max(0.1, comp.durationMs / 1000);

    // Applied force: from displacement and duration (F = m * a)
    const kfs = comp.keyframes ?? [];
    let totalDisp = 0;
    for (let i = 1; i < kfs.length; i++) {
      const prev = (kfs[i - 1].properties ?? {}) as Record<string, string | number>;
      const curr = (kfs[i].properties ?? {}) as Record<string, string | number>;
      for (const key of Object.keys(curr)) {
        if (typeof curr[key] === "number" && typeof prev[key] === "number") {
          totalDisp += Math.abs((curr[key] as number) - (prev[key] as number));
        }
      }
    }
    const acceleration = totalDisp / Math.max(0.001, (comp.durationMs / 1000) ** 2);
    const appliedForce = mass * acceleration;

    // Friction: proportional to velocity (opposes motion)
    const avgVelocity = totalDisp / Math.max(0.001, comp.durationMs / 1000);
    const frictionForce = -0.1 * mass * avgVelocity;

    // Gravity: check for downward translateY bias
    let gravBias = 0;
    for (const kf of kfs) {
      const props = (kf.properties ?? {}) as Record<string, string | number>;
      if ("translateY" in props && typeof props.translateY === "number" && props.translateY > 0) {
        gravBias += 1;
      }
    }
    const gravitationalForce = gravBias > 0 ? mass * 9.8 : 0;

    // Spring: check for spring easing
    const springForce = easingName.includes("spring") || easingName.includes("elastic")
      ? mass * 50 // Restoring force
      : 0;

    const netForce = appliedForce + frictionForce + gravitationalForce + springForce;

    let dominantForce: ForceAnalysis["dominantForce"] = "applied";
    const forces = [
      { name: "applied" as const, value: Math.abs(appliedForce) },
      { name: "friction" as const, value: Math.abs(frictionForce) },
      { name: "gravity" as const, value: Math.abs(gravitationalForce) },
      { name: "spring" as const, value: Math.abs(springForce) },
    ];
    forces.sort((a, b) => b.value - a.value);
    dominantForce = forces[0].name;

    return {
      componentId: comp.id,
      componentName: comp.name,
      netForce,
      appliedForce,
      frictionForce,
      gravitationalForce,
      springForce,
      dominantForce,
      description: `${dominantForce} force dominant — net ${netForce.toFixed(2)}N, applied ${appliedForce.toFixed(2)}N, friction ${frictionForce.toFixed(2)}N`,
    };
  });
}

// ---------------------------------------------------------------------------
// Energy Analysis
// ---------------------------------------------------------------------------

/** Analyze energy for each component. */
function analyzeEnergy(spec: MotionSpec): EnergyAnalysis[] {
  return spec.components.map((comp) => {
    const mass = Math.max(0.1, comp.durationMs / 1000);
    const kfs = comp.keyframes ?? [];

    // Kinetic energy: 0.5 * m * v²
    let maxVelocity = 0;
    let totalDisp = 0;
    for (let i = 1; i < kfs.length; i++) {
      const prev = (kfs[i - 1].properties ?? {}) as Record<string, string | number>;
      const curr = (kfs[i].properties ?? {}) as Record<string, string | number>;
      let disp = 0;
      for (const key of Object.keys(curr)) {
        if (typeof curr[key] === "number" && typeof prev[key] === "number") {
          disp += Math.abs((curr[key] as number) - (prev[key] as number));
        }
      }
      totalDisp += disp;
      const dt = (kfs[i].offset - kfs[i - 1].offset) * comp.durationMs / 1000;
      const vel = dt > 0 ? disp / dt : 0;
      maxVelocity = Math.max(maxVelocity, vel);
    }
    const kineticEnergy = 0.5 * mass * maxVelocity * maxVelocity;

    // Potential energy: m * g * h (height from translateY)
    let maxHeight = 0;
    for (const kf of kfs) {
      const props = (kf.properties ?? {}) as Record<string, string | number>;
      if ("translateY" in props && typeof props.translateY === "number") {
        maxHeight = Math.max(maxHeight, Math.abs(props.translateY));
      }
    }
    const potentialEnergy = mass * 9.8 * maxHeight;

    const totalEnergy = kineticEnergy + potentialEnergy;

    // Dissipation: energy lost (estimated from easing)
    const easingName =
      typeof comp.easing === "object" && comp.easing !== null && "name" in comp.easing
        ? String((comp.easing as { name?: unknown }).name ?? "ease")
        : "ease";
    const dissipationRate = easingName.includes("linear") ? 0.0 :
      easingName.includes("smooth") || easingName.includes("soft") ? 0.2 :
      easingName.includes("bounce") || easingName.includes("elastic") ? 0.5 : 0.3;
    const dissipation = totalEnergy * dissipationRate;

    const efficiency = totalEnergy > 0 ? 1 - dissipationRate : 1;

    return {
      componentId: comp.id,
      componentName: comp.name,
      kineticEnergy,
      potentialEnergy,
      totalEnergy,
      dissipation,
      efficiency,
      description: `KE ${kineticEnergy.toFixed(2)}J, PE ${potentialEnergy.toFixed(2)}J, total ${totalEnergy.toFixed(2)}J, efficiency ${(efficiency * 100).toFixed(0)}%`,
    };
  });
}

// ---------------------------------------------------------------------------
// Momentum Analysis
// ---------------------------------------------------------------------------

/** Analyze momentum for each component. */
function analyzeMomentum(spec: MotionSpec): MomentumAnalysis[] {
  return spec.components.map((comp) => {
    const mass = Math.max(0.1, comp.durationMs / 1000);
    const kfs = comp.keyframes ?? [];

    // Linear momentum: m * v
    let maxVelocity = 0;
    for (let i = 1; i < kfs.length; i++) {
      const prev = (kfs[i - 1].properties ?? {}) as Record<string, string | number>;
      const curr = (kfs[i].properties ?? {}) as Record<string, string | number>;
      let disp = 0;
      for (const key of Object.keys(curr)) {
        if (typeof curr[key] === "number" && typeof prev[key] === "number") {
          disp += Math.abs((curr[key] as number) - (prev[key] as number));
        }
      }
      const dt = (kfs[i].offset - kfs[i - 1].offset) * comp.durationMs / 1000;
      const vel = dt > 0 ? disp / dt : 0;
      maxVelocity = Math.max(maxVelocity, vel);
    }
    const linearMomentum = mass * maxVelocity;

    // Angular momentum: I * ω (from rotation)
    let maxAngularVel = 0;
    for (let i = 1; i < kfs.length; i++) {
      const prev = (kfs[i - 1].properties ?? {}) as Record<string, string | number>;
      const curr = (kfs[i].properties ?? {}) as Record<string, string | number>;
      if ("rotate" in prev && "rotate" in curr && typeof prev.rotate === "number" && typeof curr.rotate === "number") {
        const angleDiff = Math.abs((curr.rotate as number) - (prev.rotate as number));
        const dt = (kfs[i].offset - kfs[i - 1].offset) * comp.durationMs / 1000;
        const angVel = dt > 0 ? angleDiff / dt : 0;
        maxAngularVel = Math.max(maxAngularVel, angVel);
      }
    }
    const angularMomentum = mass * maxAngularVel;

    // Impulse: change in momentum (approximate as final momentum)
    const impulse = linearMomentum;

    return {
      componentId: comp.id,
      componentName: comp.name,
      linearMomentum,
      angularMomentum,
      impulse,
      description: `p ${linearMomentum.toFixed(2)} kg·px/s, L ${angularMomentum.toFixed(2)} kg·px²/s, impulse ${impulse.toFixed(2)}`,
    };
  });
}

// ---------------------------------------------------------------------------
// Collision Detection
// ---------------------------------------------------------------------------

/** Detect collisions between components (temporal overlap). */
function detectCollisions(spec: MotionSpec): CollisionEvent[] {
  const collisions: CollisionEvent[] = [];
  const components = spec.components;

  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const a = components[i];
      const b = components[j];

      // Check temporal overlap
      const overlapStart = Math.max(a.delayMs, b.delayMs);
      const overlapEnd = Math.min(a.delayMs + a.durationMs, b.delayMs + b.durationMs);

      if (overlapEnd > overlapStart) {
        // Estimate relative velocity
        const aVel = a.durationMs > 0 ? 100 / a.durationMs : 0;
        const bVel = b.durationMs > 0 ? 100 / b.durationMs : 0;
        const relativeVelocity = Math.abs(aVel - bVel);

        // Determine collision type from easing
        const aEasing = typeof a.easing === "object" && a.easing !== null && "name" in a.easing
          ? String((a.easing as { name?: unknown }).name ?? "ease") : "ease";
        const bEasing = typeof b.easing === "object" && b.easing !== null && "name" in b.easing
          ? String((b.easing as { name?: unknown }).name ?? "ease") : "ease";

        let type: CollisionEvent["type"] = "partially-elastic";
        let restitution = 0.5;

        if (aEasing.includes("bounce") || bEasing.includes("bounce")) {
          type = "elastic";
          restitution = 0.9;
        } else if (aEasing.includes("smooth") || bEasing.includes("smooth")) {
          type = "inelastic";
          restitution = 0.2;
        } else if (relativeVelocity < 0.1) {
          type = "near-miss";
          restitution = 0;
        }

        collisions.push({
          componentA: a.id,
          componentB: b.id,
          timeMs: overlapStart,
          type,
          relativeVelocity,
          restitution,
          description: `${type} collision at ${overlapStart}ms — relative velocity ${relativeVelocity.toFixed(2)}, restitution ${restitution.toFixed(2)}`,
        });
      }
    }
  }

  return collisions.sort((a, b) => a.timeMs - b.timeMs);
}

// ---------------------------------------------------------------------------
// Equilibrium Analysis
// ---------------------------------------------------------------------------

/** Analyze system equilibrium. */
function analyzeEquilibrium(spec: MotionSpec, forces: ForceAnalysis[]): EquilibriumAnalysis {
  if (spec.components.length === 0) {
    return { type: "none", balance: 0, centerOfMassOffset: 0, netSystemForce: 0, description: "No system" };
  }

  // Net system force
  const netSystemForce = forces.reduce((sum, f) => sum + f.netForce, 0);

  // Center of mass: average position weighted by "mass" (duration)
  let weightedSum = 0;
  let totalMass = 0;
  for (const comp of spec.components) {
    const mass = comp.durationMs / 1000;
    weightedSum += comp.delayMs * mass;
    totalMass += mass;
  }
  const centerOfMass = totalMass > 0 ? weightedSum / totalMass : 0;

  // Timeline midpoint
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const midpoint = timelineEnd / 2;
  const centerOfMassOffset = Math.abs(centerOfMass - midpoint);

  // Balance: inverse of offset relative to timeline
  const balance = timelineEnd > 0 ? Math.max(0, 1 - centerOfMassOffset / midpoint) : 1;

  // Equilibrium type
  let type: EquilibriumAnalysis["type"] = "dynamic";
  if (Math.abs(netSystemForce) < 0.5) {
    type = balance > 0.8 ? "static" : "metastable";
  } else if (Math.abs(netSystemForce) > 5) {
    type = "unstable";
  }

  return {
    type,
    balance,
    centerOfMassOffset,
    netSystemForce,
    description: `${type} equilibrium — balance ${(balance * 100).toFixed(0)}%, net force ${netSystemForce.toFixed(2)}N`,
  };
}

// ---------------------------------------------------------------------------
// System Metrics
// ---------------------------------------------------------------------------

/** Compute total system energy. */
function computeTotalSystemEnergy(energy: EnergyAnalysis[]): number {
  return energy.reduce((sum, e) => sum + e.totalEnergy, 0);
}

/** Compute average velocity. */
function computeAverageVelocity(kinematics: KinematicState[]): number {
  if (kinematics.length === 0) return 0;
  return kinematics.reduce((sum, k) => sum + k.velocity, 0) / kinematics.length;
}

/** Compute peak acceleration. */
function computePeakAcceleration(kinematics: KinematicState[]): number {
  if (kinematics.length === 0) return 0;
  return Math.max(...kinematics.map((k) => k.acceleration));
}

/** Compute system inertia. */
function computeSystemInertia(spec: MotionSpec): number {
  return spec.components.reduce((sum, c) => sum + c.durationMs / 1000, 0);
}

/** Compute total work done. */
function computeTotalWork(forces: ForceAnalysis[], kinematics: KinematicState[]): number {
  let work = 0;
  for (const force of forces) {
    const compKinematics = kinematics.filter((k) => k.componentId === force.componentId);
    const maxDisp = compKinematics.length > 0 ? Math.max(...compKinematics.map((k) => k.displacement)) : 0;
    work += Math.abs(force.netForce) * maxDisp;
  }
  return work;
}

/** Compute average power. */
function computeAveragePower(totalWork: number, spec: MotionSpec): number {
  if (spec.components.length === 0) return 0;
  const timelineEnd = Math.max(...spec.components.map((c) => c.delayMs + c.durationMs));
  const timeS = Math.max(0.001, timelineEnd / 1000);
  return totalWork / timeS;
}

// ---------------------------------------------------------------------------
// Main Analysis
// ---------------------------------------------------------------------------

/** Analyze the physics of a motion composition. */
export function analyzePhysics(spec: MotionSpec): PhysicsAnalysis {
  if (spec.components.length === 0) {
    return {
      kinematics: [],
      forces: [],
      energy: [],
      momentum: [],
      collisions: [],
      equilibrium: { type: "none", balance: 0, centerOfMassOffset: 0, netSystemForce: 0, description: "No system" },
      totalSystemEnergy: 0,
      averageVelocity: 0,
      peakAcceleration: 0,
      systemInertia: 0,
      totalWork: 0,
      averagePower: 0,
      summary: "No components — the physical system is empty.",
    };
  }

  const kinematics = computeKinematics(spec);
  const forces = analyzeForces(spec);
  const energy = analyzeEnergy(spec);
  const momentum = analyzeMomentum(spec);
  const collisions = detectCollisions(spec);
  const equilibrium = analyzeEquilibrium(spec, forces);

  const totalSystemEnergy = computeTotalSystemEnergy(energy);
  const averageVelocity = computeAverageVelocity(kinematics);
  const peakAcceleration = computePeakAcceleration(kinematics);
  const systemInertia = computeSystemInertia(spec);
  const totalWork = computeTotalWork(forces, kinematics);
  const averagePower = computeAveragePower(totalWork, spec);

  const summary =
    `Physics: ${equilibrium.type} equilibrium, ` +
    `${spec.components.length} bod(ies), ${collisions.length} collision(s), ` +
    `total energy ${totalSystemEnergy.toFixed(2)}J, avg velocity ${averageVelocity.toFixed(2)}px/s, ` +
    `peak accel ${peakAcceleration.toFixed(2)}px/s², work ${totalWork.toFixed(2)}J, ` +
    `power ${averagePower.toFixed(2)}W`;

  return {
    kinematics,
    forces,
    energy,
    momentum,
    collisions,
    equilibrium,
    totalSystemEnergy,
    averageVelocity,
    peakAcceleration,
    systemInertia,
    totalWork,
    averagePower,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a physics analysis as a human-readable report. */
export function formatPhysicsReport(analysis: PhysicsAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Physics Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  // System
  lines.push("## System");
  lines.push(`- Equilibrium: ${analysis.equilibrium.type}`);
  lines.push(`- Balance: ${(analysis.equilibrium.balance * 100).toFixed(0)}%`);
  lines.push(`- Total energy: ${analysis.totalSystemEnergy.toFixed(2)} J`);
  lines.push(`- Average velocity: ${analysis.averageVelocity.toFixed(2)} px/s`);
  lines.push(`- Peak acceleration: ${analysis.peakAcceleration.toFixed(2)} px/s²`);
  lines.push(`- System inertia: ${analysis.systemInertia.toFixed(2)} kg`);
  lines.push(`- Total work: ${analysis.totalWork.toFixed(2)} J`);
  lines.push(`- Average power: ${analysis.averagePower.toFixed(2)} W`);
  lines.push("");

  // Forces
  lines.push("## Forces");
  if (analysis.forces.length === 0) {
    lines.push("- No forces detected");
  } else {
    for (const f of analysis.forces) {
      lines.push(`- [${f.dominantForce}] ${f.componentName ?? f.componentId} — net ${f.netForce.toFixed(2)}N`);
    }
  }
  lines.push("");

  // Energy
  lines.push("## Energy");
  if (analysis.energy.length === 0) {
    lines.push("- No energy detected");
  } else {
    for (const e of analysis.energy) {
      lines.push(`- ${e.componentName ?? e.componentId} — KE ${e.kineticEnergy.toFixed(2)}J, PE ${e.potentialEnergy.toFixed(2)}J, efficiency ${(e.efficiency * 100).toFixed(0)}%`);
    }
  }
  lines.push("");

  // Momentum
  lines.push("## Momentum");
  if (analysis.momentum.length === 0) {
    lines.push("- No momentum detected");
  } else {
    for (const m of analysis.momentum) {
      lines.push(`- ${m.componentName ?? m.componentId} — p ${m.linearMomentum.toFixed(2)}, L ${m.angularMomentum.toFixed(2)}`);
    }
  }
  lines.push("");

  // Collisions
  lines.push("## Collisions");
  if (analysis.collisions.length === 0) {
    lines.push("- No collisions detected");
  } else {
    for (const c of analysis.collisions) {
      lines.push(`- [${c.type}] at ${c.timeMs}ms — restitution ${c.restitution.toFixed(2)}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Physics Simulation Engine
// ---------------------------------------------------------------------------

/** A physics simulation sample. */
export interface PhysicsSample {
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** Result of a physics simulation. */
export interface PhysicsSimulationResult {
  component: ComponentDraft;
  samples: PhysicsSample[];
  summary: string;
}

/** Spring simulation config. */
export interface SpringConfig {
  stiffness?: number;
  damping?: number;
  mass?: number;
  initialDisplacement?: number;
  durationMs?: number;
}

/** Simulate a spring oscillator and generate motion keyframes. */
export function simulateSpring(config: SpringConfig = {}): PhysicsSimulationResult {
  const stiffness = config.stiffness ?? 100;
  const damping = config.damping ?? 10;
  const mass = config.mass ?? 1;
  const initialDisplacement = config.initialDisplacement ?? 100;
  const durationMs = config.durationMs ?? 1500;

  const samples: PhysicsSample[] = [];
  const dt = 16 / 1000;
  let x = initialDisplacement;
  let v = 0;
  const omega = Math.sqrt(stiffness / mass);
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));

  for (let t = 0; t <= durationMs; t += 16) {
    const a = -(stiffness / mass) * x - (damping / mass) * v;
    v += a * dt;
    x += v * dt;
    samples.push({ t, x, y: 0, vx: v, vy: 0 });
  }

  const keyframes = samples
    .filter((_, i) => i % 3 === 0)
    .map((s) => kf(s.t / durationMs, { translateX: s.x }));

  const component = draft("Spring Simulation", {
    durationMs,
    easing: easingPreset("linear"),
    keyframes,
  });

  const summary = `Spring simulation: stiffness ${stiffness}, damping ${damping}, mass ${mass}, ω ${omega.toFixed(2)} rad/s, damping ratio ${dampingRatio.toFixed(3)}`;
  return { component, samples, summary };
}

/** Gravity drop simulation config. */
export interface GravityDropConfig {
  gravity?: number;
  initialHeight?: number;
  bounce?: number;
  durationMs?: number;
}

/** Simulate a gravity drop with optional bounce. */
export function simulateGravityDrop(config: GravityDropConfig = {}): PhysicsSimulationResult {
  const gravity = config.gravity ?? 980;
  const initialHeight = config.initialHeight ?? 300;
  const bounce = config.bounce ?? 0.6;
  const durationMs = config.durationMs ?? 1500;

  const samples: PhysicsSample[] = [];
  const dt = 16 / 1000;
  let y = initialHeight;
  let v = 0;
  let t = 0;

  while (t <= durationMs) {
    v -= gravity * dt;
    y += v * dt;
    if (y <= 0) {
      y = 0;
      v = -v * bounce;
    }
    samples.push({ t, x: 0, y, vx: 0, vy: v });
    t += 16;
  }

  const keyframes = samples
    .filter((_, i) => i % 3 === 0)
    .map((s) => kf(s.t / durationMs, { translateY: -s.y }));

  const component = draft("Gravity Drop", {
    durationMs,
    easing: easingPreset("linear"),
    keyframes,
  });

  const summary = `Gravity drop: g ${gravity}px/s², height ${initialHeight}px, bounce ${bounce}, ${samples.length} samples`;
  return { component, samples, summary };
}

/** Projectile simulation config. */
export interface ProjectileConfig {
  angle?: number;
  velocity?: number;
  gravity?: number;
  durationMs?: number;
}

/** Simulate a projectile motion. */
export function simulateProjectile(config: ProjectileConfig = {}): PhysicsSimulationResult {
  const angleDeg = config.angle ?? 45;
  const velocity = config.velocity ?? 500;
  const gravity = config.gravity ?? 980;
  const durationMs = config.durationMs ?? 1500;

  const angleRad = (angleDeg * Math.PI) / 180;
  const vx = velocity * Math.cos(angleRad);
  const vy = velocity * Math.sin(angleRad);

  const samples: PhysicsSample[] = [];
  const dt = 16 / 1000;
  let x = 0;
  let y = 0;
  let curVx = vx;
  let curVy = vy;

  for (let t = 0; t <= durationMs; t += 16) {
    samples.push({ t, x, y, vx: curVx, vy: curVy });
    curVy -= gravity * dt;
    x += curVx * dt;
    y += curVy * dt;
    if (y < 0 && t > 100) break;
  }

  const actualDuration = samples.length > 0 ? samples[samples.length - 1].t : durationMs;
  const keyframes = samples
    .filter((_, i) => i % 3 === 0)
    .map((s) => kf(s.t / Math.max(1, actualDuration), { translateX: s.x, translateY: -s.y }));

  const component = draft("Projectile Motion", {
    durationMs: Math.max(durationMs, actualDuration),
    easing: easingPreset("linear"),
    keyframes,
  });

  const range = samples.length > 0 ? samples[samples.length - 1].x : 0;
  const peak = samples.length > 0 ? Math.max(...samples.map((s) => s.y)) : 0;
  const summary = `Projectile: angle ${angleDeg}°, velocity ${velocity}px/s, range ${range.toFixed(0)}px, peak ${peak.toFixed(0)}px`;
  return { component, samples, summary };
}

/** Friction simulation config. */
export interface FrictionConfig {
  initialVelocity?: number;
  friction?: number;
  mass?: number;
  durationMs?: number;
}

/** Simulate a friction-decayed motion. */
export function simulateFriction(config: FrictionConfig = {}): PhysicsSimulationResult {
  const initialVelocity = config.initialVelocity ?? 500;
  const friction = config.friction ?? 50;
  const mass = config.mass ?? 1;
  const durationMs = config.durationMs ?? 1500;

  const samples: PhysicsSample[] = [];
  const dt = 16 / 1000;
  let x = 0;
  let v = initialVelocity;
  const mu = friction / mass;

  for (let t = 0; t <= durationMs; t += 16) {
    samples.push({ t, x, y: 0, vx: v, vy: 0 });
    const decel = mu * Math.sign(v);
    v -= decel * dt;
    if (Math.abs(v) < 1) v = 0;
    x += v * dt;
  }

  const keyframes = samples
    .filter((_, i) => i % 3 === 0)
    .map((s) => kf(s.t / durationMs, { translateX: s.x }));

  const component = draft("Friction Decay", {
    durationMs,
    easing: easingPreset("linear"),
    keyframes,
  });

  const finalX = samples.length > 0 ? samples[samples.length - 1].x : 0;
  const summary = `Friction: v₀ ${initialVelocity}px/s, μ ${friction}, mass ${mass}, distance ${finalX.toFixed(0)}px`;
  return { component, samples, summary };
}

/** Pendulum simulation config. */
export interface PendulumConfig {
  length?: number;
  initialAngle?: number;
  gravity?: number;
  damping?: number;
  durationMs?: number;
}

/** Simulate a pendulum swing. */
export function simulatePendulum(config: PendulumConfig = {}): PhysicsSimulationResult {
  const length = config.length ?? 200;
  const initialAngleDeg = config.initialAngle ?? 45;
  const gravity = config.gravity ?? 980;
  const damping = config.damping ?? 0.5;
  const durationMs = config.durationMs ?? 2000;

  const initialAngle = (initialAngleDeg * Math.PI) / 180;
  const omega = Math.sqrt(gravity / length);

  const samples: PhysicsSample[] = [];
  let angle = initialAngle;
  let angularVel = 0;
  const dt = 16 / 1000;

  for (let t = 0; t <= durationMs; t += 16) {
    const angularAccel = -(gravity / length) * Math.sin(angle) - damping * angularVel;
    angularVel += angularAccel * dt;
    angle += angularVel * dt;
    const x = length * Math.sin(angle);
    const y = -length * Math.cos(angle);
    samples.push({ t, x, y, vx: angularVel * Math.cos(angle), vy: angularVel * Math.sin(angle) });
  }

  const keyframes = samples
    .filter((_, i) => i % 3 === 0)
    .map((s) => {
      const sampleAngleDeg = (Math.atan2(s.x, -s.y) * 180) / Math.PI;
      return kf(s.t / durationMs, { translateX: s.x, translateY: s.y, rotate: sampleAngleDeg });
    });

  const component = draft("Pendulum Swing", {
    durationMs,
    easing: easingPreset("linear"),
    keyframes,
  });

  const period = (2 * Math.PI) / omega;
  const summary = `Pendulum: length ${length}px, θ₀ ${initialAngleDeg}°, period ${period.toFixed(0)}ms, ω ${omega.toFixed(2)} rad/s`;
  return { component, samples, summary };
}

// ---------------------------------------------------------------------------
// Physics Presets
// ---------------------------------------------------------------------------

/** A named physics preset. */
export interface PhysicsPreset {
  id: string;
  name: string;
  type: "spring" | "gravity" | "projectile" | "friction" | "pendulum";
  config: Record<string, number>;
  description: string;
}

const PHYSICS_PRESETS: PhysicsPreset[] = [
  {
    id: "spring-snappy",
    name: "Snappy Spring",
    type: "spring",
    config: { stiffness: 200, damping: 20, mass: 1, initialDisplacement: 100, durationMs: 1000 },
    description: "Fast, snappy spring with high stiffness",
  },
  {
    id: "spring-soft",
    name: "Soft Spring",
    type: "spring",
    config: { stiffness: 50, damping: 8, mass: 1, initialDisplacement: 100, durationMs: 2000 },
    description: "Gentle, soft spring oscillation",
  },
  {
    id: "spring-bouncy",
    name: "Bouncy Spring",
    type: "spring",
    config: { stiffness: 150, damping: 5, mass: 1, initialDisplacement: 80, durationMs: 1800 },
    description: "Very bouncy spring with low damping",
  },
  {
    id: "gravity-drop",
    name: "Gravity Drop",
    type: "gravity",
    config: { gravity: 980, initialHeight: 300, bounce: 0.6, durationMs: 1500 },
    description: "Free fall with single bounce",
  },
  {
    id: "gravity-bouncy",
    name: "Bouncy Ball",
    type: "gravity",
    config: { gravity: 980, initialHeight: 400, bounce: 0.8, durationMs: 2000 },
    description: "High-bounce ball drop",
  },
  {
    id: "projectile-45",
    name: "45° Projectile",
    type: "projectile",
    config: { angle: 45, velocity: 500, gravity: 980, durationMs: 1500 },
    description: "Optimal angle projectile",
  },
  {
    id: "projectile-high",
    name: "High Arc",
    type: "projectile",
    config: { angle: 70, velocity: 600, gravity: 980, durationMs: 2000 },
    description: "High-arc projectile",
  },
  {
    id: "friction-decay",
    name: "Friction Decay",
    type: "friction",
    config: { initialVelocity: 500, friction: 50, mass: 1, durationMs: 1500 },
    description: "Slowing object with friction",
  },
  {
    id: "friction-ice",
    name: "Ice Slide",
    type: "friction",
    config: { initialVelocity: 700, friction: 10, mass: 1, durationMs: 2500 },
    description: "Low-friction slide",
  },
  {
    id: "pendulum-swing",
    name: "Pendulum Swing",
    type: "pendulum",
    config: { length: 200, initialAngle: 45, gravity: 980, damping: 0.5, durationMs: 2000 },
    description: "Classic pendulum motion",
  },
  {
    id: "pendulum-damped",
    name: "Damped Pendulum",
    type: "pendulum",
    config: { length: 250, initialAngle: 60, gravity: 980, damping: 2, durationMs: 3000 },
    description: "Quickly damped pendulum",
  },
];

/** List all physics presets. */
export function listPhysicsPresets(): PhysicsPreset[] {
  return PHYSICS_PRESETS;
}

/** List all physics simulation types. */
export function listPhysicsTypes(): Array<{ id: string; name: string; description: string }> {
  return [
    { id: "spring", name: "Spring", description: "Hooke's law spring oscillator with damping" },
    { id: "gravity", name: "Gravity Drop", description: "Free fall with optional bounce" },
    { id: "projectile", name: "Projectile", description: "2D projectile motion with gravity" },
    { id: "friction", name: "Friction", description: "Linear motion decelerated by friction" },
    { id: "pendulum", name: "Pendulum", description: "Simple pendulum with damping" },
  ];
}

/** Run a named physics preset by id. */
export function runPreset(presetId: string): PhysicsSimulationResult | null {
  const preset = PHYSICS_PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;

  switch (preset.type) {
    case "spring":
      return simulateSpring(preset.config);
    case "gravity":
      return simulateGravityDrop(preset.config);
    case "projectile":
      return simulateProjectile(preset.config);
    case "friction":
      return simulateFriction(preset.config);
    case "pendulum":
      return simulatePendulum(preset.config);
    default:
      return null;
  }
}
