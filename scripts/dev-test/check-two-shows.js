// Dev-only check of one game across two shows (docs/PLAN-start-a-game-gpt.md step A12 part 4b: a stage's `season`, a league on another
// season; schema.js stagedProblems with ctx.seasons, engine-lab.ts makeStages on each stage's season, answer-points.ts stageWalk cutting a
// stage on another season at the viewer's mark there, StateLogic.StageLogic) against the dev server, through the API (no screens: they're
// the UI track's), on new-fixture.js's couch (ZT Survivor 51: results through Episode 5, Episode 6 three days off; ZT Traitors 5: results
// through Episode 3, Episode 4 tomorrow). In order:
//   - The engine lab checks it on Survivor's season with each stage's own rules: the game passes; a stage on a season that isn't set up,
//     and a Traitors stage scoring a Survivor moment, are refused.
//   - The desk's admin (zt_nd_desk, made here, on the couch) starts it: an Outlast of 2 each on Survivor to 13, then an Outlast of 2 each
//     on The Traitors 5. The game is a league on Survivor's season; its Survivor stage a league there (from 6, the next to air), its
//     Traitors stage a league on The Traitors' season (its cast, its results through 3; from 4, the next to air there), tied to it.
//   - alex, riley, jordan and sam join: seated in both stages under the same player id; a late joiner's mark isn't copied to The Traitors'.
//     The Traitors' draft opens at its start: once the seats × 2 outgrow the 7 still in there (Survivor's 13 would fit), it's shared,
//     with a line in its Recent changes. Survivor's is drafted through the pick route, The Traitors' in private (the blind lock route).
//   - The Traitors' Episode 4 result goes in through its own season's sync: it reaches the Traitors stage, never the game or its Survivor
//     stage; Survivor's Episode 6 result reaches those two, never the Traitors stage.
//   - The game's table on Survivor's Games tab, at each viewer's marks: alex (Survivor 6, no Traitors follow) sees the Survivor stage
//     only, then, at Traitors 4, both added up; riley (Traitors 2) sees none of The Traitors' 4, and sam (Survivor 3, Traitors 4) only The
//     Traitors'; read with no viewer, nothing of The Traitors' (spoiler-safe). The Traitors stage is
//     on The Traitors' Games tab; the game is on Survivor's only. The game isn't over (neither stage is).
//   - The game-specs flag's check passes on the game and both stages.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-two-shows.js [--keep]
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-two-shows runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const DESK = "zt_nd_desk";
const out = K.checker();
const { check } = out;
const { errorOf } = K;

