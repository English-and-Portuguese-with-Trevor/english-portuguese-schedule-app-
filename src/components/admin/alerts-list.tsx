"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { CalendarClock, CreditCard, Flag, MessageSquareWarning, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { alertTitle, flagDetails, type AlertRow } from "@/lib/alerts";
import { markAlertsRead } from "@/lib/actions/alerts";

type Alert = AlertRow & { read_at: string | null };

export function AlertsList({ alerts }: { alerts: Alert[] }) {
  // Remember what was unread when the page opened, so it stays marked "New"
  // after the alerts are marked read (which clears the bell).
  const [unread] = useState(() => new Set(alerts.filter((a) => !a.read_at).map((a) => a.id)));

  useEffect(() => {
    if (unread.size) void markAlertsRead();
  }, [unread]);

  if (!alerts.length) {
    return <p className="text-sm text-muted-foreground">No alerts yet.</p>;
  }

  return (
    <ul className="divide-y rounded-lg border">
      {alerts.map((alert) => {
        const Icon =
          alert.kind === "request" ? CalendarClock : alert.kind === "flag" ? Flag : alert.kind === "report" ? MessageSquareWarning : alert.kind === "subscriber" ? CreditCard : UserPlus;
        return (
          <li key={alert.id} className="flex items-start gap-3 p-4">
            <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {alertTitle(alert.kind)}
                {unread.has(alert.id) && <Badge variant="success">New</Badge>}
              </p>
              <p className="truncate text-sm">
                {alert.name || "No name"}
                {alert.email && <span className="text-muted-foreground"> · {alert.email}</span>}
              </p>
              {alert.kind !== "signup" && alert.kind !== "subscriber" && <p className="text-sm">{flagDetails(alert)}</p>}
            </div>
            <time
              dateTime={alert.created_at}
              title={new Date(alert.created_at).toLocaleString()}
              className="shrink-0 text-xs text-muted-foreground"
            >
              {formatDistanceToNowStrict(new Date(alert.created_at), { addSuffix: true })}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
