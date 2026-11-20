// A cast property changing mid-season (docs/PLAN-cast-properties.md, chunk 6): a season result of kind 'prop' (a promotion, a move),
// asked by episode research of each person only when it changed, staged with the property's own spelling, applied per episode like a
// tribe move (ep.props), emptied on an episode a viewer hasn't seen, read "as of" an episode (a lineup slot at its episode), and said
// in words ("Job: Bosun"). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src"), "@db": path.join(__dirname, "..", "db") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const { applyDecision, undoDetail } = jiti("../src/lib/game/decision-apply.ts");
const W = jiti("../src/lib/game/dated-fact-words.ts");
const { compileRulebook } = require("../src/lib/game/formats/rulebook-compile.js");
const { LIBRARY } = require("../src/lib/game/formats/library/index.js");

const CREW = [["i1", "Ana", "Interior", "Stew"], ["d1", "Bo", "Deck", "Deckhand"], ["d2", "Cy", "Deck", "Bosun"]];
function league(count) {
  const spec = { preset: "weekly-lineup", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, count: count || { start: 1 } };
  const s = S.migrateLeagueState({
    settings: { ...G.settingsOf(spec), showFormat: "survivor" },
    players: [{ id: "ann", name: "ann", color: "#000", active: true }],
    draftOrder: ["ann"],
    tribes: [],
    castaways: CREW.map(([id, name]) => ({ id, name, status: "active", tribeId: null, ownerIds: ["ann"], placementOrder: null, exitMethod: null, exitEpisodeId: null, seasonCastId: `sc-${id}` })),
    episodes: [1, 2, 3].map((n) => ({ id: `ep${n}`, number: n, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} })),
  });
  s.castProps = Object.fromEntries(CREW.map(([id, , department, job]) => [id, { department, job }]));
  s.castPropDefs = [{ key: "department", name: "Department", plural: "Departments", values: ["Interior", "Deck"], main: false, of: null, flex: null, plurals: null }, { key: "job", name: "Job", plural: "Jobs", values: null, main: true, of: "department", flex: null, plurals: null }];
  return s;
}
const fact = (n, name, key, value) => ({ episode_number: n, post_merge: false, kind: "prop", castaway_name: name, method: value, event_type: key, jury_votes: null, units: null, applied: null });
const CAST = CREW.map(([id, name]) => ({ id: `sc-${id}`, name }));

test("applied per episode, read as of an episode, undone, and counted as a result", () => {
  const s = league();
  const r = applyDecision(s, fact(2, "Bo", "job", "Lead deckhand"), CAST);
  assert.ok(r.detail && !r.skip, JSON.stringify(r));
  assert.deepEqual(s.episodes[1].props, [{ castawayId: "d1", key: "job", value: "Lead deckhand" }]);
  assert.equal(S.CastPropLogic.valueOf(s, "d1", "job", 1), "Deckhand", "before it: the starting value");
  assert.equal(S.CastPropLogic.valueOf(s, "d1", "job", 2), "Lead deckhand");
  assert.equal(S.CastPropLogic.valueOf(s, "d1", "job"), "Lead deckhand", "now");
  assert.ok(S.episodeHasResults(s.episodes[1]), "a change is a result");
  assert.deepEqual(applyDecision(s, fact(2, "Bo", "job", "Lead deckhand"), CAST).detail.preexisting, true, "once");
  undoDetail(s, r.detail);
  assert.equal(S.CastPropLogic.valueOf(s, "d1", "job"), "Deckhand", "undone");
});

test("a viewer who hasn't seen the episode doesn't see the change", () => {
  const s = league();
  applyDecision(s, fact(3, "Ana", "department", "Deck"), CAST);
  const behind = S.SpoilerLogic.viewThrough(s, 2);
  assert.equal(S.CastPropLogic.valueOf(behind, "i1", "department"), "Interior");
  assert.equal(S.CastPropLogic.valueOf(s, "i1", "department"), "Deck");
});

test("a lineup slot reads the value as of its episode", () => {
  const s = league({ start: 1, slots: [{ label: "Deck", of: "department", values: ["Deck"], n: 1 }] });
  applyDecision(s, fact(2, "Ana", "department", "Deck"), CAST);
  assert.match(S.ActiveRosterLogic.validateLineup(s, "ep1", "ann", ["i1"]) || "", /has no open slot/, "Episode 1: still Interior");
  assert.equal(S.ActiveRosterLogic.validateLineup(s, "ep3", "ann", ["i1"]), null, "Episode 3, after the change in 2: Deck");
});

test("research asks it of a changing property, and stages a change with the property's own spelling", () => {
  const { data } = compileRulebook(LIBRARY["below-deck"].blocks, { id: "bd", reader: "research" });
  assert.deepEqual(data.research.propChanges.map((p) => p.key), ["department", "job"]);
  const q = data.research.checklist.find((f) => f.key === "departmentNow");
  assert.match(q.description, /Only if their department changed in THIS episode .* exactly one of "Interior", "Deck", "Galley", "Bridge". Null if it didn't change/);
  const ER = require("../db/episode-research.js");
  const format = { hasGroups: false, research: { ...data.research, items: () => {} } };
  const items = ER.itemsFromChecklist({ name: "Bo", departmentNow: "deck", jobNow: "Lead Deckhand", confidence: "high" }, format, { castaways: [{ name: "Bo" }] }, 2);
  assert.deepEqual(items.map((i) => `${i.kind}:${i.eventType}:${i.method}`), ["prop:department:Deck", "prop:job:Lead Deckhand"]);
  const none = ER.itemsFromChecklist({ name: "Bo", departmentNow: "Engine", jobNow: null, confidence: "high" }, format, { castaways: [{ name: "Bo" }] }, 2);
  assert.deepEqual(none, [], "a value not the property's, and no change, stage nothing");
});

test("the words", () => {
  assert.equal(W.propLabel("job", "Bosun"), "Job: Bosun");
  assert.equal(W.holdingLabel(W.holdingType("advantages", "found", "Hidden Immunity Idol"), ""), "Found a hidden immunity idol");
  assert.equal(W.holdingLabel(W.holdingType("advantages", "gave", "Block a Vote"), "Eric"), "Gave away a block a vote to Eric");
  assert.equal(W.holdingLabel(W.holdingType("advantages", "played", "Idol"), "Kristin"), "Played an idol on Kristin");
});

test("the AI decides and settles a property's change or a holding at once; the desk confirms or changes it after", () => {
  const F = jiti("../src/lib/game/fact-status.ts");
  const sub = (id, key, confidence) => ({ id, key, at: 1, covers: { people: ["Bo"], kinds: null } });
  const fact = (kind, confidence) => ({ id: "f1", kind, castawayName: "Bo", method: "Lead deckhand", factStatus: null, live: false, locked: false, flags: [], sources: [{ researchId: "r1", method: "Lead deckhand", confidence }] });
  const [prop] = F.settleEpisode([fact("prop", "low")], [sub("r1", "bot")]);
  assert.equal(prop.live, true, "one low-confidence answer: in the games");
  // Since 2026-11-20 an ordinary moment does too (docs/PLAN-results-settle.md: one look is enough, whatever its confidence).
  const [event] = F.settleEpisode([{ ...fact("event", "low"), method: "" }], [sub("r1", "bot")]);
  assert.equal(event.live, true, "an ordinary moment goes in on one low-confidence answer too");
});
