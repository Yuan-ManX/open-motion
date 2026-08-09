/**
 * Motion Chemistry Engine — analyzes motion as molecular reactions.
 */

import type { MotionSpec, MotionComponent } from "@openmotion/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An atom — a single animated property. */
export interface MotionAtom {
  /** Component that owns this atom. */
  componentId: string;
  /** Property name (translateX, scale, rotate, opacity, ...). */
  element: string;
  /** Atomic number — index in the periodic table of motion. */
  atomicNumber: number;
  /** Atomic mass — magnitude of motion (peak displacement). */
  atomicMass: number;
  /** Valence — number of bonds this atom can form. */
  valence: number;
  /** Electronegativity — how strongly this atom attracts motion. */
  electronegativity: number;
  /** Periodic group. */
  group: "alkali" | "alkaline-earth" | "transition" | "halogen" | "noble" | "metalloid" | "nonmetal";
  /** Period (1..7). */
  period: number;
}

/** A bond between two atoms. */
export interface MotionBond {
  /** Atom A (componentId:element). */
  atomA: string;
  /** Atom B (componentId:element). */
  atomB: string;
  /** Bond type. */
  type: "covalent" | "ionic" | "metallic" | "hydrogen" | "van-der-waals";
  /** Bond strength 0..1. */
  strength: number;
  /** Description. */
  description: string;
}

/** A molecule — one component's complete animated property set. */
export interface MotionMolecule {
  /** Source component ID. */
  componentId: string;
  /** Source component name. */
  componentName: string | null;
  /** Atoms in this molecule. */
  atoms: MotionAtom[];
  /** Molecular formula (e.g., "T2R1S1" = 2 translate + 1 rotate + 1 scale). */
  formula: string;
  /** Molecular weight (sum of atomic masses). */
  molecularWeight: number;
  /** Polarity 0..1 (asymmetry of motion). */
  polarity: number;
  /** State of matter. */
  stateOfMatter: "solid" | "liquid" | "gas" | "plasma";
  /** Description. */
  description: string;
}

/** A chemical reaction between molecules. */
export interface MotionReaction {
  /** Reactant molecule IDs. */
  reactants: string[];
  /** Product molecule IDs (may overlap with reactants for catalytic cycles). */
  products: string[];
  /** Reaction type. */
  type:
    | "synthesis"
    | "decomposition"
    | "single-displacement"
    | "double-displacement"
    | "combustion"
    | "redox"
    | "acid-base"
    | "catalytic";
  /** Time of reaction in ms. */
  timeMs: number;
  /** Activation energy 0..1 (intensity needed to start). */
  activationEnergy: number;
  /** Enthalpy change (negative = exothermic, positive = endothermic). */
  enthalpyChange: number;
  /** Reaction rate 0..1. */
  rate: number;
  /** Catalyst easing name, if any. */
  catalyst?: string;
  /** Description. */
  description: string;
}

/** A catalyst (easing) or inhibitor (delay) in the system. */
export interface MotionCatalyst {
  /** Component ID. */
  componentId: string;
  /** Catalyst type. */
  type: "catalyst" | "inhibitor";
  /** Easing name or delay amount. */
  agent: string;
  /** Effect strength 0..1. */
  strength: number;
  /** Affected reaction rate change. */
  rateChange: number;
  /** Description. */
  description: string;
}

/** A compound — multiple components acting as a coordinated unit. */
export interface MotionCompound {
  /** Member component IDs. */
  componentIds: string[];
  /** Compound name. */
  name: string;
  /** Compound formula (combined molecular formulas). */
  formula: string;
  /** Compound type. */
  type: "ionic" | "covalent" | "metallic" | "polymeric" | "network";
  /** Stability 0..1. */
  stability: number;
  /** Description. */
  description: string;
}

