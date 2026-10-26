// A person's face, the pure half (docs/PLAN-new-design.md step 15 part 1; src/lib/people.ts): the palette a face can be,
// the colour someone chose winning over the one their id picks, and the id's colour staying what every face had before
// step 15 (the first six). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const P = jiti("../src/lib/people.ts");

// The colour every face had before step 15 (ui/bars.tsx avatarColour, by its id).
function before(id) {
  const old = ["#35b5a5", "#a76bb0", "#f2804b", "#5089c9", "#e0b23a", "#e86f9a"];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return old[h % old.length];
}

test("the palette: eight colours, each a lower-case hex the database's check takes", () => {
  assert.equal(P.PALETTE.length, 8);
  for (const c of P.PALETTE) assert.match(c.hex, /^#[0-9a-f]{6}$/);
  assert.equal(new Set(P.PALETTE.map((c) => c.hex)).size, 8);
  assert.ok(P.isPaletteColour("#8db85e"));
  assert.ok(!P.isPaletteColour("#123456"));
  assert.ok(!P.isPaletteColour("#8DB85E"), "upper case isn't one (the server stores them as the palette has them)");
  assert.ok(!P.isPaletteColour(null));
});

test("someone's colour: their choice, else the one their id picks, as before", () => {
  for (const id of ["2xq1fivk18uryht8zuzsd8xa", "abc", "zzzzzz", "user-1", ""]) {
    assert.equal(P.colourOf(id), before(id), `id ${id}`);
    assert.equal(P.colourOf(id, null), before(id));
    assert.equal(P.colourOf(id, "#cfc8bb"), "#cfc8bb");
    assert.equal(P.colourOf(id, "#000000"), before(id), "a colour off the palette is ignored");
  }
});

test("a picture's link carries its version", () => {
  assert.equal(P.pictureUrl("ab c", 1730000000000), "/api/people/ab%20c/picture?v=1730000000000");
});
