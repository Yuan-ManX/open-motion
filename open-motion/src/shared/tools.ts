import { z } from "zod";
import { EasingSchema } from "./motion/easing.js";
import { KeyValueSchema, TransformPropertySchema } from "./motion/transform.js";
import { IterationCountSchema, DirectionSchema, FillModeSchema, PlayStateSchema } from "./motion/spec.js";

const zIdField = z.string().min(1);

/* ----------------------------- Query tools ----------------------------- */
export const GetMotionSpecInput = z.object({
  projectId: zIdField,
});

export const ListTemplatesInput = z.object({
  category: z.string().optional(),
  tag: z.string().optional(),
});

export const SetTemplateInput = z.object({
  projectId: zIdField,
  templateId: zIdField,
});

export const PreviewUrlInput = z.object({
  projectId: zIdField,
});

/* ----------------------------- Structure tools ----------------------------- */
export const AddLayerInput = z.object({
  projectId: zIdField,
  sceneId: z.string().optional(),
  name: z.string(),
  selector: z.string().optional(),
  templateId: z.string().optional(),
});

export const RemoveComponentInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
});

export const AddSceneInput = z.object({
  projectId: zIdField,
  name: z.string(),
  durationMs: z.number().int().positive().optional(),
});

/* ----------------------------- Tuning tools ----------------------------- */
export const SetEasingInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  easing: EasingSchema,
});

export const SetSpringInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  stiffness: z.number().positive(),
  damping: z.number().nonnegative(),
  mass: z.number().positive().default(1),
});

export const SetDurationInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  durationMs: z.number().int().positive(),
});

export const SetDelayInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  delayMs: z.number().int().nonnegative(),
});

export const SetTransformInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  property: TransformPropertySchema,
  keyframes: z.array(
    z.object({
      offset: z.number().min(0).max(1),
      value: KeyValueSchema,
      easing: EasingSchema.optional(),
    }),
  ),
});

export const SetKeyframeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  property: TransformPropertySchema,
  offset: z.number().min(0).max(1),
  value: KeyValueSchema,
  easing: EasingSchema.optional(),
});

export const SetLoopInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  iterationCount: z.union([z.number().int().positive(), z.literal("infinite")]),
  direction: z
    .enum(["normal", "reverse", "alternate", "alternate-reverse"])
    .optional(),
});

export const SetFillModeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  fillMode: z.enum(["none", "forwards", "backwards", "both"]),
});

export const SetColorInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  color: z.string(),
  target: z.enum(["text", "background"]).default("text"),
});

export const SetStaticStyleInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  style: z.record(z.string(), z.union([z.string(), z.number()])),
});

export const SetGlobalTimingInput = z.object({
  projectId: zIdField,
  totalDurationMs: z.number().int().positive().optional(),
});

/* ----------------------------- Multi-component tools ----------------------------- */
export const BatchUpdateInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(1),
  easing: EasingSchema.optional(),
  durationMs: z.number().int().positive().optional(),
  delayMs: z.number().int().nonnegative().optional(),
  iterationCount: IterationCountSchema.optional(),
  direction: DirectionSchema.optional(),
  fillMode: FillModeSchema.optional(),
});

export const ApplyPresetInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  preset: z.enum(["shake", "wiggle", "float", "glow", "heartbeat", "typewriter"]),
});

export const DuplicateComponentInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  name: z.string().optional(),
});

export const ReorderComponentsInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(1),
});

export const SetPlayStateInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  playState: PlayStateSchema,
});

/* ----------------------------- Analysis tools ----------------------------- */
export const DescribeMotionInput = z.object({
  projectId: zIdField,
  componentId: z.string().optional(),
});

/* ----------------------------- Scene tools ----------------------------- */
export const ListScenesInput = z.object({
  projectId: zIdField,
});

export const RemoveSceneInput = z.object({
  projectId: zIdField,
  sceneId: zIdField,
});

/* ----------------------------- Export tools ----------------------------- */
export const ExportHtmlInput = z.object({
  projectId: zIdField,
});

export const ExportVideoInput = z.object({
  projectId: zIdField,
  format: z.enum(["mp4", "gif", "webm"]).default("mp4"),
});

