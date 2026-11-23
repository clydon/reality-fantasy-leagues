"use client";

// A league's Games (docs/PLAN-sports-couch.md B1, session 3; the design: docs/design-round/league-games-spec.md, -first-view.md,
// -shape.md): the way into games in this league, in round 2's groups. Your games here (the show launcher's rows, due first), then
// with the couch (its games here to join, Play this week's games, Play the season), then rivals (the couch's rivalry games still to
// come, each a Start, a pair's every meeting a quiet line), then your team (its season). No results anywhere: This week holds the
// couch's week, Scores the league's, each game's page its season. Nothing is offered that can't be done: a sports start needs a
// couch today, so a solo player sees his games and says so once (the spec's flaw, raised for the user).

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useCouchGames, useCurrentCouch, useHome, useLeagueTeams, useMySportsGames, type JoinGame } from "../data";
import { joinable, JoinButton, JoinGameSheet } from "../couch/join-game";
import { LaunchRow, People } from "../show/whats-on";
import { paths } from "../routes";
import { CouchLine } from "./team-page";
import { SportsLabel, TeamMark } from "../sports/parts";
import { clockOf, dayOf, useNow } from "../sports/scores";
import { LeagueStart, openSports, startOn, useLeagueGames } from "../sports/sheets";
import { useTableTeams, type Team } from "./league-page";
import { rivalriesOf, type Fan, type Rivalry } from "@/lib/sports/couch-table";
import type { LeagueNow } from "@/lib/sports/league-now";
import { teamKeyOf } from "@/lib/sports/team-badge";

const RIVALS_SHOWN = 3;
const JOIN_SHOWN = 4;

export function LeagueGames({ league, name, lnow }: { league: string; name: string; lnow: LeagueNow | null }) {
  const home = useHome().data;
  const couch = useCurrentCouch(home);
  const { yours, moveOf } = useLeagueGames(league);
  const { teams, meId } = useTableTeams(league);
  const couchGames = useCouchGames(couch?.id ?? null, !!couch).data?.games;
  const [joining, setJoining] = useState<JoinGame | null>(null);
  const off = !!lnow && !lnow.on;

  // The couch's games, by id: their faces for your rows, and the ones here you could join.
  const seasons = new Set(yours.map((y) => y.seasonId));
  const theirs = useMemo(() => new Map((couchGames ?? []).map((g) => [g.leagueId, g])), [couchGames]);
  const mySeasons = useLeagueSeasons(league);
  const toJoin = (couchGames ?? []).filter((g) => g.seasonId && (mySeasons.has(g.seasonId) || seasons.has(g.seasonId)) && joinable(g) && !g.you?.playing);
  // Due first, as the show's launcher orders them.
  const rows = [...yours].sort((a, b) => +!!moveOf(b.g.leagueId) - +!!moveOf(a.g.leagueId));

  return (
    <div data-league-games-tab className="pb-2">
      {rows.length > 0 && (
        <section data-games-yours={rows.length}>
          <SportsLabel>Your games here</SportsLabel>
          <div className="flex flex-col">
            {rows.map(({ g, seasonId }) => {
              const m = moveOf(g.leagueId);
              const faces = theirs.get(g.leagueId)?.faces ?? [];
              return (
                <LaunchRow
                  key={g.leagueId}
                  data={{ "data-games-yours-row": g.leagueId, "data-due": m ? "yes" : undefined }}
                  name={g.name}
                  href={m?.href ?? paths.show(seasonId)}
                  whole
                  second={
                    <>
                      <People faces={faces.map((f) => ({ id: f.userId, name: f.name }))} you={{ id: meId, in: true }} />
                      <small className={`min-w-0 truncate text-[13px] ${m ? "font-semibold text-chyron-line" : "text-muted-foreground"}`}>{m ? m.text.replace(/ \(([^)]+)\)$/, " · $1") : "All set"}</small>
                    </>
                  }
                />
              );
            })}
          </div>
        </section>
      )}
      {!couch ? (
        // Solo (C4): your own games are above; Your team starts one on no couch (computer players are offered there); the couch line
        // last and quiet.
        <>
          {off ? (
            <p data-games-off className="mt-6 text-[14px] text-muted-foreground">
              Nothing to start until the season does.
            </p>
          ) : (
            <YourTeam league={league} teams={teams.filter((t) => t.followers.some((f) => f.id === meId))} meId={meId} />
          )}
          <div data-games-solo className="mt-4">
            {!rows.length && <p className="text-[14px] leading-snug text-muted-foreground">You don’t play a game in {name} yet.</p>}
            <CouchLine />
          </div>
        </>
      ) : off ? (
        <p data-games-off className="mt-6 text-[14px] text-muted-foreground">
          Nothing to start until the season does.
        </p>
      ) : (
        <>
          <WithTheCouch league={league} name={name} lnow={lnow} toJoin={toJoin} couchId={couch.id} onJoin={setJoining} />
          <Rivals league={league} teams={teams} meId={meId} />
          <YourTeam league={league} teams={teams.filter((t) => t.followers.some((f) => f.id === meId))} meId={meId} />
          <JoinGameSheet couchId={couch.id} game={joining} onOpenChange={(o) => !o && setJoining(null)} />
        </>
      )}
    </div>
  );
}

