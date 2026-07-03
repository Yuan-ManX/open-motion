import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import type { MotionSpec } from "@openmotion/shared";
import { getProjectSpec } from "../db/repositories/projects.js";
import {
  createExportJob,
  updateExportJob,
} from "../db/repositories/exports.js";
import { exportsDir, renderedDir } from "../db/index.js";
import { publicBaseUrl } from "../config.js";
import { now } from "../utils/id.js";
import { logger } from "../utils/logger.js";
import { hasPuppeteer, hasFfmpeg, getFfmpegPath } from "../utils/env.js";
import { recordFrames } from "./recorder.js";

export type VideoFormat = "mp4" | "gif" | "webm";

export interface VideoExportOptions {
  format?: VideoFormat;
  fps?: number;
  width?: number;
  height?: number;
}

export interface VideoExportHandle {
  jobId: string;
  status: "pending";
}

function computeTotalDuration(spec: MotionSpec): number {
  let max = 0;
  for (const c of spec.components) {
    const iters = c.iterationCount === "infinite" ? 1 : Number(c.iterationCount) || 1;
    max = Math.max(max, c.delayMs + c.durationMs * iters);
  }
  return Math.max(max, 500);
}

function ffmpegArgs(
  framesDir: string,
  outFile: string,
  format: VideoFormat,
  fps: number,
  width: number,
  height: number,
): string[] {
  const input = join(framesDir, "frame_%06d.png");
  if (format === "mp4") {
    return [
      "-y",
      "-framerate", String(fps),
      "-i", input,
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      `-vf`, `scale=${width}:${height}`,
      outFile,
    ];
  }
  if (format === "webm") {
    return [
      "-y",
      "-framerate", String(fps),
      "-i", input,
      "-c:v", "libvpx-vp9",
      "-b:v", "0",
      "-crf", "40",
      `-vf`, `scale=${width}:${height}`,
      outFile,
    ];
  }
  // gif
  return [
    "-y",
    "-framerate", String(fps),
    "-i", input,
    "-lavfi", `fps=${fps},scale=${width}:${height}:flags=lanczos`,
    outFile,
  ];
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(args[0], args.slice(1), { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    proc.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

/** Create a video export job and kick off background processing. Returns immediately. */
export async function exportProjectVideo(
  projectId: string,
  opts: VideoExportOptions = {},
): Promise<VideoExportHandle> {
  const format = opts.format ?? "mp4";
  const fps = opts.fps ?? 30;
  const width = opts.width ?? 640;
  const height = opts.height ?? 360;

  const job = createExportJob(projectId, format, { fps, width, height });

  // Fire and forget — the route returns the jobId immediately.
  void _runVideoJob(job.id, projectId, { format, fps, width, height }).catch((err) => {
    logger.error("video job crashed", { jobId: job.id, error: String(err) });
    updateExportJob(job.id, {
      status: "failed",
      error: String(err),
      completedAt: now(),
    });
  });

  return { jobId: job.id, status: "pending" };
}

async function _runVideoJob(
  jobId: string,
  projectId: string,
  opts: { format: VideoFormat; fps: number; width: number; height: number },
): Promise<void> {
  const [puppet, ffmpeg] = await Promise.all([hasPuppeteer(), hasFfmpeg()]);
  if (!puppet || !ffmpeg) {
    updateExportJob(jobId, {
      status: "failed",
      error: `video export requires puppeteer + ffmpeg (puppeteer=${puppet}, ffmpeg=${ffmpeg})`,
      completedAt: now(),
    });
    return;
  }

  const spec = getProjectSpec(projectId);
  if (!spec) {
    updateExportJob(jobId, {
      status: "failed",
      error: "project not found",
      completedAt: now(),
    });
    return;
  }

  updateExportJob(jobId, { status: "running" });

  const totalDurationMs = computeTotalDuration(spec);
  const framesDir = join(renderedDir, "jobs", jobId);
  const filename = `${projectId}-${jobId}.${opts.format}`;
  const outFile = join(exportsDir, filename);
  const ffmpegPath = await getFfmpegPath();
  if (!ffmpegPath) {
    updateExportJob(jobId, {
      status: "failed",
      error: "ffmpeg binary not found",
      completedAt: now(),
    });
    return;
  }

  try {
    const previewUrl = `${publicBaseUrl()}/api/projects/${projectId}/preview`;
    await recordFrames({
      previewUrl,
      width: opts.width,
      height: opts.height,
      fps: opts.fps,
      durationMs: totalDurationMs,
      framesDir,
    });

    const args = ffmpegArgs(framesDir, outFile, opts.format, opts.fps, opts.width, opts.height);
    await runFfmpeg([ffmpegPath, ...args]);

    updateExportJob(jobId, {
      status: "done",
      filePath: filename,
      completedAt: now(),
    });
    logger.info("video job done", { jobId, filename });
  } catch (err) {
    updateExportJob(jobId, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      completedAt: now(),
    });
  } finally {
    rmSync(framesDir, { recursive: true, force: true });
  }
}
