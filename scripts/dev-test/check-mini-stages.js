// Dev-only check of mini-games and two ways of scoring (docs/PLAN-start-a-game-gpt.md step A12 part 4a: a stage of bingo or Weekly
// Calls, its table the server's own counts, answer-points.ts stageWalk's outsideCounts; a stage alongside the game's own, at the same
// time; schema.js stageGames, StateLogic.StageLogic) against the dev server, through the API (no screens: they're the UI track's), on
// new-fixture.js's couch (ZT Survivor 51: 13 episodes, results through Episode 5, Episode 6 three days off). In order:
//   - The desk's admin (zt_nd_desk, made here, on the couch) starts a season of mini-games from the engine lab: Bingo (5 points a line)
//     for Episode 6, then a Draft (an Outlast of 2 each) from 7, and Calls (Weekly Calls) alongside them from 6, the overall by points.
//     The game is a league; each stage a league of its own tied to it (bingo, an Outlast and Weekly Calls), the admin seated in each;
//     Calls from 6 to the season's end, the Draft's own draft waiting for Episode 6's results.
//   - alex, riley, jordan and sam join the game on the couch: each is seated in all three stages under the same player id.
//   - Episode 6 (the season's clock moved past it: bingo's and Calls' own tables count what's aired): alex's bingo card has a line (immunity, the free middle, an idol found, all ticked), riley's has none; alex and jordan
//     call who goes home right, riley wrong; the result goes in through the season sync (the moments too).
//   - Each stage's own table on the Games tab (bingo: alex 5; Calls: alex 1, jordan 1) and the game's, the overall: alex 6, jordan 1,
//     riley 0 (alex caught up to 6 first); the stages as the server reads them (stageWalk): Bingo over with 6, Calls alongside.
//   - The Draft's draft opens once Episode 6 has results, drafted through the pick route; Episode 7's result: the game's table is each
//     seat's three stages added up, its end the Draft's (none yet); sam, behind at 3, sees nothing of it.
//   - The game-specs flag's check passes on the game and its three stages (each carries its spec in step).
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-mini-stages.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const K = require("./check-kit");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");
const { checkLeague } = require("../game-specs-flag.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-mini-stages runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const DESK = "zt_nd_desk";
const out = K.checker();
const { check } = out;
const { errorOf } = K;

const STAGED = {
  stages: [
    { id: "bingo", name: "Bingo", game: { preset: "weekly-bingo", score: { by: "lines", points: 5 }, span: { to: 6 } } },
    { id: "draft", name: "Draft", game: { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" }, span: { from: 7 } } },
    { id: "calls", name: "Calls", alongside: true, game: { preset: "weekly-calls" } },
  ],
  overall: { by: "points" },
};

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    // The desk's admin: a zt_nd_ person of their own (fixture.down removes them), on the couch (the lab's test games go on a zt- couch
    // they're on).
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [deskId, DESK, `${DESK}@example.invalid`]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), deskId, await hashPassword(fixture.PASSWORD)]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);
    await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'member', 'couch')", [couch, deskId]);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    as.desk = await api({ user: DESK, pass: fixture.PASSWORD });
    const k = K.kit({ pool, fx, as, specsOn });
    const { decide, seen, stateOf, gameIn } = k;
    let r;

    // ---------- the engine lab: the game and a league for each stage ----------
    r = await as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(STAGED) });
    const G = r.body?.leagueId;
    check(r.status === 200 && !!G, "the desk's admin starts a season of mini-games from the engine lab", `${r.status} ${errorOf(r)}`);
    const parent = await stateOf(G);
    const rows = (await pool.query("SELECT id, stage_key, couch_id FROM leagues WHERE stage_of = $1 AND deleted_at IS NULL", [G])).rows;
    const idOf = (key) => rows.find((x) => x.stage_key === key)?.id;
    const [BI, DR, CA] = ["bingo", "draft", "calls"].map(idOf);
    check(parent.settings.leagueTypeId === "stages" && rows.length === 3 && !!BI && !!DR && !!CA && rows.every((x) => x.couch_id === couch), "  the game and a league for each stage, tied to it, on the couch", JSON.stringify(rows));
    const [bs, ds, cs] = await Promise.all([BI, DR, CA].map(stateOf));
    check(bs.settings.leagueTypeId === "weekly-bingo" && ds.settings.leagueTypeId === "classic-draft" && cs.settings.leagueTypeId === "weekly-calls", "  Bingo a Weekly Bingo, Draft an Outlast, Calls a Weekly Calls", JSON.stringify([bs, ds, cs].map((s) => s.settings.leagueTypeId)));
    check(S.startEpisode(bs) === 6 && S.endEpisode(bs) === 6 && bs.settings.linePoints === 5, "  Bingo plays Episode 6, 5 points a line", JSON.stringify([S.startEpisode(bs), S.endEpisode(bs), bs.settings.linePoints]));
    check(S.startEpisode(cs) === 6 && S.endEpisode(cs) === null, "  Calls alongside, from 6 (the game's start) to the season's end", JSON.stringify([S.startEpisode(cs), S.endEpisode(cs)]));
    check(S.startEpisode(ds) === 7 && /Episode 6's results/.test(S.DraftLogic.waits(ds) || ""), "  Draft from 7, its draft waiting for Episode 6's results", String(S.DraftLogic.waits(ds)));

    // ---------- the four join: seated in all three ----------
    for (const who of WHO) {
      r = await as[who].call("POST", `/api/couches/${couch}/games/${G}`, { action: "join" });
      check(r.status === 200, `  ${who} joins the game on the couch`, `${r.status} ${errorOf(r)}`);
    }
    const seatsG = await k.seatsOf(G);
    const seats = await Promise.all([BI, DR, CA].map((id) => k.seatsOf(id)));
    check(WHO.every((w) => seatsG[w] && seats.every((x) => x[w] === seatsG[w])), "  each is seated in all three stages under the same player id", JSON.stringify({ seatsG, seats }));

    // ---------- Episode 6: a bingo line, the calls, the result ----------
    const square = (key, label) => ({ key, label });
    const squares = [square("m:fireMaking", "Fire"), square("m:quit", "A quit"), square("m:medevac", "A medevac"), square("m:individualImmunity", "Immunity"), square("free", "Free"), square("m:idolFound", "An idol found"), square("m:rockDraw", "A rock draw"), square("m:shotInTheDark", "A shot in the dark"), square("m:reward", "Reward")];
    const card = async (who, ticks) => {
      const id = (await pool.query("INSERT INTO bingo_cards (user_id, season_id, episode, squares) VALUES ($1, $2, 6, $3::jsonb) ON CONFLICT (user_id, season_id, episode) DO UPDATE SET squares = EXCLUDED.squares RETURNING id", [fx.users[who], sid, JSON.stringify(squares)])).rows[0].id;
      for (const t of ticks) await pool.query("INSERT INTO bingo_marks (card_id, square) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, t]);
    };
    await card("alex", [3, 4, 5]);
    await card("riley", [0, 4, 8]);
    const still = bs.castaways.filter((c) => c.status === "active");
    const goes = still[0];
    const other = still[1];
    const castId = async (name) => (await pool.query("SELECT id FROM season_cast WHERE season_id = $1 AND name = $2", [sid, name])).rows[0]?.id;
    const call = async (who, name) => pool.query("INSERT INTO episode_calls (user_id, season_id, episode, question, answer) VALUES ($1, $2, 6, 'out', $3) ON CONFLICT DO NOTHING", [fx.users[who], sid, await castId(name)]);
    await call("alex", goes.name);
    await call("jordan", goes.name);
    await call("riley", other.name);
    await decide(6, "event", other.name, "individualImmunity");
    await decide(6, "event", other.name, "idolFound");
    await decide(6, "elimination", goes.name);
    const ep6 = (s) => S.episodeHasResults(s.episodes.find((e) => e.number === 6));
    check((await Promise.all([BI, DR, CA, G].map(stateOf))).every(ep6), `Episode 6's result (${goes.name} goes home, immunity and an idol found) reaches the game and its three stages`);
    // Bingo's and Calls' own tables count what's aired: the season's clock moved on past Episode 6 (not 7).
    await k.airs(4);
    await seen("alex", 6);
    const totals = (g) => Object.fromEntries((g?.table ?? []).map((t) => [Object.keys(seatsG).find((w) => seatsG[w] === t.playerId) ?? t.name, t.total]));
    const bt = totals(await gameIn("alex", BI));
    const ct = totals(await gameIn("alex", CA));
    check(bt.alex === 5 && bt.riley === 0, "  Bingo's own table: alex's line at 5, riley's ticks no line", JSON.stringify(bt));
    check(ct.alex === 1 && ct.jordan === 1 && ct.riley === 0, "  Calls' own table: alex and jordan called it", JSON.stringify(ct));
    let gt = totals(await gameIn("alex", G));
    check(gt.alex === 6 && gt.jordan === 1 && gt.riley === 0 && gt.sam === 0, "  the game's table, the overall: alex 6, jordan 1, riley 0", JSON.stringify(gt));
    const { asItStands } = jiti("../../src/lib/server/answer-points.ts");
    let stands = S.StageLogic.standings((await asItStands(G, await stateOf(G))).state);
    check(JSON.stringify(stands.map((x) => [x.key, x.alongside, x.from, x.to, x.started, x.over])) === JSON.stringify([["bingo", false, 6, 6, true, true], ["draft", false, 7, null, false, false], ["calls", true, 6, null, true, false]]),
      "  the stages as the server reads them: Bingo over with 6, Draft not started, Calls alongside from 6", JSON.stringify(stands.map((x) => [x.key, x.alongside, x.from, x.to, x.started, x.over])));

    // ---------- the Draft: its draft opens, drafted; Episode 7 ----------
    let dstate = await stateOf(DR);
    check(!S.DraftLogic.waits(dstate), "Draft's draft opens once Episode 6 has results", String(S.DraftLogic.waits(dstate)));
    r = await as.desk.call("POST", `/api/leagues/${DR}/draft/force-start`, {});
    check(r.status === 200, "  it starts", `${r.status} ${errorOf(r)}`);
    const seatsD = seats[1];
    const whoOf = (pid) => Object.keys(seatsD).find((w) => seatsD[w] === pid) ?? (pid === parent.players[0].id ? "desk" : null);
    let picks = 0;
    for (let guard = 0; guard < 20; guard++) {
      dstate = await stateOf(DR);
      const turn = S.currentDraftTurn(dstate);
      if (!turn || turn.isComplete) break;
      const free = dstate.castaways.find((c) => c.status === "active" && !(c.ownerIds || []).length);
      r = await as[whoOf(turn.playerId)].call("POST", `/api/leagues/${DR}/draft/pick`, { castawayId: free.id });
      if (r.status === 200) picks++;
    }
    dstate = await stateOf(DR);
    check(picks === 10 && dstate.draftPicksMade === 10, "  drafted through the pick route: 5 of you × 2", JSON.stringify({ picks, made: dstate.draftPicksMade }));
    const free7 = dstate.castaways.find((c) => c.status === "active" && !(c.ownerIds || []).length);
    await decide(7, "elimination", free7.name);
    await k.airs(7);
    await seen("alex", 7);
    const dt = totals(await gameIn("alex", DR));
    gt = totals(await gameIn("alex", G));
    const ct7 = totals(await gameIn("alex", CA));
    check(WHO.every((w) => gt[w] === (bt[w] ?? 0) + (dt[w] ?? 0) + (ct7[w] ?? 0)) && gt.alex > 6, "Episode 7: the game's table is each seat's three stages added up", JSON.stringify({ gt, bt, dt, ct7 }));
    const view = (await asItStands(G, await stateOf(G))).state;
    stands = S.StageLogic.standings(view);
    check(stands.find((x) => x.key === "draft")?.started === true && S.StageLogic.endsAt(view) === null && !S.gameOver(view), "  the Draft has started; the game ends with it (not yet), whatever Calls does", JSON.stringify(stands.map((x) => [x.key, x.started, x.over])));
    const samG = await gameIn("sam", G);
    check(!!samG && (samG.table ?? []).every((t) => t.total === 0), "  sam, behind at 3, sees nothing of it", JSON.stringify(samG?.table));

    // ---------- the flag ----------
    for (const [id, what] of [[G, "the game"], [BI, "Bingo"], [DR, "Draft"], [CA, "Calls"]]) {
      const flagged = checkLeague(await stateOf(id));
      check(flagged.ok, `the game-specs flag's check passes on ${what}`, JSON.stringify(flagged));
    }
  } catch (e) {
    out.fail();
    console.error(e);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.error("down:", e.message));
    await pool.end();
  }
  console.log(out.failures() ? `${out.failures()} FAILED` : "ALL PASS");
  process.exit(out.failures() ? 1 : 0);
})();
