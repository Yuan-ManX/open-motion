import type { ToolName } from "@openmotion/shared";
import {
  saveVersion,
  listVersions,
  restoreVersion,
  deleteVersion,
} from "../../db/repositories/versions.js";
import {
  listTokens,
  createToken,
  updateToken,
  deleteToken,
  getToken,
  type TokenCategory,
} from "../../db/repositories/tokens.js";
import type { ToolContext, ToolResult } from "./registry.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

export const versionExecutors: Partial<Record<ToolName, Executor>> = {
  save_version: (args, ctx) => {
    const label = String(args.label);
    const version = saveVersion(ctx.projectId, label);
    if (!version) {
      return { ok: false, summary: `failed to capture version for project ${ctx.projectId}`, specChanged: false };
    }
    return {
      ok: true,
      summary: `captured version "${label}" (${version.componentCount} components)`,
      specChanged: false,
      data: version,
    };
  },

  list_versions: (_args, ctx) => {
    const versions = listVersions(ctx.projectId);
    return {
      ok: true,
      summary: `${versions.length} version snapshot(s) available`,
      specChanged: false,
      data: versions,
    };
  },

  restore_version: (args, ctx) => {
    const versionId = String(args.versionId);
    const spec = restoreVersion(versionId);
    if (!spec) {
      return { ok: false, summary: `version ${versionId} not found`, specChanged: false };
    }
    return {
      ok: true,
      summary: `restored project to version ${versionId} (${spec.components.length} components)`,
      specChanged: true,
      data: spec,
    };
  },

  delete_version: (args, ctx) => {
    const versionId = String(args.versionId);
    const ok = deleteVersion(versionId);
    if (!ok) {
      return { ok: false, summary: `version ${versionId} not found`, specChanged: false };
    }
    return {
      ok: true,
      summary: `deleted version ${versionId}`,
      specChanged: false,
    };
  },

  save_token: (args, ctx) => {
    const name = String(args.name);
    const category = String(args.category) as TokenCategory;
    const value = String(args.value);
    const description = args.description ? String(args.description) : "";
    // Upsert: if token exists, update it; otherwise create.
    const existing = getToken(ctx.projectId, name);
    if (existing) {
      const updated = updateToken(ctx.projectId, name, { value, description: description || undefined });
      return {
        ok: true,
        summary: `updated token "${name}" (${category}) = ${value}`,
        specChanged: false,
        data: updated,
      };
    }
    const token = createToken({ projectId: ctx.projectId, name, category, value, description });
    return {
      ok: true,
      summary: `created token "${name}" (${category}) = ${value}`,
      specChanged: false,
      data: token,
    };
  },

  list_tokens: (args, ctx) => {
    const category = args.category ? String(args.category) : undefined;
    const tokens = listTokens(ctx.projectId, category);
    return {
      ok: true,
      summary: `${tokens.length} design token(s)${category ? ` in category "${category}"` : ""}`,
      specChanged: false,
      data: tokens,
    };
  },

  update_token: (args, ctx) => {
    const name = String(args.name);
    const patch: { value?: string; description?: string } = {};
    if (args.value) patch.value = String(args.value);
    if (args.description) patch.description = String(args.description);
    const token = updateToken(ctx.projectId, name, patch);
    if (!token) {
      return { ok: false, summary: `token "${name}" not found`, specChanged: false };
    }
    return {
      ok: true,
      summary: `updated token "${name}" = ${token.value}`,
      specChanged: false,
      data: token,
    };
  },

  delete_token: (args, ctx) => {
    const name = String(args.name);
    const ok = deleteToken(ctx.projectId, name);
    if (!ok) {
      return { ok: false, summary: `token "${name}" not found`, specChanged: false };
    }
    return {
      ok: true,
      summary: `deleted token "${name}"`,
      specChanged: false,
    };
  },
};
