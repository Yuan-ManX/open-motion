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

/** Set the project-wide tempo so motion can be quantized to a beat grid. */
export const SetProjectTempoInput = z.object({
  projectId: zIdField,
  bpm: z.number().min(20).max(300),
});

/**
 * Snap a component's duration (or every component's) to the nearest beat
 * division of the project tempo. If no division is given, picks the closest
 * musical division for each duration automatically.
 */
export const QuantizeToTempoInput = z.object({
  projectId: zIdField,
  componentId: zIdField.optional().describe("Omit to quantize every component in the project"),
  division: z.enum(["1", "2", "4", "8", "16"]).optional().describe("Force a specific beat division; omit for auto"),
});

/**
 * Anchor a component's start time to a musical phase within a 4/4 bar.
 * The phase is expressed either as a beat offset (0 = downbeat, 0.5 =
 * offbeat, 1 = beat 2) or via a named label. Translates to a delay so the
 * motion begins on that beat position. Requires a project tempo.
 */
export const SetPhaseInput = z.object({
  projectId: zIdField,
  componentId: zIdField.optional().describe("Single target; omit when using componentIds"),
  componentIds: z.array(zIdField).min(1).optional().describe("Group target; the same phase is applied to each"),
  phaseBeats: z.number().min(0).max(4).optional().describe("Phase offset in beats from the downbeat (0=downbeat, 0.5=offbeat, 1=beat 2). Mutually exclusive with label."),
  label: z.enum(["downbeat", "offbeat", "backbeat", "beat1", "beat2", "beat3", "beat4"]).optional().describe("Named musical phase. Mutually exclusive with phaseBeats."),
});

/**
 * Align component start times to the beat grid. In "snap" mode each
 * component's existing delay is snapped to the nearest beat division. In
 * "polyrhythm" mode the targeted components are distributed evenly across a
 * fixed beat cycle, producing a k:base polyrhythm (e.g. 3 components across
 * 2 beats = 3:2) that resolves back to the downbeat every cycle.
 */
export const AlignToBeatInput = z.object({
  projectId: zIdField,
  mode: z.enum(["snap", "polyrhythm"]).default("snap"),
  componentIds: z.array(zIdField).min(1).optional().describe("Targets; omit for every component (ordered by orderIndex in polyrhythm mode)"),
  division: z.enum(["1", "2", "4", "8", "16"]).optional().describe("snap mode: force a specific beat division; omit for auto"),
  cycleBeats: z.number().min(1).max(16).default(4).describe("polyrhythm mode: span in beats the events fill (default 4 = one bar of 4/4)"),
  rotation: z.number().min(0).max(4).default(0).describe("polyrhythm mode: rotate the pattern by this many beats"),
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

/* --------------------------- Catalog search tool --------------------------- */
export const SearchCatalogInput = z.object({
  query: z.string().min(1).describe("Search query (e.g., 'fade', 'bounce', 'glitch')"),
  limit: z.number().min(1).max(50).optional().default(10).describe("Maximum number of results"),
});

/* --------------------------- Automation pipeline --------------------------- */
export const RunMotionPipelineInput = z.object({
  projectId: zIdField,
  description: z.string().min(1).describe("Natural language description of the desired motion (e.g., 'playful bounce-in for a hero title')"),
  durationMs: z.number().int().positive().optional().describe("Target duration in milliseconds"),
  colorScheme: z.enum(["complementary", "analogous", "triadic", "monochrome"]).optional(),
  baseColor: z.string().optional().describe("Base color as hex (e.g., '#ff6b00')"),
  choreography: z.enum(["cascade", "call_response", "unison", "counterpoint", "wave", "canon", "stagger_grid", "ripple_out", "auto"]).optional(),
  componentCount: z.number().int().positive().optional(),
});

/* --------------------------- Composition engine --------------------------- */
export const ComposeSequenceInput = z.object({
  projectId: zIdField,
  type: z.enum(["sequence", "parallel", "stagger"]),
  componentIds: z.array(z.string()).min(1).describe("Component IDs to compose"),
  stepMs: z.number().int().positive().optional().default(80).describe("Stagger step in ms"),
  gapMs: z.number().int().nonnegative().optional().default(0).describe("Gap between sequence items in ms"),
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

/* --------------------------- Rotoscoping & keying --------------------------- */
export const RotoBrushInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  mode: z.enum(["add", "subtract", "foreground", "background"]).default("add"),
  seedPoints: z.array(z.object({
    x: z.number(),
    y: z.number(),
    radius: z.number().min(1).max(200).default(20),
  })).min(1).default([{ x: 0.5, y: 0.5, radius: 20 }]),
  detectionSensitivity: z.number().min(0).max(1).default(0.5),
  smoothness: z.number().min(0).max(1).default(0.5),
  frameRange: z.tuple([z.number(), z.number()]).optional(),
});

export const RefineEdgeInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  featherRadius: z.number().min(0).max(100).default(5),
  edgeSoftness: z.number().min(0).max(1).default(0.5),
  decontamination: z.number().min(0).max(1).default(0.2),
  smoothEdge: z.boolean().default(true),
  useSmartRadius: z.boolean().default(false),
  smartRadius: z.number().min(-50).max(50).default(0),
});

export const ColorKeyInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  keyColor: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#00ff00"),
  colorTolerance: z.number().min(0).max(1).default(0.2),
  edgeThin: z.number().min(-10).max(10).default(0),
  edgeFeather: z.number().min(0).max(10).default(1),
  invert: z.boolean().default(false),
});

export const LinearColorKeyInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  keyColor: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#00ff00"),
  matchColors: z.array(z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)).min(1).default(["#00ff00"]),
  matchingTolerance: z.number().min(0).max(1).default(0.2),
  matchingSoftness: z.number().min(0).max(1).default(0.1),
  operateOn: z.enum(["rgb", "hue", "saturation", "brightness"]).default("rgb"),
});

export const DifferenceMatteInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  referenceFrame: z.number().int().nonnegative().default(0),
  differenceThreshold: z.number().min(0).max(1).default(0.2),
  matchTolerance: z.number().min(0).max(1).default(0.1),
  blurBeforeDifference: z.number().min(0).max(10).default(0),
  invert: z.boolean().default(false),
});

export const SpillSuppressionInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  suppressColor: z.enum(["green", "blue", "red", "custom"]).default("green"),
  customColor: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional(),
  suppression: z.number().min(0).max(1).default(0.5),
  luminancePreservation: z.number().min(0).max(1).default(0.5),
  edgeSoftness: z.number().min(0).max(10).default(2),
});

export const MatteChokerInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  chokeSpread: z.array(z.number().min(-100).max(100)).length(4).optional().describe("Four stages of choke (negative=spread, positive=choke)"),
  choke1: z.number().min(-100).max(100).default(0),
  choke2: z.number().min(-100).max(100).default(0),
  grayLevel: z.number().min(0).max(1).default(1),
  iterations: z.number().int().min(1).max(10).default(2),
});

export const InnerOuterKeyInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  innerPath: z.array(z.object({ x: z.number(), y: z.number() })).min(3).optional(),
  outerPath: z.array(z.object({ x: z.number(), y: z.number() })).min(3).optional(),
  feather: z.number().min(0).max(100).default(5),
  edgeThreshold: z.number().min(0).max(1).default(0.5),
  useInnerOnly: z.boolean().default(false),
  invert: z.boolean().default(false),
  additionalForegroundPath: z.array(z.object({ x: z.number(), y: z.number() })).min(3).optional(),
  additionalBackgroundPath: z.array(z.object({ x: z.number(), y: z.number() })).min(3).optional(),
});

/* --------------------------- Transitions library --------------------------- */
export const BlockDissolveInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(2).optional(),
  blockSize: z.number().int().min(2).max(100).default(16),
  rows: z.number().int().min(1).max(50).default(8),
  columns: z.number().int().min(1).max(50).default(8),
  transitionDurationMs: z.number().min(100).max(10000).default(800),
  randomness: z.number().min(0).max(1).default(0.3),
  direction: z.enum(["dissolve-in", "dissolve-out"]).default("dissolve-in"),
});

export const CardWipeInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(2).optional(),
  rows: z.number().int().min(1).max(50).default(10),
  columns: z.number().int().min(1).max(50).default(10),
  flipAxis: z.enum(["x", "y"]).default("x"),
  flipDirection: z.enum(["positive", "negative"]).default("positive"),
  transitionDurationMs: z.number().min(100).max(10000).default(1000),
  randomness: z.number().min(0).max(1).default(0.2),
  cameraDistance: z.number().min(0).max(1000).default(200),
  jitter: z.number().min(0).max(50).default(0),
});

export const GradientWipeInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(2).optional(),
  gradientLayerId: zIdField.optional().describe("Layer to use as wipe gradient (default: brightness of source)"),
  transitionDurationMs: z.number().min(100).max(10000).default(800),
  completion: z.number().min(0).max(1).default(0.5),
  isGradientLayerInverted: z.boolean().default(false),
});

export const IrisWipeInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(2).optional(),
  irisCenter: z.tuple([z.number(), z.number()]).default([0.5, 0.5]),
  outerRadius: z.number().min(0).max(1).default(0.5),
  innerRadius: z.number().min(0).max(1).default(0),
  irisPoints: z.number().int().min(2).max(32).default(8),
  rotation: z.number().min(0).max(360).default(0),
  transitionDurationMs: z.number().min(100).max(10000).default(700),
  feather: z.number().min(0).max(50).default(2),
});

export const LinearWipeInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(2).optional(),
  angle: z.number().min(0).max(360).default(0),
  feather: z.number().min(0).max(100).default(5),
  transitionDurationMs: z.number().min(100).max(10000).default(600),
});

export const RadialWipeInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(2).optional(),
  startAngle: z.number().min(0).max(360).default(0),
  wipeAngle: z.number().min(0).max(360).default(0),
  feather: z.number().min(0).max(100).default(5),
  wipeShape: z.enum(["clockwise", "counterclockwise", "both"]).default("clockwise"),
  transitionDurationMs: z.number().min(100).max(10000).default(700),
});

export const VenetianBlindsInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(2).optional(),
  stripeWidth: z.number().min(2).max(100).default(20),
  transitionDurationMs: z.number().min(100).max(10000).default(600),
  direction: z.enum(["horizontal", "vertical"]).default("horizontal"),
  edgeCompletion: z.number().min(0).max(1).default(1),
  feather: z.number().min(0).max(20).default(0),
});

export const CcJawsWipeInput = z.object({
  projectId: zIdField,
  componentIds: z.array(zIdField).min(2).optional(),
  shape: z.enum(["jaws", "line", "scale", "grid", "radial"]).default("jaws"),
  direction: z.enum(["top-left", "top-right", "bottom-left", "bottom-right", "all"]).default("all"),
  completion: z.number().min(0).max(1).default(0.5),
  transitionDurationMs: z.number().min(100).max(10000).default(800),
  pointSpacing: z.number().min(1).max(100).default(20),
  shapeLayer: z.boolean().default(false),
});

/* --------------------------- Simulation & generators --------------------------- */
export const CcBallActionInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  ballSize: z.number().min(1).max(50).default(10),
  spacing: z.number().min(1).max(50).default(15),
  rotationX: z.number().min(0).max(360).default(0),
  rotationY: z.number().min(0).max(360).default(0),
  rotationZ: z.number().min(0).max(360).default(0),
  scatter: z.number().min(0).max(1).default(0),
  gridMode: z.enum(["rectangular", "hexagonal"]).default("rectangular"),
});

