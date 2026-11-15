import StateLogic from "./state-logic.js";
import type { LeagueState } from "./types";
import { predictionKind } from "./game-view";

// What a game's own page reads about this week beyond the game's table (the design round's step 2, docs/design-round/
// step2-game-page-spec.md): the side bets (posting, calling, settling) and, once an episode's lineups have locked, both sides of
// your matchup. Read from the viewer's own copy (GhostLogic.viewFor), so nothing past their mark is in it. Pure, for the tests.

/** Someone's call on a side bet, shown once its episode has started (a call is secret until then, as a lineup is). */
export interface SideBetCall {
  predId: string;
  playerId: string;
  name: string;
  you: boolean;
  guess: string;
  correct: boolean | null;
}

export interface SideBet {
  epId: string;
  episode: number;
  betId: string;
  label: string;
  points: number;
  /** Who posted it (null: nobody recorded, an older bet); `byYou` when it was you. */
  by: string | null;
  byYou: boolean;
  /** Whoever posted it may take it down while fewer than two have called it (the route's rule). */
  removable: boolean;
  mine: { id: string; text: string; correct: boolean | null } | null;
  /** How many have called it (it pays once two have). */
  calls: number;
  /** Still open for calls: its episode hasn't started. */
  open: boolean;
  /** Everyone's calls once its episode has started; null before. */
  everyone: SideBetCall[] | null;
  /** Its episode is one you've seen with results, so its calls can be marked (and their marks shown). */
  played: boolean;
  /** Every call marked right or wrong. */
  settled: boolean;
  /** The answers as chips (who for "Who ...?", yes and no for "Will ...?"); null: answered in words. */
  options: string[] | null;
}

export interface SideBets {
  /** The episode a new bet goes on, while it's open for them; null when none can be posted (it's started, or the game's over). */
  postTo: number | null;
  /** The bets worth showing now: the episode a new bet goes on, and the latest you've seen with bets on it, newest first. */
  bets: SideBet[];
  /** Calls on episodes you've seen still waiting to be marked (whoever runs the game settles them). */
  unsettled: number;
}

/**
 * The side bets the page shows. `names`: each seat's name; `through`: the latest episode with results in this copy (the viewer's
 * mark); `now` for the lock (tests).
 */
export function sideBetsOf(view: LeagueState, me: string, names: Map<string, string>, through: number, now?: number): SideBets | null {
  if (!StateLogic.betsOn(view)) return null;
  const at = now ?? Date.now();
  const target = StateLogic.betTarget(view);
  const targetEp = target === null ? null : view.episodes.find((e) => e.number === target) ?? null;
  // A bet goes on the episode about to be played until it starts (BetLogic.add), even before that episode exists in the state.
  const postTo = target === null ? null : targetEp && closed(targetEp, at) ? null : target;
  const stillIn = view.castaways.filter((c) => c.status !== "eliminated").map((c) => c.name);
  const optionsFor = (label: string) => {
    const kind = predictionKind(label);
    return kind === "cast" ? (stillIn.length ? stillIn : null) : kind === "yesno" ? ["Yes", "No"] : null;
  };
  const withBets = view.episodes.filter((ep) => (ep.bets || []).length && !ep.resultsHidden && StateLogic.inPlay(view, ep.number));
  const latestSeen = withBets.filter((ep) => ep.number <= through).sort((a, b) => b.number - a.number)[0] ?? null;
  const shown = withBets.filter((ep) => ep === latestSeen || ep.number > through).sort((a, b) => b.number - a.number);
  const bets: SideBet[] = shown.flatMap((ep) => {
    const locked = closed(ep, at);
    const played = ep.number <= through && StateLogic.episodeHasResults(ep);
    return (ep.bets || []).map((bet) => {
      const preds = bet.predictions || [];
      const mine = preds.find((p) => p.playerId === me);
      return {
        epId: ep.id,
        episode: ep.number,
        betId: bet.id,
        label: bet.label,
        points: bet.points || 0,
        by: bet.createdByPlayerId ? (names.get(bet.createdByPlayerId) ?? null) : null,
        byYou: !!bet.createdByPlayerId && bet.createdByPlayerId === me,
        removable: !locked && preds.length < 2,
        mine: mine ? { id: mine.id, text: mine.guess, correct: played ? mine.correct : null } : null,
        calls: preds.length,
        open: !locked,
        everyone: locked
          ? preds.map((p) => ({ predId: p.id, playerId: p.playerId, name: names.get(p.playerId) ?? "Someone", you: p.playerId === me, guess: p.guess, correct: played ? p.correct : null }))
          : null,
        played,
        settled: played && preds.length > 0 && preds.every((p) => p.correct !== null),
        options: optionsFor(bet.label),
      };
    });
  });
  const unsettled = bets.filter((b) => b.played).reduce((n, b) => n + (b.everyone ?? []).filter((c) => c.correct === null).length, 0);
  return { postTo, bets, unsettled };
}

