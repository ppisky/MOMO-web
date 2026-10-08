import {
  streamEventSchema,
  type ConversationEngine,
  type StreamEvent,
} from "../../../shared/contracts/chat";

export async function* decodeEventStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (!frame.startsWith("data: ")) continue;
        const event = streamEventSchema.parse(JSON.parse(frame.slice(6)));
        if (event.type === "finish") finished = true;
        yield event;
      }
      if (done) break;
    }
    if (!finished) throw new Error("回复意外中断，请重试。");
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export const httpEngine: ConversationEngine = {
  id: "demo-http",
  async *stream(request, signal) {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok || !response.body)
      throw new Error("暂时无法连接，请稍后重试。");
    yield* decodeEventStream(response.body);
  },
};
