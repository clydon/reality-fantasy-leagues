"use client";

// A league's page (docs/PLAN-sports-couch.md B1; the design: docs/design-round/league-page-spec.md, -first-view.md, -shape.md): its
// own page, reached from the league's card in Your shows and search's league row, with its tabs under a bar of its own. This week
// is the couch in the league this week, in the first-view order PFD set: your due move (the one yellow), this week's rivalry, the
// couch's teams ranked by record; then rivalries this season, your games, and the rest of the league one row into Scores. Scores,
// Games, Standings and Chat are their own files (league-scores.tsx, league-games.tsx, league-standings.tsx, league-chat.tsx).
//
// Every result on it (a record, a form tick, a score, a rivalry's winner, the table's order) goes through Hide sports scores: with it
// on, none shows, the table is ordered yours first then by fans, and Show records shows them all for the visit (showScore).

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Eye, ListOrdered, MessageCircle, Settings, TableProperties, Trophy, type LucideIcon } from "lucide-react";
import { useCouchTeams, useCurrentCouch, useHome, useLeaguesNow, useLeagueArt, useLeagueTeams, useRivalryGames, useRoomBadge, useRoomLatest, useSportsRecordings, useWatching, useYourTeams, useLaps, useOwnCalls, type Watching, type WeekGame } from "../data";
import { NavLink, useNav } from "../nav";
import { isLeagueTab, LEAGUE_TABS, paths, type LeagueTab } from "../routes";
import { Avatar, Faces } from "../ui/bars";
import { FollowToggle, theLeague, useLeagueFollow } from "../sports/follow";
import { SportsLabel, TeamMark } from "../sports/parts";
import { begun, clockOf, dayOf, showScore, useGameScore, useHideSports, useNow, useShownScores } from "../sports/scores";
import { LeagueGameRows, LeagueStart, openSports, useLeagueGames, useLeagueWeek } from "../sports/sheets";
import { pairRecord, rankTeams, recordWords, rivalriesOf, rivalryRecords, type Fan, type Rivalry, type TeamForm } from "@/lib/sports/couch-table";
import { RivalryCard } from "../sports/rivalry";
import { CallsCard, callEntries, matchOfWeek, useCallGames, type CallMatch } from "../sports/fan-call";
import { LapCard, useOpenLap } from "../sports/lap";
import type { LeagueNow } from "@/lib/sports/league-now";
import { LeagueScores } from "./league-scores";
import { LeagueGames } from "./league-games";
import { LeagueStandings } from "./league-standings";
import { LeagueChat } from "./league-chat";
import { teamKeyOf } from "@/lib/sports/team-badge";
import { artInUse } from "@/lib/sports/league-art";
import { ShowArt } from "../ui/show-bar";
import { LeagueSettingsPage, useLeagueSettings } from "../settings/league-page";

