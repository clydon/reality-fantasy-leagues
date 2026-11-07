// A card the bot chooses (docs/PLAN-start-a-game-gpt.md step C7 part 2; game-spec schema.js `card: { from: 'bot' }`): before each
// episode, the ask-AI bot ranks the moments the season's cards are drawn from for that episode, best first (could go either way, and
// matter to where the season is), and says which can't happen in it (tribe challenges after the merge). One ask for the season: every
// game on it whose card the bot chooses reads the same choice, each card taking the first `each` of its own list in that order
// (schema.js rankedLines), so two games with different lists still share one run.
//
// Bot research's card run (db/bot-research.js planCards) asks it for the next episode of every season with such a game: due
// CARD_BEFORE minutes before that episode airs (no sooner than CARD_AFTER_PREV after the one before it ends, for its recaps), three
// tries, and never once the card is out (Spec.CARD_OUT_HOURS before the episode). Its answer is checked here (every id one it was
// asked about, none twice, at least one ranked, the episode the one asked about) and kept in card_choices (0208), live or dropped
// with why. No second ask: the choice settles nothing (each line is still settled by research after the episode, as any moment is),
// and a wrong ranking only orders the card; what it can get wrong that matters, an id or the episode, the parse catches.
//
// The server stamps each league's episodes with each episode's card (stampChoices, here so the checks and the server read it the
// one way; src/lib/server/card-choices.ts calls stampLeague): its first decided row, a live choice or a fallback, oldest first. The
// card is out once a choice is made, or CARD_OUT_HOURS before the episode airs (at once when its air time isn't known): the first
// read after that with no choice files a fallback (status 'fallback', made_by 'app'), so once a card is out it never changes, an air
// date moved or a later choice notwithstanding, and a line answered never changes its moment. The card run never files once it's out.
//
// The prompt, the parse and stampChoices are pure (tests/card-bot.test.js); the rest read and write the database.
const StateLogic = require("../src/lib/game/state-logic.js");
const Spec = require("../src/lib/game/game-spec/index.js");
const Air = require("../src/lib/game/air-schedule.js");
const SeasonClock = require("./season-clock.js");

/** How many minutes before its episode airs the card run is due (no sooner than CARD_AFTER_PREV after the one before it ends). */
const CARD_BEFORE = 2 * 24 * 60;
const CARD_AFTER_PREV = 3 * 60;
/** The most moments one ask ranks (the season's cards' lists together). */
const MAX_ASKED = 60;
const MAX_WHY = 300;
const HOUR = 60 * 60 * 1000;

const str = (v) => (typeof v === "string" ? v.trim() : "");

/**
 * The prompt. `moments`: [{ id, label }] the season's cards are drawn from; `airAt`, when episode n airs (words), or null.
 */
function buildCardPrompt({ showName, season, episode: n, airAt = null, moments, term = "cast members" }) {
  const when = airAt ? ` It airs ${airAt}.` : "";
  const before = n > 1 ? `Episode ${n - 1} is the latest to air; episode ${n} hasn't aired yet.${when}` : `Episode 1 hasn't aired yet.${when}`;
  return [
    `Search the web for ${showName} season ${season}. ${before}`,
    `Read recaps and news about the season so far${n > 1 ? ` (episode ${n - 1} especially)` : ""}, and any preview of episode ${n}: the network's`,
    "description, a teaser, a press release. Never use anything about episode " + n + " that came out after it aired.",
    "",
    `Players of a game answer questions about episode ${n} before it airs: for a few of the moments below, whether it happens in`,
    `episode ${n} (or who of the ${term} does it). Rank every moment by how good a question it makes for episode ${n}:`,
    "- first, moments that could really go either way in this episode and matter to where the season is now (an idol or",
    "  advantage in play, a journey or a reward the preview shows, a vote that could split);",
    "- then the rest, ending with those that are near certain to happen or near certain not to.",
    `Put in "cannot" only the moments the season's format rules out in episode ${n} (for example a tribe challenge once the tribes`,
    "have merged, or a jury vote before the finale). Leave a moment out of \"cannot\" whenever it could happen at all.",
    "",
    "The moments (use these ids exactly):",
    ...moments.map((m) => `- ${m.id}: ${str(m.label).replace(/\.\s*$/, "") || m.id}`),
    "",
    'Every id goes in exactly one of the two lists: "moments" (ranked, best first) or "cannot".',
    "Reply with only this JSON, in a ```json code block, and nothing after it:",
    `{"episode": ${n}, "moments": ["id", "id"], "cannot": ["id"], "why": "one line on what's at stake in episode ${n}"}`,
    "Plain JSON: double quotes, no comments, no trailing commas.",
  ].join("\n");
}

/** The JSON object in an answer (a code block, or the outermost braces), parsed; null when there's none that parses. */
function jsonIn(text) {
  const s = String(text || "");
  const block = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = block ? block[1] : s;
  const a = body.indexOf("{");
  const b = body.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    return JSON.parse(body.slice(a, b + 1));
  } catch {
    return null;
  }
}

