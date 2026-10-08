import { timingSafeEqual } from "node:crypto";

export function isAuthorized(
  headers: {
    host?: string | undefined;
    origin?: string | undefined;
    cookie?: string | undefined;
  },
  method: string,
  origin: string,
  token: string,
): boolean {
  if (headers.host !== new URL(origin).host) return false;
  if (headers.origin && headers.origin !== origin) return false;
  if (!["GET", "HEAD"].includes(method) && headers.origin !== origin)
    return false;
  const cookies = (headers.cookie ?? "").split(";").map((part) => part.trim());
  const actual = cookies
    .find((part) => part.startsWith("momo_session="))
    ?.slice(13);
  if (!actual || actual.length !== token.length) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
