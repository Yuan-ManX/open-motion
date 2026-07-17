import express, { type Express } from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
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
import { agentRouter } from "./routes/agent.js";
import { versionsRouter } from "./routes/versions.js";
import { tokensRouter } from "./routes/tokens.js";
import { pipelinesRouter } from "./routes/pipelines.js";
import { insightsRouter } from "./routes/insights.js";
import { catalogRouter } from "./routes/catalog.js";
import { motionRouter } from "./routes/motion.js";
import { providersRouter } from "./routes/providers.js";
import { mountMcpHttp } from "../mcp/transport-http.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Dev: src/server/ → ../../../web/dist ; Prod: dist/src/server/ → ../../../../web/dist
const webDistPath =
  [path.resolve(__dirname, "../../../web/dist"), path.resolve(__dirname, "../../../../web/dist")].find((p) =>
    fs.existsSync(p),
  ) ?? path.resolve(__dirname, "../../../web/dist");

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
  app.use("/api", agentRouter);
  app.use("/api", versionsRouter);
  app.use("/api", tokensRouter);
  app.use("/api", pipelinesRouter);
  app.use("/api", insightsRouter);
  app.use("/api", catalogRouter);
  app.use("/api", motionRouter);
  app.use("/api", providersRouter);

  mountMcpHttp(app);

  if (fs.existsSync(webDistPath)) {
    app.use(express.static(webDistPath));
    app.get(/^(?!\/api|\/mcp).*/, (_req, res) => {
      res.sendFile(path.join(webDistPath, "index.html"));
    });
  }

  app.use(notFound());
  app.use(errorMiddleware);
  return app;
}
