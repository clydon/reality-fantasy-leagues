import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { AnswerFacts, FormatGroups, Question, SpecContext, SportsGameFacts, Verdict } from "@/lib/game/game-spec/index.js";
import type { RulebookBlocks } from "@/lib/game/formats/rulebook-schema";
import type { LeagueState } from "@/lib/game/types";
import type { CallBook } from "@/lib/game/calls";
import { contextOf } from "@/lib/game/question-choices";
import type { SheetMove } from "@/lib/game/game-view";
import { publicMediaSrc } from "@/lib/game/selectors";
import { isUuid, type SessionUser } from "./auth-helpers";
import { HttpError, pool, withLeagueLock } from "./db";
import { seasonSchedules, type SeasonSchedule } from "./schedule";
import { finaleEpisode, keepsAnswers, readsTimeline, walked, type AnswerRow } from "./answer-points";
import type { AnswerLines, AnswerWalk, CoopWalk } from "@/lib/game/state-logic.js";
import { seasonBook } from "./calls";
import { gamesHere, type GameHere } from "./season-games";
import { playedInSheet, triviaWritten } from "./trivia-key";
import { factContextForSeason } from "./episode-facts";
import { drawNow, sidesFor } from "./sports/score";
import { keepLines } from "./question-lines";
import { PLAYOFFS } from "@/lib/sports/playoffs";

// A game's questions (docs/PLAN-start-a-game-gpt.md step A4; migration 0200 game_answers):
//   GET  /api/seasons/[id]/answers?league=&episode=   the game's questions as you may see them: this week's (asked each
//        episode) and the game's own (asked once), yours, how many have answered; once one locks, everyone's answers, and how
//        it stands as far as you've seen
//   POST /api/seasons/[id]/answers?league=            { episode?, answers: { [question]: answer | null } } before each locks
// The tables' points are answer-points.ts's (leagueAnswers, answerStanding).
//
// The questions are the game's spec's `ask` (StateLogic.AnswerLogic): a game of questions' own, whose answers live in
// game_answers, and a draft's finale predictions, whose answers stay in its state (state.finalePredictions, where classic's
// finale panel writes them), and (step C2 part 4c) a draft's own questions after them, in game_answers as a game of questions'
// are. Weekly Calls' are Call it's (calls.ts). A question locks as a lineup does, at the start of the
// episode that closes it (closedForPlay: whoever runs the game can keep it open or lock it early), once it has results or
// data has settled it; finale predictions when the season's last episode starts. Nobody else's answer leaves the server
// before then, only how many have answered. Graded on read from the league's results at your mark (the spoiler guard's view
// of the state, as every table is), never stored. Nothing polls (docs/HOSTING.md).

export interface QuestionFace {
  id: string;
  name: string;
  photo: string | null;
}

/** A13: one question of a trivia round (its key's, the bot's trivia research), as the round shows it: the right answer, why and its
 *  page only once it's graded as far as you've seen. */
export interface TriviaRoundItem {
  id: string;
  /** The episode it's about (the one before the round's, or earlier). */
  episode: number;
  kind: "cast" | "number" | "text";
  question: string;
  options: string[];
  /** You've played it in the trivia sheet, where you saw its answer: an answer here can't be given or changed. */
  played: boolean;
  answer: string | null;
  why: string | null;
  source: string | null;
}

export interface QuestionPerson {
  playerId: string;
  /** Their account, for their face (null: a seat with none). */
  userId: string | null;
  name: string;
  you: boolean;
  answer: unknown;
  /** Null while it's still to be settled (as far as you've seen). */
  right: boolean | null;
  earned: number;
}

export interface QuestionView {
  id: string;
  ask: string;
  answer: Question["answer"];
  /** What settles it (the results' who went home or won, a moment): the screen's words for what was right. */
  settle: Question["settle"];
  points: number;
  asked: Question["asked"];
  closes: "start" | "finale";
  pick: number | null;
  from: "cast" | "team" | null;
  /** An over/under's line: its own, or (L3 part 3b) on the game's own line the one kept when it opened (null: none out yet). */
  line: number | null;
  options: string[] | null;
  /** A8: an order's places off that still score; chips to spread; a wager's most stake; who outlasts whom, the pairs (each its
   *  key and two faces, answered { key: castawayId }). */
  within: number | null;
  chips: number | null;
  /** A9: "total", any of your points (`stakeMost` is how many that is for you now; step C6, beside a bank, any stake's most). */
  wager: number | "total" | null;
  /** Step C6: what a right stake pays: even money, or a share of the pool (the window's wrong stakes); null without a wager. */
  odds: "even" | "pool" | null;
  /** Step C6 part 2, a ticket: the questions it's built from, how many legs it takes, and its stake's winnings for each number of
   *  legs right from its least (answered { legs: [question ids], stake }, each leg your own answer to it there); null for any other. */
  ticket: { of: string[]; min: number; max: number; pays: number[] } | null;
  /** Step C7, a line of the game's card (a question on it, asked for each of its lines: `<id>.<n>`): the question it's from, and the
   *  moment it's about this window, in the league's rules' words; null for any other question. */
  /** Step C7 part 2: `waiting`, a card the bot chooses that isn't out yet (its moment and label null till then). */
  card: { from: string; moment: string | null; label: string | null; waiting?: true } | null;
  pairs: { key: string; faces: [QuestionFace, QuestionFace] }[] | null;
  /** A9: how its points combine. share: split (a pot split between everyone right) or only (only the only right one scores);
   *  rollover: a window nobody earns anything on carries its points into the next (`jackpot`: what's carried into this one, once
   *  the windows before it are settled as far as you've seen); shrink: a call whose points shrink with each episode that's
   *  started when it's made, or each change once the game's on (`worth`: what yours is worth, or one made now). */
  share: "split" | "only" | null;
  rollover: boolean;
  jackpot: number | null;
  shrink: { points: number; per: "episode" | "change" } | null;
  worth: number | null;
  stakeMost: number | null;
  /** "person": asked about each person still in (A6), answered { castawayId: answer } for any of `faces`. L3 part 2f part 2:
   *  "game", asked of each game of the episode, answered { eventId: answer } for any of `games` (ranked by confidence: each
   *  { answer, confidence }), each pick locking as its own game starts. */
  each: "person" | "game" | null;
  /** L3 part 2f part 2, a question about each game: whether its picks are ranked by confidence (1 to the episode's games). */
  confidence: boolean;
  /** L3 part 2f part 2, a question about each game: the episode's games as linked, in the order they start, each with its sides
   *  (a side answer's faces: the teams by name) and whether it's started (its pick locked, kept as it was); null for any other. */
  games: { id: string; name: string | null; startsAt: string | null; started: boolean; sides: QuestionFace[]; line: number | null; called: "postponed" | "canceled" | null }[] | null;
  /** The episode it's answered for (asked each), or null (the game's own). */
  episode: number | null;
  /** open: yours to answer; behind: see Episode `catchUp` first (it says who's still in), or catch up on the game first (null);
   *  waiting (L3 part 3b): an over/under on the game's own line before there's one ("Line coming"), opening once it's read;
   *  closed: locked. */
  status: "open" | "behind" | "waiting" | "closed";
  catchUp: number | null;
  /** When it locks (the closing episode's air time), when that's known. */
  closesAt: string | null;
  /** Who a person answer can name: who's still in as far as you've seen (or, from your own team, yours); a group answer, the groups
   *  someone still in is on; a question about each person, who it asks about. */
  faces: QuestionFace[] | null;
  /** L3 part 2e: a bracket's draw as listed (sports/score.ts drawNow), the draw as it was made and nothing it's played since (no
   *  spoiler): how many rounds it is (`first`, the first round's distance from the final), its first round's matches, and who's in
   *  it, each with the round they enter in (a seed with a bye later). Null for any other question, a draw not listed yet, or while
   *  you're behind. */
  draw: { first: number; matches: [QuestionFace, QuestionFace][]; entrants: (QuestionFace & { enters: number })[] } | null;
  /** F3 part 2: why a group question has nothing to pick this episode on a season played in pairs (who is with whom going in
   *  isn't sure, or nobody is in a group): it doesn't count either way. A13: why a trivia round has none (yet). Null otherwise. */
  offWhy: string | null;
  /** A13: a trivia question's round, answered { [id]: option } for any of them; null for any other question, or while you're behind
   *  (see the episode before it first: the round is about it). */
  trivia: TriviaRoundItem[] | null;
  mine: unknown;
  /** How many have answered: a count, nobody named. */
  answered: number;
  /** Once it's closed: how it stands as far as you've seen (still to settle, off, or what was right). */
  verdict: Verdict | null;
  /** Once it's closed: everyone's answers, you first, and how each did as far as you've seen. */
  people: QuestionPerson[];
  /** Step A14 part 2: a question played against the bot's own call: whether the bot has made its call on this window (before it
   *  locks for you, nothing of what it is), and once it's closed for you, its call and whether it was right as far as you've seen
   *  (null: still to settle, or void); null for any other question. The bot is never one of `people`. */
  bot: { called: boolean; answer: unknown; right: boolean | null } | null;
}

