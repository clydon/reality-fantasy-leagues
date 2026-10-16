// Mid-season waivers (StateLogic.WaiverLogic, docs/PLAN-midseason-waivers.md): the week's clock,
// claims, processing in waiver order, free agency, auto-filled pickups, Undo, and the spoiler view.
// The main scenario is the design canvas's own: Couch Crew after Episode 3. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const Bots = require("../src/lib/game/bot-logic.js");
const W = S.WaiverLogic;

const HOUR = 3600e3;
const T0 = Date.parse("2026-10-15T14:00:00Z"); // Thursday: Episode 3's results go in
const EP4_AIRS = Date.parse("2026-10-21T00:00:00Z"); // Tuesday 8pm ET is EP4_AIRS - 24h

// Five players; the waiver order starts in reverse draft order: Kim, Sam, Andrew, Josie, Dee.
const TEAMS = {
  kim: ["mike", "k2", "k3"],
  sam: ["jelly", "kilby", "s3"],
  andrew: ["carter", "a2", "a3"],
  josie: ["lewis", "jenna", "sharonda"],
  dee: ["d1", "d2", "d3"],
};
const FREE = ["rob", "maggie", "ori", "patt", "aaliyah", "linnea"];
const EARLY_OUT = ["x1", "x2"]; // unowned, out in episodes 1 and 2

function league({ type = "classic-draft", shared = false, settings = {}, airs = true } = {}) {
  const owned = Object.entries(TEAMS).flatMap(([p, ids]) => ids.map((id) => [id, p]));
  const ids = [...owned.map(([id]) => id), ...FREE, ...EARLY_OUT];
  const s = S.migrateLeagueState({
    settings: {
      leagueTypeId: type, showFormat: "survivor", ownershipMode: shared ? "shared" : "exclusive",
      replenishEnabled: true, tradeEnabled: true, swapEvery: 3, startEpisode: 1, replenishOrderBy: "rolling",
      ...(type === "active-roster" ? { activeSlots: 2, benchSlots: 1 } : {}), ...settings,
    },
    players: Object.keys(TEAMS).map((id) => ({ id, name: id, color: "#000", active: true })),
    draftOrder: ["dee", "josie", "andrew", "sam", "kim"],
    castaways: ids.map((id) => ({
      id, name: id, status: "active", placementOrder: null, exitMethod: null, exitEpisodeId: null,
      ownerIds: owned.filter(([c]) => c === id).map(([, p]) => p),
    })),
    episodes: Array.from({ length: 13 }, (_, i) => ({
      id: `ep${i + 1}`, number: i + 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {},
      ...(airs && i === 3 ? { airsAt: new Date(EP4_AIRS).toISOString() } : {}),
    })),
  });
  S.addElimination(s, "ep1", "x1", "Voted Out");
  S.addElimination(s, "ep2", "x2", "Voted Out");
  return s;
}
// Episode 3's results: Jelly (Sam's) is out. Then waivers open.
function afterEpisode3(opts) {
  const s = league(opts);
  S.addElimination(s, "ep3", "jelly", "Voted Out");
  assert.equal(W.due(s, T0), "open");
  W.open(s, T0);
  return s;
}
const owners = (s, id) => S.getCastaway(s, id).ownerIds.slice().sort();
const claim = (s, pid, c) => {
  const r = W.checkClaim(s, W.current(s), pid, c);
  assert.equal(r.error, undefined, `${pid}'s claim: ${r.error}`);
  return r.claim;
};
// The canvas's claims (boards 2, 3 and 5).
function canvasClaims(s) {
  return {
    sam: claim(s, "sam", { pickupIds: ["rob", "maggie"], dropId: "kilby", addIds: ["maggie", "patt"] }),
    kim: claim(s, "kim", { dropId: "mike", addIds: ["rob", "ori"] }),
    andrew: claim(s, "andrew", { dropId: "carter", addIds: ["maggie", "patt"] }),
    josie: claim(s, "josie", {}),
  };
}

