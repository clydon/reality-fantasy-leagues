// A draft's prices (docs/PLAN-start-a-game-gpt.md step A10 part 3b: the stretch rows s03 "Auction draft: everyone gets $100 to
// bid on castaways", s04 "Salary cap: couples cost more the better they're doing", the dial row answer.bid). The spec's
// get.budget: an auction (get.order 'auction', exclusive: sealed bids settled at once, the highest first, ties by a seed, a team
// the bids didn't fill filled at the lowest price or left short, the bidding closing at the first episode's lock) and a salary
// cap (any other draft: each castaway's price from their points so far by the game's rules, by standing; a team within the cap
// when it's drafted and whenever it changes after, the cap never blocking a draft, a team that went over as its prices moved
// keeping its team but going no further over). Their shape, defaults, words and settings; the prices; the auction; the cap at
// the draft (snake, blind, a draw) and on waivers; computer players. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");
const { draftKind, draftView } = jiti("../src/lib/game/draft-view.ts");
const { draftOpen } = jiti("../src/lib/game/computer-players.ts");

const ats = (problems) => problems.map((p) => p.at);
const CTX = { moments: [], results: true, winner: true, roles: [], grouped: true, jury: true, phases: [{ id: "premerge" }, { id: "merged" }] };
const outlast = (get = {}) => ({ preset: "outlast", get: { by: "draft", ...get } });
const lineup = (get = {}, start = 2) => ({ preset: "weekly-lineup", get: { by: "draft", ...get }, count: { start } });
const AUCTION = (each = 2, budget) => outlast({ each, order: "auction", ...(budget ? { budget } : {}) });
const CAP = (each = 3, budget = { total: 30 }, extra = {}) => lineup({ each, order: "blind", own: "shared", budget, ...extra }, 2);

/** A league of `n` castaways over made-up tribes (c0.., on t1/t2 by turns), `people` its seats, the game `spec`. */
function league(spec, { n = 8, people = ["ann", "bo", "cy"], bots = [], tribes = 2 } = {}) {
  const settings = { ...G.settingsOf(spec), showFormat: "survivor" };
  assert.ok(G.settingsOf(spec), `plays: ${JSON.stringify(spec)}`);
  return S.migrateLeagueState({
    settings,
    players: [...people, ...bots].map((id) => ({ id, name: id, color: "#000", active: true, ...(bots.includes(id) ? { automated: true } : {}) })),
    draftOrder: [...people, ...bots],
    tribes: Array.from({ length: tribes }, (_, t) => ({ id: `t${t + 1}`, name: ["Toka", "Savu", "Dina"][t], color: "#000" })),
    castaways: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `C${i} Person`, status: "active", tribeId: `t${(i % tribes) + 1}`, ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
    episodes: [{ id: "ep1", number: 1, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} }],
  });
}
const team = (s, pid) => s.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id).sort();
/** Episode `number`'s results: `points` { castawayId: individual immunity wins }, `out` who went home. */
function results(s, number, points = {}, out = []) {
  let ep = s.episodes.find((e) => e.number === number);
  if (!ep) {
    ep = { id: `ep${number}`, number, events: [], scoringEvents: [], bets: [], picks: [], lineups: {} };
    s.episodes.push(ep);
  }
  Object.entries(points).forEach(([cid, times]) => {
    for (let i = 0; i < times; i++) ep.scoringEvents.push({ id: `${ep.id}-${cid}-${i}`, type: "individualImmunity", castawayId: cid });
  });
  out.forEach((cid) => S.EpisodeLogic.addElimination(s, ep.id, cid, "Voted out"));
  if (!ep.scoringEvents.length && !out.length) ep.noExit = true;
}
const started = (s) => {
  S.forceStartDraft ? S.forceStartDraft(s) : S.DraftLogic.forceStart(s);
  return s;
};

