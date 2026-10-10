import { timingSafeEqual } from "node:crypto";

/**
 * True when the request carries "Authorization: Bearer <secret>". The compare
 * takes the same time whatever the caller sent, so the secret can't be
 * guessed byte by byte from the response times.
 */
export function hasBearer(request: Request, secret: string | undefined): secret is string {
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
