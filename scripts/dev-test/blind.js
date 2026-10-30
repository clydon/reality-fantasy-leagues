// Dev-only: F4's blind replays (docs/PLAN-start-a-game-gpt.md, "Formats nobody announced"; what they found is in
// docs/STUDY-format-changes.md, "F4: blind replays"). A taped season replayed as if it were live, through every game the
// capability tracker says plays now (tests/fixtures/engine-capabilities.json, each ✅ row's spec that the engine lab's own check
// passes on the season), so a format change nobody announced reaches each game only as its episode's research:
//   - each game is made before the premiere (the engine lab's labStart, on a zt- couch of its own, four seats with the
//     friend-group archetypes' habits joining through Join), from what was known then: the season's rules, and of its format
//     only what research has said so far (nothing, at the premiere);
//   - before each episode, the games' moves through the app's own writes (playtest.js: the draft, lineups and picks, waivers)
//     and every open question answered by habit (answers.ts answerQuestions), its choices as the app offers them at that lock
//     (gameQuestions: a group question's faces from the timeline of the episodes before it, or the league's own groups);
//   - each episode's results through the bot's own run on Autopilot (playtest.js fileResults), from the tape, with two
//     things the tape doesn't have: the research's format section (the local bot's own answer for that episode where F2 asked
//     it again with today's prompt, format-asks.js; else a stand-in written from F1's fixture, the season's ground truth, at
//     that episode's end), and who went home as the fixture has it (the tapes get some exits wrong: The Challenge 41's Nia
//     Moore, Leo and Will), each answer reshaped as playtest.js's --results=quick-exits does it, the finale's exits placed;
//   - after each episode: the season's format state over time as the app reads it (db/format-timeline.js: what changed, sure
//     or held, the stage triggers, group slots and side stages it opens), what the next prompt would carry (the groups going
//     in, the newcomers on its checklist, the word for its groups: episode-research.js resolveSeasonResearchContext), and what
//     each game did: its group questions' choices and verdicts (right, off, void picks), its table, whether it's over;
//   - at the end, the checks: every game ended, every score a finite number, nothing scored on an off or void group pick,
//     no answer the app refused that it offered, no problem in the moves; a game with group slots (A10 part 1), each seat's
//     empty or dropped slot picking from the groups on offer before each episode, nothing scored by a slot not held and no
//     pick it offered refused; a stock market (A10 part 3c), each seat trading by habit in its waiver weeks (playtest.js's
//     claims, within its cash), and nobody's cash below nothing; a game that keeps from last season's (A10 part 4), that game
//     made first for the same seats on the show's previous season as this database has it loaded (lastSeasonGame), and what each
//     seat kept recorded (none where no previous season is loaded: the fallback); a game with a handicap (A11 part 5b), an
//     earlier game on its couch for the tinkerer and the fan first (earlierGame), so the drive-by and the forgetter are its
//     newcomers, and each episode's record says who it names and what it has given each so far; a game in stages (A12), each
//     stage played as a game of its own beside it, and a stage a format change starts (A12 part 2) found as the season sync makes
//     each copy mid-season (its draft at its start, from who's left), its record ended where a corrected report takes it away.
// Nothing asks a bot. The local bot's answers are F2's, kept beside the tapes; the stand-ins are marked as such in the record.
//
//   node scripts/dev-test/blind.js run [<show> <season>] [--only=3,7] [--through=N] [--keep]
//                                         every season studied (The Challenge 41, 40, 39, Survivor 49, The Traitors 4), or
//                                         one; --only the tracker games by number (as `games` lists them); --through stops
//                                         after episode N; --keep leaves the games standing (down when done)
//   node scripts/dev-test/blind.js games <show> <season>
//                                         the tracker's games that play on the season and why the rest don't (no replay)
//   node scripts/dev-test/blind.js sections <show> <season>
//                                         each episode's format section as the replay files it: F2's answer or the stand-in
//   node scripts/dev-test/blind.js summary [--md]
//                                         the records on file, a line per season (the study doc's tables with --md)
//   node scripts/dev-test/blind.js down   take out everything a replay made (playtest.js's zt-pt- rows)
//
// Records go to ~\rfl-tapes\replays\blind\<show>-<season>.json and .md (TAPES_DIR moves it). Needs this lane's .env.local (a
// local database; refused otherwise), its migrations, each season loaded once (`tapes.js load <show> <season>`), F1's fixtures
// (tests/fixtures/format-timelines, under the tapes' cast names). No dev server; it uses playtest.js's zt-pt- rows, so it
// never runs beside playtest.js or golden.js (they share them), and `run` takes them down first and again after (unless
// --keep). About a minute or two a season.
"use strict";
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const PT = require("./playtest.js");
const Study = require("./format-study.js");
const FA = require("./format-asks.js");
const Timeline = require("../../src/lib/game/formats/format-timeline.js");

const H = PT.harness;
const SEASONS = [
  ["the-challenge", 41],
  ["the-challenge", 40],
  ["the-challenge", 39],
  ["survivor", 49],
  ["the-traitors-us", 4],
];
const GROUP_SIZE = 4;
const GROUPED = new Set(["tribes", "teams", "pairs"]);
const low = (v) => String(v || "").trim().toLowerCase();

// ---------- the research as it would have come in (pure) ----------

// A fixture's "how" in a format's own words for who left (exitMethods), by the words each format uses for it.
const HOW = {
  eliminated: ["eliminated", "voted out", "banished"],
  "voted out": ["voted out", "eliminated", "banished"],
  purged: ["eliminated", "voted out"],
  banished: ["banished", "voted out", "eliminated"],
  murdered: ["murdered"],
  fire: ["fire"],
  quit: ["quit", "left the game"],
  medical: ["medical"],
  evacuated: ["medical"],
  disqualified: ["disqualified"],
};

/** A fixture's `how` as the format says it: won is its winner's exit, placed its endgame's first (a finalist), the rest by
 *  their words, else "Other". Pure. */
function howIn(how, format) {
  const methods = (format && format.exitMethods) || [];
  const h = low(how);
  if (h === "won") return (format && format.winnerExitMethod) || "Winner";
  if (h === "placed") return ((format && format.endgameExitMethods) || []).find((m) => m !== format.winnerExitMethod) || "Finalist";
  for (const w of HOW[h] || [h]) {
    const m = methods.find((x) => x !== "Other" && low(x).includes(w));
    if (m) return m;
  }
  return "Other";
}

/**
 * Episode n's format section as research would say it at its end, from F1's fixture (the stand-in for an episode F2 didn't
 * ask again): format-asks.js truthAtEnd's groups going into the next episode (named as the show names them), who's on their
 * own, the newcomers (who they replaced; the group they joined, when the fixture's groups have them), whether a whole group
 * went home, and the changes the fixture says were shown in it (its kind, when, the episode it takes effect), each sure.
 * Null for an episode the fixture doesn't have. Pure.
 */
function standIn(t, n) {
  const truth = FA.truthAtEnd(t, n);
  if (!truth) return null;
  const e = t.episodes.find((x) => x.n === n);
  const groupOf = (name) => truth.groups.find((g) => g.members.includes(name)) || null;
  const newcomers = (e.in || []).map((x) => {
    const g = groupOf(x.name);
    return { name: x.name, replaces: x.for || null, group: g ? g.name || g.members.filter((m) => m !== x.name).join(" & ") || null : null };
  });
  const changes = FA.changesReportedIn(t, n).map((c) => ({ kind: c.kind, when: c.when || null, from: c.from, what: c.what || c.kind, sure: "high" }));
  return {
    playedAs: truth.playedAs,
    phase: truth.phase,
    groups: truth.groups.filter((g) => g.members.length > 1).map((g) => ({ name: g.name || null, members: g.members.slice() })),
    alone: truth.alone.slice(),
    newcomers,
    wentHomeAs: truth.wentHomeAs,
    changes,
  };
}

/**
 * Where episode n's format section comes from in a blind replay: the local bot's answer for it (F2's, asked with today's
 * prompt: `f2` is format-asks.js answersOf), else the fixture's stand-in. { section, from: "research" | "stand-in" | null,
 * merged }: `merged` the answer's own when the bot's, else the fixture's (yes in the episode its phase first reads as the
 * merge; only for a format that has one). Pure.
 */
function sectionFor(t, n, f2 = {}, { hasMerge = false } = {}) {
  const a = f2[n];
  if (a && a.ok && a.parsed && a.parsed.formatState) return { section: a.parsed.formatState, from: "research", merged: hasMerge ? a.parsed.merged ?? null : null };
  const section = standIn(t, n);
  if (!section) return { section: null, from: null, merged: null };
  let merged = null;
  if (hasMerge) {
    const firstMerged = t.episodes.find((e) => /merge/i.test(e.phase || ""));
    merged = firstMerged && firstMerged.n === n ? "yes" : "no";
  }
  return { section, from: "stand-in", merged };
}

/**
 * Who went home in episode n as the fixture has it, as the app reads a quick check (bot-research.js parseQuickAnswer's
 * shape: every name matched, each `how` in the format's words), and the tape's quick answer rewritten to say it (its title,
 * headline and sources kept; two sources at least, so the app trusts it as it trusts the bot's). Pure.
 */
