import StateLogic from "@/lib/game/state-logic.js";
import { bingoMoments, countLines, dealCard, firstLineAt, truthOf, FREE_KEY, MIN_MOMENTS, SQUARES, type BingoSquare, type LineCount, type Truth } from "@/lib/game/bingo";
import { settleSays, type CallBook, type EpisodeFacts } from "@/lib/game/calls";
import { PRESENT_MS } from "@/lib/game/watch-along";
import { kindOf } from "@/lib/game/formats/rulebook-schema.js";
import type { BingoMove, GameCalls } from "@/lib/game/game-view";
import type { LeagueState } from "@/lib/game/types";
import { isUuid, type SessionUser } from "./auth-helpers";
import { endedThrough, episodeFacts, openEpisode, OPEN, othersSharing, saysOn, scopeOf, seasonBook, settledSays, SHARED, type SayRow } from "./calls";
import { HttpError, pool } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { latestAired, seasonSchedules, type SeasonSchedule } from "./schedule";
import { seasonHeaders, type SeasonHeader } from "./show-space";
import { notifyBingoLines } from "./push-events";

// Bingo (docs/PLAN-new-design.md step 12 part 3; migration 0130 bingo_cards, bingo_marks; the pure rules are bingo.ts):
//   GET  /api/seasons/[id]/bingo/[n]?couch=   your card for an episode (the next to air, or one that's aired), what you've
//        ticked, how many on the couch are playing; once you've seen it, what's settled of each square, your lines and the
//        couch's cards (who got a line first)
//   POST /api/seasons/[id]/bingo/[n]?couch=   { square, ticked } from the episode's airtime on: tick a square, or untick it
// plus Weekly Bingo's table (bingoLines, leagueBingo), the talk show's other season game.
//
// A card is a person's (one per episode, whichever couch they're on), dealt from the show's moments and kept from your first tick,
// so a rulebook change can't reshuffle it under you. Its squares are the show's moments, never a name or anything about the
// episode, so anyone may see their own card for any episode that's aired or is next. Ticks are private: nobody else's card, tick,
// line or count of ticks leaves the server until you've seen the episode (guard.ts seenThrough), and only from the couch's people
// who share the show (guard.ts visibleFollows), as calls are; watching it together (step 13 part 3), the people here in your together
// session are at the same moment as you, so what they tick from then on shows on your card as they do. A square counts once it
// happened: the season's results say so (every
// result in), or on a talk show the couch does (calls.ts settleSays: two agreeing; a tick from someone who's seen the episode is
// their say, so bingo settles a talk show's calls too). Read when a sheet or row opens; nothing polls (docs/HOSTING.md).
// A line that counts is a notice (step 15 part 2, bingoLinesOn): its owner and the couch-mates playing that episode hear, once
// each, and only once they've seen it.

