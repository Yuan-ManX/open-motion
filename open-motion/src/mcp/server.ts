import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMcpTools } from "./tools.js";

/** Create a fresh MCP server with every OpenMotion tool registered. */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "openmotion", version: "0.1.0" },
    { instructions: "OpenMotion motion-design tools. Create projects in the web UI, then drive them from here." },
  );
  registerMcpTools(server as unknown as Parameters<typeof registerMcpTools>[0]);
  return server;
}
