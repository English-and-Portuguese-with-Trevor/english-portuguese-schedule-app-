"use client";

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
}: {
  initialUsers: Profile[];
  displayNames: Record<string, string>;
  /** Class-set progress by user id (admin_class_progress). */
  progress?: Record<string, ClassProgress>;
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

  function handleRoleChange(userId: string, role: Role) {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    startTransition(() => {
      void updateUserRole(userId, role);
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
          Search and manage student and admin accounts. Lesson access opens
          lessons 5 and up on the lessons site; new sign-ups start without it.
          Set a student&apos;s class package to track their progress toward
          lifetime access (three class sets). You decide when to give it.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Input
        placeholder="Search by name or email..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="flex flex-col gap-2">
        {users.map((user) => (
          <UserRow
            key={user.id}
            user={user}
            name={displayNames[user.id] ?? "Unknown"}
            progress={progress[user.id]}
            disabled={isPending}
            onLessonAccess={(access) => handleLessonAccess(user, access)}
            onClassTracking={(pkg, earlier) =>
              handleClassTracking(user, pkg, earlier)
            }
            onRoleChange={(role) => handleRoleChange(user.id, role)}
          />
        ))}
        {users.length === 0 && (
          <p className="text-sm text-muted-foreground">No users found.</p>
        )}
      </div>
    </div>
  );
}

function UserRow({
  user,
  name,
  progress,
  disabled,
  onLessonAccess,
  onClassTracking,
  onRoleChange,
}: {
  user: Profile;
  name: string;
  progress: ClassProgress | undefined;
  disabled: boolean;
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

  return (
    <div className="flex flex-col gap-3 rounded-md border px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <LessonAccessBadge access={user.lesson_access} />
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
          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
            {user.role}
          </Badge>
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

      {user.role === "student" && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Package</span>
            <select
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
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">
              Classes before this app
            </span>
            <Input
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
          </label>
          {progress && classPackage && user.lesson_access !== "lifetime" && (
            <span className="text-muted-foreground">
              {Math.min(progress.completed, progress.needed ?? 0)} of{" "}
              {progress.needed} classes toward lifetime
            </span>
          )}
          {eligible && (
            <Badge variant="default">Qualifies for lifetime access</Badge>
          )}
          {user.lesson_access === "lifetime" ? (
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
          )}
        </div>
      )}
    </div>
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
