import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

import { proxy } from "./proxy";

const request = (path: string) => new NextRequest(new URL(path, "https://schedule.example.com"));

afterEach(() => {
  vi.unstubAllEnvs();
  getUser.mockReset();
});

describe("proxy", () => {
  it("keeps the query string in the login redirect", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await proxy(request("/admin/calendar?view=week"));
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("redirect")).toBe("/admin/calendar?view=week");
  });

  it("shows the maintenance page with a 503", async () => {
    vi.stubEnv("MAINTENANCE_MODE", "on");
    const res = await proxy(request("/dashboard"));
    expect(res.status).toBe(503);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/maintenance");
  });

  it.each(["/api/cron/daily", "/api/cron/flags", "/api/alerts/push"])(
    "lets %s through during maintenance",
    async (path) => {
      vi.stubEnv("MAINTENANCE_MODE", "on");
      getUser.mockResolvedValue({ data: { user: null } });
      const res = await proxy(request(path));
      expect(res.status).not.toBe(503);
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    },
  );
});
