"use client";

import { useState } from "react";
import { Check, ChevronRight, MessageCircle } from "lucide-react";
import { useCouchGames, useCouchTeams, useGameSeasons, useHome, useRoomCounts, useSportRail, type JoinGame, type TeamSchedule, type WeekGame } from "../data";
import { NavLink, useNav } from "../nav";
import { paths } from "../routes";
import { Avatar } from "../ui/bars";
import { openCouchSheet } from "../couch/couch-sheets";
import { joinable, JoinGameSheet } from "../couch/join-game";
import { GameBug } from "./game-bug";
import { MoreAction, OpenRow, PlayPlate, SportsLabel, type TeamGame } from "./parts";
import { AskSheet } from "./scorebug";
import { clockOf, dayOf, useGameScore, useNow } from "./scores";
import { useStartSport } from "./start";
import { WatchingRow } from "./fan-call";

// A team's games' parts (the team's page, docs/PLAN-sports-couch.md B2, is src/new/screens/team-page.tsx; it replaced the team's
// sheet): what Start a game on is asked for (StartWhen), a schedule game as a game row's moment, "vs Cowboys", and one game's sheet:
// the game, the couch line, the couch's games on it, Play (the one-game types, one decision), Go bigger (B4).

export type StartWhen =
  | { kind: "next" }
  | { kind: "season" }
  | { kind: "games"; games: string[] }
  | { kind: "meetings"; against: string };

export interface TeamRef {
  league: string;
  team: string;
}


type Game = TeamSchedule["games"][number];
export const asRow = (g: Game): TeamGame => ({
  id: g.id,
  at: g.at,
  state: g.state,
  final: g.final,
  called: g.calledOff ? "postponed" : null,
  home: g.home,
  opponent: g.opponent,
  score: g.score,
  result: g.result,
  note: g.note,
});

/** "vs Cowboys", "at Cowboys". */
export const versus = (g: Pick<Game, "home" | "opponent">) => `${g.home === false ? "at" : "vs"} ${g.opponent?.short ?? "To be decided"}`;

/**
 * One game's sheet (docs/PLAN-sports-couch.md B4; the design: docs/design-round/game-sheet-spec.md, -first-view.md, -shape.md): the
 * game as the shared scorebug; the couch line (whose team each side is, in names); the couch's games that already cover it (Join,
 * Open), above Play so nobody starts a second one; Play: the sport's one-game types as tiles, Pick'em chosen, and one decision (Start
 * the chosen type, or Join the couch's game of that kind, PFD's R5), its lock words in full; Go bigger (the series, the team's season,
 * this week's games) and More options (Start a game's screens). Once it's on or over: the score through hiding, your games on it, the
 * couch's talk about it.
 */
