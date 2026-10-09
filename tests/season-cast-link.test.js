// The link from a league's castaway to its season's cast (docs/PLAN-universal-season-cast.md, piece 1):
// StateLogic.planSeasonCastLinks / applySeasonCastLinks / syncSeasonCast, and the id-aware halves of
// applyCastImport / applyCastTribes, composed the way src/lib/server/season-cast.ts's applyCastToState
// composes them. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const StateLogic = require("../src/lib/game/state-logic.js");

const row = (id, name, tribeName = null, photoUrl = null) => ({ id, name, tribeName, photoUrl });

function league(names) {
  const s = StateLogic.defaultState();
  StateLogic.applyCastImport(s, { castaways: names.map((name) => ({ name })) });
  return s;
}
const byName = (s, name) => s.castaways.find((c) => c.name === name);

// season-cast.ts's applyCastToState, minus the database (and its tribes-due check).
function applyCast(s, cast, withTribes) {
  const out = StateLogic.applySeasonCast(s, cast, { withTribes });
  return { linked: out.linked, synced: out.synced, added: out, tribed: out.tribed, needsReview: out.needsReview };
}

test("plan: exact names link (ignoring case and outer spaces); looser ones only with forgiving", () => {
  const s = league(["Kyle Fraser", " eva erickson ", "Jess"]);
  const cast = [row("r1", "Kyle Fraser"), row("r2", "Eva Erickson"), row("r3", "Jess White")];

  const strict = StateLogic.planSeasonCastLinks(s, cast);
  assert.deepEqual(strict.links.map((l) => [l.seasonName, l.how]), [["Kyle Fraser", "exact"], ["Eva Erickson", "exact"]]);
  assert.deepEqual(strict.unmatched.map((u) => u.seasonName), ["Jess White"]);
  assert.deepEqual(strict.unlinked.map((u) => u.castawayName), ["Jess"]);

  const loose = StateLogic.planSeasonCastLinks(s, cast, { forgiving: true });
  assert.deepEqual(loose.links.find((l) => l.seasonName === "Jess White"), {
    seasonCastId: "r3", seasonName: "Jess White", castawayId: byName(s, "Jess").id, castawayName: "Jess", how: "forgiving",
  });
  assert.equal(loose.unmatched.length, 0);
  assert.equal(loose.unlinked.length, 0);
});

test("plan: a forgiving match must agree both ways, so 'Jess' is nobody when the season has two", () => {
  const s = league(["Jess"]);
  const plan = StateLogic.planSeasonCastLinks(s, [row("r1", "Jess White"), row("r2", "Jess Smith")], { forgiving: true });
  assert.equal(plan.links.length, 0);
  assert.deepEqual(plan.ambiguous.map((a) => [a.seasonName, a.candidates]), [["Jess White", ["Jess"]], ["Jess Smith", ["Jess"]]]);
  assert.deepEqual(plan.unlinked.map((u) => u.castawayName), ["Jess"]);

  // ...and the same when the other Jess is already linked exactly: the reverse check reads every row.
  const t = league(["Jess White", "Jess"]);
  const plan2 = StateLogic.planSeasonCastLinks(t, [row("r1", "Jess White"), row("r2", "Jess Smith")], { forgiving: true });
  assert.deepEqual(plan2.links.map((l) => [l.seasonName, l.castawayName]), [["Jess White", "Jess White"]]);
  assert.deepEqual(plan2.ambiguous.map((a) => [a.seasonName, a.candidates]), [["Jess Smith", ["Jess"]]], "refused, but shown");
  assert.deepEqual(plan2.unmatched, []);
  assert.deepEqual(plan2.unlinked.map((u) => u.castawayName), ["Jess"]);
});

test("plan: a league with two of one name links neither", () => {
  const s = league(["Sam"]);
  StateLogic.addCastaway(s, "sam");
  const plan = StateLogic.planSeasonCastLinks(s, [row("r1", "Sam")], { forgiving: true });
  assert.equal(plan.links.length, 0);
  assert.deepEqual(plan.ambiguous[0].candidates.sort(), ["Sam", "sam"]);
});

test("plan: already-linked people keep their link, even to a row no longer in the cast", () => {
  const s = league(["Kyle Fraser", "Gone Person"]);
  byName(s, "Kyle Fraser").seasonCastId = "r1";
  byName(s, "Gone Person").seasonCastId = "removed";
  // Renamed in the season cast: still 'id', never re-matched by name.
  const plan = StateLogic.planSeasonCastLinks(s, [row("r1", "Kyle F."), row("r2", "Gone Person")], { forgiving: true });
  assert.deepEqual(plan.links.map((l) => [l.seasonName, l.castawayName, l.how]), [["Kyle F.", "Kyle Fraser", "id"]]);
  assert.deepEqual(plan.unmatched.map((u) => u.seasonName), ["Gone Person"]);
  assert.deepEqual(plan.unlinked, []);
});

