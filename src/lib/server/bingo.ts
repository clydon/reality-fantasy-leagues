import StateLogic from "@/lib/game/state-logic.js";
import { countLines, dealCard, firstLineAt, fullLines, seedOf, truthOf, FREE_KEY, LINES, MIN_MOMENTS, SQUARES, type BankSquare, type BingoSquare, type CalledLine, type Likelihood, type LineCount, type Truth } from "@/lib/game/bingo";
import { settleSays, type CallBook, type EpisodeFacts } from "@/lib/game/calls";
import { PRESENT_MS } from "@/lib/game/watch-along";
import { kindOf } from "@/lib/game/formats/rulebook-schema.js";
import type { BingoMove, GameCalls } from "@/lib/game/game-view";
import type { LeagueState } from "@/lib/game/types";
import { isUuid, type SessionUser } from "./auth-helpers";
import { endedThrough, episodeFacts, openEpisode, OPEN, othersSharing, saysOn, scopeOf, seasonBook, settledSays, SHARED, type SayRow } from "./calls";
import { HttpError, pool } from "./db";
import { refuseTestPlayer } from "./test-players";
import { EVERYTHING, seenThrough } from "./guard";
import { latestAired, seasonSchedules, type SeasonSchedule } from "./schedule";
import { seasonHeaders, type SeasonHeader } from "./show-space";
import { notifyBingoCall, notifyBingoLines } from "./push-events";

// Bingo (docs/PLAN-new-design.md step 12 part 3; migration 0130 bingo_cards, bingo_marks; the pure rules are bingo.ts):
//   GET  /api/seasons/[id]/bingo/[n]?couch=   your card for an episode (the next to air, or one that's aired), what you've
//        ticked, how many on the couch are playing; once you've seen it, what's settled of each square, your lines and the
//        couch's cards (who got a line first)
//   GET  ...?couch=&of=<user>                  someone on the couch's card (step 3's "Look at their card"): once you've seen the
//        episode, or while you're watching it together with them; else only that there's one to see after you catch up
//   POST /api/seasons/[id]/bingo/[n]?couch=   { square, ticked } from the episode's airtime on: tick a square, or untick it;
//        { reroll: true } until your first tick: a new card, at most MAX_REROLLS times; { call: 0-7 } call BINGO on a line
//        you've ticked all of (docs/PLAN-bingo-bank.md step 3: only a called line counts, and the couch hears of it);
//        { said: { [square]: "yes" | "no" | null } } once you've seen it: whether a square in someone's called line happened;
//        { flag: square, on? } "This square's unfair" (step 4): out of your own card now unless you've ticked it, and out of
//        everyone's new cards once two people (or an admin) say so; on: false takes yours back
// plus Weekly Bingo's table (bingoLines, leagueBingo), the talk show's other season game.
//
// A card is a person's (one per episode, whichever couch they're on), dealt from the episode's bank (docs/PLAN-bingo-bank.md:
// bingo_squares, written before it airs; else the season's own bank; else no card) and kept from your first tick, so a new bank
// can't reshuffle it under you. Until then it's dealt afresh each read, from a seed that counts your rerolls, so the same card shows
// on every device. Its squares are things that might happen, written before the episode aired, never anything about it, so anyone
// may see their own card for any episode that's aired or is next. Ticks are private: nobody else's card, tick, line or count of
// ticks leaves the server until you've seen the episode (guard.ts seenThrough), and only from the couch's people who share the show
// (guard.ts visibleFollows), as calls are; watching it together (step 13 part 3), the people here in your together session are at
// the same moment as you, so what they tick from then on shows on your card as they do. A bank's square counts once the couch says
// it happened (calls.ts settleSays: two agreeing, alone your own word; a tick from someone who's seen the episode is their say). A
// card dealt before the banks keeps its show's moments, settled as they were: by the season's results (every result in), or on a
// talk show by the couch (so bingo settles a talk show's calls too). Read when a sheet or row opens; nothing polls (docs/HOSTING.md).
// On a card dealt from a bank, only a line you called counts (step 3): it counts once every square in it is settled as happened,
// waits while one isn't, and comes off once one settles as not; unticking a square takes its line's call back. Calling is the
// notice (push-events.ts notifyBingoCall): "riley called BINGO · Look at their card". Once you've seen the episode, the squares
// in the couch's called lines still waiting on a second say are yours to answer ("Did it?"): a say like a talk show's
// (episode_call_says), so it settles a square for every card that has it. A card from before the banks counts every ticked line,
// and a line that counts there is its notice (step 15 part 2, bingoLinesOn): its owner and the couch-mates playing that episode
// hear, once each, and only once they've seen it.

export interface BingoPerson {
  userId: string;
  name: string;
  /** Their lines that count (every square happened), those still waiting on a square, and those that came off. */
  lines: number;
  waiting: number;
  off: number;
  /** Lines they called (or on a card from before the banks, ticked). */
  called: number;
  ticked: number;
}

/** A square in someone's called line still waiting on a second say: whether it happened is yours to say (step 3's "Did it?"). */
export interface BingoDidIt {
  key: string;
  label: string;
  /** Whose called lines it's in. */
  by: string[];
  /** What you've said of it (a tick on your own card is a say too). */
  mine: "yes" | "no" | null;
}

/** Someone watching this episode together with you, and the moments they've ticked since it began (step 13 part 3). */
export interface BingoMate {
  userId: string;
  name: string;
  keys: string[];
}

