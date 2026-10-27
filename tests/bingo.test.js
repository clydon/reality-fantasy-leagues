// Bingo's rules (src/lib/game/bingo.ts, docs/PLAN-new-design.md step 12 part 3, docs/PLAN-bingo-bank.md): a card dealt from a bank
// (three by three, the centre free, the same card for the same seed, a mix of likely, maybe and long-shot squares made up from the
// nearest when the bank is short of one, a reroll's own seed, free squares only where the bank has too few and never a whole line
// of them), its lines (ticked, standing once every square happened, waiting while one hasn't settled, none once one didn't), and
// who finished a line first. No database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { dealCard, countLines, firstLineAt, fullLines, lineState, truthOf, seedOf, LINES, CENTRE, FREE_KEY, MIN_MOMENTS, DEFAULT_MIX } = jiti("../src/lib/game/bingo.ts");

const moments = (n) => Array.from({ length: n }, (_, i) => ({ key: `m:k${i}`, label: `Moment ${i}` }));
const free = (card) => card.filter((s) => s.key === FREE_KEY).length;
/** A bank: `likely`, `maybe` and `longshot` squares of each, keyed by their likelihood so a card can be counted. */
const bank = (counts) => Object.entries(counts).flatMap(([l, n]) => Array.from({ length: n }, (_, i) => ({ key: `b:${l}-${i}`, label: `${l} ${i}.`, likelihood: l })));
const mixOf = (card) => {
  const out = { likely: 0, maybe: 0, longshot: 0 };
  for (const s of card) if (s.key !== FREE_KEY) out[s.key.slice(2).split("-")[0]]++;
  return out;
};

test("a card from a bank: three likely, four maybe, one long shot, wherever they fall", () => {
  assert.deepEqual(DEFAULT_MIX, { likely: 3, maybe: 4, longshot: 1 });
  const full = bank({ likely: 10, maybe: 14, longshot: 6 });
  for (const who of ["alex", "riley", "sam", "jordan"]) {
    const card = dealCard(full, seedOf(who, "s", 5));
    assert.deepEqual(mixOf(card), { likely: 3, maybe: 4, longshot: 1 }, who);
    assert.equal(card[CENTRE].key, FREE_KEY);
    assert.ok(card.every((s) => !/\.$/.test(s.label)), "a full stop comes off");
    assert.ok(card.every((s) => Object.keys(s).sort().join() === "key,label"), "a card keeps a square's key and label, not how likely it was");
  }
  // Positions vary: the long shot isn't always in the same cell.
  const cells = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((w) => dealCard(full, seedOf(w, "s", 5)).findIndex((s) => s.key.startsWith("b:longshot"))));
  assert.ok(cells.size > 2, `the long shot lands in ${cells.size} different cells`);
});

test("a bank short of one likelihood: the nearest makes it up; a mix of your own", () => {
  assert.deepEqual(mixOf(dealCard(bank({ likely: 12, maybe: 12 }), "a")), { likely: 3, maybe: 5, longshot: 0 }, "no long shots: a maybe");
  assert.deepEqual(mixOf(dealCard(bank({ likely: 10, maybe: 1, longshot: 5 }), "a")), { likely: 6, maybe: 1, longshot: 1 }, "one maybe: likely ones first");
  assert.deepEqual(mixOf(dealCard(bank({ maybe: 3, longshot: 9 }), "a")), { likely: 0, maybe: 3, longshot: 5 }, "no likely ones: maybe, then long shots");
  assert.deepEqual(mixOf(dealCard(bank({ likely: 9, maybe: 9, longshot: 9 }), "a", { likely: 8, maybe: 0, longshot: 0 })), { likely: 8, maybe: 0, longshot: 0 });
  assert.deepEqual(mixOf(dealCard(bank({ likely: 9, maybe: 9, longshot: 9 }), "a", { likely: 2, maybe: 2, longshot: 0 })), { likely: 2, maybe: 6, longshot: 0 }, "a mix short of eight: topped up with maybe");
  // A square without a likelihood (a card's squares from before the banks) counts as maybe.
  assert.equal(dealCard(moments(12), "a").filter((s) => s.key !== FREE_KEY).length, 8);
});

