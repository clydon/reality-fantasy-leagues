"use client";

// A league's page (docs/PLAN-sports-couch.md B1; the design: docs/design-round/league-page-spec.md, -first-view.md, -shape.md): its
// own page, reached from the league's card in Your shows and search's league row, with its tabs under a bar of its own. This week
// is the couch in the league this week, in the first-view order PFD set: your due move (the one yellow), this week's rivalry, the
// couch's teams ranked by record; then rivalries this season, your games, and the rest of the league one row into Scores. Scores and
// Games carry the old league sheet's parts until their own sessions; Standings and Chat join the tab bar when they're built.
//
// Every result on it (a record, a form tick, a score, a rivalry's winner, the table's order) goes through Hide sports scores: with it
// on, none shows, the table is ordered yours first then by fans, and Show records shows them all for the visit (showScore).

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Eye, ListOrdered, Swords, Trophy, type LucideIcon } from "lucide-react";
import { useCouchTeams, useCurrentCouch, useHome, useLeaguesNow, useLeagueTeams, useYourTeams, type WeekGame } from "../data";
import { NavLink, useNav } from "../nav";
import { isLeagueTab, LEAGUE_TABS, paths, type LeagueTab } from "../routes";
import { Avatar, Faces } from "../ui/bars";
import { FollowToggle, theLeague, useLeagueFollow } from "../sports/follow";
import { SportsLabel, TeamMark } from "../sports/parts";
import { begun, clockOf, dayOf, showScore, useGameScore, useHideSports, useNow, useShownScores } from "../sports/scores";
import { LeagueGameRows, LeagueStart, openSports, startOn, useLeagueGames, useLeagueWeek } from "../sports/sheets";
import { rankTeams, recordWords, rivalriesOf, rivalryRecords, type Fan, type Rivalry, type TeamForm } from "@/lib/sports/couch-table";
import type { LeagueNow } from "@/lib/sports/league-now";
import { LeagueScores } from "./league-scores";
import { LeagueGames } from "./league-games";

const TABS: Record<LeagueTab, { label: string; icon: LucideIcon }> = {
  week: { label: "This week", icon: CalendarDays },
  scores: { label: "Scores", icon: ListOrdered },
  games: { label: "Games", icon: Trophy },
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
      {/* The show bar's compact form, without art (a league has none: our marks, never logos), Night in both themes. */}
      <header
        ref={bar}
        data-league-bar={league}
        className="dark sticky top-[var(--nd-top,0px)] z-20 bg-[linear-gradient(135deg,#2a2633,#100e15)] px-2 pb-3 pt-[calc(8px+env(safe-area-inset-top,0px))] text-foreground"
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => nav.back(paths.home, undefined, undefined, (p) => p.startsWith(`/league/${league}/`))}
            className="flex h-11 items-center gap-0.5 rounded-[3px] pl-1 pr-2.5 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-foreground"
          >
            <ChevronLeft className="size-5" aria-hidden />
            Home
          </button>
          <span className="ml-auto">
            <FollowToggle on={f.on} disabled={!f.ready || f.busy} onClick={() => void f.toggle()} label={theLeague(name)} data="league-bar" />
          </span>
        </div>
        <h1 className="type-caption truncate px-2 pt-2 text-[28px] leading-none">{loading ? " " : name}</h1>
        <p data-league-sub className="mt-1.5 h-[18px] truncate px-2 text-[13.5px] font-semibold text-muted-foreground">
          {sub}
        </p>
      </header>
      <main style={{ paddingBottom: "calc(96px + env(safe-area-inset-bottom, 0px))" }}>{children}</main>
      <LeagueTabBar league={league} current={tab} />
    </>
  );
}

