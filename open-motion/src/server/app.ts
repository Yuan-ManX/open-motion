import express, { type Express } from "express";
import { corsMiddleware } from "./middleware/cors.js";
import { errorMiddleware, notFound } from "./middleware/error.js";
import { authMiddleware } from "./middleware/auth.js";
import { createRateLimiter } from "./middleware/rateLimit.js";
import { requestLog } from "./middleware/requestLog.js";
import { config } from "../config.js";
import { healthRouter } from "./routes/health.js";
import { templatesRouter } from "./routes/templates.js";
import { projectsRouter } from "./routes/projects.js";
import { componentsRouter } from "./routes/components.js";
import { chatRouter } from "./routes/chat.js";
import { skillsRouter } from "./routes/skills.js";
import { previewRouter } from "./routes/preview.js";
import { exportRouter } from "./routes/export.js";
import { mountMcpHttp } from "../mcp/transport-http.js";

/**
 * Assemble the Express application. Kept in one place so the HTTP server and the
 * MCP streamable-http transport can share the same route surface.
 */
export function createApp(): Express {
  const app = express();
  app.use(corsMiddleware);
  app.use(requestLog);
  app.use(express.json({ limit: "4mb" }));
  app.use(authMiddleware);

  const globalRateLimit = createRateLimiter(config.RATE_LIMIT_MAX, config.RATE_LIMIT_WINDOW_MS);
  app.use(globalRateLimit);

  app.use("/api", healthRouter);
  app.use("/api", templatesRouter);
  app.use("/api", projectsRouter);
  app.use("/api/projects/:id/components", componentsRouter);
  app.use("/api", chatRouter);
  app.use("/api", skillsRouter);
  app.use("/api", previewRouter);
  app.use("/api", exportRouter);

  mountMcpHttp(app);

  app.use(notFound());
  app.use(errorMiddleware);
  return app;
}
