// BACKLOG 60 (the user's decision, 2026-11-14): a private draft's sheet names everyone left to pick when that's fewer than a team
// takes (a later stage drafting from who's still in: "6 each from the merge" with five left). It asked for exactly a team, so
// every sheet was refused and the stage never had teams. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");

const CTX = { show: "Survivor 51", season: "survivor/51", moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: 3, answeredBy: "research" }], results: true, winner: true, roles: [], grouped: true, phases: [{ id: "premerge", name: "Pre-merge" }, { id: "merged", name: "Merged" }] };
const SEATS = ["ann", "bo", "cy"];
function league(n) {
  const spec = G.fullSpec({ preset: "weekly-lineup", get: { by: "draft", each: 6, order: "blind", own: "shared" }, count: { start: 2 } });
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  S.updateSettings(s, "leagueTypeId", G.madeAs(G.typeOf(spec)));
  for (let i = 0; i < n; i++) S.addCastaway(s, `C${i}`);
  s.players = SEATS.map((id) => ({ id, name: id, color: "#000", disabled: false, active: true }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, spec, { ctx: { ...CTX, pool: n, couch: 3 } }), []);
  for (let k = 1; k <= 4; k++) S.ensureEpisodeNumber(s, k, false);
  return s;
}
const ids = (s) => s.castaways.filter((c) => c.status === "active").map((c) => c.id);

test("with fewer left to pick than a team takes, a sheet names everyone left", () => {
  const s = league(8);
  // Three go home: five still in, a team is six.
  [0, 1, 2].forEach((i) => S.addElimination(s, s.episodes[i].id, s.castaways[i].id, "Voted Out"));
  S.forceStartDraft(s);
  const still = ids(s);
  assert.equal(still.length, 5);
  assert.equal(S.BlindDraftLogic.sheetSize(s, "ann"), 5);
  assert.equal(S.BlindDraftLogic.validateSubmission(s, "ann", still.slice(0, 4)), "Only 5 are left to pick: pick all 5");
  assert.equal(S.BlindDraftLogic.validateSubmission(s, "ann", [...still, s.castaways[0].id]), "Only 5 are left to pick: pick all 5");
  assert.equal(S.BlindDraftLogic.validateSubmission(s, "ann", [...still.slice(0, 4), s.castaways[0].id]), `${s.castaways[0].name} is already eliminated`);
  assert.equal(S.BlindDraftLogic.validateSubmission(s, "ann", still), null);
  // Everyone locks in everyone left: the reveal makes the teams, and the game plays (who each starts is theirs).
  assert.equal(S.BlindDraftLogic.reveal(s, Object.fromEntries(SEATS.map((p) => [p, still])), "2099-01-04T00:00:00.000Z"), true);
  for (const p of SEATS) assert.deepEqual(s.castaways.filter((c) => c.ownerIds.includes(p)).map((c) => c.id), still);
  assert.equal(S.DraftLogic.begun(s), true);
});

test("one left: the sheet is them", () => {
  const s = league(8);
  [0, 1, 2, 3].forEach((i) => S.addElimination(s, s.episodes[i].id, s.castaways[i].id, "Voted Out"));
  [4, 5, 6].forEach((i) => S.addElimination(s, s.episodes[3].id, s.castaways[i].id, "Voted Out"));
  S.forceStartDraft(s);
  assert.equal(S.BlindDraftLogic.sheetSize(s, "ann"), 1);
  assert.equal(S.BlindDraftLogic.validateSubmission(s, "ann", []), "Only 1 is left to pick: pick them");
  assert.equal(S.BlindDraftLogic.validateSubmission(s, "ann", ids(s)), null);
});

test("with a team's worth or more left, a sheet is exactly a team, as before", () => {
  const s = league(12);
  S.forceStartDraft(s);
  const all = ids(s);
  assert.equal(S.BlindDraftLogic.sheetSize(s, "ann"), 6);
  assert.equal(S.BlindDraftLogic.validateSubmission(s, "ann", all.slice(0, 5)), "Pick exactly 6 castaways");
  assert.equal(S.BlindDraftLogic.validateSubmission(s, "ann", all.slice(0, 7)), "Pick exactly 6 castaways");
  assert.equal(S.BlindDraftLogic.validateSubmission(s, "ann", all.slice(0, 6)), null);
});
