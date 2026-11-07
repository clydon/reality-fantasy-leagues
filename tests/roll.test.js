// Randomize (docs/PLAN-start-a-game-gpt.md step G4, src/lib/game/game-spec/roll.js): a game rolled from a seed on a page's rules.
// Every roll passes our check and fits its short form's caps, on every rulebook the tracker's pages name; the same page, locks and
// seed make the same game; every lock holds; a lock nothing fits comes back as the nearest with why; the tracker's weights lean the
// roll toward what people ask for. The short form (describeSpec's `short`) fits its caps on every game the tracker says plays. No
// database: the pages' ctx are their rulebooks' (tests/fixtures/game-words/bank.js ctxOf). The thousands of seeds on the taped
// seasons, and the rolls played to the end, are scripts/dev-test/roll-check.js and blind.js --rolls. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../src/lib/game/game-spec/index.js");
const R = require("../src/lib/game/game-spec/roll.js");
const C = require("../src/lib/game/game-spec/capabilities.js");
const B = require("./fixtures/game-words/bank.js");
const tracker = require("./fixtures/engine-capabilities.json");
const { SHORT_TITLE, SHORT_LINE } = require("../src/lib/game/game-spec/describe.js");
const { unsaid } = require("./fixtures/short-words.js");

// Each rulebook a tracker page names, with a couch, who's in and where the season stands: at its premiere, and partway.
const PAGES = [
  { page: { show: "Survivor", season: 51, rulebook: "survivor", couch: 6, pool: 18 }, total: 13 },
  { page: { show: "Survivor", season: 51, rulebook: "survivor", couch: 6, pool: 12 }, total: 13, next: 7 },
  { page: { show: "The Challenge", season: 41, rulebook: "challenge", couch: 5, pool: 30 }, total: 18 },
  { page: { show: "The Traitors", season: 4, rulebook: "traitors", couch: 4, pool: 23 }, total: 12 },
  { page: { show: "Below Deck", season: 13, rulebook: "belowDeck", couch: 4, pool: 10 }, total: 16 },
  { page: { show: "Dancing with the Stars", season: 35, rulebook: "dancing", couch: 8, pool: 14 }, total: 11 },
  { page: { show: "The Amazing Race", season: 38, rulebook: "amazingRace", couch: 3, pool: 22 }, total: 12 },
  { page: { show: "Saturday Night Live", season: null, rulebook: "snl", couch: 4 }, total: 21 },
  { page: { show: "Pluribus", season: 1, rulebook: "pluribus", couch: 2 }, total: 9 },
];
const pageOf = ({ page, total, next = 1 }) => ({
  ctx: B.ctxOf(page),
  pack: { episodes: { aired: next - 1, total, next: { number: next } }, stillIn: page.pool, couch: { people: page.couch } },
});
const SEEDS = 600;

test("every roll passes our check, plays, and fits its short form, on every rulebook the tracker names", () => {
  for (const p of PAGES) {
    const page = pageOf(p);
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = R.rollSpec(page, {}, seed);
      const at = `${p.page.rulebook} seed ${seed}`;
      assert.ok(r.ok, `${at}: ${r.why}`);
      // Checked again here, independently of the roll's own gate.
      assert.deepEqual(G.specProblems(r.spec, page.ctx), [], at);
      assert.deepEqual(G.specWaitsFor(r.spec), [], at);
      assert.ok(G.typeOf(r.spec), `${at}: has a place in the scoring sequence`);
      assert.ok(r.twists.length <= 2, `${at}: one or two twists at most`);
      const s = r.describe.short;
      assert.ok(s.title && s.title.length <= SHORT_TITLE, `${at}: title "${s.title}"`);
      assert.ok(s.line && s.line.length <= SHORT_LINE, `${at}: line "${s.line}"`);
      assert.ok(!/undefined|NaN|null/.test(`${s.title} ${s.line} ${r.describe.sentence}`), `${at}: ${s.title} | ${s.line}`);
      // G3 part 3: its sentence says every piece the short form shows (tests/fixtures/short-words.js).
      assert.deepEqual(unsaid(s, r.describe.sentence), [], `${at}: ${s.line} | ${r.describe.sentence}`);
      // The game starts where the page is: the next episode to air, or a phase still to come.
      const from = r.spec.stages ? r.spec.stages[0].game.span.from : r.spec.span.from;
      assert.ok(typeof from === "object" || from === (p.next || 1), `${at}: starts at the next episode`);
    }
  }
});

