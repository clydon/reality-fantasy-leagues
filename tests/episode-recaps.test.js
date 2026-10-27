// Fill in what happened (src/lib/server/episode-recaps.ts, db/migrations/0143): the prompt asks about each missing episode in the
// show's own words (a sport's score and who won), and an answer's recaps are read from its JSON, fenced or not, only for episodes
// that were asked about, trimmed. Saving and the spoiler guard are checked against the database by
// scripts/dev-test/check-show-words.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { readRecaps, recapPrompt } = jiti("../src/lib/server/episode-recaps.ts");
const { showWords } = jiti("../src/lib/game/show-words.ts");

const plan = (kind, episode) => ({
  show: "World Series",
  seasonLabel: "season 2026",
  kind,
  words: showWords({ castaway: "Player", episode }),
  missing: [
    { number: 1, airAt: "2026-10-24T00:08:00.000Z", title: "Game 1: Rays at Brewers" },
    { number: 2, airAt: null, title: null },
  ],
});

test("the prompt: the show's words, a sport's score, each missing one with when and its title", () => {
  const p = recapPrompt(plan("sport", "Game"));
  assert.match(p, /these games of World Series \(season 2026\)/);
  assert.match(p, /the final score and who won/);
  assert.match(p, /- Game 1, aired Fri, Oct 23, 2026: "Game 1: Rays at Brewers"/);
  assert.match(p, /- Game 2\n?$/m);
  assert.match(recapPrompt(plan("competition", "Episode")), /who left or won anything/);
});

test("an answer's recaps: fenced JSON, only what was asked, trimmed", () => {
  const answer = 'Here you go:\n```json\n{"episodes": [{"number": 1, "summary": "  Rays 5,   Brewers 3. "}, {"number": 9, "summary": "not asked"}, {"number": 2, "summary": ""}]}\n```';
  const got = readRecaps(answer, [1, 2]);
  assert.deepEqual([...got.entries()], [[1, "Rays 5, Brewers 3."]]);
  assert.equal(readRecaps("no JSON here", [1]).size, 0);
  assert.equal(readRecaps('{"episodes": "nope"}', [1]).size, 0);
  assert.equal(readRecaps(`{"episodes":[{"number":1,"summary":"${"x".repeat(1500)}"}]}`, [1]).get(1).length, 1000);
});
