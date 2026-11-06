// The bot's own call as an opponent (docs/PLAN-start-a-game-gpt.md step A14 part 2): a game of questions' question played against
// the bot (its spec's `beat` { by: 'bot' }, "beat the bot: the AI makes its call too; you score when you're right and it's wrong")
// has the bot's call on each window, kept in bot_calls (migration 0206), never in the league's state and never as a seat. This
// module files calls and says which windows wait for one; the bot's run that asks for them before each lock comes after it (step
// A14 part 2b), and until then a check or a replay files a stand-in (made_by 'stand-in'). The server reads the calls into the
// grade's facts once each window's lock has passed (src/lib/server/answer-points.ts botCallsFor).
//
// A call is checked as a seat's answer is (Spec.answerProblem): against who could be named at the window's first lock, from the
// league as it stands then (the bot has no spoiler mark: it calls before the episode, from what anyone could know). It's filed only
// while the window is still open for it: its first lock (asked once, the game's first episode) not yet passed. Changeable until then,
// never after.
//
// windowsAt is pure; the rest read and write the database.
const StateLogic = require("../src/lib/game/state-logic.js");
const Spec = require("../src/lib/game/game-spec/index.js");
const Timeline = require("./format-timeline.js");
const SeasonClock = require("./season-clock.js");
const Air = require("../src/lib/game/air-schedule.js");

const { AnswerLogic } = StateLogic;
const MAX_NOTE = 300;

/** A game's questions played against the bot (whole: each with its defaults). */
const beatQuestions = (state) => AnswerLogic.questions(state).filter((q) => Spec.isBeat(q));

/** The episode a window's call locks at: the window's first (asked once, the game's first), or null while the game waits for its
 *  phase. */
function lockOf(state, q, window) {
  return q.asked === "once" ? StateLogic.startEpisode(state) : window;
}

/**
 * Whether the bot can no longer call a window: the players' own lock (AnswerLogic.closed: its episode has results or has started,
 * `airAt` its air time from the schedule for one the league hasn't stamped and never for a league catching up at its own pace, or the
 * game is over), but a question asked once that waits for the finale locks for the bot at the game's first episode (lockOf), so it
 * calls before anyone could know more. o: { now, airAt }. Pure.
 */
function locked(state, q, window, o = {}) {
  const asLocked = q.asked === "once" && q.closes === "finale" ? { ...q, closes: "start" } : q;
  return AnswerLogic.closed(state, asLocked, window, { now: o.now !== undefined ? Number(o.now) : Date.now(), airAt: o.airAt || null });
}

/**
 * The windows of a game's questions played against the bot whose call locks at `episode` (each one opening there; asked once, the
 * game's first), each { q, window } (window: the answers' key, 0 asked once), less those already locked. o: { now, airAt }. Pure.
 */
function windowsAt(state, episode, o = {}) {
  const out = [];
  for (const q of beatQuestions(state)) {
    if (q.asked === "once") {
      if (StateLogic.startEpisode(state) === episode && !locked(state, q, 0, o)) out.push({ q, window: 0 });
    } else if (AnswerLogic.opensAt(state, q, episode) && !locked(state, q, episode, o)) out.push({ q, window: episode });
  }
  return out;
}

/** The format's groups going into each episode (F3 part 2), for a group question asked each episode on a season played in groups
 *  the league doesn't hold: the same read a seat's answers have (db/format-timeline.js leagueGroupFacts); undefined otherwise. */
async function formatGroups(pool, state) {
  if (!beatQuestions(state).some(Spec.readsTimeline)) return undefined;
  return Timeline.leagueGroupFacts(pool, state);
}

/**
 * Who (or which groups) a call on a window can name, [{ id, name }], as a seat's answer could at that lock (AnswerLogic.faces, on the
 * league as it stands: the bot has no spoiler mark), `fg` the format's groups going into it; null for an answer that names nobody.
 * Pure.
 */
function facesFor(state, q, fg) {
  if (!Spec.NAMES.includes(q.answer)) return null;
  return AnswerLogic.faces(state, q, { groups: fg || null }).map((f) => ({ id: f.id, name: f.name }));
}

/** A game's state and whether it's gone (deleted or archived): what filing a call reads. */
async function readLeague(pool, leagueId) {
  const { rows } = await pool.query("SELECT state, deleted_at FROM leagues WHERE id = $1", [leagueId]);
  return rows[0] ? { state: rows[0].state, gone: !!rows[0].deleted_at || !!(rows[0].state.settings || {}).archivedAt } : null;
}

