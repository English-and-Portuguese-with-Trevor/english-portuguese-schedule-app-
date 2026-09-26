import { describe, expect, it } from "vitest";

import { authCookieOptions } from "./cookie-options";

describe("authCookieOptions", () => {
  it("shares the login cookie with the other sites on the domain", () => {
    expect(authCookieOptions("schedule.englishandportuguesewithtrevor.com", true)).toEqual({
      name: "ept-auth",
      domain: "englishandportuguesewithtrevor.com",
      secure: true,
    });
  });

  it("ignores a port and keeps the cookie on the host elsewhere", () => {
    expect(authCookieOptions("localhost:3000", false)).toEqual({ name: "ept-auth", secure: false });
    expect(authCookieOptions("my-app.vercel.app", true).domain).toBeUndefined();
  });
});
