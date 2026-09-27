// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ functions: { invoke }, auth: { signOut } }),
}));
vi.mock("@/lib/actions/auth", () => ({ logout: vi.fn() }));

import { AccountSettings } from "@/components/account-settings";

const subscription = {
  status: "active",
  current_period_end: "2026-10-27T12:00:00Z",
  cancel_at_period_end: false,
  subscription_id: "sub_1",
};

beforeEach(() => {
  invoke.mockReset();
  signOut.mockReset();
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
