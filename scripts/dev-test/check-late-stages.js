// Dev-only check of late joiners in a game in stages (docs/PLAN-start-a-game-gpt.md step A12 part 4c: state-logic.js
// StageLogic.joinsOf and closed, couch-joins.ts joinStaged and stagedOptions, stages.ts seatStage, lateStages and stagesBegun,
// backstage-members.ts freeSeat, db.ts syncStagesFor) against the dev server, through the API (no screens: they're the UI track's), on
// new-fixture.js's couch (ZT Survivor 51: 13 episodes, results through Episode 5, Episode 6 three days off, its rulebook Tribes then
// Merged; sam has seen through Episode 3). In order:
//   - The desk's admin (zt_nd_desk, made here) starts two games in stages from the engine lab: A, Pre-merge (an Outlast of 2 each,
//     exclusive, from Episode 6 until Merged) then Post-merge (an Outlast of 3 each from Merged, its draft at its start); B, a Survival
//     Pool with a life each, then an Outlast from Merged. alex, riley and jordan join A, alex and riley B, before either starts; A's
//     Pre-merge is drafted through the pick route; in B's pool alex picks the castaway who goes home in Episode 6.
//   - Episode 6's result: both games have started. A takes someone new (its stages take a late joiner), B doesn't (alex is out of its
//     pool: nobody new where a stage knocks people out).
//   - sam asks A's join options: live from Episode 7 only (no catching up), a team of 2 from who's free in Pre-merge. A catch-up start
//     and a team with someone drafted are refused; then sam joins live with two free castaways: seated in A, a late joiner from 7 in
//     Pre-merge with that team, seen at once, their mark where they are; in Post-merge's draft as anyone. sam can't join B.
//   - jordan leaves A (a stage has begun): A keeps the seat, disabled; Pre-merge keeps it with its team; Post-merge lets it go. jordan
//     comes back through the couch's join: the same seat in A and Pre-merge (team and all), seated again in Post-merge under that id.
//   - The desk makes riley an admin of A and back (a membership write, no write to the game): each stage's membership follows at once.
//   - The desk confirms Merged at 8; Episode 7's result: Pre-merge is over, Post-merge's draft opens with five in its rotation (sam and
//     jordan counted), shared.
//   - kim (zt_nd_kim, made here) joins A now: no team to pick (Post-merge drafts later), seated in A and Post-merge's draft, never in
//     Pre-merge (over: it counts nothing for them); A's table has kim on 0 from Pre-merge.
//   - riley leaves A (gone from Post-merge, not begun); Episode 8's result begins Post-merge; riley comes back through the couch's join
//     with a team of 3: the same seat, Post-merge's late joiner from Episode 9 with that team.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-late-stages.js [--keep]
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-late-stages runs against a local database only");
const keep = process.argv.includes("--keep");
const out = K.checker();
const { check } = out;
const { errorOf } = K;

