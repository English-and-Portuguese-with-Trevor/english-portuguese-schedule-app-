// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setLessonAccess = vi.fn();
vi.mock("@/lib/actions/users", () => ({
  searchUsers: vi.fn(),
  updateUserRole: vi.fn(),
  setLessonAccess: (...args: unknown[]) => setLessonAccess(...args),
  setClassTracking: (...args: unknown[]) => setClassTracking(...args),
}));
const setClassTracking = vi.fn();

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
    class_package: null,
    earlier_classes: 0,
  } as Profile;
}

describe("UsersManager lesson access", () => {
  beforeEach(() => setLessonAccess.mockReset());

  it("grants access to a new sign-up", async () => {
    setLessonAccess.mockResolvedValue({ error: null });
    render(
      <UsersManager
        initialUsers={[profile("new", "none")]}
        displayNames={{ new: "New S." }}
      />,
    );

    expect(screen.getByText("No lesson access")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Give lesson access" }));

    expect(setLessonAccess).toHaveBeenCalledWith("new", "granted");
    expect(await screen.findByText("Lesson access")).toBeInTheDocument();
  });

  it("puts the old value back and says why when the change fails", async () => {
    setLessonAccess.mockResolvedValue({ error: "permission denied" });
    render(
      <UsersManager
        initialUsers={[profile("s1", "granted")]}
        displayNames={{}}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Remove lesson access" }),
    );

    expect(await screen.findByText(/permission denied/)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Lesson access")).toBeInTheDocument(),
    );
  });

  it("leaves paying subscribers' access alone apart from lifetime", () => {
    render(
      <UsersManager
        initialUsers={[profile("sub", "subscriber")]}
        displayNames={{}}
      />,
    );
    expect(screen.getByText("Subscriber")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^(Give|Remove) lesson access$/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Give lifetime access" }),
    ).toBeInTheDocument();
  });
});

describe("UsersManager lifetime access", () => {
  beforeEach(() => {
    setLessonAccess.mockReset();
    setClassTracking.mockReset();
  });

  it("flags a student who finished three class sets, but only Trevor gives lifetime access", async () => {
    setLessonAccess.mockResolvedValue({ error: null });
    const student = { ...profile("s1", "granted"), class_package: 4 as const };
    render(
      <UsersManager
        initialUsers={[student]}
        displayNames={{ s1: "Ana" }}
        progress={{
          s1: {
            user_id: "s1",
            class_package: 4,
            completed: 12,
            needed: 12,
            eligible: true,
          },
        }}
      />,
    );

    expect(
      screen.getByText("Qualifies for lifetime access"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("12 of 12 classes toward lifetime"),
    ).toBeInTheDocument();
    expect(setLessonAccess).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Give lifetime access" }),
    );
    expect(setLessonAccess).toHaveBeenCalledWith("s1", "lifetime");
    expect(await screen.findByText("Lifetime access")).toBeInTheDocument();
    expect(
      screen.queryByText("Qualifies for lifetime access"),
    ).not.toBeInTheDocument();
  });

  it("does not flag a student who hasn't finished three sets", () => {
    const student = { ...profile("s2", "granted"), class_package: 8 as const };
    render(
      <UsersManager
        initialUsers={[student]}
        displayNames={{}}
        progress={{
          s2: {
            user_id: "s2",
            class_package: 8,
            completed: 10,
            needed: 24,
            eligible: false,
          },
        }}
      />,
    );
    expect(
      screen.queryByText("Qualifies for lifetime access"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("10 of 24 classes toward lifetime"),
    ).toBeInTheDocument();
  });

  it("saves the class package", () => {
    setClassTracking.mockResolvedValue({ error: null });
    render(
      <UsersManager
        initialUsers={[profile("s3", "granted")]}
        displayNames={{ s3: "Bo" }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Class package for Bo"), {
      target: { value: "8" },
    });
    expect(setClassTracking).toHaveBeenCalledWith("s3", 8, 0);
  });
});
