"use client";

import { useState, useTransition } from "react";

import { searchUsers, setLessonAccess, updateUserRole } from "@/lib/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Profile, Role } from "@/lib/types";

export function UsersManager({
  initialUsers,
  displayNames,
}: {
  initialUsers: Profile[];
  displayNames: Record<string, string>;
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

  function handleLessonAccess(user: Profile, granted: boolean) {
    const previous = user.lesson_access;
    setError(null);
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, lesson_access: granted ? "granted" : "none" } : u)),
    );
    startTransition(async () => {
      const result = await setLessonAccess(user.id, granted);
      if (result.error) {
        setError(result.error);
        setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, lesson_access: previous } : u)));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">
          Search and manage student and admin accounts. Lesson access opens lessons 5 and up on the
          lessons site; new sign-ups start without it.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">Couldn&apos;t change lesson access: {error}</p>}

      <Input
        placeholder="Search by name or email..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="flex flex-col gap-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{displayNames[user.id] ?? "Unknown"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <LessonAccessBadge access={user.lesson_access} />
              {user.lesson_access !== "subscriber" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleLessonAccess(user, user.lesson_access === "none")}
                >
                  {user.lesson_access === "none" ? "Give lesson access" : "Remove lesson access"}
                </Button>
              )}
              <Badge variant={user.role === "admin" ? "default" : "secondary"}>{user.role}</Badge>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleRoleChange(user.id, user.role === "admin" ? "student" : "admin")}
              >
                Make {user.role === "admin" ? "student" : "admin"}
              </Button>
            </div>
          </div>
        ))}
        {users.length === 0 && <p className="text-sm text-muted-foreground">No users found.</p>}
      </div>
    </div>
  );
}

function LessonAccessBadge({ access }: { access: Profile["lesson_access"] }) {
  if (access === "none") return <Badge variant="outline">No lesson access</Badge>;
  return <Badge variant="success">{access === "subscriber" ? "Subscriber" : "Lesson access"}</Badge>;
}
