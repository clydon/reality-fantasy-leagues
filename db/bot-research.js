// Bot research (experimental, db/migrations/0065): the ask-AI bot -- a ChatGPT session on our own VM
// (src/lib/server/ask-bot.ts) -- asks about each episode on a schedule counted from when it ENDS (its
// air time plus the season's episode length, 0066), for free. A season's schedule is a list of runs, by
// default:
//
//   quick @   5 min -- who left the game and the episode's headline, while it's still news
//   full  @  60 min -- the whole research checklist, staged for review like a pasted answer
//   full  @ 540 min -- the checklist again once the overnight recaps are up, merged into the first
//
// Each call to POST /api/cron/bot-research runs at most one due run (the bot answers one question at a
// time anyway) and says when the next one comes due (nextRunAt). The VM's tick calls only then, so the
// database sleeps between runs (docs/HOSTING.md: on Neon's Free plan a database never left idle for 5
// minutes uses up the month's compute). Nothing reaches a league by itself: full runs stage season
// decisions for an admin, exactly like the Research button.
const Air = require("../src/lib/game/air-schedule.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const AutoResearch = require("./auto-research.js");
const Research = require("./episode-research.js");

const KINDS = ["quick", "full"];
const DEFAULT_SCHEDULE = [
  { kind: "quick", after: 5, on: true },
  { kind: "full", after: 60, on: true },
  { kind: "full", after: 540, on: true },
];
const MAX_RUNS = 8;
// Two weeks: a run after that is about an episode nobody is waiting on.
const MAX_AFTER = 14 * 24 * 60;

// A season that hasn't said how long its episodes run (show_seasons.episode_minutes).
const DEFAULT_EPISODE_MINUTES = 60;
const MIN = 60 * 1000;

// A run still marked running after this long was cut off (the route's 300s ceiling, a redeploy):
// it counts as a failed attempt.
const RUNNING_STALE_MS = 10 * MIN;
const MAX_ATTEMPTS = 3;
// A full run: three tries, 20 minutes apart.
const FULL_RETRY_MS = 20 * MIN;
// A quick check is the fast "who went home". Recaps and live blogs land 5 to 30 minutes after an episode
// ends, later when it ran long, and ChatGPT's search lags them a little: so it keeps trying, every 5
// minutes for its first half hour, then every 15, until 3 hours after it was due (and at least three
// tries, for one that started late).
const QUICK = { fastMs: 5 * MIN, fastForMs: 30 * MIN, slowMs: 15 * MIN, windowMs: 3 * 60 * MIN, maxTries: 20 };
// How late a run is still worth doing at all (the VM was down, say). A quick check is news for hours; a
// full one is useful for days.
const STALE_MS = { quick: 12 * 60 * MIN, full: 3 * 24 * 60 * MIN };

const slotOf = (run) => `${run.kind}@${run.after}`;

/**
 * When one run (a slot of one episode, due at `due`) may next be tried, or null for never: `due` itself
 * before any try; after a failure, the retry pace; never once it has succeeded, used up its tries or gone
 * stale. A try still marked running holds it until it's cut off. The one rule dueRuns (what to run now)
 * and nextRunAt (when to come back) both read, so they never disagree. Pure.
 */
function nextTryAt(kind, due, tries) {
  if (tries.some((h) => h.ok === true)) return null;
  const at = due.getTime();
  let next = at;
  if (tries.length) {
    const last = Math.max(...tries.map((h) => new Date(h.started_at).getTime()));
    if (kind === "quick") {
      if (tries.length >= QUICK.maxTries) return null;
      next = last + (last - at < QUICK.fastForMs ? QUICK.fastMs : QUICK.slowMs);
      if (tries.length >= MAX_ATTEMPTS && next - at > QUICK.windowMs) return null;
    } else {
      if (tries.length >= MAX_ATTEMPTS) return null;
      next = last + FULL_RETRY_MS;
    }
    for (const h of tries) if (h.ok == null) next = Math.max(next, new Date(h.started_at).getTime() + RUNNING_STALE_MS);
  }
  return next - at > STALE_MS[kind] ? null : new Date(next);
}

/** Every scheduled slot of every episode, with when it's due: the episode's end (its own length when research
 *  confirmed one, else the season's) plus the run's minutes. */
function slots({ schedule, since, airTimes, episodeMinutes = 0, history }) {
  const out = [];
  for (const { episode, at: airedAt, minutes } of airTimes) {
    for (const run of schedule) {
      if (!run.on) continue;
      const due = new Date(airedAt.getTime() + ((minutes ?? episodeMinutes) + run.after) * MIN);
      if (since && due < since) continue;
      const slot = slotOf(run);
      const tries = history.filter((h) => h.episode_number === episode && h.slot === slot);
      out.push({ episode, slot, kind: run.kind, after: run.after, at: due, next: nextTryAt(run.kind, due, tries) });
    }
  }
  return out;
}

/** A schedule from a request body or the column, cleaned up; throws on anything malformed. */
function normalizeSchedule(input) {
  if (input == null) return DEFAULT_SCHEDULE.map((r) => ({ ...r }));
  if (!Array.isArray(input)) throw new Error("schedule must be a list of runs");
  if (input.length > MAX_RUNS) throw new Error(`At most ${MAX_RUNS} runs`);
  const out = input.map((r) => {
    const kind = r && r.kind;
    const after = Number(r && r.after);
    if (!KINDS.includes(kind)) throw new Error(`A run's kind must be ${KINDS.join(" or ")}`);
    if (!Number.isInteger(after) || after < 0 || after > MAX_AFTER) throw new Error(`"after" must be 0 to ${MAX_AFTER} minutes`);
    return { kind, after, on: r.on !== false };
  });
  // Two entries for the same slot would share their run history, so the second could never run.
  const seen = new Set();
  for (const r of out) {
    if (seen.has(slotOf(r))) throw new Error(`Two ${r.kind} runs ${r.after} minutes after airing`);
    seen.add(slotOf(r));
  }
  return out.sort((a, b) => a.after - b.after);
}

/**
 * The runs due at `now` for one season, earliest first. Pure.
 *   schedule        -- normalized runs
 *   since           -- when bot research was switched on (Date); runs timed before it never run
 *   airTimes        -- [{ episode, at: Date, minutes? }]: when each episode starts airing, and its own length
 *                      when known (later ones are ignored)
 *   episodeMinutes  -- how long an episode runs when it has no length of its own: a run's minutes count from its end
 *   history         -- bot_research_runs rows for the season: { episode_number, slot, started_at, ok }
 */
function dueRuns({ schedule, since, airTimes, episodeMinutes = 0, history, now }) {
  const t = now.getTime();
  return slots({ schedule, since, airTimes, episodeMinutes, history })
    .filter((s) => s.next && s.next.getTime() <= t && t - s.at.getTime() <= STALE_MS[s.kind])
    .map(({ episode, slot, kind, after, at }) => ({ episode, slot, kind, after, at }))
    .sort((a, b) => a.at - b.at);
}

/**
 * When this season next has a run due: `now` when one already is, null when none is left. Takes every
 * episode's air time, aired or not. Pure; the same rules as dueRuns, so the VM is never told to come back
 * for a run that then isn't due.
 */
function nextRunAt({ schedule, since, airTimes, episodeMinutes = 0, history, now }) {
  const t = now.getTime();
  let best = null;
  for (const s of slots({ schedule, since, airTimes, episodeMinutes, history })) {
    if (!s.next) continue;
    const when = Math.max(s.next.getTime(), t);
    if (when - s.at.getTime() > STALE_MS[s.kind]) continue;
    if (best === null || when < best) best = when;
  }
  return best === null ? null : new Date(best);
}

// ---------- the quick check ----------

/** The quick check's prompt: who left, and the headline, in a small fixed JSON shape. */
function buildQuickPrompt(ctx, airedAt, tz) {
  const term = (ctx.terms && (ctx.terms.castaways || ctx.terms.castaway)) || "people";
  const exits = (ctx.format && ctx.format.exitMethods) || [];
  const when = airedAt ? `, which aired ${Air.formatInTz(airedAt, tz)}` : "";
  return [
    `Search the web for ${ctx.showName} season ${ctx.season}, episode ${ctx.episodeNumber}${when}.`,
    "It aired very recently, so look for tonight's live blogs, recaps and news posts about this exact episode.",
    "",
    "Answer two things:",
    `1. Who left the game in this episode${exits.length ? ` (${exits.filter((e) => e !== "Other").join(", ")}, or any other way)` : ""}?`,
    `   These are the ${term.toLowerCase()} still in the game; use their names exactly as written: ${ctx.castNames.join(", ")}.`,
    "2. The headline: the one fact a fan would text a friend about this episode. One sentence, at most 25 words.",
    "",
    "If you can't find a source about this exact episode yet, set \"found\" to false and leave the rest empty.",
    "Never answer from earlier episodes or from memory.",
    "",
    "Reply with only this JSON, in a ```json code block:",
    '{"found": true, "episodeTitle": null, "left": [{"name": "", "how": ""}], "headline": "", "sources": ["https://..."]}',
    exits.length ? `"how" is just one of: ${exits.join(", ")}. The story goes in the headline.` : '"how" is two or three words. The story goes in the headline.',
  ].join("\n");
}

/** The quick check's answer, with each name matched to the cast where it can be. */
function parseQuickAnswer(text, castNames) {
  const raw = JSON.parse(Research.extractJsonObject(String(text || "")));
  const roster = { castaways: castNames.map((name, i) => ({ id: String(i), name })) };
  const left = (Array.isArray(raw.left) ? raw.left : [])
    .filter((p) => p && String(p.name || "").trim())
    .map((p) => {
      const { castaway } = StateLogic.Core.findCastawayByName(roster, String(p.name).trim());
      // "how" is meant to be an exit term ("Voted Out"); a chat that writes the story there instead
      // has it dropped rather than shown as a label.
      const how = String(p.how || "").trim();
      return { name: castaway ? castaway.name : String(p.name).trim(), how: how && how.length <= 32 ? how : null, matched: !!castaway };
    });
  return {
    found: raw.found !== false && (left.length > 0 || !!String(raw.headline || "").trim()),
    episodeTitle: raw.episodeTitle ? String(raw.episodeTitle) : null,
    left,
    headline: String(raw.headline || "").trim() || null,
    sources: (Array.isArray(raw.sources) ? raw.sources : []).map(String).filter((s) => /^https?:\/\//.test(s)).slice(0, 8),
  };
}

function quickMessage(q) {
  const who = q.left.length ? `${q.left.map((p) => p.name).join(" & ")} left` : "Nobody left";
  return q.headline ? `${who}. ${q.headline}` : `${who}.`;
}

// ---------- running ----------

/** Seasons with bot research on, loaded the way auto-research loads them (schedule + air clock). */
async function loadBotSeasons(pool, seasonId) {
  return seasonId
    ? AutoResearch.loadSeasons(pool, "ss.id = $1 AND ss.bot_research_on", [seasonId])
    : AutoResearch.loadSeasons(pool, "ss.bot_research_on");
}

/** One season the way runJob wants it, whether or not its schedule is on (an admin's "Run now"). */
async function loadSeasonForJob(pool, seasonId) {
  const [season] = await AutoResearch.loadSeasons(pool, "ss.id = $1", [seasonId]);
  return season;
}

/** When each episode of a season airs, as far as the schedule knows, and how long it runs when research
 *  confirmed that (season_episodes, 0067): [{ episode, at, minutes? }]. */
function episodeAirTimes(season) {
  const out = [];
  const last = season.episode_count || 60;
  const runtimes = season.episodeRuntimes || {};
  for (let n = 1; n <= last; n++) {
    const at = Air.episodeAirTime(season.schedule, n, season.wikiAirDates);
    if (!at) break;
    out.push(runtimes[n] ? { episode: n, at, minutes: Number(runtimes[n]) } : { episode: n, at });
  }
  return out;
}

/** Episodes of a season that have aired by `now`: [{ episode, at }]. */
function airedEpisodes(season, now) {
  return episodeAirTimes(season).filter((e) => e.at <= now);
}

/** How long a season's episodes run, in minutes (0066): its own setting, else an hour. */
const episodeMinutesOf = (season) => season.episode_minutes || DEFAULT_EPISODE_MINUTES;

/**
 * Across every season with bot research on (or one season): what's due now, earliest first, and when the
 * next run comes due (`now` if one already is; null when no season has one left). One read of each
 * season's history serves both.
 */
async function planRuns(pool, { now = new Date(), seasonId } = {}) {
  const due = [];
  let next = null;
  for (const season of await loadBotSeasons(pool, seasonId)) {
    if (season.status !== "airing") continue;
    const { rows: history } = await pool.query(
      "SELECT episode_number, slot, started_at, ok FROM bot_research_runs WHERE season_id=$1",
      [season.id]
    );
    const input = {
      schedule: normalizeSchedule(season.bot_research_schedule),
      since: season.bot_research_since ? new Date(season.bot_research_since) : null,
      airTimes: episodeAirTimes(season),
      episodeMinutes: episodeMinutesOf(season),
      history,
      now,
    };
    if (AutoResearch.isSeasonLive(season, now)) due.push(...dueRuns(input).map((r) => ({ ...r, season })));
    const when = nextRunAt(input);
    if (when && AutoResearch.isSeasonLive(season, when) && (next === null || when < next)) next = when;
  }
  return { due: due.sort((a, b) => a.at - b.at), next };
}

/** Everything due now, across every season with bot research on (or one season). */
async function listDue(pool, opts = {}) {
  return (await planRuns(pool, opts)).due;
}

/**
 * Runs one job: asks the bot (`ask(prompt) -> { answer }`, injected so a test can stand in) and files
 * the answer. A quick answer is kept on the run row; a full one goes through the paste import, merged
 * into whatever the episode already has. `dry` asks and parses but writes nothing.
 */
async function runJob(pool, job, { ask, dry = false } = {}) {
  const { season, episode, kind } = job;
  const slot = job.slot || "now";
  const started = Date.now();
  let runId = null;
  if (!dry) {
    const { rows } = await pool.query(
      "INSERT INTO bot_research_runs (season_id, episode_number, slot, kind) VALUES ($1,$2,$3,$4) RETURNING id",
      [season.id, episode, slot, kind]
    );
    runId = rows[0].id;
  }
  const finish = async (ok, message, result) => {
    const seconds = Math.round((Date.now() - started) / 100) / 10;
    if (runId) {
      await pool.query(
        "UPDATE bot_research_runs SET finished_at=now(), ok=$2, message=$3, result=$4::jsonb, seconds=$5 WHERE id=$1",
        [runId, ok, String(message || "").slice(0, 1000), result ? JSON.stringify(result) : null, seconds]
      );
    }
    return { ok, message, result, seconds, runId };
  };

  try {
    if (kind === "quick") {
      const ctx = await Research.resolveSeasonResearchContext(pool, season.slug, season.season_number, episode);
      const airedAt = Air.episodeAirTime(season.schedule, episode, season.wikiAirDates);
      const { answer } = await ask(buildQuickPrompt(ctx, airedAt, season.air_tz));
      const q = parseQuickAnswer(answer, ctx.castNames);
      // Too early is a failed attempt, so it's asked again a few minutes later.
      if (!q.found) return finish(false, "No source about this episode yet", q);
      return finish(true, quickMessage(q), q);
    }
    const { prompt } = await Research.buildPasteImportPrompt(pool, season.slug, season.season_number, episode, { structured: true });
    const { answer } = await ask(prompt);
    const { rows: prior } = await pool.query(
      "SELECT 1 FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number=$3",
      [season.show_id, season.season_number, episode]
    );
    // A second pass (the 9-hour run, or after someone pasted their own) fills in field by field
    // rather than replacing what's there.
    const again = prior.length > 0;
    const run = await Research.researchFromPaste(pool, season.slug, season.season_number, episode, answer, {
      structured: true,
      merge: again,
      fill: again,
      dry,
      via: "bot",
    });
    const d = run.decisions || {};
    const result = {
      researchId: run.id || null,
      merged: again,
      inserted: d.inserted || 0,
      updated: d.updated || 0,
      total: d.total || 0,
      problems: (run.problems || []).slice(0, 20),
    };
    return finish(true, `${result.inserted} new result(s) to review${again ? " (merged into the earlier answers)" : ""}`, result);
  } catch (e) {
    return finish(false, e instanceof Error ? e.message : String(e), null);
  }
}

/** What the VM's timer calls: runs the earliest due job, if any. */
async function runNext(pool, { ask, now = new Date(), dry = false, seasonId } = {}) {
  const startedAt = Date.now();
  const plan = await planRuns(pool, { now, seasonId });
  const [job] = plan.due;
  if (!job) return { job: null, next: plan.next };
  const label = `${job.season.slug} season ${job.season.season_number} episode ${job.episode} ${job.slot}`;
  console.log(`[bot-research] running ${label}`);
  const outcome = await runJob(pool, job, { ask, dry });
  console.log(`[bot-research] ${label}: ${outcome.ok ? "ok" : "failed"} in ${outcome.seconds}s: ${outcome.message}`);
  // Planned again: this try changed the history (a retry's time, or the next slot). `now` moves on by
  // however long the run took, so a test clock stays a test clock.
  const after = await planRuns(pool, { now: new Date(now.getTime() + Date.now() - startedAt), seasonId });
  return {
    job: { season: job.season.slug, seasonNumber: job.season.season_number, episode: job.episode, slot: job.slot, kind: job.kind },
    ...outcome,
    next: after.next,
  };
}

module.exports = {
  DEFAULT_SCHEDULE,
  MAX_ATTEMPTS,
  normalizeSchedule,
  dueRuns,
  nextRunAt,
  nextTryAt,
  buildQuickPrompt,
  parseQuickAnswer,
  quickMessage,
  airedEpisodes,
  episodeAirTimes,
  episodeMinutesOf,
  DEFAULT_EPISODE_MINUTES,
  loadSeasonForJob,
  listDue,
  planRuns,
  runJob,
  runNext,
  slotOf,
};
