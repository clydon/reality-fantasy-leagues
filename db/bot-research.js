// Bot research (experimental, db/migrations/0065): the ask-AI bot -- a ChatGPT session on our own VM
// (src/lib/server/ask-bot.ts) -- asks about each episode on a schedule counted from when it ENDS (its
// air time plus the season's episode length, 0066), for free. A season's schedule is a list of runs, by
// default:
//
//   quick @   0 min -- who left the game and the episode's headline, at its end (players' early results)
//   full  @  60 min -- the whole research checklist, staged for review like a pasted answer
//   full  @ 720 min -- the checklist again once the morning's recaps are up, merged into the first, before players'
//                      final results at 12:00 noon (src/lib/game/final-results.js)
//   facts @ 750 min -- the episode's facts its stored answer still isn't sure of (who says the title quote), asked on their own
//                      in a short prompt (db/facts-research.js, A13 part 2b), filed into that answer as a second pass fills
//                      in; nothing is asked when research was sure of them. Before the final results, which a game's question
//                      a fact settles waits for while research isn't sure (formats/episode-facts.js pendingUntil)
//   trivia  1440 min -- trivia questions about it and the season so far (db/trivia-research.js), checked by a second
//                       prompt. Its minutes count BACK from when the NEXT episode airs, so it lands a day before that
//                       one whether the show airs weekly or most nights (and never sooner than TRIVIA_AFTER_END after
//                       this one ends, for the recaps)
//   bingo   1440 min -- bingo's squares for the episode coming up (db/bingo-research.js, docs/PLAN-bingo-bank.md), checked by
//                       a second prompt. Its minutes count BACK from when THIS episode airs, and it never runs once it has. A
//                       season without its own bank yet (the fallback for an episode without squares) gets that written too,
//                       as a job of its own in the same window (slot bingo@season), so each call stays one write and one check
//
// That's our usual (DEFAULT_SCHEDULE), which the desk can change (the user, 2026-10-29: "Make this our usual"): app_settings
// 'bot_usual' when it's been set (usualSchedule), DEFAULT_SCHEDULE when not. A season with no schedule of its own
// (bot_research_schedule NULL) follows it and changes with it; a season with its own keeps it exactly. An episode can have runs
// of its own (bot_research_episodes, 0431: "Episode N only" on the desk), which the planner reads for that episode alone. A run
// that moved (retimed, or our usual changed under it) carries the slots it was (`was`, carryWas), so an episode it already ran
// for isn't asked again at its new time.
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
// A card the bot chooses (docs/PLAN-start-a-game-gpt.md step C7 part 2, db/card-research.js): a game whose card the bot chooses
// needs its choice before each episode, whatever the season's schedule says. It isn't any season's schedule either: each season
// with such a game gets a card run for each episode coming (slot 'card'), due CardResearch.CARD_BEFORE minutes before it airs (no
// sooner than CARD_AFTER_PREV after the one before it ends), three tries 20 minutes apart, and never once the card is out
// (Spec.CARD_OUT_HOURS before the episode: the game plays its fallback then). An episode with a live choice already isn't asked.
//
// The bot's own call as an opponent (step A14 part 2b, db/call-research.js): a game with a question played against the bot needs its
// call on each window before the window locks, whatever the season's schedule says. Not any season's schedule either: each such game
// gets a call run for each lock coming with a window it hasn't called (slot 'call:<league id>', its episode the lock's), due
// CallResearch.CALL_BEFORE minutes before that episode airs (no sooner than CALL_AFTER_PREV after the one before it ends, no later
// than CALL_LAST before it), three tries 20 minutes apart, and never once it has locked (the window plays its fallback then).
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
const FactsRun = require("./facts-research.js");
const MomentsRun = require("./moments-research.js");
const FinalResults = require("../src/lib/game/final-results.js");
const CardResearch = require("./card-research.js");
const CallResearch = require("./call-research.js");
const BotCalls = require("./bot-calls.js");

