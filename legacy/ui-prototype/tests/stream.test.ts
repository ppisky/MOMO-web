import { describe, expect, it } from "vitest";
import { decodeEventStream } from "../app/features/chat/http-engine";
import { demoEngine } from "../app/services/demo-engine.server";
import { action } from "../app/routes/api.chat";

const encoder = new TextEncoder();
const input = { messages: [{ role: "user" as const, text: "本周计划" }] };
function byteStream(value: string, step: number) {
  const bytes = encoder.encode(value);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += step)
        controller.enqueue(bytes.slice(i, i + step));
      controller.close();
    },
  });
}
async function collect<T>(iterator: AsyncIterable<T>) {
  const values: T[] = [];
  for await (const value of iterator) values.push(value);
  return values;
}
function request(body: string, origin = "http://127.0.0.1:5173") {
  return new Request("http://127.0.0.1:5173/api/chat", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body,
  });
}

describe("stream boundary", () => {
  it("preserves Chinese characters split across individual UTF-8 bytes", async () => {
    const result = await collect(
      decodeEventStream(
        byteStream(
          'data: {"type":"text-delta","text":"你好，世界"}\n\ndata: {"type":"finish"}\n\n',
          1,
        ),
      ),
    );
    expect(result).toEqual([
      { type: "text-delta", text: "你好，世界" },
      { type: "finish" },
    ]);
  });
  it("rejects truncated streams instead of reporting a completed reply", async () => {
    await expect(
      collect(
        decodeEventStream(
          byteStream('data: {"type":"text-delta","text":"partial"}\n\n', 3),
        ),
      ),
    ).rejects.toThrow("中断");
  });
  it("validates untrusted event payloads", async () => {
    await expect(
      collect(
        decodeEventStream(
          byteStream('data: {"type":"text-delta","text":42}\n\n', 99),
        ),
      ),
    ).rejects.toThrow();
  });
  it("stops the provider after cancellation", async () => {
    const abort = new AbortController();
    const events = demoEngine.stream(input, abort.signal);
    const generator = events[Symbol.asyncIterator]();
    expect((await generator.next()).done).toBe(false);
    abort.abort();
    expect((await generator.next()).done).toBe(true);
  });
  it("does not produce output for a pre-aborted request", async () => {
    const abort = new AbortController();
    abort.abort();
    expect(await collect(demoEngine.stream(input, abort.signal))).toEqual([]);
  });
});

describe("Remix chat route", () => {
  it("rejects cross-origin requests", async () => {
    const response = await action({
      request: request(JSON.stringify(input), "https://example.com"),
      params: {},
      context: {},
    });
    expect(response.status).toBe(403);
  });
  it.each([
    "invalid-json",
    '{"messages":[]}',
    '{"messages":[{"role":"tool","text":"bad"}]}',
  ])("rejects invalid input: %s", async (body) => {
    const response = await action({
      request: request(body),
      params: {},
      context: {},
    });
    expect(response.status).toBe(400);
  });
  it("rejects oversized input", async () => {
    const response = await action({
      request: request("x".repeat(100001)),
      params: {},
      context: {},
    });
    expect(response.status).toBe(413);
  });
  it("streams a complete reply using the client protocol", async () => {
    const response = await action({
      request: request(JSON.stringify(input)),
      params: {},
      context: {},
    });
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    if (!response.body) throw new Error("Missing response body");
    const events = await collect(decodeEventStream(response.body));
    expect(events.at(-1)).toEqual({ type: "finish" });
    expect(
      events
        .filter((event) => event.type === "text-delta")
        .map((event) => event.text)
        .join(""),
    ).toContain("本周计划");
  });
});
