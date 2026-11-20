// Lineup slots by cast properties (docs/PLAN-cast-properties.md, chunk 5): count.slots beside count.start or count.best, "1 QB, 2 RB,
// 2 WR, 1 TE and a W/R/T", "start one Interior". A lineup is still stored as ids; validateLineup refuses someone no open slot takes
// (a short lineup is still fine), the bots and best ball take the best legal lineup, and football's standard games carry their
// defaults' slots. Each reads the per-read stamp (castProps), so a copy without it checks nothing. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");
const { defaultsFor } = jiti("../src/lib/sports/index.ts");
const D = require("../src/lib/game/game-spec/describe.js");

const NFL = [
  { label: "QB", of: "position", values: ["QB"], n: 1 },
  { label: "RB", of: "position", values: ["RB", "FB"], n: 2 },
  { label: "WR", of: "position", values: ["WR"], n: 2 },
  { label: "TE", of: "position", values: ["TE"], n: 1 },
  { label: "W/R/T", of: "position", values: ["WR", "RB", "FB", "TE"], n: 1 },
];
// [id, position, points this week]: a roster of eleven.
const ROSTER = [
  ["qb1", "QB", 22], ["qb2", "QB", 30], ["rb1", "RB", 14], ["rb2", "RB", 9], ["rb3", "RB", 7], ["wr1", "WR", 18],
  ["wr2", "WR", 12], ["wr3", "WR", 11], ["te1", "TE", 6], ["te2", "TE", 3], ["fb1", "FB", 2],
];
const lineupSpec = (count) => ({ preset: "weekly-lineup", get: { by: "draft", each: 11, order: "snake", own: "exclusive" }, count });

