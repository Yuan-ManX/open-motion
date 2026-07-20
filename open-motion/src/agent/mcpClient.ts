/**
 * Inbound MCP client registry — lets the OpenMotion Agent call tools on
 * external MCP servers (stdio or Streamable HTTP).
 *
 * The outbound direction (OpenMotion tools exposed to MCP clients) lives in
 * src/mcp/server.ts + src/mcp/tools.ts. This module is the symmetric inbound
 * half: it connects OpenMotion-as-client to one or more external MCP servers
 * and exposes their tools to the orchestrator through a uniform interface.
 *
 * Design notes:
 * - Connections are project-scoped but share a single registry. Each connected
 *   server is identified by a stable serverId chosen by the caller.
 * - The registry is in-memory — connections are not persisted across server
 *   restarts. Long-lived servers re-register on boot via the REST API.
 * - All calls are guarded with timeouts and structured logging so a wedged
 *   external server can never block the orchestrator.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { logger } from "../utils/logger.js";

export type ExternalTransport = "stdio" | "http";

export interface StdioServerConfig {
  transport: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface HttpServerConfig {
  transport: "http";
  url: string;
  /** Optional request init passed to the Streamable HTTP transport. */
  requestInit?: RequestInit;
  /** Optional session id for resuming an existing server session. */
  sessionId?: string;
}

export type ExternalServerConfig = StdioServerConfig | HttpServerConfig;

export interface ExternalToolDescriptor {
  serverId: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface ExternalCallResult {
  ok: boolean;
  content: Array<{ type: string; text?: string } & Record<string, unknown>>;
  isError?: boolean;
  durationMs: number;
  raw?: unknown;
}

interface RegistryEntry {
  serverId: string;
  config: ExternalServerConfig;
  client: Client;
  connectedAt: number;
  lastError?: string;
  toolCount: number;
}

const registry = new Map<string, RegistryEntry>();
const DEFAULT_CALL_TIMEOUT_MS = 30_000;

function makeClient(serverId: string): Client {
  return new Client(
    { name: "openmotion-agent", version: "0.1.0" },
    { capabilities: {} },
  );
}

function makeTransport(config: ExternalServerConfig): {
  transport: StdioClientTransport | StreamableHTTPClientTransport;
} {
  if (config.transport === "stdio") {
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
      cwd: config.cwd,
      stderr: "pipe",
    });
    return { transport };
  }
  const url = new URL(config.url);
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: config.requestInit,
    sessionId: config.sessionId,
  });
  return { transport };
}

/**
 * Connect to an external MCP server. If a server with the same id is already
 * registered, it is closed and replaced.
 */
