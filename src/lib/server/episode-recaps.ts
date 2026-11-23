import { after } from "next/server";
import { capRecap, HEADLINE_MAX, plainHeadline, plainRecap } from "@/lib/game/recap-text";
import { showWords } from "@/lib/game/show-words";
import { askBot, askBotStatus } from "./ask-bot";
import { isUuid, type SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { askResults, resultsResearch, type ResultsResearch } from "./research-asks";
import { DEFAULT_RUNTIME_MIN, latestEnded, seasonSchedules } from "./schedule";

// Fill in what happened (db/migrations/0143): a short recap of each aired episode of a show you watch, so its Episodes tab says
// more than "Aired Fri" ("Rays 5, Brewers 3: Arozarena's two-run homer in the 8th decided it"). One ask covers every aired
// episode that hasn't one: our bot (after the response, the way Make it a game asks: make-game.ts), else a pasted answer to the
// same prompt. Recaps are the season's, shared by everyone on it, and only reach someone who has seen that episode
// (season-episodes.ts reads them through the guard's mark). A recap already filled in is never written over.
//
// The same ask looks up each episode's results too, for a show made a game that nobody plays (research-asks.ts, 0152): one
// episode at a time on the bot's clock, so the Cast tab can count stats for it. Their progress comes with the recaps' state.

const ASK_STALE_MS = 6 * 60_000;
const BUDGET_MS = 280_000;
const RECAP_MAX = 1000;

type Queryable = { query: typeof pool.query };

interface Plan {
  show: string;
  seasonLabel: string;
  kind: string;
  words: ReturnType<typeof showWords>;
  /** The aired (ended) episodes with no recap yet, each with when it aired and its listing title. */
  missing: { number: number; airAt: string | null; title: string | null }[];
}

export interface RecapState {
  /** Episodes that have ended with no recap yet (every one, seen or not: how many have aired isn't a spoiler). */
  missing: number[];
  /** Our bot is asking now. */
  asking: boolean;
  /** Why the last ask didn't work, when it didn't. */
  message: string | null;
  /** Our bot answers right now (else it's copy and paste). */
  available: boolean;
  /** Each episode's results, looked up one at a time (research-asks.ts); null where that isn't ours to do (not a game yet, a
   *  sport, or someone plays a game on it: its results come in through its games). */
  results: ResultsResearch | null;
}

/** What to ask about: the season's words and the aired episodes with no recap. */
async function planOf(seasonId: string, db: Queryable = pool): Promise<Plan> {
  const [schedules, { rows }, { rows: have }] = await Promise.all([
    seasonSchedules([seasonId]),
    db.query(
      `SELECT s.name, s.kind, s.castaway_term, s.castaway_plural, s.episode_term, ss.season_number, ss.name AS season_name
         FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.id = $1`,
      [seasonId]
    ),
    db.query("SELECT number FROM season_episodes WHERE season_id = $1 AND summary IS NOT NULL", [seasonId]),
  ]);
  const r = rows[0];
  const schedule = schedules.get(seasonId);
  if (!r || !schedule) throw new HttpError(404, "Season not found");
  const ended = latestEnded(schedule);
  const done = new Set(have.map((h) => h.number as number));
  const show = (r.name as string).replace(/\s*\([^)]*\)\s*$/, "").trim() || r.name;
  return {
    show,
    seasonLabel: r.season_name || (r.season_number ? `season ${r.season_number}` : "this season"),
    kind: r.kind,
    words: showWords({ castaway: r.castaway_term, people: r.castaway_plural, episode: r.episode_term }),
    // Only the newest RECAP_WINDOW aired episodes (a sport's long season never asks about a whole year at once).
    missing: schedule.episodes
      .filter((e) => e.number <= ended && e.number > ended - RECAP_WINDOW && !done.has(e.number))
      .map((e) => ({ number: e.number, airAt: e.airAt, title: e.title })),
  };
}

