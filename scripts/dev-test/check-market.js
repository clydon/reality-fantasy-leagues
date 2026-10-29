// Dev-only check of buying and selling each week, a stock market (docs/PLAN-start-a-game-gpt.md step A10 part 3c: game-spec
// schema.js get.budget.trade and .left, rank.by 'worth', marketWaivers; settings.js draftRank; state-logic.js MarketLogic, the cash
// ledger read from the draft's log, a blind draft's reveal and the moves' log, BudgetLogic.moveProblem's market branch,
// WaiverLogic's runs, free agency and autofill reading cash, the scores' worth; game-view.ts tableOf ranking by worth) against the
// dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT
// Survivor 51: results through Episode 5, one going home each; Episode 6 three days off; sam revealed through 3), and its ZT
// Extra (alex and casey). Each game has its draft and waivers taken back and is made a market through RosterLogic.setGame:
//   - Lineup League, a shared market of two each (30 each, prices 1 to 20 from five episodes' results, a trade costing 1), ranked
//     by worth: its waivers a window after every episode, both tradeable; everyone's blind team locked in (riley's costing nearly
//     all of hers), the reveal recording what each paid, cash the rest; a waiver week open after Episode 5; riley's claim to buy
//     the dearest refused (400, saying what she'd have), a cheap one claimed; alex's Process now runs it (its log entry recording
//     what it sold for, paid and the fee; her cash follows); free agency: riley refused the dearest (400, saying so), jordan
//     buying it; the couch hub ranking the game by worth (the two who traded paid a fee each: alex first, riley behind); sam's
//     copy (seen through 3) without the week's trades, riley's cash as after the draft; alex's Undo last waiver run taking the
//     week's trades back, and the cash with them.
//   - ZT Extra, an exclusive snake market of two (40 each, its results given immunity wins so the prices differ): the draft's
//     log recording each pick's price, cash the rest; after Process now, casey can't buy one of alex's (409: not a free agent),
//     and can buy one nobody holds.
//   - Pool Party, a Weekly Lineup auction that trades from Episode 1 (aired): its bidding closed at once, jordan's read settles it,
//     everyone filled at the lowest price, their cash the rest (20 less 2), and the data's prices after it.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-market.js [--keep]
//
// One fixed scenario on purpose (the three games above), run again whenever the market changes. Brings new-fixture.js up and
// takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares new-fixture's zt_nd_ couch with
// other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-market runs against a local database only");
const keep = process.argv.includes("--keep");
const PASSWORD = fixture.PASSWORD;

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

