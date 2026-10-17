"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLeagueStore, useIsAuthenticated, useIsPreviewingDemo, useCanManage } from "@/lib/store";
import { api, ApiError } from "@/lib/api";
import { actionItems, type ActionItem } from "@/lib/game/action-items.js";
import { cn } from "cn";
import { dismissNotificationsNudge, shouldNudgeNotifications } from "@/lib/notify-nudge";
import { commissionerItems } from "@/lib/game/commissioner-items";
import { UpNext, ACTION_TAGS, type Job } from "@/components/overview/up-next";
import { useLinkedGroup } from "@/components/league-strip";
import { useSwitchLinked } from "@/components/league-swipe";
import { teamBanner } from "@/components/waivers/team-waivers";
import { useCastNames, useNow } from "@/components/waivers/waivers-model";

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
//
// Every page shows the same items as Up next (overview/up-next.tsx: this game's most urgent move, a count
// for the rest, the commissioner's control room above it), so none hides behind a pager. The pager keeps
// only what isn't a league's: an invite, and the notifications nudge once nothing else needs you. Two
// pages differ (docs/PLAN-league-tabs.md): Team / Lineup lead with their own waiver banner instead, and
// Episodes leaves this league's results job to its own lead.
export function ActionBar() {
  const router = useRouter();
  const pathname = usePathname();
  const mode = useLeagueStore((s) => s.mode);
  // The real state, not the spoiler-trimmed view: what's due is due whether or not you've looked.
  const state = useLeagueStore((s) => s.fullState);
  const leagueId = useLeagueStore((s) => s.leagueId);
  const leagueName = useLeagueStore((s) => s.leagueName);
  const myPlayerId = useLeagueStore((s) => s.membership?.playerId ?? null);
  // A late joiner catching up gets alerts for their own week, which their mark says where it is.
  const seenThrough = useLeagueStore((s) => s.membership?.resultsSeenThrough ?? null);
  // A commissioner also gets the league's own to-do: an aired episode's results to fill in.
  const commissioner = useCanManage();
  const switchLeague = useLeagueStore((s) => s.switchLeague);
  const setLeagues = useLeagueStore((s) => s.setLeagues);
  const setFlash = useLeagueStore((s) => s.setFlash);
  const isAuthenticated = useIsAuthenticated();
  const leagues = useLeagueStore((s) => s.leagues);
  const previewingDemo = useIsPreviewingDemo();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  // "Turn on notifications", last in the list, for a device that could get push but doesn't
  // (notify-nudge.ts decides, including the snooze after a dismissal).
  const [nudgeAllowed, setNudge] = useState(false);
  // Not before the first league: there's nothing to be reminded about yet.
  const nudge = nudgeAllowed && leagues.length > 0;
  const live = mode === "live" && !!leagueId;
  // Signed in with no league yet still fetches: invites are exactly what that person needs to see.
  const enabled = isAuthenticated && !previewingDemo;
  // A demo season plays as one of its players, so it gets the bar too -- its own items only, nothing
  // fetched (there are no other leagues, and no server behind it).
  const demo = mode === "mock" && !!myPlayerId;
  const hereId = leagueId ?? "demo";
  // Team and Lineup open on their own waiver banner when waivers need you (docs/PLAN-league-tabs.md),
  // in this strip's place: the strip would only repeat it. Read from the viewer's own copy, as the page is.
  const viewState = useLeagueStore((s) => s.state);
  const castName = useCastNames(viewState);
  const now = useNow();
  const bannerHere = (pathname === "/team" || pathname === "/lineup") && !!teamBanner(viewState, myPlayerId, now, castName);
  const group = useLinkedGroup();
  const { open: openLinked } = useSwitchLinked();

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
      ? actionItems(state, myPlayerId, seenThrough, { commissioner }).map((it) => ({ ...it, leagueId: hereId, leagueName: leagueName ?? "Demo season" }))
      : [];
  const fetched = enabled ? (data?.items ?? []) : [];
  // Nothing that points at the page you're already on (your pick on /pick, your lineup on /lineup, League
  // Settings' own job on /setup/league): the page itself is the to-do. An item for a section of a page
  // (/#predictions) still shows. This league's results job is Episodes' own lead (week.tsx) and the
  // episode page's, so Up next leaves it to those pages. Only this league's: another league's isn't there.
  const onThisPage = (it: { leagueId: string; kind?: string; href: string }) =>
    it.leagueId === hereId && ((!it.href.includes("#") && it.href === pathname) || (it.kind === "results" && pathname.startsWith("/episodes")));
  const others = fetched.filter((it) => it.kind !== "invite" && it.leagueId !== leagueId);
  const overview = pathname === "/" && (live || demo);
  const hereMine = here.filter((it) => !onThisPage(it));
  // The commissioner's jobs, for Up next's control room: this league's results and its own to-dos
  // (commissioner-items.ts, from the viewer's trimmed state) first, then every other league you run.
  const job = (it: { leagueId: string; leagueName: string; title?: string; text?: string; href: string }): Job => ({
    leagueId: it.leagueId,
    leagueName: it.leagueName,
    title: (it.title ?? it.text) as string,
    href: it.href,
  });
  const jobs: Job[] = [
    ...hereMine.filter((it) => it.who === "commish").map(job),
    ...(commissioner && (live || demo)
      ? commissionerItems(viewState)
          .map((it) => ({ leagueId: hereId, leagueName: leagueName ?? "Demo season", title: it.title, href: it.href }))
          .filter((it) => !onThisPage(it))
          .map(job)
      : []),
    ...others.filter((it) => it.who === "commish").map(job),
    ...(enabled ? (data?.commish ?? []) : []).filter((it) => it.leagueId !== leagueId).map(job),
  ];
  const nudgeItem = { kind: "notifications" as const, text: "Turn on notifications", href: "/account", leagueId: "", leagueName: "Get reminders before each episode" };
  const items = [
    ...fetched.filter((it) => it.kind === "invite"),
    ...(enabled && nudge && !hereMine.length && !others.length && !jobs.length ? [nudgeItem] : []),
  ];
  const i = items.length ? Math.min(index, items.length - 1) : 0;
  const item = items[i];
  // Team / Lineup's waiver banner says what Up next would (and the page is the to-do), so nothing here.
  const upNext = bannerHere ? null : (
    <UpNext here={hereMine} others={others} jobs={jobs} hereId={hereId} hereName={leagueName ?? "Demo season"} quiet={overview} go={(id, href) => open({ leagueId: id, href } as Item)} />
  );
  if ((!enabled && !demo) || !item || bannerHere) return upNext;

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
    // A game in this linked group opens the way the league strip opens it (no loading screen).
    if (it.leagueId !== hereId) {
      if (group?.games.some((g) => g.id === it.leagueId)) await openLinked(it.leagueId, pathname);
      else await switchLeague(it.leagueId);
    }
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
  // white plate with the message. What's left of the pager is an invite or the notifications nudge: one
  // at a time, a single 48px "1/2 Next" that cycles (it wraps round, so there's no Previous).
  //
  // At 390px the plate has about 340px after its tag, so the message gets almost all of it: it wraps
  // to a second line rather than truncating, and an item with two answers (an invite's Join / Decline,
  // the nudge's Turn on / Not now) puts them on their own line under it.
  const TAGS = ACTION_TAGS;
  const plateBtn = "flex min-h-11 min-w-11 items-center justify-center bg-plate text-plate-foreground hover:bg-[#f1eff6]";
  const title = "type-caption line-clamp-2 text-[19px] leading-[1.05] [overflow-wrap:anywhere] [text-wrap:pretty]";
  const answerRow = (yes: { label: string; onClick: () => void }, no: { label: string; onClick: () => void }) => (
    <span className="flex flex-wrap gap-1.5">
      <button className="min-h-11 whitespace-nowrap rounded-[3px] bg-chyron px-4 text-sm font-bold text-chyron-foreground disabled:opacity-60" disabled={busy} onClick={yes.onClick}>
        {yes.label}
      </button>
      <button className="min-h-11 whitespace-nowrap rounded-[3px] border border-plate-muted/40 px-3 text-sm font-semibold disabled:opacity-60" disabled={busy} onClick={no.onClick}>
        {no.label}
      </button>
    </span>
  );

  return (
    <>
      <div role="status" className="isolate mb-4 flex min-h-[56px] items-stretch overflow-hidden rounded-[3px] bg-plate shadow-plate">
        <span className="type-caption tag-cut flex shrink-0 items-center bg-chyron pl-3 pr-5 text-[14px] tracking-[0.04em] text-chyron-foreground">
          {TAGS[item.kind] ?? "Now"}
        </span>
        <div className="tag-tuck flex min-w-0 flex-1 items-stretch bg-plate text-plate-foreground">
          <div className="flex min-w-0 flex-1 flex-col gap-2 py-2.5 pl-3 pr-2">
            <span className="min-w-0">
              {/* An invite's title carries the league's name, so it gets a third line. */}
              <span className={cn(title, item.kind === "invite" && "line-clamp-3")}>{item.text}</span>
              <span className="mt-0.5 block truncate text-[13px] text-plate-muted">
                {item.kind === "invite" ? (item.invitedBy ? `from ${item.invitedBy}` : null) : item.leagueName}
              </span>
            </span>
            {item.kind === "invite"
              ? answerRow({ label: "Join", onClick: () => answer(item, true) }, { label: "Decline", onClick: () => answer(item, false) })
              : answerRow(
                  { label: "Turn on", onClick: () => open(item) },
                  // The one item you can wave away (snoozed -- see notify-nudge.ts).
                  {
                    label: "Not now",
                    onClick: () => {
                      dismissNotificationsNudge();
                      setNudge(false);
                    },
                  }
                )}
          </div>
          {items.length > 1 && (
            <button
              className={cn(plateBtn, "w-12 shrink-0 flex-col gap-0.5 border-l border-plate-muted/20")}
              aria-label={`Next (${i + 1} of ${items.length})`}
              onClick={() => step(1)}
            >
              <span className="type-num text-[15px] font-bold leading-none">
                {i + 1}/{items.length}
              </span>
              <span className="text-[11px] font-semibold leading-none text-plate-muted">Next</span>
            </button>
          )}
        </div>
      </div>
      {upNext}
    </>
  );
}
