// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const signOut = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ functions: { invoke }, auth: { signOut }, rpc }),
}));
vi.mock("@/lib/actions/auth", () => ({ logout: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { AccountSettings } from "@/components/account-settings";
import { SiteLanguageProvider } from "@/i18n/client";

const subscription = {
  status: "active",
  current_period_end: "2026-10-27T12:00:00Z",
  cancel_at_period_end: false,
  subscription_id: "sub_1",
};

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { synced: false }, error: null });
  signOut.mockReset();
  rpc.mockReset();
  rpc.mockResolvedValue({ error: null });
  refresh.mockReset();
  delete document.documentElement.dataset.theme;
});

describe("AccountSettings", () => {
  it("puts Manage subscription next to Delete account for subscribers", () => {
    render(
      <AccountSettings
        name="Ana"
        email="ana@example.com"
        role="student"
        lessonAccess="subscriber"
        billing={subscription}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Manage subscription" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete account" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Renews on October 27, 2026/)).toBeInTheDocument();
  });

  it("has no Manage subscription button without a subscription", () => {
    render(
      <AccountSettings
        name="Ana"
        email="ana@example.com"
        role="student"
        lessonAccess="granted"
        billing={null}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Manage subscription" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Student access from Trevor/)).toBeInTheDocument();
  });

  it("asks Stripe for the latest when it opens and reloads if anything was synced", async () => {
    invoke.mockResolvedValue({ data: { synced: true }, error: null });
    render(
      <AccountSettings
        name="Ana"
        email="ana@example.com"
        role="student"
        lessonAccess="subscriber"
        billing={subscription}
      />,
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(invoke).toHaveBeenCalledWith("billing", {
      body: { action: "refresh" },
    });
  });

  it("only deletes after typing DELETE, and shows why it couldn't", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          json: async () => ({ error: "You have an upcoming class booked." }),
        },
      },
    });
    render(
      <AccountSettings
        name="Ana"
        email="ana@example.com"
        role="student"
        lessonAccess="none"
        billing={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));

    const confirm = screen.getByRole("button", {
      name: "Permanently delete my account",
    });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("DELETE"), {
      target: { value: "delete" },
    });
    fireEvent.click(confirm);

    expect(
      await screen.findByText("You have an upcoming class booked."),
    ).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("delete-account", { method: "POST" });
    await waitFor(() => expect(signOut).not.toHaveBeenCalled());
  });
});

describe("Preferences", () => {
  function renderSettings() {
    render(
      <AccountSettings
        name="Ana"
        email="ana@example.com"
        role="student"
        lessonAccess="none"
        billing={null}
      />,
    );
  }

  it("shows the saved dark mode choice from the shared cookie", async () => {
    document.cookie = `ept-prefs=${encodeURIComponent('{"theme":"dark"}')}; Path=/`;
    renderSettings();
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Dark mode" })).toBeChecked(),
    );
  });

  it("turns on dark mode, saves the cookie and the profile", async () => {
    renderSettings();
    fireEvent.click(screen.getByRole("switch", { name: "Dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(decodeURIComponent(document.cookie)).toContain('"theme":"dark"');
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_theme", { theme: "dark" }),
    );
  });

  it("saves the language being learned", async () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText("I'm learning"), {
      target: { value: "English" },
    });
    expect(decodeURIComponent(document.cookie)).toContain(
      '"learning":"English"',
    );
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_learning_language", {
        lang: "English",
      }),
    );
  });

  it("saves the site language, then reloads the page in it", async () => {
    render(
      <AccountSettings
        name="Ana"
        email="ana@example.com"
        role="student"
        lessonAccess="none"
        billing={null}
      />,
    );
    fireEvent.change(screen.getByLabelText("Site language"), {
      target: { value: "es" },
    });
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_site_language", { lang: "es" }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(decodeURIComponent(document.cookie)).toContain('"site":"es"');
  });

  it("shows the settings in the site language", () => {
    render(
      <SiteLanguageProvider lang="fr">
        <AccountSettings
          name="Ana"
          email="ana@example.com"
          role="student"
          lessonAccess="granted"
          billing={null}
        />
      </SiteLanguageProvider>,
    );
    expect(screen.getByRole("heading", { name: "Paramètres" })).toBeInTheDocument();
    expect(screen.getByText(/Accès élève offert par Trevor/)).toBeInTheDocument();
  });
});
