// Mid-season waivers (StateLogic.WaiverLogic; docs/PLAN-midseason-waivers.md, docs/PLAN-waivers-v2.md):
// the week's clock, the v2 settings (replacement rules, waiver windows, the recommendation) and their
// backfill from the old switches, claims as ranked "add X, drop Y" pairs, processing in rounds in one
// waiver order, free agency, auto-fill, Open a waiver window, Undo, and the spoiler view. The main
// scenario is the design canvas's own: Couch Crew after Episode 3. Run with `npm test`.
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

// Pre-v2 switches by default (Pickups and Add/drops on, every 3): the backfill reads them as
// "Replace them" (Classic) / "Only when short" (Active Roster), a window every 3 episodes with 1 swap.
function league({ type = "classic-draft", shared = false, settings = {}, airs = true } = {}) {
  const owned = Object.entries(TEAMS).flatMap(([p, ids]) => ids.map((id) => [id, p]));
  const ids = [...owned.map(([id]) => id), ...FREE, ...EARLY_OUT];
  const s = S.migrateLeagueState({
    settings: {
      leagueTypeId: type, showFormat: "survivor", ownershipMode: shared ? "shared" : "exclusive",
      replenishEnabled: true, tradeEnabled: true, swapEvery: 3, startEpisode: 1, replenishOrderBy: "rolling",
      ...(type === "active-roster" ? { activeSlots: 2, benchSlots: 1 } : { teamSize: 3 }), ...settings,
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
const pair = (addId, dropId) => ({ addId, dropId });
const claim = (s, pid, c) => {
  const r = W.checkClaim(s, W.current(s), pid, c);
  assert.equal(r.error, undefined, `${pid}'s claim: ${r.error}`);
  return r.claim;
};
const result = (run, pid, kind) => run.results.find((x) => x.playerId === pid && x.kind === kind);
// The canvas's claims (boards 2, 3 and 5), as pairs.
function canvasClaims(s) {
  return {
    sam: claim(s, "sam", { pairs: [pair("rob", "jelly"), pair("maggie", "jelly"), pair("maggie", "kilby"), pair("patt", "kilby")] }),
    kim: claim(s, "kim", { pairs: [pair("rob", "mike"), pair("ori", "mike")] }),
    andrew: claim(s, "andrew", { pairs: [pair("maggie", "carter"), pair("patt", "carter")] }),
    josie: claim(s, "josie", { pairs: [] }),
  };
}

// ---- Settings: the backfill, the old switches, the recommendation ----

test("backfill: every league keeps doing what its old switches did", () => {
  const read = (settings, type) => {
    const s = league({ type, settings, shared: type === "active-roster" });
    return [s.settings.replaceRule, s.settings.waiverWindows, s.settings.waiverFeel, s.settings.autoFill];
  };
  assert.deepEqual(read({}), ["always", { schedule: "every", every: 3, swaps: 1 }, "balanced", true]);
  assert.deepEqual(read({}, "active-roster"), ["whenShort", { schedule: "every", every: 3, swaps: 1 }, "balanced", true]);
  assert.deepEqual(read({ tradeEnabled: false })[1], { schedule: "manual", every: 3, swaps: 0 });
  assert.deepEqual(read({ swapEvery: 1 })[1], { schedule: "everyEpisode", every: 2, swaps: 1 });
  assert.deepEqual(read({ replenishEnabled: false, tradeEnabled: false }).slice(0, 2), ["never", { schedule: "manual", every: 3, swaps: 0 }]);
  assert.equal(W.enabled(league({ settings: { replenishEnabled: false, tradeEnabled: false } })), false, "both off stays off");
  // A league that's never been through migrateLeagueState reads the same through config().
  const raw = league();
  ["replaceRule", "waiverWindows", "waiverFeel", "autoFill"].forEach((k) => delete raw.settings[k]);
  assert.equal(W.config(raw).replaceRule, "always");
  // Weeks: an add/drop week is a window with one swap.
  const s = afterEpisode3();
  delete W.current(s).window;
  delete W.current(s).swaps;
  assert.equal(W.swapsAllowed(W.current(s)), 1, "read as one swap before the backfill");
  W.backfill(s);
  assert.equal(W.current(s).window, true);
  assert.equal(W.current(s).swaps, 1);
});

test("settings: the old switches move the v2 settings, and v2 writes keep the old switches in step", () => {
  const s = league();
  S.updateSettings(s, "replenishEnabled", false);
  assert.equal(s.settings.replaceRule, "never");
  S.updateSettings(s, "replenishEnabled", true);
  assert.equal(s.settings.replaceRule, "always");
  S.updateSettings(s, "tradeEnabled", false);
  assert.deepEqual(s.settings.waiverWindows, { schedule: "manual", every: 3, swaps: 0 });
  S.updateSettings(s, "tradeEnabled", true);
  S.updateSettings(s, "swapEvery", 4);
  assert.deepEqual(s.settings.waiverWindows, { schedule: "every", every: 4, swaps: 1 });

  S.updateSettings(s, "replaceRule", "windows");
  S.updateSettings(s, "waiverWindows", { schedule: "manual", swaps: 99 });
  assert.deepEqual(s.settings.waiverWindows, { schedule: "manual", every: 4, swaps: 3 }, "Whole team is the roster size");
  assert.equal(s.settings.replenishEnabled, true, "windows still replaces");
  assert.equal(s.settings.tradeEnabled, false, "no scheduled swaps");
  S.updateSettings(s, "replaceRule", "nonsense");
  assert.equal(s.settings.replaceRule, "windows", "an unknown rule is refused");
  S.updateSettings(s, "autoFill", false);
  assert.equal(W.autoFillOn(s), false);
  // Applying the recommendation (Classic 5 × 3 out of 23: 8 free agents).
  S.updateSettings(s, "waiverRecommendation", "competitive");
  assert.equal(s.settings.waiverFeel, "competitive");
  assert.equal(W.isRecommended(s), true);
  S.updateSettings(s, "waiverWindows", { swaps: 1 });
  assert.equal(W.isRecommended(s), false, "touched: Customized");
});

test("recommend(): the plan's worked examples (C = 18, E = 13)", () => {
  const rec = (o) => W.recommend({ C: 18, E: 13, ...o });
  const brief = (r) => r.feasible ? [r.settings.replaceRule, r.settings.replenishAt, r.settings.waiverWindows, r.settings.waiverProcessHours] : r;

  // Last Survivor Standing: s = 0.5 -> whenShort -> one stricter for Classic: windows; manual, Whole team.
  assert.deepEqual(brief(rec({ type: "classic-draft", T: 4, R: 3 })), ["windows", 2, { schedule: "manual", every: 3, swaps: 3 }, 24]);
  // Weekly Start/Bench: shared -> whenShort (2); X = 3.
  assert.deepEqual(brief(rec({ type: "active-roster", shared: true, T: 3, R: 5, S: 3 })), ["whenShort", 2, { schedule: "every", every: 3, swaps: 1 }, 24]);
  // s = 0.2 -> windows; X = 3.
  assert.deepEqual(brief(rec({ type: "active-roster", T: 3, R: 5, S: 3 })), ["windows", 2, { schedule: "every", every: 3, swaps: 1 }, 24]);
  // 4 × (3+1): s = 0.125 -> windows; X = 4.
  assert.deepEqual(brief(rec({ type: "active-roster", T: 4, R: 4, S: 3 })), ["windows", 2, { schedule: "every", every: 4, swaps: 1 }, 24]);
  // 3 × 4 out of 24: s = 1 -> always. The plan's table says X = 4, but its formula gives 3 for E = 13
  // (r = 21/12, 24 / (4 · 1.75) = 3.4): flagged for the user; this asserts the formula.
  assert.deepEqual(brief(rec({ type: "active-roster", C: 24, T: 3, R: 4, S: 4 })), ["always", 3, { schedule: "every", every: 3, swaps: 1 }, 24]);
  // 12 × (3+2), shared: whenShort (2); X = 3; 48h with more than 6 teams.
  assert.deepEqual(brief(rec({ type: "active-roster", shared: true, T: 12, R: 5, S: 3 })), ["whenShort", 2, { schedule: "every", every: 3, swaps: 1 }, 48]);
  // 12 × anything, exclusive: not feasible.
  assert.deepEqual(rec({ type: "active-roster", T: 12, R: 4, S: 3 }), { feasible: false, need: 48, have: 18 });
  assert.equal(rec({ type: "active-roster", T: 4, R: 4, S: 4 }).feasible, false, "4 × 4 fills the cast, but no free agent per team");
  // No waivers at all.
  assert.equal(rec({ type: "pickem", T: 4, R: 1 }), null);
  assert.equal(rec({ type: "classic-draft", shared: true, T: 4, R: 3 }), null);
  // Nothing left over: never, manual, no swaps.
  assert.deepEqual(brief(rec({ type: "classic-draft", T: 6, R: 3 })), ["never", 2, { schedule: "manual", every: 3, swaps: 0 }, 24]);
});

test("recommend(): Casual and Competitive move it a step", () => {
  const base = { C: 18, E: 13, type: "active-roster", T: 3, R: 5, S: 3 };
  const casual = W.recommend({ ...base, feel: "casual" }).settings;
  assert.equal(casual.replaceRule, "whenShort", "one more generous than windows");
  assert.deepEqual(casual.waiverWindows, { schedule: "every", every: 4, swaps: 1 });
  assert.equal(casual.waiverProcessHours, 48);
  assert.equal(casual.replenishOrderBy, "leastPoints");
  assert.equal(casual.autoFill, true);
  const comp = W.recommend({ ...base, feel: "competitive" }).settings;
  assert.equal(comp.replaceRule, "never", "one stricter than windows");
  assert.deepEqual(comp.waiverWindows, { schedule: "every", every: 2, swaps: 1 });
  assert.equal(comp.waiverProcessHours, 12, "4 or fewer teams");
  assert.equal(comp.replenishOrderBy, "rolling");
  assert.equal(comp.autoFill, false, "miss the deadline, play short");
  // Every episode is as often as it gets.
  const fast = W.recommend({ C: 18, E: 13, type: "active-roster", shared: true, T: 5, R: 5, S: 3, feel: "competitive" }).settings;
  assert.deepEqual(fast.waiverWindows, { schedule: "every", every: 2, swaps: 1 });
  assert.deepEqual(W.recommend({ C: 18, E: 13, type: "active-roster", shared: true, T: 5, R: 6, S: 3, feel: "competitive" }).settings.waiverWindows.schedule, "everyEpisode");
  assert.equal(W.recommend({ C: 18, E: 13, type: "active-roster", shared: true, T: 5, R: 5, S: 3, feel: "competitive" }).settings.waiverProcessHours, 24);
});

// ---- The clock, and when weeks open ----

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
  assert.equal(p.window, true, "after episode 3 is a window (every 3)");
  assert.equal(p.swaps, 1);
  assert.equal(p.addDrop, true, "and says so the pre-v2 way");
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

test("when weeks open: every episode for replacements that don't wait; otherwise only windows", () => {
  const s = league();
  S.addElimination(s, "ep3", "x1", "Voted Out"); // nobody's: still a week, or it'd say someone lost one
  s.castaways.find((c) => c.id === "x1").status = "eliminated";
  assert.equal(W.due(s, T0), "open");
  // Swaps only (Pickups off): only the scheduled windows.
  const swapsOnly = league({ settings: { replenishEnabled: false } });
  S.addElimination(swapsOnly, "ep3", "jelly", "Voted Out");
  assert.equal(W.due(swapsOnly, T0), "open", "episode 3 is a window");
  W.open(swapsOnly, T0);
  W.process(swapsOnly, {}, { now: T0 });
  W.close(swapsOnly, T0 + HOUR);
  S.addElimination(swapsOnly, "ep4", "d1", "Voted Out");
  assert.equal(W.due(swapsOnly, T0 + 2 * HOUR), null, "episode 4 isn't");
  // Replace, but only every X episodes: windows with no swaps still open for the replacements.
  const everyX = league({ settings: { replaceRule: "windows", waiverWindows: { schedule: "every", every: 3, swaps: 0 } } });
  S.addElimination(everyX, "ep3", "jelly", "Voted Out");
  assert.equal(W.due(everyX, T0), "open");
  assert.equal(W.open(everyX, T0).swaps, 0);
  // Manual only: nothing opens on its own, whatever happens.
  const manual = league({ settings: { replaceRule: "windows", waiverWindows: { schedule: "manual", swaps: 3 } } });
  S.addElimination(manual, "ep3", "jelly", "Voted Out");
  assert.equal(W.due(manual, T0), null);
  assert.equal(W.enabled(manual), true, "but waivers are on: the commissioner opens windows");
  const off = league({ settings: { replenishEnabled: false, tradeEnabled: false } });
  S.addElimination(off, "ep3", "jelly", "Voted Out");
  assert.equal(W.due(off, T0), null, "a league with nothing on never opens waivers");
  assert.equal(W.nextWindowEpisode(league(), 3), 6);
  assert.equal(W.nextWindowEpisode(manual, 3), null);
});

// ---- Replacement rules ----

test("replacement rules: always, only when short, only in windows, never", () => {
  const out = (s, ...ids) => ids.forEach((id) => S.addElimination(s, "ep3", id, "Voted Out"));
  // Always: every loss, after any episode.
  const always = league({ settings: { replaceRule: "always" } });
  out(always, "jelly", "mike", "k2");
  assert.deepEqual(W.replacementsOwed(always, "sam", null), { count: 1, lossIds: ["jelly"], outIds: ["jelly"] });
  assert.equal(W.replacementsOwed(always, "kim", null).count, 2);
  // Only when short (Classic: roster 3, so down to 2): Sam (2 left) gets 1, Kim (1 left) gets 2.
  const short = league({ settings: { replaceRule: "whenShort" } });
  out(short, "jelly", "mike", "k2");
  assert.equal(W.shortAt(short), 2);
  assert.equal(W.replacementsOwed(short, "sam", null).count, 1);
  assert.equal(W.replacementsOwed(short, "kim", null).count, 2);
  S.updateSettings(short, "replenishAt", 1);
  assert.equal(W.replacementsOwed(short, "sam", null).count, 0, "2 still in is enough");
  assert.deepEqual(W.replacementsOwed(short, "kim", null), { count: 1, lossIds: ["mike"], outIds: ["mike", "k2"] }, "back up to 2, either loss");
  // Only in waiver windows: nothing until a window.
  const win = league({ settings: { replaceRule: "windows", waiverWindows: { schedule: "every", every: 3, swaps: 0 } } });
  out(win, "jelly");
  assert.equal(W.replacementsOwed(win, "sam", null).count, 0);
  const p = W.open(win, T0);
  assert.equal(W.replacementsOwed(win, "sam", p).count, 1);
  // Never.
  const never = league({ settings: { replaceRule: "never" } });
  out(never, "jelly");
  assert.equal(W.replacementsOwed(never, "sam", W.open(never, T0)).count, 0);
});

// ---- Claims ----

test("claims: pairs drop someone of yours and add a free agent, within what the week allows", () => {
  const s = afterEpisode3();
  const p = W.current(s);
  const err = (pid, pairs) => W.checkClaim(s, p, pid, { pairs }).error;
  assert.equal(err("sam", [pair("rob", "jelly"), pair("maggie", "s3")]), undefined, "a replacement and a swap");
  assert.match(err("sam", [pair("rob", "mike")]), /on your team/);
  assert.match(err("sam", [pair("mike", "kilby")]), /free agents only/);
  assert.match(err("kim", [pair("rob", "x1")]), /on your team/);
  // 1 owed + 1 swap + 2 spare = 4 different adds; the same add may appear in several pairs.
  assert.equal(err("sam", [pair("rob", "jelly"), pair("rob", "kilby"), pair("maggie", "kilby"), pair("ori", "s3"), pair("patt", "s3")]), undefined);
  assert.match(err("sam", [pair("rob", "jelly"), pair("maggie", "kilby"), pair("ori", "s3"), pair("patt", "s3"), pair("linnea", "s3")]), /up to 4/);
  const c = claim(s, "sam", { pairs: [pair("rob", "jelly"), pair("rob", "jelly"), pair("maggie", "s3")] });
  assert.deepEqual(c.pairs, [pair("rob", "jelly"), pair("maggie", "s3")], "duplicates go");
  assert.deepEqual([c.pickupIds, c.dropId, c.addIds], [["rob"], "s3", ["maggie"]], "and the pre-v2 view of it");
  assert.ok(W.isEmptyClaim(claim(s, "dee", { pairs: [] })));
  // Not a window: no swaps; replacements still (always). (Closed as it processed: no auto-fill.)
  W.process(s, {}, { now: T0 });
  W.close(s, T0);
  S.addElimination(s, "ep4", "d1", "Voted Out");
  const p4 = W.open(s, T0 + HOUR);
  assert.equal(p4.window, false);
  assert.match(W.checkClaim(s, p4, "dee", { pairs: [pair("rob", "d2")] }).error, /No swaps this week/);
  assert.equal(W.checkClaim(s, p4, "dee", { pairs: [pair("rob", "d1")] }).error, undefined);
  assert.match(W.checkClaim(s, p4, "kim", { pairs: [pair("rob", "x1")] }).error, /on your team/);
});

test("claims: the pre-v2 shape still works, as each pickup paired with every loss it could replace", () => {
  const s = afterEpisode3();
  const p = W.current(s);
  assert.match(W.checkClaim(s, p, "kim", { pickupIds: ["rob"] }).error, /can’t replace anyone/);
  assert.match(W.checkClaim(s, p, "sam", { pickupIds: ["rob", "maggie", "ori", "patt"] }).error, /up to 3/);
  assert.match(W.checkClaim(s, p, "sam", { pickupIds: ["mike"] }).error, /free agents only/);
  assert.match(W.checkClaim(s, p, "sam", { dropId: "mike", addIds: ["rob"] }).error, /on your team/);
  assert.match(W.checkClaim(s, p, "sam", { dropId: "kilby" }).error, /who to add/);
  const c = claim(s, "sam", { pickupIds: ["rob", "rob", "maggie"], dropId: "kilby", addIds: ["maggie", "patt"] });
  assert.deepEqual(c.pairs, [pair("rob", "jelly"), pair("maggie", "jelly"), pair("maggie", "kilby"), pair("patt", "kilby")]);
  assert.deepEqual([c.pickupIds, c.dropId, c.addIds], [["rob", "maggie"], "kilby", ["maggie", "patt"]], "round trip");
  // A stored row carries both: its pairs win.
  assert.deepEqual(W.pairsOf(s, p, "sam", { ...c, pickupIds: ["ori"] }).pairs, c.pairs);
  // Owed two: every pickup with each loss, oldest first.
  S.addElimination(s, "ep3", "kilby", "Voted Out");
  assert.deepEqual(W.pairsOf(s, p, "sam", { pickupIds: ["rob", "ori"] }).pairs, [pair("rob", "jelly"), pair("rob", "kilby"), pair("ori", "jelly"), pair("ori", "kilby")]);
});

// ---- Processing ----

test("processing: the canvas's week in rounds, one waiver order, no priority for replacements", () => {
  const s = afterEpisode3();
  const run = W.process(s, canvasClaims(s), { now: EP4_AIRS - 24 * HOUR });
  assert.deepEqual(run.orderBefore, ["kim", "sam", "andrew", "josie", "dee"]);

  // Round 1. Kim is first: Rob for Mike.
  assert.deepEqual(result(run, "kim", "addDrop"), { playerId: "kim", kind: "addDrop", outcome: "got", castawayId: "rob", droppedCastawayId: "mike", choice: 1, round: 1, passed: [], txId: result(run, "kim", "addDrop").txId });
  // Sam wanted Rob for Jelly too; Kim was ahead. Maggie, his 2nd choice for Jelly.
  const samRep = result(run, "sam", "pickup");
  assert.deepEqual([samRep.outcome, samRep.castawayId, samRep.droppedCastawayId, samRep.choice, samRep.round], ["got", "maggie", "jelly", 2, 1]);
  assert.deepEqual(samRep.passed, [{ castawayId: "rob", reason: "ahead", byPlayerId: "kim" }]);
  assert.deepEqual(owners(s, "jelly"), [], "Jelly's slot is replaced");
  // Andrew wanted Maggie; Sam was ahead. Patt.
  assert.equal(result(run, "andrew", "addDrop").castawayId, "patt");
  assert.deepEqual(result(run, "andrew", "addDrop").passed, [{ castawayId: "maggie", reason: "ahead", byPlayerId: "sam" }]);
  // Round 2: Sam's swap list -- Maggie is already his, Patt went to Andrew.
  const samSwap = result(run, "sam", "addDrop");
  assert.equal(samSwap.outcome, "missed");
  assert.deepEqual(samSwap.passed, [{ castawayId: "maggie", reason: "yours" }, { castawayId: "patt", reason: "ahead", byPlayerId: "andrew" }]);
  assert.deepEqual(owners(s, "kilby"), ["sam"]);
  assert.equal(result(run, "josie", "addDrop").outcome, "skipped");
  assert.equal(result(run, "dee", "addDrop").outcome, "noClaim");
  assert.deepEqual(owners(s, "mike"), [], "whoever's dropped is a free agent");

  // Rolling waivers: movers to the back in their order; a quiet week moves you up.
  assert.deepEqual(run.orderAfter, ["josie", "dee", "kim", "sam", "andrew"]);
  assert.deepEqual(S.MidSeasonLogic.priorityList(s), run.orderAfter);
  assert.equal(W.current(s).phase, "processed");
  assert.equal(s.midSeason.log.filter((tx) => tx.via === "waivers").length, 3);
  assert.match(W.checkClaim(s, W.current(s), "sam", { pairs: [] }).error, /closed/, "no claims once processed");
});

test("processing: owed two, one a round; the higher in the order wins a contested add", () => {
  const s = afterEpisode3();
  ["mike", "k2"].forEach((id) => S.addElimination(s, "ep3", id, "Voted Out"));
  const run = W.process(s, {
    kim: claim(s, "kim", { pickupIds: ["rob", "maggie", "ori"] }),
    sam: claim(s, "sam", { pickupIds: ["rob", "maggie"] }),
  }, { now: T0 });
  const kim = run.results.filter((r) => r.playerId === "kim" && r.outcome === "got");
  assert.deepEqual(kim.map((r) => [r.castawayId, r.droppedCastawayId, r.round]), [["rob", "mike", 1], ["ori", "k2", 2]]);
  // Kim's second round: Rob is already Kim's, Maggie went to Sam in round 1.
  assert.deepEqual(kim[1].passed, [{ castawayId: "rob", reason: "yours" }, { castawayId: "maggie", reason: "ahead", byPlayerId: "sam" }]);
  assert.equal(kim[1].choice, 3);
  assert.equal(result(run, "sam", "pickup").castawayId, "maggie");
});

test("processing: the week's limits -- one swap a window, replacements only as owed", () => {
  const s = afterEpisode3();
  const run = W.process(s, {
    // Two swaps asked for, one allowed: the first that goes through uses it.
    kim: claim(s, "kim", { pairs: [pair("rob", "mike"), pair("ori", "k2")] }),
  }, { now: T0 });
  assert.equal(run.results.filter((r) => r.playerId === "kim" && r.outcome === "got").length, 1);
  assert.deepEqual(owners(s, "k2"), ["kim"]);
  assert.deepEqual(owners(s, "ori"), []);
});

test("a whole-team window: the merge rebuild, every loss replaced and every castaway swapped", () => {
  // Last Survivor Standing: only in waiver windows, manual only. Nothing happens until the commissioner
  // opens a window with Whole team swaps.
  const s = league({ settings: { replaceRule: "windows", waiverWindows: { schedule: "manual", every: 3, swaps: 3 } } });
  S.addElimination(s, "ep3", "jelly", "Voted Out");
  assert.equal(W.due(s, T0), null);
  const opened = W.openWindow(s, 3, T0);
  assert.equal(opened.error, undefined);
  const p = W.current(s);
  assert.deepEqual([p.window, p.swaps, p.openedBy, p.episode], [true, 3, "commissioner", 3]);
  assert.equal(W.replacementsOwed(s, "sam", p).count, 1);
  const run = W.process(s, {
    sam: claim(s, "sam", { pairs: [pair("rob", "jelly"), pair("maggie", "kilby"), pair("ori", "s3")] }),
    kim: claim(s, "kim", { pairs: [pair("patt", "mike"), pair("aaliyah", "k2"), pair("linnea", "k3")] }),
  }, { now: T0 + HOUR });
  assert.deepEqual(run.results.filter((r) => r.outcome === "got").map((r) => [r.playerId, r.castawayId, r.round]), [
    ["kim", "patt", 1], ["sam", "rob", 1], ["kim", "aaliyah", 2], ["sam", "maggie", 2], ["kim", "linnea", 3], ["sam", "ori", 3],
  ]);
  assert.deepEqual(S.getCastaway(s, "rob").ownerIds, ["sam"]);
  assert.equal(W.swapsLeft(s, p, "sam"), 1, "two swaps and a replacement");
  assert.equal(W.swapsLeft(s, p, "kim"), 0);
});

test("your own replacement landing someone moves your swap on to your next choice", () => {
  const s = afterEpisode3();
  const run = W.process(s, { sam: claim(s, "sam", { pickupIds: ["maggie"], dropId: "kilby", addIds: ["maggie", "patt"] }) }, { now: T0 });
  const ad = result(run, "sam", "addDrop");
  assert.equal(ad.castawayId, "patt");
  assert.equal(ad.choice, 2);
  assert.deepEqual(ad.passed, [{ castawayId: "maggie", reason: "yours" }]);
});

// ---- Free agency and closing ----

test("free agency: instant, first come, just-dropped castaways in, swaps left, order unchanged", () => {
  const s = afterEpisode3();
  W.process(s, canvasClaims(s), { now: EP4_AIRS - 24 * HOUR });
  const order = S.MidSeasonLogic.priorityList(s);
  assert.equal(W.freeAgencyMove(s, "josie", "mike", "lewis", EP4_AIRS - 2 * HOUR), null, "Mike was dropped in waivers");
  assert.deepEqual(owners(s, "mike"), ["josie"]);
  assert.deepEqual(S.MidSeasonLogic.priorityList(s), order, "free agency never moves the order");
  assert.match(W.freeAgencyMove(s, "josie", "linnea", "jenna"), /used this window’s swaps/);
  assert.match(W.freeAgencyMove(s, "kim", "linnea", "k2"), /used this window’s swaps/, "Kim's went through in waivers");
  assert.match(W.freeAgencyMove(s, "dee", "mike", "d1"), /not a free agent/, "Josie got there first");
  assert.match(W.freeAgencyMove(s, "dee", "linnea"), /who to drop/, "nothing to replace: an add needs a drop");
  assert.match(W.freeAgencyMove(s, "dee", "linnea", "kilby"), /on your team/);
  assert.equal(W.freeAgencyMove(s, "dee", "linnea", "d1"), null);
  assert.equal(W.freeAgencyMove(s, "sam", "ori", "kilby"), null, "Sam's swap missed in waivers, so it's still his");
  const off = afterEpisode3({ settings: { freeAgencyEnabled: false } });
  W.process(off, {}, { now: T0 });
  assert.match(W.freeAgencyMove(off, "josie", "rob", "lewis"), /no free agency/);
});

test("a replacement can be made in free agency instead, naming the loss or not", () => {
  const s = afterEpisode3();
  W.process(s, {}, { now: T0 });
  assert.equal(W.freeAgencyMove(s, "sam", "ori", "jelly"), null);
  assert.deepEqual(owners(s, "ori"), ["sam"]);
  assert.equal(W.pickupsOwed(s, "sam").count, 0);
  const t = afterEpisode3();
  W.process(t, {}, { now: T0 });
  assert.equal(W.freeAgencyMove(t, "sam", "ori"), null, "pre-v2: no drop replaces the oldest loss");
  assert.deepEqual(owners(t, "jelly"), []);
});

test("a replacement still unfilled at airtime is assigned, the same way every time", () => {
  const s = afterEpisode3();
  W.process(s, {}, { now: T0 }); // Sam made no claim
  assert.equal(W.pickupsOwed(s, "sam").count, 1);
  assert.equal(result(W.current(s).run, "sam", "pickup").outcome, "noClaim");
  const copy = JSON.parse(JSON.stringify(s));
  W.close(s, EP4_AIRS);
  W.close(copy, EP4_AIRS);
  assert.equal(W.replacementsOwed(s, "sam", null).count, 0);
  const auto = s.midSeason.log.find((tx) => tx.via === "auto");
  assert.ok(FREE.includes(auto.addedCastawayId));
  assert.equal(auto.droppedCastawayId, "jelly");
  assert.equal(copy.midSeason.log.find((tx) => tx.via === "auto").addedCastawayId, auto.addedCastawayId, "deterministic");
  assert.deepEqual(W.periods(s)[0].autoFills, [auto.id]);
});

test("auto-fill off: a missed deadline plays short, and the loss carries to the next week", () => {
  const s = afterEpisode3({ settings: { autoFill: false } });
  W.process(s, {}, { now: T0 });
  W.close(s, EP4_AIRS);
  assert.ok(!(s.midSeason.log || []).some((tx) => tx.via === "auto"));
  assert.deepEqual(owners(s, "jelly"), ["sam"]);
  S.addElimination(s, "ep4", "d1", "Voted Out");
  W.open(s, EP4_AIRS + HOUR);
  assert.equal(W.pickupsOwed(s, "sam").count, 1);
});

test("only in waiver windows: losses wait for a window, and only a window's close fills them", () => {
  const s = league({ settings: { replaceRule: "windows", waiverWindows: { schedule: "every", every: 3, swaps: 0 } } });
  S.addElimination(s, "ep3", "jelly", "Voted Out");
  W.open(s, T0);
  W.process(s, {}, { now: T0 });
  W.close(s, EP4_AIRS);
  assert.equal(s.midSeason.log.filter((tx) => tx.via === "auto").length, 1, "the window's close filled Jelly's slot");
  S.addElimination(s, "ep4", "kilby", "Voted Out");
  assert.equal(W.due(s, EP4_AIRS + HOUR), null, "episode 4: no window, no week");
  assert.equal(W.replacementsOwed(s, "sam", null).count, 0, "Kilby waits");
  ["ep5", "ep6"].forEach((ep, i) => S.addElimination(s, ep, ["d1", "a2"][i], "Voted Out"));
  assert.equal(W.due(s, EP4_AIRS + 2 * HOUR), "open", "episode 6 opens the next window");
  const p = W.open(s, EP4_AIRS + 2 * HOUR);
  assert.deepEqual(W.replacementsOwed(s, "sam", p).lossIds, ["kilby"]);
});

test("a week that processes and closes at once auto-fills nothing: what's owed carries to the next week", () => {
  // Episode 4's results were already in when the week processed (no free agency at all), as in a
  // league whose first waiver week opened after the next episode had aired.
  const s = afterEpisode3({ airs: false });
  S.addElimination(s, "ep4", "d1", "Voted Out");
  W.process(s, {}, { now: T0 + HOUR });
  W.close(s, T0 + HOUR);
  assert.equal(W.periods(s)[0].autoFills.length, 0);
  assert.ok(!(s.midSeason.log || []).some((tx) => tx.via === "auto"));
  W.open(s, T0 + HOUR);
  assert.equal(W.pickupsOwed(s, "sam").count, 1, "Sam still claims for Jelly");
  assert.equal(W.pickupsOwed(s, "dee").count, 1);
});

// ---- Commissioner: Open a waiver window, Undo ----

test("Open a waiver window: turns the open week into one, changes it, or turns it off", () => {
  // A week after episode 4 (not a scheduled window) becomes one.
  const s = afterEpisode3();
  W.process(s, {}, { now: T0 });
  W.close(s, T0);
  S.addElimination(s, "ep4", "d1", "Voted Out");
  const p = W.open(s, T0 + HOUR);
  assert.equal(p.window, false);
  assert.match(W.checkClaim(s, p, "kim", { pairs: [pair("rob", "mike")] }).error, /No swaps/);
  assert.equal(W.openWindow(s, 2, T0 + HOUR).period, p);
  assert.deepEqual([p.window, p.swaps, p.addDrop, p.openedBy], [true, 2, true, "commissioner"]);
  const dee = claim(s, "dee", { pairs: [pair("rob", "d1"), pair("maggie", "d2"), pair("ori", "d3")] });
  assert.equal(S.tradeAvailable(s), true);
  // Turned off: it's still a week for replacements (always), and the swaps leave Dee's claim.
  assert.equal(W.openWindow(s, null, T0 + HOUR).error, undefined);
  assert.deepEqual([p.window, p.swaps, p.phase], [false, 0, "open"]);
  const trimmed = W.trimClaim(s, p, "dee", dee);
  assert.equal(trimmed.removed, 2);
  assert.deepEqual(trimmed.claim.pairs, [pair("rob", "d1")]);
  assert.match(W.openWindow(s, null).error, /no waiver window to turn off/);
  assert.match(W.openWindow(s, 4).error, /0 to 3/);
  W.process(s, {}, { now: T0 + 2 * HOUR });
  assert.match(W.openWindow(s, 1).error, /processed/, "too late once it's processed");
});

test("Open a waiver window: turned off with nothing else to run, the week ends and doesn't reopen", () => {
  const s = league({ settings: { replaceRule: "windows", waiverWindows: { schedule: "manual", swaps: 3 } } });
  S.addElimination(s, "ep3", "jelly", "Voted Out");
  W.openWindow(s, 3, T0);
  const r = W.openWindow(s, null, T0);
  assert.equal(r.closed, true);
  assert.deepEqual([r.period.phase, r.period.turnedOff], ["closed", true]);
  assert.equal(W.due(s, T0 + HOUR), null);
  assert.match(W.openWindow(s, 3, T0).error, /processed: open a window after the next episode/);
  S.addElimination(s, "ep4", "kilby", "Voted Out");
  assert.equal(W.openWindow(s, 3, T0 + HOUR).error, undefined, "after the next episode, fine");
});

test("Open a waiver window: any league, even one with waivers off, while it runs", () => {
  const s = league({ settings: { replenishEnabled: false, tradeEnabled: false } });
  S.addElimination(s, "ep3", "jelly", "Voted Out");
  assert.equal(W.enabled(s), false);
  assert.equal(W.openWindow(s, 1, T0).error, undefined);
  assert.equal(W.enabled(s), true);
  assert.equal(W.due(s, T0 + HOUR), null, "not closed for being off");
  assert.equal(W.replacementsOwed(s, "sam", W.current(s)).count, 0, "never: swaps only");
  W.process(s, { kim: claim(s, "kim", { pairs: [pair("rob", "mike")] }) }, { now: T0 + HOUR });
  W.close(s, EP4_AIRS);
  assert.deepEqual(owners(s, "rob"), ["kim"]);
  assert.equal(W.enabled(s), false, "off again afterwards");
  const pickem = league({ type: "pickem" });
  assert.match(W.openWindow(pickem, 1, T0).error, /doesn’t use waivers/);
});

test("Undo last waiver run puts everything back exactly, and holds the week until Process now or airtime", () => {
  const s = afterEpisode3();
  const before = JSON.parse(JSON.stringify(s));
  W.process(s, canvasClaims(s), { now: EP4_AIRS - 24 * HOUR });
  W.freeAgencyMove(s, "josie", "mike", "lewis");
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

// ---- Spoilers ----

test("spoilers: someone who hasn't revealed episode 3 sees the week exist, and nothing else", () => {
  const s = afterEpisode3();
  W.setClaimsIn(s, W.current(s), ["kim", "sam"]);
  W.process(s, canvasClaims(s), { now: EP4_AIRS - 24 * HOUR });
  const real = JSON.stringify(s);
  const v = S.SpoilerLogic.viewThrough(s, 2);
  assert.equal(JSON.stringify(s), real, "the real state is untouched");
  assert.equal(S.getCastaway(v, "jelly").status, "active");
  assert.deepEqual(owners(v, "jelly"), ["sam"], "Sam still has Jelly");
  assert.deepEqual(owners(v, "maggie"), [], "and no replacement");
  assert.deepEqual(owners(v, "mike"), ["kim"], "nor a swap");
  assert.deepEqual(owners(v, "rob"), []);
  assert.equal(S.getCastaway(v, "mike").departedVia, null);
  assert.equal(v.midSeason.log.length, 0);
  assert.deepEqual(S.MidSeasonLogic.priorityList(v), ["kim", "sam", "andrew", "josie", "dee"], "the order before the run");
  const p = W.periods(v)[0];
  assert.equal(p.hidden, true);
  assert.deepEqual(p.claimsIn, []);
  assert.equal(p.run, null);
  assert.equal(p.processAt, W.periods(s)[0].processAt, "when it processes is no spoiler");
  // Revealed: everything.
  const seen = S.SpoilerLogic.viewThrough(s, 3);
  assert.deepEqual(owners(seen, "maggie"), ["sam"]);
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

// ---- Shared ownership, Active Roster, computer players ----

test("shared ownership: two claims for the same castaway both go through", () => {
  const s = afterEpisode3({ type: "active-roster", shared: true });
  // Only when short (2 active slots: down to 1). Take Sam and Kim down.
  ["kilby", "k2", "k3"].forEach((id) => S.addElimination(s, "ep3", id, "Voted Out"));
  assert.equal(W.pickupsOwed(s, "sam").count, 1);
  assert.equal(W.pickupsOwed(s, "kim").count, 1);
  const run = W.process(s, {
    sam: claim(s, "sam", { pickupIds: ["rob"] }),
    kim: claim(s, "kim", { pairs: [pair("rob", "k2")] }),
  }, { now: T0 });
  assert.deepEqual(owners(s, "rob"), ["kim", "sam"]);
  assert.equal(run.results.filter((x) => x.outcome === "got").length, 2);
});

test("shared ownership: someone dropped earlier in the run can still be added by anyone else", () => {
  // Exclusive leagues hold a castaway dropped in the run back until free agency; in a shared league,
  // Kim letting Mike go has nothing to do with whether Andrew may have him.
  const s = afterEpisode3({ type: "active-roster", shared: true });
  const run = W.process(s, {
    kim: claim(s, "kim", { pairs: [pair("rob", "mike")] }),
    andrew: claim(s, "andrew", { pairs: [pair("mike", "carter"), pair("ori", "carter")] }),
  }, { now: T0 });
  const andrew = result(run, "andrew", "addDrop");
  assert.equal(andrew.castawayId, "mike");
  assert.equal(andrew.choice, 1);
  assert.deepEqual(owners(s, "mike"), ["andrew"]);
});

test("Active Roster: an unfilled replacement at airtime gets the free agent with the most points", () => {
  const s = afterEpisode3({ type: "active-roster", shared: true });
  ["kilby", "s3"].forEach((id) => S.addElimination(s, "ep3", id, "Voted Out"));
  const ev = S.formatOf(s).events.find((e) => S.ActiveRosterLogic.pointsFor(s, e.id) > 0);
  S.addScoringEvent(s, "ep2", ev.id, "linnea");
  W.process(s, {}, { now: T0 });
  W.close(s, EP4_AIRS);
  const auto = s.midSeason.log.find((tx) => tx.via === "auto" && tx.playerId === "sam");
  assert.equal(auto.addedCastawayId, "linnea");
});

test("computer players claim when the week processes, in pairs, and their claims are valid ones", () => {
  const s = afterEpisode3();
  s.players.find((p) => p.id === "sam").automated = true;
  const c = Bots.waiverClaim(s, "sam", W.current(s));
  assert.deepEqual(c.pairs.filter((x) => x.dropId === "jelly").length, 3, "owed one: three ranked replacements");
  assert.equal(W.checkClaim(s, W.current(s), "sam", c).error, undefined);
  // A whole-team window: still within the week's limit on adds.
  const t = league({ settings: { replaceRule: "windows", waiverWindows: { schedule: "manual", swaps: 3 } } });
  S.addElimination(t, "ep3", "jelly", "Voted Out");
  W.openWindow(t, 3, T0);
  t.players.find((p) => p.id === "sam").automated = true;
  assert.equal(W.checkClaim(t, W.current(t), "sam", Bots.waiverClaim(t, "sam", W.current(t))).error, undefined);
});