/** The league's tabs, the show's tab bar's form: a tab move replaces the history entry, so Back leaves the league. */
function LeagueTabBar({ league, current }: { league: string; current: LeagueTab }) {
  const i = LEAGUE_TABS.indexOf(current);
  const n = LEAGUE_TABS.length;
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
  // This week's rivalry: the one on now, else the next, else the one just played.
  const thisWeek = rivalries.filter((r) => inWeek.has(r.id));
  const live = thisWeek.find((r) => {
    const g = week.games.find((x) => x.id === r.id);
    return g && begun(g, now) && g.state !== "post" && !g.final;
  });
  const rivalry = live ?? thisWeek.find((r) => !r.at || Date.parse(r.at) > now) ?? thisWeek[thisWeek.length - 1] ?? null;
  const rest = week.games.filter((g) => !g.sides.some((s) => teams.some((t) => t.id === s.id)));
  const showAll = () => {
    for (const id of results) showScore(id);
    for (const g of weekBegun) showScore(g.id, league);
  };
  return (
    <div data-this-week>
      <MoveStrip league={league} />
      {rivalry && <RivalryCard r={rivalry} g={week.games.find((x) => x.id === rivalry.id) ?? null} teams={teams} forms={forms} hidden={hidden} league={league} meId={meId} />}
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
        rivalryId={rivalry?.id ?? null}
        onShow={hide && hidden ? showAll : null}
        weekly={league.startsWith("football/")}
        off={!!lnow && !lnow.on}
        now={now}
      />
      <SeasonRivalries rivalries={rivalries.filter((r) => r.id !== rivalry?.id)} teams={teams} hidden={hidden} meId={meId} league={league} />
      <YourGamesHere league={league} name={name} lnow={lnow} />
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

/** This week's rivalry: two couch members' teams meeting, read through the people, their teams and records (no VS: 2026-11-12). */
function RivalryCard({ r, g, teams, forms, hidden, league, meId }: { r: Rivalry; g: WeekGame | null; teams: Team[]; forms: Map<string, TeamForm>; hidden: boolean; league: string; meId: string }) {
  const who = (f: Fan) => (f.id === meId ? "You" : f.name);
  const moment = g ?? { id: r.id, at: r.at, state: r.state, final: r.final };
  const s = useGameScore(moment);
  const open = s.open && !hidden;
  const final = !!g && (g.state === "post" || g.final);
  const live = s.started && open && !final;
  const status = !s.started ? (r.at ? `${dayOf(r.at)} ${clockOf(r.at)}` : "Time to be set") : open ? (final ? "Final" : "On now") : s.when;
  const team = (id: string) => teams.find((t) => t.id === id);
  const away = team(r.away);
  const home = team(r.home);
  const sideOf = (id: string) => g?.sides.find((x) => x.id === id);
  const winner = open && final ? (sideOf(r.away)?.winner ? r.away : sideOf(r.home)?.winner ? r.home : null) : null;
  const say = (t: Team | undefined, fan: Fan) => `${fan.id === meId ? "Your" : `${fan.name}'s`} ${t?.short ?? "team"}${open && forms.get(t?.id ?? "") ? `, ${recordWords(forms.get(t!.id)!) ?? "no record yet"}` : ""}`;
  return (
    <section data-rivalry={r.id} aria-label={`This week's rivalry: ${say(away, r.fans[0])} at ${say(home, r.fans[1])}. ${status}.`} className="mt-4 rounded-[4px] bg-card px-3.5 pb-3 pt-3">
      <div className="flex items-center gap-2">
        <Swords className="size-4 flex-none text-muted-foreground" aria-hidden />
        <h2 className="type-caption text-[17px] tracking-[0.03em]">This week&rsquo;s rivalry</h2>
        <span data-rivalry-status className="ml-auto flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          {live && <i className="size-[7px] rounded-full bg-live motion-safe:animate-pulse" aria-hidden />}
          <span className={live ? "text-foreground" : undefined}>{status}</span>
        </span>
      </div>
      <button
        type="button"
        data-rivalry-open
        onClick={() => openSports({ kind: "game", league, team: r.home, game: r.id })}
        aria-label={`Open ${away?.short ?? ""} at ${home?.short ?? ""}`}
        className="nd-press -mx-1.5 mt-1.5 flex w-[calc(100%+12px)] flex-col gap-2 rounded-[3px] px-1.5 py-1 text-left focus-visible:outline-2 focus-visible:outline-foreground"
      >
        {([r.away, r.home] as const).map((id, i) => (
          <RivalrySide key={id} t={team(id)} fan={r.fans[i]} name={who(r.fans[i])} form={forms.get(id)} side={sideOf(id)} open={open} started={s.started} lost={!!winner && winner !== id} />
        ))}
      </button>
      {!s.started && (
        <button
          type="button"
          data-rivalry-start
          onClick={() => openSports(startOn(league, r.home, home?.short ?? "", { kind: "games", games: [r.id] }))}
          className="nd-press mt-3 flex h-11 w-full items-center justify-center rounded-[4px] text-[15px] font-bold outline-1 -outline-offset-1 outline-edge focus-visible:outline-2 focus-visible:outline-foreground"
        >
          Start a game on it
        </button>
      )}
    </section>
  );
}

/** One side of the rivalry: the team's mark and name, its fan's face and name under it with the record, the score at the right. */
function RivalrySide({ t, fan, name, form, side, open, started, lost }: { t: Team | undefined; fan: Fan; name: string; started: boolean; form: TeamForm | undefined; side: WeekGame["sides"][number] | undefined; open: boolean; lost: boolean }) {
  const record = open && form ? recordWords(form) : null;
  return (
    <div className={`flex min-h-[48px] items-center gap-3 ${lost ? "text-muted-foreground" : ""}`} data-rivalry-side={t?.id}>
      <TeamMark abbr={t?.abbreviation ?? t?.short.slice(0, 3)} color={t?.color} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold leading-tight">{t?.short}</span>
        <span className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
          <Avatar id={fan.id} name={fan.name} size={18} />
          <span className="truncate">
            {name}
            {record ? ` · ${record}` : ""}
          </span>
        </span>
      </span>
      {open && started && side?.score != null && <span className="type-num flex-none text-[26px] leading-none">{side.score}</span>}
    </div>
  );
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
  rivalryId: string | null;
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
              rivalry={!!p.rivalryId && p.games.some((g) => g.id === p.rivalryId && g.sides.some((s) => s.id === team.id))}
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

function TeamRow({ t, place, ranked, leader, form, week, weekFailed, rivalry, solo, meId, weekly, off, league }: { t: Team; place: number | null; leader: boolean; form: TeamForm | undefined; week: { g: WeekGame | null; more: number }; weekFailed: boolean; ranked: boolean; rivalry: boolean; solo: boolean; meId: string; weekly: boolean; off: boolean; league: string }) {
  const words = useSideWords(week.g, t.id);
  const yours = t.followers.some((f) => f.id === meId);
  const record = form ? recordWords(form) : null;
  const more = week.more ? ` · +${week.more} more this week` : "";
  const game = weekFailed ? "" : rivalry ? `Rivalry, above${more}` : week.g ? `${words.text}${more}` : off ? "Off-season" : weekly ? "Bye" : "No games this week";
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
        <TeamMark abbr={t.abbreviation ?? t.short.slice(0, 3)} color={t.color} size="sm" />
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[16px] font-bold">{t.short}</span>
          {!solo && <Faces marks={t.followers.map((f) => ({ userId: f.id, name: f.name, you: f.id === meId }))} size={20} max={3} ground={yours ? "var(--secondary)" : "var(--background)"} />}
        </span>
        <span className="type-num text-right text-[19px] leading-none">{record ?? ""}</span>
        {ranked && <span />}
        <span className="col-span-3 flex min-w-0 items-center gap-2">
          {form && form.form.length > 0 && <FormTicks form={form.form} />}
          <span className={`flex min-w-0 items-center gap-1.5 text-[13px] ${words.live && !rivalry ? "text-foreground" : "text-muted-foreground"}`}>
            {words.live && !rivalry && <i className="size-[7px] flex-none rounded-full bg-live" aria-hidden />}
            <span className="truncate">{game}</span>
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
        <TeamMark abbr={a?.abbreviation ?? a?.short.slice(0, 3)} color={a?.color} size="xs" />
        <TeamMark abbr={b?.abbreviation ?? b?.short.slice(0, 3)} color={b?.color} size="xs" />
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
