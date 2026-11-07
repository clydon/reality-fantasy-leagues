import * as Words from "@/lib/game/game-words/index.js";
import type { AnswerResult, CheckResult, MomentRating, Pack, PackInput } from "@/lib/game/game-words/index.js";
import * as Capabilities from "@/lib/game/game-spec/capabilities.js";
import type { SpecContext } from "@/lib/game/game-spec/index.js";
import tracker from "../../../tests/fixtures/engine-capabilities.json";
import { askBot, askBotStatus } from "./ask-bot";
import { isSuperAdminUser, isUuid, type SessionUser } from "./auth-helpers";
import { couchMembers, requireCouch } from "./couches";
import { HttpError, pool } from "./db";
import { stageContext } from "./engine-lab";
import { seenThrough } from "./guard";
import { seasonSchedules } from "./schedule";
import { games, seasonHeaders } from "./show-space";
import { startFrom } from "./start-game";
import { groupsGoingInto } from "@db/format-timeline.js";

// The Start-a-game GPT's words to a game (docs/PLAN-start-a-game-gpt.md step G1; POST /api/seasons/[seasonId]/game-words): someone
// on a show's page types the game they want; our bot drafts it from the context pack (what the app knows about the page, gathered
// here) and the engine's manual (generated from the spec's VOCAB, its examples the capability tracker's requests), and our check
// (src/lib/game/game-words/check.js) decides what's a game: the spec, what the wizard asks, what it can't do yet. A moment the show
// doesn't have gets the reliability ask (a second, short question) and, rated at the bar, an offer to add it. A typed change goes
// back to the bot with the game so far. Nothing here makes a game: the wizard (U0/U1) shows the result and Start a game makes it.
//
// The bot is asked with search off and priority "now" (llm-browser-api's queue: it waits only for the question the bot is already
// answering). Every ask is a row of game_word_asks (0214): the daily cap's count and the record to measure the prompt on. The
// pack shows the cast as the asker has seen it (their mark: guard.ts seenThrough), so nothing the wizard says can spoil an exit.
// No UI in G1: the route answers JSON for the wizard to come.

/** Asks one person can make in a day: a first ask or a typed change each (the desk aside). Make it a game's is 5 shows. */
export const GAME_ASKS_A_DAY = 10;
/** At most this many new moments rated in one ask (each a question of its own to the bot). */
const MOMENT_ASKS = 2;
/** What one request may spend on the bot: the route's 300 s, less room to save what came back. */
const BUDGET_MS = 270_000;
/** Don't start a reliability ask with less than this left. */
const MOMENT_NEEDS_MS = 60_000;

export interface GameWordsResult {
  /** The ask's id: a typed change names it (`change.from`). */
  id: string;
  result: AnswerResult;
  /** How long the bot took, every ask together. */
  seconds: number;
  /** Asks left today (null: no cap, the desk). */
  left: number | null;
}

/** The asks someone has made in the last day, and how many they have left (null: no cap, the desk). An ask the bot never
 *  answered (its error kept) isn't counted: a bot that's down doesn't use up anyone's day. */
async function asksToday(user: SessionUser): Promise<{ used: number; left: number | null }> {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM game_word_asks WHERE user_id = $1 AND created_at > now() - interval '1 day' AND error IS NULL", [user.id]);
  const used = rows[0].n as number;
  return { used, left: isSuperAdminUser(user) ? null : GAME_ASKS_A_DAY - used };
}

/**
 * The context pack's input for a season, as `user` has seen it on `couchId`: the show and season, its episodes and the next, its
 * phases, its cast (who's gone and how, through their mark; each one's group now as far as they've seen it, G1 part 4: F3's timeline, else their starting one), the moments research answers (the rules
 * the couch plays by: its own copy, else the season's), and the couch (how many, its games here). And the ctx our check reads, sized
 * by the couch and who's still in as they've seen it.
 */
