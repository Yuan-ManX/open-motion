import { TOOL_NAMES, TOOL_INPUT_SCHEMAS, TOOL_DESCRIPTIONS } from "@openmotion/shared";
import type { z, ZodTypeAny } from "zod";
import { listProjects } from "../db/repositories/projects.js";
import { executeTool } from "../agent/tools/registry.js";
import { logger } from "../utils/logger.js";

type McpServerLike = {
  tool(
    name: string,
    description: string,
    paramsSchema: Record<string, ZodTypeAny>,
    cb: (args: Record<string, unknown>) => Promise<{
      content: Array<{ type: "text"; text: string }>;
      isError?: boolean;
    }>,
  ): unknown;
};

function defaultProjectId(): string | null {
  const projects = listProjects();
  return projects[0]?.id ?? null;
}

function toMcpShape(schema: z.ZodObject<z.ZodRawShape>): Record<string, ZodTypeAny> {
  const shape = schema.shape as Record<string, ZodTypeAny>;
  const next: Record<string, ZodTypeAny> = { ...shape };
  if (next.projectId) {
    next.projectId = next.projectId.optional();
  }
  return next;
}

/** Register every OpenMotion tool onto an MCP server. */
export function registerMcpTools(server: McpServerLike): void {
  for (const name of TOOL_NAMES) {
    const description = TOOL_DESCRIPTIONS[name] ?? name;
    const shape = toMcpShape(TOOL_INPUT_SCHEMAS[name]);

    server.tool(name, description, shape, async (args) => {
      const projectId = (args.projectId as string | undefined) ?? defaultProjectId();
      if (!projectId) {
        return {
          content: [{ type: "text", text: "No project exists yet. Create one via the web UI first." }],
          isError: true,
        };
      }

      logger.debug("mcp tool call", { name, projectId });
      const result = await executeTool(name, args, { projectId });
      const text = JSON.stringify(result, null, 2);
      return {
        content: [{ type: "text", text }],
        isError: !result.ok,
      };
    });
  }
}