function league(count, { bots = [], roster = ROSTER, props = (pos) => ({ position: pos }) } = {}) {
  const people = ["ann", ...bots];
  const s = S.migrateLeagueState({
    settings: { ...G.settingsOf(lineupSpec(count)), showFormat: "survivor" },
    players: people.map((id) => ({ id, name: id, color: "#000", active: true, ...(bots.includes(id) ? { automated: true } : {}) })),
    draftOrder: people,
    tribes: [],
    castaways: roster.map(([id]) => ({ id, name: id.toUpperCase(), status: "active", tribeId: null, ownerIds: [bots[0] || "ann"], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: [{ id: "ep1", number: 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} }],
  });
  s.castProps = Object.fromEntries(roster.map(([id, pos]) => [id, props(pos)]));
  s.castPropDefs = [];
  return s;
}

test("the spec: slots beside start or best, adding up to the lineup, kept through the settings, said in words", () => {
  assert.deepEqual(G.specProblems(lineupSpec({ start: 7, slots: NFL }), null), []);
  assert.deepEqual(G.gameOf(G.settingsOf(lineupSpec({ start: 7, slots: NFL }))).count, { start: 7, slots: NFL });
  assert.match(G.specProblems(lineupSpec({ start: 8, slots: NFL }), null).map((p) => p.problem).join(), /add up to 7, and the lineup counts 8/);
  assert.match(G.specProblems(lineupSpec({ start: 7, slots: [{ of: "position", values: [], n: 7 }] }), null).map((p) => p.problem).join(), /one or more of its values/);
  const words = D.describeSpec(lineupSpec({ start: 7, slots: NFL }), {});
  assert.match(words.sentence, /starts 7 each episode \(1 QB, 2 RB, 2 WR, 1 TE and 1 W\/R\/T\)/);
  assert.ok(words.rules.some((r) => /a flex any of its positions/.test(r)));
  // A show's property: checked against the season's.
  const ctx = { moments: [], results: true, winner: true, roles: [], grouped: false, jury: false, phases: [], properties: [{ key: "department", name: "Department", values: ["Interior", "Deck"] }] };
  const show = lineupSpec({ start: 2, slots: [{ of: "department", values: ["Interior"], n: 1 }, { of: "department", values: ["Galley"], n: 1 }] });
  assert.match(G.specProblems(show, ctx).map((p) => p.problem).join(), /Department is one of Interior, Deck/);
});

test("validateLineup: nobody without an open slot, a short lineup still fine, a FLEX taking any of its positions", () => {
  const s = league({ start: 7, slots: NFL });
  const ok = ["qb2", "rb1", "rb2", "wr1", "wr2", "te1", "wr3"];
  assert.equal(S.ActiveRosterLogic.validateLineup(s, "ep1", "ann", ok), null, "the W/R/T takes a third WR");
  assert.match(S.ActiveRosterLogic.validateLineup(s, "ep1", "ann", ["qb1", "qb2"]), /QB2 has no open slot: the lineup is 1 QB, 2 RB, 2 WR, 1 TE, 1 W\/R\/T/);
  assert.match(S.ActiveRosterLogic.validateLineup(s, "ep1", "ann", ["te1", "te2", "fb1", "rb1", "rb2"]) || "", /has no open slot/);
  assert.equal(S.ActiveRosterLogic.validateLineup(s, "ep1", "ann", ["qb1", "te1"]), null, "short is fine");
  assert.deepEqual(S.SlotLogic.assignment(s, ok).map((x) => `${x.label}:${x.id}`), ["QB:qb2", "RB:rb1", "RB:rb2", "WR:wr1", "WR:wr2", "TE:te1", "W/R/T:wr3"]);
  // Without the stamp, nothing is checked (a copy that has none).
  const bare = league({ start: 7, slots: NFL });
  delete bare.castProps;
  assert.equal(S.ActiveRosterLogic.validateLineup(bare, "ep1", "ann", ["qb1", "qb2"]), null);
});

test("best: the bots and best ball take the best lineup the slots allow", () => {
  const ranked = [...ROSTER].sort((a, b) => b[2] - a[2]).map((r) => r[0]);
  const s = league({ start: 7, slots: NFL });
  const best = S.SlotLogic.best(s, ranked, 7);
  assert.deepEqual([...best].sort(), ["qb2", "rb1", "rb2", "te1", "wr1", "wr2", "wr3"].sort(), "one QB, the flex a WR, the best TE");
  // A bot sets that lineup.
  const b = league({ start: 7, slots: NFL }, { bots: ["x1"] });
  Bots.run(b);
  const set = S.ActiveRosterLogic.lineupFor(b, "ep1", "x1");
  assert.equal(set.length, 7);
  assert.equal(S.SlotLogic.problem(b, set), null, "the bot's lineup fits its slots");
  assert.equal(set.filter((id) => id.startsWith("qb")).length, 1, "one QB");
});

test("a show's slots: start one Interior and one Deck", () => {
  const crew = [["i1", "Interior"], ["i2", "Interior"], ["d1", "Deck"], ["g1", "Galley"]];
  const s = league({ start: 2, slots: [{ label: "Interior", of: "department", values: ["Interior"], n: 1 }, { label: "Deck", of: "department", values: ["Deck"], n: 1 }] }, { roster: crew.map(([id, d]) => [id, d, 1]), props: (d) => ({ department: d }) });
  assert.equal(S.ActiveRosterLogic.validateLineup(s, "ep1", "ann", ["i1", "d1"]), null);
  assert.match(S.ActiveRosterLogic.validateLineup(s, "ep1", "ann", ["i1", "i2"]), /I2 has no open slot: the lineup is 1 Interior, 1 Deck/);
});

test("football's standard games carry their defaults' slots (every team sport's since step 2.3: tests/sports-slots.test.js)", () => {
  const d = defaultsFor("football", "football/nfl");
  const season = d.specs.season.spec.count;
  assert.equal(season.start, 9);
  assert.deepEqual(season.slots.map((x) => `${x.n} ${x.label}`), ["1 QB", "2 WR", "2 RB", "1 TE", "1 W/R/T", "1 K", "1 DEF"]);
  assert.deepEqual(G.specProblems(d.specs.season.spec, null).filter((p) => /count/.test(p.at)), []);
});