const TABS: Record<LeagueTab, { label: string; icon: LucideIcon }> = {
  week: { label: "This week", icon: CalendarDays },
  scores: { label: "Scores", icon: ListOrdered },
  games: { label: "Games", icon: Trophy },
  standings: { label: "Standings", icon: TableProperties },
  chat: { label: "Chat", icon: MessageCircle },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDay = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;

/** The league's now (its name, week and season), shared by the frame and the tabs (one read, the card's). */
function useLeague(league: string): { now: LeagueNow | null; name: string; loading: boolean } {
  const q = useLeaguesNow([league])[0];
  const now = q?.data ?? null;
  return { now, name: now?.leagueName ?? league.split("/").pop()!.toUpperCase(), loading: !!q?.isLoading };
}

/** The (tabs) layout: the league's bar over the tab's content, the tab bar under it. */
export function LeagueFrame({ league, children }: { league: string; children: ReactNode }) {
  const pathname = usePathname();
  const seg = pathname.split("/")[4] ?? "week";
  const tab: LeagueTab = isLeagueTab(seg) ? seg : "week";
  const { now, name, loading } = useLeague(league);
  const nav = useNav();
  const { yours } = useLeagueGames(league);
  const f = useLeagueFollow(league, name, { playsHere: yours.length > 0 });
  const settings = useLeagueSettings();
  // The league's art for you (league-art.ts artInUse: yours, else the couch's, else its own), once its read says which: a band's art
  // carried onto its page, as a show's is.
  const home = useHome().data;
  const couch = useCurrentCouch(home);
  const artQ = useLeagueArt(couch?.id ?? null);
  const art = home && artQ.isFetched ? artInUse(league, artQ.data, home.user).art : null;
  // The bar's height, for what sticks under it (Scores' switcher).
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty("--league-bar", `${el.offsetHeight}px`));
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--league-bar");
    };
  }, []);
  const sub = !now
    ? null
    : now.on
      ? [now.week, now.season].filter(Boolean).join(" · ")
      : `Off-season${now.back ? ` · back ${shortDay(now.back)}` : ""}`;
  return (
    <>
      {/* The show bar's compact form, with the league's art behind it under the show bar's own fade (league-art.ts: the app's own
          photos, never a logo), Night in both themes. */}
      <header
        ref={bar}
        data-league-bar={league}
        data-art={art?.id}
        className="dark sticky top-[var(--nd-top,0px)] isolate z-20 overflow-hidden bg-[linear-gradient(135deg,#2a2633,#100e15)] px-2 pb-3 pt-[calc(8px+env(safe-area-inset-top,0px))] text-foreground"
      >
        {art && (
          <>
            <ShowArt seasonId={`league-bar-${league}`} artUrl={art.src} name={name} position={art.position} bare className="absolute inset-0 -z-[2] size-full" />
            {/* Lighter at the top than a show's (night photos, not bright key art: the check found the art all but gone), as dark at
                the foot, under the name and its line. */}
            <span aria-hidden className="absolute inset-0 -z-[1] bg-[linear-gradient(180deg,rgba(16,14,21,.3),rgba(16,14,21,.55)_45%,rgba(16,14,21,.92))]" />
          </>
        )}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => nav.back(paths.home, undefined, undefined, (p) => p.startsWith(`/league/${league}/`))}
            className="flex h-11 items-center gap-0.5 rounded-[3px] pl-1 pr-2.5 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-foreground"
          >
            <ChevronLeft className="size-5" aria-hidden />
            Home
          </button>
          {/* 8 px between Follow and the gear: a slip onto Following unfollows (the check). */}
          <span className="ml-auto flex items-center gap-2">
            <FollowToggle on={f.on} disabled={!f.ready || f.busy} onClick={() => void f.toggle()} label={theLeague(name)} data="league-bar" />
            {/* The gear: this league's settings for you (Round 0's one gear on every bar; its art first). Last, so it stays put
                while Follow's width changes. */}
            <button
              type="button"
              aria-label="Your settings for this league"
              data-league-gear
              onClick={() => settings.show()}
              className="grid size-11 place-items-center rounded-[3px] text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
            >
              <Settings className="size-5" aria-hidden />
            </button>
          </span>
        </div>
        <h1 className="type-caption truncate px-2 pt-2 text-[28px] leading-none">{loading ? " " : name}</h1>
        {/* Over a picture, the ink at 80%, not muted grey (DESIGN.md's Show Art: muted can't hold its contrast on a picture). */}
        <p data-league-sub className="mt-1.5 h-[18px] truncate px-2 text-[13.5px] font-semibold text-foreground/80">
          {sub}
        </p>
      </header>
      <main style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>{children}</main>
      <LeagueTabBar league={league} current={tab} />
      <LeagueSettingsPage league={league} name={name} now={now} />
    </>
  );
}

/** The league's tabs, the show's tab bar's form: a tab move replaces the history entry, so Back leaves the league. */
function LeagueTabBar({ league, current }: { league: string; current: LeagueTab }) {
  const i = LEAGUE_TABS.indexOf(current);
  const n = LEAGUE_TABS.length;
  // The room's unread count on its tab (every 30 s; the open room reads itself, and reading it clears this).
  const couch = useCurrentCouch(useHome().data);
  const unread = useRoomBadge(league, current === "chat" ? null : (couch?.id ?? null)).data?.unread ?? 0;
  return (
    <nav
      aria-label="League"
      className="nd-tabbar nd-fixed-x fixed bottom-0 z-30 grid h-[calc(66px+env(safe-area-inset-bottom,0px))] border-t border-border bg-panel-menu/94 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-[14px]"
      style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}
    >
      {LEAGUE_TABS.map((t) => {
        const { icon: Icon, label } = TABS[t];
        const on = t === current;
        return (
          <NavLink
            key={t}
            href={paths.league(league, t)}
            replace
            aria-current={on ? "page" : undefined}
            className={`relative flex flex-col items-center justify-center gap-[5px] text-[11.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-foreground ${on ? "text-foreground" : "text-muted-foreground"}`}
          >
            <Icon className={`size-5 transition-transform duration-[350ms] ease-[cubic-bezier(.34,1.45,.64,1)] ${on ? "-translate-y-0.5 text-chyron-line" : ""}`} aria-hidden />
            <span>{label}</span>
            {t === "chat" && !on && unread > 0 && (
              <span data-room-badge className="absolute left-[calc(50%+5px)] top-[7px] grid h-[18px] min-w-[18px] place-items-center rounded-[9px] bg-live px-[5px] text-[11px] font-extrabold text-live-foreground">
                {unread}
              </span>
            )}
          </NavLink>
        );
      })}
      <i
        aria-hidden
        className="nd-tabind pointer-events-none absolute -top-px h-[3px] rounded-b-[2px] bg-chyron-line"
        style={{ left: `calc(${i} * 100% / ${n} + 30% / ${n})`, width: `calc(40% / ${n})` }}
      />
    </nav>
  );
}

