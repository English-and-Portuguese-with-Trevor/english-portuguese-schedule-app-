"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { GoogleIcon } from "@/components/google-icon";
import { Ribbons } from "@/components/ribbons";
import { translator } from "@/i18n/translate";
import { readPrefs, siteLanguage, type SiteLanguage } from "@/lib/prefs";
import { safeNextPath } from "@/lib/safe-next-path";
import { createClient } from "@/lib/supabase/client";
import { sharedLoginUrl } from "@/lib/shared-login";

const noopSubscribe = () => () => {};
// Nobody is logged in here, so the site language comes from the shared
// cookie (or the browser); the server can't know it, so English until hydrated.
const cookieLanguage = () => siteLanguage(readPrefs(), navigator.languages);
const serverLanguage = (): SiteLanguage => "en";

/** Where to go after login: the page that sent us here (see supabase/proxy.ts), else the dashboard. */
function nextPath() {
  return safeNextPath(new URLSearchParams(window.location.search).get("redirect"));
}

export default function LoginPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lang = useSyncExternalStore(noopSubscribe, cookieLanguage, serverLanguage);
  const t = translator(lang);

  useEffect(() => {
    // Stay here only to show a failed Google login, or when running locally.
    if (new URLSearchParams(window.location.search).has("error")) return;
    const url = sharedLoginUrl(window.location, nextPath());
    if (url) {
      window.location.replace(url);
    }
  }, []);

  async function handleGoogleSignIn() {
    setPending(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}`,
      },
    });
    if (error) {
      setError(error.message);
      setPending(false);
    }
  }

  return (
    <main lang={lang} className="flex min-h-svh items-center justify-center p-6">
      <Card className="stage stage-soft w-full max-w-sm">
        <Ribbons animate at={3} />
        <CardHeader>
          <p className="title text-xl leading-tight">
            English <em className="text-brand-accent">&amp;</em> Portuguese
            <br />
            with Trevor
          </p>
          <h1 className="pt-3 text-lg font-semibold leading-none tracking-tight">{t("Welcome")}</h1>
          <CardDescription>
            {t("Log in with your Google account or your email and password.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button
            onClick={handleGoogleSignIn}
            disabled={pending}
            className="gap-2.5"
          >
            {/* White circle so Google's colors read on the dark button. */}
            <span className="flex size-5 items-center justify-center rounded-full bg-white">
              <GoogleIcon className="size-3.5" />
            </span>
            {pending ? t("Redirecting...") : t("Log in with Google")}
          </Button>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </main>
  );
}
