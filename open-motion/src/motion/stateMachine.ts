import type { Easing } from "@openmotion/shared";
import { easingPreset } from "../shared/motion/easing.js";

/**
 * State Machine Composer — an OpenMotion-native state machine model for motion
 * design. Each state machine owns a set of named states, typed inputs, and
 * transitions. States map to component visibility/style snapshots; transitions
 * define how inputs move the machine between states with their own timing.
 *
 * State machines are stored as JSON in the project tokens under the
 * STATE_MACHINES_KEY, so no DB migration is needed. The Agent can compose,
 * inspect, and trigger states through dedicated tools.
 */

export type InputType = "boolean" | "number" | "trigger";

export interface StateMachineInput {
  name: string;
  type: InputType;
  /** Initial value — false for boolean, 0 for number, false for trigger. */
  initial: boolean | number;
}

export interface StateConfig {
  /** Component IDs visible in this state. Hidden by default. */
  visibleComponents: string[];
  /** Component IDs playing their animation in this state. */
  playingComponents: string[];
  /** Per-component style overrides applied when entering this state. */
  styleOverrides: Record<string, Record<string, string | number>>;
  /** Label shown in the graph editor. */
  label: string;
  /** Whether this is the initial state on load. */
  isInitial?: boolean;
}

export interface StateMachineState {
  id: string;
  name: string;
  config: StateConfig;
}

export interface StateMachineTransition {
  id: string;
  fromStateId: string;
  toStateId: string;
  /** Input name that fires this transition. */
  inputName: string;
  /** Condition for boolean inputs: true/false. For number: threshold. */
  condition: boolean | number;
  /** Comparison operator for number inputs. */
  operator?: "eq" | "gt" | "lt" | "gte" | "lte";
  durationMs: number;
  easing: Easing;
}

export interface StateMachine {
  id: string;
  name: string;
  description: string;
  states: StateMachineState[];
  transitions: StateMachineTransition[];
  inputs: StateMachineInput[];
  /** Component IDs governed by this state machine. */
  componentIds: string[];
  currentStateId: string | null;
  createdAt: string;
}

export const STATE_MACHINES_KEY = "__stateMachines";

/** Common state machine presets for quick composition. */
export interface StateMachinePreset {
  name: string;
  description: string;
  states: Array<{ name: string; label: string; isInitial?: boolean }>;
  inputs: Array<{ name: string; type: InputType; initial: boolean | number }>;
  transitions: Array<{
    from: string;
    to: string;
    input: string;
    condition: boolean | number;
    durationMs: number;
  }>;
}