export function LeagueTabScreen({ league, tab }: { league: string; tab: LeagueTab }) {
  const { now, name, loading } = useLeague(league);
  return (
    <div data-league-tab={tab} key={tab} className="px-4">
      {tab === "week" && <ThisWeek league={league} name={name} now={now} />}
      {tab === "scores" && <LeagueScores league={league} name={name} lnow={now} loading={loading} />}
      {tab === "games" && <LeagueGames league={league} name={name} lnow={now} />}
      {tab === "standings" && <LeagueStandings league={league} name={name} lnow={now} />}
      {tab === "chat" && <LeagueChat league={league} name={name} lnow={now} />}
    </div>
  );
}

// ---------- This week ----------

export type Team = { id: string; league: string; short: string; abbreviation: string | null; color: string | null; followers: Fan[]; you: boolean };

/** The couch's teams in the league (yours alone, on no couch), each with who follows it. */
export function useTableTeams(league: string): { teams: Team[]; solo: boolean; meId: string; ready: boolean } {
  const home = useHome().data;
  const couch = useCurrentCouch(home);
  const couchQ = useCouchTeams(couch?.id ?? null);
  const ownQ = useYourTeams(!couch);
  const me = home?.user;
  const teams = useMemo(() => {
    if (!me) return [];
    const all: Team[] = couch
      ? (couchQ.data?.teams ?? []).filter((t) => t.followers.length).map((t) => ({ ...t, followers: t.followers }))
      : (ownQ.data?.teams ?? []).map((t) => ({ ...t, followers: [{ id: me.id, name: me.name, myTeam: t.myTeam }], you: true }));
    // Yours first among each team's faces (the card's order).
    return all.filter((t) => t.league === league).map((t) => ({ ...t, followers: [...t.followers.filter((f) => f.id === me.id), ...t.followers.filter((f) => f.id !== me.id)] }));
  }, [couch, couchQ.data, ownQ.data, me, league]);
  return { teams, solo: !couch, meId: me?.id ?? "", ready: !!home && (couch ? couchQ.isFetched : ownQ.isFetched) };
}

/** A team's game this week: on now, else its next, else its last; how many more of its games are still to come this week. */
function weekGameOf(team: string, games: WeekGame[], now: number): { g: WeekGame | null; more: number } {
  const mine = games.filter((g) => g.sides.some((s) => s.id === team) && !(g.called && g.called !== "suspended"));
  const on = mine.find((g) => begun(g, now) && g.state !== "post" && !g.final);
  const next = mine.filter((g) => !begun(g, now));
  const g = on ?? next[0] ?? mine.filter((x) => begun(x, now)).pop() ?? null;
  return { g, more: next.filter((x) => x !== g).length };
}

