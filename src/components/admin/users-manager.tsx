"use client";

import { useState, useTransition } from "react";

import { searchUsers, updateUserRole } from "@/lib/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Profile, Role } from "@/lib/types";

export function UsersManager({ initialUsers }: { initialUsers: Profile[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">Search and manage student and admin accounts.</p>
      </div>

      <Input
        placeholder="Search by name or email..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="max-w-sm"
      />

      <div className="flex flex-col gap-2">
        {users.map((user) => (
          <div key={user.id} className="flex items-center justify-between rounded-md border px-4 py-3">
            <div>
              <p className="text-sm font-medium">{user.full_name ?? "Unnamed"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex items-center gap-2">
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
