// What a show calls things (src/lib/game/show-words.ts, db/migrations/0142): its episodes and its people, the tabs that use them
// (Schedule when the word won't fit or would read as the Games tab; Cast when the people's word won't fit), and a sport's word
// read from its listing's titles. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { showWords, pluralWord, episodeWordFromTitles } = jiti("../src/lib/game/show-words.ts");

test("a show made of episodes keeps Episode, Ep and its people's word", () => {
  const w = showWords({ castaway: "Castaway", episode: "Episode" });
  assert.deepEqual([w.episode, w.episodes, w.ep, w.people, w.peopleTab, w.episodesTab], ["Episode", "Episodes", "Ep", "Castaways", "Castaways", "Episodes"]);
  assert.equal(showWords(null).episode, "Episode");
  assert.equal(showWords(null).peopleTab, "Cast", "Cast members won't fit a tab");
  // The Traitors calls its people "Cast": a group word, not "Casts".
  assert.deepEqual([showWords({ castaway: "Cast" }).people, showWords({ castaway: "Cast" }).person], ["Cast", "Cast member"]);
});

test("a baseball series: Game, Players, and Schedule for its tab (Games is the app's tab)", () => {
  const w = showWords({ castaway: "Player", episode: "Game" });
  assert.deepEqual([w.episode, w.ep, w.episodes, w.episodesTab, w.peopleTab], ["Game", "Game", "Games", "Schedule", "Players"]);
});

test("F1: Races and Drivers; a long word falls back", () => {
  const w = showWords({ castaway: "driver", episode: "race" });
  assert.deepEqual([w.episode, w.episodesTab, w.peopleTab], ["Race", "Races", "Drivers"]);
  assert.equal(showWords({ episode: "Tournament round" }).episodesTab, "Schedule");
});

test("plurals, and a word that's already plural", () => {
  assert.deepEqual(["Celebrity", "Match", "Contestants", "Houseguest"].map(pluralWord), ["Celebrities", "Matches", "Contestants", "Houseguests"]);
});

test("a sport's word from its titles: more than half start with it before a number", () => {
  assert.equal(episodeWordFromTitles(["Game 1: Rays at Brewers", "Game 2: Rays at Brewers", null, "Game 3: Brewers at Rays"]), "Game");
  assert.equal(episodeWordFromTitles(["Race 1", "Bahrain Grand Prix", "Saudi Grand Prix"]), null);
  assert.equal(episodeWordFromTitles([]), null);
  assert.equal(episodeWordFromTitles(["Week 1: Bills at Jets", "Week 2: Jets at Pats"]), null, "a word that says when isn't one");
});
