// The bot's own call as an opponent, asked (docs/PLAN-start-a-game-gpt.md step A14 part 2b; part 2 is the piece: game-spec schema.js
// `beat: { by: 'bot' }`, db/bot-calls.js, bot_calls 0206): before each lock of a game's questions played against the bot, the ask-AI
// bot makes its call on every window that locks there, from only what anyone could know then, and each call is filed through
// BotCalls.fileCalls (made_by 'bot'), checked as a seat's answer is. Until a call is filed, a window plays its fallback (beat.none).
//
// Bot research's call run (db/bot-research.js planCalls) asks it once per game per lock: every window of the game's questions
// against the bot whose call locks at an episode (BotCalls.windowsAt: each one opening there; asked once, the game's first), less
// those it has called already. Due CALL_BEFORE minutes before that episode airs by the broadcast's schedule (no sooner than
// CALL_AFTER_PREV after the one before it ends, for its results, and no later than CALL_LAST before the lock, for the retries), three
// tries 20 minutes apart, and never once the window has locked: the bot calls before anyone could know more, and fileCalls refuses a
// call after. A game catching up at its own pace on an aired season is never asked (every lock there is past by the broadcast's
// clock): it plays its fallback, as a card the bot chooses does (C7 part 2).
//
// The bot is told the show, the season, the episode coming, each question as players see it (its words, what it's about, its answer
// kind) and exactly what can be named at that lock (BotCalls.facesFor, as a seat's answer could: those still in, the groups), and
// asked not to use anything about the episode itself. Its answer is parsed strictly here (the JSON, the episode, each question one it
// was asked about, each answer as its kind takes it, a name matched to its id only when it's exactly one of those offered) and
// checked again by fileCalls (Spec.answerProblem against who could be named): what's refused is listed on the run, and a try with a
// call missing or refused is a failed one, asked again for those alone.
//
// The prompt, the parse and callNext are pure (tests/bot-call-run.test.js); the rest read and write the database.
const StateLogic = require("../src/lib/game/state-logic.js");
const BotCalls = require("./bot-calls.js");
const { jsonIn } = require("./card-research.js");

/** How many minutes before its lock the call run is due (no sooner than CALL_AFTER_PREV after the episode before it ends, no later
 *  than CALL_LAST before the lock). */
const CALL_BEFORE = 6 * 60;
const CALL_AFTER_PREV = 60;
const CALL_LAST = 60;
const MIN = 60 * 1000;
const MAX_WHY = 300;

const str = (v) => (typeof v === "string" ? v.trim() : "");
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** What a window is about, in words: its episode, its run of episodes, its phase, or the game or season as a whole. */
function aboutWords(state, q, n) {
  if (q.asked === "once") {
    if (q.closes === "finale" || (q.settle && ["winner", "placed", "top", "split"].includes(q.settle.take))) return "the season as a whole (it's settled at the finale)";
    const end = StateLogic.endEpisode(state);
    return end !== null ? `episodes ${n} to ${end} (the game's whole run)` : `from episode ${n} to the season's end (the game's whole run)`;
  }
  const span = q.asked === "every" ? q.every : Number.isInteger(q.over) && q.over > 1 ? q.over : 1;
  if (q.asked === "phase") return `this part of the season, from episode ${n}`;
  return span > 1 ? `episodes ${n} to ${n + span - 1}` : `episode ${n}`;
}

/** How a question's answer is given, in words, `listed` whether its choices are the cast list's (people). */
function answerWords(q, faces, listed) {
  const pick = q.pick || 1;
  switch (q.answer) {
    case "person":
    case "group": {
      const one = q.answer === "group" ? "group" : "person";
      const from = listed ? "the cast list above" : "its list below";
      return pick > 1 ? `up to ${pick} ids from ${from}, as a JSON list` : `the id of one ${one} from ${from}`;
    }
    case "yesNo": return '"yes" or "no"';
    case "number": return "a whole number, 0 or more";
    case "overUnder": return `"over" or "under" ${q.line}`;
    case "choice": return `one of: ${(q.options || []).map((o) => JSON.stringify(o)).join(", ")}`;
    default: return "an answer";
  }
}

/**
 * The prompt. `asked`: the windows to call, [{ id (the question's), q, faces ([{ id, name }] or null) }]; `cast`: who's still in,
 * [{ id, name }] (the people a person question names, listed once); `airAt`, when episode n airs (words), or null; `term` what the
 * show calls its cast. Pure.
 */
