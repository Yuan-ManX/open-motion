import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getBrowserPath } from "../utils/env.js";
import { logger } from "../utils/logger.js";

export interface RecordOptions {
  previewUrl: string;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  framesDir: string;
}

/**
 * Drive a headless browser to the preview URL, restart CSS animations from t=0,
 * and capture a PNG stream via CDP Page.startScreencast for the full duration.
 * Returns the sorted list of captured frame file paths.
 */
export async function recordFrames(opts: RecordOptions): Promise<string[]> {
  const exe = await getBrowserPath();
  if (!exe) throw new Error("recorder: no browser executable found");

  const puppeteer = (await import("puppeteer-core")).default;
  mkdirSync(opts.framesDir, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"],
  });

  const frames: string[] = [];
  let frameIndex = 0;

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: opts.width,
      height: opts.height,
      deviceScaleFactor: 1,
    });
    await page.goto(opts.previewUrl, { waitUntil: "networkidle0", timeout: 15000 });

    // Restart every animation from the beginning so the capture starts clean.
    await page.evaluate(() => {
      document.querySelectorAll("[data-om-name]").forEach((el) => {
        const cast = el as HTMLElement;
        cast.style.animation = "none";
        void cast.offsetWidth; // reflow
        cast.style.animation = "";
      });
    });

    const client = await page.target().createCDPSession();
    client.on("Page.screencastFrame", (event) => {
      const filename = `frame_${String(frameIndex).padStart(6, "0")}.png`;
      const filePath = join(opts.framesDir, filename);
      writeFileSync(filePath, Buffer.from(event.data, "base64"));
      frames.push(filePath);
      frameIndex += 1;
      void client.send("Page.screencastFrameAck", { sessionId: event.sessionId });
    });

    await client.send("Page.startScreencast", {
      format: "png",
      quality: 100,
      maxWidth: opts.width,
      maxHeight: opts.height,
      everyNthFrame: 1,
    });

    const captureMs = Math.max(opts.durationMs + 300, 500);
    await new Promise((r) => setTimeout(r, captureMs));

    await client.send("Page.stopScreencast").catch(() => {
      /* already stopped */
    });

    logger.info("recorder captured frames", { count: frames.length, captureMs });
  } finally {
    await browser.close().catch(() => {
      /* ignore */
    });
  }

  return frames;
}
