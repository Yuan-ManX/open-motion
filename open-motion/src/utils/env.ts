import { logger } from "./logger.js";

let _puppeteerOk: boolean | null = null;
let _ffmpegOk: boolean | null = null;

/** Lazily check whether a usable puppeteer-core + browser is available. */
export async function hasPuppeteer(): Promise<boolean> {
  if (_puppeteerOk !== null) return _puppeteerOk;
  try {
    const puppeteer = await import("puppeteer-core");
    const exe = await findBrowserExecutable();
    _puppeteerOk = !!(puppeteer && exe);
    if (!_puppeteerOk) logger.warn("Video export disabled: no browser executable found for puppeteer.");
    return _puppeteerOk;
  } catch {
    _puppeteerOk = false;
    logger.warn("Video export disabled: puppeteer-core not installed.");
    return false;
  }
}

export async function hasFfmpeg(): Promise<boolean> {
  if (_ffmpegOk !== null) return _ffmpegOk;
  try {
    const ffmpegPath = (await import("ffmpeg-static")).default;
    _ffmpegOk = !!ffmpegPath;
    return _ffmpegOk;
  } catch {
    _ffmpegOk = false;
    return false;
  }
}

export async function getFfmpegPath(): Promise<string | null> {
  if (!(await hasFfmpeg())) return null;
  try {
    return (await import("ffmpeg-static")).default as string;
  } catch {
    return null;
  }
}

/** Public accessor for the discovered browser executable path (or null). */
export async function getBrowserPath(): Promise<string | null> {
  return findBrowserExecutable();
}

async function findBrowserExecutable(): Promise<string | null> {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ];
  const fs = await import("node:fs");
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function hasNodeSqlite(): Promise<boolean> {
  try {
    const m = await import("node:sqlite");
    return !!m.DatabaseSync;
  } catch {
    return false;
  }
}
