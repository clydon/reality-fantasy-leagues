// Simple waivers as one player reads them (src/lib/game/waiver-view.ts, docs/PLAN-new-design.md step 6a): who of yours to
// replace, your team, who's free, your own picks a spot at a time, the picking order, the run in picking order, and How it
// works; from your copy at your mark, so a week opened by an episode you haven't revealed says only "reveal it first".
// Runs on a made-up league (no database). Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const { waiverWeek, waiverHow } = jiti("../src/lib/game/waiver-view.ts");
const S = require("../src/lib/game/state-logic.js");
const W = S.WaiverLogic;

const T0 = Date.parse("2026-10-15T14:00:00Z");
const TEAMS = { ann: ["a1", "a2", "a3"], bo: ["b1", "b2", "b3"], cy: ["c1", "c2", "c3"] };
const FREE = ["f1", "f2", "f3", "f4"];

function league({ shared = false, settings = {} } = {}) {
  const owned = Object.entries(TEAMS).flatMap(([p, ids]) => ids.map((id) => [id, p]));
  const s = S.migrateLeagueState({
    settings: {
      leagueTypeId: "classic-draft", showFormat: "survivor", ownershipMode: shared ? "shared" : "exclusive", teamSize: 3, startEpisode: 1,
      replaceRule: "always", waiverWindows: { schedule: "every", every: 3, swaps: 1 }, autoFill: true, replenishOrderBy: "leastPoints", ...settings,
    },
    players: Object.keys(TEAMS).map((id) => ({ id, name: id, color: "#000", active: true })),
    draftOrder: ["cy", "bo", "ann"],
    castaways: [...owned.map(([id]) => id), ...FREE].map((id) => ({
      id, name: id.toUpperCase(), status: "active", placementOrder: null, exitMethod: null, exitEpisodeId: null,
      ownerIds: owned.filter(([c]) => c === id).map(([, p]) => p),
    })),
    episodes: Array.from({ length: 13 }, (_, i) => ({ id: `ep${i + 1}`, number: i + 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} })),
  });
  S.addElimination(s, "ep1", "b3", "Voted Out");
  S.addElimination(s, "ep2", "c3", "Voted Out");
  S.addElimination(s, "ep3", "a1", "Voted Out");
  W.open(s, T0);
  return s;
}
const ref = { leagueId: "l1", name: "Couch Cup", gameType: "classic-draft", gameName: "Outlast", yourRole: "member" };
const userOf = (p) => `user-${p}`;

test("up to date: who of yours to replace, your team, who's free and the picking order", () => {
  const s = league();
  const w = waiverWeek(ref, s, "ann", 3, userOf, null);
  assert.equal(w.stage, "open");
  assert.equal(w.revealFirst, null);
  assert.deepEqual(w.replace, ["a1"], "A1 left in Episode 3");
  assert.deepEqual(w.team.map((f) => f.id), ["a2", "a3", "a1"], "still in first, then who's out");
  assert.equal(w.team.find((f) => f.id === "a1").out, 3);
  assert.deepEqual(w.free.map((f) => f.id).sort(), FREE, "free agents only (exclusive)");
  assert.equal(w.order.length, 3);
  assert.ok(w.order.some((o) => o.you && o.playerId === "ann"));
  assert.equal(w.orderBy, "leastPoints");
  assert.equal(w.fallback, true);
  assert.equal(w.shared, false);
  assert.equal(w.period.due, W.current(s).processAt);
});

test("behind on results: reveal it first, and nothing in the week says who left", () => {
  const s = league();
  const w = waiverWeek(ref, s, "ann", 2, userOf, [{ addId: "f1", dropId: "a1" }]);
  assert.equal(w.revealFirst, 3);
  assert.equal(w.stage, "none");
  assert.deepEqual(w.replace, []);
  assert.deepEqual(w.spots, []);
  assert.ok(w.team.every((f) => f.out === null), "A1 still in, as far as ann has seen");
});

test("your own picks, a spot at a time: first choice first, then backups", () => {
  const s = league();
  const w = waiverWeek(ref, s, "ann", 3, userOf, [{ addId: "f2", dropId: "a1" }, { addId: "f1", dropId: "a1" }]);
  assert.deepEqual(w.spots, [{ dropId: "a1", addIds: ["f2", "f1"] }]);
});

test("every week's run, oldest first (Episodes lists them where they happened); one you haven't revealed isn't there", () => {
  const s = league();
  W.process(s, { ann: W.checkClaim(s, W.current(s), "ann", { pairs: [{ addId: "f1", dropId: "a1" }] }).claim }, { now: T0 + 3600e3, by: "commissioner" });
  S.addElimination(s, "ep4", "b2", "Voted Out");
  W.open(s, T0 + 7 * 86400e3);
  W.process(s, { bo: W.checkClaim(s, W.current(s), "bo", { pairs: [{ addId: "f2", dropId: "b2" }] }).claim }, { now: T0 + 7 * 86400e3 + 3600e3, by: "commissioner" });
  const w = waiverWeek(ref, s, "ann", 4, userOf, null);
  assert.deepEqual(w.runs.map((r) => r.episode), [3, 4]);
  assert.equal(w.run, w.runs[1], "the week's run is the latest");
  assert.ok(w.runs[0].moves.some((m) => m.you && m.outcome === "got" && m.add.id === "f1"), "after Episode 3: you got F1");
  assert.ok(w.runs[1].moves.some((m) => m.name === "bo" && m.outcome === "got" && m.add.id === "f2"), "after Episode 4: bo got F2");
  const behind = waiverWeek(ref, s, "ann", 3, userOf, null);
  assert.deepEqual(behind.runs.map((r) => r.episode), [3], "on Episode 3: the week Episode 4 opened isn't there");
});

