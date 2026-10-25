import type { Castaway, LeagueState, ScoreRow } from "./types";
import StateLogic from "./state-logic.js";
import { castawayEventStats } from "./active-roster-rows";
import { castawayPoints, teamOrder } from "./classic-view";
import { latestScoredEpisode } from "./episode-team-summary";
import { gameRules } from "./game-rules";
import { lineupStatus } from "./lineup-view";
import { pickWindow } from "./pool-view";
import { isBetSettled, isKnockedOut, publicMediaSrc } from "./selectors";
import { teamEpisodeBreakdown } from "./team-episode-breakdown";

// One of your season games on a show, as the new design's show space reads it (docs/PLAN-new-design.md step 1):
// your moves for the next episode (the lineup, the pick, open predictions), the game's table, its rules, its cast,
// and who's set this week. Built from the viewer's own copy of the league (GhostLogic.viewFor at their mark, which
// the server takes from guard.ts), so nothing past where they are is in it: standings stop at their episode,
// nobody they haven't seen leave is out, and nobody else's pick shows before it's decided. Pure, for the tests.

export interface CastFace {
  id: string;
  name: string;
  photo: string | null;
  /** Their group now, as far as you've seen. */
  tribe: { name: string; colour: string } | null;
  /** Left the game, as far as you've seen (a finalist too: `knocked` says who was knocked out). */
  left: boolean;
  knocked: boolean;
  /** The episode they left in, when known. */
  out: number | null;
  /** Where they finished, once out: the winner 1st. */
  place: number | null;
  /** Their points so far as this game counts them (Outlast: the boot order; Weekly Lineup: what they did). */
  points: number | null;
}

export interface TableRow {
  playerId: string;
  userId: string | null;
  name: string;
  you: boolean;
  /** "1", "T2": ties share a place. */
  rank: string;
  place: number;
  /** Outlast and Weekly Lineup: points. Survival Pool: the best streak, which it ranks by. */
  total: number;
  /** Weekly Lineup: what the latest scored episode earned. Survival Pool: the streak now. */
  week: number | null;
  /** Survival Pool: right picks' points, the tie-break. */
  points: number;
  /** The team (castaway ids), still in first. */
  team: string[];
  /** Weekly Lineup: who started the latest scored episode. */
  last: string[];
  /** Survival Pool: picks oldest first. Only decided ones, except your own. */
  picks: { episode: number; castawayId: string | null; correct: boolean | null }[];
}

export interface LineupMove {
  epId: string;
  episode: number;
  airsAt: string | null;
  locked: boolean;
  /** How many start. */
  slots: number;
  /** How many make it "set": fewer late in a season, once fewer are left than slots. */
  need: number;
  starters: string[];
  /** Your team: still in first, then who's out. */
  roster: string[];
  set: boolean;
  /** Not chosen for this episode: the last lineup you set stands in. */
  carried: boolean;
}

export interface PickMove {
  epId: string;
  episode: number;
  airsAt: string | null;
  open: boolean;
  pick: string | null;
  /** Who you may pick. */
  available: string[];
  /** Still in, but not pickable this time, and why. */
  blocked: { id: string; episode: number; reason: "cycle" | "backToBack" }[];
  streak: number;
}

export interface PredictionMove {
  epId: string;
  episode: number;
  betId: string;
  label: string;
  points: number;
  guess: { id: string; text: string } | null;
  /** How many have answered (it pays once two have). */
  answers: number;
}

export interface WeekProgress {
  label: "lineups set" | "picked";
  episode: number;
  done: number;
  of: number;
  people: { playerId: string; userId: string | null; name: string; done: boolean }[];
}

export interface GameRefIn {
  leagueId: string;
  name: string;
  gameType: string;
  gameName: string;
  yourRole: string | null;
}

export interface GameView extends GameRefIn {
  playerId: string;
  /** Standings are through this episode: they move when you reveal. */
  through: number;
  table: TableRow[];
  you: TableRow | null;
  rules: string[];
  cast: CastFace[];
  lineup: LineupMove | null;
  pick: PickMove | null;
  predictions: PredictionMove[];
  progress: WeekProgress | null;
  /** Results you haven't revealed stand in the way of this week's lineup or pick: the first of them. */
  revealFirst: number | null;
  /** A late joiner playing their own season (GhostLogic): their week is the episode after their mark. */
  catchingUp: boolean;
  /** Catching up (step 9): the episode they're on (their week), and the latest the game has results for ("Episode 2 of 4"). */
  catchUp: { week: number; latest: number } | null;
}