export const CcBubblesInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  bubbleCount: z.number().int().min(1).max(500).default(50),
  minSize: z.number().min(1).max(100).default(10),
  maxSize: z.number().min(1).max(100).default(30),
  speed: z.number().min(0).max(10).default(1),
  wobble: z.number().min(0).max(1).default(0.3),
  direction: z.enum(["up", "down", "left", "right"]).default("up"),
  seed: z.number().int().nonnegative().default(1),
});

export const CcRainfallInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  dropCount: z.number().int().min(1).max(2000).default(300),
  dropSize: z.number().min(1).max(20).default(3),
  speed: z.number().min(0).max(50).default(10),
  wind: z.number().min(-20).max(20).default(0),
  angle: z.number().min(-45).max(45).default(0),
  opacity: z.number().min(0).max(1).default(0.7),
  blur: z.number().min(0).max(20).default(2),
  seed: z.number().int().nonnegative().default(1),
});

export const CcSnowfallInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  flakeCount: z.number().int().min(1).max(2000).default(200),
  minSize: z.number().min(1).max(30).default(3),
  maxSize: z.number().min(1).max(30).default(10),
  speed: z.number().min(0).max(20).default(2),
  wind: z.number().min(-20).max(20).default(0),
  wobble: z.number().min(0).max(2).default(0.5),
  opacity: z.number().min(0).max(1).default(0.9),
  seed: z.number().int().nonnegative().default(1),
});

export const CcStarBurstInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  starCount: z.number().int().min(1).max(1000).default(100),
  speed: z.number().min(0).max(20).default(2),
  scatter: z.number().min(0).max(1).default(0.5),
  phase: z.number().min(0).max(360).default(0),
  gridSize: z.number().min(1).max(100).default(20),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#ffffff"),
  seed: z.number().int().nonnegative().default(1),
});

export const CellPatternInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  patternType: z.enum(["bubbles", "crystals", "static-plates", "tubular", "spotted", "cracked", "steel", "organic", "stone-rock", "dried-up", "shatter", "scales", "turbulent", "load-bubbles"]).default("bubbles"),
  contrast: z.number().min(0).max(100).default(50),
  dispersal: z.number().min(0).max(1).default(0.5),
  size: z.number().min(0).max(200).default(50),
  offset: z.tuple([z.number(), z.number()]).default([0, 0]),
  tiling: z.boolean().default(false),
  evolution: z.number().min(0).max(360).default(0),
  speed: z.number().min(0).max(5).default(1),
});

export const AudioSpectrumInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  audioLayerId: zIdField.optional().describe("Audio source layer (default: project audio track)"),
  startPath: z.tuple([z.number(), z.number()]).default([0.5, 0.5]),
  endPath: z.tuple([z.number(), z.number()]).default([0.9, 0.5]),
  pathShape: z.enum(["line", "curve", "closed", "loop"]).default("line"),
  frequencyRange: z.tuple([z.number().min(0).max(20000), z.number().min(0).max(20000)]).default([20, 2000]),
  maximumHeight: z.number().min(1).max(500).default(100),
  thickness: z.number().min(1).max(50).default(10),
  insideColor: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#ffffff"),
  outsideColor: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#000000"),
  displayOptions: z.array(z.enum(["analog", "digital", "log", "analog-frequencies", "digital-frequencies"])).default(["analog"]),
  hueInterpolation: z.number().min(0).max(1).default(0),
});

export const RadioWavesInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  producerPoint: z.tuple([z.number(), z.number()]).default([0.5, 0.5]),
  wavesPerSecond: z.number().min(0).max(20).default(1),
  waveSpeed: z.number().min(0).max(100).default(5),
  frequency: z.number().min(0).max(50).default(2),
  expansion: z.number().min(0).max(500).default(50),
  maxRadius: z.number().min(1).max(2000).default(500),
  strokeWidth: z.number().min(0).max(20).default(2),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#ffffff"),
  fadeoutTime: z.number().min(0).max(10).default(2),
  startWidth: z.number().min(0).max(100).default(10),
  endWidth: z.number().min(0).max(100).default(0),
});

/* --------------------------- Stylize effects --------------------------- */
export const CartoonEffectInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  edgeThickness: z.number().min(0).max(10).default(1.5),
  edgeIntensity: z.number().min(0).max(1).default(0.8),
  shadingSteps: z.number().int().min(2).max(10).default(4),
  shadingSmoothness: z.number().min(0).max(1).default(0.5),
  outlineColor: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).default("#000000"),
  edgeMode: z.enum(["inverted", "drawn", "lit", "outline"]).default("drawn"),
});

export const BrushStrokesInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  brushSize: z.number().min(1).max(50).default(8),
  strokeAngle: z.number().min(0).max(360).default(45),
  strokeLength: z.number().min(1).max(50).default(15),
  strokeDensity: z.number().min(0).max(1).default(0.6),
  strokeRandomness: z.number().min(0).max(1).default(0.3),
  paintSurface: z.enum(["painting", "canvas", "paper", "wet"]).default("canvas"),
  blendMode: z.enum(["normal", "multiply", "screen"]).default("normal"),
});

export const OilPaintInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  brushScale: z.number().min(1).max(20).default(4),
  contrast: z.number().min(0).max(2).default(1),
  cleanColor: z.number().min(0).max(1).default(0.5),
  invert: z.boolean().default(false),
  blur: z.number().min(0).max(20).default(3),
  sharpness: z.number().min(0).max(1).default(0.4),
});

export const WatercolorInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  edgeIntensity: z.number().min(0).max(2).default(1),
  edgeSimplicity: z.number().min(0).max(10).default(2),
  texture: z.number().min(0).max(1).default(0.4),
  brushSize: z.number().min(1).max(30).default(10),
  wetness: z.number().min(0).max(1).default(0.5),
  colorVariation: z.number().min(0).max(1).default(0.3),
  paperType: z.enum(["cold-press", "hot-press", "rough"]).default("cold-press"),
});

export const EmbossEffectInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  angle: z.number().min(0).max(360).default(135),
  height: z.number().min(1).max(50).default(5),
  amount: z.number().min(0).max(200).default(100),
  relief: z.number().min(0).max(100).default(50),
});

export const MotionTileInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  tileCenter: z.tuple([z.number(), z.number()]).default([0.5, 0.5]),
  tileWidth: z.number().min(0).max(2).default(1),
  tileHeight: z.number().min(0).max(2).default(1),
  outputWidth: z.number().min(0).max(10).default(2),
  outputHeight: z.number().min(0).max(10).default(2),
  phase: z.number().min(0).max(360).default(0),
  horizontalOffset: z.number().min(-1).max(1).default(0),
  verticalOffset: z.number().min(-1).max(1).default(0),
  mirrorEdges: z.boolean().default(false),
});

export const ScatterEffectInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  scatterAmount: z.number().min(0).max(50).default(5),
  grainAmount: z.number().min(0).max(1).default(0.3),
  grainSeed: z.number().int().nonnegative().default(1),
  horizontalOnly: z.boolean().default(false),
  verticalOnly: z.boolean().default(false),
  monochromatic: z.boolean().default(false),
});