export interface EpisodeBingo {
  seasonId: string;
  episode: number;
  airAt: string | null;
  /** ready: before it airs (ticks open at airtime); open: it's aired, tick as it happens; none: no bank to deal a card from yet. */
  status: "ready" | "open" | "none";
  squares: BingoSquare[];
  ticked: number[];
  /** The ticked squares in the order they were ticked (Undo takes back the last one in a line). */
  order: number[];
  /** New cards you can still deal yourself: none once you've ticked (the card's yours then) or used them all. */
  rerollsLeft: number;
  /** Lines count only once called (a card dealt from a bank); false: a card from before the banks, every ticked line counts. */
  calls: boolean;
  /** The lines called, still ticked, and when. */
  called: { line: number; at: string }[];
  /** Once you've seen it: the couch's called squares still waiting on a second say (yours to answer). */
  didIt: BingoDidIt[];
  /** Someone else's card (?of=): who. */
  of: { userId: string; name: string } | null;
  /** The squares on this card you've flagged as unfair (step 4). */
  flagged: string[];
  /** Once it's aired and you've seen it: what's settled of each square (a free one is "yes"); null before. */
  truth: Truth[] | null;
  lines: LineCount;
  /** What settles the squares: the season's results (a card dealt before the banks), or the couch saying. */
  by: "results" | "couch";
  /** The couch's cards with a tick on them, you first: only once you've seen it. */
  people: BingoPerson[];
  /** Who finished a line first (that still stands): once you've seen it. */
  first: { userId: string; name: string } | null;
  /** How many on the couch (alone on it: on Game Your Show) have ticked a square: a count, nobody named. */
  playing: number;
  /** It's aired and you haven't seen it: the episode to see before how it went and the couch's cards. */
  catchUp: number | null;
  scope: "couch" | "solo";
  alone: boolean;
  /** Watching it together: who's here in your together session with a tick since it began (they're where you are). */
  together: BingoMate[];
}

function episodeNumber(n: unknown): number {
  const e = Number(n);
  if (!Number.isInteger(e) || e < 1 || e > 1000) throw new HttpError(400, "Which episode?");
  return e;
}

interface Context {
  header: SeasonHeader;
  book: CallBook;
  talk: boolean;
  mark: number;
  airAt: string | null;
  aired: boolean;
  couch: string | null;
  alone: boolean;
}

async function context(user: SessionUser, seasonId: string, couchId: string | null, n: number, now: Date): Promise<Context> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const header = (await seasonHeaders([seasonId])).get(seasonId);
  if (!header) throw new HttpError(404, "Season not found");
  if (!header.ready) throw new HttpError(409, `${header.show.name} isn't a game yet: Make it a game first`);
  const [schedule, seen, book, couch] = await Promise.all([
    seasonSchedules([seasonId], now).then((m) => m.get(seasonId)),
    seenThrough(user.id, seasonId),
    seasonBook(seasonId),
    scopeOf(user, couchId),
  ]);
  const airAt = schedule?.episodes.find((e) => e.number === n)?.airAt ?? null;
  const aired = !!airAt && Date.parse(airAt) <= now.getTime();
  const open = openEpisode(schedule, now);
  if (!aired && (!open || open.number !== n)) throw new HttpError(409, open ? `Episode ${open.number}'s card is the next one` : `Episode ${n} has no air time yet`);
  const alone = !couch || (await othersSharing(couch, seasonId, user.id)) === 0;
  return { header, book, talk: kindOf(book.blocks) === "talk", mark: seen === EVERYTHING ? Number.POSITIVE_INFINITY : seen, airAt, aired, couch, alone };
}

/** New cards a person can deal themselves for an episode, before their first tick. */
export const MAX_REROLLS = 2;

/** A square of the season's bank, as a card keys it. */
const BANK = "b:";
const fromBank = (key: string) => key.startsWith(BANK);

/**
 * SQL: a bank's square (`sq`, its id) is out of new deals: flagged as unfair by two people, or by an admin (step 4). An admin's
 * Show it again (the desk's Bingo bank, 0425 shown_at) overrules the flags it had then: only two since take it out again.
 */
export const FLAGGED_OUT = (sq: string, shownAt: string = `(SELECT s_.shown_at FROM bingo_squares s_ WHERE s_.id = ${sq})`) =>
  `(EXISTS (SELECT 1 FROM bingo_square_flags f_ JOIN "user" u_ ON u_.id = f_.user_id WHERE f_.square_id = ${sq} AND u_.role = 'admin')
    OR (SELECT count(*) FROM bingo_square_flags f_ WHERE f_.square_id = ${sq} AND f_.flagged_at > COALESCE(${shownAt}, '-infinity')) >= 2)`;

/**
 * What an episode's cards are dealt from: its own bank's live squares, else the season's own bank's (no episode), else nothing
 * (no card); never a square flagged out (FLAGGED_OUT), nor (`viewer`) one they've flagged themselves. A bank too small for a
 * card (under four) is passed over.
 */
export async function bankFor(seasonId: string, n: number, viewer: string | null = null): Promise<{ from: "episode" | "season" | null; squares: BankSquare[] }> {
  const { rows } = await pool.query(
    `SELECT s.id, s.episode, s.label, s.likelihood FROM bingo_squares s
      WHERE s.season_id = $1 AND s.status = 'live' AND (s.episode = $2 OR s.episode IS NULL) AND NOT ${FLAGGED_OUT("s.id", "s.shown_at")}
        AND ($3::text IS NULL OR NOT EXISTS (SELECT 1 FROM bingo_square_flags f WHERE f.square_id = s.id AND f.user_id = $3))
      ORDER BY s.created_at, s.id`,
    [seasonId, n, viewer]
  );
  const of = (episode: number | null) =>
    rows.filter((r) => (r.episode ?? null) === episode).map((r) => ({ key: `${BANK}${r.id}`, label: r.label as string, likelihood: r.likelihood as Likelihood }));
  const own = of(n);
  if (own.length >= MIN_MOMENTS) return { from: "episode", squares: own };
  const season = of(null);
  return season.length >= MIN_MOMENTS ? { from: "season", squares: season } : { from: null, squares: [] };
}

interface Card {
  /** Its row: kept once ticked; before that, only when you've dealt yourself a new one. */
  id: string | null;
  squares: BingoSquare[];
  /** Ticked: yours as dealt, whatever the bank says now. */
  kept: boolean;
  rerolls: number;
  /** The lines called BINGO on (bingo_cards.called_lines). */
  called: CalledLine[];
}

/** bingo_cards.called_lines as CalledLine[]: [{ line, at }] with `at` an ISO time. */
const calledOf = (raw: unknown): CalledLine[] =>
  (Array.isArray(raw) ? raw : []).flatMap((c) => (c && Number.isInteger(c.line) ? [{ line: Number(c.line), at: Date.parse(c.at) || 0 }] : []));

