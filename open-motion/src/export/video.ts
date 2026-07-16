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

/** Audio source extracted from a component for mixing into the export. */
interface AudioSource {
  url: string;
  delayMs: number;
  loop: boolean;
}

function computeTotalDuration(spec: MotionSpec): number {
  let max = 0;
  for (const c of spec.components) {
    const iters = c.iterationCount === "infinite" ? 1 : Number(c.iterationCount) || 1;
    max = Math.max(max, c.delayMs + c.durationMs * iters);
  }
  return Math.max(max, 500);
}

/** Extract audio sources from components with _tag audio or video. */
function extractAudioSources(spec: MotionSpec): AudioSource[] {
  const sources: AudioSource[] = [];
  for (const c of spec.components) {
    const style = c.style as Record<string, string | number>;
    const tag = String(style._tag ?? "div");
    const src = style._src ? String(style._src) : null;
    if (!src) continue;
    if (tag === "audio" || tag === "video") {
      sources.push({
        url: src,
        delayMs: c.delayMs,
        loop: style._loop === 1 || c.iterationCount === "infinite",
      });
    }
  }
  return sources;
}

/** Build ffmpeg arguments with audio mixing support. */
function ffmpegArgs(
  framesDir: string,
  outFile: string,
  format: VideoFormat,
  fps: number,
  width: number,
  height: number,
  audioSources: AudioSource[],
): string[] {
  const input = join(framesDir, "frame_%06d.png");
  const args: string[] = ["-y", "-framerate", String(fps), "-i", input];

  // Add audio inputs
  for (const src of audioSources) {
    args.push("-i", src.url);
  }

  if (audioSources.length > 0 && format !== "gif") {
    // Build filter complex for audio delay and mixing
    const filterParts: string[] = [];
    const mixInputs: string[] = [];
    audioSources.forEach((src, i) => {
      const inputIdx = i + 1; // offset by 1 because 0 is the video
      const delay = Math.round(src.delayMs);
      const label = `a${i}`;
      if (src.loop) {
        filterParts.push(`[${inputIdx}:a]aloop=loop=-1:size=2e9,adelay=${delay}|${delay}[${label}]`);
      } else {
        filterParts.push(`[${inputIdx}:a]adelay=${delay}|${delay}[${label}]`);
      }
      mixInputs.push(`[${label}]`);
    });
    const mixLabel = mixInputs.length > 1
      ? `${mixInputs.join("")}amix=inputs=${mixInputs.length}[aout]`
      : `${mixInputs.join("")}anull[aout]`;
    filterParts.push(mixLabel);

    args.push("-filter_complex", filterParts.join(";"));

    if (format === "mp4") {
      args.push(
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        `-vf`, `scale=${width}:${height}`,
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        outFile,
      );
    } else {
      // webm
      args.push(
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "libvpx-vp9",
        "-b:v", "0",
        "-crf", "40",
        `-vf`, `scale=${width}:${height}`,
        "-c:a", "libopus",
        "-b:a", "128k",
        "-shortest",
        outFile,
      );
    }
  } else {
    // No audio — use the original video-only args
    if (format === "mp4") {
      args.push(
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        `-vf`, `scale=${width}:${height}`,
        outFile,
      );
    } else if (format === "webm") {
      args.push(
        "-c:v", "libvpx-vp9",
        "-b:v", "0",
        "-crf", "40",
        `-vf`, `scale=${width}:${height}`,
        outFile,
      );
    } else {
      // gif
      args.push("-lavfi", `fps=${fps},scale=${width}:${height}:flags=lanczos`, outFile);
    }
  }

  return args;
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

    const audioSources = extractAudioSources(spec);
    const args = ffmpegArgs(framesDir, outFile, opts.format, opts.fps, opts.width, opts.height, audioSources);
    if (audioSources.length > 0) {
      logger.info(`Video export includes ${audioSources.length} audio source(s)`, { jobId });
    }
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
