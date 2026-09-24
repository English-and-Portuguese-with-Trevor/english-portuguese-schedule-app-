"use client";

import { addDays, format } from "date-fns";
import { useState, useTransition } from "react";

import {
  cancelRecurringInstance,
  cancelRecurringSeries,
  createRecurringClass,
} from "@/lib/actions/recurring";
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
import { DAY_NAMES, type RecurringGroup } from "@/lib/types";

interface Instance {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  recurring_group_id: string | null;
}

export function ClassesManager({
  initialGroups,
  instances,
}: {
  initialGroups: RecurringGroup[];
  instances: Instance[];
}) {
  const [groups, setGroups] = useState(initialGroups);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => {
    const now = new Date();
    return {
      title: "",
      description: "",
      dayOfWeek: "2",
      startTime: "16:00",
      durationMinutes: "60",
      timezone: "America/Denver",
      startsOn: format(now, "yyyy-MM-dd"),
      endsOn: format(addDays(now, 56), "yyyy-MM-dd"),
      maxCapacity: "6",
    };
  });

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createRecurringClass({
        title: form.title,
        description: form.description || undefined,
        dayOfWeek: Number(form.dayOfWeek),
        startTime: `${form.startTime}:00`,
        durationMinutes: Number(form.durationMinutes),
        timezone: form.timezone,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
        maxCapacity: Number(form.maxCapacity),
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      window.location.reload();
    });
  }

  function handleCancelSeries(id: string) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, is_active: false } : g)));
    startTransition(() => {
      void cancelRecurringSeries(id);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Recurring classes</h1>
        <p className="text-sm text-muted-foreground">
          Create a class series (e.g. &ldquo;Every Tuesday at 4 PM for 8 weeks&rdquo;). Each week
          generates its own session so you can cancel a single class without breaking the series.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New class series</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Max capacity</Label>
              <Input
                type="number"
                min={1}
                value={form.maxCapacity}
                onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-2">
              <Label>Day</Label>
              <Select
                value={form.dayOfWeek}
                onValueChange={(v) => setForm({ ...form, dayOfWeek: v })}
              >
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
              <Label>Duration (min)</Label>
              <Input
                type="number"
                min={5}
                className="w-24"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
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
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-2">
              <Label>Starts on</Label>
              <Input
                type="date"
                value={form.startsOn}
                onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Ends on</Label>
              <Input
                type="date"
                value={form.endsOn}
                onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
              />
            </div>
            <Button onClick={handleCreate} disabled={isPending || !form.title}>
              Create series
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        {groups.length === 0 && (
          <p className="text-sm text-muted-foreground">No recurring classes yet.</p>
        )}
        {groups.map((group) => {
          const groupInstances = instances.filter((i) => i.recurring_group_id === group.id);
          return (
            <Card key={group.id}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{group.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {DAY_NAMES[group.day_of_week]} {group.start_time.slice(0, 5)} ·{" "}
                    {group.duration_minutes} min · cap {group.max_capacity}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={group.is_active ? "success" : "secondary"}>
                    {group.is_active ? "Active" : "Cancelled"}
                  </Badge>
                  {group.is_active && (
                    <Button variant="outline" size="sm" onClick={() => handleCancelSeries(group.id)}>
                      Cancel series
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 pt-0">
                {groupInstances.map((inst) => (
                  <Badge
                    key={inst.id}
                    variant={inst.status === "OPEN" ? "outline" : "secondary"}
                    className="cursor-pointer"
                    onClick={() =>
                      inst.status === "OPEN" &&
                      startTransition(() => {
                        void cancelRecurringInstance(inst.id);
                      })
                    }
                  >
                    {format(new Date(inst.start_time), "MMM d")}
                    {inst.status !== "OPEN" ? " (cancelled)" : ""}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
