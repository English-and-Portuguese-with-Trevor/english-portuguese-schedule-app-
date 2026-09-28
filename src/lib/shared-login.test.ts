import { describe, expect, it } from "vitest";

import { sharedLoginUrl } from "@/lib/shared-login";

describe("sharedLoginUrl", () => {
  it("sends the live site to the shared login page, returning to the dashboard", () => {
    expect(
      sharedLoginUrl({
        hostname: "schedule.englishandportuguesewithtrevor.com",
        origin: "https://schedule.englishandportuguesewithtrevor.com",
      }),
    ).toBe(
      "https://englishandportuguesewithtrevor.com/login/?next=https%3A%2F%2Fschedule.englishandportuguesewithtrevor.com%2Fdashboard",
    );
  });

  it("sends people on to the page they were opening", () => {
    expect(
      sharedLoginUrl(
        {
          hostname: "schedule.englishandportuguesewithtrevor.com",
          origin: "https://schedule.englishandportuguesewithtrevor.com",
        },
        "/admin/bookings",
      ),
    ).toBe(
      "https://englishandportuguesewithtrevor.com/login/?next=https%3A%2F%2Fschedule.englishandportuguesewithtrevor.com%2Fadmin%2Fbookings",
    );
  });

  it("keeps the local Google button when running locally", () => {
    expect(sharedLoginUrl({ hostname: "localhost", origin: "http://localhost:3000" })).toBeNull();
  });
});
