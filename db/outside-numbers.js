// A number from a vetted outside source, read once and stored (docs/PLAN-start-a-game-gpt.md step A14 part 7; game-spec schema.js
// `settle: { by: 'outside', take: 'rating', source: 'tvmaze', after }`; migration 0213): for every season a game asks it on, each
// episode's TVmaze rating as it stands `after` days after the episode aired, kept in outside_numbers so every league on the season
// reads the same number and a later rating never changes it.
//
//   node db/outside-numbers.js          # read whatever is due now
//   node db/outside-numbers.js --dry    # say what would be read; store nothing
//
// NOT RUN BY ANY JOB YET: asking TVmaze for ratings is a new data source, the user's to approve at the merge (the plan's A14 part 7
// Noticed). Once approved it's one more step of .github/workflows/reminders-waivers.yml (hourly; `node db/outside-numbers.js`),
// after waivers.js. TVmaze is free, needs no key and allows at least 20 calls every 10 seconds per IP (docs/HOSTING.md): one
// call a season with something due, an hour at most.
//
// Due: an episode of the season, from the first a game asking it starts at, whose moment (its air time, as the app stamps it: air-schedule.js episodeAirTime, plus `after`
// days) has passed, with nothing stored for it yet. What's stored, once (an INSERT that never overwrites): the rating, or why there
// was none: `none` (TVmaze had no rating for it then), and, once GRACE_DAYS past the moment with every run before trying again,
// `unlisted` (the season still isn't linked to its TVmaze listing) or `unreached` (TVmaze still didn't answer). A season played at your own pace
// reads its aired episodes' ratings at its first run, as they stand then (they settled long ago).
//
// `fetchRatings(listingId)` is the only thing that asks TVmaze: the tests and the checks stub it (never TVmaze from a unit test).
require("dotenv").config({ path: ".env.local", quiet: true });
const Air = require("../src/lib/game/air-schedule.js");
const StateLogic = require("../src/lib/game/state-logic.js");
const Spec = require("../src/lib/game/game-spec/index.js");
const { loadSeasons } = require("./season-clock.js");

const TVMAZE = "https://api.tvmaze.com";
const UA = { "User-Agent": "GameYourShow/1.0 (+https://gameyourshow.com)" };
const DAY = 24 * 60 * 60 * 1000;
/** How long past its moment a number TVmaze won't give us waits before it's void (so no game waits on it). */
const GRACE_DAYS = 3;
/** A season's most episodes looked at. */
const MAX_EPISODES = 60;

/** Each regular episode's TVmaze rating (rating.average, or null), by its number, for a TVmaze season (show_seasons.listing_id). */
async function tvmazeRatings(listingId, base = TVMAZE) {
  const res = await fetch(`${base}/seasons/${listingId}/episodes`, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`TVmaze answered ${res.status}`);
  const out = new Map();
  for (const e of await res.json()) {
    if (!Number.isInteger(e && e.number) || e.number < 1 || (e.type && e.type !== "regular")) continue;
    const r = e.rating && typeof e.rating.average === "number" && Number.isFinite(e.rating.average) ? e.rating.average : null;
    out.set(e.number, r);
  }
  return out;
}

/** The outside numbers a league's game asks, as { source, what, after } (each once). */
function asked(state) {
  const out = new Map();
  for (const q of StateLogic.AnswerLogic.questions(state)) {
    if (!Spec.isOutside(q)) continue;
    const st = Spec.fullQuestion(q).settle;
    out.set(Spec.outsideKey(st), { source: st.source, what: st.take, after: st.after });
  }
  return [...out.values()];
}

/**
 * Read and store every outside number that's due now. `opts`: now (ms), fetchRatings (listingId -> Map number -> rating|null; the
 * tests' stand-in), dry (say, store nothing), seasonIds (only these: a check's own), log. Returns what it stored, as
 * [{ seasonId, episode, key, value, why }].
 */