test("the clock: waivers open with results, process 24h before the next episode, close as it airs", () => {
  const s = league();
  // A league switching to waivers mid-season gets a week for its latest results straight away.
  assert.equal(W.due(s, T0), "open");
  assert.equal(W.open(s, T0).episode, 2);
  W.process(s, {}, { now: T0 });
  W.close(s, T0);
  assert.equal(W.due(s, T0), null, "nothing new since episode 2's week");
  S.addElimination(s, "ep3", "jelly", "Voted Out");
  assert.equal(W.due(s, T0), "open");
  const p = W.open(s, T0);
  assert.equal(p.episode, 3);
  assert.equal(p.addDrop, true, "after episode 3 is an add/drop week (every 3)");
  assert.equal(p.processAt, new Date(EP4_AIRS - 24 * HOUR).toISOString());
  assert.equal(p.closesAt, new Date(EP4_AIRS).toISOString());
  assert.equal(W.due(s, EP4_AIRS - 25 * HOUR), null);
  assert.equal(W.due(s, EP4_AIRS - 24 * HOUR), "process");
  W.process(s, {}, { now: EP4_AIRS - 24 * HOUR });
  assert.equal(W.due(s, EP4_AIRS - HOUR), null, "free agency until airtime");
  assert.equal(W.due(s, EP4_AIRS), "close");
  W.close(s, EP4_AIRS);
  assert.equal(W.current(s), null);
  assert.equal(W.due(s, EP4_AIRS + HOUR), null, "no new week until episode 4 has results");
});

test("the clock: 12 or 48 hours, results that came late, and leagues with no air schedule", () => {
  const s = afterEpisode3({ settings: { waiverProcessHours: 48 } });
  assert.equal(W.current(s).processAt, new Date(EP4_AIRS - 48 * HOUR).toISOString());
  const late = league();
  S.addElimination(late, "ep3", "jelly", "Voted Out");
  const opened = EP4_AIRS - 10 * HOUR; // results in 10 hours before episode 4
  const p = W.open(late, opened);
  assert.equal(p.processAt, new Date(opened + 5 * HOUR).toISOString(), "halfway to airtime");
  const none = afterEpisode3({ airs: false });
  assert.equal(W.current(none).processAt, new Date(T0 + 24 * HOUR).toISOString(), "24h after opening");
  assert.equal(W.current(none).closesAt, null, "free agency until the next results");
});

test("every week opens while pickups are on, owed or not; add/drops alone open only their weeks", () => {
  const s = league();
  S.addElimination(s, "ep3", "x1", "Voted Out"); // nobody's: still a week, or it'd say someone lost one
  s.castaways.find((c) => c.id === "x1").status = "eliminated";
  assert.equal(W.due(s, T0), "open");
  const tradeOnly = league({ settings: { replenishEnabled: false } });
  S.addElimination(tradeOnly, "ep3", "jelly", "Voted Out");
  assert.equal(W.due(tradeOnly, T0), "open", "episode 3 is an add/drop week");
  const off = league({ settings: { replenishEnabled: false, tradeEnabled: false } });
  S.addElimination(off, "ep3", "jelly", "Voted Out");
  assert.equal(W.due(off, T0), null, "a league with Pickups and Add/drops off never opens waivers");
});

test("claims: only what you're owed, only free agents, add/drops only on their weeks", () => {
  const s = afterEpisode3();
  const p = W.current(s);
  assert.deepEqual(W.pickupsOwed(s, "sam"), { count: 1, lossIds: ["jelly"] });
  assert.equal(W.pickupsOwed(s, "kim").count, 0);
  assert.match(W.checkClaim(s, p, "kim", { pickupIds: ["rob"] }).error, /don’t have a pickup/);
  assert.match(W.checkClaim(s, p, "sam", { pickupIds: ["rob", "maggie", "ori", "patt"] }).error, /up to 3/);
  assert.match(W.checkClaim(s, p, "sam", { pickupIds: ["mike"] }).error, /free agents only/);
  assert.match(W.checkClaim(s, p, "sam", { dropId: "mike", addIds: ["rob"] }).error, /still on your team/);
  assert.match(W.checkClaim(s, p, "sam", { dropId: "kilby" }).error, /who to add/);
  assert.deepEqual(W.checkClaim(s, p, "sam", { pickupIds: ["rob", "rob", "maggie"] }).claim.pickupIds, ["rob", "maggie"]);
  assert.ok(W.isEmptyClaim(W.checkClaim(s, p, "dee", {}).claim));
  // Episode 4 isn't an add/drop week.
  W.process(s, {}, { now: T0 });
  W.close(s, T0);
  S.addElimination(s, "ep4", "d1", "Voted Out");
  const p4 = W.open(s, T0);
  assert.equal(p4.addDrop, false);
  assert.match(W.checkClaim(s, p4, "dee", { dropId: "d2", addIds: ["rob"] }).error, /No add\/drops/);
});