/** Chemistry analysis result. */
export interface ChemistryAnalysis {
  /** Detected atoms. */
  atoms: MotionAtom[];
  /** Detected molecules. */
  molecules: MotionMolecule[];
  /** Detected bonds. */
  bonds: MotionBond[];
  /** Detected reactions. */
  reactions: MotionReaction[];
  /** Detected catalysts and inhibitors. */
  catalysts: MotionCatalyst[];
  /** Detected compounds. */
  compounds: MotionCompound[];
  /** Overall pH (0 = strongly acidic/intense, 14 = strongly alkaline/subtle, 7 = neutral). */
  ph: number;
  /** Overall temperature in "Kelvin" (intensity scale). */
  temperatureK: number;
  /** Concentration 0..1 (density of activity). */
  concentration: number;
  /** Entropy 0..1 (disorder). */
  entropy: number;
  /** Enthalpy (total energy). */
  enthalpy: number;
  /** Equilibrium constant 0..1 (balance forward vs reverse). */
  equilibriumConstant: number;
  /** Primary state of matter across the system. */
  primaryState: "solid" | "liquid" | "gas" | "plasma";
  /** Summary. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Periodic Table of Motion
// ---------------------------------------------------------------------------

/** Periodic table mapping property names → atomic properties. */
const PERIODIC_TABLE: Record<
  string,
  { atomicNumber: number; group: MotionAtom["group"]; period: number; baseMass: number; electronegativity: number }
> = {
  // Group 1 — alkali (positional, highly reactive)
  translateX: { atomicNumber: 1, group: "alkali", period: 1, baseMass: 1.0, electronegativity: 0.9 },
  translateY: { atomicNumber: 2, group: "alkali", period: 1, baseMass: 1.0, electronegativity: 0.9 },
  translateZ: { atomicNumber: 3, group: "alkali", period: 2, baseMass: 1.1, electronegativity: 0.95 },

  // Group 2 — alkaline-earth (transform, moderately reactive)
  scale: { atomicNumber: 4, group: "alkaline-earth", period: 2, baseMass: 2.0, electronegativity: 1.2 },
  scaleX: { atomicNumber: 5, group: "alkaline-earth", period: 2, baseMass: 2.0, electronegativity: 1.2 },
  scaleY: { atomicNumber: 6, group: "alkaline-earth", period: 2, baseMass: 2.0, electronegativity: 1.2 },
  rotate: { atomicNumber: 12, group: "alkaline-earth", period: 3, baseMass: 2.4, electronegativity: 1.3 },

  // Transition metals (visual props, varied reactivity)
  opacity: { atomicNumber: 26, group: "transition", period: 4, baseMass: 3.5, electronegativity: 1.8 },
  filter: { atomicNumber: 29, group: "transition", period: 4, baseMass: 4.0, electronegativity: 1.9 },
  blur: { atomicNumber: 30, group: "transition", period: 4, baseMass: 3.8, electronegativity: 1.9 },
  brightness: { atomicNumber: 24, group: "transition", period: 4, baseMass: 3.6, electronegativity: 1.7 },
  hue: { atomicNumber: 27, group: "transition", period: 4, baseMass: 3.7, electronegativity: 1.8 },
  saturate: { atomicNumber: 28, group: "transition", period: 4, baseMass: 3.7, electronegativity: 1.8 },

  // Metalloids (color, semi-reactive)
  color: { atomicNumber: 14, group: "metalloid", period: 3, baseMass: 2.8, electronegativity: 1.5 },
  backgroundColor: { atomicNumber: 32, group: "metalloid", period: 4, baseMass: 2.9, electronegativity: 1.55 },
  borderColor: { atomicNumber: 33, group: "metalloid", period: 4, baseMass: 2.85, electronegativity: 1.55 },

  // Halogens (highly reactive visual emphasis)
  boxShadow: { atomicNumber: 17, group: "halogen", period: 3, baseMass: 3.0, electronegativity: 3.0 },
  textShadow: { atomicNumber: 35, group: "halogen", period: 4, baseMass: 3.1, electronegativity: 3.0 },
  outline: { atomicNumber: 53, group: "halogen", period: 5, baseMass: 3.2, electronegativity: 2.9 },

  // Nonmetals (subtle / structural)
  width: { atomicNumber: 8, group: "nonmetal", period: 2, baseMass: 2.0, electronegativity: 3.5 },
  height: { atomicNumber: 9, group: "nonmetal", period: 2, baseMass: 2.0, electronegativity: 3.5 },
  margin: { atomicNumber: 16, group: "nonmetal", period: 3, baseMass: 2.2, electronegativity: 2.5 },
  padding: { atomicNumber: 15, group: "nonmetal", period: 3, baseMass: 2.2, electronegativity: 2.4 },

  // Noble gases (decorative, non-reactive)
  cursor: { atomicNumber: 2, group: "noble", period: 1, baseMass: 0.5, electronegativity: 0.0 },
  zIndex: { atomicNumber: 10, group: "noble", period: 2, baseMass: 0.6, electronegativity: 0.0 },
  pointerEvents: { atomicNumber: 18, group: "noble", period: 3, baseMass: 0.6, electronegativity: 0.0 },
};

const UNKNOWN_ELEMENT = {
  atomicNumber: 99,
  group: "transition" as const,
  period: 7,
  baseMass: 2.5,
  electronegativity: 1.5,
};

/** Resolve an element name from a property name. */
function resolveElement(prop: string): string {
  // Normalize common aliases
  if (prop === "transform") return "scale";
  if (prop === "rotateX" || prop === "rotateY" || prop === "rotateZ") return "rotate";
  return prop;
}

// ---------------------------------------------------------------------------
// Atom Extraction
// ---------------------------------------------------------------------------

/** Extract atoms (animated properties) from a component. */
function extractAtoms(comp: MotionComponent): MotionAtom[] {
  const atoms: MotionAtom[] = [];
  const seen = new Set<string>();

  // Scan keyframe properties
  for (const kf of comp.keyframes ?? []) {
    const props = kf.properties as Record<string, string | number>;
    for (const rawProp of Object.keys(props)) {
      const element = resolveElement(rawProp);
      if (seen.has(element)) continue;
      seen.add(element);

      const table = PERIODIC_TABLE[element] ?? UNKNOWN_ELEMENT;
      // Compute peak magnitude from keyframes
      let peakMag = 0;
      for (const k of comp.keyframes ?? []) {
        const v = (k.properties as Record<string, string | number>)[rawProp];
        if (typeof v === "number") peakMag = Math.max(peakMag, Math.abs(v));
      }

      atoms.push({
        componentId: comp.id,
        element,
        atomicNumber: table.atomicNumber,
        atomicMass: table.baseMass + peakMag * 0.1,
        valence: Math.min(4, Math.max(1, Math.round(peakMag / 50) + 1)),
        electronegativity: table.electronegativity,
        group: table.group,
        period: table.period,
      });
    }
  }

  // Always include at least one atom (the easing/duration atom)
  if (atoms.length === 0) {
    atoms.push({
      componentId: comp.id,
      element: "duration",
      atomicNumber: 6,
      atomicMass: comp.durationMs / 1000,
      valence: 1,
      electronegativity: 1.0,
      group: "alkaline-earth",
      period: 2,
    });
  }

  return atoms;
}

// ---------------------------------------------------------------------------
// Molecule Construction
// ---------------------------------------------------------------------------

/** Build a molecular formula from atoms. */
function buildFormula(atoms: MotionAtom[]): string {
  const counts = new Map<string, number>();
  for (const a of atoms) {
    // Use first letter(s) as element symbol
    const sym = elementSymbol(a.element);
    counts.set(sym, (counts.get(sym) ?? 0) + 1);
  }
  const parts: string[] = [];
  for (const [sym, count] of counts) {
    parts.push(sym + (count > 1 ? String(count) : ""));
  }
  return parts.join("");
}

/** Get a short element symbol from a property name. */
function elementSymbol(element: string): string {
  const map: Record<string, string> = {
    translateX: "Tx",
    translateY: "Ty",
    translateZ: "Tz",
    scale: "S",
    scaleX: "Sx",
    scaleY: "Sy",
    rotate: "R",
    opacity: "O",
    filter: "F",
    blur: "B",
    brightness: "Br",
    hue: "H",
    saturate: "Sa",
    color: "C",
    backgroundColor: "Bg",
    borderColor: "Bc",
    boxShadow: "Sh",
    textShadow: "Ts",
    outline: "Ol",
    width: "W",
    height: "Ht",
    margin: "M",
    padding: "P",
    cursor: "Cu",
    zIndex: "Z",
    pointerEvents: "Pe",
    duration: "D",
  };
  return map[element] ?? element.charAt(0).toUpperCase() + element.slice(1, 2);
}

/** Determine state of matter from component properties. */
function classifyStateOfMatter(comp: MotionComponent): MotionMolecule["stateOfMatter"] {
  const duration = comp.durationMs;
  const kfCount = comp.keyframes?.length ?? 0;

  if (duration < 300 && kfCount >= 4) return "plasma"; // Intense, fast, multi-step
  if (duration < 600 && kfCount >= 2) return "gas";    // Fast, dispersed
  if (duration < 1500) return "liquid";                // Flowing
  return "solid";                                       // Rigid, structured
}

/** Build a molecule from a component. */
function buildMolecule(comp: MotionComponent): MotionMolecule {
  const atoms = extractAtoms(comp);
  const formula = buildFormula(atoms);
  const molecularWeight = atoms.reduce((sum, a) => sum + a.atomicMass, 0);

  // Polarity: asymmetry of keyframe values (positive vs negative)
  let posCount = 0;
  let negCount = 0;
  for (const kf of comp.keyframes ?? []) {
    const props = kf.properties as Record<string, string | number>;
    for (const v of Object.values(props)) {
      if (typeof v === "number") {
        if (v > 0) posCount++;
        else if (v < 0) negCount++;
      }
    }
  }
  const total = posCount + negCount;
  const polarity = total > 0 ? Math.abs(posCount - negCount) / total : 0;

  const state = classifyStateOfMatter(comp);

  return {
    componentId: comp.id,
    componentName: comp.name,
    atoms,
    formula,
    molecularWeight,
    polarity,
    stateOfMatter: state,
    description: `${state} molecule ${formula} — ${atoms.length} atom(s), weight ${molecularWeight.toFixed(2)}, polarity ${(polarity * 100).toFixed(0)}%`,
  };
}

// ---------------------------------------------------------------------------
// Bond Detection
// ---------------------------------------------------------------------------

/** Detect bonds between atoms (across molecules) based on temporal overlap. */
function detectBonds(spec: MotionSpec, molecules: MotionMolecule[]): MotionBond[] {
  const bonds: MotionBond[] = [];
  const components = spec.components;

  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const a = components[i];
      const b = components[j];

      // Check temporal overlap
      const aEnd = a.delayMs + a.durationMs;
      const bEnd = b.delayMs + b.durationMs;
      const overlapStart = Math.max(a.delayMs, b.delayMs);
      const overlapEnd = Math.min(aEnd, bEnd);
      const overlap = Math.max(0, overlapEnd - overlapStart);
      const minDuration = Math.min(a.durationMs, b.durationMs);
      const temporalStrength = minDuration > 0 ? overlap / minDuration : 0;

      if (temporalStrength <= 0) continue;

      // Find atoms that could bond (same element across molecules)
      const molA = molecules[i];
      const molB = molecules[j];
      const atomsA = molA.atoms;
      const atomsB = molB.atoms;

      for (const atomA of atomsA) {
        for (const atomB of atomsB) {
          if (atomA.element !== atomB.element) continue;

          // Determine bond type from electronegativity difference.
          // Polar covalent bonds are reported as "covalent" to fit the
          // union type; the description carries the ΔEN nuance.
          const enDiff = Math.abs(atomA.electronegativity - atomB.electronegativity);
          let bondType: MotionBond["type"];
          if (enDiff < 1.7) bondType = "covalent";
          else if (atomA.group === "transition" && atomB.group === "transition") bondType = "metallic";
          else if (enDiff < 2.5) bondType = "ionic";
          else if (enDiff < 3.5) bondType = "hydrogen";
          else bondType = "van-der-waals";

          const strength = temporalStrength * (1 - Math.min(1, enDiff / 4));

          bonds.push({
            atomA: `${atomA.componentId}:${atomA.element}`,
            atomB: `${atomB.componentId}:${atomB.element}`,
            type: bondType,
            strength,
            description: `${bondType} bond between ${atomA.element} atoms (overlap ${(temporalStrength * 100).toFixed(0)}%, ΔEN ${enDiff.toFixed(2)})`,
          });
        }
      }
    }
  }

  return bonds;
}

