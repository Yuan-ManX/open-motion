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

/* --------------------------- Composition tools --------------------------- */
export const StaggerComponentsInput = z.object({
  projectId: zIdField,
  stepMs: z.number().int().min(10).max(5000).default(100),
  startMs: z.number().int().min(0).max(10000).optional(),
  direction: z.enum(["forward", "reverse", "center"]).default("forward"),
});

export const MatchTemplateInput = z.object({
  projectId: zIdField,
  hint: z.string().optional(),
});

export const CreateVariantInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  easing: EasingSchema.optional(),
  durationMs: z.number().int().min(50).max(60000).optional(),
  scale: z.number().min(0.1).max(10).optional(),
});

/* --------------------------- Intelligence tools --------------------------- */
export const AnalyzeMotionInput = z.object({
  projectId: zIdField,
  componentId: z.string().optional(),
});

export const SuggestNextInput = z.object({
  projectId: zIdField,
});

/* --------------------------- Motion path tools --------------------------- */
export const SetMotionPathInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  pathType: z.enum(["line", "circle", "ellipse", "bezier"]),
  // Line: from → to coordinates
  fromX: z.number().optional(),
  fromY: z.number().optional(),
  toX: z.number().optional(),
  toY: z.number().optional(),
  // Circle / ellipse: radius and center
  centerX: z.number().optional(),
  centerY: z.number().optional(),
  radiusX: z.number().optional(),
  radiusY: z.number().optional(),
  // Bezier: control points
  cp1X: z.number().optional(),
  cp1Y: z.number().optional(),
  cp2X: z.number().optional(),
  cp2Y: z.number().optional(),
  steps: z.number().int().min(8).max(60).default(20),
  durationMs: z.number().int().min(100).max(30000).optional(),
});

/* --------------------------- Style preset tools --------------------------- */
export const ApplyStyleInput = z.object({
  projectId: zIdField,
  styleId: z.enum(["playful", "energetic", "calm", "professional", "dramatic", "minimal"]),
});

/* ------------------------- Pattern recognition tool ------------------------ */
export const RecognizePatternInput = z.object({
  projectId: zIdField,
});

/* --------------------------- Color harmony tool --------------------------- */
export const HarmonizeColorsInput = z.object({
  projectId: zIdField,
  scheme: z.enum(["complementary", "analogous", "triadic", "monochrome"]).default("analogous"),
  baseColor: z.string().regex(/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/).optional(),
});

/* --------------------------- Choreography tool --------------------------- */
export const ChoreographInput = z.object({
  projectId: zIdField,
  pattern: z.enum(["cascade", "wave", "ripple", "canon", "converge"]),
  stepMs: z.number().int().min(20).max(2000).default(150),
  durationMs: z.number().int().min(100).max(10000).optional(),
});

/* --------------------------- Motion refinement tool --------------------------- */
export const RefineMotionInput = z.object({
  projectId: zIdField,
  componentId: z.string().optional(),
  refinement: z.enum(["snappier", "smoother", "more-dramatic", "calmer", "subtler", "more-energetic", "bouncier", "softer"]),
});

export const SetCustomBezierInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  x1: z.number().min(-0.2).max(1.2),
  y1: z.number().min(-0.2).max(1.2),
  x2: z.number().min(-0.2).max(1.2),
  y2: z.number().min(-0.2).max(1.2),
});

export const SetInterpolationInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  keyframeIndex: z.number().int().min(0),
  interpolation: z.enum(["linear", "ease", "hold"]),
});

export const AddPropertyKeyframeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  property: z.string(),
  offset: z.number().min(0).max(1),
  value: z.union([z.string(), z.number()]),
});

export const RemoveKeyframeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  keyframeIndex: z.number().int().min(0),
});

export const SetTriggerInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  trigger: z.enum(["onLoad", "onClick", "onHover", "onScroll", "afterDelay"]),
});

export const SetOnionSkinInput = z.object({
  projectId: zIdField,
  enabled: z.boolean(),
  frames: z.number().int().min(1).max(8).default(3),
  opacity: z.number().min(0.05).max(0.8).default(0.25),
});

export const PreviewFullscreenInput = z.object({
  projectId: zIdField,
  componentId: z.string().optional(),
});