function ThisWeek({ league, name, now: lnow }: { league: string; name: string; now: LeagueNow | null }) {
  const now = useNow();
  const { teams, solo, meId, ready } = useTableTeams(league);
  const formsQ = useLeagueTeams(
    league,
    teams.map((t) => t.id),
    ready
  );
  const week = useLeagueWeek(league, lnow?.from ?? null, lnow?.to ?? null);
  const hide = useHideSports();
  const shown = useShownScores();
  const forms = useMemo(() => new Map((formsQ.data?.teams ?? []).map((f) => [f.id, f])), [formsQ.data]);
  const results = [...forms.values()].flatMap((f) => [...f.form.map((x) => x.id), ...f.meetings.filter((m) => m.final).map((m) => m.id)]);
  const weekBegun = week.games.filter((g) => begun(g, now));
  // Hidden until every result on the page is shown (Show records shows them all at once).
  const hidden = hide && [...results, ...weekBegun.map((g) => g.id)].some((id) => !shown.has(id));
  const rivalries = rivalriesOf(teams, forms, meId);
  const inWeek = new Set(week.games.map((g) => g.id));
  const thisWeek = rivalries.filter((r) => inWeek.has(r.id));
  const live = thisWeek.find((r) => {
    const g = week.games.find((x) => x.id === r.id);
    return g && begun(g, now) && g.state !== "post" && !g.final;
  });
  // C1: a card for each of this week's rivalries, two at most (the rest in Rivalries this season): on now, then the next to come,
  // then the last played (its result is the story: a final mustn't vanish because another rivalry is still to come).
  const upcoming = thisWeek.filter((r) => r !== live && (!r.at || Date.parse(r.at) > now));
  const played = thisWeek.filter((r) => r !== live && !upcoming.includes(r)).reverse();
  const shownRivalries = [...(live ? [live] : []), ...upcoming, ...played].slice(0, 2);
  const couchId = useCurrentCouch(useHome().data)?.id ?? null;
  const yellowTaken = useLeagueGames(league).moves.length > 0;
  const call = useSearchParams().get("call");
  // C2: this week's calls (a couch team's game that isn't a rivalry), under the rivalries. Yours may take the page's one yellow
  // when neither the move strip nor a rivalry you're a fan in (with your call still to make) holds it.
  const callsQ = useCallGames(solo ? null : couchId, league, teams.map((t) => t.id));
  // C4: solo, your own calls on your teams (no couch: nobody backs them).
  const ownQ = useOwnCalls(league, teams.filter((t) => t.followers.some((f) => f.id === meId)).map((t) => t.id), solo);
  const callsRead = solo ? ownQ : callsQ;
  const callGames = (solo ? ownQ.data?.calls : callsQ.data?.games) ?? [];
  const watching = useWatching(solo ? null : couchId, league).data?.watching ?? [];
  const rivalryPicks = useRivalryGames(solo ? null : couchId, league).data?.games ?? [];
  const rivalryYellow = shownRivalries.some((r) => r.fans.some((f) => f.id === meId) && !(r.at && Date.parse(r.at) <= now) && !rivalryPicks.find((g) => g.event === r.id)?.picks.some((x) => x.userId === meId && x.side));
  const entries = callEntries({
    matches: week.games.map(matchOfWeek).filter((m): m is CallMatch => !!m),
    teams,
    calls: callGames,
    meId,
    rivalryIds: new Set(thisWeek.map((r) => r.id)),
    now,
  });
  // Solo (C4), once called: what you called ("You called Lions, above").
  const sideShort = (e: (typeof entries)[number], id: string) => (e.m.home.id === id ? e.m.home.short : e.m.away.short);
  const callAbove = new Map(entries.map((e) => [e.m.id, solo && e.call ? `You called ${sideShort(e, e.call.side)}, above` : `${e.call ? (e.call.userId === meId ? "Your" : `${e.fan.name}’s`) : "Your"} call, above`]));
  // C3: your victory lap, when a team of yours just won (the newest unanswered; nothing while its result is hidden from you).
  const lapsQ = useLaps(solo ? null : couchId, league, teams.filter((t) => t.followers.some((f) => f.id === meId)).map((t) => t.id));
  const openLap = useOpenLap(lapsQ.data?.open);
  const rest = week.games.filter((g) => !g.sides.some((s) => teams.some((t) => t.id === s.id)));
  const showAll = () => {
    for (const id of results) showScore(id);
    for (const g of weekBegun) showScore(g.id, league);
  };
  return (
    <div data-this-week>
      <MoveStrip league={league} />
      {!solo && couchId && (
        <LapCard lap={openLap} laps={lapsQ.data?.laps ?? []} league={league} couchId={couchId} meId={meId} gifs={!!lapsQ.data?.gifs} fansOf={(id) => teams.find((t) => t.id === id)?.followers ?? []} />
      )}
      {shownRivalries.map((r, i) => (
        <RivalryCard
          key={r.id}
          r={r}
          g={week.games.find((x) => x.id === r.id) ?? null}
          teams={teams}
          forms={forms}
          hidden={hidden}
          league={league}
          meId={meId}
          couchId={solo ? null : couchId}
          // One yellow a page: the move strip's, else the first card you're a fan in (its call).
          yellowTaken={yellowTaken || shownRivalries.slice(0, i).some((x) => x.fans.some((f) => f.id === meId))}
          record={{ ...pairRecord(rivalries, r.fans[0], r.fans[1]), since: null }}
          openCall={call === r.id}
          heading={i ? "Also this week" : undefined}
        />
      ))}
      {(solo || couchId) && (
        <CallsCard
          league={league}
          entries={entries}
          calls={callGames}
          loading={callsRead.isLoading}
          failed={callsRead.isError}
          retry={() => void callsRead.refetch()}
          hidden={hidden}
          meId={meId}
          couchId={solo ? null : couchId}
          yellowFree={!yellowTaken && !rivalryYellow}
          watching={watching}
        />
      )}
      <CouchTable
        league={league}
        name={name}
        teams={teams}
        forms={forms}
        games={week.games}
        solo={solo}
        meId={meId}
        hidden={hidden}
        loading={!ready || (teams.length > 0 && formsQ.isLoading) || week.loading}
        failed={formsQ.isError}
        weekFailed={week.error}
        retry={() => void (formsQ.isError && formsQ.refetch(), week.error && week.refetch())}
        rivalryIds={shownRivalries.map((r) => r.id)}
        callAbove={callAbove}
        watching={watching}
        onShow={hide && hidden ? showAll : null}
        weekly={league.startsWith("football/")}
        off={!!lnow && !lnow.on}
        now={now}
      />
      <SeasonRivalries rivalries={rivalries.filter((r) => !shownRivalries.some((x) => x.id === r.id))} teams={teams} hidden={hidden} meId={meId} league={league} />
      <YourGamesHere league={league} name={name} lnow={lnow} />
      <RoomLine league={league} />
      {rest.length > 0 && (
        <NavLink
          href={paths.league(league, "scores")}
          replace
          data-league-rest
          className="nd-press mt-6 flex min-h-[60px] items-center gap-3 border-y border-border py-2 focus-visible:outline-2 focus-visible:outline-foreground"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-semibold">The rest of {lnow?.week ?? "this week"}</span>
            <span className="mt-[3px] block truncate text-[13px] text-muted-foreground">
              {rest.length} more {rest.length === 1 ? "game" : "games"} in {name} · Scores
            </span>
          </span>
          <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
        </NavLink>
      )}
    </div>
  );
}

