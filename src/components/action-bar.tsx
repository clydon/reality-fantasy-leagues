"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLeagueStore, useIsAuthenticated, useIsPreviewingDemo } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { actionItems, type ActionItem } from "@/lib/game/action-items.js";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "cn";
import { dismissNotificationsNudge, shouldNudgeNotifications } from "@/lib/notify-nudge";
import { StatusPlate } from "@/components/overview/status-plate";

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
  const pathname = usePathname();
  const mode = useLeagueStore((s) => s.mode);
  // The real state, not the spoiler-trimmed view: what's due is due whether or not you've looked.
  const state = useLeagueStore((s) => s.fullState);
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
  // "Turn on notifications", last in the list, for a device that could get push but doesn't
  // (notify-nudge.ts decides, including the snooze after a dismissal).
  const [nudge, setNudge] = useState(false);
  const live = mode === "live" && !!leagueId;
  // Signed in with no league yet still fetches: invites are exactly what that person needs to see.
  const enabled = isAuthenticated && !previewingDemo;
  // A demo season plays as one of its players, so it gets the bar too -- its own items only, nothing
  // fetched (there are no other leagues, and no server behind it).
  const demo = mode === "mock" && !!myPlayerId;
  const hereId = leagueId ?? "demo";

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
  // Re-checked on every page change, so turning notifications on in Account settings clears it.
  useEffect(() => {
    if (enabled) shouldNudgeNotifications().then(setNudge);
  }, [enabled, pathname]);

  const here: Item[] =
    (live || demo) && myPlayerId
      ? actionItems(state, myPlayerId).map((it) => ({ ...it, leagueId: hereId, leagueName: leagueName ?? "Demo season" }))
      : [];
  const fetched = enabled ? (data?.items ?? []) : [];
  // Nothing that points at the page you're already on (your pick on /pick, your lineup on /lineup):
  // the page itself is the to-do. An item for a section of a page (/#predictions) still shows.
  const onThisPage = (it: Item) => !it.href.includes("#") && it.href === pathname;
  const items = [
    ...fetched.filter((it) => it.kind === "invite"),
    ...here.filter((it) => !onThisPage(it)),
    ...fetched.filter((it) => it.kind !== "invite" && it.leagueId !== leagueId),
    ...(enabled && nudge
      ? [{ kind: "notifications" as const, text: "Turn on notifications", href: "/account", leagueId: "", leagueName: "Get reminders before each episode" }]
      : []),
  ];
  const i = items.length ? Math.min(index, items.length - 1) : 0;
  const item = items[i];
  // Overview opens on the league's next beat when nothing here needs you (StatusPlate): under another
  // league's alert if there is one, otherwise in the strip's own slot.
  const statusPlate = pathname === "/" && (live || demo) && here.length === 0 ? <StatusPlate /> : null;
  if ((!enabled && !demo) || !item) return statusPlate;

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
    if (it.kind === "notifications") {
      router.push("/account");
      return;
    }
    if (it.leagueId !== hereId) await switchLeague(it.leagueId);
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

  // Direction A: the strip is a broadcast caption -- a tag naming what kind of thing this is, then a
  // white plate with the message. One strip, one item at a time, the pager for the rest.
  const TAGS: Record<string, string> = {
    invite: "Invite",
    notifications: "Alerts",
    draftTurn: "Your pick",
    blindDraft: "Draft",
    midSeasonTurn: "Your turn",
    lineup: "Lineup",
    pick: "Pick",
    prediction: "Predict",
  };
  const plateBtn = "flex min-h-11 min-w-11 items-center justify-center bg-plate text-plate-foreground hover:bg-[#f1eff6]";

  return (
    <>
      <div role="status" className="mb-4 flex min-h-[56px] items-stretch overflow-hidden rounded-[3px] shadow-plate">
        <span className="type-caption flex shrink-0 items-center bg-chyron pl-3 pr-5 text-[14px] tracking-[0.04em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,84%_100%,0_100%)]">
          {TAGS[item.kind] ?? "Now"}
        </span>
        <div className="-ml-2.5 flex min-w-0 flex-1 items-stretch bg-plate text-plate-foreground">
          {item.kind === "invite" ? (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-2 py-2 pl-3 pr-2">
              <span className="min-w-0 flex-1">
                <span className="type-caption block truncate text-[19px]">{item.text}</span>
                {item.invitedBy && <span className="block truncate text-[13px] text-plate-muted">from {item.invitedBy}</span>}
              </span>
              <span className="ml-auto flex shrink-0 gap-1.5">
                <button
                  className="min-h-11 rounded-[3px] bg-chyron px-4 text-sm font-bold text-chyron-foreground disabled:opacity-60"
                  disabled={busy}
                  onClick={() => answer(item, true)}
                >
                  Join
                </button>
                <button
                  className="min-h-11 rounded-[3px] border border-plate-muted/40 px-3 text-sm font-semibold disabled:opacity-60"
                  disabled={busy}
                  onClick={() => answer(item, false)}
                >
                  Decline
                </button>
              </span>
            </div>
          ) : (
            <button className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-3 pr-2 text-left hover:bg-[#f1eff6]" onClick={() => open(item)}>
              <span className="min-w-0 flex-1">
                <span className="type-caption block truncate text-[19px]">{item.text}</span>
                <span className={cn("block truncate text-[13px] text-plate-muted", !(item.kind === "notifications" || item.leagueId === hereId) && "font-semibold text-plate-foreground")}>
                  {item.kind === "notifications" || item.leagueId === hereId ? item.leagueName : `in ${item.leagueName}`}
                </span>
              </span>
              <ChevronRight className="size-[18px] shrink-0" strokeWidth={2.4} aria-hidden />
            </button>
          )}
          {/* The nudge is the one item you can wave away (snoozed -- see notify-nudge.ts). */}
          {item.kind === "notifications" && (
            <button
              className={cn(plateBtn, "border-l border-plate-muted/20")}
              aria-label="Not now"
              title="Not now"
              onClick={() => {
                dismissNotificationsNudge();
                setNudge(false);
              }}
            >
              <X className="size-[18px]" strokeWidth={2.2} aria-hidden />
            </button>
          )}
          {items.length > 1 && (
            <div className="flex shrink-0 items-center border-l border-plate-muted/20">
              <button className={plateBtn} aria-label="Previous" onClick={() => step(-1)}>
                <ChevronLeft className="size-[18px]" strokeWidth={2.4} aria-hidden />
              </button>
              <span className="type-num w-7 text-center text-[13px]">
                {i + 1}/{items.length}
              </span>
              <button className={plateBtn} aria-label="Next" onClick={() => step(1)}>
                <ChevronRight className="size-[18px]" strokeWidth={2.4} aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
      {statusPlate}
    </>
  );
}
