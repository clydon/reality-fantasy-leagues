// Settings Round 4, the words and the ripple (docs/design-round/settings-r4-spec.md). How it plays says Round 3b's two rules (BACKLOG
// 243): an empty slot filled from the bench, and when a moment the show adds mid-season counts. Start a game says a running game's
// words (the waiver feels as Relaxed · Standard · Strict), no longer offers Lineups hidden (the app hides others' lineups until the
// lock whatever it says), and its Waivers can be turned on from off (it set a window "every 1 episode", which the schema refuses, and
// showed the schema's rule as the reason). The screens are in scripts/dev-test/story-settings.js `--only=^r4-`. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const root = path.join(__dirname, "..");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(root, "src") } });
const StateLogic = require("../src/lib/game/state-logic.js");
const Gallery = require("../src/lib/game/start-gallery/index.js");
const Schema = require("../src/lib/game/game-spec/schema.js");
const { gameRules } = jiti("../src/lib/game/game-rules.ts");
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
const { compileRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const RULEBOOK = { data: compileRulebook(BUILT_IN_BLOCKS.survivor.blocks, { aliases: BUILT_IN_BLOCKS.survivor.aliases || {} }).data, reader: "survivor" };

/** A Weekly Lineup on Survivor: two start of four, on the show's rulebook when `rulebook`. */
function lineupGame(settings = {}, rulebook = true) {
  return StateLogic.migrateLeagueState({
    settings: { leagueTypeId: "active-roster", activeSlots: 2, benchSlots: 2, showFormat: "survivor", startEpisode: 1, ...(rulebook ? { rulebook: RULEBOOK } : {}), ...settings },
    players: [{ id: "p1", name: "Ann", color: "#111" }],
    castaways: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase(), ownerIds: ["p1"], status: "active" })),
    episodes: [1, 2, 3].map((n) => ({ id: `ep${n}`, number: n, events: [], lineups: {}, scoringEvents: [] })),
  });
}
const BENCH = /a starter goes home and nobody changes the lineup, the first on the bench starts\./;
const MOMENTS = /If the show adds a moment mid-season/;

test("How it plays: the bench rule only where the game fills from the bench, after the lineup's lock", () => {
  assert.equal(gameRules(lineupGame()).some((r) => BENCH.test(r)), false, "off: nothing said");
  const on = gameRules(lineupGame({ benchFill: 1 }));
  const i = on.findIndex((r) => BENCH.test(r));
  assert.ok(i > 0 && /^Lineups lock/.test(on[i - 1]), `said after the lock: ${JSON.stringify(on)}`);
  assert.equal(on[i], "If a starter goes home and nobody changes the lineup, the first on the bench starts.", "on from the first episode: no 'from'");
  assert.ok(gameRules(lineupGame({ benchFill: 4 })).includes("From Episode 4, if a starter goes home and nobody changes the lineup, the first on the bench starts."), "the episode leads");
});

test("How it plays: when a new moment counts, the game's choice or the show's default, on a game on the show's rulebook", () => {
  const said = (settings, fallback, rulebook = true) => gameRules(lineupGame(settings, rulebook), undefined, fallback).filter((r) => MOMENTS.test(r));
  assert.deepEqual(said({ newMoments: "start" }), ["If the show adds a moment mid-season, it counts from the start: the episodes already played count it too."]);
  assert.deepEqual(said({ newMoments: "next" }), ["If the show adds a moment mid-season, it counts from the next episode on."]);
  assert.match(said({ newMoments: "vote" })[0], /you vote on whether it counts from the start or only from the next episode\. Until you decide, it's the next episode\.$/);
  assert.deepEqual(said({}, "next"), ["If the show adds a moment mid-season, it counts from the next episode on."], "unset: the show's default");
  assert.deepEqual(said({ newMoments: "start" }, "next"), ["If the show adds a moment mid-season, it counts from the start: the episodes already played count it too."], "the game's choice wins");
  assert.deepEqual(said({}, undefined), [], "nothing known: nothing said");
  assert.deepEqual(said({ newMoments: "next" }, "next", false), [], "a game with rules of its own (no rulebook) gains no moments");
  // Said where the points are.
  const rules = gameRules(lineupGame({ newMoments: "next" }));
  const at = rules.findIndex((r) => MOMENTS.test(r));
  assert.match(rules[at - 1], /^Points come from what happens/);
});

test("Start a game: the waiver feels in Manage this game's words; Lineups hidden is gone", () => {
  const waivers = Gallery.CHANGES.find((c) => c.id === "waivers");
  const feel = waivers.controls.find((k) => k.id === "feel");
  assert.deepEqual(feel.options.map((o) => o[1]), ["Relaxed", "Standard", "Strict"]);
  assert.equal(feel.rec, "balanced", "Standard carries the Recommended tag, as on Manage this game");
  assert.equal(Gallery.CHANGES.find((c) => c.id === "join").line, "Anyone on the couch, they ask first, or nobody new");
  assert.equal(Gallery.CHANGES.some((c) => c.id === "hidden"), false);
});

test("Start a game: Waivers turns on from off, with no schema rule as its reason", () => {
  const pg = Gallery.pageFacts({ castaway: "castaway", show: "Survivor 51" });
  const spec = Gallery.baseSpec(Gallery.baseById("fantasy"), { from: 1, to: null }, pg);
  spec.extras = { ...(spec.extras || {}), waivers: { ...Schema.NO_WAIVERS } };
  const off = Gallery.changeStates(spec, "details", pg).find((c) => c.id === "waivers");
  assert.deepEqual([off.on, off.why], [false, null], "off, and nothing in the way");
  const on = Gallery.applyChange(spec, "waivers", pg);
  assert.equal(on.extras.waivers.windows.schedule, "everyEpisode");
  assert.equal(Gallery.changeStates(on, "details", pg).find((c) => c.id === "waivers").on, true);
});
