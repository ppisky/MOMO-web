import { describe, expect, it } from "vitest";
import { isAuthorized } from "../server/access";
import {
  copyTextSchema,
  serviceReadySchema,
} from "../shared/contracts/desktop";

describe("desktop service boundary", () => {
  const origin = "http://127.0.0.1:48123";
  const token = "a".repeat(64);
  const headers = {
    host: "127.0.0.1:48123",
    origin,
    cookie: `momo_session=${token}`,
  };
  it("accepts the window session and ordinary asset requests", () => {
    expect(isAuthorized(headers, "POST", origin, token)).toBe(true);
    expect(
      isAuthorized({ ...headers, origin: undefined }, "GET", origin, token),
    ).toBe(true);
  });
  it.each([
    { cookie: undefined },
    { cookie: "momo_session=wrong" },
    { cookie: "momo_session=" + "é".repeat(64) },
    { host: "localhost:48123" },
    { origin: "https://example.com" },
    { origin: undefined },
  ])("rejects forged or missing request context %j", (override) => {
    expect(
      isAuthorized({ ...headers, ...override }, "POST", origin, token),
    ).toBe(false);
  });
  it("validates process messages and clipboard payloads", () => {
    expect(
      serviceReadySchema.safeParse({ type: "ready", port: 0 }).success,
    ).toBe(false);
    expect(copyTextSchema.safeParse({ text: "invalid" }).success).toBe(false);
    expect(copyTextSchema.safeParse("x".repeat(100001)).success).toBe(false);
  });
});