/** The sports seasons in this league that you or your couches play on (/api/sports/mine's seasons, A2), for its games to join. */
function useLeagueSeasons(league: string): Set<string> {
  const seasons = useMySportsGames(true).data?.seasons;
  return useMemo(() => new Set((seasons ?? []).filter((s) => s.league === league).map((s) => s.seasonId)), [seasons, league]);
}

/** The couch's games here to join, then starting one for the couch. */
function WithTheCouch({ league, name, lnow, toJoin, couchId, onJoin }: { league: string; name: string; lnow: LeagueNow | null; toJoin: JoinGame[]; couchId: string; onJoin: (g: JoinGame) => void }) {
  const [all, setAll] = useState(false);
  const shown = all || toJoin.length <= JOIN_SHOWN + 1 ? toJoin : toJoin.slice(0, JOIN_SHOWN);
  return (
    <section data-games-couch>
      <SportsLabel aside={toJoin.length > 0 ? <span className="text-[13px] text-muted-foreground">{`${toJoin.length} to join`}</span> : null}>With the couch</SportsLabel>
      {shown.length > 0 && (
        <div data-games-join className="flex flex-col">
          {shown.map((g) => (
            <LaunchRow
              key={g.leagueId}
              data={{ "data-join-row": g.leagueId }}
              name={g.name}
              second={
                <>
                  <People faces={g.faces.map((f) => ({ id: f.userId, name: f.name }))} />
                  <small className="min-w-0 truncate text-[13px] text-muted-foreground">{`${g.faces.length} playing${g.underway ? " · under way" : ""}`}</small>
                </>
              }
              right={<JoinButton couchId={couchId} g={g} onJoin={onJoin} />}
            />
          ))}
          {shown.length < toJoin.length && (
            <button type="button" data-games-join-fold onClick={() => setAll(true)} className="nd-press flex min-h-12 items-center gap-1.5 border-t border-border text-left text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-foreground">
              {`${toJoin.length - shown.length} more to join`} <ChevronDown className="size-4" aria-hidden />
            </button>
          )}
        </div>
      )}
      {/* The old sheet's two starts: this week's games (the plate while nothing of yours is due), the season outlined. */}
      <LeagueStart league={league} leagueName={name} from={lnow?.from} to={lnow?.to} rows />
    </section>
  );
}

/** The couch's rivalry games still to come this season, yours first: each a Start on that one game; a pair that meets again, every
 *  meeting as a quiet line. */
function Rivals({ league, teams, meId }: { league: string; teams: Team[]; meId: string }) {
  const now = useNow();
  const forms = useLeagueTeams(
    league,
    teams.map((t) => t.id),
    teams.length > 1
  ).data?.teams;
  const [all, setAll] = useState(false);
  const formMap = useMemo(() => new Map((forms ?? []).map((f) => [f.id, f])), [forms]);
  const coming = rivalriesOf(teams, formMap, meId)
    .filter((r) => !r.final && (!r.at || Date.parse(r.at) > now))
    .sort((a, b) => +b.fans.some((f) => f.id === meId) - +a.fans.some((f) => f.id === meId) || (a.at ?? "").localeCompare(b.at ?? ""));
  if (!coming.length) return null;
  const shown = all ? coming : coming.slice(0, RIVALS_SHOWN);
  const pair = (r: Rivalry) => [r.away, r.home].sort().join("|");
  const left = (r: Rivalry) => coming.filter((x) => pair(x) === pair(r)).length;
  return (
    <section data-games-rivals={coming.length}>
      <SportsLabel>Rivals</SportsLabel>
      <ul className="flex flex-col">
        {shown.map((r, i) => {
          const lastOfPair = !shown.slice(i + 1).some((x) => pair(x) === pair(r));
          return (
            <li key={r.id}>
              <RivalRow r={r} teams={teams} meId={meId} league={league} />
              {lastOfPair && left(r) > 1 && <EveryMeeting r={r} teams={teams} meId={meId} league={league} left={left(r)} />}
            </li>
          );
        })}
      </ul>
      {shown.length < coming.length && (
        <button type="button" data-games-rivals-all onClick={() => setAll(true)} className="nd-press mt-1 flex h-11 items-center gap-1 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-foreground">
          All {coming.length} <ChevronRight className="size-4" aria-hidden />
        </button>
      )}
    </section>
  );
}

