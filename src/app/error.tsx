"use client";

import { useEffect } from "react";

import { StatusPage } from "@/components/status-page";
import { tr } from "@/i18n/tr";
import { reportCaught } from "@/lib/error-report";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => reportCaught(error), [error]);
  return (
    <StatusPage
      title={tr("Something went wrong")}
      message={tr("Please try again in a moment. If it keeps happening, let Trevor know.")}
      retry={retry}
    />
  );
}