const KINDS = ["quick", "full", "schedule", "trivia", "bingo", "facts"];
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
  { kind: "facts", after: 750, on: true },
  { kind: "trivia", after: 1440, on: true },
  { kind: "bingo", after: 1440, on: true },
];
// Our usual's slots before 2026-10-29, which a run under today's counts as: an episode the old usual already asked about isn't
// asked again the day this changes (quick@5 then is quick@0 now, the second full run's 9 hours then is 12 now).
const SLOT_WAS = { "quick@0": ["quick@5"], "full@720": ["full@540"] };
// Our usual as the desk set it (app_settings), and how many earlier slots a moved run remembers.
const USUAL_KEY = "bot_usual";
const MAX_WAS = 6;
const SLOT_RE = new RegExp(`^(${KINDS.join("|")})@\\d{1,5}$`);
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
// Bingo's squares are worth writing until the episode airs (slots cuts a try off there), however early its run was set. An
// episode's facts, for a day: a game's question waits for them only until the episode's final results.
// A card run, until its card is out (cardNext cuts a try off there); a call run, until its lock (CallResearch.callNext's).
const STALE_MS = { quick: 12 * 60 * MIN, full: 3 * 24 * 60 * MIN, schedule: 3 * 24 * 60 * MIN, tiebreak: 3 * 24 * 60 * MIN, trivia: 2 * 24 * 60 * MIN, bingo: MAX_AFTER * MIN, facts: 24 * 60 * MIN, card: MAX_AFTER * MIN, call: MAX_AFTER * MIN };
// A result disputed this long gets its tie-break run.
const TIEBREAK_AFTER_MS = 24 * 60 * MIN;
// A card run's rows (kind 'card', 0208) carry this slot.
const CARD_SLOT = "card";
// An asked episode's run rows (kind 'full') carry this slot: two tries, the second two minutes after the first failed.
const ASKED_SLOT = "asked";
const ASKED_TRIES = 2;
const ASKED_RETRY_MS = 2 * MIN;
// What a full research answer's people are counted by while it's written (each person's entry has a name): its progress.
const PEOPLE_PATTERN = '"name"\\s*:';

const slotOf = (run) => `${run.kind}@${run.after}`;

/**
 * The slots whose tries count as a run's in an episode whose runs are `list`: its own, those it moved from (`was`), and our
 * old usual's (SLOT_WAS), but never a slot another run in the list holds now (that run's tries are its own). The planner
 * (slots) and the desk's rail both read it. Pure.
 */
function triedAs(run, list) {
  const slot = slotOf(run);
  const here = new Set(list.map(slotOf));
  return [slot, ...[...(run.was || []), ...(SLOT_WAS[slot] || [])].filter((s) => !here.has(s))];
}

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
      // A full run, a schedule check, a tie-break, trivia, the facts run, a card and a call: three tries, 20 minutes apart.
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

// The facts run lands at least this long (minutes) before the episode's final results, for its retries: a game's question waits
// for it only until then.
const FACTS_BEFORE_FINAL = 60;

/**
 * When one run of an episode is due on the schedule (the planner's and the desk's rail): dueAt's time, but the facts run's no later
 * than FACTS_BEFORE_FINAL before the episode's final results (final-results.js, in the season's zone `tz`) and no sooner than its end,
 * so it lands before them however late the episode ends (a two-hour show ending at midnight, a 3 AM drop whose final results are
 * that noon); none when the episode ends after that. Pure.
 */
function dueFor(run, ends, nextAt, starts, tz = null) {
  const due = dueAt(run, ends, nextAt, starts);
  if (!due || run.kind !== "facts" || starts == null) return due;
  const final = FinalResults.finalResultsAt(new Date(starts), tz);
  if (!final) return due;
  const latest = final.getTime() - FACTS_BEFORE_FINAL * MIN;
  if (latest < ends) return null;
  return new Date(Math.min(due.getTime(), latest));
}

/**
 * Every scheduled slot of every episode, with when it's due (dueAt; the facts run's, dueFor): the episode's end (its own length when research
 * confirmed one, else the season's) plus the run's minutes; trivia's, a day (by default) before the next one; bingo's, a day
 * (by default) before this one, no try once it airs (`until`, which dueRuns and nextRunAt both keep to); the facts run's, no try
 * once the episode's final results are in (in the season's zone, `tz`): a game's question waits for it only until then, so a later
 * answer would change a week players were told is final (Run now still can). `seasonBank` false: the
 * season has no bingo bank of its own yet, so each bingo slot has a twin (forSeason) for it, due with it and listed after it,
 * with tries of its own. `episodes`: { [n]: runs } for the episodes with runs of their own, read in place of `schedule`.
 */
