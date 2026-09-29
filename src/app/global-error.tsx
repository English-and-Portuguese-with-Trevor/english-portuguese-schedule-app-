"use client";

import { useEffect } from "react";

import "./globals.css";
import { StatusPage } from "@/components/status-page";
import { tr } from "@/i18n/translate";
import { applyThemeAttribute, readPrefs } from "@/lib/prefs";

// Shown when the root layout itself fails, so it brings its own <html> and
// applies dark mode itself (THEME_SCRIPT is in the layout it replaces).
export default function GlobalError({ retry }: { retry: () => void }) {
  useEffect(() => applyThemeAttribute(readPrefs().theme), []);
  return (
    <html lang="en">
      <body className="min-h-full flex flex-col antialiased">
        <StatusPage
          title={tr("Something went wrong")}
          message={tr("Please try again in a moment. If it keeps happening, let Trevor know.")}
          retry={retry}
        />
      </body>
    </html>
  );
}
