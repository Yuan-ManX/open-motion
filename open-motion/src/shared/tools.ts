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

export const FindSimilarMotionInput = z.object({
  projectId: zIdField,
  componentId: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  threshold: z.number().int().min(0).max(100).optional(),
});

export const GenerateMotionDocsInput = z.object({
  projectId: zIdField,
  format: z.enum(["markdown", "json"]).optional(),
  includeAccessibility: z.boolean().optional(),
  includePerformance: z.boolean().optional(),
  includeStoryboard: z.boolean().optional(),
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
  styleId: z.enum(["playful", "energetic", "calm", "professional", "dramatic", "minimal", "cinematic", "glassy", "retro", "futuristic", "organic", "mechanical", "luxury"]),
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
  pattern: z.enum(["cascade", "wave", "ripple", "canon", "converge", "spiral", "explosion", "assembly", "breathing", "domino", "scatter"]),
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

export const AddImageInput = z.object({
  projectId: zIdField,
  src: z.string().describe("Image URL or data URI"),
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fit: z.enum(["cover", "contain", "fill"]).optional(),
});

export const AddVideoInput = z.object({
  projectId: zIdField,
  src: z.string().describe("Video URL or data URI"),
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  muted: z.boolean().optional(),
  loop: z.boolean().optional(),
  autoplay: z.boolean().optional(),
  delayMs: z.number().int().nonnegative().optional(),
});

export const AddAudioInput = z.object({
  projectId: zIdField,
  src: z.string().describe("Audio URL or data URI"),
  name: z.string().optional(),
  delayMs: z.number().int().nonnegative().optional(),
  loop: z.boolean().optional(),
  muted: z.boolean().optional(),
});

export const AddTypewriterTextInput = z.object({
  projectId: zIdField,
  text: z.string().describe("The full text to reveal character-by-character"),
  name: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  fontSize: z.number().int().positive().optional(),
  color: z.string().optional(),
  charDelayMs: z.number().int().positive().optional().describe("Milliseconds per character (default 60)"),
  cursor: z.boolean().optional().describe("Show a blinking cursor"),
});

export const AddSceneTransitionInput = z.object({
  projectId: zIdField,
  type: z.enum(["dissolve", "wipe-left", "wipe-right", "wipe-up", "wipe-down", "slide-left", "slide-right", "zoom-in", "zoom-out", "flash"]),
  durationMs: z.number().int().positive().optional(),
  delayMs: z.number().int().nonnegative().optional(),
  color: z.string().optional().describe("Transition overlay color (default black)"),
});

export const AddCameraMoveInput = z.object({
  projectId: zIdField,
  type: z.enum(["pan-left", "pan-right", "pan-up", "pan-down", "zoom-in", "zoom-out", "zoom-pan"]),
  durationMs: z.number().int().positive().optional(),
  delayMs: z.number().int().nonnegative().optional(),
  intensity: z.number().min(0.1).max(5).optional().describe("Pan/zoom magnitude (default 1)"),
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

export const ExportLottieInput = z.object({
  projectId: zIdField,
  fps: z.number().int().min(1).max(120).optional().describe("Frame rate (default 60)"),
});

/* --------------------------- Tool pipeline tools --------------------------- */
const PipelineStepSchema = z.object({
  tool: z.string().min(1).describe("Tool name, e.g. 'set_easing'"),
  args: z.record(z.unknown()).describe("Arguments object for the tool"),
  description: z.string().optional().describe("Human-readable note for this step"),
});

export const SavePipelineInput = z.object({
  projectId: zIdField,
  name: z.string().min(1).max(120).describe("Pipeline name, e.g. 'bounce-then-fade'"),
  description: z.string().max(500).optional(),
  steps: z.array(PipelineStepSchema).min(1).describe("Ordered list of tool calls to replay"),
  tags: z.array(z.string()).optional(),
});

export const ListPipelinesInput = z.object({
  projectId: zIdField,
});

export const RunPipelineInput = z.object({
  projectId: zIdField,
  pipelineId: zIdField,
});

export const DeletePipelineInput = z.object({
  projectId: zIdField,
  pipelineId: zIdField,
});

/* --------------------------- Mood intelligence tools --------------------------- */
export const AnalyzeMoodInput = z.object({
  projectId: zIdField,
  componentId: z.string().optional(),
});

export const SetMoodInput = z.object({
  projectId: zIdField,
  mood: z.enum([
    "premium", "playful", "calm", "energetic", "dramatic",
    "minimal", "confident", "gentle", "urgent", "nostalgic",
  ]),
  componentId: z.string().optional(),
  scope: z.enum(["component", "project"]).default("project"),
});

export const SuggestCreativeInput = z.object({
  projectId: zIdField,
  surprise: z.boolean().default(false),
});

/* --------------------------- Visual context tool --------------------------- */
export const AnalyzeVisualContextInput = z.object({
  projectId: zIdField,
  componentId: z.string().optional(),
});

/* --------------------------- Code synthesis tool --------------------------- */
export const SynthesizeCodeInput = z.object({
  projectId: zIdField,
  description: z.string().min(1).describe("Natural language motion description, e.g. 'bounce in playfully with spring physics' or 'smooth fade from left, 600ms'"),
  format: z.enum(["css", "react", "html", "vanilla"]).default("css").describe("Output format: css (@keyframes + class), react (component using Web Animations API), html (standalone file), vanilla (element.animate() snippet)"),
});

/* --------------------------- State machine composer tools --------------------------- */
export const ComposeStateMachineInput = z.object({
  projectId: zIdField,
  name: z.string().min(1).describe("State machine name"),
  description: z.string().optional(),
  presetId: z.enum(["hover-press", "toggle-on-off", "loading-sequence", "carousel", "tab-switch"]).optional().describe("Preset to build from: hover-press (idle/hover/pressed), toggle-on-off (on/off), loading-sequence (idle/loading/success/error), carousel (slides), tab-switch (tabs)"),
  componentIds: z.array(z.string()).default([]).describe("Component IDs governed by the state machine. Pass [] to use all components."),
});

export const ListStateMachinesInput = z.object({
  projectId: zIdField,
});

export const TriggerStateMachineInput = z.object({
  projectId: zIdField,
  machineId: z.string().min(1).describe("State machine ID"),
  stateName: z.string().min(1).describe("Target state name to transition to"),
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

/* --------------------------- Adjustment layer tools --------------------------- */
export const SetAdjustmentLayerInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  enabled: z.boolean().describe("When true, the component becomes an adjustment layer — its filter effects apply to all layers below via backdrop-filter"),
});

/* --------------------------- Pre-composition tools --------------------------- */
export const CreatePrecompInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(1).describe("Component IDs to group into a pre-composition"),
  name: z.string().optional().describe("Optional name for the pre-composition group"),
});

export const UngroupPrecompInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(1).describe("Component IDs to remove from their pre-composition group"),
});

/* --------------------------- Expression tools --------------------------- */
export const SetExpressionInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  property: z.string().describe("Property name (e.g. opacity, scale, rotate, translateX)"),
  expression: z.string().describe("JavaScript expression. Variables: time (ms), index (component order), duration (ms), value (current value). Example: 'Math.sin(time / 500) * 50 + 50'"),
  enabled: z.boolean().default(true).describe("Enable or disable the expression without deleting it"),
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

/* --------------------------- Project recipe tools --------------------------- */
export const SaveProjectRecipeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  intentKeywords: z.array(z.string()).optional(),
  avoidWhen: z.array(z.string()).optional(),
  restraintLevel: z.number().min(1).max(10).optional(),
});

export const ListProjectRecipesInput = z.object({
  projectId: zIdField,
  query: z.string().optional(),
});

export const ApplyProjectRecipeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  recipeId: zIdField,
});

export const DeleteProjectRecipeInput = z.object({
  projectId: zIdField,
  recipeId: zIdField,
});

