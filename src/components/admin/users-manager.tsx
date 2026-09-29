"use client";

import { ChevronDown } from "lucide-react";
import { useState, useTransition } from "react";

import {
  searchUsers,
  setClassTracking,
  setLessonAccess,
  updateUserRole,
} from "@/lib/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ClassPackage,
  ClassProgress,
  LessonAccess,
  Profile,
  Role,
} from "@/lib/types";

export function UsersManager({
  initialUsers,
  displayNames,
  progress = {},
  currentUserId,
}: {
  initialUsers: Profile[];
  displayNames: Record<string, string>;
  /** Class-set progress by user id (admin_class_progress). */
  progress?: Record<string, ClassProgress>;
  /** The signed-in admin, who can't demote themselves. */
  currentUserId?: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSearch(value: string) {
    setQuery(value);
    startTransition(async () => {
      const results = await searchUsers(value);
      setUsers(results as Profile[]);
    });
  }

  function handleRoleChange(user: Profile, role: Role) {
    const previous = user.role;
    setError(null);
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, role } : u)),
    );
    startTransition(async () => {
      const result = await updateUserRole(user.id, role);
      if (result.error) {
        setError(`Couldn't change the role: ${result.error}`);
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role: previous } : u)),
        );
      }
    });
  }

  function handleLessonAccess(
    user: Profile,
    access: Exclude<LessonAccess, "subscriber">,
  ) {
    if (
      access === "lifetime" &&
      user.lesson_access === "subscriber" &&
      !window.confirm(
        `${displayNames[user.id] ?? user.email} pays for a subscription. Lifetime access won't stop Stripe from billing them — cancel it in Stripe too. Give lifetime access?`,
      )
    ) {
      return;
    }
    const previous = user.lesson_access;
    setError(null);
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, lesson_access: access } : u)),
    );
    startTransition(async () => {
      const result = await setLessonAccess(user.id, access);
      if (result.error) {
        setError(`Couldn't change lesson access: ${result.error}`);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, lesson_access: previous } : u,
          ),
        );
      }
    });
  }

  function handleClassTracking(
    user: Profile,
    classPackage: ClassPackage | null,
    earlierClasses: number,
  ) {
    setError(null);
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? {
              ...u,
              class_package: classPackage,
              earlier_classes: earlierClasses,
            }
          : u,
      ),
    );
    startTransition(async () => {
      const result = await setClassTracking(
        user.id,
        classPackage,
        earlierClasses,
      );
      if (result.error)
        setError(`Couldn't save the class package: ${result.error}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Open a user to change their lesson access, class package or role.
          Three finished class sets qualify a student for lifetime access; you
          decide when to give it.
        </p>
      </div>

      <Input
        placeholder="Search by name or email..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="sm:max-w-sm"
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users found.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {users.map((user) => (
            <li key={user.id}>
              <UserRow
                user={user}
                name={displayNames[user.id] ?? "Unknown"}
                progress={progress[user.id]}
                disabled={isPending}
                isSelf={user.id === currentUserId}
                onLessonAccess={(access) => handleLessonAccess(user, access)}
                onClassTracking={(pkg, earlier) =>
                  handleClassTracking(user, pkg, earlier)
                }
                onRoleChange={(role) => handleRoleChange(user, role)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UserRow({
  user,
  name,
  progress,
  disabled,
  isSelf,
  onLessonAccess,
  onClassTracking,
  onRoleChange,
}: {
  user: Profile;
  name: string;
  progress: ClassProgress | undefined;
  disabled: boolean;
  /** The admin's own row: they can't make themselves a student. */
  isSelf: boolean;
  onLessonAccess: (access: Exclude<LessonAccess, "subscriber">) => void;
  onClassTracking: (
    classPackage: ClassPackage | null,
    earlierClasses: number,
  ) => void;
  onRoleChange: (role: Role) => void;
}) {
  const [earlier, setEarlier] = useState(String(user.earlier_classes ?? 0));
  const classPackage = user.class_package;
  const eligible =
    Boolean(progress?.eligible) && user.lesson_access !== "lifetime";

  function saveEarlier() {
    const value = Number(earlier);
    if (!Number.isInteger(value) || value < 0 || value > 1000) {
      setEarlier(String(user.earlier_classes ?? 0));
      return;
    }
    if (value !== user.earlier_classes) onClassTracking(classPackage, value);
  }

  const showProgress =
    progress && classPackage && user.lesson_access !== "lifetime";

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-accent/50 [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
            {eligible && (
              <Badge variant="default">Qualifies for lifetime access</Badge>
            )}
            {user.role === "admin" && <Badge variant="secondary">admin</Badge>}
            <LessonAccessBadge access={user.lesson_access} />
          </div>
        </div>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="flex flex-col gap-4 border-t bg-muted/30 px-4 py-4 text-sm">
        <div className="grid gap-1.5 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-6">
          <span className="text-muted-foreground">Lessons</span>
          <div className="flex flex-wrap items-center gap-2">
            {user.lesson_access === "none" && (
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onLessonAccess("granted")}
              >
                Give lesson access
              </Button>
            )}
            {user.lesson_access === "granted" && (
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => onLessonAccess("none")}
              >
                Remove lesson access
              </Button>
            )}
            {user.role === "student" &&
              (user.lesson_access === "lifetime" ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onLessonAccess("granted")}
                >
                  Remove lifetime access
                </Button>
              ) : (
                <Button
                  variant={eligible ? "default" : "outline"}
                  size="sm"
                  disabled={disabled}
                  onClick={() => onLessonAccess("lifetime")}
                >
                  Give lifetime access
                </Button>
              ))}
            <span className="text-muted-foreground">
              Opens lessons 5 and up.
            </span>
          </div>
        </div>

        {user.role === "student" && (
          <>
            <div className="grid gap-1.5 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-6">
              <label
                htmlFor={`package-${user.id}`}
                className="text-muted-foreground"
              >
                Class package
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  id={`package-${user.id}`}
                  aria-label={`Class package for ${name}`}
                  className="h-8 rounded-md border bg-background px-2"
                  value={classPackage ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    onClassTracking(
                      e.target.value
                        ? (Number(e.target.value) as ClassPackage)
                        : null,
                      user.earlier_classes ?? 0,
                    )
                  }
                >
                  <option value="">Not set</option>
                  <option value="4">4 classes</option>
                  <option value="8">8 classes</option>
                </select>
                {showProgress && (
                  <span className="text-muted-foreground">
                    {Math.min(progress.completed, progress.needed ?? 0)} of{" "}
                    {progress.needed} classes toward lifetime
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-1.5 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-6">
              <label
                htmlFor={`earlier-${user.id}`}
                className="text-muted-foreground"
              >
                Classes before this app
              </label>
              <Input
                id={`earlier-${user.id}`}
                aria-label={`Classes before this app for ${name}`}
                type="number"
                min={0}
                max={1000}
                inputMode="numeric"
                className="h-8 w-20"
                value={earlier}
                disabled={disabled}
                onChange={(e) => setEarlier(e.target.value)}
                onBlur={saveEarlier}
                onKeyDown={(e) => e.key === "Enter" && saveEarlier()}
              />
            </div>
          </>
        )}

        {!(isSelf && user.role === "admin") && (
          <div className="grid gap-1.5 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-6">
            <span className="text-muted-foreground">Role</span>
            <div>
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() =>
                  onRoleChange(user.role === "admin" ? "student" : "admin")
                }
              >
                Make {user.role === "admin" ? "student" : "admin"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function LessonAccessBadge({ access }: { access: LessonAccess }) {
  if (access === "none")
    return <Badge variant="outline">No lesson access</Badge>;
  const label = {
    granted: "Lesson access",
    subscriber: "Subscriber",
    lifetime: "Lifetime access",
  }[access];
  return <Badge variant="success">{label}</Badge>;
}
