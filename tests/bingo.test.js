// Bingo's rules (src/lib/game/bingo.ts, docs/PLAN-new-design.md step 12 part 3): a card dealt from a show's moments (three by three,
// the centre free, the same card for the same seed, free squares only where the show has too few moments and never a whole line
// of them), its lines (ticked, standing once every square happened, waiting while one hasn't settled, none once one didn't), and
// who finished a line first. No database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { bingoMoments, dealCard, countLines, firstLineAt, truthOf, LINES, CENTRE, FREE_KEY, MIN_MOMENTS } = jiti("../src/lib/game/bingo.ts");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
const SAMPLES = require("./fixtures/rulebook-samples.js");

const moments = (n) => Array.from({ length: n }, (_, i) => ({ key: `m:k${i}`, label: `Moment ${i}` }));
const free = (card) => card.filter((s) => s.key === FREE_KEY).length;

test("a show's moments: the callable ones, keyed as the season's results record them", () => {
  const survivor = bingoMoments(BUILT_IN_BLOCKS.survivor);
  assert.ok(survivor.length >= 8, `Survivor has ${survivor.length}`);
  assert.ok(survivor.every((m) => /^m:/.test(m.key) && m.label && !/\.$/.test(m.label)));
  assert.ok(survivor.some((m) => m.label === "Played an idol or advantage"));
  assert.ok(!survivor.some((m) => /Voted out|Sole Survivor/.test(m.label)), "never a way out");
  const talk = bingoMoments({ blocks: SAMPLES.snl.blocks || SAMPLES.snl, aliases: null });
  assert.deepEqual(talk.map((m) => m.key).sort(), ["m:breaksCharacter", "m:flubbedLine", "m:guestInSketch", "m:hostSings", "m:recurringCharacter", "m:surpriseCameo"]);
});

test("a card: nine squares, the centre free, eight moments; the same seed deals it the same", () => {
  const card = dealCard(moments(12), "alex|s|5");
  assert.equal(card.length, 9);
  assert.equal(card[CENTRE].key, FREE_KEY);
  assert.equal(free(card), 1);
  assert.equal(new Set(card.map((s) => s.key)).size, 9);
  assert.deepEqual(dealCard(moments(12), "alex|s|5"), card, "the same card again");
  assert.notDeepEqual(dealCard(moments(12), "riley|s|5"), card, "someone else's differs");
});

test("too few moments: free squares in the gaps, never a whole line of them; under four, no card", () => {
  for (let n = MIN_MOMENTS; n < 8; n++) {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const card = dealCard(moments(n), seed);
      assert.equal(free(card), 9 - n);
      assert.ok(LINES.every((l) => l.some((i) => card[i].key !== FREE_KEY)), `every line has a moment (${n}, ${seed})`);
    }
  }
  assert.equal(dealCard(moments(3), "a"), null);
  // A show without a card: no lines, nothing first.
  assert.deepEqual(countLines([], new Set(), null), { ticked: 0, standing: 0, waiting: 0 });
  assert.equal(firstLineAt([], new Map(), null), null);
  // A repeated moment is dealt once.
  assert.equal(dealCard([...moments(4), ...moments(4)], "a").filter((s) => s.key !== FREE_KEY).length, 4);
});

test("lines: ticked as you play; standing once every square happened; waiting; nothing once one didn't", () => {
  const card = dealCard(moments(8), "x");
  const row = [3, 4, 5]; // through the free centre
  const ticked = new Set([3, 5]);
  assert.deepEqual(countLines(card, ticked, null), { ticked: 1, standing: 0, waiting: 0 });
  const yes = (keys) => truthOf(card, (k) => (keys.includes(k) ? "yes" : null));
  assert.deepEqual(countLines(card, ticked, yes([card[3].key])), { ticked: 1, standing: 0, waiting: 1 });
  assert.deepEqual(countLines(card, ticked, yes([card[3].key, card[5].key])), { ticked: 1, standing: 1, waiting: 0 });
  const no = truthOf(card, (k) => (k === card[5].key ? "no" : "yes"));
  assert.deepEqual(countLines(card, ticked, no), { ticked: 1, standing: 0, waiting: 0 }, "a square that didn't happen breaks it");
  // Everything happened but you didn't tick it: not your line.
  assert.equal(countLines(card, new Set([3]), truthOf(card, () => "yes")).standing, 0);
  assert.ok(row.every((i) => LINES.some((l) => l.includes(i))));
});

test("who finished a line first: the earliest line's last tick, leaving out a line that didn't happen", () => {
  const card = dealCard(moments(8), "y");
  const ticks = new Map([
    [0, 100],
    [8, 300],
    [3, 150],
    [5, 200],
  ]);
  assert.equal(firstLineAt(card, ticks, null), 200, "row 3-4-5 at 200 beats the diagonal at 300");
  const broke = truthOf(card, (k) => (k === card[5].key ? "no" : "yes"));
  assert.equal(firstLineAt(card, ticks, broke), 300, "with 5 not happening, the diagonal");
  assert.equal(firstLineAt(card, new Map([[0, 1]]), null), null);
});