test("after the run: each move in picking order, yours marked, and why it wasn't a first choice", () => {
  const s = league();
  // bo (out B3) and ann (out A1) both want F1: whoever's first in line gets them.
  const claims = {
    ann: W.checkClaim(s, W.current(s), "ann", { pairs: [{ addId: "f1", dropId: "a1" }, { addId: "f2", dropId: "a1" }] }).claim,
    bo: W.checkClaim(s, W.current(s), "bo", { pairs: [{ addId: "f1", dropId: "b3" }] }).claim,
  };
  const first = S.MidSeasonLogic.order(s, W.rotation(s))[0];
  W.process(s, claims, { now: T0 + 3600e3, by: "commissioner" });
  const w = waiverWeek(ref, s, "ann", 3, userOf, null);
  assert.equal(w.stage, "processed");
  const mine = w.run.moves.find((m) => m.you);
  assert.ok(mine && mine.outcome === "got");
  if (first === "bo") {
    assert.equal(mine.add.id, "f2");
    assert.equal(mine.choice, 2);
    assert.match(mine.why, /^2nd choice: bo got F1 first$/);
  } else {
    assert.equal(mine.add.id, "f1");
    assert.equal(mine.why, "1st choice");
  }
  assert.ok(w.run.moves.every((m) => m.kind === "replace"));
});

test("shared ownership: no picking order; How it works says who picks first", () => {
  // Shared Classic has no waivers at all; a shared Weekly Lineup does.
  const s = league({ shared: true, settings: { leagueTypeId: "active-roster", activeSlots: 2, benchSlots: 1 } });
  const w = waiverWeek({ ...ref, gameType: "active-roster", gameName: "Weekly Lineup" }, s, "ann", 3, userOf, null);
  assert.equal(w.shared, true);
  assert.deepEqual(w.order, []);
  assert.match(w.how.order, /everyone can have the same/i);
  const ex = waiverHow(league());
  assert.equal(ex.order, "Lowest score picks first.");
  assert.equal(ex.lanes.episodes.length, ex.lanes.replace.length);
  assert.ok(ex.lanes.replace.every(Boolean), "replace right away: every episode");
});

test("waivers that start when Merged does: How it works says so, and the lanes are empty until it", () => {
  const s = league({ settings: { replaceRule: "never", waiverWindows: { schedule: "manual", every: 3, swaps: 1 }, waiverStartPhase: "merged" } });
  s.midSeason.waivers.periods = [];
  const how = waiverHow(s);
  assert.equal(how.starts, "Waivers start when Merged starts");
  assert.match(how.out, /^They stay on your team until Merged starts\. After its first episode, a waiver window lets you replace everyone who's out\. After that, out is out\.$/);
  assert.match(how.swap, /^Not until Merged starts: its waiver window allows 1 swap\. After that, when your commissioner opens a waiver window\.$/);
  assert.ok(how.lanes.replace.every((on) => !on) && how.lanes.swap.every((on) => !on), "nothing while nobody knows when");
  // The merge's start known (Episode 6) but not seen yet: nothing says where (a spoiler), in the season's name for the phase.
  S.settlePhases(s, { phases: [{ id: "tribes", from: 1 }, { id: "merged", from: 6 }], open: 4 });
  const known = waiverHow(s, [{ id: "merged", name: "The Merge" }]);
  assert.equal(known.starts, "Waivers start when The Merge starts");
  assert.ok(known.lanes.replace.every((on) => !on) && known.lanes.swap.every((on) => !on));
  // Once you've seen it start: its window in the lanes, and the usual words.
  S.addElimination(s, "ep4", "a2", "Voted Out");
  S.addElimination(s, "ep5", "c2", "Voted Out");
  S.addElimination(s, "ep6", "b2", "Voted Out");
  const after = waiverHow(s);
  assert.equal(after.starts, null);
  assert.equal(after.out, "They stay on your team: there are no replacements.");
  const at = (lane) => after.lanes.episodes.filter((n, i) => lane[i]);
  assert.deepEqual(at(after.lanes.replace), [6]);
  assert.deepEqual(at(after.lanes.swap), [6]);
  // A viewer who hasn't seen Episode 6 still reads it as ahead.
  const behind = waiverHow(S.GhostLogic.viewFor(s, "ann", 4));
  assert.equal(behind.starts, "Waivers start when Merged starts");
  assert.ok(behind.lanes.replace.every((on) => !on));
});

test("a game with no waivers has no week", () => {
  const s = league({ settings: { leagueTypeId: "pickem" } });
  assert.equal(waiverWeek({ ...ref, gameType: "pickem" }, s, "ann", 3, userOf, null), null);
});
