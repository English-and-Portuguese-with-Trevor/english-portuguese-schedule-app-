// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc,
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        cb("INITIAL_SESSION");
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  }),
}));

import { Notices } from "@/components/notices";

const KEY = "ept-dismissed-notices";

beforeEach(() => {
  localStorage.clear();
  rpc.mockResolvedValue({
    data: [
      { id: 2, message: "No classes on Friday.", created_at: "2026-09-30T12:00:00Z" },
      { id: 1, message: "Old news.", created_at: "2026-09-29T12:00:00Z" },
    ],
    error: null,
  });
});

describe("Notices", () => {
  it("shows notices not dismissed on this device", async () => {
    localStorage.setItem(KEY, JSON.stringify([1]));
    render(<Notices />);
    expect(await screen.findByText("No classes on Friday.")).toBeInTheDocument();
    expect(screen.queryByText("Old news.")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Notices" })).toBeInTheDocument();
  });

  it("hides a notice when dismissed and remembers it", async () => {
    render(<Notices />);
    await screen.findByText("No classes on Friday.");
    await userEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    expect(screen.queryByText("No classes on Friday.")).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([2]);
  });

  it("shows nothing when the call fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "down" } });
    const { container } = render(<Notices />);
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
