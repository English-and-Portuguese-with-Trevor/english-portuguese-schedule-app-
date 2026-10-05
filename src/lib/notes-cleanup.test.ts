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

import { emails, type NotesOwner } from "@/lib/notifications";
import { cleanUpNotes } from "@/lib/notes-cleanup";

const ana: NotesOwner = { id: "u1", full_name: "Ana Pereira", email: "ana@example.com", site_language: "pt", notes: 12, delete_on: "2026-11-20T18:00:00Z" };
const bo: NotesOwner = { id: "u2", full_name: null, email: "bo@example.com", site_language: null, notes: 3, delete_on: "2026-11-20T18:00:00Z" };

function rpcAnswers(people: NotesOwner[], deleted = 0) {
  mocks.rpc.mockImplementation(async (name: string) => {
    if (name === "claim_notes_warnings") return { data: people, error: null };
    if (name === "delete_stale_notes") return { data: deleted, error: null };
    return { data: null, error: null };
  });
}

beforeEach(() => rpcAnswers([]));
afterEach(() => vi.clearAllMocks());

describe("emails.notesExpiring", () => {
  it("says when the notes go and links them, in English when there's no site language", () => {
    const email = emails.notesExpiring(bo)!;
    expect(email).toMatchObject({ to: "bo@example.com", subject: "Your notes will be deleted on November 20, 2026" });
    expect(email.text).toContain("Hi there!");
    expect(email.text).toContain("just open them before then");
    expect(email.text).toContain("https://englishandportuguesewithtrevor.com/notebook/");
  });

  it("is written in the student's site language", () => {
    const email = emails.notesExpiring(ana)!;
    expect(email.subject).toBe("Suas anotações serão apagadas em 20 de novembro de 2026");
    expect(email.text).toContain("Oi, Ana!");
  });
});

describe("cleanUpNotes", () => {
  it("warns the claimed students, then deletes stale notes", async () => {
    rpcAnswers([ana, bo], 2);
    expect(await cleanUpNotes("s3cret")).toEqual({ warned: 2, deleted: 2 });
    expect(mocks.sendEmail.mock.calls.map(([e]) => e.to)).toEqual(["ana@example.com", "bo@example.com"]);
    expect(mocks.rpc).toHaveBeenCalledWith("delete_stale_notes", { p_secret: "s3cret" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("unclaim_notes_warnings", expect.anything());
  });

  it("hands a failed email back so the student is warned before anything goes", async () => {
    rpcAnswers([ana, bo]);
    mocks.sendEmail.mockRejectedValueOnce(new Error("Gmail down"));
    expect(await cleanUpNotes("s3cret")).toEqual({ warned: 1, deleted: 0 });
    expect(mocks.rpc).toHaveBeenCalledWith("unclaim_notes_warnings", { p_secret: "s3cret", p_ids: ["u1"] });
  });

  it("does nothing while Gmail isn't set up", async () => {
    mocks.isGoogleConfigured.mockReturnValueOnce(false);
    expect(await cleanUpNotes("s3cret")).toEqual({ warned: 0, deleted: 0 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
