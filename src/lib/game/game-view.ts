import type { Castaway, LeagueState, ScoreRow } from "./types";
import StateLogic from "./state-logic.js";
import type { AnswerWalk } from "./state-logic.js";
import { castawayEventStats } from "./active-roster-rows";
import { castawayPoints, teamOrder } from "./classic-view";
import { latestScoredEpisode } from "./episode-team-summary";
import { gameRules } from "./game-rules";
import { lineupStatus } from "./lineup-view";
import { pickWindow } from "./pool-view";
import { pointsPerLine } from "./bingo";
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
  /** A computer player (bot-logic.js): a practice couch's. */
  bot: boolean;
  /** Calls that were right (Call it, step 12 part 2): a public pool's Who goes home? (settings.calls) or Weekly Calls'; else 0. */
  calls: number;
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
  /** Step A11 part 2: "used", a pick that never repeats: picked before. */
  blocked: { id: string; episode: number; reason: "cycle" | "backToBack" | "used" }[];
  streak: number;
}

/**
 * Your calls in a game that reads them (Call it, src/lib/server/calls.ts; a person's, not the league's): a public pool's Who
 * goes home? (`call`, a castaway of the pool's, for the pick's episode; anyone still in) or Weekly Calls' two a show.
 */
export interface CallMove {
  epId: string;
  episode: number;
  airsAt: string | null;
  open: boolean;
  /** The pool's Who goes home?: whoever you called, and who you could. */
  call: string | null;
  available: string[];
  /** How many of the episode's calls you've made, of how many. */
  made: number;
  of: number;
  /** Calls of yours that were right so far. */
  right: number;
}

/** Weekly Bingo's card to hand (step 12 part 3; bingo.ts): the next episode you'd watch once it's aired, else the next to air. */
export interface BingoMove {
  episode: number;
  airsAt: string | null;
  /** It's aired: tick squares as it happens. */
  open: boolean;
  /** Squares you've ticked on it, and the lines they make. */
  ticked: number;
  lines: number;
}

/** A game's sheet of questions to answer now (step A4 part 2 of docs/PLAN-start-a-game-gpt.md; answers.ts sheetOf): a game of
 *  questions' this week (and its own), or a draft's finale predictions. */
export interface SheetMove {
  /** The episode this week's questions are for, or null (only the game's own). */
  episode: number | null;
  /** Questions you can answer now, and how many of them you have. */
  of: number;
  answered: number;
  /** The soonest of their locks, when it's known. */
  closesAt: string | null;
  /** A question waits until you've seen this episode (it says who's still in), or null. */
  behind: number | null;
  /** A draft's finale predictions, not a game of questions. */
  finale: boolean;
}

/** What a game reads of its players' calls or bingo cards (they aren't in its state): each one's right calls (Weekly Bingo: lines
 *  that count), your move, and (Weekly Calls, Weekly Bingo) the episode its table is through and whether the season's over. */
export interface GameCalls {
  right: (playerId: string) => number;
  move: CallMove | null;
  bingo?: BingoMove | null;
  through?: number;
  ended?: boolean;
  /** Step A11 part 2b: a game of questions' walk on this viewer's own copy (answer-points.ts walked): who's out, where it ended. */
  walk?: AnswerWalk | null;
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
  /** The answers as chips (step 12 part 2), from what the question asks (predictionKind): who's still in for "Who ...?", Yes and
   *  No for "Will ...?"; null: answered in words. */
  options: string[] | null;
}

/**
 * What a prediction asks for, from its words (a prediction is free text with no options of its own, so the question says it):
 * a person ("Who goes home?", "Which castaway ...?") or a yes or no ("Will an idol be played?"); null: anything, in words
 * (a question with "or" in it chooses between its own words).
 */
export function predictionKind(label: string): "cast" | "yesno" | null {
  const q = label.trim();
  if (/^(who|whom|which (castaway|player|person|contestant|one|houseguest|queen|team|crew member))\b/i.test(q)) return "cast";
  if (/^(will|does|do|did|is|are|was|were|can|could|has|have|would|should)\b/i.test(q) && !/\bor\b/i.test(q)) return "yesno";
  return null;
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
  /** A game on no couch (step 9 part 3): a season's public pool, or your practice couch against computer players. */
  solo?: "public" | "practice" | null;
  /** Archived (step 10 part 2b): its table as it stood; nothing scores it. */
  archived?: boolean;
}

/** A public pool's table: the top ten, you and whoever's either side of you (it can hold hundreds). */
export const POOL_TOP = 10;

