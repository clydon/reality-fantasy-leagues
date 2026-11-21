// Tonight's night has a design for every kind of game (src/lib/game/night-rows.ts; docs/design-round/tonight-night-spec.md): every
// main block the game page's grammar can give a spec (game-page/grammar.ts mainOf) has a row, closed and open, with a value for
// each of its parts. A new kind of game fails here (and in tsc) until Tonight has one; docs/UI-REVIEW-MAP.md says what else to
// review. Pure: no database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { NIGHT_ROWS, nightRowOf } = jiti("../src/lib/game/night-rows.ts");
const { mainOf } = jiti("../src/lib/game/game-page/grammar.ts");

// The main blocks, as the grammar's type lists them (read from the source, so a block added there is seen here).
const grammar = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "game", "game-page", "grammar.ts"), "utf8");
const MAIN = [...grammar.match(/export type MainBlock =([^;]+);/)[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);

test("every main block the grammar names has a Tonight row", () => {
  assert.ok(MAIN.length >= 15, `the grammar's main blocks: ${MAIN.join(", ")}`);
  for (const main of MAIN) assert.ok(NIGHT_ROWS[main], `Tonight has no row for "${main}": add it to src/lib/game/night-rows.ts`);
  for (const main of Object.keys(NIGHT_ROWS)) assert.ok(MAIN.includes(main), `night-rows.ts has "${main}", which the grammar no longer names`);
});

test("each row says what its faces, change, line and open state are", () => {
  const ok = { faces: ["plays", "none"], change: ["points", "night", "result", "lives", "week", "lines"], line: ["total", "opponent", "target", "lives", "weeks", "stage", "worth"], open: ["everyone", "matchups"] };
  for (const [main, d] of Object.entries(NIGHT_ROWS)) {
    for (const [k, values] of Object.entries(ok)) assert.ok(values.includes(d[k]), `${main}.${k} is "${d[k]}"`);
    assert.equal(typeof d.place, "boolean", `${main}.place`);
  }
});

test("the rows follow the games they're for", () => {
  // Every kind of spec reaches a row: the grammar's own examples, one per main block.
  const specs = [
    { rank: { by: "coop" } }, { rank: { by: "total", race: { to: 20 } } }, { rank: { by: "matchups" } }, { rank: { by: "categories" } },
    { rank: { by: "worth" } }, { rank: { by: "weeks" } }, { get: { by: "squares" } }, { get: { by: "card" } }, { score: { hits: "objective" } },
    { get: { by: "draft" } }, { get: { by: "pick" }, score: { by: "moments" } }, { get: { by: "pick" }, score: { by: "survive" } },
    { ask: [{ each: "game" }] }, { ask: [{ answer: "pick" }] },
  ];
  for (const spec of specs) assert.ok(nightRowOf(mainOf(spec)), JSON.stringify(spec));
  assert.equal(NIGHT_ROWS.together.place, false, "a co-op game has no place to show");
  assert.equal(NIGHT_ROWS.matchup.open, "matchups", "head to head opens on the episode's matchups");
  assert.equal(NIGHT_ROWS.ladder.change, "night", "a pool says its pick's night in a word");
  assert.equal(nightRowOf("not-a-block"), NIGHT_ROWS.ballot, "an unknown block reads as a game of questions");
});
