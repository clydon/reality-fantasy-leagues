// A season's own added moments (docs/PLAN-start-a-game-gpt.md step G1 part 4: formats/added-moments.js, db/moments-research.js,
// answers.js's void): what an added moment is in a rulebook (a moment added by hand with addedFrom, research's, a yes or no of its
// own) and that the rulebook compiles it into research's checklist and a rule worth 0; how a stored answer stands on one; the short
// ask's prompt, its answer read loosely, and how it's filed (a second pass fills in, never over what research said); the full
// run's second pass on a stand-in database and bot; our check taking a game on it once it's in the ctx; and the grader's void. The
// route and the run through the app are proven by scripts/dev-test/check-added-moments.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const Added = require("../src/lib/game/formats/added-moments.js");
const MR = require("../db/moments-research.js");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
const { blocksProblems } = require("../src/lib/game/formats/rulebook-schema.js");
const { momentsFor } = require("../src/lib/game/formats/rulebook-moments.js");
const { compileRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const G = require("../src/lib/game/game-spec/index.js");

const CRIED = { id: "cried", label: "Cried", question: "This episode, who cried?", counted: "yesNo", answeredBy: "research", reliability: "usually", addedFrom: 4 };
const SURVIVOR = BUILT_IN_BLOCKS.survivor.blocks;
const withCried = (b = SURVIVOR, m = CRIED) => ({ ...JSON.parse(JSON.stringify(b)), customMoments: [...(b.customMoments || []), m] });

test("an added moment in a rulebook: checked, built as research's, compiled into the checklist and a rule worth 0", () => {
  const blocks = withCried();
  assert.deepEqual(blocksProblems(blocks), []);
  assert.deepEqual(Added.addedOf(blocks), [{ id: "cried", label: "Cried", question: "This episode, who cried?", from: 4 }]);
  const m = momentsFor(blocks).find((x) => x.id === "cried");
  assert.equal(m.answeredBy, "research");
  assert.equal(m.addedFrom, 4);
  assert.equal(m.defaultPoints, 0, "worth nothing in the rulebook: no game scores it but one that names it");
  const { data, problems } = compileRulebook(blocks, { aliases: BUILT_IN_BLOCKS.survivor.aliases || {} });
  assert.deepEqual(problems, []);
  const field = data.research.checklist.find((f) => f.key === "cried");
  assert.ok(field && field.type === "answer", "the full run's checklist asks it of each person");
  assert.ok(data.rules.research.some((r) => r.award === "cried"), "a yes awards it");
  // Refused: not an episode number; not a yes or no of research's own.
  const bad = (x) => blocksProblems(withCried(undefined, { ...CRIED, ...x })).map((p) => p.at);
  assert.ok(bad({ addedFrom: 0 }).some((a) => /addedFrom/.test(a)));
  assert.ok(bad({ addedFrom: "4" }).some((a) => /addedFrom/.test(a)));
  assert.ok(bad({ answeredBy: "league" }).some((a) => /addedFrom/.test(a)));
  assert.ok(bad({ counted: "eachTime" }).some((a) => /addedFrom/.test(a)));
  // A moment added by hand without it isn't a season's added moment (Make it ours, What scores).
  assert.deepEqual(Added.addedOf(withCried(undefined, { ...CRIED, addedFrom: undefined })), []);
});

test("how a stored answer stands on one: yes with who, no from everyone, else unsure; what the run asks", () => {
  const people = (...v) => v.map((x, i) => ({ name: `P${i + 1}`, cried: x }));
  assert.deepEqual(Added.standingOf(people("no", "yes", "unknown"), "cried"), { state: "yes", who: ["P2"] });
  assert.deepEqual(Added.standingOf(people("no", "no"), "cried"), { state: "no" });
  assert.deepEqual(Added.standingOf(people("no", "unknown"), "cried"), { state: "unsure" });
  assert.deepEqual(Added.standingOf([{ name: "P1" }], "cried"), { state: "unsure" }, "not asked (an answer from before it was added)");
  assert.deepEqual(Added.standingOf([], "cried"), { state: "unsure" });
  assert.deepEqual(Added.standingOf(people("no", "unknown"), "cried", ["P1"]), { state: "no" }, "only who was in");
  const moments = Added.addedOf(withCried());
  assert.deepEqual(Added.unsureIn(people("no", "unknown"), moments, 3), [], "before it was added: never asked");
  assert.deepEqual(Added.unsureIn(people("no", "unknown"), moments, 4).map((m) => m.id), ["cried"]);
  assert.deepEqual(Added.unsureIn(people("no", "no"), moments, 5), []);
});

test("filing the run's answer: a sure yes names who (the rest no), a sure no is everyone's; never over what research said", () => {
  const stored = [{ name: "Ann", cried: "unknown" }, { name: "Bo" }, { name: "Cy", cried: "no" }, { name: "Di", cried: "yes" }];
  let out = Added.fillMoments(stored, { cried: { happened: "yes", who: ["Bo", "Cy"], sure: "high" } });
  assert.deepEqual(out.castaways.map((c) => c.cried), ["no", "yes", "no", "yes"], "Cy's no and Di's yes stay research's");
  assert.deepEqual(out.changed, ["cried"]);
  assert.equal(stored[1].cried, undefined, "a copy");
  out = Added.fillMoments(stored, { cried: { happened: "no", who: [], sure: "high" } });
  assert.deepEqual(out.castaways.map((c) => c.cried), ["no", "no", "no", "yes"]);
  // Not sure, not known, nobody on the list, or only people research said no for (it disagrees: left unsure, never everyone's no).
  for (const a of [{ happened: "yes", who: ["Bo"], sure: "low" }, { happened: "unknown", who: [], sure: "high" }, { happened: "yes", who: ["Nobody"], sure: "high" }, { happened: "yes", who: ["Cy"], sure: "high" }]) {
    out = Added.fillMoments(stored, { cried: a });
    assert.deepEqual(out.changed, [], JSON.stringify(a));
  }
});

test("the short ask: its prompt, its answer read loosely, its line", () => {
  const moments = Added.addedOf(withCried());
  const p = MR.buildMomentsPrompt({ showName: "Survivor", season: 50, episode: 5, title: "Hot Tub", cast: ["Ann Lee", "Bo Ray"], term: "castaways", moments });
  assert.match(p, /Survivor season 50, episode 5, titled "Hot Tub"/);
  assert.match(p, /1\. cried: This episode, who cried\?/);
  assert.match(p, /1\. Ann Lee\n2\. Bo Ray/);
  assert.match(p, /"cried": \{"happened": "unknown", "who": \[\], "sure": "low", "source": null\}/);
  assert.match(p, /a recap not mentioning something isn't a no/);
  assert.equal(MR.questionOf({ id: "x", label: "Hooked up" }), "This episode, who hooked up?");
  const answer = 'Here:\n```json\n{"episodeTitle": "Hot Tub", "moments": {"cried": {"happened": "YES", "who": ["ann lee", "Zed"], "sure": "high", "source": "https://x"}, "other": {}}}\n```';
  const r = MR.parseMomentsAnswer(answer, ["cried"], ["Ann Lee", "Bo Ray"]);
  assert.equal(r.found, true);
  assert.deepEqual(r.moments, { cried: { happened: "yes", who: ["Ann Lee"], sure: "high", source: "https://x" } });
  assert.deepEqual(r.repairs, ['cried: "Zed" isn\'t on the list']);
  assert.equal(r.episodeTitle, "Hot Tub");
  assert.deepEqual(MR.parseMomentsAnswer('{"cried": {"happened": "maybe", "who": "Bo Ray"}}', ["cried"], ["Bo Ray"]).moments, { cried: { happened: "unknown", who: [], sure: "low", source: null } }, "a bad value is unknown; entries at the top");
  assert.equal(MR.parseMomentsAnswer("{}", ["cried"]).found, false);
  assert.throws(() => MR.parseMomentsAnswer("no json here", ["cried"]));
  assert.equal(MR.momentsLine(r.moments, { cried: "Cried" }), "Cried: Ann Lee, sure");
  assert.equal(MR.momentsLine({ cried: { happened: "yes", who: ["A"], sure: "low" } }), "cried: still not sure");
});

/** A stand-in pool for askUnsure: the episode's row (its stored answer's people, the season's blocks), and what was written. */
function fakePool({ castaways, blocks = withCried(), title = "Hot Tub" }) {
  const db = { castaways, written: null };
  const client = {
    async query(sql, params) {
      if (/^SELECT id, payload->'castaways'/.test(sql)) return { rows: [{ id: "r1", castaways: db.castaways }] };
      if (/^UPDATE episode_research/.test(sql)) db.written = JSON.parse(params[1]);
      return { rows: [] };
    },
    release() {},
  };
  db.pool = {
    async query() {
      return { rows: [{ name: "Survivor", castaway_term: "castaway", castaway_plural: "castaways", show_id: "survivor", season_number: 50, blocks, research_id: "r1", castaways: db.castaways, title, listed: null, cast_names: [] }] };
    },
    async connect() {
      return client;
    },
  };
  return db;
}

test("the full run's second pass: asks what's unsure, files it into the stored answer and into what's sent", async () => {
  const people = () => [{ name: "Ann", cried: "unknown" }, { name: "Bo", cried: "unknown" }];
  const season = { id: "s1", show_id: "survivor", season_number: 50 };
  let db = fakePool({ castaways: people() });
  const asked = [];
  const ask = (said) => async (prompt) => (asked.push(prompt), { answer: JSON.stringify(said) });
  const run = { submitted: { castaways: people() } };
  let out = await MR.askUnsure(db.pool, season, 5, ask({ episodeTitle: "Hot Tub", moments: { cried: { happened: "yes", who: ["Bo"], sure: "high" } } }), run);
  assert.deepEqual(out.asked, ["cried"]);
  assert.equal(out.line, "Cried: Bo, sure");
  assert.deepEqual(out.changed, ["cried"]);
  assert.deepEqual(db.written.map((c) => c.cried), ["no", "yes"], "the stored answer");
  assert.deepEqual(run.submitted.castaways.map((c) => c.cried), ["no", "yes"], "what's sent to the leagues");
  // Nothing unsure, or before it was added: nothing asked.
  db = fakePool({ castaways: [{ name: "Ann", cried: "no" }, { name: "Bo", cried: "yes" }] });
  assert.equal(await MR.askUnsure(db.pool, season, 5, ask({}), {}), null);
  db = fakePool({ castaways: people() });
  assert.equal(await MR.askUnsure(db.pool, season, 3, ask({}), {}), null);
  // An answer about another episode, or no JSON: nothing filed.
  db = fakePool({ castaways: people() });
  out = await MR.askUnsure(db.pool, season, 5, ask({ episodeTitle: "Another One", moments: { cried: { happened: "no", sure: "high" } } }), {});
  assert.match(out.line, /about "Another One"/);
  assert.equal(db.written, null);
  out = await MR.askUnsure(db.pool, season, 5, async () => ({ answer: "sorry" }), {});
  assert.equal(out.line, "Added moments: no JSON in the answer");
});

test("our check takes a game on an added moment once the season has it, and refuses it before", () => {
  const spec = (moment) => ({ get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" }, ask: [{ id: "c", ask: "Will someone cry?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment, take: "happened" } }] });
  const ctxOf = (blocks) => ({ moments: momentsFor(blocks) });
  const problems = (b) => G.specProblems(spec("cried"), ctxOf(b)).map((p) => p.problem);
  assert.ok(problems(SURVIVOR).some((p) => /isn't one of the show's moments/.test(p)));
  assert.deepEqual(problems(withCried()), []);
});

