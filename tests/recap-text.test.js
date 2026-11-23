// An episode's write-up as people read it (src/lib/game/recap-text.ts): the recap search's citation markup never reaches a
// screen (Tonight's Last time, the reveal, Episodes). The S51 rows are the real shapes seen in the local copy (2026-11-23).
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { plainRecap } = jiti("../src/lib/game/recap-text.ts");

const BODY = "Ori was voted out, leaving Jelly and Devin as the tribe's only remaining members.";

test("a trailing markdown source goes", () => {
  assert.equal(plainRecap(`${BODY} [Source: Paramount+ recap](https://www.paramountplus.com/sneak-peak/survivor-season-51-episode-6-recap/)`), BODY);
  assert.equal(plainRecap(`${BODY} [Source: Survivor Tribes recap](https://survivortribes.com/season/episode/s51-3)`), BODY);
  assert.equal(plainRecap(`${BODY} ([Source](https://example.com/a))`), BODY);
  assert.equal(plainRecap(`${BODY} [Sources: A](https://a.example) [B](https://b.example)`), BODY);
});

test("a trailing plain source with its address goes", () => {
  assert.equal(plainRecap(`${BODY} Source: Bravo (https://www.bravotv.com/below-deck)`), BODY);
});

test("another link keeps its words, a bare address goes", () => {
  assert.equal(plainRecap("Kerry read the [guest sheet](https://example.com/x) twice."), "Kerry read the guest sheet twice.");
  assert.equal(plainRecap("Aesha quit (https://example.com/y)."), "Aesha quit.");
});

test("a clean write-up is untouched, spaces tidied", () => {
  const clean = "Rainbeau's management style creates tension with members of the interior team. Chef Moe plays matchmaker.";
  assert.equal(plainRecap(clean), clean);
  assert.equal(plainRecap(`  ${clean}\n `), clean);
  assert.equal(plainRecap("The source of the fight was the laundry."), "The source of the fight was the laundry.");
  assert.equal(plainRecap(""), "");
});

const { capRecap, namesAnyone } = jiti("../src/lib/game/recap-text.ts");

test("a long write-up is kept by whole sentences, else whole words", () => {
  const two = "Patt Cannaday was blindsided and voted out 6–5. Carter sided against the majority alliance at Toka's Tribal Council.";
  assert.equal(capRecap(two, 200), two);
  assert.equal(capRecap(two, 80), "Patt Cannaday was blindsided and voted out 6–5.");
  assert.equal(capRecap(two, 110), "Patt Cannaday was blindsided and voted out 6–5. Carter sided against the majority alliance at Toka's Tribal…", "under half: whole words");
  assert.equal(capRecap("Carter sided against the majority alliance at Tribal Council", 30), "Carter sided against the…");
});

test("a write-up names someone who left, by any part of their name", () => {
  const t = "Rob Antonson quit the game. At Toka's Tribal Council, Patt Cannaday was blindsided and voted out 6–5.";
  assert.equal(namesAnyone(t, ["Rob Antonson", "Patt Cannaday"]), true);
  assert.equal(namesAnyone("Kilby and Kristin were eliminated.", ["Danny 'Kilby' Kilby", "Kristin Flickinger"]), true);
  assert.equal(namesAnyone("Izzy lost to Cassidy.", ["Isabella “Izzy” Fairthorne"]), true, "a nickname in quotes");
  assert.equal(namesAnyone("Xavier was murdered.", ["Xavier Scruggs", "Madeline Kostopulos", "Kim Daily"]), true, "results that carry last episode's leavers");
  assert.equal(namesAnyone(t, ["Ana Sani"]), false, "another episode's boot");
  assert.equal(namesAnyone("A banana split the tribe.", ["Ana Sani"]), false, "a name part inside a word doesn't count");
  assert.equal(namesAnyone(t, []), true, "nobody left: nothing to name");
});

const { plainHeadline } = jiti("../src/lib/game/recap-text.ts");

test("a headline is one clean line, never cut", () => {
  assert.equal(plainHeadline("Rob walks out, Patt blindsided 6–5."), "Rob walks out, Patt blindsided 6–5");
  assert.equal(plainHeadline("“Aesha's rules split the interior”"), "Aesha's rules split the interior");
  assert.equal(plainHeadline("Kerry tips the galley [Source: Bravo](https://www.bravotv.com/x)"), "Kerry tips the galley");
  assert.equal(plainHeadline("x".repeat(45)), "x".repeat(45), "45 characters: kept");
  assert.equal(plainHeadline("x".repeat(46)), null, "46: dropped, not cut");
  assert.equal(plainHeadline(""), null);
  assert.equal(plainHeadline(42), null);
});

const { headlineAgrees, keepCounts } = jiti("../src/lib/game/recap-text.ts");

test("a headline shows only when it agrees with the write-up and the plates", () => {
  const s = "Rob Antonson quit the game. At Toka's Tribal Council, Patt Cannaday was blindsided and voted out 6–5.";
  assert.equal(headlineAgrees("Rob quit, Patt blindsided and voted out 6–5", s, ["Rob Antonson", "Patt Cannaday"]), true);
  assert.equal(headlineAgrees("Rob quit, Patt blindsided 6-5", s, ["Rob Antonson", "Patt Cannaday"]), true, "a hyphen counts as the dash");
  assert.equal(headlineAgrees("A blindside at Tribal Council, 6–5", s, ["Rob Antonson", "Patt Cannaday"]), false, "names nobody who left");
  assert.equal(headlineAgrees("Rob quit, Patt blindsided 7–4", s, ["Rob Antonson", "Patt Cannaday"]), false, "a count the write-up doesn't have");
  assert.equal(headlineAgrees("Aesha's rules split the interior", "Aesha set rules.", []), true, "nobody left, no count");
});

test("a count keeps its dashes on one line", () => {
  assert.equal(keepCounts("banished 8–3–3–1"), "banished 8⁠–⁠3⁠–⁠3⁠–⁠1");
  assert.equal(keepCounts("voted out 6 - 5"), "voted out 6⁠-⁠5");
  assert.equal(keepCounts("a well-run tribe"), "a well-run tribe");
});