const PRESETS: Record<string, StateMachinePreset> = {
  "hover-press": {
    name: "Hover & Press",
    description: "Three-state interaction: idle → hover → pressed → idle",
    states: [
      { name: "idle", label: "Idle", isInitial: true },
      { name: "hover", label: "Hover" },
      { name: "pressed", label: "Pressed" },
    ],
    inputs: [
      { name: "isHovered", type: "boolean", initial: false },
      { name: "isPressed", type: "boolean", initial: false },
    ],
    transitions: [
      { from: "idle", to: "hover", input: "isHovered", condition: true, durationMs: 200 },
      { from: "hover", to: "idle", input: "isHovered", condition: false, durationMs: 200 },
      { from: "hover", to: "pressed", input: "isPressed", condition: true, durationMs: 100 },
      { from: "pressed", to: "hover", input: "isPressed", condition: false, durationMs: 150 },
      { from: "pressed", to: "idle", input: "isPressed", condition: false, durationMs: 300 },
    ],
  },
  "toggle-on-off": {
    name: "Toggle On/Off",
    description: "Two-state toggle driven by a trigger input",
    states: [
      { name: "off", label: "Off", isInitial: true },
      { name: "on", label: "On" },
    ],
    inputs: [
      { name: "toggle", type: "trigger", initial: false },
    ],
    transitions: [
      { from: "off", to: "on", input: "toggle", condition: true, durationMs: 300 },
      { from: "on", to: "off", input: "toggle", condition: true, durationMs: 300 },
    ],
  },
  "loading-sequence": {
    name: "Loading Sequence",
    description: "Four-state loading flow: idle → loading → success/error",
    states: [
      { name: "idle", label: "Idle", isInitial: true },
      { name: "loading", label: "Loading" },
      { name: "success", label: "Success" },
      { name: "error", label: "Error" },
    ],
    inputs: [
      { name: "start", type: "trigger", initial: false },
      { name: "progress", type: "number", initial: 0 },
      { name: "hasError", type: "boolean", initial: false },
    ],
    transitions: [
      { from: "idle", to: "loading", input: "start", condition: true, durationMs: 200 },
      { from: "loading", to: "success", input: "progress", condition: 100, durationMs: 400 },
      { from: "loading", to: "error", input: "hasError", condition: true, durationMs: 300 },
      { from: "success", to: "idle", input: "start", condition: true, durationMs: 200 },
      { from: "error", to: "idle", input: "start", condition: true, durationMs: 200 },
    ],
  },
  "carousel": {
    name: "Carousel",
    description: "Multi-slide carousel with next/prev triggers",
    states: [
      { name: "slide-1", label: "Slide 1", isInitial: true },
      { name: "slide-2", label: "Slide 2" },
      { name: "slide-3", label: "Slide 3" },
    ],
    inputs: [
      { name: "next", type: "trigger", initial: false },
      { name: "prev", type: "trigger", initial: false },
    ],
    transitions: [
      { from: "slide-1", to: "slide-2", input: "next", condition: true, durationMs: 500 },
      { from: "slide-2", to: "slide-3", input: "next", condition: true, durationMs: 500 },
      { from: "slide-3", to: "slide-1", input: "next", condition: true, durationMs: 500 },
      { from: "slide-2", to: "slide-1", input: "prev", condition: true, durationMs: 500 },
      { from: "slide-3", to: "slide-2", input: "prev", condition: true, durationMs: 500 },
      { from: "slide-1", to: "slide-3", input: "prev", condition: true, durationMs: 500 },
    ],
  },
  "tab-switch": {
    name: "Tab Switch",
    description: "Tab navigation with N tabs driven by a number input",
    states: [
      { name: "tab-1", label: "Tab 1", isInitial: true },
      { name: "tab-2", label: "Tab 2" },
      { name: "tab-3", label: "Tab 3" },
    ],
    inputs: [
      { name: "activeTab", type: "number", initial: 0 },
    ],
    transitions: [
      { from: "tab-1", to: "tab-2", input: "activeTab", condition: 1, durationMs: 300 },
      { from: "tab-1", to: "tab-3", input: "activeTab", condition: 2, durationMs: 300 },
      { from: "tab-2", to: "tab-1", input: "activeTab", condition: 0, durationMs: 300 },
      { from: "tab-2", to: "tab-3", input: "activeTab", condition: 2, durationMs: 300 },
      { from: "tab-3", to: "tab-1", input: "activeTab", condition: 0, durationMs: 300 },
      { from: "tab-3", to: "tab-2", input: "activeTab", condition: 1, durationMs: 300 },
    ],
  },
};

export function listPresets(): string[] {
  return Object.keys(PRESETS);
}

export function getPreset(id: string): StateMachinePreset | null {
  return PRESETS[id] ?? null;
}

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * Compose a state machine from a preset or custom definition. Assigns the
 * given component IDs to the machine and distributes them across states.
 */
export function composeStateMachine(options: {
  name: string;
  description?: string;
  presetId?: string;
  componentIds: string[];
  customStates?: Array<{ name: string; label: string; isInitial?: boolean }>;
  customInputs?: Array<{ name: string; type: InputType; initial: boolean | number }>;
  customTransitions?: Array<{
    from: string;
    to: string;
    input: string;
    condition: boolean | number;
    durationMs: number;
  }>;
}): StateMachine {
  const now = new Date().toISOString();
  const id = genId("sm");

  let presetStates: Array<{ name: string; label: string; isInitial?: boolean }>;
  let presetInputs: Array<{ name: string; type: InputType; initial: boolean | number }>;
  let presetTransitions: Array<{
    from: string;
    to: string;
    input: string;
    condition: boolean | number;
    durationMs: number;
  }>;

  if (options.presetId && PRESETS[options.presetId]) {
    const p = PRESETS[options.presetId];
    presetStates = p.states;
    presetInputs = p.inputs;
    presetTransitions = p.transitions;
  } else {
    presetStates = options.customStates ?? [
      { name: "idle", label: "Idle", isInitial: true },
      { name: "active", label: "Active" },
    ];
    presetInputs = options.customInputs ?? [
      { name: "activate", type: "trigger", initial: false },
    ];
    presetTransitions = options.customTransitions ?? [
      { from: "idle", to: "active", input: "activate", condition: true, durationMs: 300 },
      { from: "active", to: "idle", input: "activate", condition: true, durationMs: 300 },
    ];
  }

  const compIds = options.componentIds;
  const states: StateMachineState[] = presetStates.map((s, i) => {
    // Distribute components across states: each state shows the component at
    // its index (wrapping). The initial state shows all components.
    const visible = s.isInitial ? compIds : [compIds[i % compIds.length]].filter(Boolean);
    return {
      id: genId("st"),
      name: s.name,
      config: {
        visibleComponents: visible,
        playingComponents: visible,
        styleOverrides: {},
        label: s.label,
        isInitial: s.isInitial,
      },
    };
  });

  const stateByName = new Map(states.map((s) => [s.name, s]));
  const transitions: StateMachineTransition[] = presetTransitions.map((t) => {
    const from = stateByName.get(t.from);
    const to = stateByName.get(t.to);
    return {
      id: genId("tr"),
      fromStateId: from?.id ?? "",
      toStateId: to?.id ?? "",
      inputName: t.input,
      condition: t.condition,
      durationMs: t.durationMs,
      easing: easingPreset("ease-in-out"),
    };
  }).filter((t) => t.fromStateId && t.toStateId);

  const inputs: StateMachineInput[] = presetInputs.map((inp) => ({
    name: inp.name,
    type: inp.type,
    initial: inp.initial,
  }));

  const initial = states.find((s) => s.config.isInitial) ?? states[0];

  return {
    id,
    name: options.name,
    description: options.description ?? "",
    states,
    transitions,
    inputs,
    componentIds: compIds,
    currentStateId: initial?.id ?? null,
    createdAt: now,
  };
}

