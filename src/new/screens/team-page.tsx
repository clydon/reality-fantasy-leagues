"use client";

// A team's page (docs/PLAN-sports-couch.md B2; the design: docs/design-round/team-page-spec.md (Intent), -first-view.md (PFD),
// -shape.md (Impeccable)): a full page instead of the old sheet, at /league/<sport>/<code>/team/<id>, a level under its league.
// In the first-view order PFD set: who (the lower third, its league, record and place, the couch's faces), now (the game on now
// or the next, as the shared scorebug, and Play the next game: the one yellow), the season (a bar a game by margin, the bye a gap),
// then step 2.8's Start a game on and the schedule: one list of the season by month, results and games to come together, each row
// the scorebug's one-side form; Against (the old rival chips) filters it; a daily sport groups its homestands and road trips, and
// has a Month view.
//
// Every result here (the record and place, the bug's score, the bars, a row's result) goes through Hide sports scores: with it on,
// none shows, and one Show the season shows them for the visit (a key of its own in showScore's set: it moves no season's mark).

import { useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, Gamepad2, House, MessageCircle, Plane } from "lucide-react";
import { sportsApi, useCouchGames, useCouchTeams, useCurrentCouch, useGameSeasons, useHome, useLeaguesNow, useLeagueStandings, useMySportsGames, useRoomCounts, useSportsRecordings, useTeamSchedule, useWatching, useOwnCalls, type JoinGame, type TeamSchedule, type WeekGame } from "../data";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { toast } from "../ui/toast";
import { Avatar } from "../ui/bars";
import { openCouchSheet } from "../couch/couch-sheets";
import { FollowFaces, FollowToggle, theLeague, useTeamFollow } from "../sports/follow";
import { MoreAction, OpenRow, PlayPlate, SportsLabel, TeamMark, TeamPlate } from "../sports/parts";
import { CallRow, FanCard, callEntries, useCallGames, type CallMatch } from "../sports/fan-call";
import { joinable, JoinGameSheet } from "../couch/join-game";
import { AskSheet } from "../sports/scorebug";
import { GameBug } from "../sports/game-bug";
import { begun, clockOf, dayOf, showScore, useGameScore, useHideSports, useHideSportsKnown, useNow, useShownScores } from "../sports/scores";
import { openSports, startOn } from "../sports/sheets";
import { SeasonCallRow } from "../sports/season-call";
import { useStartSport } from "../sports/start";
import { asRow, CouchGameRow, couchName, versus, type StartWhen } from "../sports/team";
import { teamKeyOf } from "@/lib/sports/team-badge";
import { byesOf, eastDay, eastMonth, focusMonth, ordinal, recordOf, runsOf, seriesPlaces, streakOf, stripOf, stripWords, type Run, type StripItem } from "@/lib/sports/team-season";

