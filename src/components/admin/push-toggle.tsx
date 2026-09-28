"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { deletePushSubscription, getPushPublicKey, savePushSubscription } from "@/lib/actions/alerts";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function base64UrlToBytes(value: string) {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** Turns push notifications for new alerts on or off for this device. */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // iPhones only offer push to sites added to the home screen.
        setState(isIos() && !isInstalled() ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      setState(subscription ? "on" : "off");
    })();
  }, []);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const { key, error: keyError } = await getPushPublicKey();
      if (!key) throw new Error(keyError ?? "No push key.");

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(key),
      });
      const json = subscription.toJSON();
      const { error: saveError } = await savePushSubscription({
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });
      if (saveError) {
        await subscription.unsubscribe();
        throw new Error(saveError);
      }
      setState("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border p-4">
      <h2 className="font-semibold">Push notifications</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {state === "loading" && "Checking this device…"}
        {state === "on" && "On for this device. You'll get a notification for each new sign-up and subscriber."}
        {state === "off" && "Get a notification on this device for each new sign-up and subscriber. Turn it on on every phone or computer you want them on."}
        {state === "denied" &&
          "Notifications are blocked for this site. Allow them in your browser's site settings, then reload this page."}
        {state === "ios-install" &&
          "On an iPhone, first add this site to your home screen (Share, then Add to Home Screen), open it from there, and come back to this page."}
        {state === "unsupported" && "This browser can't receive push notifications."}
      </p>
      {(state === "off" || state === "on") && (
        <Button
          className="mt-3"
          variant={state === "on" ? "outline" : "default"}
          disabled={busy}
          onClick={() => void (state === "on" ? turnOff() : turnOn())}
        >
          {state === "on" ? <BellOff aria-hidden /> : <Bell aria-hidden />}
          {state === "on" ? "Turn off on this device" : "Turn on push notifications"}
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