/** The question: what happened in each missing episode, as JSON. */
export function recapPrompt(plan: Plan): string {
  const word = plan.words.episode.toLowerCase();
  const sport = plan.kind === "sport";
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" }) : null);
  const lines = plan.missing.map((e) => `- ${plan.words.episode} ${e.number}${e.airAt ? `, aired ${day(e.airAt)}` : ""}${e.title ? `: "${e.title}"` : ""}`);
  return [
    `Search the web for what happened in each of these ${plan.words.episodes.toLowerCase()} of ${plan.show} (${plan.seasonLabel}). Answer with JSON only, in this shape:`,
    `{"episodes": [{"number": 1, "headline": "...", "summary": "..."}]}`,
    sport
      ? `Each summary is two or three plain sentences in the past tense: the final score and who won first, then what decided it and who stood out.`
      : `Each summary is two or three plain sentences in the past tense: the main things that happened in that ${word}, and who left or won anything, if anyone did. Say who was voted out and how, but leave out vote counts and tallies (no "6–5").`,
    sport
      ? `Each headline is one line of ${HEADLINE_MAX} characters or fewer: the final score with who won, the way a scoreboard puts it.`
      : `Each headline is one line of ${HEADLINE_MAX} characters or fewer, in the past tense, the way a TV recap would title it: who left and how (a vote, a blindside, a quit, a twist), or the ${word}'s biggest moment if nobody left. Name everyone who left. No vote counts. No semicolons: join two facts with a comma.`,
    `Say only what the recaps and reports say, in plain words: no links, sources or citations. Leave out any ${word} you can't find a recap of. "number" is the ${word}'s number below.`,
    ``,
    `The ${plan.words.episodes.toLowerCase()}:`,
    ...lines,
  ].join("\n");
}

/**
 * An answer's episodes: its JSON (fenced or not), or none. The bot's answer can hold a cut-off copy of the JSON before the whole
 * one (seen 2026-11-23 asking for Survivor 51's nine: the first `{` to the last `}` spanned both, so nothing was read), so each
 * `{` that opens an "episodes" object is tried, the last first, as far as the last `}`. With none whole, each episode object
 * that parses on its own is kept.
 */
function answerEpisodes(answer: string): unknown[] {
  const text = answer.replace(/```(?:json)?/gi, "");
  const to = text.lastIndexOf("}");
  if (to < 0) return [];
  const starts = [...text.matchAll(/\{\s*"episodes"\s*:/g)].map((m) => m.index ?? 0).reverse();
  for (const from of starts.length ? starts : [text.indexOf("{")]) {
    if (from < 0 || to <= from) continue;
    try {
      const list = (JSON.parse(text.slice(from, to + 1)) as { episodes?: unknown })?.episodes;
      if (Array.isArray(list)) return list;
    } catch {
      // a cut-off copy: try the next
    }
  }
  const salvaged = new Map<number, unknown>();
  for (const m of text.matchAll(/\{\s*"number"\s*:\s*\d+[^{}]*\}/g)) {
    try {
      const e = JSON.parse(m[0]) as { number?: unknown };
      salvaged.set(Number(e.number), e);
    } catch {
      // not a whole object
    }
  }
  return [...salvaged.values()];
}

/** The recaps in an answer: its JSON (fenced or not), each one for an episode we asked about, trimmed. */
export function readRecaps(answer: string, asked: number[]): Map<number, string> {
  const out = new Map<number, string>();
  const list = answerEpisodes(answer);
  if (!list.length) return out;
  const want = new Set(asked);
  for (const e of list) {
    const n = Number((e as { number?: unknown })?.number);
    const s = (e as { summary?: unknown })?.summary;
    if (!want.has(n) || typeof s !== "string" || !s.trim()) continue;
    const clean = capRecap(plainRecap(s), RECAP_MAX);
    if (clean) out.set(n, clean);
  }
  return out;
}

/** The headlines in an answer (migration 0456), each one for an episode we asked about, one clean line of HEADLINE_MAX (45)
 *  characters or none (plainHeadline: a headline too long is dropped, never cut). */
export function readHeadlines(answer: string, asked: number[]): Map<number, string> {
  const out = new Map<number, string>();
  const want = new Set(asked);
  for (const e of answerEpisodes(answer)) {
    const n = Number((e as { number?: unknown })?.number);
    const h = plainHeadline((e as { headline?: unknown })?.headline);
    if (want.has(n) && h) out.set(n, h);
  }
  return out;
}

/** Write the recaps with their headlines (never over a recap that's there). Answers how many were new. */
async function saveRecaps(seasonId: string, recaps: Map<number, string>, headlines: Map<number, string> = new Map(), db: Queryable = pool): Promise<number> {
  let n = 0;
  for (const [number, summary] of recaps) {
    const { rowCount } = await db.query(
      `INSERT INTO season_episodes (season_id, number, summary, headline, summary_at, source) VALUES ($1, $2, $3, $4, now(), 'listing')
       ON CONFLICT (season_id, number) DO UPDATE SET summary = EXCLUDED.summary, headline = EXCLUDED.headline, summary_at = now()
        WHERE season_episodes.summary IS NULL`,
      [seasonId, number, summary, headlines.get(number) ?? null]
    );
    n += rowCount ?? 0;
  }
  return n;
}

/** Someone who follows the season or plays it (anyone else has no reason to fill it in). */
export async function mayFill(userId: string, seasonId: string): Promise<void> {
  if (!isUuid(seasonId)) throw new HttpError(404, "Season not found");
  const { rows } = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM show_follows WHERE user_id = $1 AND season_id = $2 AND following)
         OR EXISTS (SELECT 1 FROM league_memberships m JOIN leagues l ON l.id = m.league_id ${LEAGUE_SEASON_JOIN} WHERE m.user_id = $1 AND ss.id = $2) AS ok`,
    [userId, seasonId]
  );
  if (!rows[0]?.ok) throw new HttpError(403, "Add it to your shows first");
}

