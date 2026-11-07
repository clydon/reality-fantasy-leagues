// Dev-only check of the top scorer's twist (docs/PLAN-start-a-game-gpt.md step A14 part 5: game-spec schema.js score.twist and
// twistProblems, settings.js twist; src/lib/server/twists.ts, the filing and the stamp with the air times; the twist route;
// state-logic.js TwistLogic, timesFor and pointsFor) against the dev server, through the API (no screens: they're the UI track's), on
// new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51, 13 episodes: results through Episode 5, Episode 6 three days
// off; the couch's Weekly Lineup, alex its commissioner; everyone has seen 5 but sam, 3). Expectations are worked out from the
// engine's own reading of each copy, so the check proves the choice stays out of the state until it closes and reaches the table
// once filed. In order:
//   - Couch Cup (the couch's Outlast) refused a twist (a place has no points to multiply), nothing written; the Weekly Lineup given
//     double points or immunity counting triple through RosterLogic.setGame with the show's ctx (settings.twist, its words).
//   - The first read files Episodes 2 to 5 (each closed: it has results; nobody chose, so no twist) and leaves Episode 6 open.
//   - The twist route as each of the four: Episode 6 being chosen, its close 12 hours before it airs, the chooser (Episode 5's top
//     scorer by the engine's walk) told so, the others not; sam (seen through 3) nothing about it.
//   - Choosing: someone else refused, a twist the game doesn't offer refused, the chooser's double points kept (and changed, and back),
//     secret: the state as read carries no Episode 6 twist, nobody else's route shows it.
//   - Episode 6 airs (the premiere moved back four days): the next read files it, chosen, and stamps it on the episode (the state as
//     read has it); a choice after that refused.
//   - Episode 6's result through the season sync (someone starting that episode voted out): the Games tab as alex, riley and jordan
//     (seen through 6) is the engine's table on that copy, and on it each seat's Episode 6 is double the same copy's without the stamp;
//     sam's copy (through 3) has no Episode 6 twist; the route's played list as alex and as sam.
//   - The game-specs flag's check passes on it.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-twist.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it; the twist's rows go with its league); touches zt rows only; refuses a
// non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or
// how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");
const { checkLeague } = require("../game-specs-flag.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-twist runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const TWISTS = [{ id: "double", name: "Double points", times: 2 }, { id: "immunity", name: "Immunity frenzy", moment: "individualImmunity", times: 3 }];

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameBy = (a, b) => same(Object.entries(a).sort(), Object.entries(b).sort());

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const sid = fx.seasonId;
    const L = fx.leagues.lineup;
    const stateOf = async (id) => (await pool.query("SELECT state FROM leagues WHERE id = $1", [id])).rows[0].state;
    const league = () => stateOf(L);
    const write = (id, state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), id]);
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const { stampAirTimes } = jiti("../../src/lib/server/air-times.ts");
    const gameIn = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body.games ?? []).find((x) => x.leagueId === L) ?? null;
    const twistAs = async (who) => (await as[who].call("GET", `/api/leagues/${L}/twist`)).body;
    const choose = async (who, twist) => as[who].call("POST", `/api/leagues/${L}/twist`, { twist });
    const whoIs = (userId) => Object.keys(fx.users).find((k) => fx.users[k] === userId);
    const pids = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [L])).rows) {
      const who = whoIs(user_id);
      if (who) pids[who] = player_id;
    }
    const whoOf = (pid) => Object.keys(pids).find((k) => pids[k] === pid) ?? pid;
    const setGame = async (id, changes) => {
      const st = await stateOf(id);
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      const ctx = await questionContext(id, sid);
      const problems = S.setGame(st, { ...S.gameOf(st), ...changes }, { ctx });
      if (!problems.length) await write(id, st);
      return problems;
    };
    const totals = (v) => Object.fromEntries(S.computeScores(v).map((r) => [whoOf(r.playerId), r.total]));
    const tableOf = (g) => Object.fromEntries((g?.table ?? []).map((r) => [whoIs(r.userId), r.points]));
    const rows = async () => (await pool.query("SELECT episode, player_id, twist, filed, how FROM twist_choices WHERE league_id = $1 ORDER BY episode", [L])).rows;
    const marks = { alex: 5, riley: 5, jordan: 5, sam: 3 };

    // ---------- the game ----------
    const outlast = await setGame(fx.leagues.outlast, { score: { by: "place", twist: { of: TWISTS } } });
    check(outlast.some((p) => p.at.startsWith("score.twist")) && (await stateOf(fx.leagues.outlast)).settings.twist === undefined, "Couch Cup (an Outlast) with a twist: refused, nothing written", JSON.stringify(outlast));
    const before = await league();
    const twist = { of: TWISTS };
    const problems = await setGame(L, { score: { ...S.gameOf(before).score, twist } });
    let st = await league();
    const words = G.describeSpec(S.gameOf(st), { castaway: "castaway" }).sentence;
    check(!problems.length && G.sameValue(st.settings.twist, twist) && /After each episode, its top scorer chooses a twist for the next one: Double points \(every point counts double\) or Immunity frenzy \(.+ counts triple\)\./.test(words),
      "the Weekly Lineup gets double points or immunity counting triple (settings.twist; its words)", JSON.stringify({ problems, twist: st.settings.twist, words }));

    // ---------- the first read: 2 to 5 filed, 6 open ----------
    const first = {};
    for (const who of WHO) first[who] = await twistAs(who);
    const filed = await rows();
    check(same(filed.map((r) => [r.episode, r.filed, r.how, r.twist, r.player_id]), [2, 3, 4, 5].map((n) => [n, true, "fallback", null, null])),
      "the first read files Episodes 2 to 5 (each has results; nobody chose: no twist), Episode 6 left open", JSON.stringify(filed));
    st = await league();
    await stampAirTimes(pool, st, L);
    const want = S.TwistLogic.chooserAt(st, 6);
    const chooser = want.playerId ? whoOf(want.playerId) : null;
    const ep6 = st.episodes.find((e) => e.number === 6);
    const closes = new Date(Date.parse(ep6.airsAt) - 12 * 3600e3).toISOString();
    check(!!chooser, `Episode 5's top scorer by the engine's walk: ${chooser}`, JSON.stringify(want));
    for (const who of WHO) {
      const r = first[who];
      const n = r?.next;
      const ok = who === "sam" ? n === null : n && n.episode === 6 && n.closesAt === closes && n.youChoose === (who === chooser) && n.choice === null;
      check(ok && G.sameValue(r.twist.of, TWISTS) && r.twist.closes === 12, `  the twist route as ${who}: ${who === "sam" ? "nothing about Episode 6 (seen through 3)" : `Episode 6, closing ${closes}, ${who === chooser ? "you choose" : "someone else chooses"}`}`, JSON.stringify(r));
    }

    // ---------- choosing ----------
    // The chooser has seen Episode 5 (who chooses is who scored most in it): sam, seen through 3, is brought up to it if it's them.
    if (chooser === "sam") { await seen("sam", 5); marks.sam = 5; }
    const other = WHO.find((w) => w !== chooser && w !== "sam");
    const refused = await choose(other, "double");
    check(refused.status === 409, `  ${other} choosing: refused (${refused.body?.error})`, JSON.stringify(refused));
    const bad = await choose(chooser, "triple");
    check(bad.status === 400, `  ${chooser} choosing a twist the game doesn't offer: refused`, JSON.stringify(bad));
    const ok1 = await choose(chooser, "immunity");
    const ok2 = await choose(chooser, "double");
    const mine = await twistAs(chooser);
    const theirs = await twistAs(other);
    check(ok1.status === 200 && ok2.status === 200 && mine.next.choice === "double" && theirs.next.choice === null,
      `  ${chooser} chooses immunity, then double points: kept as theirs, ${other} sees none of it`, JSON.stringify({ ok1: ok1.body, ok2: ok2.body, mine: mine.next, theirs: theirs.next }));
    const asRead = (await as[other].call("GET", `/api/leagues/${L}/state`)).body?.state;
    check(asRead && !asRead.episodes.find((e) => e.number === 6).twist && !JSON.stringify(asRead).includes('"double","by"'), "  the league's state as read: no Episode 6 twist (secret until it closes)");

    // ---------- Episode 6 airs: filed ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    const after = (await as.alex.call("GET", `/api/leagues/${L}/state`)).body?.state;
    const stamp = after?.episodes.find((e) => e.number === 6).twist;
    const row6 = (await rows()).find((r) => r.episode === 6);
    check(same(stamp, { id: "double", by: pids[chooser], how: "chosen" }) && row6?.filed === true && row6.how === "chosen",
      `Episode 6 aired: the next read files it, ${chooser}'s double points, stamped on the episode`, JSON.stringify({ stamp, row6 }));
    const late = await choose(chooser, "immunity");
    check(late.status === 409, `  ${chooser} choosing again once it's filed: refused (${late.body?.error})`, JSON.stringify(late));

    // ---------- Episode 6's result ----------
    st = await league();
    const ep = st.episodes.find((e) => e.number === 6);
    const starter = WHO.map((w) => S.ActiveRosterLogic.lineupFor(st, ep.id, pids[w])).flat().find((id) => st.castaways.find((c) => c.id === id)?.status === "active");
    const goner = st.castaways.find((c) => c.id === starter) || st.castaways.find((c) => c.status === "active");
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now(), false)`,
      [sid, goner.name]
    );
    await syncSeasonLeagues(sid, null);
    for (const who of ["alex", "riley", "jordan"]) await seen(who, 6);
    marks.alex = marks.riley = marks.jordan = 6;
    st = await league();
    check(st.castaways.find((c) => c.id === goner.id)?.status === "eliminated", `Episode 6 through the season sync: ${goner.name} voted out${starter ? " (starting that episode)" : ""}`);
    await stampAirTimes(pool, st, L);
    let moved = 0;
    for (const who of WHO) {
      const view = S.GhostLogic.viewFor(st, pids[who], marks[who]);
      const g = await gameIn(who);
      const wantTable = totals(view);
      check(sameBy(tableOf(g), wantTable), `  the Games tab as ${who} reads it (seen through ${marks[who]}): the engine's table on that copy`, JSON.stringify({ api: tableOf(g), want: wantTable }));
      const v6 = view.episodes.find((e) => e.number === 6);
      if (marks[who] === 6) {
        const plain = JSON.parse(JSON.stringify(view));
        delete plain.episodes.find((e) => e.number === 6).twist;
        const at = (v) => Object.fromEntries(WHO.map((w) => [w, S.ActiveRosterLogic.episodeScore(v, v.episodes.find((e) => e.number === 6), pids[w]).total]));
        const doubled = at(view);
        const single = at(plain);
        moved = Object.values(single).filter((x) => x !== 0).length;
        check(WHO.every((w) => doubled[w] === Math.round(single[w] * 2 * 100) / 100) && moved > 0, `  ${who}'s copy: each seat's Episode 6 double the same copy's without the twist (${JSON.stringify(single)} -> ${JSON.stringify(doubled)})`, JSON.stringify({ doubled, single }));
      } else if (marks[who] < 5) check(v6 && v6.twist === undefined, `  ${who}'s copy (through ${marks[who]}): no Episode 6 twist`);
    }
    const playedAlex = (await twistAs("alex")).played;
    const playedSam = (await twistAs("sam")).played;
    check(same(playedAlex.map((p) => [p.episode, p.twist, p.by && p.by.playerId, p.how]), [[2, null, null, "fallback"], [3, null, null, "fallback"], [4, null, null, "fallback"], [5, null, null, "fallback"], [6, "double", pids[chooser], "chosen"]])
      && playedAlex[4].name === "Double points" && same(playedSam.map((p) => p.episode), [2, 3, 4, 5, 6].filter((n) => n - 1 <= marks.sam)),
      "  the route's played list: alex every episode filed (6 double points, by the chooser), sam only those after one they've seen", JSON.stringify({ playedAlex, playedSam }));

    // ---------- the flag ----------
    const flagged = checkLeague(await league());
    check(flagged.ok, "the game-specs flag's check passes on it", JSON.stringify(flagged));
  } catch (e) {
    failures++;
    console.log(`FAIL  ${e.stack || e}`);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.log(`down: ${e.message}`));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
