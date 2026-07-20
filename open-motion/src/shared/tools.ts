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

/* --------------------------- Motion blur tools --------------------------- */
export const EnableMotionBlurInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  intensity: z.number().min(0).max(20).default(4).describe("Blur radius in pixels applied while the layer is animating. Higher = more streaking."),
  shutterAngle: z.number().min(0).max(360).default(180).describe("Simulated shutter angle in degrees — 180 is the cinematic default, 360 yields long streaks, 45 yields crisp motion."),
  enabled: z.boolean().default(true).describe("Toggle motion blur on or off without removing configuration."),
});

/* --------------------------- Null object tools --------------------------- */
export const AddNullObjectInput = z.object({
  projectId: zIdField,
  name: z.string().optional().describe("Optional name for the null object. Defaults to 'Null N'."),
  x: z.number().optional().describe("Initial X position in pixels."),
  y: z.number().optional().describe("Initial Y position in pixels."),
});

/* --------------------------- Trim path tools --------------------------- */
export const TrimPathInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  start: z.number().min(0).max(100).default(0).describe("Start percentage of the path to reveal (0-100)."),
  end: z.number().min(0).max(100).default(100).describe("End percentage of the path to reveal (0-100)."),
  offset: z.number().default(0).describe("Rotation offset in degrees for the trim start point."),
  animate: z.boolean().default(true).describe("When true, animates the trim reveal across the component's duration."),
});

/* --------------------------- Repeater tools --------------------------- */
export const AddRepeaterInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  copies: z.number().int().min(1).max(50).default(5).describe("Number of duplicate instances to generate."),
  offset: z.object({
    x: z.number().default(20).describe("Horizontal pixel offset between copies."),
    y: z.number().default(0).describe("Vertical pixel offset between copies."),
    rotate: z.number().default(0).describe("Rotation offset in degrees between copies."),
    scale: z.number().default(1).describe("Scale multiplier between copies (1 = uniform, 0.9 = shrinking)."),
  }).default({ x: 20, y: 0, rotate: 0, scale: 1 }),
  decay: z.number().min(0).max(1).default(0.15).describe("Opacity decay per copy (0 = none, 0.2 = each copy 20% more transparent)."),
});

/* --------------------------- Echo effect tools --------------------------- */
export const AddEchoInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  copies: z.number().int().min(1).max(20).default(4).describe("Number of trailing echo copies."),
  delayMs: z.number().int().positive().default(80).describe("Delay between each echo in milliseconds."),
  decay: z.number().min(0).max(1).default(0.25).describe("Opacity decay per echo (0 = no fade, 0.5 = halving each step)."),
  scaleDecay: z.number().min(0).max(1).default(0).describe("Optional scale shrink per echo (0 = none, 0.1 = each echo 10% smaller)."),
});

/* --------------------------- Time remap tools --------------------------- */
export const SetTimeRemapInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  rate: z.number().describe("Playback rate multiplier. 1 = normal, 2 = double speed, 0.5 = half speed, 0 = freeze, -1 = reverse."),
  freezeAtMs: z.number().optional().describe("When set and rate is 0, freezes the layer at this timestamp instead of the start."),
  reverseDirection: z.boolean().default(false).describe("When true, forces reverse playback regardless of rate sign."),
});

/* --------------------------- Layer effect tools --------------------------- */
export const AddLayerEffectInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  effect: z.enum(["drop-shadow", "inner-shadow", "outer-glow", "inner-glow", "stroke"]),
  color: z.string().default("#000000").describe("Effect color as hex (e.g. #ff0000) or CSS color name."),
  distance: z.number().default(4).describe("Distance/offset in pixels for shadow/glow effects."),
  blur: z.number().default(6).describe("Blur radius in pixels for the effect."),
  opacity: z.number().min(0).max(1).default(0.5).describe("Effect opacity (0-1)."),
  spread: z.number().default(0).describe("Spread/size in pixels for stroke or grow effects."),
});

/* --------------------------- Mask tools --------------------------- */
export const AddMaskInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  shape: z.enum(["rectangle", "ellipse", "path"]).default("rectangle").describe("Mask shape type."),
  mode: z.enum(["add", "subtract", "intersect", "difference", "lighten", "darken"]).default("add").describe("Mask blend mode — professional mask operations."),
  x: z.number().default(0).describe("Mask X offset in pixels."),
  y: z.number().default(0).describe("Mask Y offset in pixels."),
  width: z.number().default(100).describe("Mask width in pixels (rectangle/ellipse)."),
  height: z.number().default(100).describe("Mask height in pixels (rectangle/ellipse)."),
  path: z.string().optional().describe("SVG path data when shape='path' (e.g. 'M 0 0 L 100 0 L 100 100 Z')."),
  feather: z.number().default(0).describe("Feather (blur) radius in pixels for soft mask edges."),
  expansion: z.number().default(0).describe("Expansion in pixels — grows or shrinks the mask shape."),
  inverted: z.boolean().default(false).describe("When true, inverts the mask region."),
  name: z.string().optional().describe("Optional mask name."),
});

export const SetMaskModeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  maskIndex: z.number().int().nonnegative().default(0).describe("Index of the mask to modify (0 = first mask)."),
  mode: z.enum(["add", "subtract", "intersect", "difference", "lighten", "darken"]).describe("New mask blend mode."),
  inverted: z.boolean().optional().describe("Optionally toggle inversion."),
  feather: z.number().optional().describe("Optionally set feather radius in pixels."),
  expansion: z.number().optional().describe("Optionally set expansion in pixels."),
});

/* --------------------------- Track matte tools --------------------------- */
export const SetTrackMatteInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  matteComponentId: zIdField.describe("ID of the layer to use as the matte (mask source)."),
  mode: z.enum(["alpha", "alpha-inverted", "luma", "luma-inverted"]).default("alpha").describe("Track matte mode — alpha uses transparency, luma uses brightness."),
});

/* --------------------------- Shape layer v2 tools --------------------------- */
export const CreateShapeLayerInput = z.object({
  projectId: zIdField,
  name: z.string().optional().describe("Layer name. Defaults to the shape type."),
  shape: z.enum(["rectangle", "ellipse", "polygon", "star", "line", "path"]).describe("Shape primitive type."),
  x: z.number().default(40).describe("X position in pixels."),
  y: z.number().default(40).describe("Y position in pixels."),
  width: z.number().default(120).describe("Width in pixels."),
  height: z.number().default(120).describe("Height in pixels."),
  sides: z.number().int().min(3).max(20).default(5).describe("Number of sides for polygon/star shapes."),
  points: z.number().int().min(3).max(20).default(5).describe("Number of points for star shapes."),
  innerRadius: z.number().optional().describe("Inner radius for star shapes (0-1 of outer radius)."),
  path: z.string().optional().describe("SVG path data when shape='path'."),
  fill: z.string().default("#e5e5e5").describe("Fill color as hex or CSS color."),
  stroke: z.string().optional().describe("Stroke (outline) color as hex or CSS color."),
  strokeWidth: z.number().default(0).describe("Stroke width in pixels. 0 = no stroke."),
  cornerRadius: z.number().default(0).describe("Corner radius in pixels for rectangles."),
  rotation: z.number().default(0).describe("Initial rotation in degrees."),
});

/* --------------------------- Posterize time tools --------------------------- */
export const PosterizeTimeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  fps: z.number().int().min(1).max(60).describe("Target frame rate. The layer's animation will be quantized to this rate (e.g. 12 = stop-motion look, 24 = cinematic)."),
  enabled: z.boolean().default(true).describe("Toggle posterize on/off without losing the configured rate."),
});

/* --------------------------- Text animator tools --------------------------- */
export const AddTextAnimatorInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  property: z.enum(["position", "scale", "rotation", "opacity", "color"]).default("opacity").describe("Property to animate per character/word."),
  rangeStart: z.number().min(0).max(100).default(0).describe("Range selector start percentage (0-100 of the text)."),
  rangeEnd: z.number().min(0).max(100).default(100).describe("Range selector end percentage (0-100 of the text)."),
  unit: z.enum(["character", "word"]).default("character").describe("Selector unit — per-character or per-word."),
  offset: z.number().default(0).describe("Selector offset — animates the range across the text over time."),
  valueDelta: z.number().default(1).describe("Magnitude of the property change at the range center. For opacity: 0-1 (1 = full reveal). For rotation: degrees. For position: pixels. For scale: multiplier delta."),
  staggerMs: z.number().int().min(0).default(40).describe("Per-unit stagger in milliseconds — adds a delay between each character/word."),
  easing: z.string().default("ease-out").describe("CSS easing for the per-unit animation."),
});

/* --------------------------- Keyframe interpolation tools --------------------------- */
export const SetKeyframeInterpolationInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  keyframeIndex: z.number().int().nonnegative().describe("Index of the keyframe to modify."),
  interpolation: z.enum(["linear", "bezier", "hold", "auto-bezier", "continuous"]).describe("Interpolation type for the segment LEAVING this keyframe. 'hold' freezes the value until the next keyframe."),
  roving: z.boolean().optional().describe("When true, marks this keyframe as roving — its time is auto-adjusted to maintain constant velocity across segments."),
});

/* --------------------------- Expression tools --------------------------- */
export const SetExpressionInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  property: z.string().describe("Property name (e.g. opacity, scale, rotate, translateX)"),
  expression: z.string().describe("JavaScript expression. Variables: time (ms), index (component order), duration (ms), value (current value). Example: 'Math.sin(time / 500) * 50 + 50'"),
  enabled: z.boolean().default(true).describe("Enable or disable the expression without deleting it"),
});

/* --------------------------- Gradient tools --------------------------- */
export const SetGradientFillInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  type: z.enum(["linear", "radial"]).default("linear"),
  angle: z.number().default(90).describe("Rotation in degrees for linear gradients (0 = top-to-bottom, 90 = left-to-right)"),
  stops: z.array(z.object({
    color: z.string().describe("Hex color, e.g. #ff0080"),
    position: z.number().min(0).max(100).default(0).describe("Stop position as percentage 0-100"),
  })).min(2).max(8),
  cx: z.number().optional().describe("Radial center X as percentage 0-100 (radial only)"),
  cy: z.number().optional().describe("Radial center Y as percentage 0-100 (radial only)"),
  radius: z.number().optional().describe("Radial radius as percentage 0-100 (radial only)"),
});

