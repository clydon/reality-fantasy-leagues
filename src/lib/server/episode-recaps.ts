import { after } from "next/server";
import { showWords } from "@/lib/game/show-words";
import { askBot, askBotStatus } from "./ask-bot";
import { isUuid, type SessionUser } from "./auth-helpers";
import { pool, HttpError } from "./db";
import { EVERYTHING, seenThrough } from "./guard";
import { LEAGUE_SEASON_JOIN } from "./league-season";
import { askResults, resultsResearch, type ResultsResearch } from "./research-asks";
import { latestEnded, seasonSchedules } from "./schedule";

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
      `SELECT s.name, s.kind, s.castaway_term, s.episode_term, ss.season_number, ss.name AS season_name
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
    words: showWords({ castaway: r.castaway_term, episode: r.episode_term }),
    missing: schedule.episodes.filter((e) => e.number <= ended && !done.has(e.number)).map((e) => ({ number: e.number, airAt: e.airAt, title: e.title })),
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
    `{"episodes": [{"number": 1, "summary": "..."}]}`,
    sport
      ? `Each summary is two or three plain sentences: the final score and who won first, then what decided it and who stood out.`
      : `Each summary is two or three plain sentences: the main things that happened in that ${word}, and who left or won anything, if anyone did.`,
    `Say only what the recaps and reports say. Leave out any ${word} you can't find a recap of. "number" is the ${word}'s number below.`,
    ``,
    `The ${plan.words.episodes.toLowerCase()}:`,
    ...lines,
  ].join("\n");
}

/** The recaps in an answer: its JSON (fenced or not), each one for an episode we asked about, trimmed. */
export function readRecaps(answer: string, asked: number[]): Map<number, string> {
  const out = new Map<number, string>();
  const text = answer.replace(/```(?:json)?/gi, "");
  const from = text.indexOf("{");
  const to = text.lastIndexOf("}");
  if (from < 0 || to <= from) return out;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(from, to + 1));
  } catch {
    return out;
  }
  const list = (parsed as { episodes?: unknown })?.episodes;
  if (!Array.isArray(list)) return out;
  const want = new Set(asked);
  for (const e of list) {
    const n = Number((e as { number?: unknown })?.number);
    const s = (e as { summary?: unknown })?.summary;
    if (!want.has(n) || typeof s !== "string" || !s.trim()) continue;
    out.set(n, s.trim().replace(/\s+/g, " ").slice(0, RECAP_MAX));
  }
  return out;
}

/** Write the recaps (never over one that's there). Answers how many were new. */
async function saveRecaps(seasonId: string, recaps: Map<number, string>, db: Queryable = pool): Promise<number> {
  let n = 0;
  for (const [number, summary] of recaps) {
    const { rowCount } = await db.query(
      `INSERT INTO season_episodes (season_id, number, summary, summary_at, source) VALUES ($1, $2, $3, now(), 'listing')
       ON CONFLICT (season_id, number) DO UPDATE SET summary = EXCLUDED.summary, summary_at = now() WHERE season_episodes.summary IS NULL`,
      [seasonId, number, summary]
    );
    n += rowCount ?? 0;
  }
  return n;
}

/** Someone who follows the season or plays it (anyone else has no reason to fill it in). */
async function mayFill(userId: string, seasonId: string): Promise<void> {
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
    if (rowCount) after(() => runAsk(seasonId, bot));
  }
  if (resultsToAsk) await askResults(user.id, seasonId);
  return recapState(user, seasonId, bot);
}

async function runAsk(seasonId: string, bot?: string): Promise<void> {
  const done = (message: string | null, filled: number | null) =>
    pool.query("UPDATE episode_fills SET asking_at = NULL, message = $2, filled = $3, updated_at = now() WHERE season_id = $1", [seasonId, message, filled]);
  try {
    const plan = await planOf(seasonId);
    const { answer } = await askBot(recapPrompt(plan), { bot, budgetMs: BUDGET_MS });
    const recaps = readRecaps(answer, plan.missing.map((e) => e.number));
    if (!recaps.size) throw new Error("ChatGPT didn't find any recaps. Try again later, or paste an answer.");
    await done(null, await saveRecaps(seasonId, recaps));
  } catch (e) {
    await done((e instanceof Error ? e.message : "ChatGPT didn't answer").slice(0, 300), null).catch((err) => console.error("[recaps] couldn't record", seasonId, err));
  }
}

/** Copy and paste: the answer to the prompt, read and saved now. */
export async function pasteRecaps(user: SessionUser, seasonId: string, answer: unknown): Promise<RecapState & { filled: number }> {
  await mayFill(user.id, seasonId);
  const text = typeof answer === "string" ? answer.trim() : "";
  if (!text) throw new HttpError(400, "Paste the AI's whole answer");
  if (text.length > 100_000) throw new HttpError(400, "That's too long to be the answer");
  const plan = await planOf(seasonId);
  const recaps = readRecaps(text, plan.missing.map((e) => e.number));
  if (!recaps.size) throw new HttpError(400, "That answer has no recaps in it. Paste the AI's whole answer, JSON and all.");
  const filled = await saveRecaps(seasonId, recaps);
  return { ...(await recapState(user, seasonId)), filled };
}
