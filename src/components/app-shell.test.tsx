// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell, LANDING_URL } from "@/components/app-shell";
import type { Role } from "@/lib/types";

const logout = vi.fn();
vi.mock("@/lib/actions/auth", () => ({ logout: () => logout() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/bookings" }));

function renderShell(role: Role) {
  render(
    <AppShell role={role} fullName="Trevor List" email="trevor@example.com">
      <p>Page content</p>
    </AppShell>,
  );
  return userEvent.setup();
}

beforeEach(() => logout.mockClear());

describe("AppShell", () => {
  it("links the wordmark to the main website", () => {
    renderShell("student");
    expect(
      screen.getByRole("link", { name: /English & Portuguese with Trevor/ }),
    ).toHaveAttribute("href", LANDING_URL);
  });

  it("gives students no admin navigation", () => {
    renderShell("student");
    expect(
      screen.queryByRole("navigation", { name: /^Admin/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });

  it("gives admins every section without scrolling, on wide screens and phones", () => {
    renderShell("admin");
    const navs = screen.getAllByRole("navigation", { name: /^Admin/ });
    expect(navs).toHaveLength(2); // header tabs (wide) and bottom bar (phone)
    for (const nav of navs) {
      const links = within(nav).getAllByRole("link");
      expect(links.map((l) => l.textContent)).toEqual([
        "Overview",
        "Availability",
        "Bookings",
        "Users",
        "Book",
      ]);
      expect(nav.className).not.toMatch(/overflow-x-auto/);
      expect(
        within(nav).getByRole("link", { name: "Bookings" }),
      ).toHaveAttribute("aria-current", "page");
    }
  });

  it("has the same account menu as the other sites", async () => {
    const user = renderShell("student");
    expect(screen.queryByText("Log out")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hi, Trevor" }));
    const menu = screen.getByRole("menu");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Home",
      "Lessons",
      "Flashcards",
      "Activities",
      "Schedule a class",
      "Settings",
      "Log out",
    ]);
    expect(
      within(menu).getByRole("menuitem", { name: "Home" }),
    ).toHaveAttribute("href", LANDING_URL);
    expect(
      within(menu).getByRole("menuitem", { name: "Settings" }),
    ).toHaveAttribute("href", "/settings");

    await user.click(within(menu).getByRole("menuitem", { name: "Log out" }));
    expect(logout).toHaveBeenCalledOnce();
  });
});