// The bot's health, asked at most every 20 s (the card polls while results come in one at a time).
let health: { at: number; available: boolean } | null = null;
async function botAvailable(bot?: string): Promise<boolean> {
  // A check's stand-in (next dev only) is asked every time, so it going down is seen at once.
  if (bot) return (await askBotStatus({ bot })).available;
  if (health && Date.now() - health.at < 20_000) return health.available;
  const { available } = await askBotStatus();
  health = { at: Date.now(), available };
  return available;
}

export async function recapState(user: SessionUser, seasonId: string, bot?: string): Promise<RecapState> {
  await mayFill(user.id, seasonId);
  const [plan, { rows }, available, results, seen] = await Promise.all([
    planOf(seasonId),
    pool.query("SELECT asking_at, message FROM episode_fills WHERE season_id = $1", [seasonId]),
    botAvailable(bot),
    resultsResearch(seasonId),
    seenThrough(user.id, seasonId),
  ]);
  // An episode you haven't seen: how far its answer has got, but not how many people it's about (who's still in by then).
  if (results?.now && seen !== EVERYTHING && seen < results.now.episode) results.now = { ...results.now, done: null, of: null };
  const asking = !!rows[0]?.asking_at && Date.now() - new Date(rows[0].asking_at).getTime() < ASK_STALE_MS;
  return { missing: plan.missing.map((e) => e.number), asking, message: asking ? null : (rows[0]?.message ?? null), available, results };
}

/** The prompt to copy, for copy and paste. */
export async function recapPromptFor(user: SessionUser, seasonId: string): Promise<{ prompt: string }> {
  await mayFill(user.id, seasonId);
  const plan = await planOf(seasonId);
  if (!plan.missing.length) throw new HttpError(409, "Every one that's aired is filled in already");
  return { prompt: recapPrompt(plan) };
}

/**
 * Ask our bot, after this answers (one ask a season at a time: one already going is joined): the recaps still missing, and
 * each episode's results still missing (or that failed), queued one at a time (research-asks.ts).
 */
export async function askRecaps(user: SessionUser, seasonId: string, bot?: string): Promise<RecapState> {
  await mayFill(user.id, seasonId);
  const [plan, results] = await Promise.all([planOf(seasonId), resultsResearch(seasonId)]);
  const resultsToAsk = !!results && (results.missing.length > 0 || results.asked.some((a) => a.status === "failed"));
  if (!plan.missing.length && !resultsToAsk) throw new HttpError(409, "Every one that's aired is filled in already");
  if (!(await botAvailable(bot))) throw new HttpError(503, "Our bot isn't answering right now. Copy and paste works.");
  if (plan.missing.length) {
    const { rowCount } = await pool.query(
      `INSERT INTO episode_fills (season_id, asking_at, asked_by, message) VALUES ($1, now(), $2, NULL)
       ON CONFLICT (season_id) DO UPDATE SET asking_at = now(), asked_by = $2, message = NULL, updated_at = now()
        WHERE episode_fills.asking_at IS NULL OR episode_fills.asking_at < now() - make_interval(secs => $3)`,
      [seasonId, user.id, ASK_STALE_MS / 1000]
    );
    if (rowCount) after(() => runAsk(seasonId, bot).catch(() => undefined));
  }
  if (resultsToAsk) await askResults(user.id, seasonId);
  return recapState(user, seasonId, bot);
}