// ---------------------------------------------------------------------------
// Reaction Detection
// ---------------------------------------------------------------------------

/** Detect chemical reactions between molecules. */
function detectReactions(spec: MotionSpec, molecules: MotionMolecule[]): MotionReaction[] {
  const reactions: MotionReaction[] = [];
  const components = spec.components;

  for (let i = 0; i < components.length; i++) {
    for (let j = i + 1; j < components.length; j++) {
      const a = components[i];
      const b = components[j];
      const aStart = a.delayMs;
      const bStart = b.delayMs;
      const aEnd = a.delayMs + a.durationMs;
      const bEnd = b.delayMs + b.durationMs;

      // Synthesis: A + B → AB (components start at similar time, similar duration)
      if (Math.abs(aStart - bStart) < 100 && Math.abs(a.durationMs - b.durationMs) < 200) {
        reactions.push({
          reactants: [a.id, b.id],
          products: [a.id, b.id],
          type: "synthesis",
          timeMs: Math.min(aStart, bStart),
          activationEnergy: 0.3,
          enthalpyChange: -0.5,
          rate: 1 / Math.max(1, Math.abs(aStart - bStart) / 100),
          description: `Synthesis: ${a.name} + ${b.name} combine at ${Math.min(aStart, bStart)}ms`,
        });
      }

      // Decomposition: AB → A + B (one component ends, another begins at same time)
      else if (Math.abs(aEnd - bStart) < 100) {
        reactions.push({
          reactants: [a.id],
          products: [b.id],
          type: "decomposition",
          timeMs: aEnd,
          activationEnergy: 0.5,
          enthalpyChange: 0.4,
          rate: 1 / Math.max(1, (bStart - aEnd) / 100),
          description: `Decomposition: ${a.name} breaks down into ${b.name} at ${aEnd}ms`,
        });
      }

      // Single displacement: A + BC → AC + B (overlap with one ending before the other)
      else if (aStart < bStart && bStart < aEnd && aEnd < bEnd) {
        reactions.push({
          reactants: [a.id, b.id],
          products: [a.id, b.id],
          type: "single-displacement",
          timeMs: bStart,
          activationEnergy: 0.6,
          enthalpyChange: -0.2,
          rate: 1 / Math.max(1, (bStart - aStart) / 100),
          description: `Single displacement: ${a.name} displaces part of ${b.name} at ${bStart}ms`,
        });
      }

      // Combustion: very short, high-intensity overlap
      else if (
        a.durationMs < 300 &&
        b.durationMs < 300 &&
        Math.abs(aStart - bStart) < 100
      ) {
        reactions.push({
          reactants: [a.id, b.id],
          products: [a.id, b.id],
          type: "combustion",
          timeMs: Math.min(aStart, bStart),
          activationEnergy: 0.9,
          enthalpyChange: -0.95,
          rate: 0.95,
          description: `Combustion: ${a.name} + ${b.name} react violently at ${Math.min(aStart, bStart)}ms`,
        });
      }

      // Double displacement: crossed timing (A starts before B, B ends after A)
      else if (aStart < bStart && aEnd > bStart && bEnd > aEnd) {
        reactions.push({
          reactants: [a.id, b.id],
          products: [b.id, a.id],
          type: "double-displacement",
          timeMs: bStart,
          activationEnergy: 0.7,
          enthalpyChange: 0.0,
          rate: 0.5,
          description: `Double displacement: ${a.name} and ${b.name} exchange motion at ${bStart}ms`,
        });
      }
    }
  }

  // Sort reactions by time
  reactions.sort((a, b) => a.timeMs - b.timeMs);
  return reactions;
}

