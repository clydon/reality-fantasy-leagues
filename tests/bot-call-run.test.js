// The bot's own call, asked (docs/PLAN-start-a-game-gpt.md step A14 part 2b; part 2's piece is tests/beat-bot.test.js): bot
// research's call run (db/call-research.js, db/bot-research.js planCalls and callJob) asks the bot for its call on each window of a
// game's questions against it before the window locks, and files each through db/bot-calls.js fileCalls. What it asks about at a lock
// (windowsToCall), the prompt (exactly what can be named, each question as players see it), the strict parse of its answer (each
// answer as its kind takes it, a name to its id only when it's exactly one offered) and when the run is due (callNext: before the
// lock, after the episode before it, retries, never once it's locked). The database's side is scripts/dev-test/check-bot-calls-run.js.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const CallResearch = require("../db/call-research.js");
const BotResearch = require("../db/bot-research.js");

const CTX = {
  moments: [{ id: "idolPlayed", label: "Played an idol", defaultPoints: 1, answeredBy: "research" }],
  results: true,
  winner: true,
  grouped: true,
};
const BOOT = { id: "boot", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" }, beat: { by: "bot" } };
const IDOL = { id: "idol", ask: "An idol played?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "happened" }, beat: { by: "bot" } };
const MANY = { id: "many", ask: "How many idols played?", answer: "number", points: 3, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "count" }, beat: { by: "bot" } };
const OVER = { id: "over", ask: "Idols played, over or under 1.5?", answer: "overUnder", line: 1.5, points: 1, asked: "each", settle: { by: "moment", moment: "idolPlayed", take: "count" }, beat: { by: "bot" } };
const TRIBE = { id: "tribe", ask: "Which tribe loses?", answer: "group", pick: 1, points: 1, asked: "each", settle: { by: "results", take: "out" }, beat: { by: "bot" } };
const WINNER = { id: "winner", ask: "Who wins?", answer: "person", points: 5, asked: "once", closes: "finale", settle: { by: "results", take: "winner" }, beat: { by: "bot" } };
const TWO = { id: "two", ask: "Who goes home? Pick two", answer: "person", pick: 2, points: 1, asked: "each", settle: { by: "results", take: "out" }, beat: { by: "bot" } };
const PLAIN = { id: "plain", ask: "Who goes home (no bot)?", answer: "person", points: 1, asked: "each", settle: { by: "results", take: "out" } };
const game = (ask) => ({ spec: 1, span: { from: 1, to: null }, get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" }, ask });
const HOUR = 3600 * 1000;
const MIN = 60 * 1000;

function league(spec, { n = 8, eps = 6 } = {}) {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "wikiSeason", 51);
  S.updateSettings(s, "leagueTypeId", G.madeAs(G.typeOf(spec)));
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  const kele = S.addTribe(s, "Kele", "#c00");
  const hina = S.addTribe(s, "Hina", "#00c");
  s.castaways.forEach((c, i) => {
    c.tribeId = i < n / 2 ? kele.id : hina.id;
  });
  s.players = ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const cid = (s, i) => s.castaways[i].id;
// No season's format timeline here (a group question on a season played in groups reads it: db/format-timeline.js).
const pool = { query: async () => ({ rows: [] }) };

test("what a lock asks about: the windows against the bot locking there, less those called; what each can name", async () => {
  const s = league(game([BOOT, IDOL, WINNER, TRIBE, PLAIN]));
  const now = Date.parse("2026-11-04T12:00:00Z");
  const at1 = await CallResearch.windowsToCall(pool, s, 1, { now });
  assert.deepEqual(at1.asked.map((a) => [a.id, a.window]), [["boot", 1], ["idol", 1], ["winner", 0], ["tribe", 1]], "the game's who wins at its first lock; never a question not against the bot");
  assert.equal(at1.asked[0].faces.length, 8);
  assert.equal(at1.asked[1].faces, null, "a yes or no names nobody");
  assert.deepEqual(at1.asked[3].faces.map((f) => f.name), ["Kele", "Hina"]);
  assert.equal(at1.cast.length, 8);
  const at2 = await CallResearch.windowsToCall(pool, s, 2, { now, skip: new Set(["boot|2"]) });
  assert.deepEqual(at2.asked.map((a) => a.id), ["idol", "tribe"], "a window called already is left out");
  // Episode 1's results: C5 goes home, so Episode 2's calls can't name them.
  S.addElimination(s, s.episodes[0].id, cid(s, 5), "Voted Out");
  const after = await CallResearch.windowsToCall(pool, s, 2, { now });
  assert.ok(!after.asked[0].faces.some((f) => f.id === cid(s, 5)) && !after.cast.some((c) => c.id === cid(s, 5)));
  assert.deepEqual((await CallResearch.windowsToCall(pool, s, 1, { now })).asked, [], "nothing once its episode has results");
  // Whether the episode before a lock is still without its results (back to back: its first tries wait for them).
  assert.equal(CallResearch.waitsForResults(s, 1), false, "the game's first episode has none before it");
  assert.equal(CallResearch.waitsForResults(s, 2), false, "Episode 1 has its results");
  assert.equal(CallResearch.waitsForResults(s, 3), true, "Episode 2 has none yet");
  assert.deepEqual((await CallResearch.windowsToCall(pool, s, 3, { now, airAt: new Date(now - HOUR).toISOString() })).asked, [], "nothing once it has aired");
});

test("a draft's own questions against the bot are called too; never its finale predictions", async () => {
  // An Outlast of two each with its own who goes home against the bot (C2 part 4c's draft questions: the run finds them through
  // AnswerLogic.questions, as the grade does), beside the finale predictions Start a game makes.
  const spec = { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" }, ask: [...G.finaleQuestions({ top3: 1, winner: 3, from: "any" }), BOOT], rank: { by: "total" } };
  assert.deepEqual(G.specProblems(spec, CTX), []);
  const s = S.migrateLeagueState({
    settings: { ...G.settingsOf(spec), showFormat: "survivor", setupComplete: true },
    players: ["ann", "bo"].map((id) => ({ id, name: id, color: "#000" })),
    draftOrder: ["ann", "bo"],
    tribes: [{ id: "t1", name: "Toka", color: "#111" }],
    castaways: Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, status: "active", tribeId: "t1", ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: Array.from({ length: 3 }, (_, i) => ({ id: `e${i + 1}`, number: i + 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} })),
  });
  const at1 = await CallResearch.windowsToCall(pool, s, 1, { now: 0 });
  assert.deepEqual(at1.asked.map((a) => [a.id, a.window]), [["boot", 1]]);
  assert.equal(at1.asked[0].faces.length, 6);
  assert.deepEqual((await CallResearch.windowsToCall(pool, s, 2, { now: 0 })).asked.map((a) => a.id), ["boot"]);
});

test("the prompt: the episode coming, who's still in by id, each question as players see it, what it's about and how to answer", async () => {
  const s = league(game([BOOT, IDOL, MANY, OVER, TRIBE, WINNER, TWO, { ...IDOL, id: "pick", ask: "An idol played? (a choice)", answer: "choice", options: ["Yes", "No"] }]));
  S.addElimination(s, s.episodes[0].id, cid(s, 5), "Voted Out");
  const { asked, cast } = await CallResearch.windowsToCall(pool, s, 2, { now: Date.parse("2026-11-04T12:00:00Z") });
  const p = CallResearch.buildCallPrompt({ showName: "Survivor", season: 51, episode: 2, airAt: "Wed, Nov 11, 8:00 PM ET", asked, cast, term: "castaways", state: s });
  assert.match(p, /Search the web for Survivor season 51\. Episode 1 is the latest to air; episode 2 hasn't aired yet\. It airs Wed, Nov 11, 8:00 PM ET\./);
  assert.match(p, /Never use anything about episode 2 or later that came out after it aired/);
  assert.match(p, new RegExp(`- ${cid(s, 0)}: C0\\n`));
  assert.ok(!p.includes(`${cid(s, 5)}: C5`), "nobody who's gone");
  assert.match(p, /- boot: Who goes home\? About episode 2\. Answer with the id of one person from the cast list above\./);
  assert.match(p, /- idol: An idol played\? About episode 2\. Answer with "yes" or "no"\./);
  assert.match(p, /- many: How many idols played\? About episode 2\. Answer with a whole number, 0 or more\./);
  assert.match(p, /- over: .* Answer with "over" or "under" 1\.5\./);
  assert.match(p, /- tribe: Which tribe loses\? About episode 2\. Answer with the id of one group from its list below\.\n {4}- [^:]+: Kele\n {4}- [^:]+: Hina/);
  assert.match(p, /- two: .* Answer with up to 2 ids from the cast list above, as a JSON list\./);
  assert.match(p, /- pick: An idol played\? \(a choice\)\. About episode 2\. Answer with one of: "Yes", "No"\./);
  assert.ok(!/- winner:/.test(p), "who wins is the game's first lock's, called already then");
  assert.match(p, /\{"episode": 2, "calls": \{"boot": \{"answer": "id", "why": "one line"\}, "idol": \{"answer": "yes"/);
  assert.match(p, /"pick": \{"answer": "Yes", "why": "one line"\}/, "a choice's example is one of its options");
  // The game's first lock: who wins, about the season as a whole; a run of episodes; a game's whole run.
  const first = await CallResearch.windowsToCall(pool, league(game([WINNER, BOOT])), 1, { now: 0 });
  const p1 = CallResearch.buildCallPrompt({ showName: "Survivor", season: 51, episode: 1, asked: first.asked, cast: first.cast, state: s });
  assert.match(p1, /Episode 1 hasn't aired yet\.\n/);
  assert.match(p1, /- winner: Who wins\? About the season as a whole \(it's settled at the finale\)\./);
  assert.equal(CallResearch.aboutWords(s, { asked: "each", over: 3 }, 4), "episodes 4 to 6");
  assert.equal(CallResearch.aboutWords(s, { asked: "every", every: 2 }, 3), "episodes 3 to 4");
  assert.equal(CallResearch.aboutWords(s, { asked: "once", closes: "start", settle: { by: "results", take: "out" } }, 1), "from episode 1 to the season's end (the game's whole run)");
});

test("the parse: strict JSON about the episode asked, each answer as its kind takes it", async () => {
  const s = league(game([BOOT, IDOL, MANY, OVER, TRIBE, TWO, { ...IDOL, id: "pick", ask: "An idol played? (a choice)", answer: "choice", options: ["Yes", "No"] }]));
  const { asked } = await CallResearch.windowsToCall(pool, s, 1, { now: 0 });
  const kele = asked.find((a) => a.id === "tribe").faces[0].id;
  const answer = (calls, episode = 1) => "Here you go:\n```json\n" + JSON.stringify({ episode, calls }) + "\n```";
  let r = CallResearch.parseCallAnswer(answer({
    boot: { answer: cid(s, 3), why: "On the bottom." },
    idol: { answer: "Yes" },
    many: { answer: "2" },
    over: { answer: "UNDER" },
    tribe: { answer: "kele" },
    two: { answer: ["nobody", "C2"] },
    pick: { answer: "yes" },
    extra: { answer: "x" },
  }), 1, asked);
  assert.equal(r.found, true);
  const by = Object.fromEntries(r.calls.map((c) => [c.question, c.answer]));
  assert.deepEqual(by, { boot: cid(s, 3), idol: "yes", many: 2, over: "under", tribe: kele, two: ["nobody", cid(s, 2)], pick: "Yes" }, "a name matched to its id (any case), an unknown id kept for the check to refuse");
  assert.equal(r.calls.find((c) => c.question === "boot").note, "On the bottom.");
  assert.equal(r.calls[0].episode, 1);
  assert.deepEqual(r.unknown, ["extra"]);
  assert.deepEqual(r.missing, []);
  // Booleans, a bare answer, a list of one on a pick of one, a missing one.
  r = CallResearch.parseCallAnswer(answer({ boot: [cid(s, 1)], idol: false, many: "lots" }), 1, asked);
  assert.deepEqual(r.calls.map((c) => [c.question, c.answer]), [["boot", cid(s, 1)], ["idol", "no"], ["many", "lots"]]);
  assert.deepEqual(r.missing, ["over", "tribe", "two", "pick"]);
  assert.equal(G.answerProblem(asked.find((a) => a.id === "many").q, "lots", null), "A number, 0 or more", "what can't be read is refused by fileCalls's check");
  // A number only from a number or a numeral: a list, a boolean or an empty string passed on for the check to refuse.
  for (const v of [[2], true, "", " "]) assert.deepEqual(CallResearch.coerce(MANY, null, v), v);
  assert.equal(CallResearch.coerce(MANY, null, " 4 "), 4);
  // Two castaways with one name: the name stays a name (refused), never a guess.
  const twins = [{ id: "a1", name: "Sam" }, { id: "a2", name: "Sam" }];
  assert.equal(CallResearch.coerce(BOOT, twins, "sam"), "sam");
  // Not found: no JSON, another episode, nothing called.
  assert.equal(CallResearch.parseCallAnswer("I can't help with that.", 1, asked).note, "No JSON in the answer");
  assert.match(CallResearch.parseCallAnswer(answer({ boot: { answer: cid(s, 1) } }, 2), 1, asked).note, /about episode 2, not 1/);
  r = CallResearch.parseCallAnswer(answer({ nope: { answer: "x" } }), 1, asked);
  assert.equal(r.found, false);
  assert.equal(r.missing.length, asked.length);
});

test("when the call run is due: hours before the lock, after the episode before it, retries, never once it's locked", () => {
  const nextTry = (d, t) => BotResearch.nextTryAt("call", d, t);
  const lock = Date.parse("2026-11-12T01:00:00Z");
  // A weekly show: CALL_BEFORE (6 hours) before it airs.
  let r = CallResearch.callNext({ lockAt: lock, prevEnd: lock - 7 * 24 * HOUR + 2 * HOUR, nextTry });
  assert.equal(r.at.getTime(), lock - CallResearch.CALL_BEFORE * MIN);
  assert.equal(r.next.getTime(), r.at.getTime());
  // The episode before it ends 4 hours before: an hour after it ends (its results), not 6 hours before.
  r = CallResearch.callNext({ lockAt: lock, prevEnd: lock - 4 * HOUR, nextTry });
  assert.equal(r.at.getTime(), lock - 3 * HOUR);
  // Back to back (a nightly show's next starts as this one ends, a binge drop): no later than CALL_LAST before the lock.
  r = CallResearch.callNext({ lockAt: lock, prevEnd: lock, nextTry });
  assert.equal(r.at.getTime(), lock - CallResearch.CALL_LAST * MIN);
  // A failed try: the next 20 minutes on; three failed: never; a try still running holds it.
  const due = lock - 6 * HOUR;
  r = CallResearch.callNext({ lockAt: lock, tries: [{ started_at: new Date(due).toISOString(), ok: false }], nextTry });
  assert.equal(r.next.getTime(), due + 20 * MIN);
  const three = [0, 20, 40].map((m) => ({ started_at: new Date(due + m * MIN).toISOString(), ok: false }));
  assert.equal(CallResearch.callNext({ lockAt: lock, tries: three, nextTry }), null);
  assert.equal(CallResearch.callNext({ lockAt: lock, tries: [{ started_at: new Date(due).toISOString(), ok: true }], nextTry }), null, "done once one worked");
  // A retry that would land at or after the lock: never (the window plays its fallback).
  const late = lock - CallResearch.CALL_LAST * MIN;
  r = CallResearch.callNext({ lockAt: lock, prevEnd: lock, tries: [{ started_at: new Date(late + 41 * MIN).toISOString(), ok: false }], nextTry });
  assert.equal(r, null);
  assert.equal(CallResearch.callNext({ lockAt: NaN, nextTry }), null, "no air time known: no run");
});
