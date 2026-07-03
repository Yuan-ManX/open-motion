import type { ZodTypeAny } from "zod";
import { TOOL_INPUT_SCHEMAS, TOOL_DESCRIPTIONS, TOOL_NAMES, type ToolName } from "@openmotion/shared";
import type { LlmToolSpec } from "../provider/types.js";

/**
 * Minimal zod → JSON Schema converter covering the constructs used across the
 * OpenMotion tool schemas (object/string/number/enum/literal/union/array/record/
 * optional/default/tuple/discriminated-union). Keeps the LLM tool surface free
 * of a third-party converter dependency.
 */
export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  return convert(schema) as Record<string, unknown>;
}

function convert(schema: ZodTypeAny): unknown {
  if (!schema) return {};
  // Unwrap optional/default wrappers to reach the concrete type.
  const def = (schema as { _def?: { typeName: string; [k: string]: unknown } })._def;
  if (!def) return {};
  switch (def.typeName) {
    case "ZodObject": {
      const shape = (def.shape as () => Record<string, ZodTypeAny>)();
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convert(value);
        if (!isOptional(value)) required.push(key);
      }
      return { type: "object", properties, required, additionalProperties: false };
    }
    case "ZodString":
      return { type: "string" };
    case "ZodNumber": {
      const out: Record<string, unknown> = { type: "number" };
      for (const check of (def.checks as { kind: string; value?: number; inclusive?: boolean }[]) ?? []) {
        if (check.kind === "min" && check.inclusive !== false) out.minimum = check.value;
        if (check.kind === "max" && check.inclusive !== false) out.maximum = check.value;
        if (check.kind === "int") out.type = "integer";
      }
      return out;
    }
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return { type: "string", enum: def.values };
    case "ZodLiteral":
      return { const: def.value };
    case "ZodUnion":
    case "ZodDiscriminatedUnion":
      return { anyOf: (def.options as ZodTypeAny[]).map(convert) };
    case "ZodArray":
      return { type: "array", items: convert((def.type ?? def.element) as ZodTypeAny) };
    case "ZodTuple":
      return {
        type: "array",
        items: (def.items as ZodTypeAny[]).map(convert),
        minItems: (def.items as unknown[]).length,
        maxItems: (def.items as unknown[]).length,
      };
    case "ZodRecord":
      return { type: "object", additionalProperties: convert(def.valueType as ZodTypeAny) };
    case "ZodOptional":
    case "ZodDefault":
    case "ZodNullable":
      return convert((def.innerType ?? def.type) as ZodTypeAny);
    default:
      return {};
  }
}

function isOptional(schema: ZodTypeAny): boolean {
  const def = (schema as { _def: { typeName: string; innerType?: ZodTypeAny } })._def;
  return def.typeName === "ZodOptional" || def.typeName === "ZodDefault";
}

/** Build the full LLM tool surface from the shared zod registry. */
export function buildToolSpecs(): LlmToolSpec[] {
  return TOOL_NAMES.map((name) => ({
    name,
    description: TOOL_DESCRIPTIONS[name],
    inputSchema: zodToJsonSchema(TOOL_INPUT_SCHEMAS[name]),
  }));
}

/** Validate raw tool args against the shared schema. */
export function parseToolArgs(
  tool: ToolName,
  raw: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const schema = TOOL_INPUT_SCHEMAS[tool];
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  const first = result.error.issues[0];
  return { ok: false, error: first ? `${first.path.join(".")}: ${first.message}` : "invalid args" };
}
