// Draft rules by cast properties (docs/PLAN-cast-properties.md, chunk 4): what a team needs (get.needs: "one Interior and one Deck",
// "two men and two women"), a draft spread across any property (get.across.of a key: one from each department), and a pool by one
// (pool.where.props: "Interior only"). Each reads the per-read stamp (state.castProps, castPropDefs), never blocks a draft, refuses a
// pick with the reason while someone else would keep the team right, and reaches bots, blind teams and waiver replacements alike.
// Gender's Nonbinary counts as a man or a woman (the user, 2026-11-16). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");

const outlast = (get = {}, extra = {}) => ({ preset: "outlast", get: { by: "draft", ...get }, ...extra });
const DEFS = [
  { key: "department", name: "Department", plural: "Departments", values: ["Interior", "Deck", "Galley", "Bridge"], main: false, of: null, flex: null },
  { key: "job", name: "Job", plural: "Jobs", values: null, main: true, of: "department", flex: null },
  { key: "gender", name: "Gender", plural: "Genders", values: ["Man", "Woman", "Nonbinary"], main: false, of: null, flex: { Nonbinary: ["Man", "Woman"] }, plurals: { Man: "Men", Woman: "Women", Nonbinary: "Nonbinary" } },
];
// [id, department, gender]: a crew of twelve, mostly Interior and Deck.
const CREW = [
  ["i1", "Interior", "Woman"], ["i2", "Interior", "Woman"], ["i3", "Interior", "Man"], ["i4", "Interior", "Woman"],
  ["d1", "Deck", "Man"], ["d2", "Deck", "Man"], ["d3", "Deck", "Woman"], ["d4", "Deck", "Man"],
  ["g1", "Galley", "Nonbinary"], ["g2", "Galley", "Man"], ["b1", "Bridge", "Man"], ["b2", "Bridge", "Woman"],
];
const CTX = { moments: [], results: true, winner: true, roles: [], grouped: false, jury: false, phases: [], properties: DEFS };

