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
  setAppUses,
  setEmailChoices,
  setLearningLanguage,
  setSiteLanguage,
  setStartPage,
  setTheme,
  START_LABELS,
  type ArticleDelivery,
  type ClassUpdateDelivery,
  type SummaryDelivery,
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
import {
  getInstallState,
  promptInstall,
  subscribeInstallState,
} from "@/lib/install-prompt";
import { loadClient } from "@/lib/supabase/load-client";
import type { LessonAccess, Role } from "@/lib/types";

type Page = "preferences" | "notifications" | "uses" | "account";

const PAGE_TITLES: Record<Page, string> = {
  preferences: "Preferences",
  notifications: "Notifications",
  uses: "What I use the app for",
  account: "Account",
};

/** Reads the JSON error an edge function returned with a non-2xx status. */
async function functionError(error: { message: string; context?: unknown }) {
  const context = error.context as
    | { json?: () => Promise<{ error?: string }> }
    | undefined;
  const body = await context?.json?.().catch(() => null);
  return body?.error || error.message;
}

/**
 * Settings, the same short menu on every site: Preferences › (look and
 * languages), Get the app, Notifications › (Daily practice reminder, Emails),
 * What I use the app for ›, Account › (name, email, lesson access), Manage
 * subscription (Stripe customer portal), Delete account and Log out.
 */
