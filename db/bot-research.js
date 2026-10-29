// Bot research (experimental, db/migrations/0065): the ask-AI bot -- a ChatGPT session on our own VM
// (src/lib/server/ask-bot.ts) -- asks about each episode on a schedule counted from when it ENDS (its
// air time plus the season's episode length, 0066), for free. A season's schedule is a list of runs, by
// default:
//
//   quick @   0 min -- who left the game and the episode's headline, at its end (players' early results)
//   full  @  60 min -- the whole research checklist, staged for review like a pasted answer
//   full  @ 720 min -- the checklist again once the morning's recaps are up, merged into the first, before players'
//                      final results at 12:00 noon (src/lib/game/final-results.js)
//   trivia  1440 min -- trivia questions about it and the season so far (db/trivia-research.js), checked by a second
//                       prompt. Its minutes count BACK from when the NEXT episode airs, so it lands a day before that
//                       one whether the show airs weekly or most nights (and never sooner than TRIVIA_AFTER_END after
//                       this one ends, for the recaps)
//   bingo   1440 min -- bingo's squares for the episode coming up (db/bingo-research.js, docs/PLAN-bingo-bank.md), checked by
//                       a second prompt. Its minutes count BACK from when THIS episode airs, and it never runs once it has. A
//                       season without its own bank yet (the fallback for an episode without squares) gets that written too,
//                       as a job of its own in the same window (slot bingo@season), so each call stays one write and one check
//
// Each call to POST /api/cron/bot-research runs at most one due run (the bot answers one question at a
// time anyway) and says when the next one comes due (nextRunAt). The VM's tick calls only then, so the
// database sleeps between runs (docs/HOSTING.md: on Neon's Free plan a database never left idle for 5
// minutes uses up the month's compute).
//
// Its answers are sources like anyone's (docs/PLAN-new-design.md step 6c): the app passes `send`
// (src/lib/server/bot-results.ts), which files each answer through community-results.ts, so what's trusted
// reaches every league on the season on its own, and a quick check it can't be sure of waits in Backstage and is
// asked again. Without `send` (a test, a dry run) a quick answer is only kept on the run row and a full one staged
// for an admin, as before.
//
// The tie-break run (step 6c part 2): when a shared result has been disputed for a day (a flag no answer has checked,
// or sources that split), the bot asks the episode's full research once more, as a source of its own ("tiebreak"),
// which settles most of them; what it doesn't settle reaches the admin's Inbox. It isn't any season's schedule: it's
// the desk's switch (app_settings 'tiebreak', off by default), across every season, and its runs are planned with the
// rest, so the VM's clock is told when one comes due (nextRunAt) and calls only then.
//
// Results someone asked for (db/migrations/0152, src/lib/server/research-asks.ts): a show nobody plays a game on, whose
// aired episodes have no results, gets each episode's full research when someone fills in what happened. It isn't any
// season's schedule either: each asked episode is a job of its own (slot 'asked'), a season's one at a time in episode
// order, each one's full results complete before the next (two tries each; seasonAskNext). The run says how it ended on the
// ask (settleAsk), and the app tells whoever asked. Every run writes how far it's got as it goes (progressFor, 0153).
// An episode looked up already can be asked again (0154, the maker's scoring: docs/PLAN-maker-scoring.md step 5): "missing"
// asks only the questions its stored answers have nothing for, "full" the whole checklist; either is filled into the stored
// answers, and what's filed as the bot's answer is that merged whole, so nothing it said before counts as taken back.
const Air = require("../src/lib/game/air-schedule.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const SeasonClock = require("./season-clock.js");
const Research = require("./episode-research.js");
const Trivia = require("./trivia-research.js");
const Bingo = require("./bingo-research.js");

const KINDS = ["quick", "full", "schedule", "trivia", "bingo"];
// A tie-break's run rows (kind 'tiebreak', 0116) carry this slot.
const TIEBREAK_SLOT = "tiebreak";
// The season's own bingo bank, written once, in the window of an episode's bingo run (dueAt).
const SEASON_BINGO_SLOT = "bingo@season";
// Our usual runs (the user, 2026-10-29: early results right after the episode, final ones at 12:00 noon the next day,
// src/lib/game/final-results.js). Who went home at its end (its retries catch it if it isn't out yet); full results an hour
// on, and again 12 hours after the end: for an evening episode (an 8 to 10 PM end) that's 8 to 10 AM, late enough for the
// morning's sources and early enough to finish, retries and all, before noon.
const DEFAULT_SCHEDULE = [
  { kind: "quick", after: 0, on: true },
  { kind: "full", after: 60, on: true },
  { kind: "full", after: 720, on: true },
  { kind: "trivia", after: 1440, on: true },
  { kind: "bingo", after: 1440, on: true },
];
// Our usual's slots before 2026-10-29, which a run under today's counts as: an episode the old usual already asked about isn't
// asked again the day this changes (quick@5 then is quick@0 now, the second full run's 9 hours then is 12 now).
const SLOT_WAS = { "quick@0": ["quick@5"], "full@720": ["full@540"] };
// A bingo run's two asks share the route's 300s as trivia's do.
const BINGO_WRITE_MS = 160_000;
const BINGO_TOTAL_MS = 280_000;
// A trivia run waits at least this long (minutes) after its episode ends, for the recaps, however soon the next one airs.
const TRIVIA_AFTER_END = 3 * 60;
// A trivia run's two asks share the route's 300s: the questions get up to 160s, the check the rest.
const TRIVIA_WRITE_MS = 160_000;
const TRIVIA_TOTAL_MS = 280_000;
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
// full one is useful for days, and so is a tie-break.
// Bingo's squares are worth writing until the episode airs (slots cuts a try off there), however early its run was set.
const STALE_MS = { quick: 12 * 60 * MIN, full: 3 * 24 * 60 * MIN, schedule: 3 * 24 * 60 * MIN, tiebreak: 3 * 24 * 60 * MIN, trivia: 2 * 24 * 60 * MIN, bingo: MAX_AFTER * MIN };
// A result disputed this long gets its tie-break run.
const TIEBREAK_AFTER_MS = 24 * 60 * MIN;
// An asked episode's run rows (kind 'full') carry this slot: two tries, the second two minutes after the first failed.
const ASKED_SLOT = "asked";
const ASKED_TRIES = 2;
const ASKED_RETRY_MS = 2 * MIN;
// What a full research answer's people are counted by while it's written (each person's entry has a name): its progress.
const PEOPLE_PATTERN = '"name"\\s*:';

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
      // A full run, a schedule check, a tie-break and trivia: three tries, 20 minutes apart.
      if (tries.length >= MAX_ATTEMPTS) return null;
      next = last + FULL_RETRY_MS;
    }
    for (const h of tries) if (h.ok == null) next = Math.max(next, new Date(h.started_at).getTime() + RUNNING_STALE_MS);
  }
  return next - at > STALE_MS[kind] ? null : new Date(next);
}