export const SeedProjectRecipesInput = z.object({
  projectId: zIdField,
});

/* --------------------------- Brand pack tools --------------------------- */
export const ListBrandPacksInput = z.object({
  projectId: zIdField,
});

export const ApplyBrandPackInput = z.object({
  projectId: zIdField,
  packId: zIdField,
  componentId: z.string().optional().describe("Optional: apply to a single component. If omitted, applies to all components."),
});

export const DeleteBrandPackInput = z.object({
  projectId: zIdField,
  packId: zIdField,
});

export const SeedBrandPacksInput = z.object({
  projectId: zIdField,
});

/* --------------------------- Motion profile tools --------------------------- */
export const SetMotionProfileInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  role: z.enum(["hero", "supporting", "background", "cta", "decorative", "data", "navigation"]).optional(),
  temperament: z.enum(["bold", "subtle", "urgent", "calm", "playful", "precise", "dramatic", "friendly"]).optional(),
  interactionStyle: z.enum(["passive", "reactive", "interactive"]).optional(),
  visualWeight: z.number().min(0).max(10).optional(),
  notes: z.string().max(300).optional(),
});

export const GetMotionProfileInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
});

export const ListMotionProfilesInput = z.object({
  projectId: zIdField,
});

export const SuggestMotionProfileInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
});

export const ApplyMotionProfileInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
});

/* --------------------------- Motion capture tools --------------------------- */
export const SaveMotionCaptureInput = z.object({
  projectId: zIdField,
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  samples: z.array(
    z.object({
      t: z.number().min(0),
      x: z.number(),
      y: z.number(),
    }),
  ).min(2).describe("Cursor samples: t (ms offset), x, y (canvas coordinates)."),
  originX: z.number().optional(),
  originY: z.number().optional(),
  normalize: z.boolean().optional().describe("Normalize samples to a 0..100 bounding box centered on origin."),
  smoothing: z.number().int().min(0).max(10).optional().describe("Moving-average window size (0 = raw)."),
});

export const ListMotionCapturesInput = z.object({
  projectId: zIdField,
});

export const ApplyMotionCaptureInput = z.object({
  projectId: zIdField,
  captureId: zIdField,
  componentId: zIdField,
  normalize: z.boolean().optional(),
  smoothing: z.number().int().min(0).max(10).optional(),
  snap: z.number().int().min(0).max(50).optional().describe("Snap samples to nearest N pixels (0 = off)."),
  maxKeyframes: z.number().int().min(2).max(64).optional(),
});

export const DeleteMotionCaptureInput = z.object({
  projectId: zIdField,
  captureId: zIdField,
});

export const SeedMotionCapturesInput = z.object({
  projectId: zIdField,
});

/* --------------------------- Export preset tools --------------------------- */
export const ListExportPresetsInput = z.object({
  projectId: zIdField,
});

export const RecommendExportFormatInput = z.object({
  projectId: zIdField,
  hint: z.string().optional().describe("Optional user intent hint, e.g. 'for Instagram' or 'as a React component'"),
});

export const ApplyExportPresetInput = z.object({
  projectId: zIdField,
  presetId: zIdField,
});

/* --------------------------- Session lineage tools --------------------------- */
export const SaveSessionSnapshotInput = z.object({
  projectId: zIdField,
  name: z.string().min(1).max(120).describe("Human-readable session name, e.g. 'Spring tuning exploration'"),
  parentId: z.string().optional().describe("Parent session id to fork from (omit for a new root session)"),
  summary: z.string().max(500).optional().describe("What was accomplished in this session"),
  messageCount: z.number().int().min(0).optional(),
  toolsUsed: z.array(z.string()).optional().describe("Tool names invoked during the session — used for auto-insight extraction"),
  componentIds: z.array(z.string()).optional().describe("Components created or modified during the session"),
  tags: z.array(z.string()).optional(),
});

export const ListSessionSnapshotsInput = z.object({
  projectId: zIdField,
});

export const ResumeSessionSnapshotInput = z.object({
  projectId: zIdField,
  sessionId: zIdField,
  summary: z.string().max(500).optional().describe("Updated summary of what was accomplished when resuming"),
  messageCount: z.number().int().min(0).optional(),
  toolsUsed: z.array(z.string()).optional(),
  componentIds: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export const GetSessionLineageInput = z.object({
  projectId: zIdField,
  sessionId: z.string().optional().describe("Optional: focus on a specific session's ancestry and descendants. Omit for full tree + stats."),
});

export const DeleteSessionSnapshotInput = z.object({
  projectId: zIdField,
  sessionId: zIdField,
});

/* --------------------------- Accessibility tools --------------------------- */
export const CheckAccessibilityInput = z.object({
  projectId: zIdField,
  componentId: z.string().optional().describe("Optional: check a single component. Omit to check the entire project."),
});

/* --------------------------- Performance tools --------------------------- */
export const CheckPerformanceInput = z.object({
  projectId: zIdField,
  componentId: z.string().optional().describe("Optional: check a single component. Omit to check the entire project."),
});

/* --------------------------- Storyboard tools --------------------------- */
export const CreateBeatInput = z.object({
  projectId: zIdField,
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  durationMs: z.number().int().min(50).max(60000).optional(),
  sceneId: z.string().optional(),
  componentIds: z.array(z.string()).optional(),
  transition: z.enum(["cut", "fade", "slide", "zoom", "dissolve", "wipe"]).optional(),
});

export const ListBeatsInput = z.object({
  projectId: zIdField,
});

export const UpdateBeatInput = z.object({
  projectId: zIdField,
  beatId: zIdField,
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  durationMs: z.number().int().min(50).max(60000).optional(),
  sceneId: z.string().optional(),
  componentIds: z.array(z.string()).optional(),
  transition: z.enum(["cut", "fade", "slide", "zoom", "dissolve", "wipe"]).optional(),
});

export const ReorderBeatsInput = z.object({
  projectId: zIdField,
  beatIds: z.array(zIdField).min(1),
});

export const DeleteBeatInput = z.object({
  projectId: zIdField,
  beatId: zIdField,
});

export const ExportStoryboardInput = z.object({
  projectId: zIdField,
  format: z.enum(["markdown", "json"]).default("markdown"),
});

/* ------------------------ Principles tools ------------------------ */
export const AnalyzePrinciplesInput = z.object({
  projectId: zIdField,
  componentId: zIdField.optional(),
});

export const ApplyPrincipleInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  principle: z.enum([
    "squash_stretch", "anticipation", "staging", "slow_in_out", "arcs",
    "secondary_action", "timing", "exaggeration", "solid_drawing",
    "appeal", "follow_through", "overlapping_action",
  ]),
});

/* ------------------------ Easing synthesis ------------------------ */
export const SynthesizeEasingInput = z.object({
  description: z.string(),
  format: z.enum(["bezier", "spring", "css"]).default("bezier"),
});

/* --------------------- Choreography patterns --------------------- */
export const ApplyChoreographyInput = z.object({
  projectId: zIdField,
  pattern: z.enum([
    "cascade", "call_response", "unison", "counterpoint",
    "wave", "canon", "stagger_grid", "ripple_out",
  ]),
  baseDelayMs: z.number().int().min(10).max(2000).optional(),
  baseDurationMs: z.number().int().min(100).max(10000).optional(),
});

/* --------------------- Motion blend engine --------------------- */
export const BlendMotionsInput = z.object({
  projectId: zIdField,
  sourceComponentId: zIdField,
  targetComponentId: zIdField,
  ratio: z.number().min(0).max(1).default(0.5),
  applyTo: z.enum(["source", "new"]).default("new"),
});

export const InterpolateMotionInput = z.object({
  projectId: zIdField,
  sourceComponentId: zIdField,
  targetComponentId: zIdField,
  steps: z.number().int().min(2).max(20).default(5),
});

