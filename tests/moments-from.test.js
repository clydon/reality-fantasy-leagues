// Settings Round 3b (A17, BACKLOG 230; docs/design-round/settings-r3b-spec.md, "When the show's rules change mid-season"): a moment a
// game's rules gained mid-season counts from the episode the game's rule says. The gate (StateLogic's momentFrom, read by
// ActiveRosterLogic.pointsFor): before its episode it scores nothing, from it on as before, settled from the start everywhere; a
// points table (no episode) shows its points. The recording (db/rulebooks.js recordAddedMoments) on a stand-in database: only ids
// the rules didn't have, the next episode to air, a vote's close, nothing for "from the start" or a season with nothing left to air,
// and the show's default (a show's first season here counts from the start). The vote and the screens are proven by
// scripts/dev-test/check-settings-r3b.js. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const StateLogic = require("../src/lib/game/state-logic.js");
const { recordAddedMoments } = require("../db/rulebooks.js");

function makeState(momentsFrom) {
  return StateLogic.migrateLeagueState({
    settings: { leagueTypeId: "active-roster", activeSlots: 2, benchSlots: 1, showFormat: "survivor", startEpisode: 1, ...(momentsFrom ? { momentsFrom } : {}) },
    players: [{ id: "p1", name: "Ann", color: "#111" }],
    castaways: ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase(), ownerIds: ["p1"], status: "active" })),
    episodes: [1, 2, 3, 4].map((n) => ({
      id: `ep${n}`,
      number: n,
      events: [],
      lineups: n === 1 ? { p1: ["a", "b"] } : {},
      scoringEvents: [{ id: `s${n}`, type: "individualImmunity", castawayId: "a" }],
    })),
  });
}
const total = (s) => StateLogic.computeScores(s).find((r) => r.playerId === "p1").total;
const per = (s) => StateLogic.ActiveRosterLogic.pointsFor(s, "individualImmunity");
const added = (more) => ({ individualImmunity: { from: 3, at: "2026-11-21T00:00:00Z", name: "Individual immunity win", points: null, rule: "next", closes: null, ...more } });

test("a moment gained mid-season scores nothing before its episode, as before from it on", () => {
  const plain = makeState();
  const gated = makeState(added());
  assert.equal(total(plain), 4 * per(plain), "every episode counts with no entry");
  assert.equal(total(gated), 2 * per(gated), "Episodes 3 and 4 only");
  assert.equal(StateLogic.ActiveRosterLogic.pointsFor(gated, "individualImmunity", 2), 0);
  assert.equal(StateLogic.ActiveRosterLogic.pointsFor(gated, "individualImmunity", 3), per(gated));
  assert.equal(per(gated), per(plain), "a points table (no episode) shows its points");
});

test("settled from the start (a vote, or whoever runs it), it counts everywhere; settled from the next episode, as recorded", () => {
  assert.equal(total(makeState(added({ settled: { to: "start", by: "vote", at: "x" } }))), 4 * per(makeState()));
  assert.equal(total(makeState(added({ settled: { to: "next", by: "nobody", at: "x" } }))), 2 * per(makeState()));
});

/** A stand-in database: the show's seasons, and the next episode to air (or none). */
function db({ seasons = 3, next = { number: 8, air_at: new Date("2026-11-25T01:00:00Z") } } = {}) {
  return {
    query: async (sql) => {
      if (/count\(\*\)/.test(sql)) return { rows: [{ n: seasons }] };
      if (/season_episodes/.test(sql)) return { rows: next ? [next] : [] };
      throw new Error(`unexpected: ${sql}`);
    },
  };
}
const { BUILT_IN_BLOCKS } = require("../src/lib/game/formats/blocks/index.js");
const { compileRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const { momentIdsOf } = require("../db/rulebooks.js");
const DATA = compileRulebook(BUILT_IN_BLOCKS.survivor.blocks, { aliases: BUILT_IN_BLOCKS.survivor.aliases || {} }).data;
const settings = (more) => ({ rulebook: { data: DATA, reader: "survivor" }, ...more });
const IDS = momentIdsOf(settings().rulebook);
const NEW = IDS[0];
const BEFORE = IDS.slice(1);

test("recording: only ids it didn't have, from the next episode to air; a vote closes at that airtime", async () => {
  assert.ok(IDS.length > 5, "the survivor rulebook's moments");
  const s = settings({ newMoments: "vote" });
  assert.deepEqual(await recordAddedMoments(db(), "s1", s, BEFORE), [NEW]);
  assert.equal(s.momentsFrom[NEW].from, 8);
  assert.equal(s.momentsFrom[NEW].rule, "vote");
  assert.equal(s.momentsFrom[NEW].closes, "2026-11-25T01:00:00.000Z");
  assert.ok(s.momentsFrom[NEW].name && s.momentsFrom[NEW].name !== NEW, "its name, for the players' line");
  assert.deepEqual(await recordAddedMoments(db(), "s1", s, BEFORE), [], "recorded once: a later sync leaves it as it was");
  assert.deepEqual(await recordAddedMoments(db(), "s1", settings({ newMoments: "next" }), IDS), [], "nothing new, nothing recorded");
});

test("recording: from the start records nothing; nothing left to air records nothing; a first season defaults to the start", async () => {
  const one = settings({ newMoments: "start" });
  assert.deepEqual(await recordAddedMoments(db(), "s1", one, BEFORE), []);
  assert.equal(one.momentsFrom, undefined);
  assert.deepEqual(await recordAddedMoments(db({ next: null }), "s1", settings({ newMoments: "next" }), BEFORE), []);
  assert.deepEqual(await recordAddedMoments(db({ seasons: 1 }), "s1", settings({}), BEFORE), [], "a show's first season counts from the start");
  const known = settings({});
  assert.deepEqual(await recordAddedMoments(db({ seasons: 4 }), "s1", known, BEFORE), [NEW]);
  assert.equal(known.momentsFrom[NEW].rule, "next");
  assert.equal(known.momentsFrom[NEW].closes, null);
});