export interface BingoPerson {
  userId: string;
  name: string;
  /** Their lines that count (every square happened), and those still waiting on a square. */
  lines: number;
  waiting: number;
  ticked: number;
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
  /** ready: before it airs (ticks open at airtime); open: it's aired, tick as it happens; none: the show has too few moments. */
  status: "ready" | "open" | "none";
  squares: BingoSquare[];
  ticked: number[];
  /** Once it's aired and you've seen it: what's settled of each square (a free one is "yes"); null before. */
  truth: Truth[] | null;
  lines: LineCount;
  /** What settles the squares: the season's results, or the couch saying (a talk show). */
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

const seedOf = (userId: string, seasonId: string, n: number) => `bingo|${userId}|${seasonId}|${n}`;

/** Your card for an episode: the one you've ticked (kept as it was dealt), else dealt now from the show's moments (not kept yet). */
async function cardOf(userId: string, seasonId: string, n: number, book: CallBook): Promise<{ id: string | null; squares: BingoSquare[] } | null> {
  const { rows } = await pool.query("SELECT id, squares FROM bingo_cards WHERE user_id = $1 AND season_id = $2 AND episode = $3", [userId, seasonId, n]);
  if (rows[0]) return { id: rows[0].id as string, squares: rows[0].squares as BingoSquare[] };
  const squares = dealCard(bingoMoments(book), seedOf(userId, seasonId, n));
  return squares ? { id: null, squares } : null;
}

/** What's settled of each moment on an episode, for a viewer: the season's results (every result in), or what the couch says. */
async function settledOf(ctx: Context, userId: string, seasonId: string, n: number): Promise<(key: string) => Truth> {
  if (ctx.talk) {
    const says = await saysOn(seasonId, [n], { viewer: userId, couch: ctx.couch });
    const settled = settledSays(says, n, userId, ctx.alone);
    return (key) => settled.get(key)?.settled ?? null;
  }
  const facts = (await episodeFacts(seasonId, ctx.book, n)).get(n) ?? null;
  return (key) => (facts?.events ? (facts.events.has(key.slice(2)) ? "yes" : "no") : null);
}

/** One episode's card, as this viewer may see it. */
export async function episodeBingo(user: SessionUser, seasonId: string, couchId: string | null, nIn: unknown, now = new Date()): Promise<EpisodeBingo> {
  const n = episodeNumber(nIn);
  const ctx = await context(user, seasonId, couchId, n, now);
  return readBingo(user, seasonId, n, ctx);
}

async function readBingo(user: SessionUser, seasonId: string, n: number, ctx: Context): Promise<EpisodeBingo> {
  const { couch, aired, mark } = ctx;
  const card = await cardOf(user.id, seasonId, n, ctx.book);
  const [{ rows: mine }, { rows: count }] = await Promise.all([
    card?.id ? pool.query("SELECT square, marked_at FROM bingo_marks WHERE card_id = $1", [card.id]) : Promise.resolve({ rows: [] as { square: number; marked_at: Date }[] }),
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
  const truth = settled ? truthOf(squares, settled) : null;
  const out: EpisodeBingo = {
    seasonId,
    episode: n,
    airAt: ctx.airAt,
    status: !card ? "none" : aired ? "open" : "ready",
    squares,
    ticked: [...ticked].sort((a, b) => a - b),
    truth,
    lines: countLines(squares, ticked, truth),
    by: ctx.talk ? "couch" : "results",
    people: [],
    first: null,
    playing: count[0].n,
    catchUp: aired && !seen ? n : null,
    scope: couch ? "couch" : "solo",
    alone: ctx.alone,
    together: couch && aired ? await togetherTicks(user.id, seasonId, n, couch) : [],
  };
  if (!seen || !settled) return out;

  // You've seen it: the couch's cards (each against what's settled), and who finished a line first.
  const { rows } = await pool.query(
    `SELECT c.user_id, COALESCE(u.username, u.name) AS name, c.squares, array_agg(m.square) AS squares_ticked,
            array_agg((extract(epoch FROM m.marked_at) * 1000)::bigint) AS ticked_at
       FROM bingo_cards c JOIN "user" u ON u.id = c.user_id JOIN bingo_marks m ON m.card_id = c.id
      WHERE c.season_id = $1 AND c.episode = $2 AND ${couch ? SHARED("$3", "$4") : "c.user_id = $3"}
      GROUP BY c.id, c.user_id, u.username, u.name`,
    couch ? [seasonId, n, user.id, couch] : [seasonId, n, user.id]
  );
  let first: { userId: string; name: string; at: number } | null = null;
  const people = rows.map((r) => {
    const sq = r.squares as BingoSquare[];
    const marks = (r.squares_ticked as number[]).map(Number);
    const at = new Map(marks.map((s, i) => [s, Number((r.ticked_at as string[])[i])]));
    const t = truthOf(sq, settled);
    const lines = countLines(sq, new Set(marks), t);
    const done = firstLineAt(sq, at, t);
    if (done !== null && (!first || done < first.at)) first = { userId: r.user_id, name: r.name, at: done };
    return { userId: r.user_id as string, name: r.name as string, lines: lines.standing, waiting: lines.waiting, ticked: marks.length };
  });
  out.people = people.sort((a, b) => Number(b.userId === user.id) - Number(a.userId === user.id) || b.lines - a.lines || b.ticked - a.ticked);
  const f = first as { userId: string; name: string; at: number } | null;
  out.first = f ? { userId: f.userId, name: f.name } : null;
  return out;
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
  let card = await cardOf(user.id, seasonId, n, ctx.book);
  if (!card) throw new HttpError(409, `${ctx.header.show.name} doesn't have enough moments for a bingo card yet`);
  if (card.squares[square]?.key === FREE_KEY) throw new HttpError(400, "That one's free");
  if (!card.id) {
    await pool.query("INSERT INTO bingo_cards (user_id, season_id, episode, squares) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, season_id, episode) DO NOTHING", [
      user.id,
      seasonId,
      n,
      JSON.stringify(card.squares),
    ]);
    card = await cardOf(user.id, seasonId, n, ctx.book);
  }
  if (body.ticked) await pool.query("INSERT INTO bingo_marks (card_id, square) VALUES ($1, $2) ON CONFLICT DO NOTHING", [card!.id, square]);
  else await pool.query("DELETE FROM bingo_marks WHERE card_id = $1 AND square = $2", [card!.id, square]);
  // A tick can finish a line once what happened is settled: yours, or on a talk show (where a tick from someone who's seen it is
  // a say) anyone's on the episode. An untick finishes nothing.
  if (body.ticked) notifyBingoLines({ seasonId, episode: n, lines: () => bingoLinesOn(seasonId, n, ctx.talk ? undefined : [user.id], ctx.book) });
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
 * Who has a bingo line that counts on an episode now (step 15 part 2's notices): each card's owner with one, their name, and their
 * couch-mates with a card on the episode (who hears of it is the guard's, per reader: push-events.ts notifyBingoLines). On a talk show a line is settled by a couch's says, so it counts on any couch they're on. `only`: just these
 * people's cards (a tick changes only its own, where results settle the squares).
 */
export async function bingoLinesOn(seasonId: string, n: number, only?: string[], bookIn?: CallBook): Promise<{ userId: string; name: string; mates: string[] }[]> {
  const { rows } = await pool.query(
    `SELECT c.user_id, COALESCE(u.username, u.name) AS name
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
  if (kindOf(book.blocks) === "talk") {
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
    `SELECT c.user_id, c.episode, c.squares, array_agg(m.square) AS ticked
       FROM bingo_cards c JOIN bingo_marks m ON m.card_id = c.id
      WHERE c.season_id = $1 AND c.user_id = ANY($2::text[]) AND c.episode BETWEEN $3 AND $4
      GROUP BY c.id`,
    [seasonId, userIds, Math.max(1, opts.from), upTo]
  );
  if (!rows.length) return out;
  const book = opts.book ?? (await seasonBook(seasonId));
  const talk = kindOf(book.blocks) === "talk";
  const episodes = [...new Set(rows.map((r) => r.episode as number))];
  let truthAt: (userId: string, episode: number, key: string) => Truth;
  if (talk) {
    const says: SayRow[] = await saysOn(seasonId, episodes, opts.couchId ? { couch: opts.couchId } : { users: userIds });
    const alone = !opts.couchId || (await othersSharing(opts.couchId, seasonId, null)) <= 1;
    const at = (u: string, e: number, k: string) => (opts.couchId ? `${e}|${k}` : `${u}|${e}|${k}`);
    const grouped = new Map<string, boolean[]>();
    for (const s of says) grouped.set(at(s.user_id, s.episode, s.question), [...(grouped.get(at(s.user_id, s.episode, s.question)) ?? []), s.happened]);
    // As calls.ts callRights settles them: two on the couch agreeing, or alone on the show (or no couch) your own say.
    truthAt = (u, e, k) => settleSays(grouped.get(at(u, e, k)) ?? [], alone);
  } else {
    const facts: Map<number, EpisodeFacts> = await episodeFacts(seasonId, book, upTo);
    truthAt = (_u, e, k) => {
      const events = facts.get(e)?.events;
      return events ? (events.has(k.slice(2)) ? "yes" : "no") : null;
    };
  }
  for (const r of rows) {
    const squares = r.squares as BingoSquare[];
    const t = truthOf(squares, (k) => truthAt(r.user_id, r.episode, k));
    const lines = countLines(squares, new Set((r.ticked as number[]).map(Number)), t).standing;
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

/** Your card this week on a show (Commercial break's This week only): as bingoMove has it, when the show has moments enough. */
export async function weekBingo(userId: string, seasonId: string, mark: number, schedule: SeasonSchedule | undefined, now = new Date()): Promise<BingoMove | null> {
  if (bingoMoments(await seasonBook(seasonId)).length < MIN_MOMENTS) return null;
  return bingoMove(userId, seasonId, mark, 1, schedule, now);
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
  const through = Math.min(mark, latestAired(schedule, now));
  const from = StateLogic.startEpisode(o.state);
  const userIds = o.state.players.map((p) => o.userOf(p.id)).filter((id): id is string => !!id);
  const [lines, move] = await Promise.all([
    bingoLines(o.seasonId, userIds, { from, through, couchId: o.couchId, book: o.book }),
    o.playerId ? bingoMove(o.userId, o.seasonId, mark, from, schedule, now) : Promise.resolve(null),
  ]);
  return { right: (p) => lines.get(o.userOf(p) ?? "") ?? 0, move: null, bingo: move, through, ended: endedThrough(schedule, through) };
}
