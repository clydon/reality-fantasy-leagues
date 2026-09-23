"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLeagueStore } from "@/lib/store";
import { useNotificationsStore } from "@/lib/notifications-store";
import { useChatStore } from "@/lib/chat-store";
import { api } from "@/lib/api";
import StateLogic from "@/lib/game/state-logic.js";
import { isBetSettled } from "@/lib/game/selectors";

// Port of pollForNotifications() (public/app.js): every 15s while a real league is loaded,
// re-fetch its state and diff against what changed to decide what's actually worth surfacing --
// "a bet now needs your guess," "it just became your turn to draft" -- rather than a full-state
// overwrite that would just re-render everything on a timer. TanStack Query supplies the polling
// mechanics (refetchInterval, automatic pause when the tab is hidden via refetchIntervalInBackground:
// false, request dedup); the actual diffing logic below is a direct port either way -- no library
// hands you transition detection for free. Mounted once, in AuthGate's shell (see that file).
export function useLeaguePoll() {
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const setMidSeason = useLeagueStore((s) => s.setMidSeason);
  const { push, dismissByTab, setBetGuessNotifications, setWasMyTurn, notifWasMyTurn } = useNotificationsStore();

  const pathname = usePathname();
  const pollUnreadChat = useChatStore((s) => s.pollUnread);

  const { data } = useQuery({
    queryKey: ["league-poll", leagueId],
    queryFn: () => api.leagueState(leagueId!),
    enabled: mode === "live" && !!leagueId,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  // Chat unread badge -- skipped while actively on /chat, since ChatTab's own faster 5s poll
  // (chat-tab.tsx) keeps lastSeenAt current in that case instead. Same 15s cadence as the main
  // poll above, same reasoning as pollForNotifications()'s own chat-unread check.
  useQuery({
    queryKey: ["chat-unread-poll", leagueId, pathname],
    queryFn: () => pollUnreadChat(),
    enabled: mode === "live" && !!leagueId && pathname !== "/chat",
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!data) return;
    const fresh = data.state;

    // Bets needing your guess -- recomputed fresh every poll (including the very first one right
    // after login), so a backlog from before you logged in shows up too, not just new arrivals.
    if (fresh.settings.bonusEnabled && myPlayerId) {
      const pendingBetIds = new Set<string>();
      const betById = new Map<string, string>();
      fresh.episodes.forEach((ep) =>
        (ep.bets || []).forEach((bet) => {
          betById.set(bet.id, bet.label);
          const alreadyGuessed = (bet.predictions || []).some((p) => p.playerId === myPlayerId);
          if (!alreadyGuessed && !isBetSettled(bet)) pendingBetIds.add(bet.id);
        })
      );
      setBetGuessNotifications(pendingBetIds, (id) => betById.get(id) || "?");
    }

    const turn = StateLogic.currentDraftTurn(fresh);
    const isMyTurnNow = !!(StateLogic.isDraftStarted(fresh) && turn && !turn.isComplete && myPlayerId && turn.playerId === myPlayerId);
    if (isMyTurnNow && !notifWasMyTurn) {
      push("It's your turn to draft!", "/draft");
    } else if (!isMyTurnNow && notifWasMyTurn) {
      // Turn moved on (someone picked on your behalf, or you picked elsewhere) without you ever
      // visiting Draft -- the notification is stale now, drop it naturally.
      dismissByTab("/draft");
    }
    setWasMyTurn(isMyTurnNow);

    // Only the midSeason slice is synced, not the whole state -- see setMidSeason's comment.
    setMidSeason(fresh.midSeason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
}