// ---------------------------------------------------------------------------
// Catalysts and Inhibitors
// ---------------------------------------------------------------------------

/** Identify catalysts (easings) and inhibitors (delays). */
function detectCatalysts(spec: MotionSpec): MotionCatalyst[] {
  const catalysts: MotionCatalyst[] = [];

  for (const comp of spec.components) {
    // Catalysts: aggressive easings accelerate reactions
    const easingName =
      typeof comp.easing === "object" && comp.easing !== null && "name" in comp.easing
        ? String((comp.easing as { name?: unknown }).name ?? "ease")
        : "ease";

    const aggressiveEasings = ["bounce", "elastic", "back", "snappy"];
    const mildEasings = ["linear", "smooth", "soft", "ease", "ease-in-out"];

    if (aggressiveEasings.some((e) => easingName.includes(e))) {
      catalysts.push({
        componentId: comp.id,
        type: "catalyst",
        agent: easingName,
        strength: 0.8,
        rateChange: 0.3,
        description: `Catalyst: ${easingName} easing accelerates ${comp.name}'s reaction`,
      });
    } else if (mildEasings.some((e) => easingName.includes(e))) {
      catalysts.push({
        componentId: comp.id,
        type: "catalyst",
        agent: easingName,
        strength: 0.4,
        rateChange: 0.1,
        description: `Mild catalyst: ${easingName} easing moderates ${comp.name}'s reaction`,
      });
    }

    // Inhibitors: large delays retard reactions
    if (comp.delayMs > 500) {
      catalysts.push({
        componentId: comp.id,
        type: "inhibitor",
        agent: `delay:${comp.delayMs}ms`,
        strength: Math.min(1, comp.delayMs / 2000),
        rateChange: -0.4,
        description: `Inhibitor: ${comp.delayMs}ms delay retards ${comp.name}'s reaction`,
      });
    }
  }

  return catalysts;
}