test("processing: the canvas's week -- pickups first, then add/drops, each in the frozen waiver order", () => {
  const s = afterEpisode3();
  const run = W.process(s, canvasClaims(s), { now: EP4_AIRS - 24 * HOUR });
  const r = (pid, kind) => run.results.find((x) => x.playerId === pid && x.kind === kind);
  assert.deepEqual(run.orderBefore, ["kim", "sam", "andrew", "josie", "dee"]);

  assert.equal(r("sam", "pickup").outcome, "got");
  assert.equal(r("sam", "pickup").castawayId, "rob");
  assert.equal(r("sam", "pickup").droppedCastawayId, "jelly");
  assert.deepEqual(owners(s, "rob"), ["sam"]);
  assert.deepEqual(owners(s, "jelly"), [], "Jelly's slot is replaced: her points stop counting for Sam");

  // Kim is ahead of Sam, but Sam's pickup beat Kim's add/drop to Rob.
  assert.equal(r("kim", "addDrop").castawayId, "ori");
  assert.equal(r("kim", "addDrop").choice, 2);
  assert.deepEqual(r("kim", "addDrop").passed, [{ castawayId: "rob", reason: "pickupFirst", byPlayerId: "sam" }]);
  // Sam is ahead of Andrew for Maggie; Andrew gets his 2nd choice.
  assert.equal(r("sam", "addDrop").castawayId, "maggie");
  assert.equal(r("andrew", "addDrop").castawayId, "patt");
  assert.deepEqual(r("andrew", "addDrop").passed, [{ castawayId: "maggie", reason: "ahead", byPlayerId: "sam" }]);
  assert.equal(r("josie", "addDrop").outcome, "skipped");
  assert.equal(r("dee", "addDrop").outcome, "noClaim");
  assert.deepEqual(owners(s, "kilby"), [], "whoever's dropped is a free agent");

  // Rolling waivers: movers to the back in their order; a quiet week moves you up.
  assert.deepEqual(run.orderAfter, ["josie", "dee", "kim", "sam", "andrew"]);
  assert.deepEqual(S.MidSeasonLogic.priorityList(s), run.orderAfter);
  assert.equal(W.current(s).phase, "processed");
  assert.equal(s.midSeason.log.filter((tx) => tx.via === "waivers").length, 4);
  assert.match(W.checkClaim(s, W.current(s), "sam", {}).error, /closed/, "no claims once processed");
});

test("your own pickup landing someone moves your add/drop claim on to your next choice", () => {
  const s = afterEpisode3();
  const run = W.process(s, { sam: claim(s, "sam", { pickupIds: ["maggie"], dropId: "kilby", addIds: ["maggie", "patt"] }) }, { now: T0 });
  const ad = run.results.find((x) => x.playerId === "sam" && x.kind === "addDrop");
  assert.equal(ad.castawayId, "patt");
  assert.deepEqual(ad.passed, [{ castawayId: "maggie", reason: "yours" }]);
});

test("free agency: instant, first come, just-dropped castaways in, one add/drop, order unchanged", () => {
  const s = afterEpisode3();
  W.process(s, canvasClaims(s), { now: EP4_AIRS - 24 * HOUR });
  const order = S.MidSeasonLogic.priorityList(s);
  assert.equal(W.freeAgencyMove(s, "josie", "kilby", "lewis", EP4_AIRS - 2 * HOUR), null, "Kilby was dropped in waivers");
  assert.deepEqual(owners(s, "kilby"), ["josie"]);
  assert.deepEqual(S.MidSeasonLogic.priorityList(s), order, "free agency never moves the order");
  assert.match(W.freeAgencyMove(s, "josie", "linnea", "jenna"), /made this week’s add\/drop/);
  assert.match(W.freeAgencyMove(s, "kim", "linnea", "k2"), /made this week’s add\/drop/, "Kim's went through in waivers");
  assert.match(W.freeAgencyMove(s, "dee", "kilby", "d1"), /not a free agent/, "Josie got there first");
  assert.match(W.freeAgencyMove(s, "dee", "linnea"), /who to drop/, "no pickup owed: an add needs a drop");
  assert.equal(W.freeAgencyMove(s, "dee", "linnea", "d1"), null);
  const off = afterEpisode3({ settings: { freeAgencyEnabled: false } });
  W.process(off, {}, { now: T0 });
  assert.match(W.freeAgencyMove(off, "josie", "rob", "lewis"), /no free agency/);
});

