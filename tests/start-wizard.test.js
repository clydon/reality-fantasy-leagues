// Start a game's wizard, the logic (docs/PLAN-start-a-game-gpt.md U1; src/lib/game/start-wizard/index.js, the settled board's
// script ported pure). On every rulebook the roll tests use, at the premiere and mid-season: When it runs' default follows where
// the season is (the season, after the premiere, before Episode 2; tonight mid-season); every game on the rail plays and is worded;
// every quick change, tapped until there's nothing left, leaves a game that plays (and says why when it stops); every way to win,
// twist and bet the sheet offers plays; What scores' changes play; Surprise me never deals a game in stages (Start can't make one
// yet) and a shuffled game rebuilds as it was; a typed game (our AI's, checked) goes into the sheet; the footer says what's next
// with no undefined. No database: the pages' ctx are their rulebooks' (tests/fixtures/game-words/bank.js ctxOf). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const W = require("../src/lib/game/start-wizard/index.js");
const G = require("../src/lib/game/game-spec/index.js");
const B = require("./fixtures/game-words/bank.js");

const PAGES = [
  { page: { show: "Survivor", season: 51, rulebook: "survivor", couch: 6, pool: 18 }, total: 13 },
  { page: { show: "Survivor", season: 51, rulebook: "survivor", couch: 6, pool: 12 }, total: 13, next: 7 },
  { page: { show: "The Challenge", season: 41, rulebook: "challenge", couch: 5, pool: 30 }, total: 18 },
  { page: { show: "The Traitors", season: 4, rulebook: "traitors", couch: 4, pool: 23 }, total: 12, next: 4 },
  { page: { show: "Below Deck", season: 13, rulebook: "belowDeck", couch: 4, pool: 10 }, total: 16 },
  { page: { show: "Dancing with the Stars", season: 35, rulebook: "dancing", couch: 8, pool: 14 }, total: 11, next: 5 },
  { page: { show: "The Amazing Race", season: 38, rulebook: "amazingRace", couch: 3, pool: 22 }, total: 12 },
];

function inputOf({ page, total, next = 1 }) {
  const ctx = B.ctxOf(page);
  return {
    page: { ctx, pack: { episodes: { aired: next - 1, total, next: { number: next } }, stillIn: page.pool, couch: { people: page.couch } } },
    first: next,
    last: total,
    phases: (ctx.phases || []).map((p) => ({ id: p.id, name: p.name || p.id })),
    part: { singular: "episode", plural: "episodes" },
    label: `${page.show}${page.season ? ` ${page.season}` : ""}`,
  };
}
const at = (p) => `${p.page.rulebook}${p.next ? ` from ${p.next}` : ""}`;
// The page whose ctx the game is checked against again, set as each page's loop starts.
let CTX = null;
const plays = (b, where) => {
  assert.ok(b && b.r.ok, `${where}: ${b && b.r.why}`);
  assert.deepEqual(G.specProblems(b.r.spec, CTX), [], where);
  assert.deepEqual(G.specWaitsFor(b.r.spec), [], where);
  assert.ok(!/undefined|NaN/.test(`${b.r.describe.short.title} ${b.r.describe.short.line} ${b.r.describe.sentence}`), `${where}: ${b.r.describe.short.line}`);
};

test("When it runs: the season before Episode 2 (after the premiere), tonight mid-season; spans in words", () => {
  for (const p of PAGES) {
    const input = inputOf(p);
    CTX = input.page.ctx;
    const t = W.timing(input);
    const first = p.next || 1;
    assert.equal(t.mode, first <= 2 ? "season" : "tonight", at(p));
    assert.deepEqual(t.tonight, { from: first, to: first }, at(p));
    assert.deepEqual(t.season, { from: first === 1 ? 2 : first, to: null }, at(p));
    for (const span of [t.tonight, t.season, ...t.stages.map((s) => s.span)]) {
      const words = W.sayRange(span, input);
      assert.ok(words && !/undefined|null|NaN/.test(words), `${at(p)}: ${JSON.stringify(span)} -> ${words}`);
      assert.ok(!/undefined|NaN/.test(W.nTag(span, input)), at(p));
    }
  }
});

test("every game on the rail plays, worded; the classic leads", () => {
  for (const p of PAGES) {
    const input = inputOf(p);
    CTX = input.page.ctx;
    const t = W.timing(input);
    const wz = W.createWizard(input);
    for (const span of [t.tonight, t.season]) {
      const g = wz.games(span);
      assert.ok(g.list.length >= 3, `${at(p)}: ${g.list.length} games`);
      assert.equal(g.list[0].role, "The classic", at(p));
      for (const row of g.list) {
        plays(wz.build(span, { ...W.fresh(), sel: row.id }), `${at(p)} ${row.name}`);
        assert.ok(wz.steps(row.spec).every((s) => s.words && !/undefined|NaN/.test(s.words)), `${at(p)} ${row.name}: steps`);
        assert.ok(!/undefined|NaN/.test(wz.nextLine(span, row.spec, () => "8 PM tonight")), `${at(p)} ${row.name}: next`);
      }
    }
  }
});