export interface GameQuestions {
  leagueId: string;
  /** The episode this week's questions are for (the one lineups and picks are for), or null. */
  episode: number | null;
  questions: QuestionView[];
  /** Your points from them so far, as far as you've seen. */
  points: number;
  /** Every castaway by id, name and face (no status: who's still in is `faces`), for the answers and what was right. */
  cast: QuestionFace[];
  /** Every group (tribe, team) by id and name, for a group answer's answers and what was right (A6). */
  groups: QuestionFace[];
  /** Where you are (the last episode you've seen), or null when you see results as they come: a locked question past it says
   *  "once you've seen it", not "waiting". */
  mark: number | null;
  /** Step A11 part 2b: in a game that knocks players out, the last episode that counted for you once you're out (as far as you've
   *  seen), else null: you answer nothing more. */
  out: number | null;
  /** Where the game ended early (a race won, one left; step A11 part 3: a co-op game's last life lost; part 4b: head to head's
   *  final played), as far as you've seen, else null: nothing after it is asked. */
  ended: number | null;
  /** Step A11 part 3: a co-op game's lives (the couch's together) and its result, won or lost by all, as far as you've seen; null
   *  for any other game. */
  coop: CoopWalk | null;
}


/** Whether a question's answers are a draft's finale predictions (kept in its state), not game_answers'. A draft's own questions
 *  (step C2 part 4c) take other ids (schema.js), so they're game_answers', as a game of questions' are. */
const inState = (state: LeagueState, q: Question) => !!StateLogic.finaleOfGame(state) && (q.id === "top3" || q.id === "winner");

/** The questions answered here: the spec's, less Weekly Calls' (Call it's, calls.ts). */
const questionsOf = (state: LeagueState): Question[] => StateLogic.AnswerLogic.questions(state).filter((q) => !Spec.isCalls(q));

/** Whether a question's answers name someone still in, or ask about each of them (A6): what you can answer depends on who's still in
 *  (and on what group), so it waits until you've seen the episode before it. */
const namesSomeone = (q: Question) => Spec.NAMES.includes(q.answer) || Spec.RANKS.includes(q.answer) || q.answer === "chips" || q.answer === "pairs" || q.each === "person";

/** L3 part 2f part 2: whether a game of an episode has started (its listing's start passed; a game with none, once it's on). L3 part
 *  3b: or it's called off (postponed, cancelled): nothing to pick for it from then. */
const gameStarted = (g: SportsGameFacts, now: number) => g.status === "off" || (g.listing?.startsAt ? Date.parse(g.listing.startsAt) <= now : g.status !== "pre");

/** L3 part 3b: an over/under on a game's own line, the games it's on at a window (each its kept line's event: an episode's one
 *  game '', each game its own id): a question about each game, the episode's; any other, its window's game (asked once: the game's
 *  first episode's). */
function lineGames(facts: AnswerFacts, q: Question, ep: number): [string, SportsGameFacts][] {
  if (q.each === "game") return [...(facts.slate?.get(ep) ?? [])];
  const n = q.asked === "once" ? facts.from : ep;
  const g = n === null ? undefined : facts.games?.get(n);
  return g ? [["", g]] : [];
}

/** L3 part 3b: the line kept for a question's game at a window (an episode's one game: ''), or null while none is. */
const keptLine = (facts: AnswerFacts, q: Question, ep: number, event: string) => facts.lines?.get(Spec.lineKey(q, ep, event)) ?? null;

/**
 * L3 part 3b: an over/under on a game's own line as it opens (not closed): each of its games still to start with a line read and
 * none kept yet takes the latest one (the listing's), kept for good (question-lines.ts), and the facts carry what's kept now.
 */
async function openLines(r: Read, q: Question, ep: number): Promise<void> {
  if (q.line !== Spec.LINE_GAME) return;
  const now = r.now.getTime();
  const due = lineGames(r.facts, q, ep).filter(([event, g]) => keptLine(r.facts, q, ep, event) === null && !gameStarted(g, now) && typeof g.listing?.line === "number");
  if (!due.length) return;
  r.facts.lines = await keepLines(r.h.game.leagueId, due.map(([event, g]) => ({ question: q.id, window: ep, event, line: g.listing!.line!, readAt: g.listing?.lineAt ?? null })));
}

/** L3 part 2f part 2: a question about each game closes as its episode's last game starts (each pick at its own game's start before
 *  then): that start, or null when a game's start isn't known (the episode's own lock, then). */
function lastStartOf(facts: AnswerFacts, ep: number): string | null {
  const games = facts.slate?.get(ep);
  if (!games?.size) return null;
  let last: string | null = null;
  for (const g of games.values()) {
    const at = g.listing?.startsAt;
    if (!at) return null;
    if (last === null || Date.parse(at) > Date.parse(last)) last = at;
  }
  return last;
}

/** L3 part 2f part 2: a question about each game's games at a window, as the view lists them (QuestionView.games). */
function gamesView(facts: AnswerFacts, q: Question, ep: number, now: number): NonNullable<QuestionView["games"]> {
  return [...(facts.slate?.get(ep) ?? new Map<string, SportsGameFacts>())]
    .map(([id, g]) => ({
      id,
      name: g.listing?.name ?? null,
      startsAt: g.listing?.startsAt ?? null,
      started: gameStarted(g, now),
      sides: (g.listing?.sides ?? g.sides.map((x) => ({ id: x.id, name: null }))).map((x) => ({ id: x.id, name: x.name ?? "A team", photo: null })),
      // L3 part 3b: an over/under on each game's own line, the one kept when its pick opened (null: none out yet: no pick for it).
      line: q.line === Spec.LINE_GAME ? keptLine(facts, q, ep, id) : null,
      called: g.status === "off" ? (g.called ?? null) : null,
    }))
    .sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? "") || a.id.localeCompare(b.id));
}

/** L3 part 2f part 2: a question about each game's faces at a window, each game by event id with its sides. */
function gameFaces(facts: AnswerFacts, ep: number): Map<string, Set<string>> {
  return new Map([...(facts.slate?.get(ep) ?? new Map<string, SportsGameFacts>())].map(([id, g]) => [id, new Set(g.sides.map((x) => x.id))]));
}

/**
 * L3 part 2f part 2: an answer to a question about each game with each started game's pick kept as it was (a pick there left out
 * stays; one there for a game that started with none, or changed, is refused); taken back (null), only the games still to start.
 * Null when nothing's left.
 */