test("a draft's prices: their shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX, opts) => ats(G.specProblems(spec, ctx, opts));
  // s03 and s04 as the tracker says them: valid, played as today's games, nothing to wait for.
  const s03 = lineup({ each: 5, order: "auction", budget: { total: 100 } }, 3);
  const s04 = CAP(4, { total: 100 });
  for (const s of [s03, s04, AUCTION()]) {
    assert.deepEqual(at(s), [], JSON.stringify(s));
    assert.deepEqual(G.specWaitsFor(s), []);
  }
  assert.equal(G.typeOf(AUCTION()), "classic-draft");
  assert.equal(G.typeOf(s03), "active-roster");
  assert.equal(G.typeOf(s04), "active-roster");
  // The defaults (the user's to set): an auction is exclusive with 100 each, bids from 1, a team it didn't fill filled; a cap
  // counts someone gone home as nothing, its highest price the one where an average team fits.
  assert.deepEqual(G.fullSpec(AUCTION()).get, { by: "draft", each: 2, order: "auction", own: "exclusive", budget: { total: 100, floor: 1, fallback: "fill" } });
  assert.deepEqual(G.fullSpec(s04).get.budget, { total: 100, floor: 1, gone: "zero", ceiling: 49 });
  assert.equal(G.ceilingFor(100, 5, 1), 39);
  assert.equal(G.ceilingFor(30, 1, 1), 30);
  assert.deepEqual(G.budgetParts(G.fullSpec(s04)), { auction: false, total: 100, floor: 1, ceiling: 49, gone: "zero" });
  // An auction is for castaways nobody else can have; its shared version is a salary cap.
  assert.deepEqual(at(outlast({ each: 2, order: "auction", own: "shared" })), ["get.own"]);
  assert.match(G.specProblems(outlast({ each: 2, order: "auction", own: "shared" }))[0].problem, /salary cap/);
  // A cap's prices are points by the game's rules: scored by place, everyone still in is the same.
  assert.deepEqual(at(outlast({ each: 2, order: "snake", own: "exclusive", budget: { total: 30 } })), ["get.budget"]);
  // The budget's shape.
  assert.deepEqual(at(AUCTION(3, { total: 2 })), ["get.budget.floor"]);
  assert.deepEqual(at(AUCTION(2, { total: 5000 })), ["get.budget.total"]);
  assert.deepEqual(at(AUCTION(2, { ceiling: 50 })), ["get.budget.ceiling"]);
  assert.deepEqual(at(AUCTION(2, { gone: "last" })), ["get.budget.gone"]);
  assert.deepEqual(at(AUCTION(2, { fallback: "wait" })), ["get.budget.fallback"]);
  assert.deepEqual(at(CAP(3, { total: 30, fallback: "fill" })), ["get.budget.fallback"]);
  assert.deepEqual(at(CAP(3, { total: 30, ceiling: 40 })), ["get.budget.ceiling"]);
  assert.deepEqual(at(CAP(3, { total: 30, gone: "half" })), ["get.budget.gone"]);
  assert.deepEqual(at(CAP(3, { total: 30, rate: 2 })), ["get.budget.rate"]);
  // The exclusive count (the 9:10 PM decision): an auction the pool doesn't cover says to make it a salary cap.
  const short = G.specProblems(AUCTION(3), { ...CTX, pool: 8, couch: 4 });
  assert.deepEqual(ats(short), ["get.own"]);
  assert.match(short[0].problem, /4 of you × 3 picks is more than the 8 .* make it a salary cap/);
  assert.deepEqual(at(AUCTION(2), { ...CTX, pool: 8, couch: 4 }), []);
  // Words: the sentence and How it works.
  const d3 = G.describeSpec(s03, { show: "Survivor 51", castaway: "castaway" });
  assert.match(d3.sentence, /everyone has 100 to bid on a team of 5 and starts 3/);
  assert.ok(d3.rules.some((r) => /It's an auction: everyone has 100 to spend/.test(r)) && d3.rules.some((r) => /Equal bids are settled by a draw/.test(r)) && d3.rules.some((r) => /filled from who's left, at random, at 1 each/.test(r)));
  const d4 = G.describeSpec(s04, { show: "Dancing with the Stars", castaway: "couple" });
  assert.match(d4.sentence, /everyone drafts 4 under a salary cap of 100/);
  assert.ok(d4.rules.some((r) => /salary cap of 100: each couple costs 1 to 49 by how they're doing/.test(r)) && d4.rules.some((r) => /a change can't take it further over/.test(r)));
  assert.ok(G.describeSpec(AUCTION(2, { fallback: "short" })).rules.some((r) => /stays short/.test(r)));
  // Settings, both ways: each absent unless a game says it.
  for (const spec of [s03, s04, AUCTION(2, { total: 50, floor: 2, fallback: "short" }), CAP(3, { total: 30, ceiling: 12, gone: "last" })]) {
    const f = G.settingsOf(spec);
    assert.ok(G.sameValue(G.fullSpec(G.specOf(f)).get, G.fullSpec(spec).get), JSON.stringify(spec));
  }
  assert.equal(G.settingsOf(s03).draftAuction, true);
  assert.equal(G.settingsOf(s04).draftAuction, undefined);
  assert.equal(G.settingsOf(lineup({ each: 3 })).draftBudget, undefined);
  assert.equal(G.specOf({ leagueTypeId: "classic-draft", teamSize: 2 }).get.budget, undefined);
});

