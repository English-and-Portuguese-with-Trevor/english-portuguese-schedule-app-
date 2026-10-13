import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  sendEmail: vi.fn<(email: { to: string; subject: string; html: string; text: string }) => Promise<void>>(async () => {}),
  isGoogleConfigured: vi.fn(() => true),
}));
vi.mock("@/lib/google", () => ({
  isGoogleConfigured: mocks.isGoogleConfigured,
  sendEmail: mocks.sendEmail,
  LESSON_TIMEZONE: "America/Denver",
}));
vi.mock("@/lib/integration-status", () => ({
  createServerJobClient: () => ({ rpc: mocks.rpc }),
  recordGoogleStatus: async () => {},
}));

import { emails } from "@/lib/notifications";
import { sendWelcomes } from "@/lib/welcome";

const ana = { id: "u1", full_name: "Ana Pereira", email: "ana@example.com" };
const bo = { id: "u2", full_name: null, email: "bo@example.com" };

beforeEach(() => {
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});

afterEach(() => vi.clearAllMocks());

describe("emails.welcome", () => {
  it("is a branded email with what's free, the app and booking", () => {
    const email = emails.welcome(ana)!;
    expect(email).toMatchObject({ to: "ana@example.com", subject: "Welcome to English & Portuguese With Trevor" });
    expect(email.text).toContain("Welcome, Ana!");
    expect(email.text).toContain("The first five lessons in Portuguese and in English");
    expect(email.text).toContain("Three free games every day");
    expect(email.html).not.toContain("/placement/");
    expect(email.html).toContain('href="https://englishandportuguesewithtrevor.com/?install=1"');
    expect(email.html).toContain('href="https://schedule.englishandportuguesewithtrevor.com/dashboard"');
    expect(email.html).toContain("Portuguese With Trevor");
    expect(emails.welcome(bo)!.text).toContain("Welcome, there!");
    expect(emails.welcome({ full_name: "No Email", email: null })).toBeNull();
  });
});

describe("sendWelcomes", () => {
  it("emails each account it claimed, once", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: [ana, bo], error: null });
    expect(await sendWelcomes("s3cret")).toBe(2);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_welcome_emails", { p_secret: "s3cret" });
    expect(mocks.sendEmail.mock.calls.map(([e]) => e.to)).toEqual(["ana@example.com", "bo@example.com"]);
    expect(mocks.rpc).not.toHaveBeenCalledWith("unclaim_welcome_emails", expect.anything());
  });

  it("hands back the accounts whose email failed, for the next call", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValueOnce({ data: [ana, bo], error: null });
    mocks.sendEmail.mockRejectedValueOnce(new Error("Gmail is down"));
    expect(await sendWelcomes("s3cret")).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledWith("unclaim_welcome_emails", { p_secret: "s3cret", p_ids: ["u1"] });
  });

  it("claims nothing while Gmail isn't set up", async () => {
    mocks.isGoogleConfigured.mockReturnValueOnce(false);
    expect(await sendWelcomes("s3cret")).toBe(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
