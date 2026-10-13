import { describe, expect, it } from "vitest";

import { isClassStudent } from "@/lib/types";

describe("isClassStudent", () => {
  it("counts lesson access Trevor gave, or a class package", () => {
    expect(isClassStudent({ lesson_access: "granted", class_package: null })).toBe(true);
    expect(isClassStudent({ lesson_access: "lifetime", class_package: null })).toBe(true);
    expect(isClassStudent({ lesson_access: "none", class_package: 4 })).toBe(true);
  });

  it("leaves everyone else on 30-minute classes, lessons subscribers too", () => {
    expect(isClassStudent({ lesson_access: "none", class_package: null })).toBe(false);
    expect(isClassStudent({ lesson_access: "subscriber", class_package: null })).toBe(false);
  });
});
