// Make it a game, the pure half (docs/PLAN-new-design.md step 10 part 2a; src/lib/game/make-game.ts): the rulebook a new
// show's prompt starts from, the kind chosen on the review, an answer that doesn't quite fit made usable, the cast from a
// TV listing, and the lines shown while it's asked. Library rulebooks and made-up listings: no network or database.
// Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const M = jiti("../src/lib/game/make-game.ts");
const { blocksProblems } = require("../src/lib/game/formats/rulebook-schema.js");
const { compileRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const { LIBRARY } = require("../src/lib/game/formats/library/index.js");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");

test("the rulebook a new show starts from: by name, else the kind's nearest, never a guess for a reality show", () => {
  assert.deepEqual(M.templateFor({ name: "Survivor 2", kind: "competition" }), { from: "builtin", id: "survivor" });
  assert.deepEqual(M.templateFor({ name: "The Traitors (US)", kind: "competition" }), { from: "builtin", id: "traitors" });
  assert.deepEqual(M.templateFor({ name: "Below Deck Mediterranean", kind: "competition", type: "Reality" }), { from: "library", id: "below-deck" });
  assert.deepEqual(M.templateFor({ name: "The Real Housewives of Atlanta", kind: "competition" }), { from: "library", id: "the-real-housewives-of-beverly-hills" });
  assert.deepEqual(M.templateFor({ name: "Pluribus", kind: "series", type: "Scripted" }), { from: "library", id: "scrubs" });
  assert.deepEqual(M.templateFor({ name: "Vanderpump Rules", kind: "series", type: "Documentary" }), { from: "library", id: "below-deck" });
  assert.deepEqual(M.templateFor({ name: "The Late Show", kind: "talk", type: "Talk Show" }), { from: "library", id: "saturday-night-live" });
  assert.equal(M.templateFor({ name: "Love Island USA", kind: "competition", type: "Reality" }), null, "a reality show the listings can't tell apart");
  assert.equal(M.templateFor({ name: "Formula 1", kind: "sport", type: "Sports" }), null, "a race series isn't a ball game");
  assert.equal(M.startOf("Scripted"), "scripted");
  assert.equal(M.startOf("Animation"), "scripted");
  assert.equal(M.startOf("Documentary"), "reality");
  assert.equal(M.startOf("Reality"), null);
  assert.equal(M.templateBlocks({ from: "library", id: "scrubs" }).kind, "series");
  assert.equal(M.templateBlocks({ from: "builtin", id: "survivor" }).kind, "competition");
  assert.equal(M.templateBlocks(null), null);
});

test("the kind chosen on the review: hidden blocks emptied, a winner when it becomes a competition, nothing lost going back", () => {
  for (const [id, entry] of Object.entries(LIBRARY)) {
    for (const kind of ["competition", "series", "talk", "sport"]) {
      const b = M.withKind(entry.blocks, kind, kind === "series" ? "scripted" : null);
      assert.deepEqual(blocksProblems(b), [], `${id} as ${kind}`);
      assert.deepEqual(compileRulebook(b, { id: "x" }).problems, [], `${id} as ${kind} compiles`);
      assert.equal(b.kind, kind);
      assert.equal(b.start, kind === "series" ? "scripted" : undefined);
    }
  }
  const snl = LIBRARY["saturday-night-live"].blocks;
  const asComp = M.withKind(snl, "competition");
  assert.ok(asComp.waysOut.some((w) => w.means === "winner"), "a competition crowns someone");
  const race = LIBRARY["the-amazing-race"].blocks;
  const asTalk = M.withKind(race, "talk");
  assert.deepEqual(asTalk.waysOut, []);
  assert.deepEqual(asTalk.twists, []);
  assert.ok(race.waysOut.length > 0, "the answer itself is untouched");
  assert.deepEqual(M.withKind(asTalk, "competition").waysOut.map((w) => w.means), ["winner"]);
  assert.equal(M.withKind(LIBRARY["below-deck"].blocks, "series").start, "reality", "a series keeps where it starts from");
});

test("an answer that doesn't quite fit: what doesn't is left out and listed, a part's way out keeps its name", () => {
  const b = JSON.parse(JSON.stringify(BUILT_IN_BLOCKS.survivor.blocks));
  b.customMoments = [{ id: "cried", label: "Cried at camp", counted: "sometimes", answeredBy: "research" }];
  b.points = { cried: 2 };
  const tribal = b.segments.find((s) => s.id === "tribalCouncil");
  tribal.voters = "theStudioAudience";
  const r = M.salvage(b);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.dropped.sort(), ["Cried at camp", "Tribal Council"].sort());
  assert.equal(r.blocks.points.cried, undefined);
  assert.ok(!r.blocks.segments.some((s) => s.id === "tribalCouncil"));
  const voted = r.blocks.waysOut.find((w) => w.name === "Voted out");
  assert.ok(voted && voted.cause === undefined, "the way out stays, without its cause");
  assert.deepEqual(compileRulebook(r.blocks, { id: "x" }).problems, []);
  // A part with a problem goes, but what only pointed at it lets go: Tribal Council stays without the tribe that skipped it,
  // and being chosen for a reward stays without leaving out the reward's winners.
  const broken = JSON.parse(JSON.stringify(BUILT_IN_BLOCKS.survivor.blocks));
  broken.segments.find((s) => s.id === "immunityChallenge").often = "sometimes";
  broken.segments.find((s) => s.id === "rewardChallenge").often = "sometimes";
  const kept = M.salvage(broken);
  assert.deepEqual(kept.problems, []);
  assert.deepEqual(kept.dropped.sort(), ["Immunity challenge", "Reward challenge"]);
  assert.ok(kept.blocks.segments.some((s) => s.id === "tribalCouncil" && s.skippedBy === undefined));
  assert.ok(kept.blocks.customMoments.some((m) => m.id === "chosenForReward" && m.exceptWinners === undefined));
  // What can't be left out stays a problem.
  const noCast = JSON.parse(JSON.stringify(BUILT_IN_BLOCKS.survivor.blocks));
  noCast.cast.unit = "robots";
  assert.ok(M.salvage(noCast).problems.some((p) => p.at === "cast.unit"));
});

