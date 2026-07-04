import { z } from "zod";
import { MotionSpecSchema } from "./motion/spec.js";

/** A skill manifest — describes how an AI agent should call this motion skill. */
export const SkillManifestSchema = z.object({
  name: z.string(),
  description: z.string(),
  version: z.string().default("1.0.0"),
  outputType: z.enum(["html", "spec", "code"]).default("html"),
  inputSchema: z
    .record(z.string(), z.unknown())
    .describe("JSON-schema-ish description of callable inputs")
    .default({}),
});
export type SkillManifest = z.infer<typeof SkillManifestSchema>;

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string().default("1.0.0"),
  sourceProjectId: z.string().nullable().default(null),
  sourceComponentId: z.string().nullable().default(null),
  manifest: SkillManifestSchema,
  motionSpec: MotionSpecSchema,
  codeHtml: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Skill = z.infer<typeof SkillSchema>;