const OUTLAST = (each) => ({ preset: "outlast", get: { by: "draft", each, order: "snake", own: "exclusive" } });
const A_SPEC = {
  stages: [
    { id: "pre", name: "Pre-merge", game: OUTLAST(2) },
    { id: "post", name: "Post-merge", game: { ...OUTLAST(3), span: { from: { phase: "merged" } } } },
  ],
  overall: { by: "points" },
};
const B_SPEC = {
  stages: [
    { id: "pool", name: "Pool", game: { preset: "survival-pool", score: { by: "survive", lives: 1 } } },
    { id: "after", name: "After", game: { ...OUTLAST(2), span: { from: { phase: "merged" } } } },
  ],
  overall: { by: "places" },
};

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    // Two zt_nd_ people of this check's own (fixture.down removes them), on the couch: the desk's admin and a late newcomer.
    const { hashPassword } = await import("better-auth/crypto");
    const person = async (name, role) => {
      const id = crypto.randomUUID();
      await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, now(), now())`, [id, name, `${name}@example.invalid`, role]);
      await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, await hashPassword(fixture.PASSWORD)]);
      await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'member', 'couch')", [couch, id]);
      return id;
    };
    fx.users.desk = await person("zt_nd_desk", "admin");
    fx.users.kim = await person("zt_nd_kim", "user");
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam", "kim", "desk"]) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const k = K.kit({ pool, fx, as, specsOn });
    const { decide, stateOf, seatsOf } = k;
    const membership = async (id, who) => (await pool.query("SELECT player_id, role, results_seen_through FROM league_memberships WHERE league_id = $1 AND user_id = $2", [id, fx.users[who]])).rows[0] ?? null;
    const games = async (who = "alex") => (await as[who].call("GET", `/api/couches/${couch}/games`)).body.games ?? [];
    const still = (s) => s.castaways.filter((c) => c.status === "active");
    const teamOf = (s, pid) => s.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id).sort();
    let r;

    // ---------- the two games, made and joined before they start ----------
    const start = async (spec) => (await as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(spec) })).body?.leagueId;
    const A = await start(A_SPEC);
    const B = await start(B_SPEC);
    const stageOf = async (g, key) => (await pool.query("SELECT id FROM leagues WHERE stage_of = $1 AND stage_key = $2", [g, key])).rows[0]?.id;
    const pre = await stageOf(A, "pre");
    const post = await stageOf(A, "post");
    const poolStage = await stageOf(B, "pool");
    check(!!A && !!B && !!pre && !!post && !!poolStage, "the desk's admin starts two games in stages from the engine lab, each stage a league of its own");
    for (const [who, g] of [["alex", A], ["riley", A], ["jordan", A], ["alex", B], ["riley", B]]) {
      r = await as[who].call("POST", `/api/couches/${couch}/games/${g}`, { action: "join" });
      check(r.status === 200, `  ${who} joins ${g === A ? "A" : "B"} before it starts`, `${r.status} ${errorOf(r)}`);
    }
    r = await as.desk.call("POST", `/api/leagues/${pre}/draft/force-start`, {});
    const seatsPre0 = await seatsOf(pre);
    const whoOf = (pid) => Object.keys(seatsPre0).find((w) => seatsPre0[w] === pid);
    for (let guard = 0; guard < 20; guard++) {
      const s = await stateOf(pre);
      const turn = S.currentDraftTurn(s);
      if (!turn || turn.isComplete) break;
      const free = s.castaways.find((c) => c.status === "active" && !(c.ownerIds || []).length);
      await as[whoOf(turn.playerId)].call("POST", `/api/leagues/${pre}/draft/pick`, { castawayId: free.id });
    }
    let pa = await stateOf(pre);
    check(pa.draftPicksMade === 8, "  A's Pre-merge drafted through the pick route: 4 of you × 2", String(pa.draftPicksMade));
    // B's pool: alex picks the castaway who goes home in Episode 6 (nobody's in A), riley someone else.
    const free = still(pa).filter((c) => !(c.ownerIds || []).length);
    const six = free[0];
    let pb = await stateOf(poolStage);
    const ep6 = pb.episodes.find((e) => e.number === 6);
    const seatsPool = await seatsOf(poolStage);
    const pick = async (who, name) => as[who].call("PUT", `/api/leagues/${poolStage}/episodes/${ep6.id}/picks`, { playerId: seatsPool[who], castawayId: pb.castaways.find((c) => c.name === name).id });
    const picks = [(await pick("alex", six.name)).status, (await pick("riley", free[1].name)).status];
    pb = await stateOf(poolStage);
    const stored = (who) => (pb.episodes.find((e) => e.number === 6).picks || []).some((x) => x.playerId === seatsPool[who]);
    check(picks.every((x) => x === 200) && !!stored("alex") && !!stored("riley"), "  in B's pool alex picks who goes home in Episode 6, riley someone who stays", JSON.stringify({ picks, stored: pb.episodes.find((e) => e.number === 6).picks }));

    // ---------- Episode 6: both games have started ----------
    await decide(6, "elimination", six.name);
    let list = await games();
    const gA = list.find((g) => g.leagueId === A);
    const gB = list.find((g) => g.leagueId === B);
    check(!!gA && gA.underway && gA.mode !== "locked", "Episode 6's result: A has started and takes someone new (its stages take a late joiner)", JSON.stringify(gA && { underway: gA.underway, mode: gA.mode }));
    check(!!gB && gB.mode === "locked", "  B doesn't: alex is out of its pool, so nobody new joins it (A11 part 5c's rule, one rule for the game)", JSON.stringify(gB && gB.mode));

    // ---------- sam joins A live, a late joiner in Pre-merge ----------
    r = await as.sam.call("GET", `/api/couches/${couch}/games/${A}?start=7`);
    const opts = r.body;
    pa = await stateOf(pre);
    const freeNow = still(pa).filter((c) => !(c.ownerIds || []).length).map((c) => c.id).sort();
    check(r.status === 200 && opts.starts?.live === 7 && opts.starts?.catchUp === null && opts.start === 7 && opts.team === 2, "sam's options: live from Episode 7 only (no catching up), a team of 2", `${r.status} ${JSON.stringify(opts && { starts: opts.starts, start: opts.start, team: opts.team })}`);
    check(JSON.stringify((opts.pool ?? []).map((c) => c.id).sort()) === JSON.stringify(freeNow), "  to pick from who's free in Pre-merge (its castaways are one team's each)", JSON.stringify({ offered: (opts.pool ?? []).length, free: freeNow.length }));
    r = await as.sam.call("POST", `/api/couches/${couch}/games/${A}`, { action: "join", start: 1, team: freeNow.slice(0, 2) });
    check(r.status === 400 && /start from Episode 7/.test(errorOf(r)), "  catching up is refused", `${r.status} ${errorOf(r)}`);
    const taken = pa.castaways.find((c) => (c.ownerIds || []).length && c.status === "active").id;
    r = await as.sam.call("POST", `/api/couches/${couch}/games/${A}`, { action: "join", start: 7, team: [taken, freeNow[0]] });
    check(r.status === 400 && /still in the game/.test(errorOf(r)), "  so is a team with someone drafted, before anything's written", `${r.status} ${errorOf(r)}`);
    check(!(await membership(A, "sam")), "  (sam isn't in A after either)");
    r = await as.sam.call("POST", `/api/couches/${couch}/games/${A}`, { action: "join", start: 7, team: freeNow.slice(0, 2) });
    check(r.status === 200 && r.body.start === 7 && r.body.catchingUp === false, "  sam joins live from Episode 7 with two free castaways", `${r.status} ${errorOf(r)}`);
    const sA = await membership(A, "sam");
    const sPre = await membership(pre, "sam");
    const sPost = await membership(post, "sam");
    const ga = await stateOf(A);
    pa = await stateOf(pre);
    let po = await stateOf(post);
    const samA = ga.players.find((p) => p.id === sA?.player_id);
    const samPre = pa.players.find((p) => p.id === sA?.player_id);
    const samPost = po.players.find((p) => p.id === sA?.player_id);
    check(!!samA && !samA.ghost && samA.active !== false && samA.lateJoin?.startEpisode === 7 && sA.results_seen_through === 3, "  in A: seen at once, from Episode 7, their mark where they are (Episode 3)", JSON.stringify({ samA, mark: sA?.results_seen_through }));
    check(!!samPre && !samPre.ghost && samPre.lateJoin?.startEpisode === 7 && samPre.lateJoin?.catchingUp === false && sPre?.player_id === sA.player_id && sPre.results_seen_through === 3,
      "  in Pre-merge: the same seat, its own late joiner from 7, live, seen at once, the same mark", JSON.stringify({ samPre, sPre }));
    check(JSON.stringify(teamOf(pa, sA.player_id)) === JSON.stringify(freeNow.slice(0, 2).sort()), "  with the team they picked");
    check(!!samPost && !samPost.lateJoin && po.draftOrder.includes(sA.player_id) && sPost?.player_id === sA.player_id, "  in Post-merge: in its draft, as anyone (it starts later)", JSON.stringify({ samPost, order: po.draftOrder }));
    r = await as.sam.call("POST", `/api/couches/${couch}/games/${B}`, { action: "join" });
    check(r.status === 403 && /Nobody new can join/.test(errorOf(r)), "  sam can't join B", `${r.status} ${errorOf(r)}`);

    // ---------- jordan leaves A and comes back: the same seat ----------
    const jSeat = (await membership(A, "jordan")).player_id;
    const jTeam = teamOf(pa, jSeat);
    r = await as.jordan.call("POST", `/api/leagues/${A}/leave`, {});
    let gaNow = await stateOf(A);
    pa = await stateOf(pre);
    po = await stateOf(post);
    const jA = gaNow.players.find((p) => p.id === jSeat);
    check(r.status === 200 && !!jA && jA.disabled === true && jA.disabledFromUserId === fx.users.jordan, "jordan leaves A: a stage has begun, so A keeps the seat, disabled, their account on it", `${r.status} ${JSON.stringify(jA)}`);
    check(pa.players.find((p) => p.id === jSeat)?.disabled === true && JSON.stringify(teamOf(pa, jSeat)) === JSON.stringify(jTeam) && !po.players.some((p) => p.id === jSeat),
      "  Pre-merge keeps it with its team; Post-merge (not begun) lets it go");
    check(!(await membership(pre, "jordan")) && !(await membership(post, "jordan")), "  their memberships gone from both stages");
    r = await as.jordan.call("POST", `/api/couches/${couch}/games/${A}`, { action: "join" });
    gaNow = await stateOf(A);
    pa = await stateOf(pre);
    po = await stateOf(post);
    check(r.status === 200 && (await membership(A, "jordan"))?.player_id === jSeat && gaNow.players.find((p) => p.id === jSeat)?.disabled === false, "  jordan comes back through the couch's join: their own seat in A", `${r.status} ${errorOf(r)}`);
    check(pa.players.find((p) => p.id === jSeat)?.disabled === false && JSON.stringify(teamOf(pa, jSeat)) === JSON.stringify(jTeam) && (await membership(pre, "jordan"))?.player_id === jSeat,
      "  the same seat in Pre-merge, team and all, never a second one", JSON.stringify(pa.players.map((p) => [p.name, p.disabled])));
    check(po.players.some((p) => p.id === jSeat && !p.disabled) && po.draftOrder.includes(jSeat) && (await membership(post, "jordan"))?.player_id === jSeat, "  seated again in Post-merge's draft under that id");

    // ---------- a membership write with no write to the game: each stage follows at once ----------
    r = await as.desk.call("POST", `/api/desk/seats/${A}/${fx.users.riley}`, { role: "admin" });
    const rolesNow = async () => [await membership(pre, "riley"), await membership(post, "riley")].map((m) => m?.role);
    check(r.status === 200 && (await rolesNow()).every((x) => x === "admin"), "The desk makes riley an admin of A: each stage's membership follows at once", `${r.status} ${errorOf(r)} ${JSON.stringify(await rolesNow())}`);
    r = await as.desk.call("POST", `/api/desk/seats/${A}/${fx.users.riley}`, { role: "member" });
    check(r.status === 200 && (await rolesNow()).every((x) => x === "member"), "  and back", JSON.stringify(await rolesNow()));

    // ---------- Merged at 8; Episode 7: Pre-merge over, Post-merge's draft opens with five ----------
    const season = (await as.desk.call("GET", `/api/desk/seasons/${sid}`)).body;
    r = await as.desk.call("POST", `/api/desk/rulebooks/${season.rulebook?.id}`, { action: "phase", phaseId: "merged", episode: 8 });
    pa = await stateOf(pre);
    const seven = still(pa).find((c) => !(c.ownerIds || []).length);
    await decide(7, "elimination", seven.name);
    pa = await stateOf(pre);
    po = await stateOf(post);
    const left = still(po).length;
    check(r.status === 200 && S.gameOver(pa) && S.StageLogic.joinsOf(pa) === "over", "Merged at 8, Episode 7's result: Pre-merge is over", JSON.stringify({ end: S.endEpisode(pa) }));
    check(po.settings.ownershipMode === "shared" && S.DraftLogic.waits(po) === null, `  Post-merge's draft opens: 5 of you × 3 (sam and jordan counted) is more than the ${left} still in, so it's shared`, JSON.stringify({ own: po.settings.ownershipMode, order: po.draftOrder.length }));
    check((await pool.query("SELECT 1 FROM league_changes WHERE league_id = $1 AND text = $2", [post, `The draft is shared: 5 of you × 3 is more than the ${left} still in, so two of you can have the same one`])).rows.length === 1, "  said in its Recent changes, with five");

    // ---------- kim joins A now: Post-merge only ----------
    r = await as.kim.call("GET", `/api/couches/${couch}/games/${A}?start=8`);
    check(r.status === 200 && r.body.starts?.live === 8 && r.body.team === 0 && (r.body.pool ?? []).length === 0, "kim's options: live from Episode 8, no team to pick (Post-merge drafts later)", `${r.status} ${JSON.stringify(r.body && { starts: r.body.starts, team: r.body.team })}`);
    r = await as.kim.call("POST", `/api/couches/${couch}/games/${A}`, { action: "join", start: 8 });
    const kA = await membership(A, "kim");
    pa = await stateOf(pre);
    po = await stateOf(post);
    check(r.status === 200 && !!kA, "  kim joins A from Episode 8", `${r.status} ${errorOf(r)}`);
    check(!pa.players.some((p) => p.id === kA?.player_id) && !(await membership(pre, "kim")), "  never seated in Pre-merge: it's over, and counts nothing for them");
    check(po.players.some((p) => p.id === kA?.player_id && !p.ghost && !p.lateJoin) && po.draftOrder.includes(kA?.player_id) && (await membership(post, "kim"))?.player_id === kA?.player_id, "  in Post-merge's draft, as anyone");
    list = await games();
    check(list.find((g) => g.leagueId === A)?.mode !== "locked", "  A still takes someone new (no stage keeps them waiting)");
    const view = await k.gameIn("alex", A);
    const kimRow = view?.table?.find((x) => x.playerId === kA?.player_id);
    check(!!kimRow && kimRow.total === 0, "  on A's table, kim on 0: Pre-merge counts nothing for them", JSON.stringify(view?.table?.map((x) => [x.name, x.total])));

    // ---------- riley leaves, Post-merge begins while they're away, riley comes back ----------
    const rSeat = (await membership(A, "riley")).player_id;
    r = await as.riley.call("POST", `/api/leagues/${A}/leave`, {});
    po = await stateOf(post);
    check(r.status === 200 && !po.players.some((p) => p.id === rSeat) && (await stateOf(pre)).players.find((p) => p.id === rSeat)?.disabled === true, "riley leaves A: kept (disabled) in Pre-merge, gone from Post-merge (not begun)", `${r.status} ${errorOf(r)}`);
    po = await stateOf(post);
    const eight = still(po)[0];
    await decide(8, "elimination", eight.name);
    po = await stateOf(post);
    check(S.StageLogic.joinsOf(po) === "late", "  Episode 8's result: Post-merge has begun while they're away", S.StageLogic.joinsOf(po));
    r = await as.riley.call("GET", `/api/couches/${couch}/games/${A}?start=9`);
    const offered = (r.body.pool ?? []).map((c) => c.id);
    check(r.status === 200 && r.body.team === 3 && offered.length === still(po).length, "  their options: a team of 3 from who's still in (Post-merge is shared)", `${r.status} ${JSON.stringify(r.body && { team: r.body.team, pool: offered.length })}`);
    r = await as.riley.call("POST", `/api/couches/${couch}/games/${A}`, { action: "join", team: offered.slice(0, 3) });
    po = await stateOf(post);
    const rPost = po.players.find((p) => p.id === rSeat);
    check(r.status === 200 && !r.body.waits && (await membership(A, "riley"))?.player_id === rSeat, "  riley comes back: their own seat in A", `${r.status} ${errorOf(r)} ${JSON.stringify(r.body)}`);
    check(!!rPost && !rPost.ghost && !rPost.disabled && rPost.lateJoin?.startEpisode === 9 && JSON.stringify(teamOf(po, rSeat)) === JSON.stringify(offered.slice(0, 3).sort()) && (await membership(post, "riley"))?.player_id === rSeat,
      "  Post-merge takes them as its late joiner, live from Episode 9, under the same id, with the team they picked", JSON.stringify(rPost));
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