/**
 * Your card for an episode: the one you've ticked (kept as it was dealt), else dealt now from the episode's bank by your rerolls'
 * seed (not kept yet). Null with no bank and nothing kept.
 */
async function cardOf(userId: string, seasonId: string, n: number): Promise<Card | null> {
  const { rows } = await pool.query(
    `SELECT c.id, c.squares, c.rerolls, c.called_lines, EXISTS (SELECT 1 FROM bingo_marks m WHERE m.card_id = c.id) AS kept
       FROM bingo_cards c WHERE c.user_id = $1 AND c.season_id = $2 AND c.episode = $3`,
    [userId, seasonId, n]
  );
  const row = rows[0];
  const rerolls = row ? Number(row.rerolls) : 0;
  if (row?.kept) return { id: row.id as string, squares: row.squares as BingoSquare[], kept: true, rerolls, called: calledOf(row.called_lines) };
  const squares = dealCard((await bankFor(seasonId, n, userId)).squares, seedOf(userId, seasonId, n, rerolls));
  return squares ? { id: (row?.id as string | undefined) ?? null, squares, kept: false, rerolls, called: [] } : null;
}

/**
 * What's settled of each square on an episode, for a viewer: a bank's square by what the couch says (and so is every square on a
 * talk show), a show's moment on a card from before the banks by the season's results (every result in).
 */
async function settledOf(ctx: Context, userId: string, seasonId: string, n: number): Promise<{ truth: (key: string) => Truth; mine: (key: string) => "yes" | "no" | null }> {
  const settled = settledSays(await saysOn(seasonId, [n], { viewer: userId, couch: ctx.couch }), n, userId, ctx.alone);
  const facts = ctx.talk ? null : ((await episodeFacts(seasonId, ctx.book, n)).get(n) ?? null);
  return {
    truth: (key) => (ctx.talk || fromBank(key) ? (settled.get(key)?.settled ?? null) : facts?.events ? (facts.events.has(key.slice(2)) ? "yes" : "no") : null),
    mine: (key) => settled.get(key)?.mine ?? null,
  };
}

/** Whether a card counts only its called lines: one dealt from a bank. */
const callsOn = (squares: BingoSquare[]) => squares.some((s) => fromBank(s.key));

/**
 * The squares in these cards' called lines (their owners', not the viewer's) still waiting on a second say, each once with whose
 * lines it's in and what the viewer has said of it.
 */
function didItOf(cards: { userId: string; name: string; squares: BingoSquare[]; marks: Set<number>; called: CalledLine[] }[], viewer: string, truth: (key: string) => Truth, mine: (key: string) => "yes" | "no" | null): BingoDidIt[] {
  const out = new Map<string, BingoDidIt>();
  for (const c of cards) {
    if (c.userId === viewer || !callsOn(c.squares)) continue;
    const full = fullLines(c.squares, c.marks);
    for (const call of c.called) {
      if (!full.includes(call.line)) continue;
      for (const i of LINES[call.line]) {
        const s = c.squares[i];
        if (!s || s.key === FREE_KEY || truth(s.key) !== null) continue;
        const item = out.get(s.key) ?? { key: s.key, label: s.label, by: [], mine: mine(s.key) };
        if (!item.by.includes(c.name)) item.by.push(c.name);
        out.set(s.key, item);
      }
    }
  }
  return [...out.values()];
}

/** One episode's card, as this viewer may see it: theirs, or with `of`, someone else's on the couch. */
export async function episodeBingo(user: SessionUser, seasonId: string, couchId: string | null, nIn: unknown, now = new Date(), of: string | null = null): Promise<EpisodeBingo> {
  const n = episodeNumber(nIn);
  const ctx = await context(user, seasonId, couchId, n, now);
  return of && of !== user.id ? theirBingo(user, seasonId, n, ctx, of) : readBingo(user, seasonId, n, ctx);
}

/** The bank squares on a card that this person has flagged as unfair. */
async function flaggedOn(userId: string, squares: BingoSquare[]): Promise<string[]> {
  const ids = squares.filter((s) => fromBank(s.key)).map((s) => s.key.slice(BANK.length));
  if (!ids.length) return [];
  const { rows } = await pool.query("SELECT square_id FROM bingo_square_flags WHERE user_id = $1 AND square_id = ANY($2::uuid[])", [userId, ids]);
  return rows.map((r) => `${BANK}${r.square_id}`);
}