test("the same page, locks and seed make the same game; other seeds make others", () => {
  const page = pageOf(PAGES[0]);
  const locks = { length: "rest", play: "draft" };
  for (const seed of [1, 2, 99, 12345, "share-me"]) assert.deepEqual(R.rollSpec(page, locks, seed), R.rollSpec(page, locks, seed));
  const games = new Set(Array.from({ length: 200 }, (_, i) => JSON.stringify(R.rollSpec(page, {}, i + 1).spec)));
  assert.ok(games.size > 150, `200 seeds make ${games.size} different games`);
  // A roll's seed is the one it landed on, so rolling that seed again is the same game in one try (a shared roll).
  for (let seed = 1; seed <= 100; seed++) {
    const r = R.rollSpec(page, {}, seed);
    const again = R.rollSpec(page, {}, r.seed);
    assert.equal(again.tries, 1);
    assert.deepEqual(again.spec, r.spec);
  }
});

test("every lock holds", () => {
  const survivor = pageOf(PAGES[1]);
  const challenge = pageOf(PAGES[2]);
  const each = (page, locks, check, n = 150) => {
    for (let seed = 1; seed <= n; seed++) {
      const r = R.rollSpec(page, locks, seed);
      assert.ok(r.ok, `${JSON.stringify(locks)} seed ${seed}: ${r.why}`);
      check(r, seed);
    }
  };
  const spanOf = (s) => (s.stages ? { from: s.stages[0].game.span.from, to: s.stages[s.stages.length - 1].game.span ? s.stages[s.stages.length - 1].game.span.to : null } : s.span);
  each(survivor, { length: "one" }, (r) => assert.deepEqual(spanOf(r.spec), { from: 7, to: 7 }));
  each(survivor, { length: 3 }, (r) => assert.deepEqual(spanOf(r.spec), { from: 7, to: 9 }));
  each(survivor, { length: "rest" }, (r) => assert.equal(spanOf(r.spec).to ?? null, null));
  each(survivor, { length: "phase" }, (r) => assert.deepEqual(spanOf(r.spec).from, { phase: "merged" }));
  each(survivor, { length: "until-phase" }, (r) => assert.deepEqual(spanOf(r.spec), { from: 7, to: { phase: "merged" } }));
  // A length too short for a base rules it out, unless it's locked too.
  each(survivor, { length: "one" }, (r) => assert.ok(!["outlast", "pool"].includes(r.base)));
  assert.equal(R.rollSpec(survivor, { length: "one", base: "outlast" }, 1).base, "outlast");
  for (const play of R.ROLL.plays) each(survivor, { play }, (r) => assert.equal(R.ROLL.bases.find((b) => b.id === r.base).play, play), 60);
  for (const b of R.ROLL.bases) each(survivor, { base: b.id }, (r) => assert.equal(r.base, b.id), 40);
  const winOf = (s) => (s.stages ? s.stages[0].game : s).rank || {};
  each(survivor, { win: "matchups" }, (r) => assert.equal(winOf(r.spec).by, "matchups"), 80);
  each(survivor, { win: "weeks" }, (r) => assert.equal(winOf(r.spec).by, "weeks"), 80);
  each(survivor, { win: "standing" }, (r) => assert.equal(winOf(r.spec).by, "standing"), 80);
  each(survivor, { win: "coop" }, (r) => assert.equal(winOf(r.spec).by, "coop"), 40);
  each(survivor, { win: "race" }, (r) => assert.ok(winOf(r.spec).race), 40);
  each(survivor, { win: "streak" }, (r) => assert.equal(G.fullSpec(r.spec).rank.by, "streak"), 40);
  each(survivor, { win: "total" }, (r) => assert.equal(G.fullSpec(r.spec.stages ? r.spec.stages[0].game : r.spec).rank.by, "total"), 80);
  each(survivor, { twists: [] }, (r) => assert.deepEqual(r.twists, []));
  each(survivor, { base: "lineup", twists: ["captain"] }, (r) => assert.ok(r.spec.score.captain && r.twists.includes("captain")), 60);
  each(survivor, { base: "pool", twists: ["mulligan", "second-pick"] }, (r) => assert.ok(r.spec.score.mulligans === 1 && r.spec.get.second), 60);
  each(challenge, { base: "outlast", twists: ["redraft"] }, (r) => assert.ok(r.spec.stages && r.spec.stages[1].on), 40);
  each(survivor, { base: "outlast", twists: ["redraft"] }, (r) => assert.deepEqual(r.spec.stages[1].game.span.from, { phase: "merged" }), 40);
  // What someone typed is held over the roll (the doors mixed).
  each(survivor, { play: "draft", keep: { get: { each: 2 } } }, (r) => {
    const g = r.spec.stages ? r.spec.stages[0].game : r.spec;
    assert.equal(g.get ? g.get.each : r.spec.get.each, 2);
  }, 60);
});