test("a salary cap's prices come from the data: by standing, ties sharing, moving with each episode; someone gone home", () => {
  const s = league(CAP(3, { total: 30, floor: 1, ceiling: 15 }), { n: 5 });
  // Before anyone's scored, everyone costs the middle.
  assert.deepEqual([...S.PriceLogic.prices(s).values()], [8, 8, 8, 8, 8]);
  // Episode 1: c0 wins twice, c1 once: c0 the highest, c1 next, the three on nothing share the middle of their places.
  results(s, 1, { c0: 2, c1: 1 });
  let p = S.PriceLogic.prices(s);
  assert.deepEqual([p.get("c0"), p.get("c1"), p.get("c2"), p.get("c3"), p.get("c4")], [15, 12, 5, 5, 5]);
  assert.equal(S.PriceLogic.points(s).get("c0"), 8); // individual immunity at the game's points: 4 each, shared
  // Prices as of an earlier episode read only its results.
  assert.deepEqual([...S.PriceLogic.prices(s, 0).values()], [8, 8, 8, 8, 8]);
  // Episode 2: c0 goes home. Gone counts nothing (zero) by default; the rest are priced among those still in.
  results(s, 2, { c2: 3 }, ["c0"]);
  p = S.PriceLogic.prices(s);
  assert.equal(p.get("c0"), 0);
  assert.deepEqual([p.get("c2"), p.get("c1"), p.get("c3")], [15, 10, 3]);
  // ... or what they cost going into the episode they went home in (last).
  const last = league(CAP(3, { total: 30, floor: 1, ceiling: 15, gone: "last" }), { n: 5 });
  results(last, 1, { c0: 2, c1: 1 });
  results(last, 2, { c2: 3 }, ["c0"]);
  assert.equal(S.PriceLogic.prices(last).get("c0"), 15);
  // Not a cap: no prices.
  assert.equal(S.PriceLogic.prices(league(AUCTION())).size, 0);
});