test("a pickup still unfilled at airtime is assigned, the same way every time", () => {
  const s = afterEpisode3();
  W.process(s, {}, { now: T0 }); // Sam made no claim
  assert.equal(W.pickupsOwed(s, "sam").count, 1);
  const copy = JSON.parse(JSON.stringify(s));
  W.close(s, EP4_AIRS);
  W.close(copy, EP4_AIRS);
  assert.equal(W.pickupsOwed(s, "sam").count, 0);
  const auto = s.midSeason.log.find((tx) => tx.via === "auto");
  assert.ok(FREE.includes(auto.addedCastawayId));
  assert.equal(auto.droppedCastawayId, "jelly");
  assert.equal(copy.midSeason.log.find((tx) => tx.via === "auto").addedCastawayId, auto.addedCastawayId, "deterministic");
  assert.deepEqual(W.periods(s)[0].autoFills, [auto.id]);
});

test("a pickup can be filled in free agency instead", () => {
  const s = afterEpisode3();
  W.process(s, { sam: claim(s, "sam", { pickupIds: ["rob"] }) }, { now: T0 });
  assert.equal(W.pickupsOwed(s, "sam").count, 0);
  const t = afterEpisode3();
  W.process(t, {}, { now: T0 });
  assert.equal(W.freeAgencyMove(t, "sam", "ori"), null);
  assert.deepEqual(owners(t, "ori"), ["sam"]);
  assert.equal(W.pickupsOwed(t, "sam").count, 0);
});

test("Undo last waiver run puts everything back exactly, and holds the week until Process now or airtime", () => {
  const s = afterEpisode3();
  const before = JSON.parse(JSON.stringify(s));
  W.process(s, canvasClaims(s), { now: EP4_AIRS - 24 * HOUR });
  W.freeAgencyMove(s, "josie", "kilby", "lewis");
  assert.equal(W.undo(s), null);
  assert.deepEqual(s.castaways, before.castaways, "every castaway and flag as it was");
  assert.deepEqual(S.MidSeasonLogic.priorityList(s), ["kim", "sam", "andrew", "josie", "dee"]);
  assert.deepEqual(s.midSeason.log, before.midSeason.log);
  const p = W.current(s);
  assert.equal(p.phase, "open");
  assert.equal(p.hold, true);
  assert.equal(W.due(s, EP4_AIRS - HOUR), null, "held: the schedule doesn't process it");
  assert.equal(W.due(s, EP4_AIRS), "process", "but airtime still does");
  assert.match(W.undo(s), /no waiver run/);
});

test("results taken back cancel an open week; a later episode's results finish it and open the next", () => {
  const s = afterEpisode3();
  S.removeElimination(s, "ep3", "jelly");
  assert.equal(W.due(s, T0), "cancel");
  W.cancel(s);
  assert.equal(W.periods(s).length, 0);

  const c = afterEpisode3({ airs: false });
  S.addElimination(c, "ep4", "d1", "Voted Out");
  assert.equal(W.due(c, T0 + HOUR), "process");
  W.process(c, {}, { now: T0 + HOUR });
  assert.equal(W.due(c, T0 + HOUR), "close");
  W.close(c, T0 + HOUR);
  assert.equal(W.due(c, T0 + HOUR), "open");
  assert.equal(W.open(c, T0 + HOUR).episode, 4);
});

test("spoilers: someone who hasn't revealed episode 3 sees the week exist, and nothing else", () => {
  const s = afterEpisode3();
  const claimsIn = ["kim", "sam"];
  W.setClaimsIn(s, W.current(s), claimsIn);
  W.process(s, canvasClaims(s), { now: EP4_AIRS - 24 * HOUR });
  const real = JSON.stringify(s);
  const v = S.SpoilerLogic.viewThrough(s, 2);
  assert.equal(JSON.stringify(s), real, "the real state is untouched");
  assert.equal(S.getCastaway(v, "jelly").status, "active");
  assert.deepEqual(owners(v, "jelly"), ["sam"], "Sam still has Jelly");
  assert.deepEqual(owners(v, "rob"), [], "and no pickup");
  assert.deepEqual(owners(v, "kilby"), ["sam"], "nor an add/drop");
  assert.equal(S.getCastaway(v, "kilby").departedVia, null);
  assert.deepEqual(owners(v, "mike"), ["kim"]);
  assert.equal(v.midSeason.log.length, 0);
  assert.deepEqual(S.MidSeasonLogic.priorityList(v), ["kim", "sam", "andrew", "josie", "dee"], "the order before the run");
  const p = W.periods(v)[0];
  assert.equal(p.hidden, true);
  assert.deepEqual(p.claimsIn, []);
  assert.equal(p.run, null);
  assert.equal(p.processAt, W.periods(s)[0].processAt, "when it processes is no spoiler");
  // Revealed: everything.
  const seen = S.SpoilerLogic.viewThrough(s, 3);
  assert.deepEqual(owners(seen, "rob"), ["sam"]);
  assert.ok(W.periods(seen)[0].run);
});

