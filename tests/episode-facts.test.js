// Episode facts (docs/PLAN-start-a-game-gpt.md step A13 part 2: the dial rows what.quote and settle.facts, the request s28 "Each
// episode, guess who says the episode's title quote"): a question settled by a fact research answers about each episode, in its
// stored answer's episodeFacts section (db/episode-research.js; formats/episode-facts.js reads it), `settle: { by: 'fact', fact:
// 'titleQuote', take: 'who' }`. The section's loose read and what each answer says once its person is found in the cast; how a fact
// is rated from what research returned on a show (the season tapes' measure and the show's stored episodes) and the bar our check
// takes it at; the question's shape and the data rule; its words; grading at a viewer's mark; each fallback from the start (research
// not sure, the title not a line, someone nobody could pick said it, its answer stored without the fact: void, no points either
// way; its answer not stored yet, or no facts read at all: waiting); a group answer; a life riding on it; the research section in the prompt and the
// schema, and a second pass filling in. The server's reads (episode-facts.ts) are proven by scripts/dev-test/check-episode-facts.js.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const F = require("../src/lib/game/formats/episode-facts.js");
const { describeSpec } = require("../src/lib/game/game-spec/describe.js");

const A = S.AnswerLogic;
const ats = (problems) => problems.map((p) => p.at);

const CTX = { moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }], results: true, winner: true, roles: [], grouped: true };
/** Who says the title quote, before each episode, a point if you're right (the tracker's s28). */
const QUOTE = { id: "quote", ask: "Who says the title quote?", answer: "person", points: 1, asked: "each", settle: { by: "fact", fact: "titleQuote", take: "who" } };
const TRIBE = { ...QUOTE, id: "tribe", ask: "Which tribe does the title quote come from?", answer: "group" };
const game = (ask, score = {}, extra = {}) => ({ spec: 1, span: { from: 1, to: null }, get: { by: "none" }, score: { by: "answers", ...score }, rank: { by: "total" }, ask, ...extra });

