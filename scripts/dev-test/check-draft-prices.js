// Dev-only check of a draft's prices (docs/PLAN-start-a-game-gpt.md step A10 part 3b: game-spec schema.js get.budget and
// get.order 'auction', settings.js draftAuction and draftBudget, state-logic.js PriceLogic, BudgetLogic, AuctionLogic and
// AuctionDraftStrategy, src/lib/server/auction.ts, draft.ts's lockBidsFor / unlockBidsFor / readOwnBids, the route
// /api/leagues/[id]/draft/bids, the pick and blind routes' refusals, db.ts and league-read.ts settling an auction whose bidding
// has closed) against the dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (alex,
// riley, jordan, sam on ZT Survivor 51: results through Episode 5, one going home each; Episode 6 three days off), and its ZT
// Extra (alex and casey). Each game has its draft taken back and is made one of part 3b's, through RosterLogic.setGame:
//   - Couch Cup, an Outlast auction of two each (100 each) from Episode 6: started by alex; a bid past what anyone can pay
//     refused (400, with why); riley and jordan bid the same on one castaway; riley's second lock refused, withdrawn and locked
//     again; riley reads her own bids back; the state says who's locked in and never what anyone bid; alex locks in an empty
//     sheet for sam (filled at the lowest price), then his own, which settles it: the tie by the recorded seed (the same bids
//     and seed settle the same way), sam filled at 1 each, every team two, what each spent; the sheets gone; the draft room
//     reads it as an auction, done.
//   - Pool Party, an Outlast auction of one each from Episode 1 (aired): started by alex with no bids in, the bidding closed at
//     once; jordan's read of the league settles it (readyLeague), everyone filled at the lowest price.
//   - Lineup League, a blind Weekly Lineup of three under a salary cap (prices from five episodes' results): the three
//     dearest refused (400, with the cost), a cheap team locked in.
//   - ZT Extra, a snake Weekly Lineup of two under a salary cap of 40 (its results given two immunity wins, so its prices
//     differ): alex takes a cheap one, casey the dearest; her second, the next dearest, would take her past the cap: refused
//     (400, with what it would cost); a cheap one taken, its price in the draft's log.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-draft-prices.js [--keep]
//
// One fixed scenario on purpose (the four drafts above), run again whenever a draft's prices change. Brings new-fixture.js up
// and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares new-fixture's zt_nd_ couch
// with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-draft-prices runs against a local database only");
const keep = process.argv.includes("--keep");
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

