import { create } from "zustand";
import type { Notif } from "@/lib/game/types";

// Port of the live app's `notifications` array + pushNotification()/dismissNotifications()
// (public/app.js) -- capped at 20, newest first. The actual polling/diffing that decides *when*
// to push or dismiss lives in use-league-poll.ts; this store is just the resulting list. (Turns and
// other things waiting on you are the app-wide action bar's job now -- see action-bar.tsx.)
interface NotificationsStore {
  notifications: Notif[];
  push: (text: string, tab: string, meta?: { kind?: "bet-guess"; betId?: string }) => void;
  dismissByTab: (tab: string) => void;
  setBetGuessNotifications: (pendingBetIds: Set<string>, betLabelOf: (id: string) => string) => void;
  clear: () => void;
}

let counter = 0;

export const useNotificationsStore = create<NotificationsStore>((set, get) => ({
  notifications: [],
  push: (text, tab, meta) => {
    counter++;
    const notif: Notif = { id: "n" + counter, text, ts: Date.now(), tab, ...meta };
    set({ notifications: [notif, ...get().notifications].slice(0, 20) });
  },

  dismissByTab: (tab) => {
    // "needs your guess" reminders don't clear just from visiting the tab -- only from actually
    // submitting a guess (or the bet no longer needing one) -- see setBetGuessNotifications.
    set({ notifications: get().notifications.filter((n) => n.tab !== tab || n.kind === "bet-guess") });
  },

  // Reconciles the bet-guess notifications against the current pending set in one pass: drops
  // ones that are no longer pending, adds ones that are newly pending and don't already have a
  // notification. Mirrors pollForNotifications()'s filter-then-add pattern exactly.
  setBetGuessNotifications: (pendingBetIds, betLabelOf) => {
    const existing = get().notifications;
    const kept = existing.filter((n) => n.kind !== "bet-guess" || (n.betId && pendingBetIds.has(n.betId)));
    const existingBetIds = new Set(kept.filter((n) => n.kind === "bet-guess").map((n) => n.betId));
    const additions: Notif[] = [];
    pendingBetIds.forEach((betId) => {
      if (!existingBetIds.has(betId)) {
        counter++;
        additions.push({
          id: "n" + counter,
          text: `New prediction needs your guess: "${betLabelOf(betId)}"`,
          ts: Date.now(),
          tab: "/",
          kind: "bet-guess",
          betId,
        });
      }
    });
    if (additions.length > 0 || kept.length !== existing.length) {
      set({ notifications: [...additions, ...kept].slice(0, 20) });
    }
  },

  clear: () => set({ notifications: [] }),
}));