/** A bet's lock (BetLogic.closed): its episode's start, unless whoever runs the game kept it open or locked it early, and for good
 *  once it has results. */
function closed(ep: LeagueState["episodes"][number], now: number): boolean {
  return !!StateLogic.closedForPlay(ep, now) || StateLogic.episodeHasResults(ep);
}

/** Both sides of your matchup once its episode's lineups have locked and before its results: who each of you started. Null
 *  otherwise (before the lock the other side is secret; after results the week's own lines say it). */
export function lockedMatchup(view: LeagueState, me: string, next: { episode: number; opponent: string | null } | null | undefined, now?: number): { episode: number; mine: string[]; theirs: string[] | null } | null {
  if (!next) return null;
  const ep = view.episodes.find((e) => e.number === next.episode);
  if (!ep || StateLogic.episodeHasResults(ep)) return null;
  if (!StateLogic.ActiveRosterLogic.isLineupLocked(view, ep.id, now)) return null;
  return {
    episode: ep.number,
    mine: StateLogic.activeRosterLineupFor(view, ep.id, me),
    theirs: next.opponent ? StateLogic.activeRosterLineupFor(view, ep.id, next.opponent) : null,
  };
}

/** One game of a head-to-head week: its two seats (b null: the odd one out plays the median, or has a bye), whether each has a
 *  lineup in, and once the week's lineups have locked, who each started. */
export interface WeekGame {
  a: string;
  b: string | null;
  stand: "median" | "bye" | null;
  set: { a: boolean; b: boolean | null };
  locked: { a: string[]; b: string[] | null } | null;
}

/**
 * The league's games for the week about to be played (the design round's step 2b: "This week's games"), every seat's pairing as
 * the schedule sets it (MatchupLogic.view per seat: the same round robin the engine plays, nothing re-derived). Who's set comes
 * from `set` (the table's next-week marks); lineups only once the week has locked. Null outside head to head or between weeks.
 */
export function leagueWeek(view: LeagueState, seats: string[], set: Record<string, boolean | null> | null, now?: number): { episode: number; games: WeekGame[] } | null {
  const ML = StateLogic.MatchupLogic;
  const nexts = seats.map((id) => ({ id, next: ML.view(view, id)?.next ?? null })).filter((x) => x.next);
  if (!nexts.length) return null;
  const episode = Math.min(...nexts.map((x) => x.next!.episode));
  const ep = view.episodes.find((e) => e.number === episode);
  const locked = !!ep && !StateLogic.episodeHasResults(ep) && StateLogic.ActiveRosterLogic.isLineupLocked(view, ep.id, now);
  const lineupOf = (id: string) => (ep ? StateLogic.activeRosterLineupFor(view, ep.id, id) : []);
  const seen = new Set<string>();
  const games: WeekGame[] = [];
  for (const { id, next } of nexts) {
    if (next!.episode !== episode || seen.has(id)) continue;
    const b = next!.opponent && next!.opponent !== id ? next!.opponent : null;
    seen.add(id);
    if (b) seen.add(b);
    games.push({
      a: id,
      b,
      stand: next!.stand,
      set: { a: !!set?.[id], b: b ? !!set?.[b] : null },
      locked: locked ? { a: lineupOf(id), b: b ? lineupOf(b) : null } : null,
    });
  }
  return { episode, games };
}
