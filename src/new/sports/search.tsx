"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import { useCouchTeams, useCurrentCouch, useHome, useLeaguesNow, useSportsSearch, useTeamSchedule, useYourTeams, type CouchTeam, type FoundTeams, type WeekGame } from "../data";
import { Avatar } from "../ui/bars";
import { FollowFaces, FollowToggle, theLeague, useLeagueFollow, useTeamFollow } from "./follow";
import { GameBug } from "./game-bug";
import { TeamMark } from "./parts";
import { AskSheet } from "./scorebug";
import { begun, clockOf, dayOf, useNow } from "./scores";
import { teamKeyOf } from "@/lib/sports/team-badge";
import { IN_SEASON, rankSports, type Ranked } from "@/lib/sports/search-rank";

// What Add's search finds of sports (docs/PLAN-sports-couch.md B3; the design: docs/design-round/search-spec.md, -first-view.md,
// -shape.md): one card for a strong sports meaning (a team with its game on now or next as the shared scorebug, a matchup with their
// next meeting, a league with its week), then rows (teams, leagues, and the tours nothing opens yet), from /api/sports/search (the
// edge keeps each an hour). Add a show or team (watching/sheets.tsx) and first run (welcome/first-run.tsx) draw the same parts;
// first run's action is Pick (`pick`), Add's is Follow. Before typing: the major leagues as tiles, and the couch's teams.

export type TeamPick =
  | { kind: "team"; league: string; team: string; name: string; against?: string; short?: string; abbr?: string | null; color?: string | null; leagueName?: string | null }
  | { kind: "league"; league: string; leagueName: string };

type Hit = FoundTeams["teams"][number];
type Matchup = NonNullable<FoundTeams["matchup"]>;
type League = FoundTeams["leagues"][number];
export type RankedSports = Ranked<Hit, Matchup, League>;

/** First run's picking instead of following (no account yet): what's picked, and the toggle. */
export type Picking = { has: (key: string) => boolean; toggle: (p: TeamPick) => void };
export const pickKey = (p: TeamPick) => (p.kind === "team" ? `team:${p.league}/${p.team}` : `league:${p.league}`);

/** The words, asked once typing pauses; `failed` when ESPN didn't answer. */
export function useTeamSearch(q: string) {
  const [asked, setAsked] = useState(q);
  useEffect(() => {
    const id = setTimeout(() => setAsked(q), 300);
    return () => clearTimeout(id);
  }, [q]);
  const found = useSportsSearch(asked);
  const t = q.trim();
  const data: FoundTeams | undefined = t.length >= 2 ? found.data : undefined;
  return { data, loading: t.length >= 2 && (asked !== q || found.isFetching), failed: t.length >= 2 && found.isError && !found.isFetching, retry: () => void found.refetch() };
}