function keepStarted(r: Read, q: Question, ep: number, value: unknown): unknown {
  const games = r.facts.slate?.get(ep);
  if (!games?.size) return value;
  const given = value === null ? {} : value;
  if (!given || typeof given !== "object" || Array.isArray(given)) return value;
  const before = (r.rows.find((a) => a.playerId === r.h.playerId && a.question === q.id && a.episode === ep)?.answer ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...(given as Record<string, unknown>) };
  const now = r.now.getTime();
  for (const [id, g] of games) {
    const named = g.listing?.name ?? "That game";
    if (!gameStarted(g, now)) {
      // L3 part 3b: an over/under on each game's own line, a game's pick only once its line is kept.
      if (q.line === Spec.LINE_GAME && Object.prototype.hasOwnProperty.call(given, id) && out[id] != null && keptLine(r.facts, q, ep, id) === null) throw new HttpError(409, `No line for ${named} yet: pick it once there is one`);
      continue;
    }
    const had = Object.prototype.hasOwnProperty.call(before, id);
    if (Object.prototype.hasOwnProperty.call(given, id) && (!had || JSON.stringify(out[id]) !== JSON.stringify(before[id]))) {
      // L3 part 3b: called off (its picks don't count), or under way.
      if (g.status === "off") throw new HttpError(409, `${named} was ${g.called === "canceled" ? "cancelled" : "postponed"}: its pick doesn't count either way`);
      throw new HttpError(409, `${named} has started: its pick is locked`);
    }
    if (had) out[id] = before[id];
    else delete out[id];
  }
  return value === null && !Object.keys(out).length ? null : out;
}

/** A pairs question's pairs (step A8): drawn from who was in at the game's start (AnswerLogic.startIn, as the grader draws them),
 *  the same every time, each with its key (its answers' { "a|b": who }). */
function pairsOf(state: LeagueState, q: Question): { key: string; ids: [string, string] }[] {
  return Spec.pairsFrom(q, StateLogic.AnswerLogic.startIn(state)).map((ids) => ({ key: Spec.pairKey(ids), ids }));
}

/** Who a person answer can name, as the viewer sees it: who's still in (from your own team, yours); for a group answer (A6), the
 *  groups someone still in is on (after any swap you've seen, never one you haven't; `fg`, F3 part 2: on a season played in
 *  pairs, the format's state over time's groups going into the episode); for a question about each person, each of those still in. */
function facesFor(view: LeagueState, q: Question, playerId: string, fg?: FormatGroups | null): QuestionFace[] {
  // F3 part 2: on a season played in groups the league doesn't hold (pairs), the groups going into the lock, from the format's
  // state over time ("Ann & Bea"); none when that isn't sure, unless the question follows the people (carry-on). A14 part 2: the
  // engine's (AnswerLogic.faces), which the bot's calls are checked against too.
  return StateLogic.AnswerLogic.faces(view, q, { playerId, groups: fg ?? null }).map((f) => ({ id: f.id, name: f.name, photo: publicMediaSrc(f.photoUrl) }));
}

/** Why a group question on the timeline's groups (F3 part 2) has nothing to pick at an episode's lock, or null. */
function offWhy(q: Question, fg: FormatGroups | null | undefined): string | null {
  if (!fg || !readsTimeline(q)) return null;
  if (fg.off === "apart") return "Nobody plays in a pair or team in this episode: it doesn't count either way";
  if (fg.off === "unknown") return "Who played with whom in this episode wasn't known going into it: it doesn't count either way";
  if (!fg.lockSure && q.fallback !== "carry-on") return "Who is with whom going into this episode isn't sure: it doesn't count either way";
  if (!fg.offered.length) return "Nobody is in a pair or team going into this episode: it doesn't count either way";
  return null;
}

/** A castaway's face by id, as the viewer's copy has them. */
function castFace(view: LeagueState, id: string): QuestionFace {
  const c = view.castaways.find((x) => x.id === id);
  return { id, name: c?.name ?? "Someone", photo: c ? publicMediaSrc(c.photoUrl) : null };
}

/** L3 part 2e: a bracket question's draw for its window, as listed (QuestionView.draw: as it was made, none of what's been played),
 *  or null. */
async function drawView(view: LeagueState, state: LeagueState, q: Question, episode: number, facts: Pick<AnswerFacts, "games" | "playoffs">): Promise<QuestionView["draw"]> {
  const of = (q.settle as { of?: string }).of;
  // L8 part 1's engine items, part 2: a league's playoffs are its teams (by name as linked), not its people.
  // As the grader read them, as of the viewer's mark (serverFacts: every game asking a sport's final has them).
  const playoffs = of === PLAYOFFS ? (facts.playoffs ?? null) : null;
  const field = of ? await drawNow(state, episode, of, { games: facts.games, playoffs }) : null;
  if (!field || field.first === null) return null;
  const first = field.first;
  const teams = new Map((playoffs?.listing?.sides ?? []).map((t) => [t.id, t.name]));
  const face = (id: string): QuestionFace => (playoffs ? { id, name: teams.get(id) ?? "A team", photo: null } : castFace(view, id));
  return {
    first,
    matches: (field.matches[first] ?? []).map(([a, b]) => [face(a), face(b)] as [QuestionFace, QuestionFace]),
    entrants: Object.entries(field.entrants).map(([id, enters]) => ({ ...face(id), enters })).sort((a, b) => b.enters - a.enters || a.name.localeCompare(b.name)),
  };
}

/** One of your games on a season, by league: 404 when you don't play it. */
async function gameHere(user: SessionUser, seasonId: string, leagueId: unknown): Promise<GameHere> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  if (typeof leagueId !== "string" || !isUuid(leagueId)) throw new HttpError(400, "Which game?");
  const { here } = await gamesHere(user, seasonId, null, null, leagueId);
  const h = here.find((x) => x.game.leagueId === leagueId);
  if (!h) throw new HttpError(404, "Game not found");
  return h;
}

/** A game ready for its questions: `h.state` is the league as it stands (a game that knocks players out walked over every answer:
 *  season-games.ts gamesHere), `view` your copy, walked as far as you've seen (answer-points.ts walked), `rows` its answers that
 *  count (a game of questions'; none of someone's for an episode after they went out). */
interface Read {
  h: GameHere;
  view: LeagueState;
  facts: AnswerFacts;
  rows: AnswerRow[];
  walk: AnswerWalk | null;
  /** Step C2 part 4c: a draft's own questions' lines on `view` (answer-points.ts walked), else none. */
  lines: AnswerLines | null;
  schedule: SeasonSchedule | undefined;
  finale: { number: number; airAt: string | null } | null;
  now: Date;
  /** A13: the account reading (whose trivia sheet plays a trivia round's questions are checked against), when it's said, and the
   *  season read (a round's batch is that season's). */
  userId: string | null;
  seasonId: string;
}

async function readOf(user: SessionUser, seasonId: string, leagueId: unknown, now: Date): Promise<Read> {
  return readFrom(await gameHere(user, seasonId, leagueId), seasonId, now, undefined, user.id);
}

/** A game already read (season-games.ts gamesHere) ready for its questions. `rows`: its answers when they've been read already. */
async function readFrom(h: GameHere, seasonId: string, now: Date, rows?: AnswerRow[], userId: string | null = null): Promise<Read> {
  const schedule = (await seasonSchedules([seasonId], now)).get(seasonId);
  const w = await walked({ leagueId: h.game.leagueId, state: h.state, playerId: h.playerId, mark: h.mark, rows: rows ?? h.answers });
  return { h, view: w.view, facts: w.facts, rows: w.rows, walk: w.walk, lines: w.lines ?? null, schedule, finale: finaleEpisode(schedule), now, userId, seasonId };
}

/** A13: a trivia round's key at a window (facts.trivia: the batch written after the episode before it), [] when there's none. */
const roundKey = (r: Read, ep: number) => r.facts.trivia?.get(ep) ?? [];
/** A13: which of a round's questions an account has played in the trivia sheet (none said: none), on the batch's own season. */
const playedOf = (r: Read, userId: string | null, ep: number, ids: string[]) =>
  userId && ids.length ? playedInSheet(userId, roundKey(r, ep)[0]?.seasonId ?? r.seasonId, ep - 1, ids) : Promise.resolve(new Set<string>());

