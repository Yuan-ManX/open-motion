import type { Response } from "express";
import type { ChatEvent } from "@openmotion/shared";

/** Initialize an SSE response and return a writer + close handler registration. */
export function initSse(res: Response): {
  send: (event: ChatEvent) => void;
  done: () => void;
} {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const send = (event: ChatEvent) => {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const done = () => {
    res.end();
  };
  return { send, done };
}