export const MergePropertiesInput = z.object({
  projectId: zIdField,
  sourceComponentId: zIdField,
  targetComponentId: zIdField,
  applyTo: z.enum(["source", "new"]).default("source"),
});

/* --------------------------- Intelligence tools --------------------------- */
export const AnalyzeEmotionInput = z.object({
  projectId: zIdField,
});
export const AnalyzeRhythmInput = z.object({
  projectId: zIdField,
});
export const AnalyzeNarrativeInput = z.object({
  projectId: zIdField,
});

/* --------------------------- Adaptive tools --------------------------- */
export const AdaptMotionInput = z.object({
  projectId: zIdField,
  device: z.enum(["desktop", "tablet", "mobile", "tv"]).describe("Target device type"),
  viewportWidth: z.number().int().min(64).max(4096).describe("Viewport width in pixels"),
  viewportHeight: z.number().int().min(64).max(4096).describe("Viewport height in pixels"),
  performance: z.enum(["high", "medium", "low"]).describe("Device performance tier"),
  accessibility: z.enum(["full", "reduced", "minimal"]).describe("Accessibility motion preference"),
  connectionSpeed: z.enum(["fast", "slow", "offline"]).describe("Network connection speed"),
  batteryLevel: z.number().min(0).max(1).default(1).describe("Battery level 0..1 (1 = full)"),
  apply: z.boolean().default(false).describe("If true, apply the adapted spec to the project; if false, only preview"),
});

export const PreviewAdaptationsInput = z.object({
  projectId: zIdField,
});

export const GenerateResponsiveCssInput = z.object({
  projectId: zIdField,
});

/* --------------------------- Synthesis tools --------------------------- */
export const SynthesizeMotionInput = z.object({
  projectId: zIdField,
  pattern: z.enum([
    "heartbeat", "breathing", "walk-cycle", "bounce-ball", "pendulum",
    "ocean-wave", "tremor", "fidget", "heartbeat-fast", "shake-violent",
    "sway-gentle", "orbit-elliptical",
  ]).describe("Generative motion pattern to synthesize"),
  durationMs: z.number().int().min(100).max(60000).optional().describe("Duration in ms (uses pattern default if omitted)"),
  loopCount: z.union([z.number().int().min(1), z.literal("infinite")]).optional().default("infinite").describe("Loop count or 'infinite'"),
  amplitudeScale: z.number().min(0).max(2).optional().default(1).describe("Amplitude multiplier (0..2, 1 = default)"),
  speedScale: z.number().min(0.1).max(5).optional().default(1).describe("Speed multiplier (0.1..5, 1 = default)"),
  componentName: z.string().optional().describe("Name for the generated component"),
});

export const MorphToPatternInput = z.object({
  projectId: zIdField,
  targetPattern: z.enum([
    "heartbeat", "breathing", "walk-cycle", "bounce-ball", "pendulum",
    "ocean-wave", "tremor", "fidget", "heartbeat-fast", "shake-violent",
    "sway-gentle", "orbit-elliptical",
  ]).describe("Target generative pattern to morph toward"),
  morphSteps: z.number().int().min(2).max(20).optional().default(5).describe("Number of intermediate morph steps"),
  durationMs: z.number().int().min(100).max(60000).optional().describe("Target duration in ms"),
});

export const SynthesizeWaveformInput = z.object({
  projectId: zIdField,
  waveform: z.enum(["sine", "square", "triangle", "sawtooth", "noise", "pulse"]).describe("Waveform type"),
  amplitude: z.number().min(-1000).max(1000).describe("Wave amplitude"),
  frequency: z.number().min(0.01).max(50).describe("Frequency in Hz (cycles per second)"),
  phase: z.number().min(0).max(6.283).optional().default(0).describe("Phase offset in radians (0..2π)"),
  offset: z.number().optional().default(0).describe("DC offset added to the wave"),
  property: z.enum(["translateX", "translateY", "scale", "scaleX", "scaleY", "rotate", "opacity"]).describe("Property to animate"),
  durationMs: z.number().int().min(100).max(60000).default(1000).describe("Duration in ms"),
  loopCount: z.union([z.number().int().min(1), z.literal("infinite")]).optional().default("infinite").describe("Loop count or 'infinite'"),
  componentName: z.string().optional().describe("Name for the generated component"),
  keyframeCount: z.number().int().min(4).max(32).optional().default(12).describe("Number of keyframes to generate (4..32)"),
});

/* --------------------------- Storytelling tools --------------------------- */
export const CreateStoryArcInput = z.object({
  projectId: zIdField,
  genre: z.enum(["hero", "mystery", "romance", "comedy", "thriller", "documentary", "fantasy", "horror"]).describe("Story genre template"),
  totalDurationMs: z.number().int().min(1000).max(120000).default(10000).describe("Total story duration in ms"),
});

export const AnalyzePacingInput = z.object({
  projectId: zIdField,
  arcId: z.string().optional().describe("Specific arc ID to analyze (uses latest if omitted)"),
});

export const ApplyStoryPlanInput = z.object({
  projectId: zIdField,
  genre: z.enum(["hero", "mystery", "romance", "comedy", "thriller", "documentary", "fantasy", "horror"]).describe("Story genre to apply"),
  totalDurationMs: z.number().int().min(1000).max(120000).default(10000).describe("Total story duration in ms"),
  apply: z.boolean().default(false).describe("If true, apply timing changes to components; if false, only preview"),
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
  effectId: z.string().describe("Shader effect ID: shader-chromatic, shader-glitch, shader-plasma, shader-noise, shader-ripple, shader-vignette, shader-neon-glow, shader-pixelate, shader-gradient-shift, shader-invert-pulse, shader-aurora, shader-vortex"),
  intensity: z.number().min(0).max(5).optional(),
});

/* --------------------------- Version history tools --------------------------- */
export const SaveVersionInput = z.object({
  projectId: zIdField,
  label: z.string().min(1).max(120).describe("Human-readable label for the snapshot, e.g. 'before stagger tweak'"),
});

export const ListVersionsInput = z.object({
  projectId: zIdField,
});

export const RestoreVersionInput = z.object({
  projectId: zIdField,
  versionId: zIdField,
});

export const DeleteVersionInput = z.object({
  projectId: zIdField,
  versionId: zIdField,
});

/* --------------------------- Design token tools --------------------------- */
export const SaveTokenInput = z.object({
  projectId: zIdField,
  name: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/).describe("Lowercase kebab-case token name, e.g. 'fast', 'brand-blue'"),
  category: z.enum(["duration", "easing", "color", "spacing", "radius", "shadow", "font"]),
  value: z.string().min(1).describe("Token value — e.g. '400ms', 'cubic-bezier(0.4,0,0.2,1)', '#0a0a0a', '16px'"),
  description: z.string().max(500).optional(),
});

export const ListTokensInput = z.object({
  projectId: zIdField,
  category: z.enum(["duration", "easing", "color", "spacing", "radius", "shadow", "font"]).optional(),
});

export const UpdateTokenInput = z.object({
  projectId: zIdField,
  name: z.string().min(1).max(80),
  value: z.string().min(1).optional(),
  description: z.string().max(500).optional(),
});

export const DeleteTokenInput = z.object({
  projectId: zIdField,
  name: z.string().min(1).max(80),
});

/* --------------------------- Multimodal generation tools --------------------------- */
export const GenerateImageInput = z.object({
  prompt: z.string().min(1).max(2000).describe("Text description of the image to generate"),
  model: z.string().optional().describe("Model: dall-e-3, dall-e-2, stable-diffusion-3, stable-image-ultra"),
  width: z.number().int().min(64).max(4096).optional(),
  height: z.number().int().min(64).max(4096).optional(),
  negativePrompt: z.string().optional().describe("What to exclude from the image"),
});