/**
 * When one run of an episode is due, from when the episode ends (ms) and when the next one airs (null: not known, or the
 * finale): the end plus the run's minutes. Trivia's count back from the next episode instead, no sooner than
 * TRIVIA_AFTER_END after the end (with no next one known, from the end like the rest), and never once the next one airs.
 * Bingo's count back from when this one starts (`starts`, ms): null for a run timed at or after it. Pure.
 */
function dueAt(run, ends, nextAt, starts = null) {
  if (run.kind === "bingo") {
    const due = starts === null ? null : starts - run.after * MIN;
    return due !== null && due < starts ? new Date(due) : null;
  }
  if (run.kind !== "trivia" || !nextAt) return new Date(ends + run.after * MIN);
  const due = Math.max(ends + TRIVIA_AFTER_END * MIN, nextAt.getTime() - run.after * MIN);
  return due < nextAt.getTime() ? new Date(due) : null;
}

/**
 * Every scheduled slot of every episode, with when it's due (dueAt): the episode's end (its own length when research
 * confirmed one, else the season's) plus the run's minutes; trivia's, a day (by default) before the next one; bingo's, a day
 * (by default) before this one, no try once it airs (`until`, which dueRuns and nextRunAt both keep to). `seasonBank` false: the
 * season has no bingo bank of its own yet, so each bingo slot has a twin (forSeason) for it, due with it and listed after it,
 * with tries of its own.
 */
function slots({ schedule, since, airTimes, episodeMinutes = 0, history, seasonBank = true }) {
  const out = [];
  for (const { episode, at: airedAt, minutes } of airTimes) {
    const ends = airedAt.getTime() + (minutes ?? episodeMinutes) * MIN;
    const next = airTimes.find((e) => e.episode === episode + 1);
    for (const run of schedule) {
      if (!run.on) continue;
      const due = dueAt(run, ends, next ? next.at : null, airedAt.getTime());
      if (!due || (since && due < since)) continue;
      const slot = slotOf(run);
      const at = (s) => nextTryAt(run.kind, due, history.filter((h) => h.episode_number === episode && (h.slot === s || (SLOT_WAS[s] || []).includes(h.slot))));
      const until = run.kind === "bingo" ? airedAt : null;
      out.push({ episode, slot, kind: run.kind, after: run.after, at: due, next: at(slot), until });
      if (run.kind === "bingo" && !seasonBank) out.push({ episode, slot: SEASON_BINGO_SLOT, kind: "bingo", after: run.after, at: due, next: at(SEASON_BINGO_SLOT), until, forSeason: true });
    }
  }
  return out;
}

// ---------- the tie-break ----------

