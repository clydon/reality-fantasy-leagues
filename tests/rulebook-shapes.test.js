// The library's pure parts (docs/PLAN-new-design.md step 10 part 3): the proposed shapes a rulebook is (rulebook-shapes.js),
// how a show's name finds its family, and templateFor reading the desk's templates (make-game.ts): one saved for a show's
// family, ours by name, a stored format's mirror, the newest the desk saved for a series or a talk show. Library rulebooks
// and made-up templates: no network or database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const M = jiti("../src/lib/game/make-game.ts");
const S = require("../src/lib/game/formats/rulebook-shapes.js");
const { LIBRARY } = require("../src/lib/game/formats/library/index.js");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");

const clone = (v) => JSON.parse(JSON.stringify(v));
const race = () => {
  const b = clone(LIBRARY["world-series"].blocks);
  b.segments = [{ id: "race", name: "The race", decidedBy: "result", takesPart: "everyone", decides: "fullOrder", onTheLine: "points", often: "everyEpisode" }];
  b.customMoments = [];
  b.points = {};
  return b;
};

test("the shapes a rulebook is, of its own kind only", () => {
  assert.deepEqual(S.shapesOf(race()), ["race"]);
  assert.deepEqual(S.shapesOf(BUILT_IN_BLOCKS.challenge.blocks), ["brackets"], "an elimination duel every episode");
  for (const id of ["survivor", "traitors"]) assert.deepEqual(S.shapesOf(BUILT_IN_BLOCKS[id].blocks), [], id);
  for (const id of Object.keys(LIBRARY)) assert.deepEqual(S.shapesOf(LIBRARY[id].blocks), [], id);
  const playoffs = race();
  playoffs.season.phases = [
    { id: "regular", name: "Regular season", starts: { type: "episode", n: 1 }, changes: [] },
    { id: "playoffs", name: "Playoffs", starts: { type: "announced" }, changes: [] },
  ];
  assert.deepEqual(S.shapesOf(playoffs).sort(), ["playoffs", "race"]);
  const awards = clone(LIBRARY["saturday-night-live"].blocks);
  assert.deepEqual(S.shapesOf(awards), []);
  awards.segments.push({ id: "bestPicture", name: "Best Picture", decidedBy: "vote", voters: "jury", decides: "winner", often: "everyEpisode" });
  assert.deepEqual(S.shapesOf(awards), ["awards"]);
  assert.equal(S.SHAPES.length, 8);
  assert.equal(S.shapeById("race").name, "Race series");
});

test("a show's family: no country, edition or leading The; one name the start of another's in whole words", () => {
  assert.equal(S.familyOf("The Amazing Race (American edition)"), "amazing race");
  assert.equal(S.familyOf("Love Island USA"), "love island");
  assert.equal(S.familyOf("RuPaul's Drag Race UK"), "rupauls drag race");
  assert.equal(S.familyOf("Formula 1 2026"), "formula 1");
  assert.ok(S.sameFamily("Below Deck", "Below Deck Mediterranean"));
  assert.ok(S.sameFamily("Big Brother US", "Big Brother Canada"));
  assert.ok(S.sameFamily("The Challenge", "The Challenge: USA"));
  assert.ok(S.sameFamily("NASCAR", "NASCAR Cup Series"));
  assert.ok(!S.sameFamily("Love", "Love Island"), "one short word isn't a family");
  assert.ok(!S.sameFamily("Formula 1", "Formula E"));
  assert.ok(!S.sameFamily("", "Survivor"));
});

test("templateFor reads the desk's library", () => {
  const t = (id, name, kind, shows, saved, start = null) => ({ id, name, kind, start, shows, saved, blocks: { kind, start } });
  const library = [
    t("saved-yacht", "ZT Yacht Life", "series", ["ZT Yacht Life"], true, "reality"),
    t("race", "Race series", "sport", ["ZT Rally", "Formula 1", "NASCAR"], true),
    t("talk", "Late night", "talk", ["The Tonight Show"], true),
    t("mirror-bb", "Big Brother US", "competition", ["Big Brother US"], false),
    t("mirror-survivor", "Survivor", "competition", ["Survivor"], false),
  ];
  // A template the desk saved for a show's family, whatever the listing guessed.
  assert.deepEqual(M.templateFor({ name: "ZT Yacht Life Riviera", kind: "competition", type: "Reality" }, library), { from: "rulebook", id: "saved-yacht" });
  assert.deepEqual(M.templateFor({ name: "NASCAR Cup Series", kind: "sport" }, library), { from: "rulebook", id: "race" });
  // Ours by name before a mirror; a mirror by name before nothing.
  assert.deepEqual(M.templateFor({ name: "Survivor South Africa", kind: "competition" }, library), { from: "builtin", id: "survivor" });
  assert.deepEqual(M.templateFor({ name: "Big Brother Canada", kind: "competition" }, library), { from: "rulebook", id: "mirror-bb" });
  // The newest the desk saved for a series (its start) or a talk show; never by kind for a competition or a sport.
  assert.deepEqual(M.templateFor({ name: "Harbour Crew", kind: "series", type: "Documentary" }, library), { from: "rulebook", id: "saved-yacht" });
  assert.deepEqual(M.templateFor({ name: "Some Drama", kind: "series", type: "Scripted" }, library), { from: "library", id: "scrubs" }, "no scripted series saved: ours");
  assert.deepEqual(M.templateFor({ name: "The Late Late Show", kind: "talk", type: "Talk Show" }, library), { from: "rulebook", id: "talk" });
  assert.equal(M.templateFor({ name: "Some Reality Show", kind: "competition", type: "Reality" }, library), null);
  assert.equal(M.templateFor({ name: "Some Ball Game", kind: "sport" }, library), null);
  // A rulebook row's blocks come from the library it was given.
  assert.equal(M.templateBlocks({ from: "rulebook", id: "race" }, library).kind, "sport");
  assert.equal(M.templateBlocks({ from: "rulebook", id: "gone" }, library), null);
});