export function GameView({ g, s, onStart, onStarted, onSlate }: { g: Game; s: TeamSchedule; onStart: (when: StartWhen) => void; onStarted?: () => void; onSlate?: () => void }) {
  const row = asRow(g);
  const now = useNow();
  const sc = useGameScore(row);
  const { start, busy, couch } = useStartSport();
  const home = useHome().data;
  const meId = home?.user.id ?? "";
  const nav = useNav();
  const [asking, setAsking] = useState<WeekGame | null>(null);
  const [joining, setJoining] = useState<JoinGame | null>(null);
  const [chosen, setChosen] = useState("pickem");
  const couchTeams = useCouchTeams(couch?.id ?? null).data?.teams ?? [];
  const couchGames = useCouchGames(couch?.id ?? null, !!couch).data?.games ?? [];
  const seasons = useGameSeasons(s.league, g.id).data?.seasons ?? [];
  const rail = (useSportRail(s.league, 1).data?.games ?? []).filter((t) => !t.why && t.id !== "bestBall").slice(0, 4);
  const talk = useRoomCounts(s.league, couch?.id ?? null).data?.counts?.[g.id] ?? 0;
  const started = sc.started || g.state !== "pre";
  const called = g.calledOff;

  const away = g.home === false ? s.team : g.opponent;
  const homeSide = g.home === false ? g.opponent : s.team;
  // The couch line: whose team each side is, in names (faces ride on the bug; the name carries it: many have no photo).
  const fansOf = (id: string | undefined) => (id ? (couchTeams.find((t) => t.league === s.league && t.id === id)?.followers ?? []) : []);
  const sideWords = (t: typeof away) => {
    if (!t) return "To be decided";
    const f = fansOf(t.id);
    const you = f.some((x) => x.id === meId);
    const others = f.filter((x) => x.id !== meId).map((x) => x.name);
    const theirs = others.length === 1 ? `${others[0]}'s` : others.length === 2 ? `${others[0]} and ${others[1]}'s` : others.length ? `${others[0]} and ${others.length - 1} others'` : "";
    return you ? (theirs ? `Your and ${theirs} ${t.short}` : `Your ${t.short}`) : theirs ? `${theirs} ${t.short}` : t.short;
  };
  const couchLine = fansOf(away?.id).length || fansOf(homeSide?.id).length ? `${sideWords(away)} at ${sideWords(homeSide)}` : null;

  // The couch's games that cover this game: a season this game is in, inside the game's span, not over.
  const covering = couchGames.filter((c) => {
    if (c.ended || !c.seasonId) return false;
    const at = seasons.find((x) => x.seasonId === c.seasonId);
    if (!at) return false;
    const from = c.span?.from ?? c.start ?? 1;
    const to = c.span?.to ?? Infinity;
    return at.episode >= from && at.episode <= to;
  });
  const oneGame = (c: JoinGame) => !!c.span && c.span.from === c.span.to;
  const chosenType = rail.find((t) => t.id === chosen) ?? rail[0] ?? null;
  const sameKind = (c: JoinGame) => !!chosenType && oneGame(c) && (c.gameName ?? "").toLowerCase().includes(chosenType.name.toLowerCase());
  const yours = covering.filter((c) => c.you?.playing);
  const moveOf = (c: JoinGame) => home?.moves.find((m) => m.leagueId === c.leagueId) ?? null;
  const toJoin = covering.find((c) => sameKind(c) && !c.you?.playing && joinable(c)) ?? null;
  const mineSame = yours.find((c) => sameKind(c)) ?? null;
  const when = g.at ? `${dayOf(g.at)} ${clockOf(g.at)}` : "when its time is set";
  const lockWhen = `${chosenType?.id === "pickem" ? "Picks lock" : `${chosenType?.name ?? "It"} locks`} at kickoff, ${when}`;
  const told = "You have 10 seconds to undo, then the couch is told";
  const lock = `${lockWhen} · ${told}`;
  const rivalry = !!(away && homeSide && fansOf(away.id).length && fansOf(homeSide.id).length);
  // The day only: the bug says the time, the network and the line (said once).
  const sub = !started && !called ? (g.at ? dayOf(g.at) : "Time to be set") : null;

  // Go bigger: the series this game is in (still to finish), the season of the couch's side (else home's), this week's games.
  const series = s.series.find((x) => x.state !== "past" && x.games.length >= 2 && x.games.includes(g.id)) ?? null;
  const left = s.games.filter((x) => !x.calledOff && x.at && Date.parse(x.at) > now).length;

  return (
    <div data-game-sheet={g.id} data-game-view={g.id}>
      {sub && <p className="-mt-1 mb-3 text-[14px] text-muted-foreground" data-game-when>{sub}</p>}
      <GameBug g={g} s={s} now={now} onAsk={setAsking} />
      {couchLine && (
        <p data-couch-line className="mt-2 text-[14px] font-semibold">
          {couchLine}
        </p>
      )}
      {/* C2: I'm watching, from the hour before it starts until it's over (presence, for the couch). */}
      {couch && !called && g.state !== "post" && !g.final && g.at && Date.parse(g.at) - now < 3_600_000 && <WatchingRow league={s.league} game={g.id} couchId={couch.id} meId={meId} />}

      {covering.length > 0 && (
        <section data-on-couch>
          <SportsLabel>On the couch</SportsLabel>
          {covering.slice(0, 2).map((c) => (
            <CouchGameRow
              key={c.leagueId}
              c={c}
              started={started}
              spans={!oneGame(c)}
              move={moveOf(c)?.text ?? null}
              joinBelow={!started && c.leagueId === toJoin?.leagueId}
              onOpen={() => nav.push(paths.gamePage(c.seasonId!, c.leagueId))}
              // A rivalry's or a call's game is joined by picking on This week's card (a side, a back or a fade), not a join sheet.
              onJoin={() => (c.picked ? nav.push(paths.league(s.league)) : setJoining(c))}
            />
          ))}
          {couch && !started && toJoin && !(mineSame && moveOf(mineSame)) && (
            <PlayPlate data="game-join" title={`Join ${couchName(toJoin)}`} line={`${toJoin.players} in · ${lockWhen}`} onClick={() => setJoining(toJoin)} />
          )}
          {covering.length > 2 && <p className="mt-2 text-[13px] text-muted-foreground">+{covering.length - 2} more on the Games tab</p>}
        </section>
      )}

      {called ? (
        <p className="mt-5 text-[14px] text-muted-foreground">Postponed: its makeup is a game of its own.</p>
      ) : !started ? (
        <section data-play-section>
          {couch && <SportsLabel>{toJoin ? "Or start your own" : "Play"}</SportsLabel>}
          {!couch ? null : rail.length === 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((k) => (
                <div key={k} className="h-16 animate-pulse rounded-[4px] bg-card" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Which game">
              {rail.map((t) => (
                <TypeTile key={t.id} id={t.id} title={t.name} line={t.id === "pickem" && rivalry ? "Pick a side" : (TYPE_LINES[t.id] ?? t.sub)} chosen={chosenType?.id === t.id} onPick={() => setChosen(t.id)} />
              ))}
            </div>
          )}
          {!couch ? (
            // Solo: a sports game is played on a couch for now (C4 brings solo play); the one move there is, the yellow.
            <div data-game-solo className="mt-5">
              <PlayPlate data="game-couch" title="Start a couch" line="A sports game is played on a couch for now" onClick={() => openCouchSheet({ kind: "new" })} />
              <button type="button" onClick={() => openCouchSheet({ kind: "join" })} className="nd-press mt-1 inline-flex h-11 items-center text-[14px] font-semibold underline underline-offset-[3px]">
                Join one with a code
              </button>
            </div>
          ) : mineSame && moveOf(mineSame) ? (
            <PlayPlate data="game-move" title="Make your pick" line={`You're in ${couchName(mineSame)} · ${lockWhen}`} onClick={() => nav.push(paths.gamePage(mineSame.seasonId!, mineSame.leagueId))} />
          ) : toJoin ? (
            <MoreAction data="game-start-another" title={`Start another ${chosenType?.name ?? "game"}`} line={told} onClick={() => chosenType && void start({ league: s.league, team: s.team.id, games: [g.id], game: chosenType.id }, onStarted)} />
          ) : (
            chosenType && (
              <PlayPlate
                data="game"
                disabled={busy}
                title={mineSame ? `Start another ${chosenType.name}` : `Start ${chosenType.name}`}
                line={lock}
                onClick={() => void start({ league: s.league, team: s.team.id, games: [g.id], game: chosenType.id }, onStarted)}
              />
            )
          )}
          {couch && (
            <section data-go-bigger>
              <SportsLabel>Go bigger</SportsLabel>
              {series && <OpenRow data="bigger-series" title="Their series" line={`${series.games.length} games${series.from && series.to ? ` · ${seriesDates(series.from, series.to)}` : ""} · both teams' players`} onClick={() => onStart({ kind: "games", games: series.games })} />}
              {left > 1 && <OpenRow data="bigger-season" title={`Every ${s.team.short} game left`} line={`${left} games · ${s.team.short} players only`} onClick={() => onStart({ kind: "season" })} />}
              {onSlate && <OpenRow data="bigger-week" title="All of this week's games" line="Pick'em on this week's games still to come" onClick={onSlate} />}
              <button type="button" data-more-options onClick={() => onStart({ kind: "games", games: [g.id] })} className="nd-press mt-1 inline-flex h-11 items-center text-[13px] font-bold underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-foreground">
                More options for {chosenType?.name ?? "a game"}…
              </button>
            </section>
          )}
        </section>
      ) : (
        <>
          {couch && (
            <NavLink
              href={`${paths.league(s.league, "chat")}?thread=${encodeURIComponent(g.id)}`}
              data-game-thread
              className="nd-press mt-3 inline-flex h-11 items-center gap-1.5 text-[14px] font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-foreground"
            >
              <MessageCircle className="size-4" aria-hidden />
              {talk ? `${talk} ${talk === 1 ? "message" : "messages"} in its thread` : "Talk about it"}
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </NavLink>
          )}
          {g.state === "in" && covering.length > 0 && <p className="mt-2 text-[14px] text-muted-foreground">Picks closed at kickoff.</p>}
        </>
      )}
      <AskSheet g={asking} onClose={() => setAsking(null)} />
      {couch && <JoinGameSheet couchId={couch.id} game={joining} onOpenChange={(o) => !o && setJoining(null)} />}
    </div>
  );
}

/** A game type to choose: a night panel with a hairline; chosen, the white plate with a check (never yellow: the sheet's one yellow is
 *  its decision, PFD's R2). */
function TypeTile({ id, title, line, chosen, onPick }: { id: string; title: string; line: string; chosen: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      data-gallery-option={`type-${id}`}
      data-chosen={chosen ? "" : undefined}
      role="radio"
      aria-checked={chosen}
      onClick={onPick}
      className={`nd-press flex min-h-16 w-full flex-col justify-center rounded-[4px] bg-secondary px-3 py-2.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${chosen ? "outline-2 -outline-offset-2 outline-foreground" : "outline-1 -outline-offset-1 outline-border"}`}
    >
      <span className="flex items-start justify-between gap-2">
        <b className="text-[16px] font-semibold leading-tight">{title}</b>
        {chosen && <Check className="size-5 flex-none" strokeWidth={3} aria-hidden />}
      </span>
      <span className="mt-1 text-[14px] leading-snug text-muted-foreground">{line}</span>
    </button>
  );
}

/** Each type's few words (a fan's, not the engine's). */
const TYPE_LINES: Record<string, string> = { pickem: "Who wins", pickAFew: "Three players", short: "A few players each", squares: "A grid of score digits" };

/** A couch game by its maker ("Riley's Pick'em"), not the engine's name for it ("Pick'em · Game 12"). */
export function couchName(c: JoinGame): string {
  // A rivalry's or a fan's call is named by its people already ("Riley vs Andrew", "Andrew's call").
  if (c.picked) return c.name.replace(/\s*·\s*(Game|Week|Episode)\s*\d+.*$/i, "");
  const kind = (c.gameName || c.name).replace(/\s*·\s*(Game|Week|Episode)\s*\d+.*$/i, "");
  return c.runners[0] ? `${c.runners[0]}'s ${kind}` : kind;
}

/** "Nov 23–24", "Nov 30–Dec 2". */
function seriesDates(from: string, to: string): string {
  const d = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });
  const [a, b] = [d(from), d(to)];
  return a.split(" ")[0] === b.split(" ")[0] ? `${a}–${b.split(" ")[1]}` : `${a}–${b}`;
}