type Game = TeamSchedule["games"][number];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAILY = new Set(["basketball", "hockey", "baseball"]);
/** A month's name from "2026-11". */
const monthName = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1];
const shortDate = (iso: string) => {
  const d = eastDay(iso);
  return `${SHORT[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
};
const weekday = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", timeZone: "America/New_York" });
const seasonKey = (league: string, team: string) => `season:${league}/${team}`;
/** Its time, or "TBD": ESPN lists a game whose time isn't set yet at midnight in the East (real MLB's road games, an NFL flex game). */
const timeOf = (iso: string) => (new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) === "12:00 AM" ? "TBD" : clockOf(iso));
const RIVALS = 3;

/** The screen: the bar, then the page, or its loading, failed and no-such-team states. */
export function TeamPageScreen({ league, team, against }: { league: string; team: string; against: string | null }) {
  const nav = useNav();
  const sched = useTeamSchedule(league, team);
  const s = sched.data;
  // Back is where you came from (any page of this visit), else up to the league's This week.
  const back = () => nav.back(paths.league(league), () => true);
  return (
    <>
      <TeamBar league={league} team={team} s={s ?? null} onBack={back} />
      <main data-team-page-root style={{ paddingBottom: "calc(40px + env(safe-area-inset-bottom, 0px))" }} className="px-4">
        {sched.isLoading ? (
          <div aria-busy data-team-page-loading>
            <div className="mt-3 h-12 animate-pulse rounded-[3px] bg-card" />
            <div className="mt-1 h-7 w-40 animate-pulse rounded-b-[3px] bg-card" />
            <div className="mt-5 h-[76px] animate-pulse rounded-[4px] bg-card" />
            <div className="mt-3.5 h-16 animate-pulse rounded-[4px] bg-card" />
            <div className="mt-6 h-28 animate-pulse rounded-[4px] bg-card" />
          </div>
        ) : !s ? (
          <div data-team-page-failed className="mt-10 text-[15px] text-muted-foreground">
            {sched.error ? (
              <>
                <p>Their season didn’t load.</p>
                <button type="button" onClick={() => void sched.refetch()} className="nd-press mt-2 inline-flex h-11 items-center rounded-[3px] px-3.5 text-[14px] font-semibold text-foreground outline-1 -outline-offset-1 outline-edge">
                  Try again
                </button>
              </>
            ) : (
              <p>
                No such team here.{" "}
                <NavLink href={paths.league(league)} className="font-semibold text-foreground underline underline-offset-[3px]">
                  The league’s page
                </NavLink>
              </p>
            )}
          </div>
        ) : (
          <TeamPageBody league={league} team={team} s={s} against={against} />
        )}
      </main>
    </>
  );
}

/** The page's own bar: Back and Follow, Night in both themes (the league bar's ground); the plate below is the title. */
function TeamBar({ league, team, s, onBack }: { league: string; team: string; s: TeamSchedule | null; onBack: () => void }) {
  const f = useTeamFollow(league, team, s && { short: s.team.short, leagueName: s.leagueName });
  return (
    <header data-team-bar className="dark sticky top-[var(--nd-top,0px)] z-20 flex h-[calc(56px+env(safe-area-inset-top,0px))] items-center gap-1.5 bg-[linear-gradient(135deg,#2a2633,#100e15)] px-2 pt-[env(safe-area-inset-top,0px)] text-foreground">
      <button type="button" data-team-back onClick={onBack} className="flex h-11 items-center gap-0.5 rounded-[3px] pl-1 pr-2.5 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-foreground">
        <ChevronLeft className="size-5" aria-hidden />
        Back
      </button>
      {s && (
        <span className="ml-auto">
          <FollowToggle on={f.on} onClick={() => void f.toggle()} label={`the ${s.team.short}`} data="team" />
        </span>
      )}
    </header>
  );
}

function TeamPageBody({ league, team, s, against: firstAgainst }: { league: string; team: string; s: TeamSchedule; against: string | null }) {
  const now = useNow();
  const f = useTeamFollow(league, team, s && { short: s.team.short, leagueName: s.leagueName });
  const qc = useQueryClient();
  const hide = useHideSports();
  const known = useHideSportsKnown();
  const shown = useShownScores();
  const recordings = useSportsRecordings().data?.recordings;
  const { start, busy } = useStartSport();
  const sport = league.split("/")[0];
  const daily = DAILY.has(sport);
  const lnow = useLeaguesNow([league])[0]?.data ?? null;
  // The results on this page are told unless you hide sports scores (or before that's known) and haven't asked for the season.
  const told = known && (!hide || shown.has(seasonKey(league, team)));
  const standings = useLeagueStandings(league, told).data?.standings ?? null;
  const [against, setAgainst] = useState<string | null>(firstAgainst);
  const [asking, setAsking] = useState<WeekGame | null>(null);

  const games = useMemo(() => s.games.filter((g) => g.stage !== "pre"), [s.games]);
  const live = games.find((g) => g.state === "in" && !g.calledOff) ?? null;
  const next = games.find((g) => !g.calledOff && !begun(g, now)) ?? null;
  const nowGame = live ?? next;
  const record = recordOf(games);
  const streak = streakOf(games);
  const byes = useMemo(() => (lnow?.weeks?.length ? byesOf(games, lnow.weeks) : []), [games, lnow]);
  const strip = useMemo(() => stripOf(games, byes), [games, byes]);
  const lastGame = [...games].reverse().find((g) => !g.calledOff && g.final) ?? null;

  // The place in its group, where the standings read has the team ("1st in ZTN East").
  const place = useMemo(() => {
    for (const g of standings?.groups ?? []) {
      const ordered = [...g.entries].sort((a, b) => (a.seed != null && b.seed != null ? a.seed - b.seed : a.rank != null && b.rank != null ? a.rank - b.rank : 0));
      const i = ordered.findIndex((e) => e.team === team);
      if (i >= 0 && ordered.length > 1) return `${ordinal(ordered[i].rank ?? i + 1)} in ${g.name}`;
    }
    return null;
  }, [standings, team]);

  // The place is the standings' now: before this season's first final it's last season's, so it's left out.
  const playedAny = games.some((g) => g.final && !!g.result);
  const sub = [s.leagueName ?? league, told ? record : null, told && playedAny ? place : null].filter(Boolean).join(" · ");
  const others = f.followers.filter((x) => x.id !== f.me);
  const here = (f.mine.data?.teams ?? []).filter((t) => t.league === league);
  const choice = f.on && here.length > 1 && here.some((t) => t.id === team);
  const isMine = choice && !!here.find((t) => t.id === team)?.myTeam;
  const yourTeamWords = f.short.length <= 6 ? `Your ${f.short} team` : `Your team in ${theLeague(f.short)}`;
  const theirs = here.find((t) => t.myTeam);
  const followLine = isMine
    ? others.length
      ? `${yourTeamWords} · ${others.length === 1 ? `${others[0].name} follows them too` : `${others.length} others follow them too`}`
      : yourTeamWords
    : choice && theirs
      ? `${yourTeamWords}: the ${theirs.short}`
      : f.on
        ? others.length
          ? `You and ${others.length === 1 ? others[0].name : `${others.length} others`} follow them`
          : "You follow them"
        : others.length
          ? `${others.slice(0, 2).map((x) => x.name).join(" and ")}${others.length > 2 ? ` and ${others.length - 2} more` : ""} ${others.length === 1 ? "follows" : "follow"} them`
          : f.couch
            ? "Nobody on your couch follows them yet"
            : "Follow them: their games lead your guide";
  const makeMine = async () => {
    try {
      qc.setQueryData(["new-design", "your-teams"], await sportsApi.myTeam(league, team));
      await qc.invalidateQueries({ queryKey: ["new-design", "couch-teams"] });
      toast(`The ${s.team.short} are your ${f.short.length <= 6 ? `${f.short} team` : "team there"}`);
    } catch (e) {
      toast.quiet((e as Error).message);
    }
  };
  const onStart = (when: StartWhen) => openSports(startOn(league, team, s.team.short, when));

  // C2, the lone fan: the couch's calls in the league (this team's fans' record, the next game's call), who's watching.
  const couchId = f.couch?.id ?? null;
  const couchTeamsHere = (useCouchTeams(couchId).data?.teams ?? []).filter((t) => t.league === league && t.followers.length);
  const callsQ = useCallGames(couchId, league, [...couchTeamsHere.map((t) => t.id), team]);
  const calls = callsQ.data?.games ?? [];
  const watching = useWatching(couchId, league).data?.watching ?? [];
  const fans = couchTeamsHere.find((t) => t.id === team)?.followers ?? [];
  const meId = f.me ?? "";
  const lite = { id: s.team.id, short: s.team.short, abbreviation: s.team.abbreviation ?? null, color: s.team.color ?? null };
  // C4, solo: a fan on no couch calls their games into their own calls (no backing), and anyone following them calls the season.
  const solo = !f.couch;
  const ownQ = useOwnCalls(league, [team], f.on && !!meId);
  const ownCalls = ownQ.data?.calls ?? [];
  const seasonCall = ownQ.data?.seasons.find((c) => c.team === team) ?? null;
  const since = here.find((t) => t.id === team) as { since?: string } | undefined;
  const soloFans = [{ id: meId, name: "You", since: since?.since }];
  const callEntry = (() => {
    if ((!couchId && !(solo && f.on)) || !nowGame?.opponent) return null;
    const opp = { id: nowGame.opponent.id, short: nowGame.opponent.short, abbreviation: nowGame.opponent.abbreviation, color: couchTeamsHere.find((t) => t.id === nowGame.opponent!.id)?.color ?? null };
    const away = nowGame.home === false ? lite : opp;
    const home = nowGame.home === false ? opp : lite;
    const score = nowGame.score ? (nowGame.home === false ? nowGame.score : ([nowGame.score[1], nowGame.score[0]] as [number, number])) : null;
    const m: CallMatch = { id: nowGame.id, at: nowGame.at, state: nowGame.state, final: nowGame.final, called: nowGame.calledOff ? "postponed" : null, away, home, score };
    // A rivalry (each side has a fan the other hasn't) is This week's rivalry card's, not a call.
    const us = couchTeamsHere.find((t) => t.id === team)?.followers ?? [];
    const them = couchTeamsHere.find((t) => t.id === opp.id)?.followers ?? [];
    const rivalry = us.some((x) => !them.some((y) => y.id === x.id)) && them.some((x) => !us.some((y) => y.id === x.id));
    if (solo) return callEntries({ matches: [m], teams: [{ ...lite, followers: soloFans }] as never, calls: ownCalls, meId, rivalryIds: new Set(), now })[0] ?? null;
    return callEntries({ matches: [m], teams: couchTeamsHere as never, calls, meId, rivalryIds: new Set(rivalry ? [m.id] : []), now })[0] ?? null;
  })();
  // Your own call to make is the page's one yellow; Play the next game steps down (the call is a Pick'em on that same game).
  const callYellow = !!callEntry && !callEntry.call && callEntry.fan.id === meId;
  const onGame = (g: Game) => openSports({ kind: "game", league, team, game: g.id });

  return (
    <div data-team-page={`${league}/${team}`}>
      {/* Who: the lower third, its league (up to its page), record and place; the couch's faces; the fan card under (C2). */}
      <div data-team-head className="pt-2">
        <TeamPlate name={s.team.name} color={s.team.color} sub={sub} />
        <div className="mt-2.5 flex min-h-11 items-center gap-2" data-team-follow data-my-team={isMine || undefined}>
          <FollowFaces who={f.followers} />
          <span className="min-w-0 flex-1 text-[13px] leading-snug text-muted-foreground">
            {/* Short when it's only you: the bar's Following already says it (the critique); the line names the others. */}
            {followLine && (
              <span data-team-follow-line className={isMine ? "font-semibold text-foreground" : undefined}>
                {followLine}
              </span>
            )}
            {choice && !isMine && (
              <button
                type="button"
                data-make-my-team
                onClick={() => void makeMine()}
                className="nd-press -my-1 flex min-h-11 items-center text-[13px] font-bold text-foreground underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              >
                Make the {s.team.short} your team
              </button>
            )}
          </span>
          <NavLink href={paths.league(league)} data-team-league className="nd-press flex h-11 flex-none items-center gap-0.5 text-[13px] font-semibold text-foreground">
            {f.short}
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </NavLink>
        </div>
        {solo && f.on && known && (
          <FanCard
            league={league}
            team={lite}
            fans={soloFans}
            meId={meId}
            season={games.filter((g) => !g.calledOff).map((g) => ({ id: g.id, at: g.at }))}
            calls={ownCalls}
            told={told}
            onShow={() => showScore(seasonKey(league, team))}
            solo
          />
        )}
        {couchId && fans.length > 0 && known && (
          <FanCard
            league={league}
            team={lite}
            fans={fans}
            meId={meId}
            season={games.filter((g) => !g.calledOff).map((g) => ({ id: g.id, at: g.at }))}
            calls={calls}
            told={told}
            onShow={() => showScore(seasonKey(league, team))}
          />
        )}
      </div>

      {/* Now: the game on now, else the next, as the shared scorebug; Play the next game under it (the one yellow). */}
      <section data-team-now className="mt-4">
        {nowGame ? (
          <>
            {/* Its day here, so the bug's status column says only the time (a day's word overran it: "TOMORROW"). */}
            <p data-team-now-label className="type-caption mb-2 text-[14px] tracking-[0.05em] text-muted-foreground">{live ? "On now" : !nowGame.at ? "Next game" : dayOf(nowGame.at) === "Today" ? "Today" : `Next game · ${dayOf(nowGame.at)}${/^(Tomorrow|[A-Z][a-z]{2})$/.test(dayOf(nowGame.at)) ? `, ${shortDate(nowGame.at)}` : ""}`}</p>
            <GameBug g={nowGame} s={s} now={now} onAsk={setAsking} />
            {callEntry && (couchId || solo) && (
              <CallRow
                e={callEntry}
                league={league}
                calls={solo ? ownCalls : calls}
                loading={solo ? ownQ.isLoading : callsQ.isLoading}
                hidden={!told}
                meId={meId}
                couchId={couchId}
                yellow={callYellow}
                watchers={watching.filter((w) => w.game === callEntry.m.id)}
                bare
              />
            )}
          </>
        ) : (
          <p data-team-over className="text-[14px] text-muted-foreground">
            {lastGame?.at ? `Season over · their last game ${weekday(lastGame.at)}, ${shortDate(lastGame.at)}` : "No games listed for them yet."}
          </p>
        )}
        {f.couch && next && <PlayNext g={next} busy={busy} quiet={callYellow} onPlay={(g) => void start({ league, team, games: [g.id], game: "pickem" })} />}
        {/* C4: the season call, for anyone following them (yours alone, couch or not). */}
        {f.on && known && <SeasonCallRow league={league} team={lite} season={ownQ.data?.schedules[team] ?? []} call={seasonCall} told={told} now={now} loading={ownQ.isLoading} />}
      </section>

      {games.length > 0 && (
        <>
      {/* The season, graphed: a bar a game by margin (the team's record by week: Standings' note), held while results are hidden. */}
      <section data-team-season>
        <SportsLabel aside={told && record ? <span className="type-num text-[14px] font-bold">{[record, streak].filter(Boolean).join(" · ")}</span> : null}>The season</SportsLabel>
        {!known ? (
          <div className="h-24 animate-pulse rounded-[4px] bg-card" />
        ) : !playedAny ? (
          <p data-season-ahead className="text-[14px] text-muted-foreground">
            {(() => {
              const first = games.find((g) => !g.calledOff && g.at);
              const n = games.filter((g) => !g.calledOff && g.stage !== "post").length;
              return first?.at ? `${n} games, from ${weekday(first.at)}, ${shortDate(first.at)}. Nothing played yet.` : "Nothing played yet.";
            })()}
          </p>
        ) : told ? (
          <SeasonStrip items={strip} streak={streak} daily={daily} liveId={live?.id ?? null} />
        ) : (
          <div data-season-hidden className="rounded-[4px] bg-card px-3.5 py-3">
            <p className="text-[14px] text-muted-foreground">
              {strip.filter((i) => i.kind === "game" && i.result).length || "No"} games played. Results are hidden.
            </p>
            <button
              type="button"
              data-show-season
              onClick={() => showScore(seasonKey(league, team))}
              className="nd-press mt-2 inline-flex h-11 items-center rounded-[3px] px-3.5 text-[14px] font-semibold outline-1 -outline-offset-1 outline-edge focus-visible:outline-2 focus-visible:outline-foreground"
            >
              Show the season
            </button>
          </div>
        )}
      </section>

      {/* Start a game on (step 2.8's rows, approved 2026-11-21): bigger games beside the one yellow. */}
      {f.couch && next && (
        <section>
          <SportsLabel>Start a game on</SportsLabel>
          <div data-scopes>
            <OpenRow data="scope-next" title="The next game" line={`${versus(next)} · a draft, squares or props`} onClick={() => onStart({ kind: "next" })} />
            <OpenRow
              data="scope-season"
              title="Their season"
              line={`${games.filter((g) => !g.calledOff && !begun(g, now)).length} games left · ${s.team.short} players only`}
              onClick={() => onStart({ kind: "season" })}
            />
            {/* The next series only (P1 in the check: four drew six starts beside the one yellow); a daily sport's schedule carries
                Start a game on each homestand and road trip. */}
            {s.series
              .filter((x) => x.state === "coming" && x.games.length >= 2 && !!x.from && Date.parse(x.from) - now < 14 * 86_400_000)
              .slice(0, 1)
              .map((x) => (
                <OpenRow key={x.games.join()} data="series" title={x.name} line={`${x.games.length} games · both teams' players`} onClick={() => onStart({ kind: "games", games: x.games })} />
              ))}
          </div>
        </section>
      )}
      {/* C2: the couch's games on this team's next game (by their maker, Join or Open); its call and rivalry are the rows above. */}
      {f.couch && next && <TeamCouchGames league={league} short={s.team.short} next={next} now={now} skip={new Set(calls.map((c) => c.leagueId))} />}
      {/* C4, solo: more on the team, your own games (a draft against computer players, or any game on their season); the couch last. */}
      {solo && next && (
        <section data-team-more>
          <SportsLabel>{`More on the ${s.team.short}`}</SportsLabel>
          <OpenRow
            data="solo-draft"
            title={`A draft of ${s.team.short} players`}
            line="You and computer players · the rest of the season"
            onClick={() => openSports({ kind: "start", target: { kind: "team", league, team, teamName: s.team.short, when: { kind: "season" }, base: SOLO_DRAFT, bots: SOLO_BOTS } })}
          />
          <OpenRow data="solo-season" title={`Every ${s.team.short} game`} line="Pick’em on each, or Best Ball" onClick={() => onStart({ kind: "season" })} />
          <CouchLine />
        </section>
      )}

      <Schedule
        league={league}
        team={team}
        s={s}
        games={games}
        byes={byes.map((b) => ({ label: b.label, from: b.from }))}
        daily={daily}
        now={now}
        told={told}
        recorded={new Set((recordings ?? []).map((r) => r.game))}
        nextId={nowGame?.id ?? null}
        against={against}
        onAgainst={setAgainst}
        onGame={onGame}
        onStart={onStart}
        canStart={!!f.couch}
      />
        </>
      )}
      <p className="mt-6 text-[12px] text-muted-foreground">From ESPN</p>
      <AskSheet g={asking} onClose={() => setAsking(null)} />
    </div>
  );
}


