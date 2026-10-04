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

import { emails, type ArticleReader } from "@/lib/notifications";
import { sendArticleEmails } from "@/lib/article-emails";
import { TAGLINE_EN, TAGLINE_ES, TAGLINE_FR, TAGLINE_PT } from "@/lib/email-template";

const catalog = [
  { id: "ar", title: "Regular -AR Verbs" },
  { id: "hi", title: "Hi, I'm…", learning: "English" },
  { id: "coffee", title: "Coffee Around the World", learning: "English", article: true },
  { id: "tiny-homes", title: "Tiny Homes", learning: "English", article: true, releaseOn: "2026-10-05" },
  { id: "next-week", title: "Next Week's Article", learning: "English", article: true, releaseOn: "2026-10-12" },
];

const ana: ArticleReader = { id: "u1", full_name: "Ana Pereira", email: "ana@example.com", site_language: "pt", learning: "English" };
const john: ArticleReader = { id: "u2", full_name: "John Smith", email: "john@example.com", site_language: null, learning: "Portuguese" };
const bo: ArticleReader = { id: "u3", full_name: null, email: "bo@example.com", site_language: null, learning: "English" };
const tinyHomes = [catalog[3]];

beforeEach(() => {
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => catalog })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("emails.newArticles", () => {
  it("links the article, in English when there's no site language", () => {
    const email = emails.newArticles(bo, tinyHomes)!;
    expect(email).toMatchObject({ to: "bo@example.com", subject: "New article: Tiny Homes" });
    expect(email.text).toContain("Hi there!");
    expect(email.text).toContain("There's a new article for you today.");
    expect(email.html).toContain('href="https://englishandportuguesewithtrevor.com/lessons/#/tiny-homes"');
    expect(email.text).toContain("Read it: https://englishandportuguesewithtrevor.com/lessons/#/tiny-homes");
    expect(email.text).toContain("You can change this in Settings > Preferences.");
  });

  it("is written in the student's site language, keeping the title as it is", () => {
    const email = emails.newArticles(ana, tinyHomes)!;
    expect(email.subject).toBe("Novo artigo: Tiny Homes");
    expect(email.text).toContain("Oi, Ana!");
    expect(email.text).toContain("Hoje tem um artigo novo para você.");
    expect(email.text).toContain("Artigo: Tiny Homes");
    expect(email.text).toContain("Ler: https://englishandportuguesewithtrevor.com/lessons/#/tiny-homes");
    expect(email.text).toContain("Configurações > Preferências");
    expect(email.text).not.toContain("Read it");
  });

  it("ends with the tagline in the email's language", () => {
    const en = emails.newArticles(bo, tinyHomes)!;
    expect(en.text).toContain(`${TAGLINE_EN}\n${TAGLINE_PT}`);
    const pt = emails.newArticles(ana, tinyHomes)!;
    expect(pt.text).toContain(TAGLINE_PT);
    expect(pt.text).not.toContain(TAGLINE_EN);
    for (const [lang, line] of [["es", TAGLINE_ES], ["fr", TAGLINE_FR]] as const) {
      const email = emails.newArticles({ ...bo, site_language: lang }, tinyHomes)!;
      expect(email.text).toContain(line);
      expect(email.html).toContain(line.replaceAll("'", "&#39;"));
      expect(email.text).not.toContain(TAGLINE_EN);
      expect(email.text).not.toContain(TAGLINE_PT);
    }
  });

  it("sends nothing without an article or an address", () => {
    expect(emails.newArticles(bo, [])).toBeNull();
    expect(emails.newArticles({ ...bo, email: null }, tinyHomes)).toBeNull();
  });
});

describe("sendArticleEmails", () => {
  it("emails today's articles in each student's language and hands back the rest", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValueOnce({ data: [ana, john, bo], error: null });
    mocks.sendEmail.mockRejectedValueOnce(new Error("Gmail is down")).mockResolvedValue(undefined);
    expect(await sendArticleEmails("s3cret", "2026-10-05")).toBe(1);
    expect(mocks.rpc).toHaveBeenCalledWith("claim_article_emails", { p_secret: "s3cret", p_day: "2026-10-05" });
    // Ana's email failed; John learns Portuguese and there's no Portuguese article today.
    expect(mocks.rpc).toHaveBeenCalledWith("unclaim_article_emails", { p_secret: "s3cret", p_ids: ["u1", "u2"] });
    expect(mocks.sendEmail.mock.calls.map(([e]) => e.to)).toEqual(["ana@example.com", "bo@example.com"]);
    expect(mocks.sendEmail.mock.calls[1][0].text).not.toContain("Next Week");
  });

  it("claims nobody when no article comes out today", async () => {
    expect(await sendArticleEmails("s3cret", "2026-10-06")).toBe(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("claims nothing while Gmail isn't set up", async () => {
    mocks.isGoogleConfigured.mockReturnValueOnce(false);
    expect(await sendArticleEmails("s3cret", "2026-10-05")).toBe(0);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
