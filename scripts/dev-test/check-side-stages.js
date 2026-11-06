// Dev-only check of a side stage (docs/PLAN-start-a-game-gpt.md step A12 part 3, the tracker's p8: "draft solo players in the
// challenge. if we ever get teams forming or pairing up that lasts for multiple episode i want us to start a 'side draft' after that
// episode ends"; format-timeline.js sideTriggers, state-logic.js StageLogic.changePlan, src/lib/server/change-stages.ts from the season
// sync) against the dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (ZT Survivor 51: 13
// episodes, results through Episode 5, Episode 6 three days off), its season played in pairs from Episode 4 as research stores it
// (check-next-stage.js's rows). In order:
//   - The desk's admin (zt_nd_desk, made here, on the couch) starts a solo draft with a side draft beside it from the engine lab: Solo,
//     an Outlast of 2 each, from Episode 6; Side draft, an Outlast of 1 each, once a grouping has held 2 episodes. Only Solo is made;
//     alex, riley, jordan and sam join; Solo drafted through the pick route.
//   - Episode 6's research: the pairs (shown at 4's end) have played 5 and 6 and go on: the season sync makes the side copy (its own
//     league, tied, the five seats under the same ids), from 7, keyed by the spell, playing on; said on the game; GET stage-changes
//     keeps it from alex until he's seen 6; its draft open at once and drafted; Solo untouched.
//   - Episode 7: the pairs still; the game's table each seat's two stages added up.
//   - Episode 6 corrected (re-paired at its end: the pairs never lasted): the copy is taken away, said; corrected back: it's back, its
//     team kept, from the first episode still open (8).
//   - Episode 8's research: every pair re-drawn at its end: the copy ends with 8, its points kept, said; GET hides its end from alex
//     until he's seen 8. Episode 8 corrected (the pairs played on): its end its own again; corrected back: it ends with 8.
//   - The maker's OK: the new pairs hold 9 and 10: the second copy waits for the maker until Episode 11 starts; a player can't answer
//     (403); the maker opens it (from 11), then calls it off (taken away).
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-side-stages.js [--keep]
//
// One fixed scenario on purpose, run again whenever stages or the format's readers change. Brings new-fixture.js up and takes it
// down (--keep leaves it); the research rows go with the zt show. Touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const K = require("./check-kit");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-side-stages runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const DESK = "zt_nd_desk";
const SHOW = "zt-nd-survivor";
const out = K.checker();
const { check } = out;
const { errorOf } = K;