/** The episode whose start closes a question, and its air time (the league's, else the schedule's). */
function closing(r: Read, q: Question, episode: number): { at: number | null; airAt: string | null } {
  const at = StateLogic.AnswerLogic.closesAt(r.h.state, q, episode, r.finale?.number ?? null);
  if (at === null) return { at, airAt: null };
  const ep = r.h.state.episodes.find((e) => e.number === at);
  return { at, airAt: ep?.airsAt ?? r.schedule?.episodes.find((e) => e.number === at)?.airAt ?? null };
}

/** A13: your stored trivia answer at a window, { id: option } ({} when none). */
const triviaBefore = (r: Read, q: Question, ep: number) =>
  (r.rows.find((a) => a.playerId === r.h.playerId && a.question === q.id && a.episode === ep)?.answer ?? {}) as Record<string, unknown>;

/** Whether a question is closed for an episode (the full state's lock: StateLogic.AnswerLogic.closed), for you: a game with a late
 *  lock (step A7) keeps it open while you haven't seen it. */
function isClosed(r: Read, q: Question, episode: number): boolean {
  const { airAt } = closing(r, q, episode);
  // L3 part 2f part 2: a question about each game, at its episode's last game's start.
  const lastStart = q.each === "game" ? lastStartOf(r.facts, episode) : null;
  return StateLogic.AnswerLogic.closed(r.h.state, q, episode, { now: r.now.getTime(), finale: r.finale?.number ?? null, airAt, mark: r.h.mark, lastStart });
}

/** How many of the game's episodes have started now (A9: when an answer is made), the schedule's air time for one the league
 *  hasn't made yet. */
const startedNow = (r: Read) =>
  StateLogic.AnswerLogic.started(r.h.state, { now: r.now.getTime(), airAtOf: (n) => r.schedule?.episodes.find((e) => e.number === n)?.airAt ?? null });

/** Step C6 part 2: a ticket's read: what it's built from, its legs, what it pays for each number right from its least; else null. */
function ticketView(q: Question): QuestionView["ticket"] {
  const t = Spec.ticketOf(q);
  if (!t) return null;
  return { of: t.of, min: t.min, max: t.max, pays: t.payouts };
}

/** Step C7: a line of the game's card at a window: the question it's from and the moment it's about there (as the league's rules
 *  say it), or null for any other question (or a window with no line). Part 2: a card the bot chooses reads the window's choice
 *  (facts.cardChoices: the league's stamp), and says it's waiting while it isn't out. */
function cardView(state: LeagueState, q: Question, ep: number, facts: AnswerFacts): QuestionView["card"] {
  if (!Spec.isCardLine(q) || !q.card || q.card === true) return null;
  const choice = facts.cardChoices?.get(ep);
  if (Spec.cardWaiting(q, ep, choice)) return { from: q.card.from, moment: null, label: null, waiting: true };
  const moment = Spec.cardMoment(q, ep, choice);
  if (!moment) return null;
  const label = (StateLogic.formatOf(state).events.find((e) => e.id === moment)?.label ?? moment).replace(/\.\s*$/, "");
  return { from: q.card.from, moment, label };
}

/** Step C7 part 2: why a line of a card the bot chooses can't be answered yet. */
const CARD_NOT_OUT = `This episode's card isn't out yet. It's out by ${Spec.CARD_OUT_HOURS} hours before the episode airs: answer it then.`;

/** The game's bank (step C6: score.bank), or null: beside one, every stake is drawn from it (Spec.drawsOnBank). */
const bankOf = (state: LeagueState) => Spec.bankOf(StateLogic.gameOf(state));

/** What you've staked on wagers of any of your points (A9) still to settle as far as you've seen, by window ("question|episode"):
 *  points that are already on the line, so a new stake of them can't count them again. Step C6: beside a bank (`bank`), every stake. */
function heldStakes(qs: Question[], answers: AnswerRow[], verdicts: Map<string, Verdict>, me: string, bank: { start: number } | null): Map<string, number> {
  const held = new Map<string, number>();
  for (const a of answers) {
    const q = qs.find((x) => x.id === a.question);
    if (a.playerId !== me || !q || !Spec.drawsOnBank(q, bank)) continue;
    const key = `${q.id}|${q.asked === "once" ? 0 : a.episode}`;
    const stake = (a.answer as { stake?: unknown } | null)?.stake;
    if (verdicts.get(key)?.state !== "waiting" || !Number.isInteger(stake) || (stake as number) <= 0) continue;
    held.set(key, stake as number);
  }
  return held;
}
/** The most you can stake on a wager of any of your points (A9) in a window (`key`): your points as they stand for you, less what's
 *  on the line in your other wagers of them still to settle (`held`, and `staking`: the ones this answer sends); at least 0. */
function stakeMost(points: number, held: Map<string, number>, key: string, staking?: Map<string, number>): number {
  let most = points;
  for (const [k, n] of held) if (k !== key && !staking?.has(k)) most -= n;
  for (const [k, n] of staking ?? []) if (k !== key) most -= n;
  return Math.max(0, Math.floor(most));
}
/** Your points as they stand for you (at your mark) and your stakes still on the line: what a wager of any of them (A9) can stake. */
async function stakeRoom(r: Read): Promise<{ points: number; held: Map<string, number> }> {
  const all = keepsAnswers(r.h.state) ? r.rows : [];
  const graded = StateLogic.AnswerLogic.grade(r.view, all, r.facts);
  return { points: yourPoints(r, graded.points), held: heldStakes(questionsOf(r.h.state), all, graded.verdicts, r.h.playerId, bankOf(r.h.state)) };
}

/** Where a game that ends early ended, once it has (step A11 part 2b: a race won, one left, a co-op game's last life, as its walk has
 *  it), else null. Part 4b, head to head: its end is known from the start (its final's episode), reached once the final is played,
 *  or where the season ended before it (MatchupLogic.endedAt). */
function endedAt(state: LeagueState): number | null {
  if (StateLogic.MatchupLogic.on(state)) return StateLogic.MatchupLogic.endedAt(state);
  const end = StateLogic.KnockoutLogic.endsAt(state);
  return end !== null && StateLogic.gameOver(state) ? end : null;
}

/** Your points as they stand for you: a game's walk's (step A11 part 2b: frozen once you're out), else graded. */
const yourPoints = (r: Read, points: Map<string, number>) => (r.walk ? (r.walk.totals[r.h.playerId] ?? 0) : (points.get(r.h.playerId) ?? 0));

/** The episode you answer for now: this week's (the game's, not where you are), or with a late lock (step A7) the one after
 *  your mark while it's still open for you. None after the game ended early as far as you've seen (step A11 part 2b: a race won,
 *  one left; answerQuestions refuses an answer after it as the league stands). */
const weekOf = (r: Read) => {
  const n = StateLogic.AnswerLogic.lateEpisode(r.h.state, r.h.mark, { now: r.now.getTime(), airAtOf: (e) => r.schedule?.episodes.find((x) => x.number === e)?.airAt ?? null });
  return n !== null && StateLogic.KnockoutLogic.endedBefore(r.view, n) ? null : n;
};

/** The window a question is answered for at an episode (step A7: its own asked each; the run or phase it's in), or 0 asked once,
 *  or null when it has none there. A phase's window shows once you're up to the episode before it: someone further behind never
 *  learns the phase began. */
const windowFor = (r: Read, q: Question, episode: number | null) => (q.asked === "once" ? 0 : StateLogic.AnswerLogic.windowAt(r.h.state, q, episode, r.h.mark));

/** The episode before the one a person or group answer (or a question about each person) needs to have been seen (who's still in,
 *  and on what group), or null when nothing is needed. */