/** The couch's games on a team's next game (C2: "his games on the team's page"): a season, series or one-game game that covers it,
 *  by its maker, with Join or Open, as the game's sheet lists them (B4). A call's and a rivalry's games are left out (`skip`). */
function TeamCouchGames({ league, short, next, now, skip }: { league: string; short: string; next: Game; now: number; skip: Set<string> }) {
  const home = useHome().data;
  const couch = useCurrentCouch(home);
  const nav = useNav();
  const [joining, setJoining] = useState<JoinGame | null>(null);
  const couchGames = useCouchGames(couch?.id ?? null, !!couch).data?.games ?? [];
  const seasons = useGameSeasons(league, next.id).data?.seasons ?? [];
  const covering = couchGames.filter((c) => {
    if (c.ended || !c.seasonId || skip.has(c.leagueId)) return false;
    const at = seasons.find((x) => x.seasonId === c.seasonId);
    if (!at) return false;
    const from = c.span?.from ?? c.start ?? 1;
    const to = c.span?.to ?? Infinity;
    return at.episode >= from && at.episode <= to;
  });
  if (!couch || !covering.length) return null;
  const moveOf = (c: JoinGame) => home?.moves.find((m) => m.leagueId === c.leagueId) ?? null;
  return (
    <section data-team-couch-games={covering.length}>
      <SportsLabel>Games on the {short}</SportsLabel>
      {covering.slice(0, 3).map((c) => (
        <CouchGameRow
          key={c.leagueId}
          c={c}
          started={begun(next, now)}
          spans={!(c.span && c.span.from === c.span.to)}
          move={moveOf(c)?.text ?? null}
          joinBelow={false}
          onOpen={() => nav.push(paths.gamePage(c.seasonId!, c.leagueId))}
          onJoin={() => (joinable(c) ? setJoining(c) : nav.push(paths.gamePage(c.seasonId!, c.leagueId)))}
        />
      ))}
      {covering.length > 3 && <p className="mt-2 text-[13px] text-muted-foreground">+{covering.length - 3} more on the Games tab · {couchName(covering[3])}</p>}
      <JoinGameSheet couchId={couch.id} game={joining} onOpenChange={(o) => !o && setJoining(null)} />
    </section>
  );
}

