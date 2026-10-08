import { PassThrough } from "node:stream";
import {
  createReadableStreamFromReadable,
  type EntryContext,
} from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { renderToPipeableStream } from "react-dom/server";

export default function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: EntryContext,
) {
  return new Promise<Response>((resolve, reject) => {
    const timer = setTimeout(() => stream.abort(), 5000);
    const stream = renderToPipeableStream(
      <RemixServer context={context} url={request.url} />,
      {
        onAllReady() {
          clearTimeout(timer);
          const body = new PassThrough();
          headers.set("Content-Type", "text/html; charset=utf-8");
          resolve(
            new Response(createReadableStreamFromReadable(body), {
              status,
              headers,
            }),
          );
          stream.pipe(body);
        },
        onShellError(error) {
          clearTimeout(timer);
          reject(error);
        },
        onError() {
          status = 500;
        },
      },
    );
  });
}
