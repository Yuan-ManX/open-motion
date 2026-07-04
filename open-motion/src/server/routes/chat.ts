import { Router } from "express";
import { ChatRequestSchema, type ChatEvent } from "@openmotion/shared";
import { HttpError } from "../middleware/error.js";
import { validate, validated } from "../middleware/validate.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { runAsync } from "../../utils/async.js";
import { config } from "../../config.js";
import { getProject, getProjectSpec } from "../../db/repositories/projects.js";
import { listMessages, clearMessages, addMessage } from "../../db/repositories/messages.js";
import { clearMemory } from "../../agent/memory/store.js";
import { orchestrate } from "../../agent/orchestrator.js";
import { getProvider } from "../../agent/provider/index.js";
import { initSse } from "../sse.js";

export const chatRouter = Router();

const chatRateLimit = createRateLimiter(config.CHAT_RATE_LIMIT_MAX, config.RATE_LIMIT_WINDOW_MS);

chatRouter.post(
  "/projects/:id/chat",
  chatRateLimit,
  validate(ChatRequestSchema),
  runAsync(async (req, res) => {
    const projectId = req.params.id;
    const project = getProject(projectId);
    if (!project) throw new HttpError(404, "project not found");
    const { message } = validated<{ message: string }>(req);

    const provider = await getProvider();
    const wantsStream = req.query.stream !== "false";

    if (!wantsStream) {
      // Non-streaming: collect events into a single JSON payload.
      const collected = {
        provider: provider.name,
        text: "",
        toolCalls: [] as { tool: string; args: unknown; callId: string }[],
        toolResults: [] as { callId: string; tool: string; summary: string }[],
        tokensIn: 0,
        tokensOut: 0,
      };
      let finalMessage = "";
      let errored: string | null = null;

      await orchestrate({
        projectId,
        userMessage: message,
        provider,
        onEvent: (event: ChatEvent) => {
          switch (event.type) {
            case "token":
              collected.text += event.delta;
              break;
            case "tool_call":
              collected.toolCalls.push({ tool: event.tool, args: event.args, callId: event.callId });
              break;
            case "tool_result":
              collected.toolResults.push({ callId: event.callId, tool: event.tool, summary: event.summary });
              break;
            case "done":
              finalMessage = event.message;
              collected.tokensIn = event.tokensIn;
              collected.tokensOut = event.tokensOut;
              break;
            case "error":
              errored = event.message;
              break;
            default:
              break;
          }
        },
      });

      if (errored) throw new HttpError(500, errored);
      const spec = getProjectSpec(projectId);
      res.json({
        provider: collected.provider,
        message: finalMessage || collected.text,
        toolCalls: collected.toolCalls,
        toolResults: collected.toolResults,
        tokensIn: collected.tokensIn,
        tokensOut: collected.tokensOut,
        spec,
      });
      return;
    }

    const sse = initSse(res);
    sse.send({ type: "meta", provider: provider.name });

    try {
      await orchestrate({
        projectId,
        userMessage: message,
        provider,
        onEvent: (event) => {
          if (event.type === "done" || event.type === "error") {
            sse.send(event);
            sse.done();
          } else {
            sse.send(event);
          }
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!res.writableEnded) {
        sse.send({ type: "error", message: `internal error: ${msg}`, recoverable: true });
        sse.done();
      }
    }
  }),
);

chatRouter.get(
  "/projects/:id/messages",
  runAsync(async (req, res) => {
    if (!getProject(req.params.id)) throw new HttpError(404, "project not found");
    res.json(listMessages(req.params.id));
  }),
);

chatRouter.delete(
  "/projects/:id/messages",
  runAsync(async (req, res) => {
    if (!getProject(req.params.id)) throw new HttpError(404, "project not found");
    clearMessages(req.params.id);
    clearMemory(req.params.id);
    res.status(204).end();
  }),
);

// Re-export addMessage for completeness (used by tests/external callers).
export { addMessage };