/** Play the next game: Pick'em on it, one tap, its line naming the game (so with a game on above it, there's no doubt which). */
function PlayNext({ g, busy, quiet, onPlay }: { g: Game; busy: boolean; quiet?: boolean; onPlay: (g: Game) => void }) {
  // The game first, then a short day (a weekday within the week, else the date), so the line holds one line at 390 (the check).
  const d = g.at ? dayOf(g.at) : null;
  const day = !g.at ? "time to be set" : /,/.test(d!) ? shortDate(g.at) : d!;
  const when = !g.at ? day : timeOf(g.at) === "TBD" ? `${day}, time to be set` : `${day} ${clockOf(g.at)}`;
  const title = d === "Today" ? "Play the game tonight" : "Play the next game";
  const line = `Pick'em ${versus(g)} · ${when} · tells the couch`;
  // C2: outlined while your own call on this game is the page's yellow.
  if (quiet)
    return (
      <div className="mt-3">
        <MoreAction data="next" title={title} line={line} onClick={() => !busy && onPlay(g)} />
      </div>
    );
  return <PlayPlate data="next" disabled={busy} title={title} line={line} onClick={() => onPlay(g)} />;
}

/** The season as a bar a game: up for a win, down for a loss, its height the margin; a tie a tick; to come a faint tick; the bye a
 *  gap; the playoffs' start a dashed rule. Read, not tapped (the schedule is the way into a game). */