export async function connectExternalServer(
  serverId: string,
  config: ExternalServerConfig,
): Promise<{
  serverId: string;
  transport: ExternalTransport;
  serverName?: string;
  serverVersion?: string;
  toolCount: number;
}> {
  await disconnectExternalServer(serverId).catch(() => undefined);

  const client = makeClient(serverId);
  const { transport } = makeTransport(config);

  try {
    await client.connect(transport);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("external mcp connect failed", { serverId, error: msg });
    throw new Error(`failed to connect external MCP server "${serverId}": ${msg}`);
  }

  let toolCount = 0;
  try {
    const list = await client.listTools();
    toolCount = list.tools.length;
  } catch (err) {
    logger.warn("external mcp listTools failed", {
      serverId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const entry: RegistryEntry = {
    serverId,
    config,
    client,
    connectedAt: Date.now(),
    toolCount,
  };
  registry.set(serverId, entry);

  const serverInfo = client.getServerVersion();
  logger.info("external mcp server connected", {
    serverId,
    transport: config.transport,
    toolCount,
    serverName: serverInfo?.name,
    serverVersion: serverInfo?.version,
  });

  return {
    serverId,
    transport: config.transport,
    serverName: serverInfo?.name,
    serverVersion: serverInfo?.version,
    toolCount,
  };
}

/** Disconnect a single external server by id. No-op if not registered. */
export async function disconnectExternalServer(serverId: string): Promise<void> {
  const entry = registry.get(serverId);
  if (!entry) return;
  registry.delete(serverId);
  try {
    await entry.client.close();
    logger.info("external mcp server disconnected", { serverId });
  } catch (err) {
    logger.warn("external mcp disconnect error", {
      serverId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Disconnect every registered external server. Used on graceful shutdown. */
export async function disconnectAllExternalServers(): Promise<void> {
  const ids = [...registry.keys()];
  await Promise.allSettled(ids.map((id) => disconnectExternalServer(id)));
}

/** List all currently registered external servers with their metadata. */
export function listExternalServers(): Array<{
  serverId: string;
  transport: ExternalTransport;
  connectedAt: number;
  toolCount: number;
  lastError?: string;
  serverName?: string;
  serverVersion?: string;
}> {
  return [...registry.values()].map((entry) => ({
    serverId: entry.serverId,
    transport: entry.config.transport,
    connectedAt: entry.connectedAt,
    toolCount: entry.toolCount,
    lastError: entry.lastError,
    serverName: entry.client.getServerVersion()?.name,
    serverVersion: entry.client.getServerVersion()?.version,
  }));
}

/**
 * Aggregate every tool from every connected external server. Names are
 * namespaced as `${serverId}__${toolName}` so the orchestrator can route
 * calls unambiguously.
 */
export async function listExternalMcpTools(): Promise<ExternalToolDescriptor[]> {
  const out: ExternalToolDescriptor[] = [];
  for (const entry of registry.values()) {
    try {
      const list = await entry.client.listTools();
      for (const tool of list.tools) {
        out.push({
          serverId: entry.serverId,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema as Record<string, unknown>,
        });
      }
    } catch (err) {
      entry.lastError = err instanceof Error ? err.message : String(err);
      logger.warn("external mcp listTools failed during aggregate", {
        serverId: entry.serverId,
        error: entry.lastError,
      });
    }
  }
  return out;
}

/**
 * Call a tool on a specific external server. Resolves with the structured
 * content returned by the server. Network/process failures are converted into
 * a synthetic error result rather than throwing.
 */
export async function callExternalMcpTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs = DEFAULT_CALL_TIMEOUT_MS,
): Promise<ExternalCallResult> {
  const entry = registry.get(serverId);
  if (!entry) {
    return {
      ok: false,
      content: [{ type: "text", text: `external server "${serverId}" is not connected` }],
      isError: true,
      durationMs: 0,
    };
  }

  const start = Date.now();
  const timeout = new Promise<{ ok: false; content: never[]; isError: true }>((resolve) => {
    setTimeout(() => {
      resolve({
        ok: false,
        content: [],
        isError: true,
      } as never);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      entry.client.callTool({ name: toolName, arguments: args }),
      timeout,
    ]) as Awaited<ReturnType<typeof entry.client.callTool>> | { ok: false; isError: true; content: never[] };

    const durationMs = Date.now() - start;
    if ("ok" in result && result.ok === false) {
      entry.lastError = `call timeout after ${timeoutMs}ms`;
      return {
        ok: false,
        content: [{ type: "text", text: entry.lastError }],
        isError: true,
        durationMs,
      };
    }

    const content = (result.content ?? []) as Array<{ type: string; text?: string } & Record<string, unknown>>;
    const isError = Boolean(result.isError);
    return {
      ok: !isError,
      content,
      isError,
      durationMs,
      raw: result,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    entry.lastError = msg;
    logger.warn("external mcp callTool failed", {
      serverId,
      toolName,
      error: msg,
    });
    return {
      ok: false,
      content: [{ type: "text", text: msg }],
      isError: true,
      durationMs,
    };
  }
}

/**
 * Route a namespaced tool call (e.g. "filesystem__read_file") to the right
 * external server. Returns null if the name is not namespaced, so the
 * orchestrator can fall through to the local tool registry.
 */
export async function routeNamespacedExternalCall(
  namespacedName: string,
  args: Record<string, unknown>,
  timeoutMs?: number,
): Promise<ExternalCallResult | null> {
  const sep = "__";
  const idx = namespacedName.indexOf(sep);
  if (idx <= 0) return null;
  const serverId = namespacedName.slice(0, idx);
  const toolName = namespacedName.slice(idx + sep.length);
  if (!registry.has(serverId)) return null;
  return callExternalMcpTool(serverId, toolName, args, timeoutMs);
}

/** True when an external server with the given id is currently connected. */
export function isExternalServerConnected(serverId: string): boolean {
  return registry.has(serverId);
}

/**
 * Produce a tool description block (for inclusion in the orchestrator's tool
 * spec list) for every external tool. The orchestrator treats them exactly
 * like native tools but routes execution through routeNamespacedExternalCall.
 */
export async function describeExternalToolsForOrchestrator(): Promise<
  Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    source: "external-mcp";
  }>
> {
  const tools = await listExternalMcpTools();
  return tools.map((t) => ({
    name: `${t.serverId}__${t.name}`,
    description: t.description
      ? `[external:${t.serverId}] ${t.description}`
      : `[external:${t.serverId}] ${t.name}`,
    inputSchema: t.inputSchema,
    source: "external-mcp",
  }));
}
