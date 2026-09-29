"use client";

import { StatusPage } from "@/components/status-page";
import { tr } from "@/i18n/translate";

export default function Error({ retry }: { retry: () => void }) {
  return (
    <StatusPage
      title={tr("Something went wrong")}
      message={tr("Please try again in a moment. If it keeps happening, let Trevor know.")}
      retry={retry}
    />
  );
}
