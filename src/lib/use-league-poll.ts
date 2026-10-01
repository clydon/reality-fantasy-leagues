"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLeagueStore } from "@/lib/store";
import { useNotificationsStore } from "@/lib/notifications-store";
import { useChatStore } from "@/lib/chat-store";
import { api } from "@/lib/api";
import { isBetSettled } from "@/lib/game/selectors";

// Port of pollForNotifications() (public/app.js): every 15s while a real league is loaded,
// re-fetch its state and diff against what changed to decide what's actually worth surfacing --
// "a prediction now needs your guess," "it just became your turn to draft" -- rather than a full-state
// overwrite that would just re-render everything on a timer. TanStack Query supplies the polling
// mechanics (refetchInterval, automatic pause when the tab is hidden via refetchIntervalInBackground:
// false, request dedup); the actual diffing logic below is a direct port either way -- no library
// hands you transition detection for free. Mounted once, in AuthGate's shell (see that file).
export function useLeaguePoll() {
  const mode = useLeagueStore((s) => s.mode);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const setMidSeason = useLeagueStore((s) => s.setMidSeason);
  const syncLineups = useLeagueStore((s) => s.syncLineups);
  const setState = useLeagueStore((s) => s.setState);
  const { push, setBetGuessNotifications } = useNotificationsStore();

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

  // Blind draft is the one thing the narrow patch below can't carry: its reveal rewrites ownership
  // across many castaways at once (and flips blindDraft.revealedAt), so nothing short of the whole
  // state object reflects it. Synced here as an EVENT rather than on a timer -- only when the
  // blind-draft signature actually changes (someone locked in, or the reveal fired), which is a
  // discrete, rare thing, not the every-15s full overwrite the narrow patch exists to avoid.
  const lastBlindSig = useRef<string | null>(null);
  const knownPlayers = useRef<{ leagueId: string; ids: Set<string> } | null>(null);

  useEffect(() => {
    if (!data) return;
    const fresh = data.state;

    const blindSig = JSON.stringify(fresh.blindDraft ?? null);
    if (lastBlindSig.current !== null && lastBlindSig.current !== blindSig) {
      setState(fresh);
    }
    lastBlindSig.current = blindSig;

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

    // "It's your turn to draft" isn't pushed here any more: the app-wide action bar (action-bar.tsx)
    // shows it, for every league, until the pick is made.

    // Someone joined (or came back): a player seat that's active now but wasn't at the last poll.
    // The first poll for a league only records who's there, so nobody already in it is announced.
    const activeIds = fresh.players.filter((p) => !p.disabled).map((p) => p.id);
    const known = knownPlayers.current;
    if (known && known.leagueId === leagueId) {
      for (const p of fresh.players) {
        if (!p.disabled && !known.ids.has(p.id) && p.id !== myPlayerId) push(`${p.name} joined the league`, "/setup");
      }
    }
    knownPlayers.current = { leagueId: leagueId ?? "", ids: new Set(activeIds) };

    // Only the midSeason slice is synced, not the whole state -- see setMidSeason's comment.
    setMidSeason(fresh.midSeason);
    // Lineups too, so the Board's starters keep up with everyone's picks.
    syncLineups(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
}
