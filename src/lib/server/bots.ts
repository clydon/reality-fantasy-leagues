import type { Pool, PoolClient } from "pg";
import type { LeagueState } from "@/lib/game/types";
import Bots, { type FactContext, type StakeRoom } from "@/lib/game/bot-logic.js";
import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { AnswerRow } from "./answer-points";
import { lockAuctionBids } from "./auction";
import { lockBlindPicks } from "./blind-draft";
import { openEpisode, readHostCards, writeHostCard } from "./host-cards";

// Computer players' moves (src/lib/game/bot-logic.js), made inside the caller's league lock so they
// land in the same write as whatever prompted them: a person's draft pick is followed straight away by
// any bot picks after it, results landing are followed by the bots' new lineups, and so on.
//
// Blind-draft lock-ins go first and through lockBlindPicks, the same as a person's -- submissions live
// in blind_draft_picks, never in `state`, and a bot's lock can be the one that completes the set and
// reveals. Everything else is a pure change to `state`.
export async function runBots(client: PoolClient, leagueId: string, state: LeagueState): Promise<void> {
  for (const s of Bots.blindSubmissions(state)) {
    await lockBlindPicks(client, leagueId, state, s.playerId, s.castawayIds);
  }
  // An auction's sealed bids (step A10 part 3b), the same way: kept out of `state`, and the last sheet in settles it.
  for (const s of Bots.auctionBids(state)) {
    await lockAuctionBids(client, leagueId, state, s.playerId, s.bids);
  }
  Bots.run(state);
  await hostForBots(client, leagueId, state);
  await answerForBots(client, leagueId, state);
}

/** The seat whose turn it is to host the card being written now, when that's a computer player that hasn't written it (E1b's
 *  leftovers), with the episode; else null. `rows`: the league's host_cards. */
function botHostTurn(state: LeagueState, rows: Awaited<ReturnType<typeof readHostCards>>, now = Date.now()): { host: string; n: number } | null {
  const H = StateLogic.HostLogic;
  if (!H.of(state) || StateLogic.RevealLogic.isCatchingUp(state)) return null;
  const n = openEpisode(state, rows, now);
  if (n === null || rows.get(n)) return null;
  const host = H.hostAt(state, n);
  // Only one with lines to write (a card's list empty: nothing it could write, so nothing waits on it).
  return host && Bots.botIds(state).includes(host) && Bots.hostLines(state, host, n).length ? { host, n } : null;
}
/** A computer player whose turn it is to host writes its card's lines as a person does (host-cards.ts writeHostCard), once its turn
 *  is open: in the write that opens it, or the read that wakes it (botsDue). A game with no host costs no query. */
async function hostForBots(client: PoolClient, leagueId: string, state: LeagueState): Promise<void> {
  if (!StateLogic.HostLogic.of(state)) return;
  const rows = await readHostCards(client, leagueId);
  const turn = botHostTurn(state, rows);
  if (!turn) return;
  const w = await writeHostCard(client, leagueId, state, turn.host, Bots.hostLines(state, turn.host, turn.n), rows);
  // Didn't land (its time closed by the database's clock, or refused): said, and the turn files as a host's that wrote nothing does.
  if (!("episode" in w)) console.error(`[bots] a computer player couldn't write Episode ${turn.n}'s card in ${leagueId}: ${w.error}`);
}

/**
 * Whether computer players have something waiting that no write has prompted (league-read.ts readyLeague takes the league's lock
 * for it, as it does for a bot's waiting pick): a turn to host whose card is open and unwritten, or answers due now (a window the
 * clock opened, a card that came out). Read with the caller's `db`; one read for a host game, one for a game of questions, none
 * for any other or with no computer player playing live.
 */
