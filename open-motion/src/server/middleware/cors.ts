import cors from "cors";
import { config } from "../../config.js";

/** Origin allowlist driven by CORS_ORIGIN env (comma-separated). Defaults to localhost:4000. */
export const corsMiddleware = cors({
  origin: (origin, cb) => {
    const raw = config.CORS_ORIGIN ?? "http://localhost:4000";
    if (raw === "*") return cb(null, true);
    const allowlist = raw.split(",").map((s) => s.trim());
    if (!origin || allowlist.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
});