/** Your move in the league, when one's due: the show strip's own form (a white plate, the chyron tag), the page's one yellow. */
function MoveStrip({ league }: { league: string }) {
  const { moves } = useLeagueGames(league);
  const nav = useNav();
  const m = moves[0];
  if (!m) return null;
  return (
    <section className="pt-3" data-league-move>
      <button
        type="button"
        onClick={() => nav.push(m.href)}
        className="nd-press flex min-h-[58px] w-full items-stretch overflow-hidden rounded-[3px] bg-plate text-left text-plate-foreground shadow-plate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <span className="type-caption -mr-[13px] flex flex-none items-center whitespace-nowrap bg-chyron py-0 pl-[11px] pr-[22px] text-[15px] tracking-[0.04em] text-chyron-foreground [clip-path:polygon(0_0,100%_0,calc(100%_-_13px)_100%,0_100%)]">
          Your move
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] py-2 pl-5 pr-1">
          {/* The move on its own ("Fill in your sheet"), its count on the small line with the game ("Predictions · Game 12 · 1
              question"): a count after the move broke the line wherever it wrapped (BACKLOG 254 j). */}
          <b className="line-clamp-2 text-[16px] font-bold leading-tight [text-wrap:balance]">{m.text.replace(/ \(([^)]+)\)$/, "")}</b>
          <small className="truncate text-[14px] leading-tight text-plate-muted">
            {/* The count first: a truncation then cuts the game's name, never how much there is to do. */}
            {[/ \(([^)]+)\)$/.exec(m.text)?.[1], m.leagueName, moves.length > 1 ? `+${moves.length - 1} more` : null].filter(Boolean).join(" · ")}
          </small>
        </span>
        <span className="grid flex-none place-items-center px-2.5">
          <ChevronRight className="size-5" aria-hidden />
        </span>
      </button>
    </section>
  );
}

/** A game's words from one team's side: "Sun 1:00 PM vs Cowboys", "On now · 14–10 at Jets", "W 24–17 vs Cowboys", "Started 1:00 PM". */
function useSideWords(g: WeekGame | null, team: string): { text: string; live: boolean } {
  const s = useGameScore(g);
  if (!g) return { text: "", live: false };
  const us = g.sides.find((x) => x.id === team);
  const them = g.sides.find((x) => x.id !== team);
  const vs = `${us?.home ? "vs" : "at"} ${them?.short ?? ""}`;
  if (!s.started) return { text: `${g.at ? `${dayOf(g.at)} ${clockOf(g.at)}` : "Time to be set"} ${vs}`, live: false };
  if (!s.open) return { text: `${s.when} ${vs}`, live: false };
  const score = us?.score != null && them?.score != null ? `${us.score}–${them.score}` : "";
  if (g.state === "post" || g.final) {
    const r = us?.winner ? "W" : them?.winner ? "L" : us?.score != null && us.score === them?.score ? "T" : "";
    return { text: `${[r, score].filter(Boolean).join(" ")} ${vs}`.trim(), live: false };
  }
  return { text: `On now · ${score} ${vs}`.trim(), live: true };
}

