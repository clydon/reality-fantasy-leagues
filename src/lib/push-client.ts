"use client";

import { api } from "@/lib/api";

// Browser-side half of Web Push. The server half (push-core.js) sends; this is what gets a device
// subscribed in the first place. Every function here is safe to call from any browser, including
// ones with no push support at all -- isPushSupported() is the one callers must check first.

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

// True once the app is running as an installed PWA, not a browser tab -- iOS has no
// `display-mode` media feature pre-16.4 (hence the `navigator.standalone` fallback), Android/
// desktop Chrome do.
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}

// PushManager wants the VAPID public key as a raw Uint8Array, not the base64url string it's
// handed out as. Direct port of the conversion Next's own PWA guide uses.
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  // TS's DOM lib pins ArrayBufferView's buffer to plain ArrayBuffer, which a freshly-constructed
  // Uint8Array's `.buffer` isn't statically typed as (it's ArrayBufferLike). It always IS one at
  // runtime for a `new Uint8Array(n)`; this cast just tells the type checker that.
  return output as BufferSource;
}

/**
 * Subscribes this device and registers it with the server. The permission prompt only appears
 * from within a user gesture (a click handler), never on page load -- callers must call this
 * directly from one, not from a useEffect.
 *
 * Throws with a message safe to show the user (permission denied, unsupported, misconfigured).
 */
export async function enablePushOnThisDevice(): Promise<void> {
  if (!isPushSupported()) throw new Error("This browser doesn't support notifications.");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("Notifications aren't configured on this server yet.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const registration = await navigator.serviceWorker.ready;
  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Couldn't read the new subscription.");
  await api.registerPushSubscription({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } });
}

/** Unsubscribes this device and tells the server to forget it. Safe to call with nothing to undo. */
export async function disablePushOnThisDevice(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const sub = await registration?.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await api.unregisterPushSubscription(endpoint);
}

/** Whether THIS device already has an active push subscription (independent of the server's list). */
export async function isThisDeviceSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  const sub = await registration?.pushManager.getSubscription();
  return !!sub;
}