function needsSeen(r: Read, q: Question, episode: number): number | null {
  // A13: a trivia round is about the episode before it (and the season so far).
  if (q.answer === "trivia") return episode > 1 ? episode - 1 : null;
  if (!namesSomeone(q) || q.closes === "finale") return null;
  const at = q.asked !== "once" ? episode : StateLogic.startEpisode(r.h.state);
  return at === null || at <= 1 ? null : at - 1;
}

/** A game's questions as you may see them. `episodeIn`: a past episode's (for how it went), else this week's. */
export async function gameQuestions(user: SessionUser, seasonId: string, leagueId: unknown, episodeIn?: unknown, now = new Date()): Promise<GameQuestions> {
  const r = await readOf(user, seasonId, leagueId, now);
  return readQuestions(r, episodeIn);
}

async function readQuestions(r: Read, episodeIn?: unknown): Promise<GameQuestions> {
  const { h, view, facts } = r;
  const me = h.playerId;
  const qs = questionsOf(h.state);
  // This week's is the game's (the league's own state), not where you are: someone behind sees it as behind, not an
  // earlier episode that's long locked. With a late lock (A7), the one after your mark while it's open for you.
  const thisWeek = weekOf(r);
  let episode = thisWeek;
  if (episodeIn !== undefined && episodeIn !== null && episodeIn !== "") {
    const n = Number(episodeIn);
    // Step A11 part 2b: nor one after the game ended early, as far as you've seen.
    if (!Number.isInteger(n) || n < 1 || !StateLogic.inPlay(h.state, n) || StateLogic.KnockoutLogic.endedBefore(view, n)) throw new HttpError(400, "Which episode?");
    episode = n;
  }
  // Only the players your copy of the league has: a late joiner you can't see (viewFor takes them out) isn't counted,
  // listed or graded.
  const names = new Map(view.players.map((p) => [p.id, p.name]));
  // A draft's finale predictions are in its state; a game of questions keeps its answers in game_answers (those that count: step A11
  // part 2b, none of someone's for an episode after they went out), and so does a draft's own questions (step C2 part 4c).
  const stored = keepsAnswers(h.state) ? r.rows : [];
  const all = [...stored, ...StateLogic.AnswerLogic.finaleAnswers(h.state)].filter((a) => names.has(a.playerId));
  // A late joiner catching up answers nothing until they're on the live episode (answerQuestions refuses it): each open
  // question waits for them, with no episode to see (catchUp null).
  const catching = StateLogic.GhostLogic.isCatchingUp(h.state, me);
  const mark = h.mark ?? Number.POSITIVE_INFINITY;
  const graded = StateLogic.AnswerLogic.grade(view, all, facts);
  const out: QuestionView[] = [];
  const points = yourPoints(r, graded.points);
  // A9: your stakes still on the line, and how many of the game's episodes have started (a shrinking call made now).
  const bank = bankOf(h.state);
  const held = heldStakes(qs, stored, graded.verdicts, me, bank);
  const lateNow = startedNow(r);
  // A14 part 2: the windows the bot has made its call on (whether it has, before the lock: nothing of what it is), as the facts read them.
  const made = facts.botCalled ?? null;
  for (const q of qs) {
    // Its window this week (A7: asked each, its episode; every few or by phase, the run it's in), or the game's own (0).
    const each = q.asked !== "once";
    const at = windowFor(r, q, episode);
    if (at === null) continue;
    const ep = at;
    const mineRow = all.find((a) => a.playerId === me && a.question === q.id && a.episode === ep);
    const mine = mineRow?.answer ?? null;
    const theirs = all.filter((a) => a.question === q.id && a.episode === ep);
    const closed = isClosed(r, q, ep);
    const { airAt } = closing(r, q, ep);
    const seen = needsSeen(r, q, ep);
    const behind = !closed && (catching || (seen !== null && mark < seen));
    // L3 part 3b: an over/under on the game's own line keeps the latest one read as it opens; before there's one it waits.
    if (!closed) await openLines(r, q, ep);
    const ownLine = q.line === Spec.LINE_GAME && q.each !== "game" ? keptLine(r.facts, q, ep, "") : null;
    const lineComing = q.line === Spec.LINE_GAME && q.each !== "game" && ownLine === null;
    // Once it's closed, how it stands as far as you've seen.
    const v = closed ? (graded.verdicts.get(`${q.id}|${ep}`) ?? Spec.verdictOf(q, ep, facts)) : null;
    // A13: a trivia round's questions, once you've seen the episode it's about (whether or not it's locked), each one you've played in
    // the trivia sheet marked; what was right once it's graded as far as you've seen.
    let round: TriviaRoundItem[] | null = null;
    if (Spec.isTrivia(q) && !catching && !(seen !== null && mark < seen)) {
      const key = roundKey(r, ep);
      const played = await playedOf(r, r.userId, ep, key.map((t) => t.id));
      round = key.map((t) => {
        const right = v?.state === "known" && v.each?.[t.id]?.state === "known";
        return { id: t.id, episode: t.episode, kind: t.kind, question: t.question, options: t.options, played: played.has(t.id), answer: right ? t.answer : null, why: right ? t.why : null, source: right ? t.source : null };
      });
    }
    const triviaOff = round && !round.length ? (v?.state === "off" ? v.why : "No trivia questions for this round yet") : null;
    // Step C7: a line of the card says its moment this window, its words the line's own ("This week's sheet: Found an idol").
    const line = cardView(view, q, ep, r.facts);
    const view1: QuestionView = {
      id: q.id,
      ask: line?.label ? `${q.ask}: ${line.label}` : q.ask,
      answer: q.answer,
      settle: q.settle,
      points: q.points,
      asked: q.asked,
      closes: q.closes,
      pick: (Spec.NAMES.includes(q.answer) || Spec.RANKS.includes(q.answer)) && !q.each ? (q.pick ?? 1) : null,
      from: q.answer === "person" && !q.each ? (q.from ?? "cast") : null,
      line: typeof q.line === "number" ? q.line : ownLine,
      options: q.options ?? null,
      within: q.answer === "order" ? (q.within ?? 0) : null,
      chips: q.answer === "chips" ? (q.chips ?? null) : null,
      wager: q.wager ?? null,
      odds: q.wager !== undefined && !Spec.isTicket(q) ? (q.odds ?? Spec.ODDS) : null,
      ticket: ticketView(q),
      card: line,
      share: q.share ?? null,
      rollover: !!q.rollover,
      jackpot: q.rollover && graded.worth.has(`${q.id}|${ep}`) ? (graded.worth.get(`${q.id}|${ep}`) ?? q.points) - q.points : null,
      shrink: q.shrink ?? null,
      // Yours as it was made; none yet, one made now (made once the game's on, it counts as a change).
      worth: q.shrink ? Spec.shrunk(q, q.points, mineRow && "late" in mineRow ? mineRow : { late: lateNow, changes: lateNow > 0 ? 1 : 0 }) : null,
      // Step C6: beside a bank, a stake of up to the wager is held to what's left of it too.
      stakeMost: Spec.drawsOnBank(q, bank) ? Math.min(stakeMost(points, held, `${q.id}|${ep}`), typeof q.wager === "number" ? q.wager : Infinity) : null,
      pairs: q.answer === "pairs" && !behind ? pairsOf(h.state, q).map((p) => ({ key: p.key, faces: [castFace(view, p.ids[0]), castFace(view, p.ids[1])] })) : null,
      each: q.each ?? null,
      confidence: q.confidence === true,
      games: q.each === "game" ? gamesView(r.facts, q, ep, r.now.getTime()) : null,
      episode: each ? ep : null,
      status: closed ? "closed" : behind ? "behind" : lineComing ? "waiting" : "open",
      catchUp: behind && !catching ? seen : null,
      closesAt: (q.each === "game" ? lastStartOf(facts, ep) : null) ?? airAt,
      // A pairs question's faces are its pairs'.
      faces: namesSomeone(q) && q.answer !== "pairs" && !behind ? facesFor(view, q, me, facts.formatGroups?.get(ep)) : null,
      draw: q.answer === "bracket" && !behind ? await drawView(view, h.state, q, ep || (StateLogic.startEpisode(h.state) ?? 1), facts) : null,
      offWhy: !behind ? (triviaOff ?? offWhy(q, facts.formatGroups?.get(ep))) : null,
      trivia: round,
      mine,
      answered: new Set(theirs.map((a) => a.playerId)).size,
      verdict: null,
      people: [],
      bot: made && Spec.isBeat(q) ? { called: made.has(Spec.botKey(q, ep)), answer: null, right: null } : null,
    };
    if (closed) {
      // Locked: everyone's answers, and how each stands as far as you've seen (the view is cut at your mark).
      view1.verdict = v;
      const list = theirs.map((a) => ({ playerId: a.playerId, answer: a.answer }));
      // What each earned there, A9's ways of combining in (a split pot, a rollover's jackpot, a parlay, a shrinking call).
      const earned = graded.earned.get(`${q.id}|${ep}`) ?? new Map<string, number>();
      view1.people = theirs
        .map((a) => ({
          playerId: a.playerId,
          userId: h.userOf(a.playerId),
          name: names.get(a.playerId) ?? "Someone",
          you: a.playerId === me,
          answer: a.answer,
          right: Spec.isRight(q, v as Verdict, { playerId: a.playerId, answer: a.answer }, list, facts),
          earned: earned.get(a.playerId) ?? 0,
        }))
        .sort((x, y) => Number(y.you) - Number(x.you) || y.earned - x.earned || x.name.localeCompare(y.name));
      // A14 part 2: the bot's call, once it's closed for you (the grade's facts carry it from the game's lock: botCallsFor).
      const call = Spec.isBeat(q) ? Spec.botCall(q, ep, facts) : undefined;
      if (view1.bot && call !== undefined) view1.bot = { called: true, answer: call, right: Spec.botRight(q, v as Verdict, call, list, facts) };
    }
    out.push(view1);
  }
  const cast = view.castaways.map((c) => ({ id: c.id, name: c.name, photo: publicMediaSrc(c.photoUrl) }));
  // Only the groups your copy has anyone on (where they started, or a swap you've seen): a tribe a later swap or the merge made is
  // in the league's list from the moment it's recorded, and its name would say it happened.
  const onAny = new Set(
    [...view.castaways.flatMap((c) => [c.tribeId, c.startTribeId]), ...view.episodes.flatMap((e) => (e.groups ?? []).map((g) => g.tribeId))].filter((t): t is string => !!t)
  );
  const groups = (view.tribes ?? []).filter((t) => onAny.has(t.id)).map((t) => ({ id: t.id, name: t.name, photo: null }));
  // ...and on a season played in pairs (F3 part 2), every pair offered at a lock you've reached: going into the episode after the
  // last one you've seen, at most.
  const seenUpTo = (h.mark ?? Number.POSITIVE_INFINITY) + 1;
  for (const [n, fg] of facts.formatGroups ?? []) {
    if (n > seenUpTo) continue;
    for (const g of fg.offered) if (!groups.some((x) => x.id === g.id)) groups.push({ id: g.id, name: g.name, photo: null });
  }
  return {
    leagueId: h.game.leagueId,
    episode,
    questions: out,
    points,
    cast,
    groups,
    mark: h.mark,
    out: StateLogic.KnockoutLogic.outOf(view, me),
    // Step C2 part 4c: a draft's own questions, where its knockouts or head to head ended it.
    ended: r.walk || r.lines ? endedAt(view) : null,
    coop: r.walk?.coop ?? null,
  };
}

