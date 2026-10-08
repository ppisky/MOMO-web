import express from "express";
import { createRequestHandler } from "@remix-run/express";
import { resolve } from "node:path";
import { serviceStartSchema } from "../shared/contracts/desktop";
import { isAuthorized } from "./access";
// The Remix build is generated before this entry is bundled.
// @ts-expect-error Generated build is intentionally outside the source type graph.
import * as build from "../build/server/index.js";

process.parentPort.once("message", (event) => {
  const { token } = serviceStartSchema.parse(event.data);
  const app = express();
  app.disable("x-powered-by");
  let origin = "";
  app.use((req, res, next) => {
    if (!isAuthorized(req.headers, req.method, origin, token)) {
      res.status(403).end("Forbidden");
      return;
    }
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(
    express.static(resolve(__dirname, "../build/client"), { index: false }),
  );
  app.all("*", createRequestHandler({ build, mode: "production" }));
  const server = app.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Invalid listen address");
    origin = `http://127.0.0.1:${address.port}`;
    process.parentPort.postMessage({ type: "ready", port: address.port });
  });
  server.on("error", () => process.exit(1));
});