test("quick changes: each tap plays until there's nothing left, and then it says why", () => {
  for (const p of PAGES) {
    const input = inputOf(p);
    CTX = input.page.ctx;
    const t = W.timing(input);
    const wz = W.createWizard(input);
    for (const span of [t.tonight, t.season]) {
      for (const row of wz.games(span).list) {
        for (const kind of ["comp", "casual", "score"]) {
          let choice = { ...W.fresh(), sel: row.id };
          for (let i = 0; i < 8; i++) {
            const out = wz.applyQuick(span, choice, kind);
            if (out.why) {
              assert.ok(out.why.length > 5, `${at(p)} ${row.name} ${kind}: why`);
              break;
            }
            assert.ok(out.choice && out.toast, `${at(p)} ${row.name} ${kind}`);
            choice = out.choice;
            plays(wz.build(span, choice), `${at(p)} ${row.name} ${kind} #${i}: ${out.toast}`);
            assert.ok((choice.tws || []).length <= 2, "two twists at most");
          }
        }
        const quick = wz.quick(span, { ...W.fresh(), sel: row.id });
        assert.equal(quick.length, 4, at(p));
        assert.ok(quick.every((q) => q.next && !/undefined/.test(q.next)), `${at(p)} ${row.name}: ${JSON.stringify(quick)}`);
      }
    }
  }
});

test("every way to win, twist and bet the sheet offers plays", () => {
  for (const p of PAGES.slice(0, 4)) {
    const input = inputOf(p);
    CTX = input.page.ctx;
    const t = W.timing(input);
    const wz = W.createWizard(input);
    for (const row of wz.games(t.season).list) {
      const choice = { ...W.fresh(), sel: row.id };
      const o = wz.options(t.season, choice);
      for (const [w, v] of Object.entries(o.wins)) if (v.ok) plays(wz.build(t.season, { ...choice, win: w }), `${at(p)} ${row.name} win ${w}`);
      for (const id of Object.keys(o.tws)) plays(wz.build(t.season, { ...choice, tws: [id] }), `${at(p)} ${row.name} twist ${id}`);
      for (const id of o.bets) plays(wz.build(t.season, { ...choice, bet: id }), `${at(p)} ${row.name} bet ${id}`);
    }
  }
});

test("What scores: a moment off, its points stepped, a scoring way, a question's points; each plays", () => {
  for (const p of PAGES.slice(0, 4)) {
    const input = inputOf(p);
    CTX = input.page.ctx;
    const t = W.timing(input);
    const wz = W.createWizard(input);
    for (const row of wz.games(t.season).list) {
      const choice = { ...W.fresh(), sel: row.id };
      const rows = wz.scoreRows(t.season, choice);
      if (rows.kind === "moments") {
        const m = rows.rows.find((r) => r.on);
        const off = wz.setMoment(t.season, choice, m.id, false, 0);
        if (off.choice) plays(wz.build(t.season, off.choice), `${at(p)} ${row.name}: ${m.id} off`);
        const up = wz.setMoment(t.season, choice, m.id, true, m.pts + 1);
        assert.ok(up.choice, `${at(p)} ${row.name}: ${m.id} up: ${up.why}`);
        plays(wz.build(t.season, up.choice), `${at(p)} ${row.name}: ${m.id} up`);
        assert.match(wz.scoringName(t.season, up.choice), /, changed$/);
        for (const s of wz.scorings(t.season, choice)) plays(wz.build(t.season, { ...choice, scoring: s }), `${at(p)} ${row.name}: ${s}`);
      }
      if (rows.kind === "asks") {
        const q = rows.rows.find((x) => !x.fixed);
        if (!q) continue;
        const up = wz.setQuestion(t.season, choice, q.id, q.pts + 2);
        assert.ok(up.choice, `${at(p)} ${row.name}: ${q.id} +2: ${up.why}`);
        plays(wz.build(t.season, up.choice), `${at(p)} ${row.name}: ${q.id} +2`);
      }
    }
  }
});

test("Surprise me: never a game in stages, and a shuffled game rebuilds as it was; keeps hold", () => {
  for (const p of PAGES) {
    const input = inputOf(p);
    CTX = input.page.ctx;
    const t = W.timing(input);
    const wz = W.createWizard(input);
    for (const span of [t.tonight, t.season, { from: input.first, to: input.first + 2 }]) {
      for (let n = 1; n <= 25; n++) {
        const out = wz.shuffle(span, { ...W.fresh(), sel: "" }, {}, n);
        if (out.why) continue;
        assert.ok(!Array.isArray(out.choice.row.spec.stages), `${at(p)} #${n}: stages`);
        const b = wz.build(span, out.choice);
        plays(b, `${at(p)} shuffle #${n}`);
        assert.equal(JSON.stringify(b.r.spec), JSON.stringify(out.choice.row.spec), `${at(p)} shuffle #${n}: rebuilt as it was`);
      }
      const lineup = { ...W.fresh(), sel: "lineup" };
      if (wz.games(span).list.some((x) => x.id === "lineup")) {
        const kept = wz.shuffle(span, lineup, { game: true }, 3);
        if (kept.choice) assert.equal(kept.choice.row.game, "lineup", `${at(p)}: The game kept`);
      }
    }
  }
});

test("a typed game goes into the sheet and plays there", () => {
  const p = PAGES[1];
  const input = inputOf(p);
  CTX = input.page.ctx;
  const t = W.timing(input);
  const wz = W.createWizard(input);
  const rolled = G.rollSpec(input.page, { length: t.season, base: "outlast", twists: [] }, "typed-test");
  const out = wz.typed(t.season, rolled.spec, "Our Outlast");
  assert.ok(out.choice, out.why);
  assert.equal(out.choice.row.name, "Our Outlast");
  plays(wz.build(t.season, out.choice), "typed");
  const comp = wz.applyQuick(t.season, out.choice, "comp");
  if (comp.choice) plays(wz.build(t.season, comp.choice), `typed, ${comp.toast}`);
});
