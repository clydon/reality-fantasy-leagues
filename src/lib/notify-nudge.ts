"use client";

import { isPushSupported, isThisDeviceSubscribed, notificationPermission } from "@/lib/push-client";

// The action bar's "Turn on notifications" nudge, for a device that could get push but doesn't.
// Per DEVICE (localStorage), like the subscription it asks for: a "no" on the laptop shouldn't
// silence the phone. Dismissing snoozes it for SNOOZE_DAYS (about two episodes -- back while the
// season's still on, not nagging); the third dismissal is an answer, and it stops for good. Never
// shown where the browser has blocked notifications (nothing to prompt) or once they're on.
const KEY = "rfl.notifyNudge";
const SNOOZE_DAYS = 14;
const MAX_DISMISSALS = 3;

type Saved = { dismissals: number; until: number };

function read(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    if (s && typeof s.dismissals === "number" && typeof s.until === "number") return s;
  } catch {
    /* fall through */
  }
  return { dismissals: 0, until: 0 };
}

export async function shouldNudgeNotifications(): Promise<boolean> {
  if (!isPushSupported() || notificationPermission() === "denied") return false;
  const s = read();
  if (s.dismissals >= MAX_DISMISSALS || Date.now() < s.until) return false;
  return !(await isThisDeviceSubscribed().catch(() => true));
}

export function dismissNotificationsNudge() {
  const s = read();
  try {
    localStorage.setItem(KEY, JSON.stringify({ dismissals: s.dismissals + 1, until: Date.now() + SNOOZE_DAYS * 86400 * 1000 }));
  } catch {
    /* not remembered -- it'll ask again next load */
  }
}