/** Answer, change or take back your answers before each question locks. */
export async function answerQuestions(user: SessionUser, seasonId: string, leagueId: unknown, body: { episode?: unknown; answers?: unknown }, now = new Date()): Promise<GameQuestions> {
  const r = await readOf(user, seasonId, leagueId, now);
  const { h, view } = r;
  const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
  if (!isMap(body.answers)) throw new HttpError(400, "answers must be { question: answer }");
  if (StateLogic.GhostLogic.isCatchingUp(h.state, h.playerId)) throw new HttpError(409, "Catch up first: questions open once you're on the live episode");
  // Step A11 part 2b: someone out answers nothing after their last episode in, and nobody answers past where the game ended early
  // (a race won, one left), nor about the whole game then, as the league stands (h.state carries its walk over every answer:
  // season-games.ts gamesHere). An episode up to it can still be answered while it's open for you (a late lock): your answer
  // there is what decides it.
  // Step A11 part 4b: head to head's end is its final's episode, known from the start (`ends`); it has ended once that's played,
  // or the season ended before it (`ended`).
  const ends = StateLogic.KnockoutLogic.endsAt(h.state);
  const ended = endedAt(h.state);
  const limit = ended ?? ends;
  const endWords = ended !== null ? `This game ended with Episode ${ended}` : `This game ends with Episode ${ends}`;
  const outAt = StateLogic.KnockoutLogic.outOf(h.state, h.playerId);
  const qs = questionsOf(h.state);
  const thisWeek = weekOf(r);
  const mark = h.mark ?? Number.POSITIVE_INFINITY;
  // How many of the game's episodes have started (A9: when an answer is made, for a call whose points shrink).
  const late = startedNow(r);
  // Your points as they stand for you and your stakes on the line, for a wager of any of them (A9), read once when one is staked;
  // `staking`, the stakes this answer sends.
  let room: { points: number; held: Map<string, number> } | null = null;
  const staking = new Map<string, number>();
  // Step C6: beside a bank every stake is drawn from it; a stake this answer takes back frees what it held, wherever it comes in it.
  const bank = bankOf(h.state);
  for (const [key, value] of Object.entries(body.answers)) {
    const q = qs.find((x) => x.id === key);
    if (value === null && q && Spec.drawsOnBank(q, bank)) {
      const at = q.asked === "once" ? 0 : windowFor(r, q, thisWeek);
      if (at !== null) staking.set(`${q.id}|${at}`, 0);
    }
  }
  const writes: { q: Question; ep: number; value: unknown }[] = [];
  // Step C6 part 2: whether a ticket of yours at a window puts question `id` on it (this answer's ticket, else the one stored).
  const ticketOn = (id: string, ep: number) =>
    qs.some((t) => {
      if (!Spec.isTicket(t)) return false;
      const said = body.answers as Record<string, unknown>;
      const given = Object.prototype.hasOwnProperty.call(said, t.id)
        ? said[t.id]
        : r.rows.find((a) => a.playerId === h.playerId && a.question === t.id && a.episode === ep)?.answer;
      const legs = (given as { legs?: unknown } | null | undefined)?.legs;
      return Array.isArray(legs) && legs.includes(id);
    });
  for (const [key, said] of Object.entries(body.answers)) {
    let value = said;
    const q = qs.find((x) => x.id === key);
    if (!q) throw new HttpError(400, `"${key}" isn't one of this game's questions`);
    let ep = 0;
    if (q.asked !== "once") {
      // Its window this week (A7): an episode named is this week's, or the one its window opens at.
      const at = windowFor(r, q, thisWeek);
      const asked = body.episode === undefined || body.episode === null ? thisWeek : Number(body.episode);
      // Step A11 part 2b: the episode it's for, as said (none this week: the game ended, as far as you've seen).
      const named = asked ?? at;
      if (limit !== null && (named === null ? ended !== null : named > limit)) throw new HttpError(409, endWords);
      if (outAt !== null && (named === null || named > outAt)) throw new HttpError(409, "You’re out of this game");
      if (thisWeek === null || at === null || (asked !== thisWeek && asked !== at)) throw new HttpError(409, thisWeek === null || at === null ? "There's nothing to answer for yet" : `Answers are open for Episode ${thisWeek}`);
      ep = at;
    }
    if (limit !== null && ((q.asked === "once" && ended !== null) || ep > limit)) throw new HttpError(409, endWords);
    if (outAt !== null && (q.asked === "once" || ep > outAt)) throw new HttpError(409, "You’re out of this game");
    if (isClosed(r, q, ep)) {
      const { at } = closing(r, q, ep);
      throw new HttpError(409, at === null ? `"${q.ask}" is closed` : `"${q.ask}" closed when Episode ${at} started`);
    }
    // L3 part 3b: an over/under on the game's own line, its line kept as it opens; none out yet, nothing to answer.
    await openLines(r, q, ep);
    if (q.line === Spec.LINE_GAME && q.each !== "game" && value !== null && keptLine(r.facts, q, ep, "") === null) throw new HttpError(409, "The line isn't out yet: you can answer once it is");
    // L3 part 2f part 2: a question about each game, each started game's pick kept as it was.
    if (q.each === "game") value = keepStarted(r, q, ep, value);
    if (value !== null) {
      // Step C7 part 2: a line of a card the bot chooses waits for its card (its moment isn't known till then).
      if (Spec.cardWaiting(q, ep, r.facts.cardChoices?.get(ep))) throw new HttpError(409, CARD_NOT_OUT);
      const seen = needsSeen(r, q, ep);
      if (seen !== null && mark < seen) throw new HttpError(403, Spec.isTrivia(q) ? `See Episode ${seen} first: the round is about it` : `See Episode ${seen} first: it says who's still in`);
      // Who it can name (still in, your team, a group); for a pairs question, each pair's "index:id" (A8); a trivia round (A13), each
      // of its questions' "id:option".
      const faces =
        q.each === "game"
          ? gameFaces(r.facts, ep)
          : q.answer === "pairs"
          ? new Set(pairsOf(h.state, q).flatMap((p) => p.ids.map((id) => `${p.key}:${id}`)))
          : Spec.isTrivia(q)
            ? new Set(roundKey(r, ep).flatMap((t) => t.options.map((o) => `${t.id}:${o}`)))
            : namesSomeone(q)
              ? new Set(facesFor(view, q, h.playerId, r.facts.formatGroups?.get(ep)).map((f) => f.id))
              : q.answer === "side"
                ? // L3 part 1: a side is one of its game's teams (a question asked once: the game's first).
                  await sidesFor(h.state, ep || (StateLogic.startEpisode(h.state) ?? 1), r.facts.games)
                : q.answer === "bracket"
                  ? // L3 part 2e: a bracket, its draw as listed now (who's in it, its matches so far).
                    await drawNow(h.state, ep || (StateLogic.startEpisode(h.state) ?? 1), (q.settle as { of?: string }).of ?? "", { games: r.facts.games, playoffs: r.facts.playoffs ?? null })
                  : null;
      let most: number | undefined;
      if (Spec.drawsOnBank(q, bank)) {
        room ??= await stakeRoom(r);
        most = stakeMost(room.points, room.held, `${q.id}|${ep}`, staking);
      }
      const problem = Spec.answerProblem(q, value, faces, most === undefined ? undefined : { most });
      if (problem) throw new HttpError(400, problem);
      // Step C6 part 2: a ticket's legs are your own answers there (stored, or given with it), never one taken back with it.
      if (Spec.isTicket(q)) {
        const mine = new Set(r.rows.filter((a) => a.playerId === h.playerId && a.episode === ep).map((a) => a.question));
        for (const [k, v] of Object.entries(body.answers)) {
          if (v === null) mine.delete(k);
          else mine.add(k);
        }
        const blank = (value as { legs: string[] }).legs.filter((id) => !mine.has(id));
        if (blank.length) throw new HttpError(400, `Answer ${blank.map((id) => `"${qs.find((x) => x.id === id)?.ask ?? id}"`).join(" and ")} first: a ticket's legs are your own answers`);
      }
      // A13: a trivia question you've played in the trivia sheet, where you saw its answer: yours here can't be given or changed after
      // it, and what you'd said before stands (kept when this answer leaves it out).
      if (Spec.isTrivia(q)) {
        const given = value as Record<string, string>;
        const before = triviaBefore(r, q, ep);
        const sheet = await playedOf(r, user.id, ep, [...new Set([...Object.keys(given), ...Object.keys(before)])]);
        if (Object.keys(given).some((id) => sheet.has(id) && before[id] !== given[id])) throw new HttpError(409, "You've played that one in trivia, where you saw its answer: it can't be answered here now");
        const inRound = new Set(roundKey(r, ep).map((t) => t.id));
        for (const id of sheet) if (id in before && !(id in given) && inRound.has(id)) given[id] = before[id] as string;
      }
      if (Spec.drawsOnBank(q, bank)) staking.set(`${q.id}|${ep}`, (value as { stake: number }).stake);
    } else if (ticketOn(q.id, ep)) {
      // Step C6 part 2: a leg a ticket of yours stands on (stored, or given with this answer) isn't taken back while it does.
      throw new HttpError(409, `Your ticket stands on "${q.ask}": take it off your ticket first`);
    } else if (Spec.isTrivia(q)) {
      // A13: nor taken back once one of its questions has been played in the trivia sheet.
      const before = triviaBefore(r, q, ep);
      if ((await playedOf(r, user.id, ep, Object.keys(before))).size) throw new HttpError(409, "You've played some of it in trivia, where you saw the answers: it can't be taken back now");
    } else if (q.shrink && late > 0) {
      // Taken back and given again would start it over: once the game's on, a shrinking call is changed, never taken back.
      throw new HttpError(409, `"${q.ask}" can be changed but not taken back once the game is on`);
    }
    const one = Spec.NAMES.includes(q.answer) && !q.each && Array.isArray(value) && (q.pick ?? 1) === 1;
    writes.push({ q, ep, value: one ? (value as unknown[])[0] : value });
  }
  const stateWrites = writes.filter((w) => inState(h.state, w.q));
  if (stateWrites.length) {
    await withLeagueLock(h.game.leagueId, (s) => {
      for (const w of stateWrites) {
        // The lock again, under the league's own lock (the stamped state).
        if (StateLogic.AnswerLogic.closed(s, w.q, 0, { now: now.getTime(), finale: r.finale?.number ?? null, airAt: r.finale?.airAt ?? null })) throw new HttpError(409, `"${w.q.ask}" is closed`);
        if (w.q.id === "winner") StateLogic.setFinaleWinnerPick(s, h.playerId, (w.value as string | null) ?? null);
        else {
          const list = Array.isArray(w.value) ? (w.value as string[]) : w.value ? [w.value as string] : [];
          for (let i = 0; i < 3; i++) StateLogic.setFinalePick(s, h.playerId, i, null);
          list.forEach((id, i) => StateLogic.setFinalePick(s, h.playerId, i, id));
        }
      }
    });
  }
  // A game of questions' answers, all or none, the lock checked again at the moment they're written.
  const rows = writes.filter((x) => !inState(h.state, x.q));
  if (rows.length) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const w of rows) {
        if (w.value === null) {
          await client.query("DELETE FROM game_answers WHERE league_id = $1 AND player_id = $2 AND question = $3 AND episode = $4", [h.game.leagueId, h.playerId, w.q.id, w.ep]);
          continue;
        }
        // When it was made (A9): a first answer once the game's on counts as a change (sealing it early is the point), and so does
        // each change after, which makes it as late as now; the same answer again doesn't.
        await client.query(
          `INSERT INTO game_answers (league_id, player_id, question, episode, answer, answered_by, late, changes) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, CASE WHEN $7 > 0 THEN 1 ELSE 0 END)
           ON CONFLICT (league_id, player_id, question, episode) DO UPDATE SET
             changes = game_answers.changes + CASE WHEN game_answers.answer IS DISTINCT FROM EXCLUDED.answer AND EXCLUDED.late > 0 THEN 1 ELSE 0 END,
             late = CASE WHEN game_answers.answer IS DISTINCT FROM EXCLUDED.answer THEN EXCLUDED.late ELSE game_answers.late END,
             answer = EXCLUDED.answer, answered_by = EXCLUDED.answered_by, updated_at = now()`,
          [h.game.leagueId, h.playerId, w.q.id, w.ep, JSON.stringify(w.value), user.id, late]
        );
      }
      const shut = rows.find((w) => isClosed({ ...r, now: new Date() }, w.q, w.ep));
      if (shut) throw new HttpError(409, `"${shut.q.ask}" closed as it was answered`);
      // L3 part 2f part 2: and each game's pick of a question about each game, at its own game's start.
      for (const w of rows) if (w.q.each === "game") keepStarted({ ...r, now: new Date() }, w.q, w.ep, w.value);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  }
  // Read again with what was written: the state's, or the answers (an answer to an open question settles nothing, so the walk the
  // league carries still holds).
  return readQuestions(stateWrites.length ? await readOf(user, seasonId, leagueId, now) : rows.length ? await readFrom({ ...h, answers: undefined }, seasonId, now, undefined, user.id) : r);
}

