// Dev-only check of a game in stages (docs/PLAN-start-a-game-gpt.md step A12 part 1: the spec's stages and overall, state-logic.js
// StageLogic, a draft that opens at its start and its shared fallback, an end at a phase; src/lib/server/stages.ts, the lab's
// makeStages, answer-points.ts stageWalk) against the dev server, through the API (no screens: they're the UI track's), on
// new-fixture.js's couch (ZT Survivor 51: 13 episodes, results through Episode 5, Episode 6 three days off, its rulebook Tribes then
// Merged). In order:
//   - The desk's admin (zt_nd_desk, made here, on the couch) starts "Pre-merge and post-merge are separate games with their own
//     drafts" from the engine lab: an Outlast of 2 each before the merge, an Outlast of 3 each from it, the overall by points. The
//     game is a league; each stage a league of its own tied to it (stage_of, stage_key), the admin's seat and membership in each;
//     the first from Episode 6 (the next to air) until Merged starts, the second waiting for Merged, its draft opening at its start.
//   - alex, riley, jordan and sam join the game on the couch: each is seated in both stages under the same player id.
//   - The second stage's draft can't start yet (409, and why); the first's is drafted through the draft routes, turn by turn.
//   - Episode 6's result (the season sync) reaches every stage; the Games tab's table for the game is the first stage's.
//   - jordan leaves the game: their memberships go from both stages, their seat left (disabled, team and points kept) in the first
//     (it has begun) and taken out of the second (it hasn't).
//   - The desk confirms Merged at Episode 8: the first stage ends with Episode 7, the second starts with 8 (each a line in its Recent
//     changes); its draft still waits, now for Episode 7's results.
//   - Episode 7's result: the second stage's draft opens, and four of you × 3 is more than who's still in, so it's shared, with a
//     line in its Recent changes; it's drafted in private through the blind lock route; nobody new can join the game now.
//   - Episode 8's result: the game's table is each seat's two stages added up; the first stage is over; sam, behind, sees nothing
//     until their mark reaches a stage's episodes, then the first stage only; the couch's hub counts the game, never its stages.
//   - The desk deletes the game: its stages go with it, their memberships too; restored, they're back, memberships and all.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-stages.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-stages runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const DESK = "zt_nd_desk";
const out = K.checker();
const { check } = out;
const { errorOf } = K;

