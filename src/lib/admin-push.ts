import webpush from "web-push";

import { pushMessage, type AlertRow } from "@/lib/alerts";
import { createServerJobClient } from "@/lib/integration-status";

/**
 * Push notifications to the admin for new sign-ups and new subscribers.
 * The database makes the alerts (see the admin_alerts migration) and asks
 * /api/alerts/push to send them; the devices and the VAPID keys come from
 * claim_alert_pushes, guarded by CRON_SECRET.
 */

type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string };

type Claimed = {
  alerts: AlertRow[];
  subscriptions: PushSubscriptionRow[];
  vapid_public_key: string | null;
  vapid_private_key: string | null;
};

export const VAPID_SUBJECT = "mailto:englishportuguesewithtrevor@gmail.com";

/** Sends every alert not pushed yet to every admin device. Never throws for one bad device. */
export async function sendAlertPushes(secret: string) {
  const supabase = createServerJobClient();
  const { data, error } = await supabase.rpc("claim_alert_pushes", { p_secret: secret });
  if (error) throw new Error(`claim_alert_pushes: ${error.message}`);
  const claimed = data as unknown as Claimed;

  if (!claimed.alerts.length || !claimed.subscriptions.length) return { alerts: claimed.alerts.length, sent: 0 };
  if (!claimed.vapid_public_key || !claimed.vapid_private_key) {
    console.error("[alerts] no push keys yet; turn push on from /admin/alerts");
    return { alerts: claimed.alerts.length, sent: 0 };
  }

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
  return { alerts: claimed.alerts.length, sent };
}

/** Makes a push key pair and saves it, unless one is saved already (set_vapid_keys never replaces one). */
export async function createVapidKeys(secret: string) {
  const keys = webpush.generateVAPIDKeys();
  const { error } = await createServerJobClient().rpc("set_vapid_keys", {
    p_secret: secret,
    p_public: keys.publicKey,
    p_private: keys.privateKey,
  });
  if (error) throw new Error(`set_vapid_keys: ${error.message}`);
}
