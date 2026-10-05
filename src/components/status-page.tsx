"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Ribbons } from "@/components/ribbons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { useCookieLanguage } from "@/i18n/cookie-language";

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
  // These pages show outside AppShell (and may show when nothing else works), so
  // the site language comes from the shared cookie or the browser, like /login.
  const { lang, t } = useCookieLanguage();

  return (
    <main lang={lang} className="flex min-h-svh items-center justify-center p-6">
      <Card className="stage stage-soft w-full max-w-sm">
        <Ribbons at={7} />
        <CardHeader>
          <h1 className="title text-2xl">{t(title)}</h1>
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
    </main>
  );
}
