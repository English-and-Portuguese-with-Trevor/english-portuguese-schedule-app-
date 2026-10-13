"use client";

import { StatusPage } from "@/components/status-page";
import { tr } from "@/i18n/translate";

// Every page shows this while MAINTENANCE_MODE is on (see src/proxy.ts).
export default function Maintenance() {
  return (
    <StatusPage
      title={tr("We're updating the site")}
      message={tr("Scheduling will be back in a few minutes. Your bookings are safe.")}
      retry={() => window.location.reload()}
    />
  );
}