function SeasonStrip({ items, streak, daily, liveId }: { items: StripItem[]; streak: string | null; daily: boolean; liveId: string | null }) {
  const W = 358;
  const mid = 40;
  const half = 34;
  const n = Math.max(items.length, 1);
  const slot = W / n;
  const bar = daily ? Math.max(1, slot - (slot > 3 ? 1 : 0.4)) : Math.min(22, slot * 0.72);
  const maxMargin = Math.max(1, ...items.map((i) => (i.kind === "game" ? i.margin : 0)));
  const months: { x: number; label: string }[] = [];
  let lastMonth = "";
  items.forEach((it, k) => {
    if (it.month !== lastMonth) {
      lastMonth = it.month;
      const x = k * slot + slot / 2;
      const label = SHORT[Number(it.month.slice(5, 7)) - 1];
      // Too close to the last label (a month of two games at the season's edge): this month's takes its place.
      if (months.length && x - months[months.length - 1].x <= 30) months[months.length - 1] = { x, label };
      else months.push({ x, label });
    }
  });
  // Words are HTML over the bars, placed by percentage, so they never stretch with the chart (the critique: the SVG's
  // preserveAspectRatio none stretched its text on a wider screen).
  const pct = (x: number) => `${(x / W) * 100}%`;
  const liveAt = liveId ? items.findIndex((i) => i.kind === "game" && i.id === liveId) : -1;
  return (
    <div data-season-strip role="img" aria-label={stripWords(items, streak)} className="relative h-24">
    <svg viewBox={`0 0 ${W} 80`} className="block h-20 w-full" aria-hidden preserveAspectRatio="none">
      <line x1="0" x2={W} y1={mid} y2={mid} className="stroke-border" strokeWidth="1" />
      {items.map((it, k) => {
        const cx = k * slot + slot / 2;
        if (it.kind === "bye") return null;
        const x = cx - bar / 2;
        const rule = it.playoffStart ? <line key={`po-${k}`} x1={k * slot} x2={k * slot} y1={2} y2={mid + half} className="stroke-muted-foreground" strokeWidth="1" strokeDasharray="2 2" /> : null;
        if (!it.result) return [rule, <rect key={it.id} x={x} y={mid - 3} width={bar} height={6} rx={1} className="fill-muted-foreground" opacity={0.28} />];
        if (it.result === "T") return [rule, <rect key={it.id} x={x} y={mid - 1.5} width={bar} height={3} className="fill-foreground" opacity={0.7} />];
        const h = Math.max(3, (it.margin / maxMargin) * half);
        return [
          rule,
          <rect
            key={it.id}
            x={x}
            y={it.result === "W" ? mid - h : mid}
            width={bar}
            height={h}
            rx={daily ? 0 : 1.5}
            className={it.result === "W" ? "fill-(--nd-good)" : "fill-muted-foreground"}
            opacity={it.result === "W" ? 0.85 : 0.7}
          />,
        ];
      })}
    </svg>
      {/* The game on now: a live dot over its slot (no score: the bug above says what may be told). */}
      {liveAt >= 0 && <i aria-hidden className="absolute top-[30px] size-2 -translate-x-1/2 rounded-full bg-live" style={{ left: pct(liveAt * slot + slot / 2) }} />}
      {items.map((it, k) =>
        it.kind === "bye" ? (
          <span key={`bye-${k}`} aria-hidden className="absolute top-[44px] -translate-x-1/2 text-[9px] font-extrabold tracking-[0.04em] text-muted-foreground" style={{ left: pct(k * slot + slot / 2) }}>
            BYE
          </span>
        ) : null,
      )}
      {months.map((m) => (
        <span key={m.label + m.x} aria-hidden className="absolute bottom-0 -translate-x-1/2 text-[11px] font-semibold text-muted-foreground" style={{ left: pct(Math.min(Math.max(m.x, 12), W - 12)) }}>
          {m.label}
        </span>
      ))}
    </div>
  );
}

type Item = { kind: "game"; g: Game } | { kind: "bye"; label: string; from: string };

