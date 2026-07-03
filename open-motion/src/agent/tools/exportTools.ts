import type { ToolName } from "@openmotion/shared";
import { exportProjectHtml } from "../../export/html.js";
import { exportProjectVideo, type VideoFormat } from "../../export/video.js";
import { packageSkill } from "../../skills/packager.js";
import { hasPuppeteer, hasFfmpeg } from "../../utils/env.js";
import type { ToolContext, ToolResult } from "./registry.js";

type Executor = (args: Record<string, unknown>, ctx: ToolContext) => ToolResult | Promise<ToolResult>;

export const exportExecutors: Partial<Record<ToolName, Executor>> = {
  export_html: (_args, ctx) => {
    const result = exportProjectHtml(ctx.projectId);
    if (!result) return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    return {
      ok: true,
      summary: `exported standalone HTML to ${result.url}`,
      specChanged: false,
      data: { url: result.url, filename: result.filename },
    };
  },

  export_video: async (args, ctx) => {
    const [puppet, ffmpeg] = await Promise.all([hasPuppeteer(), hasFfmpeg()]);
    if (!puppet || !ffmpeg) {
      return {
        ok: false,
        summary: `video export unavailable in this environment (puppeteer=${puppet}, ffmpeg=${ffmpeg})`,
        specChanged: false,
      };
    }
    const format = (args.format as VideoFormat) ?? "mp4";
    const handle = await exportProjectVideo(ctx.projectId, { format });
    return {
      ok: true,
      summary: `video export job ${handle.jobId} started (format=${format})`,
      specChanged: false,
      data: { jobId: handle.jobId, status: handle.status, format },
    };
  },

  export_skill: (args, ctx) => {
    const name = String(args.name ?? "packaged-motion");
    const description = String(
      args.description ?? "A motion packaged as a reusable, AI-callable skill.",
    );
    const componentId = args.componentId ? String(args.componentId) : undefined;
    const tags = Array.isArray(args.tags) ? (args.tags as string[]) : [];
    const skill = packageSkill({ projectId: ctx.projectId, componentId, name, description, tags });
    if (!skill) {
      return { ok: false, summary: `could not package skill from project ${ctx.projectId}`, specChanged: false };
    }
    return {
      ok: true,
      summary: `packaged skill "${name}" (${skill.id})`,
      specChanged: false,
      data: { skillId: skill.id, name: skill.name },
    };
  },
};
