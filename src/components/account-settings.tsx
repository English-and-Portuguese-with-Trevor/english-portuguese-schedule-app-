"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FlagSelect } from "@/components/flag-select";
import { Input } from "@/components/ui/input";
import { LANDING_URL } from "@/components/app-shell";
import { logout } from "@/lib/actions/auth";
import {
  accessSummary,
  type BillingSummary,
} from "@/lib/account-summary";
import { useSiteLanguage, useT } from "@/i18n/client";
import { tr } from "@/i18n/translate";
import {
  setLearningLanguage,
  setSiteLanguage,
  setStartPage,
  setTheme,
} from "@/lib/preferences";
import {
  readPrefs,
  SITE_LANGUAGES,
  START_PAGES,
  type LearningLanguage,
  type Prefs,
  type SiteLanguage,
  type StartPage,
} from "@/lib/prefs";

// Settings > Preferences > "Open the app on": where the installed app starts.
const START_LABELS: Record<StartPage, string> = {
  lessons: tr("Lessons"),
  flashcards: tr("Flashcards"),
  activities: tr("Activities"),
  dailies: tr("Daily puzzles"),
};
import { createClient } from "@/lib/supabase/client";
import type { LessonAccess, Role } from "@/lib/types";

/** Reads the JSON error an edge function returned with a non-2xx status. */
async function functionError(error: { message: string; context?: unknown }) {
  const context = error.context as
    | { json?: () => Promise<{ error?: string }> }
    | undefined;
  const body = await context?.json?.().catch(() => null);
  return body?.error || error.message;
}

/**
 * Settings > Account, the same on every site: lesson access, Manage
 * subscription (Stripe customer portal) and Delete account.
 */