/** The couch's teams ranked by record: standings rows of two lines, yours on the raised row. */
function CouchTable(p: {
  league: string;
  name: string;
  teams: Team[];
  forms: Map<string, TeamForm>;
  games: WeekGame[];
  solo: boolean;
  meId: string;
  hidden: boolean;
  loading: boolean;
  failed: boolean;
  weekFailed: boolean;
  retry: () => void;
  /** The rivalries drawn above as cards: their teams' rows say so instead of repeating the game. */
  rivalryIds: string[];
  /** C2: the games in This week's calls, and what their rows say instead ("Jordan's call, above"). */
  callAbove: Map<string, string>;
  /** Who's watching each game now (C2). */
  watching: Watching[];
  onShow: (() => void) | null;
  weekly: boolean;
  off: boolean;
  now: number;
}) {
  const { teams, forms, meId, hidden } = p;
  const ranked = rankTeams(teams, forms, meId, hidden || p.failed);
  const title = p.solo ? "Your teams" : "The couch’s teams";
  return (
    <section data-couch-table={teams.length} className="mt-2">
      <SportsLabel
        aside={
          p.onShow ? (
            <button type="button" data-show-records onClick={p.onShow} className="nd-press -my-3 inline-flex h-11 items-center gap-1.5 rounded-[4px] px-3 text-[13px] font-semibold text-foreground outline-1 -outline-offset-1 outline-edge focus-visible:outline-2 focus-visible:outline-foreground">
              <Eye className="size-4" aria-hidden /> Show records
            </button>
          ) : !hidden && teams.length > 1 ? (
            <span className="text-[13px] text-muted-foreground">By record</span>
          ) : null
        }
      >
        {title}
      </SportsLabel>
      {p.loading && !teams.length ? (
        <div aria-busy className="flex animate-pulse flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[60px] rounded-[3px] bg-card" />
          ))}
        </div>
      ) : !teams.length ? (
        <p data-couch-table-empty className="text-[14px] leading-snug text-muted-foreground">
          {p.solo ? `You don’t follow a team in ${p.name} yet.` : `Nobody on the couch follows a ${p.name} team yet.`}{" "}
          <NavLink href={paths.league(p.league, "scores")} replace data-find-team className="inline-flex min-h-11 items-center font-semibold text-foreground underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
            Find a team in this week&rsquo;s games
          </NavLink>
        </p>
      ) : (
        <ol className="flex flex-col">
          {ranked.map(({ team, place }) => (
            <TeamRow
              key={team.id}
              t={team}
              place={teams.length > 1 ? place : null}
              ranked={teams.length > 1 && ranked.some((x) => x.place != null)}
              leader={place === 1 && teams.length > 1}
              form={hidden ? undefined : forms.get(team.id)}
              week={weekGameOf(team.id, p.games, p.now)}
              weekFailed={p.weekFailed}
              rivalry={p.games.some((g) => p.rivalryIds.includes(g.id) && g.sides.some((s) => s.id === team.id))}
              callAbove={(() => {
                const g = weekGameOf(team.id, p.games, p.now).g;
                return g ? (p.callAbove.get(g.id) ?? null) : null;
              })()}
              watching={p.watching}
              solo={p.solo}
              meId={meId}
              weekly={p.weekly}
              off={p.off}
              league={p.league}
            />
          ))}
        </ol>
      )}
      {(p.failed || p.weekFailed) && teams.length > 0 && (
        <p data-table-failed className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
          {p.weekFailed ? "This week’s games didn’t load." : "Records didn’t load."}
          <button type="button" onClick={p.retry} className="nd-press inline-flex h-11 items-center font-semibold text-foreground underline underline-offset-[3px]">
            Try again
          </button>
        </p>
      )}
    </section>
  );
}

function TeamRow({ t, place, ranked, leader, form, week, weekFailed, rivalry, callAbove, watching, solo, meId, weekly, off, league }: { t: Team; place: number | null; leader: boolean; form: TeamForm | undefined; week: { g: WeekGame | null; more: number }; weekFailed: boolean; ranked: boolean; rivalry: boolean; callAbove: string | null; watching: Watching[]; solo: boolean; meId: string; weekly: boolean; off: boolean; league: string }) {
  const words = useSideWords(week.g, t.id);
  const yours = t.followers.some((f) => f.id === meId);
  const record = form ? recordWords(form) : null;
  const more = week.more ? ` · +${week.more} more this week` : "";
  const game = weekFailed ? "" : rivalry ? `Rivalry, above${more}` : callAbove ? `${callAbove}${more}` : week.g ? `${words.text}${more}` : off ? "Off-season" : weekly ? "Bye" : "No games this week";
  const above = rivalry || !!callAbove;
  // C2: who's watching its game now (faces after the words, three at most).
  const watchers = words.live && week.g ? watching.filter((w) => w.game === week.g!.id) : [];
  const fans = t.followers.map((f) => (f.id === meId ? "you" : f.name));
  return (
    <li>
      <button
        type="button"
        data-couch-team={t.id}
        data-yours={yours || undefined}
        onClick={() => openSports({ kind: "team", league, team: t.id })}
        aria-label={[`${place ? `${place}. ` : ""}${t.short}`, record, !solo && fans.length ? `followed by ${fans.join(", ")}` : null, game].filter(Boolean).join(". ")}
        className={`nd-press grid w-full ${ranked ? "grid-cols-[22px_30px_1fr_auto]" : "grid-cols-[30px_1fr_auto]"} items-center gap-x-2.5 gap-y-1 rounded-[3px] px-2 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground ${yours && !solo ? "bg-secondary" : "border-b border-border"}`}
      >
        {/* The leader's place in bold foreground, never yellow: yellow is yours or now, and the leader may not be yours (the check). */}
        {ranked && <span className={`type-num text-center text-[15px] ${leader ? "font-bold text-foreground" : "text-muted-foreground"}`}>{place ?? ""}</span>}
        <TeamMark abbr={t.abbreviation ?? t.short.slice(0, 3)} color={t.color} size="sm" team={teamKeyOf(league, t.id)} />
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[16px] font-bold">{t.short}</span>
          {!solo && <Faces marks={t.followers.map((f) => ({ userId: f.id, name: f.name, you: f.id === meId }))} size={20} max={3} ground={yours ? "var(--secondary)" : "var(--background)"} />}
        </span>
        <span className="type-num text-right text-[19px] leading-none">{record ?? ""}</span>
        {ranked && <span />}
        <span className="col-span-3 flex min-w-0 items-center gap-2">
          {form && form.form.length > 0 && <FormTicks form={form.form} />}
          <span className={`flex min-w-0 items-center gap-1.5 text-[13px] ${words.live && !above ? "text-foreground" : "text-muted-foreground"}`}>
            {words.live && !above && <i className="size-[7px] flex-none rounded-full bg-live" aria-hidden />}
            <span className="truncate">{game}</span>
            {!above && watchers.length > 0 && <Faces marks={watchers.map((w) => ({ userId: w.userId, name: w.name, you: w.userId === meId }))} size={16} max={3} ground={yours && !solo ? "var(--secondary)" : "var(--background)"} />}
          </span>
        </span>
      </button>
    </li>
  );
}

