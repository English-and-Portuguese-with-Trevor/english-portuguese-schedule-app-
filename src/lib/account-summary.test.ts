import { describe, expect, it } from "vitest";

import { accessSummary, hasSubscription } from "@/lib/account-summary";

const sub = {
  status: "active",
  current_period_end: "2026-10-27T12:00:00Z",
  cancel_at_period_end: false,
  subscription_id: "sub_1",
};

describe("accessSummary", () => {
  it("describes each kind of access", () => {
    expect(accessSummary("admin", "granted", null)).toMatch(/Admin/);
    expect(accessSummary("student", "lifetime", null)).toMatch(
      /Lifetime access/,
    );
    expect(accessSummary("student", "granted", null)).toMatch(
      /Student access from Trevor/,
    );
    expect(accessSummary("student", "none", null)).toMatch(/Free lessons/);
  });

  it("gives subscribers their renewal or end date", () => {
    expect(accessSummary("student", "subscriber", sub)).toBe(
      "Subscriber: every Portuguese lesson is open. Renews on October 27, 2026.",
    );
    expect(
      accessSummary("student", "subscriber", {
        ...sub,
        cancel_at_period_end: true,
      }),
    ).toMatch(/Canceled; your lessons stay open until October 27, 2026/);
    expect(
      accessSummary("student", "subscriber", { ...sub, status: "past_due" }),
    ).toMatch(/update your card/);
  });

  it("knows when there is a subscription to manage", () => {
    expect(hasSubscription(sub)).toBe(true);
    expect(hasSubscription(null)).toBe(false);
  });

  it("writes the summary and dates in the site language", () => {
    expect(accessSummary("student", "subscriber", sub, "pt")).toBe(
      "Assinante: todas as aulas de português estão liberadas. Renova em 27 de outubro de 2026.",
    );
  });
});
