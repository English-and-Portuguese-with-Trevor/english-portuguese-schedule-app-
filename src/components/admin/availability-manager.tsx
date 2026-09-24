"use client";

import { useState, useTransition } from "react";

import {
  createAvailabilityRule,
  deleteAvailabilityRule,
  toggleAvailabilityRule,
} from "@/lib/actions/availability";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAY_NAMES, type AvailabilityRule } from "@/lib/types";

export function AvailabilityManager({ initialRules }: { initialRules: AvailabilityRule[] }) {
  const [rules, setRules] = useState(initialRules);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    dayOfWeek: "1",
    startTime: "09:00",
    endTime: "17:00",
    slotDurationMinutes: "45",
    timezone: "America/Los_Angeles",
  });

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createAvailabilityRule({
        dayOfWeek: Number(form.dayOfWeek),
        startTime: `${form.startTime}:00`,
        endTime: `${form.endTime}:00`,
        slotDurationMinutes: Number(form.slotDurationMinutes),
        timezone: form.timezone,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  function handleToggle(id: string, next: boolean) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: next } : r)));
    startTransition(() => {
      void toggleAvailabilityRule(id, next);
    });
  }

  function handleDelete(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    startTransition(() => {
      void deleteAvailabilityRule(id);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Availability</h1>
        <p className="text-sm text-muted-foreground">
          Set your recurring weekly windows for 1:1 sessions. Students see open start times
          computed from these windows minus existing bookings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a weekly window</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label>Day</Label>
            <Select value={form.dayOfWeek} onValueChange={(v) => setForm({ ...form, dayOfWeek: v })}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((name, i) => (
                  <SelectItem key={name} value={String(i)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Start time</Label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>End time</Label>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Duration (min)</Label>
            <Input
              type="number"
              min={5}
              className="w-24"
              value={form.slotDurationMinutes}
              onChange={(e) => setForm({ ...form, slotDurationMinutes: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Timezone</Label>
            <Input
              className="w-52"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </div>
          <Button onClick={handleCreate} disabled={isPending}>
            Add window
          </Button>
        </CardContent>
        {error && <p className="px-6 pb-4 text-sm text-destructive">{error}</p>}
      </Card>

      <div className="flex flex-col gap-2">
        {rules.length === 0 && (
          <p className="text-sm text-muted-foreground">No availability windows yet.</p>
        )}
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between rounded-md border px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Badge variant={rule.is_active ? "success" : "secondary"}>
                {DAY_NAMES[rule.day_of_week]}
              </Badge>
              <span className="text-sm">
                {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)} ({rule.timezone}) ·{" "}
                {rule.slot_duration_minutes} min slots
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleToggle(rule.id, !rule.is_active)}
              >
                {rule.is_active ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