/**
 * The bot's answer, checked: { status: 'live' | 'dropped', moments (ranked, each one of `ids`, none twice), cannot (each one of
 * `ids`, none of `moments`), unknown (ids it gave that it wasn't asked about), why, note (why it was dropped) }. Live when it's about
 * episode `n` (when it says) and ranks at least one moment; an id in both lists is in neither (it said two things about it). Pure.
 */
function parseCardAnswer(text, n, ids) {
  const asked = new Set(ids);
  const raw = jsonIn(text);
  const out = { status: "dropped", moments: [], cannot: [], unknown: [], why: null, note: null };
  if (!raw || typeof raw !== "object") return { ...out, note: "No JSON in the answer" };
  if (raw.episode !== undefined && Number(raw.episode) !== n) return { ...out, note: `The answer was about episode ${raw.episode}, not ${n}` };
  const list = (v) => (Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : []);
  const unknown = new Set();
  const clean = (l) => {
    const seen = new Set();
    return l.filter((id) => {
      if (!asked.has(id)) {
        unknown.add(id);
        return false;
      }
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };
  const ranked = clean(list(raw.moments));
  const ruled = clean(list(raw.cannot));
  const both = new Set(ranked.filter((id) => ruled.includes(id)));
  out.moments = ranked.filter((id) => !both.has(id));
  out.cannot = ruled.filter((id) => !both.has(id));
  out.unknown = [...unknown];
  out.why = str(raw.why).slice(0, MAX_WHY) || null;
  if (!out.moments.length) return { ...out, note: "It ranked none of the moments it was asked about" };
  return { ...out, status: "live" };
}

/** When episode `n`'s card is out (ms): CARD_OUT_HOURS before it airs (`airAt`, ms), or null when its air time isn't known. */
const outAt = (airAt) => (Number.isFinite(airAt) ? airAt - Spec.CARD_OUT_HOURS * HOUR : null);

/**
 * Stamps a league's episodes with its card (`episode.cardChoice`), for a game whose card the bot chooses (any other game's stamps
 * come off): the episode's first decided row (`rows`: the season's, { episode, status: 'live' | 'fallback', moments, cannot },
 * oldest first), its choice or { fallback: true }; with none, once its card is out (outAt from `airAtOf(n)`, ms or null: the
 * broadcast's, whatever the league's own pace; at once with no air time known) or it has results, { fallback: true }, and the episode
 * is in `mark` (a fallback to file, so it stands); else nothing (not out yet). Only the episodes the game plays (StateLogic.inPlay:
 * none before it starts, so a game made mid-season files nothing for the episodes before it). { changed, mark }. Pure.
 */
function stampChoices(state, rows, airAtOf, now = Date.now()) {
  const bot = Spec.botCard(Spec.cardOf(StateLogic.gameOf(state)));
  const byEp = new Map();
  if (bot) {
    for (const r of rows || []) {
      if (byEp.has(r.episode) || (r.status !== "live" && r.status !== "fallback")) continue;
      byEp.set(r.episode, r.status === "fallback" ? { fallback: true } : { moments: [...r.moments], cannot: [...(r.cannot || [])] });
    }
  }
  let changed = false;
  const mark = [];
  for (const ep of state.episodes || []) {
    let want = null;
    if (bot && StateLogic.inPlay(state, ep.number)) {
      want = byEp.get(ep.number) || null;
      if (!want) {
        const out = outAt(airAtOf(ep.number));
        if (out === null || now >= out || StateLogic.EpisodeLogic.hasResults(ep)) {
          want = { fallback: true };
          mark.push(ep.number);
        }
      }
    }
    if (JSON.stringify(ep.cardChoice || null) === JSON.stringify(want)) continue;
    if (want) ep.cardChoice = want;
    else delete ep.cardChoice;
    changed = true;
  }
  return { changed, mark };
}

// ---------- the database ----------

/** Whether a league's stored state plays a card the bot chooses (its game spec when it carries one, else its settings). */
const BOT_CARD_SQL = `(l.state->'settings'->'game'->'card'->>'from' = 'bot'
   OR (l.state->'settings'->'game' IS NULL AND l.state->'settings'->'gameCard'->>'from' = 'bot'))`;
/** A league still played: not deleted, not archived. */
const LIVE_SQL = `l.deleted_at IS NULL AND l.state->'settings'->>'archivedAt' IS NULL`;

/** The seasons with a game whose card the bot chooses: their ids. */
async function cardSeasons(pool) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ss.id FROM leagues l
       JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE ${LIVE_SQL} AND ${BOT_CARD_SQL}`
  );
  return rows.map((r) => r.id);
}

/**
 * The moments a season's cards are drawn from, [{ id, label }], each once, in the order the games list them (the oldest game's
 * first), with the league's words for each (its rules' label); at most MAX_ASKED. Empty when no game on it has a card the bot
 * chooses.
 */
async function momentsAsked(pool, seasonId) {
  const { rows } = await pool.query(
    `SELECT l.state FROM leagues l
       JOIN shows s ON s.slug = l.state->'settings'->>'showId'
       JOIN show_seasons ss ON ss.show_id = s.id AND ss.season_number::text = l.state->'settings'->>'wikiSeason'
      WHERE ss.id = $1 AND ${LIVE_SQL} AND ${BOT_CARD_SQL}
      ORDER BY l.created_at, l.id`,
    [seasonId]
  );
  const out = new Map();
  for (const r of rows) {
    const card = Spec.cardOf(StateLogic.gameOf(r.state));
    if (!Spec.botCard(card)) continue;
    const events = StateLogic.formatOf(r.state).events || [];
    for (const id of card.of) {
      if (typeof id !== "string" || out.has(id) || out.size >= MAX_ASKED) continue;
      const e = events.find((x) => x.id === id);
      out.set(id, { id, label: (e && e.label) || id });
    }
  }
  return [...out.values()];
}

/** Whether a season's episode's card is decided (a live choice, or its fallback). */
async function hasChoice(pool, seasonId, n) {
  const { rows } = await pool.query("SELECT 1 FROM card_choices WHERE season_id = $1 AND episode = $2 AND status IN ('live', 'fallback') LIMIT 1", [seasonId, n]);
  return rows.length > 0;
}

/** Files a season's episode's fallback (its card came out without a choice), unless it's decided already. */
async function markFallback(pool, seasonId, n) {
  await pool.query(
    `INSERT INTO card_choices (season_id, episode, asked, moments, cannot, status, note, made_by)
     SELECT $1, $2, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'fallback', 'The card came out without the bot''s choice', 'app'
      WHERE NOT EXISTS (SELECT 1 FROM card_choices WHERE season_id = $1 AND episode = $2 AND status IN ('live', 'fallback'))`,
    [seasonId, n]
  );
}

/** Files a choice (parseCardAnswer's, live or dropped) for a season's episode. o: { runId, madeBy: 'bot' | 'stand-in', at (a
 *  stand-in's time, ISO) }. Returns its id. */
async function storeChoice(pool, seasonId, n, asked, parsed, o = {}) {
  const madeBy = o.madeBy === "stand-in" ? "stand-in" : "bot";
  const note = [parsed.note, parsed.why ? `Why: ${parsed.why}` : null, parsed.unknown && parsed.unknown.length ? `Not asked about: ${parsed.unknown.join(", ")}` : null]
    .filter(Boolean)
    .join(". ")
    .slice(0, 1000) || null;
  const { rows } = await pool.query(
    `INSERT INTO card_choices (season_id, episode, asked, moments, cannot, status, note, made_by, run_id, created_at)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9, COALESCE($10::timestamptz, now())) RETURNING id`,
    [seasonId, n, JSON.stringify(asked), JSON.stringify(parsed.moments || []), JSON.stringify(parsed.cannot || []), parsed.status === "live" ? "live" : "dropped", note, madeBy, o.runId || null, o.at || null]
  );
  return rows[0].id;
}

/** A season's decided rows (live choices and fallbacks), oldest first: what a league's episodes are stamped from (stampChoices). */
async function liveChoices(pool, seasonId) {
  const { rows } = await pool.query(
    "SELECT episode, status, moments, cannot, created_at FROM card_choices WHERE season_id = $1 AND status IN ('live', 'fallback') ORDER BY created_at, id",
    [seasonId]
  );
  return rows;
}

/**
 * A league's season by its show's slug and number: its id and when each episode airs by the broadcast's schedule (ms, or null), for
 * stampChoices; null for a season the catalog doesn't have.
 */
async function seasonClock(pool, slug, number) {
  const [season] = await SeasonClock.loadSeasons(pool, "s.slug = $1 AND ss.season_number::text = $2", [slug, String(number)]);
  if (!season) return null;
  return {
    seasonId: season.id,
    airAtOf: (n) => {
      const at = Air.episodeAirTime(season.schedule, n, season.wikiAirDates);
      return at ? at.getTime() : null;
    },
  };
}

/** Stamps a league's episodes from the database (stampChoices on its season's decided rows), filing a fallback for each episode
 *  whose card it finds out without one; a game whose card the bot doesn't choose has its stamps taken off without a query, and one on
 *  no season the catalog has plays every card on its fallback. True when anything changed. */
async function stampLeague(pool, state, now = Date.now()) {
  if (!Spec.botCard(Spec.cardOf(StateLogic.gameOf(state)))) return stampChoices(state, [], () => null, now).changed;
  const s = state.settings || {};
  const clock = s.showId && s.wikiSeason != null ? await seasonClock(pool, s.showId, s.wikiSeason) : null;
  if (!clock) return stampChoices(state, [], () => null, now).changed;
  const r = stampChoices(state, await liveChoices(pool, clock.seasonId), clock.airAtOf, now);
  for (const n of r.mark) await markFallback(pool, clock.seasonId, n);
  return r.changed;
}

module.exports = { jsonIn, seasonClock, stampLeague, markFallback, CARD_BEFORE, CARD_AFTER_PREV, MAX_ASKED, buildCardPrompt, parseCardAnswer, outAt, stampChoices, cardSeasons, momentsAsked, hasChoice, storeChoice, liveChoices };
