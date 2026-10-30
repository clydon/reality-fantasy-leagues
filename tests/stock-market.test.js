// Buying and selling each week (docs/PLAN-start-a-game-gpt.md step A10 part 3c: the stretch row s22 "Stock market: buy and sell
// castaways each week", the dial row answer.trade). The spec's get.budget.trade, on part 3b's prices: everyone starts with the
// budget and buys a team at the draft (a salary cap's draft, or an auction's bids), then trades in the waiver weeks, selling at
// today's price and buying at theirs, each paying the trade's fee. Cash is a ledger from the logs (the draft's prices, each
// move's sale, purchase and fee), so undo and the spoiler views take it back with the move; nobody spends more than they have
// (a replacement nobody can afford isn't filled); someone gone home sells for nothing or their last price; worth (rank 'worth')
// is cash plus the team at today's prices. Its shape, defaults, words and settings; the ledger through every kind of draft; a
// waiver week of trades; worth; computer players. Run with `npm test`.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "src") } });
const S = require("../src/lib/game/state-logic.js");
const G = require("../src/lib/game/game-spec/index.js");
const Bots = require("../src/lib/game/bot-logic.js");
const { tableOf } = jiti("../src/lib/game/game-view.ts");

const ats = (problems) => problems.map((p) => p.at);
const CTX = { moments: [], results: true, winner: true, roles: [], grouped: true, jury: true, phases: [{ id: "premerge" }, { id: "merged" }] };
const lineup = (get = {}, start = 1, extra = {}) => ({ preset: "weekly-lineup", get: { by: "draft", ...get }, count: { start }, ...extra });
/** A stock market: a Weekly Lineup of `each` under a budget that trades. */
const MARKET = (each = 2, budget = { total: 20, ceiling: 15, trade: {} }, get = { order: "snake", own: "exclusive" }, extra = {}) => lineup({ each, ...get, budget }, 1, extra);
const S22 = lineup({ each: 5, order: "blind", own: "shared", budget: { total: 100, trade: {} } }, 3, { rank: { by: "worth" } });

/** A league of `n` castaways (c0..), `people` its seats, the game `spec`. */
function league(spec, { n = 6, people = ["ann", "bo"], bots = [] } = {}) {
  assert.ok(G.settingsOf(spec), `plays: ${JSON.stringify(spec)}`);
  return S.migrateLeagueState({
    settings: { ...G.settingsOf(spec), showFormat: "survivor" },
    players: [...people, ...bots].map((id) => ({ id, name: id, color: "#000", active: true, ...(bots.includes(id) ? { automated: true } : {}) })),
    draftOrder: [...people, ...bots],
    tribes: [{ id: "t1", name: "Toka", color: "#000" }],
    castaways: Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `C${i} Person`, status: "active", tribeId: "t1", ownerIds: [], placementOrder: null, exitMethod: null, exitEpisodeId: null })),
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
  S.DraftLogic.forceStart(s);
  return s;
};
const pick = (s, ...ids) => ids.forEach((id) => S.draftToCurrentTurn(s, id));
const NOW = Date.parse("2026-10-20T12:00:00Z");
/** Ann and Bo's snake market: each drafts two at 8 (nobody's scored), 4 left each; after episode 1 c4 costs 15, c0 12, the rest 5. */
function snakeMarket(budget = { total: 20, ceiling: 15, trade: {} }) {
  const s = started(league(MARKET(2, budget)));
  pick(s, "c0", "c1", "c2", "c3");
  results(s, 1, { c4: 2, c0: 1 });
  return s;
}

