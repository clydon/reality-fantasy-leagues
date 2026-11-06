// Ownership per holding (docs/PLAN-start-a-game-gpt.md step C4; the tracker's p11, the user's second game: "Have an exclusive draft
// initially ... If you need to replace one you can pick as if the cast was open and shared but the new player who replaces your lost
// one scores 0.5x, if you need to replace another it scores 0.25x"). Exclusive or shared for each way of holding: the draft
// (get.own), its group slots (get.groups.own, A10) and now each waiver move (extras.waivers.own: { replace, swap }, each left out the
// draft's own), which says where a replacement or a swap comes from: only someone on nobody's team, or anyone still in who isn't
// yours already. Its shape, refusals, words and settings (every stored spec reads as before); who each move can bring in, a claim,
// a waiver run, free agency and auto-fill on it; a castaway two seats hold when one lets them go (the other keeps them, and is
// still owed a replacement once they're gone home: a shared game's too); and the user's second game scored. Every number here is
// worked out by hand in its comment. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const W = S.WaiverLogic;
const M = S.MidSeasonLogic;

const ats = (problems) => problems.map((p) => p.at);
const CTX = {
  moments: [{ id: "individualImmunity", label: "Won immunity", defaultPoints: { exclusive: 3, shared: 4 }, answeredBy: "research" }],
  results: true,
  winner: true,
  roles: [],
  grouped: true,
  jury: true,
  phases: [{ id: "premerge" }, { id: "merged" }],
};
const WAIVERS = { ...G.fullSpec({ preset: "outlast" }).extras.waivers, replace: "always" };
const SHARED_REPLACE = { ...WAIVERS, own: { replace: "shared" } };
/** An exclusive Outlast of three each, replacing anyone gone after any episode, with `waivers`. */
const outlast = (waivers, more = {}) => ({ preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, score: { by: "place" }, extras: { waivers }, ...more });
// The tracker's p11, the user's second game, whole: an exclusive draft, its replacements shared, scoring half then a quarter.
const GAME2 = outlast(SHARED_REPLACE, { score: { by: "place", multiply: [{ joined: "replacement", times: [0.5, 0.25] }] } });

