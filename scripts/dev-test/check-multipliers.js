// Dev-only check of a multiplier on how a holding joined (docs/PLAN-start-a-game-gpt.md track C, C3: game-spec schema.js
// multiplyProblems and multipliersOf, settings.js joinedTimes; the sequence's stints, earnedWhileHeld and factorOf; state-logic.js
// joinedFactors and ScoringLogic.walk's Outlast lines) against the dev server, through the API (no screens: they're the UI track's),
// on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor 51, 13 episodes: results through Episode 5, Episode 6 three
// days off; Couch Cup, the couch's Outlast, alex its commissioner; everyone has seen 5 but sam, 3). Expectations are the engine's own
// reading of each copy (the numbers by hand are tests/multipliers.test.js's), so the check proves a real waiver move feeds the
// multiplier and the server's reads score it as the engine does. In order:
//   - Couch Cup's replacements score half, then a quarter (the user's second game), with waivers replacing anyone gone, through
//     RosterLogic.setGame with the show's ctx: settings.joinedTimes, still an Outlast, its words; refused in reverse.
//   - A real replacement through the waiver routes: someone on a team gone home, a free agent still in claimed for them (PUT
//     /waivers/claims), the commissioner's Process now (POST /waivers/process): the move in the league's log, from Episode 5.
//   - Before Episode 6's results: the replacement has earned nothing yet (the Games tab's table as each copy reads it is the
//     engine's; the claimer's total is what it was, where today's count would give the newcomer's whole place); the player who lost
//     someone keeps what they earned.
//   - Episode 6 airs and its results come in (someone else goes home): the replacement earns the boot it outlasted, half of 1;
//     the Games tab's table as alex, riley, jordan (seen through 6) and sam (3) read it is the engine's on each one's copy; the
//     hub's place for the claimer is the Games tab's.
//   - C4, the user's second game whole: someone else on a team goes home in Episode 6 (a team that's seen it, not the claimer's);
//     its holder claims someone on another team for them, refused while replacements are only someone on nobody's team ("Claim
//     free agents only"); Couch Cup's replacements made shared (extras.waivers.own { replace: 'shared' }, settings.waiverOwn, its
//     words), the same claim goes through the waiver routes and Process now: the newcomer on both teams, the move logged, the
//     Games tab's table the engine's.
//   - The game-specs flag's check passes on it.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-multipliers.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt rows only; refuses a non-local database. Shares
// new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then ALL PASS or how many failed.
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
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-multipliers runs against a local database only");
const keep = process.argv.includes("--keep");
const WHO = ["alex", "riley", "jordan", "sam"];
const MULTIPLY = [{ joined: "replacement", times: [0.5, 0.25] }];

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
    const gameIn = async (who) => ((await as[who].call("GET", `/api/seasons/${sid}/games?couch=${fx.couchId}`)).body.games ?? []).find((x) => x.leagueId === L) ?? null;
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
    const decide = async (n, name) => {
      await pool.query(
        `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
         VALUES ($1, $2, 'elimination', $3, 'Voted Out', '', 'accepted', true, now(), false)`,
        [sid, n, name]
      );
      await syncSeasonLeagues(sid, null);
    };
    const totals = (v) => Object.fromEntries(S.computeScores(v).map((r) => [whoOf(r.playerId), r.total]));
    const tableOf = (g) => Object.fromEntries((g?.table ?? []).map((r) => [whoIs(r.userId), r.points]));
    // The engine's table on each one's copy, and the same copy scored without the multiplier (today's count).
    const copies = async (who, mark) => {
      const st = await league();
      const view = S.GhostLogic.viewFor(st, pids[who], mark);
      const plain = JSON.parse(JSON.stringify(view));
      delete plain.settings.joinedTimes;
      if (plain.settings.game && plain.settings.game.score) delete plain.settings.game.score.multiply;
      return { view, plain };
    };

    // ---------- the game ----------
    let st = await league();
    // No auto-fill: a loss in Episode 6 is still owed in its week (C4's claim below), not filled as the week before closes.
    const waivers = { ...S.gameOf(st).extras.waivers, replace: "always", freeAgency: true, autoFill: false };
    const extras = { ...S.gameOf(st).extras, waivers };
    const reverse = await setGame({ score: { by: "place", reverse: true, multiply: MULTIPLY }, extras });
    check(reverse.some((p) => p.at === "score.multiply" && /In reverse/.test(p.problem)) && (await league()).settings.joinedTimes === undefined,
      "Couch Cup in reverse with a multiplier on how they joined: refused, nothing written", JSON.stringify(reverse));
    const problems = await setGame({ score: { by: "place", multiply: MULTIPLY }, extras });
    st = await league();
    const words = G.describeSpec(S.gameOf(st)).sentence;
    check(!problems.length && same((st.settings.joinedTimes ?? []).map((m) => [m.joined, m.times]), MULTIPLY.map((m) => [m.joined, m.times])) && S.getLeagueType(st).id === "classic-draft" && /Your first replacement scores half, your second a quarter/.test(words),
      "Couch Cup's replacements score half, then a quarter (settings.joinedTimes; still an Outlast; its words)", JSON.stringify({ problems, joined: st.settings.joinedTimes, words }));

    // ---------- a real replacement through the waiver routes ----------
    // Someone on a team gone home, and a free agent still in.
    const ownerOf = (c) => (c.ownerIds ?? [])[0];
    const gone = st.castaways.find((c) => c.status === "eliminated" && ownerOf(c) && whoOf(ownerOf(c)) !== ownerOf(c));
    const free = st.castaways.find((c) => c.status === "active" && !(c.ownerIds ?? []).length);
    check(!!gone && !!free, "A team with someone gone home, and a free agent still in", JSON.stringify({ gone: gone?.name, free: free?.name }));
    const claimer = whoOf(ownerOf(gone));
    const L_ = `/api/leagues/${L}`;
    let r = await as[claimer].call("GET", `${L_}/waivers`);
    check(r.status === 200, `  ${claimer} reads the waiver week`, `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await as[claimer].call("PUT", `${L_}/waivers/claims`, { pairs: [{ addId: free.id, dropId: gone.id }] });
    check(r.status === 200, `  ${claimer} claims ${free.name} for ${gone.name}`, `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await as.alex.call("POST", `${L_}/waivers/process`);
    check(r.status === 200, "  the commissioner's Process now", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    st = await league();
    const tx = (st.midSeason?.log ?? []).find((x) => x.addedCastawayId === free.id);
    check(!!tx && tx.type === "replenish" && tx.playerId === pids[claimer] && tx.droppedCastawayId === gone.id && tx.episode === 5 && (st.castaways.find((c) => c.id === free.id)?.ownerIds ?? []).includes(pids[claimer]),
      `  the move in the league's log: ${claimer}'s replacement after Episode 5`, JSON.stringify(tx));

    // ---------- before Episode 6's results: the replacement has earned nothing yet ----------
    const mark5 = await copies(claimer, 5);
    const t5 = totals(mark5.view);
    const p5 = totals(mark5.plain);
    // Today's count: the newcomer's whole place (still in after 5 boots... 1 plus the boots so far) and the one gone for nobody.
    const outBy5 = st.castaways.filter((c) => c.status === "eliminated" && typeof c.placementOrder === "number").length;
    check(t5[claimer] === p5[claimer] - (outBy5 + 1) + gone.placementOrder,
      `  ${claimer}'s total keeps ${gone.name}'s ${gone.placementOrder} and gives ${free.name} nothing yet (${t5[claimer]}; today's count ${p5[claimer]})`, JSON.stringify({ t5, p5, outBy5 }));
    let g = await gameIn(claimer);
    check(sameBy(tableOf(g), t5), `  the Games tab as ${claimer} reads it: the engine's table (${JSON.stringify(t5)})`, JSON.stringify({ api: tableOf(g), want: t5 }));

    // ---------- Episode 6 airs; someone else goes home ----------
    st = await league();
    // C4: someone on the team of one who's seen Episode 6 (not the claimer's), so they can replace them below; else anyone still in.
    const onTeam = (c) => ownerOf(c) && ["alex", "riley", "jordan"].includes(whoOf(ownerOf(c))) && whoOf(ownerOf(c)) !== claimer;
    const goner = st.castaways.find((c) => c.status === "active" && c.id !== free.id && onTeam(c)) ?? st.castaways.find((c) => c.status === "active" && c.id !== free.id);
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    await decide(6, goner.name);
    for (const who of ["alex", "riley", "jordan"]) await seen(who, 6);
    st = await league();
    check(st.castaways.find((c) => c.id === goner.id)?.status === "eliminated", `Episode 6 through the season sync: ${goner.name} voted out`);
    for (const who of WHO) {
      const mark = who === "sam" ? 3 : 6;
      const { view, plain } = await copies(who, mark);
      const want = totals(view);
      g = await gameIn(who);
      check(sameBy(tableOf(g), want), `  the Games tab as ${who} reads it (seen through ${mark}): the engine's table on that copy (${JSON.stringify(want)})`,
        JSON.stringify({ api: tableOf(g), want, without: totals(plain) }));
      if (who === claimer && mark === 6) {
        // From 5 to 6 the newcomer outlasted one boot: half of 1 where today's count gives 1, the rest of the team the same both ways.
        const grew = want[claimer] - t5[claimer];
        const grewPlain = totals(plain)[claimer] - p5[claimer];
        check(Math.abs(grewPlain - grew - 0.5) < 0.005,
          `  ${claimer}'s Episode 6: ${free.name} earns half of the boot it outlasted (0.5 where today's count gives 1)`, JSON.stringify({ t5: t5[claimer], t6: want[claimer], p5: p5[claimer], p6: totals(plain)[claimer] }));
      }
    }
    const hub = (await as[claimer].call("GET", `/api/couches/${fx.couchId}/hub`)).body;
    const there = (hub?.games ?? []).find((x) => x.leagueId === L);
    g = await gameIn(claimer);
    check(!!there && there.rank === g?.you?.rank, `  the hub's place for ${claimer} in Couch Cup is the Games tab's (${g?.you?.rank})`, JSON.stringify({ hub: there?.rank, games: g?.you?.rank }));

    // ---------- C4: the user's second game whole, its replacements from anyone still in ----------
    st = await league();
    const loser = ownerOf(st.castaways.find((c) => c.id === goner.id)) ? whoOf(ownerOf(goner)) : null;
    const taken = st.castaways.find((c) => c.status === "active" && ownerOf(c) && !(c.ownerIds ?? []).includes(pids[loser]));
    check(!!loser && loser !== claimer && !!taken, `${loser}'s ${goner.name} gone home, and ${taken?.name} on ${taken ? whoOf(ownerOf(taken)) : "?"}'s team`, JSON.stringify({ loser, taken: taken?.name }));
    // Revealed through Episode 6 in this league, as a reveal marks it (the waiver routes ask for it).
    await pool.query("UPDATE league_memberships SET results_seen_through = 6 WHERE league_id = $1 AND user_id = $2", [L, fx.users[loser]]);
    r = await as[loser].call("GET", `${L_}/waivers`);
    check(r.status === 200, `  ${loser} reads the waiver week`, `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await as[loser].call("PUT", `${L_}/waivers/claims`, { pairs: [{ addId: taken.id, dropId: goner.id }] });
    check(r.status >= 400 && /free agents only/.test(JSON.stringify(r.body)), `  replacements from nobody's team: ${loser}'s claim for ${taken.name} refused`, `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    const sharedWaivers = { ...S.gameOf(st).extras.waivers, own: { replace: "shared" } };
    const made = await setGame({ extras: { ...S.gameOf(st).extras, waivers: sharedWaivers } });
    st = await league();
    const said = G.describeSpec(S.gameOf(st));
    check(!made.length && same(st.settings.waiverOwn, { replace: "shared" }) && same((S.gameOf(st).score.multiply ?? []).map((m) => [m.joined, m.times]), MULTIPLY.map((m) => [m.joined, m.times])) && /replacements from anyone still in/.test(said.sentence) && said.rules.some((x) => /^Lose someone\? Their replacement can be anyone still in/.test(x)),
      "Couch Cup's replacements from anyone still in (settings.waiverOwn; the multiplier kept; its words)", JSON.stringify({ made, own: st.settings.waiverOwn, multiply: S.gameOf(st).score.multiply, sentence: said.sentence, rules: said.rules.slice(0, 3) }));
    r = await as[loser].call("PUT", `${L_}/waivers/claims`, { pairs: [{ addId: taken.id, dropId: goner.id }] });
    check(r.status === 200, `  ${loser} claims ${taken.name} (${whoOf(ownerOf(taken))}'s) for ${goner.name}`, `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    r = await as.alex.call("POST", `${L_}/waivers/process`);
    check(r.status === 200, "  the commissioner's Process now", `${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
    st = await league();
    const both = st.castaways.find((c) => c.id === taken.id)?.ownerIds ?? [];
    const tx2 = (st.midSeason?.log ?? []).find((x) => x.addedCastawayId === taken.id && x.playerId === pids[loser]);
    check(both.includes(pids[loser]) && both.includes(ownerOf(taken)) && !!tx2 && tx2.type === "replenish" && tx2.droppedCastawayId === goner.id && !(st.castaways.find((c) => c.id === goner.id)?.ownerIds ?? []).includes(pids[loser]),
      `  ${taken.name} on both teams now (${both.map(whoOf).join(" and ")}), ${loser}'s move logged, ${goner.name} let go`, JSON.stringify({ both, tx2 }));
    g = await gameIn(loser);
    const want6 = totals((await copies(loser, 6)).view);
    check(sameBy(tableOf(g), want6), `  the Games tab as ${loser} reads it: the engine's table (${JSON.stringify(want6)})`, JSON.stringify({ api: tableOf(g), want: want6 }));

    // ---------- the game-specs flag's check ----------
    const flagged = checkLeague(await league());
    check(flagged.ok, "The game-specs flag's check passes on Couch Cup", JSON.stringify(flagged));
  } catch (e) {
    failures++;
    console.log(`FAIL  threw: ${e && e.stack ? e.stack : e}`);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.log(`(fixture down: ${e.message})`));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