const STAGED = {
  stages: [
    { id: "pre", name: "Pre-merge", game: { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" } } },
    { id: "post", name: "Post-merge", game: { preset: "outlast", get: { by: "draft", each: 3, order: "snake", own: "exclusive" }, span: { from: { phase: "merged" } } } },
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
    const seatsOf = async (id) => {
      const o = await k.seatsOf(id);
      const desk = (await pool.query("SELECT player_id FROM league_memberships WHERE league_id = $1 AND user_id = $2", [id, deskId])).rows[0];
      return desk ? { ...o, desk: desk.player_id } : o;
    };
    const changes = async (id) => (await pool.query("SELECT text FROM league_changes WHERE league_id = $1 ORDER BY created_at", [id])).rows.map((r) => r.text);
    let r;
    let st;

    // ---------- the engine lab: the game and a league for each stage ----------
    r = await as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(STAGED) });
    const G = r.body?.leagueId;
    check(r.status === 200 && !!G, "the desk's admin starts a game in stages from the engine lab", `${r.status} ${errorOf(r)}`);
    const parent = await stateOf(G);
    const stages = (await pool.query("SELECT id, name, stage_key, couch_id FROM leagues WHERE stage_of = $1 ORDER BY name DESC", [G])).rows;
    const pre = stages.find((x) => x.stage_key === "pre")?.id;
    const post = stages.find((x) => x.stage_key === "post")?.id;
    check(parent.settings.leagueTypeId === "stages" && S.StageLogic.on(parent) && S.StageLogic.stages(parent).map((x) => x.id).join() === "pre,post",
      "  the game is a league that plays in stages: Pre-merge, then Post-merge", JSON.stringify({ type: parent.settings.leagueTypeId }));
    check(stages.length === 2 && !!pre && !!post && stages.every((x) => x.couch_id === couch && /Pre-merge|Post-merge/.test(x.name)), "  each stage a league of its own, tied to it, on the same couch", JSON.stringify(stages));
    let pa = await stateOf(pre);
    let po = await stateOf(post);
    const deskPid = parent.players[0].id;
    check([pa, po].every((s) => s.players.length === 1 && s.players[0].id === deskPid), "  the admin's seat in each stage, under the same id");
    check(S.startEpisode(pa) === 6 && S.endPhase(pa) === "merged" && S.endEpisode(pa) === null, "  Pre-merge from Episode 6 (the next to air) until Merged starts (not known yet)", JSON.stringify(pa.settings.startEpisode));
    check(S.startPhase(po) === "merged" && S.startEpisode(po) === null && S.gameOf(po).extras.draft.opens === "start", "  Post-merge waits for Merged, its draft opening at its start");

    // ---------- the four join the game: seated in both stages ----------
    for (const who of WHO) {
      r = await as[who].call("POST", `/api/couches/${couch}/games/${G}`, { action: "join" });
      check(r.status === 200, `  ${who} joins the game on the couch`, `${r.status} ${errorOf(r)}`);
    }
    const seatsG = await seatsOf(G);
    const seatsPre = await seatsOf(pre);
    const seatsPost = await seatsOf(post);
    check(WHO.every((w) => seatsG[w] && seatsPre[w] === seatsG[w] && seatsPost[w] === seatsG[w]), "  each is seated in both stages under the same player id, their account on it", JSON.stringify({ seatsG, seatsPre, seatsPost }));

    // ---------- the drafts: the second can't start yet; the first, turn by turn ----------
    r = await as.desk.call("POST", `/api/leagues/${post}/draft/force-start`, {});
    check(r.status === 409 && /once it's known where the game starts/.test(errorOf(r)), "Post-merge's draft can't start yet, and says why", `${r.status} ${errorOf(r)}`);
    r = await as.desk.call("POST", `/api/leagues/${pre}/draft/force-start`, {});
    check(r.status === 200, "Pre-merge's draft starts", `${r.status} ${errorOf(r)}`);
    const whoOf = (pid) => Object.keys(seatsPre).find((w) => seatsPre[w] === pid);
    let picks = 0;
    for (let guard = 0; guard < 20; guard++) {
      pa = await stateOf(pre);
      const turn = S.currentDraftTurn(pa);
      if (!turn || turn.isComplete) break;
      const free = pa.castaways.find((c) => c.status === "active" && !(c.ownerIds || []).length);
      r = await as[whoOf(turn.playerId)].call("POST", `/api/leagues/${pre}/draft/pick`, { castawayId: free.id });
      if (r.status === 200) picks++;
    }
    pa = await stateOf(pre);
    check(picks === 10 && pa.draftPicksMade === 10, "  drafted through the pick route, each on their own turn: 5 of you × 2", JSON.stringify({ picks, made: pa.draftPicksMade }));

    // ---------- Episode 6 ----------
    const still = (s) => s.castaways.filter((c) => c.status === "active");
    const free6 = still(pa).find((c) => !(c.ownerIds || []).length);
    await decide(6, "elimination", free6.name);
    pa = await stateOf(pre);
    po = await stateOf(post);
    check(S.episodeHasResults(pa.episodes.find((e) => e.number === 6)) && S.episodeHasResults(po.episodes.find((e) => e.number === 6)), `Episode 6's result (${free6.name} goes home) reaches both stages through the season sync`);
    // alex has seen through Episode 5 (the fixture's): caught up to 6.
    await seen("alex", 6);
    let view = await gameIn("alex", G);
    const preTable = S.computeScores(pa);
    const ptsOf = (rows, pid) => rows.find((x) => x.playerId === pid)?.total;
    check(!!view && WHO.every((w) => view.table.find((x) => x.playerId === seatsG[w])?.total === ptsOf(preTable, seatsPre[w])),
      "  the Games tab's table for the game is Pre-merge's own so far", JSON.stringify({ game: view?.table?.map((x) => [x.name, x.total]), pre: preTable.map((x) => [x.name, x.total]) }));

    // ---------- jordan leaves the game ----------
    r = await as.jordan.call("POST", `/api/leagues/${G}/leave`, {});
    pa = await stateOf(pre);
    po = await stateOf(post);
    const memberIn = async (id, who) => (await pool.query("SELECT 1 FROM league_memberships WHERE league_id = $1 AND user_id = $2", [id, fx.users[who]])).rows.length > 0;
    check(r.status === 200 && !(await memberIn(G, "jordan")) && !(await memberIn(pre, "jordan")) && !(await memberIn(post, "jordan")), "jordan leaves the game: out of both stages too", `${r.status} ${errorOf(r)}`);
    const jPre = pa.players.find((p) => p.id === seatsPre.jordan);
    check(!!jPre && jPre.disabled === true && S.Core.ownedCastawayIds(pa, jPre.id).length === 2 && !po.players.some((p) => p.id === seatsPost.jordan),
      "  their seat left in Pre-merge (it has begun: team and points kept), taken out of Post-merge (it hasn't)", JSON.stringify({ pre: jPre && { disabled: jPre.disabled }, post: po.players.map((p) => p.name) }));
    const IN = ["alex", "riley", "sam"];

    // ---------- the desk confirms Merged at Episode 8 ----------
    const season = (await as.desk.call("GET", `/api/desk/seasons/${sid}`)).body;
    const rb = season.rulebook?.id;
    r = await as.desk.call("POST", `/api/desk/rulebooks/${rb}`, { action: "phase", phaseId: "merged", episode: 8 });
    pa = await stateOf(pre);
    po = await stateOf(post);
    check(r.status === 200 && S.endEpisode(pa) === 7 && S.startEpisode(po) === 8, "The desk confirms Merged at Episode 8: Pre-merge ends with Episode 7, Post-merge starts with 8", `${r.status} ${JSON.stringify({ end: S.endEpisode(pa), start: S.startEpisode(po) })}`);
    check((await changes(pre)).some((t) => /Ends before Merged, with Episode 7/.test(t)) && (await changes(post)).some((t) => /Starts with Merged, at Episode 8/.test(t)), "  a line in each stage's Recent changes");
    r = await as.desk.call("POST", `/api/leagues/${post}/draft/force-start`, {});
    check(r.status === 409 && /Episode 7's results/.test(errorOf(r)), "  Post-merge's draft still waits, now for Episode 7's results", `${r.status} ${errorOf(r)}`);

    // ---------- Episode 7: the second draft opens, shared ----------
    // One of alex's Pre-merge team goes home, so the seats' points differ.
    const free7 = still(pa).find((c) => (c.ownerIds || []).includes(seatsPre.alex));
    await decide(7, "elimination", free7.name);
    po = await stateOf(post);
    const left = still(po).length;
    check(po.settings.ownershipMode === "shared" && S.DraftLogic.waits(po) === null, `Episode 7's result: Post-merge's draft opens, and 4 of you × 3 is more than the ${left} still in: it's shared`, JSON.stringify({ own: po.settings.ownershipMode }));
    check((await changes(post)).some((t) => t === `The draft is shared: 4 of you × 3 is more than the ${left} still in, so two of you can have the same one`), "  whoever runs it hears, in its Recent changes", JSON.stringify(await changes(post)));
    const games = (await as.alex.call("GET", `/api/couches/${couch}/games`)).body.games ?? [];
    check(games.find((x) => x.leagueId === G)?.mode === "locked", "  nobody new can join the game now its first stage has started");
    r = await as.desk.call("POST", `/api/leagues/${post}/draft/force-start`, {});
    check(r.status === 200, "  its draft starts", `${r.status} ${errorOf(r)}`);
    const ids = still(po).map((c) => c.id);
    const locks = [];
    for (const [i, who] of ["desk", ...IN].entries()) {
      r = await as[who].call("POST", `/api/leagues/${post}/draft/blind/lock`, { playerId: seatsPost[who], castawayIds: ids.slice(i, i + 3) });
      locks.push(r.status);
    }
    po = await stateOf(post);
    check(locks.every((x) => x === 200) && S.BlindDraftLogic.isRevealed(po) && S.Core.ownedCastawayIds(po, seatsPost.alex).length === 3, "  drafted in private through the blind lock route, from who's left, and revealed", JSON.stringify(locks));

    // ---------- Episode 8: the overall ----------
    // One of riley's Post-merge team (and nobody else's) goes home.
    const free8 = still(po).find((c) => (c.ownerIds || []).length === 1 && c.ownerIds[0] === seatsPost.riley) || still(po).find((c) => (c.ownerIds || []).includes(seatsPost.riley));
    await decide(8, "elimination", free8.name);
    pa = await stateOf(pre);
    po = await stateOf(post);
    await seen("alex", 8);
    view = await gameIn("alex", G);
    const a = S.computeScores(S.spanView(pa));
    const b = S.computeScores(po);
    check(S.gameOver(pa) && !S.gameOver(po), "Episode 8's result: Pre-merge is over (at 7), Post-merge plays on");
    check(!!view && IN.every((w) => view.table.find((x) => x.playerId === seatsG[w])?.total === ptsOf(a, seatsPre[w]) + ptsOf(b, seatsPost[w])) && new Set(view.table.map((x) => x.total)).size > 1,
      "  the game's table is each seat's two stages added up (alex's Pre-merge and riley's Post-merge each lost someone)", JSON.stringify({ game: view?.table?.map((x) => [x.name, x.total]), pre: a.map((x) => [x.name, x.total]), post: b.map((x) => [x.name, x.total]) }));
    // sam has seen through Episode 3: no stage has played at their mark.
    let samView = await gameIn("sam", G);
    check(!!samView && samView.table.every((x) => x.total === 0), "  sam, who has seen through Episode 3, sees every stage still to come", JSON.stringify(samView?.table?.map((x) => [x.name, x.total])));
    await seen("sam", 7);
    samView = await gameIn("sam", G);
    check(!!samView && IN.every((w) => samView.table.find((x) => x.playerId === seatsG[w])?.total === ptsOf(a, seatsPre[w])), "  through Episode 7: Pre-merge's final table, nothing yet from Post-merge", JSON.stringify(samView?.table?.map((x) => [x.name, x.total])));
    const hub = (await as.alex.call("GET", `/api/couches/${couch}/hub`)).body;
    const hubIds = (hub.games ?? []).map((x) => x.leagueId);
    check(hubIds.includes(G) && !hubIds.includes(pre) && !hubIds.includes(post), "  the couch's hub counts the game, never its stages", JSON.stringify(hubIds));
    st = await stateOf(G);
    check(st.players.length === 4 && !st.stageWalk, "  the game's own state stores no walk (worked out on every read)");

    // ---------- the desk deletes the game, and restores it ----------
    const stageRows = async () => (await pool.query("SELECT l.id, l.deleted_at IS NOT NULL AS gone, (SELECT count(*)::int FROM league_memberships m WHERE m.league_id = l.id) AS seats FROM leagues l WHERE l.stage_of = $1 ORDER BY l.id", [G])).rows;
    r = await as.desk.call("POST", `/api/desk/games/${G}`, { delete: true });
    let rows = await stageRows();
    check(r.status === 200 && rows.length === 2 && rows.every((x) => x.gone && x.seats === 0), "The desk deletes the game: its stages go with it, their memberships too", `${r.status} ${errorOf(r)} ${JSON.stringify(rows)}`);
    r = await as.desk.call("POST", `/api/desk/games/${G}`, { restore: true });
    rows = await stageRows();
    check(r.status === 200 && rows.every((x) => !x.gone && x.seats === 4), "  restored: its stages are back, the four seats' memberships mirrored", `${r.status} ${errorOf(r)} ${JSON.stringify(rows)}`);
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