test("the piece: its shape, words and settings; what's refused; every stored spec reads as before", () => {
  const at = (spec, ctx = CTX) => ats(G.specProblems(spec, ctx));
  assert.deepEqual(at(GAME2), []);
  // Back from the settings it writes, whole (settings.waiverOwn), as the multiplier's (settings.joinedTimes).
  const st = G.withSpec(S.defaultState().settings, GAME2);
  assert.deepEqual(st.waiverOwn, { replace: "shared" });
  assert.deepEqual(G.specOf(st), G.fullSpec(GAME2));
  // Each move's own: the waivers' where they say it, else the draft's.
  assert.deepEqual([G.waiverOwnOf(GAME2, "replace"), G.waiverOwnOf(GAME2, "swap")], ["shared", "exclusive"]);
  assert.deepEqual([G.waiverOwnOf({ preset: "weekly-lineup", get: { by: "draft", own: "shared" } }, "swap"), G.waiverOwnOf({ preset: "outlast" }, "replace")], ["shared", "exclusive"]);
  // Today's one own reads as a use of it: no stored spec or preset says `own`, and its settings write nothing for it.
  for (const p of ["outlast", "weekly-lineup"]) {
    assert.equal("own" in G.fullSpec({ preset: p }).extras.waivers, false, p);
    assert.equal(G.withSpec(S.defaultState().settings, { preset: p }).waiverOwn, undefined, p);
  }
  assert.equal("own" in G.specOf(S.defaultState().settings).extras.waivers, false);
  // Settings read back only what a move can be: nothing from an empty or unknown own; an exclusive one beside a draft made shared
  // since (settings.ownershipMode) is the draft's own again.
  const back = (waiverOwn) => G.specOf({ ...st, waiverOwn }).extras.waivers.own;
  assert.deepEqual([back({}), back({ replace: "open" }), back({ replace: "shared", swap: "exclusive" })], [undefined, undefined, { replace: "shared", swap: "exclusive" }]);
  const lu = G.withSpec(S.defaultState().settings, { preset: "weekly-lineup", get: { by: "draft", each: 5, order: "snake", own: "exclusive" } });
  assert.deepEqual(G.specOf({ ...lu, ownershipMode: "shared", waiverOwn: { replace: "shared", swap: "exclusive" } }).extras.waivers.own, { replace: "shared" });
  // Words: the sentence, How it works, and the waivers' detail.
  const d = G.describeSpec(GAME2, { show: "Survivor" });
  assert.ok(d.sentence.startsWith("An Outlast for Survivor: everyone drafts 3, replacements from anyone still in, all season."), d.sentence);
  assert.ok(d.rules.includes("Lose someone? Their replacement can be anyone still in, even a person on another team: they're on both teams then."), d.rules.join("\n"));
  assert.match(d.details.find((x) => x.id === "waivers").value, / · replacements from anyone still in$/);
  const swaps = { ...WAIVERS, windows: { schedule: "every", every: 3, swaps: 1 } };
  assert.ok(G.describeSpec(outlast({ ...swaps, own: { replace: "shared" } })).rules.includes("Lose someone? Their replacement can be anyone still in, even a person on another team: they're on both teams then. A swap brings in only someone on nobody's team."));
  assert.ok(G.describeSpec(outlast({ ...swaps, own: { swap: "shared" } })).rules.includes("A swap can bring in anyone still in, even a person on another team: they're on both teams then. A replacement is someone on nobody's team."));
  assert.ok(G.describeSpec(outlast({ ...swaps, own: { replace: "shared", swap: "shared" } })).sentence.includes(", pickups from anyone still in,"));
  // A shared move the waivers don't make on their own (no swap windows): nothing said of it.
  assert.equal(G.describeSpec(outlast({ ...WAIVERS, own: { replace: "exclusive", swap: "shared" } })).sentence.includes("anyone still in"), false);
  // Said the draft's own: nothing to say.
  assert.equal(G.describeSpec(outlast({ ...WAIVERS, own: { replace: "exclusive" } })).sentence.includes("anyone still in"), false);
  // Refused, each with why.
  const o = (own, more) => at(outlast({ ...WAIVERS, own }, more));
  assert.deepEqual(o({}), ["extras.waivers.own"], "says nothing");
  assert.deepEqual(o("shared"), ["extras.waivers.own"], "an object, per move");
  assert.deepEqual(o({ replace: "open" }), ["extras.waivers.own.replace"]);
  assert.deepEqual(o({ trade: "shared" }), ["extras.waivers.own.trade"], "an unknown key");
  // Never exclusive where the draft is shared (a shared lineup: a shared Outlast has no waivers at all).
  const lineup = (own) => ({ preset: "weekly-lineup", get: { by: "draft", each: 5, order: "blind", own: "shared" }, extras: { waivers: { ...G.fullSpec({ preset: "weekly-lineup" }).extras.waivers, replace: "always", own } } });
  assert.deepEqual(at(lineup({ replace: "exclusive" })), ["extras.waivers.own.replace"]);
  assert.deepEqual(at(lineup({ replace: "shared" })), [], "the draft's own, said");
  // A stock market buys at its draft's own.
  const market = { preset: "weekly-lineup", get: { by: "draft", each: 5, order: "snake", own: "exclusive", budget: { trade: {} } }, rank: { by: "worth" } };
  const mw = G.fullSpec(market).extras.waivers;
  assert.deepEqual(at({ ...market, extras: { waivers: { ...mw, own: { swap: "shared" } } } }), ["extras.waivers.own"]);
  // The count per holding (the 9:10 PM decision): 6 of you × 3 takes all 18, so an exclusive draft whose replacements are only
  // someone on nobody's team, with nothing that ever frees anyone, never has anyone to replace with.
  const full = { ...CTX, pool: 18, couch: 6 };
  assert.deepEqual(at(outlast(WAIVERS), full), ["extras.waivers.own"]);
  assert.match(G.specProblems(outlast(WAIVERS), full)[0].problem, /^6 of you × 3 picks takes all 18 who can be drafted, so nobody's ever free to replace someone gone home with: make the replacements shared/);
  assert.deepEqual(at(GAME2, full), [], "shared replacements: anyone still in");
  assert.deepEqual(at(outlast(swaps), full), [], "a swap lets someone still in go");
  assert.deepEqual(at(outlast(WAIVERS, { rank: { by: "standing", cut: [{ at: { every: 2 } }] } }), full), [], "a cut frees a knocked-out team's");
  assert.deepEqual(at(outlast(WAIVERS), { ...full, pool: 19 }), [], "one left over");
  assert.deepEqual(at(outlast(G.fullSpec({ preset: "outlast" }).extras.waivers), full), [], "no replacements");
  assert.deepEqual(ats(G.specProblems(outlast(WAIVERS), full, { league: true })), [], "a league's own keeps the draft it made");
});

// ---- the engine, on a league ----

// Five players with three each (the waivers tests' couch); six free agents; two nobody held, out in Episodes 1 and 2.
const TEAMS = {
  kim: ["mike", "k2", "k3"],
  sam: ["jelly", "kilby", "s3"],
  andrew: ["carter", "a2", "a3"],
  josie: ["lewis", "jenna", "sharonda"],
  dee: ["d1", "d2", "d3"],
};
const FREE = ["rob", "maggie", "ori", "patt", "aaliyah", "linnea"];
const T0 = Date.parse("2026-10-15T14:00:00Z");
function league({ type = "classic-draft", shared = false, settings = {} } = {}) {
  const owned = Object.entries(TEAMS).flatMap(([p, ids]) => ids.map((id) => [id, p]));
  const ids = [...owned.map(([id]) => id), ...FREE, "x1", "x2"];
  const s = S.migrateLeagueState({
    settings: {
      leagueTypeId: type, showFormat: "survivor", ownershipMode: shared ? "shared" : "exclusive",
      replaceRule: "always", waiverWindows: { schedule: "every", every: 3, swaps: 1 }, startEpisode: 1, replenishOrderBy: "rolling",
      ...(type === "active-roster" ? { activeSlots: 2, benchSlots: 1 } : { teamSize: 3 }), ...settings,
    },
    players: Object.keys(TEAMS).map((id) => ({ id, name: id, color: "#000", active: true })),
    draftOrder: ["dee", "josie", "andrew", "sam", "kim"],
    castaways: ids.map((id) => ({
      id, name: id, status: "active", placementOrder: null, exitMethod: null, exitEpisodeId: null,
      ownerIds: owned.filter(([c]) => c === id).map(([, p]) => p),
    })),
    episodes: Array.from({ length: 13 }, (_, i) => ({ id: `ep${i + 1}`, number: i + 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} })),
  });
  S.addElimination(s, "ep1", "x1", "Voted Out");
  S.addElimination(s, "ep2", "x2", "Voted Out");
  return s;
}
const owners = (s, id) => S.getCastaway(s, id).ownerIds.slice().sort();
const ids = (list) => list.map((c) => c.id).sort();
const pair = (addId, dropId) => ({ addId, dropId });
const others = (pid) => Object.entries(TEAMS).filter(([p]) => p !== pid).flatMap(([, list]) => list);
/** Episode 3: Jelly (Sam's) and Carter (Andrew's) go home; waivers open. */
function week(opts) {
  const s = league(opts);
  S.addElimination(s, "ep3", "jelly", "Voted Out");
  S.addElimination(s, "ep3", "carter", "Voted Out");
  W.open(s, T0);
  return s;
}
const SHARED = { settings: { waiverOwn: { replace: "shared" } } };

