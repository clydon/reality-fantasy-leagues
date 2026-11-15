// A person's face, the pure half (docs/PLAN-new-design.md step 15 part 1; src/lib/people.ts): the palette a face can be,
// the colour someone chose winning over the one their id picks, and the id's colour staying what every face had before
// step 15 except where that was teal or gold, which left the palette on 2026-11-15 (gold means due, teal a win). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const P = jiti("../src/lib/people.ts");

const TEAL = "#35b5a5", GOLD = "#e0b23a";

// The colour every face had before step 15 (ui/bars.tsx avatarColour, by its id).
function before(id) {
  const old = [TEAL, "#a76bb0", "#f2804b", "#5089c9", GOLD, "#e86f9a"];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return old[h % old.length];
}

test("the palette: six colours, no gold or teal, each a lower-case hex the database's check takes", () => {
  assert.equal(P.PALETTE.length, 6);
  for (const c of P.PALETTE) assert.match(c.hex, /^#[0-9a-f]{6}$/);
  assert.equal(new Set(P.PALETTE.map((c) => c.hex)).size, 6);
  assert.ok(!P.isPaletteColour(TEAL) && !P.isPaletteColour(GOLD), "gold and teal can't be chosen any more");
  assert.ok(P.isPaletteColour("#8db85e"));
  assert.ok(!P.isPaletteColour("#123456"));
  assert.ok(!P.isPaletteColour("#8DB85E"), "upper case isn't one (the server stores them as the palette has them)");
  assert.ok(!P.isPaletteColour(null));
});

test("someone's colour: their choice, else the one their id picks; nobody's face is gold or teal", () => {
  const ids = ["2xq1fivk18uryht8zuzsd8xa", "abc", "zzzzzz", "user-1", ""];
  for (let i = 0; i < 400; i++) ids.push(`id-${i}-${(i * 7919).toString(36)}`);
  const slots = new Set();
  for (const id of ids) {
    const was = before(id);
    const now = P.colourOf(id);
    slots.add(was);
    if (was === TEAL) assert.equal(now, "#8db85e", `id ${id}: teal's slot is Sage`);
    else if (was === GOLD) assert.equal(now, "#f2804b", `id ${id}: gold's slot is Ember`);
    else assert.equal(now, was, `id ${id}: everyone else keeps their face`);
    assert.equal(P.colourOf(id, null), now);
    assert.equal(P.colourOf(id, "#cfc8bb"), "#cfc8bb");
    assert.equal(P.colourOf(id, "#000000"), now, "a colour off the palette is ignored");
    assert.equal(P.colourOf(id, TEAL), "#5089c9", "chose teal: the nearest hue left, Lake");
    assert.equal(P.colourOf(id, GOLD), "#f2804b", "chose gold: the nearest hue left, Ember");
  }
  assert.ok(slots.has(TEAL) && slots.has(GOLD), "the ids reach both retired slots");
});

test("a stored choice as the palette has it today", () => {
  assert.equal(P.paletteColour("#a76bb0"), "#a76bb0");
  assert.equal(P.paletteColour(TEAL), "#5089c9");
  assert.equal(P.paletteColour(GOLD), "#f2804b");
  assert.equal(P.paletteColour("#123456"), null);
  assert.equal(P.paletteColour(null), null);
});

test("a picture's link carries its version", () => {
  assert.equal(P.pictureUrl("ab c", 1730000000000), "/api/people/ab%20c/picture?v=1730000000000");
});