export function AccountSettings({
  name,
  email,
  role,
  lessonAccess,
  billing,
}: {
  name: string | null;
  email: string | null;
  role: Role;
  lessonAccess: LessonAccess;
  billing: BillingSummary | null;
}) {
  const [billingError, setBillingError] = useState<string | null>(null);
  const [opening, startOpening] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [page, setPage] = useState<"preferences" | "account" | null>(null);
  const router = useRouter();
  const t = useT();
  const lang = useSiteLanguage();

  // Ask Stripe for the latest once per visit, so a cancel made in the Stripe
  // portal shows here even if its webhook message went missing.
  useEffect(() => {
    let cancelled = false;
    createClient()
      .functions.invoke("billing", { body: { action: "refresh" } })
      .then(({ data, error }) => {
        if (!cancelled && !error && data?.synced) router.refresh();
      })
      .catch(() => {
        // Stripe unreachable: keep showing what's saved.
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  function manageSubscription() {
    setBillingError(null);
    startOpening(async () => {
      const { data, error } = await createClient().functions.invoke("billing", {
        body: { action: "portal", returnUrl: window.location.href },
      });
      if (data?.url) {
        window.location.assign(data.url);
        return;
      }
      setBillingError(
        error
          ? await functionError(error)
          : tr("Billing is unavailable right now. Please try again."),
      );
    });
  }

  // Settings is a short menu; Preferences and Account each open their own page.
  if (page) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Button variant="ghost" className="-ml-3 self-start" onClick={() => setPage(null)}>
          ‹ {t("Settings")}
        </Button>
        <h1 className="-mt-4 text-2xl font-semibold">
          {page === "preferences" ? t("Preferences") : t("Account")}
        </h1>
        {page === "preferences" ? (
          <PreferencesCard />
        ) : (
          <Card>
            <CardHeader>
              <CardDescription>
                {t("The same account works on the lessons, flashcards and schedule sites.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">{t("Name")}</dt>
                <dd className="break-words">{name || "—"}</dd>
                <dt className="text-muted-foreground">{t("Email")}</dt>
                <dd className="break-all">{email || "—"}</dd>
              </dl>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{t("Lessons & subscription")}</p>
                <p className="text-sm text-muted-foreground">
                  {accessSummary(role, lessonAccess, billing, lang)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {/* Back to this site's home, like every site's Settings. */}
      <Button variant="ghost" className="-ml-3 self-start" asChild>
        <Link href={role === "admin" ? "/admin" : "/dashboard"}>‹ {t("Back")}</Link>
      </Button>
      <h1 className="-mt-4 text-2xl font-semibold">{t("Settings")}</h1>

      {/* The Stripe portal opens for any account (card, receipts, cancel). */}
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="h-12 w-full justify-between"
          onClick={() => setPage("preferences")}
        >
          {t("Preferences")}
          <span aria-hidden>›</span>
        </Button>
        <Button
          variant="outline"
          className="h-12 w-full justify-between"
          onClick={() => setPage("account")}
        >
          {t("Account")}
          <span aria-hidden>›</span>
        </Button>
        <Button
          variant="outline"
          className="h-12 w-full justify-start"
          onClick={manageSubscription}
          disabled={opening}
        >
          {opening ? t("Opening…") : t("Manage subscription")}
        </Button>
        <Button
          variant="outline"
          className="h-12 w-full justify-start text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          {t("Delete account")}
        </Button>
        <Button
          variant="outline"
          className="h-12 w-full justify-start border-logout-border bg-logout text-logout-foreground hover:bg-logout-hover hover:text-logout-foreground"
          onClick={() => void logout()}
        >
          {t("Log out")}
        </Button>
        <p className="text-xs text-muted-foreground">
          {t(
            "Change your card, see receipts, or cancel. Handled securely by Stripe.",
          )}
        </p>
        {billingError && (
          <p role="alert" className="text-sm text-destructive">
            {t(billingError)}
          </p>
        )}
      </div>

      <DeleteAccountDialog
        open={deleteOpen}
        isAdmin={role === "admin"}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}

/** Dark mode and the language being learned; the same settings on every site. */
function PreferencesCard() {
  // The cookie is only readable in the browser; the server renders the defaults.
  const [prefs, setPrefs] = useState<Prefs>({});
  const t = useT();
  const siteLanguage = useSiteLanguage();
  const router = useRouter();
  const [savingLanguage, startSavingLanguage] = useTransition();
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the browser-only cookie after hydration
    setPrefs(readPrefs());
  }, []);
  const dark = prefs.theme === "dark";

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          {t("These follow you to the home, lessons and flashcards sites too.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        <div className="flex items-center justify-between gap-4 py-3">
          <span id="site-language-label" className="text-sm font-medium">
            {t("Site language")}
          </span>
          <FlagSelect
            id="site-language"
            labelId="site-language-label"
            value={siteLanguage}
            options={SITE_LANGUAGES.map((l) => ({
              value: l.code,
              label: l.label,
              flag: l.flag,
              lang: l.code,
            }))}
            disabled={savingLanguage}
            onChange={(next: SiteLanguage) => {
              // Save first, then re-render the pages in the new language.
              startSavingLanguage(async () => {
                await setSiteLanguage(next);
                router.refresh();
              });
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <span id="dark-mode-label" className="text-sm font-medium">
            {t("Dark mode")}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={dark}
            aria-labelledby="dark-mode-label"
            onClick={() => {
              const theme = dark ? "light" : "dark";
              setTheme(theme);
              setPrefs((p) => ({ ...p, theme }));
            }}
            className={`relative h-7 w-12 shrink-0 rounded-full border-2 transition-colors ${
              dark
                ? "border-primary bg-primary"
                : "border-muted-foreground bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full transition-all ${
                dark
                  ? "left-[1.35rem] bg-primary-foreground"
                  : "left-0.5 bg-muted-foreground"
              }`}
            />
          </button>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <span id="learning-language-label" className="text-sm font-medium">
            {t("I'm learning")}
          </span>
          <FlagSelect
            id="learning-language"
            labelId="learning-language-label"
            value={prefs.learning}
            placeholder={t("Choose…")}
            options={[
              { value: "Portuguese", label: t("Portuguese"), flag: "/flags/br.svg" },
              { value: "English", label: t("English"), flag: "/flags/us.svg" },
            ]}
            onChange={(learning: LearningLanguage) => {
              setLearningLanguage(learning);
              setPrefs((p) => ({ ...p, learning }));
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <label htmlFor="start-page" className="text-sm font-medium">
            {t("Open the app on")}
          </label>
          <select
            id="start-page"
            value={prefs.start ?? ""}
            onChange={(e) => {
              const start = e.target.value as StartPage;
              setStartPage(start);
              setPrefs((p) => ({ ...p, start }));
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {!prefs.start && <option value="">{t("Choose…")}</option>}
            {START_PAGES.map((p) => (
              <option key={p} value={p}>
                {t(START_LABELS[p])}
              </option>
            ))}
          </select>
        </div>
        <p className="pt-3 text-sm text-muted-foreground">
          {t("Where the app opens when started from its icon.")}
        </p>
      </CardContent>
    </Card>
  );
}

function DeleteAccountDialog({
  open,
  isAdmin,
  onClose,
}: {
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, startDeleting] = useTransition();
  const canDelete = confirmText.trim().toUpperCase() === "DELETE";
  const t = useT();

  function close() {
    setConfirmText("");
    setError(null);
    onClose();
  }

  function confirm() {
    if (!canDelete) return;
    setError(null);
    startDeleting(async () => {
      const supabase = createClient();
      const { error: fnError } = await supabase.functions.invoke(
        "delete-account",
        { method: "POST" },
      );
      if (fnError) {
        setError(await functionError(fnError));
        return;
      }
      await supabase.auth.signOut({ scope: "local" });
      window.location.assign(LANDING_URL);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !deleting && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Delete account")}</DialogTitle>
          <DialogDescription>
            {t("This deletes your account on every Trevor site.")}
          </DialogDescription>
        </DialogHeader>
        {isAdmin ? (
          <p className="text-sm text-muted-foreground">
            {t(
              "Admin accounts can't be deleted from the app, since that would remove the account that manages the schedule, lessons and instructor decks.",
            )}
          </p>
        ) : (
          <>
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
              {t(
                "This permanently deletes your account, your class history, your flashcard decks and study progress, and cancels any lesson subscription. Cancel upcoming classes first. This can't be undone.",
              )}
            </p>
            <label className="flex flex-col gap-1 text-sm">
              {t("Type DELETE to confirm")}
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {t(error)}
              </p>
            )}
          </>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={deleting} onClick={close}>
            {t("Keep my account")}
          </Button>
          {!isAdmin && (
            <Button
              variant="destructive"
              disabled={!canDelete || deleting}
              onClick={confirm}
            >
              {deleting ? t("Deleting…") : t("Permanently delete my account")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
