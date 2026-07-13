import type { ToolName } from "@openmotion/shared";
import { exportProjectHtml } from "../../export/html.js";
import { exportProjectVideo, type VideoFormat } from "../../export/video.js";
import { exportProjectCss, exportProjectJson, exportProjectReact } from "../../export/code.js";
import { exportProjectLottie } from "../../export/lottie.js";
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

  export_code: (args, ctx) => {
    const format = String(args.format ?? "css") as "css" | "json" | "react";
    let result;
    if (format === "css") result = exportProjectCss(ctx.projectId);
    else if (format === "json") result = exportProjectJson(ctx.projectId);
    else result = exportProjectReact(ctx.projectId);
    if (!result) {
      return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    }
    const preview = result.code.slice(0, 200);
    return {
      ok: true,
      summary: `exported ${format} code (${result.code.length} chars, file: ${result.filename}) — preview: ${preview}…`,
      specChanged: false,
      data: { format, filename: result.filename, code: result.code },
    };
  },

  export_lottie: (args, ctx) => {
    const fps = args.fps ? Number(args.fps) : undefined;
    const result = exportProjectLottie(ctx.projectId, fps);
    if (!result) {
      return { ok: false, summary: `project ${ctx.projectId} not found`, specChanged: false };
    }
    return {
      ok: true,
      summary: `exported Lottie JSON (${result.code.length} chars, ${fps ?? 60}fps, file: ${result.filename})`,
      specChanged: false,
      data: { filename: result.filename, code: result.code, fps: fps ?? 60 },
    };
  },
};