test("who each move can bring in: a replacement from anyone still in, a swap from nobody's team", () => {
  const s = week(SHARED);
  assert.deepEqual([M.ownOf(s), M.ownOf(s, "replace"), M.ownOf(s, "swap")], ["exclusive", "shared", "exclusive"]);
  // Sam's replacement: anyone still in who isn't Sam's (Carter's gone home, Jelly too); his swap: the six free agents only.
  const stillIn = (list) => list.filter((id) => !["jelly", "carter"].includes(id));
  assert.deepEqual(ids(M.availableFor(s, "sam", "replace")), [...stillIn(others("sam")), ...FREE].sort());
  assert.deepEqual(ids(M.availableFor(s, "sam", "swap")), [...FREE].sort());
  // No kind: either move's (a shared one's people include an exclusive one's).
  assert.deepEqual(ids(M.availableFor(s, "sam")), ids(M.availableFor(s, "sam", "replace")));
  // The same league with today's one own: every move from nobody's team, as before.
  const plain = week();
  for (const kind of [undefined, "replace", "swap"]) assert.deepEqual(ids(M.availableFor(plain, "sam", kind)), [...FREE].sort());
  // A claim: replacing Jelly with Mike (Kim's) goes; swapping Kilby for Mike doesn't; with today's own, neither.
  const check = (st, pid, pairs) => W.checkClaim(st, W.current(st), pid, { pairs }).error || null;
  assert.equal(check(s, "sam", [pair("mike", "jelly")]), null);
  assert.equal(check(s, "sam", [pair("mike", "kilby")]), "Claim free agents only");
  assert.equal(check(s, "sam", [pair("rob", "kilby")]), null);
  assert.equal(check(plain, "sam", [pair("mike", "jelly")]), "Claim free agents only");
});