async function readBingo(user: SessionUser, seasonId: string, n: number, ctx: Context): Promise<EpisodeBingo> {
  const { couch, aired, mark } = ctx;
  const card = await cardOf(user.id, seasonId, n);
  const [{ rows: mine }, { rows: count }] = await Promise.all([
    card?.kept ? pool.query("SELECT square, marked_at FROM bingo_marks WHERE card_id = $1", [card.id]) : Promise.resolve({ rows: [] as { square: number; marked_at: Date }[] }),
    pool.query(
      `SELECT count(DISTINCT c.user_id)::int AS n FROM bingo_cards c WHERE c.season_id = $1 AND c.episode = $2
          AND EXISTS (SELECT 1 FROM bingo_marks m WHERE m.card_id = c.id) AND ${couch ? SHARED("$3", "$4") : `(c.user_id = $3 OR ${OPEN})`}`,
      couch ? [seasonId, n, user.id, couch] : [seasonId, n, user.id]
    ),
  ]);
  const ticked = new Set(mine.map((r) => Number(r.square)));
  const squares = card?.squares ?? [];
  const seen = aired && mark >= n;
  const settled = seen && card ? await settledOf(ctx, user.id, seasonId, n) : null;
  const truth = settled ? truthOf(squares, settled.truth) : null;
  const calls = callsOn(squares);
  const full = fullLines(squares, ticked);
  const called = (card?.called ?? []).filter((c) => full.includes(c.line));
  const out: EpisodeBingo = {
    seasonId,
    episode: n,
    airAt: ctx.airAt,
    status: !card ? "none" : aired ? "open" : "ready",
    squares,
    ticked: [...ticked].sort((a, b) => a - b),
    order: [...mine].sort((a, b) => new Date(a.marked_at).getTime() - new Date(b.marked_at).getTime()).map((r) => Number(r.square)),
    rerollsLeft: !card || card.kept ? 0 : Math.max(0, MAX_REROLLS - card.rerolls),
    calls,
    called: called.map((c) => ({ line: c.line, at: new Date(c.at).toISOString() })),
    didIt: [],
    of: null,
    flagged: await flaggedOn(user.id, squares),
    truth,
    lines: countLines(squares, ticked, truth, calls ? called.map((c) => c.line) : null),
    by: ctx.talk || calls ? "couch" : "results",
    people: [],
    first: null,
    playing: count[0].n,
    catchUp: aired && !seen ? n : null,
    scope: couch ? "couch" : "solo",
    alone: ctx.alone,
    together: couch && aired ? await togetherTicks(user.id, seasonId, n, couch) : [],
  };
  if (!seen || !settled) return out;

  // You've seen it: the couch's cards (each against what's settled), who made a line first, and the squares in their called lines
  // still waiting on a say.
  const { rows } = await pool.query(
    `SELECT c.user_id, COALESCE(u.username, u.name) AS name, c.squares, c.called_lines, array_agg(m.square) AS squares_ticked,
            array_agg((extract(epoch FROM m.marked_at) * 1000)::bigint) AS ticked_at
       FROM bingo_cards c JOIN "user" u ON u.id = c.user_id JOIN bingo_marks m ON m.card_id = c.id
      WHERE c.season_id = $1 AND c.episode = $2 AND ${couch ? SHARED("$3", "$4") : "c.user_id = $3"}
      GROUP BY c.id, c.user_id, u.username, u.name`,
    couch ? [seasonId, n, user.id, couch] : [seasonId, n, user.id]
  );
  let first: { userId: string; name: string; at: number } | null = null;
  const cards = rows.map((r) => {
    const marks = (r.squares_ticked as number[]).map(Number);
    return {
      userId: r.user_id as string,
      name: r.name as string,
      squares: r.squares as BingoSquare[],
      marks: new Set(marks),
      at: new Map(marks.map((s, i) => [s, Number((r.ticked_at as string[])[i])])),
      called: calledOf(r.called_lines),
    };
  });
  const people = cards.map((c) => {
    const t = truthOf(c.squares, settled.truth);
    const on = callsOn(c.squares);
    const lines = countLines(c.squares, c.marks, t, on ? c.called.map((x) => x.line) : null);
    const done = firstLineAt(c.squares, c.at, t, on ? c.called : null);
    if (done !== null && (!first || done < first.at)) first = { userId: c.userId, name: c.name, at: done };
    return { userId: c.userId, name: c.name, lines: lines.standing, waiting: lines.waiting, off: lines.off, called: lines.called, ticked: c.marks.size };
  });
  out.people = people.sort((a, b) => Number(b.userId === user.id) - Number(a.userId === user.id) || b.lines - a.lines || b.ticked - a.ticked);
  const f = first as { userId: string; name: string; at: number } | null;
  out.first = f ? { userId: f.userId, name: f.name } : null;
  out.didIt = didItOf(cards, user.id, settled.truth, settled.mine);
  return out;
}

/** Whether these two are both here in a together session of the episode on the couch now (step 13 part 3). */
async function watchingTogether(userId: string, otherId: string, seasonId: string, n: number, couchId: string): Promise<boolean> {
  const here = (p: string) => `${p}.left_at IS NULL AND ${p}.seen_at > now() - interval '${PRESENT_MS} milliseconds'`;
  const { rows } = await pool.query(
    `SELECT 1 FROM watch_sessions s
       JOIN watch_session_people me ON me.session_id = s.id AND me.user_id = $1 AND ${here("me")}
       JOIN watch_session_people p ON p.session_id = s.id AND p.user_id = $2 AND ${here("p")}
      WHERE s.together AND s.season_id = $3 AND s.episode = $4 AND s.couch_id = $5 LIMIT 1`,
    [userId, otherId, seasonId, n, couchId]
  );
  return rows.length > 0;
}

/**
 * Someone on the couch's card for an episode (step 3's "Look at their card"), when they share the show with you: their squares,
 * ticks and called lines once you've seen the episode (with how each square stands and the "Did it?" squares of their lines) or
 * while you're watching it together with them (no truth: you haven't seen how it ends); before either, only who and the episode
 * to catch up on (their ticks say what happened). 404 for someone not on it with you, or who hasn't played it.
 */
async function theirBingo(user: SessionUser, seasonId: string, n: number, ctx: Context, ofId: string): Promise<EpisodeBingo> {
  if (!ctx.couch) throw new HttpError(404, "Their card is for the couch you share");
  const { rows } = await pool.query(
    `SELECT c.user_id, COALESCE(u.username, u.name) AS name, c.squares, c.called_lines, array_agg(m.square ORDER BY m.marked_at) AS ticked
       FROM bingo_cards c JOIN "user" u ON u.id = c.user_id JOIN bingo_marks m ON m.card_id = c.id
      WHERE c.season_id = $1 AND c.episode = $2 AND c.user_id = $5 AND ${SHARED("$3", "$4")}
      GROUP BY c.id, c.user_id, u.username, u.name`,
    [seasonId, n, user.id, ctx.couch, ofId]
  );
  const r = rows[0];
  if (!r) throw new HttpError(404, `Nobody by that name played Episode ${n} on this couch`);
  const seen = ctx.aired && ctx.mark >= n;
  const open = seen || (await watchingTogether(user.id, ofId, seasonId, n, ctx.couch));
  const squares = r.squares as BingoSquare[];
  const order = (r.ticked as number[]).map(Number);
  const marks = new Set(order);
  const full = fullLines(squares, marks);
  const called = calledOf(r.called_lines).filter((c) => full.includes(c.line));
  const settled = seen ? await settledOf(ctx, user.id, seasonId, n) : null;
  const truth = settled ? truthOf(squares, settled.truth) : null;
  const calls = callsOn(squares);
  const card = { userId: r.user_id as string, name: r.name as string, squares, marks, called };
  return {
    seasonId,
    episode: n,
    airAt: ctx.airAt,
    status: ctx.aired ? "open" : "ready",
    squares: open ? squares : [],
    ticked: open ? [...marks].sort((a, b) => a - b) : [],
    order: open ? order : [],
    rerollsLeft: 0,
    calls,
    called: open ? called.map((c) => ({ line: c.line, at: new Date(c.at).toISOString() })) : [],
    didIt: settled ? didItOf([card], user.id, settled.truth, settled.mine) : [],
    of: { userId: card.userId, name: card.name },
    flagged: [],
    truth,
    lines: open ? countLines(squares, marks, truth, calls ? called.map((c) => c.line) : null) : countLines([], new Set(), null),
    by: ctx.talk || calls ? "couch" : "results",
    people: [],
    first: null,
    playing: 0,
    catchUp: seen ? null : n,
    scope: "couch",
    alone: ctx.alone,
    together: [],
  };
}