/** The schedule: Against, List · Month (a daily sport), then the season by month. */
function Schedule(props: {
  league: string;
  team: string;
  s: TeamSchedule;
  games: Game[];
  byes: { label: string; from: string }[];
  daily: boolean;
  now: number;
  told: boolean;
  recorded: Set<string>;
  nextId: string | null;
  against: string | null;
  onAgainst: (id: string | null) => void;
  onGame: (g: Game) => void;
  onStart: (w: StartWhen) => void;
  canStart: boolean;
}) {
  const { league, s, games, byes, daily, now, against, onAgainst, onGame, onStart, canStart } = props;
  const [view, setView] = useState<"list" | "month">("list");
  const [earlier, setEarlier] = useState(false);
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [allOpps, setAllOpps] = useState(false);
  const home = useHome().data;
  const couchTeams = useCouchTeams(useCurrentCouch(home)?.id ?? null).data?.teams;
  const fansOf = useMemo(() => new Map((couchTeams ?? []).filter((t) => t.league === league).map((t) => [t.id, t.followers])), [couchTeams, league]);
  // Each row's couch: the opponent's fans (not you), a game of yours on it and whether its pick is due, the room's talk about it.
  const meId = home?.user.id ?? "";
  const mine = useMySportsGames(true).data?.games;
  const playedBy = new Map((mine ?? []).filter((m) => m.league === league).map((m) => [m.event, m]));
  const dueOf = (id: string) => {
    const p = playedBy.get(id);
    return !!p && !!home?.moves.some((m) => m.leagueId === p.leagueId && (m.episode == null || m.episode === p.episode));
  };
  const talk = useRoomCounts(league, useCurrentCouch(home)?.id ?? null).data?.counts ?? {};
  const rivalsOf = (g: Game) => (g.opponent ? (fansOf.get(g.opponent.id) ?? []).filter((f) => f.id !== meId).map((f) => ({ id: f.id, name: f.name })) : []);

  // The opponents: the couch's teams first, then by when they next meet (else last met).
  const opps = useMemo(() => {
    const m = new Map<string, { id: string; short: string; abbreviation: string | null; color: string | null; n: number; left: number; next: string }>();
    for (const g of games) {
      if (!g.opponent || g.calledOff) continue;
      const o = m.get(g.opponent.id) ?? { id: g.opponent.id, short: g.opponent.short, abbreviation: g.opponent.abbreviation, color: g.opponent.color, n: 0, left: 0, next: "~" };
      o.n++;
      if (!begun(g, now)) {
        o.left++;
        if (g.at && g.at < o.next) o.next = g.at;
      }
      m.set(g.opponent.id, o);
    }
    return [...m.values()].sort((a, b) => +fansOf.has(b.id) - +fansOf.has(a.id) || a.next.localeCompare(b.next) || a.short.localeCompare(b.short));
  }, [games, now, fansOf]);
  const couchOpps = opps.filter((o) => fansOf.has(o.id)).slice(0, RIVALS);
  const chips = allOpps ? opps : couchOpps.length ? couchOpps : opps.slice(0, RIVALS);
  const chosen = against ? opps.find((o) => o.id === against) ?? null : null;

  const shownGames = against ? games.filter((g) => g.opponent?.id === against) : games;
  const at = (it: Item) => (it.kind === "game" ? (it.g.at ?? "~") : `${it.from}T12:00:00Z`);
  const items: Item[] = [...shownGames.map((g): Item => ({ kind: "game", g })), ...(against ? [] : byes.map((b): Item => ({ kind: "bye", ...b })))].sort((a, b) => at(a).localeCompare(at(b)));
  const monthOf = (it: Item) => (it.kind === "game" ? (it.g.at ? eastMonth(it.g.at) : "~") : it.from.slice(0, 7));
  const months = new Map<string, Item[]>();
  for (const it of items) months.set(monthOf(it), [...(months.get(monthOf(it)) ?? []), it]);
  const focus = focusMonth(games, now) ?? [...months.keys()][0] ?? "";
  const keys = [...months.keys()];
  const before = against ? [] : keys.filter((k) => k < focus);
  const after = against ? keys : keys.filter((k) => k >= focus);
  const series = useMemo(() => seriesPlaces(games), [games]);
  const runs = useMemo(() => (daily ? runsOf(games) : []), [daily, games]);
  const runAt = new Map<string, Run>(runs.map((r) => [r.games[0], r]));
  const earlierCount = before.reduce((n, k) => n + months.get(k)!.filter((x) => x.kind === "game").length, 0);
  const span = before.length ? `${SHORT[Number(before[0].slice(5, 7)) - 1]}${before.length > 1 ? `–${SHORT[Number(before.at(-1)!.slice(5, 7)) - 1]}` : ""}` : "";

  const monthBlock = (k: string, foldable: boolean) => {
    const rows = months.get(k)!;
    const n = rows.filter((x) => x.kind === "game").length;
    const open = !foldable || openMonths.has(k);
    return (
      <div key={k} data-sched-month={k}>
        {foldable ? (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpenMonths((o) => new Set(o.has(k) ? [...o].filter((x) => x !== k) : [...o, k]))}
            className="nd-press flex min-h-[52px] w-full items-center gap-3 border-b border-border text-left"
          >
            <span className="type-caption flex-1 text-[15px] tracking-[0.04em]">
              {monthName(k)} <span className="font-normal text-muted-foreground">· {n}</span>
            </span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
        ) : (
          <h3 className="type-caption mb-1 mt-5 flex items-baseline justify-between text-[14px] tracking-[0.05em] text-muted-foreground">
            {k === "~" ? "To be set" : monthName(k)}
            <span className="font-sans text-[12px] font-semibold normal-case tracking-normal">{n} {n === 1 ? "game" : "games"}</span>
          </h3>
        )}
        {open &&
          rows.map((it) =>
            it.kind === "bye" ? (
              <div key={`bye-${it.label}`} data-sched-bye className="flex h-11 items-center gap-3 border-b border-border">
                <span className="w-14 flex-none text-[12px] font-semibold text-muted-foreground">{it.label}</span>
                <span className="text-[14px] text-muted-foreground">Bye</span>
              </div>
            ) : (
              <div key={it.g.id}>
                {runAt.get(it.g.id) && !against && <RunLine run={runAt.get(it.g.id)!} now={now} games={games} canStart={canStart} onStart={(ids) => onStart({ kind: "games", games: ids })} />}
                <SchedRow
                  g={it.g}
                  league={league}
                  next={it.g.id === props.nextId}
                  place={against ? null : (series.get(it.g.id) ?? null)}
                  told={props.told}
                  recorded={props.recorded.has(it.g.id)}
                  rivals={rivalsOf(it.g)}
                  played={playedBy.has(it.g.id)}
                  due={dueOf(it.g.id)}
                  talk={talk[it.g.id] ?? 0}
                  onOpen={() => onGame(it.g)}
                />
              </div>
            ),
          )}
      </div>
    );
  };

  return (
    <section data-team-schedule>
      <SportsLabel
        aside={
          daily ? (
            <span role="group" aria-label="Schedule view" className="flex h-9 overflow-hidden rounded-[4px] outline-1 -outline-offset-1 outline-edge">
              {(["list", "month"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  data-sched-view={v}
                  onClick={() => setView(v)}
                  className={`nd-press px-3.5 text-[13px] font-semibold ${view === v ? "bg-secondary text-foreground shadow-[inset_0_0_0_1px_var(--foreground)]" : "text-muted-foreground"}`}
                >
                  {v === "list" ? "List" : "Month"}
                </button>
              ))}
            </span>
          ) : null
        }
      >
        Schedule
      </SportsLabel>
      {/* Against: the old rival chips, now a filter of this list (the spec: a filter isn't a start). */}
      {opps.length > 1 && (
        <div data-against className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Chip on={!against} onClick={() => onAgainst(null)} data="all">
            All games
          </Chip>
          {chips.map((o) => (
            <Chip key={o.id} on={against === o.id} onClick={() => onAgainst(against === o.id ? null : o.id)} data={o.id}>
              <TeamMark abbr={o.abbreviation ?? o.short.slice(0, 3)} color={o.color} size="xs" team={teamKeyOf(league, o.id)} />
              {o.short}
              {fansOf.get(o.id)?.[0] && <span className="font-normal text-muted-foreground">· {fansOf.get(o.id)![0].name}</span>}
            </Chip>
          ))}
          {opps.length > chips.length && (
            <Chip on={false} onClick={() => setAllOpps(true)} data="more">
              All opponents · {opps.length}
            </Chip>
          )}
        </div>
      )}
      {chosen && canStart && chosen.left > 0 && (
        <div className="mt-2">
          <OpenRow data="scope-rival" title={`Every ${chosen.short} game`} line={`${chosen.left} left · ${chosen.short} and ${s.team.short} players`} onClick={() => onStart({ kind: "meetings", against: chosen.id })} />
        </div>
      )}
      {view === "month" && daily ? (
        <MonthView games={shownGames} league={league} focus={focus} now={now} told={props.told} recorded={props.recorded} onGame={onGame} />
      ) : (
        <>
          {before.length > 0 && (
            <>
              <button type="button" data-sched-earlier aria-expanded={earlier} onClick={() => setEarlier(!earlier)} className="nd-press mt-2 flex min-h-[52px] w-full items-center gap-3 border-b border-border text-left">
                <span className="flex-1 text-[15px] font-semibold">
                  Earlier <span className="font-normal text-muted-foreground">· {span} · {earlierCount} {earlierCount === 1 ? "game" : "games"}</span>
                </span>
                <ChevronDown className={`size-4 text-muted-foreground transition-transform ${earlier ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {earlier && before.map((k) => monthBlock(k, false))}
            </>
          )}
          {after.map((k, i) => monthBlock(k, daily && !against && i >= 2 && months.get(k)!.length > 0))}
          {!items.length && against && <p className="mt-3 text-[14px] text-muted-foreground">No games against them this season.</p>}
        </>
      )}
    </section>
  );
}

function Chip({ on, onClick, data, children }: { on: boolean; onClick: () => void; data: string; children: ReactNode }) {
  return (
    // A 36 px chip in a 44 px target.
    <button type="button" aria-pressed={on} data-against-chip={data} onClick={onClick} className="nd-press flex h-11 flex-none items-center focus-visible:outline-none [&:focus-visible>span]:shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--foreground)]">
      <span className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-[4px] px-3 text-[14px] font-semibold ${on ? "bg-foreground text-background" : "outline-1 -outline-offset-1 outline-edge"}`}>{children}</span>
    </button>
  );
}

/** A homestand's or road trip's line, inside its month: what it is, and Start a game on it while any of it is to come. */
function RunLine({ run, now, games, canStart, onStart }: { run: Run; now: number; games: Game[]; canStart: boolean; onStart: (ids: string[]) => void }) {
  const left = run.games.filter((id) => {
    const g = games.find((x) => x.id === id);
    return g && !begun(g, now);
  });
  const Icon = run.home ? House : Plane;
  return (
    <div data-sched-run={run.home ? "home" : "away"} className="mt-2 flex min-h-10 items-center gap-2 text-[13px] font-semibold text-muted-foreground">
      <Icon className="size-[15px] flex-none" aria-hidden />
      <span className="min-w-0 flex-1 py-1 leading-snug">
        {run.home ? "Homestand" : "Road trip"} · {run.games.length} games · {shortDate(run.from)}–{eastMonth(run.from) === eastMonth(run.to) ? Number(eastDay(run.to).slice(8, 10)) : shortDate(run.to)}
      </span>
      {canStart && left.length >= 2 && (
        <button type="button" data-run-start onClick={() => onStart(left.slice(0, 30))} className="nd-press flex h-10 flex-none items-center gap-0.5 font-semibold text-foreground">
          Start a game on it
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </button>
      )}
    </div>
  );
}

/** A schedule row: the scorebug's one-side form (the date, the opponent, the bug's status column), the next game's on a raised panel. */
function SchedRow({
  g,
  league,
  next,
  place,
  told,
  recorded,
  rivals,
  played,
  due,
  talk,
  onOpen,
}: {
  g: Game;
  league: string;
  next: boolean;
  place: { i: number; n: number } | null;
  told: boolean;
  recorded: boolean;
  rivals: { id: string; name: string }[];
  played: boolean;
  due: boolean;
  talk: number;
  onOpen: () => void;
}) {
  const sc = useGameScore(asRow(g));
  const live = g.state === "in" && !g.calledOff;
  // Shown when the game may be told: its own Show, or, once it's over, the season's (a game on now keeps its own ask, as the bug
  // above it does; never a game being watched as if live).
  const open = !recorded && (sc.open || (told && !live));
  const status = g.calledOff ? (
    <span className="text-[13px] font-semibold text-muted-foreground">Postponed</span>
  ) : !sc.started ? (
    <span className="type-num text-[14px] font-bold">{g.at ? timeOf(g.at) : "TBD"}</span>
  ) : !open ? (
    <span className="text-[13px] font-semibold text-muted-foreground">{live ? "Started" : "Played"}</span>
  ) : live ? (
    <>
      <span className="flex items-center gap-1 text-[12px] font-extrabold text-live">
        <i aria-hidden className="size-1.5 rounded-full bg-live" />
        Live
      </span>
      {g.score && <span className="type-num text-[15px] font-bold">{g.score[0]}–{g.score[1]}</span>}
    </>
  ) : (
    <>
      <span className={`text-[13px] font-extrabold ${g.result === "W" ? "text-(--nd-good)" : "text-muted-foreground"}`}>{g.result ?? "Final"}</span>
      {g.score && <span className="type-num text-[15px] font-bold">{g.score[0]}–{g.score[1]}</span>}
    </>
  );
  const later = place && place.i > 1;
  // The line under the opponent: the couch member whose team it is (a face and the name: many have no photo, so the name carries
  // it; the user, 2026-11-22), then ESPN's note or the series's place.
  const rivalWords = rivals.length === 1 ? `${rivals[0].name}'s team` : rivals.length === 2 ? `${rivals[0].name} and ${rivals[1].name}'s team` : rivals.length ? `${rivals[0].name} and ${rivals.length - 1} others' team` : null;
  const extra = [later ? null : rivalWords, g.note ?? (place && place.i === 1 ? `Game 1 of ${place.n}` : null)].filter(Boolean).join(" · ");
  return (
    <div data-sched-item={g.id} className={next ? "" : "border-b border-border"}>
      <button
        type="button"
        data-sched-row={g.id}
        data-next={next || undefined}
        data-rival={rivals.length ? rivals.map((r) => r.id).join(",") : undefined}
        onClick={onOpen}
        className={`nd-press relative flex min-h-[60px] items-stretch gap-2.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground ${next ? "-mx-2 w-[calc(100%+16px)] rounded-[4px] bg-secondary px-2" : "w-full"}`}
      >
        <span className="flex w-[50px] flex-none flex-col justify-center gap-0.5">
          <span className={`text-[13px] font-bold ${g.at && dayOf(g.at) === "Today" ? "text-foreground" : ""}`}>{g.at ? (dayOf(g.at) === "Today" ? "Today" : weekday(g.at)) : "TBD"}</span>
          <span className="text-[12px] text-muted-foreground">{g.at ? shortDate(g.at) : ""}</span>
        </span>
        <span className="relative flex w-[30px] flex-none items-center">
          {later ? <i aria-hidden className="absolute -top-px bottom-1/2 left-[14px] w-px bg-muted-foreground/50" /> : <TeamMark abbr={g.opponent?.abbreviation ?? g.opponent?.short.slice(0, 3)} color={g.opponent?.color} size="sm" team={g.opponent && teamKeyOf(league, g.opponent.id)} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center py-1.5">
          <span className={`truncate text-[16px] font-semibold ${later ? "text-muted-foreground" : ""}`}>{later ? `Game ${place.i} of ${place.n}` : versus(g)}</span>
          {extra && (
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
              {!later && rivals.length > 0 && (
                <span className="flex flex-none -space-x-1">
                  {rivals.slice(0, 2).map((r) => (
                    <Avatar key={r.id} id={r.id} name={r.name} size={18} />
                  ))}
                </span>
              )}
              <span className="truncate">{extra}</span>
            </span>
          )}
        </span>
        {/* The bug's status column, and its controller mark on a game you play (the chyron dot while a pick is due). */}
        <span className={`flex w-[78px] flex-none flex-col items-end justify-center gap-0.5 border-l border-border pl-2 ${played ? "pt-3" : ""}`}>{status}</span>
        {played && (
          <span data-row-game={due ? "due" : "on"} aria-label={due ? "You play this game: a pick is due" : "You play this game"} className={`absolute top-[5px] text-muted-foreground ${next ? "right-[10px]" : "right-[2px]"}`}>
            <Gamepad2 className="size-[13px]" strokeWidth={2.4} aria-hidden />
            {due && <i aria-hidden className="absolute -right-[3px] -top-[3px] size-[7px] rounded-full bg-chyron-line shadow-[0_0_0_1.5px_var(--background)]" />}
          </span>
        )}
      </button>
      {/* The couch's talk about it, into its thread in the league's room (Scores' link: a count, never a word). */}
      {talk > 0 && (
        <NavLink
          href={`${paths.league(league, "chat")}?thread=${encodeURIComponent(g.id)}`}
          data-row-thread={g.id}
          className="nd-press -mt-2 ml-[60px] inline-flex h-11 items-center gap-1.5 px-1 text-[13px] font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-foreground"
        >
          <MessageCircle className="size-4" aria-hidden />
          {talk} {talk === 1 ? "message" : "messages"}
          <ChevronRight className="size-3.5" aria-hidden />
        </NavLink>
      )}
    </div>
  );
}

/** Month view (a daily sport): the month's calendar, a game day a cell with the opponent's mark, home filled, away outlined. */
function MonthView({ games, league, focus, now, told, recorded, onGame }: { games: Game[]; league: string; focus: string; now: number; told: boolean; recorded: Set<string>; onGame: (g: Game) => void }) {
  const months = [...new Set(games.filter((g) => g.at).map((g) => eastMonth(g.at!)))].sort();
  const [m, setM] = useState(months.includes(focus) ? focus : (months[0] ?? focus));
  const i = months.indexOf(m);
  const [y, mo] = [Number(m.slice(0, 4)), Number(m.slice(5, 7))];
  const first = new Date(Date.UTC(y, mo - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const byDay = new Map<number, Game>();
  for (const g of games) if (g.at && eastMonth(g.at) === m) byDay.set(Number(eastDay(g.at).slice(8, 10)), g);
  const today = eastDay(new Date(now).toISOString());
  // From the week of the month's first game (a season's first month opened on three empty weeks: the critique).
  const firstDay = Math.min(...[...byDay.keys(), days]);
  const skip = Math.floor((lead + firstDay - 1) / 7) * 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, k) => k + 1)].slice(skip);
  return (
    <div data-sched-monthview className="mt-2">
      <div className="flex items-center justify-between" data-month-head>
        <button type="button" aria-label="The month before" disabled={i <= 0} onClick={() => setM(months[i - 1])} className="nd-press grid size-11 place-items-center rounded-[3px] disabled:opacity-30">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <span className="text-center">
          <span className="type-caption block text-[16px] tracking-[0.04em]">
            {monthName(m)} {y}
          </span>
          <span className="block text-[12px] text-muted-foreground">Filled: home · Outlined: away</span>
        </span>
        <button type="button" aria-label="The month after" disabled={i >= months.length - 1} onClick={() => setM(months[i + 1])} className="nd-press grid size-11 place-items-center rounded-[3px] disabled:opacity-30">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, k) => (
          <span key={k}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, k) => {
          if (d == null) return <span key={`e${k}`} />;
          const g = byDay.get(d);
          const iso = `${m}-${String(d).padStart(2, "0")}`;
          const isToday = iso === today;
          if (!g)
            return (
              <span key={d} className={`relative aspect-[4/5] rounded-[4px] ${isToday ? "shadow-[inset_0_0_0_2px_var(--foreground)]" : ""}`}>
                <span className="absolute left-1.5 top-0.5 text-[11px] leading-3 text-muted-foreground/70">{d}</span>
              </span>
            );
          return <MonthCell key={d} g={g} d={d} league={league} today={isToday} told={told} recorded={recorded.has(g.id)} onOpen={() => onGame(g)} />;
        })}
      </div>
    </div>
  );
}