/* ----------------------------- Editor UI tools ----------------------------- */
export const SetCanvasViewInput = z.object({
  projectId: zIdField,
  pan: z.object({ x: z.number(), y: z.number() }).optional(),
  zoom: z.number().min(0.1).max(5).optional(),
  fit: z.boolean().optional(),
});

export const LockLayerInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  locked: z.boolean().default(true),
});

export const SetPlaybackRangeInput = z.object({
  projectId: zIdField,
  startMs: z.number().int().min(0).optional(),
  endMs: z.number().int().positive().optional(),
  clear: z.boolean().optional(),
});

export const SelectComponentsInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).default([]),
  clear: z.boolean().default(true),
});

export const ToggleSnapInput = z.object({
  projectId: zIdField,
  enabled: z.boolean().default(true),
  size: z.number().int().min(1).max(50).optional(),
});

export const SetRulersInput = z.object({
  projectId: zIdField,
  show: z.boolean().default(true),
});

/* --------------------------- Editor data tools --------------------------- */
export const SetZOrderInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  action: z.enum(["forward", "backward", "to-front", "to-back"]),
});

export const SetTransformPropsInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  rotation: z.number().optional(),
});

export const AlignComponentsInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(2),
  align: z.enum(["left", "center", "right", "top", "middle", "bottom", "distribute-h", "distribute-v"]),
});

export const AddShapeInput = z.object({
  projectId: zIdField,
  shape: z.enum(["rectangle", "circle", "text", "triangle", "star", "polygon", "line", "arrow"]),
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const SetBlendModeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  blendMode: z.enum([
    "normal", "multiply", "screen", "overlay", "darken", "lighten",
    "color-dodge", "color-burn", "hard-light", "soft-light",
    "difference", "exclusion", "hue", "saturation", "color", "luminosity",
  ]),
});

export const SetArtboardInput = z.object({
  projectId: zIdField,
  width: z.number().int().min(64).max(4096).optional(),
  height: z.number().int().min(64).max(4096).optional(),
  background: z.string().optional(),
});

export const SetLayerOpacityInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  opacity: z.number().min(0).max(1),
});

/* --------------------------- Direct manipulation tools --------------------------- */
export const NudgeComponentInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  dx: z.number(),
  dy: z.number(),
});

export const CopyToClipboardInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).optional(),
});

export const PasteFromClipboardInput = z.object({
  projectId: zIdField,
  x: z.number().optional(),
  y: z.number().optional(),
});

/* --------------------------- State machine tools --------------------------- */
export const CaptureStateInput = z.object({
  projectId: zIdField,
  name: z.string(),
});

export const ApplyStateInput = z.object({
  projectId: zIdField,
  stateId: zIdField,
});

export const AddTransitionInput = z.object({
  projectId: zIdField,
  fromStateId: zIdField,
  toStateId: zIdField,
  trigger: z.enum(["onClick", "onHover", "onLoad", "manual"]).default("manual"),
  durationMs: z.number().int().min(50).max(10000).default(500),
});

export const RemoveStateInput = z.object({
  projectId: zIdField,
  stateId: zIdField,
});

export const ListStatesInput = z.object({
  projectId: zIdField,
});

/* --------------------------- Interactive tools -------------------------- */
export const ToggleAutoKeyframeInput = z.object({
  projectId: zIdField,
  enabled: z.boolean().optional(),
});

export const AddListenerInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  eventType: z.enum(["pointerEnter", "pointerLeave", "pointerDown", "pointerUp", "click"]),
  actionType: z.enum(["applyState", "playAnimation", "setProperty"]),
  target: zIdField,
  property: z.string().optional(),
  value: z.union([z.string(), z.number()]).optional(),
});

export const RemoveListenerInput = z.object({
  projectId: zIdField,
  listenerId: zIdField,
});

export const ListListenersInput = z.object({
  projectId: zIdField,
  componentId: z.string().optional(),
});

export const SetKeyframeOffsetInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  keyframeIndex: z.number().int().min(0),
  offset: z.number().min(0).max(1),
});

/* --------------------------- Marker tools --------------------------- */
export const AddMarkerInput = z.object({
  projectId: zIdField,
  timeMs: z.number().min(0),
  label: z.string().optional(),
});

export const RemoveMarkerInput = z.object({
  projectId: zIdField,
  markerId: zIdField,
});