function fixtureQuick(t, n, format, tapeText) {
  const e = t.episodes.find((x) => x.n === n);
  const left = ((e && e.out) || []).map((o) => ({ name: o.name, how: howIn(o.how, format) }));
  const raw = tapeText ? H.answerJson(tapeText) : null;
  const sources = raw && Array.isArray(raw.sources) && raw.sources.length >= 2 ? raw.sources : ["https://example.invalid/f1-fixture", "https://example.invalid/f1-fixture-2"];
  const text = JSON.stringify({ found: true, episodeTitle: (raw && raw.episodeTitle) || null, left, headline: (raw && raw.headline) || "", sources });
  return { text, quick: { found: true, left: left.map((x) => ({ ...x, matched: true })), sources } };
}

/**
 * A full answer as a blind replay files it: who went home made the fixture's (playtest.js quickExits, with the fixture as the
 * quick check, over who the app's prompt asks about: `asked`, pasteSkeleton's entries, newcomers among them once research
 * asks about them), then the format section and `merged` put in. { text, changes } (quickExits' changes: who it made leave
 * or stay). Pure.
 */
function blindFull(text, { quick, asked, format, section, merged }) {
  // The quick check's wording for an exit both name (so the two agree: the app holds an exit they word differently, the
  // playtest report's finding 2), and a leaver's entry as sure as the fixture is (a medium one never reaches a game: finding
  // 3), so who went home reaches every game as the fixture has it.
  const got = PT.quickExits(text, { asked, quick, exitMethods: (format && format.exitMethods) || [], winnerExit: (format && format.winnerExitMethod) || null, quickHow: true });
  const raw = H.answerJson(got.text);
  if (!raw) return { text: got.text, changes: got.changes };
  const leaving = PT.castMatcher(((quick && quick.left) || []).map((p) => p.name));
  for (const c of Array.isArray(raw.castaways) ? raw.castaways : []) {
    if (c && String(c.leftTheGame).toLowerCase() === "yes" && leaving.idOf(c.name) !== null && c.confidence !== "high") {
      c.confidence = "high";
      got.changes.raised.push(`${c.name}: its exit`);
    }
  }
  if (section !== undefined) raw.formatState = section;
  if (merged != null && ("merged" in raw || (format && format.hasMerge))) raw.merged = merged;
  return { text: JSON.stringify(raw), changes: got.changes };
}

// ---------- the players' answers (pure) ----------

