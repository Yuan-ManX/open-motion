import type { ChatEvent } from "@openmotion/shared";
import { authHeaders } from "./auth.js";

/**
 * Stream a chat request over SSE. Parses the text/event-stream frames and
 * dispatches typed events. Returns an AbortController so the caller can cancel.
 */
export function streamChat(
  projectId: string,
  message: string,
  onEvent: (event: ChatEvent) => void,
  onError?: (err: Error) => void,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        if (res.status === 401) {
          throw new Error("unauthorized — set your API key via the 🔑 button in the toolbar");
        }
        throw new Error(`chat request failed: ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        buffer += text;
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const dataLine = frame.match(/^data:\s*(.*)$/m)?.[1];
          if (!dataLine) continue;
          try {
            const parsed = JSON.parse(dataLine) as ChatEvent;
            onEvent(parsed);
          } catch {
            /* skip malformed frame */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError?.(err as Error);
      }
    }
  })();

  return controller;
}
