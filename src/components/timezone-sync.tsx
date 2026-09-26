"use client";

import { useEffect } from "react";

import { setMyTimezone } from "@/lib/actions/profile";

/**
 * Keeps the saved time zone in step with this device, so emails show times
 * where the admin actually is (e.g. after travelling).
 */
export function TimezoneSync({ saved }: { saved: string | null }) {
  useEffect(() => {
    const current = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (current && current !== saved) void setMyTimezone(current);
  }, [saved]);
  return null;
}