/** Whose user a seat is, for faces. */
export type UserOf = (playerId: string) => string | null;

/**
 * The game as `playerId` may see it. `full`: the league's state with air times stamped; `seen`: their mark for
 * this league (null: they see results straight away).
 */
export function gameView(game: GameRefIn, full: LeagueState, playerId: string, seen: number | null, userOf: UserOf): GameView {
  const view = StateLogic.GhostLogic.viewFor(full, playerId, seen);
  const type = StateLogic.getLeagueType(view);
  const catchingUp = StateLogic.GhostLogic.isCatchingUp(full, playerId) && Number.isInteger(seen);
  const hidden = StateLogic.SpoilerLogic.hiddenEpisodes(full, seen);
  const table = tableOf(view, playerId, userOf);
  const catchUp = catchingUp ? { week: (seen as number) + 1, latest: StateLogic.SpoilerLogic.latestWithResults(full) } : null;
  return {
    ...game,
    playerId,
    through: StateLogic.SpoilerLogic.latestWithResults(view),
    table,
    you: table.find((r) => r.you) ?? null,
    rules: gameRules(view),
    cast: castOf(view),
    lineup: type.hasActiveRoster ? lineupOf(view, playerId) : null,
    pick: type.hasWeeklyPicks ? pickOf(view, playerId) : null,
    predictions: catchingUp ? [] : predictionsOf(view, playerId),
    progress: catchingUp ? null : weekProgress(full, playerId, userOf),
    revealFirst: hidden.length && !catchingUp ? hidden[0].number : null,
    catchingUp,
    catchUp,
  };
}

export function tableOf(view: LeagueState, me: string, userOf: UserOf): TableRow[] {
  const type = StateLogic.getLeagueType(view);
  const pool = type.hasWeeklyPicks;
  const key = (r: ScoreRow) => (pool ? [r.longestStreak ?? 0, r.total] : [r.total]);
  const rows = [...StateLogic.computeScores(view)].sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    return y[0] - x[0] || (y[1] ?? 0) - (x[1] ?? 0);
  });
  const keys = rows.map((r) => key(r).join(","));
  const lastEp = type.hasActiveRoster ? latestScoredEpisode(view) : null;
  return rows.map((r, i) => {
    const first = keys.indexOf(keys[i]);
    const tied = keys.lastIndexOf(keys[i]) !== first;
    const you = r.playerId === me;
    return {
      playerId: r.playerId,
      userId: userOf(r.playerId),
      name: r.name,
      you,
      rank: `${tied ? "T" : ""}${first + 1}`,
      place: first + 1,
      total: pool ? (r.longestStreak ?? 0) : r.total,
      week: pool ? (r.currentStreak ?? 0) : lastEp ? teamEpisodeBreakdown(view, lastEp.id, r.playerId).total : null,
      points: r.total,
      team: type.hasRoster ? teamOrder(r.roster).map((c) => c.id) : [],
      last: lastEp ? StateLogic.activeRosterLineupFor(view, lastEp.id, r.playerId) : [],
      // Someone else's pick stays theirs until it's decided.
      picks: pool
        ? StateLogic.pickEmHistory(view, r.playerId)
            .rows.filter((p) => you || p.correct !== null)
            .map((p) => ({ episode: p.episode, castawayId: p.castawayId, correct: p.correct }))
        : [],
    };
  });
}

/** Every castaway as this copy of the league shows them (the waivers' faces too, waiver-view.ts). */
export function castOf(view: LeagueState): CastFace[] {
  const type = StateLogic.getLeagueType(view);
  const episode = new Map(view.episodes.map((e) => [e.id, e.number]));
  const tribes = new Map((view.tribes || []).map((t) => [t.id, t]));
  const outlast = type.hasRoster && !type.hasActiveRoster;
  return view.castaways.map((c: Castaway) => {
    const tribe = tribes.get(c.tribeId);
    const left = c.status === "eliminated";
    return {
      id: c.id,
      name: c.name,
      photo: publicMediaSrc(c.photoUrl),
      tribe: tribe ? { name: tribe.name, colour: tribe.color } : null,
      left,
      knocked: isKnockedOut(view, c),
      out: left && c.exitEpisodeId ? (episode.get(c.exitEpisodeId) ?? null) : null,
      place: left && c.placementOrder ? view.castaways.length - c.placementOrder + 1 : null,
      points: outlast ? castawayPoints(view, c) : type.hasActiveRoster ? castawayEventStats(view, c.id).total : null,
    };
  });
}