/** Our bot's ask: the recaps still missing, saved. How many it filled in; a failed ask is recorded on the card, then thrown. */
async function runAsk(seasonId: string, bot?: string, budgetMs = BUDGET_MS): Promise<number> {
  const done = (message: string | null, filled: number | null) =>
    pool.query("UPDATE episode_fills SET asking_at = NULL, message = $2, filled = $3, updated_at = now() WHERE season_id = $1", [seasonId, message, filled]);
  try {
    const plan = await planOf(seasonId);
    const { answer } = await askBot(recapPrompt(plan), { bot, budgetMs });
    const asked = plan.missing.map((e) => e.number);
    const recaps = readRecaps(answer, asked);
    if (!recaps.size) throw new Error("ChatGPT didn't find any recaps. Try again later, or paste an answer.");
    const filled = await saveRecaps(seasonId, recaps, readHeadlines(answer, asked));
    await done(null, filled);
    return filled;
  } catch (e) {
    await done((e instanceof Error ? e.message : "ChatGPT didn't answer").slice(0, 300), null).catch((err) => console.error("[recaps] couldn't record", seasonId, err));
    throw e;
  }
}

/** The aired episodes still without a recap. */
export async function recapsMissing(seasonId: string): Promise<number[]> {
  return (await planOf(seasonId)).missing.map((e) => e.number);
}

/**
 * Getting it ready (season-fill.ts): the recaps still missing, asked now within `budgetMs` (the card shows it asking meanwhile,
 * as a tap would). How many it filled in, or null when an ask is going already (someone's tap: theirs does it). A failed ask
 * throws.
 */
export async function recapsByItself(seasonId: string, userId: string | null, bot: string | undefined, budgetMs: number): Promise<number | null> {
  const { rowCount } = await pool.query(
    `INSERT INTO episode_fills (season_id, asking_at, asked_by, message) VALUES ($1, now(), $2, NULL)
     ON CONFLICT (season_id) DO UPDATE SET asking_at = now(), asked_by = $2, message = NULL, updated_at = now()
      WHERE episode_fills.asking_at IS NULL OR episode_fills.asking_at < now() - make_interval(secs => $3)`,
    [seasonId, userId, ASK_STALE_MS / 1000]
  );
  if (!rowCount) return null;
  return runAsk(seasonId, bot, budgetMs);
}

/** Copy and paste: the answer to the prompt, read and saved now. */
export async function pasteRecaps(user: SessionUser, seasonId: string, answer: unknown): Promise<RecapState & { filled: number }> {
  await mayFill(user.id, seasonId);
  const text = typeof answer === "string" ? answer.trim() : "";
  if (!text) throw new HttpError(400, "Paste the AI's whole answer");
  if (text.length > 100_000) throw new HttpError(400, "That's too long to be the answer");
  const plan = await planOf(seasonId);
  const asked = plan.missing.map((e) => e.number);
  const recaps = readRecaps(text, asked);
  if (!recaps.size) throw new HttpError(400, "That answer has no recaps in it. Paste the AI's whole answer, JSON and all.");
  const filled = await saveRecaps(seasonId, recaps, readHeadlines(text, asked));
  return { ...(await recapState(user, seasonId)), filled };
}

// ---------- the research clock's own asks ----------
// Every show gets its write-ups and headlines (the user, 2026-11-23: "All shows should have summaries. The challenge, traitors,
// survivor etc, I think even sports"). Before, they were asked only for a show nobody plays (a tap on Episodes, or Getting it
// ready), so a game's season (Survivor's) never had one. Now the bot research clock (api/cron/bot-research) asks for a season
// someone follows or plays once its newest aired episodes lack one: the clock's last job, after results, Getting it ready and
// the catch-up, one season a call.

/** An episode's write-up is asked for this long after it ends (recaps are up by then). */
const RECAP_DELAY_MS = 2 * 3600_000;
/** An episode already asked about waits this long before it's asked again: 6 hours after an ask that found some, a day after
 *  one that found none or failed (an episode nobody's written up isn't asked about all day). */
