import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  role: "admin" as string | null,
  aal: { currentLevel: "aal1", nextLevel: "aal1" } as { currentLevel: string; nextLevel: string } | null,
}));
const client = {
  auth: {
    getUser: async () => ({ data: { user: mocks.user } }),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: mocks.aal }) },
  },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: mocks.role ? { role: mocks.role } : null }) }) }) }),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client }));

import { checkAdmin, requireAdmin } from "@/lib/auth/require-admin";

afterEach(() => {
  mocks.user = { id: "u1" };
  mocks.role = "admin";
  mocks.aal = { currentLevel: "aal1", nextLevel: "aal1" };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const check = () => checkAdmin(client as any);

describe("checkAdmin / requireAdmin", () => {
  it("lets an admin in while no Google Authenticator factor is set up (aal1 -> aal1)", async () => {
    expect(await check()).toEqual({ ok: true, adminId: "u1" });
    await expect(requireAdmin()).resolves.toMatchObject({ adminId: "u1" });
  });

  it("refuses an admin with a verified factor who hasn't entered the code (aal1 -> aal2)", async () => {
    mocks.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    expect(await check()).toMatchObject({ ok: false, status: 403, reason: "needs-code" });
    await expect(requireAdmin()).rejects.toThrow(/Google Authenticator/);
  });

  it("lets an admin in once the code was entered (aal2)", async () => {
    mocks.aal = { currentLevel: "aal2", nextLevel: "aal2" };
    expect(await check()).toEqual({ ok: true, adminId: "u1" });
  });

  it("refuses signed-out callers and students, whatever their level", async () => {
    mocks.aal = { currentLevel: "aal2", nextLevel: "aal2" };
    mocks.role = "student";
    expect(await check()).toMatchObject({ ok: false, status: 403, reason: "not-admin" });
    mocks.role = null;
    expect(await check()).toMatchObject({ ok: false, status: 403, reason: "not-admin" });
    mocks.user = null;
    expect(await check()).toMatchObject({ ok: false, status: 401, reason: "signed-out" });
    await expect(requireAdmin()).rejects.toThrow("Not signed in.");
  });
});
