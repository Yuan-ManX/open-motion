import type { ChatEvent } from "@openmotion/shared";
import { authHeaders } from "./auth.js";

/**
 * Stream a chat request over SSE. Parses the text/event-stream frames and
 * dispatches typed events. Returns an AbortController so the caller can cancel.
 * The selected model (if any) is forwarded so the backend router can honour
 * the user's choice from the model picker.
 */
export function streamChat(
  projectId: string,
  message: string,
  onEvent: (event: ChatEvent) => void,
  onError?: (err: Error) => void,
): AbortController {
  const controller = new AbortController();

  (async () => {
    let model: string | undefined;
    try {
      model = localStorage.getItem("openmotion.selectedModel") ?? undefined;
    } catch {
      /* localStorage unavailable */
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message, model }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        if (res.status === 401) {
          throw new Error("unauthorized — set your OPENMOTION_API_KEY to access the backend");
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
