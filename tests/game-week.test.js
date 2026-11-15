// This week on a game's own page (the design round's step 2: src/new/show/this-week.ts; docs/design-round/step2-game-page-spec.md,
// "This week, by situation"): the one block whose words change with the situation. Each case is a game-page situation
// (tools/gameplay-bench/explorer/situations.cjs) played by the runtime, read as the viewer's projection (the production game view),
// so the card is held to what each situation is. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const root = path.join(__dirname, "..");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(root, "src") } });
const { thisWeek, scoreWords } = jiti("../src/new/show/this-week.ts");
const Sit = require(path.join(root, "tools/gameplay-bench/explorer/situations.cjs"));
const R = require(path.join(root, "tools/gameplay-bench/explorer/runtime.cjs"));

const WORDS = { episode: "Episode", ep: "Ep" };

/** A situation's game as its viewer reads it, and the card for it (`ctx` adds the show's side: a reveal waiting, the latest aired). */
function card(id, ctx = {}) {
  const x = Sit.build(id), s = R.open(x.input);
  try {
    for (const a of x.steps) assert.equal(s.apply(a).status, "accepted");
    const g = s.project(x.gameId, x.viewerId).game;
    const move = g.lineup && !g.lineup.locked ? { kind: "lineup", due: !g.lineup.set } : null;
    return { g, w: thisWeek(g, { words: WORDS, next: null, move, seen: ctx.seen ?? g.through, locked: g.locked ?? null, reveal: ctx.reveal ?? null, aired: ctx.aired ?? g.through }) };
  } finally { s.dispose(); }
}

test("due: who you play this week and their record, your lineup not set, last week in a line", () => {
  const { g, w } = card("show-due");
  assert.equal(w.kind, "matchup");
  assert.equal(w.them.playerId, g.matchups.next.opponent);
  assert.match(w.them.record, /^\d+–\d+(–\d+)?$/);
  assert.equal(w.tone, "due");
  assert.match(w.state, /isn't set/);
  assert.equal(w.theirs, "hidden", "their lineup is secret until it locks");
  assert.equal(w.last.episode, 3);
  assert.match(w.last.line, /^Ep 3 · (Beat|Lost to|Tied) /);
});

test("set: you're set, theirs still hidden, nothing yellow to do", () => {
  const { w } = card("show-set");
  assert.equal(w.tone, "set");
  assert.match(w.state, /^You're set/);
  assert.equal(w.theirs, "hidden");
});

test("locked (live only): both lineups shown, results to come", () => {
  const { g, w } = card("show-locked");
  assert.ok(g.locked, "the view carries both sides once locked");
  assert.equal(w.tone, "locked");
  assert.ok(Array.isArray(w.theirs) && w.theirs.length > 0, "their starters, once locked");
  assert.ok(Array.isArray(w.mine) && w.mine.length > 0);
});

test("a quiet night is said as such, records unchanged", () => {
  const { w } = card("show-quiet");
  assert.equal(w.last.result, "quiet");
  assert.match(w.last.line, /Counted for nobody/);
});

test("the playoffs: out of them is said as such, never OUT; you lead, the final in a line", () => {
  const { w } = card("show-playoffs");
  assert.equal(w.tone, "out");
  assert.equal(w.you.name, "You");
  assert.match(w.state, /missed the playoffs/);
  assert.doesNotMatch(w.state, /\bOUT\b/);
  assert.match(w.label, /The final/);
  assert.match(w.last.line, /The final · \w+ \(1\) vs \w+ \(2\)/);
  assert.ok(w.last.playerId, "the final's line opens its matchup");
});

test("the season over: the champion named, your finish", () => {
  const { g, w } = card("show-champion");
  assert.equal(w.tone, "over");
  assert.equal(w.champion.playerId, g.matchups.playoffs.champion);
  assert.match(w.state, /You (finished|won)/);
});

test("behind (own pace): your mark, what's waiting, no result past it", () => {
  const { w } = card("show-behind", { seen: 3, aired: 5, reveal: { episode: 4, stage: "final" } });
  assert.equal(w.tone, "behind");
  assert.match(w.state, /You're up to Ep 3\. Ep 4 and 5 are waiting/);
  assert.equal(w.last, null, "no last week shown while results wait");
  const early = card("show-early", { seen: 3, aired: 4, reveal: { episode: 4, stage: "early" } }).w;
  assert.equal(early.tone, "early");
  assert.match(early.state, /early results are waiting/);
});

test("solo: your own season, no opponent and no place", () => {
  const { w } = card("show-solo");
  assert.notEqual(w.kind, "matchup");
  assert.equal(w.them, null);
  assert.doesNotMatch(w.state, /of 1\b/);
});

test("a score with a negative reads with 'to'", () => {
  assert.equal(scoreWords(6, 2), "6–2");
  assert.equal(scoreWords(-3, 0), "−3 to 0");
});