// ---------------------------------------------------------------------------
// Compound Detection
// ---------------------------------------------------------------------------

/** Detect compounds (coordinated component groups). */
function detectCompounds(spec: MotionSpec, molecules: MotionMolecule[]): MotionCompound[] {
  const compounds: MotionCompound[] = [];
  const components = spec.components;

  // Group components by similar start time (within 100ms) and overlapping duration
  const used = new Set<string>();

  for (let i = 0; i < components.length; i++) {
    if (used.has(components[i].id)) continue;
    const group: MotionComponent[] = [components[i]];
    used.add(components[i].id);

    for (let j = i + 1; j < components.length; j++) {
      if (used.has(components[j].id)) continue;
      const a = components[i];
      const b = components[j];
      if (
        Math.abs(a.delayMs - b.delayMs) < 150 &&
        Math.abs(a.durationMs - b.durationMs) < 300
      ) {
        group.push(b);
        used.add(b.id);
      }
    }

    if (group.length >= 2) {
      const formulas = group.map((c) => molecules.find((m) => m.componentId === c.id)?.formula ?? "?");
      const compoundFormula = formulas.join("·");
      const avgPolarity =
        group.reduce((sum, c) => {
          const m = molecules.find((m) => m.componentId === c.id);
          return sum + (m?.polarity ?? 0);
        }, 0) / group.length;

      let type: MotionCompound["type"] = "covalent";
      if (avgPolarity > 0.7) type = "ionic";
      else if (group.length >= 4) type = "polymeric";
      else if (group.every((c) => molecules.find((m) => m.componentId === c.id)?.stateOfMatter === "solid")) {
        type = "metallic";
      }

      const stability = 1 - avgPolarity * 0.5;

      compounds.push({
        componentIds: group.map((c) => c.id),
        name: `Compound-${group.length}`,
        formula: compoundFormula,
        type,
        stability,
        description: `${type} compound ${compoundFormula} — ${group.length} molecule(s), stability ${(stability * 100).toFixed(0)}%`,
      });
    }
  }

  return compounds;
}

