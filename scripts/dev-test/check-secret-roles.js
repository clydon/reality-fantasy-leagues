// Dev-only check of secret roles among the players (docs/PLAN-start-a-game-gpt.md step A14 part 4: game-spec schema.js score.roles
// and rolesProblems, settings.js secretRoles; src/lib/server/secret-roles.ts, the deal and the stamp with the air times; the roles
// route; the sequence's roleLines; state-logic.js SecretRoleLogic and ScoringLogic.walk) against the dev server, through the API (no
// screens: they're the UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51, 13 episodes: results
// through Episode 5, Episode 6 three days off; Couch Cup, the couch's Outlast, alex its commissioner; everyone has seen 5 but sam, 3).
// Expectations are worked out from the deal the server made and the engine's own reading of each copy, so the check proves the deal
// stays out of the state until the reveal and reaches the table at it. In order:
//   - Couch Cup refused secret roles beside cuts (nothing written), then given two Traitors at 2 points, revealed after Episode 6,
//     through RosterLogic.setGame with the show's ctx (settings.secretRoles, still an Outlast, its words).
//   - The roles route as each of the four: the first read deals (the game started long ago), once (secret_role_deals, the same on
//     every read after): two of the four hold the role, each told so with the other as their mate and their points so far as far as
//     they've seen; the other two told nothing of anyone's; nobody's revealed. The league's state as read carries no roles, and the
//     Games tab's table is the engine's without them.
//   - Episode 6's result through the season sync (someone a seat without the role held, voted out): the reveal. The state as read
//     carries the deal (at 6, the two holders); the Games tab as alex, riley and jordan (seen through 6) read it is the engine's table
//     on that copy, each holder up by its points so far against the same copy without the stamp, nobody else moved; sam (seen
//     through 3) has none of it, and the roles route as sam reveals nothing while it does as alex.
//   - The game-specs flag's check passes on it.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-secret-roles.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it; the deal goes with its league); touches zt rows only; refuses a
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-secret-roles runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];

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
    const L = fx.leagues.outlast;
    const league = async () => (await pool.query("SELECT state FROM leagues WHERE id = $1", [L])).rows[0].state;
    const write = (state) => pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state), L]);
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");
    const { stampSecretRoles } = jiti("../../src/lib/server/secret-roles.ts");
    const gameIn = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body.games ?? []).find((x) => x.leagueId === L) ?? null;
    const rolesAs = async (who) => (await as[who].call("GET", `/api/leagues/${L}/roles`)).body;
    const whoIs = (userId) => Object.keys(fx.users).find((k) => fx.users[k] === userId);
    const pids = {};
    for (const { user_id, player_id } of (await pool.query("SELECT user_id, player_id FROM league_memberships WHERE league_id = $1", [L])).rows) {
      const who = whoIs(user_id);
      if (who) pids[who] = player_id;
    }
    const whoOf = (pid) => Object.keys(pids).find((k) => pids[k] === pid) ?? pid;
    const setGame = async (changes) => {
      const st = await league();
      if (specsOn) GameSpecs.carryGame(st.settings, true);
      const ctx = await questionContext(L, sid);
      const problems = S.setGame(st, { ...S.gameOf(st), ...changes }, { ctx });
      if (!problems.length) await write(st);
      return problems;
    };
    const totals = (v) => Object.fromEntries(S.computeScores(v).map((r) => [whoOf(r.playerId), r.total]));
    const tableOf = (g) => Object.fromEntries((g?.table ?? []).map((r) => [whoIs(r.userId), r.points]));
    // The engine's table on each one's copy, stamped as the server stamps it, and the same copy without the stamp.
    const copies = async (who, mark) => {
      const st = await league();
      await stampSecretRoles(pool, st, L);
      const view = S.GhostLogic.viewFor(st, pids[who], mark);
      const plain = JSON.parse(JSON.stringify(view));
      delete plain.secretRoles;
      return { view, plain };
    };
    const marks = { alex: 5, riley: 5, jordan: 5, sam: 3 };

    // ---------- the game ----------
    const roles = { count: 2, points: 2, reveal: 6 };
    const cut = await setGame({ score: { by: "place", roles }, rank: { by: "standing", cut: [{ at: { every: 3 }, out: 1 }] } });
    check(cut.some((p) => p.at === "score.roles" && /a cut or a race/.test(p.problem)) && (await league()).settings.secretRoles === undefined,
      "Couch Cup with secret roles beside cuts: refused, nothing written", JSON.stringify(cut));
    const problems = await setGame({ score: { by: "place", roles } });
    let st = await league();
    const words = G.describeSpec(S.gameOf(st)).sentence;
    check(!problems.length && same(st.settings.secretRoles, roles) && S.getLeagueType(st).id === "classic-draft" && /Secret roles: two of you are secretly Traitors\. A Traitor scores 2 points each time someone who isn't a Traitor loses /.test(words),
      "Couch Cup gets two Traitors at 2 points, revealed after Episode 6 (settings.secretRoles; still an Outlast; its words)", JSON.stringify({ problems, roles: st.settings.secretRoles, words }));

    // ---------- the deal, and each one's own ----------
    const first = {};
    for (const who of WHO) first[who] = await rolesAs(who);
    const { rows: deals } = await pool.query("SELECT seed, seats, holders, role FROM secret_role_deals WHERE league_id = $1", [L]);
    const deal = deals[0];
    check(deals.length === 1 && deal.holders.length === 2 && deal.seats.length === 4 && deal.role === "Traitor" && deal.holders.every((h) => deal.seats.includes(h)),
      `the first read deals, once: ${deal ? deal.holders.map(whoOf).join(" and ") : "nobody"} the Traitors, of the four seats`, JSON.stringify(deals));
    const holders = deal ? deal.holders : [];
    for (const who of WHO) {
      const r = first[who];
      const holds = holders.includes(pids[who]);
      const mate = holders.find((h) => h !== pids[who]);
      const pts = holds ? S.SecretRoleLogic.pointsOf(S.SpoilerLogic.viewThrough(st, marks[who]), pids[who], holders) : null;
      check(r && r.dealt === true && r.seat === pids[who] && r.revealed === null && same(r.roles, { name: "Traitor", count: 2, points: 2, on: "out", reveal: 6, mates: true })
        && (holds ? r.mine && r.mine.role === "Traitor" && r.mine.points === pts && same(r.mine.mates.map((m) => m.playerId), [mate]) : r.mine === null),
        `  the roles route as ${who}: ${holds ? `a Traitor, ${whoOf(mate)} their mate, ${pts} points so far (seen through ${marks[who]})` : "nothing of anyone's"}`, JSON.stringify(r));
    }
    // Dealt: the roles stay as they were dealt (state.secretRolesDealt, the server's stamp, says only that).
    const marked = (await as.riley.call("GET", `/api/leagues/${L}/state`)).body?.state;
    const change = await setGame({ score: { by: "place", roles: { ...roles, count: 1 } } });
    check(marked?.secretRolesDealt === true && change.some((p) => p.at === "score.roles") && same((await league()).settings.secretRoles, roles),
      "  dealt (the state says only that): a change to the roles is refused, nothing written", JSON.stringify({ dealt: marked?.secretRolesDealt, change }));
    const again = await rolesAs("alex");
    const { rows: still } = await pool.query("SELECT seed FROM secret_role_deals WHERE league_id = $1", [L]);
    check(same(again, first.alex) && still.length === 1 && still[0].seed === deal.seed, "  read again: the same deal, never dealt again");
    const before = (await as.alex.call("GET", `/api/leagues/${L}/state`)).body;
    check(before?.state && before.state.secretRoles === undefined && !JSON.stringify(before.state).includes(deal.seed), "  the league's state as read: no roles in it");
    for (const who of ["alex", "sam"]) {
      const { view } = await copies(who, marks[who]);
      const g = await gameIn(who);
      check(sameBy(tableOf(g), totals(view)) && view.secretRoles === undefined, `  the Games tab as ${who} reads it before the reveal: the engine's table, no role points`, JSON.stringify({ api: tableOf(g), want: totals(view) }));
    }

    // ---------- Episode 6: the reveal ----------
    st = await league();
    const ownerOf = (c) => (c.ownerIds ?? [])[0];
    const goner = st.castaways.find((c) => c.status === "active" && ownerOf(c) && !holders.includes(ownerOf(c)));
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now(), false)`,
      [sid, goner.name]
    );
    await syncSeasonLeagues(sid, null);
    for (const who of ["alex", "riley", "jordan"]) await seen(who, 6);
    marks.alex = marks.riley = marks.jordan = 6;
    st = await league();
    check(st.castaways.find((c) => c.id === goner.id)?.status === "eliminated", `Episode 6 through the season sync: ${goner.name} (${whoOf(ownerOf(goner))}'s, no Traitor) voted out`);
    const read = (await as.sam.call("GET", `/api/leagues/${L}/state`)).body;
    check(same(read?.state?.secretRoles, { at: 6, holders }), "  the league's state as read: the deal stamped, at 6 (as public as its results)", JSON.stringify(read?.state?.secretRoles));
    const samView = S.SpoilerLogic.viewThrough(read.state, read.membership?.resultsSeenThrough ?? 3);
    check(samView.secretRoles === undefined, `  sam's copy as the browser trims it (through ${read.membership?.resultsSeenThrough}): no roles`);
    for (const who of WHO) {
      const { view, plain } = await copies(who, marks[who]);
      const want = totals(view);
      const g = await gameIn(who);
      check(sameBy(tableOf(g), want), `  the Games tab as ${who} reads it (seen through ${marks[who]}): the engine's table on that copy (${JSON.stringify(want)})`, JSON.stringify({ api: tableOf(g), want }));
      const without = totals(plain);
      const diff = Object.fromEntries(Object.keys(want).map((k) => [k, Math.round((want[k] - without[k]) * 100) / 100]).filter(([, d]) => d));
      if (marks[who] === 6) {
        const owed = Object.fromEntries(holders.map((h) => [whoOf(h), S.SecretRoleLogic.pointsOf(view, h, holders)]).filter(([, p]) => p));
        check(sameBy(diff, owed) && Object.values(owed).every((p) => p >= 2), `  ${who}'s copy against the same without the stamp: the Traitors up by their points so far, ${JSON.stringify(owed)}`, JSON.stringify({ diff, owed }));
      } else check(!Object.keys(diff).length && view.secretRoles === undefined, `  ${who}'s copy (through 3) has no roles`, JSON.stringify(diff));
    }
    const revealed = await rolesAs("alex");
    const samRoles = await rolesAs("sam");
    check(revealed.revealed && revealed.revealed.at === 6 && same(revealed.revealed.holders.map((h) => h.playerId), holders) && samRoles.revealed === null,
      "  the roles route: revealed to alex (seen 6), not to sam (seen 3)", JSON.stringify({ alex: revealed.revealed, sam: samRoles.revealed }));

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