export const SetGradientStrokeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  type: z.enum(["linear", "radial"]).default("linear"),
  angle: z.number().default(90),
  width: z.number().default(2).describe("Stroke width in px"),
  stops: z.array(z.object({
    color: z.string(),
    position: z.number().min(0).max(100).default(0),
  })).min(2).max(8),
});

/* --------------------------- Wiggle tool --------------------------- */
export const ApplyWiggleInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  property: z.enum(["translateX", "translateY", "rotate", "scale", "opacity", "skewX", "skewY"]).default("translateX"),
  frequency: z.number().min(0.1).default(2).describe("Oscillations per second (Hz)"),
  amplitude: z.number().default(20).describe("Peak deviation from current value (in property units)"),
  octaves: z.number().int().min(1).max(6).default(2).describe("Number of noise octaves stacked for richness"),
  seed: z.number().int().default(1).describe("Deterministic seed so the same params produce the same wiggle"),
  durationMs: z.number().int().positive().optional().describe("Total duration to sample; defaults to the component duration"),
  sampleCount: z.number().int().min(8).max(120).default(24).describe("Number of keyframes to sample"),
});

/* --------------------------- Particle emitter --------------------------- */
export const AddParticleEmitterInput = z.object({
  projectId: zIdField,
  name: z.string().optional(),
  x: z.number().default(50).describe("Emitter X position as percentage of canvas width"),
  y: z.number().default(50).describe("Emitter Y position as percentage of canvas height"),
  width: z.number().default(400).describe("Canvas layer width in px"),
  height: z.number().default(300).describe("Canvas layer height in px"),
  rate: z.number().default(20).describe("Particles emitted per second"),
  lifespan: z.number().default(1500).describe("Particle lifetime in ms"),
  gravity: z.number().default(80).describe("Downward acceleration in px/s^2"),
  spread: z.number().default(60).describe("Emission angle spread in degrees (0 = straight up)"),
  speed: z.number().default(120).describe("Initial particle speed in px/s"),
  startColor: z.string().default("#ffffff"),
  endColor: z.string().default("#ff0080"),
  startSize: z.number().default(6),
  endSize: z.number().default(0),
  startOpacity: z.number().min(0).max(1).default(1),
  endOpacity: z.number().min(0).max(1).default(0),
  blendMode: z.enum(["normal", "screen", "lighter", "add"]).default("lighter"),
});

/* --------------------------- 3D camera --------------------------- */
export const AddCameraInput = z.object({
  projectId: zIdField,
  name: z.string().optional(),
  positionX: z.number().default(0).describe("Camera X offset from canvas center"),
  positionY: z.number().default(0),
  positionZ: z.number().default(400).describe("Camera Z distance from canvas plane (higher = farther)"),
  focalLength: z.number().default(50).describe("Camera focal length in mm (35-85 typical)"),
  depthOfField: z.number().default(0).describe("DOF amount 0-1; 0 disables, higher intensifies blur with distance"),
  rotateX: z.number().default(0),
  rotateY: z.number().default(0),
  rotateZ: z.number().default(0),
});

export const SetCameraTransformInput = z.object({
  projectId: zIdField,
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  positionZ: z.number().optional(),
  focalLength: z.number().optional(),
  depthOfField: z.number().optional(),
  rotateX: z.number().optional(),
  rotateY: z.number().optional(),
  rotateZ: z.number().optional(),
});

/* --------------------------- Audio reactive --------------------------- */
export const BindAudioToPropertyInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  audioComponentId: zIdField.describe("ID of the audio component whose signal drives the property"),
  property: z.enum(["opacity", "scale", "translateX", "translateY", "rotate", "backgroundColor"]).default("scale"),
  band: z.enum(["bass", "mid", "treble", "overall"]).default("overall").describe("Frequency band to react to"),
  min: z.number().default(0).describe("Output value when audio is silent"),
  max: z.number().default(1).describe("Output value when audio peaks"),
  smoothing: z.number().min(0).max(0.99).default(0.7).describe("Temporal smoothing 0-0.99 (higher = smoother)"),
});

export const UnbindAudioInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
});

/* --------------------------- Puppet pin & mesh warp --------------------------- */
export const AddPuppetPinInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  x: z.number().describe("Pin X position within the layer (px, layer-local)"),
  y: z.number().describe("Pin Y position within the layer (px, layer-local)"),
  name: z.string().optional(),
});

export const ApplyMeshWarpInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  turbulence: z.number().default(0.05).describe("Turbulence amount 0-1 (higher = more distortion)"),
  scale: z.number().default(20).describe("Noise scale in px (smaller = finer ripples)"),
  octaves: z.number().int().min(1).max(4).default(2),
  animated: z.boolean().default(true).describe("Animate the noise over time"),
  speed: z.number().default(0.2).describe("Animation speed when animated=true"),
  seed: z.number().int().default(1),
});

export const RemoveMeshWarpInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
});

/* --------------------------- 3D lighting system --------------------------- */
export const AddLightInput = z.object({
  projectId: zIdField,
  type: z.enum(["parallel", "point", "spot", "ambient"]).describe("Light type: parallel (directional sun), point (omni), spot (cone), ambient (fill)"),
  name: z.string().optional(),
  positionX: z.number().default(0).describe("Light X position in 3D space"),
  positionY: z.number().default(0).describe("Light Y position in 3D space"),
  positionZ: z.number().default(500).describe("Light Z position (positive = in front of canvas)"),
  targetX: z.number().default(0).optional().describe("Target X for parallel/spot lights (where light points)"),
  targetY: z.number().default(0).optional().describe("Target Y for parallel/spot lights"),
  targetZ: z.number().default(0).optional().describe("Target Z for parallel/spot lights"),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#ffffff").describe("Light color as hex"),
  intensity: z.number().min(0).max(2).default(1).describe("Light intensity 0-2 (1 = normal)"),
  coneAngle: z.number().min(1).max(180).optional().describe("Cone angle in degrees for spot lights"),
  coneFeather: z.number().min(0).max(100).optional().describe("Cone edge softness 0-100 for spot lights"),
  castShadow: z.boolean().default(false).describe("Whether this light casts shadows onto 3D layers"),
});

export const SetLightTransformInput = z.object({
  projectId: zIdField,
  lightId: zIdField,
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  positionZ: z.number().optional(),
  targetX: z.number().optional(),
  targetY: z.number().optional(),
  targetZ: z.number().optional(),
});

export const SetLightPropertiesInput = z.object({
  projectId: zIdField,
  lightId: zIdField,
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional(),
  intensity: z.number().min(0).max(2).optional(),
  coneAngle: z.number().min(1).max(180).optional(),
  coneFeather: z.number().min(0).max(100).optional(),
  castShadow: z.boolean().optional(),
  falloff: z.number().min(0).max(1).optional().describe("Distance falloff 0-1 (0 = no falloff, 1 = strong)"),
});

export const RemoveLightInput = z.object({
  projectId: zIdField,
  lightId: zIdField,
});

export const CastShadowInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  enabled: z.boolean().default(true).describe("Enable shadow casting for this layer"),
  shadowOpacity: z.number().min(0).max(1).default(0.5).describe("Shadow opacity 0-1"),
  shadowBlur: z.number().min(0).max(50).default(8).describe("Shadow blur in px (softness)"),
  shadowOffsetX: z.number().default(4).describe("Shadow X offset in px"),
  shadowOffsetY: z.number().default(4).describe("Shadow Y offset in px"),
});

export const SetCameraDOFInput = z.object({
  projectId: zIdField,
  enabled: z.boolean().default(true).describe("Enable depth-of-field blur"),
  focusDistance: z.number().min(0).default(500).describe("Distance from camera in focus (px in Z)"),
  aperture: z.number().min(0).max(1).default(0.3).describe("Aperture size 0-1 (larger = more blur)"),
  blurAmount: z.number().min(0).max(20).default(4).describe("Maximum blur radius in px"),
});

/* --------------------------- Advanced color correction --------------------------- */
export const SetLevelsInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  inputBlack: z.number().min(0).max(254).default(0).describe("Input black point 0-254"),
  inputWhite: z.number().min(1).max(255).default(255).describe("Input white point 1-255"),
  gamma: z.number().min(0.1).max(9.9).default(1).describe("Gamma 0.1-9.9 (1 = no change)"),
  outputBlack: z.number().min(0).max(254).default(0).describe("Output black point 0-254"),
  outputWhite: z.number().min(1).max(255).default(255).describe("Output white point 1-255"),
  channel: z.enum(["rgb", "red", "green", "blue"]).default("rgb").describe("Which channel to adjust"),
});

export const SetCurvesInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  channel: z.enum(["rgb", "red", "green", "blue"]).default("rgb"),
  points: z.array(z.object({
    x: z.number().min(0).max(255).describe("Input value 0-255"),
    y: z.number().min(0).max(255).describe("Output value 0-255"),
  })).min(2).max(16).describe("Curve control points (interpolated as smooth bezier)"),
});

export const SetColorBalanceInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  shadowRed: z.number().min(-100).max(100).default(0).describe("Shadow red/cyan offset -100..100"),
  shadowGreen: z.number().min(-100).max(100).default(0),
  shadowBlue: z.number().min(-100).max(100).default(0),
  midtoneRed: z.number().min(-100).max(100).default(0),
  midtoneGreen: z.number().min(-100).max(100).default(0),
  midtoneBlue: z.number().min(-100).max(100).default(0),
  highlightRed: z.number().min(-100).max(100).default(0),
  highlightGreen: z.number().min(-100).max(100).default(0),
  highlightBlue: z.number().min(-100).max(100).default(0),
});