test("the cast from a TV listing: a scripted series' characters, else the people, each once", () => {
  const rows = [
    { person: { name: "Lee Actor", image: { medium: "lee.jpg" } }, character: { name: "Nora Vale", image: { medium: "nora.jpg" } } },
    { person: { name: "Max Player", image: null }, character: { name: "Dr. Ives", image: null } },
    { person: { name: "Host Person", image: { medium: "h.jpg" } }, character: { name: "Self" }, self: true },
    { person: { name: "Lee Actor" }, character: { name: "Nora Vale" } },
  ];
  assert.deepEqual(M.castFromListing(rows, "scripted"), [
    { name: "Nora Vale", photoUrl: "nora.jpg", group: null, note: "Lee Actor" },
    { name: "Dr. Ives", photoUrl: null, group: null, note: "Max Player" },
    { name: "Host Person", photoUrl: "h.jpg", group: null, note: null },
  ]);
  const crew = [
    { person: { name: "Cap Rivers", image: { medium: "k.jpg" } }, character: { name: "Captain" } },
    { person: { name: "Bo Sun" }, character: { name: "Bo Sun" } },
    { person: { name: "Dee Chief" }, character: { name: "Herself" } },
  ];
  assert.deepEqual(M.castFromListing(crew, "reality").map((c) => [c.name, c.note]), [
    ["Cap Rivers", "Captain"],
    ["Bo Sun", null],
    ["Dee Chief", null],
  ]);
  assert.equal(M.castFromListing(Array.from({ length: 60 }, (_, i) => ({ person: { name: `P${i}` } })), null).length, M.LISTING_CAST_MAX);
});

test("what was found, a line each, and who needs a cast", () => {
  const surv = BUILT_IN_BLOCKS.survivor.blocks;
  const cast = Array.from({ length: 18 }, (_, i) => ({ name: `C${i}`, photoUrl: null, group: ["Red", "Blue", "Green"][i % 3], note: null }));
  const lines = M.foundLines(surv, cast);
  assert.equal(lines[0], "18 castaways in 3 tribes");
  assert.match(lines[1], /^How an episode runs: \d+ parts$/);
  assert.match(lines[2], /^\d+ things that score$/);
  assert.equal(lines[3], "A competition");
  assert.deepEqual(M.foundLines(null, null), []);
  const snl = M.foundLines(LIBRARY["saturday-night-live"].blocks, null);
  assert.match(snl[1], /moments for bingo and calls$/);
  assert.equal(M.kindName("series", "scripted"), "A series · scripted");
  assert.equal(M.needsCast("talk"), false);
  assert.equal(M.needsCast("sport"), true);
});