export async function botsDue(db: Pool | PoolClient, leagueId: string, state: LeagueState, now = Date.now()): Promise<boolean> {
  const bots = Bots.botIds(state);
  if (!bots.length) return false;
  if (StateLogic.HostLogic.of(state) && botHostTurn(state, await readHostCards(db, leagueId), now)) return true;
  if (!Bots.answeredQuestions(state).length) return false;
  const { rows } = await db.query("SELECT player_id, question, episode FROM game_answers WHERE league_id = $1", [leagueId]);
  const stored = rows.map((r) => ({ playerId: r.player_id as string, question: r.question as string, episode: r.episode as number }));
  // A staked one counted as if its room were wide open: whether it's due, not what it stakes (the write reads the real room).
  const wide = new Map(bots.map((pid) => [`${pid}|live`, { points: Number.MAX_SAFE_INTEGER, held: new Map<string, number>() }]));
  if (Bots.answers(state, stored, { now, rooms: wide }).length > 0) return true;
  // The server's facts read only while a question from them is still to answer, open (the review: never on every read).
  if (!Bots.factsDue(state, stored, null, null, now)) return false;
  return Bots.answers(state, stored, { now, rooms: wide, ctx: await contextFor(leagueId, state, undefined, null, null, null, now) }).length > 0;
}

type Answered = { playerId: string; question: string; episode: number };
// The answers' reads (answer-points.ts), loaded only for a game where computer players answer questions: every league write runs
// runBots, and that module brings the grading's whole server side with it.
const points = () => import("./answer-points");
const storedAnswers = async (leagueId: string, client: Client) => (await points()).storedAnswers(leagueId, client);
type Client = PoolClient | { query: PoolClient["query"] };
async function writeAnswers(client: Client, leagueId: string, due: (Answered & { answer: unknown })[]): Promise<void> {
  for (const a of due) {
    await client.query(
      `INSERT INTO game_answers (league_id, player_id, question, episode, answer, answered_by, late, changes) VALUES ($1, $2, $3, $4, $5::jsonb, NULL, 0, 0)
       ON CONFLICT (league_id, player_id, question, episode) DO NOTHING`,
      [leagueId, a.playerId, a.question, a.episode, JSON.stringify(a.answer)]
    );
  }
}
/** What the server's facts say for computer players' questions about each game, trivia, a side or a bracket (E1b's leftovers): the
 *  facts as a seat at `mark` sees them (null: live; answer-points.ts walked), and each such question's faces at its window there
 *  (`week`: a catching-up seat's; null: this week's), as answers.ts checks a person's (factFaces). None for a game without one. */
async function contextFor(leagueId: string, state: LeagueState, rows: AnswerRow[] | undefined, playerId: string | null, mark: number | null, week: number | null, now = Date.now()): Promise<FactContext | undefined> {
  if (!Bots.needsFacts(state)) return undefined;
  const { factFaces, fromFacts, openLinesFor } = await import("./answers");
  const w = await (await points()).walked({ leagueId, state, playerId, mark, rows });
  const AL = StateLogic.AnswerLogic;
  const faces = new Map<string, unknown>();
  for (const q of Bots.answeredQuestions(state)) {
    const ep = q.asked === "once" ? 0 : (week ?? AL.windowAt(state, q, AL.episodeNow(state)));
    if (ep === null || ep === undefined) continue;
    // E1e: a game's line kept as it opens, as a person's read keeps it (answers.ts openLines).
    if (q.line === Spec.LINE_GAME) await openLinesFor(leagueId, w.facts, q, ep, now);
    if (!fromFacts(q)) continue;
    const f = await factFaces(state, q, ep, w.facts);
    if (f) faces.set(`${q.id}|${ep}`, f);
  }
  return { facts: w.facts, faces, now };
}
/** Each live computer player's room to stake (E1b's second slice), read as a person's is (answer-points.ts seatStakeRoom), for one
 *  with a question staked from its points or a bank still to answer this week ("seat|live"); none otherwise. */
