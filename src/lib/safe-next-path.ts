/**
 * Where to send someone after login. Only paths on this site are allowed:
 * "@evil.com" or "//evil.com" would otherwise turn `${origin}${next}` into a
 * link to another site.
 */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/dashboard";
  }
  return next;
}