/** A league on the crew, the game `spec`, its cast's properties stamped as the server stamps them per read. */
function league(spec, { people = ["ann", "bo"], bots = [], crew = CREW } = {}) {
  const settings = { ...G.settingsOf(spec), showFormat: "survivor" };
  assert.ok(G.settingsOf(spec), `plays: ${JSON.stringify(spec)}`);
  const s = S.migrateLeagueState({
    settings,
    players: [...people, ...bots].map((id) => ({ id, name: id, color: "#000", active: true, ...(bots.includes(id) ? { automated: true } : {}) })),
    draftOrder: [...people, ...bots],
    tribes: [],
    castaways: crew.map(([id]) => ({ id, name: `${id.toUpperCase()} Crew`, status: "active", tribeId: null, ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: [{ id: "ep1", number: 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} }],
  });
  s.castProps = Object.fromEntries(crew.map(([id, department, gender]) => [id, { department, gender }]));
  s.castPropDefs = DEFS;
  return s;
}
const team = (s, pid) => s.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id);
const dept = (id) => CREW.find((c) => c[0] === id)[1];
const NEEDS = [{ of: "department", value: "Interior", n: 1 }, { of: "department", value: "Deck", n: 1 }];

test("the spec: needs, a spread by a property and a pool by one; their shape, settings and the data rule", () => {
  const spec = outlast({ each: 3, order: "snake", own: "exclusive", needs: NEEDS, across: { of: "gender" } }, { pool: { of: "cast", where: { props: { department: ["Interior", "Deck"] } } } });
  assert.deepEqual(G.specProblems(spec, CTX), []);
  // Saved and read back whole (settings.draftNeeds, poolWhere).
  const again = G.gameOf(G.settingsOf(spec));
  assert.deepEqual(again.get.needs, NEEDS);
  assert.deepEqual(again.get.across.of, "gender");
  assert.deepEqual(again.pool.where, { props: { department: ["Interior", "Deck"] } });
  const msg = (sp, ctx = CTX) => G.specProblems(sp, ctx).map((p) => p.problem || p.message || JSON.stringify(p)).join(" | ");
  assert.match(msg(outlast({ each: 2, order: "snake", own: "exclusive", needs: [{ of: "department", value: "Interior", n: 3 }] })), /more than a team of 2/);
  assert.match(msg(outlast({ each: 3, order: "snake", own: "exclusive", needs: [{ of: "department", value: "Engine", n: 1 }] })), /Department is one of Interior, Deck, Galley, Bridge/);
  assert.match(msg(outlast({ each: 3, order: "snake", own: "exclusive", needs: [{ of: "job", value: "Bosun", n: 1 }] })), /anything in the show's words/);
  assert.match(msg(outlast({ each: 3, order: "snake", own: "exclusive", across: { of: "status" } })), /isn't sorted by status/);
  assert.match(msg(outlast({ each: 3, order: "snake", own: "exclusive", needs: [{ of: "department", value: "Interior" }] })), /whole number from 1/);
  // Gender plays now (every show has it): no longer refused, and nothing waits on it.
  assert.deepEqual(G.specProblems(outlast({ each: 2, order: "snake", own: "exclusive", across: { of: "gender" } }), CTX), []);
});

test("needs: a snake draft refuses a pick that leaves a need unfillable, says why, and never blocks", () => {
  const s = league(outlast({ each: 2, order: "snake", own: "exclusive", needs: NEEDS }), { people: ["ann"] });
  S.forceStartDraft(s);
  // ann takes an Interior; then a second Interior would leave Deck unfilled with no picks left.
  S.draftToCurrentTurn(s, "i1");
  assert.equal(S.currentDraftTurn(s).playerId, "ann");
  assert.equal(S.CompositionLogic.needsLine(s, team(s, "ann")), "Needs: 1 Deck");
  assert.match(S.CompositionLogic.pickProblem(s, "ann", "i2"), /You still need someone from Deck, and 1 pick is left/);
  assert.equal(S.CompositionLogic.pickProblem(s, "ann", "d3"), null);
  const before = s.draftPicksMade;
  S.draftToCurrentTurn(s, "i2");
  assert.equal(s.draftPicksMade, before, "the engine refuses it too");
  S.draftToCurrentTurn(s, "d3");
  assert.deepEqual(team(s, "ann").map(dept).sort(), ["Deck", "Interior"]);
  assert.equal(S.CompositionLogic.needsLine(s, team(s, "ann")), null);
  // Never blocks: with no Deck left to take, anyone can be taken.
  const dry = league(outlast({ each: 2, order: "snake", own: "exclusive", needs: [{ of: "department", value: "Bridge", n: 2 }] }), { people: ["ann", "bo", "cy"] });
  S.forceStartDraft(dry);
  S.draftToCurrentTurn(dry, "b1");
  S.draftToCurrentTurn(dry, "b2");
  assert.equal(S.CompositionLogic.pickProblem(dry, "cy", "i1"), null, "nobody left can fill it: anyone");
  // Without the stamp (a copy that has none) nothing is checked.
  const bare = league(outlast({ each: 2, order: "snake", own: "exclusive", needs: NEEDS }));
  delete bare.castProps;
  assert.equal(S.CompositionLogic.slots(bare), null);
});

test("two men and two women: Nonbinary counts as either, on whichever side lets the team fit", () => {
  const needs = [{ of: "gender", value: "Man", n: 2 }, { of: "gender", value: "Woman", n: 2 }];
  const s = league(outlast({ each: 4, order: "snake", own: "exclusive", needs }), { people: ["ann"] });
  S.forceStartDraft(s);
  // Two women, then the Nonbinary chef: they can still be the second man or (were a man taken) the woman.
  for (const id of ["i1", "i2", "g1"]) S.draftToCurrentTurn(s, id);
  assert.equal(S.CompositionLogic.needsLine(s, team(s, "ann")), "Needs: 1 Man");
  assert.equal(S.CompositionLogic.needsLine(s, ["i1"]), "Needs: 2 Men, 1 Woman", "a plural for more than one");
  assert.match(S.CompositionLogic.pickProblem(s, "ann", "i4"), /You still need someone from Man/);
  assert.equal(S.CompositionLogic.pickProblem(s, "ann", "d1"), null);
  // A spread across gender: Nonbinary never counts against a side's most.
  const sp = league(outlast({ each: 2, order: "snake", own: "exclusive", across: { of: "gender" } }), { people: ["ann"] });
  S.forceStartDraft(sp);
  S.draftToCurrentTurn(sp, "g1");
  assert.equal(S.SpreadLogic.pickProblem(sp, "ann", "d1"), null);
  assert.equal(S.SpreadLogic.pickProblem(sp, "ann", "i1"), null);
});

test("a spread across a property: one from each department", () => {
  const crew = CREW.filter(([, d]) => d === "Interior" || d === "Deck");
  const s = league(outlast({ each: 2, order: "snake", own: "exclusive", across: { of: "department" } }), { people: ["ann"], crew });
  S.forceStartDraft(s);
  S.draftToCurrentTurn(s, "i1");
  assert.match(S.SpreadLogic.pickProblem(s, "ann", "i2"), /Spread your team across the departments/);
  assert.equal(S.SpreadLogic.pickProblem(s, "ann", "d1"), null);
});

test("a pool by a property: Interior only, its refusal in words", () => {
  const s = league(outlast({ each: 1, order: "snake", own: "exclusive" }, { pool: { of: "cast", where: { props: { department: ["Interior"] } } } }));
  assert.deepEqual(S.PoolLogic.offered(s).map((c) => c.id), ["i1", "i2", "i3", "i4"]);
  assert.equal(S.PoolLogic.has(s, "d1"), false);
  assert.match(S.PoolLogic.reason(s, s.castaways.find((c) => c.id === "d1")), /it's Interior only/);
});

test("bots, a blind team and a waiver replacement keep the needs", () => {
  // Two bots and a person, exclusive: every team gets one Interior and one Deck (the plan's "Done when").
  const s = league(outlast({ each: 2, order: "snake", own: "exclusive", needs: NEEDS }), { people: ["ann"], bots: ["x1", "x2"] });
  S.forceStartDraft(s);
  // ann can't start with the captain: she'd still need Interior and Deck with one pick left.
  assert.match(S.CompositionLogic.pickProblem(s, "ann", "b1") || "", /You still need someone from Interior and someone from Deck, and 2 picks are left/);
  S.draftToCurrentTurn(s, "i1");
  Bots.run(s);
  for (const p of ["x1", "x2"]) assert.deepEqual(team(s, p).map(dept).sort(), ["Deck", "Interior"], p);
  // Blind: a submission without Deck is refused, with the reason.
  const blind = league(outlast({ each: 2, order: "blind", own: "shared", needs: NEEDS }), { people: ["ann"], bots: ["x1"] });
  S.forceStartDraft(blind);
  assert.match(S.CompositionLogic.teamProblem(blind, ["i1", "i2"]) || "", /You still need someone from Deck/);
  assert.equal(S.CompositionLogic.teamProblem(blind, ["i1", "d1"]), null);
  for (const x of Bots.blindSubmissions(blind)) assert.deepEqual(x.castawayIds.map(dept).sort(), ["Deck", "Interior"]);
  // A replacement keeps the shape: ann's Deck out, an Interior in her place is refused while a Deck is free.
  const w = league(outlast({ each: 2, order: "snake", own: "exclusive", needs: NEEDS }), { people: ["ann"] });
  S.forceStartDraft(w);
  S.draftToCurrentTurn(w, "i1");
  S.draftToCurrentTurn(w, "d1");
  assert.match(S.CompositionLogic.moveProblem(w, "ann", "d1", "i2"), /needs someone from Deck/);
  assert.equal(S.CompositionLogic.moveProblem(w, "ann", "d1", "d2"), null);
});
