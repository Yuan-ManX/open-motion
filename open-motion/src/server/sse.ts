import type { Response } from "express";
import type { ChatEvent } from "@openmotion/shared";

/** Initialize an SSE response and return a writer that is safe after close. */
export function initSse(res: Response): {
  send: (event: ChatEvent) => void;
  done: () => void;
  closed: () => boolean;
} {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  let isClosed = false;
  res.on("close", () => {
    isClosed = true;
  });

  const send = (event: ChatEvent) => {
    if (isClosed || res.writableEnded) return;
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const done = () => {
    if (isClosed || res.writableEnded) return;
    res.end();
  };
  return { send, done, closed: () => isClosed };
}
