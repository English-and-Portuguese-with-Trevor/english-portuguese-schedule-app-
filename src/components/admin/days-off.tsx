"use client";

import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { addDayOff, deleteDayOff } from "@/lib/actions/availability";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DayOff = { id: string; starts_on: string; ends_on: string };

const show = (date: string) => format(parseISO(date), "EEE, MMM d, yyyy");

export function DaysOff({ daysOff }: { daysOff: DayOff[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await addDayOff(startsOn, endsOn || startsOn);
      if (result.error) {
        setError(`Couldn't add the day off: ${result.error}`);
        return;
      }
      setStartsOn("");
      setEndsOn("");
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteDayOff(id);
      if (result.error) {
        setError(`Couldn't remove the day off: ${result.error}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">Days off</h2>
        <p className="text-sm text-muted-foreground">
          No class can be booked on these dates (Denver time), whatever the weekly windows say.
          Classes already booked stay booked.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {daysOff.length === 0 ? (
        <p className="text-sm text-muted-foreground">No days off coming up.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {daysOff.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-2">
              <span className="text-sm">
                {d.starts_on === d.ends_on ? show(d.starts_on) : `${show(d.starts_on)} – ${show(d.ends_on)}`}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-destructive"
                disabled={isPending}
                onClick={() => handleDelete(d.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="day-off-start">First day</Label>
          <Input id="day-off-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="day-off-end">Last day</Label>
          <Input
            id="day-off-end"
            type="date"
            min={startsOn || undefined}
            value={endsOn || startsOn}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </div>
        <Button onClick={handleAdd} disabled={isPending || !startsOn}>
          Add day off
        </Button>
      </div>
    </section>
  );
}
