import StateLogic from "@/lib/game/state-logic.js";
import * as Spec from "@/lib/game/game-spec/index.js";
import type { TriviaKeyItem } from "@/lib/game/game-spec/index.js";
import type { LeagueState } from "@/lib/game/types";
import { randomFrom, shuffled } from "@/lib/game/seeded";
import { pool } from "./db";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { seasonSchedules } from "./schedule";

// A13: the episode's trivia key, for a game that asks trivia (docs/PLAN-start-a-game-gpt.md step A13; game-spec schema.js's trivia
// answer). The key is the bot's trivia research as it's written and checked today (db/trivia-research.js, bot research's 'trivia'
// run: a batch a day before each episode, about the one before it and the season so far, each question live once a second ask
// passed it; trivia_questions, 0140). A game's round before episode N is the batch written after episode N - 1, so its window is N,
// closing as N starts, and nobody answers about an episode they haven't seen. Read on each read of the game (the grader's
// facts.trivia, the round's questions), never stored, as it stood at the round's lock: a question written after N started (a batch
// that came late) isn't in it, so a round can't be answered after it closes, and one whose batch came too late is void; a batch
// written again once its round has locked is added to, never replaced (db/trivia-research.js storeTrivia's `keep`), so a round
// graded on it keeps its key. A question pulled from a game is an admin's pull alone: two people's flags take it out of the trivia
// sheet (trivia.ts), but a game is settled by data, never the couch's word.
//
// The trivia sheet shows each answer as it's tapped (show/trivia.tsx), so a batch a game's round is about is held back from the
// sheet of anyone playing that game until the round locks (heldFromSheet, for trivia.ts), and a question someone played there before
// can't be answered in the game (playedInSheet, for answers.ts).

/** A question an admin pulled: the only pull a game's round follows. On `q`. */
const ADMIN_PULLED = `EXISTS (SELECT 1 FROM trivia_flags f JOIN "user" u ON u.id = f.user_id WHERE f.question_id = q.id AND u.role = 'admin')`;
/** A question pulled from everyone: two people said it's wrong, or an admin did (the trivia sheet's rounds leave these out). On `q`. */
export const TRIVIA_PULLED = `(${ADMIN_PULLED} OR (SELECT count(*) FROM trivia_flags f WHERE f.question_id = q.id) >= 2)`;

/** Whether a game asks the episode's trivia (a trivia question in its spec). */
export const asksTrivia = (state: LeagueState): boolean => StateLogic.AnswerLogic.questions(state).some(Spec.isTrivia);

/** When each of a season's episodes airs (its schedule), by number: null for one with no date yet; an episode the schedule doesn't
 *  have isn't in it. */
async function airTimes(seasonId: string): Promise<Map<number, number | null>> {
  const schedule = (await seasonSchedules([seasonId])).get(seasonId);
  return new Map((schedule?.episodes ?? []).map((e) => [e.number, e.airAt ? Date.parse(e.airAt) : null]));
}

/**
 * A question's options as a round shows them: shuffled, the same for everyone (seeded by the question), as the trivia sheet deals them
 * (trivia.ts asked), because the bot writes the right answer first far more often than not and last almost never (the blind
 * replays' tapes: of 350 live questions that aren't numbers, on five seasons, 221 first and 9 last); a number's stay smallest first.
 */
const shownOptions = (id: string, kind: string, options: string[]) => (kind === "number" ? options : shuffled(options, randomFrom(`trivia|${id}`)));

/**
 * Each round's trivia key for a game that asks trivia, by the episode the round is before (made_after + 1), in the order the bot
 * wrote it (each question's options shuffled: shownOptions), as it stood when that episode started: undefined for a game that asks
 * none, or one on no season. A round with no live
 * question then has no entry (the grader's void). The league's season is its settings' show and number (push-events.ts
 * leagueSeason's), so a copy or a stage reads its own.
 */
export async function triviaKeyFor(state: LeagueState): Promise<Map<number, TriviaKeyItem[]> | undefined> {
  if (!asksTrivia(state)) return undefined;
  const s = state.settings ?? {};
  if (!s.showId || s.wikiSeason == null) return undefined;
  const { rows } = await pool.query(
    `SELECT q.id, q.season_id, q.made_after, q.episode, q.kind, q.question, q.options, q.answer, q.why, q.source, q.created_at
       FROM trivia_questions q JOIN show_seasons ss ON ss.id = q.season_id JOIN shows sh ON sh.id = ss.show_id
      WHERE sh.slug = $1 AND ss.season_number::text = $2::text AND q.status = 'live' AND NOT ${ADMIN_PULLED}
      ORDER BY q.made_after, q.created_at, q.id`,
    [s.showId, String(s.wikiSeason)]
  );
  const out = new Map<number, TriviaKeyItem[]>();
  if (!rows.length) return out;
  const airs = await airTimes(rows[0].season_id as string);
  for (const r of rows) {
    const n = (r.made_after as number) + 1;
    // Written once the round had locked (its episode's start: the league's own air time, else the schedule's): not its key.
    const own = state.episodes?.find((e) => e.number === n)?.airsAt;
    const at = own ? Date.parse(own) : airs.get(n);
    if (at != null && new Date(r.created_at).getTime() >= at) continue;
    const item: TriviaKeyItem = {
      id: r.id as string,
      seasonId: r.season_id as string,
      answer: r.answer as string,
      episode: r.episode as number,
      kind: r.kind as TriviaKeyItem["kind"],
      question: r.question as string,
      options: shownOptions(r.id as string, r.kind as string, Array.isArray(r.options) ? (r.options as string[]) : []),
      why: (r.why as string | null) ?? null,
      source: (r.source as string | null) ?? null,
    };
    out.set(n, [...(out.get(n) ?? []), item]);
  }
  return out;
}