/** The last five, oldest first: a tinted W, an outlined L, a half-filled T (the team sheet's form strip, small). */
function FormTicks({ form }: { form: TeamForm["form"] }) {
  return (
    <span className="flex flex-none gap-[3px]" role="img" aria-label={`Last ${form.length}: ${form.map((f) => f.result).join(", ")}`} data-form>
      {form.map((f) => (
        <span
          key={f.id}
          aria-hidden
          className={`grid h-[18px] w-[17px] place-items-center rounded-[2px] text-[12px] font-extrabold leading-none outline-1 -outline-offset-1 ${
            f.result === "W" ? "bg-good text-good-foreground outline-transparent dark:bg-good/15 dark:text-(--nd-good)" : f.result === "T" ? "bg-[linear-gradient(90deg,var(--secondary)_50%,transparent_50%)] text-foreground outline-border" : "text-muted-foreground outline-border"
          }`}
        >
          {f.result}
        </span>
      ))}
    </span>
  );
}

/** The couch's rivalries this season: each fan's record at the head; the next two to come and the last two played, the rest folded. */
function SeasonRivalries({ rivalries, teams, hidden, meId, league }: { rivalries: Rivalry[]; teams: Team[]; hidden: boolean; meId: string; league: string }) {
  const who = (f: Fan) => (f.id === meId ? "you" : f.name);
  const [all, setAll] = useState(false);
  const now = useNow();
  if (!rivalries.length) return null;
  const played = rivalries.filter((r) => r.at && Date.parse(r.at) <= now);
  const coming = rivalries.filter((r) => !r.at || Date.parse(r.at) > now);
  const shown = all ? [...coming, ...[...played].reverse()] : [...coming.slice(0, 2), ...played.slice(-2).reverse()];
  const rec = hidden ? [] : rivalryRecords(rivalries).slice(0, 3);
  return (
    <section data-season-rivalries={rivalries.length} className="mt-2">
      <SportsLabel>Rivalries this season</SportsLabel>
      {/* Each fan's record in the couch's rivalries, under the heading (beside it, it squeezed the heading onto two lines). */}
      {rec.length > 0 && (
        <p data-rivalry-records className="-mt-1 mb-1 truncate text-[13px] text-muted-foreground">
          {rec.map((x) => `${who(x.fan) === "you" ? "You" : x.fan.name} ${x.w}–${x.l}${x.t ? `–${x.t}` : ""}`).join(" · ")}
        </p>
      )}
      <ul>
        {shown.map((r) => (
          <SeasonRivalryRow key={r.id} r={r} teams={teams} hidden={hidden} who={who} league={league} />
        ))}
      </ul>
      {shown.length < rivalries.length && (
        <button type="button" data-rivalries-all onClick={() => setAll(true)} className="nd-press mt-1 flex h-11 items-center gap-1 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-foreground">
          All {rivalries.length} <ChevronRight className="size-4" aria-hidden />
        </button>
      )}
    </section>
  );
}

