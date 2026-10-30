// Keepers across seasons (docs/PLAN-start-a-game-gpt.md step A10 part 4: the stretch row s17 "Dynasty: keep 2 of your players
// when they come back next season", the dial row shape.keepers). The spec's get.keep: a game that continues last season's (from),
// each seat keeping up to `each` of its team there who are on this season's cast, named before the draft and locked as it starts,
// the draft filling the rest whatever its kind (a snake passing over a full team or sitting it out of its first rounds, a blind
// sheet, a draw, an auction, a salary cap, a stock market's cash). Its shape, defaults, words and settings; who can be kept (a
// name as each season's cast records it, best first by last season's points); naming them; the lock and its fallbacks; each kind
// of draft; computer players. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");

const ats = (problems) => problems.map((p) => p.at);
const CTX = { moments: [], results: true, winner: true, roles: [], grouped: true, jury: true, phases: [{ id: "premerge" }, { id: "merged" }] };
const outlast = (get = {}, extra = {}) => ({ preset: "outlast", get: { by: "draft", each: 3, ...get }, ...extra });
const lineup = (get = {}, start = 1, extra = {}) => ({ preset: "weekly-lineup", get: { by: "draft", each: 3, ...get }, count: { start }, ...extra });
const KEEP = (k = {}) => ({ each: 2, from: "L0", ...k });
const S17 = outlast({ each: 3, keep: { each: 2, from: "L0" } });

/** A league of `n` castaways (c0..), `people` its seats, the game `spec`. */
function league(spec, { n = 10, people = ["ann", "bo", "cy"], bots = [], names } = {}) {
  assert.ok(G.settingsOf(spec), `plays: ${JSON.stringify(spec)}`);
  return S.migrateLeagueState({
    settings: { ...G.settingsOf(spec), showFormat: "survivor" },
    players: [...people, ...bots].map((id) => ({ id, name: id, color: "#000", active: true, ...(bots.includes(id) ? { automated: true } : {}) })),
    draftOrder: [...people, ...bots],
    tribes: [{ id: "t1", name: "Toka", color: "#000" }, { id: "t2", name: "Vati", color: "#111" }],
    castaways: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: names ? names[i] : `C${i} Person`, status: "active", tribeId: i % 2 ? "t2" : "t1", ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: [{ id: "ep1", number: 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} }],
  });
}
const team = (s, pid) => s.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id).sort();
const kept = (s, pid) => S.KeeperLogic.keptIds(s, pid).slice().sort();
/** Options written as the server would (keepers.ts), then names chosen. */
function open(s, options, chosen = {}) {
  S.KeeperLogic.setOptions(s, options);
  for (const [pid, ids] of Object.entries(chosen)) assert.equal(S.KeeperLogic.choose(s, pid, ids, `u-${pid}`), null, `${pid} names ${ids}`);
  return s;
}
/** The snake's turns as they come, each taking the first free agent. */
function snake(s) {
  const out = [];
  for (let i = 0; i < 40; i++) {
    const t = S.currentDraftTurn(s);
    if (!t || t.isComplete) break;
    out.push(t.playerId);
    S.draftToCurrentTurn(s, S.draftFitsFor(s, t.playerId)[0]);
  }
  return out;
}