function MonthCell({ g, d, league, today, told, recorded, onOpen }: { g: Game; d: number; league: string; today: boolean; told: boolean; recorded: boolean; onOpen: () => void }) {
  const sc = useGameScore(asRow(g));
  const open = !recorded && (sc.open || told) && g.final && !!g.result;
  const away = g.home === false;
  return (
    <button
      type="button"
      data-month-cell={g.id}
      aria-label={`${weekday(g.at!)} ${shortDate(g.at!)}, ${versus(g)}${open ? `, ${g.result === "W" ? "won" : g.result === "L" ? "lost" : "tied"} ${g.score?.join("–")}` : ""}${g.calledOff ? ", postponed" : ""}`}
      onClick={onOpen}
      className={`nd-press relative flex aspect-[4/5] flex-col items-center justify-end gap-0.5 rounded-[4px] pb-1 ${away ? "outline-1 -outline-offset-1 outline-edge" : "bg-secondary"} ${today ? "shadow-[inset_0_0_0_2px_var(--foreground)]" : ""} ${g.calledOff ? "opacity-50" : ""}`}
    >
      <span className="absolute left-1.5 top-0.5 text-[11px] leading-3 text-muted-foreground">{d}</span>
      <TeamMark abbr={g.opponent?.abbreviation ?? g.opponent?.short.slice(0, 3)} color={g.opponent?.color} size="xs" team={g.opponent && teamKeyOf(league, g.opponent.id)} />
      <span className={`h-3 text-[11px] font-extrabold leading-3 ${g.result === "W" ? "text-(--nd-good)" : "text-muted-foreground"}`}>{open ? g.result : ""}</span>
    </button>
  );
}

/** C4: the solo draft (the gallery's draft on a team's season) and its computer players. */
const SOLO_DRAFT = "sp-game-draft";
const SOLO_BOTS = 3;

/** C4: a solo fan's way to friends, last and quiet (the solo play is the page, not a consolation). */
export function CouchLine() {
  return (
    <p data-couch-line className="mt-3 text-[13px] leading-snug text-muted-foreground">
      Play with friends:{" "}
      <button type="button" onClick={() => openCouchSheet({ kind: "new" })} className="nd-press inline-flex h-11 items-center font-semibold text-foreground underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
        Start a couch
      </button>{" "}
      ·{" "}
      <button type="button" onClick={() => openCouchSheet({ kind: "join" })} className="nd-press inline-flex h-11 items-center font-semibold text-foreground underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
        Join one
      </button>
    </p>
  );
}