test("applying links adds seasonCastId and nothing else, is idempotent, and leaves scores alone", () => {
  const s = league(["A One", "B Two", "C Three", "D Four"]);
  const p1 = StateLogic.addPlayer(s, "p1");
  const p2 = StateLogic.addPlayer(s, "p2");
  StateLogic.Core.setOwner(s, byName(s, "A One").id, p1.id);
  StateLogic.Core.setOwner(s, byName(s, "B Two").id, p1.id);
  StateLogic.Core.setOwner(s, byName(s, "C Three").id, p2.id);
  StateLogic.Core.setOwner(s, byName(s, "D Four").id, p2.id);
  const ep = StateLogic.ensureEpisodeNumber(s, 1, false);
  StateLogic.addElimination(s, ep.id, byName(s, "C Three").id, "Voted Out");

  const before = JSON.parse(JSON.stringify(s));
  // Score rows carry whole castaway objects, link included -- compare everything but the link.
  const scores = () => JSON.stringify(StateLogic.computeScores(s), (k, v) => (k === "seasonCastId" ? undefined : v));
  const scoresBefore = scores();
  const cast = ["A One", "B Two", "C Three", "D Four"].map((n, i) => row(`r${i}`, n));
  const plan = StateLogic.planSeasonCastLinks(s, cast, { forgiving: true });
  assert.equal(StateLogic.applySeasonCastLinks(s, plan).length, 4);

  const stripped = JSON.parse(JSON.stringify(s));
  stripped.castaways.forEach((c) => delete c.seasonCastId);
  assert.deepEqual(stripped, before);
  assert.equal(scores(), scoresBefore);
  assert.equal(StateLogic.applySeasonCastLinks(s, StateLogic.planSeasonCastLinks(s, cast, { forgiving: true })).length, 0);
});

test("applyCastImport: a season row finds its castaway by link, so a rename never adds a second person", () => {
  const s = league([]);
  StateLogic.applyCastImport(s, { castaways: [{ id: "r1", name: "Kyle Fraser" }] });
  assert.equal(byName(s, "Kyle Fraser").seasonCastId, "r1", "born linked");
  const out = StateLogic.applyCastImport(s, { castaways: [{ id: "r1", name: "Kyle F." }] });
  assert.deepEqual(out.castaways, []);
  assert.equal(s.castaways.length, 1);
  // A row without an id (a league's own paste) still matches by name only.
  StateLogic.applyCastImport(s, { castaways: [{ name: "kyle fraser" }] });
  assert.equal(s.castaways.length, 1);
});

test("sync: renames and new photos reach a linked castaway in place; unlinked people are untouched", () => {
  const s = league(["Kyle Fraser", "Hand Added"]);
  const kyle = byName(s, "Kyle Fraser");
  const id = kyle.id;
  StateLogic.applyCastImport(s, { castaways: [] });
  applyCast(s, [row("r1", "Kyle Fraser", null, "a.jpg")], false);
  assert.equal(kyle.seasonCastId, "r1");

  const out = applyCast(s, [row("r1", "Kyle Fraser-Smith", null, "b.jpg")], false);
  assert.deepEqual(out.synced.renamed, [{ from: "Kyle Fraser", to: "Kyle Fraser-Smith" }]);
  assert.equal(s.castaways.length, 2, "renamed, not added");
  assert.equal(kyle.id, id);
  assert.equal(kyle.photoUrl, "b.jpg");
  // A season with no photo never clears one.
  applyCast(s, [row("r1", "Kyle Fraser-Smith", null, null)], false);
  assert.equal(kyle.photoUrl, "b.jpg");
  assert.equal(byName(s, "Hand Added").seasonCastId, undefined);
});

test("sync: a rename onto a name somebody else already has is reported, not applied", () => {
  const s = league([]);
  StateLogic.applyCastImport(s, { castaways: [{ id: "r1", name: "Sam A" }] });
  StateLogic.addCastaway(s, "Sam B");
  const out = StateLogic.syncSeasonCast(s, [row("r1", "Sam B")]);
  assert.deepEqual(out.conflicts, [{ from: "Sam A", to: "Sam B" }]);
  assert.ok(byName(s, "Sam A"));
});

