"use client";

import { useEffect } from "react";

import { syncFromProfile } from "@/lib/preferences";

/** Brings the shared preferences cookie in step with the logged-in profile. */
export function PrefsSync({
  theme,
  learningLanguage,
  siteLanguage,
}: {
  theme: string | null;
  learningLanguage: string | null;
  siteLanguage: string | null;
}) {
  useEffect(() => {
    syncFromProfile({
      theme,
      learning_language: learningLanguage,
      site_language: siteLanguage,
    });
  }, [theme, learningLanguage, siteLanguage]);
  return null;
}