function slots({ schedule, episodes = {}, since, airTimes, episodeMinutes = 0, history, seasonBank = true, tz = null }) {
  const out = [];
  for (const { episode, at: airedAt, minutes } of airTimes) {
    const ends = airedAt.getTime() + (minutes ?? episodeMinutes) * MIN;
    const next = airTimes.find((e) => e.episode === episode + 1);
    // An episode's own runs, when it has them (0431), in place of the season's.
    const list = episodes[episode] || schedule;
    for (const run of list) {
      if (!run.on) continue;
      const due = dueFor(run, ends, next ? next.at : null, airedAt.getTime(), tz);
      if (!due || (since && due < since)) continue;
      const slot = slotOf(run);
      // A run's tries are its slot's, and those of the slots it was before it moved (triedAs).
      const was = triedAs(run, list);
      const at = (s) => nextTryAt(run.kind, due, history.filter((h) => h.episode_number === episode && (s === slot ? was.includes(h.slot) : h.slot === s)));
      const until = run.kind === "bingo" ? airedAt : run.kind === "facts" ? FinalResults.finalResultsAt(airedAt, tz) : null;
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

// ---------- a card the bot chooses ----------

/**
 * Each card run of a season still to come (C7 part 2): for every episode whose card isn't out yet at `now` (outAt) and isn't decided
 * (`chosen`: the episodes with a choice or a fallback), due CARD_BEFORE minutes before it airs and no sooner than CARD_AFTER_PREV
 * after the one before it ends (`airTimes`, `episodeMinutes` as slots reads them), unless that's too late for the card (episodes
 * back to back: then CARD_BEFORE minutes before it, from what's known then), its next try (nextTryAt on its tries in `history`, slot
 * 'card') before the card's out: [{ episode, slot, kind, at (when it was due), next }]. Pure.
 */
function cardNext({ airTimes, episodeMinutes = 0, history, chosen, now }) {
  const out = [];
  for (const { episode, at: airedAt } of airTimes) {
    const cut = CardResearch.outAt(airedAt.getTime());
    if (cut === null || cut <= now.getTime() || chosen.has(episode)) continue;
    const prev = airTimes.find((e) => e.episode === episode - 1);
    const after = prev ? prev.at.getTime() + ((prev.minutes ?? episodeMinutes) + CardResearch.CARD_AFTER_PREV) * MIN : -Infinity;
    const early = airedAt.getTime() - CardResearch.CARD_BEFORE * MIN;
    const due = Math.max(after, early) < cut ? Math.max(after, early) : early;
    const next = nextTryAt("card", new Date(due), history.filter((h) => h.episode_number === episode && h.slot === CARD_SLOT));
    if (!next || next.getTime() >= cut) continue;
    out.push({ episode, slot: CARD_SLOT, kind: "card", at: new Date(due), next });
  }
  return out;
}

/** The card runs due now, across every season with a game whose card the bot chooses (or one season), and when the next comes
 *  due: { due: [job], next }. */
async function planCards(pool, now, seasonId = null) {
  const due = [];
  let next = null;
  const ids = (await CardResearch.cardSeasons(pool)).filter((id) => !seasonId || id === seasonId);
  for (const id of ids) {
    const season = await loadSeasonForJob(pool, id);
    if (!season) continue;
    const [{ rows: history }, { rows: chosen }] = await Promise.all([
      pool.query("SELECT episode_number, slot, started_at, ok FROM bot_research_runs WHERE season_id = $1 AND slot = $2", [id, CARD_SLOT]),
      pool.query("SELECT DISTINCT episode FROM card_choices WHERE season_id = $1 AND status IN ('live', 'fallback')", [id]),
    ]);
    const runs = cardNext({ airTimes: episodeAirTimes(season), episodeMinutes: episodeMinutesOf(season), history, chosen: new Set(chosen.map((r) => r.episode)), now });
    for (const r of runs) {
      if (r.next <= now) due.push({ episode: r.episode, slot: r.slot, kind: r.kind, after: null, at: r.at, season });
      const when = Math.max(r.next.getTime(), now.getTime());
      if (next === null || when < next) next = when;
    }
  }
  return { due, next: next === null ? null : new Date(next) };
}

/**
 * A card run (runJob's, C7 part 2: db/card-research.js): the bot ranks the moments the season's cards are drawn from for episode
 * `episode`, checked and filed in card_choices, live or dropped with why; dropped is a failed try, asked again. A scheduled run for
 * an episode that has a live choice already leaves it be (a choice is never replaced), and a season with no such game left asks
 * nothing.
 */
async function cardJob(pool, job, { ask, dry, runId, finish }) {
  const { season, episode } = job;
  if (job.slot && job.slot !== "now" && (await CardResearch.hasChoice(pool, season.id, episode))) {
    return finish(true, `Episode ${episode}'s card: chosen already, left as it is`, { kept: true });
  }
  const moments = await CardResearch.momentsAsked(pool, season.id);
  if (!moments.length) return finish(true, "No game on the season has a card the bot chooses: nothing to ask", { asked: [] });
  const airedAt = Air.episodeAirTime(season.schedule, episode, season.wikiAirDates);
  // Once the card's out it never changes (its fallback stands): a choice now would change what players have answered.
  const cut = airedAt ? CardResearch.outAt(airedAt.getTime()) : null;
  if (cut === null || Date.now() >= cut || (await CardResearch.hasChoice(pool, season.id, episode))) {
    return finish(true, `Episode ${episode}'s card is out already: nothing to ask`, { out: true });
  }
  const { rows: show } = await pool.query("SELECT name, castaway_term FROM shows WHERE id = $1", [season.show_id]);
  const term = show[0] && show[0].castaway_term ? `${show[0].castaway_term.toLowerCase()}s` : "cast members";
  const prompt = CardResearch.buildCardPrompt({
    showName: show[0] ? show[0].name : season.slug,
    season: season.season_number,
    episode,
    airAt: airedAt ? Air.formatInTz(airedAt, season.air_tz) : null,
    moments,
    term,
  });
  const { answer } = await ask(prompt);
  const ids = moments.map((m) => m.id);
  const parsed = CardResearch.parseCardAnswer(answer, episode, ids);
  const result = { asked: ids, ...parsed };
  const line = parsed.status === "live" ? `Episode ${episode}'s card: ${parsed.moments.length} of ${ids.length} moment(s) ranked, ${parsed.cannot.length} can't happen` : `Episode ${episode}'s card: ${parsed.note}`;
  if (dry) return finish(parsed.status === "live", `${line} (dry run: not filed)`, result);
  // A check or a replay standing in for the bot says so (job.madeBy 'stand-in'): never production's.
  await CardResearch.storeChoice(pool, season.id, episode, ids, parsed, { runId, madeBy: job.madeBy });
  return finish(parsed.status === "live", line, result);
}

// ---------- the bot's own call ----------

/**
 * The call runs due now, across every game with a question played against the bot (or one season's), and when the next comes due:
 * { due: [job], next } (A14 part 2b). For each game, each episode coming by the broadcast's schedule with a window whose call locks
 * there that it hasn't called (BotCalls.windowsAt, as of `now`): its run's time and next try (CallResearch.callNext on its tries, slot
 * 'call:<league id>'). A lock already past by the broadcast's clock (a game at its own pace on an aired season) is never planned.
 */
async function planCalls(pool, now, seasonId = null) {
  const due = [];
  let next = null;
  const only = seasonId ? await loadSeasonForJob(pool, seasonId) : null;
  if (seasonId && !only) return { due, next };
  const seasons = new Map();
  for (const g of await CallResearch.callGames(pool, only)) {
    const s = g.state.settings || {};
    const key = `${s.showId}|${s.wikiSeason}`;
    if (!seasons.has(key)) {
      const [season] = only ? [only] : s.showId && s.wikiSeason != null ? await SeasonClock.loadSeasons(pool, "s.slug = $1 AND ss.season_number::text = $2", [s.showId, String(s.wikiSeason)]) : [];
      const { rows: history } = season ? await pool.query("SELECT episode_number, slot, started_at, ok FROM bot_research_runs WHERE season_id = $1 AND kind = 'call'", [season.id]) : { rows: [] };
      seasons.set(key, season ? { season, airTimes: episodeAirTimes(season), history } : null);
    }
    const on = seasons.get(key);
    if (!on) continue;
    const slot = CallResearch.slotOf(g.id);
    let called = null;
    for (const e of on.airTimes) {
      if (e.at <= now) continue;
      const windows = BotCalls.windowsAt(g.state, e.episode, { now: now.getTime(), airAt: e.at.toISOString() });
      if (!windows.length) continue;
      called ??= await CallResearch.calledOn(pool, g.id);
      if (windows.every((w) => called.has(`${w.q.id}|${w.window}`))) continue;
      const prev = on.airTimes.find((x) => x.episode === e.episode - 1);
      // Its tries since the last that worked: a window that turned up at a lock already called (a phase's, a question added) gets
      // tries of its own.
      const mine = on.history.filter((h) => h.slot === slot && h.episode_number === e.episode);
      const lastOk = Math.max(-Infinity, ...mine.filter((h) => h.ok === true).map((h) => new Date(h.started_at).getTime()));
      const tries = mine.filter((h) => new Date(h.started_at).getTime() > lastOk);
      const r = CallResearch.callNext({
        lockAt: e.at.getTime(),
        prevEnd: prev ? prev.at.getTime() + (prev.minutes ?? episodeMinutesOf(on.season)) * MIN : null,
        tries,
        nextTry: (d, t) => nextTryAt("call", d, t),
      });
      if (!r) continue;
      if (r.next <= now) due.push({ episode: e.episode, slot, kind: "call", after: null, at: r.at, season: on.season, leagueId: g.id, tries: tries.length, now: now.getTime() });
      const when = Math.max(r.next.getTime(), now.getTime());
      if (next === null || when < next) next = when;
      // A later lock's run is never due before this one's: one planned is enough for the game.
      break;
    }
  }
  return { due, next: next === null ? null : new Date(next) };
}

/**
 * A call run (runJob's, A14 part 2b: db/call-research.js): the bot's call on each window of a game's questions against it that locks
 * at `episode` and it hasn't called, from what can be named there, filed through BotCalls.fileCalls (made_by 'bot'; a check's or a
 * replay's job.madeBy 'stand-in'), each checked as a seat's answer is. A try that leaves a window uncalled (missing from the answer,
 * refused, or offering nobody yet) is a failed one, asked again for those alone; a game gone or a lock passed asks nothing.
 */
async function callJob(pool, job, { ask, dry, runId, finish }) {
  const { season, episode, leagueId } = job;
  const { rows } = await pool.query("SELECT state, deleted_at FROM leagues WHERE id = $1", [leagueId]);
  const league = rows[0];
  if (!league || league.deleted_at || (league.state.settings || {}).archivedAt) return finish(true, "The game is gone: nothing to call", { asked: [] });
  const airedAt = Air.episodeAirTime(season.schedule, episode, season.wikiAirDates);
  const airAt = airedAt ? airedAt.toISOString() : null;
  // The planner's clock (a check's or the cron's `now`), so the job reads the locks the planner did.
  const now = Number.isFinite(job.now) ? job.now : Date.now();
  const { asked, cast, waiting } = await CallResearch.windowsToCall(pool, league.state, episode, { now, airAt, skip: await CallResearch.calledOn(pool, leagueId) });
  if (!asked.length) {
    if (waiting.length) return finish(false, `Episode ${episode}: nobody can be named yet on ${waiting.join(", ")} (the format's groups aren't sure)`, { asked: [], waiting });
    return finish(true, `Episode ${episode}: nothing left to call (called already, or locked)`, { asked: [] });
  }
  // The episode before it without its results in the league yet (back to back): who it sent home would still be offered, so its first
  // two tries wait for them; the last calls from what's there.
  if (CallResearch.waitsForResults(league.state, episode) && (job.tries || 0) < 2) {
    return finish(false, `Episode ${episode}: waiting for Episode ${episode - 1}'s results before the bot calls`, { asked: [], waitingFor: episode - 1 });
  }
  const { rows: show } = await pool.query("SELECT name, castaway_term FROM shows WHERE id = $1", [season.show_id]);
  const term = show[0] && show[0].castaway_term ? `${show[0].castaway_term.toLowerCase()}s` : "cast members";
  const prompt = CallResearch.buildCallPrompt({
    showName: show[0] ? show[0].name : season.slug,
    season: season.season_number,
    episode,
    airAt: airedAt ? Air.formatInTz(airedAt, season.air_tz) : null,
    asked,
    cast: asked.some((a) => a.q.answer === "person") ? cast : [],
    term,
    state: league.state,
  });
  const { answer } = await ask(prompt);
  const parsed = CallResearch.parseCallAnswer(answer, episode, asked);
  const result = { asked: asked.map((a) => a.id), calls: parsed.calls, missing: parsed.missing, unknown: parsed.unknown, ...(waiting.length ? { waiting } : {}) };
  if (!parsed.found) return finish(false, `Episode ${episode}'s calls: ${parsed.note}`, result);
  const gaps = [parsed.missing.length ? `${parsed.missing.length} not answered` : null, waiting.length ? `${waiting.length} waiting` : null].filter(Boolean);
  if (dry) return finish(!parsed.missing.length && !waiting.length, `Episode ${episode}: ${parsed.calls.length} of ${asked.length} call(s)${gaps.length ? ` (${gaps.join(", ")})` : ""} (dry run: not filed)`, result);
  const { filed, refused } = await BotCalls.fileCalls(pool, leagueId, parsed.calls, { madeBy: job.madeBy, airAt, now });
  if (refused.length) gaps.unshift(`refused: ${refused.map((x) => `${x.question} (${x.why})`).join("; ")}`);
  const ok = filed.length === asked.length && !waiting.length;
  return finish(ok, `Episode ${episode}: the bot called ${filed.length} of ${asked.length}${gaps.length ? `; ${gaps.join(", ")}` : ""}`, { ...result, filed, refused });
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
      RETURNING a.asked_by, a.asked_at, a.quiet`,
    [seasonId, episode, ok, String(message || "").slice(0, 300), ok ? found : null, ASKED_SLOT, ASKED_TRIES]
  );
  // quiet (0161): Getting it ready's own ask, whose one notification comes when everything's in (season-fill.ts tellReady).
  return rows[0] ? { userId: rows[0].asked_by, askedAt: rows[0].asked_at, ok, found: ok ? found : null, message: ok ? null : message, quiet: !!rows[0].quiet } : null;
}

/**
 * A schedule from a request body or the column, cleaned up; throws on anything malformed. Null is our usual (`usual`, the
 * desk's when it's set: usualSchedule; DEFAULT_SCHEDULE by default). A run's `was` (the slots it moved from) is kept.
 */
function normalizeSchedule(input, usual = DEFAULT_SCHEDULE) {
  if (input == null) return usual.map((r) => ({ ...r, ...(r.was ? { was: [...r.was] } : {}) }));
  if (!Array.isArray(input)) throw new Error("schedule must be a list of runs");
  if (input.length > MAX_RUNS) throw new Error(`At most ${MAX_RUNS} runs`);
  const out = input.map((r) => {
    const kind = r && r.kind;
    const after = Number(r && r.after);
    if (!KINDS.includes(kind)) throw new Error(`A run's kind must be ${KINDS.join(" or ")}`);
    if (!Number.isInteger(after) || after < 0 || after > MAX_AFTER) throw new Error(`"after" must be 0 to ${MAX_AFTER} minutes`);
    const was = Array.isArray(r.was) ? [...new Set(r.was.filter((s) => typeof s === "string" && SLOT_RE.test(s) && s !== `${kind}@${after}`))].slice(-MAX_WAS) : [];
    return { kind, after, on: r.on !== false, ...(was.length ? { was } : {}) };
  });
  // A slot a run moved from that another run holds now isn't its to remember: that run's tries are its own.
  const held = new Set(out.map(slotOf));
  for (const r of out) {
    if (!r.was) continue;
    r.was = r.was.filter((s) => !held.has(s));
    if (!r.was.length) delete r.was;
  }
  // Two entries for the same slot would share their run history, so the second could never run.
  const seen = new Set();
  for (const r of out) {
    const when = r.kind === "trivia" ? "before the next episode" : r.kind === "bingo" ? "before it airs" : "after airing";
    if (seen.has(slotOf(r))) throw new Error(`Two ${r.kind} runs ${r.after} minutes ${when}`);
    seen.add(slotOf(r));
  }
  return out.sort((a, b) => a.after - b.after);
}

/** Our usual runs: the desk's (app_settings 'bot_usual', "Make this our usual") when set and sound, else DEFAULT_SCHEDULE. */
async function usualSchedule(pool) {
  const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = $1", [USUAL_KEY]);
  if (!rows[0] || !Array.isArray(rows[0].value)) return normalizeSchedule(null);
  try {
    return normalizeSchedule(rows[0].value);
  } catch {
    return normalizeSchedule(null);
  }
}

/**
 * The runs of `after` with what they were in `before`: of each kind, the runs that went and the runs that came, in time
 * order, pair up as moved, and a moved run carries the slots it was (`was`), so an episode it already ran for isn't asked
 * again at its new time (slots). A retimed run, a run our usual moved, an episode's own copy of one. Pure.
 */
function carryWas(before, after) {
  const has = (list, r) => list.some((x) => slotOf(x) === slotOf(r));
  const out = after.map((r) => ({ ...r, ...(r.was ? { was: [...r.was] } : {}) }));
  for (const kind of KINDS) {
    const gone = before.filter((r) => r.kind === kind && !has(after, r)).sort((a, b) => a.after - b.after);
    const came = out.filter((r) => r.kind === kind && !has(before, r)).sort((a, b) => a.after - b.after);
    for (let i = 0; i < Math.min(gone.length, came.length); i++) {
      const was = [...new Set([...(came[i].was || []), ...(gone[i].was || []), slotOf(gone[i])])].filter((s) => s !== slotOf(came[i])).slice(-MAX_WAS);
      came[i].was = was;
    }
  }
  return out;
}

/**
 * One run changed in a list of runs (the desk's): `from` (a slot) becomes `to` (a run: retimed, switched), `to` added (no
 * `from`, or a `from` the list hasn't), or `from` taken off (no `to`). A `to` whose slot another run has throws. `loose` (an
 * episode's own runs, reached by a change to every episode): a `from` it hasn't is left as it is, and a `to` it has already
 * only takes `from` off. The moved run keeps what it was, and remembers its old slot (carryWas). Pure; normalized.
 */
function changeRun(list, from, to, { loose = false } = {}) {
  const i = from ? list.findIndex((r) => slotOf(r) === from) : -1;
  if (loose && from && i < 0) return list;
  const rest = list.filter((_, k) => k !== i);
  // An episode's own runs with no room for one more keep what they have (the change for every episode still goes ahead).
  if (loose && to && rest.length >= MAX_RUNS) return list;
  if (!to) return normalizeSchedule(rest);
  if (rest.some((r) => slotOf(r) === slotOf(to))) {
    if (loose) return normalizeSchedule(rest);
    const when = to.kind === "trivia" ? "before the next episode" : to.kind === "bingo" ? "before it airs" : "after it ends";
    throw new Error(`There's already a ${to.kind} run ${to.after} minutes ${when}`);
  }
  const moved = { kind: to.kind, after: to.after, on: to.on !== false, ...(i >= 0 && list[i].was ? { was: list[i].was } : {}) };
  return normalizeSchedule(carryWas(list, [...rest, moved]));
}

/** An episode's own runs as the column has them ({ "7": [runs] }), each cleaned up; one that isn't sound is left out. */
function normalizeEpisodes(input) {
  const out = {};
  for (const [n, runs] of Object.entries(input || {})) {
    try {
      if (Number.isInteger(Number(n)) && Number(n) > 0 && Array.isArray(runs)) out[Number(n)] = normalizeSchedule(runs);
    } catch {
      /* left out: the season's schedule stands for it */
    }
  }
  return out;
}

/**
 * The runs due at `now` for one season, earliest first. Pure.
 *   schedule        -- normalized runs
 *   episodes        -- { [n]: normalized runs } for the episodes with runs of their own (0431), in place of `schedule`
 *   since           -- when bot research was switched on (Date); runs timed before it never run
 *   airTimes        -- [{ episode, at: Date, minutes? }]: when each episode starts airing, and its own length
 *                      when known (later ones are ignored)
 *   episodeMinutes  -- how long an episode runs when it has no length of its own: a run's minutes count from its end
 *   history         -- bot_research_runs rows for the season: { episode_number, slot, started_at, ok }
 *   seasonBank      -- the season has a bingo bank of its own (false: its bingo runs write one too); true by default
 *   tz              -- the season's time zone, for each episode's final results (the facts run stops at them); Eastern by default
 * A job for the season's own bingo bank carries `forSeason`.
 */
function dueRuns({ schedule, episodes = {}, since, airTimes, episodeMinutes = 0, history, now, seasonBank = true, tz = null }) {
  const t = now.getTime();
  return slots({ schedule, episodes, since, airTimes, episodeMinutes, history, seasonBank, tz })
    .filter((s) => s.next && s.next.getTime() <= t && t - s.at.getTime() <= STALE_MS[s.kind] && (!s.until || t < s.until.getTime()))
    .map(({ episode, slot, kind, after, at, forSeason }) => ({ episode, slot, kind, after, at, ...(forSeason ? { forSeason } : {}) }))
    .sort((a, b) => a.at - b.at);
}

/**
 * When this season next has a run due: `now` when one already is, null when none is left. Takes every
 * episode's air time, aired or not. Pure; the same rules as dueRuns, so the VM is never told to come back
 * for a run that then isn't due.
 */
function nextRunAt({ schedule, episodes = {}, since, airTimes, episodeMinutes = 0, history, now, seasonBank = true, tz = null }) {
  const t = now.getTime();
  let best = null;
  for (const s of slots({ schedule, episodes, since, airTimes, episodeMinutes, history, seasonBank, tz })) {
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
    `- airsAt: when episode ${episode + 1} starts, ISO 8601 with the UTC offset of the time zone it's announced in, as it is on that date (after a clock change, the new one). If the show takes a week off, the date of the next one that does air.`,
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
  const seasons = (await loadBotSeasons(pool, seasonId)).filter((s) => s.status === "airing");
  // Our usual, for the seasons that follow it (no schedule of their own).
  const usual = seasons.some((s) => s.bot_research_schedule == null) ? await usualSchedule(pool) : DEFAULT_SCHEDULE;
  for (const season of seasons) {
    const { rows: history } = await pool.query(
      "SELECT episode_number, slot, started_at, ok FROM bot_research_runs WHERE season_id=$1",
      [season.id]
    );
    const schedule = normalizeSchedule(season.bot_research_schedule, usual);
    const episodes = normalizeEpisodes(season.bot_research_episodes);
    const input = {
      schedule,
      episodes,
      since: season.bot_research_since ? new Date(season.bot_research_since) : null,
      airTimes: episodeAirTimes(season),
      episodeMinutes: episodeMinutesOf(season),
      history,
      now,
      // Asked only of a season whose schedule has bingo on: its own bank yet?
      seasonBank: [schedule, ...Object.values(episodes)].some((l) => l.some((r) => r.kind === "bingo" && r.on)) ? await Bingo.hasBank(pool, season.id, null) : true,
      tz: season.air_tz,
    };
    if (SeasonClock.isSeasonLive(season, now)) due.push(...dueRuns(input).map((r) => ({ ...r, season })));
    const when = nextRunAt(input);
    if (when && SeasonClock.isSeasonLive(season, when) && (next === null || when < next)) next = when;
  }
  // The tie-breaks (the desk's switch, across every season). One season asked about needs only its own.
  const ties = await planTiebreaks(pool, now);
  for (const job of ties.due) if (!seasonId || job.season.id === seasonId) due.push(job);
  if (!seasonId && ties.next && (next === null || ties.next < next)) next = ties.next;
  // C7 part 2: a card the bot chooses (any season with such a game, whatever its schedule).
  const cards = await planCards(pool, now, seasonId);
  due.push(...cards.due);
  if (cards.next && (next === null || cards.next < next)) next = cards.next;
  // A14 part 2b: the bot's own call before each lock (any game with a question against it, whatever its season's schedule).
  const calls = await planCalls(pool, now, seasonId);
  due.push(...calls.due);
  if (calls.next && (next === null || calls.next < next)) next = calls.next;
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
 * Runs one job: asks the bot (`ask(prompt, { budgetMs?, kind }) -> { answer }`, injected so a test can stand in; `kind`, the
 * job's, lets a run kind ask an AI of its own: src/lib/bot-runs.ts) and files
 * the answer. A quick answer is kept on the run row; a full one goes through the paste import, merged
 * into whatever the episode already has; trivia's questions, checked, go in trivia_questions (0140); bingo's squares, checked,
 * go in bingo_squares (0146) as the episode's bank, or with `job.forSeason` the season's own. `send` (the app's) also files
 * either as a source: a quick answer it can't trust yet waits for a commissioner and counts as a failed try, so it's asked again.
 * `dry` asks and parses but writes nothing.
 */
async function runJob(pool, job, { ask: askAny, send = null, dry = false } = {}) {
  const { season, episode, kind } = job;
  const ask = (prompt, o = {}) => askAny(prompt, { kind, ...o });
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
      // A13: once the episode after it has aired, the batch is the key of a game's trivia round that has locked: added to, never
      // replaced, so that round keeps what it was graded on.
      const next = episodeAirTimes(season).find((e) => e.episode === episode + 1);
      await Trivia.storeTrivia(pool, season.id, episode, questions, runId, { keep: !!next && next.at.getTime() <= Date.now() });
      // None passing is a failed try, asked again (a new batch replaces this one).
      return finish(live > 0, line, result);
    }
    if (kind === "bingo") return await bingoJob(pool, job, { ask, dry, runId, started, finish });
    if (kind === "facts") return await factsJob(pool, job, { ask, dry, runId, finish });
    if (kind === "card") return await cardJob(pool, job, { ask, dry, runId, finish });
    if (kind === "call") return await callJob(pool, job, { ask, dry, runId, finish });
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
    // G1 part 4: the season's added moments the stored answer still leaves unsure, asked on their own and filed into it and into
    // what's sent (db/moments-research.js askUnsure), so the leagues get them with the rest. Its failing doesn't fail the run.
    let moments = null;
    if (!dry) {
      try {
        moments = await MomentsRun.askUnsure(pool, season, episode, ask, run);
      } catch (e) {
        moments = { asked: [], line: `Added moments: ${e.message}`, changed: [], repairs: [] };
      }
    }
    const d = run.decisions || {};
    const result = {
      researchId: run.id || null,
      merged: again,
      ...(moments ? { moments } : {}),
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
      return finish(true, `${lead}${sent.count} of ${sent.facts} result(s) in every league${again ? " (the stored answers merged too)" : ""}${moments ? `. ${moments.line}` : ""}`, { ...result, submission: sent.researchId, live: sent.count });
    }
    return finish(true, `${result.inserted} new result(s) to review${again ? " (merged into the earlier answers)" : ""}${moments ? `. ${moments.line}` : ""}`, result);
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

/**
 * A facts run (runJob's, A13 part 2b: db/facts-research.js): the facts the episode's stored answer isn't sure of, asked on their
 * own, filed into that answer (fillFacts: never a sure answer replaced by an unsure one). No stored answer yet (its full run hasn't
 * landed) is a failed try, asked again; nothing unsure is nothing asked. An answer that's still unsure is filed and done (asking
 * again a few minutes later seldom says more); one without the facts in it is a failed try.
 */
async function factsJob(pool, job, { ask, dry, runId, finish }) {
  const { season, episode } = job;
  const about = await FactsRun.factsFor(pool, season.id, episode);
  if (!about.stored) return finish(false, `Episode ${episode}'s research isn't in yet: its facts are asked once it is`, null);
  if (!about.ask.length) return finish(true, "Nothing to ask: research was sure of its facts", { asked: [] });
  const { answer } = await ask(FactsRun.buildFactsPrompt({ ...about, facts: about.ask }));
  const parsed = FactsRun.parseFactsAnswer(answer, about.ask);
  const result = { asked: about.ask, episodeFacts: parsed.episodeFacts, episodeTitle: parsed.episodeTitle, repairs: parsed.repairs };
  if (!parsed.found) return finish(false, `No episode facts in the answer about Episode ${episode}`, result);
  // The bot's chat can carry an earlier question over (the full run's checkEpisode): an answer about another title is a failed try.
  if (!FactsRun.sameTitle(about.title, parsed.episodeTitle)) return finish(false, `The answer was about "${parsed.episodeTitle}", not Episode ${episode} ("${about.title}")`, result);
  const line = FactsRun.factsLine(parsed.episodeFacts);
  if (dry) return finish(true, `${line} (dry run: not filed)`, result);
  const filed = await FactsRun.storeFacts(pool, { showId: season.show_id, season: season.season_number, episode }, parsed.episodeFacts, {
    at: new Date().toISOString(),
    runId,
    asked: about.ask,
  });
  if (!filed) return finish(false, `Episode ${episode}'s research went before its facts could be filed`, result);
  return finish(true, `${line}${filed.changed ? "" : " (nothing new: research was already sure)"}`, { ...result, filed: filed.episodeFacts, changed: filed.changed });
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
  KINDS,
  SLOT_RE,
  DEFAULT_SCHEDULE,
  FACTS_BEFORE_FINAL,
  dueFor,
  triedAs,
  USUAL_KEY,
  usualSchedule,
  carryWas,
  changeRun,
  normalizeEpisodes,
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
  CARD_SLOT,
  cardNext,
  planCards,
  planCalls,
  RUNNING_STALE_MS,
  askedNext,
  seasonAskNext,
  planAsks,
};