test("a waiver run: two replacements can take the same someone, who stays on their own team too", () => {
  const s = week(SHARED);
  // Sam and Andrew both claim Lewis (Josie's) for their loss, and Kim a swap for him (a swap is from nobody's team: refused at the
  // claim, so Kim claims Rob instead).
  const claims = {
    sam: W.checkClaim(s, W.current(s), "sam", { pairs: [pair("lewis", "jelly")] }).claim,
    andrew: W.checkClaim(s, W.current(s), "andrew", { pairs: [pair("lewis", "carter")] }).claim,
    kim: W.checkClaim(s, W.current(s), "kim", { pairs: [pair("rob", "mike")] }).claim,
  };
  const run = W.process(s, claims, { now: T0 + 3600e3 });
  const got = (pid) => run.results.filter((x) => x.playerId === pid && x.outcome === "got").map((x) => x.castawayId);
  // Both get him: nobody's ahead of anyone for a shared replacement. Josie keeps him; Sam and Andrew let their losses go.
  assert.deepEqual([got("sam"), got("andrew"), got("kim")], [["lewis"], ["lewis"], ["rob"]]);
  assert.deepEqual(owners(s, "lewis"), ["andrew", "josie", "sam"]);
  assert.deepEqual([owners(s, "jelly"), owners(s, "carter"), owners(s, "rob"), owners(s, "mike")], [[], [], ["kim"], []]);
  // With today's one own, Lewis is Josie's: nobody can claim him.
  const plain = week();
  assert.equal(W.checkClaim(plain, W.current(plain), "sam", { pairs: [pair("lewis", "jelly")] }).error, "Claim free agents only");
  // Undo the run: everything back as it was.
  [...s.midSeason.log].reverse().forEach((tx) => M.revert(s, tx));
  assert.deepEqual([owners(s, "lewis"), owners(s, "jelly"), owners(s, "carter"), owners(s, "rob"), owners(s, "mike")], [["josie"], ["sam"], ["andrew"], [], ["kim"]]);
});