test("locks nothing fits come back as the nearest, with why", () => {
  const page = pageOf(PAGES[0]);
  const cant = R.rollSpec(page, { base: "pool", win: "coop" }, 1);
  assert.equal(cant.ok, false);
  assert.match(cant.why, /unlock one/);
  // A twist that doesn't go with the base: the nearest game, and our check's own words for why.
  const near = R.rollSpec(page, { base: "pool", twists: ["captain"] }, 1);
  assert.equal(near.ok, false);
  assert.ok(near.spec && near.why, "the nearest it found, with why");
  assert.equal(near.tries, R.MAX_TRIES);
  // Something typed that can't be: the check says so.
  const typed = R.rollSpec(page, { base: "outlast", keep: { get: { each: 40 } } }, 1);
  assert.equal(typed.ok, false);
  assert.ok(typed.problems.length);
});

test("a roll fits what the page can have: no phase still to come, a season's length unknown, a few episodes left", () => {
  // The Challenge has one phase (the season): from the next phase on is nothing to roll, and says so rather than throwing.
  const challenge = pageOf(PAGES[2]);
  for (const length of ["phase", "until-phase"]) {
    const r = R.rollSpec(challenge, { length }, 1);
    assert.equal(r.ok, false);
    assert.match(r.why, /unlock one/);
  }
  // Half of a season whose length isn't known: nothing to roll.
  const unknown = { ctx: B.ctxOf(PAGES[0].page), pack: { episodes: { aired: 0, next: { number: 1 } }, stillIn: 18, couch: { people: 6 } } };
  assert.equal(R.rollSpec(unknown, { length: "half" }, 1).ok, false);
  for (let seed = 1; seed <= 100; seed++) assert.ok(R.rollSpec(unknown, {}, seed).ok);
  // Two episodes left: no Outlast or pool (each needs longer to be a game), unless one is locked.
  const late = pageOf({ ...PAGES[1], next: 12 });
  for (let seed = 1; seed <= 200; seed++) assert.ok(!["outlast", "pool"].includes(R.rollSpec(late, {}, seed).base), `seed ${seed}`);
  assert.equal(R.rollSpec(late, { base: "pool" }, 1).base, "pool");
  // A locked twist rolls a base it goes on: a captain is a lineup's.
  const survivor = pageOf(PAGES[0]);
  for (let seed = 1; seed <= 60; seed++) {
    const r = R.rollSpec(survivor, { twists: ["captain"] }, seed);
    assert.ok(r.ok && r.base === "lineup" && r.spec.score.captain, `seed ${seed}: ${r.base} ${r.why}`);
  }
  // The length a roll reports is the one it chose, so locking it keeps it.
  for (let seed = 1; seed <= 100; seed++) {
    const r = R.rollSpec(survivor, {}, seed);
    assert.ok(R.ROLL.lengths.includes(r.length), `seed ${seed}: ${r.length}`);
    const again = R.rollSpec(survivor, { length: r.length }, seed);
    assert.equal(again.length, r.length);
  }
});

