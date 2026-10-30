// Dev-only check of group slots (docs/PLAN-start-a-game-gpt.md step A10 part 1, "When a grouping lasts": a draft's +1 or +2 slot
// that holds a pair or a team the show forms; state-logic.js GroupSlotLogic, format-timeline.js slotRecords, group-slots.ts, the
// route /api/leagues/[id]/episodes/[epId]/group-slots/[playerId]) against the dev server, on new-fixture.js's couch (alex,
// riley, jordan, sam on ZT Survivor 51: results through Episode 5; Episode 6 three days off; everyone has seen 5 but sam, 3).
//   - The couch's Weekly Lineup is given a group slot (its own spec, plus get.groups { slots: 1 }: shared, no swaps, void when
//     the groups aren't sure, a group's points its members' mean).
//   - The season turns into pairs: its stored research says, from 4, who is paired with whom (unnamed pairs: never staged as
//     tribe moves, so only the timeline has them).
//   - Going into 6 (GET): the six pairs at 5's end are on offer; the slots are empty. jordan picks a pair that will hold, riley
//     one that Episode 6 re-draws at its start; a second slot, someone else's slot, a group not on offer: refused. sam, behind
//     (seen 3), is offered nothing (he hasn't seen the episode that showed the pairs).
//   - The lock (Episode 6 starts): a pick is refused. Episode 6's research re-draws two pairs at its start; its accepted results
//     give jordan's pair immunity (season_decisions, through the season sync, which settles the groups into the game).
//   - jordan's slot held, scoring its pair's mean, and the table counting it (the engine's own scores less the slot's are what
//     the game scored before it); riley's void (no points); Episode 7 offers the pairs after the swap: riley's slot dropped and
//     picks again, jordan's rides with its pair (a change refused).
//   API only: the screens are the UI track's (U1). One fixed scenario on purpose (its episodes and pairs are the story above),
//   run again whenever group slots change; a game type or an episode isn't a parameter.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-group-slots.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); the research rows go with the zt show. Touches zt rows only;
// refuses a non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-group-slots runs against a local database only");
const keep = process.argv.includes("--keep");
const PASSWORD = fixture.PASSWORD;
const SHOW = "zt-nd-survivor";

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    const fx = await fixture.up(pool);
    const sid = fx.seasonId;
    const L = fx.leagues.lineup;
    await pool.query("UPDATE show_seasons SET results_by = 'admin' WHERE id = $1", [sid]);
    const as = {};
    for (const who of ["alex", "riley", "jordan", "sam"]) as[who] = await api({ user: `zt_nd_${who}`, pass: PASSWORD });
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L])).rows[0].state;
    const pid = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [L])).rows) {
      const who = Object.keys(fx.users).find((k) => fx.users[k] === user_id);
      if (who) pid[who] = player_id;
    }
    const showId = (await pool.query("SELECT id FROM shows WHERE slug = $1", [SHOW])).rows[0].id;
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);

    // ---------- The Weekly Lineup, with a group slot ----------
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const ctx = await questionContext(L, sid);
    const s0 = await league();
    const was = S.gameOf(s0);
    const problems = S.setGame(s0, { ...was, get: { ...was.get, groups: { slots: 1 } } }, { ctx });
    if (!problems.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(s0), L]);
    const made = await league();
    const cfg = S.GroupSlotLogic.config(made);
    check(!problems.length && cfg && cfg.slots === 1 && cfg.own === "shared" && cfg.swap === false && cfg.fallback === "void" && cfg.points === "mean", "the couch's Weekly Lineup gets a group slot (the defaults: shared, no swaps, void, the mean)", JSON.stringify({ problems, cfg }));

    // ---------- The season in pairs, as research stores it ----------
    const cast = [...made.castaways].sort((a, b) => (a.placementOrder ?? 99) - (b.placementOrder ?? 99));
    const N = (i) => cast[i].name;
    const pairs = (from, to) => Array.from({ length: (to - from + 1) / 2 }, (_, k) => ({ name: null, members: [N(from + 2 * k), N(from + 2 * k + 1)] }));
    const section = (groups, extra = {}) => ({ playedAs: "pairs", phase: null, groups, alone: [], newcomers: [], wentHomeAs: "individuals", changes: [], ...extra });
    const store = (n, formatState, out) =>
      pool.query(
        `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance) VALUES ($1, 51, $2, $3::jsonb, '{"provider":"zt-check"}'::jsonb)
         ON CONFLICT (show_id, season_number, episode_number) WHERE source = 'combined' DO UPDATE SET payload = EXCLUDED.payload`,
        [showId, n, JSON.stringify({ summary: `Episode ${n}.`, formatState, castaways: out.map((name) => ({ name, leftTheGame: "yes" })) })]
      );
    for (let n = 1; n <= 3; n++) await store(n, null, [N(n - 1)]);
    await store(4, section(pairs(4, 17)), [N(3)]);
    await store(5, section(pairs(6, 17), { alone: [N(5)] }), [N(4)]);
    // The season sync, as after every result: its write settles the season's groups into the game.
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    await syncSeasonLeagues(sid, null);

    // ---------- Going into 6: the pairs on offer ----------
    const ep = (n, st) => st.episodes.find((e) => e.number === n);
    const url = (n, who, st) => `/api/leagues/${L}/episodes/${ep(n, st).id}/group-slots/${pid[who]}`;
    let st = await league();
    let r = await as.jordan.call("GET", url(6, "jordan", st));
    const offer = r.body.offered?.groups ?? [];
    const named = (a, b) => offer.find((g) => g.name === `${N(a)} & ${N(b)}`);
    check(r.status === 200 && r.body.episode === 6 && offer.length === 6 && !!named(6, 7) && !!named(8, 9) && r.body.offered.sure === true && r.body.offered.shared === false, "jordan reads Episode 6's slot: the six pairs at Episode 5's end on offer, sure", `${r.status} ${JSON.stringify(r.body).slice(0, 400)}`);
    check(r.body.slots?.length === 1 && r.body.slots[0].status === "empty", "  his one slot is empty", JSON.stringify(r.body.slots));
    r = await as.jordan.call("PUT", `${url(6, "jordan", st)}?quiet`, { slot: 0, groupId: named(6, 7).id });
    check(r.status === 200, `jordan picks ${N(6)} & ${N(7)}`, `${r.status} ${JSON.stringify(r.body)}`);
    r = await as.riley.call("PUT", `${url(6, "riley", st)}?quiet`, { slot: 0, groupId: named(8, 9).id });
    check(r.status === 200, `riley picks ${N(8)} & ${N(9)}`, `${r.status} ${JSON.stringify(r.body)}`);
    r = await as.jordan.call("PUT", `${url(6, "jordan", st)}?quiet`, { slot: 1, groupId: named(8, 9).id });
    check(r.status === 400 && /1 group slot/.test(r.body?.error ?? ""), "  a second slot is refused (400): the game has one", `${r.status} ${JSON.stringify(r.body)}`);
    r = await as.jordan.call("PUT", `${url(6, "riley", st)}?quiet`, { slot: 0, groupId: named(6, 7).id });
    check(r.status === 403, "  someone else's slot is refused (403)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await as.riley.call("PUT", `${url(6, "riley", st)}?quiet`, { slot: 0, groupId: "6:nobody" });
    check(r.status === 400 && /isn't one going into this episode/.test(r.body?.error ?? ""), "  a group not on offer is refused (400)", `${r.status} ${JSON.stringify(r.body)}`);
    r = await as.sam.call("GET", url(6, "sam", st));
    check(r.status === 404 || (r.status === 200 && (r.body.offered?.groups ?? []).length === 0), "sam, at Episode 3, is offered nothing yet: he hasn't seen the episodes that showed the pairs", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    st = await league();
    check(st.episodes.some((e) => e.number === 5 && e.formatGroups?.end?.groups?.length === 6), "the season sync settled the season's groups into the game (Episode 5's record: six pairs at its end)", JSON.stringify(ep(5, st)?.formatGroups?.end?.groups?.length));

    // ---------- The lock, then Episode 6: two pairs re-drawn at its start, immunity to jordan's ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    r = await as.riley.call("PUT", `${url(6, "riley", st)}?quiet`, { slot: 0, groupId: named(6, 7).id });
    check(r.status === 400 && /started/.test(r.body?.error ?? ""), "Episode 6 has started: a pick is refused", `${r.status} ${JSON.stringify(r.body)}`);
    const after6 = [{ name: null, members: [N(6), N(7)] }, { name: null, members: [N(8), N(10)] }, { name: null, members: [N(9), N(11)] }, ...pairs(12, 17)];
    await store(6, section(after6, { changes: [{ kind: "swap", when: "start", from: 6, what: "Two pairs were re-drawn before the challenge.", sure: "high" }] }), [N(5)]);
    for (const [kind, name, method, eventType] of [["event", N(6), "", "tribeImmunity"], ["event", N(7), "", "tribeImmunity"], ["event", N(9), "", "idolFound"], ["elimination", N(5), "Voted Out", ""]]) {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, 6, $2, $3, $4, $5, 'accepted', true, now(), false)`,
        [sid, kind, name, method, eventType]
      );
    }
    await syncSeasonLeagues(sid, null);
    st = await league();
    const e6 = ep(6, st);
    check(!!e6 && S.episodeHasResults(e6) && !!e6.formatGroups && e6.formatGroups.played?.sure === true, "Episode 6's results reach the game, and the season sync settles its groups (played as re-drawn at its start, sure)", JSON.stringify(e6 && e6.formatGroups));

    // ---------- How each slot did ----------
    const lines = (who) => S.GroupSlotLogic.episodeLines(st, e6, pid[who]);
    const pts = S.ActiveRosterLogic.eventPoints(st, { type: "tribeImmunity" });
    check(lines("jordan")[0].status === "held" && lines("jordan")[0].points === pts && pts > 0, `jordan's slot held: his pair won immunity, its mean ${pts}`, JSON.stringify(lines("jordan")));
    check(lines("riley")[0].status === "void" && lines("riley")[0].points === 0, `riley's re-drawn pair is void: no points (though ${N(9)} found an idol)`, JSON.stringify(lines("riley")));
    const without = JSON.parse(JSON.stringify(st));
    without.episodes.forEach((e) => { delete e.groupSlots; });
    const total = (x, who) => S.computeScores(x).find((row) => row.playerId === pid[who]).total;
    check(Math.abs(total(st, "jordan") - total(without, "jordan") - pts) < 1e-9 && total(st, "riley") === total(without, "riley"), "the table counts jordan's slot, and nothing for riley's", JSON.stringify({ jordan: [total(st, "jordan"), total(without, "jordan")], riley: [total(st, "riley"), total(without, "riley")] }));
    r = await as.jordan.call("GET", url(6, "jordan", st));
    check(r.status === 200 && r.body.slots?.[0]?.status === "waiting", "jordan hasn't seen Episode 6: his read says nothing of how it went", JSON.stringify(r.body.slots));
    for (const who of ["jordan", "riley"]) await seen(who, 6);
    r = await as.jordan.call("GET", url(6, "jordan", st));
    check(r.status === 200 && r.body.slots?.[0]?.status === "held" && r.body.slots[0].points === pts, "  once he's seen it, the read says the same", JSON.stringify(r.body.slots));

    // ---------- Going into 7: the pairs after the swap ----------
    r = await as.riley.call("GET", url(7, "riley", st));
    const offer7 = (r.body.offered?.groups ?? []).map((g) => g.name);
    check(r.status === 200 && offer7.length === 6 && offer7.includes(`${N(8)} & ${N(10)}`) && !offer7.includes(`${N(8)} & ${N(9)}`) && r.body.slots?.[0]?.status === "dropped", "riley reads Episode 7's: the pairs after the swap, her slot dropped", `${r.status} ${JSON.stringify(r.body).slice(0, 400)}`);
    const g810 = r.body.offered.groups.find((g) => g.name === `${N(8)} & ${N(10)}`);
    r = await as.riley.call("PUT", `${url(7, "riley", st)}?quiet`, { slot: 0, groupId: g810.id });
    check(r.status === 200, `  and picks again: ${N(8)} & ${N(10)}`, `${r.status} ${JSON.stringify(r.body)}`);
    r = await as.jordan.call("PUT", `${url(7, "jordan", st)}?quiet`, { slot: 0, groupId: g810.id });
    check(r.status === 400 && /rides with its group/.test(r.body?.error ?? ""), "jordan's slot rides with its pair while it lasts: a change is refused", `${r.status} ${JSON.stringify(r.body)}`);
    r = await as.jordan.call("GET", url(7, "jordan", await league()));
    check(r.body.slots?.[0]?.status === "waiting" && r.body.slots[0].pick?.id === named(6, 7).id, "  his slot still holds it going into 7", JSON.stringify(r.body.slots));
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