export async function packFor(user: SessionUser, seasonId: string, couchId: string | null, now = new Date()): Promise<{ pack: Pack; ctx: SpecContext; kind: "show" | "sport"; show: string }> {
  const [headers, schedules, mark, rules] = await Promise.all([seasonHeaders([seasonId]), seasonSchedules([seasonId], now), seenThrough(user.id, seasonId), stageContext(seasonId, couchId)]);
  const h = headers.get(seasonId);
  if (!h) throw new HttpError(404, "Season not found");
  const schedule = schedules.get(seasonId);
  const label = `${h.show.name}${h.seasonNumber ? ` ${h.seasonNumber}` : ""}`;
  const kind = h.show.kind === "sport" ? "sport" : "show";
  const [{ rows: cast }, { rows: outs }, members, here, now_] = await Promise.all([
    pool.query("SELECT id, name, tribe_name FROM season_cast WHERE season_id = $1 ORDER BY sort_order, name", [seasonId]),
    pool.query(
      `SELECT lower(COALESCE(d.applied->>'castawayName', d.castaway_name)) AS name, min(d.episode_number)::int AS ep, min(d.method) AS how
         FROM season_decisions d WHERE d.season_id = $1 AND d.kind = 'elimination' AND d.status = 'accepted' AND d.episode_number <= $2 GROUP BY 1`,
      [seasonId, mark]
    ),
    couchId ? couchMembers([couchId]) : Promise.resolve(new Map()),
    couchId ? games(user.id, { couchIds: [couchId], seasonId }) : Promise.resolve([]),
    // G1 part 4: who is with whom now, as far as they've seen (F3's timeline from the season's research): the starting groups until then.
    groupsGoingInto(pool, seasonId, mark + 1),
  ]);
  const out = new Map(outs.map((r) => [r.name as string, { episode: r.ep as number, how: (r.how as string | null) ?? undefined }]));
  const eps = schedule?.episodes ?? [];
  const next = startFrom(schedule, now);
  const nextEp = eps.find((e) => e.number === next);
  const people = couchId ? (members.get(couchId) ?? []).length : null;
  const input: PackInput = {
    label,
    show: h.show.name,
    ...(h.seasonNumber ? { season: h.seasonNumber } : {}),
    kind,
    status: h.status,
    today: now.toISOString().slice(0, 10),
    episodes: {
      aired: eps.filter((e) => e.airAt && Date.parse(e.airAt) <= now.getTime()).length,
      ...(h.episodeCount ? { total: h.episodeCount } : {}),
      next: nextEp ? { number: nextEp.number, ...(nextEp.airAt ? { airs: nextEp.airAt } : {}) } : null,
    },
    phases: (rules.phases ?? []).map((p) => ({ id: p.id, name: p.name ?? p.id })),
    cast: cast.map((c) => {
      const gone = out.get(String(c.name).toLowerCase());
      const key = String(c.name).toLowerCase();
      const group = now_ && now_.has(key) ? now_.get(key)! : ((c.tribe_name as string | null) ?? null);
      return { id: c.id as string, name: c.name as string, in: !gone, out: gone ?? null, group: gone ? ((c.tribe_name as string | null) ?? null) : group };
    }),
    ctx: rules,
    couch: couchId ? { people, games: here.filter((g) => !g.archived).map((g) => ({ name: g.name, says: g.gameName })) } : null,
  };
  const pack = Words.packOf(input);
  const ctx: SpecContext = { ...rules, show: label, ...(people ? { couch: people } : {}), ...(pack.cast.length ? { pool: pack.stillIn } : {}) };
  return { pack, ctx, kind, show: h.show.name };
}

/** The manual for a page: generated from VOCAB, its examples the tracker's requests that play there. */
const manualFor = (ctx: SpecContext, kind: "show" | "sport", show: string) => Words.manualFor(ctx, { kind, examples: Capabilities.rowsOf(tracker as never), show });

/** Each new moment the check found, rated by the reliability ask while there's time (at most MOMENT_ASKS). */
async function rateMoments(result: CheckResult, pack: Pack, o: { bot?: string; deadline: number }): Promise<{ result: CheckResult; seconds: number }> {
  const ratings: Record<string, MomentRating> = {};
  let seconds = 0;
  for (const m of result.newMoments.slice(0, MOMENT_ASKS)) {
    const left = o.deadline - Date.now();
    if (left < MOMENT_NEEDS_MS) break;
    try {
      const a = await askBot(Words.momentPrompt({ pack, moment: m.label }), { bot: o.bot, budgetMs: left, search: false, priority: "now" });
      seconds += a.seconds;
      ratings[m.label] = Words.readMoment(a.answer);
    } catch {
      // Unrated: it stays a can't-yet, as an unreliable one would.
    }
  }
  return { result: Object.keys(ratings).length ? Words.withMoments(result, ratings, { pack }) : result, seconds };
}

/**
 * Their words to a game (`body`: { words, couch?, change?: { from: an ask's id, words } }): the pack, the manual and the prompt to our
 * bot, then our check, then the reliability ask for each new moment. Capped per person a day; the bot must be answering.
 */