test("rerolls: each its own seed, the same card again on every read", () => {
  const full = bank({ likely: 10, maybe: 14, longshot: 6 });
  assert.equal(seedOf("alex", "s", 5), "bingo|alex|s|5", "the first deal's seed is the one cards always had");
  const first = dealCard(full, seedOf("alex", "s", 5));
  const second = dealCard(full, seedOf("alex", "s", 5, 1));
  const third = dealCard(full, seedOf("alex", "s", 5, 2));
  assert.notDeepEqual(second, first);
  assert.notDeepEqual(third, second);
  assert.deepEqual(dealCard(full, seedOf("alex", "s", 5, 1)), second);
  assert.deepEqual(mixOf(third), DEFAULT_MIX);
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

test("too few squares: free squares in the gaps, never a whole line of them; under four, no card", () => {
  for (let n = MIN_MOMENTS; n < 8; n++) {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const card = dealCard(moments(n), seed);
      assert.equal(free(card), 9 - n);
      assert.ok(LINES.every((l) => l.some((i) => card[i].key !== FREE_KEY)), `every line has a moment (${n}, ${seed})`);
    }
  }
  assert.equal(dealCard(moments(3), "a"), null);
  // A show without a card: no lines, nothing first.
  assert.deepEqual(countLines([], new Set(), null), { ticked: 0, called: 0, standing: 0, waiting: 0, off: 0 });
  assert.equal(firstLineAt([], new Map(), null), null);
  // A repeated moment is dealt once.
  assert.equal(dealCard([...moments(4), ...moments(4)], "a").filter((s) => s.key !== FREE_KEY).length, 4);
});

test("lines: ticked as you play; standing once every square happened; waiting; nothing once one didn't", () => {
  const card = dealCard(moments(8), "x");
  const row = [3, 4, 5]; // through the free centre
  const ticked = new Set([3, 5]);
  assert.deepEqual(countLines(card, ticked, null), { ticked: 1, called: 1, standing: 0, waiting: 0, off: 0 });
  const yes = (keys) => truthOf(card, (k) => (keys.includes(k) ? "yes" : null));
  assert.deepEqual(countLines(card, ticked, yes([card[3].key])), { ticked: 1, called: 1, standing: 0, waiting: 1, off: 0 });
  assert.deepEqual(countLines(card, ticked, yes([card[3].key, card[5].key])), { ticked: 1, called: 1, standing: 1, waiting: 0, off: 0 });
  const no = truthOf(card, (k) => (k === card[5].key ? "no" : "yes"));
  assert.deepEqual(countLines(card, ticked, no), { ticked: 1, called: 1, standing: 0, waiting: 0, off: 1 }, "a square that didn't happen: it came off");
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

// ---------- calling BINGO (docs/PLAN-bingo-bank.md step 3) ----------

test("only a called line counts, and only while it's still ticked; it counts, waits or comes off", () => {
  const card = dealCard(moments(8), "z");
  const row = 1; // [3, 4, 5], through the free centre
  const col = 4; // [1, 4, 7]
  const ticked = new Set([3, 5, 1, 7]);
  assert.deepEqual(fullLines(card, ticked), [row, col]);
  const yes = truthOf(card, () => "yes");
  assert.deepEqual(countLines(card, ticked, yes, []), { ticked: 2, called: 0, standing: 0, waiting: 0, off: 0 }, "nothing called: nothing counts");
  assert.deepEqual(countLines(card, ticked, yes, [row]), { ticked: 2, called: 1, standing: 1, waiting: 0, off: 0 });
  assert.deepEqual(countLines(card, new Set([3, 1, 7]), yes, [row, col]), { ticked: 1, called: 1, standing: 1, waiting: 0, off: 0 }, "a called line unticked: not yours");
  const waiting = truthOf(card, (k) => (k === card[5].key ? null : "yes"));
  assert.deepEqual(countLines(card, ticked, waiting, [row, col]), { ticked: 2, called: 2, standing: 1, waiting: 1, off: 0 });
  const no = truthOf(card, (k) => (k === card[7].key ? "no" : "yes"));
  assert.deepEqual(countLines(card, ticked, no, [row, col]), { ticked: 2, called: 2, standing: 1, waiting: 0, off: 1 });
  assert.equal(lineState(card, row, yes), "counts");
  assert.equal(lineState(card, row, waiting), "waiting");
  assert.equal(lineState(card, col, no), "off");
  assert.equal(lineState(card, row, null), "waiting", "not seen yet: waiting");
  assert.deepEqual(countLines(card, ticked, null, [row]), { ticked: 2, called: 1, standing: 0, waiting: 0, off: 0 }, "nothing settled for you: just what's called");
});

test("who got a line first on a bank's card: the earliest call, of a line that hasn't come off", () => {
  const card = dealCard(moments(8), "w");
  const ticks = new Map([
    [3, 100],
    [5, 110],
    [1, 120],
    [7, 130],
  ]);
  assert.equal(firstLineAt(card, ticks, null, []), null, "nothing called");
  assert.equal(firstLineAt(card, ticks, null, [{ line: 4, at: 500 }, { line: 1, at: 900 }]), 500, "the column called first");
  const broke = truthOf(card, (k) => (k === card[7].key ? "no" : "yes"));
  assert.equal(firstLineAt(card, ticks, broke, [{ line: 4, at: 500 }, { line: 1, at: 900 }]), 900, "the column came off: the row's call");
  assert.equal(firstLineAt(card, new Map([[3, 1]]), null, [{ line: 1, at: 50 }]), null, "a call on a line no longer ticked");
});