async function liveRooms(leagueId: string, state: LeagueState, rows: AnswerRow[]): Promise<Map<string, StakeRoom> | undefined> {
  if (!Bots.stakesPoints(state)) return undefined;
  const rooms = new Map<string, StakeRoom>();
  for (const pid of Bots.botIds(state)) if (Bots.needsRoom(state, rows, pid, null)) rooms.set(`${pid}|live`, await (await points()).seatStakeRoom(leagueId, state, pid, null, rows));
  return rooms;
}
/** Computer players catching up at their own pace answer each week, one seat-week at a time, through the week after `n` (null: its own
 *  mark): each week's room (where it has a staked question there) read after the weeks before it are written, so a jump of several
 *  weeks stakes as their bets settled. Written on the caller's transaction; `rows` (the game's answers) grows with them. */
async function catchUpWrite(client: Client, leagueId: string, state: LeagueState, rows: AnswerRow[], n: number | null): Promise<number> {
  const stakes = Bots.stakesPoints(state);
  let made = 0;
  for (const only of Bots.catchUpWeeks(state, n)) {
    const room = stakes && Bots.needsRoom(state, rows, only.playerId, only.week) ? await (await points()).seatStakeRoom(leagueId, state, only.playerId, only.week - 1, rows) : null;
    const ctx = Bots.factsDue(state, rows, only.playerId, only.week) ? await contextFor(leagueId, state, rows, only.playerId, only.week - 1, only.week) : undefined;
    const due = Bots.catchUpAnswers(state, rows, n, room ? new Map([[`${only.playerId}|${only.week - 1}`, room]]) : undefined, only, ctx);
    await writeAnswers(client, leagueId, due);
    rows.push(...due.map((d) => ({ ...d, late: 0, changes: 0 })));
    made += due.length;
  }
  return made;
}
// Catching up at its own pace (AnswerLogic.ownWeek): it answers by its own mark, as a person there does.
const catchingUp = (state: LeagueState) => state.players.some((p) => Bots.isBot(p) && StateLogic.AnswerLogic.ownWeek(state, p.id));

/**
 * At your own pace (E1b's second slice): computer players catch up to `n` with whoever revealed it first, answering each week's
 * questions on the way (and the week after's) from their own copies (bot-logic.js catchUpAnswers: that week's results unseen), then
 * playing its picks and lineups (catchUpTo). Inside the caller's league lock (reveal.ts, late-join.ts).
 */
export async function catchUpBots(client: PoolClient, leagueId: string, state: LeagueState, n: number): Promise<void> {
  if (Bots.answeredQuestions(state).length && catchingUp(state)) await catchUpWrite(client, leagueId, state, await storedAnswers(leagueId, client), n);
  Bots.catchUpTo(state, n);
}

/**
 * Computer players' answers to a game's own questions (docs/PLAN-start-a-game-redo.md E1b; bot-logic.js answers): written into
 * game_answers as a person's are, never over one already there, inside the caller's transaction. Each one playing live answers
 * each open window once; each one catching up at your own pace, its next week's, from its own copy (catchUpAnswers). Runs with
 * every league write: a window opening as results land, and the game's start (start-spec.ts writes once after a start with
 * computer players). A window that opens with no write to the league waits for the next one.
 */
export async function answerForBots(client: Client, leagueId: string, state: LeagueState, now = Date.now()): Promise<number> {
  if (!Bots.answeredQuestions(state).length) return 0;
  const live = Bots.botIds(state).length > 0;
  const behind = catchingUp(state);
  if (!live && !behind) return 0;
  const stored = await storedAnswers(leagueId, client);
  const ctx = live && Bots.factsDue(state, stored, null, null, now) ? await contextFor(leagueId, state, stored, null, null, null, now) : undefined;
  const due = live ? Bots.answers(state, stored, { now, rooms: await liveRooms(leagueId, state, stored), ctx }) : [];
  await writeAnswers(client, leagueId, due);
  stored.push(...due.map((d) => ({ ...d, late: 0, changes: 0 })));
  return due.length + (behind ? await catchUpWrite(client, leagueId, state, stored, null) : 0);
}
