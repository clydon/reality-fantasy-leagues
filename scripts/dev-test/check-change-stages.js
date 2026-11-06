// Dev-only check of a stage a format change starts (docs/PLAN-start-a-game-gpt.md step A12 part 2: a later stage's `on`, the game's
// extras.changes, state-logic.js StageLogic.changePlan; src/lib/server/change-stages.ts from the season sync; the stage-changes route)
// against the dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (ZT Survivor 51: 13
// episodes, results through Episode 5, Episode 6 three days off). Its season is played in pairs from Episode 4, as research stores it
// (episode_research's combined answer and its format section; check-format-groups.js's rows). In order:
//   - The desk's admin (zt_nd_desk, made here, on the couch) starts "a solo draft, and a new draft whenever the game splits into
//     individuals or pairs form" from the engine lab: an Outlast of 2 each from Episode 6, a stage a change starts again. Only the
//     first stage is made (the next is made when its change comes); alex, riley, jordan and sam join; the solo draft is drafted.
//   - Episode 6's research says everyone plays on their own from 7 (at its end, sure), and its result goes in: the season sync makes a
//     copy of the new draft (its own league, tied to the game, the game's seats under the same ids), from Episode 7; the solo stage
//     ends with 6; the game and each stage say so in Recent changes; GET stage-changes lists it, only once you've seen Episode 6 (a
//     change is as much a spoiler as a result). Its draft opens at once (6 has results) and is drafted.
//   - Episode 7: pairs formed from 8, but research isn't sure: held, said, nothing made. The game's table is each seat's two stages.
//   - Episode 6's research corrected (no split after all): the copy is taken away (soft-deleted, its points with it), the solo stage
//     plays on; corrected back: the copy is back, from the first episode still open (8), the solo stage ending with 7.
//   - The game turned to the maker's OK (the carry-on default): Episode 8's research says everyone on their own from 9 again: it waits
//     for the maker, nothing made; a player can't answer it (403); the maker starts it (a second copy from 9, the first ending with
//     8), then calls it off (taken away, the first plays on).
//   - Deleted and restored, the game's live stages come back and the copy called off stays away.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-change-stages.js [--keep]
//
// One fixed scenario on purpose (its episodes and changes are the story above), run again whenever stages or the format's readers
// change. Brings new-fixture.js up and takes it down (--keep leaves it); the research rows go with the zt show. Touches zt rows only;
// refuses a non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then
// ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const K = require("./check-kit");
const S = require("../../src/lib/game/state-logic.js");
const GameSpecs = require("../../db/game-specs.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-change-stages runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const DESK = "zt_nd_desk";
const SHOW = "zt-nd-survivor";
const out = K.checker();
const { check } = out;
const { errorOf } = K;

const DRAFT = { by: "draft", each: 2, order: "snake", own: "exclusive" };
const SPEC = {
  stages: [
    { id: "solo", name: "Solo", game: { preset: "outlast", get: DRAFT } },
    { id: "re", name: "New draft", on: { change: ["split-into-individuals", "pairs-formed"], again: true }, game: { preset: "outlast", get: DRAFT } },
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
    const { decide, seen, stateOf, gameIn } = k;
    const changes = async (id) => (await pool.query("SELECT text FROM league_changes WHERE league_id = $1 ORDER BY created_at", [id])).rows.map((r) => r.text);
    const stageRows = async (G) => (await pool.query("SELECT id, stage_key, deleted_at IS NOT NULL AS gone, (SELECT count(*)::int FROM league_memberships m WHERE m.league_id = l.id) AS seats FROM leagues l WHERE stage_of = $1 ORDER BY created_at", [G])).rows;
    const live = async (G) => (await stageRows(G)).filter((x) => !x.gone);
    let r;

    // ---------- the season in pairs, as research stores it ----------
    const showId = (await pool.query("SELECT id FROM shows WHERE slug = $1", [SHOW])).rows[0].id;
    const cast = [...(await stateOf((await pool.query("SELECT id FROM leagues WHERE couch_id = $1 AND deleted_at IS NULL LIMIT 1", [couch])).rows[0].id)).castaways].sort((a, b) => (a.placementOrder ?? 99) - (b.placementOrder ?? 99));
    const N = (i) => cast[i].name;
    const pairs = (from, to) => Array.from({ length: (to - from + 1) / 2 }, (_, j) => ({ name: null, members: [N(from + 2 * j), N(from + 2 * j + 1)] }));
    const section = (groups, extra = {}) => ({ playedAs: "pairs", phase: null, groups, alone: [], newcomers: [], wentHomeAs: "individuals", changes: [], ...extra });
    const store = (n, formatState, outNames) =>
      pool.query(
        `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance) VALUES ($1, 51, $2, $3::jsonb, '{"provider":"zt-check"}'::jsonb)
         ON CONFLICT (show_id, season_number, episode_number) WHERE source = 'combined' DO UPDATE SET payload = EXCLUDED.payload`,
        [showId, n, JSON.stringify({ summary: `Episode ${n}.`, formatState, castaways: outNames.map((name) => ({ name, leftTheGame: "yes" })) })]
      );
    for (let n = 1; n <= 3; n++) await store(n, null, [N(n - 1)]);
    await store(4, section(pairs(4, 17)), [N(3)]);
    await store(5, section(pairs(6, 17), { alone: [N(5)] }), [N(4)]);
    const split = (n, from, sure = "high") => ({ kind: "split-into-individuals", when: "end", from, what: `Everyone plays on their own from Episode ${from}.`, sure });
    const ep6 = (withSplit) => store(6, withSplit ? section([], { alone: [], changes: [split(6, 7)] }) : section(pairs(6, 17)), [N(5)]);

    // ---------- the engine lab: the game, and only its first stage ----------
    r = await as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(SPEC) });
    const G = r.body?.leagueId;
    check(r.status === 200 && !!G, "the desk's admin starts a solo draft and a new draft at each split or pairing, from the engine lab", `${r.status} ${errorOf(r)}`);
    let parent = await stateOf(G);
    let rows = await stageRows(G);
    const solo = rows.find((x) => x.stage_key === "solo")?.id;
    check(S.StageLogic.on(parent) && S.StageLogic.onStages(parent).map((x) => x.id).join() === "re" && rows.length === 1 && !!solo, "  only the first stage is made: the new draft is made when its change comes", JSON.stringify(rows));
    check(S.StageLogic.changesOf(parent)?.ok === "auto" && S.StageLogic.changesOf(parent)?.unanswered === "start", "  by itself, with an undo (the default)", JSON.stringify(S.StageLogic.changesOf(parent)));
    let so = await stateOf(solo);
    check(S.startEpisode(so) === 6 && S.endEpisode(so) === null, "  Solo from Episode 6 (the next to air), until the format changes", JSON.stringify(so.settings.startEpisode));
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
    let d = await draft(solo);
    check(d.picks === 10, "  Solo is drafted through the pick route: 5 of you × 2", JSON.stringify(d));

    // ---------- Episode 6: everyone on their own from 7: a copy of the new draft ----------
    await ep6(true);
    await decide(6, "elimination", N(5));
    rows = await live(G);
    const copy = rows.find((x) => x.stage_key === "re@6:split-into-individuals")?.id;
    check(!!copy && rows.length === 2, "Episode 6's research says everyone plays on their own from 7: the season sync makes a copy of the new draft", JSON.stringify(rows));
    let co = copy ? await stateOf(copy) : null;
    so = await stateOf(solo);
    const seatsCopy = copy ? await k.seatsOf(copy) : {};
    check(!!co && S.startEpisode(co) === 7 && S.endEpisode(co) === null && S.endEpisode(so) === 6, "  it plays from Episode 7; Solo ends with 6", JSON.stringify({ copy: co && [S.startEpisode(co), S.endEpisode(co)], solo: S.endEpisode(so) }));
    check(!!co && WHO.every((w) => seatsCopy[w] === seatsG[w]) && co.players.length === 5, "  the game's five seats in it, under the same ids, their accounts on it", JSON.stringify({ seatsCopy, seatsG }));
    const tied = copy ? (await pool.query("SELECT name, couch_id, stage_of FROM leagues WHERE id = $1", [copy])).rows[0] : null;
    check(!!tied && tied.stage_of === G && tied.couch_id === couch && /New draft/.test(tied.name), "  tied to the game, on the same couch, named for its stage", JSON.stringify(tied));
    check((await changes(G)).some((t) => /^The format changed \(everyone went on to play on their own, from Episode 7\): New draft starts with Episode 7$/.test(t)), "  the game's Recent changes say what changed and what the game did", JSON.stringify(await changes(G)));
    check((await changes(solo)).some((t) => /^Plays Episodes 6 to 6: the next stage starts at a format change$/.test(t)) && (copy ? await changes(copy) : []).some((t) => /^New draft of Lab · .*, from Episode 7: the format changed/.test(t)), "  and each stage's", JSON.stringify({ solo: await changes(solo), copy: copy && (await changes(copy)) }));
    r = await as.alex.call("GET", `/api/leagues/${G}/stage-changes`);
    check(r.status === 200 && r.body.started?.length === 0 && r.body.later === 1, "  GET stage-changes keeps it from alex, who hasn't seen Episode 6 (one more past his mark)", `${r.status} ${JSON.stringify(r.body)}`);
    await seen("alex", 6);
    r = await as.alex.call("GET", `/api/leagues/${G}/stage-changes`);
    check(r.status === 200 && r.body.started?.length === 1 && r.body.started[0].key === "re@6:split-into-individuals" && r.body.started[0].from === 7 && r.body.started[0].change?.kind === "split-into-individuals" && r.body.later === 0, "  and lists it once he has", `${r.status} ${JSON.stringify(r.body)}`);
    check(!!co && S.DraftLogic.waits(co) === null && co.settings.ownershipMode === "exclusive", "  its draft is open now (Episode 6 has results), still exclusive (5 × 2 fits the 12 still in)", JSON.stringify(co && { waits: S.DraftLogic.waits(co), own: co.settings.ownershipMode }));
    d = copy ? await draft(copy) : { picks: 0 };
    check(d.picks === 10, "  drafted through the pick route", JSON.stringify(d));

    // ---------- Episode 7: pairs, but research isn't sure: held ----------
    await store(7, section(pairs(8, 17), { changes: [{ kind: "pairs-formed", when: "end", from: 8, what: "New pairs, maybe.", sure: "low" }] }), [N(6)]);
    co = await stateOf(copy);
    const out7 = co.castaways.find((c) => c.status === "active" && (c.ownerIds || []).includes(seatsG.alex));
    await decide(7, "elimination", out7.name);
    check((await live(G)).length === 2, "Episode 7's research isn't sure pairs formed from 8: held, nothing made");
    check((await changes(G)).some((t) => /^Research isn't sure pairs formed at Episode 8, so the game carries on as it is$/.test(t)), "  and said", JSON.stringify(await changes(G)));
    await seen("alex", 7);
    r = await as.alex.call("GET", `/api/leagues/${G}/stage-changes`);
    check(r.body.held?.length === 1 && r.body.held[0].change.kind === "pairs-formed", "  GET lists it as held", JSON.stringify(r.body.held));
    let view = await gameIn("alex", G);
    so = await stateOf(solo);
    co = await stateOf(copy);
    const a = S.computeScores(S.spanView(so));
    const b = S.computeScores(co);
    const pts = (rowsOf, pid) => rowsOf.find((x) => x.playerId === pid)?.total ?? 0;
    check(!!view && WHO.every((w) => view.table.find((x) => x.playerId === seatsG[w])?.total === pts(a, seatsG[w]) + pts(b, seatsG[w])), "  the game's table: each seat's Solo and New draft added up", JSON.stringify({ game: view?.table?.map((x) => [x.name, x.total]), solo: a.map((x) => [x.name, x.total]), copy: b.map((x) => [x.name, x.total]) }));

    // ---------- Episode 6 corrected: no split after all; then corrected back ----------
    await ep6(false);
    await k.sync();
    rows = await stageRows(G);
    so = await stateOf(solo);
    check(rows.find((x) => x.id === copy)?.gone === true && rows.find((x) => x.id === copy)?.seats === 0 && S.endEpisode(so) === null, "Episode 6's research corrected (no split): the copy is taken away, Solo plays on", JSON.stringify({ rows, solo: S.endEpisode(so) }));
    check((await changes(G)).some((t) => /^New draft \(6:split-into-individuals\) is called off: research no longer says the format changed there, so what it scored is taken back$/.test(t)), "  the game says so", JSON.stringify(await changes(G)));
    view = await gameIn("alex", G);
    so = await stateOf(solo);
    const a2 = S.computeScores(S.spanView(so));
    check(!!view && WHO.every((w) => view.table.find((x) => x.playerId === seatsG[w])?.total === pts(a2, seatsG[w])), "  the game's table is Solo's alone again (its Episode 7 now Solo's)", JSON.stringify({ game: view?.table?.map((x) => [x.name, x.total]), solo: a2.map((x) => [x.name, x.total]) }));
    await ep6(true);
    await k.sync();
    rows = await stageRows(G);
    co = await stateOf(copy);
    so = await stateOf(solo);
    check(rows.find((x) => x.id === copy)?.gone === false && rows.find((x) => x.id === copy)?.seats === 5 && S.startEpisode(co) === 8 && S.endEpisode(so) === 7, "  corrected back: the copy is back (its team kept), from the first episode still open (8); Solo ends with 7", JSON.stringify({ rows, copy: S.startEpisode(co), solo: S.endEpisode(so) }));

    // ---------- the maker's OK ----------
    const problems = await k.setGame(G, (g) => ({ ...g, extras: { ...g.extras, changes: { ok: "maker", unanswered: "carry-on" } } }));
    parent = await stateOf(G);
    check(!problems.length && S.StageLogic.changesOf(parent)?.ok === "maker", "The game now waits for the maker's OK (carrying on if nobody answers)", JSON.stringify(problems));
    await store(8, section([], { changes: [split(8, 9)] }), [N(7)]);
    co = await stateOf(copy);
    const out8 = co.castaways.find((c) => c.status === "active" && !(c.ownerIds || []).length) || co.castaways.find((c) => c.status === "active");
    await decide(8, "elimination", out8.name);
    rows = await live(G);
    await seen("alex", 8);
    r = await as.alex.call("GET", `/api/leagues/${G}/stage-changes`);
    check(rows.length === 2 && r.body.pending?.length === 1 && r.body.pending[0].key === "re@8:split-into-individuals" && r.body.pending[0].until === 9, "Episode 8's research: everyone on their own from 9: it waits for the maker until Episode 9 starts", JSON.stringify({ rows, pending: r.body.pending }));
    check((await changes(G)).some((t) => /^The format changed \(everyone went on to play on their own, from Episode 9\): start New draft\? Say so before Episode 9 starts, else the game carries on as it is$/.test(t)), "  the maker is asked", JSON.stringify(await changes(G)));
    r = await as.alex.call("POST", `/api/leagues/${G}/stage-changes`, { key: "re@8:split-into-individuals", do: "start" });
    check(r.status === 403, "  a player can't answer it (403)", `${r.status} ${errorOf(r)}`);
    r = await as.desk.call("POST", `/api/leagues/${G}/stage-changes`, { key: "re@9:merge", do: "start" });
    check(r.status === 400, "  nor anyone a change research doesn't have (400)", `${r.status} ${errorOf(r)}`);
    r = await as.desk.call("POST", `/api/leagues/${G}/stage-changes`, { key: "re@8:split-into-individuals", do: "start" });
    rows = await live(G);
    const copy2 = rows.find((x) => x.stage_key === "re@8:split-into-individuals")?.id;
    co = await stateOf(copy);
    check(r.status === 200 && !!copy2 && S.startEpisode(await stateOf(copy2)) === 9 && S.endEpisode(co) === 8 && r.body.started?.length === 2, "  the maker starts it: a second copy from 9, the first ending with 8", `${r.status} ${errorOf(r)} ${JSON.stringify(rows)}`);
    r = await as.desk.call("POST", `/api/leagues/${G}/stage-changes`, { key: "re@8:split-into-individuals", do: "skip" });
    rows = await stageRows(G);
    co = await stateOf(copy);
    check(r.status === 200 && rows.find((x) => x.id === copy2)?.gone === true && S.endEpisode(co) === null && r.body.skipped?.length === 1, "  then calls it off: taken away, the first copy plays on", `${r.status} ${errorOf(r)} ${JSON.stringify(rows)}`);
    check((await changes(G)).some((t) => /^zt_nd_desk said start New draft for everyone went on to play on their own at 9$/.test(t)) && (await changes(G)).some((t) => /^zt_nd_desk said no to New draft for everyone went on to play on their own at 9$/.test(t)) && (await changes(G)).some((t) => /^New draft for everyone went on to play on their own at Episode 9 is called off, and what it scored with it$/.test(t)), "  each answer and what it did in the game's Recent changes", JSON.stringify(await changes(G)));

    // ---------- deleted and restored: the copy called off stays away ----------
    r = await as.desk.call("POST", `/api/desk/games/${G}`, { delete: true });
    rows = await stageRows(G);
    check(r.status === 200 && rows.every((x) => x.gone && x.seats === 0), "The desk deletes the game: its stages go with it", `${r.status} ${errorOf(r)} ${JSON.stringify(rows)}`);
    r = await as.desk.call("POST", `/api/desk/games/${G}`, { restore: true });
    rows = await stageRows(G);
    check(r.status === 200 && rows.filter((x) => !x.gone).map((x) => x.stage_key).sort().join() === "re@6:split-into-individuals,solo" && rows.find((x) => x.id === copy2)?.gone === true, "  restored: Solo and the copy are back, the one called off stays away", `${r.status} ${errorOf(r)} ${JSON.stringify(rows)}`);
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