export const SetHueSaturationInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  hueShift: z.number().min(-180).max(180).default(0).describe("Hue shift in degrees -180..180"),
  saturation: z.number().min(-100).max(100).default(0).describe("Saturation -100..100"),
  lightness: z.number().min(-100).max(100).default(0).describe("Lightness -100..100"),
  channel: z.enum(["master", "red", "yellow", "green", "cyan", "blue", "magenta"]).default("master").describe("Color range to affect"),
});

export const SetVibranceInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  vibrance: z.number().min(-100).max(100).default(0).describe("Vibrance -100..100 (selectively boosts less-saturated colors)"),
});

export const SetExposureInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  exposure: z.number().min(-20).max(20).default(0).describe("Exposure in stops -20..20"),
  offset: z.number().min(-0.5).max(0.5).default(0).describe("Shadow offset -0.5..0.5"),
  gammaCorrection: z.number().min(0.1).max(9.9).default(1).describe("Gamma correction 0.1-9.9"),
});

export const SetShadowHighlightInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  shadowAmount: z.number().min(0).max(100).default(0).describe("Shadow amount 0-100"),
  shadowTonalWidth: z.number().min(0).max(100).default(50),
  shadowRadius: z.number().min(0).max(100).default(30),
  highlightAmount: z.number().min(0).max(100).default(0).describe("Highlight amount 0-100"),
  highlightTonalWidth: z.number().min(0).max(100).default(50),
  highlightRadius: z.number().min(0).max(100).default(30),
});

export const SetSelectiveColorInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  target: z.enum(["reds", "yellows", "greens", "cyans", "blues", "magentas", "whites", "neutrals", "blacks"]).describe("Target color range"),
  cyan: z.number().min(-100).max(100).default(0),
  magenta: z.number().min(-100).max(100).default(0),
  yellow: z.number().min(-100).max(100).default(0),
  black: z.number().min(-100).max(100).default(0),
  method: z.enum(["relative", "absolute"]).default("relative"),
});

/* --------------------------- Path operations & booleans --------------------------- */
export const OffsetPathInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  amount: z.number().describe("Offset in px (positive = expand outward, negative = shrink inward)"),
  miterLimit: z.number().min(1).max(20).default(4).describe("Miter limit for sharp corners"),
  lineJoin: z.enum(["miter", "round", "bevel"]).default("round"),
});

export const PuckerBloatInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  amount: z.number().min(-100).max(100).describe("Amount -100..100 (negative = pucker inward, positive = bloat outward)"),
});

export const RoundCornersInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  radius: z.number().min(0).max(200).describe("Corner radius in px"),
});

export const ZigZagInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  size: z.number().min(0).max(100).default(10).describe("Zig-zag amplitude in px"),
  ridges: z.number().min(1).max(50).default(6).describe("Number of ridges per segment"),
  points: z.enum(["corner", "smooth"]).default("smooth"),
});

export const TwistPathInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  angle: z.number().min(-720).max(720).describe("Twist angle in degrees (-720..720)"),
  centerX: z.number().optional().describe("Twist center X (default = layer center)"),
  centerY: z.number().optional().describe("Twist center Y"),
});

export const MergePathsInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  mode: z.enum(["merge", "add", "subtract", "intersect", "exclude"]).describe("Merge mode: merge (union), add, subtract, intersect, exclude"),
  sourcePathIds: z.array(zIdField).min(2).max(8).describe("Path IDs within the layer to merge"),
  resultName: z.string().optional(),
});

export const ShapeBooleanInput = z.object({
  projectId: zIdField,
  operation: z.enum(["union", "subtract", "intersect", "exclude"]).describe("Boolean operation"),
  targetComponentId: zIdField.describe("Base component"),
  sourceComponentId: zIdField.describe("Component to combine with the base"),
  createNew: z.boolean().default(false).describe("If true, create a new component; otherwise modify target in place"),
});

export const TrimPathMultipleInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  segments: z.array(z.object({
    start: z.number().min(0).max(100).describe("Start percentage 0-100"),
    end: z.number().min(0).max(100).describe("End percentage 0-100"),
    offset: z.number().default(0).describe("Offset in percentage"),
  })).min(1).max(8).describe("Multiple trim segments"),
  reverse: z.boolean().default(false),
});

/* --------------------------- Data-driven animation --------------------------- */
export const LoadDataSourceInput = z.object({
  projectId: zIdField,
  name: z.string().min(1).max(80).describe("Data source name (unique within project)"),
  format: z.enum(["json", "csv"]).default("json").describe("Data format"),
  data: z.string().describe("Inline data payload (JSON string or CSV text)"),
});

export const ListDataSourcesInput = z.object({
  projectId: zIdField,
});

export const BindPropertyToDataInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  dataSourceName: zIdField,
  column: z.string().describe("Column/field name in the data source"),
  property: z.enum(["translateX", "translateY", "scale", "rotate", "opacity", "width", "height", "backgroundColor"]).describe("Property to drive"),
  mapping: z.enum(["linear", "logarithmic", "quantize"]).default("linear").describe("Value mapping method"),
  rangeMin: z.number().optional().describe("Output range minimum"),
  rangeMax: z.number().optional().describe("Output range maximum"),
  sampleInterval: z.number().int().positive().default(50).describe("Sample interval in ms (data point spacing)"),
});

export const UnbindDataInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  property: z.enum(["translateX", "translateY", "scale", "rotate", "opacity", "width", "height", "backgroundColor"]).optional().describe("Property to unbind (omit for all)"),
});

export const DataDrivenChartInput = z.object({
  projectId: zIdField,
  dataSourceName: zIdField,
  chartType: z.enum(["bar", "line", "pie", "scatter", "area"]).describe("Chart type"),
  xColumn: z.string().describe("X-axis column"),
  yColumn: z.string().describe("Y-axis column (or value column for bar/pie)"),
  name: z.string().optional(),
  animated: z.boolean().default(true).describe("Animate chart on enter (build-up)"),
  durationMs: z.number().int().positive().default(1200).describe("Animation duration in ms"),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional().describe("Series color"),
});

/* --------------------------- Effects & filters library --------------------------- */
export const ApplyGaussianBlurInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  radius: z.number().min(0).max(100).default(8).describe("Blur radius in px"),
});
export const ApplyDirectionalBlurInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  angle: z.number().default(0).describe("Direction in degrees (0 = horizontal, 90 = vertical)"),
  length: z.number().min(0).max(200).default(20).describe("Blur length in px"),
});
export const ApplyRadialBlurInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  centerX: z.number().default(0).describe("Blur center X (relative to layer center)"),
  centerY: z.number().default(0).describe("Blur center Y"),
  amount: z.number().min(0).max(100).default(15).describe("Blur strength (zoom/spin blend)"),
  spin: z.boolean().default(false).describe("If true, applies spin blur; otherwise zoom blur"),
});
export const ApplySharpenInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  amount: z.number().min(0).max(100).default(50).describe("Sharpen amount (0-100)"),
  radius: z.number().min(0.1).max(10).default(1).describe("Edge detection radius in px"),
  threshold: z.number().min(0).max(255).default(0).describe("Luma threshold below which no sharpening"),
});
export const ApplyWaveWarpInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  waveHeight: z.number().min(0).max(200).default(20).describe("Wave amplitude in px"),
  waveWidth: z.number().min(1).max(500).default(50).describe("Wave wavelength in px"),
  direction: z.number().default(90).describe("Wave direction in degrees"),
  speed: z.number().min(0).default(0).describe("Phase animation speed (cycles per second)"),
  phase: z.number().default(0).describe("Initial phase in degrees"),
});
export const ApplyRippleInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  centerX: z.number().default(0),
  centerY: z.number().default(0),
  radius: z.number().min(1).max(500).default(100).describe("Ripple radius in px"),
  waveSpeed: z.number().min(0).default(1).describe("Wave speed"),
  frequency: z.number().min(0.1).default(3).describe("Number of ripples within radius"),
  amplitude: z.number().min(0).max(100).default(10).describe("Ripple amplitude"),
});
export const ApplyBulgeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  centerX: z.number().default(0),
  centerY: z.number().default(0),
  radius: z.number().min(1).max(500).default(100).describe("Bulge radius in px"),
  height: z.number().min(-100).max(100).default(50).describe("Bulge height (-100 = pinch, +100 = bulge)"),
  antialias: z.boolean().default(true),
});
export const ApplyGlowInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  threshold: z.number().min(0).max(255).default(80).describe("Luma threshold above which pixels glow"),
  radius: z.number().min(0).max(100).default(12).describe("Glow blur radius in px"),
  intensity: z.number().min(0).max(3).default(1).describe("Glow brightness multiplier"),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional().describe("Optional tint color"),
});
export const ApplyMosaicInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  blockSize: z.number().min(1).max(100).default(10).describe("Block size in px"),
  sharpEdges: z.boolean().default(false).describe("If true, hard block edges; otherwise blended"),
});
export const ApplyFindEdgesInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  invert: z.boolean().default(false).describe("Invert result (white edges on black vs black on white)"),
  blend: z.number().min(0).max(1).default(0).describe("Blend with original (0 = full edge, 1 = original)"),
});
export const ApplyLensFlareInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  centerX: z.number().default(0).describe("Flare source X"),
  centerY: z.number().default(0).describe("Flare source Y"),
  brightness: z.number().min(0).max(200).default(100).describe("Flare brightness"),
  rays: z.number().min(0).max(20).default(6).describe("Number of light rays"),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#ffffff"),
});
export const ApplyFourColorGradientInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  color1: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#ff0066"),
  color2: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#00ff66"),
  color3: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#0066ff"),
  color4: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#666600"),
  blend: z.number().min(0).max(1).default(0.5).describe("Cross-blend smoothness"),
});