test("an auction: sealed bids, settled at once, the highest first, ties by the seed; the fallbacks", () => {
  const s = started(league(AUCTION(2, { total: 10, floor: 1 }), { n: 8 }));
  assert.equal(S.getLeagueType(s).draftStrategy, S.AuctionDraftStrategy);
  assert.equal(draftKind(s), "auction");
  assert.equal(S.currentDraftTurn(s), null);
  assert.ok(draftOpen(s));
  // The bids' shape: whole numbers from the lowest price to what's left after it for every other place, on someone free, once.
  const V = (bids, pid = "ann") => S.AuctionLogic.validateBids(s, pid, bids);
  assert.equal(S.AuctionLogic.maxBid(s), 9);
  assert.equal(V([]), null);
  assert.equal(V([{ castawayId: "c0", bid: 9 }, { castawayId: "c1", bid: 1 }]), null);
  assert.match(V([{ castawayId: "c0", bid: 10 }]), /from 1 to 9/);
  assert.match(V([{ castawayId: "c0", bid: 0 }]), /from 1 to 9/);
  assert.match(V([{ castawayId: "c0", bid: 2.5 }]), /whole number/);
  assert.match(V([{ castawayId: "c0", bid: 2 }, { castawayId: "c0", bid: 3 }]), /twice/);
  assert.match(V([{ castawayId: "zz", bid: 2 }]), /Unknown/);
  assert.match(V(Array.from({ length: 7 }, (_, i) => ({ castawayId: `c${i}`, bid: 1 }))), /up to 6/);
  assert.match(V([], "nobody"), /No such player/);
  const fresh = league(AUCTION(2, { total: 10 }));
  assert.match(S.AuctionLogic.validateBids(fresh, "ann", []), /hasn't opened/);
  // Ann bids 6 on c0 and 3 on c1; Bo 5 on c0 (outbid) and 4 on c2; Cy doesn't bid.
  const bids = {
    ann: [{ castawayId: "c0", bid: 6 }, { castawayId: "c1", bid: 3 }],
    bo: [{ castawayId: "c0", bid: 5 }, { castawayId: "c2", bid: 4 }],
  };
  const out = S.AuctionLogic.outcome(s, bids, "seed-1");
  const won = Object.fromEntries(["ann", "bo", "cy"].map((p) => [p, out.won.filter((x) => x.playerId === p)]));
  assert.deepEqual(won.ann.map((x) => [x.castawayId, x.price]), [["c0", 6], ["c1", 3]]);
  assert.deepEqual(won.bo.find((x) => x.castawayId === "c2").price, 4);
  // Bo's second place, and Cy's whole team, filled from what's left at the lowest price (the fallback, by the seed's hat).
  assert.equal(won.bo.length, 2);
  assert.ok(won.bo.some((x) => x.filled && x.price === 1));
  assert.ok(won.cy.length === 2 && won.cy.every((x) => x.filled && x.price === 1));
  assert.deepEqual(out.spent, { ann: 9, bo: 5, cy: 2 });
  assert.deepEqual(out.short, []);
  // The same bids and seed settle the same way; the outcome changes nothing.
  assert.deepEqual(S.AuctionLogic.outcome(s, bids, "seed-1"), out);
  assert.equal(team(s, "ann").length, 0);
  // Settled: ownership, the log with prices, the record; once.
  assert.ok(S.AuctionLogic.settle(s, bids, "seed-1"));
  assert.deepEqual(team(s, "ann"), ["c0", "c1"]);
  assert.ok(S.AuctionLogic.settled(s) && s.auction.seed === "seed-1" && s.auction.spent.ann === 9);
  assert.equal(s.draftLog.length, 6);
  assert.deepEqual(s.draftLog.slice(0, 3).map((e) => [e.playerId, e.castawayId, e.price]), [["ann", "c0", 6], ["bo", "c2", 4], ["ann", "c1", 3]]);
  assert.deepEqual(S.currentDraftTurn(s), { isComplete: true });
  assert.ok(!draftOpen(s));
  assert.equal(S.AuctionLogic.settle(s, bids, "seed-2"), false);
  assert.match(S.AuctionLogic.validateBids(s, "ann", []), /over/);
  // Nothing to pick or take back.
  S.draftToCurrentTurn(s, "c7");
  assert.equal(team(s, "cy").length, 2);
  // The draft room reads it: who locked in before, the teams once settled.
  const view = draftView({ leagueId: "L", name: "Bids", gameType: "classic-draft", gameName: "Outlast", yourRole: "member" }, s, "ann", null, (p) => p, { queue: [], mine: null }, () => null);
  assert.ok(view.kind === "auction" && view.phase === "done" && view.teams.length === 3 && view.revealedAt === s.auction.at);
});

test("an auction's ties, what a bid can pay, a spread, the fallback short, and the bidding's close", () => {
  // A tie: Ann and Bo both bid 5 on c0; the seed says who wins, the same seed the same way, another seed maybe the other.
  const tie = { ann: [{ castawayId: "c0", bid: 5 }], bo: [{ castawayId: "c0", bid: 5 }] };
  const winners = new Set();
  for (let i = 0; i < 12; i++) {
    const s = started(league(AUCTION(1, { total: 10 }), { people: ["ann", "bo"] }));
    const w = S.AuctionLogic.outcome(s, tie, `seed-${i}`).won.find((x) => x.castawayId === "c0").playerId;
    assert.equal(S.AuctionLogic.outcome(s, tie, `seed-${i}`).won.find((x) => x.castawayId === "c0").playerId, w);
    winners.add(w);
  }
  assert.deepEqual([...winners].sort(), ["ann", "bo"]);
  // A bid wins only while its bidder can still pay the lowest price for every place after it: Ann's 7 on c1 after 6 on c0 would
  // leave nothing for a third place, so it goes to Bo's 2.
  const s = started(league(AUCTION(3, { total: 10 }), { people: ["ann", "bo"] }));
  const out = S.AuctionLogic.outcome(s, { ann: [{ castawayId: "c0", bid: 6 }, { castawayId: "c1", bid: 4 }], bo: [{ castawayId: "c1", bid: 2 }] }, "x");
  assert.deepEqual(out.won.filter((x) => !x.filled).map((x) => [x.playerId, x.castawayId, x.price]), [["ann", "c0", 6], ["bo", "c1", 2]]);
  assert.ok(out.spent.ann <= 10 && out.won.filter((x) => x.playerId === "ann").length === 3);
  // Fallback short: a team the bids didn't fill stays short.
  const sh = started(league(AUCTION(2, { total: 10, fallback: "short" })));
  const o2 = S.AuctionLogic.outcome(sh, { ann: [{ castawayId: "c0", bid: 3 }] }, "x");
  assert.deepEqual(o2.won.map((x) => x.playerId), ["ann"]);
  assert.deepEqual(o2.short.sort(), ["ann", "bo", "cy"]);
  // A spread auction (one from each tribe): a bid that would break the spread is passed over, and the fill keeps it spread.
  const sp = started(league(outlast({ each: 2, order: "auction", across: { of: "group" } }), { n: 8 }));
  const o3 = S.AuctionLogic.outcome(sp, { ann: [{ castawayId: "c0", bid: 9 }, { castawayId: "c2", bid: 8 }] }, "x");
  const annTribes = o3.won.filter((x) => x.playerId === "ann").map((x) => sp.castaways.find((c) => c.id === x.castawayId).tribeId).sort();
  assert.deepEqual(annTribes, ["t1", "t2"]);
  assert.ok(!o3.won.some((x) => x.castawayId === "c2" && x.playerId === "ann"));
  // The close: open until the game's first episode starts; then due, with the bids it has.
  const c = started(league(AUCTION(2)));
  assert.ok(!S.AuctionLogic.due(c, Date.now()));
  c.episodes[0].airsAt = new Date(Date.now() - 60_000).toISOString();
  assert.ok(S.AuctionLogic.due(c, Date.now()));
  assert.ok(!S.AuctionLogic.due(league(AUCTION(2)), Date.now() + 1e12), "not before the bidding opens");
  // Everyone locked in, or not.
  S.AuctionLogic.setLockedPlayerIds(c, ["ann", "bo"]);
  assert.ok(!S.AuctionLogic.allLockedIn(c, ["ann", "bo"]));
  assert.ok(S.AuctionLogic.allLockedIn(c, ["ann", "bo", "cy"]));
  assert.deepEqual(S.AuctionLogic.waitingOn(c).map((p) => p.id), ["cy"]);
});

test("a salary cap at the draft: a snake pick and a blind team within it, with room left; a draw within it; never blocking", () => {
  // A snake (exclusive) Weekly Lineup of three under a cap of 30, prices 1 to 15: after episode 1 c0 15, c1 13, the rest 6.
  const s = league(lineup({ each: 3, order: "snake", own: "exclusive", budget: { total: 30, ceiling: 15 } }), { n: 8 });
  results(s, 1, { c0: 2, c1: 1 });
  started(s);
  const prices = S.PriceLogic.prices(s);
  assert.deepEqual([prices.get("c0"), prices.get("c1"), prices.get("c2")], [15, 13, 6]);
  // Ann takes c0 (15): fine, two left to fill at the cheapest (6 each: 27).
  S.draftToCurrentTurn(s, "c0");
  assert.deepEqual(team(s, "ann"), ["c0"]);
  // Bo, Cy, Cy, Bo pick; then Ann can't take c1 (13): with one more at 6 that's 34, while someone cheaper keeps her within.
  S.draftToCurrentTurn(s, "c2"); S.draftToCurrentTurn(s, "c3"); S.draftToCurrentTurn(s, "c4"); S.draftToCurrentTurn(s, "c5");
  assert.match(S.BudgetLogic.pickProblem(s, "ann", "c1"), /Your team would cost at least 34, with 1 more to pick at the cheapest: the cap is 30/);
  const before = s.draftPicksMade;
  S.draftToCurrentTurn(s, "c1");
  assert.equal(s.draftPicksMade, before, "refused");
  assert.ok(!S.draftFitsFor(s, "ann").includes("c1"));
  S.draftToCurrentTurn(s, "c6");
  assert.ok(team(s, "ann").includes("c6"));
  assert.equal(s.draftLog.find((e) => e.castawayId === "c0").price, 15);
  // Never blocking: with only expensive castaways left, anyone can be taken.
  const t = league(lineup({ each: 2, order: "snake", own: "exclusive", budget: { total: 10, ceiling: 9 } }), { n: 2, people: ["ann"] });
  results(t, 1, { c0: 1 });
  started(t);
  assert.deepEqual(S.draftFitsFor(t, "ann").sort(), ["c0", "c1"]);
  // A blind team (shared) costing more than the cap is refused with why; one within it locks in.
  const b = league(CAP(2, { total: 20, ceiling: 15 }), { n: 6 });
  results(b, 1, { c0: 2, c1: 1 });
  started(b);
  assert.match(S.BlindDraftLogic.validateSubmission(b, "ann", ["c0", "c1"]), /cost 27: the cap is 20/);
  assert.equal(S.BlindDraftLogic.validateSubmission(b, "ann", ["c0", "c2"]), null);
  // A draw within the cap: every team dealt fits (a hat each, shared).
  for (const seed of ["a", "b", "c", "d"]) {
    const d = league(lineup({ each: 2, order: "draw", own: "shared", budget: { total: 20, ceiling: 15 } }), { n: 6 });
    results(d, 1, { c0: 2, c1: 1 });
    const out = S.DrawLogic.outcome(d, seed);
    const p = S.PriceLogic.prices(d);
    Object.values(out.teams).forEach((ids) => assert.ok(S.BudgetLogic.cost(ids, p) <= 20, `${seed}: ${ids}`));
  }
  // Computer players draft within it (snake and blind).
  const bots = started(league(lineup({ each: 3, order: "snake", own: "exclusive", budget: { total: 20, ceiling: 15 } }), { n: 9, people: [], bots: ["b1", "b2"] }));
  results(bots, 1, { c0: 2, c1: 1, c2: 1 });
  Bots.run(bots);
  const bp = S.PriceLogic.prices(bots);
  ["b1", "b2"].forEach((pid) => assert.ok(team(bots, pid).length === 3 && S.BudgetLogic.cost(team(bots, pid), bp) <= 20, pid));
  const blind = started(league(CAP(2, { total: 20, ceiling: 15 }), { n: 6, people: [], bots: ["b1", "b2"] }));
  results(blind, 1, { c0: 2, c1: 1 });
  Bots.blindSubmissions(blind).forEach((x) => assert.equal(S.BlindDraftLogic.validateSubmission(blind, x.playerId, x.castawayIds), null));
});

test("a salary cap after the draft: a change within it, or no further over; a team over keeps its team; filled within it", () => {
  // Ann's team after the draft: c1 and c2, then c1 scores big and the prices move.
  const s = league(lineup({ each: 2, order: "snake", own: "exclusive", budget: { total: 16, ceiling: 15 } }, 1), { n: 6 });
  S.setOwner ? S.setOwner(s, "c1", "ann") : S.Core.setOwner(s, "c1", "ann");
  S.Core.setOwner(s, "c2", "ann");
  results(s, 1, { c1: 3, c3: 2, c4: 1 });
  const p = S.PriceLogic.prices(s);
  assert.deepEqual([p.get("c1"), p.get("c3"), p.get("c4"), p.get("c2")], [15, 12, 9, 4]);
  // Ann's team costs 19 now, over the cap of 16: she keeps it.
  assert.equal(S.BudgetLogic.cost(team(s, "ann"), p), 19);
  // A change that takes it further over is refused (c2 for c3: 27); one that brings it under is fine (c1 for c4: 13); one no
  // further over is fine (c2 for c5: 19 - 4 + 4).
  assert.match(S.BudgetLogic.moveProblem(s, "ann", "c2", "c3"), /C3 Person costs 12: your team would cost 27, and the cap is 16/);
  assert.equal(S.BudgetLogic.moveProblem(s, "ann", "c1", "c4"), null);
  assert.equal(S.BudgetLogic.moveProblem(s, "ann", "c2", "c5"), null);
  // Someone gone home counts nothing (zero): replacing them adds the new one's price.
  results(s, 2, {}, ["c1"]);
  const p2 = S.PriceLogic.prices(s);
  assert.equal(p2.get("c1"), 0);
  assert.equal(S.BudgetLogic.cost(team(s, "ann"), p2), p2.get("c2"));
  // Waivers' replacement filled for them (autoPick) keeps within the cap, else takes the cheapest.
  const pick = S.WaiverLogic.autoPick(s, { id: "w1" }, "ann", 0, "c1");
  assert.ok(pick && !S.BudgetLogic.moveProblem(s, "ann", "c1", pick, p2));
  // Without a cap, nothing is refused.
  const plain = league(lineup({ each: 2, order: "snake", own: "exclusive" }, 1));
  assert.equal(S.BudgetLogic.moveProblem(plain, "ann", "c0", "c1"), null);
  assert.equal(S.BudgetLogic.cap(plain), null);
});

test("the code review's cases: the default highest price, the places left, teams made another way, the cheapest replacement", () => {
  // The default highest price makes the middle price what an average team can afford: before anyone's scored, a team of the
  // cap's size fits (3 × 33 = 99 of 100), and so does a team of 4, 5, 6 or 7.
  for (const each of [3, 4, 5, 6, 7]) {
    const s = league(CAP(each, { total: 100 }), { n: 12 });
    const p = S.PriceLogic.prices(s);
    assert.ok(each * p.get("c0") <= 100, `${each}: ${p.get("c0")} each`);
  }
  assert.equal(G.ceilingFor(100, 3, 1), 65);
  // The places still to fill are priced from everyone who could fill them, not only the next pick's candidates (draftFits).
  const s = league(CAP(3, { total: 20, ceiling: 15 }), { n: 6 });
  results(s, 1, { c0: 2, c1: 1 });
  const p = S.PriceLogic.prices(s);
  assert.equal(S.BudgetLogic.least(s, [], "c0", ["c0"], p), p.get("c0"));
  assert.equal(S.BudgetLogic.least(s, [], "c0", ["c0", "c2", "c3", "c4"], p), p.get("c0") + p.get("c2") + p.get("c3"));
  assert.ok(!S.BudgetLogic.allowed(s, [], ["c0", "c2"], p, ["c0", "c2", "c3", "c4"]).includes("c0"), "c0 and two more is past 20");
  // An auction never settles over teams made another way.
  const made = started(league(AUCTION(2)));
  S.Core.setOwner(made, "c0", "ann");
  assert.ok(!S.AuctionLogic.ready(made) && !S.AuctionLogic.settle(made, {}, "x"));
  assert.match(S.AuctionLogic.validateBids(made, "bo", []), /teams are made already/);
  made.episodes[0].airsAt = new Date(Date.now() - 60_000).toISOString();
  assert.ok(!S.AuctionLogic.due(made, Date.now()));
  // A replacement for someone gone home is never refused when nobody cheaper is free: Ann's team is at the cap, c0 goes home.
  const r = league(lineup({ each: 2, order: "snake", own: "exclusive", budget: { total: 12, ceiling: 12 } }, 1), { n: 5 });
  S.Core.setOwner(r, "c0", "ann");
  S.Core.setOwner(r, "c1", "ann");
  results(r, 1, { c1: 2, c2: 1 }, ["c0"]);
  const rp = S.PriceLogic.prices(r);
  const free = ["c2", "c3", "c4"];
  const cheapest = free.reduce((a, b) => (rp.get(b) < rp.get(a) ? b : a));
  assert.ok(S.BudgetLogic.cost(["c1", cheapest], rp) > 12, "even the cheapest takes her past the cap");
  assert.equal(S.BudgetLogic.moveProblem(r, "ann", "c0", cheapest, rp), null);
  assert.match(S.BudgetLogic.moveProblem(r, "ann", "c0", "c2", rp), /the cap is 12/);
  // The words with a budget that isn't one: the validator says so, the words don't throw.
  const bad = outlast({ each: 2, order: "auction", budget: null });
  assert.deepEqual(ats(G.specProblems(bad)), ["get.budget"]);
  assert.doesNotThrow(() => G.describeSpec(bad));
  // A sheet from an order: the budget over the first team's worth by rank, the rest at the lowest price, each within reach.
  const a = started(league(AUCTION(3, { total: 20 }), { n: 10 }));
  const sheet = S.AuctionLogic.sheetFor(a, ["c0", "c1", "c2", "c3", "c4"]);
  assert.deepEqual(sheet.map((x) => x.bid), [9, 6, 3, 1, 1]);
  assert.equal(S.AuctionLogic.validateBids(a, "ann", sheet), null);
});

test("computer players bid in an auction, within what they can pay; a plain draft as before", () => {
  const s = started(league(AUCTION(3, { total: 20 }), { n: 12, people: ["ann"], bots: ["b1", "b2"] }));
  const sheets = Bots.auctionBids(s);
  assert.equal(sheets.length, 2);
  sheets.forEach((x) => {
    assert.equal(S.AuctionLogic.validateBids(s, x.playerId, x.bids), null);
    assert.ok(x.bids.slice(0, 3).reduce((n, b) => n + b.bid, 0) <= 20);
  });
  // A bot that locked in bids no more.
  S.AuctionLogic.setLockedPlayerIds(s, ["b1"]);
  assert.deepEqual(Bots.auctionBids(s).map((x) => x.playerId), ["b2"]);
  // Not an auction: none.
  assert.deepEqual(Bots.auctionBids(started(league(outlast({ each: 2 }), { bots: ["b1"] }))), []);
  // A plain snake draft reads as before: no prices, no cap, every free agent fits.
  const plain = started(league(outlast({ each: 2 })));
  assert.equal(S.PriceLogic.config(plain), null);
  assert.deepEqual(S.draftFitsFor(plain, "ann"), S.freeAgents(plain).map((c) => c.id));
});