/**
 * Whether a season's research writes trivia (the data-can-settle rule's ctx.trivia): its schedule (its own, else our usual) has a
 * trivia run switched on. Whether research runs for the season at all is the desk's to switch on, so it isn't asked here; a round
 * whose key never comes is void either way.
 */
export async function triviaWritten(seasonId: string): Promise<boolean> {
  const { rows } = await pool.query("SELECT bot_research_schedule FROM show_seasons WHERE id = $1", [seasonId]);
  if (!rows[0]) return true;
  const BotResearch = await import("@db/bot-research.js");
  const own = rows[0].bot_research_schedule;
  const runs = BotResearch.normalizeSchedule(own, own == null ? await BotResearch.usualSchedule(pool) : undefined);
  return runs.some((r) => r.kind === "trivia" && r.on);
}

/**
 * Of a round's questions (the batch written after `madeAfter` on `seasonId`), the ones an account has already played in the trivia
 * sheet, where it saw the right answers: every one of the batch once it played the batch's own round there (all its questions' answers
 * come with it), else those a play answered (trivia_plays, keyed "r:<id>"). A game's answer to one of them can't be given or changed
 * after (answers.ts), so nobody scores in a game by having looked it up there.
 */
export async function playedInSheet(userId: string, seasonId: string | null, madeAfter: number, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { rows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM trivia_plays WHERE user_id = $1 AND round = $2) AS round,
            ARRAY(SELECT DISTINCT substr(k, 3) FROM trivia_plays t, jsonb_object_keys(t.answers) k WHERE t.user_id = $1 AND k = ANY($3::text[])) AS ids`,
    [userId, `${seasonId}:${madeAfter}`, ids.map((id) => `r:${id}`)]
  );
  return rows[0].round ? new Set(ids) : new Set(rows[0].ids as string[]);
}

/**
 * For the trivia sheet (trivia.ts): which researched batches to hold back from an account, as (seasonId, madeAfter) => held. A game's
 * questions and late lock are its settings' (settings.questions, lateLockHours), or its carried spec's (settings.game). A batch is
 * the key of a game's round before episode madeAfter + 1, so while the account plays a game on its season that asks trivia, it's held
 * until that round has locked for them (the episode's air time, plus the game's late lock: someone who hasn't seen it can answer that
 * long). Nothing held for anyone who plays no such game.
 */
export async function heldFromSheet(userId: string, seasonIds: string[], now: Date): Promise<(seasonId: string, madeAfter: number) => boolean> {
  if (!seasonIds.length) return () => false;
  const { rows } = await pool.query(
    `SELECT ss.id AS season_id, max(COALESCE((l.state->'settings'->>'lateLockHours')::int, (l.state->'settings'->'game'->'extras'->'lateLock'->>'hours')::int, 0)) AS late
       FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN}
      WHERE m.user_id = $1 AND l.deleted_at IS NULL AND ss.id = ANY($2::uuid[])
        AND (l.state->'settings'->'questions' @> '[{"answer":"trivia"}]'::jsonb OR l.state->'settings'->'game'->'ask' @> '[{"answer":"trivia"}]'::jsonb)
      GROUP BY ss.id`,
    [userId, seasonIds]
  );
  if (!rows.length) return () => false;
  const late = new Map(rows.map((r) => [r.season_id as string, Number(r.late) || 0]));
  const airs = new Map(await Promise.all([...late.keys()].map(async (id) => [id, await airTimes(id)] as const)));
  // Held while the round it's the key of hasn't locked: its episode not aired (or not dated yet). A batch with no episode after it on
  // the schedule (written after the finale) is no game's round: never held.
  return (seasonId, madeAfter) => {
    if (!late.has(seasonId)) return false;
    const next = airs.get(seasonId);
    if (!next?.has(madeAfter + 1)) return false;
    const at = next.get(madeAfter + 1);
    return at == null || now.getTime() < at + (late.get(seasonId) ?? 0) * 3600 * 1000;
  };
}