/**
 * What the data-can-settle rule checks a game's own questions against (game-spec specProblems' ctx, for RosterLogic.setGame):
 * the moments of the rules the game plays by (its couch's own copy, else the season's), by the ids its results record (a
 * built-in's aliases), and who answers each; whether the results say who goes home (a series' and a talk show's don't),
 * whether anyone wins, who settles the show's calls, and its phases.
 */
export async function questionContext(leagueId: string, seasonId: string): Promise<SpecContext> {
  // A13: and whether the season's research writes the trivia a trivia question is settled by; part 2, what research has returned
  // of each episode fact on the show.
  const [book, trivia, facts] = await Promise.all([leagueBook(leagueId, seasonId), triviaWritten(seasonId), factContextForSeason(seasonId)]);
  return { ...contextOf(book), trivia, facts };
}

/** The rules a game plays by: the couch's own copy (Make it ours), else the season's rulebook, else its show's format read back
 *  as blocks (with a built-in's aliases): calls.ts seasonBook. */
export async function leagueBook(leagueId: string, seasonId: string): Promise<CallBook> {
  const { rows } = await pool.query("SELECT r.blocks, r.aliases FROM rulebooks r JOIN leagues l ON l.rulebook_id = r.id WHERE l.id = $1 AND r.status <> 'archived'", [leagueId]);
  return rows[0]?.blocks ? { blocks: rows[0].blocks as RulebookBlocks, aliases: rows[0].aliases } : seasonBook(seasonId);
}