/** The league's draft and waivers taken back: nobody owns anyone, no picks, not started, no draw or auction, no waiver weeks. */
function undraft(st) {
  for (const c of st.castaways) Object.assign(c, { ownerIds: [], acquiredVia: null, formerOwnerId: null, departedVia: null, replenishClaimed: false });
  Object.assign(st, { draftPicksMade: 0, draftLog: [], draftForceStarted: false, draftOrder: st.players.filter((p) => !p.disabled && !p.ghost).map((p) => p.id) });
  delete st.draftStartedAt;
  delete st.draftTurnAt;
  delete st.draw;
  delete st.auction;
  st.blindDraft = { lockedPlayerIds: [], revealedAt: null };
  st.midSeason = { ...(st.midSeason || {}), log: [], priority: [], waivers: { periods: [] } };
  for (const e of st.episodes) e.lineups = {};
}
const teamOf = (st, pid) => st.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id);
const errorOf = (r) => (r.body && (r.body.error || r.body.message)) || JSON.stringify(r.body);
const week = (st) => S.WaiverLogic.current(st);

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "casey"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const league = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const write = (id, state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), id]);
    const pidsOf = async (id) => {
      const out = {};
      for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [id])).rows) {
        const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
        if (who) out[who] = player_id;
      }
      return out;
    };
    /** The league made `spec`, its draft and waivers taken back (setGame, as a league's own; the game-specs flag's copy carried). */
    const remake = async (id, spec, extra = () => {}) => {
      const st = await league(id);
      undraft(st);
      const problems = S.setGame(st, spec);
      extra(st);
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      await write(id, st);
      await pool.query("DELETE FROM waiver_claims WHERE league_id = $1", [id]);
      await pool.query("DELETE FROM blind_draft_picks WHERE league_id = $1", [id]);
      return problems;
    };

    // ---------- Lineup League: a shared market of two each, ranked by worth, a trade costing 1 ----------
    const L = fx.leagues.lineup;
    const pL = await pidsOf(L);
    const spec = { preset: "weekly-lineup", get: { by: "draft", each: 2, order: "blind", own: "shared", budget: { total: 30, ceiling: 20, trade: { fee: 1 } } }, count: { start: 1 }, rank: { by: "worth" } };
    let problems = await remake(L, spec);
    let st = await league(L);
    check(!problems.length && st.settings.draftRank === "worth" && S.MarketLogic.on(st) && G.sameValue(S.WaiverLogic.windows(st), { schedule: "everyEpisode", every: 3, swaps: 2 }) && S.WaiverLogic.replaceRule(st) === "always",
      "Lineup League made a shared market of two (30 each, a trade 1), ranked by worth: a window after every episode, both tradeable", JSON.stringify([problems, st.settings.draftRank, S.WaiverLogic.windows(st)]));
    let r = await as.alex.call("POST", `/api/leagues/${L}/draft/force-start`, {});
    st = await league(L);
    const p = S.PriceLogic.prices(st);
    const still = st.castaways.filter((c) => c.status === "active").map((c) => c.id).sort((a, b) => p.get(b) - p.get(a) || (a < b ? -1 : 1));
    const [dearest, second] = still;
    const cheap = still.slice(-4);
    // Riley's team: the second dearest and the dearest of the rest that fits beside it, so she has little cash left.
    const rileyMate = still.slice(2).find((id) => p.get(second) + p.get(id) <= 30);
    const teams = { alex: [dearest, cheap[3]], riley: [second, rileyMate], jordan: [cheap[0], cheap[1]], sam: [cheap[2], cheap[3]] };
    check(r.status === 200 && p.get(dearest) === 20 && p.get(dearest) > p.get(cheap[0]), `  the prices come from the results: ${p.get(dearest)} for the dearest down to ${p.get(cheap[3])}`, JSON.stringify([r.status, [...p.values()]]));
    for (const who of ["alex", "riley", "jordan", "sam"]) {
      r = await as[who].call("POST", `/api/leagues/${L}/draft/blind/lock`, { playerId: pL[who], castawayIds: teams[who] });
      if (r.status !== 200) check(false, `  ${who} locks in a team`, `${r.status} ${errorOf(r)}`);
    }
    st = await league(L);
    const paid = Object.fromEntries(Object.entries(teams).map(([w, ids]) => [w, ids.reduce((n, id) => n + p.get(id), 0)]));
    const cash = (state, who) => S.MarketLogic.cash(state, pL[who]);
    check(S.BlindDraftLogic.isRevealed(st) && Object.keys(teams).every((w) => st.blindDraft.paid[pL[w]] === paid[w] && cash(st, w) === 30 - paid[w]),
      `  everyone's team revealed: what each paid recorded (riley ${paid.riley}), cash the rest (riley ${30 - paid.riley})`, JSON.stringify([st.blindDraft, Object.keys(teams).map((w) => cash(st, w))]));
    const wk = week(st);
    check(!!wk && wk.phase === "open" && wk.episode === 5 && S.WaiverLogic.swapsAllowed(wk) === 2, "  a waiver week is open after Episode 5, two trades each", JSON.stringify(wk));
    // Riley can't buy the dearest for her cheaper one; she can buy a cheap one nobody's tied to.
    const rileyCash = 30 - paid.riley;
    r = await as.riley.call("PUT", `/api/leagues/${L}/waivers/claims`, { pairs: [{ addId: dearest, dropId: rileyMate }] });
    const refusedWords = new RegExp(`costs 20, and a trade 1: you'd have ${rileyCash + p.get(rileyMate)} to spend`);
    check(r.status === 400 && refusedWords.test(errorOf(r)), "  riley's claim on the dearest is refused (400), saying what she'd have to spend", `${r.status} ${errorOf(r)}`);
    const rileyBuy = still.find((id) => !teams.riley.includes(id) && p.get(id) + 1 <= rileyCash + p.get(rileyMate) && id !== dearest);
    r = await as.riley.call("PUT", `/api/leagues/${L}/waivers/claims`, { pairs: [{ addId: rileyBuy, dropId: rileyMate }] });
    check(r.status === 200, "  a cheaper one is claimed", `${r.status} ${errorOf(r)}`);
    r = await as.riley.call("POST", `/api/leagues/${L}/waivers/process`, {});
    check(r.status === 403, "  riley can't run waivers (she doesn't run the game)", `${r.status}`);
    r = await as.alex.call("POST", `/api/leagues/${L}/waivers/process`, {});
    st = await league(L);
    const tx = (st.midSeason.log || []).find((x) => x.playerId === pL.riley);
    check(r.status === 200 && !!tx && tx.sold === p.get(rileyMate) && tx.paid === p.get(rileyBuy) && tx.fee === 1 && cash(st, "riley") === rileyCash + p.get(rileyMate) - p.get(rileyBuy) - 1 && teamOf(st, pL.riley).includes(rileyBuy),
      `  alex's Process now runs it: the log records ${tx && tx.sold} sold, ${tx && tx.paid} paid, the fee 1; riley's cash follows (${cash(st, "riley")})`, JSON.stringify([r.status, tx]));
    // Free agency: riley still can't afford the dearest for the cheap one she bought; jordan can.
    r = await as.riley.call("POST", `/api/leagues/${L}/waivers/free-agency`, { addId: dearest, dropId: rileyBuy });
    check(r.status === 400 && new RegExp(`costs 20, and a trade 1: you'd have ${cash(st, "riley") + p.get(rileyBuy)} to spend`).test(errorOf(r)), "  in free agency riley is refused the dearest for her cheap one (400), saying why", `${r.status} ${errorOf(r).slice(0, 300)}`);
    const jordanCash = 30 - paid.jordan;
    r = await as.jordan.call("POST", `/api/leagues/${L}/waivers/free-agency`, { addId: dearest, dropId: cheap[0] });
    st = await league(L);
    check(r.status === 200 && teamOf(st, pL.jordan).includes(dearest) && teamOf(st, pL.alex).includes(dearest) && cash(st, "jordan") === jordanCash + p.get(cheap[0]) - 20 - 1,
      `  jordan buys the dearest in free agency (shared: alex keeps his), his cash ${cash(st, "jordan")}`, `${r.status} ${errorOf(r)}`);
    // Worth: cash plus the team at today's prices. A trade at today's prices doesn't change it; each fee does.
    const worth = Object.fromEntries(Object.keys(teams).map((w) => [w, S.MarketLogic.worth(st, pL[w])]));
    check(worth.alex === 30 && worth.sam === 30 && worth.riley === 29 && worth.jordan === 29, "  worth: 30 for the two who didn't trade, 29 for the two who paid a fee", JSON.stringify(worth));
    const hub = async (who) => ((await as[who].call("GET", `/api/couches/${fx.couchId}/hub`)).body?.games ?? []).find((g) => g.leagueId === L);
    const [alexGame, rileyGame] = [await hub("alex"), await hub("riley")];
    const place = (g) => Number(String(g?.rank ?? "").replace("T", ""));
    // Worth first (alex and sam's 30 over riley and jordan's 29), then the points.
    check(place(alexGame) <= 2 && place(rileyGame) >= 3, `  the couch hub ranks it by worth: alex ${alexGame?.rank}, riley ${rileyGame?.rank} of 4`, JSON.stringify([alexGame, rileyGame]));
    // Sam, seen through 3: his copy has none of the week's trades (they're after Episode 5), riley's cash as after the draft.
    const samView = S.GhostLogic.viewFor(st, pL.sam, 3);
    check(!(samView.midSeason.log || []).length && cash(samView, "riley") === rileyCash && teamOf(samView, pL.riley).includes(rileyMate), "  sam's copy (seen through 3) has none of the week's trades: riley's cash as after the draft", JSON.stringify(samView.midSeason.log));
    // Undo last waiver run takes the week's trades back, and the cash with them.
    r = await as.alex.call("POST", `/api/leagues/${L}/waivers/undo`, {});
    st = await league(L);
    check(r.status === 200 && !(st.midSeason.log || []).length && cash(st, "riley") === rileyCash && cash(st, "jordan") === jordanCash && teamOf(st, pL.riley).includes(rileyMate) && !teamOf(st, pL.jordan).includes(dearest),
      "  alex's Undo last waiver run takes the trades back, and the cash with them", `${r.status} ${errorOf(r)}`);

    // ---------- ZT Extra: an exclusive snake market of two ----------
    const X = fx.leagues.extra;
    const pX = await pidsOf(X);
    // Its results have no moments: immunity wins in Episode 5 (two to the first still in, one to the next), so the prices differ.
    const wins = (state) => {
      const [a, b] = state.castaways.filter((c) => c.status === "active").map((c) => c.id);
      const ep5 = state.episodes.find((e) => e.number === 5);
      ep5.scoringEvents = [...(ep5.scoringEvents || []), { id: "zt-mk-1", type: "individualImmunity", castawayId: a }, { id: "zt-mk-2", type: "individualImmunity", castawayId: a }, { id: "zt-mk-3", type: "individualImmunity", castawayId: b }];
      state.draftOrder = [pX.alex, pX.casey];
    };
    problems = await remake(X, { preset: "weekly-lineup", get: { by: "draft", each: 2, order: "snake", own: "exclusive", budget: { total: 40, ceiling: 25, trade: {} } }, count: { start: 1 } }, wins);
    st = await league(X);
    const xp = S.PriceLogic.prices(st);
    const ranked = st.castaways.filter((c) => c.status === "active").map((c) => c.id).sort((a, b) => xp.get(b) - xp.get(a) || (a < b ? -1 : 1));
    const [xDear, xNext] = ranked;
    const [xCheap1, xCheap2, xCheap3] = ranked.slice(-3);
    await as.alex.call("POST", `/api/leagues/${X}/draft/force-start`, {});
    const picks = [[as.alex, xCheap1], [as.casey, xDear], [as.casey, xCheap2], [as.alex, xNext]];
    let picked = true;
    for (const [who, id] of picks) {
      r = await who.call("POST", `/api/leagues/${X}/draft/pick`, { castawayId: id });
      if (r.status !== 200) {
        picked = false;
        check(false, "  a pick goes through", `${r.status} ${errorOf(r)}`);
      }
    }
    st = await league(X);
    check(!problems.length && picked && G.sameValue(st.draftLog.map((e) => e.price), picks.map(([, id]) => xp.get(id))) && S.MarketLogic.cash(st, pX.casey) === 40 - xp.get(xDear) - xp.get(xCheap2),
      `ZT Extra made an exclusive snake market of two (40 each): the draft's log records each price (${st.draftLog.map((e) => e.price).join(", ")}), casey's cash the rest`, JSON.stringify([problems, st.draftLog]));
    r = await as.alex.call("POST", `/api/leagues/${X}/waivers/process`, {});
    const rc = await as.casey.call("POST", `/api/leagues/${X}/waivers/free-agency`, { addId: xNext, dropId: xCheap2 });
    check(r.status === 200 && rc.status === 409 && /not a free agent/.test(errorOf(rc)), "  after Process now, casey can't buy one of alex's (409: not a free agent)", `${r.status} ${rc.status} ${errorOf(rc)}`);
    r = await as.casey.call("POST", `/api/leagues/${X}/waivers/free-agency`, { addId: xCheap3, dropId: xCheap2 });
    st = await league(X);
    check(r.status === 200 && teamOf(st, pX.casey).includes(xCheap3) && st.midSeason.log.at(-1).paid === xp.get(xCheap3), "  and can buy one nobody holds", `${r.status} ${errorOf(r)}`);

    // ---------- Pool Party: a Weekly Lineup auction that trades, from Episode 1 (aired) ----------
    const P = fx.leagues.pool;
    const pP = await pidsOf(P);
    problems = await remake(P, { preset: "weekly-lineup", get: { by: "draft", each: 2, order: "auction", budget: { total: 20, trade: {} } }, count: { start: 1 } });
    r = await as.alex.call("POST", `/api/leagues/${P}/draft/force-start`, {});
    r = await as.jordan.call("GET", `/api/leagues/${P}/state`);
    st = await league(P);
    check(!problems.length && S.AuctionLogic.settled(st) && Object.values(pP).every((pid) => teamOf(st, pid).length === 2 && S.MarketLogic.cash(st, pid) === 18) && S.PriceLogic.prices(st).size > 0,
      "Pool Party made an auction that trades from Episode 1: jordan's read settles it, everyone filled at 1 each, 18 left to trade with; prices from the data after it", JSON.stringify([problems, r.status, Object.values(pP).map((pid) => S.MarketLogic.cash(st, pid))]));
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
