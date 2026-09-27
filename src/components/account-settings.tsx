"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LANDING_URL } from "@/components/app-shell";
import { logout } from "@/lib/actions/auth";
import {
  accessSummary,
  hasSubscription,
  type BillingSummary,
} from "@/lib/account-summary";
import { setLearningLanguage, setTheme } from "@/lib/preferences";
import { readPrefs, type LearningLanguage, type Prefs } from "@/lib/prefs";
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
  const router = useRouter();

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
          : "Billing is unavailable right now. Please try again.",
      );
    });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <PreferencesCard />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            The same account works on the lessons, flashcards and schedule
            sites.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="break-words">{name || "—"}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="break-all">{email || "—"}</dd>
          </dl>

          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Lessons &amp; subscription</p>
            <p className="text-sm text-muted-foreground">
              {accessSummary(role, lessonAccess, billing)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {hasSubscription(billing) && (
              <Button onClick={manageSubscription} disabled={opening}>
                {opening ? "Opening…" : "Manage subscription"}
              </Button>
            )}
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              Delete account
            </Button>
            <Button variant="outline" onClick={() => void logout()}>
              Log out
            </Button>
          </div>
          {hasSubscription(billing) && (
            <p className="-mt-3 text-xs text-muted-foreground">
              Change your card, see receipts, or cancel. Handled securely by
              Stripe.
            </p>
          )}
          {billingError && (
            <p role="alert" className="text-sm text-destructive">
              {billingError}
            </p>
          )}
        </CardContent>
      </Card>

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
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the browser-only cookie after hydration
    setPrefs(readPrefs());
  }, []);
  const dark = prefs.theme === "dark";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          These follow you to the lessons and flashcards sites too.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        <div className="flex items-center justify-between gap-4 py-3">
          <span id="dark-mode-label" className="text-sm font-medium">
            Dark mode
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
          <label htmlFor="learning-language" className="text-sm font-medium">
            I&apos;m learning
          </label>
          <select
            id="learning-language"
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={prefs.learning ?? ""}
            onChange={(e) => {
              const learning = e.target.value as LearningLanguage;
              setLearningLanguage(learning);
              setPrefs((p) => ({ ...p, learning }));
            }}
          >
            <option value="" disabled>
              Choose…
            </option>
            <option value="Portuguese">Portuguese</option>
            <option value="English">English</option>
          </select>
        </div>
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
          <DialogTitle>Delete account</DialogTitle>
          <DialogDescription>
            This deletes your account on every Trevor site.
          </DialogDescription>
        </DialogHeader>
        {isAdmin ? (
          <p className="text-sm text-muted-foreground">
            Admin accounts can&apos;t be deleted from the app, since that would
            remove the account that manages the schedule, lessons and instructor
            decks.
          </p>
        ) : (
          <>
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              This permanently deletes your account, your class history, your
              flashcard decks and study progress, and cancels any lesson
              subscription. Cancel upcoming classes first. This can&apos;t be
              undone.
            </p>
            <label className="flex flex-col gap-1 text-sm">
              Type DELETE to confirm
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
                {error}
              </p>
            )}
          </>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={deleting} onClick={close}>
            Keep my account
          </Button>
          {!isAdmin && (
            <Button
              variant="destructive"
              disabled={!canDelete || deleting}
              onClick={confirm}
            >
              {deleting ? "Deleting…" : "Permanently delete my account"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
