// Fill in what happened (src/lib/server/episode-recaps.ts, db/migrations/0143): the prompt asks about each missing episode in the
// show's own words (a sport's score and who won), and an answer's recaps are read from its JSON, fenced or not, only for episodes
// that were asked about, trimmed. Saving and the spoiler guard are checked against the database by
// scripts/dev-test/check-show-words.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
// "@db": the module reaches db/ through research-asks.ts (results looked up alongside, 0152).
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src"), "@db": path.join(__dirname, "..", "db") } });
const { readHeadlines, readRecaps, recapPrompt } = jiti("../src/lib/server/episode-recaps.ts");
const { HEADLINE_MAX } = jiti("../src/lib/game/recap-text.ts");
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
  assert.match(recapPrompt(plan("competition", "Episode")), /in the past tense: the main things that happened in that episode, and who left or won anything/);
  assert.match(recapPrompt(plan("competition", "Episode")), /no links, sources or citations/);
});

test("an answer's recaps: fenced JSON, only what was asked, trimmed", () => {
  const answer = 'Here you go:\n```json\n{"episodes": [{"number": 1, "summary": "  Rays 5,   Brewers 3. "}, {"number": 9, "summary": "not asked"}, {"number": 2, "summary": ""}]}\n```';
  const got = readRecaps(answer, [1, 2]);
  assert.deepEqual([...got.entries()], [[1, "Rays 5, Brewers 3."]]);
  assert.equal(readRecaps("no JSON here", [1]).size, 0);
  assert.equal(readRecaps('{"episodes": "nope"}', [1]).size, 0);
  assert.equal(readRecaps(`{"episodes":[{"number":1,"summary":"${"x".repeat(1500)}"}]}`, [1]).get(1).length, 1000);
});

test("headlines: one stated limit, 45 characters, asked for and enforced alike", () => {
  assert.equal(HEADLINE_MAX, 45);
  for (const kind of ["competition", "sport"]) assert.match(recapPrompt(plan(kind, "Episode")), new RegExp(`Each headline is one line of ${HEADLINE_MAX} characters or fewer`));
  const migration = require("fs").readFileSync(require("path").join(__dirname, "..", "db", "migrations", "0456_episode_headlines.sql"), "utf8");
  assert.ok(migration.includes(`CHECK (length(headline) <= ${HEADLINE_MAX})`), "the database refuses longer");
  const prod = require("../scripts/headlines-once.prod-answer.json").headlines;
  assert.deepEqual(prod.filter((h) => h.headline.length > HEADLINE_MAX), [], "the one-time answer fits");
  assert.equal(readHeadlines(JSON.stringify({ episodes: [{ number: 1, headline: "y".repeat(HEADLINE_MAX + 1), summary: "s" }] }), [1]).size, 0, "longer is dropped");
});

test("headlines: asked for with each recap, one clean line each, dropped when too long, never cut", () => {
  assert.match(recapPrompt(plan("competition", "Episode")), /"headline": "\.\.\.", "summary"/);
  assert.match(recapPrompt(plan("competition", "Episode")), /Each headline is one line of 45 characters or fewer, in the past tense, the way a TV recap would title it: who left and how/);
  assert.ok(recapPrompt(plan("competition", "Episode")).includes("Name everyone who left. No semicolons: join two facts with a comma."));
  assert.match(recapPrompt(plan("sport", "Game")), /Each headline is one line of 45 characters or fewer: the final score with who won/);
  const json = { episodes: [{ number: 1, headline: "Patt blindsided 6–5.", summary: "Patt went home." }, { number: 2, headline: "x".repeat(90), summary: "Nobody left." }, { number: 3, headline: "Not asked", summary: "Never asked." }] };
  const answer = "```json\n" + JSON.stringify(json) + "\n```";
  const got = readHeadlines(answer, [1, 2]);
  assert.deepEqual([...got], [[1, "Patt blindsided 6–5"]]);
  assert.equal(readRecaps(answer, [1, 2]).size, 2, "a recap without a usable headline is still a recap");
});