export interface GameView extends GameRefIn {
  playerId: string;
  /** Standings are through this episode: they move when you reveal. */
  through: number;
  /** The first episode this game counts for you (its start, or yours as a late joiner): standings mean something once
   *  `through` reaches it. Null while a game that starts when a phase of the season does waits for it (step A3). */
  from: number | null;
  /** The phase of the season it starts at, by name ("Merged"), or null: it starts at an episode. Filled in by the server
   *  (season-games.ts), which reads the league's rulebook. */
  phase: string | null;
  /** A game over a span (docs/PLAN-sports-data.md step 6): its last episode; null to the season's end. */
  to: number | null;
  /** It's over as far as you've seen: its season, or its span's last episode (StateLogic.gameOver). */
  over: boolean;
  table: TableRow[];
  you: TableRow | null;
  /** Everyone on the table, when `table` is a public pool's top and you (else table.length). */
  players: number;
  rules: string[];
  cast: CastFace[];
  lineup: LineupMove | null;
  pick: PickMove | null;
  call: CallMove | null;
  /** Weekly Bingo's card to hand (step 12 part 3). */
  bingo: BingoMove | null;
  /** Weekly Bingo's points per line (step A9; 1 unless it says), so its table's totals are said as points when a line is worth
   *  more; null for any other game. */
  linePoints: number | null;
  /** A sheet of questions to answer now (step A4 part 2): filled in by the server (season-games.ts), which reads the answers. */
  sheet: SheetMove | null;
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
 * this league (null: they see results straight away). `playerId` null: no seat (the desk's Open it read-only,
 * docs/PLAN-desk-parity.md part 6c): the table as anyone on its couch sees it, nobody marked "you", no moves and nothing
 * to reveal; its `playerId` is "".
 */
export function gameView(game: GameRefIn, full: LeagueState, playerId: string | null, seen: number | null, userOf: UserOf, calls?: GameCalls): GameView {
  // A game over a span (settings.endEpisode) as it stood at its last episode, however far past it you are. Step A11 part 2b: a game
  // of questions' walk on your copy (answer-points.ts), so it ends, and knocks anyone out, only as far as you've seen.
  const seenView = StateLogic.GhostLogic.viewFor(full, playerId, seen);
  const view = StateLogic.spanView(calls?.walk ? StateLogic.AnswerLogic.withWalk(seenView, calls.walk) : seenView);
  const type = StateLogic.getLeagueType(view);
  const me = playerId ?? "";
  const seat = playerId !== null;
  const catchingUp = seat && StateLogic.GhostLogic.isCatchingUp(full, me) && Number.isInteger(seen);
  const end = StateLogic.endEpisode(full);
  // Results after its last episode aren't this game's to reveal (step A11 part 1: nor after a race won or one left).
  const last = StateLogic.lastEpisode(full);
  const hidden = StateLogic.SpoilerLogic.hiddenEpisodes(full, seen).filter((e) => last === null || e.number <= last);
  const everyone = tableOf(view, me, userOf, calls?.right);
  const isPublic = game.solo === "public";
  const table = isPublic ? poolTop(everyone) : everyone;
  const catchUp = catchingUp ? { week: (seen as number) + 1, latest: StateLogic.SpoilerLogic.latestWithResults(full) } : null;
  return {
    ...game,
    playerId: me,
    through: type.hasCalls || type.hasBingo ? (calls?.through ?? 0) : StateLogic.SpoilerLogic.latestWithResults(view),
    from: StateLogic.GhostLogic.startFor(view, me),
    phase: null,
    to: end,
    over: type.hasCalls || type.hasBingo ? !!calls?.ended : StateLogic.gameOver(view),
    table,
    you: table.find((r) => r.you) ?? null,
    players: everyone.length,
    rules: gameRules(view),
    cast: castOf(view),
    lineup: seat && type.hasActiveRoster ? lineupOf(view, me) : null,
    pick: seat && type.hasWeeklyPicks ? pickOf(view, me) : null,
    call: calls?.move ?? null,
    bingo: calls?.bingo ?? null,
    linePoints: type.hasBingo ? pointsPerLine(view) : null,
    sheet: null,
    predictions: catchingUp || !seat ? [] : predictionsOf(view, me),
    progress: catchingUp ? null : weekProgress(full, playerId, userOf, { counts: isPublic }),
    revealFirst: hidden.length && !catchingUp && seat ? hidden[0].number : null,
    catchingUp,
    catchUp,
  };
}

/** A public pool's rows: the top POOL_TOP, then you and your neighbours when you're further down. */
export function poolTop(rows: TableRow[]): TableRow[] {
  const i = rows.findIndex((r) => r.you);
  return rows.filter((r, j) => j < POOL_TOP || (i >= POOL_TOP && Math.abs(j - i) <= 1));
}

/** `right`: each player's right calls (Call it), for Weekly Calls' table and a pool's "N called", or their lines (Weekly Bingo's
 *  table); none read, none counted. */
export function tableOf(view: LeagueState, me: string, userOf: UserOf, right: (playerId: string) => number = () => 0): TableRow[] {
  const type = StateLogic.getLeagueType(view);
  const pool = type.hasWeeklyPicks;
  // Weekly Calls, Weekly Bingo and a game of questions (A4) rank by what `right` counts: calls, lines, points.
  const callsGame = !!type.hasCalls || !!type.hasBingo || !!type.hasQuestions;
  const calls = StateLogic.pickEmCallsOn(view) || callsGame;
  const bots = new Set(view.players.filter((p) => p.automated).map((p) => p.id));
  // The engine's own order (StateLogic.rankKey): a pool with lives by who's still standing (step A10 part 2), else its streak; a
  // stock market ranked by worth (part 3c), cash plus the team at today's prices; else the points.
  const worth = !pool && !callsGame && StateLogic.gameOf(view).rank.by === "worth";
  // Step A11 part 2b: a game of questions that races or knocks players out ranks as the engine does, its rows carrying its walk
  // (who's out, their points frozen there).
  const walked = !!StateLogic.AnswerLogic.walkOf(view);
  const key = (r: ScoreRow): number[] => (callsGame && !walked ? [right(r.playerId)] : StateLogic.rankKey(view, r));
  const rows = [...StateLogic.computeScores(view)].sort((a, b) => StateLogic.PickEmScoringStrategy.compareKeys(key(b), key(a)));
  // A pool's seasons, read once (step A11 part 2: a pool that walks everyone together walks once for the table).
  const histories = pool ? StateLogic.PickEmLogic.histories(view) : null;
  const keys = rows.map((r) => key(r).join(","));
  // Best ball (step A9 part 2) has a week as a lineup does; its "last" is who counted, as it has no lineups.
  const lastEp = type.hasActiveRoster || type.hasBestBall ? latestScoredEpisode(view) : null;
  const lastOf = (playerId: string) =>
    !lastEp
      ? []
      : type.hasBestBall
        ? StateLogic.ActiveRosterLogic.episodeScore(view, lastEp, playerId).lines.filter((l) => l.counted).map((l) => l.castawayId)
        : StateLogic.activeRosterLineupFor(view, lastEp.id, playerId);
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
      total: callsGame ? right(r.playerId) : pool ? (r.longestStreak ?? 0) : worth ? (r.worth ?? 0) : r.total,
      week: pool ? (r.currentStreak ?? 0) : lastEp ? teamEpisodeBreakdown(view, lastEp.id, r.playerId).total : null,
      points: r.total,
      team: type.hasRoster ? teamOrder(r.roster).map((c) => c.id) : [],
      last: lastOf(r.playerId),
      // Someone else's pick stays theirs until it's decided.
      picks: pool
        ? (histories?.get(r.playerId) ?? StateLogic.pickEmHistory(view, r.playerId))
            .rows.filter((p) => you || p.correct !== null)
            .map((p) => ({ episode: p.episode, castawayId: p.castawayId, correct: p.correct }))
        : [],
      bot: bots.has(r.playerId),
      calls: calls ? right(r.playerId) : 0,
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

/**
 * A public pool's Who goes home? for the pick's episode (closed with the pick, anyone still in): `mine` is your call there as
 * one of the pool's castaways, from your Call it (the server maps the season's cast to the pool's).
 */
export function poolCallOf(view: LeagueState, mine: string | null, right: number): CallMove | null {
  const { ep, open } = pickWindow(view);
  if (!ep) return null;
  const available = view.castaways.filter((c) => c.status === "active").map((c) => c.id);
  const call = mine && available.includes(mine) ? mine : null;
  return { epId: ep.id, episode: ep.number, airsAt: ep.airsAt ?? null, open, call, available, made: call ? 1 : 0, of: 1, right };
}

/** Open predictions (the home's prediction move, action-items.js): unsettled, on an episode that hasn't locked yet (A4: a
 *  bet locks as its episode's lineups do, BetLogic.closed), and only where side bets count (beside a draft: betsOn). */
function predictionsOf(view: LeagueState, me: string): PredictionMove[] {
  if (!StateLogic.betsOn(view)) return [];
  const stillIn = view.castaways.filter((c) => c.status !== "eliminated").map((c) => c.name);
  const optionsFor = (label: string) => {
    const kind = predictionKind(label);
    return kind === "cast" ? (stillIn.length ? stillIn : null) : kind === "yesno" ? ["Yes", "No"] : null;
  };
  return [...view.episodes]
    .filter((ep) => !ep.resultsHidden && !StateLogic.BetLogic.closed(ep) && StateLogic.inPlay(view, ep.number))
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
            options: optionsFor(bet.label),
          };
        })
    );
}

/**
 * Who's set for this week's move: lineups set (Weekly Lineup) or picks made (Survival Pool), counted over the
 * league's own players (no late joiner it can't see). Nothing about results, so it reads the real state; null for
 * a game with no weekly move. Also the hub's Up next (/api/me/home). `counts`: the numbers only, nobody named (a public
 * pool, where the people are strangers and can be hundreds).
 */
export function weekProgress(full: LeagueState, viewerId: string | null, userOf: UserOf, opts: { counts?: boolean } = {}): WeekProgress | null {
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
  return { label, episode, done: list.filter((p) => p.done).length, of: list.length, people: opts.counts ? [] : list };
}
