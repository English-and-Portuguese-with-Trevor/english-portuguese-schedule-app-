import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc: async () => ({ error: null }) }) }));

import { makeErrorReporter } from "@/lib/error-report";

function setup(rpc = vi.fn(async () => ({ error: null }))) {
  const target = { location: { href: "https://schedule.test/dashboard" }, navigator: { userAgent: "TestBrowser" } } as unknown as Window;
  return { report: makeErrorReporter("schedule", () => ({ rpc }), target), rpc };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("makeErrorReporter", () => {
  it("sends an error with the site, stack, address and browser", async () => {
    const { report, rpc } = setup();
    const error = new Error("boom");
    report(error);
    await flush();
    expect(rpc).toHaveBeenCalledWith("report_client_error", {
      p_site: "schedule",
      p_message: "boom",
      p_stack: error.stack,
      p_url: "https://schedule.test/dashboard",
      p_user_agent: "TestBrowser",
    });
  });

  it("sends plain rejected values and the event's message when there's no error", async () => {
    const { report, rpc } = setup();
    report("nope");
    report(null, "Script error.");
    await flush();
    expect(rpc.mock.calls.map((call) => (call as unknown[])[1])).toMatchObject([{ p_message: "nope" }, { p_message: "Script error." }]);
  });

  it("sends each message once and at most five a page load", async () => {
    const { report, rpc } = setup();
    report(new Error("same"));
    report(new Error("same"));
    for (let i = 0; i < 10; i++) report(new Error(`error ${i}`));
    await flush();
    expect(rpc).toHaveBeenCalledTimes(5);
  });

  it("ignores a missing RPC or a failing client", async () => {
    const { report } = setup(vi.fn(() => {
      throw new Error("no function");
    }));
    expect(() => report(new Error("a"))).not.toThrow();
    const failing = makeErrorReporter("schedule", () => Promise.reject(new Error("offline")), {} as Window);
    expect(() => failing(new Error("b"))).not.toThrow();
    await flush();
  });
});