async function settleOutside(pool, opts = {}) {
  const now = opts.now || Date.now();
  const fetchRatings = opts.fetchRatings || tvmazeRatings;
  const log = opts.log || ((line) => console.log(`[outside] ${line}`));
  // Every game that could ask one (a cheap filter; asked() decides), by its season.
  const { rows: leagues } = await pool.query(
    `SELECT state FROM leagues WHERE deleted_at IS NULL AND COALESCE(state->'settings'->>'archivedAt', '') = '' AND state::text LIKE '%"outside"%'`
  );
  const want = new Map();
  for (const { state } of leagues) {
    const s = (state && state.settings) || {};
    if (!s.showId || s.wikiSeason == null) continue;
    const keys = asked(state);
    if (!keys.length) continue;
    const k = `${s.showId}|${s.wikiSeason}`;
    const m = want.get(k) || new Map();
    // From the game's first episode (Spec.spanStart: a number, or { at }; a game starting at a phase, from the episode it started,
    // and nothing while it waits for it).
    const from = Spec.spanStart(StateLogic.gameOf(state).span) ?? (Number.isInteger(s.startEpisode) && s.startEpisode >= 1 ? s.startEpisode : null);
    if (from === null) continue;
    for (const a of keys) {
      const key = Spec.outsideKey({ source: a.source, take: a.what, after: a.after });
      m.set(key, { ...a, from: Math.min(from, m.has(key) ? m.get(key).from : from) });
    }
    want.set(k, m);
  }
  if (!want.size) return [];
  // Only the seasons a game asks it on (and with opts.seasonIds, only those).
  const pairs = [...want.keys()].map((k) => k.split("|"));
  const seasons = (await loadSeasons(pool, "(s.slug, ss.season_number::text) IN (SELECT * FROM unnest($1::text[], $2::text[]))", [pairs.map((p) => p[0]), pairs.map((p) => p[1])]))
    .filter((s) => !opts.seasonIds || opts.seasonIds.includes(s.id));
  const stored = [];
  for (const season of seasons) {
    const keys = [...want.get(`${season.slug}|${season.season_number}`).values()];
    const { rows: had } = await pool.query("SELECT episode, source, what, after_days FROM outside_numbers WHERE season_id = $1", [season.id]);
    const have = new Set(had.map((r) => `${r.episode}|${r.source}:${r.what}:${r.after_days}`));
    const due = [];
    const last = Number.isInteger(season.episode_count) && season.episode_count > 0 ? Math.min(season.episode_count, MAX_EPISODES) : MAX_EPISODES;
    for (let n = 1; n <= last; n++) {
      const at = Air.episodeAirTime(season.schedule, n, season.wikiAirDates);
      if (!at || at.getTime() > now) break;
      for (const a of keys) {
        const key = Spec.outsideKey({ source: a.source, take: a.what, after: a.after });
        const moment = at.getTime() + a.after * DAY;
        if (n >= a.from && moment <= now && !have.has(`${n}|${key}`)) due.push({ n, a, key, moment });
      }
    }
    if (!due.length) continue;
    const { rows: link } = await pool.query("SELECT listing_id FROM show_seasons WHERE id = $1", [season.id]);
    const listingId = link[0] && link[0].listing_id;
    let ratings = null;
    let failed = null;
    if (listingId != null) {
      try {
        ratings = await fetchRatings(listingId);
      } catch (e) {
        failed = e;
      }
    }
    for (const d of due) {
      let value = null;
      let why = null;
      if (listingId == null || !ratings) {
        // Not linked to TVmaze, or TVmaze didn't answer: the next run tries again (a season linked late, or linked again, still
        // settles), until it's been too long.
        if (now - d.moment < GRACE_DAYS * DAY) continue;
        why = listingId == null ? "unlisted" : "unreached";
      } else {
        const r = ratings.get(d.n);
        if (typeof r === "number" && Number.isFinite(r) && r >= 0 && r <= 10) value = r;
        else why = "none";
      }
      stored.push({ seasonId: season.id, episode: d.n, key: d.key, value, why });
      if (opts.dry) continue;
      await pool.query(
        `INSERT INTO outside_numbers (season_id, episode, source, what, after_days, value, why, read_at) VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8 / 1000.0))
         ON CONFLICT DO NOTHING`,
        [season.id, d.n, d.a.source, d.a.what, d.a.after, value, why, now]
      );
    }
    log(`${season.slug} ${season.season_number}: ${due.length} due${failed ? ` (TVmaze: ${failed.message})` : ""}`);
  }
  return stored;
}

module.exports = { settleOutside, tvmazeRatings, asked, GRACE_DAYS };

if (require.main === module) {
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  settleOutside(pool, { dry: process.argv.includes("--dry") })
    .then((s) => console.log(`[outside] ${s.length} stored${process.argv.includes("--dry") ? " (dry: nothing written)" : ""}`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