/** A game of questions on Survivor with castaways C0.. (two tribes, Kele and Hina, half each) and seats ann, bo and cy. */
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
  s.players = ["ann", "bo", "cy"].map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: CTX }), []);
  for (let k = 1; k <= eps; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const cid = (s, i) => s.castaways[i].id;
const ep = (s, n) => s.episodes.find((e) => e.number === n);
/** Episode n's results: castaway `i` voted out. */
const boot = (s, n, i) => S.addElimination(s, ep(s, n).id, cid(s, i), "Voted Out");
/** A title quote as research reports it. */
const tq = (by, o = {}) => ({ titleQuote: { isQuote: "yes", line: "a line", by, sure: "high", ...o } });
/** The server's read (episode-facts.ts episodeFactsFor) of sections by episode: { 2: section }, people found in `s`'s cast. */
const factsMap = (s, sections) =>
  new Map(Object.entries(sections).map(([n, sec]) => [Number(n), { titleQuote: F.outcomeOf(F.looseEpisodeFacts(sec), "titleQuote", s.castaways) || { state: "unsure", why: "Research didn't say" } }]));
const factsOf = (s, episodeFacts) => ({ ...A.facts(s), ...(episodeFacts ? { episodeFacts } : {}) });
const said = (n, by, question = "quote") => Object.entries(by).map(([playerId, answer]) => ({ playerId, question, episode: n, answer }));

test("the section read loosely: missing is not asked, a bad value repaired and said, never a failed run", () => {
  assert.equal(F.looseEpisodeFacts(undefined), null);
  assert.equal(F.looseEpisodeFacts(null), null);
  const repairs = [];
  assert.equal(F.looseEpisodeFacts("Rizo", repairs), null);
  assert.equal(repairs.length, 1);
  assert.deepEqual(F.looseEpisodeFacts({}), { titleQuote: null }, "a section without the fact: not answered");
  assert.deepEqual(F.looseEpisodeFacts({ titleQuote: { isQuote: true, line: " I'm a wolf ", by: "Sage", sure: "HIGH" } }), { titleQuote: { isQuote: "yes", line: "I'm a wolf", by: "Sage", sure: "high" } });
  const r2 = [];
  assert.deepEqual(F.looseEpisodeFacts({ titleQuote: { isQuote: "maybe", by: "", sure: "very" } }, r2), { titleQuote: { isQuote: "unknown", line: null, by: null, sure: "low" } });
  assert.equal(r2.length, 2, "both repairs said");
  assert.deepEqual(F.looseEpisodeFacts({ titleQuote: { isQuote: false } }).titleQuote, { isQuote: "no", line: null, by: null, sure: "low" }, "false is no; no sure said is low");
});

test("what an answer says once its person is found in the cast: who, someone outside it, not a line, or not sure", () => {
  const cast = [{ id: "a", name: 'Kimberly "Kilby" Kilbourne' }, { id: "b", name: "Jeff" }, { id: "c", name: "Rizo Velovic" }, { id: "d", name: "Matt A" }, { id: "e", name: "Matt B" }];
  // Strictly: the same name (case, accents and punctuation aside), never a castaway whose name merely has its words, nor one whose
  // whole name is one of its words.
  assert.equal(F.personIn(cast, "rizo velovic"), "c");
  assert.equal(F.personIn([{ id: "x", name: "José Ñuñez" }], "Jose Nunez"), "x");
  assert.equal(F.personIn(cast, "Kilby"), null, "a shortened name isn't sure");
  assert.equal(F.personIn(cast, "Jeff Probst"), null, "the host isn't the castaway called Jeff");
  assert.equal(F.personIn([{ id: "k", name: "Kelly Wentworth" }], "Kelly"), null, "a castaway's sister Kelly isn't Kelly Wentworth");
  assert.equal(F.personIn(cast, "Jeff"), "b");
  assert.equal(F.personIn(cast, ""), null);
  // Loosely (the proof's scoring, against truth in first names): the one person with every word of it.
  assert.equal(F.personIn(cast, "Kilby", true), "a");
  assert.equal(F.personIn(cast, "Matt", true), null, "two Matts: nobody");
  const o = (sec) => F.outcomeOf(F.looseEpisodeFacts(sec), "titleQuote", cast);
  assert.deepEqual(o(tq("Rizo Velovic")), { state: "who", who: "c", name: "Rizo Velovic" });
  assert.deepEqual(o(tq("Rizo")), { state: "outside", name: "Rizo" }, "a shortened name: nobody you could pick, so void");
  assert.deepEqual(o(tq("Jeff Probst")), { state: "outside", name: "Jeff Probst" });
  assert.deepEqual(o({ titleQuote: { isQuote: "no", sure: "high" } }), { state: "none" });
  assert.equal(o({ titleQuote: { isQuote: "no", sure: "low" } }).state, "unsure", "not sure it isn't a line");
  assert.equal(o({ titleQuote: { isQuote: "unknown", sure: "high" } }).state, "unsure");
  assert.equal(o(tq(null)).state, "unsure", "a line, but nobody named");
  assert.match(o(tq("Rizo", { sure: "low" })).why, /wasn't sure who says the title quote \(it said Rizo\)/);
  assert.equal(o({ titleQuote: null }), null, "not answered");
  assert.equal(o(null), null);
  assert.equal(F.outcomeOf(F.looseEpisodeFacts(tq("Rizo")), "rain", cast), null, "not a fact research answers");
});

test("a fact's rating, from what research returned on the show: the tapes' measure plus its stored episodes, at the bar", () => {
  // The measure: the episodes it was asked on, and those it settled a pick on (sure of someone in the cast, by their name there, as
  // the grader reads it); the host, a shortened name, not a line or unsure settle nothing.
  const cast = [{ id: "r", name: "Rizo Velovic" }, { id: "s", name: "Sage Ahrens-Nichols" }];
  const sections = [tq("Rizo Velovic"), tq("Sage Ahrens-Nichols"), tq("Rizo"), tq("Jeff Probst"), { titleQuote: { isQuote: "no", sure: "high" } }, tq("Sage Ahrens-Nichols", { sure: "low" }), null, { titleQuote: null }];
  assert.deepEqual(F.measure(sections.map((x) => ({ section: F.looseEpisodeFacts(x), cast })), "titleQuote"), { asked: 6, settled: 2 });
  // Rated once asked on MEASURED episodes or more: reliable from 90%, usually from 70%, else patchy.
  assert.equal(F.MEASURED, 6);
  assert.deepEqual(F.ratingOf({ asked: 5, settled: 5 }), { rating: null, asked: 5, settled: 5 });
  assert.equal(F.ratingOf({ asked: 10, settled: 9 }).rating, "reliable");
  assert.equal(F.ratingOf({ asked: 10, settled: 8 }).rating, "usually");
  assert.equal(F.ratingOf({ asked: 10, settled: 6 }).rating, "patchy");
  assert.equal(F.ratingOf({ asked: 6, settled: 9 }).settled, 6, "never more settled than asked");
  assert.equal(F.ratingOf(undefined).rating, null);
  // The tapes' measure (fact-measures.json) is added to the show's own: a show with neither isn't rated.
  assert.deepEqual(F.entryFor("no-such-show", "titleQuote", { asked: 3, settled: 2 }), { asked: 3, settled: 2 });
  assert.deepEqual(F.entryFor("no-such-show", "titleQuote"), { asked: 0, settled: 0 });
  // Our check's words, and the bar (reliable only until the user says usually too).
  assert.deepEqual(F.BAR, ["reliable"]);
  assert.equal(F.factProblem("titleQuote", { asked: 10, settled: 10 }), null);
  assert.match(F.factProblem("titleQuote", { asked: 10, settled: 8 }), /for sure on 8 of the 10 episodes it was asked on this show: not reliably enough/);
  assert.match(F.factProblem("titleQuote", { asked: 2, settled: 2 }), /on 2 of this show's episodes, not yet the 6 it takes/);
  assert.match(F.factProblem("titleQuote", {}), /hasn't been asked who says the episode's title quote on this show yet/);
  assert.equal(F.factProblem("rain", {}), null, "an unknown fact is the shape's to refuse");
});

test("a fact question's shape: about each episode, a person or a group, settled by a fact research answers; what's refused", () => {
  const at = (q, score, ctx = CTX) => ats(G.specProblems(game([q], score), ctx));
  assert.deepEqual(at(QUOTE), []);
  assert.deepEqual(at(TRIBE), [], "a group answer: the group whoever said it was on");
  assert.equal(G.typeOf(game([QUOTE])), "questions", "a game of questions");
  assert.deepEqual(G.specWaitsFor(game([QUOTE])), [], "nothing it needs is still to build");
  assert.equal(G.isFact(QUOTE), true);
  assert.equal(G.isFact({ ...QUOTE, settle: { by: "results", take: "out" } }), false);
  assert.deepEqual(at({ ...QUOTE, asked: undefined }), ["ask[0].asked"], "an episode's fact: asked each episode");
  assert.deepEqual(at({ ...QUOTE, asked: "every", every: 2 }), ["ask[0].asked"]);
  assert.deepEqual(at({ ...QUOTE, over: 2 }), ["ask[0].asked"], "about the one episode, not a run");
  assert.deepEqual(at({ ...QUOTE, settle: { by: "fact", fact: "rain", take: "who" } }), ["ask[0].settle.fact"], "a fact research answers");
  assert.deepEqual(at({ ...QUOTE, settle: { by: "fact", take: "who" } }), ["ask[0].settle.fact"]);
  assert.deepEqual(at({ ...QUOTE, settle: { by: "fact", fact: "titleQuote", take: "count" } }), ["ask[0].settle.take"]);
  assert.deepEqual(at({ ...QUOTE, settle: { by: "moment", moment: "individualImmunity", take: "who", fact: "titleQuote" } }), ["ask[0].settle.fact"], "only a fact settles by a fact");
  assert.deepEqual(at({ ...QUOTE, answer: "yesNo" }), ["ask[0].settle"], "a yes or no isn't who");
  assert.deepEqual(at({ ...QUOTE, each: "person", answer: "yesNo" }), ["ask[0].settle"], "not a question about each person");
  assert.deepEqual(at({ ...QUOTE, asked: "once", closes: "finale" }), ["ask[0].asked", "ask[0].closes"]);
  // A9's ways of combining, a pick of two, a wager on it: as any person question.
  assert.deepEqual(at({ ...QUOTE, share: "split" }), []);
  assert.deepEqual(at({ ...QUOTE, rollover: true }), []);
  assert.deepEqual(at({ ...QUOTE, pick: 2 }), []);
  assert.deepEqual(at({ ...QUOTE, wager: 2 }), []);
});

test("the data rule: a fact only where research says it reliably on the show (ctx.facts); left out, not checked", () => {
  const at = (ctx) => ats(G.specProblems(game([QUOTE]), ctx));
  assert.deepEqual(at(CTX), [], "a reader that didn't say");
  assert.deepEqual(at({ ...CTX, facts: { titleQuote: { asked: 10, settled: 10 } } }), []);
  assert.deepEqual(at({ ...CTX, facts: { titleQuote: { asked: 10, settled: 8 } } }), ["ask[0].settle.fact"], "usually isn't the bar");
  assert.deepEqual(at({ ...CTX, facts: { titleQuote: { asked: 3, settled: 3 } } }), ["ask[0].settle.fact"], "not asked enough to know");
  assert.deepEqual(at({ ...CTX, facts: {} }), ["ask[0].settle.fact"], "never asked on the show");
  const p = G.specProblems(game([QUOTE]), { ...CTX, facts: { titleQuote: { asked: 10, settled: 4 } } })[0].problem;
  assert.match(p, /for sure on 4 of the 10 episodes/);
});

test("a fact question in words: before each episode, a point if you're right, and its fallback", () => {
  const all = JSON.stringify(describeSpec(game([QUOTE]), CTX));
  assert.match(all, /Before each episode: Who says the title quote\? 1 point if you're right\. If research can't say for sure, or it's nobody you could pick, it doesn't count either way\./);
});

test("graded once its episode has results, at each viewer's mark: right is who research is sure said it", () => {
  const s = league(game([QUOTE]));
  const rows = said(2, { ann: cid(s, 3), bo: cid(s, 4) });
  const facts = factsMap(s, { 2: tq("C3") });
  boot(s, 1, 0);
  // Research may have answered, but Episode 2 has no results: it waits.
  let g = A.grade(s, rows, factsOf(s, facts));
  assert.equal(g.verdicts.get("quote|2").state, "waiting");
  boot(s, 2, 1);
  g = A.grade(s, rows, factsOf(s, facts));
  const v = g.verdicts.get("quote|2");
  assert.equal(v.state, "known");
  assert.deepEqual(v.right, [cid(s, 3)]);
  assert.deepEqual(Object.fromEntries(g.points), { ann: 1 });
  // Someone who hasn't seen Episode 2: it waits for them (spoiler-safe).
  const behind = S.GhostLogic.viewFor(s, null, 1);
  assert.equal(A.grade(behind, rows, factsOf(behind, facts)).verdicts.get("quote|2").state, "waiting");
  // What was known through Episode 1 (a walk's step) has no answer for 2 yet.
  const f1 = G.factsThrough(factsOf(s, facts), 1);
  assert.equal(f1.episodeFacts.has(2), false);
  assert.equal(G.verdictOf(QUOTE, 2, f1).state, "waiting");
  // No facts read at all (a reader that isn't the server's): waiting.
  assert.equal(A.grade(s, rows, factsOf(s, undefined)).verdicts.get("quote|2").state, "waiting");
  // Two picks: each one right scores.
  const s2 = league(game([{ ...QUOTE, pick: 2, points: 2 }]));
  boot(s2, 1, 0);
  boot(s2, 2, 1);
  assert.equal(A.grade(s2, said(2, { ann: [cid(s2, 3), cid(s2, 5)] }), factsOf(s2, factsMap(s2, { 2: tq("C3") }))).points.get("ann"), 2);
});

test("its fallbacks, from the start: void when research isn't sure, the title isn't a line, or nobody you could pick said it", () => {
  const s = league(game([QUOTE]));
  [0, 1, 2, 3, 4].forEach((i, k) => boot(s, k + 1, i));
  const rows = [1, 2, 3, 4, 5].flatMap((n) => said(n, { ann: cid(s, 6), bo: cid(s, 7) }));
  const verdict = (sections, n, over = false) => {
    const f = factsOf(s, factsMap(s, sections));
    return G.verdictOf(QUOTE, n, over ? { ...f, over: true } : f);
  };
  // Research wasn't sure who: void, no points either way.
  let v = verdict({ 1: tq("C6", { sure: "low" }) }, 1);
  assert.equal(v.state, "off");
  assert.match(v.why, /wasn't sure who says the title quote \(it said C6\): it doesn't count either way/);
  assert.equal(verdict({ 1: tq(null) }, 1).state, "off");
  assert.equal(verdict({ 1: { titleQuote: { isQuote: "unknown", sure: "low" } } }, 1).state, "off");
  // The title isn't a line from the episode.
  assert.equal(verdict({ 1: { titleQuote: { isQuote: "no", sure: "high" } } }, 1).why, "The title isn't a line from the episode: it doesn't count either way");
  // The host said it: nobody could pick them.
  assert.match(verdict({ 1: tq("Jeff Probst") }, 1).why, /^Jeff Probst said it, who wasn't one to pick/);
  // Someone already out of the game (a juror): nobody could pick them either.
  assert.match(verdict({ 3: tq("C0") }, 3).why, /^C0 said it, who wasn't one to pick/);
  // Research's answer came without the fact, or without the section at all (asked before it was): research didn't say.
  assert.equal(verdict({ 1: { titleQuote: null } }, 1).why, "Research didn't say: it doesn't count either way");
  assert.equal(verdict({ 2: null }, 2).why, "Research didn't say: it doesn't count either way");
  // Research's answer not stored yet (the full run comes after the early results): waiting, at the game's last episode too (its
  // results end the game; research comes the next day); void once research for a later episode the viewer has seen is stored (its
  // run for this one came to nothing), never for one they haven't.
  assert.equal(verdict({}, 2).state, "waiting");
  assert.equal(verdict({}, 2, true).state, "waiting");
  assert.equal(verdict({ 3: tq("C6") }, 2).why, "Research didn't say: it doesn't count either way");
  const behind = S.GhostLogic.viewFor(s, null, 2);
  assert.equal(G.verdictOf(QUOTE, 2, factsOf(behind, factsMap(s, { 3: tq("C6") }))).state, "waiting", "Episode 3 not seen: nothing about it shows");
  // Graded through: none of it scores, and a right one beside it does.
  const g = A.grade(s, rows, factsOf(s, factsMap(s, { 1: tq("Jeff Probst"), 2: tq("C6"), 3: { titleQuote: { isQuote: "no", sure: "high" } } })));
  assert.deepEqual(Object.fromEntries(g.points), { ann: 1 });
  assert.equal(g.verdicts.get("quote|4").state, "waiting", "Episode 4: no answer yet, and none after it");
});

test("a group answer: the group whoever said it was on in the episode", () => {
  const s = league(game([TRIBE]));
  const [kele, hina] = s.tribes.map((t) => t.id);
  boot(s, 1, 0);
  const rows = said(1, { ann: kele, bo: hina }, "tribe");
  const g = A.grade(s, rows, factsOf(s, factsMap(s, { 1: tq("C5") })));
  assert.deepEqual(g.verdicts.get("tribe|1").groups, [hina]);
  assert.deepEqual(Object.fromEntries(g.points), { bo: 1 });
});

test("a life riding on it: a wrong pick costs one; a void episode costs nothing", () => {
  const s = league(game([QUOTE], { lives: 2 }, { rank: { by: "standing" } }));
  [0, 1, 2].forEach((i, k) => boot(s, k + 1, i));
  // Episode 1: C5 said it (ann right, bo wrong); Episode 2: research unsure (void); Episode 3: C6 (bo wrong again).
  const rows = said(1, { ann: cid(s, 5), bo: cid(s, 4) }).concat(said(2, { ann: cid(s, 4), bo: cid(s, 4) }), said(3, { ann: cid(s, 6), bo: cid(s, 3) }));
  const w = A.walk(s, rows, factsOf(s, factsMap(s, { 1: tq("C5"), 2: tq("C4", { sure: "low" }), 3: tq("C6") })));
  assert.equal(w.lives.ann, 2, "right, void, right");
  assert.equal(w.lives.bo, 0);
  assert.equal(w.out.bo, 3, "out after two wrong picks: the void one cost nothing");
});

test("the research section: every show's research asks it beside the format section, its skeleton, and a second pass filling in", () => {
  require("./harness/fake-research-db.js").stubEmbeddings();
  const Research = require("../db/episode-research.js");
  const format = require("../src/lib/game/formats/index.js").formatFor("survivor");
  const shape = Research.researchSchemaFor(format, false).shape;
  assert.ok(shape.episodeFacts, "asked");
  assert.ok(shape.formatState);
  // A cut-down ask (some of the checklist) leaves it out, as it does the format section.
  assert.equal(Research.researchSchemaFor({ ...format, asksFormat: false }, false).shape.episodeFacts, undefined);
  // An answer from before it was asked: none, never a failed run.
  const schema = Research.researchSchemaFor(format, false);
  const skeleton = Research.pasteSkeleton({ format, castNames: ["Rizo", "Sage"], groupWord: null }, []);
  assert.deepEqual(skeleton.episodeFacts, { titleQuote: { isQuote: "unknown", line: null, by: null, sure: "low" } }, "its fields at their don't-know values");
  const without = { ...skeleton };
  delete without.episodeFacts;
  assert.equal(Research.parseJsonAnswer(JSON.stringify(without), schema, "x").episodeFacts, null);
  const odd = { ...skeleton, episodeFacts: { titleQuote: { isQuote: "Yes", line: "I'm a wolf", by: "Sage", sure: "certain" } } };
  const parsed = Research.parseJsonAnswer(JSON.stringify(odd), schema, "x");
  assert.deepEqual(parsed.episodeFacts.titleQuote, { isQuote: "yes", line: "I'm a wolf", by: "Sage", sure: "low" });
  assert.ok(parsed.repairs.some((r) => /titleQuote\.sure "certain"/.test(r)));
  // A second pass doesn't replace what the first was sure of with what it isn't, and fills what the first couldn't say.
  const sure = { titleQuote: { isQuote: "yes", line: "x", by: "Sage", sure: "high" } };
  const unsure = { titleQuote: { isQuote: "unknown", line: null, by: null, sure: "low" } };
  assert.deepEqual(F.fillFacts(sure, unsure), sure);
  assert.deepEqual(F.fillFacts(unsure, sure), sure);
  assert.deepEqual(F.fillFacts(sure, { titleQuote: null }), sure);
  assert.deepEqual(F.fillFacts(sure, { titleQuote: { ...sure.titleQuote, by: "Rizo" } }).titleQuote.by, "Rizo", "a sure correction replaces it");
});

test("part 2b: a fact research isn't sure of waits from the episode's airing until its final results, then stands (void)", () => {
  const final = Date.parse("2026-10-22T16:00:00Z");
  const unsure = { state: "unsure", why: "Research wasn't sure who says the title quote (it said C6)" };
  // Before the final results: pending (the morning's runs, the facts run among them, may settle it); after them, or with no time
  // to go by, it stands.
  assert.deepEqual(F.pendingUntil(unsure, final, final - 1), { state: "pending", why: unsure.why });
  assert.deepEqual(F.pendingUntil(unsure, final, final), unsure);
  assert.deepEqual(F.pendingUntil(unsure, null, final - 1), unsure);
  // From its airing: research about an episode the clock says hasn't aired (a replay's copy, a test) stands, as it can't live.
  assert.deepEqual(F.pendingUntil(unsure, final, final - 1, final - 10), { state: "pending", why: unsure.why });
  assert.deepEqual(F.pendingUntil(unsure, final, final - 20, final - 10), unsure);
  // Anything research was sure of is as it is.
  for (const o of [{ state: "who", who: "c1", name: "C1" }, { state: "outside", name: "Jeff Probst" }, { state: "none" }]) assert.deepEqual(F.pendingUntil(o, final, final - 1), o);
  // The grader: pending is waiting (no points either way yet, nothing walked past it); once it stands, void.
  const s = league(game([QUOTE]));
  boot(s, 1, 0);
  const at = (o) => G.verdictOf(QUOTE, 1, factsOf(s, new Map([[1, { titleQuote: o }]])));
  assert.equal(at(F.pendingUntil(unsure, final, final - 1)).state, "waiting");
  assert.equal(at(F.pendingUntil(unsure, final, final)).state, "off");
  const g = A.grade(s, said(1, { ann: cid(s, 6) }), factsOf(s, new Map([[1, { titleQuote: { state: "pending", why: unsure.why } }]])));
  assert.equal(g.verdicts.get("quote|1").state, "waiting");
  assert.deepEqual(Object.fromEntries(g.points), {});
});