test("someone two seats hold, gone home: one replaces them, the other keeps them and is still owed", () => {
  const s = week(SHARED);
  M.applyPickup(s, "sam", "lewis", "jelly");
  assert.deepEqual(owners(s, "lewis"), ["josie", "sam"]);
  // Lewis goes home in Episode 4. Josie replaces him with Rob: she lets him go; Sam keeps him (his place is Sam's still).
  S.addElimination(s, "ep4", "lewis", "Voted Out");
  W.close(s, T0 + 7 * 86400e3);
  W.open(s, T0 + 7 * 86400e3);
  const owed = (pid) => W.replacementsOwed(s, pid, W.current(s)).lossIds;
  assert.deepEqual([owed("josie"), owed("sam")], [["lewis"], ["lewis"]]);
  M.applyPickup(s, "josie", "rob", "lewis");
  assert.deepEqual(owners(s, "lewis"), ["sam"]);
  // Marked replaced (by Josie, who let him go), and Sam's still owed one for him: in a game whose waivers say where each move
  // comes from, a mark is only the one who replaced. His loss is still open (the server's waiver moment, own-pace's gather).
  assert.deepEqual([S.getCastaway(s, "lewis").replenishClaimed, S.getCastaway(s, "lewis").formerOwnerId], [true, "josie"]);
  assert.deepEqual([owed("josie"), owed("sam")], [[], ["lewis"]]);
  assert.deepEqual([W.perHolder(s), W.replacedFor(s, S.getCastaway(s, "lewis"), "sam"), W.lossOpen(s, S.getCastaway(s, "lewis"))], [true, false, true]);
  M.applyPickup(s, "sam", "maggie", "lewis");
  assert.deepEqual([owners(s, "lewis"), owed("sam"), W.lossOpen(s, S.getCastaway(s, "lewis"))], [[], [], false]);
  // A mark naming nobody (a league from before formerOwnerId) counts for everyone, as it always did.
  S.getCastaway(s, "lewis").ownerIds = ["sam"];
  S.getCastaway(s, "lewis").formerOwnerId = null;
  assert.deepEqual(owed("sam"), []);
});

// A shared game's two holders (the user's rule, 2026-11-06: the Decisions table's "A shared game's two holders"): every holder is
// owed a replacement for someone gone home, except an exit a game had already played when the rule came in (its cutover,
// settings.perHolderFrom, migration 0207: the first episode it hadn't played), which stays as it played out.
/** A shared Weekly Lineup where Josie and Kim both hold Lewis, who goes home in `ep`; waivers open. */
function twoHold(ep, settings = {}) {
  const s = league({ type: "active-roster", shared: true, settings });
  S.getCastaway(s, "lewis").ownerIds = ["josie", "kim"];
  S.addElimination(s, ep, "lewis", "Voted Out");
  W.open(s, T0);
  return s;
}
const owedIn = (s) => (pid) => W.replacementsOwed(s, pid, W.current(s)).lossIds;

test("a shared game's two holders: one replacing someone gone home leaves the other still owed (a game with no cutover)", () => {
  const s = twoHold("ep3");
  const owed = owedIn(s);
  // Replacing every loss (replaceRule 'always'): each is owed one for Lewis.
  assert.deepEqual([owed("josie"), owed("kim")], [["lewis"], ["lewis"]]);
  M.applyPickup(s, "josie", "rob", "lewis");
  // Josie's mark is only hers: Kim keeps Lewis and is still owed one for him; his loss is still open (the server's waiver moment).
  const lewis = S.getCastaway(s, "lewis");
  assert.deepEqual([W.perHolderFrom(s), W.perHolder(s), W.perHolder(s, lewis), owners(s, "lewis"), owed("josie"), owed("kim"), W.lossOpen(s, lewis)],
    [null, true, true, ["kim"], [], ["lewis"], true]);
  // Kim replaces him too (with Maggie): nobody's owed, the loss closed.
  M.applyPickup(s, "kim", "maggie", "lewis");
  assert.deepEqual([owners(s, "lewis"), owed("kim"), W.lossOpen(s, lewis)], [[], [], false]);
  // Undo Kim's, then Josie's: each owed again, as before either.
  const [josies, kims] = s.midSeason.log.slice(-2);
  M.revert(s, kims);
  assert.deepEqual([owners(s, "lewis"), owed("josie"), owed("kim")], [["kim"], [], ["lewis"]]);
  M.revert(s, josies);
  assert.deepEqual([owners(s, "lewis"), owed("josie"), owed("kim")], [["josie", "kim"], ["lewis"], ["lewis"]]);
});

