// U1's sports slice, the pure parts (docs/PLAN-start-a-game-gpt.md U1): Sports scores too's rule (src/lib/sports/hide.ts: what a
// game may say while scores are hidden, and once its score is shown), the strip's unit in the show's own words (show-words.ts
// epShort: Wk, G, Ep, never "Ga"), an engine line in the show's words (inShowWords). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { gameWords, begun } = jiti("../src/lib/sports/hide.ts");
const { epShort, inShowWords, showWords } = jiti("../src/lib/game/show-words.ts");

const NOW = Date.parse("2026-11-09T20:00:00Z");
const at = (h) => new Date(NOW + h * 3600_000).toISOString();

test("a game still to come says its day and time, hidden or not", () => {
  const g = { id: "1", at: at(26), state: "pre", final: false };
  assert.equal(begun(g, NOW), false);
  for (const hidden of [true, false]) {
    const w = gameWords(g, hidden, false, NOW);
    assert.equal(w.open, true);
    assert.match(w.when, /Tomorrow/);
  }
});

test("hidden: a game on now or over says only when it started, never live, final or how long", () => {
  for (const g of [
    { id: "2", at: at(-1), state: "in", final: false },
    { id: "3", at: at(-4), state: "post", final: true },
    // listed "pre" past its start: begun by the clock
    { id: "4", at: at(-0.5), state: "pre", final: false },
  ]) {
    const w = gameWords(g, true, false, NOW);
    assert.equal(w.open, false, g.id);
    assert.match(w.when, /^Started /, g.id);
    assert.doesNotMatch(w.when, /Final|On now|OT|overtime|inning|quarter/i, g.id);
  }
});

test("shown for the visit, or sports live: On now and Final", () => {
  assert.equal(gameWords({ id: "2", at: at(-1), state: "in", final: false }, true, true, NOW).when, "On now");
  assert.equal(gameWords({ id: "3", at: at(-4), state: "post", final: true }, false, false, NOW).when, "Final");
});

test("a game called off says so: it wasn't played, so nothing's given away", () => {
  assert.equal(gameWords({ id: "5", at: at(-4), state: "post", final: false, called: "postponed" }, true, false, NOW).when, "Postponed");
});

test("the strip's unit: the world's short form, never two letters cut off", () => {
  assert.deepEqual(["Episode", "Week", "Game", "Round", "Race"].map(epShort), ["Ep", "Wk", "G", "Rd", "Race"]);
  assert.equal(showWords({ episode: "Game" }).ep, "G");
});

test("an engine line in the show's words", () => {
  const w = showWords({ episode: "Game" });
  assert.equal(inShowWords("Episodes 1–3 · Draft 3", w), "Games 1–3 · Draft 3");
  assert.equal(inShowWords("each episode", w), "each game");
  assert.equal(inShowWords("Episodes 1–3", showWords({ episode: "Episode" })), "Episodes 1–3");
});