test("the short form of a game still being made says what it can", () => {
  const ctx = B.ctxOf({ show: "Survivor", season: 51, rulebook: "survivor" });
  const s = (spec) => G.describeSpec(spec, ctx).short;
  assert.equal(s({ get: { by: "draft", order: "snake", own: "exclusive" }, count: { all: true }, score: { by: "place" } }).line, "All season · Draft");
  assert.match(s({ preset: "outlast", ask: [{ id: "boot", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } }] }).line, /Plus 1 question$/);
  assert.equal(s({ get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" }, ask: [] }).line, "All season · Questions");
});

test("the tracker's weights lean the roll toward what people ask for", () => {
  const rows = C.rowsOf(tracker);
  const w = R.weightsFrom(rows, (r) => B.ctxOf(r.page));
  assert.ok(w.bases.outlast > 0 && w.bases.lineup > 0 && w.bases.questions > 0, JSON.stringify(w.bases));
  assert.ok(w.twists.captain > 0 && w.twists.bounty > 0, JSON.stringify(w.twists));
  // Weighed, the most asked-for base comes up more than it does flat.
  const page = pageOf(PAGES[0]);
  const top = Object.entries(w.bases).sort((a, b) => b[1] - a[1])[0][0];
  const count = (weights) => Array.from({ length: 600 }, (_, i) => R.rollSpec(page, {}, i + 1, { weights }).base).filter((b) => b === top).length;
  assert.ok(count(w) > count(null), `${top} comes up more weighed`);
});

test("every base, way to win and twist comes up somewhere", () => {
  const seen = { bases: new Set(), wins: new Set(), twists: new Set() };
  for (const p of PAGES.slice(0, 4)) {
    const page = pageOf(p);
    for (let seed = 1; seed <= 800; seed++) {
      const r = R.rollSpec(page, {}, seed);
      seen.bases.add(r.base);
      seen.wins.add(r.win);
      r.twists.forEach((t) => seen.twists.add(t));
    }
  }
  for (const b of R.ROLL.bases) assert.ok(seen.bases.has(b.id), b.id);
  for (const t of R.ROLL.twists) assert.ok(seen.twists.has(t.id), t.id);
  for (const w of ["total", "own", "points", "standing", "matchups", "weeks", "coop", "race"]) assert.ok(seen.wins.has(w), w);
});

test("the short form fits its caps on every game the tracker says plays", () => {
  for (const r of C.rowsOf(tracker)) {
    if (!r.spec || !r.page || !r.page.rulebook) continue;
    const ctx = B.ctxOf(r.page);
    if (C.statusOf(r, ctx).state !== "yes") continue;
    const s = G.describeSpec(r.spec, ctx).short;
    assert.ok(s.title.length <= SHORT_TITLE && s.line.length <= SHORT_LINE, `${r.id}: ${s.title} | ${s.line}`);
    assert.ok(s.title && s.line.split(" · ").length >= 2, `${r.id}: when and what you do, at least`);
    assert.ok(!/undefined|NaN|null/.test(`${s.title} ${s.line}`), `${r.id}: ${s.title} | ${s.line}`);
  }
  // The plan's example: one episode, a draft of two, a captain.
  const ctx = B.ctxOf({ show: "Survivor", season: 51, rulebook: "survivor" });
  const s = G.describeSpec({ preset: "weekly-lineup", span: { from: 7, to: 7 }, get: { by: "draft", each: 2, order: "blind", own: "shared" }, count: { start: 1 }, score: { by: "moments", points: null, captain: { times: 2 } } }, ctx).short;
  assert.deepEqual(s, { title: "Weekly Lineup", line: "Episode 7 · Draft 2, start 1 · Captain scores double", more: 0 });
});

// G3 part 3 (the main session's 12:15 PM note): a rolled game's sentence says every piece its short form shows (each chip's words,
// tests/fixtures/short-words.js), on every page's seeds and every game the tracker says plays; the majority question reads naturally.
test("every piece the short form shows is in the sentence on every game the tracker says plays (every roll's: the first test); finale picks and the majority's words", () => {
  for (const r of C.rowsOf(tracker)) {
    if (!r.spec || !r.page || !r.page.rulebook) continue;
    const ctx = B.ctxOf(r.page);
    if (C.statusOf(r, ctx).state !== "yes") continue;
    const d = G.describeSpec(r.spec, ctx);
    assert.deepEqual(unsaid(d.short, d.sentence), [], `${r.id}: ${d.short.line} | ${d.sentence}`);
  }
  const ctx = B.ctxOf({ show: "Survivor", season: 51, rulebook: "survivor" });
  // Survivor 49 seed 42's shape: a Weekly Lineup with finale picks, said in the sentence.
  const { finaleQuestions } = require("../src/lib/game/game-spec/schema.js");
  const lineup = G.describeSpec({ preset: "weekly-lineup", get: { by: "draft", each: 5, own: "shared" }, count: { start: 2 }, score: { by: "moments" }, ask: finaleQuestions({ top3: 1, winner: 3, from: "any" }) }, ctx);
  assert.match(lineup.short.line, /Finale picks/);
  assert.match(lineup.sentence, /each episode, all season\. Before the finale, everyone names their final three and the winner\./);
  // Seed 3's: who most of you will say goes home.
  const majority = R.ROLL.twists.find((t) => t.id === "majority");
  const most = { preset: "weekly-calls", get: { by: "none" }, score: { by: "answers" }, rank: { by: "total" }, ask: [{ id: "boot", ask: "Who goes home?", answer: "person", points: 2, asked: "each", settle: { by: "results", take: "out" } }, { id: "most", ask: "Who will most of you say goes home?", answer: "person", points: 2, asked: "each", settle: { by: "players", take: "majority", of: "boot" } }] };
  assert.ok(majority, "the roll has a majority twist");
  assert.match(G.describeSpec(most, ctx).sentence, /who goes home and who most of you will say goes home/);
  // Only the majority's wording is turned round: "Who will have the final say?" stays as it is.
  assert.match(G.describeSpec({ ...most, ask: [{ ...most.ask[0], ask: "Who will have the final say at tribal?" }] }, ctx).sentence, /who will have the final say at tribal/);
});
