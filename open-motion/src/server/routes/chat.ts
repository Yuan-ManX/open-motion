import { Router } from "express";
import { ChatRequestSchema, type ChatEvent } from "@openmotion/shared";
import { validate, validated } from "../middleware/validate.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { runAsync } from "../../utils/async.js";
import { config } from "../../config.js";
import { chat, chatStream, listProjectMessages, clearProjectMessages } from "../services/chatService.js";
import { initSse } from "../sse.js";

export const chatRouter = Router();

const chatRateLimit = createRateLimiter(config.CHAT_RATE_LIMIT_MAX, config.RATE_LIMIT_WINDOW_MS);

chatRouter.post(
  "/projects/:id/chat",
  chatRateLimit,
  validate(ChatRequestSchema),
  runAsync(async (req, res) => {
    const { message, model } = validated<{ message: string; model?: string }>(req);
    const projectId = req.params.id;
    const wantsStream = req.query.stream !== "false";

    if (!wantsStream) {
      const result = await chat(projectId, message, undefined, model);
      res.json(result);
      return;
    }

    const sse = initSse(res);
    try {
      await chatStream(
        projectId,
        message,
        (providerName) => sse.send({ type: "meta", provider: providerName as "mock" | "openai" }),
        (event: ChatEvent) => {
          if (event.type === "done" || event.type === "error") {
            sse.send(event);
            sse.done();
          } else {
            sse.send(event);
          }
        },
        model,
      );
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
    res.json(listProjectMessages(req.params.id));
  }),
);

chatRouter.delete(
  "/projects/:id/messages",
  runAsync(async (req, res) => {
    clearProjectMessages(req.params.id);
    res.status(204).end();
  }),
);