test("sync: a starting-tribe fix rewrites the starting group only when tribes are due, and keeps later moves", () => {
  const s = league([]);
  const cast = [row("r1", "Kyle", "Kele"), row("r2", "Eva", "Kele")];
  applyCast(s, cast, true);
  const kyle = byName(s, "Kyle");
  const eva = byName(s, "Eva");
  assert.equal(StateLogic.getTribe(s, kyle.tribeId).name, "Kele");

  // Eva moves to Hina in episode 3.
  const ep3 = StateLogic.ensureEpisodeNumber(s, 3, false);
  StateLogic.GroupLogic.add(s, ep3.id, eva.id, "Hina");

  const fixed = [row("r1", "Kyle", "Uli"), row("r2", "Eva", "Uli")];
  assert.deepEqual(applyCast(s, fixed, false).synced.retribed, [], "held tribes: no fix yet");
  assert.equal(StateLogic.getTribe(s, kyle.tribeId).name, "Kele");

  const out = applyCast(s, fixed, true);
  assert.deepEqual(out.synced.retribed.map((r) => [r.name, r.from, r.to]), [["Kyle", "Kele", "Uli"], ["Eva", "Kele", "Uli"]]);
  assert.equal(StateLogic.getTribe(s, kyle.tribeId).name, "Uli");
  assert.equal(StateLogic.getTribe(s, eva.startTribeId).name, "Uli");
  assert.equal(StateLogic.getTribe(s, eva.tribeId).name, "Hina", "the episode-3 move still decides where she is");
  assert.deepEqual(applyCast(s, fixed, true).synced, { renamed: [], photos: [], retribed: [], conflicts: [] }, "idempotent");
});

test("applyCastTribes finds a renamed castaway by link", () => {
  const s = league([]);
  StateLogic.applyCastImport(s, { castaways: [{ id: "r1", name: "Kyle" }] });
  byName(s, "Kyle").name = "Kyle Renamed";
  const out = StateLogic.applyCastTribes(s, { castaways: [{ id: "r1", name: "Kyle", tribeName: "Kele" }] });
  assert.deepEqual(out.linked, ["Kyle Renamed"]);
});

test("the castaway PATCH setter refuses seasonCastId", () => {
  const s = league(["Kyle"]);
  const kyle = byName(s, "Kyle");
  StateLogic.updateCastaway(s, kyle.id, "seasonCastId", "someone-else");
  assert.equal(kyle.seasonCastId, undefined);
  StateLogic.updateCastaway(s, kyle.id, "name", "Kyle F");
  assert.equal(kyle.name, "Kyle F");
});

test("applySeasonCast: a row an unlinked castaway might already be is held back, not added twice", () => {
  const s = league(["Jess", "Kyle Fraser"]);
  const cast = [row("r1", "Jess White"), row("r2", "Kyle Fraser"), row("r3", "Joe Hunter")];
  const out = applyCast(s, cast, false);
  assert.deepEqual(out.needsReview, ["Jess White"]);
  assert.deepEqual(out.added.castaways, ["Joe Hunter"]);
  assert.deepEqual(s.castaways.map((c) => c.name).sort(), ["Jess", "Joe Hunter", "Kyle Fraser"]);
  // Once "Jess" is linked (the reviewed pass), the next apply renames her instead.
  byName(s, "Jess").seasonCastId = "r1";
  const again = applyCast(s, cast, false);
  assert.deepEqual(again.needsReview, []);
  assert.deepEqual(again.synced.renamed, [{ from: "Jess", to: "Jess White" }]);
  assert.equal(s.castaways.length, 3);
});

test("applySeasonCast on an already-linked league with nothing new changes nothing at all", () => {
  const s = league([]);
  const cast = [row("r1", "Kyle", "Kele", "k.jpg"), row("r2", "Eva", "Uli", null)];
  applyCast(s, cast, true);
  const before = JSON.stringify(s);
  const out = applyCast(s, cast, true);
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual([out.linked, out.added.castaways, out.needsReview, out.tribed], [[], [], [], []]);
});

test("castawayInUse: an owner or any reference elsewhere in the league counts; a fresh castaway doesn't", () => {
  const s = league(["A One", "B Two", "C Three"]);
  const p1 = StateLogic.addPlayer(s, "p1");
  StateLogic.Core.setOwner(s, byName(s, "A One").id, p1.id);
  const ep = StateLogic.ensureEpisodeNumber(s, 1, false);
  StateLogic.addElimination(s, ep.id, byName(s, "B Two").id, "Voted Out");
  assert.equal(StateLogic.castawayInUse(s, byName(s, "A One").id), true, "owned");
  assert.equal(StateLogic.castawayInUse(s, byName(s, "B Two").id), true, "has a result");
  assert.equal(StateLogic.castawayInUse(s, byName(s, "C Three").id), false);
});

test("findSeasonCastaway: a season's spelling finds the LINKED castaway, whatever this league calls them", () => {
  const s = league(["Kyle", "Kyle Smith"]);
  // "Kyle" here is the season's "Kyle Fraser"; the loose matcher alone would call "Kyle Fraser" ambiguous.
  byName(s, "Kyle").seasonCastId = "r1";
  const cast = [{ id: "r1", name: "Kyle Fraser" }, { id: "r2", name: "Kyle Smith" }];
  assert.equal(StateLogic.Core.findSeasonCastaway(s, "kyle fraser", cast).castaway?.name, "Kyle");
  // Not in the season cast, or not linked: the loose matcher, as before.
  assert.equal(StateLogic.Core.findSeasonCastaway(s, "Kyle Smith", cast).castaway?.name, "Kyle Smith");
  assert.equal(StateLogic.Core.findSeasonCastaway(s, "Kyle Smith", null).castaway?.name, "Kyle Smith");
});