/** The search's sports, ranked: the card, then the rows (search-rank.ts). The couch's teams lead. */
export function useRankedSports(data: FoundTeams | undefined): RankedSports {
  const home = useHome().data;
  const couch = useCurrentCouch(home);
  const couchTeams = useCouchTeams(couch?.id ?? null).data?.teams;
  const [now] = useState(() => Date.now());
  return useMemo(() => rankSports(data, new Set((couchTeams ?? []).filter((t) => t.followers.length).map((t) => `${t.league}/${t.id}`)), now), [data, couchTeams, now]);
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthDay = (iso: string) => {
  const d = new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return `${SHORT_MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
};
/** A game's day, one way everywhere in search: "Today", "Tomorrow", else "Thu, Nov 26" (the check's P5). */
const dayDate = (iso: string) => {
  const d = dayOf(iso);
  return d === "Today" || d === "Tomorrow" ? d : `${new Date(iso).toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" })}, ${monthDay(iso)}`;
};

/** ESPN lists a game whose time isn't set yet at midnight in the East (the team page's rule). */
const timeOf = (iso: string) => (new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) === "12:00 AM" ? "TBD" : clockOf(iso));

/** A team's next game in words, never a score (a row is no place for one): on now, its day and time, or when its season starts. */
export function nextWords(n: Hit["next"], now: number) {
  if (!n) return "No games listed";
  const vs = `${n.home === false ? "at" : "vs"} ${n.opponent?.short ?? "TBD"}`;
  if (n.state === "in") return `On now ${vs}`;
  if (n.at && begun({ at: n.at, state: n.state })) return `Started ${clockOf(n.at)} ${vs}`;
  if (!n.at) return `Time to be set ${vs}`;
  if (Date.parse(n.at) - now > IN_SEASON) return `Season starts ${monthDay(n.at)}`;
  return `${dayOf(n.at)} ${timeOf(n.at)} ${vs}`;
}

const Group = ({ label, data }: { label: string; data?: string }) => (
  <p data-search-group={data} className="type-caption mb-1 mt-5 text-[14px] tracking-[0.04em] text-muted-foreground">
    {label}
  </p>
);

/** Who on the couch follows it, in names, with their faces (faces with names: many have no photo). */
function couchLine(followers: { id: string; name: string }[], me: string) {
  if (!followers.length) return null;
  const you = followers.some((f) => f.id === me);
  const others = followers.filter((f) => f.id !== me).map((f) => f.name.split(" ")[0]);
  const named = [...(you ? ["You"] : []), ...others.slice(0, you ? 1 : 2)];
  const more = others.length - (named.length - (you ? 1 : 0));
  const who = more > 0 ? `${named.join(", ")} and ${more} more` : named.length > 1 ? `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}` : named[0];
  return `${who} follow${!you && named.length === 1 && more <= 0 ? "s" : ""} them`;
}

// ---------- the card ----------

/** The card for a strong sports meaning, or nothing. `onOpen` goes to the place (closing Add); `onGame` runs as a game's sheet opens. */
export function SportsCard({ ranked, onOpen, onGame, pick }: { ranked: RankedSports; onOpen: (p: TeamPick) => void; onGame?: () => void; pick?: Picking }) {
  const c = ranked.card;
  if (!c) return null;
  if (c.kind === "team") return <TeamCard t={c.team} onOpen={onOpen} onGame={onGame} pick={pick} />;
  if (c.kind === "matchup") return <MatchupCard m={c.matchup} onOpen={onOpen} onGame={onGame} pick={pick} />;
  return <LeagueCard l={c.league} onOpen={onOpen} pick={pick} />;
}

// No panel of its own (the sheet is the card colour): flush with the rows, the scorebug its only fill.
const CARD = "mt-4";

/** The card's title line: what it is, opening its place (or picking it, in first run), and its one action at the end. */
function CardHead({ start, title, sub, onOpen, action, data }: { start: ReactNode; title: string; sub: string; onOpen: () => void; action?: ReactNode; data: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" data-search-open={data} data-hit={title} data-hit-kind={data} onClick={onOpen} className="nd-press flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
        {start}
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-0.5">
            <b className="type-caption truncate text-[22px] leading-none">{title}</b>
            <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
          </span>
          <small className="mt-1 block truncate text-[13px] text-muted-foreground">{sub}</small>
        </span>
      </button>
      {action}
    </div>
  );
}

/** First run's Pick: a state like Follow, its picked state the follow's quiet fill with a check. */
function PickToggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${on ? "Picked" : "Pick"} ${label}`}
      data-search-pick
      onClick={onClick}
      className={`nd-press inline-flex min-h-11 min-w-[6.5rem] flex-none items-center justify-center gap-1 rounded-full px-3.5 text-[14px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${on ? "bg-secondary text-foreground" : "outline-1 -outline-offset-1 outline-edge"}`}
    >
      {on && <Check className="size-4 flex-none" strokeWidth={2.5} aria-hidden />}
      {on ? "Picked" : "Pick"}
    </button>
  );
}

function TeamFollowAction({ t }: { t: Hit }) {
  const f = useTeamFollow(t.league, t.id, { short: t.short, leagueName: t.leagueName });
  return <FollowToggle on={f.on} disabled={!f.ready} onClick={() => void f.toggle()} label={`the ${t.short}`} data="search-team" />;
}

function CouchFollowLine({ league, team }: { league: string; team: string }) {
  const home = useHome().data;
  const couch = useCurrentCouch(home);
  const followers = useCouchTeams(couch?.id ?? null).data?.teams.find((x) => x.league === league && x.id === team)?.followers ?? [];
  // Yours alone draws no sentence: Following already says it (the team page's rule).
  const me = home?.user.id ?? "";
  const line = followers.some((f) => f.id !== me) ? couchLine(followers, me) : null;
  if (!line) return null;
  return (
    <p data-search-couch className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
      <FollowFaces who={followers} />
      <span className="min-w-0 truncate">{line}</span>
    </p>
  );
}

/** Where a team's from, as its full name says it ("Philadelphia" of "Philadelphia Eagles"): the card's title is the short name. */
const placeOf = (t: { name: string; short: string }) => (t.name.endsWith(` ${t.short}`) ? t.name.slice(0, -t.short.length - 1) : null);

const pickOf = (t: Omit<Hit, "next">, against?: string): TeamPick => ({ kind: "team", league: t.league, team: t.id, name: t.name, short: t.short, abbr: t.abbreviation, color: t.color, leagueName: t.leagueName, ...(against ? { against } : {}) });

/** A team: its name and league, the couch on it, its game on now or next as the shared scorebug (into that game's sheet), Follow. */
function TeamCard({ t, onOpen, onGame, pick }: { t: Hit; onOpen: (p: TeamPick) => void; onGame?: () => void; pick?: Picking }) {
  const sched = useTeamSchedule(t.league, t.id);
  const now = useNow();
  const [asking, setAsking] = useState<WeekGame | null>(null);
  const s = sched.data;
  const games = s?.games ?? [];
  const live = games.find((g) => g.state === "in" && !g.calledOff) ?? null;
  const next = games.find((g) => !g.calledOff && !begun(g, now)) ?? null;
  const g = live ?? next;
  const p = pickOf(t);
  const label = !g ? null : live ? "On now" : !g.at ? "Next game" : Date.parse(g.at) - now > IN_SEASON ? `Season starts ${monthDay(g.at)}` : dayOf(g.at) === "Today" ? "Today" : `Next game · ${dayDate(g.at)}`;
  return (
    <section data-search-card="team" className={CARD}>
      <CardHead
        data="team"
        start={<TeamMark abbr={t.abbreviation ?? t.short.slice(0, 3)} color={t.color} team={teamKeyOf(t.league, t.id)} />}
        title={t.short}
        sub={[placeOf(t), t.leagueName ?? t.league].filter(Boolean).join(" · ")}
        onOpen={() => (pick ? pick.toggle(p) : onOpen(p))}
        action={pick ? <PickToggle on={pick.has(pickKey(p))} onClick={() => pick.toggle(p)} label={t.name} /> : <TeamFollowAction t={t} />}
      />
      {!pick && <CouchFollowLine league={t.league} team={t.id} />}
      {sched.isLoading ? (
        <div aria-busy className="mt-3 h-[76px] animate-pulse rounded-[4px] bg-secondary" />
      ) : s && g ? (
        <div className="mt-3" inert={pick ? true : undefined}>
          <p className="type-caption mb-1.5 text-[13px] tracking-[0.05em] text-muted-foreground">{label}</p>
          <GameBug g={g} s={s} now={now} onAsk={setAsking} onOpened={onGame} />
        </div>
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground">{s ? "No games coming up" : "Their games didn’t load"}</p>
      )}
      {!pick && <AskSheet g={asking} onClose={() => setAsking(null)} />}
    </section>
  );
}

/** Two teams: their next meeting as the scorebug (into its sheet, where Play is); none left, their meetings on the first team's page. */
function MatchupCard({ m, onOpen, onGame, pick }: { m: Matchup; onOpen: (p: TeamPick) => void; onGame?: () => void; pick?: Picking }) {
  const [a, b] = m.teams;
  const sched = useTeamSchedule(m.league, a.id, b.id);
  const now = useNow();
  const [asking, setAsking] = useState<WeekGame | null>(null);
  const s = sched.data;
  const g = s?.games.find((x) => !x.calledOff && (x.state === "in" || !begun(x, now))) ?? null;
  // Away at home, as the bug reads (the next meeting's sides, else the search's).
  const homeId = g ? (g.home === false ? b.id : a.id) : m.home;
  const home = homeId === b.id ? b : a;
  const away = home === a ? b : a;
  // First run: a matchup picks both teams (the check's C8), and unpicks both.
  const both = !!pick && pick.has(pickKey(pickOf(a))) && pick.has(pickKey(pickOf(b)));
  const pickBoth = () => {
    if (!pick) return;
    for (const t of [a, b]) if (pick.has(pickKey(pickOf(t))) === both) pick.toggle(pickOf(t));
  };
  return (
    <section data-search-card="matchup" className={CARD}>
      <CardHead
        data="matchup"
        start={
          <span className="flex flex-none -space-x-2">
            <TeamMark abbr={away.abbreviation ?? away.short.slice(0, 3)} color={away.color} team={teamKeyOf(m.league, away.id)} />
            <TeamMark abbr={home.abbreviation ?? home.short.slice(0, 3)} color={home.color} team={teamKeyOf(m.league, home.id)} />
          </span>
        }
        title={`${away.short} at ${home.short}`}
        sub={`${m.leagueName ?? m.league} · ${g?.at ? `Their next meeting · ${dayDate(g.at)}` : s ? "No meetings left this season" : "Their meetings"}`}
        onOpen={() => (pick ? pickBoth() : onOpen(pickOf(a, b.id)))}
        action={pick ? <PickToggle on={both} onClick={pickBoth} label={`${a.name} and ${b.name}`} /> : undefined}
      />
      {sched.isLoading ? (
        <div aria-busy className="mt-3 h-[76px] animate-pulse rounded-[4px] bg-secondary" />
      ) : s && g ? (
        <div className="mt-3" inert={pick ? true : undefined}>
          <GameBug g={g} s={s} now={now} onAsk={setAsking} onOpened={onGame} />
        </div>
      ) : null}
      {!pick && <AskSheet g={asking} onClose={() => setAsking(null)} />}
    </section>
  );
}

/** A league's state today, in a few words ("Week 12", "Off-season · back Mar 26"). */
function leagueState(n: { on: boolean; week: string | null; back: string | null } | null | undefined) {
  if (!n) return null;
  if (n.on) return n.week ?? "In season";
  return n.back ? `Off-season · back ${monthDay(`${n.back}T12:00:00Z`)}` : "Off-season";
}

/** A league's or tour's short mark: its own where people say one ("F1", "PGA"), else its initials, else its name's first letters. */
const MARK: Record<string, string> = { "racing/f1": "F1", "golf/pga": "PGA", "golf/eur": "DPWT", "golf/liv": "LIV", "golf/lpga": "LPGA", "golf/champions-tour": "PGAC", "mma/ufc": "UFC", "racing/irl": "INDY", "racing/nascar-premier": "NAS" };
const markOf = (league: string, name: string) => {
  if (MARK[league]) return MARK[league];
  if (name.length <= 4) return name;
  const initials = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0]).join("");
  return (initials.length >= 2 ? initials : name).slice(0, 4).toUpperCase();
};
const LeagueTile = ({ league, name }: { league: string; name: string }) => <span className="type-caption grid size-10 flex-none place-items-center rounded-[3px] bg-secondary text-[14px]">{markOf(league, name)}</span>;

function LeagueCard({ l, onOpen, pick }: { l: League; onOpen: (p: TeamPick) => void; pick?: Picking }) {
  const n = useLeaguesNow([l.league])[0]?.data;
  const p: TeamPick = { kind: "league", league: l.league, leagueName: l.leagueName };
  return (
    <section data-search-card="league" className={CARD}>
      <CardHead
        data="league"
        start={<LeagueTile league={l.league} name={l.leagueName} />}
        title={l.name && l.name.length <= 26 ? l.name : l.leagueName}
        sub={leagueState(n) ?? l.leagueName}
        onOpen={() => (pick ? pick.toggle(p) : onOpen(p))}
        action={pick ? <PickToggle on={pick.has(pickKey(p))} onClick={() => pick.toggle(p)} label={l.leagueName} /> : <LeagueFollowAction league={l.league} leagueName={l.leagueName} />}
      />
      {!pick && <LeagueCouchLine league={l.league} />}
    </section>
  );
}

function LeagueFollowAction({ league, leagueName }: { league: string; leagueName: string }) {
  const f = useLeagueFollow(league, leagueName);
  return <FollowToggle on={f.on} disabled={!f.ready || f.busy} onClick={() => void f.toggle()} label={theLeague(leagueName)} data="search-league" />;
}

function LeagueCouchLine({ league }: { league: string }) {
  const home = useHome().data;
  const couch = useCurrentCouch(home);
  const followers = useCouchTeams(couch?.id ?? null).data?.leagues.find((x) => x.league === league)?.followers ?? [];
  if (!followers.length) return null;
  const me = home?.user.id ?? "";
  const others = followers.filter((f) => f.id !== me).length;
  const you = followers.some((f) => f.id === me);
  return (
    <p data-search-couch className="mt-2 flex items-center gap-2 text-[13px] text-muted-foreground">
      <FollowFaces who={followers} />
      <span>{you ? (others ? `You and ${others} on the couch follow it` : "You follow it") : `${others} on the couch follow${others === 1 ? "s" : ""} it`}</span>
    </p>
  );
}

// ---------- the rows ----------

function Row({ start, title, sub, onClick, data, end, pressable = true }: { start: ReactNode; title: string; sub: ReactNode; onClick?: () => void; data: string; end?: ReactNode; pressable?: boolean }) {
  const inner = (
    <>
      {start}
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[16px]">{title}</b>
        <small className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-muted-foreground">{sub}</small>
      </span>
    </>
  );
  if (!pressable)
    return (
      <div data-hit={title} data-hit-kind={data} className="flex min-h-16 w-full items-center gap-3 border-b border-border text-left">
        {inner}
      </div>
    );
  return (
    <div className="flex min-h-16 items-center gap-2 border-b border-border">
      <button type="button" data-hit={title} data-hit-kind={data} onClick={onClick} className="nd-press flex min-h-16 min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground">
        {inner}
        {!end && <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />}
      </button>
      {end}
    </div>
  );
}

/** The rows under the card: teams (college ones alike folded), leagues with Follow, tours said as they are; or that ESPN didn't answer. */
export function SportsRows({ ranked, onOpen, pick, loading, failed, retry }: { ranked: RankedSports; onOpen: (p: TeamPick) => void; pick?: Picking; loading?: boolean; failed?: boolean; retry?: () => void }) {
  const [open, setOpen] = useState(false);
  const [now] = useState(() => Date.now());
  const teams = open ? [...ranked.teams, ...ranked.folded] : ranked.teams;
  const any = teams.length || ranked.folded.length || ranked.leagues.length || ranked.tours.length;
  if (failed)
    return (
      <p data-sports-failed className="mt-5 flex items-center gap-2 text-[14px] text-muted-foreground">
        Teams didn’t load.
        <button type="button" onClick={retry} className="nd-press min-h-11 font-semibold text-foreground underline underline-offset-[3px]">
          Try again
        </button>
      </p>
    );
  if (!any)
    return loading ? (
      <p data-sports-looking aria-live="polite" className="mt-5 flex min-h-11 items-center text-[14px] text-muted-foreground">
        Looking for teams…
      </p>
    ) : null;
  return (
    <div data-sports-results aria-busy={loading || undefined}>
      {teams.length > 0 && <Group label={ranked.card?.kind === "matchup" ? "The teams" : ranked.card ? "More teams" : "Teams"} data="teams" />}
      {teams.map((t) => {
        const p = pickOf(t);
        return (
          <Row
            key={`${t.league}/${t.id}`}
            data="team"
            start={<TeamMark abbr={t.abbreviation ?? t.short.slice(0, 3)} color={t.color} team={teamKeyOf(t.league, t.id)} />}
            title={t.name}
            sub={`${t.leagueName ?? t.league}${t.next ? ` · ${nextWords(t.next, now)}` : ""}`}
            onClick={() => (pick ? pick.toggle(p) : onOpen(p))}
            end={pick ? <PickToggle on={pick.has(pickKey(p))} onClick={() => pick.toggle(p)} label={t.name} /> : undefined}
          />
        );
      })}
      {!open && ranked.folded.length > 0 && (
        <button type="button" data-sports-more onClick={() => setOpen(true)} className="nd-press flex min-h-12 w-full items-center gap-1 border-b border-border text-left text-[14px] font-semibold text-muted-foreground">
          More college teams · {ranked.folded.length}
          <ChevronRight className="size-4 rotate-90" aria-hidden />
        </button>
      )}
      {open && ranked.folded.length > 0 && (
        <button type="button" data-sports-fewer onClick={() => setOpen(false)} className="nd-press flex min-h-12 w-full items-center gap-1 border-b border-border text-left text-[14px] font-semibold text-muted-foreground">
          Fewer teams
          <ChevronRight className="size-4 -rotate-90" aria-hidden />
        </button>
      )}
      {ranked.leagues.length > 0 && <Group label="Leagues" data="leagues" />}
      {ranked.leagues.slice(0, 3).map((l) => (
        <LeagueRow key={l.league} l={l} onOpen={onOpen} pick={pick} />
      ))}
      {ranked.tours.length > 0 && (
        <>
          {/* Said once for them all (the check's C5): nothing in the app opens a tour yet. */}
          <Group label="Tours" data="tours" />
          <p className="-mt-0.5 mb-1 text-[13px] text-muted-foreground">Their own pages and games come later.</p>
        </>
      )}
      {ranked.tours.slice(0, 3).map((l) => (
        <Row key={l.league} data="tour" pressable={false} start={<LeagueTile league={l.league} name={l.leagueName} />} title={l.name ?? l.leagueName} sub={sportWord(l.league)} />
      ))}
    </div>
  );
}

const SPORT: Record<string, string> = { golf: "Golf", racing: "Racing", mma: "MMA", tennis: "Tennis" };
const sportWord = (league: string) => SPORT[league.split("/")[0]] ?? "Events";

/** A league found: its row opens the league; Follow sits in the chevron's slot, its own button (A3). */
function LeagueRow({ l, onOpen, pick }: { l: League; onOpen: (p: TeamPick) => void; pick?: Picking }) {
  const p: TeamPick = { kind: "league", league: l.league, leagueName: l.leagueName };
  return (
    <div data-league-row={l.league}>
      <Row
        data="league"
        start={<LeagueTile league={l.league} name={l.leagueName} />}
        title={l.name ?? l.leagueName}
        sub="Every game, week by week"
        onClick={() => (pick ? pick.toggle(p) : onOpen(p))}
        end={pick ? <PickToggle on={pick.has(pickKey(p))} onClick={() => pick.toggle(p)} label={l.leagueName} /> : <LeagueFollowAction league={l.league} leagueName={l.leagueName} />}
      />
    </div>
  );
}

// ---------- before typing ----------

/** The major leagues, as Sports shows them before typing (two to a row). */
const MAJOR: [string, string][] = [
  ["football/nfl", "NFL"],
  ["basketball/nba", "NBA"],
  ["baseball/mlb", "MLB"],
  ["hockey/nhl", "NHL"],
  ["football/college-football", "College football"],
  ["basketball/mens-college-basketball", "College hoops"],
  ["soccer/usa.1", "MLS"],
  ["soccer/eng.1", "Premier League"],
];

/** The leagues as tiles, yours first and checked, each with today's state; a tile opens the league's page. */
export function LeagueTiles({ onOpen }: { onOpen: (p: TeamPick) => void }) {
  const mine = useYourTeams().data?.leagues ?? [];
  const order = [...MAJOR].sort((a, b) => Number(mine.includes(b[0])) - Number(mine.includes(a[0])));
  const nows = useLeaguesNow(order.map((x) => x[0]));
  return (
    <>
      <Group label="Leagues" data="league-tiles" />
      <div data-league-tiles className="grid grid-cols-2 gap-2">
        {order.map(([league, name], i) => {
          const on = mine.includes(league);
          const state = leagueState(nows[i]?.data);
          return (
            <button
              key={league}
              type="button"
              data-league-tile={league}
              aria-label={`${name}${on ? ", following" : ""}${state ? `, ${state}` : ""}`}
              onClick={() => onOpen({ kind: "league", league, leagueName: name })}
              className="nd-press relative flex min-h-16 flex-col justify-center rounded-[4px] bg-secondary px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              <b className="type-caption block pr-5 text-[19px] leading-[.95]">{name}</b>
              <small className="mt-1 block truncate text-[12px] text-muted-foreground">{state ?? " "}</small>
              {on && <Check className="absolute right-2.5 top-2.5 size-4" strokeWidth={2.5} aria-hidden />}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** The couch's teams you don't follow. */
export function useCouchFollows() {
  const home = useHome().data;
  const couch = useCurrentCouch(home);
  const teams = useCouchTeams(couch?.id ?? null).data?.teams;
  return useMemo(() => (teams ?? []).filter((t) => !t.you && t.followers.length), [teams]);
}

/** Three of them at most: whose team (a face and the name), Follow. Nothing when there are none. */
export function CouchFollows({ teams, onOpen }: { teams: CouchTeam[]; onOpen: (p: TeamPick) => void }) {
  if (!teams.length) return null;
  return (
    <>
      <Group label="Your couch follows" data="couch-follows" />
      {teams.slice(0, 3).map((t) => (
        <CouchTeamRow key={`${t.league}/${t.id}`} t={t} onOpen={onOpen} />
      ))}
    </>
  );
}

function CouchTeamRow({ t, onOpen }: { t: CouchTeam; onOpen: (p: TeamPick) => void }) {
  const f = useTeamFollow(t.league, t.id, { short: t.short, leagueName: null });
  const first = t.followers[0];
  const who = `${first.name.split(" ")[0]}’s team${t.followers.length > 1 ? ` · ${t.followers.length - 1} more` : ""}`;
  return (
    <Row
      data="couch-team"
      start={<TeamMark abbr={t.abbreviation ?? t.short.slice(0, 3)} color={t.color} team={teamKeyOf(t.league, t.id)} />}
      title={t.name}
      sub={
        <>
          <Avatar id={first.id} name={first.name} size={18} />
          <span className="truncate">{who}</span>
        </>
      }
      onClick={() => onOpen({ kind: "team", league: t.league, team: t.id, name: t.name })}
      end={<FollowToggle on={f.on} disabled={!f.ready} onClick={() => void f.toggle()} label={`the ${t.short}`} data="couch-team" />}
    />
  );
}