test("keepers: the spec's shape, defaults, words and settings", () => {
  // s17 plays as an Outlast; a lineup with keepers plays as a Weekly Lineup.
  assert.deepEqual(G.specProblems(S17, CTX), []);
  assert.deepEqual(G.specWaitsFor(S17), []);
  assert.equal(G.typeOf(S17), "classic-draft");
  assert.equal(G.typeOf(lineup({ keep: KEEP() })), "active-roster");
  assert.equal(G.flagsOf(G.fullSpec(S17)).hasKeepers, true);
  assert.equal(G.flagsOf(G.fullSpec(outlast())).hasKeepers, false);
  // The defaults (the user's to set): one each, the best kept for someone who names nobody, a place on the team (a stock
  // market's: their price).
  assert.deepEqual(G.fullSpec(outlast({ keep: { from: "L0" } })).get.keep, { from: "L0", each: 1, fallback: "best", cost: "place" });
  assert.equal(G.fullSpec(lineup({ order: "blind", own: "shared", budget: { total: 30, trade: {} }, keep: { from: "L0" } })).get.keep.cost, "price");
  assert.deepEqual(G.keepParts(G.fullSpec(S17)), { each: 2, from: "L0", cost: "place", fallback: "best" });
  assert.equal(G.keepParts(G.fullSpec(outlast())), null);
  // What's refused.
  assert.deepEqual(ats(G.specProblems(outlast({ keep: KEEP({ each: 4 }) }))), ["get.keep.each"]);
  assert.deepEqual(ats(G.specProblems(outlast({ keep: KEEP({ each: 0 }) }))), ["get.keep.each"]);
  assert.deepEqual(ats(G.specProblems(outlast({ keep: { each: 1 } }))), ["get.keep.from"]);
  assert.deepEqual(ats(G.specProblems(outlast({ keep: KEEP({ from: " " }) }))), ["get.keep.from"]);
  assert.deepEqual(ats(G.specProblems(outlast({ keep: KEEP({ cost: "gold" }) }))), ["get.keep.cost"]);
  assert.deepEqual(ats(G.specProblems(outlast({ keep: KEEP({ fallback: "random" }) }))), ["get.keep.fallback"]);
  assert.deepEqual(ats(G.specProblems(outlast({ keep: KEEP({ extra: 1 }) }))), ["get.keep.extra"]);
  assert.deepEqual(ats(G.specProblems(outlast({ keep: 2 }))), ["get.keep"]);
  // A round is a snake's; a price is the data's (a cap or a market), never an auction's bids alone.
  assert.match(G.specProblems(lineup({ order: "blind", own: "shared", keep: KEEP({ cost: "round" }) }))[0].problem, /snake/);
  assert.deepEqual(G.specProblems(outlast({ keep: KEEP({ cost: "round" }) })), []);
  assert.match(G.specProblems(outlast({ keep: KEEP({ cost: "price" }) }))[0].problem, /salary cap or a stock market/);
  assert.match(G.specProblems(lineup({ order: "auction", budget: { total: 20 }, keep: KEEP({ cost: "price" }) }))[0].problem, /auction's prices are its bids/);
  assert.deepEqual(G.specProblems(lineup({ order: "blind", own: "shared", budget: { total: 30 }, keep: KEEP({ cost: "price" }) })), []);
  // Only a draft keeps anyone.
  assert.deepEqual(ats(G.specProblems({ preset: "survival-pool", get: { by: "pick", keep: KEEP() } })), ["get.keep"]);
  // The data rule: from is one of the couch's games on an earlier season (the context pack's), when it lists them.
  assert.deepEqual(ats(G.specProblems(S17, { ...CTX, games: ["L9"] })), ["get.keep.from"]);
  assert.deepEqual(G.specProblems(S17, { ...CTX, games: [{ id: "L0" }] }), []);
  // The exclusive count (the 9:10 PM decision): each keeper takes one out of the pool and one pick out of the draft, so keepers
  // change nothing: a pool that covers every pick still does, and one that doesn't still doesn't.
  for (const [pool, couch] of [[9, 3], [8, 3], [12, 4]]) {
    const ctx = { ...CTX, pool, couch };
    assert.deepEqual(ats(G.specProblems(S17, ctx)), ats(G.specProblems(outlast(), ctx)), `${pool} for ${couch}`);
  }
  assert.ok(G.covers({ pool: 9 - 2, people: 3, each: 3 }) === false && G.covers({ pool: 9, people: 3, each: 3 }));
  // Words.
  const d = G.describeSpec(S17, { show: "The Challenge 42" });
  assert.match(d.sentence, /everyone drafts 3, keeping up to two of last season's team who come back/);
  assert.ok(d.rules.some((r) => /^Keepers: before the draft, keep up to two .* if they're on this season's cast\. Each takes a place on your team of three/.test(r)));
  assert.ok(d.rules.some((r) => /passed over once their team is full/.test(r)));
  assert.ok(d.rules.some((r) => /whoever names them first has them/.test(r)));
  assert.ok(d.rules.some((r) => /keep your best who are back/.test(r)));
  assert.ok(d.rules.some((r) => /isn't back can't be kept: their place goes to the draft/.test(r)));
  const one = G.describeSpec(lineup({ order: "blind", own: "shared", keep: { each: 1, from: "L0", fallback: "none" } }));
  assert.match(one.sentence, /keeping one of last season's team if they come back/);
  assert.ok(one.rules.some((r) => /can still be on someone else's team/.test(r)) && one.rules.some((r) => /you keep nobody/.test(r)));
  assert.ok(G.describeSpec(outlast({ keep: KEEP({ cost: "round" }) })).rules.some((r) => /sit out one of your first rounds/.test(r)));
  assert.ok(G.describeSpec(lineup({ order: "blind", own: "shared", budget: { total: 30, trade: {} }, keep: KEEP() })).rules.some((r) => /costs their price when the draft starts, out of your 30/.test(r)));
  assert.ok(G.describeSpec(lineup({ order: "blind", own: "shared", budget: { total: 30 }, keep: KEEP() })).rules.some((r) => /count against the cap/.test(r)));
  // A snake under a cap whose keepers cost a round says both.
  const capRound = G.describeSpec(lineup({ order: "snake", own: "exclusive", budget: { total: 30 }, keep: KEEP({ cost: "round" }) })).rules;
  assert.ok(capRound.some((r) => /count against the cap/.test(r)) && capRound.some((r) => /sit out one of your first rounds/.test(r)));
  // Settings both ways: draftKeep, as the spec says it.
  const st = G.settingsOf(S17);
  assert.deepEqual(st.draftKeep, { each: 2, from: "L0", fallback: "best", cost: "place" });
  assert.deepEqual(G.specOf(st).get.keep, st.draftKeep);
  assert.equal(G.settingsOf(outlast()).draftKeep, undefined);
  assert.equal(G.specOf(G.settingsOf(outlast())).get.keep, undefined);
});

test("keepers: a name across seasons, and a seat's options from last season's game", () => {
  const K = S.KeeperLogic;
  assert.equal(K.nameKey('Johnny "Bananas" Devenanzio'), K.nameKey("Johnny Devenanzio"));
  assert.equal(K.nameKey("Benjamin “Coach” Wade"), K.nameKey("benjamin wade"));
  assert.equal(K.nameKey("Horacio Gutiérrez Jr."), K.nameKey("Horacio Gutierrez"));
  assert.equal(K.nameKey("  CT  Tamburello "), "ct tamburello");
  assert.notEqual(K.nameKey("Kyle"), K.nameKey("Kyle Christie"));
  assert.notEqual(K.nameKey("Da'Vonne Rogers"), K.nameKey("Davonne Rogers"));
  // Last season's Outlast: ann held A, B and C (C won, B lasted to episode 2, A went first); bo held D.
  const old = league(outlast(), { n: 5, people: ["oa", "ob"], names: ["Aneesa Ferreira", 'Johnny "Bananas" Devenanzio', "Cara Maria Sorbello", "Derek Chavez", "Nia Moore"] });
  [["c0", "oa"], ["c1", "oa"], ["c2", "oa"], ["c3", "ob"]].forEach(([c, p]) => S.Core.setOwner(old, c, p));
  old.episodes.push({ id: "ep2", number: 2, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} });
  S.EpisodeLogic.addElimination(old, "ep1", "c0", "Eliminated");
  S.EpisodeLogic.addElimination(old, "ep2", "c1", "Eliminated");
  // A scored by place ranks by how long they lasted: C, then B, then A.
  assert.deepEqual(K.rankFrom(old).filter((id) => ["c0", "c1", "c2"].includes(id)), ["c2", "c1", "c0"]);
  // This season: Bananas (as "Johnny Devenanzio") and Aneesa are back; Cara Maria isn't; Derek is back but was bo's.
  const now = league(S17, { n: 4, names: ["Johnny Devenanzio", "Derek Chavez", "Aneesa Ferreira", "Someone New"] });
  assert.deepEqual(K.optionsFrom(old, ["oa"], now), ["c0", "c2"]);
  assert.deepEqual(K.optionsFrom(old, ["ob"], now), ["c1"]);
  assert.deepEqual(K.optionsFrom(old, ["nobody"], now), []);
  // Someone gone home before this season's draft (the cast as the data has it now) isn't offered.
  now.castaways[2].status = "eliminated";
  assert.deepEqual(K.optionsFrom(old, ["oa"], now), ["c0"]);
  // Scored by moments, best first by last season's points.
  const pts = league(lineup(), { n: 3, people: ["oa"], names: ["X One", "Y Two", "Z Three"] });
  ["c0", "c1", "c2"].forEach((c) => S.Core.setOwner(pts, c, "oa"));
  pts.episodes[0].scoringEvents.push({ id: "e1", type: "individualImmunity", castawayId: "c1" });
  assert.equal(K.rankFrom(pts)[0], "c1");
});

test("keepers: options, naming them, and the lock's fallbacks", () => {
  const K = S.KeeperLogic;
  // Not a keepers game: nothing to name, nothing written.
  const plain = league(outlast());
  assert.equal(K.setOptions(plain, { ann: ["c0"] }), false);
  assert.match(K.choose(plain, "ann", []), /doesn't keep anyone/);
  const s = league(S17);
  // Options: only castaways on this league's cast and still in, only seats that exist.
  s.castaways[9].status = "eliminated";
  assert.equal(K.setOptions(s, { ann: ["c0", "c1", "c9", "zz"], bo: ["c1", "c2", "c3"], ghost: ["c4"] }), true);
  assert.deepEqual(s.keepers.options, { ann: ["c0", "c1"], bo: ["c1", "c2", "c3"] });
  assert.equal(K.setOptions(s, { ann: ["c0", "c1"], bo: ["c1", "c2", "c3"] }), false);
  // Naming: up to `each`, once each, only your options; who named them recorded.
  assert.match(K.choose(s, "ann", ["c0", "c1", "c2"]), /Keep up to 2/);
  assert.match(K.choose(s, "ann", ["c0", "c0"]), /twice/);
  assert.match(K.choose(s, "ann", ["c3"]), /isn't one of yours from last season who's back/);
  assert.match(K.choose(s, "zz", []), /No such player/);
  assert.equal(K.choose(s, "ann", ["c1"], "u-ann"), null);
  assert.deepEqual(K.chosen(s, "ann"), ["c1"]);
  assert.equal(s.keepers.chosen.ann.by, "u-ann");
  // Exclusive: nobody keeps someone another seat named first.
  assert.match(K.choose(s, "bo", ["c1", "c2"]), /C1 Person is kept by ann already/);
  assert.equal(K.choose(s, "bo", ["c2"]), null);
  assert.equal(K.choose(s, "cy", []), null);
  assert.deepEqual(K.chosen(s, "cy"), []);
  // An option that leaves the cast before the lock is dropped from the options, and the lock won't keep it: its place goes to the
  // draft. What was named stays as named (one bad read of last season's game never erases it).
  assert.equal(K.setOptions(s, { ann: ["c0", "c1"], bo: ["c3"] }), true);
  assert.deepEqual([K.chosen(s, "bo"), K.named(s, "bo")], [["c2"], []]);
  assert.equal(K.setOptions(s, {}), true);
  assert.deepEqual([K.chosen(s, "ann"), K.named(s, "ann")], [["c1"], []]);
  assert.equal(K.setOptions(s, { ann: ["c0", "c1"], bo: ["c3"] }), true);
  assert.deepEqual(K.named(s, "ann"), ["c1"]);
  assert.equal(K.locked(s), false);
  assert.equal(K.due(s), false);
  // The lock: as the draft starts.
  S.DraftLogic.forceStart(s);
  assert.equal(K.locked(s), true);
  assert.deepEqual(kept(s, "ann"), ["c1"]);
  assert.deepEqual(kept(s, "bo"), []);
  assert.deepEqual(kept(s, "cy"), []);
  assert.deepEqual(team(s, "ann"), ["c1"]);
  assert.equal(S.getCastaway(s, "c1").acquiredVia, "keeper");
  assert.match(K.choose(s, "ann", ["c0"]), /locked/);
  assert.equal(K.setOptions(s, { ann: ["c0"] }), false);
  // The fallback: someone who named nobody keeps their best who are back, skipping one another seat has (exclusive), in the
  // draft's order after everyone who named theirs (first come).
  const f = open(league(S17), { ann: ["c0", "c1", "c2"], bo: ["c0", "c3"], cy: ["c4"] }, { cy: ["c4"] });
  S.KeeperLogic.choose(f, "bo", ["c0"], "u-bo");
  S.DraftLogic.forceStart(f);
  assert.deepEqual([kept(f, "ann"), kept(f, "bo"), kept(f, "cy")], [["c1", "c2"], ["c0"], ["c4"]]);
  // fallback none: nobody kept for someone who named nobody.
  const none = open(league(outlast({ keep: KEEP({ fallback: "none" }) })), { ann: ["c0"], bo: ["c1"] }, { bo: ["c1"] });
  S.DraftLogic.forceStart(none);
  assert.deepEqual([kept(none, "ann"), kept(none, "bo")], [[], ["c1"]]);
  // Shared: two can keep the same one.
  const sh = open(league(lineup({ order: "blind", own: "shared", keep: KEEP() })), { ann: ["c0", "c1"], bo: ["c0"] }, { ann: ["c0"], bo: ["c0"] });
  S.DraftLogic.forceStart(sh);
  assert.deepEqual([kept(sh, "ann"), kept(sh, "bo")], [["c0"], ["c0"]]);
  assert.deepEqual(S.getCastaway(sh, "c0").ownerIds.sort(), ["ann", "bo"]);
  // A game whose teams were made before its keepers locked keeps its teams: nobody keeps anyone.
  const late = league(outlast());
  S.DraftLogic.forceStart(late);
  snake(late);
  assert.deepEqual(S.RosterLogic.setGame(late, S17), []);
  open(late, { ann: [team(late, "bo")[0]] });
  assert.equal(S.KeeperLogic.settle(late), true);
  assert.deepEqual(late.keepers.kept, {});
  assert.equal(team(late, "ann").length, 3);
});

test("keepers: a snake passes over a full team, or sits it out of its first rounds", () => {
  // Place (the default): ann keeps two of three, bo one, cy none; the snake gives ann one pick, in the first round.
  const s = open(league(S17), { ann: ["c0", "c1"], bo: ["c2"] }, { ann: ["c0", "c1"], bo: ["c2"] });
  S.DraftLogic.forceStart(s);
  assert.deepEqual(snake(s), ["ann", "bo", "cy", "cy", "bo", "cy"]);
  assert.deepEqual([team(s, "ann").length, team(s, "bo").length, team(s, "cy").length], [3, 3, 3]);
  assert.equal(S.currentDraftTurn(s).isComplete, true);
  // A keeper isn't taken back as a pick.
  S.undraft(s, "c0");
  assert.deepEqual(team(s, "ann").includes("c0"), true);
  // Round: ann sits out her first two rounds, bo his first.
  const r = open(league(outlast({ keep: KEEP({ cost: "round" }) })), { ann: ["c0", "c1"], bo: ["c2"] }, { ann: ["c0", "c1"], bo: ["c2"] });
  S.DraftLogic.forceStart(r);
  const turns = [];
  for (let i = 0; i < 9; i++) {
    const t = S.currentDraftTurn(r);
    if (!t || t.isComplete) break;
    turns.push(`${t.playerId}${t.personalPickNumber}`);
    S.draftToCurrentTurn(r, S.freeAgents(r)[0].id);
  }
  assert.deepEqual(turns, ["cy1", "cy2", "bo2", "ann3", "bo3", "cy3"]);
  assert.deepEqual([team(r, "ann").length, team(r, "bo").length, team(r, "cy").length], [3, 3, 3]);
  // Nobody kept anyone: the snake as it always was.
  const plain = league(S17);
  S.DraftLogic.forceStart(plain);
  assert.deepEqual(snake(plain), ["ann", "bo", "cy", "cy", "bo", "ann", "ann", "bo", "cy"]);
  // Keepers that came out of the spec after they locked: their places stay taken (its last rounds), nothing throws.
  const gone = open(league(S17), { ann: ["c0", "c1"] }, { ann: ["c0", "c1"] });
  S.DraftLogic.forceStart(gone);
  assert.deepEqual(S.RosterLogic.setGame(gone, outlast()), []);
  assert.equal(S.KeeperLogic.config(gone), null);
  assert.deepEqual(snake(gone), ["ann", "bo", "cy", "cy", "bo", "bo", "cy"]);
  // A seat all of whose places its keepers fill is passed over the whole draft.
  const full = open(league(outlast({ each: 2, keep: KEEP() })), { ann: ["c0", "c1"] }, { ann: ["c0", "c1"] });
  S.DraftLogic.forceStart(full);
  assert.deepEqual(snake(full), ["bo", "cy", "cy", "bo"]);
});

test("keepers: a blind draft's sheet, a draw and an auction fill the places left", () => {
  // Blind (shared): ann keeps one, so she picks two; her keeper can't be on her sheet, and someone else can pick him.
  const b = open(league(lineup({ order: "blind", own: "shared", keep: KEEP() })), { ann: ["c0"], bo: ["c1", "c2"] }, { ann: ["c0"], bo: ["c1", "c2"] });
  S.DraftLogic.forceStart(b);
  assert.match(S.BlindDraftLogic.validateSubmission(b, "ann", ["c1", "c2", "c3"]), /Pick exactly 2 castaways beside your keeper/);
  assert.match(S.BlindDraftLogic.validateSubmission(b, "ann", ["c0", "c3"]), /one of your keepers already/);
  assert.equal(S.BlindDraftLogic.validateSubmission(b, "ann", ["c1", "c3"]), null);
  assert.equal(S.BlindDraftLogic.validateSubmission(b, "bo", ["c0"]), null);
  assert.equal(S.BlindDraftLogic.validateSubmission(b, "cy", ["c0", "c1", "c2"]), null);
  S.BlindDraftLogic.reveal(b, { ann: ["c1", "c3"], bo: ["c0"], cy: ["c0", "c1", "c2"] });
  assert.deepEqual([team(b, "ann"), team(b, "bo"), team(b, "cy")], [["c0", "c1", "c3"], ["c0", "c1", "c2"], ["c0", "c1", "c2"]]);
  // A seat its keepers filled has nothing to lock in, so nobody waits for it; when they filled every team, it's revealed as they
  // lock (an auction settled), with nothing to wait for.
  const bf = open(league(lineup({ each: 2, order: "blind", own: "shared", keep: KEEP() })), { ann: ["c0", "c1"] }, { ann: ["c0", "c1"] });
  S.DraftLogic.forceStart(bf);
  assert.deepEqual(S.BlindDraftLogic.eligiblePlayers(bf).map((p) => p.id), ["bo", "cy"]);
  const allFull = open(league(lineup({ each: 1, order: "blind", own: "shared", keep: KEEP({ each: 1 }) }), { people: ["ann", "bo"] }), { ann: ["c0"], bo: ["c0"] });
  S.DraftLogic.forceStart(allFull);
  assert.ok(S.BlindDraftLogic.isRevealed(allFull) && S.BlindDraftStrategy.currentTurn(allFull).isComplete);
  assert.deepEqual([team(allFull, "ann"), team(allFull, "bo")], [["c0"], ["c0"]]);
  const auctionFull = open(league(outlast({ each: 1, order: "auction", budget: { total: 10 }, keep: KEEP({ each: 1 }) }), { people: ["ann", "bo"] }), { ann: ["c0"], bo: ["c1"] });
  S.DraftLogic.forceStart(auctionFull);
  assert.ok(S.AuctionLogic.settled(auctionFull) && !S.AuctionLogic.eligiblePlayers(auctionFull).length);
  // An exclusive draw: one hat without anyone kept; each team dealt only its places left; the log the dealt alone.
  const d = open(league(outlast({ order: "draw", keep: KEEP() })), { ann: ["c0", "c1"], bo: ["c2"] }, { ann: ["c0", "c1"], bo: ["c2"] });
  S.DraftLogic.forceStart(d);
  assert.ok(S.DrawLogic.drawn(d));
  assert.deepEqual([team(d, "ann").length, team(d, "bo").length, team(d, "cy").length], [3, 3, 3]);
  const all = [...team(d, "ann"), ...team(d, "bo"), ...team(d, "cy")];
  assert.equal(new Set(all).size, 9);
  assert.equal(d.draftLog.length, 6);
  assert.ok(!d.draftLog.some((e) => ["c0", "c1", "c2"].includes(e.castawayId)));
  // A shared draw: each its own hat, its own keepers left out of it.
  const ds = open(league(lineup({ order: "draw", own: "shared", keep: KEEP() })), { ann: ["c0"] }, { ann: ["c0"] });
  S.DraftLogic.forceStart(ds);
  assert.equal(team(ds, "ann").length, 3);
  assert.ok(team(ds, "ann").includes("c0"));
  // An auction: bids for the places left, from the whole budget (a keeper costs a place); a keeper can't be bid on.
  const a = open(league(outlast({ order: "auction", budget: { total: 20 }, keep: KEEP() })), { ann: ["c0", "c1"] }, { ann: ["c0", "c1"] });
  S.DraftLogic.forceStart(a);
  assert.equal(S.AuctionLogic.maxBid(a, "ann"), 20);
  assert.equal(S.AuctionLogic.maxBid(a, "bo"), 18);
  assert.match(S.AuctionLogic.validateBids(a, "bo", [{ castawayId: "c0", bid: 5 }]), /on a team already/);
  assert.match(S.AuctionLogic.validateBids(a, "ann", [{ castawayId: "c3", bid: 21 }]), /from 1 to 20/);
  assert.ok(S.AuctionLogic.ready(a));
  assert.equal(S.AuctionLogic.settle(a, { ann: [{ castawayId: "c3", bid: 20 }], bo: [{ castawayId: "c3", bid: 5 }] }, "seed"), true);
  assert.deepEqual([team(a, "ann").length, team(a, "bo").length, team(a, "cy").length], [3, 3, 3]);
  assert.ok(team(a, "ann").includes("c3"));
  assert.equal(a.auction.spent.ann, 20);
  assert.deepEqual(a.auction.short, []);
  // A computer player's sheet is for the places its keepers leave.
  const ab = open(league(outlast({ order: "auction", budget: { total: 20 }, keep: KEEP() }), { people: ["ann"], bots: ["rob"] }), { rob: ["c0", "c1"] }, { rob: ["c0"] });
  S.DraftLogic.forceStart(ab);
  const sheet = Bots.auctionBids(ab).find((x) => x.playerId === "rob");
  assert.ok(sheet && sheet.bids.every((x) => x.castawayId !== "c0"));
  assert.equal(S.AuctionLogic.validateBids(ab, "rob", sheet.bids), null);
});

test("keepers: a salary cap counts them, a stock market charges their price, computer players fill the rest", () => {
  // A cap of 30 (prices 1 to 15; everyone 8 before anyone's scored): ann keeps one, so her sheet of two is held to the cap with
  // him on it.
  const cap = { total: 30, ceiling: 15 };
  const c = open(league(lineup({ order: "blind", own: "shared", budget: cap, keep: KEEP() })), { ann: ["c0"] }, { ann: ["c0"] });
  S.DraftLogic.forceStart(c);
  assert.equal(S.BlindDraftLogic.validateSubmission(c, "ann", ["c1", "c2"]), null);
  c.episodes[0].scoringEvents.push({ id: "e1", type: "individualImmunity", castawayId: "c1" }, { id: "e2", type: "individualImmunity", castawayId: "c2" });
  assert.match(S.BlindDraftLogic.validateSubmission(c, "ann", ["c1", "c2"]), /cap is 30/);
  // The cheapest team that fits counts the keeper once: a sheet that takes the team over the cap is refused while one that keeps
  // it within exists (the keeper and the two cheapest).
  const c2 = open(league(lineup({ order: "blind", own: "shared", budget: cap, keep: KEEP() })), { ann: ["c0"] }, { ann: ["c0"] });
  c2.episodes[0].scoringEvents.push({ id: "e1", type: "individualImmunity", castawayId: "c1" }, { id: "e2", type: "individualImmunity", castawayId: "c2" }, { id: "e3", type: "individualImmunity", castawayId: "c2" });
  S.DraftLogic.forceStart(c2);
  const pr = S.PriceLogic.prices(c2);
  assert.ok(pr.get("c0") + pr.get("c1") + pr.get("c2") > 30 && pr.get("c0") + pr.get("c3") + pr.get("c4") <= 30, JSON.stringify([...pr]));
  assert.match(S.BlindDraftLogic.validateSubmission(c2, "ann", ["c1", "c2"]), /cap is 30/);
  assert.equal(S.BlindDraftLogic.validateSubmission(c2, "ann", ["c3", "c4"]), null);
  // A stock market: a keeper costs their price at the lock (8, before anyone's scored) out of the cash.
  const m = open(league(lineup({ order: "snake", own: "exclusive", budget: { total: 30, ceiling: 15, trade: {} }, keep: KEEP() })), { ann: ["c0"] }, { ann: ["c0"] });
  S.DraftLogic.forceStart(m);
  assert.deepEqual(S.KeeperLogic.kept(m, "ann"), [{ castawayId: "c0", price: 8 }]);
  assert.equal(S.MarketLogic.cash(m, "ann"), 22);
  snake(m);
  assert.equal(S.MarketLogic.cash(m, "ann"), 6);
  assert.equal(S.MarketLogic.cash(m, "bo"), 6);
  assert.deepEqual(Object.fromEntries(S.MarketLogic.cashAll(m)), { ann: 6, bo: 6, cy: 6 });
  // A market whose keepers cost a place: free, so the cash goes on the rest.
  const free = open(league(lineup({ order: "snake", own: "exclusive", budget: { total: 30, ceiling: 15, trade: {} }, keep: KEEP({ cost: "place" }) })), { ann: ["c0"] }, { ann: ["c0"] });
  S.DraftLogic.forceStart(free);
  snake(free);
  assert.equal(S.MarketLogic.cash(free, "ann"), 14);
  // Computer players: a blind sheet for the places their keepers leave, beside them.
  const bot = open(league(lineup({ order: "blind", own: "shared", keep: KEEP() }), { people: ["ann"], bots: ["rob"] }), { rob: ["c0", "c1"] }, { rob: ["c0"] });
  S.DraftLogic.forceStart(bot);
  const sub = Bots.blindSubmissions(bot).find((x) => x.playerId === "rob");
  assert.equal(sub.castawayIds.length, 2);
  assert.ok(!sub.castawayIds.includes("c0"));
});