test("the grader's void: an episode research couldn't settle an added moment in doesn't count either way", () => {
  const q = (x) => G.fullQuestion({ id: "c", ask: "Will someone cry?", answer: "yesNo", points: 1, asked: "each", settle: { by: "moment", moment: "cried", take: "happened" }, ...x });
  const ep = (k) => ({ out: [], events: new Map(k ? [["cried", k]] : []), who: new Map(k ? [["cried", new Map([["a", k]])]] : []), in: ["a", "b"] });
  const facts = (o) => ({ from: 1, to: null, over: false, episodes: new Map([[4, ep(0)], [5, ep(1)], [6, ep(0)]]), winner: null, ended: false, order: null, names: new Map(), ...o });
  const unsure = new Map([[4, new Set(["cried"])], [6, new Set(["cried"])]]);
  const VOID = { state: "off", why: "Research couldn't say whether it happened: it doesn't count either way" };
  assert.deepEqual(G.verdictOf(q(), 4, facts({ unsureMoments: unsure })), VOID, "unsure, and nobody's yes: void");
  assert.deepEqual(G.verdictOf(q(), 4, facts()), { state: "known", right: ["no"] }, "without the server's map, as before");
  assert.deepEqual(G.verdictOf(q(), 5, facts({ unsureMoments: unsure })), { state: "known", right: ["yes"] }, "settled");
  assert.deepEqual(G.verdictOf(q(), 6, facts({ unsureMoments: new Map([[6, new Set(["other"])]]) })), { state: "known", right: ["no"] }, "another moment's unsure");
  // Over a window: a yes in it stands; who, without a yes, is void when one of its episodes was unsure.
  const over = { asked: "once" };
  assert.deepEqual(G.verdictOf(q(over), 0, facts({ to: 6, over: true, unsureMoments: unsure })).right, ["yes"]);
  const who = q({ answer: "castaway", settle: { by: "moment", moment: "cried", take: "who" } });
  assert.deepEqual(G.verdictOf(who, 4, facts({ unsureMoments: unsure })), VOID);
  // The first time it happens: before an unsure episode it stands; after one, void.
  const first = q({ asked: "once", answer: "number", settle: { by: "moment", moment: "cried", take: "first" } });
  assert.equal(G.verdictOf(first, 0, facts({ from: 4, unsureMoments: new Map([[6, new Set(["cried"])]]) })).value, 5);
  assert.deepEqual(G.verdictOf(first, 0, facts({ from: 4, unsureMoments: unsure })), VOID);
});