/**
 * When an episode's tie-break comes due, or null when it has none to come. Pure.
 *   flags      -- when each open flag on the episode was raised (a result's, or "something's missing")
 *   disputed   -- a result in it is disputed (sources split), not decided by an admin
 *   newest     -- when the newest answer for the episode came in (any answer; null: none)
 *   tries      -- the episode's tie-break runs: { started_at, ok }
 * The question opened with the oldest flag no answer has come in since; or, for a split, with the answer that split it,
 * unless a tie-break already answered it (what one doesn't settle is the admin's). Due a day after it opened, then the
 * full run's retry pace, counting only tries since it opened, so a flag raised after an earlier tie-break gets its own.
 */
function tiebreakNext({ flags = [], disputed = false, newest = null, tries = [] }) {
  const after = newest ? new Date(newest).getTime() : null;
  const waiting = flags.map((f) => new Date(f).getTime()).filter((t) => after === null || t > after);
  let since = null;
  if (waiting.length) since = Math.min(...waiting);
  else if (disputed && after !== null && !tries.some((t) => t.ok === true)) since = after;
  if (since === null) return null;
  const due = new Date(since + TIEBREAK_AFTER_MS);
  const next = nextTryAt("tiebreak", due, tries.filter((t) => new Date(t.started_at).getTime() >= since));
  return next ? { since: new Date(since), due, next } : null;
}

/** Whether the desk's tie-break switch is on (app_settings 'tiebreak'; off by default). */
async function tiebreakOn(pool) {
  const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = 'tiebreak'");
  return rows[0] ? rows[0].value === true : false;
}

/**
 * Every episode with a question open on a shared result (any season, whatever its schedule; or one season's), with what
 * tiebreakNext reads: [{ seasonId, episode, flags, disputed, newest, tries }]. One query for the questions, one for their
 * history.
 */
async function tiebreakQuestions(pool, seasonId = null) {
  const { rows } = await pool.query(
    `WITH q AS (
       SELECT d.season_id, d.episode_number, NULL::timestamptz AS flag_at, true AS disputed
         FROM season_decisions d WHERE d.fact_status = 'disputed' AND d.locked_at IS NULL AND ($1::uuid IS NULL OR d.season_id = $1)
       UNION ALL
       SELECT x.season_id, x.episode_number, x.created_at, false
         FROM fact_disputes x
        WHERE x.status = 'open' AND ($1::uuid IS NULL OR x.season_id = $1)
          AND (x.decision_id IS NULL OR EXISTS (SELECT 1 FROM season_decisions d WHERE d.id = x.decision_id AND d.locked_at IS NULL))
     )
     SELECT q.season_id, q.episode_number,
            array_agg(q.flag_at) FILTER (WHERE q.flag_at IS NOT NULL) AS flags, bool_or(q.disputed) AS disputed,
            (SELECT max(er.researched_at) FROM episode_research er JOIN show_seasons ss ON ss.show_id = er.show_id AND ss.season_number = er.season_number
              WHERE ss.id = q.season_id AND er.episode_number = q.episode_number AND er.source <> 'combined' AND er.withdrawn_at IS NULL) AS newest
       FROM q GROUP BY q.season_id, q.episode_number`,
    [seasonId]
  );
  if (!rows.length) return [];
  const { rows: history } = await pool.query(
    "SELECT season_id, episode_number, started_at, ok FROM bot_research_runs WHERE kind = 'tiebreak' AND season_id = ANY($1::uuid[])",
    [[...new Set(rows.map((r) => r.season_id))]]
  );
  return rows.map((r) => ({
    seasonId: r.season_id,
    episode: r.episode_number,
    flags: r.flags || [],
    disputed: !!r.disputed,
    newest: r.newest,
    tries: history.filter((h) => h.season_id === r.season_id && h.episode_number === r.episode_number),
  }));
}

/** The tie-breaks due now and when the next comes due, while the desk's switch is on: { due: [job], next }. */
async function planTiebreaks(pool, now) {
  if (!(await tiebreakOn(pool))) return { due: [], next: null };
  const t = now.getTime();
  const due = [];
  let next = null;
  const seasons = new Map();
  for (const q of await tiebreakQuestions(pool)) {
    const at = tiebreakNext(q);
    if (!at) continue;
    const when = Math.max(at.next.getTime(), t);
    if (when - at.due.getTime() > STALE_MS.tiebreak) continue;
    if (at.next.getTime() <= t) {
      if (!seasons.has(q.seasonId)) seasons.set(q.seasonId, await loadSeasonForJob(pool, q.seasonId));
      const season = seasons.get(q.seasonId);
      if (season) due.push({ episode: q.episode, slot: TIEBREAK_SLOT, kind: "tiebreak", after: null, at: at.due, season });
    }
    if (next === null || when < next) next = when;
  }
  return { due, next: next === null ? null : new Date(next) };
}

// ---------- results someone asked for ----------

/**
 * When an asked episode's next try may start, or null for never: its ask itself before any try; while a try runs, when it
 * would count as cut off (the run's end plans again sooner); after a failure, two minutes on; never once one worked or both
 * tries failed. `tries`: its runs since it was asked, { started_at, ok }. Pure.
 */