// ---------------------------------------------------------------------------
// System-Wide Metrics
// ---------------------------------------------------------------------------

/** Compute overall pH (0 = intense/acidic, 14 = subtle/alkaline, 7 = neutral). */
function computePh(spec: MotionSpec): number {
  if (spec.components.length === 0) return 7;

  // Average motion intensity (acidic = intense, alkaline = subtle)
  let totalIntensity = 0;
  for (const comp of spec.components) {
    const kfCount = comp.keyframes?.length ?? 0;
    const durationFactor = comp.durationMs < 500 ? 0.9 : comp.durationMs < 1500 ? 0.5 : 0.2;
    const intensity = durationFactor * 0.7 + Math.min(1, kfCount / 8) * 0.3;
    totalIntensity += intensity;
  }
  const avgIntensity = totalIntensity / spec.components.length;

  // Map intensity 0..1 → pH 14..0
  return Math.max(0, Math.min(14, 14 - avgIntensity * 14));
}

/** Compute system temperature in Kelvin. */
function computeTemperature(spec: MotionSpec): number {
  if (spec.components.length === 0) return 273;

  let totalTemp = 0;
  for (const comp of spec.components) {
    // Faster motion = higher temperature
    const speed = 1000 / Math.max(100, comp.durationMs);
    const kfEnergy = (comp.keyframes?.length ?? 0) * 50;
    totalTemp += 273 + speed * 50 + kfEnergy;
  }
  return Math.round(totalTemp / spec.components.length);
}

