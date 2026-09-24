import { describe, expect, it } from "vitest";

import { buildDisplayNames } from "@/lib/display-names";

function profile(id: string, full_name: string | null, created_at: string, email: string | null = null) {
  return { id, full_name, email, created_at };
}

describe("buildDisplayNames", () => {
  it("shortens to first name and last initial", () => {
    expect(buildDisplayNames([profile("a", "Jimmy Hart", "2026-01-01")])).toEqual({ a: "Jimmy H." });
  });

  it("uses the last word of a multi-part name for the initial", () => {
    expect(buildDisplayNames([profile("a", "Ana Maria de Souza", "2026-01-01")])).toEqual({ a: "Ana S." });
  });

  it("numbers everyone who shares a short name, in signup order", () => {
    const names = buildDisplayNames([
      profile("later", "Trevor Lister", "2026-09-24T11:00:00Z"),
      profile("earlier", "Trevor Lister", "2026-09-24T01:00:00Z"),
      profile("other", "Tom Lee", "2026-09-24T12:00:00Z"),
    ]);
    expect(names).toEqual({ earlier: "Trevor L. 1", later: "Trevor L. 2", other: "Tom L." });
  });

  it("treats names differing only in case as the same person name", () => {
    const names = buildDisplayNames([
      profile("a", "jimmy hart", "2026-01-01"),
      profile("b", "Jimmy Hart", "2026-01-02"),
    ]);
    expect(names).toEqual({ a: "jimmy H. 1", b: "Jimmy H. 2" });
  });

  it("keeps a single-word name as is", () => {
    expect(buildDisplayNames([profile("a", "Cher", "2026-01-01")])).toEqual({ a: "Cher" });
  });

  it("falls back to the email's local part, then to Unknown", () => {
    const names = buildDisplayNames([
      profile("a", null, "2026-01-01", "student@example.com"),
      profile("b", "   ", "2026-01-02"),
    ]);
    expect(names).toEqual({ a: "student", b: "Unknown" });
  });
});