/** When each episode of a game's season airs, from its schedule (the league's own state stamps only some): episode -> ISO time, or
 *  null for a season the schedule doesn't know. */
async function airTimesOf(pool, state) {
  const s = state.settings || {};
  if (!s.showId || s.wikiSeason == null) return null;
  const [season] = await SeasonClock.loadSeasons(pool, "s.slug = $1 AND ss.season_number::text = $2", [s.showId, String(s.wikiSeason)]);
  if (!season) return null;
  return (n) => {
    const at = Air.episodeAirTime(season.schedule, n, season.wikiAirDates);
    return at ? at.toISOString() : null;
  };
}

/**
 * Files the bot's calls on a game (`calls`: [{ question, episode (the window: 0 asked once), answer, note? }]), each checked: a
 * question played against the bot, a window it asks, still open for the bot's call (o.now, o.airAt: the lock episode's air time from
 * the schedule for one the league hasn't stamped), and an answer it could give then (Spec.answerProblem against facesFor). A call on
 * a window that has one replaces it. o.madeBy: 'bot' (the bot's run) or 'stand-in' (a check, a replay). Returns { filed: [{ question,
 * episode }], refused: [{ question, episode, why }] }.
 */
async function fileCalls(pool, leagueId, calls, o = {}) {
  const league = await readLeague(pool, leagueId);
  if (!league) throw new Error("No such game");
  const { state } = league;
  const madeBy = o.madeBy === "stand-in" ? "stand-in" : "bot";
  const qs = new Map(beatQuestions(state).map((q) => [q.id, q]));
  const fgs = await formatGroups(pool, state);
  // The lock's air time from the season's schedule, for an episode the league hasn't stamped (o.airAt, when said, first).
  const airOf = await airTimesOf(pool, state);
  const filed = [];
  const refused = [];
  for (const c of Array.isArray(calls) ? calls : []) {
    const q = qs.get(c && c.question);
    const window = q && q.asked === "once" ? 0 : c && c.episode;
    const no = (why) => refused.push({ question: c && c.question, episode: c && c.episode, why });
    if (league.gone) { no("The game is gone"); continue; }
    if (!q) { no("It isn't a question played against the bot"); continue; }
    if (!Number.isInteger(window) || (q.asked !== "once" && !AnswerLogic.opensAt(state, q, window))) { no("The game doesn't ask it then"); continue; }
    const at = lockOf(state, q, window);
    const airAt = o.airAt || (airOf && at !== null ? airOf(at) : null);
    if (locked(state, q, window, { ...o, airAt })) { no("It has locked: the bot calls before it does"); continue; }
    const faces = facesFor(state, q, fgs && at !== null ? fgs.get(at) : undefined);
    const problem = Spec.answerProblem(q, c.answer, faces ? new Set(faces.map((f) => f.id)) : null);
    if (problem) { no(problem); continue; }
    const note = typeof c.note === "string" && c.note.trim() ? c.note.trim().slice(0, MAX_NOTE) : null;
    await pool.query(
      `INSERT INTO bot_calls (league_id, question, episode, answer, note, made_by) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       ON CONFLICT (league_id, question, episode) DO UPDATE SET answer = EXCLUDED.answer, note = EXCLUDED.note, made_by = EXCLUDED.made_by, made_at = now()`,
      [leagueId, q.id, window, JSON.stringify(c.answer), note, madeBy]
    );
    filed.push({ question: q.id, episode: window });
  }
  return { filed, refused };
}

/** Every call filed on a game: [{ question, episode, answer, note, madeBy, madeAt }]. For the desk and the checks, never a player. */
async function storedCalls(pool, leagueId) {
  const { rows } = await pool.query("SELECT question, episode, answer, note, made_by, made_at FROM bot_calls WHERE league_id = $1 ORDER BY episode, question", [leagueId]);
  return rows.map((r) => ({ question: r.question, episode: r.episode, answer: r.answer, note: r.note, madeBy: r.made_by, madeAt: r.made_at }));
}

module.exports = { MAX_NOTE, beatQuestions, lockOf, locked, windowsAt, facesFor, formatGroups, airTimesOf, fileCalls, storedCalls };
