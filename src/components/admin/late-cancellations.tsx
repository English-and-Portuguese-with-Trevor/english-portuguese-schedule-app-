import { differenceInMinutes, format } from "date-fns";

import { LATE_CANCEL_HOURS, LATE_CANCEL_LIST_DAYS } from "@/lib/types";

export interface LateCancellationRow {
  id: string;
  student_id: string;
  cancelled_at: string | null;
  session_slots: { start_time: string } | null;
}

function noticeGiven(cancelledAt: string, startTime: string) {
  const minutes = differenceInMinutes(new Date(startTime), new Date(cancelledAt));
  if (minutes < 60) return `${Math.max(minutes, 0)} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

export function LateCancellations({
  rows,
  displayNames,
}: {
  rows: LateCancellationRow[];
  displayNames: Record<string, string>;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">Late cancellations ({rows.length})</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Confirmed sessions a student cancelled less than {LATE_CANCEL_HOURS} hours ahead. These still count as
        a class. Each one clears after {LATE_CANCEL_LIST_DAYS} days.
      </p>
      <div className="flex flex-col gap-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">None in the last week.</p>}
        {rows.map((b) => (
          <div key={b.id} className="rounded-md border px-4 py-3">
            <p className="text-sm font-medium">{displayNames[b.student_id] ?? "Unknown"}</p>
            {b.session_slots && (
              <p className="text-sm text-muted-foreground">
                {format(new Date(b.session_slots.start_time), "EEE, MMM d 'at' h:mm a")}
                {b.cancelled_at && ` · cancelled ${noticeGiven(b.cancelled_at, b.session_slots.start_time)} before`}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
