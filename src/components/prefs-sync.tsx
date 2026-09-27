"use client";

import { useEffect } from "react";

import { syncFromProfile } from "@/lib/preferences";

/** Brings the shared preferences cookie in step with the logged-in profile. */
export function PrefsSync({
  theme,
  learningLanguage,
}: {
  theme: string | null;
  learningLanguage: string | null;
}) {
  useEffect(() => {
    syncFromProfile({ theme, learning_language: learningLanguage });
  }, [theme, learningLanguage]);
  return null;
}
