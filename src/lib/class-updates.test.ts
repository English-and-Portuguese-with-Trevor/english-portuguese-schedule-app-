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

import { emails, type ClassUpdate } from "@/lib/notifications";
import { sendClassUpdates } from "@/lib/class-updates";

const jesse: ClassUpdate = {
  id: "u1",
  full_name: "Jesse Downing",
  email: "jesse@example.com",
  timezone: "America/Denver",
  site_language: null,
  learning: "Portuguese",
  week: "2026-10-04",
  class_package: 8,
  completed: 6,
  classes: [
    { start: "2026-10-05T22:00:00Z", end: "2026-10-05T23:00:00Z", meet_link: "https://meet.google.com/ror-vrvx-afe" },
    { start: "2026-10-08T23:00:00Z", end: "2026-10-09T00:00:00Z", meet_link: "https://meet.google.com/ror-vrvx-afe" },
  ],
};

const francieli: ClassUpdate = {
  ...jesse,
  id: "u2",
  full_name: "Francieli Agrizzi",
  email: "fran@example.com",
  timezone: "America/Sao_Paulo",
  site_language: "pt",
  learning: "English",
  completed: 4,
  classes: [{ start: "2026-10-07T15:00:00Z", end: "2026-10-07T16:00:00Z", meet_link: null }],
};

beforeEach(() => {
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("emails.weeklyClassUpdate", () => {
  it("writes the week in the language being learned first, then in the student's own language", () => {
    const email = emails.weeklyClassUpdate(jesse)!;
    expect(email).toMatchObject({ to: "jesse@example.com", subject: "Suas aulas desta semana" });
    expect(email.text).toContain("Oi, Jesse!");
    expect(email.text).toContain("Aula: segunda-feira, 5 de outubro");
    expect(email.text).toContain("16:00 (MDT)");
    expect(email.text).toContain("Aulas feitas: 6");
    expect(email.text).toContain("Restam no seu pacote: 2 de 8");
    // The Portuguese comes before the English.
    expect(email.text.indexOf("Suas aulas desta semana")).toBeLessThan(email.text.indexOf("Your classes this week"));
    expect(email.text).toContain("Class: Monday, October 5, 4:00 PM (MDT)");
    expect(email.text).toContain("Class: Thursday, October 8, 5:00 PM (MDT)");
    expect(email.text).toContain("Classes completed: 6");
    expect(email.text).toContain("Left in your package: 2 of 8");
    expect(email.html).toContain('href="https://meet.google.com/ror-vrvx-afe"');
    expect(email.html).toContain('href="https://schedule.englishandportuguesewithtrevor.com/dashboard"');
    expect(email.text).toContain("Turn it off at https://schedule.englishandportuguesewithtrevor.com/settings");
    expect(email.text).toContain("Desligue em https://schedule.englishandportuguesewithtrevor.com/settings");
  });

  it("puts English first for an English learner, with their own language under it", () => {
    const email = emails.weeklyClassUpdate(francieli)!;
    expect(email.subject).toBe("Your classes this week");
    expect(email.text).toContain("Hi Francieli!");
    expect(email.text).toContain("Class: Wednesday, October 7, 12:00 PM (GMT-3)");
    expect(email.text.indexOf("Your classes this week")).toBeLessThan(email.text.indexOf("Suas aulas desta semana"));
    expect(email.text).toContain("Aulas feitas: 4");
    expect(email.text).toContain("Restam no seu pacote: 4 de 8");
    expect(email.html).not.toContain("href=\"null\"");
  });

  it("uses a Spanish or French site language for the second part", () => {
    const email = emails.weeklyClassUpdate({ ...jesse, site_language: "es" })!;
    expect(email.text).toContain("Suas aulas desta semana");
    expect(email.text).toContain("Tus clases de esta semana");
    expect(email.text).not.toContain("Your classes this week");
    expect(emails.weeklyClassUpdate({ ...francieli, site_language: "fr" })!.text).toContain("Vos cours de la semaine");
  });

  it("sends nothing without an email or a class", () => {
    expect(emails.weeklyClassUpdate({ ...jesse, email: null })).toBeNull();
    expect(emails.weeklyClassUpdate({ ...jesse, classes: [] })).toBeNull();
  });
});

describe("sendClassUpdates", () => {
  it("emails each student it claimed for the week, and hands back a failed one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValueOnce({ data: [jesse, francieli], error: null });
    mocks.sendEmail.mockRejectedValueOnce(new Error("Gmail is down"));
    expect(await sendClassUpdates("s3cret", "2026-10-04")).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_class_updates", { p_secret: "s3cret", p_week: "2026-10-04" });
    expect(mocks.rpc).toHaveBeenCalledWith("unclaim_class_updates", { p_secret: "s3cret", p_ids: ["u1"] });
  });

  it("claims nothing while Gmail isn't set up", async () => {
    mocks.isGoogleConfigured.mockReturnValueOnce(false);
    expect(await sendClassUpdates("s3cret", "2026-10-04")).toBe(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