export async function gameWords(user: SessionUser, seasonId: string, body: { words?: unknown; couch?: unknown; change?: unknown }, bot?: string, now = new Date()): Promise<GameWordsResult> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const couchId = typeof body.couch === "string" && body.couch ? body.couch : null;
  if (couchId) {
    if (!isUuid(couchId)) throw new HttpError(400, "couch");
    if ((await requireCouch(user, couchId)) === "viewer") throw new HttpError(403, "Join the couch to start a game on it");
  }
  const change = body.change && typeof body.change === "object" ? (body.change as { from?: unknown; words?: unknown }) : null;
  let words = typeof body.words === "string" ? body.words.trim() : "";
  let changeWords: string | null = null;
  let spec: unknown = null;
  let from: string | null = null;
  let carry: { said: unknown[]; assumed: unknown[] } | null = null;
  if (change) {
    from = typeof change.from === "string" && isUuid(change.from) ? change.from : null;
    changeWords = typeof change.words === "string" ? change.words.trim() : "";
    if (!from || !changeWords) throw new HttpError(400, "A change says which ask it changes and what to change");
    const { rows } = await pool.query("SELECT words, result FROM game_word_asks WHERE id = $1 AND user_id = $2 AND season_id = $3", [from, user.id, seasonId]);
    if (!rows[0]) throw new HttpError(404, "That ask isn't yours");
    const before = rows[0].result as { spec?: unknown; said?: unknown[]; assumed?: unknown[] } | null;
    spec = before?.spec ?? null;
    if (!spec) throw new HttpError(409, "That ask has no game to change: type it again instead");
    words = rows[0].words as string;
    // What the first ask said and assumed stays backed through the change (the bot quotes only the change's words).
    carry = { said: before?.said ?? [], assumed: before?.assumed ?? [] };
  }
  if (!words) throw new HttpError(400, "Say what game you want");
  if (words.length > 2000 || (changeWords?.length ?? 0) > 2000) throw new HttpError(400, "That's longer than a game needs: 2,000 characters at most");
  // The season (a 404) before the bot (a 503) before the cap (a 429, counted once this ask is a row).
  const { pack, ctx, kind, show } = await packFor(user, seasonId, couchId, now);
  if (!(await askBotStatus({ bot })).available) throw new HttpError(503, "Our bot isn't answering right now. Start a game's taps work.");
  const manual = manualFor(ctx, kind, show);
  const prompt = change ? Words.changePrompt({ pack, manual, words, spec, change: changeWords! }) : Words.gamePrompt({ pack, manual, words });
  const { rows } = await pool.query("INSERT INTO game_word_asks (user_id, season_id, couch_id, change_of, words, change) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", [
    user.id,
    seasonId,
    couchId,
    from,
    words,
    changeWords,
  ]);
  const id = rows[0].id as string;
  // Counted with this ask in it, so asks sent at once can't all slip under the cap; one over it is taken back.
  const { left } = await asksToday(user);
  if (left !== null && left < 0) {
    await pool.query("DELETE FROM game_word_asks WHERE id = $1", [id]);
    throw new HttpError(429, `You've asked our bot for ${GAME_ASKS_A_DAY} games today. Try again tomorrow, or start one with the taps.`);
  }
  const deadline = Date.now() + BUDGET_MS;
  try {
    const asked = await askBot(prompt, { bot, budgetMs: BUDGET_MS, search: false, priority: "now" });
    // A change's quotes come from what they typed now or first; what the first ask said and assumed comes with it (carry).
    let result: AnswerResult = Words.checkAnswer(asked.answer, { ctx, pack, words: change ? `${words}\n${changeWords}` : words, kind, carry: carry as never });
    let seconds = asked.seconds;
    if (result.state !== "unreadable" && result.newMoments.length) {
      const rated = await rateMoments(result, pack, { bot, deadline });
      result = rated.result as AnswerResult;
      seconds += rated.seconds;
    }
    await pool.query("UPDATE game_word_asks SET answer = $2, result = $3, seconds = $4 WHERE id = $1", [id, asked.answer, JSON.stringify(result), seconds]);
    return { id, result, seconds, left };
  } catch (e) {
    await pool.query("UPDATE game_word_asks SET error = $2 WHERE id = $1", [id, e instanceof Error ? e.message.slice(0, 500) : "failed"]);
    throw e;
  }
}