export const ThresholdEffectInput = z.object({
  projectId: zIdField,
  componentId: zIdField,
  level: z.number().min(0).max(1).default(0.5),
  invert: z.boolean().default(false),
  channel: z.enum(["luminance", "red", "green", "blue", "alpha"]).default("luminance"),
  halftone: z.boolean().default(false),
  halftoneSize: z.number().min(1).max(20).default(4),
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

/* --------------------------- Editor control tools --------------------------- */
/* Tools that emit editor_command events to drive the frontend UI directly.   */
/* These complement spec-modifying tools by controlling pure UI state.        */

export const EditorZoomCanvasInput = z.object({
  zoom: z.number().min(0.1).max(5).describe("Zoom level (1 = 100%)"),
});

export const EditorPanCanvasInput = z.object({
  x: z.number().describe("Pan offset X in pixels"),
  y: z.number().describe("Pan offset Y in pixels"),
});

export const EditorFitToScreenInput = z.object({});

export const EditorResetViewInput = z.object({});

export const EditorSetPlayheadInput = z.object({
  timeMs: z.number().min(0).describe("Playhead position in milliseconds"),
});

export const EditorSetPlaybackSpeedInput = z.object({
  speed: z.number().min(0.25).max(4).describe("Playback speed multiplier (1 = normal)"),
});

export const EditorPlayInput = z.object({});

export const EditorPauseInput = z.object({});

export const EditorToggleRulersInput = z.object({
  enabled: z.boolean().optional().describe("Optional explicit state; toggles if omitted"),
});

export const EditorToggleSnapInput = z.object({
  enabled: z.boolean().optional(),
  gridSize: z.number().int().min(1).max(50).optional().describe("Snap grid size in pixels"),
});

export const EditorToggleAutoKeyframeInput = z.object({
  enabled: z.boolean().optional(),
});

export const EditorToggleOnionSkinInput = z.object({
  enabled: z.boolean().optional(),
  frames: z.number().int().min(1).max(8).optional().describe("Number of ghost frames"),
  opacity: z.number().min(0.05).max(0.8).optional(),
});

export const EditorSelectComponentInput = z.object({
  componentId: z.string().min(1),
  additive: z.boolean().optional().describe("Add to existing selection instead of replacing"),
});

export const EditorSelectComponentsInput = z.object({
  componentIds: z.array(z.string()).min(1),
  clearFirst: z.boolean().optional().describe("Clear existing selection before adding"),
});

export const EditorClearSelectionInput = z.object({});

export const EditorToggleVisibilityInput = z.object({
  componentId: z.string().min(1),
});

export const EditorToggleLockInput = z.object({
  componentId: z.string().min(1),
  locked: z.boolean().optional(),
});

export const EditorSetPanelInput = z.object({
  category: z.enum(["design", "motion", "intel", "assets", "output"]).describe("Right panel functional group"),
  tab: z.string().optional().describe("Optional specific tab within the group"),
});

export const EditorTogglePanelInput = z.object({
  collapsed: z.boolean().optional().describe("Optional explicit collapsed state"),
});

export const EditorOpenOverlayInput = z.object({
  overlay: z.enum(["preview", "export", "templates", "settings", "command_palette"]),
  open: z.boolean().optional().describe("Optional explicit open state; toggles if omitted"),
});

export const EditorUndoInput = z.object({});

export const EditorRedoInput = z.object({});

export const EditorSetArtboardInput = z.object({
  width: z.number().int().min(64).max(4096).optional(),
  height: z.number().int().min(64).max(4096).optional(),
  background: z.string().optional().describe("Background color (hex or css color)"),
});

export const EditorTriggerReplayInput = z.object({});

export const EditorToggleMotionPathsInput = z.object({
  enabled: z.boolean().optional().describe("Optional explicit state; toggles if omitted"),
});

export const EditorTogglePerformanceMonitorInput = z.object({
  enabled: z.boolean().optional(),
});

export const EditorSetSoloInput = z.object({
  componentId: z.string().nullable().describe("Component id to solo, or null to clear solo"),
});

export const EditorToggleSidebarInput = z.object({
  collapsed: z.boolean().optional().describe("Optional explicit collapsed state"),
});

export const EditorTimelineCommandInput = z.object({
  action: z.string().min(1).describe("Timeline action: copy, paste, duplicate, delete, group, ungroup, bring_to_front, send_to_back"),
});

export const EditorToggleSelectionInput = z.object({
  componentId: z.string().min(1).describe("Component id to toggle in/out of selection"),
});

export const EditorOpenSkillsInput = z.object({
  open: z.boolean().optional().describe("Optional explicit open state"),
});

export const EditorOpenShortcutsInput = z.object({
  open: z.boolean().optional(),
});

export const EditorSetTrackOrderInput = z.object({
  trackIds: z.array(z.string()).min(1).describe("Ordered list of track/component ids"),
});

export const EditorSetLoopRegionInput = z.object({
  startMs: z.number().min(0).describe("Loop region start in milliseconds"),
  endMs: z.number().min(0).describe("Loop region end in milliseconds"),
});

export const EditorClearLoopRegionInput = z.object({});

/* --------------------------- Checkpoint & plan tools --------------------------- */
export const RollbackLastActionInput = z.object({
  projectId: zIdField,
});

export const ListCheckpointsInput = z.object({
  projectId: zIdField,
});

export const RollbackToCheckpointInput = z.object({
  projectId: zIdField,
  checkpointId: zIdField,
});

export const CancelPlanInput = z.object({
  projectId: zIdField,
});

export const GetPlanStateInput = z.object({
  projectId: zIdField,
});

// --- Frame rendering and composition tools ---

export const SeekToFrameInput = z.object({
  projectId: zIdField,
  frame: z.number().int().min(0).describe("Frame number to seek to"),
  fps: z.number().int().positive().optional().describe("Frames per second (default 60)"),
});

export const RenderFramesInput = z.object({
  projectId: zIdField,
  startFrame: z.number().int().min(0).optional().describe("Starting frame (default 0)"),
  endFrame: z.number().int().min(0).optional().describe("Ending frame (default: last frame)"),
  fps: z.number().int().positive().optional().describe("Frames per second (default 60)"),
  sampleStep: z.number().int().positive().optional().describe("Sample every N frames for efficiency (default 1)"),
});

export const ExportHtmlCompositionInput = z.object({
  projectId: zIdField,
  width: z.number().int().positive().optional().describe("Canvas width in pixels"),
  height: z.number().int().positive().optional().describe("Canvas height in pixels"),
  fps: z.number().int().positive().optional().describe("Frames per second"),
  includeControls: z.boolean().optional().describe("Include playback controls UI"),
  loop: z.boolean().optional().describe("Loop playback"),
});

export const ResolveMediaInput = z.object({
  modality: z.enum(["audio", "image", "video", "voice", "icon", "logo", "lut", "font"]).describe("Type of media needed"),
  purpose: z.enum(["background-music", "sound-effect", "voiceover", "background-image", "foreground-image", "transition", "overlay", "color-grade", "caption", "watermark"]).describe("What the media will be used for"),
  description: z.string().min(1).describe("Natural language description of the desired media"),
  durationSec: z.number().positive().optional().describe("Duration in seconds (for audio/video)"),
  allowGeneration: z.boolean().optional().describe("Allow AI generation if catalog misses (default true)"),
});

export const RouteSkillInput = z.object({
  userInput: z.string().min(1).describe("The user's input text to route"),
});

export const ListSkillsInput = z.object({
  category: z.enum(["creation", "analysis", "optimization", "export", "editing", "intelligence"]).optional().describe("Filter by category"),
});

export const PlanSequenceInput = z.object({
  description: z.string().min(1).describe("Natural language description of the desired sequence"),
  arc: z.enum(["hero-journey", "product-launch", "tutorial", "product-reveal", "emotional-arc", "action-sequence", "documentary", "celebration"]).optional().describe("Narrative arc template"),
  totalDurationMs: z.number().int().positive().optional().describe("Target total duration in milliseconds"),
  sceneCount: z.number().int().positive().optional().describe("Number of scenes"),
});

export const ListNarrativeArcsInput = z.object({}).optional();

export const ListMotionThemesInput = z.object({
  personality: z.enum(["precise", "organic", "playful", "dramatic", "minimal", "luxurious", "technical", "warm"]).optional().describe("Filter by personality archetype"),
});

export const ApplyMotionThemeInput = z.object({
  projectId: zIdField,
  themeId: z.string().min(1).describe("Theme id to apply"),
});

export const ListRhythmPatternsInput = z.object({
  category: z.enum(["metric", "expressive", "biological", "compound"]).optional().describe("Filter by category"),
});

export const ApplyRhythmInput = z.object({
  patternId: z.enum(["steady-beat", "syncopated", "swing", "rubato", "polyrhythm-3-2", "gallop", "waltz", "fanfare", "heartbeat", "wave-flow", "accelerando", "decelerando"]).describe("Rhythm pattern id"),
  itemCount: z.number().int().positive().describe("Number of items to generate timing for"),
  bpm: z.number().int().positive().optional().describe("Override BPM"),
  scale: z.number().positive().optional().describe("Scale factor for durations"),
});

export const GenerateVariantsInput = z.object({
  projectId: zIdField,
  count: z.number().int().positive().optional().describe("Number of variants to generate (default 4)"),
  strategies: z.array(z.enum(["easing", "timing", "choreography", "intensity", "direction", "palette"])).optional().describe("Strategies to use"),
  seed: z.number().int().optional().describe("Seed for deterministic generation"),
});

export const EvolveMotionInput = z.object({
  projectId: zIdField,
  strategy: z.enum(["balanced", "playful", "accessible", "performant", "harmonious"]).optional().describe("Evolution strategy (default: balanced)"),
  generations: z.number().int().positive().max(50).optional().describe("Number of generations to evolve"),
  populationSize: z.number().int().positive().max(50).optional().describe("Population size per generation"),
  mutationRate: z.number().min(0).max(1).optional().describe("Mutation probability (0-1)"),
  apply: z.boolean().optional().describe("Apply the best individual to the project"),
});

export const ListEvolutionStrategiesInput = z.object({});

export const PredictPerceptionInput = z.object({
  projectId: zIdField,
});

export const ListSemanticConceptsInput = z.object({
  category: z.enum(["emotion", "brand", "energy", "aesthetic"]).optional().describe("Filter by category"),
});

export const InferIntentInput = z.object({
  description: z.string().min(1).describe("Natural language description of desired motion feeling"),
});

export const BlendConceptsInput = z.object({
  conceptA: z.string().describe("First concept id (e.g. 'playful')"),
  conceptB: z.string().describe("Second concept id (e.g. 'luxury')"),
  weightA: z.number().min(0).max(1).optional().describe("Weight of concept A (default 0.5)"),
});

export const SimulatePhysicsInput = z.object({
  type: z.enum(["spring", "gravity", "projectile", "friction", "pendulum"]).describe("Physics simulation type"),
  config: z.record(z.string(), z.number()).optional().describe("Simulation parameters (stiffness, damping, gravity, etc.)"),
});

export const ListPhysicsPresetsInput = z.object({});

export const RunPhysicsPresetInput = z.object({
  presetId: z.string().describe("Preset id (e.g. 'spring-snappy', 'gravity-drop')"),
});

export const GeneratePathMotionInput = z.object({
  type: z.enum(["bezier", "lissajous", "spiral", "figure-eight", "heart", "circle", "svg-path"]).describe("Path type"),
  durationMs: z.number().int().positive().optional().describe("Duration in ms (default 2000)"),
  samples: z.number().int().positive().max(200).optional().describe("Number of keyframe samples (default 60)"),
  scale: z.number().positive().optional().describe("Scale factor (default 1)"),
  loop: z.boolean().optional().describe("Loop the animation (default true)"),
});

export const ListPathPresetsInput = z.object({});

export const RunPathPresetInput = z.object({
  presetId: z.string().describe("Preset id (e.g. 'lissajous-3-2', 'figure-eight')"),
});

export const EncodeMotionInput = z.object({
  projectId: zIdField,
  format: z.enum(["lottie", "css", "waapi", "smil", "gsap", "react-spring"]).describe("Output format"),
  minify: z.boolean().optional().describe("Minify output (default false)"),
});

export const ListCodecFormatsInput = z.object({});

// --- Motion Style Transfer tools ---

export const ExtractStyleDnaInput = z.object({
  projectId: zIdField,
});

export const TransferProjectStyleInput = z.object({
  projectId: zIdField,
  sourceProjectId: zIdField.describe("Project to extract style from"),
  easingStrength: z.number().min(0).max(1).optional().describe("How strongly to apply easing (0-1, default 0.8)"),
  tempoStrength: z.number().min(0).max(1).optional().describe("How strongly to apply tempo (0-1, default 0.7)"),
  energyStrength: z.number().min(0).max(1).optional().describe("How strongly to apply energy (0-1, default 0.6)"),
  colorStrength: z.number().min(0).max(1).optional().describe("How strongly to apply colors (0-1, default 0.5)"),
});

export const BlendStylesInput = z.object({
  projectIdA: zIdField,
  projectIdB: zIdField,
  ratio: z.number().min(0).max(1).describe("Blend ratio (0=A, 1=B, 0.5=equal)"),
});

export const DescribeStyleInput = z.object({
  projectId: zIdField,
});

export const CompareStylesInput = z.object({
  projectIdA: zIdField,
  projectIdB: zIdField,
});

export const ListStyleArchetypesInput = z.object({});

export const ApplyStyleArchetypeInput = z.object({
  projectId: zIdField,
  archetypeId: z.string().describe("Archetype id (e.g. 'minimalist', 'cinematic')"),
});

// --- Motion Knowledge Graph tools ---

export const BuildKnowledgeGraphInput = z.object({});

export const QueryConceptInput = z.object({
  conceptId: z.string().describe("Concept node id (e.g. 'bounce', 'stagger')"),
});

export const FindRelatedInput = z.object({
  conceptId: z.string().describe("Concept node id"),
  relationship: z.enum([
    "enables", "complements", "conflicts", "requires", "specializes",
    "alternative", "combines", "transitions", "contrasts", "evolves",
  ]).optional().describe("Filter by relationship type"),
});

export const FindPathInput = z.object({
  fromId: z.string().describe("Source concept id"),
  toId: z.string().describe("Target concept id"),
});

export const SearchConceptsInput = z.object({
  query: z.string().describe("Search query (matches label, description, tags)"),
});

export const SuggestConnectionsInput = z.object({
  conceptIds: z.array(z.string()).describe("List of concept ids to find connections between"),
});

export const RecommendNextInput = z.object({
  usedConceptIds: z.array(z.string()).describe("Concept ids already used in the project"),
});

export const AnalyzeGraphInput = z.object({});

// --- Motion Testing tools ---

export const RunAllTestsInput = z.object({
  projectId: zIdField,
});

export const RunTestsByCategoryInput = z.object({
  projectId: zIdField,
  category: z.enum(["accessibility", "performance", "visual", "principles", "timing", "consistency"]),
});

export const RunTestSuiteInput = z.object({
  projectId: zIdField,
  suiteId: z.string().describe("Test suite id (e.g. 'a11y-duration-check')"),
});

export const ListTestSuitesInput = z.object({});

// Emotion Intelligence
export const SynthesizeFromEmotionInput = z.object({
  projectId: zIdField,
  emotionId: z.string().describe("Emotion id (e.g. 'joy', 'calm', 'anger', 'fear')"),
});
export const DetectEmotionInput = z.object({
  projectId: zIdField,
  componentId: z.string().describe("Component id to analyze"),
});
export const BlendEmotionsInput = z.object({
  projectId: zIdField,
  emotions: z.array(z.object({
    emotionId: z.string(),
    weight: z.number().min(0).max(1),
  })).min(2).describe("Emotions to blend with weights"),
});
export const PlanEmotionJourneyInput = z.object({
  projectId: zIdField,
  emotionIds: z.array(z.string()).min(2).describe("Sequence of emotion ids for the journey"),
  totalDurationMs: z.number().min(1000).default(5000).describe("Total journey duration in ms"),
});
export const ListEmotionsInput = z.object({
  category: z.string().optional().describe("Filter by category: joy, sadness, anger, fear, surprise, trust, anticipation, calm, power"),
});

// Adaptive Learning
export const GetTasteProfileInput = z.object({
  projectId: zIdField,
});
export const RecommendForProjectInput = z.object({
  projectId: zIdField,
});
export const RecordMotionObservationInput = z.object({
  projectId: zIdField,
  componentId: z.string().describe("Component id that was interacted with"),
  action: z.enum(["created", "accepted", "rejected", "modified"]).describe("Type of interaction"),
});

// Contextual Awareness
export const ComputeContextAdjustmentsInput = z.object({
  projectId: zIdField,
  device: z.string().optional().describe("Device class: desktop, tablet, mobile, watch, kiosk, tv"),
  performance: z.string().optional().describe("Performance tier: high, medium, low"),
  timeOfDay: z.string().optional().describe("Time of day: morning, afternoon, evening, night"),
  ambientLight: z.string().optional().describe("Ambient light: bright, normal, dim, dark"),
  userState: z.string().optional().describe("User state: focused, casual, rushed, relaxed"),
});
export const AdaptComponentForContextInput = z.object({
  projectId: zIdField,
  componentId: z.string().describe("Component id to adapt"),
  device: z.string().optional(),
  performance: z.string().optional(),
  timeOfDay: z.string().optional(),
  ambientLight: z.string().optional(),
  userState: z.string().optional(),
});
export const AutoDetectContextInput = z.object({});
export const ListContextOptionsInput = z.object({});

// Motion Collaboration
export const PlanCollaborationInput = z.object({
  projectId: zIdField,
  request: z.string().describe("The complex motion request to decompose into collaborative sub-tasks"),
});
export const ExecuteCollaborationInput = z.object({
  projectId: zIdField,
  request: z.string().describe("The complex motion request to execute collaboratively"),
});
export const ListCollaborationModulesInput = z.object({});

// Motion Resonance
export const AnalyzeResonanceInput = z.object({
  projectId: zIdField,
  viewerState: z.object({
    attention: z.number().min(0).max(1).optional(),
    arousal: z.number().min(0).max(1).optional(),
    valence: z.number().min(-1).max(1).optional(),
    fatigue: z.number().min(0).max(1).optional(),
    timeOfDay: z.enum(["morning", "afternoon", "evening", "night"]).optional(),
  }).optional(),
});
export const TuneResonanceInput = z.object({
  projectId: zIdField,
  viewerState: z.object({
    attention: z.number().min(0).max(1).optional(),
    arousal: z.number().min(0).max(1).optional(),
    valence: z.number().min(-1).max(1).optional(),
    fatigue: z.number().min(0).max(1).optional(),
    timeOfDay: z.enum(["morning", "afternoon", "evening", "night"]).optional(),
  }).optional(),
});

// Motion Synesthesia
export const TranslateSynesthesiaInput = z.object({
  projectId: zIdField,
});
export const MapSensoryToMotionInput = z.object({
  modality: z.enum(["color", "sound", "texture", "emotion"]),
  value: z.string().describe("The sensory value to map (hex color, note name, surface name, or emotion name)"),
});

// Motion Dream
export const DreamFromPromptInput = z.object({
  projectId: zIdField,
  prompt: z.string().describe("Natural language prompt describing the dream concept"),
});
export const GenerateDreamSequenceInput = z.object({
  projectId: zIdField,
  length: z.number().min(1).max(8).optional(),
  seed: z.string().optional(),
});
export const ListDreamConceptsInput = z.object({});

// Motion Harmonics
export const AnalyzeHarmonicsInput = z.object({
  projectId: zIdField,
});
export const FindHarmonicsInput = z.object({
  projectId: zIdField,
  componentId: z.string().describe("The component id to find harmonizing partners for"),
});

// Motion Entropy
export const AnalyzeEntropyInput = z.object({
  projectId: zIdField,
});
export const IdentifyInformationHotspotsInput = z.object({
  projectId: zIdField,
});

// Motion Cognition
export const AnalyzeCognitiveLoadInput = z.object({
  projectId: zIdField,
});

// Motion Topology
export const AnalyzeTopologyInput = z.object({
  projectId: zIdField,
});
export const FindTemporalPathInput = z.object({
  projectId: zIdField,
  fromId: z.string().describe("The source component id"),
  toId: z.string().describe("The target component id"),
});

// Motion Poetics
export const AnalyzePoeticsInput = z.object({
  projectId: zIdField,
});

// Motion Ecology
export const AnalyzeEcosystemInput = z.object({
  projectId: zIdField,
});

// Motion Calligraphy
export const AnalyzeCalligraphyInput = z.object({
  projectId: zIdField,
});

// Motion Mythology
export const AnalyzeMythologyInput = z.object({
  projectId: zIdField,
});

// Motion Weather
export const AnalyzeWeatherInput = z.object({
  projectId: zIdField,
});

// Motion Alchemy
export const AnalyzeAlchemyInput = z.object({
  projectId: zIdField,
});

// Motion Architecture
export const AnalyzeArchitectureInput = z.object({
  projectId: zIdField,
});

// Motion Cartography
export const AnalyzeCartographyInput = z.object({
  projectId: zIdField,
});

// Motion Genealogy
export const AnalyzeGenealogyInput = z.object({
  projectId: zIdField,
});

// Motion Astronomy
export const AnalyzeAstronomyInput = z.object({
  projectId: zIdField,
});

// Motion Chemistry
export const AnalyzeChemistryInput = z.object({
  projectId: zIdField,
});

// Motion Musicology
export const AnalyzeMusicologyInput = z.object({
  projectId: zIdField,
});

// Motion Botany
export const AnalyzeBotanyInput = z.object({
  projectId: zIdField,
});

// Motion Geology
export const AnalyzeGeologyInput = z.object({
  projectId: zIdField,
});

// Motion Physics
export const AnalyzePhysicsInput = z.object({
  projectId: zIdField,
});

// Motion Linguistics
export const AnalyzeLinguisticsInput = z.object({
  projectId: zIdField,
});

// Motion Cinema
export const AnalyzeCinemaInput = z.object({
  projectId: zIdField,
});

// Motion Verification
export const VerifyMotionInput = z.object({
  projectId: zIdField,
  /** Optional intent override; defaults to the most recent user message. */
  intent: z.string().optional(),
});

// Motion Self-Correction
export const SelfCorrectInput = z.object({
  projectId: zIdField,
  /** Optional intent override; defaults to the most recent user message. */
  intent: z.string().optional(),
  /** When false, only reports what would be fixed without applying patches. Default true. */
  apply: z.boolean().optional(),
});

// Motion Telepathy
export const PredictIntentInput = z.object({
  /** The partial user input to predict intent from. May be empty. */
  partial: z.string(),
  /** Optional project id to use the spec as a prior. */
  projectId: zIdField.optional(),
  /** How many predictions to return. Default 5. */
  topK: z.number().int().positive().max(10).optional(),
});

// Motion Prophecy
export const ForecastMotionInput = z.object({
  projectId: zIdField,
});

// Motion Genesis
export const GenesisMotionInput = z.object({
  projectId: zIdField,
  /** Which mathematical generator to use. */
  kind: z.enum(["lissajous", "goldenSpiral", "waveInterference", "dampedOscillator", "phyllotaxis", "lorenzAttractor"]),
  /** Number of keyframe samples. Default 24. */
  samples: z.number().int().positive().max(64).optional(),
  /** Animation duration in ms. Default 2000. */
  durationMs: z.number().int().positive().max(20000).optional(),
  /** Frequency a. Default 3. */
  a: z.number().optional(),
  /** Frequency b. Default 2. */
  b: z.number().optional(),
  /** Amplitude in pixels. Default 120. */
  amplitude: z.number().optional(),
  /** Damping coefficient. Default 0.15. */
  damping: z.number().optional(),
  /** Angular frequency. Default 4. */
  omega: z.number().optional(),
});

// Motion Symbiosis
export const AnalyzeSymbiosisInput = z.object({
  /** First project id (parent A). */
  projectIdA: zIdField,
  /** Second project id (parent B). */
  projectIdB: zIdField,
  /** When true, persist the bred hybrid offspring as components in project A. Default false. */
  persistOffspring: z.boolean().optional(),
});

// Motion Consciousness
export const ReflectConsciousnessInput = z.object({
  projectId: zIdField,
});

// Motion Volition
export const DecideVolitionInput = z.object({
  /** The partial user input to evaluate. May be empty. */
  partial: z.string(),
  /** Optional project id to read the current spec as a prior. */
  projectId: zIdField.optional(),
  /** Number of consecutive prior turns that ended in an ASK. */
  consecutiveAsks: z.number().int().min(0).optional(),
  /** Whether the same keyword appeared in the prior turn. */
  repeatedKeyword: z.boolean().optional(),
});

// Motion Lexicon
export const TranslateLexiconInput = z.object({
  /** The natural-language intent to translate (English or Chinese). */
  input: z.string(),
  /** Optional project id, reserved for future spec-aware routing. */
  projectId: zIdField.optional(),
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
  set_project_tempo: SetProjectTempoInput,
  quantize_to_tempo: QuantizeToTempoInput,
  set_phase: SetPhaseInput,
  align_to_beat: AlignToBeatInput,
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
  search_catalog: SearchCatalogInput,
  run_motion_pipeline: RunMotionPipelineInput,
  compose_sequence: ComposeSequenceInput,
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
  // Rotoscoping & keying
  roto_brush: RotoBrushInput,
  refine_edge: RefineEdgeInput,
  color_key: ColorKeyInput,
  linear_color_key: LinearColorKeyInput,
  difference_matte: DifferenceMatteInput,
  spill_suppression: SpillSuppressionInput,
  matte_choker: MatteChokerInput,
  inner_outer_key: InnerOuterKeyInput,
  // Transitions library
  block_dissolve: BlockDissolveInput,
  card_wipe: CardWipeInput,
  gradient_wipe: GradientWipeInput,
  iris_wipe: IrisWipeInput,
  linear_wipe: LinearWipeInput,
  radial_wipe: RadialWipeInput,
  venetian_blinds: VenetianBlindsInput,
  cc_jaws_wipe: CcJawsWipeInput,
  // Simulation & generators
  cc_ball_action: CcBallActionInput,
  cc_bubbles: CcBubblesInput,
  cc_rainfall: CcRainfallInput,
  cc_snowfall: CcSnowfallInput,
  cc_star_burst: CcStarBurstInput,
  cell_pattern: CellPatternInput,
  audio_spectrum: AudioSpectrumInput,
  radio_waves: RadioWavesInput,
  // Stylize effects
  cartoon_effect: CartoonEffectInput,
  brush_strokes: BrushStrokesInput,
  oil_paint: OilPaintInput,
  watercolor: WatercolorInput,
  emboss_effect: EmbossEffectInput,
  motion_tile: MotionTileInput,
  scatter_effect: ScatterEffectInput,
  threshold_effect: ThresholdEffectInput,
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
  editor_zoom_canvas: EditorZoomCanvasInput,
  editor_pan_canvas: EditorPanCanvasInput,
  editor_fit_to_screen: EditorFitToScreenInput,
  editor_reset_view: EditorResetViewInput,
  editor_set_playhead: EditorSetPlayheadInput,
  editor_set_playback_speed: EditorSetPlaybackSpeedInput,
  editor_play: EditorPlayInput,
  editor_pause: EditorPauseInput,
  editor_toggle_rulers: EditorToggleRulersInput,
  editor_toggle_snap: EditorToggleSnapInput,
  editor_toggle_auto_keyframe: EditorToggleAutoKeyframeInput,
  editor_toggle_onion_skin: EditorToggleOnionSkinInput,
  editor_select_component: EditorSelectComponentInput,
  editor_select_components: EditorSelectComponentsInput,
  editor_clear_selection: EditorClearSelectionInput,
  editor_toggle_visibility: EditorToggleVisibilityInput,
  editor_toggle_lock: EditorToggleLockInput,
  editor_set_panel: EditorSetPanelInput,
  editor_toggle_panel: EditorTogglePanelInput,
  editor_open_overlay: EditorOpenOverlayInput,
  editor_undo: EditorUndoInput,
  editor_redo: EditorRedoInput,
  editor_set_artboard: EditorSetArtboardInput,
  editor_trigger_replay: EditorTriggerReplayInput,
  editor_toggle_motion_paths: EditorToggleMotionPathsInput,
  editor_toggle_performance_monitor: EditorTogglePerformanceMonitorInput,
  editor_set_solo: EditorSetSoloInput,
  editor_toggle_sidebar: EditorToggleSidebarInput,
  editor_timeline_command: EditorTimelineCommandInput,
  editor_toggle_selection: EditorToggleSelectionInput,
  editor_open_skills: EditorOpenSkillsInput,
  editor_open_shortcuts: EditorOpenShortcutsInput,
  editor_set_track_order: EditorSetTrackOrderInput,
  editor_set_loop_region: EditorSetLoopRegionInput,
  editor_clear_loop_region: EditorClearLoopRegionInput,
  rollback_last_action: RollbackLastActionInput,
  list_checkpoints: ListCheckpointsInput,
  rollback_to_checkpoint: RollbackToCheckpointInput,
  cancel_plan: CancelPlanInput,
  get_plan_state: GetPlanStateInput,
  seek_to_frame: SeekToFrameInput,
  render_frames: RenderFramesInput,
  export_html_composition: ExportHtmlCompositionInput,
  resolve_media: ResolveMediaInput,
  route_skill: RouteSkillInput,
  list_skills: ListSkillsInput,
  plan_sequence: PlanSequenceInput,
  list_narrative_arcs: ListNarrativeArcsInput,
  list_motion_themes: ListMotionThemesInput,
  apply_motion_theme: ApplyMotionThemeInput,
  list_rhythm_patterns: ListRhythmPatternsInput,
  apply_rhythm: ApplyRhythmInput,
  generate_variants: GenerateVariantsInput,
  evolve_motion: EvolveMotionInput,
  list_evolution_strategies: ListEvolutionStrategiesInput,
  predict_perception: PredictPerceptionInput,
  list_semantic_concepts: ListSemanticConceptsInput,
  infer_intent: InferIntentInput,
  blend_concepts: BlendConceptsInput,
  simulate_physics: SimulatePhysicsInput,
  list_physics_presets: ListPhysicsPresetsInput,
  run_physics_preset: RunPhysicsPresetInput,
  generate_path_motion: GeneratePathMotionInput,
  list_path_presets: ListPathPresetsInput,
  run_path_preset: RunPathPresetInput,
  encode_motion: EncodeMotionInput,
  list_codec_formats: ListCodecFormatsInput,
  // Style Transfer
  extract_style_dna: ExtractStyleDnaInput,
  transfer_project_style: TransferProjectStyleInput,
  blend_styles: BlendStylesInput,
  describe_style: DescribeStyleInput,
  compare_styles: CompareStylesInput,
  list_style_archetypes: ListStyleArchetypesInput,
  apply_style_archetype: ApplyStyleArchetypeInput,
  // Knowledge Graph
  build_knowledge_graph: BuildKnowledgeGraphInput,
  query_concept: QueryConceptInput,
  find_related: FindRelatedInput,
  find_concept_path: FindPathInput,
  search_concepts: SearchConceptsInput,
  suggest_connections: SuggestConnectionsInput,
  recommend_next: RecommendNextInput,
  analyze_graph: AnalyzeGraphInput,
  // Testing
  run_all_tests: RunAllTestsInput,
  run_tests_by_category: RunTestsByCategoryInput,
  run_test_suite: RunTestSuiteInput,
  list_test_suites: ListTestSuitesInput,
  // Emotion Intelligence
  synthesize_from_emotion: SynthesizeFromEmotionInput,
  detect_emotion: DetectEmotionInput,
  blend_emotions: BlendEmotionsInput,
  plan_emotion_journey: PlanEmotionJourneyInput,
  list_emotions: ListEmotionsInput,
  // Adaptive Learning
  get_taste_profile: GetTasteProfileInput,
  recommend_for_project: RecommendForProjectInput,
  record_motion_observation: RecordMotionObservationInput,
  // Contextual Awareness
  compute_context_adjustments: ComputeContextAdjustmentsInput,
  adapt_component_for_context: AdaptComponentForContextInput,
  auto_detect_context: AutoDetectContextInput,
  list_context_options: ListContextOptionsInput,
  // Motion Collaboration
  plan_collaboration: PlanCollaborationInput,
  execute_collaboration: ExecuteCollaborationInput,
  list_collaboration_modules: ListCollaborationModulesInput,
  // Motion Resonance
  analyze_resonance: AnalyzeResonanceInput,
  tune_resonance: TuneResonanceInput,
  // Motion Synesthesia
  translate_synesthesia: TranslateSynesthesiaInput,
  map_sensory_to_motion: MapSensoryToMotionInput,
  // Motion Dream
  dream_from_prompt: DreamFromPromptInput,
  generate_dream_sequence: GenerateDreamSequenceInput,
  list_dream_concepts: ListDreamConceptsInput,
  // Motion Harmonics
  analyze_harmonics: AnalyzeHarmonicsInput,
  find_harmonics: FindHarmonicsInput,
  // Motion Entropy
  analyze_entropy: AnalyzeEntropyInput,
  identify_information_hotspots: IdentifyInformationHotspotsInput,
  // Motion Cognition
  analyze_cognitive_load: AnalyzeCognitiveLoadInput,
  // Motion Topology
  analyze_topology: AnalyzeTopologyInput,
  find_temporal_path: FindTemporalPathInput,
  // Motion Poetics
  analyze_poetics: AnalyzePoeticsInput,
  // Motion Ecology
  analyze_ecosystem: AnalyzeEcosystemInput,
  // Motion Calligraphy
  analyze_calligraphy: AnalyzeCalligraphyInput,
  // Motion Mythology
  analyze_mythology: AnalyzeMythologyInput,
  // Motion Weather
  analyze_weather: AnalyzeWeatherInput,
  // Motion Alchemy
  analyze_alchemy: AnalyzeAlchemyInput,
  // Motion Architecture
  analyze_architecture: AnalyzeArchitectureInput,
  // Motion Cartography
  analyze_cartography: AnalyzeCartographyInput,
  // Motion Genealogy
  analyze_genealogy: AnalyzeGenealogyInput,
  // Motion Astronomy
  analyze_astronomy: AnalyzeAstronomyInput,
  // Motion Chemistry
  analyze_chemistry: AnalyzeChemistryInput,
  // Motion Musicology
  analyze_musicology: AnalyzeMusicologyInput,
  // Motion Botany
  analyze_botany: AnalyzeBotanyInput,
  // Motion Geology
  analyze_geology: AnalyzeGeologyInput,
  // Motion Physics
  analyze_physics: AnalyzePhysicsInput,
  // Motion Linguistics
  analyze_linguistics: AnalyzeLinguisticsInput,
  // Motion Cinema
  analyze_cinema: AnalyzeCinemaInput,
  // Motion Verification
  verify_motion: VerifyMotionInput,
  // Motion Self-Correction
  self_correct: SelfCorrectInput,
  // Motion Telepathy
  predict_intent: PredictIntentInput,
  // Motion Prophecy
  forecast_motion: ForecastMotionInput,
  // Motion Genesis
  genesis_motion: GenesisMotionInput,
  // Motion Symbiosis
  analyze_symbiosis: AnalyzeSymbiosisInput,
  // Motion Consciousness
  reflect_consciousness: ReflectConsciousnessInput,
  // Motion Volition
  decide_volition: DecideVolitionInput,
  // Motion Lexicon
  translate_lexicon: TranslateLexiconInput,
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
  set_project_tempo: "Set the project tempo in beats-per-minute (20-300). Once set, durations can be snapped to the beat grid with quantize_to_tempo. Use for 'sync to 120 BPM' or 'lock motion to the music'.",
  quantize_to_tempo: "Snap a component's duration (or every component's) to the nearest musical beat division of the project tempo. Requires set_project_tempo first. Optional division forces a specific note value (1/1, 1/2, 1/4, 1/8, 1/16). Use for 'quantize everything to the beat' or 'snap durations to eighths'.",
  set_phase: "Anchor a component's start time to a musical phase within a 4/4 bar so it begins on the downbeat, offbeat, or any beat. Takes a named label (downbeat, offbeat, backbeat, beat1-4) or a numeric phaseBeats offset (0=downbeat, 0.5=offbeat, 1=beat 2). Requires set_project_tempo first. Use for 'put this on the offbeat', 'start on the downbeat', or 'shift to beat 3'.",
  align_to_beat: "Align component start times to the beat grid. 'snap' mode rounds each existing delay to the nearest beat division. 'polyrhythm' mode distributes the targets evenly across a fixed beat cycle, producing a k:base polyrhythm (e.g. 3 components across 2 beats = 3:2) that resolves back to the downbeat. Requires set_project_tempo first. Use for 'align starts to the beat', 'create a 3:2 polyrhythm', or 'space these across one bar'.",
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
  search_catalog: "Search the unified motion catalog for recipes, style presets, shader effects, brand packs, and choreography patterns. Returns matching resources with type, id, name, description, and relevance score. Use when the user asks 'find a fade preset', 'search for bounce effects', 'what shaders are available', or 'show me motion recipes'.",
  run_motion_pipeline: "Run the automated motion pipeline that generates a complete motion sequence from a natural language description. Chains intent analysis, template selection, easing synthesis, timing, choreography, color harmony, and principle validation. Use when the user says 'generate a playful bounce-in', 'create an elegant fade reveal', 'make a dramatic sequence', or 'automate motion for a hero title'.",
  compose_sequence: "Compose multiple components into a sequence, parallel, or stagger arrangement. Calculates precise start/end times and generates a timeline. Use when the user says 'arrange these in sequence', 'play them in parallel', 'stagger the animations', or 'compose a timeline'.",
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
  // Rotoscoping & keying
  roto_brush: "Automatic rotoscoping via seed-point propagation — mode (add/subtract/foreground/background), detection sensitivity, smoothness, and frame range. Use when the user says 'roto brush', 'auto mask', 'rotoscope this', or '自动遮罩'.",
  refine_edge: "Refine matte edges — feather radius, edge softness, decontamination, smart radius. Use when the user says 'refine edge', 'feather the matte', 'soft edge', 'clean up the mask edge', or '边缘羽化'.",
  color_key: "Chroma key — key out a specific color with tolerance, edge thin, and edge feather. Use when the user says 'color key', 'green screen', 'blue screen', 'remove the background color', or '抠像'.",
  linear_color_key: "Linear color key — match multiple colors with tolerance/softness, operate on RGB/hue/saturation/brightness. Use when the user says 'linear color key', 'match these colors', 'key out these shades', or '多色键'.",
  difference_matte: "Difference matte — extract a matte by comparing against a reference frame. Use when the user says 'difference matte', 'compare against reference', 'extract difference', or '差异遮罩'.",
  spill_suppression: "Spill suppression — remove green/blue/red spill from keyed footage with luminance preservation. Use when the user says 'spill suppression', 'remove green spill', 'clean up the edge color', or '溢出抑制'.",
  matte_choker: "Matte choker — tighten or spread a matte with multiple choke stages and iterations. Use when the user says 'matte choker', 'choke the matte', 'tighten the mask', 'spread the matte', or '遮罩收紧'.",
  inner_outer_key: "Inner/outer key — define foreground/background via inner and outer paths with feather. Use when the user says 'inner outer key', 'mask between two paths', 'isolate the subject', or '内外路径抠像'.",
  // Transitions library
  block_dissolve: "Block dissolve transition — dissolve between layers via a grid of random blocks. Use when the user says 'block dissolve', 'pixelate dissolve', 'tile dissolve', or '块状溶解'.",
  card_wipe: "Card wipe transition — flip cards on X or Y axis to reveal the next layer. Use when the user says 'card wipe', 'card flip', 'flip cards transition', or '卡片翻转'.",
  gradient_wipe: "Gradient wipe — wipe transition driven by a gradient layer's brightness. Use when the user says 'gradient wipe', 'wipe by gradient', 'brightness wipe', or '渐变擦除'.",
  iris_wipe: "Iris wipe — reveal via a polygonal iris (n-point star) opening/closing. Use when the user says 'iris wipe', 'star wipe', 'iris transition', or '光圈转场'.",
  linear_wipe: "Linear wipe — wipe at a specified angle with feather. Use when the user says 'linear wipe', 'wipe at 90 degrees', 'angle wipe', or '线性擦除'.",
  radial_wipe: "Radial wipe — sweep transition around a center point clockwise/counterclockwise. Use when the user says 'radial wipe', 'clock wipe', 'sweep transition', or '径向擦除'.",
  venetian_blinds: "Venetian blinds transition — reveal via horizontal or vertical stripes. Use when the user says 'venetian blinds', 'blind wipe', 'stripe transition', or '百叶窗'.",
  cc_jaws_wipe: "CC Jaws wipe — multi-directional jaws/line/scale/grid/radial wipe with point spacing. Use when the user says 'jaws wipe', 'cc jaws', 'multi-direction wipe', or '锯齿擦除'.",
  // Simulation & generators
  cc_ball_action: "CC Ball Action — render the layer as a grid of balls with rotation and scatter. Use when the user says 'ball action', 'turn into balls', 'sphere grid', or '球阵动画'.",
  cc_bubbles: "CC Bubbles — procedurally generate rising/falling bubbles with size, speed, and wobble. Use when the user says 'bubbles', 'add bubbles', 'bubble field', or '气泡效果'.",
  cc_rainfall: "CC Rainfall — procedural rain with drop count, size, speed, wind, angle, and blur. Use when the user says 'rainfall', 'rain effect', 'add rain', 'falling rain', or '下雨效果'.",
  cc_snowfall: "CC Snowfall — procedural snowflakes with count, size, speed, wind, wobble. Use when the user says 'snowfall', 'snow effect', 'add snow', 'falling snow', or '下雪效果'.",
  cc_star_burst: "CC Star Burst — point-star burst generator with speed, scatter, and phase. Use when the user says 'star burst', 'stars flying', 'starfield burst', or '星爆效果'.",
  cell_pattern: "Cell pattern generator — 14 procedural patterns (bubbles, crystals, static plates, tubular, spotted, cracked, steel, organic, stone rock, dried up, shatter, scales, turbulent, load bubbles). Use when the user says 'cell pattern', 'procedural texture', 'crystal pattern', 'organic noise', or '细胞纹理'.",
  audio_spectrum: "Audio spectrum visualizer — render frequency spectrum along a path with thickness, colors, and display modes. Use when the user says 'audio spectrum', 'frequency visualizer', 'audio bars', 'spectrum analyzer', or '频谱可视化'.",
  radio_waves: "Radio waves — emit expanding wave rings from a producer point with frequency and fadeout. Use when the user says 'radio waves', 'sonar rings', 'expanding circles', 'wave emitter', or '电波扩散'.",
  // Stylize effects
  cartoon_effect: "Cartoon cel shader — edge thickness, shading steps, outline color, edge mode (inverted/drawn/lit/outline). Use when the user says 'cartoon', 'cel shade', 'toon style', 'comic look', or '卡通着色'.",
  brush_strokes: "Brush strokes — painterly rendering via brush size, angle, length, density, randomness, and paint surface. Use when the user says 'brush strokes', 'painterly', 'oil brush look', 'paint texture', or '笔触油画'.",
  oil_paint: "Oil paint effect — brush scale, contrast, clean color, blur, sharpness. Use when the user says 'oil paint', 'oil painting look', 'palette knife', or '油画效果'.",
  watercolor: "Watercolor effect — edge intensity, simplicity, texture, brush size, wetness, color variation, paper type. Use when the user says 'watercolor', 'aquarelle', 'watercolour', 'paint wash', or '水彩效果'.",
  emboss_effect: "Emboss — direction angle, height, amount, relief for a sculpted relief look. Use when the user says 'emboss', 'bas-relief', 'sculpted look', 'relief', or '浮雕效果'.",
  motion_tile: "Motion tile — tile a layer across an output area with phase, offsets, and edge mirroring. Use when the user says 'motion tile', 'tile the layer', 'repeat pattern', 'wrap edges', or '运动拼贴'.",
  scatter_effect: "Scatter — randomly displace pixels with grain, monochromatic option, and axis lock. Use when the user says 'scatter', 'pixel scatter', 'grain', 'disperse pixels', or '像素散射'.",
  threshold_effect: "Threshold — binarize the image at a level with channel selection and optional halftone. Use when the user says 'threshold', 'binarize', 'posterize to 2 colors', 'high contrast', or '阈值化'.",
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
  editor_zoom_canvas: "Set the canvas zoom level (0.1 to 5, where 1 = 100%). Use when the user says 'zoom in', 'zoom out', 'zoom to 200%', or 'scale the view'.",
  editor_pan_canvas: "Pan the canvas viewport to a specific X/Y offset in pixels. Use when the user says 'pan left', 'scroll the canvas', 'move the view', or 'center on a point'.",
  editor_fit_to_screen: "Auto-fit all components into the visible canvas area. Use when the user says 'fit to screen', 'fit all', 'frame everything', or 'zoom to fit'.",
  editor_reset_view: "Reset the canvas zoom to 100% and pan to origin. Use when the user says 'reset view', 'reset zoom', 'reset pan', or '100% zoom'.",
  editor_set_playhead: "Move the timeline playhead to a specific time in milliseconds. Use when the user says 'go to 500ms', 'set playhead to 1 second', 'scrub to halfway', or 'jump to time'.",
  editor_set_playback_speed: "Set the playback speed multiplier (0.25 to 4). Use when the user says 'play at half speed', 'slow motion', '2x speed', or 'play faster'.",
  editor_play: "Start timeline playback from the current playhead position. Use when the user says 'play', 'start playback', 'play the animation', or 'run it'.",
  editor_pause: "Pause timeline playback. Use when the user says 'pause', 'stop playback', 'freeze', or 'halt the animation'.",
  editor_toggle_rulers: "Show or hide canvas rulers. Pass enabled to set explicitly, or omit to toggle. Use when the user says 'show rulers', 'hide rulers', or 'toggle rulers'.",
  editor_toggle_snap: "Enable or disable snap-to-grid with an optional grid size (1-50px). Use when the user says 'turn on snap', 'disable snapping', 'snap to 16px grid', or 'set grid size'.",
  editor_toggle_auto_keyframe: "Enable or disable auto-keyframe recording mode. When enabled, property changes automatically create keyframes at the playhead. Use when the user says 'auto keyframe on', 'turn off auto keyframe', or 'record keyframes automatically'.",
  editor_toggle_onion_skin: "Toggle onion skinning to show ghost overlays of adjacent keyframe positions. Optional frames (1-8) and opacity (0.05-0.8). Use when the user says 'show onion skin', 'turn on ghost frames', 'show motion trail', or 'onion skin with 4 frames'.",
  editor_select_component: "Select a single component by id. Pass additive=true to add to the current selection. Use when the user says 'select the title', 'select this layer', or 'pick the circle'.",
  editor_select_components: "Select multiple components by id. Pass clearFirst=true to clear the existing selection before adding. Use when the user says 'select all layers', 'select these three', or 'multi-select'.",
  editor_clear_selection: "Clear the current component selection. Use when the user says 'deselect', 'clear selection', 'unselect all', or 'nothing selected'.",
  editor_toggle_visibility: "Toggle the visibility of a component on the canvas. Use when the user says 'hide this layer', 'show the title', 'toggle visibility', or 'make it invisible'.",
  editor_toggle_lock: "Lock or unlock a component to prevent editing. Pass locked for explicit state, or omit to toggle. Use when the user says 'lock this layer', 'unlock the circle', or 'prevent editing'.",
  editor_set_panel: "Switch the right panel to a functional group (design, motion, intel, assets, output) and optionally a specific tab. Use when the user says 'open the layers panel', 'switch to motion tab', 'show the export panel', or 'go to design group'.",
  editor_toggle_panel: "Collapse or expand the right panel. Pass collapsed for explicit state, or omit to toggle. Use when the user says 'collapse the panel', 'expand the sidebar', 'hide the panel', or 'show the panel'.",
  editor_open_overlay: "Open or close an overlay (preview, export, templates, settings, command_palette). Pass open for explicit state, or omit to toggle. Use when the user says 'open preview', 'open export dialog', 'open settings', 'open templates', or 'open command palette'.",
  editor_undo: "Undo the last editor action. Use when the user says 'undo', 'revert that', 'go back a step', or 'undo last'.",
  editor_redo: "Redo the last undone editor action. Use when the user says 'redo', 'redo that', 'repeat the undo', or 'bring it back'.",
  editor_set_artboard: "Set the artboard (canvas) dimensions and/or background color. Width/height in pixels (64-4096). Use when the user says 'set canvas to 800x600', 'make the canvas wider', 'change background to black', or 'resize the artboard'.",
  editor_trigger_replay: "Replay the animation from the beginning. Use when the user says 'replay', 'play again', 'restart playback', or 'replay the animation'.",
  editor_toggle_motion_paths: "Show or hide motion paths (trajectory overlays) for animated components. Pass enabled to set explicitly, or omit to toggle. Use when the user says 'show motion paths', 'hide trajectories', or 'show animation paths'.",
  editor_toggle_performance_monitor: "Show or hide the performance monitor overlay (FPS, frame time, render stats). Pass enabled to set explicitly. Use when the user says 'show performance', 'check FPS', 'hide performance monitor', or 'toggle perf overlay'.",
  editor_set_solo: "Solo a single component (dims all others) or clear solo by passing null. Use when the user says 'solo this layer', 'isolate the circle', 'focus on just the title', or 'clear solo'.",
  editor_toggle_sidebar: "Collapse or expand the left sidebar. Pass collapsed for explicit state. Use when the user says 'collapse the sidebar', 'show the sidebar', 'hide the left panel', or 'toggle sidebar'.",
  editor_timeline_command: "Execute a timeline command action: copy, paste, duplicate, delete, group, ungroup, bring_to_front, send_to_back. Use when the user says 'copy this', 'paste', 'duplicate the layer', 'delete selected', 'group these', 'ungroup', 'bring to front', or 'send to back'.",
  editor_toggle_selection: "Toggle a component in or out of the current multi-selection. Use when the user says 'also select the title', 'toggle that layer in the selection', or 'add/remove from selection'.",
  editor_open_skills: "Open or close the skills overlay panel. Pass open for explicit state. Use when the user says 'open skills', 'show skills', 'close skills panel', or 'browse skills'.",
  editor_open_shortcuts: "Open or close the keyboard shortcuts overlay. Pass open for explicit state. Use when the user says 'show shortcuts', 'keyboard shortcuts', 'open shortcuts', or 'close shortcuts'.",
  editor_set_track_order: "Set the display order of timeline tracks by providing an ordered list of component/track ids. Use when the user says 'reorder tracks', 'move this track up', 'sort tracks by name', or 'change track order'.",
  editor_set_loop_region: "Set a loop region (start and end in milliseconds) for timeline playback looping. Use when the user says 'loop from 500ms to 2000ms', 'set loop region', 'loop this section', or 'set playback loop'.",
  editor_clear_loop_region: "Clear the current loop region so playback runs linearly without looping. Use when the user says 'remove loop', 'clear loop region', 'stop looping', or 'disable loop'.",
  rollback_last_action: "Roll back the most recent AI-driven mutation by restoring the latest checkpoint. Use when the user says 'undo last action', 'rollback', 'revert that change', or 'go back'.",
  list_checkpoints: "List all available checkpoints for the project, newest first. Each checkpoint is a snapshot captured before an AI tool batch mutated the spec.",
  rollback_to_checkpoint: "Roll back to a specific checkpoint by id. Use after list_checkpoints to pick a target snapshot.",
  cancel_plan: "Cancel the currently running structured plan. The agent stops executing remaining actions after the current one completes.",
  get_plan_state: "Get the current structured plan execution state — which actions are pending, in progress, completed, or failed. Use when the user asks 'what's the plan', 'where are we', or 'plan status'.",
  seek_to_frame: "Seek to a specific frame in the composition and return the complete frame snapshot with all component states (transform, opacity, styles). Deterministic — same frame always produces the same result. Use when the user says 'show frame 30', 'what does it look like at frame 45', or 'seek to the middle'.",
  render_frames: "Render a range of frames from the composition. Returns frame snapshots for each frame in the range. Use for batch rendering, preview generation, or thumbnail extraction. Use when the user says 'render frames 0 to 60', 'generate previews', or 'render the whole sequence'.",
  export_html_composition: "Generate a self-contained HTML composition document with seek protocol (window.__om.seek). The HTML can be rendered in any browser and supports frame-accurate seeking via WAAPI. Use when the user says 'export as HTML', 'generate HTML composition', or 'create a playable preview'.",
  resolve_media: "Resolve a media need (audio, image, video, voice, icon, logo, LUT) from the catalog or generate on demand. Returns a media asset with source path and metadata. Use when the user says 'I need background music', 'add a sound effect', 'generate a voiceover', or 'find an image'.",
  route_skill: "Route user input to the best skill combination. Returns the primary skill, supporting skills, detected intent, confidence, and execution plan. Use when the user asks 'what can you do', 'which skill should I use', or for understanding agent capabilities.",
  list_skills: "List all available skills, optionally filtered by category. Returns skill id, name, description, category, complexity, and tools. Use when the user asks 'what skills do you have', 'show me your capabilities', or 'list available skills'.",
  plan_sequence: "Plan a multi-scene motion sequence from a description. Decomposes a story into ordered scenes with emotional tones, transitions, and pacing. Returns scenes, timeline, emotional arc, and pacing analysis. Use when the user wants to create a multi-scene narrative, plan a story-driven animation, or organize components into scenes.",
  list_narrative_arcs: "List all available narrative arc templates (hero-journey, product-launch, tutorial, etc.). Returns arc id, name, description, default scene count, and tone progression. Use when the user wants to explore story structures.",
  list_motion_themes: "List all motion themes (coordinated easing families, timing scales, and choreography rules). Optionally filter by personality archetype. Returns theme id, name, personality, easing family, timing scale, and vocabulary. Use when the user wants to apply a consistent motion identity.",
  apply_motion_theme: "Apply a motion theme to a project. Adjusts easing, timing, and choreography to match the theme. Returns the themed spec. Use when the user says 'apply precision tech theme' or 'make this look luxurious'.",
  list_rhythm_patterns: "List all rhythm patterns (steady-beat, syncopated, swing, waltz, heartbeat, etc.). Optionally filter by category. Returns pattern id, name, BPM, time signature, and beat structure. Use when the user wants musical timing.",
  apply_rhythm: "Apply a rhythm pattern to generate stagger delays for items. Returns beat times, accents, and total duration. Use when the user says 'add swing rhythm' or 'use a heartbeat pattern for stagger timing'.",
  generate_variants: "Generate A/B motion variants from a project. Each variant explores a different design direction (easing, timing, intensity, direction, palette). Returns variants with changes and divergence scores. Use when the user wants to explore alternatives or A/B test motion designs.",
  evolve_motion: "Evolve a motion spec across multiple generations using a genetic algorithm. Breeds progressively better animations via selection, crossover, and mutation. Strategies: balanced, playful, accessible, performant, harmonious. Use when the user says 'evolve', 'optimize', 'breed', or 'iteratively improve' the motion.",
  list_evolution_strategies: "List all available evolution strategies with their fitness weights and descriptions. Use when the user asks 'what evolution strategies are available' or 'list optimization strategies'.",
  predict_perception: "Predict how viewers will cognitively and emotionally respond to the motion. Returns emotional valence, arousal profile, cognitive load, attention retention, memorability, and brand perception. Use when the user asks 'how will this feel' or 'predict viewer response'.",
  list_semantic_concepts: "List all semantic concepts (trust, urgency, luxury, playful, etc.) that can be mapped to motion parameters. Optionally filter by category. Use when the user asks 'what emotions can I express' or 'list motion concepts'.",
  infer_intent: "Infer semantic intent from a natural language description. Maps phrases like 'make it feel trustworthy' to concrete motion parameters (easing, duration, palette, energy). Use when the user describes a feeling rather than specific parameters.",
  blend_concepts: "Blend two semantic concepts into a hybrid motion profile (e.g. 'playful luxury' = bounce + smooth + gold). Returns the blended profile with easing, duration, palette, and energy. Use when the user wants to combine two moods or brand attributes.",
  simulate_physics: "Run a physics simulation and generate motion keyframes from the result. Types: spring (damped oscillator), gravity (drop with bounce), projectile (parabolic arc), friction (deceleration), pendulum (damped swing). Use when the user says 'physics', 'spring', 'gravity', 'bounce', 'projectile', or 'pendulum'.",
  list_physics_presets: "List all available physics simulation presets with their configurations. Use when the user asks 'what physics presets are available' or 'list physics simulations'.",
  run_physics_preset: "Run a named physics preset and generate a motion component from the simulation result. Presets include spring-snappy, spring-gentle, spring-bouncy, gravity-drop, gravity-slam, projectile-arc, projectile-high, friction-slide, friction-glide, pendulum-swing.",
  generate_path_motion: "Generate motion along a mathematical path (bezier, lissajous, spiral, figure-eight, heart, circle, svg-path). Samples positions along the curve and creates keyframes. Use when the user says 'path', 'curve', 'lissajous', 'spiral', 'orbit', or 'trajectory'.",
  list_path_presets: "List all available path motion presets with their configurations. Use when the user asks 'what path presets are available' or 'list path types'.",
  run_path_preset: "Run a named path preset (lissajous-3-2, spiral-archimedean, figure-eight, heart-curve, circle-orbit, ellipse-orbit, bezier-s-curve) and generate a motion component.",
  encode_motion: "Encode the project's motion spec to a standard format (lottie, css, waapi, smil, gsap, react-spring). Use when the user says 'export', 'encode', 'convert to lottie', 'generate css', or 'export as code'.",
  list_codec_formats: "List all available codec formats for motion export. Use when the user asks 'what formats can I export' or 'list codec formats'.",
  // Style Transfer
  extract_style_dna: "Extract the motion style DNA from a project. Analyzes easing, tempo, energy, colors, and staging patterns.",
  transfer_project_style: "Transfer the visual style from one project to another. Preserves target structure while applying source's easing, tempo, energy, and color characteristics.",
  blend_styles: "Blend the style DNA of two projects at a given ratio (0=A, 1=B). Returns the blended style description.",
  describe_style: "Generate a human-readable description of a project's motion style.",
  compare_styles: "Compare the style DNA of two projects and return similarity scores across multiple dimensions.",
  list_style_archetypes: "List all predefined motion style archetypes (Minimalist, Energetic, Cinematic, Playful, Corporate, Organic, Mechanical, Elegant).",
  apply_style_archetype: "Apply a named style archetype to a project, transforming its easing, tempo, energy, and colors.",
  // Knowledge Graph
  build_knowledge_graph: "Build and return the complete motion knowledge graph with all concept nodes and relationships.",
  query_concept: "Look up a motion concept by its id (e.g. 'bounce', 'stagger', 'parallax').",
  find_related: "Find concepts related to a given concept, optionally filtered by relationship type (enables, complements, conflicts, etc.).",
  find_concept_path: "Find the shortest path between two motion concepts in the knowledge graph.",
  search_concepts: "Search motion concepts by keyword across labels, descriptions, and tags.",
  suggest_connections: "Suggest non-obvious connections between a set of motion concepts.",
  recommend_next: "Recommend the next motion concept to explore based on what's already been used in the project.",
  analyze_graph: "Analyze the knowledge graph structure: centrality, clusters, bridges, and density.",
  // Testing
  run_all_tests: "Run all motion quality test suites (accessibility, performance, visual, principles, timing, consistency) on a project.",
  run_tests_by_category: "Run motion tests filtered by category: accessibility, performance, visual, principles, timing, or consistency.",
  run_test_suite: "Run a single test suite by its id (e.g. 'a11y-duration-check', 'perf-simultaneous-animations').",
  list_test_suites: "List all available motion test suites with their ids, names, and descriptions.",
  // Emotion Intelligence
  synthesize_from_emotion: "Synthesize motion parameters from a target emotion. Translates emotional tone (joy, calm, anger, etc.) into concrete easing, duration, intensity, and keyframes.",
  detect_emotion: "Detect the emotional tone of an existing motion component. Returns VAD (Valence-Arousal-Dominance) coordinates and the closest matching emotion with confidence score.",
  blend_emotions: "Blend multiple emotions with weights to create nuanced affective motion. Mixes VAD coordinates and motion parameters proportionally.",
  plan_emotion_journey: "Plan a sequence of emotional states across a timeline to create an affective arc (e.g., calm → curious → excited → satisfied).",
  list_emotions: "List all available emotion profiles (joy, excitement, calm, sadness, anger, fear, surprise, trust, anticipation, power, melancholy, serenity, playful, mystery, urgency, luxury).",
  // Adaptive Learning
  get_taste_profile: "Get the user's learned motion taste profile for this project. Shows preferred easings, durations, intensity range, and detected taste drift.",
  recommend_for_project: "Get a motion parameter recommendation based on the user's learned preferences. Returns easing, duration, intensity, and palette suggestions with confidence score.",
  record_motion_observation: "Record a motion interaction (created, accepted, rejected, modified) to feed the adaptive learning engine. Use after user interacts with a component.",
  // Contextual Awareness
  compute_context_adjustments: "Compute context-aware motion adjustments for device, performance, time of day, ambient light, and user state. Returns duration/intensity multipliers and palette mode.",
  adapt_component_for_context: "Adapt a motion component for a specific context. Adjusts duration, intensity, easing, palette, and transforms based on device, performance, and environmental factors.",
  auto_detect_context: "Auto-detect the current motion context from available signals (user-agent, hardware, time). Returns detected device, performance tier, time of day, and ambient light.",
  list_context_options: "List all available context options for device class, performance tier, time of day, ambient light, user state, and palette mode.",
  // Motion Collaboration
  plan_collaboration: "Plan a multi-module collaboration for a complex motion request. Decomposes the request into sub-tasks for specialized motion intelligence modules (emotion, physics, style, context, etc.).",
  execute_collaboration: "Execute a multi-module collaboration that produces a unified motion design. Coordinates multiple motion intelligences and merges their results with conflict resolution.",
  list_collaboration_modules: "List all available collaboration modules with their specialties and trigger keywords.",
  // Motion Resonance
  analyze_resonance: "Analyze the resonance between the project's motion and the viewer's cognitive/emotional state. Computes cognitive, emotional, and rhythmic alignment scores with dissonance detection and recommendations.",
  tune_resonance: "Tune the project's motion parameters to maximize resonance with the viewer's state. Adjusts durations and easings based on cognitive load, arousal, valence, and fatigue.",
  // Motion Synesthesia
  translate_synesthesia: "Translate the project's motion into a multi-sensory experience — map each component to color, sound, and texture for cross-modal design exploration.",
  map_sensory_to_motion: "Reverse-map a sensory input (color, sound, texture, or emotion) to motion parameters. Enables designing motion from non-visual sensory inputs.",
  // Motion Dream
  dream_from_prompt: "Generate a dream-like motion variation from a natural language prompt using surrealist concept juxtaposition and mutation techniques.",
  generate_dream_sequence: "Generate a sequence of dream motions composed into a narrative thread, traversing multiple concepts via juxtaposition and mutation.",
  list_dream_concepts: "List all available dream concepts (natural, mechanical, abstract, organic, cosmic, temporal, emotional) used as seeds for generative creativity.",
  // Motion Harmonics
  analyze_harmonics: "Analyze the harmonic structure of a motion composition — extract frequency signatures, compute consonance/dissonance between components, and reveal the hidden musical structure of looping motion.",
  find_harmonics: "Find components that harmonize with a given component — returns consonant and dissonant partners based on frequency ratio analysis.",
  // Motion Entropy
  analyze_entropy: "Apply Shannon's information theory to motion — measure property entropy, mutual information between components, information density over time, and overall predictability vs redundancy.",
  identify_information_hotspots: "Identify the most varied and least varied motion properties, plus redundant component pairs that share too much design information.",
  // Motion Cognition
  analyze_cognitive_load: "Model the cognitive load a motion composition imposes on the viewer — working memory demand (Miller's 7±2), attention switching cost, Gestalt perceptual grouping, and processing fluency.",
  // Motion Topology
  analyze_topology: "Analyze the topological structure of a motion composition — connected components, temporal holes, Euler characteristic, genus, connectivity, and compactness of the temporal space.",
  find_temporal_path: "Find the shortest temporal path between two components through overlapping neighbors — reveals how motion propagates through the composition.",
  // Motion Poetics
  analyze_poetics: "Apply poetic meter and form to motion — detect poetic feet (iamb, trochee, dactyl, anapest), stanzas, caesuras, enjambments, and classify the form (sonnet, haiku, free verse).",
  // Motion Ecology
  analyze_ecosystem: "Model motion components as a living ecosystem — classify species, detect symbiotic/parasitic/predator-prey relationships, compute biodiversity, and assess ecosystem health and stability.",
  // Motion Calligraphy
  analyze_calligraphy: "Analyze the composition as calligraphic art — evaluate stroke quality, pressure, velocity, fluency, ink flow, and overall character (regular/running/cursive/wild).",
  // Motion Mythology
  analyze_mythology: "Interpret the composition through mythological lens — detect hero's journey stages, archetypal patterns, narrative structure, theme, tension curve, and emotional boon.",
  // Motion Weather
  analyze_weather: "Model the composition as a weather system — detect pressure, wind, fronts, storms, calm periods, climate, and forecast emotional atmospheric patterns.",
  // Motion Alchemy
  analyze_alchemy: "Interpret the composition through alchemical transformation — detect the four magnum opus stages (nigredo, albedo, citrinitas, rubedo), alchemical operations, prima materia, philosopher's stone, and Hermes principle.",
  // Motion Architecture
  analyze_architecture: "Analyze the composition as a built structure — classify structural roles (foundation/structure/facade/ornament/detail), proportion (golden ratio, modular harmony), hierarchy, spatial organization, architectural style, and structural integrity.",
  // Motion Cartography
  analyze_cartography: "Map the composition as cartographic terrain — compute elevation profile, contour lines, landmarks (peak moments), routes (trajectories), territories (biomes), compass direction, and scale level.",
  // Motion Genealogy
  analyze_genealogy: "Trace the evolutionary lineage of motion patterns — extract genetic traits, detect ancestry relationships, build a phylogenetic tree, classify evolutionary pattern (divergent/convergent/parallel), and analyze genetic diversity and inheritance.",
  // Motion Astronomy
  analyze_astronomy: "Map the composition as celestial phenomena — classify components as celestial bodies (star/planet/moon/asteroid/comet/black-hole/nebula/pulsar), assign spectral types (O/B/A/F/G/K/M), detect constellations, cosmic events (supernova/eclipse/conjunction), and galactic structure (spiral/elliptical/irregular/lenticular/ring).",
  // Motion Chemistry
  analyze_chemistry: "Analyze the composition as a chemical system — extract atoms (animated properties), build molecules (components), detect bonds (covalent/ionic/metallic/hydrogen/van-der-waals), classify reactions (synthesis/decomposition/displacement/combustion), identify catalysts (easings) and inhibitors (delays), and compute pH, temperature, entropy, enthalpy, and equilibrium.",
  // Motion Musicology
  analyze_musicology: "Analyze the composition as a musical score — extract notes (pitch/velocity/articulation), detect chords and harmonic progressions, identify melodic phrases and contours, compute rhythm (BPM/time signature/syncopation), analyze dynamics (crescendo/decrescendo), determine form (AABA/sonata/rondo), and detect key and scale.",
  // Motion Botany
  analyze_botany: "Analyze the composition as a botanical system — classify organs (leaf/stem/flower/root/branch/fruit/seed/tendril/bark), detect branching structure, analyze canopy shape and density, examine root system, build phenology timeline (germination→senescence), determine life form (tree/shrub/herb/vine), and compute biomass, diversity, and vitality.",
  // Motion Geology
  analyze_geology: "Analyze the composition as a geological formation — classify strata (sedimentary/igneous/metamorphic/volcanic/alluvial), detect tectonic events (earthquake/uplift/faulting/volcanic-eruption), identify fault lines, analyze mineral composition, divide geological epochs, and examine surface topology (mountain/valley/canyon/plateau).",
  // Motion Physics
  analyze_physics: "Analyze the composition through physics principles — compute kinematics (displacement/velocity/acceleration), dynamics (applied/friction/gravity/spring forces), energy (kinetic/potential/dissipation), momentum (linear/angular), detect collisions, and analyze equilibrium (static/dynamic/unstable).",
  // Motion Linguistics
  analyze_linguistics: "Analyze the composition as a linguistic utterance — extract phonemes (plosive/fricative/vowel/diphthong), classify morphemes (root/prefix/suffix), build syntactic phrases and clauses, analyze prosody (stress/intonation/tempo), determine semantics (polarity/modality/tense/aspect), identify speech acts, and trace discourse coherence.",
  // Motion Cinema
  analyze_cinema: "Analyze the composition as a cinematic sequence — classify shots (wide/medium/close-up), detect cuts and transitions (dissolve/fade/wipe/iris), determine camera movement (pan/tilt/dolly/zoom/crane), analyze mise-en-scène (balance/lighting/color), identify narrative structure (three-act/five-act/kishōtenketsu), compute pacing, classify montage type, and detect genre (action/drama/horror/thriller).",
  verify_motion: "Verify the current motion against the user's stated intent by compiling the request into testable assertions and evaluating each one pass/fail/skip against the spec. Returns a structured report with per-assertion evidence, an achieved ratio, and concrete remediation suggestions for failed assertions. Use when the user asks 'did you do it right', 'verify', 'check your work', or before reporting completion on a multi-step request.",
  self_correct: "Close the verification loop: run verify_motion, and for each failed required assertion apply the concrete remediation patch (easing family, duration band, loop count, color, stagger) directly to the spec, then re-verify so the caller gets a before/after diff. Use when the agent detects its own work missed the intent ('fix it', 'verify and fix', 'self-correct', 'you didn't do it right'), or as a bounded one-pass correction before reporting completion. Pass apply=false to dry-run the fixes.",
  predict_intent: "Predict the user's intent from partial input before they finish typing. Returns ranked predictions with confidence scores, extracted signals, suggested completions, and the tool path each prediction implies. Use proactively to offer inline suggestions, or when the user pauses mid-sentence and may accept a completion.",
  forecast_motion: "Forecast the motion design trajectory of the current project — classify the current design era, predict the next era it would naturally evolve toward, and propose avant-garde directions that diverge from the trajectory. Returns a prophecy report with probabilities, suggestions, novelty score, and avant-garde proposals. Use when the user asks 'where is this going', 'what's next', 'forecast', 'predict the future', or wants creative direction.",
  genesis_motion: "Generate original motion from mathematical first principles. Six generators: lissajous (parametric sinusoid curve), goldenSpiral (logarithmic spiral with golden-ratio growth), waveInterference (superposition of two sine waves), dampedOscillator (exponential-decay envelope on cosine), phyllotaxis (sunflower-seed packing on Fermat spiral), lorenzAttractor (2D projection of chaotic Lorenz system). Returns component drafts with keyframes derived from pure mathematics. Use when the user asks for 'mathematical motion', 'generative', 'lissajous', 'spiral', 'wave', 'oscillator', 'phyllotaxis', 'attractor', or wants motion derived from first principles.",
  analyze_symbiosis: "Analyze the ecological relationship between two motion compositions and breed a hybrid offspring. Extracts each composition's genomic trait vector, measures niche overlap and complementarity, classifies the relationship (mutualism, commensalism, parasitism, competition, neutralism), and breeds three hybrid offspring components by crossing over parental keyframes and easings. Optionally persists the offspring into the first project. Use when the user says 'compare these two projects', 'breed them', 'crossbreed', 'symbiosis', 'what if these two compositions met', or wants hybrid offspring from two compositions.",
  reflect_consciousness: "Produce a meta-cognitive self-reflection of a motion composition. The composition observes its own design as a thinking entity: enumerates self-beliefs, generates counter-questions that challenge each belief, detects cognitive biases (anchoring, confirmation, sunk-cost, default, recency) embedded in the design choices, composes a first-person stream-of-consciousness monologue, and computes a metacognitive awareness score. Use when the user says 'what does this motion think of itself', 'is this design self-aware', 'biases in my motion', 'meta-cognitive', 'reflect on this design', or wants the composition to introspect.",
  decide_volition: "Decide whether the agent should act, ask one clarifying question, defer, or refine the intent before committing to a tool sequence. Returns a volition mode (ACT/ASK/DEFER/REFINE), action readiness, stall risk, regret estimate, detected ambiguity signals, a bounded clarifying question when ASK, a refined intent when REFINE, and suggested tools when ACT. Use proactively before dispatching tools on a vague intent, or when the user says 'should you act or ask', 'are you confident', 'clarify', or before any multi-step request that touches the spec.",
  translate_lexicon: "Translate a natural-language motion intent (English or Chinese) onto a formal token system: a duration token (instant/micro/standard/normal/extended/cinematic), an easing token (ease-out/ease-in-out/spring-soft/spring-snappy/linear), a reduced-motion fallback mode (scale-only/crossfade/none), and one of eleven motion categories (entrance, exit, scroll-reveal, hover-press, state-transition, feedback-delight, emphasis, loading, page-transition, text-kinetic, video-transition). Returns matched bilingual cues and suggested tools. Use when the user says '丝滑', '高级', '电影感', '弹性', '淡入', '滑动', '加载', '翻页', '打字', '闪烁', 'motion token', 'duration token', 'easing token', 'reduced-motion mode', or wants the intent translated into motion tokens.",
};