/** The rules a game will play by for its questions: a couch's own copy (Make it ours, ours.ts copyOf, already read), else the
 *  season's (as leagueBook says for a game that exists). */
export async function questionBook(seasonId: string, copy: { blocks?: unknown; aliases?: unknown } | null): Promise<CallBook> {
  return copy?.blocks ? { blocks: copy.blocks as RulebookBlocks, aliases: copy.aliases as CallBook["aliases"] } : seasonBook(seasonId);
}

/** questionContext's ctx from the rules themselves (question-choices.ts, pure). */
export { contextOf };

// ---------- what's due, for the screens (step A4 part 2) ----------

/**
 * A game's sheet as its move: this week's questions you can answer now (open, not behind), how many of them you have, the
 * earliest one's lock, and whether it's a draft's finale predictions. Null when it asks nothing of you now (nothing open, or a
 * game that has no questions). For the Games read (GameView.sheet: Tonight's cards, the dock) and the home's moves.
 */
export async function sheetOf(user: SessionUser, seasonId: string, h: GameHere, now = new Date(), rows?: AnswerRow[]): Promise<SheetMove | null> {
  const qs = questionsOf(h.state);
  if (!qs.length) return null;
  const g = await readQuestions(await readFrom(h, seasonId, now, rows, user.id));
  // Step C2 part 4c: a draft with its own questions has a sheet of them (its finale predictions an extra beside it, never a move).
  return StateLogic.piecesOf(h.state).hasDraftQuestions ? summaryOf(g, false, finaleIds(h.state)) : summaryOf(g, !!StateLogic.finaleOfGame(h.state));
}

/** A draft's finale predictions' ids while they're on (step C2 part 4c: what a draft's sheet of its own questions doesn't count). */
const finaleIds = (state: LeagueState): Set<string> => new Set(StateLogic.finaleOfGame(state) ? ["top3", "winner"] : []);

/** A read's questions as a move: none once you're out (step A11 part 2b: you answer nothing more). `skip`: the questions it doesn't
 *  count (step C2 part 4c: a draft's finale predictions beside its own questions). */
function summaryOf(g: GameQuestions, finale: boolean, skip: Set<string> = new Set()): SheetMove | null {
  if (g.out !== null) return null;
  const questions = g.questions.filter((q) => !skip.has(q.id));
  // A13: a trivia round with nothing you can answer yet (no questions, or every one played in the trivia sheet) asks nothing of you.
  const open = questions.filter((q) => q.status === "open" && !(q.trivia && !q.trivia.some((t) => !t.played)));
  const behind = questions.find((q) => q.status === "behind")?.catchUp ?? null;
  if (!open.length && behind === null) return null;
  const locks = open.map((q) => (q.closesAt ? Date.parse(q.closesAt) : Infinity));
  const first = Math.min(...locks);
  return {
    episode: g.episode,
    of: open.length,
    answered: open.filter((q) => answered(q.mine)).length,
    closesAt: Number.isFinite(first) ? new Date(first).toISOString() : null,
    behind,
    finale,
  };
}

/** Whether an answer is in (an empty list is none). */
const answered = (v: unknown) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0);

/**
 * A game of questions' move on the home (/api/me/home), beside actionItems' (whose league states don't hold the answers): this
 * week's sheet while some of it you could answer now is still blank. A draft's finale predictions are an extra, never a move; its own
 * questions (step C2 part 4c) are a sheet, as a game of questions' are.
 * Step R1 part 2: a game of questions by its pieces (`states`: each game's, as the home read them), never by its stored type.
 */
export async function questionMoves(
  user: SessionUser,
  games: { leagueId: string; name: string; seasonId: string | null; archived?: boolean }[],
  states: Map<string, LeagueState>,
  now = new Date()
): Promise<{ kind: "questions"; text: string; href: string; leagueId: string; leagueName: string; episode?: number; deadline: string | null; who: "you" }[]> {
  const sheets = games.filter((g) => {
    const state = states.get(g.leagueId);
    return !!state && keepsAnswers(state) && !!g.seasonId && !g.archived;
  });
  // Each read at once: a Prediction Sheet is rare, and these are the home's only per-game reads of answers.
  const reads = await Promise.all(
    sheets.map((g) =>
      gameQuestions(user, g.seasonId!, g.leagueId, undefined, now)
        .then((q) => summaryOf(q, false, finaleIds(states.get(g.leagueId) as LeagueState)))
        .catch((e) => {
          console.error(`[answers] home move ${g.leagueId}:`, e);
          return null;
        })
    )
  );
  const out = [];
  for (const [i, g] of sheets.entries()) {
    const m = reads[i];
    if (!m || m.answered >= m.of) continue;
    out.push({
      kind: "questions" as const,
      text: m.answered ? `Finish your sheet (${m.of - m.answered} to go)` : `Fill in your sheet (${m.of} ${m.of === 1 ? "question" : "questions"})`,
      href: `/show/${g.seasonId}/tonight`,
      leagueId: g.leagueId,
      leagueName: g.name,
      ...(m.episode !== null ? { episode: m.episode } : {}),
      deadline: m.closesAt,
      who: "you" as const,
    });
  }
  return out;
}
