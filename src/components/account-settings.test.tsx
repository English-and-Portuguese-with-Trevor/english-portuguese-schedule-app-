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

// Settings is a menu: open one of its pages.
const openPage = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

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
    openPage("Account");
    expect(screen.getByText(/Renews on October 27, 2026/)).toBeInTheDocument();
  });

  it("offers Get the app right under Preferences when the browser can install it", async () => {
    render(
      <AccountSettings name="Ana" email={null} role="student" lessonAccess="none" billing={null} />,
    );
    const offer = Object.assign(new Event("beforeinstallprompt"), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    fireEvent(window, offer);
    const row = await screen.findByRole("button", { name: "Get the app" });
    expect(screen.getAllByRole("button").map((b) => b.textContent).slice(0, 3)).toEqual([
      "Preferences›",
      "Get the app",
      "Account›",
    ]);
    fireEvent.click(row);
    expect(offer.prompt).toHaveBeenCalled();
    expect(await screen.findByText("Installed as an app")).toBeInTheDocument();
  });

  it("is a short menu; Preferences opens its own page with nothing else under it", () => {
    render(
      <AccountSettings
        name="Ana"
        email="ana@example.com"
        role="student"
        lessonAccess="none"
        billing={null}
      />,
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Preferences›",
      "Account›",
      "Manage subscription",
      "Delete account",
      "Log out",
    ]);
    expect(screen.getByRole("link", { name: "‹ Back" })).toHaveAttribute("href", "/dashboard");
    openPage("Preferences");
    expect(screen.getByRole("heading", { name: "Preferences" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete account" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
  });

  it("keeps Manage subscription, Delete account and Log out on view for every account", () => {
    render(
      <AccountSettings
        name="Ana"
        email="ana@example.com"
        role="student"
        lessonAccess="granted"
        billing={null}
      />,
    );
    for (const name of ["Manage subscription", "Delete account", "Log out"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
    openPage("Account");
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
    openPage("Preferences");
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Dark mode" })).toBeChecked(),
    );
  });

  it("turns on dark mode, saves the cookie and the profile", async () => {
    renderSettings();
    openPage("Preferences");
    fireEvent.click(screen.getByRole("switch", { name: "Dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(decodeURIComponent(document.cookie)).toContain('"theme":"dark"');
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_theme", { theme: "dark" }),
    );
  });

  it("saves the language being learned", async () => {
    renderSettings();
    openPage("Preferences");
    fireEvent.click(screen.getByRole("button", { name: /I'm learning/ }));
    fireEvent.click(screen.getByRole("option", { name: "English" }));
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
    openPage("Preferences");
    fireEvent.click(screen.getByRole("button", { name: /Site language/ }));
    fireEvent.click(screen.getByRole("option", { name: "Español" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_site_language", { lang: "es" }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(decodeURIComponent(document.cookie)).toContain('"site":"es"');
  });

  it("opens the language menu from the keyboard, chooses, and closes on Escape", async () => {
    renderSettings();
    openPage("Preferences");
    const button = screen.getByRole("button", { name: "Site language English" });
    expect(button).toHaveAttribute("aria-haspopup", "listbox");
    fireEvent.keyDown(button, { key: "ArrowDown" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    const english = screen.getByRole("option", { name: "English" });
    expect(english).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(english).toHaveFocus());

    const list = screen.getByRole("listbox", { name: "Site language" });
    fireEvent.keyDown(list, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    fireEvent.keyDown(button, { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "End" });
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Français" })).toHaveFocus(),
    );
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Enter" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_site_language", { lang: "fr" }),
    );
  });

  it("saves the email choices together, starting from the profile's", async () => {
    render(
      <AccountSettings
        name="Ana"
        email="ana@example.com"
        role="student"
        lessonAccess="none"
        billing={null}
        articleDelivery="app"
        summaryDelivery="email"
        classUpdateDelivery="email"
      />,
    );
    openPage("Preferences");
    expect(screen.getByLabelText("New articles")).toHaveValue("app");
    fireEvent.change(screen.getByLabelText("New articles"), { target: { value: "email" } });
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_email_choices", { p_articles: "email", p_summary: "email", p_class_update: "email" }),
    );
    fireEvent.change(screen.getByLabelText("Monthly summary"), { target: { value: "off" } });
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_email_choices", { p_articles: "email", p_summary: "off", p_class_update: "email" }),
    );
    fireEvent.change(screen.getByLabelText("Weekly class update"), { target: { value: "off" } });
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("set_email_choices", { p_articles: "email", p_summary: "off", p_class_update: "off" }),
    );
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
    openPage("Compte");
    expect(screen.getByText(/Accès élève offert par Trevor/)).toBeInTheDocument();
  });
});