/* --------------------------- Expression engine & animation assistants --------------------------- */
export const RemoveExpressionInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  property: z.enum(["translateX", "translateY", "scale", "rotate", "opacity", "width", "height"]),
});
export const SetLoopExpressionInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  property: z.enum(["translateX", "translateY", "scale", "rotate", "opacity"]).default("rotate"),
  mode: z.enum(["cycle", "pingpong", "offset", "continue"]).default("cycle").describe("Loop mode — cycle (repeat), pingpong (alternate), offset (cumulative), continue (extrapolate)"),
  durationMs: z.number().int().positive().default(1000).describe("Loop period in ms"),
});
export const SequenceLayersInput = z.object({
  projectId: zIdField,
  staggerMs: z.number().int().min(0).default(200).describe("Time offset between each layer"),
  overlap: z.number().min(0).max(1).default(0).describe("0 = sequential, 1 = full overlap"),
  order: z.enum(["top-to-bottom", "bottom-to-top", "selection-order"]).default("top-to-bottom"),
  ease: z.boolean().default(true).describe("Ease each layer's entry"),
});
export const ExponentialScaleInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  fromScale: z.number().min(0).default(1).describe("Start scale"),
  toScale: z.number().min(0).default(2).describe("End scale"),
  durationMs: z.number().int().positive().default(1000).describe("Transition duration in ms"),
});
export const SmoothKeyframesInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  property: z.enum(["translateX", "translateY", "scale", "rotate", "opacity"]).default("translateY"),
  tolerance: z.number().min(0).max(1).default(0.2).describe("Smoothing tolerance (0 = none, 1 = max)"),
});
export const WiggleKeyframesInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  property: z.enum(["translateX", "translateY", "scale", "rotate", "opacity"]).default("translateY"),
  frequency: z.number().min(0.1).default(2).describe("Wiggles per second"),
  amplitude: z.number().default(20).describe("Wiggle magnitude"),
  samples: z.number().int().min(2).max(60).default(12).describe("Number of keyframes to generate"),
});
export const AudioToKeyframesInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  audioSourceId: zIdField.describe("Reference to audio component id"),
  property: z.enum(["translateX", "translateY", "scale", "rotate", "opacity"]).default("scale"),
  channel: z.enum(["both", "left", "right"]).default("both"),
  samples: z.number().int().min(2).max(120).default(20).describe("Number of keyframes to generate"),
  smoothing: z.number().min(0).max(1).default(0.3).describe("0 = raw, 1 = heavily smoothed"),
});

/* --------------------------- Type animation system --------------------------- */
export const SetRangeSelectorInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  unit: z.enum(["characters", "words", "lines"]).default("characters").describe("Selection unit"),
  start: z.number().min(0).max(100).default(0).describe("Start of selection as percentage"),
  end: z.number().min(0).max(100).default(100).describe("End of selection as percentage"),
  offset: z.number().default(0).describe("Selection offset (-100 to 100)"),
  ease: z.boolean().default(true),
  basedOn: z.enum(["characters", "words", "lines", "all"]).default("characters"),
  mode: z.enum(["add", "subtract", "intersect", "min", "max"]).default("add"),
});
export const SetTextWigglerInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  frequency: z.number().min(0.1).default(3).describe("Wiggles per second"),
  amplitudeX: z.number().default(5).describe("Horizontal displacement"),
  amplitudeY: z.number().default(5).describe("Vertical displacement"),
  amplitudeRotation: z.number().default(5).describe("Rotation in degrees"),
  amplitudeScale: z.number().default(0).describe("Scale variation"),
  correlation: z.number().min(0).max(1).default(0.5).describe("Spatial correlation between characters"),
});
export const TextOnPathInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  pathId: zIdField.describe("Reference to a path component id"),
  startOffset: z.number().default(0).describe("Offset along path (0-100 percent)"),
  reverse: z.boolean().default(false),
  alignToPath: z.boolean().default(true).describe("Rotate characters to follow path tangent"),
  baselineShift: z.number().default(0).describe("Vertical offset from path"),
});
export const SetVerticalTextInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  enabled: z.boolean().default(true),
  rotateChars: z.boolean().default(false).describe("If true, each character is rotated 90deg"),
  lineFlow: z.enum(["top-to-bottom", "right-to-left"]).default("top-to-bottom"),
});
export const SetKerningInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  tracking: z.number().default(0).describe("Letter spacing in px (positive = loose, negative = tight)"),
  pairAdjustment: z.boolean().default(true).describe("Apply optical pair kerning"),
  range: z.object({
    start: z.number().default(0),
    end: z.number().default(-1).describe("-1 = to end of text"),
  }).optional(),
});
export const SetLeadingInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  lineHeight: z.number().min(0.5).max(5).default(1.2).describe("Line height multiplier"),
  baselineShift: z.number().default(0).describe("Baseline shift in px"),
  autoLeading: z.boolean().default(false).describe("Auto-compute leading from font metrics"),
});
export const PerCharacterTransformInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  translateX: z.number().default(0),
  translateY: z.number().default(0),
  scale: z.number().default(1),
  rotate: z.number().default(0),
  opacity: z.number().min(0).max(1).default(1),
  anchor: z.enum(["center", "baseline", "top"]).default("center"),
  staggerMs: z.number().int().min(0).default(50).describe("Per-character stagger in ms"),
});
export const SetTextAnimatorInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  animator: z.enum(["position", "scale", "rotation", "opacity", "color", "fillColor", "tracking"]).describe("Property to animate per-character"),
  from: z.string().optional().describe("Start value (color hex or number)"),
  to: z.string().optional().describe("End value (color hex or number)"),
  rangeStart: z.number().min(0).max(100).default(0),
  rangeEnd: z.number().min(0).max(100).default(100),
  smooth: z.number().min(0).max(100).default(50).describe("Range falloff percentage"),
});

/* --------------------------- Motion tracking & stabilization --------------------------- */
export const TrackPointInput = z.object({
  projectId: zIdField,
  componentId: zIdField.describe("Layer to track (provides reference frame)"),
  pointX: z.number().describe("Initial track point X"),
  pointY: z.number().describe("Initial track point Y"),
  searchSize: z.number().int().min(8).max(200).default(32).describe("Search region size in px"),
  trackName: z.string().optional().describe("Optional name for the track"),
  durationMs: z.number().int().positive().optional().describe("Track duration (default = layer duration)"),
});
export const TrackCameraInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  solveFocalLength: z.boolean().default(true).describe("Solve for camera focal length"),
  createNulls: z.boolean().default(true).describe("Create null layers for solved 3D points"),
  threshold: z.number().min(0).max(1).default(0.5).describe("Feature detection threshold"),
});
export const WarpStabilizerInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  smoothness: z.number().min(0).max(100).default(50).describe("0 = no smoothing, 100 = locked off"),
  method: z.enum(["position", "positionScaleRotation", "perspective", "subspaceWarp"]).default("position"),
  crop: z.number().min(0).max(50).default(10).describe("Auto-crop percentage"),
  noMotion: z.boolean().default(false).describe("If true, lock to first frame (no motion allowed)"),
});
export const ApplyTrackToLayerInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  trackName: z.string().describe("Name of track to apply"),
  applyTo: z.enum(["position", "anchorPoint", "positionScale", "positionScaleRotation", "transform"]).default("position"),
  matchName: z.boolean().default(true).describe("Match layer name to track name"),
  compensate: z.boolean().default(true).describe("Compensate for layer's own motion"),
});
export const EditMotionPathInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
    ease: z.enum(["linear", "bezier", "hold"]).default("bezier"),
    handleIn: z.object({ x: z.number(), y: z.number() }).optional(),
    handleOut: z.object({ x: z.number(), y: z.number() }).optional(),
  })).min(2).describe("Ordered path control points"),
  closed: z.boolean().default(false).describe("Whether the path is closed"),
  roving: z.boolean().default(false).describe("Use roving keyframes for constant speed"),
});
export const AutoOrientPathInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  orientAlong: z.enum(["motionPath", "trackPath", "camera"]).default("motionPath"),
  axis: z.enum(["auto", "x", "y"]).default("auto"),
  smoothing: z.number().min(0).max(1).default(0.2).describe("Orientation smoothing"),
  offset: z.number().default(0).describe("Orientation offset in degrees"),
});

/* --------------------------- Compositing & blending --------------------------- */
export const SetAdvancedBlendingInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  fillOpacity: z.number().min(0).max(1).optional().describe("Fill opacity (separate from layer opacity)"),
  redChannel: z.boolean().optional().describe("Include red channel in blend"),
  greenChannel: z.boolean().optional(),
  blueChannel: z.boolean().optional(),
  knockout: z.enum(["none", "shallow", "deep"]).optional().default("none"),
  blendIfSource: z.enum(["gray", "red", "green", "blue"]).optional(),
  blendIfRange: z.tuple([z.number().min(0).max(255), z.number().min(0).max(255)]).optional(),
});

export const PrecomposeInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(1),
  name: z.string().min(1).max(80).default("Pre-comp"),
  moveAttributes: z.boolean().default(true).describe("Move layer attributes into new comp"),
});

export const CollapseTransformationsInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  enabled: z.boolean().default(true),
});

export const SetAlphaModeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  mode: z.enum(["straight", "premultiplied"]).default("straight"),
  premultiplyColor: z.string().optional().describe("Color to premultiply with (for premultiplied mode)"),
});

export const SetTransferModeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  mode: z.enum(["normal", "stencil-alpha", "stencil-luma", "silhouette-alpha", "silhouette-luma", "alpha-add", "luma-matte"]),
});

export const SetBlendingGroupInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  isolated: z.boolean().default(true).describe("Isolate blending within this group"),
  groupOpacity: z.number().min(0).max(1).optional(),
  knockout: z.boolean().optional().default(false),
});

/* --------------------------- Time effects & rhythm --------------------------- */
export const TimeDisplacementInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  maxDisplacementMs: z.number().min(0).max(2000).default(200).describe("Max time offset in ms"),
  displacementSource: zIdField.optional().describe("Layer to use as displacement map"),
  resolution: z.enum(["low", "medium", "high"]).default("medium"),
});

export const EchoAdvancedInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  numberOfEchoes: z.number().int().min(1).max(50).default(6),
  echoDelayMs: z.number().min(10).max(2000).default(80),
  decay: z.number().min(0).max(1).default(0.85),
  echoOperator: z.enum(["add", "maximum", "minimum", "screen", "difference", "composite-in-front", "composite-behind", "crossfade"]).default("composite-in-front"),
});