test("a stock market: its shape, defaults, words and settings; what's refused", () => {
  const at = (spec, ctx = CTX, opts) => ats(G.specProblems(spec, ctx, opts));
  // s22 as the tracker says it: valid, played as Weekly Lineup's game, nothing to wait for.
  assert.deepEqual(at(S22), []);
  assert.deepEqual(G.specWaitsFor(S22), []);
  assert.equal(G.typeOf(S22), "active-roster");
  // The defaults (the user's to set): a trade costs nothing, the draft's money left over is cash, prices as a cap's; the market's
  // waivers a window after every episode with the whole team tradeable, someone gone home replaced whenever.
  const f = G.fullSpec(S22);
  assert.deepEqual(f.get.budget, { total: 100, trade: { fee: 0 }, left: "cash", floor: 1, gone: "zero", ceiling: 39 });
  assert.deepEqual(f.extras.waivers, { ...G.NO_WAIVERS, replace: "always", windows: { schedule: "everyEpisode", every: 3, swaps: 5 } });
  assert.deepEqual(G.budgetParts(f), { auction: false, total: 100, floor: 1, ceiling: 39, gone: "zero", trade: { fee: 0 }, left: "cash" });
  // A cap without trading says nothing new (no stored spec changes).
  assert.deepEqual(G.fullSpec(MARKET(3, { total: 30 })).get.budget, { total: 30, floor: 1, gone: "zero", ceiling: 19 });
  // An auction that trades has the data's prices after its bids: a ceiling and gone, its fallback still.
  const au = lineup({ each: 4, order: "auction", budget: { total: 100, trade: { fee: 2 }, left: "lost" } }, 2);
  assert.deepEqual(at(au), []);
  assert.deepEqual(G.budgetParts(G.fullSpec(au)), { auction: true, total: 100, floor: 1, fallback: "fill", ceiling: 49, gone: "zero", trade: { fee: 2 }, left: "lost" });
  // Its words: the sentence, How it works.
  const d = G.describeSpec(S22, { show: "Survivor 51" });
  assert.equal(d.sentence, "A Weekly Lineup for Survivor 51: everyone drafts 5 with 100 to spend, then buys and sells after every episode and starts 3 each episode, all season. Scored by Survivor 51's rules. Most worth wins: cash plus the team at today's prices.");
  for (const said of [/It's a stock market: everyone has 100 to buy a team/, /costs no more than 100 when you draft it/, /What you don't spend in the draft is cash to trade with/, /After every episode, until the next episode starts, sell one of yours at today's price and buy someone at theirs: as many as your team each time/, /Someone gone home sells for nothing/, /by more than one of you/, /Don't trade and you keep who you have/, /Most worth wins: your cash plus your team at today's prices/]) {
    assert.ok(d.rules.some((r) => said.test(r)), String(said));
  }
  assert.ok(!d.rules.some((r) => /waivers/i.test(r)), "a market's moves are its trades");
  const da = G.describeSpec(au, { show: "Survivor 51" });
  assert.match(da.sentence, /everyone has 100 to bid on a team of 4, then buys and sells after every episode/);
  assert.ok(da.rules.some((r) => /After the auction, each person is priced 1 to 49/.test(r)) && da.rules.some((r) => /is lost: after it, you trade with what you sell for/.test(r)) && da.rules.some((r) => /each trade costing 2/.test(r)) && da.rules.some((r) => /only someone nobody holds/.test(r)));
  const every2 = G.describeSpec({ ...S22, extras: { waivers: { ...G.NO_WAIVERS, replace: "never", windows: { schedule: "every", every: 2, swaps: 1 } } } }, { show: "Survivor 51" });
  assert.match(every2.sentence, /buys and sells every two episodes/);
  assert.ok(every2.rules.some((r) => /one trade each time/.test(r)) && every2.rules.some((r) => /Someone gone home is worth nothing/.test(r)));
  // The settings, both ways: the budget as the spec says it, ranked by worth, the market's waivers.
  const st = G.settingsOf(S22);
  assert.equal(st.draftRank, "worth");
  assert.deepEqual(st.draftBudget, f.get.budget);
  assert.deepEqual([st.replaceRule, st.waiverWindows], ["always", { schedule: "everyEpisode", every: 3, swaps: 5 }]);
  assert.deepEqual(G.specOf(G.withSpec(S.defaultState().settings, S22)), f);
  assert.equal(G.settingsOf(MARKET()).draftRank, undefined);
  // What's refused: worth without a market; money left over as cash without trading; a fee past the budget; trading on a game
  // scored by place; a market whose windows allow no trade; a key no market has.
  assert.deepEqual(at(lineup({ each: 2, order: "snake", own: "exclusive", budget: { total: 20 } }, 1, { rank: { by: "worth" } })), ["rank.by"]);
  assert.deepEqual(at(lineup({ each: 2, order: "snake", own: "exclusive" }, 1, { rank: { by: "worth" } })), ["rank.by"]);
  assert.deepEqual(at(MARKET(2, { total: 20, left: "cash" })), ["get.budget.left"]);
  assert.deepEqual(at(MARKET(2, { total: 20, left: "lost" })), [], "lost is what a budget's leftover always was");
  assert.deepEqual(at(MARKET(2, { total: 20, trade: { fee: 21 } })), ["get.budget.trade.fee"]);
  assert.deepEqual(at(MARKET(2, { total: 20, trade: true })), ["get.budget.trade"]);
  assert.deepEqual(at({ preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive", budget: { total: 20, trade: {} } } }), ["get.budget"]);
  assert.deepEqual(at({ ...S22, extras: { waivers: { ...G.NO_WAIVERS, replace: "always" } } }), ["extras.waivers.windows.swaps"]);
  assert.deepEqual(at(MARKET(2, { total: 20, trade: { fee: 0, limit: 2 } })), ["get.budget.trade.limit"]);
  assert.deepEqual(at(MARKET(2, { total: 20, left: "spend" })), ["get.budget.left"]);
  // Bidding on waivers with the money left over has no step yet.
  assert.deepEqual(G.specWaitsFor(MARKET(2, { total: 20, left: "bids" })).map((x) => [x.at, x.step]), [["get.budget.left", "later"]]);
  // Exclusive or shared, counted (the 9:10 PM decision): an exclusive market needs someone left over to buy.
  const excl = MARKET(5, { total: 100, trade: {} });
  assert.deepEqual(at(excl, { ...CTX, pool: 15, couch: 3 }), ["get.own"]);
  assert.match(G.specProblems(excl, { ...CTX, pool: 15, couch: 3 })[0].problem, /takes all 15 who can be drafted, so nobody's left to buy: make it shared/);
  assert.deepEqual(at(excl, { ...CTX, pool: 16, couch: 3 }), []);
  assert.deepEqual(at(excl, { ...CTX, pool: 15, couch: 3 }, { league: true }), [], "a league's own keeps the draft it made");
  assert.deepEqual(at(S22, { ...CTX, pool: 15, couch: 3 }), [], "shared: two can hold the same one");
  assert.deepEqual(at(excl, { ...CTX, pool: 12, couch: 3 }), ["get.own"], "the plain count first");
});

test("cash: the budget less what the draft cost, through every kind of draft; money left over lost", () => {
  // A snake under the cap: nobody's scored, so each costs the middle price (8); the draft's log records each.
  const s = started(league(MARKET()));
  pick(s, "c0", "c1", "c2", "c3");
  assert.deepEqual(s.draftLog.map((e) => e.price), [8, 8, 8, 8]);
  assert.deepEqual([S.MarketLogic.cash(s, "ann"), S.MarketLogic.cash(s, "bo")], [4, 4]);
  assert.equal(S.MarketLogic.draftPaid(s, "ann"), 16);
  // A pick taken back gives its price back.
  S.DraftLogic.undo(s, "c3");
  assert.equal(S.MarketLogic.cash(s, "ann"), 12);
  // Money left over lost: cash is only what trades bring in.
  const lost = started(league(MARKET(2, { total: 20, ceiling: 15, trade: {}, left: "lost" })));
  pick(lost, "c0", "c1", "c2", "c3");
  assert.equal(S.MarketLogic.cash(lost, "ann"), 0);
  // A blind draft (shared) records what each team cost at its reveal (it has no log).
  const b = started(league(MARKET(2, { total: 20, ceiling: 15, trade: {} }, { order: "blind", own: "shared" })));
  results(b, 1, { c0: 2, c1: 1 });
  S.BlindDraftLogic.reveal(b, { ann: ["c0", "c1"], bo: ["c0", "c2"] });
  const p = S.PriceLogic.prices(b);
  assert.deepEqual(b.blindDraft.paid, { ann: p.get("c0") + p.get("c1"), bo: p.get("c0") + p.get("c2") });
  assert.equal(S.MarketLogic.cash(b, "bo"), 20 - p.get("c0") - p.get("c2"));
  // A draw's log records each one's price under the cap.
  const d = started(league(MARKET(2, { total: 20, ceiling: 15, trade: {} }, { order: "draw", own: "shared" })));
  assert.ok(S.DrawLogic.drawn(d) && d.draftLog.every((e) => e.price === 8));
  assert.equal(S.MarketLogic.cash(d, "ann"), 4);
  // An auction that trades: what each spent is out of their cash, and after it prices come from the data.
  const a = started(league(lineup({ each: 2, order: "auction", budget: { total: 20, trade: {} } }, 1)));
  S.AuctionLogic.settle(a, { ann: [{ castawayId: "c0", bid: 12 }, { castawayId: "c1", bid: 3 }], bo: [{ castawayId: "c0", bid: 9 }] }, "seed");
  assert.equal(S.MarketLogic.cash(a, "ann"), 5);
  assert.equal(S.MarketLogic.cash(a, "bo"), 20 - a.auction.spent.bo);
  assert.equal(S.PriceLogic.prices(a).size, 6, "an auction that trades has the data's prices");
  assert.equal(S.BudgetLogic.cap(a), null, "the bids decide its draft, not a cap");
  // Without a market there's no cash.
  assert.equal(S.MarketLogic.cash(league(MARKET(2, { total: 20 })), "ann"), null);
});

test("trading in a waiver week: at today's prices, within cash; refused with why; the fee; the pass says cash", () => {
  const s = snakeMarket();
  const p = S.PriceLogic.prices(s);
  assert.deepEqual(["c4", "c0", "c1", "c3", "c5"].map((id) => p.get(id)), [15, 12, 5, 5, 5]);
  const W = S.WaiverLogic;
  const week = W.open(s, NOW);
  assert.ok(week.window && week.swaps === 2, "a window after every episode, the whole team");
  // Ann (4 cash) can't sell c3 (5) for c4 (15); she can sell c0 (12) for it.
  assert.match(W.checkClaim(s, week, "ann", { pairs: [{ addId: "c4", dropId: "c3" }] }).error, /C4 Person costs 15: you'd have 9 to spend/);
  assert.ok(W.checkClaim(s, week, "ann", { pairs: [{ addId: "c4", dropId: "c0" }] }).claim);
  // Bo's c4 for c1 is refused at the claim (9 to spend); a claim the run reads with it first passes it for want of cash and
  // takes his next for the same place, c5 for c1.
  assert.ok(W.checkClaim(s, week, "bo", { pairs: [{ addId: "c4", dropId: "c1" }] }).error);
  const run = W.process(s, { ann: { pairs: [{ addId: "c4", dropId: "c0" }] }, bo: { pairs: [{ addId: "c4", dropId: "c1" }, { addId: "c5", dropId: "c1" }] } }, { now: NOW + 1000 });
  const got = run.results.filter((x) => x.outcome === "got").map((x) => [x.playerId, x.castawayId, x.droppedCastawayId]);
  assert.deepEqual(got.sort(), [["ann", "c4", "c0"], ["bo", "c5", "c1"]]);
  const passed = run.results.flatMap((x) => x.passed);
  assert.ok(passed.some((x) => x.castawayId === "c4" && x.reason === "cash"), JSON.stringify(run.results));
  // Each move's log entry records what it sold for and paid; cash follows.
  const log = s.midSeason.log;
  assert.deepEqual(Object.fromEntries(log.map((x) => [x.playerId, [x.sold, x.paid, x.fee]])), { ann: [12, 15, undefined], bo: [5, 5, undefined] });
  assert.deepEqual([S.MarketLogic.cash(s, "ann"), S.MarketLogic.cash(s, "bo")], [1, 4]);
  assert.deepEqual(team(s, "ann"), ["c3", "c4"]);
  // Free agency the same way: Bo (4) can't buy c0 (12) for c2 (5); he can buy c1 back.
  assert.match(W.freeAgencyMove(s, "bo", "c0", "c2", NOW + 2000), /C0 Person costs 12: you'd have 9 to spend/);
  assert.equal(W.freeAgencyMove(s, "bo", "c1", "c2", NOW + 2000), null);
  assert.equal(S.MarketLogic.cash(s, "bo"), 4);
  // Undo last waiver run takes every move of the week back, and the cash with it.
  assert.equal(W.undo(s), null);
  assert.deepEqual([S.MarketLogic.cash(s, "ann"), S.MarketLogic.cash(s, "bo"), team(s, "ann").join()], [4, 4, "c0,c3"]);
  // A fee: each trade costs it (Ann's c4 for c0 leaves her 0).
  const f = snakeMarket({ total: 20, ceiling: 15, trade: { fee: 1 } });
  const fw = S.WaiverLogic.open(f, NOW);
  S.WaiverLogic.process(f, { ann: { pairs: [{ addId: "c4", dropId: "c0" }] } }, { now: NOW + 1000 });
  assert.equal(f.midSeason.log[0].fee, 1);
  assert.equal(S.MarketLogic.cash(f, "ann"), 0);
  assert.match(S.WaiverLogic.freeAgencyMove(f, "ann", "c0", "c3", NOW + 2000), /C0 Person costs 12, and a trade 1: you'd have 5 to spend/);
  assert.ok(fw);
  // Exclusive: only someone nobody holds; shared: anyone not yours.
  assert.match(S.WaiverLogic.freeAgencyMove(f, "bo", "c4", "c2", NOW + 2000), /not a free agent/);
});

test("someone gone home sells for nothing or their last price; a replacement nobody can afford isn't filled", () => {
  // Week 1: Ann sells c0 for c4 (1 left). Episode 2: c3 goes home.
  const run = (gone) => {
    const s = snakeMarket({ total: 20, ceiling: 15, trade: {}, gone });
    S.WaiverLogic.open(s, NOW);
    S.WaiverLogic.process(s, { ann: { pairs: [{ addId: "c4", dropId: "c0" }] } }, { now: NOW + 1000 });
    S.WaiverLogic.close(s, NOW + 2000);
    results(s, 2, {}, ["c3"]);
    return s;
  };
  const zero = run("zero");
  assert.equal(S.PriceLogic.prices(zero).get("c3"), 0);
  assert.equal(S.MarketLogic.worth(zero, "ann"), 1 + S.PriceLogic.prices(zero).get("c4"));
  let week = S.WaiverLogic.open(zero, NOW + 3000);
  const owed = S.WaiverLogic.replacementsOwed(zero, "ann", week);
  assert.deepEqual(owed.lossIds, ["c3"]);
  // Ann has 1 and c3 sells for nothing: nobody free is that cheap (c5 costs 5). Her replacement claim is refused, and at the
  // close nobody fills it: she holds who she has.
  assert.match(S.WaiverLogic.checkClaim(zero, week, "ann", { pairs: [{ addId: "c5", dropId: "c3" }] }).error, /C5 Person costs 5: you'd have 1 to spend/);
  assert.equal(S.WaiverLogic.autoPick(zero, week, "ann", 0, "c3"), null);
  S.WaiverLogic.process(zero, {}, { now: NOW + 4000 });
  S.WaiverLogic.close(zero, NOW + 5000);
  assert.deepEqual(team(zero, "ann"), ["c3", "c4"], "holds who she has");
  assert.equal(S.MarketLogic.cash(zero, "ann"), 1);
  // Gone 'last': c3 sells for what they cost going into the episode they went home in (5), so a replacement at 5 is filled.
  const last = run("last");
  assert.equal(S.PriceLogic.prices(last).get("c3"), 5);
  week = S.WaiverLogic.open(last, NOW + 3000);
  S.WaiverLogic.process(last, {}, { now: NOW + 4000 });
  S.WaiverLogic.close(last, NOW + 5000);
  const filled = last.midSeason.log.at(-1);
  assert.deepEqual([filled.via, filled.droppedCastawayId, filled.addedCastawayId, filled.sold, filled.paid], ["auto", "c3", "c5", 5, 5]);
  assert.equal(S.MarketLogic.cash(last, "ann"), 1);
});

test("the spoiler views take a week's trades back with its cash; worth ranks the table", () => {
  const s = snakeMarket();
  S.WaiverLogic.open(s, NOW);
  S.WaiverLogic.process(s, { ann: { pairs: [{ addId: "c4", dropId: "c0" }] } }, { now: NOW + 1000 });
  S.WaiverLogic.close(s, NOW + 2000);
  // Episode 2: c3 (Ann's) wins three: c3 15, c4 12, c0 9. Ann sells c3 high for c0: 1 + 15 - 9.
  results(s, 2, { c3: 3 });
  S.WaiverLogic.open(s, NOW + 3000);
  S.WaiverLogic.process(s, { ann: { pairs: [{ addId: "c0", dropId: "c3" }] } }, { now: NOW + 4000 });
  assert.equal(S.MarketLogic.cash(s, "ann"), 7);
  // A copy as of episode 1 (someone who hasn't seen episode 2): that trade is taken back, and her cash with it; week 1's stays.
  const copy = JSON.parse(JSON.stringify(s));
  S.WaiverLogic.redact(copy, 1);
  assert.equal(S.MarketLogic.cash(copy, "ann"), 1);
  assert.deepEqual(team(copy, "ann"), ["c3", "c4"]);
  assert.equal(S.MarketLogic.cash(copy, "bo"), 4);
  // The view: prices, cash and worth for everyone.
  const v = S.MarketLogic.view(s);
  assert.deepEqual(Object.keys(v.cash).sort(), ["ann", "bo"]);
  assert.equal(v.worth.ann, S.MarketLogic.worth(s, "ann"));
  // Ranked by worth: each row carries cash and worth, the table goes by worth (ties to the points), its number the worth.
  const w = snakeMarket();
  w.settings = G.withSpec(w.settings, { ...G.specOf(w.settings), rank: { by: "worth" } });
  S.WaiverLogic.open(w, NOW);
  S.WaiverLogic.process(w, { ann: { pairs: [{ addId: "c4", dropId: "c0" }] } }, { now: NOW + 1000 });
  const rows = S.ScoringLogic.compute(w);
  assert.deepEqual(rows.map((r) => [r.playerId, r.cash, r.worth]), [["ann", 1, 1 + 15 + 5], ["bo", 4, 4 + 5 + 5]]);
  const table = tableOf(w, "ann", () => null);
  assert.deepEqual(table.map((r) => [r.playerId, r.total, r.place]), [["ann", 21, 1], ["bo", 14, 2]]);
  // Ranked by the points (the default): worth is beside each row, not what ranks it.
  const t = snakeMarket();
  assert.ok(S.ScoringLogic.compute(t).every((r) => typeof r.worth === "number"));
  assert.equal(G.gameOf(t.settings).rank.by, "total");
});

test("computer players trade within their cash; the waivers' recommendation keeps a market trading", () => {
  const s = started(league(MARKET(2, { total: 20, ceiling: 15, trade: {} }), { n: 8, people: [], bots: ["b1", "b2"] }));
  Bots.run(s);
  assert.ok(team(s, "b1").length === 2 && team(s, "b2").length === 2);
  results(s, 1, { c6: 3, c7: 2 });
  S.ensureNextEpisode(s);
  const week = S.WaiverLogic.open(s, NOW);
  for (const pid of ["b1", "b2"]) {
    S.getPlayer(s, pid).botLevel = "sharp";
    const claim = Bots.waiverClaim(s, pid, week);
    assert.ok(claim.pairs.every((x) => !S.MarketLogic.moveProblem(s, pid, x.dropId, x.addId)), `${pid}: ${JSON.stringify(claim.pairs)}`);
    assert.ok(S.WaiverLogic.checkClaim(s, week, pid, claim).claim, pid);
  }
  // Picking a feel for a market's waivers keeps its trading: a window after every episode, the whole team.
  const m = league(MARKET());
  assert.ok(S.WaiverLogic.applyRecommendation(m, "casual"));
  assert.deepEqual([S.WaiverLogic.replaceRule(m), S.WaiverLogic.windows(m)], ["always", { schedule: "everyEpisode", every: 3, swaps: 2 }]);
  assert.deepEqual(G.specProblems(G.specOf(m.settings)), []);
});

test("the code review's cases: one rank key, the waiver order by worth, a market over its budget, free agency read once", () => {
  // One rank key for every table: worth first in a market ranked by it, then the points; the points anywhere else.
  const w = snakeMarket();
  w.settings = G.withSpec(w.settings, { ...G.specOf(w.settings), rank: { by: "worth" } });
  assert.deepEqual(S.rankKey(w, { total: 3, worth: 21 }), [21, 3]);
  assert.deepEqual(S.rankKey(snakeMarket(), { total: 3, worth: 21 }), [3]);
  // The waivers' order by standings (least points first) reads worth in a market ranked by it.
  w.settings = G.withSpec(w.settings, { ...G.specOf(w.settings), extras: { ...G.specOf(w.settings).extras, waivers: { ...G.specOf(w.settings).extras.waivers, order: "leastPoints" } } });
  S.WaiverLogic.open(w, NOW);
  S.WaiverLogic.process(w, { ann: { pairs: [{ addId: "c4", dropId: "c0" }] } }, { now: NOW + 1000 });
  // Ann's trade leaves her worth 21 (1, c4 15, c3 5), Bo 14: the one with less worth claims first.
  const worthOf = (pid) => S.ScoringLogic.compute(w).find((r) => r.playerId === pid).worth;
  assert.deepEqual([worthOf("ann"), worthOf("bo")], [21, 14]);
  assert.deepEqual(S.MidSeasonLogic.order(w, ["ann", "bo"]), ["bo", "ann"]);
  // A market whose prices before anyone's scored would put every team over its budget is refused, saying what fits.
  const over = MARKET(2, { total: 20, ceiling: 20, trade: {} });
  assert.deepEqual(ats(G.specProblems(over, CTX)), ["get.budget.ceiling"]);
  assert.match(G.specProblems(over, CTX)[0].problem, /everyone costs 11, so a team of 2 would cost 22, more than the 20 everyone has: a highest price of at most 19 fits/);
  assert.deepEqual(ats(G.specProblems(MARKET(2, { total: 20, ceiling: 20 }), CTX)), [], "a cap that doesn't trade: as part 3b built it");
  assert.deepEqual(ats(G.specProblems(MARKET(2, { total: 20, ceiling: 19, trade: {} }), CTX)), []);
  // Free agency records what it sold and paid (read once), as a run does.
  const f = snakeMarket();
  S.WaiverLogic.open(f, NOW);
  S.WaiverLogic.process(f, {}, { now: NOW + 1000 });
  assert.equal(S.WaiverLogic.freeAgencyMove(f, "bo", "c5", "c1", NOW + 2000), null);
  assert.deepEqual([f.midSeason.log[0].sold, f.midSeason.log[0].paid, f.midSeason.log[0].via], [5, 5, "freeAgency"]);
  // Everyone's cash in one pass is each one's.
  const all = S.MarketLogic.cashAll(f);
  assert.deepEqual([all.get("ann"), all.get("bo")], [S.MarketLogic.cash(f, "ann"), S.MarketLogic.cash(f, "bo")]);
});

test("computer players in a market buy whom they rate higher that a sale pays for (part 3c, after the blind replays)", () => {
  const s = started(league(MARKET(2, { total: 20, ceiling: 15, trade: {} }), { n: 8, people: ["ann"], bots: ["b1"] }));
  s.draftOrder = ["b1", "ann"];
  S.getPlayer(s, "b1").botLevel = "sharp";
  pick(s, "c0", "c1", "c2", "c3"); // b1 c0, ann c1, ann c2, b1 c3
  // b1's c0 had a big first week and nothing since (dear, out of form); c6, free, the best all along (dearest); c5, free, in
  // form now and cheaper.
  results(s, 1, { c0: 4, c6: 3 });
  results(s, 2, { c6: 2, c3: 1 });
  results(s, 3, { c6: 2, c5: 2 });
  S.ensureNextEpisode(s);
  const week = S.WaiverLogic.open(s, NOW);
  const claim = Bots.waiverClaim(s, "b1", week);
  assert.ok(claim.pairs.length, "it trades");
  assert.ok(claim.pairs.some((x) => x.dropId === "c0"), "it sells the one whose price ran ahead of its form");
  assert.ok(claim.pairs.every((x) => !S.MarketLogic.moveProblem(s, "b1", x.dropId, x.addId)), JSON.stringify(claim.pairs));
  assert.ok(S.WaiverLogic.checkClaim(s, week, "b1", claim).claim);
});