export const ExportSkillInput = z.object({
  projectId: zIdField,
  componentId: z.string().optional(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
});

export const ExportCodeInput = z.object({
  projectId: zIdField,
  format: z.enum(["css", "json", "react"]).default("css"),
});

/** Tool-name → input schema registry. The agent and MCP layer both consume this. */
export const TOOL_INPUT_SCHEMAS = {
  get_motion_spec: GetMotionSpecInput,
  list_templates: ListTemplatesInput,
  set_template: SetTemplateInput,
  preview_url: PreviewUrlInput,
  add_layer: AddLayerInput,
  remove_component: RemoveComponentInput,
  add_scene: AddSceneInput,
  set_easing: SetEasingInput,
  set_spring: SetSpringInput,
  set_duration: SetDurationInput,
  set_delay: SetDelayInput,
  set_transform: SetTransformInput,
  set_keyframe: SetKeyframeInput,
  set_loop: SetLoopInput,
  set_fill_mode: SetFillModeInput,
  set_color: SetColorInput,
  set_static_style: SetStaticStyleInput,
  set_global_timing: SetGlobalTimingInput,
  batch_update: BatchUpdateInput,
  apply_preset: ApplyPresetInput,
  duplicate_component: DuplicateComponentInput,
  reorder_components: ReorderComponentsInput,
  set_play_state: SetPlayStateInput,
  describe_motion: DescribeMotionInput,
  list_scenes: ListScenesInput,
  remove_scene: RemoveSceneInput,
  export_html: ExportHtmlInput,
  export_video: ExportVideoInput,
  export_skill: ExportSkillInput,
  export_code: ExportCodeInput,
} as const;

export type ToolName = keyof typeof TOOL_INPUT_SCHEMAS;
export type ToolInput<T extends ToolName> = z.infer<(typeof TOOL_INPUT_SCHEMAS)[T]>;

export const TOOL_NAMES = Object.keys(TOOL_INPUT_SCHEMAS) as ToolName[];

/** Human-readable descriptions, surfaced to the LLM as tool metadata. */
export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  get_motion_spec: "Get the current assembled MotionSpec (project + all components). Use to ground your understanding before editing.",
  list_templates: "List available motion templates, optionally filtered by category or tag.",
  set_template: "Reset a project's motion to a chosen template. Use when the user wants to start over from a template.",
  preview_url: "Get a URL where the live animation can be viewed in a browser.",
  add_layer: "Add a new animatable component (layer) to a project. Returns the new componentId.",
  remove_component: "Remove a component from a project.",
  add_scene: "Add a new scene to a multi-scene project.",
  set_easing: "Set the easing curve of a component (preset | bezier | spring). Use for 'make it bouncy / smooth / snappy'.",
  set_spring: "Convenience: set a spring easing with stiffness, damping, and mass.",
  set_duration: "Set the animation duration in milliseconds. Use for 'slower / faster'.",
  set_delay: "Set the animation delay (start offset) in milliseconds.",
  set_transform: "Set a full keyframe track for one animatable property of a component.",
  set_keyframe: "Add or replace a single keyframe for one property at a given offset (0..1).",
  set_loop: "Set iteration count and optionally direction. Use for 'loop forever / repeat 3 times'.",
  set_fill_mode: "Set the CSS fill mode (none | forwards | backwards | both).",
  set_color: "Set a static color on a component (text or background).",
  set_static_style: "Set arbitrary static CSS style on a component (size, position, radius, background...).",
  set_global_timing: "Set project-level total duration.",
  batch_update: "Apply the same patch (easing, duration, delay, loop, direction, fill mode) to multiple components at once.",
  apply_preset: "Apply a named animation preset (shake, wiggle, float, glow, heartbeat, typewriter) to a component.",
  duplicate_component: "Duplicate an existing component with a new ID. Optionally set a custom name.",
  reorder_components: "Set the z-order of components by providing their IDs in the desired order.",
  set_play_state: "Set the play state of a component (running or paused).",
  describe_motion: "Analyze the current motion and produce a natural-language description plus a compact Motion DNA signature (e.g. BOUNCE|NORMAL|LOOP∞|SCALE+OPACITY|FWD). Use when the user asks 'what does this look like' or 'describe this motion'.",
  list_scenes: "List all scenes in a multi-scene project with their component counts.",
  remove_scene: "Remove a scene and all components assigned to it.",
  export_html: "Export the project as a standalone, runnable HTML file. Returns a URL.",
  export_video: "Export the project as a video (mp4 | gif | webm). Returns a jobId to poll.",
  export_skill: "Package the project (or a single component) as a reusable AI-callable skill. Returns a skillId.",
  export_code: "Export animation code as CSS, JSON, or React (format: css | json | react). Returns the generated code string.",
};