test("spoilers: a pickup from the old live rounds after an unrevealed episode is taken back too", () => {
  const s = league();
  S.addElimination(s, "ep3", "jelly", "Voted Out");
  // Logged as a live round logged it: no waiver week, no `prev`.
  const tx = S.MidSeasonLogic.applyPickup(s, "sam", "rob", "jelly");
  delete tx.prev;
  const v = S.SpoilerLogic.viewThrough(s, 2);
  assert.deepEqual(owners(v, "rob"), []);
  assert.deepEqual(owners(v, "jelly"), ["sam"]);
  assert.ok(!S.getCastaway(v, "jelly").replenishClaimed, "her loss is unclaimed again");
});

test("shared ownership: two claims for the same castaway both go through", () => {
  const s = afterEpisode3({ type: "active-roster", shared: true });
  // Active Roster: owed only once down to replenishAt (2 active slots: down to 1). Take Sam and Kim down.
  ["kilby", "k2", "k3"].forEach((id) => S.addElimination(s, "ep3", id, "Voted Out"));
  assert.equal(W.pickupsOwed(s, "sam").count, 1);
  assert.equal(W.pickupsOwed(s, "kim").count, 1);
  const run = W.process(s, {
    sam: claim(s, "sam", { pickupIds: ["rob"] }),
    kim: claim(s, "kim", { pickupIds: ["rob"] }),
  }, { now: T0 });
  assert.deepEqual(owners(s, "rob"), ["kim", "sam"]);
  assert.equal(run.results.filter((x) => x.outcome === "got").length, 2);
});

test("shared ownership: someone dropped earlier in the run can still be added by anyone else", () => {
  // Exclusive leagues hold a castaway dropped in the run back until free agency; in a shared league,
  // Kim letting Mike go has nothing to do with whether Andrew may have him.
  const s = afterEpisode3({ type: "active-roster", shared: true });
  const run = W.process(s, {
    kim: claim(s, "kim", { dropId: "mike", addIds: ["rob"] }),
    andrew: claim(s, "andrew", { dropId: "carter", addIds: ["mike", "ori"] }),
  }, { now: T0 });
  const andrew = run.results.find((r) => r.playerId === "andrew" && r.kind === "addDrop");
  assert.equal(andrew.castawayId, "mike");
  assert.equal(andrew.choice, 1);
  assert.deepEqual(owners(s, "mike"), ["andrew"]);
});

test("Active Roster: an unfilled pickup at airtime gets the free agent with the most points", () => {
  const s = afterEpisode3({ type: "active-roster", shared: true });
  ["kilby", "s3"].forEach((id) => S.addElimination(s, "ep3", id, "Voted Out"));
  const ev = S.formatOf(s).events.find((e) => S.ActiveRosterLogic.pointsFor(s, e.id) > 0);
  S.addScoringEvent(s, "ep2", ev.id, "linnea");
  W.process(s, {}, { now: T0 });
  W.close(s, EP4_AIRS);
  const auto = s.midSeason.log.find((tx) => tx.via === "auto" && tx.playerId === "sam");
  assert.equal(auto.addedCastawayId, "linnea");
});

test("computer players claim when the week processes, and their claims are valid ones", () => {
  const s = afterEpisode3();
  s.players.find((p) => p.id === "sam").automated = true;
  const c = Bots.waiverClaim(s, "sam", W.current(s));
  assert.equal(c.pickupIds.length, 3, "owed one: three ranked claims");
  assert.equal(W.checkClaim(s, W.current(s), "sam", c).error, undefined);
});
