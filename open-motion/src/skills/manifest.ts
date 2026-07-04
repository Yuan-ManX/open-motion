import type { SkillManifest, MotionSpec } from "@openmotion/shared";

export interface BuildManifestInput {
  name: string;
  description: string;
  sourceSpec: MotionSpec;
}

/**
 * Derive the callable manifest of a skill from its source spec. Exposes the
 * dimensions an AI caller may override at invoke time.
 */
export function buildManifest(input: BuildManifestInput): SkillManifest {
  return {
    name: input.name,
    description: input.description,
    version: "1.0.0",
    outputType: "html",
    inputSchema: {
      easing: {
        type: "string",
        description: "Optional preset easing to apply (e.g. bounce, smooth, snappy, elastic).",
      },
      durationMs: {
        type: "number",
        description: "Optional animation duration override in milliseconds.",
      },
      iterationCount: {
        type: ["number", "string"],
        description: "Optional iteration count (number or 'infinite').",
      },
    },
  };
}
