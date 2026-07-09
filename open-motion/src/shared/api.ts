import { z } from "zod";
import { MotionComponentSchema, MotionProjectSchema } from "./motion/spec.js";
import { SkillSchema } from "./skill.js";

/* ----------------------------- Health ----------------------------- */
export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
  db: z.boolean(),
  provider: z.enum(["mock", "openai"]),
  toolCallSupported: z.boolean(),
  puppeteer: z.boolean(),
  ffmpeg: z.boolean(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/* ----------------------------- Templates ----------------------------- */
export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
  spec: z.unknown(),
  previewHtml: z.string().nullable().default(null),
  createdAt: z.string(),
});
export type Template = z.infer<typeof TemplateSchema>;

export const CreateProjectInputSchema = z.object({
  name: z.string().optional(),
  templateId: z.string().optional(),
});

/* ----------------------------- Projects ----------------------------- */
export const ProjectResponseSchema = MotionProjectSchema.extend({
  spec: z.unknown(),
});
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;

/* ----------------------------- Chat / SSE ----------------------------- */
export const ChatRequestSchema = z.object({
  message: z.string().min(1),
});

/** Typed SSE event frames for the chat stream. */
export const ChatEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("meta"), provider: z.enum(["mock", "openai"]) }),
  z.object({ type: z.literal("token"), delta: z.string() }),
  z.object({
    type: z.literal("plan"),
    steps: z.array(z.object({ tool: z.string(), description: z.string() })),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("tool_call"),
    tool: z.string(),
    args: z.unknown(),
    callId: z.string(),
  }),
  z.object({
    type: z.literal("tool_result"),
    callId: z.string(),
    tool: z.string(),
    result: z.unknown(),
    summary: z.string(),
  }),
  z.object({
    type: z.literal("spec_update"),
    components: z.array(MotionComponentSchema),
    project: MotionProjectSchema.optional(),
  }),
  z.object({
    type: z.literal("done"),
    message: z.string(),
    tokensIn: z.number().default(0),
    tokensOut: z.number().default(0),
  }),
  z.object({ type: z.literal("error"), message: z.string(), recoverable: z.boolean().default(true) }),
]);
export type ChatEvent = z.infer<typeof ChatEventSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string().default(""),
  toolName: z.string().nullable().default(null),
  toolCalls: z.array(z.any()).optional(),
  toolCallId: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

/* ----------------------------- Export ----------------------------- */
export const ExportHtmlResponseSchema = z.object({
  html: z.string(),
  url: z.string(),
});
export const ExportVideoInputSchema = z.object({
  format: z.enum(["mp4", "gif", "webm"]).default("mp4"),
  fps: z.number().int().positive().default(30),
  width: z.number().int().positive().default(640),
  height: z.number().int().positive().default(360),
});
export const ExportJobResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(["pending", "running", "done", "failed"]),
});
export const ExportJobStatusSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  format: z.string(),
  status: z.enum(["pending", "running", "done", "failed"]),
  filePath: z.string().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});
export type ExportJobStatus = z.infer<typeof ExportJobStatusSchema>;

/* ----------------------------- Skills ----------------------------- */
export const CreateSkillInputSchema = z.object({
  projectId: z.string(),
  componentId: z.string().optional(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()).default([]),
});
export type CreateSkillInput = z.infer<typeof CreateSkillInputSchema>;
export const SkillSummarySchema = SkillSchema.pick({
  id: true,
  name: true,
  description: true,
  version: true,
  tags: true,
}).extend({ outputType: z.string().default("html") });
export type SkillSummary = z.infer<typeof SkillSummarySchema>;
