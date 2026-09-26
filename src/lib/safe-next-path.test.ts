import { describe, expect, it } from "vitest";

import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/admin/bookings")).toBe("/admin/bookings");
    expect(safeNextPath(null)).toBe("/dashboard");
  });

  it("refuses anything that would leave the site", () => {
    for (const next of ["@evil.com", "//evil.com", "/\\evil.com", "https://evil.com", "evil.com"]) {
      expect(safeNextPath(next)).toBe("/dashboard");
    }
  });
});
