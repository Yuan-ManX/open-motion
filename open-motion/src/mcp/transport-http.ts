import type { Express } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "../utils/logger.js";
import { createMcpServer } from "./server.js";

/**
 * Mount the MCP Streamable HTTP transport onto an Express app.
 *
 * Runs in stateless mode: each request spins up a fresh transport + server
 * pair, which is simple and correct for OpenMotion's stateless tool surface
 * (tools operate on the shared SQLite store, not in-memory session state).
 */
export function mountMcpHttp(app: Express): void {
  app.post("/api/mcp", async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const server = createMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      logger.error("mcp http handler failed", { error: String(err) });
      if (!res.headersSent) {
        res.status(500).json({ error: "mcp handler failed" });
      }
    }
  });

  app.get("/api/mcp", (_req, res) => {
    res.status(405).json({ error: "Use POST for MCP Streamable HTTP (stateless mode)." });
  });

  app.delete("/api/mcp", (_req, res) => {
    res.status(405).json({ error: "Stateless MCP mode — no session to delete." });
  });

  logger.info("MCP HTTP transport mounted at /api/mcp");
}
