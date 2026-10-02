// Which leagues can share a chat and a reveal (src/lib/server/league-groups.ts). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { linkProblem } = jiti("../src/lib/server/league-groups.ts");

const league = (settings) => ({ settings: { showId: "survivor", wikiSeason: 50, ...settings } });

test("same season, revealing in step: can link", () => {
  assert.equal(linkProblem(league({}), league({})), null);
  assert.equal(linkProblem(league({ revealedThroughEpisode: 3 }), league({ revealedThroughEpisode: 3 })), null);
});

test("a different season, or reveals out of step, can't -- one would spoil the other", () => {
  assert.match(linkProblem(league({}), league({ wikiSeason: 49 })), /same season/);
  assert.match(linkProblem(league({}), league({ revealedThroughEpisode: 2 })), /catching up/);
  assert.match(linkProblem(league({ revealedThroughEpisode: 2 }), league({ revealedThroughEpisode: 4 })), /same episode/);
  assert.match(linkProblem(league({ showId: null }), league({})), /show and season/);
});
