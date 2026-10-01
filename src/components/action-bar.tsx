"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLeagueStore, useIsAuthenticated, useIsPreviewingDemo } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { actionItems, type ActionItem } from "@/lib/game/action-items.js";
import { cn } from "cn";

type Item = ActionItem & { leagueId: string; leagueName: string };

// The app-wide "this needs you" bar, above every page: a pending league invite (answerable right
// here), or anything due in ANY of your leagues -- a draft or mid-season turn, an incomplete lineup,
// an Eliminator Pool pick, a prediction to guess.
// One at a time, < and > to step through; tapping one opens that league (switching to it if
// needed) at the page where it's done.
//
// Two sources merged: the open league's items are computed right here from the state on screen,
// so an item vanishes the moment you deal with it; every other league's come from /api/me/actions,
// re-fetched every 30s and whenever the open league's state changes.
export function ActionBar() {
  const router = useRouter();
  const mode = useLeagueStore((s) => s.mode);
  const state = useLeagueStore((s) => s.state);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  const switchLeague = useLeagueStore((s) => s.switchLeague);
  const setLeagues = useLeagueStore((s) => s.setLeagues);
  const setFlash = useLeagueStore((s) => s.setFlash);
  const isAuthenticated = useIsAuthenticated();
  const previewingDemo = useIsPreviewingDemo();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const live = mode === "live" && !!leagueId;
  // Signed in with no league yet still fetches: invites are exactly what that person needs to see.
  const enabled = isAuthenticated && !previewingDemo;

  const { data, refetch } = useQuery({
    queryKey: ["my-actions"],
    queryFn: () => api.myActions(),
    enabled,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    if (enabled) refetch();
  }, [state, enabled, refetch]);

  const here: Item[] =
    live && myPlayerId ? actionItems(state, myPlayerId).map((it) => ({ ...it, leagueId: leagueId!, leagueName: leagueName ?? "" })) : [];
  const fetched = data?.items ?? [];
  const items = [
    ...fetched.filter((it) => it.kind === "invite"),
    ...here,
    ...fetched.filter((it) => it.kind !== "invite" && it.leagueId !== leagueId),
  ];
  const i = items.length ? Math.min(index, items.length - 1) : 0;
  const item = items[i];
  if (!enabled || !item) return null;

  // Accepting lands you in the league, the same way the Dashboard's own invite list does.
  async function answer(it: Item, accept: boolean) {
    if (!it.inviteId || busy) return;
    setBusy(true);
    try {
      if (accept) {
        const { league, reclaimed } = await api.acceptInvite(it.inviteId);
        const me = await api.me();
        await switchLeague(league.id);
        setLeagues(me.leagues);
        setFlash(reclaimed ? `Welcome back to ${league.name} — your previous roster has been restored.` : `You joined ${league.name}!`);
        router.push("/");
      } else {
        await api.declineInvite(it.inviteId);
      }
      await refetch();
    } catch (e) {
      setFlash(e instanceof ApiError ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  async function open(it: Item) {
    if (it.leagueId !== leagueId) await switchLeague(it.leagueId);
    const [path, hash] = it.href.split("#");
    router.push(path || "/");
    // An Overview section: scroll to it once it's rendered (it may be a league switch away).
    if (hash) {
      let tries = 0;
      const tick = () => {
        const el = document.getElementById(hash);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        else if (tries++ < 20) setTimeout(tick, 100);
      };
      setTimeout(tick, 50);
    }
  }

  const step = (d: number) => setIndex((i + d + items.length) % items.length);

  return (
    <div
      role="status"
      className="mb-4 flex items-stretch overflow-hidden rounded-lg border-2 border-amber-500 bg-amber-50 text-amber-950 shadow-sm dark:bg-amber-950/40 dark:text-amber-100"
    >
      {item.kind === "invite" ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-2 px-3 py-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm text-white" aria-hidden>
            ✉
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">{item.text}</span>
            {item.invitedBy && <span className="block truncate text-xs opacity-70">from {item.invitedBy}</span>}
          </span>
          <span className="ml-auto flex shrink-0 gap-1.5">
            <button
              className="rounded-md bg-amber-500 px-3 py-1 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60"
              disabled={busy}
              onClick={() => answer(item, true)}
            >
              Join
            </button>
            <button
              className="rounded-md border border-amber-500/60 px-3 py-1 text-sm font-semibold hover:bg-amber-100/60 disabled:opacity-60 dark:hover:bg-amber-900/40"
              disabled={busy}
              onClick={() => answer(item, false)}
            >
              Decline
            </button>
          </span>
        </div>
      ) : (
        <button className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left hover:bg-amber-100/60 dark:hover:bg-amber-900/40" onClick={() => open(item)}>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white" aria-hidden>
            !
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{item.text}</span>
            <span className={cn("block truncate text-xs", item.leagueId === leagueId ? "opacity-70" : "font-semibold")}>
              {item.leagueId === leagueId ? item.leagueName : `in ${item.leagueName}`}
            </span>
          </span>
          <span className="shrink-0 text-lg font-bold" aria-hidden>
            ›
          </span>
        </button>
      )}
      {items.length > 1 && (
        <div className="flex shrink-0 items-center border-l border-amber-500/40">
          <button className="h-full px-2.5 text-lg font-bold hover:bg-amber-100/60 dark:hover:bg-amber-900/40" aria-label="Previous" onClick={() => step(-1)}>
            ‹
          </button>
          <span className="w-9 text-center font-mono text-xs">
            {i + 1}/{items.length}
          </span>
          <button className="h-full px-2.5 text-lg font-bold hover:bg-amber-100/60 dark:hover:bg-amber-900/40" aria-label="Next" onClick={() => step(1)}>
            ›
          </button>
        </div>
      )}
    </div>
  );
}