export const ListMarkersInput = z.object({
  projectId: zIdField,
});

/* ----------------------- Keyframe operation tools ----------------------- */
export const ReverseKeyframesInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
});

/* --------------------------- Solo layer tool --------------------------- */
export const SoloLayerInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
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

/* --------------------------- Hierarchy / rigging tools --------------------------- */
export const SetParentInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  parentId: zIdField,
});

export const RemoveParentInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
});

export const ListHierarchyInput = z.object({
  projectId: zIdField,
});

/* --------------------------- Constraint tools --------------------------- */
export const AddConstraintInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  targetId: zIdField,
  type: z.enum(["position", "rotation", "scale", "look-at"]),
  strength: z.number().min(0).max(1).default(1),
  axis: z.enum(["x", "y", "both"]).default("both"),
});

export const RemoveConstraintInput = z.object({
  projectId: zIdField,
  constraintId: zIdField,
});

export const ListConstraintsInput = z.object({
  projectId: zIdField,
});

/* --------------------------- Timeline clip tools --------------------------- */
export const AddClipInput = z.object({
  projectId: zIdField,
  name: z.string(),
  startMs: z.number().int().min(0),
  endMs: z.number().int().positive(),
  color: z.string().optional(),
});

export const RemoveClipInput = z.object({
  projectId: zIdField,
  clipId: zIdField,
});

export const ListClipsInput = z.object({
  projectId: zIdField,
});

export const PlayClipInput = z.object({
  projectId: zIdField,
  clipId: zIdField,
});

/* --------------------------- Filter / shader tools --------------------------- */
export const SetFilterInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  filter: z.string(),
  value: z.union([z.string(), z.number()]),
});

/* --------------------------- 3D transform tools --------------------------- */
export const Set3DTransformInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  perspective: z.number().optional(),
  rotateX: z.number().optional(),
  rotateY: z.number().optional(),
  rotateZ: z.number().optional(),
  translateZ: z.number().optional(),
});

/* --------------------------- Restraint engine tools --------------------------- */
export const AnalyzeRestraintInput = z.object({
  projectId: zIdField,
});

/* --------------------------- Motion recipe tools --------------------------- */
export const ListRecipesInput = z.object({
  category: z.string().optional(),
  query: z.string().optional(),
});

export const ApplyRecipeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  recipeId: zIdField,
});

/* --------------------------- Memory tools --------------------------- */
export const SaveMemoryInput = z.object({
  projectId: zIdField,
  key: z.string(),
  value: z.string(),
  tags: z.array(z.string()).optional(),
});

export const RecallMemoryInput = z.object({
  projectId: zIdField,
  query: z.string(),
});

export const ListGeneratedSkillsInput = z.object({
  projectId: zIdField.optional(),
  limit: z.number().int().min(1).max(50).default(10),
});

/* --------------------------- Grammar tools --------------------------- */
export const CompileGrammarInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  source: z.string().min(1).describe("Motion grammar expression, e.g. fade.in(600ms) then slide.up(400ms) with easing(spring)"),
});

export const ParseMotionInput = z.object({
  projectId: zIdField,
  description: z.string().min(1).describe("Natural language motion description, e.g. 'make it bounce in playfully with spring physics'"),
  componentId: zIdField.optional(),
});