function SeasonRivalryRow({ r, teams, hidden, who, league }: { r: Rivalry; teams: Team[]; hidden: boolean; who: (f: Fan) => string; league: string }) {
  const s = useGameScore({ id: r.id, at: r.at, state: r.state, final: r.final });
  const open = s.open && !hidden;
  const a = teams.find((t) => t.id === r.away);
  const b = teams.find((t) => t.id === r.home);
  const done = open && r.final && r.score;
  const won = done ? (r.winner === r.away ? 0 : r.winner === r.home ? 1 : null) : null;
  // "You over Riley", "Riley over you", "Sam vs Jordan".
  const cap = (x: string) => (x.startsWith("you") ? `Y${x.slice(1)}` : x);
  const people = cap(done && won != null ? `${who(r.fans[won])} over ${who(r.fans[1 - won])}` : `${who(r.fans[0])} vs ${who(r.fans[1])}`);
  // Winner first, as "Jordan over Sam" reads.
  const right = done ? (won === 1 ? `${r.score![1]}–${r.score![0]}` : `${r.score![0]}–${r.score![1]}`) : s.started && !open ? "Started" : r.at ? clockOf(r.at) : "";
  return (
    <li data-season-rivalry={r.id} className="border-b border-border">
      <button type="button" onClick={() => openSports({ kind: "game", league, team: r.home, game: r.id })} className="nd-press flex min-h-[56px] w-full items-center gap-3 py-1.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground">
      <span className="w-[74px] flex-none text-[13px] font-bold">{r.at ? dayOf(r.at) : "To be set"}</span>
      {/* Side by side, not overlapped: the overlap cut a four-letter code's last letter (BACKLOG 254 j). */}
      <span className="flex flex-none gap-1">
        <TeamMark abbr={a?.abbreviation ?? a?.short.slice(0, 3)} color={a?.color} size="xs" team={a && teamKeyOf(league, a.id)} />
        <TeamMark abbr={b?.abbreviation ?? b?.short.slice(0, 3)} color={b?.color} size="xs" team={b && teamKeyOf(league, b.id)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {a?.short} at {b?.short}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{people}</span>
      </span>
      <span className="type-num flex-none text-[15px] text-muted-foreground">{right}</span>
      </button>
    </li>
  );
}

/** The room's latest line (round 2's item 5; BACKLOG 254 r): who said what last, one row into Chat. For anyone hiding a game's score
 *  (or watching it as if live), a thread's message written after its kickoff is passed over for the newest they may read. */
function RoomLine({ league }: { league: string }) {
  const couch = useCurrentCouch(useHome().data);
  const latest = useRoomLatest(league, couch?.id ?? null).data?.messages ?? [];
  const hide = useHideSports();
  const shown = useShownScores();
  const recorded = new Set((useSportsRecordings().data?.recordings ?? []).map((r) => r.game));
  const held = (m: (typeof latest)[number]) => !!m.event && !!m.eventAt && Date.parse(m.at) >= Date.parse(m.eventAt) && ((hide && !shown.has(m.event)) || recorded.has(m.event));
  const m = [...latest].reverse().find((x) => !held(x));
  if (!couch || !m) return null;
  return (
    <NavLink href={paths.league(league, "chat")} replace data-room-line className="nd-press mt-6 flex min-h-[60px] items-center gap-3 border-y border-border py-2 focus-visible:outline-2 focus-visible:outline-foreground">
      <Avatar id={m.userId ?? m.name} name={m.name} size={28} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px]">
          <b className="font-semibold">{m.name}</b>
          {m.lap ? " took a victory lap" : m.gif ? " sent a GIF" : `: ${m.text}`}
        </span>
        <span className="mt-[3px] block truncate text-[13px] text-muted-foreground">
          {m.eventName ? `${m.eventName} · ` : ""}
          {clockOf(m.at)} · Chat
        </span>
      </span>
      <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
    </NavLink>
  );
}

/** Your games in the league, then starting one: the old sheet's rows, under the table (PFD's R5: never above it). */
function YourGamesHere({ league, name, lnow }: { league: string; name: string; lnow: LeagueNow | null }) {
  const { yours } = useLeagueGames(league);
  const { games } = useLeagueWeek(league, lnow?.from ?? null, lnow?.to ?? null);
  const now = useNow();
  const couch = useCurrentCouch(useHome().data);
  // Nothing of yours and nothing to start (the off-season, a week played out, or no couch: a sports start needs one): no heading
  // over nothing (BACKLOG 254 j; the Games tab's build, solo).
  if (!yours.length && (!couch || !games.some((g) => !begun(g, now)))) return null;
  return (
    <section data-league-games className="mt-2">
      <SportsLabel>{yours.length ? "Your games here" : "Play"}</SportsLabel>
      <LeagueGameRows league={league} quiet />
      <LeagueStart league={league} leagueName={name} from={lnow?.from} to={lnow?.to} quiet />
    </section>
  );
}
