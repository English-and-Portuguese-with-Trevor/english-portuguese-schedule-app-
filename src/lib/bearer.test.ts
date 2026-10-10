import { describe, expect, it } from "vitest";

import { hasBearer } from "./bearer";

const withAuth = (value?: string) =>
  new Request("https://schedule.test/api/cron/daily", { headers: value === undefined ? {} : { authorization: value } });

describe("hasBearer", () => {
  it("accepts exactly Bearer <secret>", () => {
    expect(hasBearer(withAuth("Bearer s3cret"), "s3cret")).toBe(true);
  });

  it("refuses a wrong, shorter, longer or missing token, and an unset secret", () => {
    expect(hasBearer(withAuth("Bearer s3cres"), "s3cret")).toBe(false);
    expect(hasBearer(withAuth("Bearer s3cre"), "s3cret")).toBe(false);
    expect(hasBearer(withAuth("Bearer s3cret1"), "s3cret")).toBe(false);
    expect(hasBearer(withAuth("s3cret"), "s3cret")).toBe(false);
    expect(hasBearer(withAuth(), "s3cret")).toBe(false);
    expect(hasBearer(withAuth("Bearer "), "")).toBe(false);
    expect(hasBearer(withAuth("Bearer s3cret"), undefined)).toBe(false);
  });
});
