import webpush from "web-push";

import { VAPID_SUBJECT } from "@/lib/admin-push";
import { createServerJobClient } from "@/lib/integration-status";
import { translate } from "@/i18n/translate";
import type { SiteLanguage } from "@/lib/prefs";

/**
 * The daily practice reminder (Trevor, 2026-10-08): pg_cron asks for it a few
 * minutes past every hour (private.request_practice_pushes), and
 * claim_practice_pushes hands back the devices of the students whose hour it
 * is, already marked sent for today. The text is in the student's site
 * language; tapping it opens the activities site's #/daily.
 */

type Push = { endpoint: string; p256dh: string; auth: string; size: number; site_language: SiteLanguage | null };
type Claimed = { pushes: Push[]; vapid_public_key: string | null; vapid_private_key: string | null };

export async function sendPracticePushes(secret: string) {
  const supabase = createServerJobClient();
  const { data, error } = await supabase.rpc("claim_practice_pushes", { p_secret: secret });
  if (error) throw new Error(`claim_practice_pushes: ${error.message}`);
  const claimed = data as unknown as Claimed;
  if (!claimed.pushes.length) return { sent: 0 };
  if (!claimed.vapid_public_key || !claimed.vapid_private_key) throw new Error("The push keys are missing.");
  const options = {
    vapidDetails: { subject: VAPID_SUBJECT, publicKey: claimed.vapid_public_key, privateKey: claimed.vapid_private_key },
    // A reminder that arrives the next day is no use.
    TTL: 60 * 60 * 12,
  };

  let sent = 0;
  await Promise.all(
    claimed.pushes.map(async (push) => {
      const lang = push.site_language ?? "en";
      const payload = JSON.stringify({
        title: translate(lang, "Today's practice"),
        body: translate(lang, "Your {n} activities for today are ready.", { n: push.size }),
        tag: "daily-practice",
        url: "/activities/#/daily",
      });
      try {
        await webpush.sendNotification({ endpoint: push.endpoint, keys: { p256dh: push.p256dh, auth: push.auth } }, payload, options);
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // The device unsubscribed or the browser was reset: forget it.
          await supabase.rpc("drop_practice_push", { p_secret: secret, p_endpoint: push.endpoint });
        } else {
          console.error("[practice] push failed:", status, err instanceof Error ? err.message : err);
        }
      }
    }),
  );
  return { sent };
}