/** The league's draft taken back: nobody owns anyone, no picks, not started, no draw or auction; the order its players. */
function undraft(st) {
  for (const c of st.castaways) Object.assign(c, { ownerIds: [], acquiredVia: null, formerOwnerId: null, departedVia: null, replenishClaimed: false });
  Object.assign(st, { draftPicksMade: 0, draftLog: [], draftForceStarted: false, draftOrder: st.players.filter((p) => !p.disabled && !p.ghost).map((p) => p.id) });
  delete st.draftStartedAt;
  delete st.draftTurnAt;
  delete st.draw;
  delete st.auction;
  st.blindDraft = { lockedPlayerIds: [], revealedAt: null };
  if (st.midSeason) st.midSeason.log = [];
  for (const e of st.episodes) e.lineups = {};
}
const teamOf = (st, pid) => st.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id);
const errorOf = (r) => (r.body && (r.body.error || r.body.message)) || JSON.stringify(r.body);

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const league = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const write = (id, state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), id]);
    const sheets = async (id) => (await pool.query("SELECT count(*)::int AS n FROM blind_draft_picks WHERE league_id = $1", [id])).rows[0].n;
    const pidsOf = async (id) => {
      const out = {};
      for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [id])).rows) {
        const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
        if (who) out[who] = player_id;
      }
      return out;
    };
    /** The league made `spec`, its draft taken back (setGame, as a league's own; the game-specs flag's copy carried when it's on). */
    const remake = async (id, spec, extra = () => {}) => {
      const st = await league(id);
      undraft(st);
      const problems = S.setGame(st, spec);
      extra(st);
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      await write(id, st);
      return problems;
    };

    // ---------- Couch Cup: an Outlast auction of two each, from Episode 6 ----------
    const O = fx.leagues.outlast;
    const pO = await pidsOf(O);
    let problems = await remake(O, { preset: "outlast", span: { from: 6, to: null }, get: { by: "draft", each: 2, order: "auction", budget: { total: 100 } } });
    let st = await league(O);
    check(!problems.length && S.piecesOf(st).draft === S.AuctionDraftStrategy && st.settings.draftAuction === true, "Couch Cup made an Outlast auction of two each, 100 each, from Episode 6", JSON.stringify(problems));
    let r = await as.alex.call("POST", `/api/leagues/${O}/draft/force-start`, {});
    st = await league(O);
    check(r.status === 200 && S.isDraftStarted(st) && !S.AuctionLogic.settled(st) && !S.AuctionLogic.due(st, Date.now()), "  alex opens the bidding: open, not due (Episode 6 hasn't started)", `${r.status}`);
    const free = S.freeAgents(st).map((c) => c.id);
    const [c1, c2, c3] = free;
    r = await as.riley.call("POST", `/api/leagues/${O}/draft/bids`, { bids: [{ castawayId: c1, bid: 100 }] });
    check(r.status === 400 && /from 1 to 99/.test(errorOf(r)), "  a bid past what anyone can pay is refused (400), saying why", `${r.status} ${errorOf(r)}`);
    const rileyBids = [{ castawayId: c1, bid: 40 }, { castawayId: c2, bid: 20 }];
    const jordanBids = [{ castawayId: c1, bid: 40 }, { castawayId: c3, bid: 30 }];
    r = await as.riley.call("POST", `/api/leagues/${O}/draft/bids`, { bids: rileyBids });
    check(r.status === 200, "  riley locks in her bids", `${r.status} ${errorOf(r)}`);
    r = await as.riley.call("POST", `/api/leagues/${O}/draft/bids`, { bids: rileyBids });
    check(r.status === 400 && /withdraw first/.test(errorOf(r)), "  a second lock is refused until she withdraws", `${r.status} ${errorOf(r)}`);
    r = await as.riley.call("DELETE", `/api/leagues/${O}/draft/bids`, {});
    st = await league(O);
    check(r.status === 200 && !S.AuctionLogic.hasLocked(st, pO.riley), "  she withdraws", `${r.status}`);
    r = await as.riley.call("POST", `/api/leagues/${O}/draft/bids`, { bids: rileyBids });
    const back = await as.riley.call("GET", `/api/leagues/${O}/draft/bids`);
    check(r.status === 200 && back.status === 200 && G.sameValue(back.body.bids, rileyBids), "  and locks them in again; she reads her own back", JSON.stringify(back.body));
    r = await as.jordan.call("POST", `/api/leagues/${O}/draft/bids`, { bids: jordanBids });
    const jBack = await as.jordan.call("GET", `/api/leagues/${O}/draft/bids`);
    check(r.status === 200 && G.sameValue(jBack.body.bids, jordanBids), "  jordan bids the same on one of hers: his own, read back, are his", JSON.stringify(jBack.body));
    r = await as.riley.call("POST", `/api/leagues/${O}/draft/bids`, { playerId: pO.sam, bids: [] });
    check(r.status === 403, "  riley can't lock in for sam (she doesn't run the game)", `${r.status}`);
    r = await as.alex.call("POST", `/api/leagues/${O}/draft/bids`, { playerId: pO.sam, bids: [] });
    st = await league(O);
    const stateText = JSON.stringify(st);
    check(r.status === 200 && G.sameValue([...S.AuctionLogic.lockedPlayerIds(st)].sort(), [pO.riley, pO.jordan, pO.sam].sort()) && !/"bid":/.test(stateText), "  alex locks in an empty sheet for sam: the state says who's in, never what anyone bid", JSON.stringify(st.auction));
    // The sheets share blind_draft_picks with a blind draft's picks: a blind draft's withdrawal on an auction is refused.
    r = await as.riley.call("DELETE", `/api/leagues/${O}/draft/blind/lock/${pO.riley}`, {});
    check(r.status === 400 && (await sheets(O)) === 3, "  a blind draft's withdrawal on the auction is refused (400): riley's sheet stays", `${r.status} ${errorOf(r)}`);
    const before = JSON.parse(JSON.stringify(await league(O)));
    r = await as.alex.call("POST", `/api/leagues/${O}/draft/bids`, { bids: [{ castawayId: c3, bid: 10 }] });
    st = await league(O);
    const teams = Object.fromEntries(Object.entries(pO).map(([w, p]) => [w, teamOf(st, p)]));
    check(r.status === 200 && S.AuctionLogic.settled(st) && Object.values(teams).every((t) => t.length === 2) && new Set(Object.values(teams).flat()).size === 8, "  alex's own sheet settles it: every team two, nobody sharing", JSON.stringify([r.status, teams]));
    const c1Winner = Object.keys(pO).find((w) => teams[w].includes(c1));
    check(["riley", "jordan"].includes(c1Winner) && st.draftLog.find((e) => e.castawayId === c1).price === 40, `  the tie on one castaway (40 each) went to ${c1Winner}, at 40`, JSON.stringify(st.draftLog.find((e) => e.castawayId === c1)));
    const again = S.AuctionLogic.outcome(before, { [pO.riley]: rileyBids, [pO.jordan]: jordanBids, [pO.sam]: [], [pO.alex]: [{ castawayId: c3, bid: 10 }] }, st.auction.seed);
    check(G.sameValue(again.won.map((x) => [x.playerId, x.castawayId, x.price]), st.draftLog.map((e) => [e.playerId, e.castawayId, e.price])), "  recorded: the same bids and seed settle the same way", JSON.stringify({ seed: st.auction.seed }));
    check(teams.jordan.includes(c3) && st.draftLog.filter((e) => e.playerId === pO.sam).every((e) => e.filled && e.price === 1), "  jordan's 30 beat alex's 10; sam's team filled at 1 each", JSON.stringify(st.draftLog));
    check(st.auction.spent[pO.sam] === 2 && st.auction.spent[pO.riley] + st.auction.spent[pO.jordan] >= 70 && (await sheets(O)) === 0, "  what each spent recorded, the sheets gone", JSON.stringify(st.auction.spent));
    const room = (await as.jordan.call("GET", `/api/seasons/${sid}/draft`)).body;
    const roomGame = (room?.games ?? []).find((x) => x.leagueId === O);
    check(roomGame?.kind === "auction" && roomGame.phase === "done" && roomGame.teams.length === 4, "  the draft room reads it as an auction, done, the teams", JSON.stringify(roomGame && { kind: roomGame.kind, phase: roomGame.phase }).slice(0, 200));

    // ---------- Pool Party: an auction from Episode 1 (aired): the bidding closes at once ----------
    const P = fx.leagues.pool;
    const pP = await pidsOf(P);
    problems = await remake(P, { preset: "outlast", get: { by: "draft", each: 1, order: "auction" } });
    r = await as.alex.call("POST", `/api/leagues/${P}/draft/force-start`, {});
    st = await league(P);
    check(!problems.length && r.status === 200 && S.AuctionLogic.due(st, Date.now()) && !S.AuctionLogic.settled(st), "Pool Party made an auction of one each from Episode 1, which has aired: started with no bids in, it's due", JSON.stringify([problems, r.status]));
    r = await as.jordan.call("GET", `/api/leagues/${P}/state`);
    st = await league(P);
    check(r.status === 200 && S.AuctionLogic.settled(st) && Object.values(pP).every((p) => teamOf(st, p).length === 1) && st.draftLog.every((e) => e.filled && e.price === 1), "  jordan's read of the league settles it: everyone filled at the lowest price", JSON.stringify(st.draftLog));

    // ---------- Lineup League: a blind Weekly Lineup of three under a salary cap ----------
    const L = fx.leagues.lineup;
    const pL = await pidsOf(L);
    problems = await remake(L, { preset: "weekly-lineup", get: { by: "draft", each: 3, order: "blind", own: "shared", budget: { total: 45, ceiling: 25 } }, count: { start: 2 } });
    r = await as.alex.call("POST", `/api/leagues/${L}/draft/force-start`, {});
    st = await league(L);
    const prices = S.PriceLogic.prices(st);
    const still = st.castaways.filter((c) => c.status === "active").map((c) => c.id).sort((a, b) => prices.get(b) - prices.get(a));
    const dear = still.slice(0, 3);
    const cheap = still.slice(-3);
    const dearCost = S.BudgetLogic.cost(dear, prices);
    check(!problems.length && r.status === 200 && dearCost > 45 && S.BudgetLogic.cost(cheap, prices) <= 45, `Lineup League made a blind Weekly Lineup of three under a cap of 45: prices from the results, the three dearest ${dearCost}`, JSON.stringify([problems, r.status, [...prices.values()]]));
    r = await as.riley.call("POST", `/api/leagues/${L}/draft/blind/lock`, { playerId: pL.riley, castawayIds: dear });
    check(r.status === 400 && new RegExp(`Your team would cost ${dearCost}: the cap is 45`).test(errorOf(r)), "  riley's three dearest are refused (400), saying what they cost", `${r.status} ${errorOf(r)}`);
    r = await as.riley.call("POST", `/api/leagues/${L}/draft/blind/lock`, { playerId: pL.riley, castawayIds: cheap });
    check(r.status === 200, "  a team within the cap locks in", `${r.status} ${errorOf(r)}`);
    r = await as.riley.call("DELETE", `/api/leagues/${L}/draft/bids`, {});
    st = await league(L);
    check(r.status === 400 && S.BlindDraftLogic.hasLocked(st, pL.riley) && (await sheets(L)) === 1, "  an auction's withdrawal on the blind draft is refused (400): her picks stay", `${r.status} ${errorOf(r)}`);

    // ---------- ZT Extra: a snake Weekly Lineup of two under a salary cap ----------
    const X = fx.leagues.extra;
    const pX = await pidsOf(X);
    // Its results have no moments: two immunity wins in Episode 5 (to the first two still in), so the prices differ.
    const wins = (st) => {
      const [a, b] = st.castaways.filter((c) => c.status === "active").map((c) => c.id);
      const ep5 = st.episodes.find((e) => e.number === 5);
      ep5.scoringEvents = [...(ep5.scoringEvents || []), { id: "zt-win-1", type: "individualImmunity", castawayId: a }, { id: "zt-win-2", type: "individualImmunity", castawayId: a }, { id: "zt-win-3", type: "individualImmunity", castawayId: b }];
      st.draftOrder = [pX.alex, pX.casey];
    };
    problems = await remake(X, { preset: "weekly-lineup", get: { by: "draft", each: 2, order: "snake", own: "exclusive", budget: { total: 40, ceiling: 25 } }, count: { start: 1 } }, wins);
    st = await league(X);
    const xp = S.PriceLogic.prices(st);
    const ranked = st.castaways.filter((c) => c.status === "active").map((c) => c.id).sort((a, b) => xp.get(b) - xp.get(a));
    const [dearest, next] = ranked;
    const cheap1 = ranked[ranked.length - 1];
    const cheap2 = ranked[ranked.length - 2];
    r = await as.alex.call("POST", `/api/leagues/${X}/draft/force-start`, {});
    r = await as.alex.call("POST", `/api/leagues/${X}/draft/pick`, { castawayId: cheap1 });
    const r2 = await as.casey.call("POST", `/api/leagues/${X}/draft/pick`, { castawayId: dearest });
    check(!problems.length && r.status === 200 && r2.status === 200 && xp.get(dearest) > xp.get(next) && xp.get(next) > xp.get(cheap1), `ZT Extra made a snake Weekly Lineup of two under a cap of 40 (prices ${xp.get(dearest)}, ${xp.get(next)}, the rest ${xp.get(cheap1)}): alex takes a cheap one, casey the dearest`, `${r.status} ${r2.status} ${errorOf(r2)}`);
    const over = xp.get(dearest) + xp.get(next);
    r = await as.casey.call("POST", `/api/leagues/${X}/draft/pick`, { castawayId: next });
    check(r.status === 400 && new RegExp(`Your team would cost ${over}: the cap is 40`).test(errorOf(r)), `  casey's second, the next dearest, would cost ${over}: refused (400), saying so`, `${r.status} ${errorOf(r).slice(0, 200)}`);
    r = await as.casey.call("POST", `/api/leagues/${X}/draft/pick`, { castawayId: cheap2 });
    st = await league(X);
    check(r.status === 200 && teamOf(st, pX.casey).length === 2 && st.draftLog.at(-1).price === xp.get(cheap2), "  a cheap one is taken, its price in the draft's log", `${r.status} ${errorOf(r).slice(0, 200)}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  the check threw: ${e.stack || e}`);
  } finally {
    if (!keep) await fixture.down(pool);
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
