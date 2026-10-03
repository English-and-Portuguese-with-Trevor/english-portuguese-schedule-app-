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

import { emails, longestStreak, type MonthlySummary } from "@/lib/notifications";
import { sendMonthlySummaries } from "@/lib/monthly-summary";

const catalog = [
  { id: "ar", title: "Regular -AR Verbs" },
  { id: "er", title: "Regular -ER Verbs" },
  { id: "possessives", title: "Possessivos" },
  { id: "estar-com-ficar", title: "Estar Com e Ficar" },
  { id: "hi", title: "Hi, I'm…", learning: "English" },
];

const ana: MonthlySummary = {
  id: "u1",
  full_name: "Ana Pereira",
  email: "ana@example.com",
  timezone: "America/Sao_Paulo",
  learning: "Portuguese",
  month: "2026-09-01",
  classes_taken: 4,
  class_package: 8,
  completed: 6,
  next_class: "2026-10-07T21:00:00Z",
  lessons_done: ["ar", "er", "possessives"],
  lessons_month: ["er", "possessives"],
  puzzle_days: ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-10"],
  activities_finished: 12,
  cards_studied: 140,
};

const quiet: MonthlySummary = {
  ...ana,
  id: "u2",
  full_name: null,
  email: "bo@example.com",
  classes_taken: 0,
  class_package: null,
  completed: 0,
  next_class: null,
  lessons_done: [],
  lessons_month: [],
  puzzle_days: ["2026-09-05"],
  activities_finished: 0,
  cards_studied: 0,
};

beforeEach(() => {
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => catalog })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("longestStreak", () => {
  it("counts the longest run of days in a row", () => {
    expect(longestStreak(["2026-09-01", "2026-09-03", "2026-09-02", "2026-09-10"])).toBe(3);
    expect(longestStreak([])).toBe(0);
  });
});

describe("emails.monthlySummary", () => {
  it("lists the month's classes and practice, and the next lesson", () => {
    const email = emails.monthlySummary(ana, catalog)!;
    expect(email).toMatchObject({ to: "ana@example.com", subject: "Your month at English & Portuguese with Trevor" });
    expect(email.text).toContain("Hi Ana!");
    expect(email.text).toContain("Here's what you did in September.");
    expect(email.text).toContain("Classes taken this month");
    expect(email.text).toContain("2 of 8");
    expect(email.text).toContain("Wednesday, October 7, 6:00 PM");
    expect(email.text).toContain("2 (latest: Possessivos)");
    expect(email.text).toContain("4 days · best streak: 3 days");
    expect(email.text).toContain("Estar Com e Ficar");
    expect(email.html).toContain('href="https://englishandportuguesewithtrevor.com/lessons/#/estar-com-ficar"');
    expect(email.html).toContain('href="https://englishandportuguesewithtrevor.com/progress/"');
    expect(email.text).toContain("See you in class");
  });

  it("leaves out empty lines and never mixes in the other language", () => {
    const email = emails.monthlySummary(quiet, catalog)!;
    expect(email.text).toContain("Hi there!");
    expect(email.text).not.toContain("Your classes with me");
    expect(email.text).not.toContain("Flashcards studied");
    expect(email.text).toContain("1 day · best streak: 1 day");
    expect(email.text).toContain("Regular -AR Verbs");
    expect(email.text).not.toContain("Hi, I'm");
    expect(email.text).not.toContain("See you in class");
    expect(emails.monthlySummary({ ...quiet, email: null }, catalog)).toBeNull();
  });
});

describe("sendMonthlySummaries", () => {
  it("emails each student it claimed, and hands back a failed one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValueOnce({ data: [ana, quiet], error: null });
    mocks.sendEmail.mockRejectedValueOnce(new Error("Gmail is down"));
    expect(await sendMonthlySummaries("s3cret")).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_monthly_summaries", { p_secret: "s3cret" });
    expect(mocks.rpc).toHaveBeenCalledWith("unclaim_monthly_summaries", { p_secret: "s3cret", p_ids: ["u1"] });
  });

  it("claims nothing while Gmail isn't set up", async () => {
    mocks.isGoogleConfigured.mockReturnValueOnce(false);
    expect(await sendMonthlySummaries("s3cret")).toBe(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
