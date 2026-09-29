"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { translator } from "@/i18n/translate";
import { readPrefs, siteLanguage, type SiteLanguage } from "@/lib/prefs";

const noopSubscribe = () => () => {};
// These pages show outside AppShell (and may show when nothing else works), so
// the site language comes from the shared cookie or the browser, like /login.
const cookieLanguage = () => siteLanguage(readPrefs(), navigator.languages);
const serverLanguage = (): SiteLanguage => "en";

/**
 * The page people see instead of a bare error: not found, something broke, or
 * the site is being updated. `title` and `message` are English, marked with tr().
 * With `retry` the button tries again; without it, it goes to the home page.
 */
export function StatusPage({
  title,
  message,
  retry,
}: {
  title: string;
  message: string;
  retry?: () => void;
}) {
  const lang = useSyncExternalStore(noopSubscribe, cookieLanguage, serverLanguage);
  const t = translator(lang);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t(title)}</CardTitle>
          <CardDescription>{t(message)}</CardDescription>
        </CardHeader>
        <CardContent>
          {retry ? (
            <Button onClick={retry}>{t("Try again")}</Button>
          ) : (
            <Button asChild>
              <Link href="/">{t("Go to the home page")}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