function askedNext(askedAt, tries, now) {
  if (tries.some((h) => h.ok === true)) return null;
  const t = now.getTime();
  const running = tries.filter((h) => h.ok == null && new Date(h.started_at).getTime() + RUNNING_STALE_MS > t);
  if (running.length) return new Date(Math.max(...running.map((h) => new Date(h.started_at).getTime() + RUNNING_STALE_MS)));
  if (tries.length >= ASKED_TRIES) return null;
  if (!tries.length) return new Date(askedAt);
  return new Date(Math.max(...tries.map((h) => new Date(h.started_at).getTime())) + ASKED_RETRY_MS);
}

/**
 * One season's next asked run: { episode, kind, slot, at } when one is due, { hold: Date } when one is running or waiting to
 * try again (nothing else of the season goes meanwhile), or null when none is left. Each episode's full results, one after
 * another in the order asked (an episode's before the next one's), two tries each (askedNext); one given up lets the next go.
 * `asks`: the season's open asks in the order asked, each { episode_number, asked_at, tries } (its runs since it was asked).
 * Pure.
 */
function seasonAskNext(asks, now) {
  const t = now.getTime();
  for (const a of asks) {
    const at = askedNext(a.asked_at, a.tries, now);
    if (!at) continue;
    return at.getTime() <= t ? { episode: a.episode_number, kind: "full", slot: ASKED_SLOT, at: new Date(a.asked_at), ...(a.mode ? { mode: a.mode } : {}) } : { hold: at };
  }
  return null;
}

/** Every open ask (or one season's), oldest first and a season's in episode order, with its runs since it was asked. */
async function openAsks(pool, seasonId = null) {
  const { rows } = await pool.query(
    `SELECT a.season_id, a.episode_number, a.asked_at, a.mode,
            COALESCE(json_agg(json_build_object('started_at', r.started_at, 'ok', r.ok)) FILTER (WHERE r.id IS NOT NULL), '[]') AS tries
       FROM research_asks a
       LEFT JOIN bot_research_runs r ON r.season_id = a.season_id AND r.episode_number = a.episode_number AND r.slot = $2 AND r.started_at >= a.asked_at
      WHERE a.done_at IS NULL AND ($1::uuid IS NULL OR a.season_id = $1)
      GROUP BY a.season_id, a.episode_number, a.asked_at, a.mode
      ORDER BY a.asked_at, a.episode_number`,
    [seasonId, ASKED_SLOT]
  );
  return rows;
}

/** The asked runs due now (a season's one at a time: seasonAskNext) and when the next comes due: { due: [job], next }. */
async function planAsks(pool, now, seasonId = null) {
  const t = now.getTime();
  const seasons = new Map();
  for (const a of await openAsks(pool, seasonId)) {
    if (!seasons.has(a.season_id)) seasons.set(a.season_id, []);
    seasons.get(a.season_id).push(a);
  }
  const due = [];
  let next = null;
  for (const [id, asks] of seasons) {
    const plan = seasonAskNext(asks, now);
    if (!plan) continue;
    const at = plan.hold ?? plan.at;
    if (!plan.hold) {
      const season = await loadSeasonForJob(pool, id);
      if (season) due.push({ episode: plan.episode, slot: plan.slot, kind: plan.kind, after: null, at: plan.at, season, ...(plan.mode ? { mode: plan.mode } : {}) });
    }
    const when = Math.max(at.getTime(), t);
    if (next === null || when < next) next = when;
  }
  return { due, next: next === null ? null : new Date(next) };
}

/**
 * An asked episode's run just ended: the ask is done when it worked (with how many results reached the season), or when
 * this was its last try. Whoever asked, to tell ({ userId, askedAt, ok, found, message }), or null while it's still to try
 * again (or someone asked again meanwhile).
 */
