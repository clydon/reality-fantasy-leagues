"use client";

import { useQuery } from "@tanstack/react-query";
import type { ChatMode } from "@/lib/moments";
import type { MuteFor, ShowNotify } from "@/lib/server/notify-prefs";
import type { PhoneRow } from "@/lib/server/phones";

// Settings Round 1's reads and writes (docs/design-round/settings-r1-spec.md), kept here rather than in data.ts: your phones
// (A3), a couch's own chat choice (A9) and muting a show (A6). Each write answers what it changed, for the toast's Undo.

export type { PhoneRow, MuteFor };

async function call<T>(url: string, method: "GET" | "PUT" | "POST" | "DELETE" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? { method } : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(out.error || `Couldn't do that (${res.status})`), { status: res.status });
  return out as T;
}

/** This phone's push endpoint, if it has one: how Your phones knows which row is this phone. */
export async function thisEndpoint(): Promise<string | null> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
    const reg = await navigator.serviceWorker.getRegistration();
    return (await reg?.pushManager.getSubscription())?.endpoint ?? null;
  } catch {
    return null;
  }
}

export const PHONES_KEY = ["new-design", "phones"] as const;

export interface Phones {
  notify: PhoneRow[];
  signedIn: PhoneRow[];
}

/** Your phones: the ones that get notifications, and where you're signed in. */
export function usePhones(enabled = true) {
  return useQuery({
    queryKey: PHONES_KEY,
    queryFn: async () => {
      const here = await thisEndpoint();
      return call<Phones>(`/api/me/phones${here ? `?here=${encodeURIComponent(here)}` : ""}`);
    },
    enabled,
    staleTime: 30_000,
  });
}

export const phonesApi = {
  turnOff: (id: string) => call<{ ok: true }>("/api/me/phones", "DELETE", { id }),
  signOutOthers: async () => call<{ signedOut: number }>("/api/me/phones", "POST", { signOutOthers: true, here: await thisEndpoint() }),
};

/** Your chat choice on one couch: null follows your account's. */
export function useCouchChat(couchId: string | null) {
  return useQuery({
    queryKey: ["new-design", "couch-chat", couchId],
    queryFn: () => call<{ chat: ChatMode | null }>(`/api/couches/${couchId}/chat-notify`),
    enabled: !!couchId,
    staleTime: 60_000,
  });
}

export const couchChatApi = {
  save: (couchId: string, chat: ChatMode | null) => call<{ chat: ChatMode | null }>(`/api/couches/${couchId}/chat-notify`, "PUT", { chat }),
};

export const muteApi = {
  /** Mute a show for a day, a week or until it's turned back on; null unmutes. */
  mute: (seasonId: string, mute: MuteFor | null) => call<ShowNotify>(`/api/seasons/${seasonId}/notifications`, "PUT", { mute }),
  /** Put a mute back exactly as it was (Undo). */
  restore: (seasonId: string, until: string | null) => call<ShowNotify>(`/api/seasons/${seasonId}/notifications`, "PUT", { muteUntil: until }),
};

/** A mute's end by distance: "until 10 PM" today, "until tomorrow 10 PM", "until Thu 8 PM" within the week, "until Thu, Nov 27" further off, "until you turn it back
 *  on" for good. `now`: the page's clock (ui/bars useNow), never read here, so a render stays pure. */
export function muteEnd(until: string, now: number): string {
  if (until === "forever") return "until you turn it back on";
  const at = new Date(until);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(at) - day(new Date(now))) / 86_400_000);
  const time = at.toLocaleTimeString([], { hour: "numeric", minute: at.getMinutes() ? "2-digit" : undefined });
  if (days <= 0) return `until ${time}`;
  if (days === 1) return `until tomorrow ${time}`;
  // Within the week, the day and the time: a mute until the next episode ends at a moment, not on a date (settings Round 2's check).
  if (days < 7) return `until ${at.toLocaleDateString([], { weekday: "short" })} ${time}`;
  return `until ${at.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}`;
}
