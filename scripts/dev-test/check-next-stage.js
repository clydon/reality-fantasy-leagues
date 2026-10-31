// Dev-only check of the 'next-stage' fallback (docs/PLAN-start-a-game-gpt.md step A12 part 2b: a stage whose group question can't be
// played as the groups stand ends there and the game's next stage starts; format-timeline.js groupsGone, state-logic.js
// StageLogic.fallbackStarts and changePlan, src/lib/server/change-stages.ts from the season sync) against the dev server, through the
// API (no screens: they're the UI track's), on new-fixture.js's couch (ZT Survivor 51: 13 episodes, results through Episode 5, Episode
// 6 three days off), its season played in pairs from Episode 4 as research stores it (check-change-stages.js's rows). In order:
//   - The desk's admin (zt_nd_desk, made here, on the couch) starts "pick a pair each episode, and once the pairs are gone a solo
//     draft for the rest" from the engine lab: Pairs, a game of questions with a group question each episode (fallback 'next-stage'),
//     from Episode 6; then Solo, an Outlast of 2 each, with no start of its own. Only Pairs is made, its own league playing the
//     question as void (where it ends is the game's plan); alex, riley, jordan and sam join.
//   - Episode 6's research says everyone plays on their own from 7, but isn't sure: held, said, nothing made, Pairs plays on.
//   - Episode 7's research is sure nobody's in a pair going into 8: the season sync makes Solo (its own league, tied, the five seats
//     under the same ids), from 8, keyed by the split; Pairs ends with 7; said on the game and on each stage; its draft open at once
//     and drafted through the pick route; the game's table each seat's two stages added up.
//   - Episodes 6 and 7 corrected (still in pairs): Solo is taken away, Pairs plays on; corrected back: Solo is back, its team kept,
//     from the first episode still open (8).
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-next-stage.js [--keep]
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-next-stage runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const DESK = "zt_nd_desk";
const SHOW = "zt-nd-survivor";
const out = K.checker();
const { check } = out;
const { errorOf } = K;