/* --------------------------- Shader tools --------------------------- */
export const SetShaderEffectInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  effectId: z.string().describe("Shader effect ID: shader-chromatic, shader-glitch, shader-plasma, shader-noise, shader-ripple, shader-vignette, shader-neon-glow, shader-pixelate, shader-gradient-shift, shader-invert-pulse"),
  intensity: z.number().min(0).max(5).optional(),
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
  stagger_components: StaggerComponentsInput,
  match_template: MatchTemplateInput,
  create_variant: CreateVariantInput,
  analyze_motion: AnalyzeMotionInput,
  suggest_next: SuggestNextInput,
  set_motion_path: SetMotionPathInput,
  apply_style: ApplyStyleInput,
  recognize_pattern: RecognizePatternInput,
  harmonize_colors: HarmonizeColorsInput,
  choreograph: ChoreographInput,
  refine_motion: RefineMotionInput,
  set_custom_bezier: SetCustomBezierInput,
  set_interpolation: SetInterpolationInput,
  add_property_keyframe: AddPropertyKeyframeInput,
  remove_keyframe: RemoveKeyframeInput,
  set_trigger: SetTriggerInput,
  set_onion_skin: SetOnionSkinInput,
  preview_fullscreen: PreviewFullscreenInput,
  set_canvas_view: SetCanvasViewInput,
  lock_layer: LockLayerInput,
  set_z_order: SetZOrderInput,
  set_transform_props: SetTransformPropsInput,
  align_components: AlignComponentsInput,
  set_playback_range: SetPlaybackRangeInput,
  select_components: SelectComponentsInput,
  toggle_snap: ToggleSnapInput,
  add_shape: AddShapeInput,
  set_blend_mode: SetBlendModeInput,
  set_artboard: SetArtboardInput,
  set_layer_opacity: SetLayerOpacityInput,
  set_rulers: SetRulersInput,
  nudge_component: NudgeComponentInput,
  copy_to_clipboard: CopyToClipboardInput,
  paste_from_clipboard: PasteFromClipboardInput,
  capture_state: CaptureStateInput,
  apply_state: ApplyStateInput,
  add_transition: AddTransitionInput,
  remove_state: RemoveStateInput,
  list_states: ListStatesInput,
  toggle_auto_keyframe: ToggleAutoKeyframeInput,
  add_listener: AddListenerInput,
  remove_listener: RemoveListenerInput,
  list_listeners: ListListenersInput,
  set_keyframe_offset: SetKeyframeOffsetInput,
  add_marker: AddMarkerInput,
  remove_marker: RemoveMarkerInput,
  list_markers: ListMarkersInput,
  reverse_keyframes: ReverseKeyframesInput,
  solo_layer: SoloLayerInput,
  export_html: ExportHtmlInput,
  export_video: ExportVideoInput,
  export_skill: ExportSkillInput,
  export_code: ExportCodeInput,
  set_parent: SetParentInput,
  remove_parent: RemoveParentInput,
  list_hierarchy: ListHierarchyInput,
  add_constraint: AddConstraintInput,
  remove_constraint: RemoveConstraintInput,
  list_constraints: ListConstraintsInput,
  add_clip: AddClipInput,
  remove_clip: RemoveClipInput,
  list_clips: ListClipsInput,
  play_clip: PlayClipInput,
  set_filter: SetFilterInput,
  set_3d_transform: Set3DTransformInput,
  analyze_restraint: AnalyzeRestraintInput,
  list_recipes: ListRecipesInput,
  apply_recipe: ApplyRecipeInput,
  save_memory: SaveMemoryInput,
  recall_memory: RecallMemoryInput,
  list_generated_skills: ListGeneratedSkillsInput,
  compile_grammar: CompileGrammarInput,
  parse_motion: ParseMotionInput,
  set_shader_effect: SetShaderEffectInput,
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
  stagger_components: "Create a cascading delay effect across all components so they animate in sequence. Supports forward, reverse, and center directions. Use when the user says 'stagger', 'cascade', 'sequence', or 'one by one'.",
  match_template: "Find the closest matching template to the user's described motion or the current project state. Returns ranked suggestions with match scores. Use when the user says 'find a template' or 'what template fits'.",
  create_variant: "Create a variation of an existing component with different easing, duration, or property scale. The original is preserved. Use when the user says 'try a variation' or 'what would this look like with different easing'.",
  analyze_motion: "Analyze the current motion design for quality, timing, accessibility, and composition issues. Returns a list of insights with severity levels (info/warning/critical) and actionable suggestions. Use when the user asks 'is this good', 'analyze', 'review', or 'critique my motion'.",
  suggest_next: "Generate 3-5 context-aware next-step suggestions based on the current project state. Returns suggestion text and a priority level. Use when the user asks 'what should I do next', 'suggest', or 'ideas'.",
  set_motion_path: "Animate a component along a custom path (line, circle, ellipse, or bezier curve). Generates keyframes for translateX/translateY along the path. Use when the user says 'move in a circle', 'animate along a path', or 'orbit around a point'.",
  apply_style: "Apply a coordinated motion style preset (playful, energetic, calm, professional, dramatic, minimal) across ALL components. Adjusts easing, duration, loop, and direction for a coherent aesthetic. Use when the user says 'make it playful', 'give it a professional feel', or 'style the whole project'.",
  recognize_pattern: "Identify motion design patterns and anti-patterns in the project — monotony, incomplete lifecycle, timing uniformity, motion overload, and dominant category. Returns pattern observations with recommendations. Use when the user asks 'what patterns do you see' or 'is the composition balanced'.",
  harmonize_colors: "Apply color theory to adjust component colors for visual harmony. Supports complementary, analogous, triadic, and monochrome schemes. Use when the user says 'harmonize colors', 'make colors work together', or 'apply a color scheme'.",
  choreograph: "Apply a choreographic pattern across all components — cascade (sequential), wave (sine-wave delays), ripple (center-out), canon (offset repetition), converge (all converge to endpoint). Sets delays and adjusts durations for visual rhythm. Use when the user says 'choreograph', 'orchestrate', 'wave pattern', or 'ripple effect'.",
  refine_motion: "Refine motion with qualitative descriptors — snappier, smoother, more-dramatic, calmer, subtler, more-energetic, bouncier, softer. Applies targeted easing, duration, and loop changes. Use on a single component or project-wide. Use when the user says 'make it snappier', 'smoother', 'more dramatic', or 'calmer'.",
  set_custom_bezier: "Set a custom cubic-bezier easing curve on a component. Takes four control points (x1, y1, x2, y2) in the 0..1 range. Y-values beyond 0..1 create overshoot/wind-up. Use when the user says 'custom easing', 'bezier curve', or gives specific cubic-bezier values.",
  set_interpolation: "Set the interpolation type for a specific keyframe — linear (constant speed), ease (smooth), or hold (instant jump, no transition). Use when the user says 'make this keyframe hold' or 'linear interpolation'.",
  add_property_keyframe: "Add a keyframe for a specific animatable property (e.g., translateX, opacity, scale, rotate) at a given offset (0..1) with a value. Use when the user says 'add a keyframe for opacity at the halfway point' or 'keyframe the scale at 50%'.",
  remove_keyframe: "Remove a keyframe at a specific index from a component. Use when the user says 'delete the second keyframe' or 'remove that keyframe'.",
  set_trigger: "Set the trigger that starts the animation — onLoad (play immediately), onClick (play on user click), onHover (play on mouse hover), onScroll (play when scrolled into view), or afterDelay (play after the delay timer). Use when the user says 'trigger on click', 'play on hover', or 'animate on scroll'.",
  set_onion_skin: "Toggle onion skinning on the canvas — shows ghost overlays of the component at adjacent keyframe positions for visual reference. Takes enabled flag, number of ghost frames (1-8), and opacity (0.05-0.8). Use when the user says 'show onion skin', 'turn on ghost frames', or 'show motion trail'.",
  preview_fullscreen: "Open the animation in a fullscreen preview overlay without editor chrome. Optionally focus a single component. Use when the user says 'preview fullscreen', 'show me full screen', or 'present the animation'.",
  set_canvas_view: "Control the canvas viewport — zoom (0.1-5), pan (x/y offset), or fit-to-screen. Use when the user says 'zoom in', 'zoom out', 'fit to screen', 'reset view', or 'pan canvas'.",
  lock_layer: "Lock or unlock a layer to prevent selection and editing. Takes componentId and locked boolean. Use when the user says 'lock this layer' or 'unlock the layer'.",
  set_z_order: "Reorder a component's z-position — forward (up one), backward (down one), to-front (top), to-back (bottom). Use when the user says 'bring to front', 'send to back', 'move forward', or 'move backward'.",
  set_transform_props: "Set static transform properties on a component — X position, Y position, width, height, rotation (degrees). Use when the user says 'set position to X 100', 'resize to 200x100', or 'rotate 45 degrees'.",
  align_components: "Align or distribute 2+ components — left, center, right, top, middle, bottom, distribute-h, distribute-v. Use when the user says 'align left', 'align center', 'distribute horizontally', or 'align top'.",
  set_playback_range: "Set or clear the playback time range (in/out points in ms). When set, playback loops within the range. Use when the user says 'set playback range', 'trim to 500-2000ms', or 'clear range'.",
  select_components: "Select multiple components by id, optionally clearing existing selection first. Use when the user says 'select all', 'select multiple', or 'select these layers'.",
  toggle_snap: "Enable or disable snap-to-grid with optional grid size (1-50px). Use when the user says 'turn on snap', 'disable snapping', or 'set grid size to 16'.",
  add_shape: "Add a shape to the canvas — rectangle, circle, text, triangle, star, pentagon, line, or arrow. Optionally set position (x/y) and size (width/height). Use when the user says 'add a rectangle', 'create a star', or 'add an arrow'.",
  set_blend_mode: "Set a component's CSS blend mode (mixBlendMode). 16 modes: normal, multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity. Use when the user says 'set blend mode to multiply' or 'blend with screen'.",
  set_artboard: "Set the artboard (canvas) dimensions and background color. Width/height in pixels (64-4096). Use when the user says 'set canvas to 800x600', 'make the canvas wider', or 'set background to black'.",
  set_layer_opacity: "Set a layer's opacity (0-1 where 1 is fully opaque). Use when the user says 'set opacity to 50%', 'make it semi-transparent', or 'opacity 0.8'.",
  set_rulers: "Show or hide canvas rulers. Use when the user says 'show rulers', 'hide rulers', or 'toggle rulers'.",
  nudge_component: "Move a component by a pixel delta (dx, dy). Positive dx moves right, positive dy moves down. Use when the user says 'nudge', 'move by 10px', 'shift left', or gives small position adjustments.",
  copy_to_clipboard: "Copy the selected component(s) to the internal clipboard for later pasting. Use when the user says 'copy', 'copy this', or 'copy the selection'.",
  paste_from_clipboard: "Paste the clipboard contents at an optional position (x, y). Creates new components from the clipboard entries. Use when the user says 'paste', 'paste here', or 'paste a copy'.",
  capture_state: "Capture the current component positions and styles as a named state in the project's state machine. States are snapshots that can be applied later for interactive transitions. Use when the user says 'save state', 'capture state', 'snapshot this', or 'remember this position'.",
  apply_state: "Apply a previously captured state by its ID — restores all component positions and styles to the state snapshot. Use when the user says 'apply state', 'go to state', 'switch to state', or 'restore state'.",
  add_transition: "Define a transition between two states with a trigger (onClick, onHover, onLoad, manual) and duration. Use when the user says 'add transition', 'connect states', 'on click go to', or 'transition from A to B'.",
  remove_state: "Remove a named state and all its associated transitions from the state machine. Use when the user says 'delete state', 'remove state', or 'delete that snapshot'.",
  list_states: "List all states and transitions in the project's state machine. Returns state names, IDs, component counts, and transition details. Use when the user says 'list states', 'show states', 'what states exist', or 'state machine info'.",
  toggle_auto_keyframe: "Toggle auto-keyframe mode on or off. When enabled, property changes in the inspector automatically create keyframes at the current playhead position. Use when the user says 'auto-keyframe', 'record keyframes', or 'keyframe mode'.",
  add_listener: "Attach an event listener to a component (pointerEnter, pointerLeave, pointerDown, pointerUp, click) that triggers an action (applyState, playAnimation, setProperty) on a target. Use when the user says 'add a listener', 'on click trigger', or 'event listener'.",
  remove_listener: "Remove an event listener by its ID. Use when the user says 'remove listener', 'delete listener', or 'remove the event handler'.",
  list_listeners: "List all event listeners in the project, optionally filtered by component. Returns listener IDs, event types, and action details. Use when the user says 'list listeners', 'show listeners', or 'what listeners exist'.",
  set_keyframe_offset: "Move a keyframe to a new time position (offset 0..1). Re-sorts keyframes automatically. Use when the user says 'move the keyframe', 'retime this keyframe', or 'shift the keyframe to 50%'.",
  add_marker: "Add a labeled bookmark marker at a specific time (in ms) on the timeline. Use for 'mark this point', 'add a marker at 500ms'.",
  remove_marker: "Remove a timeline marker by its ID.",
  list_markers: "List all timeline markers in the project.",
  reverse_keyframes: "Reverse the keyframe order of a component — swap offsets so the animation plays backward. Use for 'reverse the keyframes', 'play backward'.",
  solo_layer: "Solo a layer — hides all other components so only this one is visible. Use for 'solo this layer', 'isolate this component'.",
  export_html: "Export the project as a standalone, runnable HTML file. Returns a URL.",
  export_video: "Export the project as a video (mp4 | gif | webm). Returns a jobId to poll.",
  export_skill: "Package the project (or a single component) as a reusable AI-callable skill. Returns a skillId.",
  export_code: "Export animation code as CSS, JSON, or React (format: css | json | react). Returns the generated code string.",
  set_parent: "Set a component's parent, creating a parent-child hierarchy. The child inherits the parent's transforms (rigging/bone system). Use for 'parent to', 'attach to', 'nest under', 'rig'.",
  remove_parent: "Remove a component's parent, detaching it from the hierarchy. Use for 'detach', 'remove parent', 'orphan'.",
  list_hierarchy: "List the layer hierarchy tree showing root components and their children. Use for 'show hierarchy', 'list tree', 'show parents'.",
  add_constraint: "Add a constraint between two components (position, rotation, scale, look-at). Strength 0-1, axis x/y/both. Use for 'pin to', 'follow', 'constrain', 'look at'.",
  remove_constraint: "Remove a constraint by its ID.",
  list_constraints: "List all constraints in the project.",
  add_clip: "Add a named timeline clip (animation segment) with start and end times in ms. Use for 'add a clip', 'create a segment', 'section'.",
  remove_clip: "Remove a timeline clip by its ID.",
  list_clips: "List all timeline clips in the project.",
  play_clip: "Trigger playback of a specific timeline clip. Use for 'play clip', 'trigger segment'.",
  set_filter: "Apply a CSS filter effect (blur, brightness, contrast, hue-rotate, saturate, grayscale, sepia) to a component. Stacks with existing filters.",
  set_3d_transform: "Apply 3D transform properties (perspective, rotateX, rotateY, rotateZ, translateZ) to a component for depth effects.",
  analyze_restraint: "Analyze motion density and restraint — calculates how many animations compete for attention simultaneously, identifies easing/duration monotony, and recommends improvements. Returns a restraint score (0-100) with warnings. Use when the user asks 'is this too much', 'analyze restraint', or 'check density'.",
  list_recipes: "Browse the curated motion recipe library. Each recipe carries avoid_when metadata — situations where it should NOT be used. Optionally filter by category or search by query. Returns recipe names, descriptions, restraint costs, and avoidance conditions.",
  apply_recipe: "Apply a curated motion recipe to a component. Recipes include pre-configured easing, keyframes, and timing. The system checks avoid_when conditions before applying. Use when the user says 'apply a recipe', 'use a gentle entrance', or 'try a cinematic fade'.",
  save_memory: "Save a persistent memory entry for the project — cross-session knowledge that the agent recalls in future interactions. Use for storing user preferences, design decisions, or project context.",
  recall_memory: "Search persistent project memory for entries matching a query. Returns relevant memories from past sessions. Use when the user says 'what did we decide', 'remember', or 'what do you know about this project'.",
  list_generated_skills: "List skills auto-generated by the agent from past successful task sequences. Each skill captures a reusable tool pattern. Use when the user asks 'what have you learned' or 'show me generated skills'.",
  compile_grammar: "Compile a motion grammar expression into motion specs. Supports verbs (fade, slide, bounce, rotate, scale, spin, pulse, flip, shake, glow, float, blur, skew, wiggle, heartbeat, typewriter, drift, swing, drop), directions (in/out/up/down/left/right/cw/ccw), and parameters (duration, easing, loop, delay). Example: 'fade.in(600ms) then slide.up(400ms) with easing(spring)'. Use when the user writes a grammar expression or says 'compile this motion'.",
  parse_motion: "Parse a natural language motion description into a structured motion spec. Extracts easing, duration, keyframes, and properties from descriptions like 'make it bounce in playfully with spring physics'. Use when the user describes a motion in natural language and you need to translate it into a spec.",
  set_shader_effect: "Apply a WebGL shader effect to a component. Available effects: shader-chromatic (RGB split), shader-glitch (displacement blocks), shader-plasma (animated plasma field), shader-noise (film grain), shader-ripple (concentric distortion), shader-vignette (darkened edges), shader-neon-glow (pulsing neon), shader-pixelate (retro pixels), shader-gradient-shift (animated gradient), shader-invert-pulse (strobe invert). Use when the user says 'shader effect', 'glitch effect', 'neon glow', 'chromatic aberration', or 'plasma'.",
};