export const SequenceWithTransitionInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(2).optional(),
  transitionType: z.enum(["crossfade", "dissolve", "cut", "wipe", "push"]).default("crossfade"),
  transitionDurationMs: z.number().min(0).max(3000).default(300),
  overlapMs: z.number().min(0).max(5000).default(0),
});

export const TimeReverseLayerInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
});

export const FreezeFrameInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  atTimeMs: z.number().optional().describe("Frame to hold (default: current time)"),
});

export const PosterizeTimeAdvancedInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  fps: z.number().min(1).max(60).default(12),
  range: z.enum(["full", "first-half", "second-half", "custom"]).default("full"),
  rangeStartMs: z.number().optional(),
  rangeEndMs: z.number().optional(),
  applyToVelocity: z.boolean().default(false).describe("Apply posterize to velocity instead of time"),
});

export const TimeWarpRemappingInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  speedKeyframes: z.array(z.object({
    timeMs: z.number(),
    speed: z.number().min(0).max(10),
    interpolation: z.enum(["linear", "ease", "hold"]).default("ease"),
  })).min(2),
  preserveTotalDuration: z.boolean().default(false),
});

/* --------------------------- Camera lens & optical --------------------------- */
export const LensDistortionInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  amount: z.number().min(-1).max(1).default(0.2).describe("Negative = barrel, positive = pincushion"),
  vertical: z.number().optional().describe("Vertical distortion amount"),
  horizontal: z.number().optional().describe("Horizontal distortion amount"),
  remove: z.boolean().default(false).describe("If true, reverse the distortion"),
});

export const ChromaticAberrationInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  redOffset: z.number().min(-30).max(30).default(2).describe("Red channel offset in px"),
  blueOffset: z.number().min(-30).max(30).default(-2).describe("Blue channel offset in px"),
  radial: z.boolean().default(true).describe("Apply offset radially from center"),
  center: z.tuple([z.number(), z.number()]).optional().describe("Center point [x, y] for radial mode"),
});

export const VignetteInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  amount: z.number().min(0).max(1).default(0.5),
  size: z.number().min(0).max(1).default(0.5).describe("How far the darkening extends from center"),
  softness: z.number().min(0).max(1).default(0.5),
  color: z.string().default("#000000"),
});

export const CameraShakeProceduralInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  intensity: z.number().min(0).max(5).default(1).describe("Shake magnitude in px"),
  frequency: z.number().min(0.1).max(20).default(2).describe("Shake frequency in Hz"),
  rotation: z.boolean().default(true).describe("Include rotation shake"),
  seed: z.number().int().default(1),
});

export const OpticalFlowInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  output: z.enum(["vector-field", "motion-magnitude", "motion-direction"]).default("motion-magnitude"),
  quality: z.enum(["draft", "high", "best"]).default("high"),
  smoothing: z.number().min(0).max(1).default(0.3),
});

export const MotionMatchMoveInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  trackName: z.string().optional().describe("Existing track to use"),
  applyTo: z.enum(["position", "position-rotation", "position-scale", "position-scale-rotation"]).default("position"),
  targetComponentId: zIdField.optional().describe("If set, apply to this component; else to source"),
  stabilization: z.boolean().default(false).describe("If true, stabilize instead of match"),
});

export const LensFlareAnamorphicInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  position: z.tuple([z.number(), z.number()]).default([0.5, 0.5]).describe("Normalized position [0-1, 0-1]"),
  brightness: z.number().min(0).max(5).default(1.5),
  streakLength: z.number().min(0).max(1000).default(120),
  streakAngle: z.number().min(0).max(360).default(0),
  color: z.string().default("#88ccff").describe("Streak tint"),
});

export const DepthOfFieldAdvancedInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  focusDistance: z.number().min(0).default(800),
  aperture: z.number().min(0).max(2).default(0.3),
  blurAmount: z.number().min(0).max(50).default(8),
  highlightShape: z.enum(["circle", "hexagon", "octagon"]).default("circle"),
  focusCurve: z.array(z.object({
    distance: z.number(),
    blur: z.number().min(0).max(1),
  })).optional().describe("Custom focus-distance-to-blur curve"),
});

/* --------------------------- Paint & cloning --------------------------- */
export const PaintStrokeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
    pressure: z.number().min(0).max(1).optional(),
  })).min(2),
  color: z.string().default("#ffffff"),
  opacity: z.number().min(0).max(1).default(1),
  blendMode: z.enum(["normal", "multiply", "screen", "overlay"]).default("normal"),
});

export const CloneStampInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  sourcePoint: z.tuple([z.number(), z.number()]),
  destinationPoint: z.tuple([z.number(), z.number()]),
  sourceLayerId: zIdField.optional().describe("Layer to sample from (default: current)"),
  brushSize: z.number().min(1).max(500).default(40),
  opacity: z.number().min(0).max(1).default(1),
  aligned: z.boolean().default(true),
});

export const BrushSettingsInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  size: z.number().min(1).max(500).default(40),
  hardness: z.number().min(0).max(1).default(0.8),
  opacity: z.number().min(0).max(1).default(1),
  spacing: z.number().min(1).max(100).default(25).describe("Brush stamp spacing in % of size"),
  flow: z.number().min(0).max(1).default(1).describe("Flow rate"),
  angle: z.number().min(0).max(360).optional(),
  roundness: z.number().min(0).max(1).optional(),
});

export const RevealWithBrushInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
    pressure: z.number().min(0).max(1).optional(),
  })).min(2),
  reveal: z.boolean().default(true).describe("true = reveal, false = hide"),
  feather: z.number().min(0).max(50).default(0),
});

export const EraseStrokeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
  })).min(2),
  brushSize: z.number().min(1).max(500).default(40),
  hardness: z.number().min(0).max(1).default(0.8),
});