const PAIR = { id: "pair", ask: "Which pair wins immunity?", answer: "group", points: 2, asked: "each", settle: { by: "moment", moment: "tribeImmunity", take: "who" }, fallback: "next-stage" };
const SPEC = {
  stages: [
    { id: "pairs", name: "Pairs", game: { spec: 1, get: { by: "none" }, score: { by: "answers" }, ask: [PAIR] } },
    { id: "solo", name: "Solo", game: { preset: "outlast", get: { by: "draft", each: 2, order: "snake", own: "exclusive" } } },
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
    const { decide, stateOf, gameIn } = k;
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
    const split = (from, sure) => ({ kind: "split-into-individuals", when: "end", from, what: `Everyone plays on their own from Episode ${from}.`, sure });
    // Episode 6: the split said at its end (`sure` how sure), or still in pairs; Episode 7: on their own, or in pairs.
    const ep6 = (sure) => store(6, sure ? section([], { changes: [split(7, sure)] }) : section(pairs(6, 17)), [N(5)]);
    const ep7 = (alone) => store(7, alone ? section([], { playedAs: "individuals" }) : section(pairs(8, 17), { alone: [N(7)] }), [N(6)]);

    // ---------- the engine lab: the game, and only its first stage ----------
    r = await as.desk.call("POST", "/api/desk/lab", { action: "start", seasonId: sid, couchId: couch, spec: JSON.stringify(SPEC) });
    const G = r.body?.leagueId;
    check(r.status === 200 && !!G, "the desk's admin starts a pair each episode, then a solo draft once the pairs are gone, from the engine lab", `${r.status} ${errorOf(r)}`);
    const parent = await stateOf(G);
    let rows = await stageRows(G);
    const pairsId = rows.find((x) => x.stage_key === "pairs")?.id;
    check(rows.length === 1 && !!pairsId && [...S.StageLogic.fallbackStarts(parent)].join() === "solo" && S.StageLogic.onStages(parent).map((x) => x.id).join() === "solo", "  only Pairs is made: Solo starts on its fallback", JSON.stringify({ rows, on: S.gameOf(parent).stages[1].on }));
    let ps = await stateOf(pairsId);
    check(S.gameOf(parent).stages[0].game.ask[0].fallback === "next-stage" && S.gameOf(ps).ask[0].fallback === "void" && S.startEpisode(ps) === 6 && S.endEpisode(ps) === null, "  the game says next-stage; Pairs' own league plays it as void, from Episode 6, until the pairs are gone", JSON.stringify({ own: S.gameOf(ps).ask[0].fallback, from: S.startEpisode(ps), to: S.endEpisode(ps) }));
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

    // ---------- Episode 6: the split said, but not sure: held ----------
    await ep6("low");
    await decide(6, "elimination", N(5));
    check((await live(G)).length === 1 && S.endEpisode(await stateOf(pairsId)) === null, "Episode 6's research says everyone plays on their own from 7, unsure: held, nothing made, Pairs plays on");
    check((await changes(G)).some((t) => /^Research isn't sure everyone went on to play on their own at Episode 7, so the game carries on as it is$/.test(t)), "  and said", JSON.stringify(await changes(G)));

    // ---------- Episode 7: sure nobody's in a pair going into 8: Solo starts ----------
    await ep7(true);
    await decide(7, "elimination", N(6));
    rows = await live(G);
    const solo = rows.find((x) => x.stage_key === "solo@6:split-into-individuals")?.id;
    check(!!solo && rows.length === 2, "Episode 7's research is sure nobody's in a pair going into 8: the season sync makes Solo, keyed by the split", JSON.stringify(rows));
    let so = solo ? await stateOf(solo) : null;
    ps = await stateOf(pairsId);
    const seatsSolo = solo ? await k.seatsOf(solo) : {};
    check(!!so && S.startEpisode(so) === 8 && S.endEpisode(so) === null && S.endEpisode(ps) === 7, "  Solo from Episode 8; Pairs ends with 7", JSON.stringify({ solo: so && [S.startEpisode(so), S.endEpisode(so)], pairs: S.endEpisode(ps) }));
    check(!!so && WHO.every((w) => seatsSolo[w] === seatsG[w]) && so.players.length === 5, "  the game's five seats in it, under the same ids", JSON.stringify({ seatsSolo, seatsG }));
    const tied = solo ? (await pool.query("SELECT couch_id, stage_of FROM leagues WHERE id = $1", [solo])).rows[0] : null;
    check(!!tied && tied.stage_of === G && tied.couch_id === couch, "  tied to the game, on the same couch", JSON.stringify(tied));
    check((await changes(G)).some((t) => /^The format changed \(everyone went on to play on their own, from Episode 8\): Solo starts with Episode 8$/.test(t)), "  the game's Recent changes say what changed and what it did", JSON.stringify(await changes(G)));
    check((await changes(pairsId)).some((t) => /^Plays Episodes 6 to 7: /.test(t)), "  and Pairs'", JSON.stringify(await changes(pairsId)));
    check(!!so && S.DraftLogic.waits(so) === null, "  its draft is open now (Episode 7 has results)", JSON.stringify(so && S.DraftLogic.waits(so)));
    const d = solo ? await draft(solo) : { picks: 0 };
    check(d.picks === 10, "  drafted through the pick route: 5 of you × 2", JSON.stringify(d));
    const view = await gameIn("alex", G);
    check(!!view && Array.isArray(view.table) && view.table.length === 5, "  the game's table: the overall of its two stages", JSON.stringify(view?.table?.map((x) => [x.name, x.total])));

    // ---------- Episodes 6 and 7 corrected: still in pairs; then corrected back ----------
    await ep6(null);
    await ep7(false);
    await k.sync();
    rows = await stageRows(G);
    ps = await stateOf(pairsId);
    check(rows.find((x) => x.id === solo)?.gone === true && S.endEpisode(ps) === null, "Episodes 6 and 7 corrected (still in pairs): Solo is taken away, Pairs plays on", JSON.stringify({ rows, pairs: S.endEpisode(ps) }));
    await ep6("high");
    await ep7(true);
    await k.sync();
    rows = await stageRows(G);
    so = await stateOf(solo);
    ps = await stateOf(pairsId);
    check(rows.find((x) => x.id === solo)?.gone === false && rows.find((x) => x.id === solo)?.seats === 5 && S.startEpisode(so) === 8 && S.endEpisode(ps) === 7 && so.castaways.some((c) => (c.ownerIds || []).length), "  corrected back: Solo is back (its team kept), from 8; Pairs ends with 7", JSON.stringify({ rows, solo: S.startEpisode(so), pairs: S.endEpisode(ps) }));
    await k.seen("alex", 7);
    r = await as.alex.call("GET", `/api/leagues/${G}/stage-changes`);
    check(r.status === 200 && r.body.started?.length === 1 && r.body.started[0].key === "solo@6:split-into-individuals" && r.body.started[0].from === 8 && r.body.started[0].change?.kind === "split-into-individuals", "  GET stage-changes lists Solo for alex once he's seen Episode 7, from 8, for the split", `${r.status} ${JSON.stringify(r.body)}`);
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