/** Serialize state machines for storage in project tokens. */
export function serializeStateMachines(machines: StateMachine[]): string {
  return JSON.stringify(machines);
}

/** Deserialize state machines from the project tokens string. */
export function deserializeStateMachines(raw: string | undefined | null): StateMachine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as StateMachine[];
  } catch {
    return [];
  }
}

/** Read state machines from a project's tokens record. */
export function readStateMachines(tokens: Record<string, string | number>): StateMachine[] {
  const raw = tokens[STATE_MACHINES_KEY];
  return typeof raw === "string" ? deserializeStateMachines(raw) : [];
}

/** Write state machines to a tokens record (returns a new record). */
export function writeStateMachines(
  tokens: Record<string, string | number>,
  machines: StateMachine[],
): Record<string, string | number> {
  return { ...tokens, [STATE_MACHINES_KEY]: serializeStateMachines(machines) };
}

/** Find a state machine by ID. */
export function findStateMachine(machines: StateMachine[], id: string): StateMachine | null {
  return machines.find((m) => m.id === id) ?? null;
}

/** Transition a state machine to a target state by name. Returns a new machine. */
export function transitionTo(
  machine: StateMachine,
  stateName: string,
): { machine: StateMachine; transition: StateMachineTransition | null } {
  const target = machine.states.find((s) => s.name === stateName);
  if (!target || target.id === machine.currentStateId) {
    return { machine, transition: null };
  }
  // Find a matching transition (any input, since we're triggering directly).
  const transition = machine.transitions.find(
    (t) => t.fromStateId === machine.currentStateId && t.toStateId === target.id,
  );
  return {
    machine: { ...machine, currentStateId: target.id },
    transition: transition ?? null,
  };
}

/** Validate a state machine and return a list of issues. */
export function validateStateMachine(machine: StateMachine): string[] {
  const issues: string[] = [];
  if (machine.states.length === 0) issues.push("state machine has no states");
  if (!machine.currentStateId) issues.push("state machine has no current state");
  const initial = machine.states.find((s) => s.config.isInitial);
  if (!initial) issues.push("state machine has no initial state");
  for (const t of machine.transitions) {
    if (!machine.states.some((s) => s.id === t.fromStateId)) {
      issues.push(`transition ${t.id} references unknown fromState`);
    }
    if (!machine.states.some((s) => s.id === t.toStateId)) {
      issues.push(`transition ${t.id} references unknown toState`);
    }
    if (!machine.inputs.some((i) => i.name === t.inputName)) {
      issues.push(`transition ${t.id} references unknown input "${t.inputName}"`);
    }
  }
  return issues;
}

/** Produce a compact text summary of a state machine for the Agent. */
export function summarizeStateMachine(machine: StateMachine): string {
  const currentState = machine.states.find((s) => s.id === machine.currentStateId);
  return `${machine.name} (${machine.states.length} states, ${machine.transitions.length} transitions, ${machine.inputs.length} inputs) — current: ${currentState?.name ?? "none"}. States: ${machine.states.map((s) => s.name).join(", ")}. Inputs: ${machine.inputs.map((i) => `${i.name}:${i.type}`).join(", ")}.`;
}
