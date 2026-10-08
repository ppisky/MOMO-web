import type { ActionFunctionArgs } from "@remix-run/node";
import { chatRequestSchema } from "../../shared/contracts/chat";
import { demoEngine } from "../services/demo-engine.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return new Response("Forbidden", { status: 403 });
  const raw = await request.text();
  if (raw.length > 100000)
    return new Response("Request too large", { status: 413 });
  let input;
  try {
    input = chatRequestSchema.safeParse(JSON.parse(raw));
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!input.success) return new Response("Invalid request", { status: 400 });
  const abort = new AbortController();
  const cancel = () => abort.abort();
  request.signal.addEventListener("abort", cancel, { once: true });
  if (request.signal.aborted) cancel();
  const events = demoEngine.stream(input.data, abort.signal);
  const iterator = events[Symbol.asyncIterator]();
  const encoder = new TextEncoder();
  const cleanup = () => request.signal.removeEventListener("abort", cancel);
  return new Response(
    new ReadableStream({
      async pull(controller) {
        try {
          const next = await iterator.next();
          if (next.done) {
            cleanup();
            controller.close();
          } else
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(next.value)}\n\n`),
            );
        } catch {
          cleanup();
          controller.error(new Error("Stream failed"));
        }
      },
      async cancel() {
        abort.abort();
        cleanup();
        await iterator.return?.();
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    },
  );
}