export const PaintAnimatorInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  strokeId: zIdField.optional().describe("Stroke to animate (default: most recent)"),
  mode: z.enum(["write-on", "reveal", "grow-from-start", "grow-from-end"]).default("write-on"),
  durationMs: z.number().int().positive().default(1500),
  startMs: z.number().int().nonnegative().default(0),
  endValue: z.number().min(0).max(1).default(1),
  easing: z.enum(["linear", "ease", "ease-in", "ease-out"]).default("ease"),
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
  enable_motion_blur: EnableMotionBlurInput,
  add_null_object: AddNullObjectInput,
  trim_path: TrimPathInput,
  add_repeater: AddRepeaterInput,
  add_echo: AddEchoInput,
  set_time_remap: SetTimeRemapInput,
  add_layer_effect: AddLayerEffectInput,
  add_mask: AddMaskInput,
  set_mask_mode: SetMaskModeInput,
  set_track_matte: SetTrackMatteInput,
  create_shape_layer: CreateShapeLayerInput,
  posterize_time: PosterizeTimeInput,
  add_text_animator: AddTextAnimatorInput,
  set_keyframe_interpolation: SetKeyframeInterpolationInput,
  set_expression: SetExpressionInput,
  set_gradient_fill: SetGradientFillInput,
  set_gradient_stroke: SetGradientStrokeInput,
  apply_wiggle: ApplyWiggleInput,
  add_particle_emitter: AddParticleEmitterInput,
  add_camera: AddCameraInput,
  set_camera_transform: SetCameraTransformInput,
  bind_audio_to_property: BindAudioToPropertyInput,
  unbind_audio: UnbindAudioInput,
  add_puppet_pin: AddPuppetPinInput,
  apply_mesh_warp: ApplyMeshWarpInput,
  remove_mesh_warp: RemoveMeshWarpInput,
  add_light: AddLightInput,
  set_light_transform: SetLightTransformInput,
  set_light_properties: SetLightPropertiesInput,
  remove_light: RemoveLightInput,
  cast_shadow: CastShadowInput,
  set_camera_dof: SetCameraDOFInput,
  set_levels: SetLevelsInput,
  set_curves: SetCurvesInput,
  set_color_balance: SetColorBalanceInput,
  set_hue_saturation: SetHueSaturationInput,
  set_vibrance: SetVibranceInput,
  set_exposure: SetExposureInput,
  set_shadow_highlight: SetShadowHighlightInput,
  set_selective_color: SetSelectiveColorInput,
  offset_path: OffsetPathInput,
  pucker_bloat: PuckerBloatInput,
  round_corners: RoundCornersInput,
  zig_zag: ZigZagInput,
  twist_path: TwistPathInput,
  merge_paths: MergePathsInput,
  shape_boolean: ShapeBooleanInput,
  trim_path_multiple: TrimPathMultipleInput,
  load_data_source: LoadDataSourceInput,
  list_data_sources: ListDataSourcesInput,
  bind_property_to_data: BindPropertyToDataInput,
  unbind_data: UnbindDataInput,
  data_driven_chart: DataDrivenChartInput,
  apply_gaussian_blur: ApplyGaussianBlurInput,
  apply_directional_blur: ApplyDirectionalBlurInput,
  apply_radial_blur: ApplyRadialBlurInput,
  apply_sharpen: ApplySharpenInput,
  apply_wave_warp: ApplyWaveWarpInput,
  apply_ripple: ApplyRippleInput,
  apply_bulge: ApplyBulgeInput,
  apply_glow: ApplyGlowInput,
  apply_mosaic: ApplyMosaicInput,
  apply_find_edges: ApplyFindEdgesInput,
  apply_lens_flare: ApplyLensFlareInput,
  apply_four_color_gradient: ApplyFourColorGradientInput,
  remove_expression: RemoveExpressionInput,
  set_loop_expression: SetLoopExpressionInput,
  sequence_layers: SequenceLayersInput,
  exponential_scale: ExponentialScaleInput,
  smooth_keyframes: SmoothKeyframesInput,
  wiggle_keyframes: WiggleKeyframesInput,
  audio_to_keyframes: AudioToKeyframesInput,
  set_range_selector: SetRangeSelectorInput,
  set_text_wiggler: SetTextWigglerInput,
  text_on_path: TextOnPathInput,
  set_vertical_text: SetVerticalTextInput,
  set_kerning: SetKerningInput,
  set_leading: SetLeadingInput,
  per_character_transform: PerCharacterTransformInput,
  set_text_animator: SetTextAnimatorInput,
  track_point: TrackPointInput,
  track_camera: TrackCameraInput,
  warp_stabilizer: WarpStabilizerInput,
  apply_track_to_layer: ApplyTrackToLayerInput,
  edit_motion_path: EditMotionPathInput,
  auto_orient_path: AutoOrientPathInput,
  set_advanced_blending: SetAdvancedBlendingInput,
  precompose: PrecomposeInput,
  collapse_transformations: CollapseTransformationsInput,
  set_alpha_mode: SetAlphaModeInput,
  set_transfer_mode: SetTransferModeInput,
  set_blending_group: SetBlendingGroupInput,
  time_displacement: TimeDisplacementInput,
  echo_advanced: EchoAdvancedInput,
  sequence_with_transition: SequenceWithTransitionInput,
  time_reverse_layer: TimeReverseLayerInput,
  freeze_frame: FreezeFrameInput,
  posterize_time_advanced: PosterizeTimeAdvancedInput,
  time_warp_remapping: TimeWarpRemappingInput,
  lens_distortion: LensDistortionInput,
  chromatic_aberration: ChromaticAberrationInput,
  vignette: VignetteInput,
  camera_shake_procedural: CameraShakeProceduralInput,
  optical_flow: OpticalFlowInput,
  motion_match_move: MotionMatchMoveInput,
  lens_flare_anamorphic: LensFlareAnamorphicInput,
  depth_of_field_advanced: DepthOfFieldAdvancedInput,
  paint_stroke: PaintStrokeInput,
  clone_stamp: CloneStampInput,
  brush_settings: BrushSettingsInput,
  reveal_with_brush: RevealWithBrushInput,
  erase_stroke: EraseStrokeInput,
  paint_animator: PaintAnimatorInput,
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
  enable_motion_blur: "Enable velocity-driven motion blur on a layer — applies a CSS blur filter while the layer is animating, simulating the streaking that occurs when a real camera shutter captures fast motion. Tunable with intensity and shutter angle. Use when the user says 'motion blur', 'enable motion blur', 'add motion blur', 'blur the motion', or 'streak'.",
  add_null_object: "Create a null object — an invisible controller layer (zero size, fully transparent, non-interactive) that can serve as a parent for other layers. Use for organizing hierarchies and driving multiple layers from one transform. Use when the user says 'null object', 'add a null', 'create null', or 'invisible controller'.",
  trim_path: "Animate a trim-path reveal on a layer — draws the layer's outline progressively using stroke-dasharray/stroke-dashoffset. Use for path-drawing effects, line-write-on, and SVG-style reveals. Use when the user says 'trim path', 'trim the path', 'draw on', 'write-on path', 'reveal the path', or 'stroke draw'.",
  add_repeater: "Duplicate a layer N times with a transform offset (x/y/rotate/scale) and opacity decay between copies — generates grid, radial, or cascade patterns. Use when the user says 'repeater', 'repeat this', 'duplicate in a grid', 'make a pattern', 'tile this', or 'cascade copies'.",
  add_echo: "Create motion-trail echoes of a layer — N delayed copies with fading opacity (and optional scale shrink) that trail the original during animation. Use when the user says 'echo', 'motion trail', 'afterimage', 'tracer', 'tail effect', or 'trail'.",
  set_time_remap: "Set per-layer time remapping — controls the playback rate of a single layer independently of the timeline. rate=2 doubles speed, 0.5 halves, 0 freezes (optionally at a specific ms), -1 reverses. Use when the user says 'time remap', 'remap time', 'slow this layer', 'speed up this layer', 'freeze this', 'reverse playback', or 'freeze frame'.",
  add_layer_effect: "Add a CSS-based layer effect: drop-shadow, inner-shadow (via inset box-shadow), outer-glow, inner-glow, or stroke (outline). Use when the user says 'drop shadow', 'add a shadow', 'glow effect', 'outer glow', 'inner shadow', 'add stroke', 'outline the layer', or 'layer effect'.",
  add_mask: "Add a vector mask to a layer — rectangle, ellipse, or SVG path — with professional mask blend modes (add, subtract, intersect, difference, lighten, darken), feather (soft edges), expansion, and inversion. Masks non-destructively clip the layer's visible region. Use when the user says 'mask', 'add a mask', 'mask this layer', 'clip the layer', 'reveal only', 'subtract mask', or 'intersect mask'.",
  set_mask_mode: "Modify an existing mask's blend mode, feather, expansion, or inversion. Use when the user says 'change mask mode', 'make mask subtract', 'feather the mask', 'soften the mask edge', 'invert the mask', or 'expand the mask'.",
  set_track_matte: "Use one layer as a track matte for another — alpha matte (transparency-based) or luma matte (brightness-based), with optional inversion. The matte layer's shape controls the visibility of the target layer. Use when the user says 'track matte', 'alpha matte', 'luma matte', 'use as mask', 'matte this layer', or 'reveal through'.",
  create_shape_layer: "Create a vector shape layer — rectangle, ellipse, polygon, star, line, or custom SVG path — with full control over fill, stroke (color and width), corner radius, and rotation. Use when the user says 'shape layer', 'add a rectangle', 'draw a circle', 'create a polygon', 'make a star', 'add a line', or 'draw a path'.",
  posterize_time: "Posterize a layer's time — quantizes its animation to a target frame rate for stop-motion, low-FPS, or stepped looks (e.g. 12fps = stop-motion, 24fps = cinematic). Implemented via CSS steps() timing. Use when the user says 'posterize time', 'low fps', 'stop motion', 'stepped animation', 'stutter', or 'choppy frames'.",
  add_text_animator: "Add a per-character or per-word text animator with a range selector — animates properties (position, scale, rotation, opacity, color) across a percentage range of the text with stagger. Use when the user says 'text animator', 'per character animation', 'character-by-character', 'word by word', 'typewriter', 'stagger text', or 'range selector'.",
  set_keyframe_interpolation: "Set the interpolation type for a keyframe — linear, bezier, hold (freeze value until next keyframe), auto-bezier (auto-smoothed), or continuous. Optionally mark as roving (time auto-adjusts for constant velocity). Use when the user says 'hold keyframe', 'freeze frame', 'roving keyframe', 'auto bezier', 'smooth keyframe', 'continuous interpolation', or 'linear keyframe'.",
  set_expression: "Set a JavaScript expression on a property. The expression is evaluated each frame with variables: time (ms), index, duration (ms), value. Example: 'Math.sin(time / 500) * 50 + 50' for pulsing opacity. Use when the user says 'expression', 'formula', 'math', 'oscillate', 'pulse', 'wiggle', or writes an equation.",
  set_gradient_fill: "Apply a linear or radial gradient fill to a layer. Specify 2-8 color stops with positions and an angle (linear) or center/radius (radial). Use when the user says 'gradient fill', 'linear gradient', 'radial gradient', 'color sweep', 'rainbow fill', or 'gradient background'.",
  set_gradient_stroke: "Apply a gradient stroke (border) to a layer with 2-8 color stops. Use when the user says 'gradient stroke', 'gradient border', 'gradient outline', or 'color stroke'.",
  apply_wiggle: "Apply organic wiggle to a property — pseudo-random fluctuation pre-sampled into keyframes. Specify frequency (Hz), amplitude, octaves, and seed for deterministic noise. Use when the user says 'wiggle', 'jitter', 'shake randomly', 'add noise to motion', 'random motion', or 'tremble'.",
  add_particle_emitter: "Create a Canvas2D-based particle emitter layer — emits particles at a rate, with lifespan, gravity, spread, speed, and start/end color/size/opacity. Renders as a JS-driven <canvas> overlay. Use when the user says 'particle', 'emitter', 'spawn particles', 'fire particles', 'burst', 'confetti', 'sparks', or 'snow'.",
  add_camera: "Add a 3D camera to the project that drives multi-plane parallax for layers with translateZ. Specify position (X/Y/Z), focal length, optional depth-of-field, and rotation. Layers with non-zero translateZ shift in screen-space based on camera position. Use when the user says '3d camera', 'add camera', 'multi-plane', 'parallax camera', 'dolly', or 'z-depth'.",
  set_camera_transform: "Update the project camera's position, focal length, depth-of-field, or rotation. Use when the user says 'move the camera', 'zoom camera', 'dolly in', 'pan camera', or 'tilt camera'.",
  bind_audio_to_property: "Bind a target property (opacity, scale, translateX, translateY, rotate, backgroundColor) to an audio component's frequency band (bass, mid, treble, overall). The property value is driven by the audio level via Web Audio AnalyserNode. Use when the user says 'audio reactive', 'react to audio', 'drive with audio', 'beat detection', 'music sync', or 'sound reactive'.",
  unbind_audio: "Remove an audio-reactive binding from a layer. Use when the user says 'stop audio reactive', 'unbind audio', 'remove audio binding', or 'detach audio'.",
  add_puppet_pin: "Add a puppet pin to a layer at a local (x, y) position. Pins are stored and used by the mesh warp deformation. Use when the user says 'puppet pin', 'add pin', 'deformation pin', or 'puppet tool'.",
  apply_mesh_warp: "Apply SVG turbulence-based mesh warp to a layer — organic distortion using feTurbulence + feDisplacementMap. Tunable turbulence, scale, octaves, animation speed, and seed. Use when the user says 'mesh warp', 'puppet warp', 'warp the layer', 'distort', 'liquid effect', 'ripple the layer', or 'organic deformation'.",
  remove_mesh_warp: "Remove mesh warp (turbulence displacement filter) from a layer. Use when the user says 'remove warp', 'undo mesh warp', 'remove distortion', or 'straighten layer'.",
  add_light: "Add a 3D light source to the project — parallel (directional sun light), point (omni light), spot (cone with angle and feather), or ambient (fill light). Specify position in 3D space, color, intensity, and optional shadow casting. Lights affect 3D layers based on their translateZ depth. Use when the user says 'add light', 'spotlight', 'point light', 'sun light', 'directional light', or 'ambient light'.",
  set_light_transform: "Update a 3D light's position and target. Use when the user says 'move the light', 'reposition light', 'aim the light', or 'rotate the spotlight'.",
  set_light_properties: "Update a 3D light's color, intensity, cone angle, cone feather, falloff, or shadow casting. Use when the user says 'change light color', 'dim the light', 'brighten the light', 'soften the spotlight edge', or 'enable shadows'.",
  remove_light: "Remove a 3D light from the project by ID. Use when the user says 'delete light', 'remove light', or 'turn off that light source'.",
  cast_shadow: "Configure per-layer shadow casting — enable shadow casting, set opacity, blur, and offset for the shadow projected by 3D lights onto this layer. Use when the user says 'cast shadow', 'enable shadow', 'soften the shadow', or 'shadow under this layer'.",
  set_camera_dof: "Configure depth-of-field blur on the project's 3D camera — focus distance, aperture (blur amount), and max blur radius. Layers farther from the focus distance blur more. Use when the user says 'depth of field', 'DOF', 'focus blur', 'background blur', 'bokeh', or 'defocus background'.",
  set_levels: "Apply professional levels adjustment — input black/white points, gamma, output black/white points. Per-channel (RGB/red/green/blue) or master. Implemented via SVG feComponentTransfer. Use when the user says 'levels', 'adjust black point', 'set white point', 'fix contrast', or 'gamma adjustment'.",
  set_curves: "Apply RGB curves adjustment — 2-16 control points interpolated as smooth bezier, per-channel (RGB/red/green/blue). Implemented via SVG feComponentTransfer table. Use when the user says 'curves', 'RGB curve', 'color curve', 'lift the shadows', or 'lower the highlights'.",
  set_color_balance: "Apply color balance across tonal ranges — separate red/green/blue offsets for shadows, midtones, and highlights. Use when the user says 'color balance', 'warm up the shadows', 'cool the highlights', or 'shift midtone color'.",
  set_hue_saturation: "Apply hue/saturation/lightness adjustment — hue shift in degrees, saturation -100..100, lightness -100..100. Optional color range targeting (master/red/yellow/green/cyan/blue/magenta). Use when the user says 'hue saturation', 'shift hue', 'boost saturation', 'desaturate', 'shift colors', or 'colorize'.",
  set_vibrance: "Apply vibrance — selectively boosts less-saturated colors while protecting skin tones, unlike plain saturation. -100..100. Use when the user says 'vibrance', 'pop the colors', 'make colors richer', or 'subtle saturation boost'.",
  set_exposure: "Apply exposure adjustment in stops (-20..20), with shadow offset and gamma correction. Use when the user says 'exposure', 'overexpose', 'underexpose', 'brighten exposure', or 'fix exposure'.",
  set_shadow_highlight: "Apply shadow/highlight recovery — bring out detail in shadows and recover blown highlights, with tonal width and radius controls. Use when the user says 'recover shadows', 'fix highlights', 'shadow highlight', 'bring out shadow detail', or 'recover blown highlights'.",
  set_selective_color: "Apply selective color adjustment — target specific color ranges (reds/yellows/greens/cyans/blues/magentas/whites/neutrals/blacks) with CMYK sliders, relative or absolute method. Use when the user says 'selective color', 'tweak just the reds', 'shift only the blues', or 'target specific colors'.",
  offset_path: "Offset a layer's SVG path inward or outward by a pixel amount — expand or shrink the shape while preserving its form. Miter limit and line join (miter/round/bevel) control corner behavior. Use when the user says 'offset path', 'inset path', 'expand path', 'outset path', or 'grow the shape'.",
  pucker_bloat: "Apply pucker (inward) or bloat (outward) deformation to a layer's path — vertices pull toward (pucker) or push away from (bloat) the centroid, creating starburst or inflated effects. -100..100. Use when the user says 'pucker', 'bloat', 'inflate the shape', 'starburst the path', or 'suck the shape inward'.",
  round_corners: "Round all corners of a layer's path to a given radius in px. Sharp angles become smooth arcs. Use when the user says 'round corners', 'soften the corners', 'rounded edges', or 'fillet the path'.",
  zig_zag: "Apply zig-zag deformation to a layer's path — adds uniform ridges along edges with adjustable size (px) and ridge count, corner or smooth points. Use when the user says 'zig zag', 'sawtooth edge', 'ridges on the path', 'crenellate', or 'wavy edge'.",
  twist_path: "Apply twist deformation to a layer's path — rotates vertices around a center based on their distance from it, creating spiral/tornado effects. Angle in degrees (-720..720). Use when the user says 'twist', 'spiral the path', 'tornado effect', 'swirl the shape', or 'rotate the edges'.",
  merge_paths: "Merge multiple SVG paths within a layer using boolean operations — merge (union), add, subtract, intersect, or exclude. Combines 2-8 paths into one result. Use when the user says 'merge paths', 'combine paths', 'union these paths', 'subtract path', or 'intersect paths'.",
  shape_boolean: "Apply boolean operations between two components — union (combine), subtract (cut), intersect (overlap only), exclude (XOR). Optionally create a new component or modify the target in place. Use when the user says 'boolean', 'union shapes', 'subtract shape', 'cut shape from another', 'intersect shapes', or 'XOR shapes'.",
  trim_path_multiple: "Apply multiple trim-path segments to a single layer — each segment has its own start/end percentages and offset. Stacks to create multi-stroke draw-on effects. Use when the user says 'multi trim', 'multiple trim segments', 'draw on in segments', or 'trim different parts of the path'.",
  load_data_source: "Load a data source (JSON or CSV format) into the project for data-driven animation. The data becomes bindable to component properties. Use when the user says 'load data', 'import CSV', 'add JSON data', 'data source', or 'bind to data'.",
  list_data_sources: "List all data sources loaded into the project with their formats, row counts, and column names. Use when the user says 'show data sources', 'what data is loaded', or 'list datasets'.",
  bind_property_to_data: "Bind a component property (translateX, translateY, scale, rotate, opacity, width, height, backgroundColor) to a column in a loaded data source. Mapping options: linear, logarithmic, quantize. Optional output range and sample interval. Use when the user says 'bind to data', 'drive this with data', 'data drive this property', or 'animate from CSV column'.",
  unbind_data: "Remove a data binding from a component property (or all bindings if property omitted). Use when the user says 'unbind data', 'remove data binding', 'stop data driving', or 'detach from data'.",
  data_driven_chart: "Generate an animated chart component from a loaded data source — bar, line, pie, scatter, or area chart types. Reads X and Y columns, optional series color, animation duration, and enter animation. Use when the user says 'bar chart from data', 'line chart', 'pie chart', 'data visualization', 'chart from CSV', or 'visualize this data'.",
  apply_gaussian_blur: "Apply a Gaussian (box) blur to a layer — soft, even blur across the whole layer. Use when the user says 'blur this', 'gaussian blur', 'soften the layer', 'defocus', or '模糊'.",
  apply_directional_blur: "Apply a directional (motion) blur in a specific angle and length — simulates linear streaking. Use when the user says 'directional blur', 'motion blur this layer' (not the temporal motion blur system), 'horizontal blur', 'vertical blur', or 'streak'.",
  apply_radial_blur: "Apply radial blur centered on a point — zoom (radial) or spin (rotational) modes. Use when the user says 'radial blur', 'zoom blur', 'spin blur', 'rotational blur', or '径向模糊'.",
  apply_sharpen: "Sharpen or unsharp-mask a layer — enhances edge contrast. Use when the user says 'sharpen this', 'unsharp mask', 'crisp it up', 'enhance detail', or '锐化'.",
  apply_wave_warp: "Apply wave warp distortion — sinusoidal displacement in a given direction with amplitude, wavelength, speed, and phase. Use when the user says 'wave warp', 'ripple this', 'wavy distortion', '波浪扭曲'.",
  apply_ripple: "Apply circular ripple distortion emanating from a center point — concentric waves with frequency, amplitude, and speed. Use when the user says 'ripple', 'circular wave', '涟漪'.",
  apply_bulge: "Apply a bulge or pinch distortion — spherical displacement centered on a point, with radius and signed height (positive bulges, negative pinches). Use when the user says 'bulge', 'pinch', 'spherize', '膨胀', '收缩'.",
  apply_glow: "Apply a stylized glow to bright pixels — luma threshold isolates bright regions, then blur + brightness creates halo. Optional tint color. Use when the user says 'glow', 'neon glow', 'add glow', 'make it glow', '发光'.",
  apply_mosaic: "Apply a mosaic (pixelate) effect — averages pixels into blocks of a given size. Use when the user says 'mosaic', 'pixelate', 'pixelate this', '马赛克'.",
  apply_find_edges: "Apply edge detection (find edges / outline) — Sobel-style luma gradient yields line-art version. Optional invert and blend with original. Use when the user says 'find edges', 'edge detection', 'outline the layer', '描边'.",
  apply_lens_flare: "Generate a procedural lens flare — bright core with rays, optional tint color. Use when the user says 'lens flare', 'add flare', '光晕'.",
  apply_four_color_gradient: "Generate a 4-color gradient fill — four colors at the corners with cross-blend smoothing. Use when the user says '4-color gradient', 'four color gradient', 'gradient corners', '多色渐变'.",
  remove_expression: "Remove an expression bound to a property — restores keyframe-driven values. Use when the user says 'remove expression', 'delete expression', 'clear expression', or '删除表达式'.",
  set_loop_expression: "Apply a loop expression to a property with a loop mode (cycle / pingpong / offset / continue) and loop period. Use when the user says 'loop the rotation', 'pingpong this', 'cycle loop', 'loop this property', or '循环'.",
  sequence_layers: "Sequence selected layers with a stagger offset and optional overlap — cascades entry times. Use when the user says 'sequence these layers', 'cascade them', 'stagger the layers', '序列图层'.",
  exponential_scale: "Apply exponential scale transition between two scale values over a duration — produces a smooth zoom-in or zoom-out that feels natural. Use when the user says 'exponential scale', 'smooth zoom', 'exponential zoom', or '指数缩放'.",
  smooth_keyframes: "Smooth keyframes on a property by averaging neighboring values with a tolerance — reduces jitter. Use when the user says 'smooth keyframes', 'smooth this animation', 'reduce jitter', or '平滑关键帧'.",
  wiggle_keyframes: "Generate wiggled keyframes on a property — creates N samples with given frequency and amplitude. Use when the user says 'wiggle keyframes', 'add wiggle to keyframes', 'generate wiggle', or '摆动关键帧'.",
  audio_to_keyframes: "Convert audio amplitude from an audio source component into keyframes on a property — generates N samples with optional smoothing. Use when the user says 'audio to keyframes', 'drive this from audio', 'audio amplitude to keyframes', or '音频转关键帧'.",
  set_range_selector: "Set a range selector on a text component — selects a contiguous range of characters, words, or lines for per-unit animation. Use when the user says 'range selector', 'select first 50% of characters', 'text range', or '范围选择器'.",
  set_text_wiggler: "Apply a text wiggler to a text component — per-character wiggle with frequency and separate X/Y/rotation/scale amplitudes plus spatial correlation. Use when the user says 'text wiggler', 'wiggle the text', 'jitter the characters', or '文字摆动'.",
  text_on_path: "Place a text component on a path — characters flow along the path with optional alignment, offset, and reverse. Use when the user says 'text on path', 'put text on the curve', 'flow text along path', or '路径文字'.",
  set_vertical_text: "Switch a text component to vertical layout — characters stack vertically with optional rotation and line flow direction. Use when the user says 'vertical text', 'stack text vertically', '竖排文字'.",
  set_kerning: "Set kerning (letter spacing) on a text component — tracking value in px plus optional range and pair adjustment. Use when the user says 'kerning', 'letter spacing', 'tracking', 'tighten the text', 'loosen the text', or '字距'.",
  set_leading: "Set leading (line height) on a text component — lineHeight multiplier, baseline shift, optional auto-leading. Use when the user says 'leading', 'line height', 'adjust line spacing', or '行距'.",
  per_character_transform: "Apply per-character transforms to a text component — translate, scale, rotate, opacity per character with stagger. Use when the user says 'per character transform', 'character by character', 'stagger the characters', or '逐字符变换'.",
  set_text_animator: "Apply a text animator that animates a property (position/scale/rotation/opacity/color/tracking) across a range of characters with falloff. Use when the user says 'text animator', 'animate color per character', 'fade in characters', or '文字动画器'.",
  track_point: "Track a single point on a layer over time — single-point motion tracker with search region and optional name. Use when the user says 'track this point', 'motion track', 'track point', or '跟踪点'.",
  track_camera: "Run camera tracker on a layer — solves for 3D camera and creates null layers at solved 3D points. Use when the user says 'camera tracker', 'track the camera', '3D solve', 'solve camera', or '摄像器解算'.",
  warp_stabilizer: "Apply warp stabilizer to a layer — smooths motion with position/scale/rotation/perspective/subspace methods, auto-crop, and optional no-motion lock. Use when the user says 'stabilize this', 'warp stabilizer', 'smooth camera shake', or '稳定'.",
  apply_track_to_layer: "Apply a tracked motion to a layer — uses the track data to drive position, anchor point, scale, rotation, or full transform. Use when the user says 'apply track to layer', 'use the track on this', 'apply tracking data', or '应用跟踪'.",
  edit_motion_path: "Edit the motion path of a layer — replaces the spatial path with an ordered set of bezier control points. Use when the user says 'edit motion path', 'redraw the path', 'change the motion path', or '运动路径'.",
  auto_orient_path: "Enable auto-orient along motion path, track path, or camera — rotates the layer to face direction of motion with optional smoothing and offset. Use when the user says 'auto orient', 'orient along path', 'face direction of motion', or '沿路径定向'.",
  set_advanced_blending: "Configure advanced blending options for a layer — fill opacity (separate from layer opacity), per-channel R/G/B inclusion, knockout mode, and Blend If ranges. Use when the user says 'advanced blending', 'fill opacity', 'knockout', 'blend if', or '高级混合'.",
  precompose: "Pre-compose selected layers into a new nested composition — collects the layers into a single pre-comp with optional attribute move. Use when the user says 'precompose', 'pre-compose', 'nest these layers', 'group into comp', or '预合成'.",
  collapse_transformations: "Toggle collapse transformations on a pre-comp layer — exposes the inner comp's transformations and 3D layer info to the parent comp. Use when the user says 'collapse transformations', 'collapse this', or '折叠变换'.",
  set_alpha_mode: "Set the alpha interpretation mode for a layer — straight (unassociated) or premultiplied with a specified color. Use when the user says 'alpha mode', 'premultiplied alpha', 'straight alpha', or 'alpha 解析'.",
  set_transfer_mode: "Set the layer transfer mode controlling how the layer behaves with underlying layers — stencil-alpha, stencil-luma, silhouette-alpha, silhouette-luma, alpha-add, luma-matte. Use when the user says 'stencil alpha', 'silhouette', 'luma matte', 'alpha add', or '模板遮罩'.",
  set_blending_group: "Configure a blending group on a layer — isolate blending within the group, apply group-level opacity and knockout. Use when the user says 'blending group', 'isolate blending', 'knockout group', or '混合组'.",
  time_displacement: "Apply per-pixel time displacement using a displacement map layer — each pixel samples the source at a time offset determined by the map brightness. Use when the user says 'time displacement', 'displace time', 'pixel time offset', or '时间位移'.",
  echo_advanced: "Apply advanced echo with composite operators — beyond simple trail, supports add/maximum/minimum/screen/difference/composite-in-front/composite-behind/crossfade echo operators with decay. Use when the user says 'echo advanced', 'composite echo', 'trail with operator', or '高级回声'.",
  sequence_with_transition: "Sequence selected layers with a transition between each — crossfade, dissolve, cut, wipe, or push, with optional overlap. Use when the user says 'sequence with crossfade', 'dissolve between layers', 'transition between clips', or '序列过渡'.",
  time_reverse_layer: "Reverse the playback direction of a layer — plays the layer's animation from end to start. Use when the user says 'reverse this layer', 'play backwards', 'time reverse', or '反向播放'.",
  freeze_frame: "Hold a specific frame of a layer — freezes the layer at the specified time (or current time). Use when the user says 'freeze frame', 'hold this frame', 'freeze at this point', or '冻结帧'.",
  posterize_time_advanced: "Apply posterize time with advanced options — per-region posterize (full/first-half/second-half/custom range), apply to velocity instead of time. Use when the user says 'posterize time advanced', 'regional posterize', 'velocity posterize', or '高级抽帧'.",
  time_warp_remapping: "Apply free-form time-warp speed remapping via speed keyframes — each keyframe sets a speed multiplier (0=freeze, 1=normal, 2=2x speed) with linear/ease/hold interpolation. Use when the user says 'time warp', 'speed ramp', 'variable speed', '变速曲线', or '时间重映射'.",
  lens_distortion: "Apply or remove lens distortion — barrel (negative amount) or pincushion (positive amount), with separate vertical/horizontal controls. Use when the user says 'lens distortion', 'barrel distortion', 'pincushion', 'remove distortion', or '镜头畸变'.",
  chromatic_aberration: "Apply chromatic aberration — splits R and B channels with optional radial offset from a center point. Use when the user says 'chromatic aberration', 'color fringing', 'RGB split', '色差', or '色散'.",
  vignette: "Apply a vignette — darkens edges around a center point with adjustable amount, size, softness, and color. Use when the user says 'vignette', 'darken edges', 'edge falloff', or '暗角'.",
  camera_shake_procedural: "Apply procedural camera shake — generates handheld-style position and rotation noise with intensity, frequency, and seed. Use when the user says 'camera shake', 'handheld shake', 'procedural shake', 'jitter the camera', or '镜头抖动'.",
  optical_flow: "Compute optical flow for a layer — outputs vector field, motion magnitude, or motion direction with quality and smoothing controls. Use when the user says 'optical flow', 'motion vectors', 'motion estimation', or '光流'.",
  motion_match_move: "Match-move a layer using a tracked point — applies track data to position/rotation/scale of a target layer, with optional stabilization mode. Use when the user says 'match move', 'match this movement', 'apply track to layer', 'motion match', or '匹配移动'.",
  lens_flare_anamorphic: "Apply an anamorphic lens flare — horizontal streak flare with adjustable brightness, length, angle, and tint. Use when the user says 'anamorphic flare', 'horizontal lens flare', 'cinematic flare', '变形光晕', or '横向光芒'.",
  depth_of_field_advanced: "Apply advanced depth of field with custom focus curve — focus distance, aperture, blur amount, highlight shape (circle/hexagon/octagon), and optional focus-distance-to-blur curve. Use when the user says 'advanced depth of field', 'bokeh shape', 'focus curve', 'custom DOF', or '高级景深'.",
  paint_stroke: "Paint a vector stroke on a layer — array of points with optional pressure, color, opacity, and blend mode. Use when the user says 'paint a stroke', 'draw on this', 'brush stroke', or '画笔笔触'.",
  clone_stamp: "Clone from a source point to a destination point — brush size, opacity, alignment, and optional source layer. Use when the user says 'clone stamp', 'clone from here', 'sample and paint', or '克隆图章'.",
  brush_settings: "Configure brush settings — size, hardness, opacity, spacing, flow, angle, roundness. Use when the user says 'set brush', 'brush size', 'brush hardness', 'change the brush', or '画笔设置'.",
  reveal_with_brush: "Reveal or hide layer content via brush strokes — points with pressure, feather, and reveal/hide mode. Use when the user says 'reveal with brush', 'paint a mask', 'brush reveal', 'erase with brush', or '画笔显隐'.",
  erase_stroke: "Erase paint from a layer — points with brush size and hardness. Use when the user says 'erase paint', 'erase stroke', 'remove paint', or '擦除笔触'.",
  paint_animator: "Animate a paint stroke — write-on, reveal, grow-from-start, or grow-from-end modes with duration, easing, and end value. Use when the user says 'animate the stroke', 'write on this stroke', 'paint animation', 'grow the stroke', or '笔触动画'.",
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