test("a game made before the rule: an exit before its cutover stays as it played out, one from it on is owed to each holder", () => {
  // Cutover at Episode 4: Lewis went home in Episode 3, before it. Josie replacing him settles it for Kim too, as it always has.
  const before = twoHold("ep3", { perHolderFrom: 4 });
  const owed = owedIn(before);
  M.applyPickup(before, "josie", "rob", "lewis");
  const lewis = S.getCastaway(before, "lewis");
  assert.deepEqual([W.perHolderFrom(before), W.perHolder(before), W.perHolder(before, lewis), owners(before, "lewis"), owed("josie"), owed("kim"), W.lossOpen(before, lewis)],
    [4, false, false, ["kim"], [], [], false]);
  // The same exit with the cutover at Episode 3 (his own episode): from it on, so Kim's still owed.
  const at = twoHold("ep3", { perHolderFrom: 3 });
  M.applyPickup(at, "josie", "rob", "lewis");
  assert.deepEqual([W.perHolder(at, S.getCastaway(at, "lewis")), owedIn(at)("kim")], [true, ["lewis"]]);
  // In one game: Lewis out in Episode 3 (before the cutover, 4), Ori, whom Andrew and Dee both hold, out in Episode 5 (after it).
  const s = twoHold("ep3", { perHolderFrom: 4 });
  S.getCastaway(s, "ori").ownerIds = ["andrew", "dee"];
  S.addElimination(s, "ep5", "ori", "Voted Out");
  M.applyPickup(s, "josie", "rob", "lewis");
  M.applyPickup(s, "andrew", "maggie", "ori");
  const o = owedIn(s);
  assert.deepEqual([o("kim"), o("dee"), o("andrew"), o("josie")], [[], ["ori"], [], []]);
  // An exit with no episode to tell by keeps the old rule. A game whose waivers come to say where each move comes from (C4's own)
  // keeps its cutover, so its played exits still stand; C4's own games, made with no cutover, are per holder throughout.
  assert.equal(W.perHolder(s, { ...S.getCastaway(s, "lewis"), exitEpisodeId: null }), false);
  const own = twoHold("ep3", { perHolderFrom: 4, waiverOwn: { replace: "shared" } });
  assert.deepEqual([W.perHolderFrom(own), W.perHolder(own, S.getCastaway(own, "lewis"))], [4, false]);
  const c4 = twoHold("ep3", { waiverOwn: { replace: "shared" } });
  assert.deepEqual([W.perHolderFrom(c4), W.perHolder(c4, S.getCastaway(c4, "lewis"))], [null, true]);
  // The cutover lives outside the spec (settings.perHolderFrom: history, never the game), so changing the game keeps it.
  assert.ok(G.OUTSIDE.includes("perHolderFrom"));
  assert.equal(G.withSpec(before.settings, G.specOf(before.settings)).perHolderFrom, 4);
});

test("the cutover migration 0207 gives a game: the first episode it hasn't played; at your own pace, past the furthest seat", () => {
  // Episodes 1 and 2 have results (x1, x2 out): the first not played is 3. Results in Episode 5 (nobody went home) make it 6.
  const s = league();
  assert.equal(W.cutoverAt(s), 3);
  s.episodes.find((e) => e.number === 5).noExit = true;
  assert.equal(W.cutoverAt(s), 6);
  // At your own pace: each seat's mark while it's catching up (no further than the latest with results), the latest for one that
  // plays live: the furthest plus one.
  s.settings.ownPace = true;
  s.players.forEach((p, i) => { p.lateJoin = { startEpisode: 1, catchingUp: true, seenThrough: i }; });
  assert.equal(W.cutoverAt(s), 5, "the furthest seat has seen through 4");
  s.players[0].lateJoin.seenThrough = 9;
  assert.equal(W.cutoverAt(s), 6, "no further than the latest with results (5)");
  s.players.forEach((p) => { p.lateJoin.seenThrough = 0; });
  s.players[1].lateJoin.catchingUp = false;
  assert.equal(W.cutoverAt(s), 6, "a seat playing live has played through the latest");
  s.players.forEach((p) => { p.lateJoin.catchingUp = true; });
  assert.equal(W.cutoverAt(s), 1, "nobody's played anything");
});