/**
 * Watching an episode together (step 13 part 3): the people here with you in your together session of it on the couch (who share the
 * show, as everywhere), each with the moments they've ticked since it began. They're at your moment, so this is never ahead of you;
 * ticks from before it began (someone who'd watched it already) stay theirs.
 */
async function togetherTicks(userId: string, seasonId: string, n: number, couchId: string): Promise<BingoMate[]> {
  const here = (p: string) => `${p}.left_at IS NULL AND ${p}.seen_at > now() - interval '${PRESENT_MS} milliseconds'`;
  const { rows } = await pool.query(
    `SELECT c.user_id, COALESCE(u.username, u.name) AS name, c.squares, array_agg(m.square) AS ticked
       FROM watch_sessions s
       JOIN watch_session_people me ON me.session_id = s.id AND me.user_id = $1 AND ${here("me")}
       JOIN watch_session_people p ON p.session_id = s.id AND p.user_id <> $1 AND ${here("p")}
       JOIN bingo_cards c ON c.user_id = p.user_id AND c.season_id = s.season_id AND c.episode = s.episode
       JOIN bingo_marks m ON m.card_id = c.id AND m.marked_at >= s.created_at
       JOIN "user" u ON u.id = c.user_id
      WHERE s.together AND s.season_id = $2 AND s.episode = $3 AND s.couch_id = $4 AND ${SHARED("$1", "$4")}
      GROUP BY c.id, c.user_id, u.username, u.name`,
    [userId, seasonId, n, couchId]
  );
  return rows
    .map((r) => {
      const squares = r.squares as BingoSquare[];
      const keys = (r.ticked as number[]).map((i) => squares[Number(i)]?.key).filter((k): k is string => !!k && k !== FREE_KEY);
      return { userId: r.user_id as string, name: r.name as string, keys };
    })
    .filter((m) => m.keys.length)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Tick a square of your card (or untick it), from the episode's airtime on. The card is kept as dealt from your first tick. */
export async function tickBingo(user: SessionUser, seasonId: string, couchId: string | null, nIn: unknown, body: { square?: unknown; ticked?: unknown }, now = new Date()): Promise<EpisodeBingo> {
  const n = episodeNumber(nIn);
  const ctx = await context(user, seasonId, couchId, n, now);
  if (!ctx.aired) throw new HttpError(409, `Your card opens when Episode ${n} starts`);
  const square = Number(body.square);
  if (!Number.isInteger(square) || square < 0 || square >= SQUARES) throw new HttpError(400, "Which square?");
  if (typeof body.ticked !== "boolean") throw new HttpError(400, "ticked must be true or false");
  const card = await cardOf(user.id, seasonId, n);
  if (!card) throw new HttpError(409, `No bingo card for Episode ${n} yet`);
  if (card.squares[square]?.key === FREE_KEY) throw new HttpError(400, "That one's free");
  // Unticking a card you haven't kept changes nothing. Your first tick keeps the card as dealt (as you see it).
  if (!body.ticked && !card.kept) return readBingo(user, seasonId, n, ctx);
  let id = card.id;
  if (!card.kept) {
    const { rows } = await pool.query(
      `INSERT INTO bingo_cards (user_id, season_id, episode, squares) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, season_id, episode) DO UPDATE SET squares = EXCLUDED.squares
        WHERE NOT EXISTS (SELECT 1 FROM bingo_marks m WHERE m.card_id = bingo_cards.id)
       RETURNING id`,
      [user.id, seasonId, n, JSON.stringify(card.squares)]
    );
    // Kept a moment ago (another tab): tick the card as kept.
    id = (rows[0]?.id as string | undefined) ?? (await cardOf(user.id, seasonId, n))!.id;
  }
  if (body.ticked) await pool.query("INSERT INTO bingo_marks (card_id, square) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, square]);
  else {
    await pool.query("DELETE FROM bingo_marks WHERE card_id = $1 AND square = $2", [id, square]);
    // A called line you've unticked a square of isn't a line any more: its call comes off (calling it again is a new call).
    const lost = card.called.filter((c) => LINES[c.line].includes(square));
    if (lost.length) {
      await pool.query(
        "UPDATE bingo_cards SET called_lines = (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb) FROM jsonb_array_elements(called_lines) x WHERE NOT ((x->>'line')::int = ANY($2::int[]))) WHERE id = $1",
        [id, lost.map((c) => c.line)]
      );
    }
  }
  // On a card from before the banks, a tick can finish a line that counts once what happened is settled: yours, or on a talk show
  // (where a tick from someone who's seen it is a say) anyone's on the episode. An untick finishes nothing. A bank's card tells the
  // couch when a line is called, not ticked (callBingo).
  if (body.ticked && !callsOn(card.squares)) notifyBingoLines({ seasonId, episode: n, lines: () => bingoLinesOn(seasonId, n, ctx.talk ? undefined : [user.id], ctx.book) });
  // Watching it together: the session moves on, so the others' open cards read again (step 13 part 3).
  if (ctx.couch) {
    await pool.query(
      `UPDATE watch_sessions s SET version = s.version + 1, updated_at = now()
        WHERE s.together AND s.season_id = $2 AND s.episode = $3 AND s.couch_id = $4
          AND EXISTS (SELECT 1 FROM watch_session_people p WHERE p.session_id = s.id AND p.user_id = $1 AND p.left_at IS NULL)`,
      [user.id, seasonId, n, ctx.couch]
    );
  }
  return readBingo(user, seasonId, n, ctx);
}

/**
 * Call BINGO on a line of your card (step 3's "Sure all three happened?"): its three squares ticked (or free), on a card dealt from
 * a bank, from airtime. Only a called line counts; calling one tells the couch (notifyBingoCall), once per episode. Calling a line
 * already called changes nothing.
 */
export async function callBingo(user: SessionUser, seasonId: string, couchId: string | null, nIn: unknown, body: { call?: unknown }, now = new Date()): Promise<EpisodeBingo> {
  const n = episodeNumber(nIn);
  const ctx = await context(user, seasonId, couchId, n, now);
  if (!ctx.aired) throw new HttpError(409, `Your card opens when Episode ${n} starts`);
  const line = Number(body.call);
  if (!Number.isInteger(line) || line < 0 || line >= LINES.length) throw new HttpError(400, "Which line?");
  const card = await cardOf(user.id, seasonId, n);
  if (!card?.kept || !card.id) throw new HttpError(409, "Tick the line's three squares first");
  if (!callsOn(card.squares)) throw new HttpError(400, "This card's lines count by themselves: nothing to call");
  const { rows } = await pool.query("SELECT square FROM bingo_marks WHERE card_id = $1", [card.id]);
  if (!fullLines(card.squares, new Set(rows.map((r) => Number(r.square)))).includes(line)) throw new HttpError(409, "Tick all three squares of that line first");
  const { rowCount } = await pool.query(
    `UPDATE bingo_cards SET called_lines = called_lines || jsonb_build_array(jsonb_build_object('line', $2::int, 'at', now()))
      WHERE id = $1 AND NOT called_lines @> jsonb_build_array(jsonb_build_object('line', $2::int))`,
    [card.id, line]
  );
  if (rowCount && ctx.couch) notifyBingoCall({ seasonId, episode: n, couchId: ctx.couch, caller: user.id });
  return readBingo(user, seasonId, n, ctx);
}

/**
 * Say whether squares happened (step 3's "Did it?"), once you've seen the episode: { [square]: "yes" | "no" | null (take it
 * back) }, each a bank's square on someone's card for the episode. A say like a talk show's (episode_call_says): it settles that square for every
 * card on the couch that has it, two agreeing (calls.ts settleSays). Answers your own card.
 */
export async function sayBingo(user: SessionUser, seasonId: string, couchId: string | null, nIn: unknown, body: { said?: unknown }, now = new Date()): Promise<EpisodeBingo> {
  const n = episodeNumber(nIn);
  const ctx = await context(user, seasonId, couchId, n, now);
  if (!ctx.aired || ctx.mark < n) throw new HttpError(403, `See Episode ${n} first: a say is about what happened`);
  const said = body.said;
  if (!said || typeof said !== "object" || Array.isArray(said)) throw new HttpError(400, "said must be { square: yes | no | null }");
  const entries = Object.entries(said as Record<string, unknown>);
  if (!entries.length || entries.length > 24) throw new HttpError(400, "Say something about 1 to 24 squares");
  for (const [key, v] of entries) {
    if (!/^b:[0-9a-f-]{36}$/.test(key)) throw new HttpError(400, "Which square?");
    if (v !== "yes" && v !== "no" && v !== null) throw new HttpError(400, "A say is yes, no or null");
  }
  // A square on someone's card for the episode: a kept card keeps its squares when its bank is written again, so not the bank.
  const keys = [...new Set(entries.map(([key]) => key))];
  const { rows } = await pool.query(
    "SELECT DISTINCT s->>'key' AS key FROM bingo_cards c, jsonb_array_elements(c.squares) s WHERE c.season_id = $1 AND c.episode = $2 AND s->>'key' = ANY($3::text[])",
    [seasonId, n, keys]
  );
  if (rows.length !== keys.length) throw new HttpError(400, "That square isn't on anyone's card for this episode");
  for (const [key, v] of entries) {
    if (v === null) await pool.query("DELETE FROM episode_call_says WHERE user_id = $1 AND season_id = $2 AND episode = $3 AND question = $4", [user.id, seasonId, n, key]);
    else {
      await pool.query(
        `INSERT INTO episode_call_says (user_id, season_id, episode, question, happened) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, season_id, episode, question) DO UPDATE SET happened = EXCLUDED.happened, updated_at = now()`,
        [user.id, seasonId, n, key, v === "yes"]
      );
    }
  }
  return readBingo(user, seasonId, n, ctx);
}

/**
 * "This square's unfair" (step 4): flag a square on your card (`on` false takes your flag back). It leaves your own card at once
 * if you haven't ticked it (dealt afresh without it), and everyone's new cards once two people, or an admin, have flagged it
 * (FLAGGED_OUT); a card already ticked keeps it. Answers your card.
 */
export async function flagBingo(user: SessionUser, seasonId: string, couchId: string | null, nIn: unknown, body: { flag?: unknown; on?: unknown }, now = new Date()): Promise<EpisodeBingo> {
  const n = episodeNumber(nIn);
  const ctx = await context(user, seasonId, couchId, n, now);
  const key = typeof body.flag === "string" ? body.flag : "";
  if (!/^b:[0-9a-f-]{36}$/.test(key)) throw new HttpError(400, "Which square?");
  await refuseTestPlayer(user.id, "flag bingo squares");
  if (body.on !== undefined && typeof body.on !== "boolean") throw new HttpError(400, "on must be true or false");
  // Taking your flag back works wherever the square went (flagging took it off a card you hadn't ticked).
  const card = await cardOf(user.id, seasonId, n);
  if (body.on !== false && !card?.squares.some((s) => s.key === key)) throw new HttpError(400, "That square isn't on your card");
  const id = key.slice(BANK.length);
  if (body.on === false) await pool.query("DELETE FROM bingo_square_flags WHERE square_id = $1 AND user_id = $2", [id, user.id]);
  else {
    const { rowCount } = await pool.query(
      "INSERT INTO bingo_square_flags (square_id, user_id) SELECT id, $2 FROM bingo_squares WHERE id = $1 AND season_id = $3 ON CONFLICT DO NOTHING",
      [id, user.id, seasonId]
    );
    if (!rowCount && !(await pool.query("SELECT 1 FROM bingo_square_flags WHERE square_id = $1 AND user_id = $2", [id, user.id])).rows.length) {
      throw new HttpError(409, "That square's bank has been written again: nothing to flag");
    }
  }
  return readBingo(user, seasonId, n, ctx);
}

/**
 * Deal yourself a new card for an episode (the bingo bank's two rerolls): until your first tick, before or after airtime, at most
 * MAX_REROLLS times. The card you had is gone for good (the sheet asks first). Kept as a row with no ticks, so the count holds; its
 * squares are dealt afresh each read until you tick, like any card you haven't kept.
 */
export async function rerollBingo(user: SessionUser, seasonId: string, couchId: string | null, nIn: unknown, now = new Date()): Promise<EpisodeBingo> {
  const n = episodeNumber(nIn);
  const ctx = await context(user, seasonId, couchId, n, now);
  const card = await cardOf(user.id, seasonId, n);
  if (!card) throw new HttpError(409, `No bingo card for Episode ${n} yet`);
  if (card.kept) throw new HttpError(409, "You've ticked this card: it's yours for the episode");
  if (card.rerolls >= MAX_REROLLS) throw new HttpError(409, "No new cards left for this episode");
  const squares = dealCard((await bankFor(seasonId, n, user.id)).squares, seedOf(user.id, seasonId, n, card.rerolls + 1));
  const { rowCount } = await pool.query(
    `INSERT INTO bingo_cards (user_id, season_id, episode, squares, rerolls) VALUES ($1, $2, $3, $4, 1)
     ON CONFLICT (user_id, season_id, episode) DO UPDATE SET squares = EXCLUDED.squares, rerolls = bingo_cards.rerolls + 1
      WHERE bingo_cards.rerolls = $5 AND NOT EXISTS (SELECT 1 FROM bingo_marks m WHERE m.card_id = bingo_cards.id)`,
    [user.id, seasonId, n, JSON.stringify(squares ?? card.squares), card.rerolls]
  );
  // Someone else's tap got there first (another tab): the card as it is now.
  if (!rowCount) throw new HttpError(409, "Your card changed: have another look");
  return readBingo(user, seasonId, n, ctx);
}

/**
 * Who has a bingo line that counts on an episode now (step 15 part 2's notices): each card's owner with one, their name, and their
 * couch-mates with a card on the episode (who hears of it is the guard's, per reader: push-events.ts notifyBingoLines). A bank's
 * square (and a talk show's) is settled by a couch's says, so a line counts on any couch they're on. `only`: just these people's
 * cards (a tick changes only its own, where results settle the squares).
 */
export async function bingoLinesOn(seasonId: string, n: number, only?: string[], bookIn?: CallBook): Promise<{ userId: string; name: string; mates: string[] }[]> {
  const { rows } = await pool.query(
    `SELECT c.user_id, COALESCE(u.username, u.name) AS name,
            (SELECT s->>'key' FROM jsonb_array_elements(c.squares) s WHERE s->>'key' <> 'free' LIMIT 1) AS first_key
       FROM bingo_cards c JOIN "user" u ON u.id = c.user_id
      WHERE c.season_id = $1 AND c.episode = $2 AND EXISTS (SELECT 1 FROM bingo_marks m WHERE m.card_id = c.id)`,
    [seasonId, n]
  );
  const owners = rows.filter((r) => !only || only.includes(r.user_id));
  if (!owners.length) return [];
  const book = bookIn ?? (await seasonBook(seasonId));
  const { rows: mates } = await pool.query<{ owner: string; mate: string; couch_id: string }>(
    "SELECT a.user_id AS owner, b.user_id AS mate, a.couch_id FROM couch_members a JOIN couch_members b ON b.couch_id = a.couch_id AND b.user_id <> a.user_id WHERE a.user_id = ANY($1::text[])",
    [owners.map((r) => r.user_id)]
  );
  const playing = new Set(rows.map((r) => r.user_id as string));
  const lines = new Map<string, number>();
  if (kindOf(book.blocks) === "talk" || rows.some((r) => fromBank(String(r.first_key ?? "")))) {
    for (const o of owners) {
      const couches = [...new Set(mates.filter((m) => m.owner === o.user_id).map((m) => m.couch_id))];
      for (const c of couches.length ? couches : [null]) {
        const got = (await bingoLines(seasonId, [o.user_id], { from: n, through: n, couchId: c, book })).get(o.user_id) ?? 0;
        lines.set(o.user_id, Math.max(lines.get(o.user_id) ?? 0, got));
      }
    }
  } else {
    for (const [u, l] of await bingoLines(seasonId, owners.map((r) => r.user_id), { from: n, through: n, couchId: null, book })) lines.set(u, l);
  }
  return owners
    .filter((o) => (lines.get(o.user_id) ?? 0) > 0)
    .map((o) => ({
      userId: o.user_id as string,
      name: o.name as string,
      mates: [...new Set(mates.filter((m) => m.owner === o.user_id && playing.has(m.mate)).map((m) => m.mate))],
    }));
}

// ---------- Weekly Bingo ----------

/**
 * Each of these people's lines that count on a season, from episode `from` through `through` (a viewer's mark): every square of
 * the line ticked and settled as happened, by the season's results or (a talk show) the couch's says (`couchId`'s people who
 * share the show; with no couch, each person's own).
 */
export async function bingoLines(seasonId: string, userIds: string[], opts: { from: number; through: number; couchId: string | null; book?: CallBook }): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const upTo = Number.isFinite(opts.through) ? opts.through : 100000;
  if (!userIds.length || upTo < Math.max(1, opts.from)) return out;
  const { rows } = await pool.query(
    `SELECT c.user_id, c.episode, c.squares, c.called_lines, array_agg(m.square) AS ticked
       FROM bingo_cards c JOIN bingo_marks m ON m.card_id = c.id
      WHERE c.season_id = $1 AND c.user_id = ANY($2::text[]) AND c.episode BETWEEN $3 AND $4
      GROUP BY c.id`,
    [seasonId, userIds, Math.max(1, opts.from), upTo]
  );
  if (!rows.length) return out;
  const book = opts.book ?? (await seasonBook(seasonId));
  const talk = kindOf(book.blocks) === "talk";
  const episodes = [...new Set(rows.map((r) => r.episode as number))];
  const keys = rows.flatMap((r) => (r.squares as BingoSquare[]).map((s) => s.key));
  // A bank's squares (and a talk show's moments) by what the couch says; a show's moments on a card from before the banks by results.
  let saidAt: (userId: string, episode: number, key: string) => Truth = () => null;
  if (talk || keys.some(fromBank)) {
    const says: SayRow[] = await saysOn(seasonId, episodes, opts.couchId ? { couch: opts.couchId } : { users: userIds });
    const alone = !opts.couchId || (await othersSharing(opts.couchId, seasonId, null)) <= 1;
    const at = (u: string, e: number, k: string) => (opts.couchId ? `${e}|${k}` : `${u}|${e}|${k}`);
    const grouped = new Map<string, boolean[]>();
    for (const s of says) grouped.set(at(s.user_id, s.episode, s.question), [...(grouped.get(at(s.user_id, s.episode, s.question)) ?? []), s.happened]);
    // As calls.ts callRights settles them: two on the couch agreeing, or alone on the show (or no couch) your own say.
    saidAt = (u, e, k) => settleSays(grouped.get(at(u, e, k)) ?? [], alone);
  }
  const facts: Map<number, EpisodeFacts> | null = !talk && keys.some((k) => k.startsWith("m:")) ? await episodeFacts(seasonId, book, upTo) : null;
  const truthAt = (u: string, e: number, k: string): Truth => {
    if (talk || fromBank(k)) return saidAt(u, e, k);
    const events = facts?.get(e)?.events;
    return events ? (events.has(k.slice(2)) ? "yes" : "no") : null;
  };
  for (const r of rows) {
    const squares = r.squares as BingoSquare[];
    const t = truthOf(squares, (k) => truthAt(r.user_id, r.episode, k));
    // A bank's card counts its called lines (step 3); one from before the banks, every ticked line.
    const called = callsOn(squares) ? calledOf(r.called_lines).map((c) => c.line) : null;
    const lines = countLines(squares, new Set((r.ticked as number[]).map(Number)), t, called).standing;
    if (lines) out.set(r.user_id, (out.get(r.user_id) ?? 0) + lines);
  }
  return out;
}

/**
 * The card a Weekly Bingo player has to hand: the next episode they'd watch once it's aired (ticks open), else the next to air
 * (ready); how many squares they've ticked on it and their ticked lines.
 */
export async function bingoMove(userId: string, seasonId: string, mark: number, from: number, schedule: SeasonSchedule | undefined, now = new Date()): Promise<BingoMove | null> {
  const latest = latestAired(schedule, now);
  const open = openEpisode(schedule, now);
  const watching = latest >= Math.max(1, from) && mark < latest ? Math.max(from, Math.min(mark + 1, latest)) : null;
  const n = watching ?? open?.number ?? null;
  if (!n) return null;
  const airAt = schedule?.episodes.find((e) => e.number === n)?.airAt ?? null;
  const { rows } = await pool.query(
    `SELECT c.squares, array_remove(array_agg(m.square), NULL) AS ticked FROM bingo_cards c LEFT JOIN bingo_marks m ON m.card_id = c.id
      WHERE c.user_id = $1 AND c.season_id = $2 AND c.episode = $3 GROUP BY c.id`,
    [userId, seasonId, n]
  );
  const ticked = new Set(((rows[0]?.ticked as number[] | undefined) ?? []).map(Number));
  const lines = rows[0] ? countLines(rows[0].squares as BingoSquare[], ticked, null).ticked : 0;
  return { episode: n, airsAt: airAt, open: !!airAt && Date.parse(airAt) <= now.getTime(), ticked: ticked.size, lines };
}

/** Your card this week on a show (Commercial break's This week only): as bingoMove has it, when there's a card to deal (or yours). */
export async function weekBingo(userId: string, seasonId: string, mark: number, schedule: SeasonSchedule | undefined, now = new Date()): Promise<BingoMove | null> {
  const move = await bingoMove(userId, seasonId, mark, 1, schedule, now);
  if (!move || move.ticked) return move;
  return (await bankFor(seasonId, move.episode, userId)).from ? move : null;
}

/**
 * A Weekly Bingo game as one viewer reads it (season-games.ts, couch-hub.ts): each player's lines through the latest show that's
 * aired and you've seen, the card you have to hand, and whether the season's over. Null for any other game.
 */
export async function leagueBingo(o: {
  state: LeagueState;
  couchId: string | null;
  seasonId: string;
  playerId: string | null;
  userId: string;
  mark: number | null;
  userOf: (playerId: string) => string | null;
  book?: CallBook;
  now?: Date;
}): Promise<GameCalls | null> {
  if (!StateLogic.getLeagueType(o.state).hasBingo) return null;
  const now = o.now ?? new Date();
  const schedule = (await seasonSchedules([o.seasonId], now)).get(o.seasonId);
  const mark = o.mark ?? Number.POSITIVE_INFINITY;
  // A game over a span counts its own episodes only (settings.endEpisode), and hands no card past its last.
  const end = StateLogic.endEpisode(o.state);
  const through = Math.min(mark, latestAired(schedule, now), end ?? Number.POSITIVE_INFINITY);
  const from = StateLogic.startEpisode(o.state);
  const userIds = o.state.players.map((p) => o.userOf(p.id)).filter((id): id is string => !!id);
  const [lines, move] = await Promise.all([
    bingoLines(o.seasonId, userIds, { from, through, couchId: o.couchId, book: o.book }),
    o.playerId ? bingoMove(o.userId, o.seasonId, mark, from, schedule, now) : Promise.resolve(null),
  ]);
  return {
    right: (p) => lines.get(o.userOf(p) ?? "") ?? 0,
    move: null,
    bingo: move && (end === null || move.episode <= end) ? move : null,
    through,
    ended: endedThrough(schedule, Math.min(mark, latestAired(schedule, now)), end),
  };
}