async function settleAsk(pool, seasonId, episode, ok, message, found) {
  const { rows } = await pool.query(
    `UPDATE research_asks a SET done_at = now(), ok = $3, message = $4, found = $5
      WHERE a.season_id = $1 AND a.episode_number = $2 AND a.done_at IS NULL
        AND ($3 OR (SELECT count(*) FROM bot_research_runs r WHERE r.season_id = a.season_id AND r.episode_number = a.episode_number
                      AND r.slot = $6 AND r.started_at >= a.asked_at) >= $7)
      RETURNING a.asked_by, a.asked_at`,
    [seasonId, episode, ok, String(message || "").slice(0, 300), ok ? found : null, ASKED_SLOT, ASKED_TRIES]
  );
  return rows[0] ? { userId: rows[0].asked_by, askedAt: rows[0].asked_at, ok, found: ok ? found : null, message: ok ? null : message } : null;
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
    const when = r.kind === "trivia" ? "before the next episode" : r.kind === "bingo" ? "before it airs" : "after airing";
    if (seen.has(slotOf(r))) throw new Error(`Two ${r.kind} runs ${r.after} minutes ${when}`);
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
 *   seasonBank      -- the season has a bingo bank of its own (false: its bingo runs write one too); true by default
 * A job for the season's own bingo bank carries `forSeason`.
 */
function dueRuns({ schedule, since, airTimes, episodeMinutes = 0, history, now, seasonBank = true }) {
  const t = now.getTime();
  return slots({ schedule, since, airTimes, episodeMinutes, history, seasonBank })
    .filter((s) => s.next && s.next.getTime() <= t && t - s.at.getTime() <= STALE_MS[s.kind] && (!s.until || t < s.until.getTime()))
    .map(({ episode, slot, kind, after, at, forSeason }) => ({ episode, slot, kind, after, at, ...(forSeason ? { forSeason } : {}) }))
    .sort((a, b) => a.at - b.at);
}

/**
 * When this season next has a run due: `now` when one already is, null when none is left. Takes every
 * episode's air time, aired or not. Pure; the same rules as dueRuns, so the VM is never told to come back
 * for a run that then isn't due.
 */
function nextRunAt({ schedule, since, airTimes, episodeMinutes = 0, history, now, seasonBank = true }) {
  const t = now.getTime();
  let best = null;
  for (const s of slots({ schedule, since, airTimes, episodeMinutes, history, seasonBank })) {
    if (!s.next) continue;
    const when = Math.max(s.next.getTime(), t);
    if (when - s.at.getTime() > STALE_MS[s.kind] || (s.until && when >= s.until.getTime())) continue;
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

// ---------- the schedule check ----------
// Only when the NEXT episode airs, its start and its length: the previous episode's "next time" preview, or the
// network's schedule. Filed in season_episodes (0067) by Research.recordNextEpisode, so a week off or a long
// special moves lineup locks, reminders and the bot's own runs. It stages no results: nothing to review.

/** The schedule check's prompt: episode n has just aired; when does n+1? */
function buildSchedulePrompt(showName, season, episode, airedAt, tz) {
  const when = airedAt ? `, which aired ${Air.formatInTz(airedAt, tz)}` : "";
  return [
    `Search the web for ${showName} season ${season}: when does episode ${episode + 1} air?`,
    `Episode ${episode}${when} has just aired. Its "next time" preview, the network's schedule or TV listings should say.`,
    "",
    "Reply with only this JSON, in a ```json code block:",
    '{"found": true, "airsAt": "2026-11-04T20:00:00-05:00", "minutes": 90, "note": null, "sources": ["https://..."]}',
    "",
    `- airsAt: when episode ${episode + 1} starts, ISO 8601 with the UTC offset of the time zone it's announced in. If the show takes a week off, the date of the next one that does air.`,
    "- minutes: how long it runs, ads included (60, 90, or 120 for a two-hour episode). Null if not announced.",
    "- note: anything unusual in a few words ('after a week off', 'two-hour finale'), else null.",
    `If you can't find a source for when episode ${episode + 1} airs, set "found" to false. Never guess from earlier seasons or a usual pattern.`,
  ].join("\n");
}

/** The schedule check's answer: { found, airsAt, minutes, note, sources }. */
function parseScheduleAnswer(text) {
  const raw = JSON.parse(Research.extractJsonObject(String(text || "")));
  const str = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const n = typeof raw.minutes === "number" ? raw.minutes : Number.parseFloat(raw.minutes);
  const out = {
    airsAt: str(raw.airsAt),
    minutes: Number.isFinite(n) ? n : null,
    note: str(raw.note),
    sources: (Array.isArray(raw.sources) ? raw.sources : []).map(String).filter((u) => /^https?:\/\//.test(u)).slice(0, 8),
  };
  return { found: raw.found !== false && (!!out.airsAt || out.minutes !== null), ...out };
}

function quickMessage(q) {
  const who = q.left.length ? `${q.left.map((p) => p.name).join(" & ")} left` : "Nobody left";
  return q.headline ? `${who}. ${q.headline}` : `${who}.`;
}

// ---------- running ----------

/** Seasons with bot research on, with their schedule and air clock (season-clock.js). */
async function loadBotSeasons(pool, seasonId) {
  return seasonId
    ? SeasonClock.loadSeasons(pool, "ss.id = $1 AND ss.bot_research_on", [seasonId])
    : SeasonClock.loadSeasons(pool, "ss.bot_research_on");
}

/** One season the way runJob wants it, whether or not its schedule is on (an admin's "Run now"). */
async function loadSeasonForJob(pool, seasonId) {
  const [season] = await SeasonClock.loadSeasons(pool, "ss.id = $1", [seasonId]);
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
    const schedule = normalizeSchedule(season.bot_research_schedule);
    const input = {
      schedule,
      since: season.bot_research_since ? new Date(season.bot_research_since) : null,
      airTimes: episodeAirTimes(season),
      episodeMinutes: episodeMinutesOf(season),
      history,
      now,
      // Asked only of a season whose schedule has bingo on: its own bank yet?
      seasonBank: schedule.some((r) => r.kind === "bingo" && r.on) ? await Bingo.hasBank(pool, season.id, null) : true,
    };
    if (SeasonClock.isSeasonLive(season, now)) due.push(...dueRuns(input).map((r) => ({ ...r, season })));
    const when = nextRunAt(input);
    if (when && SeasonClock.isSeasonLive(season, when) && (next === null || when < next)) next = when;
  }
  // The tie-breaks (the desk's switch, across every season). One season asked about needs only its own.
  const ties = await planTiebreaks(pool, now);
  for (const job of ties.due) if (!seasonId || job.season.id === seasonId) due.push(job);
  if (!seasonId && ties.next && (next === null || ties.next < next)) next = ties.next;
  // Results someone asked for (any season, whatever its schedule).
  const asks = await planAsks(pool, now, seasonId);
  due.push(...asks.due);
  if (asks.next && (next === null || asks.next < next)) next = asks.next;
  return { due: due.sort((a, b) => a.at - b.at), next };
}

/** Everything due now, across every season with bot research on (or one season). */
async function listDue(pool, opts = {}) {
  return (await planRuns(pool, opts)).due;
}

/**
 * Runs one job: asks the bot (`ask(prompt, { budgetMs? }) -> { answer }`, injected so a test can stand in) and files
 * the answer. A quick answer is kept on the run row; a full one goes through the paste import, merged
 * into whatever the episode already has; trivia's questions, checked, go in trivia_questions (0140); bingo's squares, checked,
 * go in bingo_squares (0146) as the episode's bank, or with `job.forSeason` the season's own. `send` (the app's) also files
 * either as a source: a quick answer it can't trust yet waits for a commissioner and counts as a failed try, so it's asked again.
 * `dry` asks and parses but writes nothing.
 */
async function runJob(pool, job, { ask, send = null, dry = false } = {}) {
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
    // An asked episode: done when it worked or this was its last try (whoever asked, for the app to tell).
    const asked = runId && slot === ASKED_SLOT ? await settleAsk(pool, season.id, episode, ok, message, result && Number.isInteger(result.live) ? result.live : null) : null;
    return { ok, message, result, seconds, runId, ...(asked ? { asked } : {}) };
  };
  // How far the answer has got, on the run's row while it runs (0153): its stage, and for a full research the people
  // answered so far of those asked about (`of`). A new stage at once, the count at most every 3 s; never blocks the run.
  const progressFor = (of = null) => {
    if (!runId) return undefined;
    let sent = null;
    let at = 0;
    return {
      pattern: of ? PEOPLE_PATTERN : null,
      on: (p) => {
        const v = { stage: p.stage, ...(of ? { done: Math.min(of, p.matches || 0), of } : {}) };
        if (sent && sent.stage === v.stage && (sent.done === v.done || Date.now() - at < 3000)) return;
        sent = v;
        at = Date.now();
        pool.query("UPDATE bot_research_runs SET progress = $2 WHERE id = $1 AND finished_at IS NULL", [runId, JSON.stringify(v)]).catch(() => {});
      },
    };
  };

  try {
    if (kind === "schedule") {
      const { rows: show } = await pool.query("SELECT name FROM shows WHERE id=$1", [season.show_id]);
      const showName = show[0] ? show[0].name : season.slug;
      const airedAt = Air.episodeAirTime(season.schedule, episode, season.wikiAirDates);
      const { answer } = await ask(buildSchedulePrompt(showName, season.season_number, episode, airedAt, season.air_tz));
      const a = parseScheduleAnswer(answer);
      if (!a.found) return finish(false, `No source yet for when episode ${episode + 1} airs`, a);
      if (dry) return finish(true, `Episode ${episode + 1}: ${a.airsAt || "time not given"}, ${a.minutes ?? "?"} min (dry run: not filed)`, a);
      const clean = await Research.recordNextEpisode(
        pool,
        { showId: season.show_id, season: season.season_number, episodeNumber: episode, showName },
        { airsAt: a.airsAt, minutes: a.minutes, note: a.note }
      );
      // An answer that can't be right (a date already past, a length of 3 minutes) is a failed try, asked again later.
      if (!clean) return finish(false, `Episode ${episode + 1}'s schedule didn't check out, or an admin set it by hand`, a);
      const when = clean.airAt ? Air.formatInTz(clean.airAt, season.air_tz) : "time not given";
      return finish(true, `Episode ${episode + 1}: ${when}${clean.minutes ? `, ${clean.minutes} min` : ""}${clean.note ? ` (${clean.note})` : ""}`, {
        ...a,
        airAt: clean.airAt ? clean.airAt.toISOString() : null,
      });
    }
    if (kind === "trivia") {
      // Two asks in one call, sharing the route's budget: the questions, then the check, in a chat of its own.
      const about = await Trivia.castFor(pool, season.id, episode);
      const names = about.cast.map((c) => c.name);
      const { answer } = await ask(Trivia.buildTriviaPrompt({ ...about, episode }), { budgetMs: TRIVIA_WRITE_MS });
      const parsed = Trivia.parseTriviaAnswer(answer, episode, names);
      if (!parsed.found) return finish(false, `No usable trivia about episode ${episode} yet`, { dropped: parsed.dropped });
      const { answer: checked } = await ask(Trivia.buildCheckPrompt({ ...about, episode, questions: parsed.questions }), {
        budgetMs: TRIVIA_TOTAL_MS - (Date.now() - started),
      });
      const questions = Trivia.judged(parsed, Trivia.parseCheckAnswer(checked, parsed.questions.length));
      const live = questions.filter((q) => q.status === "live").length;
      const result = { live, questions, dropped: parsed.dropped };
      const line = `${live} of ${questions.length + parsed.dropped.length} trivia question(s) passed their checks`;
      if (dry) return finish(live > 0, `${line} (dry run: not filed)`, result);
      await Trivia.storeTrivia(pool, season.id, episode, questions, runId);
      // None passing is a failed try, asked again (a new batch replaces this one).
      return finish(live > 0, line, result);
    }
    if (kind === "bingo") return await bingoJob(pool, job, { ask, dry, runId, started, finish });
    if (kind === "quick") {
      const ctx = await Research.resolveSeasonResearchContext(pool, season.slug, season.season_number, episode);
      const airedAt = Air.episodeAirTime(season.schedule, episode, season.wikiAirDates);
      const { answer } = await ask(buildQuickPrompt(ctx, airedAt, season.air_tz), { progress: progressFor() });
      const q = parseQuickAnswer(answer, ctx.castNames);
      // Too early is a failed attempt, so it's asked again a few minutes later.
      if (!q.found) return finish(false, "No source about this episode yet", q);
      if (send && !dry) {
        const sent = await send.quick({ seasonId: season.id, episode, answer: q, castNames: ctx.castNames, exitMethods: (ctx.format && ctx.format.exitMethods) || [] });
        // Not sure yet (one source, a name not in the cast): it waits in Backstage, and the next try may settle it.
        if (!sent.applied) return finish(false, `Not sure yet: ${sent.line}`, { ...q, doubt: sent.doubt });
        return finish(true, `${quickMessage(q)} In ${sent.leagues} league(s).`, { ...q, applied: true, researchId: sent.researchId });
      }
      return finish(true, quickMessage(q), q);
    }
    // Asked again for just what's new: only the questions its stored answers have nothing for (none: nothing to ask).
    const { prompt, castCount, only } = await Research.buildPasteImportPrompt(pool, season.slug, season.season_number, episode, {
      structured: true,
      ...(job.mode === "missing" ? { only: "missing" } : {}),
    });
    if (!prompt) return finish(true, "Nothing new to ask: its answers have every question already", { only: [], live: null });
    const { answer } = await ask(prompt, { progress: progressFor(castCount) });
    const { rows: prior } = await pool.query(
      "SELECT 1 FROM episode_research WHERE show_id=$1 AND season_number=$2 AND episode_number=$3 AND source = 'combined'",
      [season.show_id, season.season_number, episode]
    );
    // A second pass (the 9-hour run, or after someone pasted their own) fills in field by field
    // rather than replacing what's there.
    const again = prior.length > 0;
    const run = await Research.researchFromPaste(pool, season.slug, season.season_number, episode, answer, {
      structured: true,
      merge: again,
      fill: again,
      ...(only ? { only } : {}),
      dry,
      via: "bot",
      // An answer about another episode (the bot's chat can carry an earlier question over) is a failed try.
      checkEpisode: !!send,
    });
    const d = run.decisions || {};
    const result = {
      researchId: run.id || null,
      merged: again,
      ...(only ? { only } : {}),
      inserted: d.inserted || 0,
      updated: d.updated || 0,
      total: d.total || 0,
      problems: (run.problems || []).slice(0, 20),
    };
    if (send && !dry) {
      // A tie-break is the same full research, filed as a source of its own.
      // Asked again (an episode with answers already): the merged whole is the bot's answer, so a question asked on its own
      // doesn't take back everything it didn't ask, and it replaces the bot's earlier answers (which weren't asked what's
      // new, so would otherwise count as saying it didn't happen).
      const replaces = slot === ASKED_SLOT && again;
      const filed = replaces ? { ...run, submitted: run.payload } : run;
      const sent = await send.full({ seasonId: season.id, episode, run: filed, source: kind === "tiebreak" ? "tiebreak" : "autopilot", ...(replaces ? { replaces } : {}) });
      const lead = kind === "tiebreak" ? "Tie-break: " : "";
      return finish(true, `${lead}${sent.count} of ${sent.facts} result(s) in every league${again ? " (the stored answers merged too)" : ""}`, { ...result, submission: sent.researchId, live: sent.count });
    }
    return finish(true, `${result.inserted} new result(s) to review${again ? " (merged into the earlier answers)" : ""}`, result);
  } catch (e) {
    return finish(false, e instanceof Error ? e.message : String(e), null);
  }
}

/**
 * A bingo run (runJob's): the squares for an episode coming up (or with `job.forSeason`, the season's own bank), written, then
 * checked in a chat of its own, filed as that bank when at least Bingo.BOT_MIN pass; fewer is a failed try (asked again), and
 * the bank there stays as it was. A scheduled run for an episode that has its squares already (written by hand, or by an
 * admin's run) leaves them be, without asking. Each run's result lists every square, live or dropped with why.
 */
async function bingoJob(pool, job, { ask, dry, runId, started, finish }) {
  const { season, episode } = job;
  const forSeason = !!job.forSeason;
  const which = forSeason ? "the season's own squares" : `Episode ${episode}'s squares`;
  if (job.slot && job.slot !== "now" && (await Bingo.hasBank(pool, season.id, forSeason ? null : episode))) {
    return finish(true, `${which}: written already, left as they are`, { forSeason, kept: true });
  }
  const airedAt = Air.episodeAirTime(season.schedule, episode, season.wikiAirDates);
  const ctx = await Bingo.bingoContext(pool, season.id, forSeason ? null : episode, { airAt: airedAt ? Air.formatInTz(airedAt, season.air_tz) : null });
  const { answer } = await ask(Bingo.buildBingoPrompt(ctx), { budgetMs: BINGO_WRITE_MS });
  const parsed = Bingo.parseBingoAnswer(answer, { avoid: ctx.avoid, names: ctx.cast, anyone: !forSeason });
  const kept = parsed.squares.filter((s) => s.status === "live");
  if (kept.length < Bingo.BOT_MIN) {
    return finish(false, `${which}: only ${kept.length} of ${parsed.squares.length} passed the parse (a bank needs ${Bingo.BOT_MIN})`, { forSeason, squares: parsed.squares });
  }
  const { answer: checked } = await ask(Bingo.buildCheckPrompt({ ...ctx, squares: kept }), { budgetMs: BINGO_TOTAL_MS - (Date.now() - started) });
  const squares = Bingo.judged(parsed.squares, Bingo.parseCheckAnswer(checked, kept.length));
  const live = squares.filter((s) => s.status === "live").length;
  const result = { forSeason, live, squares };
  const line = `${which}: ${live} of ${squares.length} passed their checks`;
  if (live < Bingo.BOT_MIN) return finish(false, `${line} (a bank needs ${Bingo.BOT_MIN}; the squares there stay)`, result);
  if (dry) return finish(true, `${line} (dry run: not filed)`, result);
  await Bingo.storeBank(pool, season.id, forSeason ? null : episode, squares, runId);
  return finish(true, line, result);
}

/** What the VM's timer calls: runs the earliest due job, if any. */
async function runNext(pool, { ask, send = null, now = new Date(), dry = false, seasonId } = {}) {
  const startedAt = Date.now();
  const plan = await planRuns(pool, { now, seasonId });
  const [job] = plan.due;
  if (!job) return { job: null, next: plan.next };
  const label = `${job.season.slug} season ${job.season.season_number} episode ${job.episode} ${job.slot}`;
  console.log(`[bot-research] running ${label}`);
  const outcome = await runJob(pool, job, { ask, send, dry });
  console.log(`[bot-research] ${label}: ${outcome.ok ? "ok" : "failed"} in ${outcome.seconds}s: ${outcome.message}`);
  // Planned again: this try changed the history (a retry's time, or the next slot). `now` moves on by
  // however long the run took, so a test clock stays a test clock.
  const after = await planRuns(pool, { now: new Date(now.getTime() + Date.now() - startedAt), seasonId });
  return {
    job: { season: job.season.slug, seasonNumber: job.season.season_number, seasonId: job.season.id, episode: job.episode, slot: job.slot, kind: job.kind },
    ...outcome,
    next: after.next,
  };
}

module.exports = {
  DEFAULT_SCHEDULE,
  MAX_ATTEMPTS,
  TIEBREAK_AFTER_MS,
  tiebreakNext,
  tiebreakOn,
  tiebreakQuestions,
  normalizeSchedule,
  dueRuns,
  nextRunAt,
  nextTryAt,
  buildQuickPrompt,
  buildSchedulePrompt,
  parseScheduleAnswer,
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
  dueAt,
  TRIVIA_AFTER_END,
  SEASON_BINGO_SLOT,
  ASKED_SLOT,
  ASKED_TRIES,
  RUNNING_STALE_MS,
  askedNext,
  seasonAskNext,
  planAsks,
};