function buildCallPrompt({ showName, season, episode: n, airAt = null, asked, cast = [], term = "cast members", state }) {
  const when = airAt ? ` It airs ${airAt}.` : "";
  const before = n > 1 ? `Episode ${n - 1} is the latest to air; episode ${n} hasn't aired yet.${when}` : `Episode 1 hasn't aired yet.${when}`;
  const castIds = cast.map((c) => c.id).join("|");
  const same = (faces) => Array.isArray(faces) && faces.map((f) => f.id).join("|") === castIds;
  const lines = [
    `Search the web for ${showName} season ${season}. ${before}`,
    `Read recaps and news about the season so far${n > 1 ? ` (episode ${n - 1} especially)` : ""}, and any preview of episode ${n}: the network's`,
    `description, a teaser, a press release. Never use anything about episode ${n} or later that came out after it aired, and never`,
    "a spoiler: you're calling it before it airs, as the players do.",
    "",
    "You're playing a game against a group of friends: each question below, you make your call and they make theirs, and they score",
    "when they're right and you're not. Make your best call on each, the one most likely to be right.",
  ];
  if (cast.length) {
    lines.push("", `The ${term} still in the game (use these ids exactly; if one of them has already left, don't name them):`);
    for (const c of cast) lines.push(`- ${c.id}: ${c.name}`);
  }
  lines.push("", "The questions:");
  for (const a of asked) {
    const listed = same(a.faces);
    const said = str(a.q.ask) || a.id;
    lines.push(`- ${a.id}: ${/[.?!]$/.test(said) ? said : `${said}.`} About ${aboutWords(state, a.q, n)}. Answer with ${answerWords(a.q, a.faces, listed)}.`);
    if (Array.isArray(a.faces) && !listed) for (const f of a.faces) lines.push(`    - ${f.id}: ${f.name}`);
  }
  const sample = (q) => {
    if (q.answer === "yesNo") return '"yes"';
    if (q.answer === "number") return "3";
    if (q.answer === "overUnder") return '"over"';
    if (q.answer === "choice") return JSON.stringify((q.options || [])[0] || "option");
    return (q.pick || 1) > 1 ? '["id", "id"]' : '"id"';
  };
  const example = asked.map((a) => `"${a.id}": {"answer": ${sample(a.q)}, "why": "one line"}`);
  lines.push(
    "",
    "Answer every question. Reply with only this JSON, in a ```json code block, and nothing after it:",
    `{"episode": ${n}, "calls": {${example.join(", ")}}}`,
    "Plain JSON: double quotes, no comments, no trailing commas."
  );
  return lines.join("\n");
}

/** One answer as its question's kind takes it: an id (a name matched to its id only when it's exactly one of those offered, `faces`),
 *  a list of them, 'yes' / 'no', a number, 'over' / 'under', an option. What can't be read is passed on as it came, for fileCalls's
 *  check to refuse with its reason. Pure. */
function coerce(q, faces, v) {
  switch (q.answer) {
    case "person":
    case "group": {
      const byName = new Map();
      for (const f of faces || []) {
        const k = str(f.name).toLowerCase();
        byName.set(k, byName.has(k) ? null : f.id);
      }
      const ids = new Set((faces || []).map((f) => f.id));
      const one = (x) => {
        const s = str(x);
        if (ids.has(s)) return s;
        const m = byName.get(s.toLowerCase());
        return m || s;
      };
      if ((q.pick || 1) > 1) return Array.isArray(v) ? v.map(one) : [one(v)];
      return Array.isArray(v) && v.length === 1 ? one(v[0]) : Array.isArray(v) ? v.map(one) : one(v);
    }
    case "yesNo":
      if (v === true) return "yes";
      if (v === false) return "no";
      return str(v).toLowerCase();
    case "number": {
      if (typeof v === "number") return v;
      const s = str(v);
      return s !== "" && Number.isFinite(Number(s)) ? Number(s) : v;
    }
    case "overUnder": return str(v).toLowerCase();
    case "choice": {
      const s = str(v).toLowerCase();
      const hit = (q.options || []).filter((o) => String(o).toLowerCase() === s);
      return hit.length === 1 ? hit[0] : v;
    }
    default: return v;
  }
}

/**
 * The bot's answer, parsed: { found, calls: [{ question, episode (the window), answer, note }], missing (asked, not answered),
 * unknown (answered, not asked), why, note (why nothing was found) }. Found when it's JSON about episode `n` (when it says) with a call
 * for at least one question it was asked. `asked`: [{ id, window, q, faces }]. Each answer coerced to its kind (coerce); its check is
 * fileCalls's. Pure.
 */
function parseCallAnswer(text, n, asked) {
  const out = { found: false, calls: [], missing: [], unknown: [], note: null };
  const raw = jsonIn(text);
  if (!isObj(raw)) return { ...out, missing: asked.map((a) => a.id), note: "No JSON in the answer" };
  if (raw.episode !== undefined && Number(raw.episode) !== n) return { ...out, missing: asked.map((a) => a.id), note: `The answer was about episode ${raw.episode}, not ${n}` };
  const calls = isObj(raw.calls) ? raw.calls : {};
  const byId = new Map(asked.map((a) => [a.id, a]));
  out.unknown = Object.keys(calls).filter((k) => !byId.has(k));
  for (const a of asked) {
    const c = calls[a.id];
    const value = isObj(c) ? c.answer : c;
    if (value === undefined || value === null || value === "") {
      out.missing.push(a.id);
      continue;
    }
    const why = isObj(c) ? str(c.why).slice(0, MAX_WHY) : "";
    out.calls.push({ question: a.id, episode: a.window, answer: coerce(a.q, a.faces, value), note: why || null });
  }
  if (!out.calls.length) return { ...out, note: "It called none of the questions it was asked" };
  return { ...out, found: true };
}