const TRAITORS = { show: "zt-nd-traitors", number: 5 };
const OUTLAST = { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" } };
const STAGED = {
  stages: [
    { id: "survivor", name: "Survivor", game: { ...OUTLAST, span: { to: 13 } } },
    { id: "traitors", name: "The Traitors", season: TRAITORS, game: OUTLAST },
  ],
  overall: { by: "points" },
};

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    const tid = fx.traitorsSeasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = ANY($1::uuid[])", [[sid, tid]]);
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
    const changes = async (id) => (await pool.query("SELECT text FROM league_changes WHERE league_id = $1 ORDER BY created_at", [id])).rows.map((r) => r.text);
    const still = (s) => s.castaways.filter((c) => c.status === "active");
    /** A Traitors result accepted for episode n, then that season's sync (as the desk's accept does); the leagues it reached. */
    const decideTraitors = async (n, kind, name, method) => {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, $2, $3, $4, $5, '', 'accepted', true, now(), false)`,
        [tid, n, kind, name, method]
      );
      return (await syncSeasonLeagues(tid, null)).map((x) => x.leagueId);
    };
    const seenTraitors = (who, n) =>
      pool.query("INSERT INTO show_follows (user_id, season_id, seen_through) VALUES ($1, $2, $3) ON CONFLICT (user_id, season_id) DO UPDATE SET seen_through = EXCLUDED.seen_through", [fx.users[who], tid, n]);
    let r;

    // ---------- the lab's check: each stage on its own season's rules ----------
    r = await as.desk.call("POST", "/api/desk/lab", { action: "check", seasonId: sid, spec: JSON.stringify(STAGED) });
    check(r.status === 200 && r.body.problems?.length === 0 && r.body.startable && r.body.playsAs === "stages", "the engine lab passes a game across Survivor and The Traitors, on each one's rules", `${r.status} ${JSON.stringify(r.body.problems ?? errorOf(r))}`);
    check(/^A game in two stages for ZT Survivor 51 and ZT Traitors 5: .*then The Traitors on ZT Traitors 5, an Outlast/.test(r.body.describe?.sentence ?? ""), "  in words: on each season", r.body.describe?.sentence);
    r = await as.desk.call("POST", "/api/desk/lab", { action: "check", seasonId: sid, spec: JSON.stringify({ ...STAGED, stages: [STAGED.stages[0], { ...STAGED.stages[1], season: { show: "zt-nd-nope", number: 1 } }] }) });
    check(r.status === 200 && r.body.problems?.some((p) => p.at === "stages[1].season" && /isn't a season set up as a game here/.test(p.problem)), "  a stage on a season that isn't set up is refused", JSON.stringify(r.body.problems));
    const immunity = { ...STAGED.stages[1], game: { preset: "weekly-lineup", score: { by: "moments", points: { individualImmunity: 3 } } } };
    r = await as.desk.call("POST", "/api/desk/lab", { action: "check", seasonId: sid, spec: JSON.stringify({ ...STAGED, stages: [STAGED.stages[0], immunity] }) });
    check(r.status === 200 && r.body.problems?.some((p) => p.at === "stages[1].game.score.points.individualImmunity"), "  a Traitors stage scoring a Survivor moment is refused (its own season's rules)", JSON.stringify(r.body.problems));

    // ---------- the lab starts it: the game, a stage on each season ----------
    r = await as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(STAGED) });
    const G = r.body?.leagueId;
    check(r.status === 200 && !!G, "the desk's admin starts it from the engine lab", `${r.status} ${errorOf(r)}`);
    const parent = await stateOf(G);
    const rows = (await pool.query("SELECT id, stage_key, couch_id, state->'settings'->>'showId' AS show, state->'settings'->>'wikiSeason' AS season FROM leagues WHERE stage_of = $1 AND deleted_at IS NULL", [G])).rows;
    const SV = rows.find((x) => x.stage_key === "survivor")?.id;
    const TR = rows.find((x) => x.stage_key === "traitors")?.id;
    check(parent.settings.showId === "zt-nd-survivor" && rows.length === 2 && rows.every((x) => x.couch_id === couch), "  the game on Survivor's season, a league for each stage, tied to it, on the couch", JSON.stringify(rows));
    check(rows.find((x) => x.id === SV)?.show === "zt-nd-survivor" && rows.find((x) => x.id === TR)?.show === "zt-nd-traitors" && rows.find((x) => x.id === TR)?.season === "5", "  its Survivor stage on Survivor 51, its Traitors stage on The Traitors 5", JSON.stringify(rows.map((x) => [x.stage_key, x.show, x.season])));
    let sv = await stateOf(SV);
    let tr = await stateOf(TR);
    const cast = (await pool.query("SELECT name FROM season_cast WHERE season_id = $1 ORDER BY sort_order", [tid])).rows.map((x) => x.name);
    check(JSON.stringify(tr.castaways.map((c) => c.name).sort()) === JSON.stringify([...cast].sort()) && still(tr).length === 7, "  The Traitors' stage holds The Traitors' cast, three gone by its Episode 3", JSON.stringify({ n: tr.castaways.length, still: still(tr).length }));
    check(S.startEpisode(sv) === 6 && S.endEpisode(sv) === 13 && S.startEpisode(tr) === 4 && S.endEpisode(tr) === null, "  Survivor's from 6 to 13; The Traitors' from 4 (the next to air there) to its season's end", JSON.stringify([S.startEpisode(sv), S.endEpisode(sv), S.startEpisode(tr), S.endEpisode(tr)]));
    check(S.gameOf(tr).extras.draft.opens === "start" && !S.DraftLogic.waits(tr), "  The Traitors' draft opens at its start, Episode 3 there having results", String(S.DraftLogic.waits(tr)));

    // ---------- the four join: seated in both; The Traitors' draft counted there ----------
    for (const who of WHO) {
      r = await as[who].call("POST", `/api/couches/${couch}/games/${G}`, { action: "join" });
      check(r.status === 200, `  ${who} joins the game on the couch`, `${r.status} ${errorOf(r)}`);
    }
    const seatsG = await k.seatsOf(G);
    const seatsS = await k.seatsOf(SV);
    const seatsT = await k.seatsOf(TR);
    check(WHO.every((w) => seatsG[w] && seatsS[w] === seatsG[w] && seatsT[w] === seatsG[w]), "  each is seated in both stages under the same player id", JSON.stringify({ seatsG, seatsS, seatsT }));
    // A mark of the game's own (a late joiner's week: an episode of Survivor) on alex's seat, mirrored afresh into both stages.
    const { syncStages } = jiti("../../src/lib/server/db.ts");
    await pool.query("UPDATE league_memberships SET results_seen_through = 4 WHERE league_id = $1 AND user_id = $2", [G, fx.users.alex]);
    await pool.query("DELETE FROM league_memberships WHERE league_id = ANY($1::uuid[]) AND user_id = $2", [[SV, TR], fx.users.alex]);
    await syncStages(G, await stateOf(G));
    const marks = (await pool.query("SELECT l.stage_key, m.results_seen_through FROM league_memberships m JOIN leagues l ON l.id = m.league_id WHERE l.stage_of = $1 AND m.user_id = $2", [G, fx.users.alex])).rows;
    check(marks.length === 2 && marks.find((x) => x.stage_key === "survivor")?.results_seen_through === 4 && marks.find((x) => x.stage_key === "traitors")?.results_seen_through === null,
      "  a mark on the game (an episode of Survivor) is copied to its Survivor stage, never to The Traitors'", JSON.stringify(marks));
    tr = await stateOf(TR);
    const line = (await changes(TR)).find((x) => x.startsWith("The draft is shared"));
    const many = Number(/: (\d) of you/.exec(line ?? "")?.[1]);
    check(tr.settings.ownershipMode === "shared" && many * 2 > 7 && many * 2 <= 13, "The Traitors' draft, counted on its own season: once the seats outgrew the 7 still in there, it's shared (Survivor's 13 would fit)", JSON.stringify({ own: tr.settings.ownershipMode, order: S.gameOf(tr).get.order, line }));
    check(line === `The draft is shared: ${many} of you × 2 is more than the 7 still in, so two of you can have the same one`, "  whoever runs it hears, in its Recent changes", JSON.stringify(await changes(TR)));

    // ---------- the drafts ----------
    r = await as.desk.call("POST", `/api/leagues/${SV}/draft/force-start`, {});
    check(r.status === 200, "Survivor's draft starts", `${r.status} ${errorOf(r)}`);
    const whoOf = (seats) => (pid) => Object.keys(seats).find((w) => seats[w] === pid) ?? (pid === parent.players[0].id ? "desk" : null);
    let picks = 0;
    for (let guard = 0; guard < 20; guard++) {
      sv = await stateOf(SV);
      const turn = S.currentDraftTurn(sv);
      if (!turn || turn.isComplete) break;
      const free = sv.castaways.find((c) => c.status === "active" && !(c.ownerIds || []).length);
      r = await as[whoOf(seatsS)(turn.playerId)].call("POST", `/api/leagues/${SV}/draft/pick`, { castawayId: free.id });
      if (r.status === 200) picks++;
    }
    sv = await stateOf(SV);
    check(picks === 10 && sv.draftPicksMade === 10, "  drafted through the pick route: 5 of you × 2", JSON.stringify({ picks, made: sv.draftPicksMade }));
    r = await as.desk.call("POST", `/api/leagues/${TR}/draft/force-start`, {});
    check(r.status === 200, "The Traitors' draft starts", `${r.status} ${errorOf(r)}`);
    const ids = still(tr).map((c) => c.id);
    const locks = [];
    for (const [i, who] of ["desk", ...WHO].entries()) {
      const seat = who === "desk" ? parent.players[0].id : seatsT[who];
      r = await as[who].call("POST", `/api/leagues/${TR}/draft/blind/lock`, { playerId: seat, castawayIds: [ids[i % ids.length], ids[(i + 1) % ids.length]] });
      locks.push(r.status);
    }
    tr = await stateOf(TR);
    check(locks.every((x) => x === 200) && S.BlindDraftLogic.isRevealed(tr), "  drafted in private through the blind lock route, from The Traitors' cast, and revealed", JSON.stringify(locks));

    // ---------- each season's result reaches its own stage only ----------
    // The Traitors' Episode 4: someone on riley's and jordan's teams there is murdered.
    const rileys = still(tr).find((c) => (c.ownerIds || []).includes(seatsT.riley));
    let reached = await decideTraitors(4, "elimination", rileys.name, "Murdered");
    tr = await stateOf(TR);
    check(S.episodeHasResults(tr.episodes.find((e) => e.number === 4)) && reached.includes(TR) && !reached.includes(G) && !reached.includes(SV),
      `The Traitors' Episode 4 (${rileys.name} murdered) goes in through its own season's sync: its stage only`, JSON.stringify({ TR: reached.includes(TR), G: reached.includes(G), SV: reached.includes(SV) }));
    // Survivor's Episode 6: one of alex's team there goes home.
    const alexs = still(sv).find((c) => (c.ownerIds || []).includes(seatsS.alex));
    await decide(6, "elimination", alexs.name);
    sv = await stateOf(SV);
    const gs = await stateOf(G);
    tr = await stateOf(TR);
    check(S.episodeHasResults(sv.episodes.find((e) => e.number === 6)) && S.episodeHasResults(gs.episodes.find((e) => e.number === 6)) && !S.episodeHasResults(tr.episodes.find((e) => e.number === 6) || { events: [] }),
      `  Survivor's Episode 6 (${alexs.name} goes home) reaches the game and its Survivor stage, never The Traitors'`);
    check(!(tr.castaways || []).some((c) => c.name === alexs.name), "  (Survivor's cast is never on The Traitors' stage)");

    // ---------- the game's table at each viewer's marks ----------
    const ptsOf = (state, pid) => S.computeScores(state).find((x) => x.playerId === pid)?.total ?? 0;
    const totals = (g) => Object.fromEntries((g?.table ?? []).map((t) => [Object.keys(seatsG).find((w) => seatsG[w] === t.playerId) ?? t.name, t.total]));
    await seen("alex", 6);
    let gt = totals(await gameIn("alex", G));
    check(WHO.every((w) => gt[w] === ptsOf(S.spanView(sv), seatsS[w])), "alex, through Survivor 6 and following no Traitors: the game's table is the Survivor stage alone", JSON.stringify({ gt, sv: WHO.map((w) => ptsOf(sv, seatsS[w])) }));
    await seenTraitors("alex", 4);
    gt = totals(await gameIn("alex", G));
    const both = Object.fromEntries(WHO.map((w) => [w, ptsOf(sv, seatsS[w]) + ptsOf(tr, seatsT[w])]));
    check(WHO.every((w) => gt[w] === both[w]) && WHO.some((w) => ptsOf(tr, seatsT[w]) > 0), "  at The Traitors 4 too: each seat's two stages added up", JSON.stringify({ gt, both }));
    await seen("riley", 6);
    const rt = totals(await gameIn("riley", G));
    check(WHO.every((w) => rt[w] === ptsOf(sv, seatsS[w])), "  riley, through Survivor 6 but The Traitors 2: none of The Traitors' 4 (its stage starts there)", JSON.stringify(rt));
    await seenTraitors("sam", 4);
    const st = totals(await gameIn("sam", G));
    check(WHO.every((w) => (st[w] ?? 0) === ptsOf(tr, seatsT[w])), "  sam, behind at Survivor 3 but through The Traitors 4: The Traitors' stage alone (each season at its own mark)", JSON.stringify(st));
    const { asItStands } = jiti("../../src/lib/server/answer-points.ts");
    const safe = S.StageLogic.standings((await asItStands(G, await stateOf(G))).state);
    check(safe.find((x) => x.key === "traitors")?.started === false, "  read with no viewer, The Traitors' stage shows nothing (spoiler-safe)", JSON.stringify(safe.map((x) => [x.key, x.season, x.started])));
    const whole = (await asItStands(G, await stateOf(G), undefined, "all")).state;
    const stands = S.StageLogic.standings(whole);
    check(JSON.stringify(stands.map((x) => [x.key, x.season, x.from, x.to, x.started, x.over])) === JSON.stringify([["survivor", null, 6, 13, true, false], ["traitors", "zt-nd-traitors/5", 4, null, true, false]]),
      "  the stages as the server reads them whole: Survivor's from 6, The Traitors' from its own 4", JSON.stringify(stands.map((x) => [x.key, x.season, x.from, x.to, x.started, x.over])));
    check(!S.gameOver(whole) && S.StageLogic.crosses(whole), "  the game isn't over: neither stage is");

    // ---------- the lists: each league on its own season ----------
    const onSurvivor = ((await as.alex.call("GET", `/api/seasons/${sid}/games?couch=${couch}`)).body.games ?? []).map((g) => g.leagueId);
    const onTraitors = ((await as.alex.call("GET", `/api/seasons/${tid}/games?couch=${couch}`)).body.games ?? []).map((g) => g.leagueId);
    check(onSurvivor.includes(G) && onSurvivor.includes(SV) && !onSurvivor.includes(TR), "Survivor's Games tab: the game and its Survivor stage", JSON.stringify({ G: onSurvivor.includes(G), SV: onSurvivor.includes(SV), TR: onSurvivor.includes(TR) }));
    check(onTraitors.includes(TR) && !onTraitors.includes(G), "  The Traitors': its Traitors stage, as a game of its own (the game itself is Survivor's)", JSON.stringify({ TR: onTraitors.includes(TR), G: onTraitors.includes(G) }));

    // ---------- the flag ----------
    for (const [id, what] of [[G, "the game"], [SV, "the Survivor stage"], [TR, "the Traitors stage"]]) {
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