export const GenerateSpeechInput = z.object({
  text: z.string().min(1).max(5000).describe("Text to convert to speech"),
  model: z.string().optional().describe("Model: tts-1, eleven-multilingual-v2, eleven-turbo-v2"),
  voiceId: z.string().optional().describe("Voice identifier for the provider"),
});

export const GenerateVideoInput = z.object({
  prompt: z.string().min(1).max(2000).describe("Text description of the video to generate"),
  model: z.string().optional().describe("Model: gen-3-alpha, luma-dream-machine, pika-1.5"),
  duration: z.number().int().min(1).max(30).optional().describe("Video duration in seconds"),
  sourceImage: z.string().optional().describe("Source image URL for image-to-video"),
});

export const Generate3DInput = z.object({
  prompt: z.string().min(1).max(2000).describe("Text description of the 3D model to generate"),
  model: z.string().optional().describe("Model: meshy-text-to-3d-v2, tripo-text-to-3d"),
  sourceImage: z.string().optional().describe("Source image URL for image-to-3d conversion"),
});

export const ListModelsInput = z.object({
  provider: z.string().optional().describe("Filter by provider: openai, anthropic, gemini, ollama, stability, elevenlabs, runway, luma, pika, meshy, tripo"),
  modality: z.string().optional().describe("Filter by modality: text-to-image, text-to-video, text-to-speech, speech-to-text, text-to-3d"),
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
  find_similar_motion: FindSimilarMotionInput,
  generate_motion_docs: GenerateMotionDocsInput,
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
  add_image: AddImageInput,
  add_video: AddVideoInput,
  add_audio: AddAudioInput,
  add_typewriter_text: AddTypewriterTextInput,
  add_scene_transition: AddSceneTransitionInput,
  add_camera_move: AddCameraMoveInput,
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
  set_adjustment_layer: SetAdjustmentLayerInput,
  create_precomp: CreatePrecompInput,
  ungroup_precomp: UngroupPrecompInput,
  set_expression: SetExpressionInput,
  analyze_restraint: AnalyzeRestraintInput,
  list_recipes: ListRecipesInput,
  apply_recipe: ApplyRecipeInput,
  save_project_recipe: SaveProjectRecipeInput,
  list_project_recipes: ListProjectRecipesInput,
  apply_project_recipe: ApplyProjectRecipeInput,
  delete_project_recipe: DeleteProjectRecipeInput,
  seed_project_recipes: SeedProjectRecipesInput,
  list_brand_packs: ListBrandPacksInput,
  apply_brand_pack: ApplyBrandPackInput,
  delete_brand_pack: DeleteBrandPackInput,
  seed_brand_packs: SeedBrandPacksInput,
  set_motion_profile: SetMotionProfileInput,
  get_motion_profile: GetMotionProfileInput,
  list_motion_profiles: ListMotionProfilesInput,
  suggest_motion_profile: SuggestMotionProfileInput,
  apply_motion_profile: ApplyMotionProfileInput,
  save_motion_capture: SaveMotionCaptureInput,
  list_motion_captures: ListMotionCapturesInput,
  apply_motion_capture: ApplyMotionCaptureInput,
  delete_motion_capture: DeleteMotionCaptureInput,
  seed_motion_captures: SeedMotionCapturesInput,
  list_export_presets: ListExportPresetsInput,
  recommend_export_format: RecommendExportFormatInput,
  apply_export_preset: ApplyExportPresetInput,
  save_session_snapshot: SaveSessionSnapshotInput,
  list_session_snapshots: ListSessionSnapshotsInput,
  resume_session_snapshot: ResumeSessionSnapshotInput,
  get_session_lineage: GetSessionLineageInput,
  delete_session_snapshot: DeleteSessionSnapshotInput,
  check_accessibility: CheckAccessibilityInput,
  check_performance: CheckPerformanceInput,
  create_beat: CreateBeatInput,
  list_beats: ListBeatsInput,
  update_beat: UpdateBeatInput,
  reorder_beats: ReorderBeatsInput,
  delete_beat: DeleteBeatInput,
  export_storyboard: ExportStoryboardInput,
  save_memory: SaveMemoryInput,
  recall_memory: RecallMemoryInput,
  list_generated_skills: ListGeneratedSkillsInput,
  compile_grammar: CompileGrammarInput,
  parse_motion: ParseMotionInput,
  set_shader_effect: SetShaderEffectInput,
  save_version: SaveVersionInput,
  list_versions: ListVersionsInput,
  restore_version: RestoreVersionInput,
  delete_version: DeleteVersionInput,
  save_token: SaveTokenInput,
  list_tokens: ListTokensInput,
  update_token: UpdateTokenInput,
  delete_token: DeleteTokenInput,
  export_lottie: ExportLottieInput,
  save_pipeline: SavePipelineInput,
  list_pipelines: ListPipelinesInput,
  run_pipeline: RunPipelineInput,
  delete_pipeline: DeletePipelineInput,
  analyze_mood: AnalyzeMoodInput,
  set_mood: SetMoodInput,
  suggest_creative: SuggestCreativeInput,
  analyze_visual_context: AnalyzeVisualContextInput,
  synthesize_code: SynthesizeCodeInput,
  compose_state_machine: ComposeStateMachineInput,
  list_state_machines: ListStateMachinesInput,
  trigger_state_machine: TriggerStateMachineInput,
  analyze_principles: AnalyzePrinciplesInput,
  apply_principle: ApplyPrincipleInput,
  synthesize_easing: SynthesizeEasingInput,
  apply_choreography: ApplyChoreographyInput,
  blend_motions: BlendMotionsInput,
  interpolate_motion: InterpolateMotionInput,
  merge_properties: MergePropertiesInput,
  analyze_emotion: AnalyzeEmotionInput,
  analyze_rhythm: AnalyzeRhythmInput,
  analyze_narrative: AnalyzeNarrativeInput,
  adapt_motion: AdaptMotionInput,
  preview_adaptations: PreviewAdaptationsInput,
  generate_responsive_css: GenerateResponsiveCssInput,
  synthesize_motion: SynthesizeMotionInput,
  morph_to_pattern: MorphToPatternInput,
  synthesize_waveform: SynthesizeWaveformInput,
  create_story_arc: CreateStoryArcInput,
  analyze_pacing: AnalyzePacingInput,
  apply_story_plan: ApplyStoryPlanInput,
  generate_image: GenerateImageInput,
  generate_speech: GenerateSpeechInput,
  generate_video: GenerateVideoInput,
  generate_3d: Generate3DInput,
  list_models: ListModelsInput,
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
  set_easing: "Set the easing curve of a component. 17 presets available: linear, ease, ease-in, ease-out, ease-in-out, ease-in-quad, ease-out-quad, ease-in-out-quad, ease-in-cubic, ease-out-cubic, ease-in-out-cubic, bounce, back, elastic, snappy, smooth, soft. Also supports custom bezier (x1,y1,x2,y2) and spring (stiffness,damping,mass). Use for 'make it bouncy / smooth / snappy / soft' or specific CSS easing names.",
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
  find_similar_motion: "Search across all projects and templates for motions with similar Motion DNA signatures to the selected component. Scores similarity using weighted segment comparison (easing 30%, properties 25%, duration 20%, loop 15%, direction 10%) with Jaccard overlap on the animated property set. Returns ranked matches above the threshold with matched segments. Use when the user says 'find similar motions', 'what else looks like this', 'search for similar', or 'are there other motions like this'.",
  generate_motion_docs: "Generate comprehensive motion specification documentation for a project — includes component inventory with DNA signatures, easing distribution, trigger philosophy, accessibility and safety summary, performance budget, and storyboard beats. Outputs Markdown or JSON. Use when the user says 'generate docs', 'spec document', 'motion documentation', 'document this project', or 'export spec'.",
  create_variant: "Create a variation of an existing component with different easing, duration, or property scale. The original is preserved. Use when the user says 'try a variation' or 'what would this look like with different easing'.",
  analyze_motion: "Analyze the current motion design for quality, timing, accessibility, and composition issues. Returns a list of insights with severity levels (info/warning/critical) and actionable suggestions. Use when the user asks 'is this good', 'analyze', 'review', or 'critique my motion'.",
  suggest_next: "Generate 3-5 context-aware next-step suggestions based on the current project state. Returns suggestion text and a priority level. Use when the user asks 'what should I do next', 'suggest', or 'ideas'.",
  set_motion_path: "Animate a component along a custom path (line, circle, ellipse, or bezier curve). Generates keyframes for translateX/translateY along the path. Use when the user says 'move in a circle', 'animate along a path', or 'orbit around a point'.",
  apply_style: "Apply a coordinated motion style preset (playful, energetic, calm, professional, dramatic, minimal, cinematic, glassy, retro, futuristic, organic, mechanical, luxury) across ALL components. Adjusts easing, duration, loop, and direction for a coherent aesthetic. Use when the user says 'make it playful', 'give it a professional feel', 'make it cinematic', or 'style the whole project'.",
  recognize_pattern: "Identify motion design patterns and anti-patterns in the project — monotony, incomplete lifecycle, timing uniformity, motion overload, and dominant category. Returns pattern observations with recommendations. Use when the user asks 'what patterns do you see' or 'is the composition balanced'.",
  harmonize_colors: "Apply color theory to adjust component colors for visual harmony. Supports complementary, analogous, triadic, and monochrome schemes. Use when the user says 'harmonize colors', 'make colors work together', or 'apply a color scheme'.",
  choreograph: "Apply a choreographic pattern across all components — cascade (sequential), wave (sine-wave delays), ripple (center-out), canon (offset repetition), converge (all converge to endpoint), spiral (golden-angle distribution with alternating easing), explosion (center-out burst with bounce easing), assembly (edges meet in middle), breathing (synchronized pulse with phase offsets), domino (alternating direction cascade), scatter (reverse explosion — outer first). Sets delays, adjusts durations, and tunes easing/direction per pattern. Use when the user says 'choreograph', 'orchestrate', 'wave pattern', 'ripple effect', 'spiral', 'explosion', 'assembly', 'breathing', 'domino', or 'scatter'.",
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
  add_image: "Add an image component to the canvas from a URL or data URI. Supports object-fit (cover/contain/fill). Use when the user says 'add an image', 'insert a picture', or 'place a photo'.",
  add_video: "Add a video component to the canvas from a URL or data URI. Supports muted, loop, and autoplay options. Use when the user says 'add a video', 'embed a clip', or 'place a video'.",
  add_audio: "Add an audio component for background music or voiceover. Supports delay, loop, and muted options. Use when the user says 'add background music', 'add a voiceover', or 'play a sound'.",
  add_typewriter_text: "Add text that reveals character-by-character with an optional blinking cursor. Use when the user says 'typewriter effect', 'type on text', or 'reveal text gradually'.",
  add_scene_transition: "Add a cinematic transition effect between scenes — dissolve, wipe, slide, zoom, or flash. Use when the user says 'add a transition', 'cross-dissolve', or 'wipe to next scene'.",
  add_camera_move: "Animate a virtual camera movement — pan left/right/up/down, zoom in/out, or combined zoom-pan. Use when the user says 'pan camera', 'zoom in', 'camera movement', or 'dolly shot'.",
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
  set_adjustment_layer: "Toggle a component as an adjustment layer — its filter effects apply to all layers below via backdrop-filter. Use when the user says 'adjustment layer', 'affect layers below', or 'apply effect to all layers'.",
  create_precomp: "Group multiple components into a pre-composition — they share a common parentId so they can be moved and timed as a unit. Use when the user says 'group these', 'pre-comp', 'precompose', or 'nest these layers'.",
  ungroup_precomp: "Remove components from their pre-composition group by clearing their parentId. Use when the user says 'ungroup', 'unprecompose', or 'extract from comp'.",
  set_expression: "Set a JavaScript expression on a property. The expression is evaluated each frame with variables: time (ms), index, duration (ms), value. Example: 'Math.sin(time / 500) * 50 + 50' for pulsing opacity. Use when the user says 'expression', 'formula', 'math', 'oscillate', 'pulse', 'wiggle', or writes an equation.",
  analyze_restraint: "Analyze motion density and restraint — calculates how many animations compete for attention simultaneously, identifies easing/duration monotony, and recommends improvements. Returns a restraint score (0-100) with warnings. Use when the user asks 'is this too much', 'analyze restraint', or 'check density'.",
  list_recipes: "Browse the curated motion recipe library. Each recipe carries avoid_when metadata — situations where it should NOT be used. Optionally filter by category or search by query. Returns recipe names, descriptions, restraint costs, and avoidance conditions.",
  apply_recipe: "Apply a curated motion recipe to a component. Recipes include pre-configured easing, keyframes, and timing. The system checks avoid_when conditions before applying. Use when the user says 'apply a recipe', 'use a gentle entrance', or 'try a cinematic fade'.",
  save_project_recipe: "Capture a reusable motion recipe from an existing component's current parameters (easing, duration, delay, loop, direction, trigger). The recipe is stored in the project and can be applied to other components. Use when the user says 'save this motion as a recipe', 'capture this as a preset', or 'remember this animation'.",
  list_project_recipes: "List all user-saved project recipes. Each recipe includes intent keywords, avoidance conditions, and motion parameters. Optionally search by query to match intent keywords. Use when the user says 'show my recipes', 'what recipes do I have', or 'find a recipe for entrance'.",
  apply_project_recipe: "Apply a user-saved project recipe to a component. Transfers the recipe's easing, duration, delay, loop, direction, and trigger to the target component. Use when the user says 'apply my recipe to this', 'use the saved motion on this layer', or 'reuse that animation'.",
  delete_project_recipe: "Delete a user-saved project recipe by ID. Use when the user says 'delete this recipe', 'remove that preset', or 'clean up my recipes'.",
  seed_project_recipes: "Seed the project with built-in recipe presets (Gentle Entrance, Confident Reveal, Playful Bounce, Ambient Breath, Snappy Click). Use when the user says 'add default recipes', 'seed recipes', or 'give me some starter recipes'.",
  list_brand_packs: "List all motion identity brand packs in the project. Each pack defines duration scale, signature easings, trigger philosophy, loop behavior, stagger timing, and personality traits (energy, formality, playfulness, precision). Use when the user says 'show brand packs', 'what motion styles are available', or 'list motion identities'.",
  apply_brand_pack: "Apply a brand pack to the project — rewrites all component timing, easing, triggers, and loop behavior to align with the brand's motion identity. Optionally target a single component. Use when the user says 'apply the Minimal Reserve brand', 'make everything minimal and refined', or 'use the Playful Dynamic identity'.",
  delete_brand_pack: "Delete a brand pack by ID. Use when the user says 'delete this brand pack', 'remove that motion identity', or 'clean up brand packs'.",
  seed_brand_packs: "Seed the project with 5 built-in brand pack presets: Minimal Reserve (smooth, formal), Material Expressive (snappy, standardized), Playful Dynamic (spring, energetic), Cinematic Flow (custom bezier, ambient), Technical Precision (linear, mechanical). Use when the user says 'add default brand packs', 'seed motion identities', or 'load brand presets'.",
  set_motion_profile: "Set or update a component's motion personality profile — role (hero/supporting/background/cta/decorative/data/navigation), temperament (bold/subtle/urgent/calm/playful/precise/dramatic/friendly), interaction style (passive/reactive/interactive), visual weight (0-10). Use when the user says 'make this a hero element', 'this is a background component', or 'set this as a CTA'.",
  get_motion_profile: "Get a component's motion profile — returns role, temperament, interaction style, visual weight, and notes. Use when the user says 'what is this component's role', 'check its profile', or 'what personality does this have'.",
  list_motion_profiles: "List all motion profiles in the project. Shows each component's role, temperament, interaction style, and visual weight. Use when the user says 'show all profiles', 'list component roles', or 'what are the personalities'.",
  suggest_motion_profile: "Auto-suggest a motion profile for a component based on its name and current properties. Infers role, temperament, and interaction style from keywords. Use when the user says 'suggest a profile', 'what role should this be', or 'auto-assign profiles'.",
  apply_motion_profile: "Apply a component's motion profile to its motion parameters — translates the profile's role, temperament, and weight into appropriate easing, duration, trigger, and loop count. Use when the user says 'apply the profile', 'tune based on profile', or 'match motion to personality'.",
  save_motion_capture: "Save a recorded cursor trajectory as a reusable motion capture. Samples are {t (ms), x, y} points. Optional normalize (fit to 0..100 box), smoothing (moving-average window), and origin coordinates. Use when the user says 'save this path', 'record my cursor', or 'capture this gesture'.",
  list_motion_captures: "List all saved motion captures in the project with sample counts, durations, and normalization status. Use when the user says 'show captures', 'list paths', or 'what captures do I have'.",
  apply_motion_capture: "Apply a saved motion capture to a component, converting the recorded trajectory into translateX/translateY keyframes. Optional normalize, smoothing, snap (pixel grid), and maxKeyframes controls. Use when the user says 'apply this capture', 'use that path on this component', or 'trace this motion'.",
  delete_motion_capture: "Delete a saved motion capture by id. Use when the user says 'delete that capture', 'remove the path', or 'discard this recording'.",
  seed_motion_captures: "Seed the project with example motion captures (sine wave, spiral, bounce trail) for demonstration. Only seeds if no captures exist. Use when the user says 'seed captures', 'add example paths', or 'show me capture examples'.",
  list_export_presets: "List all available smart export presets — platform-aware profiles that bundle the right format, dimensions, frame rate, and optimizations for each target (web, react, vue, mobile-lottie, social-square, social-story, email, embed, figma). Use when the user says 'export options', 'what formats', or 'export presets'.",
  recommend_export_format: "Analyze the project's motion characteristics (component count, duration, loops, shaders, keyframe density) and recommend the best export format with scored reasoning. Accepts an optional hint like 'for Instagram' or 'as a React component'. Use when the user says 'what format should I use', 'best export for this', 'how should I export', or 'recommend an export format'.",
  apply_export_preset: "Run an export using a named preset's format and optimizations. The preset determines format (html/css/json/react/vue/lottie/mp4/gif), dimensions, fps, max keyframes, inline styles, css-only, and loop behavior. Use when the user says 'export for Instagram', 'export as React', 'make a Lottie', 'export for email', or 'apply export preset'.",
  save_session_snapshot: "Save a snapshot of the current conversation as a session lineage node — captures name, summary, tools used, components touched, and auto-extracts insights from tool patterns. If parentId is provided, creates a fork (the parent is marked as 'forked'). Use when the user says 'save this session', 'fork from here', 'snapshot this conversation', or 'remember this branch'.",
  list_session_snapshots: "List all session snapshots in the project with their summaries, message counts, tool counts, insight counts, status (active/archived/forked), depth, and tags. Use when the user says 'show sessions', 'session history', or 'what conversations have we had'.",
  resume_session_snapshot: "Resume a previously saved session by updating it with new activity — refreshes the summary, message count, tools used, and component ids. Use when the user says 'continue that session', 'resume from there', or 'pick up where we left off'.",
  get_session_lineage: "Get the full session lineage tree (parent-child relationships) with statistics, or focus on a specific session's ancestry chain and descendants. Returns the tree structure, ancestry, descendants, and project-level stats (total sessions, active, archived, forked, max depth, total insights). Use when the user says 'show lineage', 'conversation tree', 'how do these sessions relate', or 'what came before this'.",
  delete_session_snapshot: "Delete a session snapshot from the lineage. Use when the user says 'delete that session', 'remove this branch', or 'discard that conversation'.",
  check_accessibility: "Analyze motion for accessibility and safety issues — vestibular safety (large displacement, excessive rotation, rapid movement), seizure risk (flashing/strobing above 3Hz per WCAG 2.3.1), reduced-motion compliance (infinite loops without alternatives, content hidden behind animation), and cognitive load (too many simultaneous animations, inconsistent timing). Returns a scored report with categorized issues and remediation suggestions. Use when the user says 'check accessibility', 'is this safe', 'vestibular', 'seizure risk', 'reduced motion', 'WCAG', or 'accessibility check'.",
  check_performance: "Analyze motion for performance issues and frame budget impact — paint complexity (blur, drop-shadow, box-shadow, gradients), layout-triggering animations (width/height/top/left instead of transform), simultaneous animation count, and estimated frame time vs 16ms budget (60fps). Returns per-component cost breakdown, categorized issues with suggestions, and overall stats. Use when the user says 'check performance', 'frame budget', 'is this performant', 'fps', 'jank', 'optimize performance', or 'performance check'.",
  create_beat: "Create a new storyboard beat — a narrative moment in the animation sequence. Each beat has a title, description, duration, optional scene reference, component references, and a transition type (cut/fade/slide/zoom/dissolve/wipe). Use when the user says 'add a beat', 'create a storyboard moment', or 'plan a sequence'.",
  list_beats: "List all storyboard beats in order with summaries, durations, transitions, and component counts. Use when the user says 'show storyboard', 'list beats', or 'what's the sequence'.",
  update_beat: "Update a storyboard beat's title, description, duration, scene, components, or transition type. Use when the user says 'edit beat', 'change the second beat', or 'update this moment'.",
  reorder_beats: "Reorder storyboard beats by providing the desired beat id sequence. Use when the user says 'reorder beats', 'move this beat earlier', or 'swap the order'.",
  delete_beat: "Delete a storyboard beat and reindex the remaining beats. Use when the user says 'remove this beat', 'delete that moment', or 'cut this from the storyboard'.",
  export_storyboard: "Export the storyboard as Markdown or JSON — includes total duration, beat-by-beat timeline with timestamps, transitions, and component references. Use when the user says 'export storyboard', 'generate storyboard doc', or 'share the sequence'.",
  save_memory: "Save a persistent memory entry for the project — cross-session knowledge that the agent recalls in future interactions. Use for storing user preferences, design decisions, or project context.",
  recall_memory: "Search persistent project memory for entries matching a query. Returns relevant memories from past sessions. Use when the user says 'what did we decide', 'remember', or 'what do you know about this project'.",
  list_generated_skills: "List skills auto-generated by the agent from past successful task sequences. Each skill captures a reusable tool pattern. Use when the user asks 'what have you learned' or 'show me generated skills'.",
  compile_grammar: "Compile a motion grammar expression into motion specs. Supports verbs (fade, slide, bounce, rotate, scale, spin, pulse, flip, shake, glow, float, blur, skew, wiggle, heartbeat, typewriter, drift, swing, drop), directions (in/out/up/down/left/right/cw/ccw), and parameters (duration, easing, loop, delay). Example: 'fade.in(600ms) then slide.up(400ms) with easing(spring)'. Use when the user writes a grammar expression or says 'compile this motion'.",
  parse_motion: "Parse a natural language motion description into a structured motion spec. Extracts easing, duration, keyframes, and properties from descriptions like 'make it bounce in playfully with spring physics'. Use when the user describes a motion in natural language and you need to translate it into a spec.",
  set_shader_effect: "Apply a WebGL shader effect to a component. 36 effects available across distortion (chromatic, glitch, warp, swirl, ripple), color (plasma, gradient-shift, invert-pulse, color-panels, heatmap, liquid-metal), noise (noise, perlin, simplex, voronoi, dithering, grain-gradient), light (neon-glow, vignette, aurora, vortex, god-rays, gem-smoke), pattern (mesh-gradient, dot-orbit, dot-grid, waves, metaballs, pulsing-border, halftone-dots, halftone-cmyk), and filter (pixelate, smoke-ring, paper-texture, fluted-glass, water) categories. Use when the user says 'shader effect', 'glitch effect', 'neon glow', 'chromatic aberration', 'plasma', 'pixelate', 'vignette', 'aurora', 'vortex', 'warp', 'swirl', 'waves', 'perlin', 'voronoi', 'metaballs', 'heatmap', 'liquid metal', 'halftone', 'dithering', 'paper texture', 'fluted glass', or 'water'.",
  save_version: "Capture the current project state as a named version snapshot. Use before risky spec-changing operations so the user can roll back. Also use when the user says 'save a version', 'snapshot this', or 'save current state'.",
  list_versions: "List all saved version snapshots for a project, newest first. Use when the user asks 'show versions', 'what versions exist', or 'version history'.",
  restore_version: "Restore a project to a previously captured version snapshot — replaces all current components with the snapshot contents. Use when the user says 'restore version', 'roll back', 'go back to', or 'revert to snapshot'.",
  delete_version: "Delete a version snapshot from history. Use when the user says 'delete version' or 'remove snapshot'.",
  save_token: "Create or upsert a design token (duration, easing, color, spacing, radius, shadow, font). Tokens are reusable values referenced by $name. Use when the user says 'save a token', 'define a duration', or 'create a color token'.",
  list_tokens: "List all design tokens for a project, optionally filtered by category. Use when the user asks 'show tokens', 'what tokens exist', or 'list durations'.",
  update_token: "Update the value or description of an existing design token. Use when the user says 'change the fast token to 300ms' or 'update the brand color'.",
  delete_token: "Delete a design token by name. Use when the user says 'remove token' or 'delete the slow duration'.",
  export_lottie: "Export the project as a Lottie JSON animation file (industry-standard format for web/mobile animation). Optional fps parameter (default 60). Use when the user says 'export as lottie', 'lottie file', or 'export for animation tools'.",
  save_pipeline: "Save a named sequence of tool calls as a reusable pipeline that can be replayed later on any project. Each step has a tool name and args. Use when the user says 'save this as a pipeline', 'record these steps', or 'make a reusable workflow'.",
  list_pipelines: "List all saved tool pipelines for the project. Use when the user asks 'show pipelines', 'what workflows exist', or 'list saved sequences'.",
  run_pipeline: "Replay a saved pipeline by id — executes each step's tool call in sequence on the current project. Use when the user says 'run pipeline', 'replay workflow', or 'apply the bounce-then-fade sequence'.",
  delete_pipeline: "Delete a saved tool pipeline by id. Use when the user says 'remove pipeline' or 'delete workflow'.",
  analyze_mood: "Analyze the emotional character of the motion — returns the dominant mood (premium/playful/calm/energetic/dramatic/minimal/confident/gentle/urgent/nostalgic), mood score breakdown, energy level (0-1), rhythm pattern, coherence, and a human-readable narrative description. Use when the user asks 'what feeling does this convey', 'what's the mood', or 'describe the emotion'.",
  set_mood: "Apply a mood profile to the motion — translates emotional language (premium/playful/calm/energetic/dramatic/minimal/confident/gentle/urgent/nostalgic) into matching easing, duration, direction, and iteration count. Scope: 'project' applies to all components, 'component' applies to a single one. Use when the user says 'make it feel premium', 'give it a playful vibe', or 'make everything calm'.",
  suggest_creative: "Generate creative, context-aware next-step suggestions based on the project's mood, energy, rhythm, diversity, and restraint. Includes surprise ideas (shader accents, motion paths, 3D transforms, variants, choreography). Set surprise=true for unexpected but aesthetically valid ideas. Use when the user asks 'surprise me', 'creative ideas', 'what would make this better', or 'any suggestions'.",
  analyze_visual_context: "Analyze the canvas as a spatial layout — visual balance (centroid vs canvas center), spacing consistency (gap variance), hierarchy (size distribution and z-order), color palette distribution, overlap detection, and alignment (rows/columns/grid). Returns a composite visual quality score (0-100) with actionable insights and suggestions. Use when the user asks 'is the layout balanced', 'check the composition', 'visual review', 'how does the canvas look', or 'analyze the visual layout'.",
  synthesize_code: "Generate standalone, copy-pasteable animation code from a natural language description. Parses the description for motion verb (fade, slide, bounce, rotate, scale, pulse, shake, flip, float, glow, heartbeat, drop, swing, wiggle), easing, duration, loop, and direction, then renders code in the requested format: css (@keyframes + class), react (component using Web Animations API), html (standalone file), or vanilla (element.animate() snippet). Unlike export_code (which serializes the current project), synthesize_code generates fresh code from a description alone. Use when the user says 'generate code for a bounce animation', 'give me the CSS for a smooth fade', 'write a React component for a pulsing effect', or 'create animation code'.",
  compose_state_machine: "Compose an OpenMotion-native state machine with named states, typed inputs (boolean/number/trigger), and timed transitions. Builds from a preset (hover-press, toggle-on-off, loading-sequence, carousel, tab-switch) or a custom definition. States map to component visibility snapshots; transitions define how inputs move the machine between states. The machine is stored in the project tokens. Use when the user says 'create a state machine', 'add a hover/press interaction', 'make a toggle', 'build a loading flow', 'create a carousel', or 'add tab navigation'.",
  list_state_machines: "List all state machines stored in the project tokens, showing their states, transitions, inputs, and current state. Use when the user says 'list state machines', 'show state machines', or 'what state machines do I have'.",
  trigger_state_machine: "Transition a state machine to a named target state. Applies the target state's component visibility and style configuration. Use when the user says 'switch to the hover state', 'go to the loading state', 'trigger the success state', or 'transition to the on state'.",
  analyze_principles: "Analyze a motion component (or all components) against the 12 fundamental principles of animation: squash & stretch, anticipation, staging, slow in/slow out, arcs, secondary action, timing, exaggeration, solid drawing, appeal, follow through, overlapping action. Returns per-principle scores (0-100), present/missing status, and actionable suggestions. Use when the user says 'check animation principles', 'analyze motion quality', 'what principles are missing', or 'score this animation'.",
  apply_principle: "Apply a specific animation principle to a component, modifying its keyframes and easing. Principles: squash_stretch (adds scaleX/scaleY deformation), anticipation (adds pre-action keyframe), slow_in_out (fixes linear easing), follow_through (adds settling oscillation), exaggeration (amplifies values), arcs (adds perpendicular translation), secondary_action (adds opacity/shadow), overlapping_action (adds lagging secondary property), solid_drawing (adds 3D rotation). Use when the user says 'add anticipation', 'apply squash and stretch', 'add follow through', 'make it more exaggerated', or 'fix the easing'.",
  synthesize_easing: "Synthesize a custom easing curve from a semantic description. Maps natural language adjectives (weighty, featherlight, snappy, dramatic, playful, elegant, organic, mechanical, bouncy, heavy, light) to precise cubic-bezier control points or spring physics parameters. Returns the easing config and CSS cubic-bezier() string. Use when the user says 'make it feel weighty', 'I want a feather-light easing', 'give me a dramatic curve', or 'synthesize a playful easing'.",
  apply_choreography: "Apply a choreography pattern to orchestrate multiple components with coordinated timing. Patterns: cascade (waterfall delay), call_response (first group then second), unison (all simultaneous), counterpoint (opposite directions), wave (sine-phase offset), canon (musical round), stagger_grid (diagonal sweep), ripple_out (center expands outward). Returns per-component delay and duration assignments. Use when the user says 'cascade these animations', 'make them animate in a wave', 'create a call and response', 'stagger them in a grid', or 'ripple from center'.",
  blend_motions: "Blend two components' motions at a given ratio (0 = source A, 1 = source B, 0.5 = midpoint). Interpolates keyframe values, easing curves, duration, and delay. Creates a new component or overwrites the source. Use when the user says 'blend these two motions', 'cross-fade between A and B', 'create a hybrid of these two', or 'mix these animations at 30%'.",
  interpolate_motion: "Generate N intermediate motion steps between two components, creating a smooth transition sequence. Returns blend results at each ratio from 0 to 1. Use when the user says 'interpolate between these', 'create 5 steps between A and B', 'generate intermediate motions', or 'tween from A to B'.",
  merge_properties: "Merge animated properties from two components into one. Properties unique to each source are combined; conflicting properties are resolved by preferring the source with a keyframe at that offset. Use when the user says 'merge the properties', 'combine animations from A and B', 'layer these motions together', or 'union the keyframes'.",
  analyze_emotion: "Analyze the emotional impact of the motion composition — maps each animation event to an emotional beat (anticipation, surprise, delight, tension, release, curiosity, satisfaction, urgency, calm, joy, trust). Returns the emotional journey timeline, dominant emotion, emotional arc (flat, rising, falling, peaked, oscillating), and peak intensity. Use when the user says 'how does this feel', 'what emotion does this convey', 'analyze the emotion', or 'emotional impact'.",
  analyze_rhythm: "Analyze the visual rhythm of the motion composition — detects beats from keyframe events, estimates tempo (BPM), classifies rhythm type (steady, syncopated, rubato, accelerando, decelerando, chaotic), and identifies rhythmic conflicts. Returns the beat timeline, regularity score, groove score, and conflict list. Use when the user says 'analyze the rhythm', 'what is the tempo', 'is the rhythm steady', 'check the beat', or 'rhythm analysis'.",
  analyze_narrative: "Analyze the narrative coherence of the motion composition — divides the timeline into 5 acts (setup, rising, climax, falling, resolution), checks for missing acts, scores pacing and coherence, and generates suggestions for improving the story arc. Use when the user says 'does this tell a story', 'analyze the narrative', 'what is the story arc', 'is the pacing good', or 'narrative analysis'.",
  adapt_motion: "Adapt the motion for a target device and context — scales duration, delay, keyframe density, easing complexity, and loop behavior based on viewport size, performance tier, accessibility preference, connection speed, and battery level. Returns the adapted spec, a list of changes with reasons, and a reduction level. Use when the user says 'adapt for mobile', 'make it work on tablet', 'responsive motion', 'optimize for low performance', or 'reduce motion for accessibility'.",
  preview_adaptations: "Preview how the motion adapts across all responsive breakpoints (desktop, tablet, mobile, small) — returns change counts and estimated load for each breakpoint so you can see the adaptation impact before applying. Use when the user says 'preview adaptations', 'how will this look on mobile', 'what changes on tablet', or 'responsive preview'.",
  generate_responsive_css: "Generate responsive CSS with @media queries for all breakpoints — includes desktop, tablet, mobile styles with scaled durations and delays, plus prefers-reduced-motion support. Returns ready-to-use CSS string. Use when the user says 'generate responsive CSS', 'export responsive styles', 'CSS for mobile', or 'responsive CSS'.",
  synthesize_motion: "Synthesize a motion component from a generative pattern — produces mathematically-generated keyframes from waveform functions (sine, square, triangle, sawtooth, pulse, noise). 12 patterns: heartbeat (double-pulse scale), heartbeat-fast (rapid urgency), breathing (slow scale+opacity), walk-cycle (vertical bob + rotation), bounce-ball (gravity triangle wave), pendulum (rotational oscillation), ocean-wave (dual-axis fluid), tremor (high-freq micro-shake), fidget (restless micro-movements), shake-violent (sharp alternating), sway-gentle (calm rocking), orbit-elliptical (circular path). Each pattern maps to waveform parameters, animated properties, and a default duration. Amplitude and speed scales let you fine-tune intensity. Returns a fully-formed component ready to add. Use when the user says 'synthesize a heartbeat', 'generate a breathing animation', 'create a pendulum', 'make a walk cycle', 'generate a tremor', or 'synthesize motion'.",
  morph_to_pattern: "Morph the existing motion toward a generative pattern over N intermediate steps — produces a smooth transition sequence from the current motion to the target pattern. Each step blends keyframe values, easing, and duration at an increasing ratio (0 = source, 1 = target). Returns morphed components at each step. Use when the user says 'morph to a heartbeat', 'transition into a breathing pattern', 'morph this into a bounce', or 'gradually become a pendulum'.",
  synthesize_waveform: "Synthesize a custom waveform-driven motion — define an arbitrary waveform (sine, square, triangle, sawtooth, noise, pulse) with amplitude, frequency, phase, and offset, applied to a specific property (translateX, translateY, scale, rotate, opacity). Generates keyframeCount keyframes (4..32) sampling the waveform across the duration. Returns a fully-formed component. Use when the user says 'sine wave on translateY', 'square wave on opacity', 'triangle wave on rotate', 'custom waveform', 'generate a 2Hz sine wave', or 'sawtooth animation'.",
  create_story_arc: "Create a story arc from a genre template — maps narrative structure onto the motion timeline with beats, emotional tones, and intensity levels. 8 genres: hero (Hero's Journey), mystery (Mystery Unfolding), romance (Romantic Arc), comedy (Comedic Rhythm), thriller (Thriller Escalation), documentary (Documentary Flow), fantasy (Fantasy Quest), horror (Horror Descent). Each genre defines 5 acts (setup, rising, climax, falling, resolution) with weights, intensity curves, and emotional tones. Returns the full arc with beats, transitions, component assignments, and pacing analysis. Use when the user says 'create a story arc', 'hero journey', 'build a thriller structure', 'romance arc', 'comedy timing', or 'documentary flow'.",
  analyze_pacing: "Analyze the pacing of a story arc — extracts the tempo curve (BPM per beat), identifies slow and fast segments, checks climax position, and generates recommendations for improving the dramatic rhythm. Returns an overall pacing score (0-100). Use when the user says 'analyze the pacing', 'is the pacing good', 'check the rhythm of the story', 'tempo analysis', or 'pacing review'.",
  apply_story_plan: "Apply a storytelling plan to the motion spec — aligns component delays to beat starts and scales durations by beat intensity (high intensity = faster motion). Maps each component to a story role (protagonist, supporting, introduction, background) based on which beats it overlaps. Set apply=true to write changes to the project; otherwise returns a preview of what would change. Use when the user says 'apply the story plan', 'align to story beats', 'time components to the arc', or 'apply the hero journey timing'.",
  generate_image: "Generate an image from a text prompt using configured providers (DALL-E 3, Stable Diffusion 3). Returns the image URL. Use when the user says 'generate an image', 'create a picture', 'draw', 'make a visual', or 'render an image'.",
  generate_speech: "Convert text to natural-sounding speech using configured providers (OpenAI TTS, ElevenLabs). Returns audio data. Use when the user says 'generate speech', 'read this aloud', 'text to speech', 'narrate', or 'voice this text'.",
  generate_video: "Generate a video from a text prompt or animate a static image using configured providers (Runway Gen-3, Luma Dream Machine, Pika). Returns the video URL. Use when the user says 'generate a video', 'create a clip', 'animate this', 'make a movie', or 'produce a video sequence'.",
  generate_3d: "Generate a 3D model from a text prompt or convert a 2D image to 3D using configured providers (Meshy, Tripo). Returns the model URL (GLB format). Use when the user says 'generate a 3D model', 'create 3D', 'make a mesh', 'text to 3D', or 'convert image to 3D'.",
  list_models: "List all available AI models in the registry, optionally filtered by provider or modality. Shows model capabilities (text, vision, audio, image generation, video generation, code, tool use, reasoning) and context windows. Use when the user says 'what models are available', 'list models', 'show providers', or 'which LLMs can I use'.",
};