const RECAP_AGAIN_MS = 6 * 3600_000;
const RECAP_AGAIN_EMPTY_MS = 24 * 3600_000;
/** Only a season's newest aired episodes are asked about, so a sport's long season never backfills a whole year. */
export const RECAP_WINDOW = 10;

/**
 * When a season's write-ups are next due (ms), from when each missing episode ended and its last ask (null: never asked): each
 * episode two hours after it ended, and one that was already due at the last ask not before that ask's wait is up (a new
 * episode never waits on an old one nobody wrote up). Null when nothing's missing.
 */
export function recapsDueAt(missingEnds: number[], last: { at: number; filled: number | null } | null): number | null {
  let due: number | null = null;
  for (const end of missingEnds) {
    let at = end + RECAP_DELAY_MS;
    if (last && at <= last.at) at = Math.max(at, last.at + (last.filled ? RECAP_AGAIN_MS : RECAP_AGAIN_EMPTY_MS));
    due = due == null ? at : Math.min(due, at);
  }
  return due;
}

/** Every season someone follows or plays, with when its write-ups are next due (the ones with something missing). */
async function recapPlans(now: Date): Promise<{ seasonId: string; at: number }[]> {
  const { rows: seasons } = await pool.query(
    `SELECT ss.id::text AS id FROM leagues l ${LEAGUE_SEASON_JOIN}
     UNION SELECT season_id::text FROM show_follows WHERE following`
  );
  const ids = seasons.map((r) => r.id as string);
  if (!ids.length) return [];
  const [schedules, { rows: have }, { rows: asks }] = await Promise.all([
    seasonSchedules(ids, now),
    pool.query("SELECT season_id::text AS season, number FROM season_episodes WHERE season_id = ANY($1::uuid[]) AND summary IS NOT NULL", [ids]),
    pool.query("SELECT season_id::text AS season, asking_at, updated_at, filled, message FROM episode_fills WHERE season_id = ANY($1::uuid[])", [ids]),
  ]);
  const done = new Set(have.map((h) => `${h.season}:${h.number}`));
  const askOf = new Map(asks.map((a) => [a.season as string, a]));
  const out: { seasonId: string; at: number }[] = [];
  for (const id of ids) {
    const schedule = schedules.get(id);
    if (!schedule) continue;
    const ended = latestEnded(schedule, now);
    const binge = schedule.release === "binge";
    const ends = schedule.episodes
      .filter((e) => e.airAt && e.number <= ended && e.number > ended - RECAP_WINDOW && !done.has(`${id}:${e.number}`))
      .map((e) => new Date(e.airAt!).getTime() + (binge ? 0 : (e.runtimeMin ?? DEFAULT_RUNTIME_MIN) * 60_000));
    const a = askOf.get(id);
    const asking = a?.asking_at ? new Date(a.asking_at).getTime() : null;
    // An ask going now: due again only once it's gone stale (an ask that died), as recapsByItself takes it then.
    if (asking && now.getTime() - asking < ASK_STALE_MS) {
      if (ends.length) out.push({ seasonId: id, at: asking + ASK_STALE_MS });
      continue;
    }
    const last = a ? { at: asking ?? new Date(a.updated_at).getTime(), filled: a.message ? 0 : ((a.filled as number | null) ?? null) } : null;
    const at = recapsDueAt(ends, last);
    if (at != null) out.push({ seasonId: id, at });
  }
  return out.sort((x, y) => x.at - y.at);
}

/** When the clock's next write-up ask comes due (null: none). */
export async function recapsNextAt(now = new Date()): Promise<Date | null> {
  const first = (await recapPlans(now))[0];
  return first ? new Date(first.at) : null;
}

/** The clock's write-up ask: the earliest season that's due, asked now within `budgetMs`. Null when none is due; a failed ask
 *  is recorded on its season (episode_fills) and answered here, never thrown, so the clock goes on. */
export async function runDueRecaps(o: { bot?: string; budgetMs: number; now?: Date }): Promise<{ season: string; filled: number | null; error?: string } | null> {
  const now = o.now ?? new Date();
  const due = (await recapPlans(now)).find((p) => p.at <= now.getTime());
  if (!due) return null;
  try {
    return { season: due.seasonId, filled: await recapsByItself(due.seasonId, null, o.bot, o.budgetMs) };
  } catch (e) {
    return { season: due.seasonId, filled: null, error: e instanceof Error ? e.message : "the ask failed" };
  }
}