const SPEC = {
  stages: [
    { id: "solo", name: "Solo", game: { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" } } },
    { id: "side", name: "Side draft", side: { held: 2 }, game: { preset: "outlast", get: { by: "draft", each: 1, order: "snake", own: "exclusive" }, ask: [] } },
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
    // The desk's admin, on the couch (check-stages.js's).
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
    const { decide, stateOf, gameIn, seen } = k;
    const changes = async (id) => (await pool.query("SELECT text FROM league_changes WHERE league_id = $1 ORDER BY created_at", [id])).rows.map((r) => r.text);
    const said = async (id, re) => (await changes(id)).some((t) => re.test(t));
    const stageRows = async (G) => (await pool.query("SELECT id, stage_key, deleted_at IS NOT NULL AS gone, (SELECT count(*)::int FROM league_memberships m WHERE m.league_id = l.id) AS seats FROM leagues l WHERE stage_of = $1 ORDER BY created_at", [G])).rows;
    const live = async (G) => (await stageRows(G)).filter((x) => !x.gone);
    let r;

    // ---------- the season in pairs, as research stores it ----------
    const showId = (await pool.query("SELECT id FROM shows WHERE slug = $1", [SHOW])).rows[0].id;
    const cast = [...(await stateOf((await pool.query("SELECT id FROM leagues WHERE couch_id = $1 AND deleted_at IS NULL LIMIT 1", [couch])).rows[0].id)).castaways].sort((a, b) => (a.placementOrder ?? 99) - (b.placementOrder ?? 99));
    const N = (i) => cast[i].name;
    const pairs = (from, to) => Array.from({ length: (to - from + 1) / 2 }, (_, j) => ({ name: null, members: [N(from + 2 * j), N(from + 2 * j + 1)] }));
    const of = (...list) => list.map(([a, b]) => ({ name: null, members: [N(a), N(b)] }));
    const section = (groups, extra = {}) => ({ playedAs: "pairs", phase: null, groups, alone: [], newcomers: [], wentHomeAs: "individuals", changes: [], ...extra });
    const store = (n, formatState, outNames) =>
      pool.query(
        `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance) VALUES ($1, 51, $2, $3::jsonb, '{"provider":"zt-check"}'::jsonb)
         ON CONFLICT (show_id, season_number, episode_number) WHERE source = 'combined' DO UPDATE SET payload = EXCLUDED.payload`,
        [showId, n, JSON.stringify({ summary: `Episode ${n}.`, formatState, castaways: outNames.map((name) => ({ name, leftTheGame: "yes" })) })]
      );
    const swap = (from) => ({ kind: "swap", when: "end", from, what: `Every pair re-drawn for Episode ${from}.`, sure: "high" });
    for (let n = 1; n <= 3; n++) await store(n, null, [N(n - 1)]);
    await store(4, section(pairs(4, 17)), [N(3)]);
    await store(5, section(pairs(6, 17), { alone: [N(5)] }), [N(4)]);
    // Episode 6: the same pairs (N5 alone goes home), or every pair re-drawn at its end (the correction).
    const REDRAWN6 = of([6, 9], [7, 8], [10, 13], [11, 12], [14, 17], [15, 16]);
    const ep6 = (same) => store(6, same ? section(pairs(6, 17)) : section(REDRAWN6, { changes: [swap(7)] }), [N(5)]);
    // Episode 8: every pair re-drawn at its end (N7, alone since 7, goes home), or the same pairs (the correction).
    const REDRAWN8 = of([8, 11], [9, 12], [10, 13], [14, 17], [15, 16]);
    const ep8 = (redrawn) => store(8, redrawn ? section(REDRAWN8, { changes: [swap(9)] }) : section(pairs(8, 17)), [N(7)]);

    // ---------- the engine lab: the game, and only its own stage ----------
    r = await as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(SPEC) });
    const G = r.body?.leagueId;
    check(r.status === 200 && !!G, "the desk's admin starts a solo draft with a side draft beside it, from the engine lab", `${r.status} ${errorOf(r)}`);
    const parent = await stateOf(G);
    let rows = await stageRows(G);
    const soloId = rows.find((x) => x.stage_key === "solo")?.id;
    check(rows.length === 1 && !!soloId && S.StageLogic.sideStages(parent).map((x) => x.id).join() === "side" && S.gameOf(parent).stages[1].side.held === 2, "  only Solo is made: the side draft opens when a grouping lasts", JSON.stringify({ rows, side: S.gameOf(parent).stages[1].side }));
    let so = await stateOf(soloId);
    check(S.startEpisode(so) === 6 && S.endEpisode(so) === null, "  Solo from Episode 6, all season", JSON.stringify([S.startEpisode(so), S.endEpisode(so)]));
    for (const who of WHO) {
      r = await as[who].call("POST", `/api/couches/${couch}/games/${G}`, { action: "join" });
      check(r.status === 200, `  ${who} joins the game on the couch`, `${r.status} ${errorOf(r)}`);
    }
    const seatsG = await k.seatsOf(G);
    const desk = (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [G, deskId])).rows[0].player_id;
    const by = { ...seatsG, desk };
    const whoOf = (pid) => Object.keys(by).find((w) => by[w] === pid);
    /** A snake draft run through the routes, each on their own turn: how many picks went in. */
    async function draft(id) {
      r = await as.desk.call("POST", `/api/leagues/${id}/draft/force-start`, {});
      if (r.status !== 200) return { started: errorOf(r), picks: 0 };
      let picks = 0;
      for (let guard = 0; guard < 30; guard++) {
        const s = await stateOf(id);
        const turn = S.currentDraftTurn(s);
        if (!turn || turn.isComplete) break;
        const free = s.castaways.find((c) => c.status === "active" && !(c.ownerIds || []).length);
        r = await as[whoOf(turn.playerId)].call("POST", `/api/leagues/${id}/draft/pick`, { castawayId: free.id });
        if (r.status === 200) picks++;
      }
      return { started: null, picks };
    }
    let d = await draft(soloId);
    check(d.picks === 10, "  Solo drafted through the pick route: 5 of you × 2", JSON.stringify(d));

    // ---------- Episode 6: the pairs held 5 and 6 and go on: the side draft opens ----------
    await ep6(true);
    await decide(6, "elimination", N(5));
    rows = await live(G);
    const KEY = "side@s4";
    const copy = rows.find((x) => x.stage_key === KEY)?.id;
    check(!!copy && rows.length === 2, "Episode 6's research: the pairs (shown at 4's end) held 5 and 6 and go on: the season sync makes the side draft, keyed by the spell", JSON.stringify(rows));
    let co = copy ? await stateOf(copy) : null;
    so = await stateOf(soloId);
    const seatsCopy = copy ? await k.seatsOf(copy) : {};
    check(!!co && S.startEpisode(co) === 7 && S.endEpisode(co) === null && S.endEpisode(so) === null, "  from Episode 7, playing on while the pairs last; Solo untouched", JSON.stringify({ copy: co && [S.startEpisode(co), S.endEpisode(co)], solo: S.endEpisode(so) }));
    check(!!co && WHO.every((w) => seatsCopy[w] === seatsG[w]) && co.players.length === 5, "  the game's five seats in it, under the same ids", JSON.stringify({ seatsCopy, seatsG }));
    const tied = copy ? (await pool.query("SELECT couch_id, stage_of FROM leagues WHERE id = $1", [copy])).rows[0] : null;
    check(!!tied && tied.stage_of === G && tied.couch_id === couch, "  tied to the game, on the same couch", JSON.stringify(tied));
    check(await said(G, /^The tribes held 2 episodes \(to Episode 6\): Side draft opens with Episode 7$/), "  the game's Recent changes say what lasted and what it did", JSON.stringify(await changes(G)));
    check(!!copy && (await said(copy, /^Side draft of Lab · .*, from Episode 7: the tribes held 2 episodes$/)), "  and the side draft's", JSON.stringify(copy && (await changes(copy))));
    r = await as.alex.call("GET", `/api/leagues/${G}/stage-changes`);
    check(r.status === 200 && r.body.started?.length === 0 && r.body.later === 1, "  GET stage-changes keeps it from alex, who hasn't seen Episode 6", `${r.status} ${JSON.stringify(r.body)}`);
    await seen("alex", 6);
    r = await as.alex.call("GET", `/api/leagues/${G}/stage-changes`);
    check(r.status === 200 && r.body.started?.length === 1 && r.body.started[0].key === KEY && r.body.started[0].side === true && r.body.started[0].from === 7 && r.body.started[0].to === null && r.body.started[0].change?.kind === "lasted", "  and lists it once he has", `${r.status} ${JSON.stringify(r.body)}`);
    check(!!co && S.DraftLogic.waits(co) === null && co.settings.ownershipMode === "exclusive", "  its draft is open now (Episode 6 has results), exclusive (5 × 1 fits who's still in)", JSON.stringify(co && { waits: S.DraftLogic.waits(co), own: co.settings.ownershipMode }));
    d = copy ? await draft(copy) : { picks: 0 };
    check(d.picks === 5, "  drafted through the pick route", JSON.stringify(d));

    // ---------- Episode 7: the pairs still (N6 goes home, N7 alone) ----------
    await store(7, section(pairs(8, 17), { alone: [N(7)] }), [N(6)]);
    await decide(7, "elimination", N(6));
    rows = await live(G);
    co = await stateOf(copy);
    check(rows.length === 2 && S.endEpisode(co) === null, "Episode 7: the pairs still, the side draft plays on");
    await seen("alex", 7);
    const view = await gameIn("alex", G);
    so = await stateOf(soloId);
    const a = S.computeScores(S.spanView(so));
    const b = S.computeScores(S.spanView(co));
    const pts = (rowsOf, pid) => rowsOf.find((x) => x.playerId === pid)?.total ?? 0;
    check(!!view && WHO.every((w) => view.table.find((x) => x.playerId === seatsG[w])?.total === pts(a, seatsG[w]) + pts(b, seatsG[w])), "  the game's table: each seat's Solo and side draft added up", JSON.stringify({ game: view?.table?.map((x) => [x.name, x.total]), solo: a.map((x) => [x.name, x.total]), side: b.map((x) => [x.name, x.total]) }));

    // ---------- Episode 6 corrected: the pairs re-drawn at its end, so they never lasted; then corrected back ----------
    await ep6(false);
    await k.sync();
    rows = await stageRows(G);
    so = await stateOf(soloId);
    check(rows.find((x) => x.id === copy)?.gone === true && rows.find((x) => x.id === copy)?.seats === 0 && S.endEpisode(so) === null, "Episode 6 corrected (every pair re-drawn at its end): the side draft is taken away, Solo untouched", JSON.stringify({ rows, solo: S.endEpisode(so) }));
    check(await said(G, /^Side draft \(s4\) is called off: research no longer says the tribes lasted there, so what it scored is taken back$/), "  the game says so", JSON.stringify(await changes(G)));
    await ep6(true);
    await k.sync();
    rows = await stageRows(G);
    co = await stateOf(copy);
    check(rows.find((x) => x.id === copy)?.gone === false && rows.find((x) => x.id === copy)?.seats === 5 && S.startEpisode(co) === 8 && co.castaways.some((c) => (c.ownerIds || []).length), "  corrected back: it's back (its team kept), from the first episode still open (8)", JSON.stringify({ rows, copy: S.startEpisode(co) }));
    check(await said(G, /^The tribes held 2 episodes \(to Episode 6\): Side draft opens with Episode 8$/), "  and the game says it opened again", JSON.stringify(await changes(G)));

    // ---------- Episode 8: every pair re-drawn at its end: the side draft ends with 8, its points kept ----------
    await ep8(true);
    await decide(8, "elimination", N(7));
    co = await stateOf(copy);
    rows = await live(G);
    check(rows.length === 2 && S.startEpisode(co) === 8 && S.endEpisode(co) === 8, "Episode 8's research: every pair re-drawn at its end: the side draft ends with 8", JSON.stringify({ rows, copy: [S.startEpisode(co), S.endEpisode(co)] }));
    check(await said(G, /^The tribes changed \(a swap, at Episode 8\): Side draft ends with Episode 8, its points kept$/), "  said on the game", JSON.stringify(await changes(G)));
    check(await said(copy, /^Plays Episodes 8 to 8: where its grouping lasted, until it changed$/), "  and on the side draft", JSON.stringify(await changes(copy)));
    r = await as.alex.call("GET", `/api/leagues/${G}/stage-changes`);
    check(r.status === 200 && r.body.started?.[0]?.to === null && r.body.later >= 1, "  GET keeps its end from alex until he's seen 8", `${r.status} ${JSON.stringify(r.body)}`);
    await seen("alex", 8);
    r = await as.alex.call("GET", `/api/leagues/${G}/stage-changes`);
    check(r.status === 200 && r.body.started?.[0]?.to === 8, "  and shows it once he has", `${r.status} ${JSON.stringify(r.body)}`);
    await ep8(false);
    await k.sync();
    co = await stateOf(copy);
    check(S.endEpisode(co) === null, "Episode 8 corrected (the pairs played on): its end its own again", JSON.stringify(S.endEpisode(co)));
    check(await said(G, /^Research no longer says the tribes changed at Episode 8: Side draft plays on$/), "  said on the game", JSON.stringify(await changes(G)));
    await ep8(true);
    await k.sync();
    co = await stateOf(copy);
    const closes = (await changes(G)).filter((t) => /^The tribes changed \(a swap, at Episode 8\): Side draft ends with Episode 8, its points kept$/.test(t)).length;
    check(S.endEpisode(co) === 8 && closes === 2, "  corrected back: it ends with 8, said again", JSON.stringify({ to: S.endEpisode(co), closes }));

    // ---------- the maker's OK: the new pairs hold 9 and 10 ----------
    const problems = await k.setGame(G, (g) => ({ ...g, extras: { ...g.extras, changes: { ok: "maker", unanswered: "carry-on" } } }));
    check(!problems.length && S.StageLogic.changesOf(await stateOf(G))?.ok === "maker", "The game now waits for the maker's OK (carrying on if nobody answers)", JSON.stringify(problems));
    await store(9, section(of([8, 11], [9, 12], [10, 13], [14, 17]), { alone: [N(15)] }), [N(16)]);
    await decide(9, "elimination", N(16));
    await store(10, section(of([8, 11], [9, 12], [10, 13], [14, 17])), [N(15)]);
    await decide(10, "elimination", N(15));
    const KEY2 = "side@s8";
    await seen("alex", 10);
    r = await as.alex.call("GET", `/api/leagues/${G}/stage-changes`);
    check((await live(G)).length === 2 && r.body.pending?.length === 1 && r.body.pending[0].key === KEY2 && r.body.pending[0].until === 11, "Episode 10's research: the new pairs held 9 and 10: the second side draft waits for the maker until Episode 11 starts", JSON.stringify(r.body));
    check(await said(G, /^The tribes held 2 episodes \(to Episode 10\): open Side draft\? Say so before Episode 11 starts, else the game carries on as it is$/), "  the maker is asked", JSON.stringify(await changes(G)));
    r = await as.alex.call("POST", `/api/leagues/${G}/stage-changes`, { key: KEY2, do: "start" });
    check(r.status === 403, "  a player can't answer it (403)", `${r.status} ${errorOf(r)}`);
    r = await as.desk.call("POST", `/api/leagues/${G}/stage-changes`, { key: KEY2, do: "start" });
    rows = await live(G);
    const copy2 = rows.find((x) => x.stage_key === KEY2)?.id;
    check(r.status === 200 && !!copy2 && S.startEpisode(await stateOf(copy2)) === 11 && S.endEpisode(await stateOf(copy)) === 8, "  the maker opens it: a second side draft from 11, the first still ending with 8", `${r.status} ${errorOf(r)} ${JSON.stringify(rows)}`);
    r = await as.desk.call("POST", `/api/leagues/${G}/stage-changes`, { key: KEY2, do: "skip" });
    rows = await stageRows(G);
    check(r.status === 200 && rows.find((x) => x.id === copy2)?.gone === true && rows.find((x) => x.id === copy)?.gone === false && r.body.skipped?.length === 1, "  then calls it off: taken away, the first kept", `${r.status} ${errorOf(r)} ${JSON.stringify(rows)}`);
    check((await said(G, /^zt_nd_desk said open Side draft for the tribes lasting at 11$/)) && (await said(G, /^zt_nd_desk said no to Side draft for the tribes lasting at 11$/)), "  each answer in the game's Recent changes", JSON.stringify(await changes(G)));
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
