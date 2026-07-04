import { z } from "zod";
import { ExportVideoInputSchema } from "@openmotion/shared";
import type { Skill } from "@openmotion/shared";
import { HttpError } from "../middleware/error.js";
import { ensureProjectExists } from "./projectService.js";
import { getExportJob } from "../../db/repositories/exports.js";
import { exportProjectHtml } from "../../export/html.js";
import { exportProjectVideo, type VideoFormat } from "../../export/video.js";
import {
  exportProjectCss,
  exportProjectJson,
  exportProjectReact,
  type CodeExport,
} from "../../export/code.js";
import { packageSkill } from "../../skills/packager.js";

export type ExportVideoInputType = z.infer<typeof ExportVideoInputSchema>;

export interface HtmlExportResult {
  html: string;
  url: string;
  filename: string;
}

export function exportHtml(projectId: string): HtmlExportResult {
  ensureProjectExists(projectId);
  const result = exportProjectHtml(projectId);
  if (!result) throw new HttpError(500, "export failed");
  return result;
}

export async function exportVideo(
  projectId: string,
  input: ExportVideoInputType,
): Promise<{ jobId: string; status: string }> {
  ensureProjectExists(projectId);
  const handle = await exportProjectVideo(projectId, {
    format: input.format as VideoFormat,
    fps: input.fps,
    width: input.width,
    height: input.height,
  });
  return handle;
}

export function exportCode(projectId: string, format: "css" | "json" | "react"): CodeExport {
  ensureProjectExists(projectId);
  const result =
    format === "css"
      ? exportProjectCss(projectId)
      : format === "json"
        ? exportProjectJson(projectId)
        : exportProjectReact(projectId);
  if (!result) throw new HttpError(500, "export failed");
  return result;
}

export function getJobOrThrow(jobId: string) {
  const job = getExportJob(jobId);
  if (!job) throw new HttpError(404, "job not found");
  return job;
}

export function packageProjectSkill(input: {
  projectId: string;
  componentId?: string;
  name: string;
  description: string;
  tags?: string[];
}): Skill {
  const skill = packageSkill(input);
  if (!skill) throw new HttpError(404, "source project not found");
  return skill;
}