/** Compute concentration (density of activity over timeline). */
function computeConcentration(spec: MotionSpec): number {
  if (spec.components.length === 0) return 0;

  const timelineEnd = Math.max(
    ...spec.components.map((c) => c.delayMs + c.durationMs),
    1,
  );
  const totalActivity = spec.components.reduce((sum, c) => sum + c.durationMs, 0);
  return Math.min(1, totalActivity / (timelineEnd * 2));
}

/** Compute entropy (disorder) of the system. */
function computeEntropy(spec: MotionSpec, molecules: MotionMolecule[]): number {
  if (molecules.length === 0) return 0;

  // Diversity of states of matter
  const stateCounts = new Map<string, number>();
  for (const m of molecules) {
    stateCounts.set(m.stateOfMatter, (stateCounts.get(m.stateOfMatter) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of stateCounts.values()) {
    const p = count / molecules.length;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(stateCounts.size || 1);
  return maxEntropy > 0 ? entropy / maxEntropy : 0;
}

/** Compute enthalpy (total energy) of the system. */
function computeEnthalpy(spec: MotionSpec): number {
  return spec.components.reduce((sum, c) => {
    const kfEnergy = (c.keyframes?.length ?? 0) * 10;
    const durEnergy = c.durationMs / 100;
    return sum + kfEnergy + durEnergy;
  }, 0);
}

/** Compute equilibrium constant (forward vs reverse balance). */
function computeEquilibrium(spec: MotionSpec, molecules: MotionMolecule[]): number {
  if (molecules.length === 0) return 0.5;

  const forwardCount = molecules.filter((m) => m.stateOfMatter === "gas" || m.stateOfMatter === "plasma").length;
  const reverseCount = molecules.filter((m) => m.stateOfMatter === "solid").length;
  const total = forwardCount + reverseCount;
  return total > 0 ? forwardCount / total : 0.5;
}

/** Determine primary state of matter. */
function computePrimaryState(molecules: MotionMolecule[]): ChemistryAnalysis["primaryState"] {
  if (molecules.length === 0) return "solid";

  const counts = new Map<string, number>();
  for (const m of molecules) {
    counts.set(m.stateOfMatter, (counts.get(m.stateOfMatter) ?? 0) + 1);
  }

  let max = 0;
  let primary: ChemistryAnalysis["primaryState"] = "solid";
  for (const [state, count] of counts) {
    if (count > max) {
      max = count;
      primary = state as ChemistryAnalysis["primaryState"];
    }
  }
  return primary;
}

// ---------------------------------------------------------------------------
// Main Analysis
// ---------------------------------------------------------------------------

/** Analyze the chemistry of a motion composition. */
export function analyzeChemistry(spec: MotionSpec): ChemistryAnalysis {
  if (spec.components.length === 0) {
    return {
      atoms: [],
      molecules: [],
      bonds: [],
      reactions: [],
      catalysts: [],
      compounds: [],
      ph: 7,
      temperatureK: 273,
      concentration: 0,
      entropy: 0,
      enthalpy: 0,
      equilibriumConstant: 0.5,
      primaryState: "solid",
      summary: "No components — the system contains no reagents.",
    };
  }

  const molecules = spec.components.map(buildMolecule);
  const atoms = molecules.flatMap((m) => m.atoms);
  const bonds = detectBonds(spec, molecules);
  const reactions = detectReactions(spec, molecules);
  const catalysts = detectCatalysts(spec);
  const compounds = detectCompounds(spec, molecules);

  const ph = computePh(spec);
  const temperatureK = computeTemperature(spec);
  const concentration = computeConcentration(spec);
  const entropy = computeEntropy(spec, molecules);
  const enthalpy = computeEnthalpy(spec);
  const equilibriumConstant = computeEquilibrium(spec, molecules);
  const primaryState = computePrimaryState(molecules);

  const summary =
    `Chemistry: ${primaryState} system at ${temperatureK}K, pH ${ph.toFixed(1)}, ` +
    `${molecules.length} molecule(s), ${atoms.length} atom(s), ${bonds.length} bond(s), ` +
    `${reactions.length} reaction(s), ${compounds.length} compound(s), ` +
    `concentration ${(concentration * 100).toFixed(0)}%, entropy ${(entropy * 100).toFixed(0)}%`;

  return {
    atoms,
    molecules,
    bonds,
    reactions,
    catalysts,
    compounds,
    ph,
    temperatureK,
    concentration,
    entropy,
    enthalpy,
    equilibriumConstant,
    primaryState,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Format a chemistry analysis as a human-readable report. */
export function formatChemistryReport(analysis: ChemistryAnalysis): string {
  const lines: string[] = [];
  lines.push("# Motion Chemistry Report");
  lines.push("");
  lines.push(analysis.summary);
  lines.push("");

  // System Conditions
  lines.push("## System Conditions");
  lines.push(`- Temperature: ${analysis.temperatureK} K`);
  lines.push(`- pH: ${analysis.ph.toFixed(1)} ${analysis.ph < 7 ? "(acidic / intense)" : analysis.ph > 7 ? "(alkaline / subtle)" : "(neutral)"}`);
  lines.push(`- Concentration: ${(analysis.concentration * 100).toFixed(0)}%`);
  lines.push(`- Entropy: ${(analysis.entropy * 100).toFixed(0)}%`);
  lines.push(`- Enthalpy: ${analysis.enthalpy.toFixed(1)}`);
  lines.push(`- Equilibrium constant: ${analysis.equilibriumConstant.toFixed(2)}`);
  lines.push(`- Primary state: ${analysis.primaryState}`);
  lines.push("");

  // Molecules
  lines.push("## Molecules");
  if (analysis.molecules.length === 0) {
    lines.push("- No molecules detected");
  } else {
    for (const m of analysis.molecules) {
      lines.push(`- [${m.stateOfMatter}] ${m.formula} (${m.componentName ?? m.componentId}) — weight ${m.molecularWeight.toFixed(2)}, polarity ${(m.polarity * 100).toFixed(0)}%, ${m.atoms.length} atom(s)`);
    }
  }
  lines.push("");

  // Bonds
  lines.push("## Bonds");
  if (analysis.bonds.length === 0) {
    lines.push("- No bonds detected");
  } else {
    for (const b of analysis.bonds) {
      lines.push(`- [${b.type}] ${b.atomA} ↔ ${b.atomB} — strength ${(b.strength * 100).toFixed(0)}%`);
    }
  }
  lines.push("");

  // Reactions
  lines.push("## Reactions");
  if (analysis.reactions.length === 0) {
    lines.push("- No reactions detected");
  } else {
    for (const r of analysis.reactions) {
      lines.push(`- [${r.type}] at ${r.timeMs}ms — ΔH ${r.enthalpyChange.toFixed(2)}, activation ${(r.activationEnergy * 100).toFixed(0)}%, rate ${(r.rate * 100).toFixed(0)}%`);
    }
  }
  lines.push("");

  // Catalysts & Inhibitors
  lines.push("## Catalysts & Inhibitors");
  if (analysis.catalysts.length === 0) {
    lines.push("- No catalysts or inhibitors detected");
  } else {
    for (const c of analysis.catalysts) {
      lines.push(`- [${c.type}] ${c.agent} — strength ${(c.strength * 100).toFixed(0)}%, rate change ${c.rateChange > 0 ? "+" : ""}${(c.rateChange * 100).toFixed(0)}%`);
    }
  }
  lines.push("");

  // Compounds
  lines.push("## Compounds");
  if (analysis.compounds.length === 0) {
    lines.push("- No compounds detected");
  } else {
    for (const c of analysis.compounds) {
      lines.push(`- [${c.type}] ${c.formula} — ${c.componentIds.length} molecule(s), stability ${(c.stability * 100).toFixed(0)}%`);
    }
  }

  return lines.join("\n");
}