function lineupOf(view: LeagueState, me: string): LineupMove | null {
  const ep = StateLogic.currentEpisode(view);
  if (!ep) return null;
  const AR = StateLogic.ActiveRosterLogic;
  const mine = view.castaways.filter((c) => c.ownerIds.includes(me));
  const stillIn = new Set(mine.filter((c) => c.status !== "eliminated").map((c) => c.id));
  // The same "set" as the home's moves (action-items.js): every slot you could fill, filled with someone still in.
  const starters = StateLogic.activeRosterLineupFor(view, ep.id, me).filter((id) => stillIn.has(id));
  const { activeSlots, need } = lineupStatus(view, ep, me);
  return {
    epId: ep.id,
    episode: ep.number,
    airsAt: ep.airsAt ?? null,
    locked: AR.isLineupLocked(view, ep.id),
    slots: activeSlots,
    need,
    starters,
    roster: teamOrder(mine).map((c) => c.id),
    set: starters.length >= need,
    carried: AR.lineupIsCarried(view, ep.id, me),
  };
}

function pickOf(view: LeagueState, me: string): PickMove | null {
  const { ep, open } = pickWindow(view);
  if (!ep) return null;
  const { available, blocked } = StateLogic.pickEmEligibility(view, ep.id, me);
  return {
    epId: ep.id,
    episode: ep.number,
    airsAt: ep.airsAt ?? null,
    open,
    pick: StateLogic.pickEmPickFor(view, ep.id, me)?.castawayId ?? null,
    available,
    blocked: Object.entries(blocked).map(([id, b]) => ({ id, ...b })),
    streak: StateLogic.pickEmHistory(view, me).currentStreak,
  };
}

/** Open predictions (the home's prediction move, action-items.js): unsettled, on an episode with no results yet. */
function predictionsOf(view: LeagueState, me: string): PredictionMove[] {
  if (!view.settings.bonusEnabled) return [];
  return [...view.episodes]
    .filter((ep) => !ep.resultsHidden && !StateLogic.episodeHasResults(ep) && StateLogic.inPlay(view, ep.number))
    .sort((a, b) => a.number - b.number)
    .flatMap((ep) =>
      (ep.bets || [])
        .filter((bet) => !isBetSettled(bet))
        .map((bet) => {
          const mine = (bet.predictions || []).find((p) => p.playerId === me);
          return {
            epId: ep.id,
            episode: ep.number,
            betId: bet.id,
            label: bet.label,
            points: bet.points || 0,
            guess: mine ? { id: mine.id, text: mine.guess } : null,
            answers: (bet.predictions || []).length,
          };
        })
    );
}

/**
 * Who's set for this week's move: lineups set (Weekly Lineup) or picks made (Survival Pool), counted over the
 * league's own players (no late joiner it can't see). Nothing about results, so it reads the real state; null for
 * a game with no weekly move. Also the hub's Up next (/api/me/home).
 */
export function weekProgress(full: LeagueState, viewerId: string | null, userOf: UserOf): WeekProgress | null {
  const s = StateLogic.GhostLogic.viewFor(full, viewerId, null);
  const type = StateLogic.getLeagueType(s);
  const players = s.players.filter((p) => p.active !== false && !p.disabled && !p.ghost);
  const people = (done: (id: string) => boolean) => players.map((p) => ({ playerId: p.id, userId: userOf(p.id), name: p.name, done: done(p.id) }));
  let label: WeekProgress["label"];
  let episode: number;
  let list: WeekProgress["people"];
  if (type.hasActiveRoster) {
    const ep = StateLogic.currentEpisode(s);
    if (!ep) return null;
    label = "lineups set";
    episode = ep.number;
    list = people((id) => lineupStatus(s, ep, id).set);
  } else if (type.hasWeeklyPicks) {
    const { ep } = pickWindow(s);
    if (!ep) return null;
    label = "picked";
    episode = ep.number;
    list = people((id) => !!StateLogic.pickEmPickFor(s, ep.id, id));
  } else return null;
  return { label, episode, done: list.filter((p) => p.done).length, of: list.length, people: list };
}
