import { z } from "zod";
import { EasingSchema, easingPreset, type Easing } from "./easing.js";
import { KeyValueSchema, TransformPropertySchema } from "./transform.js";

export const zId = z.string().min(1);

export const CssStyleSchema = z
  .record(z.string(), z.union([z.string(), z.number()]))
  .default({});

export const KeyframeSchema = z.object({
  offset: z.number().min(0).max(1),
  properties: z.record(TransformPropertySchema, KeyValueSchema).default({}),
  easing: EasingSchema.optional(),
});
export type Keyframe = z.infer<typeof KeyframeSchema>;

export const IterationCountSchema = z.union([z.number().int().positive(), z.literal("infinite")]);
export type IterationCount = z.infer<typeof IterationCountSchema>;

export const DirectionSchema = z.enum([
  "normal",
  "reverse",
  "alternate",
  "alternate-reverse",
]);
export const FillModeSchema = z.enum(["none", "forwards", "backwards", "both"]);
export const PlayStateSchema = z.enum(["running", "paused"]);
export const TriggerSchema = z.enum(["onLoad", "onClick", "onHover", "onScroll", "afterDelay"]);
export type Trigger = z.infer<typeof TriggerSchema>;

/** A single animatable element. The editable unit the agent tools operate on. */
export const MotionComponentSchema = z.object({
  id: zId,
  projectId: zId,
  sceneId: z.string().nullable().default(null),
  name: z.string(),
  selector: z.string().nullable().default(null),
  templateId: z.string().nullable().default(null),
  durationMs: z.number().int().positive().default(800),
  delayMs: z.number().int().nonnegative().default(0),
  iterationCount: IterationCountSchema.default(1),
  direction: DirectionSchema.default("normal"),
  fillMode: FillModeSchema.default("forwards"),
  playState: PlayStateSchema.default("running"),
  trigger: TriggerSchema.default("onLoad"),
  easing: EasingSchema.default(() => easingPreset("ease-out")),
  keyframes: z.array(KeyframeSchema).default([]),
  style: CssStyleSchema.default({}),
  orderIndex: z.number().int().default(0),
  parentId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MotionComponent = z.infer<typeof MotionComponentSchema>;

export const SceneSchema = z.object({
  id: zId,
  name: z.string(),
  durationMs: z.number().int().positive().optional(),
});
export type Scene = z.infer<typeof SceneSchema>;

export const GlobalTimingSchema = z
  .object({
    totalDurationMs: z.number().int().positive().optional(),
    defaultEasing: EasingSchema.optional(),
  })
  .default({});

export const MotionProjectSchema = z.object({
  id: zId,
  name: z.string(),
  description: z.string().default(""),
  scenes: z.array(SceneSchema).default([]),
  tokens: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  globalTiming: GlobalTimingSchema,
  status: z.enum(["draft", "published"]).default("draft"),
  sourceTemplateId: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MotionProject = z.infer<typeof MotionProjectSchema>;

/** The assembled, runnable spec — project metadata + all components. */
export const MotionSpecSchema = z.object({
  project: MotionProjectSchema,
  components: z.array(MotionComponentSchema),
});
export type MotionSpec = z.infer<typeof MotionSpecSchema>;

export const DEFAULT_EASING: Easing = easingPreset("ease-out");
