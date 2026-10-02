import webpush from "web-push";

import { pushMessage, type AlertRow } from "@/lib/alerts";
import { isGoogleConfigured } from "@/lib/google";
import { createServerJobClient } from "@/lib/integration-status";
import { emails, sendNotification } from "@/lib/notifications";

/**
 * Email and push notifications to the admin for new sign-ups, new
 * subscribers and flagged classes (flags are pushed at once but emailed
 * each morning). The database makes the alerts (see the admin_alerts
 * migration) and asks /api/alerts/push to send them; the daily job sends any
 * it missed. The devices and the VAPID keys come from claim_alert_pushes,
 * guarded by CRON_SECRET.
 */

type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string };

type Claimed = {
  alerts: AlertRow[];
  subscriptions: PushSubscriptionRow[];
  vapid_public_key: string | null;
  vapid_private_key: string | null;
};

export const VAPID_SUBJECT = "mailto:englishportuguesewithtrevor@gmail.com";

/**
 * Emails and pushes every alert not sent yet. Claiming marks them sent
 * first, so two calls at once never send one twice; if the email fails they
 * are handed back (unclaim_alert_emails), so the next call, the daily job at
 * the latest, sends them again. Never throws for one bad device or a failed
 * email (those are logged).
 */
export async function sendAlerts(secret: string) {
  const supabase = createServerJobClient();
  const { data, error } = await supabase.rpc("claim_alert_pushes", { p_secret: secret });
  if (error) throw new Error(`claim_alert_pushes: ${error.message}`);
  const claimed = data as unknown as Claimed;
  if (!claimed.alerts.length) return { alerts: 0, emailed: false, sent: 0 };

  // Flagged classes and reported issues are pushed now but emailed in the morning (sendFlagDigest).
  const toEmail = claimed.alerts.filter((a) => a.kind !== "flag" && a.kind !== "report");
  const email = isGoogleConfigured() ? emails.adminAlerts(toEmail) : null;
  const [sent, ok] = await Promise.all([pushAlerts(secret, claimed), sendNotification(email)]);
  if (!ok) await unclaim("unclaim_alert_emails", secret, toEmail);
  return { alerts: claimed.alerts.length, emailed: email !== null && ok, sent };
}

/** Hands back alerts whose email failed, so they're sent again; logged if that fails too. */
async function unclaim(fn: "unclaim_alert_emails" | "unclaim_flag_digest", secret: string, alerts: AlertRow[]) {
  const { error } = await createServerJobClient().rpc(fn, { p_secret: secret, p_ids: alerts.map((a) => a.id) });
  if (error) console.error(`[alerts] ${fn} failed; these alerts weren't emailed:`, alerts.map((a) => a.id), error.message);
}

async function pushAlerts(secret: string, claimed: Claimed) {
  if (!claimed.subscriptions.length) return 0;
  if (!claimed.vapid_public_key || !claimed.vapid_private_key) {
    console.error("[alerts] no push keys yet; turn push on from the admin dashboard (landing site, /admin/#/alerts)");
    return 0;
  }
  const supabase = createServerJobClient();

  const payload = JSON.stringify(pushMessage(claimed.alerts));
  const options = {
    vapidDetails: {
      subject: VAPID_SUBJECT,
      publicKey: claimed.vapid_public_key,
      privateKey: claimed.vapid_private_key,
    },
    TTL: 60 * 60 * 24,
  };

  let sent = 0;
  await Promise.all(
    claimed.subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          options,
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The device unsubscribed or the browser was reset: forget it.
          await supabase.rpc("drop_push_subscription", { p_secret: secret, p_endpoint: sub.endpoint });
        } else {
          console.error("[alerts] push failed:", status, err instanceof Error ? err.message : err);
        }
      }
    }),
  );
  return sent;
}

/**
 * Emails the classes flagged since the last morning email; claim_flag_digest
 * marks them emailed, and a failed email hands them back for the next morning.
 */
export async function sendFlagDigest(secret: string) {
  if (!isGoogleConfigured()) return { flags: 0 };
  const { data, error } = await createServerJobClient().rpc("claim_flag_digest", { p_secret: secret });
  if (error) throw new Error(`claim_flag_digest: ${error.message}`);
  const flags = (data ?? []) as unknown as AlertRow[];
  if (!(await sendNotification(emails.flagDigest(flags)))) {
    await unclaim("unclaim_flag_digest", secret, flags);
    return { flags: 0 };
  }
  return { flags: flags.length };
}

/**
 * A test notification from the admin dashboard to one device that already
 * turned push on (looked up by its endpoint, so nothing else can be reached).
 */
export async function sendTestPush(secret: string, endpoint: string, title: string, body: string) {
  const { data, error } = await createServerJobClient().rpc("test_push_target", {
    p_secret: secret,
    p_endpoint: endpoint,
  });
  if (error) throw new Error(`test_push_target: ${error.message}`);
  const target = data as unknown as { endpoint: string; p256dh: string; auth: string; vapid_public_key: string | null; vapid_private_key: string | null } | null;
  if (!target) return { error: "This device isn't turned on for push. Turn it on above, then try again." };
  if (!target.vapid_public_key || !target.vapid_private_key) return { error: "The push keys are missing." };
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify({ title, body, tag: `test-${Date.now()}` }),
      {
        vapidDetails: { subject: VAPID_SUBJECT, publicKey: target.vapid_public_key, privateKey: target.vapid_private_key },
        TTL: 60 * 5,
      },
    );
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    return { error: `The push service refused it${status ? ` (${status})` : ""}. Turn push off and on again on this device.` };
  }
  return { error: null };
}