/** A seat's order over `items` for a question at an episode (deterministic, its own per seat): drive-bys take the list's. */
function orderFor(seat, q, n, items, key = (x) => x) {
  if (seat.role === "driveby") return items.slice();
  return items.map((x) => [PT.hash01(`${seat.role}|${q.id}|${n}|${key(x)}`), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
}

/**
 * A seat's answer to one open question (answers.ts QuestionView), in the shape answerProblem takes, or undefined when it has
 * nothing to answer with (no faces, no options). Wagers stake a little; a question about each person answers for three of
 * them. Pure.
 */
function answerFor(seat, q, n) {
  const ids = (q.faces || []).map((f) => f.id);
  const h = (salt) => PT.hash01(`${seat.role}|${q.id}|${n}|${salt}`);
  const base = (kind) => {
    switch (kind) {
      case "person":
      case "group": {
        if (!ids.length) return undefined;
        const k = Math.max(1, Math.min(q.pick || 1, ids.length));
        const picked = orderFor(seat, q, n, ids).slice(0, k);
        return q.pick && q.pick > 1 ? picked : picked[0];
      }
      case "yesNo":
        return h("yn") < 0.5 ? "yes" : "no";
      case "number":
        return q.line != null ? Math.max(0, Math.round(Number(q.line) + (h("n") - 0.5) * 4)) : Math.floor(h("n") * 6);
      case "overUnder":
        return h("ou") < 0.5 ? "over" : "under";
      case "choice":
        return q.options && q.options.length ? orderFor(seat, q, n, q.options)[0] : undefined;
      case "order":
      case "confidence":
        return ids.length ? orderFor(seat, q, n, ids).slice(0, Math.max(1, Math.min(q.pick || ids.length, ids.length))) : undefined;
      case "chips": {
        if (!ids.length || !q.chips) return undefined;
        const [a, b] = orderFor(seat, q, n, ids);
        return b && q.chips > 1 ? { [a]: q.chips - 1, [b]: 1 } : { [a]: q.chips };
      }
      case "split":
        return h("s") < 0.5 ? [5, 3] : [4, 3, 1];
      case "pairs":
        return q.pairs && q.pairs.length ? Object.fromEntries(q.pairs.map((p) => [p.key, p.faces[h(p.key) < 0.5 ? 0 : 1].id])) : undefined;
      default:
        return undefined;
    }
  };
  let value;
  if (q.each === "person") {
    if (!ids.length) return undefined;
    const kind = q.answer;
    const out = {};
    for (const id of orderFor(seat, q, n, ids).slice(0, 3)) {
      const v = kind === "person" || kind === "group" ? undefined : base(kind);
      if (v !== undefined) out[id] = v;
    }
    value = Object.keys(out).length ? out : undefined;
  } else value = base(q.answer);
  if (value === undefined) return undefined;
  if (q.wager) {
    const most = q.wager === "total" ? q.stakeMost ?? 0 : q.wager;
    return { answer: value, stake: Math.max(0, Math.min(2, Number(most) || 0)) };
  }
  return value;
}

/** Whether a seat answers this week (its habit's share of weeks, as playtest.js's lineups and picks; the runner always). */
const answersThisWeek = (seat, n) => seat.role === "tinkerer" || PT.movesThisWeek(seat, n);

// ---------- the checks (pure) ----------

/**
 * What's wrong with a game's record at the season's end: it never ended (its last episode played and the game not over), a
 * score that isn't a finite number, points on a group pick that was off or void, an answer the app refused that it had offered,
 * a problem in its moves or start. [] when it played through. Pure.
 */
function problemsOf(g) {
  const out = [];
  if (!g.leagueId) return [`never started: ${(g.problems || [])[0] || "no game"}`];
  // A12 part 2: a copy a format change started that the data took away again ends there (what it scored went with it).
  if (!g.over && !g.undone) out.push(`not over after its last episode (${g.lastEpisode ?? "none"})`);
  for (const e of g.episodes || []) {
    for (const [who, v] of Object.entries(e.table || {})) if (!Number.isFinite(v)) out.push(`episode ${e.episode}: ${who}'s score is ${v}`);
    for (const [qid, v] of Object.entries(e.verdicts || {})) {
      if ((v.state === "off" || v.offered === 0) && Object.values(v.earned || {}).some((x) => x)) out.push(`episode ${e.episode}: ${qid} was off but scored`);
      for (const who of v.void || []) if ((v.earned || {})[who]) out.push(`episode ${e.episode}: ${qid}: ${who}'s void pick scored`);
    }
    for (const r of e.refused || []) out.push(`episode ${e.episode}: an answer was refused: ${r}`);
    // A10 part 1: a group slot scores only while it's held, and a pick the app offered is never refused.
    for (const [who, lines] of Object.entries(e.slots || {})) for (const l of lines) if (l.status !== "held" && l.points) out.push(`episode ${e.episode}: ${who}'s ${l.status} group slot scored`);
    for (const [who, did] of Object.entries(e.slotPicks || {})) for (const d of did) if (d.did === "refused") out.push(`episode ${e.episode}: ${who}'s group slot pick was refused: ${d.why}`);
    // A10 part 3c: a stock market's cash never goes below nothing (every game here is drafted before the premiere, within its budget).
    for (const [who, v] of Object.entries(e.cash || {})) if (!Number.isFinite(v) || v < 0) out.push(`episode ${e.episode}: ${who}'s cash is ${v}`);
  }
  if ((g.unsettled || []).length) out.push(`never settled: ${g.unsettled.join(", ")}`);
  for (const p of g.problems || []) out.push(p);
  return out;
}

// ---------- the run ----------

const TAPES = () => require("./tapes").TAPES;
const outDir = () => path.join(TAPES(), "replays", "blind");

let lazy = null;
/** The app's own code this needs beyond playtest.js's (loaded with its jiti, so it shares the one database pool). */
function app() {
  if (lazy) return lazy;
  const base = H.appCode();
  lazy = {
    ...base,
    lab: H.tsApp("lib/server/engine-lab"),
    answers: H.tsApp("lib/server/answers"),
    points: H.tsApp("lib/server/answer-points"),
    Research: require("../../db/episode-research.js"),
    DBT: require("../../db/format-timeline.js"),
    C: require("../../src/lib/game/game-spec/capabilities.js"),
    rows: H.tsApp("lib/game/capability-rows"),
    tracker: require("../../tests/fixtures/engine-capabilities.json"),
  };
  return lazy;
}

/**
 * The tracker's games for a season: every ✅ row's spec (each distinct spec once, with the rows that have it), checked on the
 * season by the engine lab's own check (labCheck: the validator with the season's rules, what waits). A group question asked
 * each episode plays twice, its spec's fallback as written (void, the default) and following the people (carry-on), so both
 * are seen at each change. [{ n, spec, rows, label, plays, why }].
 */
async function gamesFor(seasonId, show = null) {
  const { lab, C, rows: R, tracker } = app();
  const yes = C.rowsOf(tracker).filter((r) => C.statusOf(r, R.pageCtx(r.page)).state === "yes");
  const bySpec = new Map();
  for (const r of yes) {
    const key = JSON.stringify(r.spec);
    if (!bySpec.has(key)) bySpec.set(key, { spec: r.spec, rows: [] });
    bySpec.get(key).rows.push(r.id);
  }
  const out = [];
  const add = async (spec, rows, variant = null) => {
    const v = await lab.labCheck({ seasonId, spec });
    out.push({ n: out.length + 1, spec, rows, variant, label: `${(v.describe && v.describe.name) || (v.playsAs === "stages" ? "Stages" : "a game")}${variant ? ` (${variant})` : ""}`, plays: !!(v.startable && v.playsAs), playsAs: v.playsAs || null, why: v.startable ? null : ((v.problems || [])[0] || (v.waits || [])[0] || {}).problem || "doesn't play here", sentence: (v.describe && v.describe.sentence) || "" });
  };
  const both = async (spec, rows, variant = null) => {
    await add(spec, rows, variant);
    const groupEach = (spec.ask || []).some((q) => q.answer === "group" && (q.asked || "each") === "each" && !q.fallback);
    if (groupEach) await add({ ...spec, ask: spec.ask.map((q) => (q.answer === "group" ? { ...q, fallback: "carry-on" } : q)) }, rows, [variant, "following the people"].filter(Boolean).join(", "));
  };
  for (const { spec, rows } of bySpec.values()) await both(spec, rows);
  for (const spec of OWN[show] || []) await both(spec, [], "F4's own");
  return out;
}

// F4's own games beside the tracker's: its group question is Survivor's (which tribe wins immunity), so on The Challenge the
// same question in the show's own moment for a group's win (a daily challenge), asked each episode of its pairs and teams.
const OWN = {
  "the-challenge": [
    {
      get: { by: "none" },
      score: { by: "answers" },
      rank: { by: "total" },
      ask: [
        { id: "daily", ask: "Which pair or team wins the daily challenge?", answer: "group", points: 1, asked: "each", settle: { by: "moment", moment: "dailyWin", take: "who" } },
        { id: "out", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } },
      ],
    },
  ],
};

/** `fn` over every item, `limit` at a time (4: a write holds a database client and may ask for one more, and the pool has 10). */
async function each(items, fn, limit = 4) {
  let i = 0;
  const worker = async () => {
    while (i < items.length) await fn(items[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** This database's own row for a season on tape (tapes.js load gives it this database's id), never a replay's zt- copy. */
async function loadedSeason(show, season) {
  const { rows } = await app().pool.query(
    "SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1 AND ss.season_number = $2 ORDER BY ss.created_at LIMIT 1",
    [show, Number(season)]
  );
  if (!rows.length) throw new Error(`${show} ${season} isn't loaded here (LLM_BROWSER_API_URL=http://127.0.0.1:8765 node scripts/dev-test/tapes.js load ${show} ${season})`);
  return rows[0].id;
}

/**
 * A10 part 4: a game that keeps from last season's (get.keep) gets last season's game first, for the same seats: an Outlast on
 * the show's previous season as this database has it loaded (its cast as the data records it: The Challenge 40 for 41, 39 for
 * 40), each seat dealt a team the new game's size by a seeded shared draw before any results (so its best is by name: nobody has
 * points yet), a zt-pt- league H.down takes out. The new game keeps from it, through the app's own write (keepers.ts reads both
 * leagues as each seat's draft opens). A season whose previous one isn't loaded here keeps from no game (the fallback: every
 * team drafted whole). { from: its league id or null, why, teams: { label: [names] }, back: names on this season's cast }.
 */
async function lastSeasonGame(g, users, seats, show, season, copy) {
  const { pool, S } = app();
  const each = g.spec.get && g.spec.get.each;
  // The seats' accounts (users maps a seat's username to its user row).
  const idOf = (seat) => users[seat.username].id;
  const { rows } = await pool.query(
    "SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1 AND ss.season_number = $2 ORDER BY ss.created_at LIMIT 1",
    [show, Number(season) - 1]
  );
  if (!rows.length) return { from: null, why: `${show} ${Number(season) - 1} isn't loaded here: nobody keeps anyone`, teams: {}, back: [] };
  const cast = (await pool.query("SELECT id, name, tribe_name FROM season_cast WHERE season_id = $1 ORDER BY sort_order", [rows[0].id])).rows;
  const st = S.defaultState();
  Object.assign(st.settings, { showId: H.SLUG(show), wikiSeason: Number(season) - 1, setupComplete: true });
  S.applySeasonCast(st, cast.map((c) => ({ id: c.id, name: c.name, tribeName: c.tribe_name, photoUrl: null })));
  for (const seat of seats) S.addPlayer(st, seat.label);
  const problems = S.setGame(st, { preset: "outlast", get: { by: "draft", each, order: "draw", own: "shared" } });
  if (problems.length) throw new Error(`last season's game: ${problems[0].problem}`);
  S.DrawLogic.draw(st, `zt-pt-keep-${show}-${season}`);
  const slug = `zt-pt-keep-${g.n}-${season}`;
  const { rows: made } = await pool.query(
    "INSERT INTO leagues (name, slug, join_code, state, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [`Last season ${g.n}`, slug, `K${String(g.n).padStart(3, "0")}${String(season).slice(-2)}`, JSON.stringify(st), idOf(seats[0])]
  );
  const from = made[0].id;
  for (const [i, seat] of seats.entries()) {
    await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, $4)", [from, idOf(seat), st.players[i].id, i ? "member" : "commissioner"]);
  }
  const here = new Set((await pool.query("SELECT name FROM season_cast WHERE season_id = $1", [copy.seasonId])).rows.map((c) => S.KeeperLogic.nameKey(c.name)));
  const teams = Object.fromEntries(seats.map((seat, i) => [seat.label, st.castaways.filter((c) => (c.ownerIds || []).includes(st.players[i].id)).map((c) => c.name)]));
  const back = cast.filter((c) => here.has(S.KeeperLogic.nameKey(c.name))).map((c) => c.name);
  return { from, why: null, teams, back };
}

/**
 * A11 part 5b: a game with a handicap needs a couch with a history, or everyone on it is new and it evens nothing out. Two of the
 * four seats (the tinkerer and the fan) get an earlier game on the replay's couch: a bare Outlast on the show's season before (only
 * that they held a seat in it counts), made a year before this season's premiere, a zt-pt- league H.down takes out. The drive-by and
 * the forgetter are the newcomers. Made before anyone joins the game, so every write the game has reads it (handicaps.ts).
 * { leagueId, veterans: [labels], newcomers: [labels] }.
 */
async function earlierGame(r, season) {
  const { pool, S } = app();
  const s = await H.stateOf(r.leagueId);
  const veterans = r.seats.filter((x) => x.role === "tinkerer" || x.role === "fan");
  const st = S.defaultState();
  Object.assign(st.settings, { showId: s.settings.showId, wikiSeason: Number(season) - 1, setupComplete: true });
  for (const seat of veterans) S.addPlayer(st, seat.label);
  const { rows: made } = await pool.query(
    `INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE((SELECT premiere_date FROM show_seasons WHERE id = $7)::timestamptz, now()) - interval '365 days') RETURNING id`,
    [`Earlier ${r.n}`, `zt-pt-hist-${r.n}-${season}`, `H${String(r.n).padStart(3, "0")}${String(season).slice(-2)}`, JSON.stringify(st), r.users[r.seats[0].username].id, r.couchId, r.seasonId]
  );
  for (const [i, seat] of veterans.entries()) {
    await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, $4)", [made[0].id, r.users[seat.username].id, st.players[i].id, i ? "member" : "commissioner"]);
  }
  return { leagueId: made[0].id, veterans: veterans.map((x) => x.label), newcomers: r.seats.filter((x) => !veterans.includes(x)).map((x) => x.label) };
}

/** A game's record, as playtest.js's moves and waivers read one. */
const recordOf = (n, name, seats, users, seasonId, game) => ({ n, name, seats, users, seasonId, lateSeat: null, log: [], problems: [], weeks: {}, did: {}, asks: {}, waivers: [], accepted: {}, opts: {}, bots: [], game, episodes: [] });

/**
 * A12 part 1: a game in stages' stage leagues (stages.ts: each its own game with the game's seats), a record each beside the game's,
 * in its spec's order: its own n (the game's, then the stage's place), the same seats and couch; the first stage's draft now when it
 * can open, a later one's when it does (the episode loop: at its start, from who's left). A12 part 2: only the live ones not in
 * `known` (a copy a format change started is found after the episode whose research made it), a copy after its stage's own place.
 */
async function stageRecords(r, g, known = new Set()) {
  const { pool, S } = app();
  const { rows: all } = await pool.query("SELECT id, stage_key FROM leagues WHERE stage_of = $1 AND deleted_at IS NULL ORDER BY created_at, id", [r.leagueId]);
  const rows = all.filter((x) => !known.has(x.stage_key));
  const order = (S.gameOf(await H.stateOf(r.leagueId)).stages || []).map((x) => x.id);
  const place = (key) => order.indexOf(S.StageLogic.copyOf(key) || key);
  rows.sort((a, b) => place(a.stage_key) - place(b.stage_key));
  const out = [];
  for (const [j, row] of rows.entries()) {
    const i = known.size + j;
    await pool.query("UPDATE leagues SET slug = $2 WHERE id = $1", [row.id, `zt-pt-${r.n}-${i + 1}-${row.id.slice(0, 8)}`]);
    const sr = recordOf(r.n * 10 + i + 1, `${g.label} · ${row.stage_key}`, r.seats, r.users, r.seasonId, { ...g, n: `${g.n}.${i + 1}`, label: `${g.label} · ${row.stage_key}`, stageOf: g.n });
    Object.assign(sr, { couchId: r.couchId, leagueId: row.id, stageOf: r.leagueId, stageKey: row.stage_key });
    await H.seatIds(sr);
    const s = await H.stateOf(row.id);
    if (S.getLeagueType(s).hasRoster && !S.DraftLogic.waits(s)) await H.draft(sr);
    out.push(sr);
  }
  return out;
}

/** One game: made before the premiere on a couch of its own (the engine lab's start, the tinkerer its Commissioner), the
 *  other seats joining through Join, its draft if it has one. A record playtest.js's moves and waivers can play. A game in stages
 *  (A12 part 1) has its stages' records too (r.stages). */
async function startGame(g, copy, users, seats, show, season) {
  const { lab, pool, S } = app();
  const r = recordOf(900 + g.n, g.label, seats.map((x) => ({ ...x })), users, copy.seasonId, g);
  r.couchId = await H.couchFor(r.n, r.seats, users, copy.seasonId);
  const lead = users[r.seats[0].username];
  try {
    // A10 part 4: keepers come from last season's game, made first.
    let spec = g.spec;
    if (spec.get && spec.get.keep) {
      r.lastSeason = await lastSeasonGame(g, users, r.seats, show, season, copy);
      if (r.lastSeason.from) spec = { ...spec, get: { ...spec.get, keep: { ...spec.get.keep, from: r.lastSeason.from } } };
    }
    const made = await lab.labStart(lead, { seasonId: copy.seasonId, couchId: r.couchId, spec });
    r.leagueId = made.leagueId;
    await pool.query("UPDATE leagues SET slug = $2 WHERE id = $1", [r.leagueId, `zt-pt-${r.n}-${r.leagueId.slice(0, 8)}`]);
    // A11 part 5b: a handicap's couch history, before anyone joins.
    if (spec.rank && spec.rank.handicap) r.history = await earlierGame(r, season);
    for (const seat of r.seats.slice(1)) await H.join(r, seat);
    await H.seatIds(r);
    if (S.getLeagueType(await H.stateOf(r.leagueId)).hasRoster) await H.draft(r);
    if (g.playsAs === "stages") r.stages = await stageRecords(r, g);
    // What each seat kept, once the draft locked them.
    if (r.lastSeason) {
      const s = await H.stateOf(r.leagueId);
      r.lastSeason.kept = Object.fromEntries(r.seats.map((seat) => [seat.label, S.KeeperLogic.keptIds(s, H.pidOf(r, seat)).map((id) => S.getCastaway(s, id).name)]));
      r.lastSeason.locked = S.KeeperLogic.locked(s);
      r.lastSeason.sizes = Object.fromEntries(r.seats.map((seat) => [seat.label, s.castaways.filter((c) => (c.ownerIds || []).includes(H.pidOf(r, seat))).length]));
    }
  } catch (e) {
    r.problems.push(`starting it failed: ${e.message}`);
  }
  return r;
}

/** Every open question of a game answered by each seat that plays this week, through answers.ts as the app's sheet sends
 *  them. What it offered (a group question's faces and why there are none) and what it refused, for the record. */
async function answerAll(r, n) {
  const { answers, S } = app();
  const offered = {};
  const answered = {};
  const refused = [];
  // A11 part 2b: as the app offers nothing after a game ended early, nor to a seat that's out (as playtest.js's moves skip them),
  // nothing is answered then: the league as it stands, a game of questions walked over its answers.
  const s = await standing(r);
  if (S.KnockoutLogic.endedBefore(s, n)) return { offered, answered, refused };
  for (const seat of r.seats) {
    const user = r.users[seat.username];
    let gq;
    try {
      gq = await answers.gameQuestions(user, r.seasonId, r.leagueId, n);
    } catch (e) {
      r.problems.push(`episode ${n}: ${seat.label} couldn't read its questions: ${e.message}`);
      continue;
    }
    const open = gq.questions.filter((q) => q.status === "open" && (q.episode === n || q.episode === null) && q.mine == null);
    for (const q of gq.questions) {
      if (q.answer === "group" && seat === r.seats[0]) offered[q.id] = { faces: (q.faces || []).map((f) => f.name), offWhy: q.offWhy || null, status: q.status };
    }
    if (!answersThisWeek(seat, n) || !open.length || S.KnockoutLogic.isOut(s, H.pidOf(r, seat))) continue;
    const body = {};
    for (const q of open) {
      const v = answerFor(seat, q, n);
      if (v !== undefined) body[q.id] = v;
    }
    if (!Object.keys(body).length) continue;
    try {
      await answers.answerQuestions(user, r.seasonId, r.leagueId, { episode: n, answers: body });
      answered[seat.label] = Object.keys(body);
    } catch (e) {
      refused.push(`${seat.label}: ${e.message} (${JSON.stringify(body).slice(0, 160)})`);
    }
  }
  return { offered, answered, refused };
}

/** The league as it stands (A11 part 2b: a game of questions that races or knocks players out walked over its answers, as the
 *  app reads it: answer-points.ts asItStands). */
async function standing(r) {
  return (await app().points.asItStands(r.leagueId, await H.stateOf(r.leagueId))).state;
}

/** What a game shows after episode n's results, as its runner sees it: its group questions' verdicts (what was right, who
 *  earned what, whose pick was void), its table, whether it's over. */
async function lookAt(r, n) {
  const { answers, points, S } = app();
  // A12 part 1: a game in stages read as it stands, its stages' tables handed over (its own table the overall).
  const raw = await H.stateOf(r.leagueId);
  const s = S.StageLogic.on(raw) ? await standing(r) : raw;
  const out = { episode: n, table: {}, verdicts: {}, over: S.gameOver(s) };
  if (S.StageLogic.on(s)) out.stages = S.StageLogic.standings(s).map((x) => ({ key: x.key, started: x.started, over: x.over, first: x.rows.filter((y) => y.place === 1).map((y) => (r.seats.find((z) => H.pidOf(r, z) === y.playerId) || {}).label || y.playerId) }));
  const type = S.getLeagueType(s);
  const label = (pid) => (r.seats.find((x) => H.pidOf(r, x) === pid) || {}).label || pid;
  if (type.hasQuestions) {
    const st = await points.answerStanding({ leagueId: r.leagueId, state: s, playerId: null, mark: null });
    if (st) for (const p of s.players) out.table[label(p.id)] = st.right(p.id);
    if (st) out.over = st.ended;
    // A11 part 2b: who's out (the last episode that counted for them), and nothing more to read once it ended early.
    if (st && st.walk) {
      out.out = Object.fromEntries(Object.entries(st.walk.out).map(([pid, k]) => [label(pid), k]));
      // A11 part 3: a co-op game's lives are the couch's together: one number, and its result.
      if (st.walk.coop) out.coop = { lives: st.walk.coop.lives, of: st.walk.coop.of, lost: st.walk.coop.lost.map((x) => x.episode), result: st.walk.coop.result };
      else if (Object.keys(st.walk.lives).length) out.lives = Object.fromEntries(Object.entries(st.walk.lives).map(([pid, k]) => [label(pid), k]));
      // A11 part 4b: head to head on a game of questions, on the league walked as its table reads it.
      const m = S.MatchupLogic.on(s) ? matchupLine(S, S.AnswerLogic.withWalk(s, st.walk), label) : null;
      if (m) out.matchups = m;
      // A11 part 5: teams of players, on the league walked as its table reads it.
      const t = S.TeamLogic.on(s) ? teamLine(S, S.AnswerLogic.withWalk(s, st.walk), label) : null;
      if (t) out.teams = t;
      // A11 part 5b: a handicap, each one's points as the walk has them.
      if (st.walk.handicap) out.handicap = handicapLine(S, s, label, Object.entries(st.walk.handicap).map(([playerId, handicap]) => ({ playerId, handicap })));
      if (st.walk.ends !== null && n > st.walk.ends) return out;
    }
    try {
      const gq = await answers.gameQuestions(r.users[r.seats[0].username], r.seasonId, r.leagueId, n);
      for (const q of gq.questions.filter((x) => x.episode === n || x.episode === null)) {
        const v = q.verdict || {};
        if (q.answer !== "group") {
          out.verdicts[q.id] = { state: v.state || null, right: (v.right || []).slice(0, 6).map((id) => (gq.cast.find((c) => c.id === id) || {}).name || id), earned: Object.fromEntries(q.people.filter((p) => p.earned).map((p) => [label(p.playerId), p.earned])), answered: q.people.filter((p) => p.answer != null).length };
          continue;
        }
        out.verdicts[q.id] = {
          state: v.state || null,
          offered: (q.faces || []).length,
          right: (v.groups || v.right || []).map((id) => (gq.groups.find((g) => g.id === id) || gq.cast.find((c) => c.id === id) || {}).name || id),
          earned: Object.fromEntries(q.people.map((p) => [label(p.playerId), p.earned])),
          void: q.people.filter((p) => p.answer != null && p.right === null && v.state === "known").map((p) => label(p.playerId)),
          answers: Object.fromEntries(q.people.filter((p) => p.answer != null).map((p) => [label(p.playerId), (gq.groups.find((g) => g.id === p.answer) || {}).name || String(p.answer)])),
        };
      }
    } catch (e) {
      r.problems.push(`episode ${n}: reading its questions after the results failed: ${e.message}`);
    }
  } else {
    const rows = S.computeScores(s);
    for (const x of rows) out.table[label(x.playerId)] = Math.round(x.total * 10) / 10;
    const slots = slotLines(r, s, n);
    if (slots) out.slots = slots;
    // A11 part 4: head to head's records, as the app reads the league (its season length as its last write stamped it).
    const m = S.MatchupLogic.on(s) ? matchupLine(S, s, label, rows) : null;
    if (m) out.matchups = m;
    // A11 part 5: teams of players, as the app reads the league.
    const t = S.TeamLogic.on(s) ? teamLine(S, s, label, rows) : null;
    if (t) out.teams = t;
    // A11 part 5b: a handicap, as the app reads the league.
    if (S.HandicapLogic.on(s)) out.handicap = handicapLine(S, s, label, rows);
  }
  return out;
}

/** A11 part 5b: a game with a handicap after an episode: who it names, whether that's kept yet, and each one's points from it so far
 *  (`rows`: { playerId, handicap }). */
function handicapLine(S, s, label, rows) {
  const v = S.HandicapLogic.view(s, null);
  return { newcomers: v.newcomers.map(label), kept: v.kept, points: Object.fromEntries(rows.map((x) => [label(x.playerId), x.handicap || 0])) };
}

/** A11 part 5: a game played in teams of players after an episode: each team's points, place and who's on it now, on `v` (a game of
 *  questions' carrying its walk); `rows`, its score rows when they're read already. */
function teamLine(S, v, label, rows = S.computeScores(v)) {
  const st = S.TeamLogic.standings(S.spanView(v), rows);
  if (!st) return null;
  return Object.fromEntries(st.map((t) => [t.id, { points: t.points, place: t.place, members: t.members.map(label) }]));
}

/** A11 part 4: a head-to-head game's record after an episode: the records (wins-losses-ties), where the playoffs are, the seeds once
 *  known, the rounds played and the champion, on `v` (a game of questions' carrying its walk: part 4b); `rows`, its score rows when
 *  they're read already. */
function matchupLine(S, v, label, rows = S.computeScores(v)) {
  const w = S.MatchupLogic.run(S.spanView(v));
  if (!w) return null;
  return {
    records: Object.fromEntries(rows.filter((x) => x.matchups).map((x) => [label(x.playerId), `${x.matchups.wins}-${x.matchups.losses}-${x.matchups.ties}`])),
    from: w.from,
    seeds: w.seeds ? w.seeds.map(label) : null,
    played: w.rounds.filter((x) => x.played).map((x) => x.number),
    champion: w.champion ? label(w.champion) : null,
  };
}

/**
 * A10 part 1: a game with group slots, before episode n: each seat's empty or dropped slot takes a group on offer going into it
 * (the one holding most of its own team, else one by its seat: a habit, the same every replay), through the app's own write
 * (withLeagueLock settles the season's groups into the game first, then GroupSlotLogic's checks). What each seat did, by label:
 * [{ slot, did: picked | rides | none | refused, group, why }].
 */
async function slotMoves(r, n) {
  const { S, withLeagueLock } = app();
  const out = {};
  for (const [i, seat] of r.seats.entries()) {
    const pid = H.pidOf(r, seat);
    if (!pid) continue;
    const did = [];
    try {
      await withLeagueLock(r.leagueId, (st) => {
        const cfg = S.GroupSlotLogic.config(st);
        const epObj = st.episodes.find((e) => e.number === n);
        if (!cfg || !epObj) return;
        const mine = new Set(st.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id));
        const offer = S.GroupSlotLogic.offered(st, n);
        // The slots riding with their groups first, so another slot never takes the group one of them has.
        const now = Array.from({ length: cfg.slots }, (_, k) => S.GroupSlotLogic.standing(st, pid, k, n));
        const riding = new Set(now.filter((x) => x.pick && x.status === "waiting").map((x) => x.pick.id));
        for (let k = 0; k < cfg.slots; k++) {
          if (now[k].pick && now[k].status === "waiting") {
            did.push({ slot: k, did: "rides", group: now[k].pick.id });
            continue;
          }
          // Not a group another of its slots has (riding with it, or picked now).
          const taken = new Set([...riding, ...did.filter((d) => d.did === "picked").map((d) => d.group)]);
          const free = offer.groups.filter((g) => !taken.has(g.id));
          if (!free.length) {
            did.push({ slot: k, did: "none", why: offer.why[0] || "nothing on offer" });
            continue;
          }
          const ranked = [...free].sort((a, b) => b.members.filter((m) => mine.has(m)).length - a.members.filter((m) => mine.has(m)).length);
          const want = ranked[0].members.some((m) => mine.has(m)) ? ranked[0] : free[(i + k) % free.length];
          const problem = S.GroupSlotLogic.validatePick(st, epObj.id, pid, k, want.id);
          if (problem) did.push({ slot: k, did: "refused", group: want.name, why: problem });
          else {
            S.GroupSlotLogic.setPick(st, epObj.id, pid, k, want.id);
            did.push({ slot: k, did: "picked", group: want.id, name: want.name, shared: offer.shared });
          }
        }
      });
    } catch (err) {
      did.push({ did: "refused", why: err.message });
    }
    out[seat.label] = did;
  }
  return out;
}

/** A10 part 1: what each seat's group slots did in episode n, after its results: by label, [{ slot, status, group, points }]. */
function slotLines(r, s, n) {
  const { S } = app();
  const ep = s.episodes.find((e) => e.number === n);
  if (!ep || !S.GroupSlotLogic.config(s)) return null;
  const out = {};
  for (const seat of r.seats) {
    const pid = H.pidOf(r, seat);
    if (!pid) continue;
    out[seat.label] = S.GroupSlotLogic.episodeLines(s, ep, pid).map((l) => ({ slot: l.slot, status: l.status, group: l.pick ? l.pick.id : null, points: l.points, unsure: l.unsure }));
  }
  return out;
}

/** A game's questions still waiting for a verdict at the season's end that someone answered ("id@episode"; the game's own
 *  questions as "id@game"), read episode by episode as its runner sees them: { never, early, earlyEpisodes }, `early` those
 *  about an episode whose results stayed early (only who went home, never its moments: the playtest report's finding 20, a
 *  finale with nothing more to score), or about the game while any of its episodes did, which wait on that, not on the game.
 *  All [] for a game without questions. */
async function unsettled(r, E) {
  const { answers, S } = app();
  const s = await H.stateOf(r.leagueId);
  if (!(S.AnswerLogic.questions(s) || []).length) return { never: [], early: [], earlyEpisodes: [] };
  const early = new Set(s.episodes.filter((e) => S.EpisodeLogic.resultsStage(e) === "early").map((e) => e.number));
  const out = new Set();
  const held = new Set();
  const user = r.users[r.seats[0].username];
  for (let n = 1; n <= E; n++) {
    let gq;
    try {
      gq = await answers.gameQuestions(user, r.seasonId, r.leagueId, n);
    } catch {
      continue;
    }
    for (const q of gq.questions) {
      if (q.episode !== n && q.episode !== null) continue;
      if (!(q.verdict && q.verdict.state === "waiting" && q.people.some((p) => p.answer != null))) continue;
      const key = `${q.id}@${q.episode === null ? "game" : n}`;
      // A question about one episode waits on it; one about the whole game, on any of its episodes ("will anyone quit": no,
      // once every episode's moments are in).
      ((q.episode !== null ? early.has(n) : early.size > 0) ? held : out).add(key);
    }
  }
  return { never: [...out], early: [...held], earlyEpisodes: [...early] };
}

/** The format state over time as the app reads it after episode n's research landed (db/format-timeline.js), and what the
 *  next episode's prompt would carry (the research context: the groups going in, newcomers, the word for its groups). */
async function formatAfter(copy, n, E) {
  const { pool, DBT, Research } = app();
  const got = await DBT.timelineForSeason(pool, copy.seasonId);
  const tl = got ? got.timeline : null;
  const e = tl ? Timeline.at(tl, n) : null;
  const trig = tl ? Timeline.stageTriggers(tl) : { act: [], held: [] };
  // A12 part 2b: where a stage with a 'next-stage' fallback would end, the groups gone going into an episode (sure, or held).
  const gone = tl ? Timeline.groupsGone(tl) : { act: [], held: [] };
  const out = {
    episode: n,
    sure: e ? e.sure : null,
    why: e ? e.why : ["no report"],
    played: e && e.played ? { apart: !!e.played.apart, groups: (e.played.groups || []).length, sure: !!e.played.sure } : null,
    end: e && e.end ? { groups: e.end.groups.length, alone: e.end.alone.length } : null,
    changes: e ? e.changes.map((c) => ({ kind: c.kind, allNew: !!c.allNew, from: Timeline.effective(c, n), sure: c.sure, by: c.by, ahead: !!c.ahead, what: c.what || "" })) : [],
    wentHomeAs: e ? e.wentHomeAs : null,
    triggers: { act: trig.act.filter((x) => x.episode === n).map((x) => `${x.kind} from ${x.from}`), held: trig.held.filter((x) => x.episode === n).map((x) => `${x.kind} from ${x.from}`) },
    groupsGone: { act: gone.act.filter((x) => x.episode === n).map((x) => `${x.kind} from ${x.from}`), held: gone.held.filter((x) => x.episode === n).map((x) => `${x.kind} from ${x.from}`) },
    slots: tl ? Timeline.groupSlots(tl).filter((x) => x.opensAfter === n).length : 0,
    sideStages: tl ? Timeline.sideStages(tl).filter((x) => x.opens && x.opensAfter === n).map((x) => ({ groups: x.groups.length, scores: x.scores })) : [],
    newcomers: tl ? tl.newcomers.filter((x) => x.episode === n).map((x) => x.name) : [],
  };
  if (n < E) {
    try {
      const ctx = await Research.resolveSeasonResearchContext(pool, H.SLUG(copy.show), copy.number, n + 1);
      const g = ctx.formatGoingIn;
      out.next = { goingIn: g ? { groups: g.state.groups.length, alone: g.state.alone.length, sure: g.sure, why: g.why, asOf: g.episode } : null, newcomers: ctx.newcomers || [], groupWord: ctx.groupWord || null };
    } catch (e2) {
      out.next = { error: e2.message };
    }
  }
  return out;
}

/** The premiere as the app reads it and as it would with what was known before it (the season's rulebook: its groups change
 *  often, so the cast list's groups aren't who plays with whom). */
async function premiere(r) {
  const { answers } = app();
  try {
    const gq = await answers.gameQuestions(r.users[r.seats[0].username], r.seasonId, r.leagueId, 1);
    return gq.questions.filter((q) => q.answer === "group" && q.episode === 1).map((q) => ({ id: q.id, faces: (q.faces || []).map((f) => f.name), offWhy: q.offWhy || null }));
  } catch {
    return [];
  }
}

async function run(show, season, opts = {}) {
  const { S, pool } = app();
  const Tapes = require("./tapes");
  const t = Study.loadTimeline(show, season);
  if (!t) throw new Error(`no fixture for ${show} ${season} (tests/fixtures/format-timelines)`);
  console.log(`(first) removed ${await H.down()}`);
  const copy = await H.copySeason(show, season, await loadedSeason(show, season));
  const E = copy.episodeCount;
  const through = Math.min(E, Number(opts.through) || E);
  const format = (await app().Research.resolveSeasonResearchContext(pool, H.SLUG(show), season, 1)).format;
  const f2 = FA.answersOf(show, season);
  const all = await gamesFor(copy.seasonId, show);
  const only = opts.only ? String(opts.only).split(",").map(Number) : null;
  const games = all.filter((g) => g.plays && (!only || only.includes(g.n)));
  console.log(`${show} ${season}: ${E} episodes; ${all.filter((g) => g.plays).length} of ${all.length} tracker games play here${only ? `, ${games.length} picked` : ""}`);
  const seats = PT.seatsFor(GROUP_SIZE);
  const users = {};
  for (const seat of seats) users[seat.username] ||= await H.userFor(seat);
  const replays = [];
  for (const g of games) {
    const r = await startGame(g, copy, users, seats, show, season);
    replays.push(r);
    // A12 part 1: a game in stages' stages, each played as a game of its own.
    for (const sr of r.stages || []) replays.push(sr);
    if (r.problems.length) console.log(`  ${g.n}. ${g.label}: ${r.problems[0]}`);
  }
  const live = () => replays.filter((r) => r.leagueId && !r.dead);
  const record = { show, season, title: t.title, episodes: E, at: new Date().toISOString(), games: all.map(({ spec, ...g }) => ({ ...g, spec })), premiere: {}, format: [], sources: {}, exits: {}, replays: [] };
  for (const r of live()) {
    const p = await premiere(r);
    if (p.length) record.premiere[r.game.n] = p;
  }
  const tapeAnswer = Tapes.answerer(show, season);
  for (let ep = 1; ep <= through; ep++) {
    // Before it airs: the moves and the answers, at the lock (each game its own league and couch: four at once).
    await each(live(), async (r) => {
      let s = await H.stateOf(r.leagueId);
      const e = { episode: ep };
      // A12 part 1: a stage's draft that opens at its start, once it has (the episode before it has results): drafted now, from
      // who's left (shared as it opens when four of you no longer fit: stages.ts).
      try {
        if (r.stageOf && S.getLeagueType(s).hasRoster && !S.DraftLogic.begun(s) && !S.DraftLogic.waits(s)) {
          await H.draft(r);
          s = await H.stateOf(r.leagueId);
          e.drafted = { own: s.settings.ownershipMode, picks: r.draft };
        }
      } catch (err) {
        r.problems.push(`episode ${ep}: the stage's draft failed: ${err.message}`);
      }
      try {
        if (S.inPlay(s, ep)) r.weeks[ep] = await H.moves(r, ep);
      } catch (err) {
        r.problems.push(`episode ${ep}: moves failed: ${err.message}`);
      }
      // Group slots (A10 part 1): each seat with an empty slot picks from the groups on offer going into this episode.
      try {
        if (S.inPlay(s, ep) && S.GroupSlotLogic.config(s)) e.slotPicks = await slotMoves(r, ep);
      } catch (err) {
        r.problems.push(`episode ${ep}: group slot picks failed: ${err.message}`);
      }
      // Its questions, while the game is on (a game over one episode asks nothing before it; one waiting for a phase, nothing yet).
      const waiting = !!s.settings.startPhase && !Number.isInteger(s.settings.startEpisode);
      const inSpan = !waiting && ep >= (s.settings.startEpisode ?? 1) && ep <= (s.settings.endEpisode ?? Infinity);
      if (inSpan && (S.getLeagueType(s).hasQuestions || (S.AnswerLogic.questions(s) || []).length)) Object.assign(e, await answerAll(r, ep));
      r.episodes.push(e);
    });
    await pool.query("UPDATE show_follows SET seen_through = $2 WHERE season_id = $1", [copy.seasonId, ep]);
    // The episode's research, as it would have come in.
    const src = sectionFor(t, ep, f2, { hasMerge: !!format.hasMerge });
    record.sources[ep] = src.from;
    let reshaped = null;
    const hooks = {
      quick: (text) => fixtureQuick(t, ep, format, text).text,
      full: (text, { ctx }) => {
        const fq = fixtureQuick(t, ep, format, null);
        const asked = ctx ? app().Research.pasteSkeleton(ctx, []).castaways : [];
        const got = blindFull(text, { quick: fq.quick, asked, format, section: src.section, merged: src.merged });
        reshaped = got.changes;
        return got.text;
      },
    };
    const filed = await H.fileResults(copy, ep, tapeAnswer, "placed", hooks);
    await pool.query("UPDATE season_episodes SET air_at = air_at + make_interval(days => $2::int) WHERE season_id = $1 AND air_at < now()", [copy.seasonId, copy.shiftDays]);
    if (reshaped && (reshaped.left.length || reshaped.stayed.length || reshaped.added.length)) record.exits[ep] = { left: reshaped.left, stayed: reshaped.stayed, added: reshaped.added };
    const fmt = await formatAfter(copy, ep, E);
    fmt.source = src.from;
    fmt.results = { quick: filed.quick.message, full: filed.full.message };
    record.format.push(fmt);
    // A12 part 2: a stage a format change starts: the copies the season sync made with this episode's research (each played from
    // here as a game of its own, its draft at its start), and a copy a corrected report took away (its record ends here).
    for (const r of replays.filter((x) => x.game.playsAs === "stages" && !x.stageOf && x.leagueId && !x.dead)) {
      try {
        r.stages = r.stages || [];
        const fresh = await stageRecords(r, r.game, new Set(r.stages.map((x) => x.stageKey)));
        for (const sr of fresh) {
          sr.madeAfter = ep;
          r.stages.push(sr);
          replays.push(sr);
        }
        const { rows: gone } = await pool.query("SELECT id FROM leagues WHERE stage_of = $1 AND deleted_at IS NOT NULL", [r.leagueId]);
        for (const sr of r.stages) {
          const away = gone.some((x) => x.id === sr.leagueId);
          if (!sr.dead && away) Object.assign(sr, { dead: true, undone: ep });
          // Back (its change said again): played on from here.
          else if (sr.dead && sr.undone && !away) Object.assign(sr, { dead: false, undone: null, back: ep });
        }
        if (fresh.length) console.log(`    ${r.game.n}. ${r.game.label}: ${fresh.map((x) => x.stageKey).join(", ")} made after ${ep}`);
      } catch (err) {
        r.problems.push(`episode ${ep}: finding its stages failed: ${err.message}`);
      }
    }
    const said = fmt.changes.length ? fmt.changes.map((c) => `${c.kind}${c.allNew ? " (all new)" : ""} from ${c.from} ${c.sure === "high" && (c.by === "both" || c.by === "said") && !c.ahead ? "sure" : "held"}`).join("; ") : "no change";
    console.log(`  episode ${ep}: ${src.from || "no section"}; ${fmt.sure ? "sure" : `unsure (${(fmt.why || []).join("; ")})`}; ${said}${fmt.newcomers.length ? `; came in: ${fmt.newcomers.join(", ")}` : ""}${record.exits[ep] ? `; exits made the fixture's: ${[...record.exits[ep].left, ...record.exits[ep].stayed.map((x) => `${x} stays`)].join(", ")}` : ""}`);
    await each(live(), async (r) => {
      const s = await H.stateOf(r.leagueId);
      const e = r.episodes.find((x) => x.episode === ep);
      // A game still waiting for its phase (a stage at the merge) has nothing to look at yet.
      if (S.waitsForPhase(s)) return;
      if (ep > (s.settings.endEpisode ?? Infinity) || ep < (s.settings.startEpisode ?? 1)) return;
      try {
        Object.assign(e, await lookAt(r, ep));
        e.played = true;
        const w = await H.waivers(r, ep);
        if (w) e.waivers = w.ran;
        if (w && w.cash) e.cash = w.cash;
      } catch (err) {
        r.problems.push(`episode ${ep}: after the results: ${err.message}`);
      }
    });
  }
  // At the season's end, every question each game asked read once more as its runner sees it: anything someone answered that
  // still waits for a verdict never settled.
  if (through === E) {
    await each(live(), async (r) => {
      r.unsettled = await unsettled(r, E).catch((err) => ({ never: [`reading it at the end failed: ${err.message}`], early: [] }));
    });
  }
  // The records: each game's, and what it did at each change.
  for (const r of replays) {
    const s = r.leagueId ? await H.stateOf(r.leagueId) : null;
    const played = r.episodes.filter((e) => e.played);
    const g = { n: r.game.n, label: r.game.label, variant: r.game.variant, rows: r.game.rows, sentence: r.game.sentence, playsAs: r.game.playsAs, leagueId: r.leagueId || null, madeAfter: r.madeAfter ?? null, undone: r.undone ?? null, span: s ? [s.settings.startEpisode ?? 1, s.settings.endEpisode ?? null] : null, over: s ? (played.length ? played[played.length - 1].over : S.gameOver(s)) : false, lastEpisode: played.length ? played[played.length - 1].episode : null, draft: r.draft || null, lastSeason: r.lastSeason || null, history: r.history || null, episodes: r.episodes, problems: r.problems, final: played.length ? played[played.length - 1].table : null };
    if (through < E) g.over = g.over || null;
    g.unsettled = (r.unsettled && r.unsettled.never) || [];
    g.waitsOnEarly = (r.unsettled && r.unsettled.early) || [];
    g.earlyEpisodes = (r.unsettled && r.unsettled.earlyEpisodes) || [];
    g.check = through < E ? [] : problemsOf(g);
    record.replays.push(g);
  }
  fs.mkdirSync(outDir(), { recursive: true });
  const base = path.join(outDir(), `${show}-${season}${through < E ? `-through${through}` : ""}`);
  fs.writeFileSync(`${base}.json`, JSON.stringify(record, null, 2) + "\n", "utf8");
  fs.writeFileSync(`${base}.md`, markdown(record), "utf8");
  const failed = record.replays.filter((g) => g.check.length);
  console.log(`${show} ${season}: ${record.replays.length} games, ${record.replays.length - failed.length} played through${failed.length ? `, ${failed.length} with problems` : ""}; ${base}.md`);
  for (const g of failed.slice(0, 12)) console.log(`  ! ${g.n}. ${g.label}: ${g.check.slice(0, 3).join("; ")}`);
  await new Promise((done) => setTimeout(done, 2000));
  if (!opts.keep) console.log(`removed ${await H.down()}`);
  return record;
}

// ---------- the record in words ----------

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ");

/** What a game did at an episode, in a line: its group questions' choices and verdicts, else that nothing it plays reads the
 *  format (its table moved by the people's results). */
function didLine(g, n) {
  const e = g.episodes.find((x) => x.episode === n);
  if (!e || !e.played) return null;
  const parts = [];
  for (const [qid, o] of Object.entries(e.offered || {})) {
    const v = (e.verdicts || {})[qid] || {};
    const off = !o.faces.length;
    const got = off ? `off (${o.offWhy || "nothing offered"})` : `offered ${o.faces.length}: ${o.faces.slice(0, 3).join(", ")}${o.faces.length > 3 ? ", ..." : ""}`;
    const verdict = v.state === "known" ? `right ${v.right.length ? v.right.join(", ") : "none"}${v.void.length ? `, void for ${v.void.join(", ")}` : ""}` : v.state || "no verdict";
    parts.push(`${qid}: ${got}; ${verdict}`);
  }
  // A10 part 1: group slots, each seat's (picked before it, then how each slot did).
  if (e.slots) {
    const picked = Object.values(e.slotPicks || {}).flat().filter((d) => d.did === "picked");
    const lines = Object.entries(e.slots).flatMap(([who, ls]) => ls.map((l) => `${who} ${l.status}${l.points ? ` ${l.points}` : ""}`));
    parts.push(`slots: ${picked.length ? `${picked.length} picked (${[...new Set(picked.map((d) => d.name))].slice(0, 3).join(", ")}${picked.some((d) => d.shared) ? ", shared" : ""}); ` : ""}${lines.join(", ")}`);
  }
  if (!parts.length) parts.push("rides on the people (nothing it plays reads the format)");
  if (e.refused && e.refused.length) parts.push(`${e.refused.length} answer(s) refused`);
  return parts.join(" · ");
}

function markdown(x) {
  const out = [];
  out.push(`# Blind replay: ${x.title} (${x.show} ${x.season})`);
  out.push("");
  out.push(`${x.episodes} episodes, replayed ${x.at.slice(0, 16).replace("T", " ")} UTC by \`scripts/dev-test/blind.js\`. Each episode's format section: the local bot's own (F2's) where it was asked again, else a stand-in from F1's fixture; who went home: the fixture's.`);
  out.push("");
  out.push("## The format, episode by episode, as the app read it");
  out.push("");
  out.push("| Ep | Section | Sure | Changes (from, sure or held) | Triggers | Next prompt: groups going in | Newcomers |");
  out.push("|---|---|---|---|---|---|---|");
  for (const f of x.format) {
    const ch = f.changes.length ? f.changes.map((c) => `${c.kind}${c.allNew ? " (all new)" : ""} ${c.from}, ${c.sure === "high" && (c.by === "both" || c.by === "said") && !c.ahead ? "sure" : "held"}`).join("; ") : "-";
    const tr = [...f.triggers.act.map((a) => `act: ${a}`), ...f.triggers.held.map((h) => `held: ${h}`)].join("; ") || "-";
    const nx = f.next && f.next.goingIn ? `${f.next.goingIn.groups} groups${f.next.goingIn.alone ? `, ${f.next.goingIn.alone} alone` : ""}, ${f.next.goingIn.sure ? "sure" : "unsure"}${f.next.groupWord ? ` (${f.next.groupWord})` : ""}` : f.next && f.next.error ? `error: ${f.next.error}` : "-";
    out.push(`| ${f.episode} | ${f.source || "none"} | ${f.sure ? "sure" : cell(`unsure: ${(f.why || []).join("; ")}`)} | ${cell(ch)} | ${cell(tr)} | ${cell(nx)} | ${cell([...f.newcomers, ...(f.next && f.next.newcomers && f.next.newcomers.length ? [`asked about next: ${f.next.newcomers.join(", ")}`] : [])].join("; ") || "-")} |`);
  }
  if (Object.keys(x.exits).length) {
    out.push("");
    out.push("**Who went home, made the fixture's** (where the tape's answer differed):");
    for (const [n, e] of Object.entries(x.exits)) out.push(`- Episode ${n}: ${[...e.left.map((l) => `${l} left`), ...e.stayed.map((s) => `${s} stayed`), ...e.added.map((a) => `${a} added to the answer`)].join("; ")}`);
  }
  if (Object.keys(x.premiere).length) {
    out.push("");
    out.push("**The premiere's group questions** (nothing about the format known yet):");
    for (const [n, qs] of Object.entries(x.premiere)) for (const q of qs) out.push(`- Game ${n}, ${q.id}: ${q.faces.length ? `offers ${q.faces.join(", ")}` : `nothing (${q.offWhy || "no faces"})`}`);
  }
  out.push("");
  out.push("## The games");
  out.push("");
  out.push("| # | Game | Plays as | Span | Over | Final table | Checks |");
  out.push("|---|---|---|---|---|---|---|");
  for (const g of x.replays) {
    const table = g.final ? Object.entries(g.final).map(([k, v]) => `${k} ${v}`).join(", ") : "-";
    out.push(`| ${g.n} | ${cell(g.label)}${g.madeAfter ? ` (made after ${g.madeAfter})` : ""}${g.undone ? ` (taken away after ${g.undone})` : ""} | ${g.playsAs || "-"} | ${g.span ? `${g.span[0]}-${g.span[1] ?? "end"}` : "-"} | ${g.over ? "yes" : g.undone ? "taken away" : "no"} | ${cell(table)} | ${cell(g.check.length ? g.check.slice(0, 3).join("; ") : (g.waitsOnEarly || []).length ? `ok; waits on early results (finding 20): ${g.waitsOnEarly.join(", ")}` : "ok")} |`);
  }
  // A10 part 4: the keepers games, and what they kept from last season's.
  for (const g of x.replays.filter((y) => y.lastSeason)) {
    const ls = g.lastSeason;
    out.push("");
    out.push(ls.from
      ? `**Game ${g.n} keeps from last season's** (its own Outlast on season ${x.season - 1}, dealt at random): ${ls.back.length} of that cast back on this one (${ls.back.join(", ") || "nobody"}). ${Object.entries(ls.teams).map(([k, v]) => `${k} had ${v.join(", ")}; kept ${(ls.kept || {})[k] && ls.kept[k].length ? ls.kept[k].join(", ") : "nobody"}`).join(". ")}. Teams after the draft: ${Object.entries(ls.sizes || {}).map(([k, v]) => `${k} ${v}`).join(", ")}${ls.locked ? "" : " (the keepers never locked)"}.`
      : `**Game ${g.n} keeps from last season's**: ${ls.why} (every team drafted whole: ${Object.entries(ls.sizes || {}).map(([k, v]) => `${k} ${v}`).join(", ")}).`);
  }
  const notHere = x.games.filter((g) => !g.plays);
  if (notHere.length) {
    out.push("");
    out.push(`**Tracker games that don't play on this season** (${notHere.length}): ${notHere.map((g) => `${g.label} (${g.why})`).join("; ")}.`);
  }
  out.push("");
  const grouped = x.replays.filter((g) => g.episodes.some((e) => Object.keys(e.offered || {}).length));
  if (grouped.length) {
    out.push("## The group questions, lock by lock");
    out.push("");
    out.push("What each game asking about a group offered at each episode's lock (from the timeline of the episodes before it, or the league's own groups) and how it was graded once the episode's research landed: what was right, whose pick was void (a group that didn't play as offered), or off for everyone (no points either way).");
    out.push("");
    out.push(`| Ep | ${grouped.map((g) => `${g.n}. ${cell(g.variant || g.label)}`).join(" | ")} |`);
    out.push(`|---|${grouped.map(() => "---").join("|")}|`);
    for (let n = 1; n <= x.episodes; n++) {
      const cells = grouped.map((g) => {
        const e = g.episodes.find((y) => y.episode === n);
        if (!e || !e.played) return "-";
        return Object.entries(e.offered || {}).map(([qid, o]) => {
          const v = (e.verdicts || {})[qid] || {};
          const lead = o.faces.length ? `${o.faces.length} offered` : "none offered";
          const got = v.state === "known" ? `right: ${v.right.join(", ") || "none"}${v.void && v.void.length ? `; void: ${v.void.join(", ")}` : ""}` : v.state === "off" ? "off" : v.state || "-";
          return `${lead}; ${got}`;
        }).join(" / ");
      });
      out.push(`| ${n} | ${cells.map(cell).join(" | ")} |`);
    }
    out.push("");
  }
  out.push("## What each game did at each change");
  const changed = x.format.filter((f) => f.changes.some((c) => c.kind !== "twist" && c.kind !== "role" && c.kind !== "new-phase") || f.newcomers.length);
  for (const f of changed) {
    out.push("");
    out.push(`**Episode ${f.episode}** (${f.changes.map((c) => `${c.kind} from ${c.from}`).join("; ") || "a newcomer"}): the games at the next lock, ${f.episode + 1}.`);
    const lines = new Map();
    for (const g of x.replays) {
      const l = didLine(g, f.episode + 1);
      if (!l) continue;
      if (!lines.has(l)) lines.set(l, []);
      lines.get(l).push(g.n);
    }
    for (const [l, ns] of lines) out.push(`- ${ns.length > 6 ? `${ns.length} games` : `Games ${ns.join(", ")}`}: ${l}`);
  }
  return out.join("\n") + "\n";
}

// ---------- summary ----------

function summary(md = false) {
  const dir = outDir();
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^[a-z-]+-\d+\.json$/.test(f)) : [];
  const lines = [];
  if (md) {
    lines.push("| Season | Episodes | Sections (bot / stand-in) | Sure changes | Held | Games | Played through | Over | Waiting on early results |");
    lines.push("|---|---|---|---|---|---|---|---|---|");
  }
  for (const f of files) {
    const x = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const src = Object.values(x.sources);
    const ch = x.format.flatMap((e) => e.changes);
    const sure = ch.filter((c) => c.sure === "high" && (c.by === "both" || c.by === "said") && !c.ahead).length;
    const ok = x.replays.filter((g) => !g.check.length).length;
    const over = x.replays.filter((g) => g.over).length;
    const early = x.replays.filter((g) => (g.waitsOnEarly || []).length).length;
    const row = [`${x.title} (${x.show} ${x.season})`, x.episodes, `${src.filter((s) => s === "research").length} / ${src.filter((s) => s === "stand-in").length}`, sure, ch.length - sure, x.replays.length, ok, over, early];
    lines.push(md ? `| ${row.join(" | ")} |` : row.join("  "));
  }
  console.log(lines.join("\n") || "no blind replays on file");
}

// ---------- the command line ----------

async function main() {
  const [cmd, ...argv] = process.argv.slice(2);
  const flags = Object.fromEntries(argv.filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v === undefined ? true : v]; }));
  const rest = argv.filter((a) => !a.startsWith("--"));
  if (cmd === "run") {
    const list = rest.length ? [[rest[0], Number(rest[1])]] : SEASONS;
    let bad = 0;
    for (const [show, season] of list) {
      const x = await run(show, season, flags);
      bad += x.replays.filter((g) => g.check.length).length;
    }
    process.exitCode = bad ? 1 : 0;
    return;
  }
  if (cmd === "games") {
    for (const g of await gamesFor(await loadedSeason(rest[0], Number(rest[1])), rest[0])) console.log(`${String(g.n).padStart(3)}. ${g.plays ? "plays" : "  -  "}  ${g.label}${g.plays ? ` (${g.playsAs})` : `: ${g.why}`}  [${g.rows.join(", ")}]`);
    return;
  }
  if (cmd === "sections") {
    const t = Study.loadTimeline(rest[0], Number(rest[1]));
    const f2 = FA.answersOf(rest[0], Number(rest[1]));
    // Whether the season has a merge, as its rulebook on tape says (a phase that ends the groups), as `run` reads its format's.
    const tape = require("./tapes").readTape(rest[0], Number(rest[1]));
    const blocks = (tape.season && tape.season.rulebook && tape.season.rulebook.blocks) || {};
    const hasMerge = ((blocks.season && blocks.season.phases) || []).some((ph) => (ph.changes || []).includes("groupsEnd"));
    for (const e of t.episodes) {
      const s = sectionFor(t, e.n, f2, { hasMerge });
      const x = s.section || {};
      const list = (v) => (Array.isArray(v) ? v : []);
      console.log(`E${e.n} ${s.from || "none"}: ${s.section ? `${x.playedAs}, ${list(x.groups).length} groups, ${list(x.alone).length} alone; changes ${list(x.changes).map((c) => `${c.kind} from ${c.from}`).join(", ") || "none"}${list(x.newcomers).length ? `; came in ${list(x.newcomers).map((y) => y.name).join(", ")}` : ""}${s.merged ? `; merged ${s.merged}` : ""}` : "-"}`);
    }
    return;
  }
  if (cmd === "summary") return summary(!!flags.md);
  if (cmd === "down") return console.log(`removed ${await H.down()}`);
  console.log("Usage: node scripts/dev-test/blind.js run|games|sections|summary|down [<show> <season>] (see the header comment)");
}

module.exports = { SEASONS, howIn, standIn, sectionFor, fixtureQuick, blindFull, answerFor, answersThisWeek, problemsOf, didLine, markdown };

if (require.main === module) {
  main()
    .then(async () => {
      await H.appCode().pool.end().catch(() => {});
      process.exit(process.exitCode || 0);
    })
    .catch(async (e) => {
      console.error(e && e.stack ? e.stack : e);
      await H.appCode().pool.end().catch(() => {});
      process.exit(1);
    });
}
