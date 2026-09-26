// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setLessonAccess = vi.fn();
vi.mock("@/lib/actions/users", () => ({
  searchUsers: vi.fn(),
  updateUserRole: vi.fn(),
  setLessonAccess: (...args: unknown[]) => setLessonAccess(...args),
}));

import { UsersManager } from "@/components/admin/users-manager";
import type { Profile } from "@/lib/types";

function profile(id: string, lesson_access: Profile["lesson_access"]): Profile {
  return {
    id,
    lesson_access,
    role: "student",
    email: `${id}@example.com`,
    full_name: id,
    phone: null,
    timezone: "America/Los_Angeles",
    created_at: "2026-09-01T00:00:00Z",
  };
}

describe("UsersManager lesson access", () => {
  beforeEach(() => setLessonAccess.mockReset());

  it("grants access to a new sign-up", async () => {
    setLessonAccess.mockResolvedValue({ error: null });
    render(<UsersManager initialUsers={[profile("new", "none")]} displayNames={{ new: "New S." }} />);

    expect(screen.getByText("No lesson access")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Give lesson access" }));

    expect(setLessonAccess).toHaveBeenCalledWith("new", true);
    expect(await screen.findByText("Lesson access")).toBeInTheDocument();
  });

  it("puts the old value back and says why when the change fails", async () => {
    setLessonAccess.mockResolvedValue({ error: "permission denied" });
    render(<UsersManager initialUsers={[profile("s1", "granted")]} displayNames={{}} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove lesson access" }));

    expect(await screen.findByText(/permission denied/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Lesson access")).toBeInTheDocument());
  });

  it("leaves paying subscribers alone", () => {
    render(<UsersManager initialUsers={[profile("sub", "subscriber")]} displayNames={{}} />);
    expect(screen.getByText("Subscriber")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /lesson access/ })).not.toBeInTheDocument();
  });
});
