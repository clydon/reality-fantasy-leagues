// Nothing's owed while nobody is free to come in (StateLogic.WaiverLogic.replacementsOwed): late in an exclusive game every
// castaway still in can be on someone's team, and the app asked for a replacement nobody could make. (The season-forward
// rehearsal's item 3 pointed here: "Replace Jelly" at Episode 12 of Survivor 51 with all five left drafted. The couch's
// Weekly Lineup is shared, though, where anyone still in who isn't yours can come in, so that ask was right, and still is.)
// Now replacementsOwed counts none and says why (nobodyFree), so Tonight's moves (action-items.js), the waivers page
// (waiver-view.ts: "Nobody's free to pick up") and a claim all agree; once someone is free, it's owed again. Pure, no
// database. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const { actionItems } = require("../src/lib/game/action-items.js");
const { waiverWeek } = jiti("../src/lib/game/waiver-view.ts");
const W = S.WaiverLogic;

const T0 = Date.parse("2026-12-03T14:00:00Z"); // the day after Episode 11
const AIRS = Date.parse("2026-12-10T01:00:00Z"); // Episode 12, Wednesday 8 PM EST

// Three teams; everyone else in the cast went home in Episodes 1 to 10.
const TEAMS = { kim: ["mike", "k2"], sam: ["jelly", "kilby"], dee: ["d1", "d2"] };
const GONE = ["x1", "x2", "x3", "x4", "x5", "x6", "x7", "x8", "x9", "x10"];

/** A league after Episode 11 (Jelly, Sam's, out), its waivers open; `free`: castaways still in on nobody's team. */
function league({ type = "active-roster", shared = false, free = [], rule = "always" } = {}) {
  const owned = Object.entries(TEAMS).flatMap(([p, ids]) => ids.map((id) => [id, p]));
  const ids = [...owned.map(([id]) => id), ...GONE, ...free];
  const s = S.migrateLeagueState({
    settings: {
      leagueTypeId: type, showFormat: "survivor", ownershipMode: shared ? "shared" : "exclusive",
      replenishEnabled: true, tradeEnabled: true, swapEvery: 3, startEpisode: 1, replenishOrderBy: "rolling", replaceRule: rule,
      ...(type === "active-roster" ? { activeSlots: 1, benchSlots: 1 } : { teamSize: 2 }),
    },
    players: Object.keys(TEAMS).map((id) => ({ id, name: id, color: "#000", active: true })),
    draftOrder: ["dee", "sam", "kim"],
    castaways: ids.map((id) => ({
      id, name: id, status: "active", placementOrder: null, exitMethod: null, exitEpisodeId: null,
      ownerIds: owned.filter(([c]) => c === id).map(([, p]) => p),
    })),
    episodes: Array.from({ length: 13 }, (_, i) => ({
      id: `ep${i + 1}`, number: i + 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {},
      ...(i === 11 ? { airsAt: new Date(AIRS).toISOString() } : {}),
    })),
  });
  GONE.forEach((id, i) => S.addElimination(s, `ep${i + 1}`, id, "Voted Out"));
  S.addElimination(s, "ep11", "jelly", "Voted Out");
  W.open(s, T0);
  return s;
}
const week = (s, who) => waiverWeek({ leagueId: "l1", name: "Test", gameName: "Weekly Lineup", gameType: "active-roster" }, s, who, null, () => null, null);

test("everyone still in is on a team: no replacement is owed, and nothing asks for one", () => {
  for (const type of ["active-roster", "classic-draft"]) {
    const s = league({ type });
    const p = W.current(s);
    assert.equal(p.phase, "open", type);
    assert.deepEqual(W.replacementsOwed(s, "sam", p), { count: 0, lossIds: [], outIds: [], nobodyFree: true }, type);
    assert.deepEqual(W.pickupsOwed(s, "sam"), { count: 0, lossIds: [], outIds: [], nobodyFree: true }, type);
    // Tonight's moves: no "Replace Jelly".
    assert.deepEqual(actionItems(s, "sam", null).filter((i) => i.kind === "pickup"), [], type);
    // The waivers page: nothing to replace, and why.
    const w = week(s, "sam");
    assert.deepEqual([w.replace, w.outIds, w.free, w.nobodyFree], [[], [], [], true], type);
    // Nobody without a loss is told so.
    assert.equal(week(s, "kim").nobodyFree, false, type);
    // A claim for Jelly's spot is refused, as before (there's nobody to add).
    assert.ok(W.checkClaim(s, p, "sam", { pairs: [{ addId: "k2", dropId: "jelly" }] }).error, type);
  }
});

test("only when short: short, with nobody free, is owed nothing either", () => {
  const s = league({ rule: "whenShort" });
  S.addElimination(s, "ep11", "kilby", "Voted Out");
  assert.deepEqual(W.replacementsOwed(s, "sam", W.current(s)), { count: 0, lossIds: [], outIds: [], nobodyFree: true });
  const free = league({ rule: "whenShort", free: ["rob"] });
  S.addElimination(free, "ep11", "kilby", "Voted Out");
  assert.equal(W.replacementsOwed(free, "sam", W.current(free)).count, 1);
});

test("someone free to come in: the replacement is owed, as it always was", () => {
  for (const type of ["active-roster", "classic-draft"]) {
    const s = league({ type, free: ["rob"] });
    const p = W.current(s);
    assert.deepEqual(W.replacementsOwed(s, "sam", p), { count: 1, lossIds: ["jelly"], outIds: ["jelly"] }, type);
    assert.deepEqual(actionItems(s, "sam", null).filter((i) => i.kind === "pickup").map((i) => i.text), ["Replace jelly"], type);
    const w = week(s, "sam");
    assert.deepEqual([w.replace, w.free.map((f) => f.id), w.nobodyFree], [["jelly"], ["rob"], false], type);
    assert.deepEqual(W.checkClaim(s, p, "sam", { pairs: [{ addId: "rob", dropId: "jelly" }] }).claim.pairs, [{ addId: "rob", dropId: "jelly" }], type);
    // Rob goes home before the week runs: nobody's free again, and nothing's owed.
    S.addElimination(s, "ep11", "rob", "Voted Out");
    assert.deepEqual(W.replacementsOwed(s, "sam", p), { count: 0, lossIds: [], outIds: [], nobodyFree: true }, type);
  }
});

test("a shared game: anyone still in who isn't yours can come in, so the replacement is owed", () => {
  const s = league({ type: "active-roster", shared: true });
  assert.deepEqual(W.replacementsOwed(s, "sam", W.current(s)), { count: 1, lossIds: ["jelly"], outIds: ["jelly"] });
});