/** A couch game that covers this game: its name, who's in, and its action (Join, Open, or Full). */
export function CouchGameRow({ c, started, spans, move, joinBelow, onOpen, onJoin }: { c: JoinGame; started: boolean; spans: boolean; move: string | null; joinBelow: boolean; onOpen: () => void; onJoin: () => void }) {
  const playing = !!c.you?.playing;
  const names = c.faces.map((f) => f.name);
  const who = names.length ? `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""} · ${c.players} in` : `${c.players} in`;
  // A rivalry's or a call's game is joined by picking on This week's card (C1, C2): its words say what you'd do there.
  const join = c.picked === "call" ? "Back or fade" : c.picked === "rivalry" ? "Pick a side" : "Join";
  const action = playing ? (move ? <span className="font-semibold text-chyron-line">{move}</span> : "Open") : !started && (joinable(c) || !!c.picked) && !joinBelow ? join : null;
  return (
    <button
      type="button"
      data-couch-game={c.leagueId}
      onClick={playing ? onOpen : !started && joinable(c) ? onJoin : onOpen}
      className="nd-press flex min-h-[60px] w-full items-center gap-3 border-b border-border py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground"
    >
      <span className="flex flex-none -space-x-1.5">
        {c.faces.slice(0, 3).map((f) => (
          <Avatar key={f.userId} id={f.userId} name={f.name} size={24} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold">{couchName(c)}</span>
        <span className="mt-[3px] block truncate text-[13px] text-muted-foreground">
          {playing ? "You're in" : who}
          {spans ? " · this game counts in it" : ""}
        </span>
      </span>
      {action && <span className="flex flex-none items-center gap-0.5 text-[14px] font-bold">{action}<ChevronRight className="size-4 text-muted-foreground" aria-hidden /></span>}
    </button>
  );
}