export function AccountSettings({
  name,
  email,
  role,
  lessonAccess,
  billing,
  articleDelivery = "app",
  summaryDelivery = "email",
  classUpdateDelivery = "email",
  appUses = [],
  startPage = null,
}: {
  name: string | null;
  email: string | null;
  role: Role;
  lessonAccess: LessonAccess;
  billing: BillingSummary | null;
  /** The profile's email choices (Preferences > Emails); the database's defaults when not given. */
  articleDelivery?: ArticleDelivery;
  summaryDelivery?: SummaryDelivery;
  classUpdateDelivery?: ClassUpdateDelivery;
  /** The profile's app_uses and start_page (Preferences > What I use the app for). */
  appUses?: StartPage[];
  startPage?: StartPage | null;
}) {
  const [billingError, setBillingError] = useState<string | null>(null);
  const [opening, startOpening] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [page, setPage] = useState<Page | null>(null);
  const router = useRouter();
  const t = useT();
  const lang = useSiteLanguage();

  // Ask Stripe for the latest once per visit, so a cancel made in the Stripe
  // portal shows here even if its webhook message went missing.
  useEffect(() => {
    let cancelled = false;
    loadClient()
      .then((supabase) => supabase.functions.invoke("billing", { body: { action: "refresh" } }))
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
      const { data, error } = await (await loadClient()).functions.invoke("billing", {
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

  // Settings is a short menu; each page opens on its own.
  if (page) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Button variant="ghost" className="-ml-3 self-start" onClick={() => setPage(null)}>
          ‹ {t("Settings")}
        </Button>
        <h1 className="title -mt-4 text-3xl">
          {t(PAGE_TITLES[page])}
        </h1>
        {page === "preferences" ? (
          <PreferencesCard />
        ) : page === "notifications" ? (
          <NotificationsCard
            hasAccess={role === "admin" || ["granted", "subscriber", "lifetime"].includes(lessonAccess)}
            articleDelivery={articleDelivery}
            summaryDelivery={summaryDelivery}
            classUpdateDelivery={classUpdateDelivery}
          />
        ) : page === "uses" ? (
          <Card>
            <CardContent className="flex flex-col divide-y">
              <AppUses appUses={appUses} startPage={startPage} />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardDescription>
                {t("The same account works on every site.")}
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
      <h1 className="title -mt-4 text-3xl">{t("Settings")}</h1>

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="h-12 w-full justify-between"
          onClick={() => setPage("preferences")}
        >
          {t("Preferences")}
          <span aria-hidden>›</span>
        </Button>
        <InstallRow />
        {(["notifications", "uses", "account"] as const).map((p) => (
          <Button
            key={p}
            variant="outline"
            className="h-12 w-full justify-between"
            onClick={() => setPage(p)}
          >
            {t(PAGE_TITLES[p])}
            <span aria-hidden>›</span>
          </Button>
        ))}
        <Button
          variant="outline"
          className="h-12 w-full justify-start"
          onClick={manageSubscription}
          disabled={opening}
        >
          {opening ? t("Opening…") : t("Manage subscription")}
        </Button>
        {/* The Stripe portal opens for any account. */}
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
      </div>

      <DeleteAccountDialog
        open={deleteOpen}
        isAdmin={role === "admin"}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}

/**
 * "Get the app" (this site's own install, src/app/manifest.ts): a row where
 * the browser lets a page offer the install, the two taps on an iPhone, and a
 * note once it's installed.
 */
function InstallRow() {
  const t = useT();
  const [state, setState] = useState(getInstallState);
  // Standalone and iPhone are only known in the browser; the server renders nothing.
  const [device, setDevice] = useState<{ standalone: boolean; ios: boolean } | null>(null);
  useEffect(() => subscribeInstallState(setState), []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only checks after hydration
    setDevice({
      standalone:
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (window.navigator as { standalone?: boolean }).standalone === true,
      ios: /iphone|ipad|ipod/i.test(window.navigator.userAgent),
    });
  }, []);
  if (!device) return null;
  if (state.installed || device.standalone) {
    return <p className="text-xs text-muted-foreground">{t("Installed as an app")}</p>;
  }
  if (state.prompt) {
    return (
      <Button
        variant="outline"
        className="h-12 w-full justify-start"
        onClick={() => void promptInstall()}
      >
        {t("Get the app")}
      </Button>
    );
  }
  if (device.ios) {
    return (
      <p className="text-xs text-muted-foreground">
        {t("On iPhone: tap Share, then Add to Home Screen.")}
      </p>
    );
  }
  return null;
}

/**
 * Dark mode, the language being learned and the site language; the same
 * settings on every site.
 */
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
          {t("These follow you to every site.")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
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
      </CardContent>
    </Card>
  );
}

/**
 * Everything that reaches the student: the daily practice reminder (set up
 * per device on the activities site; students with lesson access), then the
 * Emails group (new articles, monthly summary, weekly class update).
 */
function NotificationsCard(props: {
  hasAccess: boolean;
  articleDelivery: ArticleDelivery;
  summaryDelivery: SummaryDelivery;
  classUpdateDelivery: ClassUpdateDelivery;
}) {
  const [articles, setArticles] = useState(props.articleDelivery);
  const [summary, setSummary] = useState(props.summaryDelivery);
  const [classUpdate, setClassUpdate] = useState(props.classUpdateDelivery);
  const t = useT();

  return (
    <Card>
      <CardContent className="flex flex-col divide-y">
        {props.hasAccess && (
          <div className="flex flex-col gap-2 pt-5 pb-4">
            <h2 className="text-sm font-semibold">{t("Daily practice reminder")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("One notification a day when your practice set is ready. Not sent on days you’ve done it.")}
            </p>
            <Button variant="outline" className="self-start" asChild>
              <a href={`${LANDING_URL}/activities/#/settings/notifications`}>
                {t("Set it up on Activities")}
              </a>
            </Button>
          </div>
        )}
        <h2 className="pt-5 pb-1 text-sm font-semibold">{t("Emails")}</h2>
        <div className="flex items-center justify-between gap-4 py-3">
          <label htmlFor="article-delivery" className="text-sm font-medium">
            {t("New articles")}
          </label>
          <select
            id="article-delivery"
            value={articles}
            onChange={(e) => {
              const next = e.target.value as ArticleDelivery;
              setArticles(next);
              setEmailChoices(next, summary, classUpdate);
            }}
            className="h-11 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="email">{t("Email me")}</option>
            <option value="app">{t("In the app")}</option>
            <option value="off">{t("Off")}</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <label htmlFor="summary-delivery" className="text-sm font-medium">
            {t("Monthly summary")}
          </label>
          <select
            id="summary-delivery"
            value={summary}
            onChange={(e) => {
              const next = e.target.value as SummaryDelivery;
              setSummary(next);
              setEmailChoices(articles, next, classUpdate);
            }}
            className="h-11 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="email">{t("Email me")}</option>
            <option value="off">{t("Off")}</option>
          </select>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <label htmlFor="class-update-delivery" className="text-sm font-medium">
            {t("Weekly class update")}
          </label>
          <select
            id="class-update-delivery"
            value={classUpdate}
            onChange={(e) => {
              const next = e.target.value as ClassUpdateDelivery;
              setClassUpdate(next);
              setEmailChoices(articles, summary, next);
            }}
            className="h-11 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="email">{t("Email me")}</option>
            <option value="off">{t("Off")}</option>
          </select>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * What I use the app for: every section the student uses (profile app_uses)
 * and, of those, the one the installed app opens on (the account menu's App start).
 */
function AppUses(props: { appUses: StartPage[]; startPage: StartPage | null }) {
  const t = useT();
  const [start, setStart] = useState(props.startPage);
  const [saved, setSaved] = useState(props.appUses);
  // The start page always shows checked.
  const [uses, setUses] = useState(() =>
    START_PAGES.filter((p) => props.appUses.includes(p) || p === props.startPage),
  );

  function save(next: StartPage[]) {
    setUses(next);
    setSaved(next);
    setAppUses(next);
  }

  function toggle(page: StartPage, checked: boolean) {
    save(START_PAGES.filter((p) => (p === page ? checked : uses.includes(p))));
    if (checked && !start) choose(page);
  }

  function choose(page: StartPage) {
    setStartPage(page);
    setStart(page);
  }

  return (
    <>
      <div className="pt-5 pb-2">
        <p className="text-sm text-muted-foreground">
          {t("Check every section you use, and pick the one the app opens on.")}
        </p>
      </div>
      {START_PAGES.map((page) => {
        const checked = uses.includes(page);
        return (
          <div key={page} className="flex min-h-11 items-center justify-between gap-4 py-1">
            <label className="flex min-h-11 flex-1 items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="size-5 accent-primary"
                checked={checked}
                disabled={page === start}
                onChange={(e) => toggle(page, e.target.checked)}
              />
              {t(START_LABELS[page])}
            </label>
            {checked && (
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="app-start"
                  className="size-5 accent-primary"
                  checked={page === start}
                  onChange={() => {
                    choose(page);
                    if (!saved.includes(page)) save(uses);
                  }}
                />
                {t("Opens here")}
              </label>
            )}
          </div>
        );
      })}
      {start && (
        <p className="pt-3 text-sm font-medium">
          {t("The app will open on {page}.", { page: t(START_LABELS[start]) })}
        </p>
      )}
    </>
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
      const supabase = await loadClient();
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