/**
 * When a game's call run for the lock at an episode is due and may next be tried, or null for never: due CALL_BEFORE minutes before
 * the lock (`lockAt`, ms: the episode's air time), no sooner than CALL_AFTER_PREV after the episode before it ends (`prevEnd`, ms, or
 * null), no later than CALL_LAST before the lock; its next try `nextTry(due, tries)` (bot-research.js nextTryAt: three, 20 minutes
 * apart), never at or after the lock. { at (when due), next }. Pure.
 */
function callNext({ lockAt, prevEnd = null, tries = [], nextTry }) {
  if (!Number.isFinite(lockAt)) return null;
  const early = lockAt - CALL_BEFORE * MIN;
  const after = Number.isFinite(prevEnd) ? prevEnd + CALL_AFTER_PREV * MIN : -Infinity;
  const due = Math.min(Math.max(early, after), lockAt - CALL_LAST * MIN);
  const next = nextTry(new Date(due), tries);
  if (!next || next.getTime() >= lockAt) return null;
  return { at: new Date(due), next };
}

// ---------- the database ----------

/** A league still played, with a question played against the bot somewhere in its spec (or its settings), by SQL; each confirmed by
 *  BotCalls.beatQuestions on its state. */
const BEAT_SQL = `l.deleted_at IS NULL AND l.state->'settings'->>'archivedAt' IS NULL
   AND jsonb_path_exists(l.state->'settings', 'strict $.**.beat.by ? (@ == "bot")')`;

/** The games with a question played against the bot (or one season's: its show's slug and number), oldest first: [{ id, state }]. */
async function callGames(pool, season = null) {
  const { rows } = await pool.query(
    `SELECT l.id, l.state FROM leagues l
      WHERE ${BEAT_SQL}
        AND ($1::text IS NULL OR (l.state->'settings'->>'showId' = $1 AND l.state->'settings'->>'wikiSeason' = $2))
      ORDER BY l.created_at, l.id`,
    season ? [season.slug, String(season.season_number)] : [null, null]
  );
  return rows.filter((r) => BotCalls.beatQuestions(r.state).length > 0);
}

/** The windows a game's bot has called: a Set of "question|episode" (the window: 0 asked once). */
async function calledOn(pool, leagueId) {
  const { rows } = await pool.query("SELECT question, episode FROM bot_calls WHERE league_id = $1", [leagueId]);
  return new Set(rows.map((r) => `${r.question}|${r.episode}`));
}

/**
 * What a game's call at the lock of `episode` asks about: its windows still open for the bot (BotCalls.windowsAt, `airAt` the
 * episode's air time, ISO, from the schedule), less those called already when `skip` (a Set from calledOn), each with what can be
 * named (facesFor; the format's groups going into it); a window offering nobody yet (the format's groups not sure) is left out, its
 * call asked on a later try. And who's still in (the cast list the prompt shows once). { asked, cast, waiting (the windows left out) }.
 */
async function windowsToCall(pool, state, episode, { now = Date.now(), airAt = null, skip = null } = {}) {
  const open = BotCalls.windowsAt(state, episode, { now, airAt }).filter((w) => !skip || !skip.has(`${w.q.id}|${w.window}`));
  const fgs = open.length ? await BotCalls.formatGroups(pool, state) : undefined;
  const asked = [];
  const waiting = [];
  for (const w of open) {
    const faces = BotCalls.facesFor(state, w.q, fgs ? fgs.get(episode) : undefined);
    if (Array.isArray(faces) && !faces.length) waiting.push(w.q.id);
    else asked.push({ id: w.q.id, window: w.window, q: w.q, faces });
  }
  const cast = (state.castaways || []).filter((c) => c.status !== "eliminated").map((c) => ({ id: c.id, name: c.name }));
  return { asked, cast, waiting };
}

/**
 * Whether the episode before a lock is still without its results in the league (it's in play and has aired, or has no air time known,
 * but no exit or "nobody went home" recorded): who it sent home would still be offered. False for a game's first episode. Pure.
 */
function waitsForResults(state, episode) {
  const prev = (state.episodes || []).find((e) => e.number === episode - 1);
  return !!prev && StateLogic.inPlay(state, prev.number) && !StateLogic.EpisodeLogic.hasResults(prev);
}

/** What the call run's rows carry as their slot: one game's. */
const slotOf = (leagueId) => `call:${leagueId}`;

module.exports = {
  CALL_BEFORE,
  CALL_AFTER_PREV,
  CALL_LAST,
  buildCallPrompt,
  parseCallAnswer,
  coerce,
  callNext,
  callGames,
  calledOn,
  windowsToCall,
  waitsForResults,
  slotOf,
  aboutWords,
};
