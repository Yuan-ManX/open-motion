type Level = "debug" | "info" | "warn" | "error";
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const current = (process.env.LOG_LEVEL as Level) || "info";

function log(level: Level, msg: string, meta?: unknown) {
  if (LEVELS[level] < LEVELS[current as Level]) return;
  const ts = new Date().toISOString();
  const line = meta ? `${ts} [${level}] ${msg} ${safe(meta)}` : `${ts} [${level}] ${msg}`;
  const out = level === "error" || level === "warn" ? process.stderr : process.stdout;
  out.write(line + "\n");
}
const safe = (m: unknown) => {
  try {
    return typeof m === "string" ? m : JSON.stringify(m);
  } catch {
    return String(m);
  }
};

export const logger = {
  debug: (m: string, meta?: unknown) => log("debug", m, meta),
  info: (m: string, meta?: unknown) => log("info", m, meta),
  warn: (m: string, meta?: unknown) => log("warn", m, meta),
  error: (m: string, meta?: unknown) => log("error", m, meta),
};