test("auto-fill and nobody free: an exclusive replacement waits, a shared one comes from another team", () => {
  // Every castaway still in on a team (the six free agents Dee's too).
  const full = (opts) => {
    const s = week(opts);
    FREE.forEach((id) => { S.getCastaway(s, id).ownerIds = ["dee"]; });
    return s;
  };
  const plain = full();
  assert.deepEqual(W.replacementsOwed(plain, "sam", W.current(plain)), { count: 0, lossIds: [], outIds: [], nobodyFree: true });
  const s = full(SHARED);
  const owed = W.replacementsOwed(s, "sam", W.current(s));
  assert.deepEqual([owed.count, owed.lossIds], [1, ["jelly"]]);
  // Auto-fill picks from who a replacement can bring in: someone on another team (classic: one at random, fixed by the week).
  const pick = W.autoPick(s, W.current(s), "sam", 0, "jelly");
  assert.ok(others("sam").includes(pick) || FREE.includes(pick), pick);
  assert.equal(S.getCastaway(s, pick).ownerIds.length, 1, "they're someone else's");
  // Free agency: a replacement from another team goes; a swap for one doesn't.
  W.process(s, {}, { now: T0 + 3600e3 });
  assert.equal(W.freeAgencyMove(s, "andrew", "k2", "a2", T0 + 7200e3), "They’re not a free agent any more", "a swap is from nobody's team");
  assert.equal(W.freeAgencyMove(s, "andrew", "k2", "carter", T0 + 7200e3), null);
  assert.deepEqual(owners(s, "k2"), ["andrew", "kim"]);
});

// ---- the user's second game, scored ----

/** Twelve castaways C0 to C11: ann C0-C2, bo C3-C5, cy C6-C8, C9 to C11 free; GAME2 through setGame; Episodes 1 to 8. */
function game2() {
  const s = S.defaultState();
  S.updateSettings(s, "showId", "survivor");
  for (let i = 0; i < 12; i++) S.addCastaway(s, `C${i}`);
  const players = ["ann", "bo", "cy"];
  s.players = players.map((id) => ({ id, name: id, color: "#000" }));
  S.updateSettings(s, "setupComplete", true);
  assert.deepEqual(S.setGame(s, GAME2, { ctx: CTX }), []);
  s.castaways.forEach((c, i) => { c.ownerIds = players[Math.floor(i / 3)] ? [players[Math.floor(i / 3)]] : []; });
  for (let n = 1; n <= 8; n++) S.ensureEpisodeNumber(s, n, false);
  return s;
}

test("the user's second game: an exclusive draft, replacements from anyone still in at half, then a quarter", () => {
  const s = game2();
  const ep = (n) => s.episodes.find((e) => e.number === n).id;
  const c = (i) => s.castaways[i].id;
  const out = (n, i) => S.addElimination(s, ep(n), c(i), "Voted Out");
  // C0 (ann's) out first; ann replaces C0 with C4, bo's: both hold C4 now.
  out(1, 0);
  M.applyPickup(s, "ann", c(4), c(0));
  assert.deepEqual(s.castaways[4].ownerIds.slice().sort(), ["ann", "bo"]);
  // C3 out second, C4 third: ann replaces C4 with C6 (cy's), her second replacement; bo keeps C4 (drafted). C9 (nobody's) fourth.
  out(2, 3);
  out(3, 4);
  M.applyPickup(s, "ann", c(6), c(4));
  out(4, 9);
  const totals = Object.fromEntries(S.computeScores(s).map((r) => [r.playerId, r.total]));
  // ann: C0 drafted, out first, kept for her: 1. C4 joined after Episode 1 (worth 2 then), out third (3): 1 earned, half: 0.5. C6
  // joined after Episode 3 (worth 4 then), still in at 5: 1, a quarter: 0.25. C1 and C2 drafted, still in: 5 each. 11.75.
  // bo: C3 out second, 2; C4 drafted, out third, his whole place, 3; C5 5. 10 (C4 counts for both, each by their own stint).
  // cy: C6, C7, C8 drafted, still in: 15 (C6 is ann's too: cy keeps all of it).
  assert.deepEqual(totals, { ann: 11.75, bo: 10, cy: 15 });
  // bo is still owed a replacement for C4 (ann's mark is hers) and for C3.
  const owed = W.replacementsOwed(s, "bo", W.current(s));
  assert.deepEqual(owed.lossIds, [c(3), c(4)]);
});