const who = (f: Fan, meId: string) => (f.id === meId ? "you" : f.name);
const cap = (s: string) => (s.startsWith("you") ? `Y${s.slice(1)}` : s);

function RivalRow({ r, teams, meId, league }: { r: Rivalry; teams: Team[]; meId: string; league: string }) {
  const a = teams.find((t) => t.id === r.away);
  const b = teams.find((t) => t.id === r.home);
  // You first, whichever side you're on: a long name never cuts "you" off (the check).
  const mineAt = r.fans[1].id === meId ? 1 : 0;
  const people = cap(`${who(r.fans[mineAt], meId)} vs ${who(r.fans[1 - mineAt], meId)}`);
  const when = r.at ? `${dayOf(r.at)} ${clockOf(r.at)}` : "Time to be set";
  // Start on the game from your side when it's yours, else the home side's (the handoff adds that team's games).
  const side = r.fans[0].id === meId ? a : b;
  return (
    <div data-games-rival={r.id} className="flex min-h-[60px] items-center gap-3 border-b border-border py-1.5">
      <span className="flex flex-none gap-1">
        <TeamMark abbr={a?.abbreviation ?? a?.short.slice(0, 3)} color={a?.color} size="xs" team={a && teamKeyOf(league, a.id)} />
        <TeamMark abbr={b?.abbreviation ?? b?.short.slice(0, 3)} color={b?.color} size="xs" team={b && teamKeyOf(league, b.id)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {a?.short} at {b?.short}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{`${people} · ${when}`}</span>
      </span>
      <button
        type="button"
        data-games-rival-start={r.id}
        aria-label={`Start a game on ${a?.short ?? ""} at ${b?.short ?? ""}`}
        onClick={() => side && openSports(startOn(league, side.id, side.short, { kind: "games", games: [r.id] }))}
        className="nd-press -mr-1 flex h-11 flex-none items-center gap-0.5 rounded-[3px] pl-2 pr-1 text-[14px] font-semibold focus-visible:outline-2 focus-visible:outline-foreground"
      >
        Start
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </button>
    </div>
  );
}

/** A pair's every meeting still to come, as one game: a quiet line under its last row. */
function EveryMeeting({ r, teams, meId, league, left }: { r: Rivalry; teams: Team[]; meId: string; league: string; left: number }) {
  const mine = r.fans[0].id === meId ? r.away : r.fans[1].id === meId ? r.home : r.home;
  const other = mine === r.away ? r.home : r.away;
  const t = teams.find((x) => x.id === mine);
  const o = teams.find((x) => x.id === other);
  return (
    <button
      type="button"
      data-games-meetings={`${mine}-${other}`}
      onClick={() => t && openSports(startOn(league, t.id, t.short, { kind: "meetings", against: other }))}
      className="nd-press flex min-h-11 w-full items-center gap-1 border-b border-border pl-[68px] text-left text-[14px] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
    >
      <span className="min-w-0 truncate">{`Every ${t?.short ?? ""}–${o?.short ?? ""} game · ${left} left`}</span>
      <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
    </button>
  );
}

/** Your teams here, your team first: each one's season, opening Start a game on it. */
function YourTeam({ league, teams, meId }: { league: string; teams: Team[]; meId: string }) {
  if (!teams.length) return null;
  const mine = [...teams].sort((a, b) => +!!b.followers.find((f) => f.id === meId)?.myTeam - +!!a.followers.find((f) => f.id === meId)?.myTeam);
  return (
    <section data-games-team={teams.length}>
      <SportsLabel>{teams.length === 1 ? "Your team" : "Your teams"}</SportsLabel>
      <div className="flex flex-col">
        {mine.map((t) => (
          <button
            key={t.id}
            type="button"
            data-games-team-season={t.id}
            onClick={() => openSports(startOn(league, t.id, t.short, { kind: "season" }))}
            className="nd-press flex min-h-[60px] w-full items-center gap-3 border-b border-border py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
          >
            <TeamMark abbr={t.abbreviation ?? t.short.slice(0, 3)} color={t.color} size="sm" team={teamKeyOf(league, t.id)} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-semibold">{`Every ${t.short} game`}</span>
              <span className="mt-[3px] block truncate text-[13px] text-muted-foreground">The rest of the season · Pick&rsquo;em on its games, or a draft of its players</span>
            </span>
            <ChevronRight className="size-4 flex-none text-muted-foreground" aria-hidden />
          </button>
        ))}
      </div>
    </section>
  );
}
