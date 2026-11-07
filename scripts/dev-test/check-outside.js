// Dev-only check of a number from a vetted outside source (docs/PLAN-start-a-game-gpt.md step A14 part 7: game-spec schema.js
// `settle: { by: 'outside', take: 'rating' }`, answers.js outsideVerdict; db/outside-numbers.js settleOutside, the read once and
// stored; src/lib/server/outside-numbers.ts, the grader's facts.outside and our check's ctx.tvmaze; answers.ts's refusals) against the
// dev server, through the API (no screens: they're the UI track's), on new-fixture.js's couch (alex, riley, jordan, sam on ZT Survivor
// 51: results through Episode 5, Episode 6 three days off). TVmaze is never asked: the read's fetch is a stand-in. In order:
//   - jordan starts a Survival Pool for Episode 6 on, riley and sam join it, and it's made a game of questions through
//     RosterLogic.setGame with the show's ctx: the episode's TVmaze rating (3 points, the closest) and over or under 7.5 (a point).
//     With the season not linked to TVmaze, refused (our check's words); linked (a zt listing id), made, with its words.
//   - Episode 6's questions through the answers route: riley 7.3 and under, sam 7.9 and under, jordan 12 refused (a rating, 0 to 10),
//     then 7.6 and over.
//   - Episode 6's results through the season sync: its rating questions wait (nothing read yet), nobody has points.
//   - Six days after it airs, the read finds nothing due; seven days after, it reads Episode 6's 7.4 (the game's first: nothing
//     before it) and stores it; the next read grades it: riley 4 (closest, under), sam 1 (under), jordan 0; the
//     Games tab ranks them. A second read with a later rating (9.9) stores nothing and changes nothing.
//   - The flag's check.
// Off since 2026-11-07 (the user said no to TVmaze's ratings as a source: ask.settle's outside is 'later' in VOCAB), so after the
// refusal it checks that a linked season's game waits too, and skips the rest until the piece is on again.
//
//   node scripts/lane.js dev   (or npm run dev; in another terminal)
//   node scripts/dev-test/check-outside.js [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it; the stored numbers go with its season); touches zt rows only;
// refuses a non-local database. Shares new-fixture's zt_nd_ couch with other checks: never run two at once. Prints PASS/FAIL, then
// ALL PASS or how many failed.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const { api } = require("./browser");
const fixture = require("./new-fixture");
const S = require("../../src/lib/game/state-logic.js");
const G = require("../../src/lib/game/game-spec/index.js");
const GameSpecs = require("../../db/game-specs.js");
const { settleOutside } = require("../../db/outside-numbers.js");
const { loadSeasons } = require("../../db/season-clock.js");
const Air = require("../../src/lib/game/air-schedule.js");
const { checkLeague } = require("../game-specs-flag.js");
const jiti = require("jiti")(__filename, {
  alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db"), "next/server": path.join(__dirname, "next-after-stub.js") },
});
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-outside runs against a local database only");
const keep = process.argv.includes("--keep");

let failures = 0;
function check(ok, label, detail) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${!ok && detail ? `\n      ${detail}` : ""}`);
}

const RATING = { id: "rating", ask: "What will the episode's TVmaze rating be?", answer: "number", points: 3, asked: "each", settle: { by: "outside", take: "rating" } };
const OU = { id: "ou", ask: "Over or under 7.5 on TVmaze?", answer: "overUnder", line: 7.5, points: 1, asked: "each", settle: { by: "outside", take: "rating", source: "tvmaze", after: 7 } };
const WHO = ["jordan", "riley", "sam"];
const DAY = 24 * 3600 * 1000;
const LISTING = 990777;

(async () => {
  const pool = new Pool({ connectionString: DB });
  const specsOn = await GameSpecs.gameSpecsOn(pool);
  try {
    const fx = await fixture.up(pool);
    const couch = fx.couchId;
    const sid = fx.seasonId;
    await pool.query("UPDATE show_seasons SET results_by = 'admin', listing_id = NULL WHERE id = $1", [sid]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [Object.values(fx.users)]);
    const q = `?couch=${couch}`;
    const as = {};
    for (const who of WHO) as[who] = await api({ user: `zt_nd_${who}`, pass: fixture.PASSWORD });
    const league = async (id) => (await pool.query("SELECT * FROM leagues WHERE id = $1", [id])).rows[0];
    const seen = (who, n) => pool.query("UPDATE show_follows SET seen_through = $3 WHERE user_id = $1 AND season_id = $2", [fx.users[who], sid, n]);
    const { questionContext } = jiti("../../src/lib/server/answers.ts");
    const { syncSeasonLeagues } = jiti("../../src/lib/server/season-decisions.ts");

    // ---------- The game ----------
    let r = await as.jordan.call("POST", `/api/seasons/${sid}/start${q}`, { game: "survivalPool", tell: false });
    const QG = r.body.leagueId;
    check(r.status === 200 && !!QG, "jordan starts a Survival Pool for Episode 6 on", JSON.stringify(r.body));
    for (const who of ["riley", "sam"]) {
      const o = await as[who].call("GET", `/api/couches/${couch}/games/${QG}`);
      const j = await as[who].call("POST", `/api/couches/${couch}/games/${QG}`, { action: "join", start: o.body.starts?.live ?? o.body.start ?? null });
      check(j.status === 200, `  ${who} joins it`, JSON.stringify(j.body).slice(0, 300));
    }
    const state0 = (await league(QG)).state;
    if (specsOn) GameSpecs.carryGame(state0.settings, true);
    const spec = { spec: 1, span: S.gameOf(state0).span, get: { by: "none" }, score: { by: "answers" }, ask: [RATING, OU] };
    const unlinked = await questionContext(QG, sid);
    const refused = S.setGame(JSON.parse(JSON.stringify(state0)), spec, { ctx: unlinked });
    check(unlinked.tvmaze === false && refused.length === 2 && refused.every((p) => /isn't linked to TVmaze/.test(p.problem)),
      "  the season not linked to TVmaze: refused, in our check's words", JSON.stringify(refused));
    await pool.query("UPDATE show_seasons SET listing_id = $2 WHERE id = $1", [sid, LISTING]);
    const ctx = await questionContext(QG, sid);
    if (G.VOCAB["ask.settle"].outside !== "now") {
      // Off (the user said no to TVmaze's ratings as a source, 2026-11-07): linked or not, nobody can make it. The rest runs once
      // `outside` is 'now' again (tests/outside-number.test.js keeps the built code checked meanwhile).
      const was = JSON.stringify(state0);
      const waits = S.setGame(state0, spec, { ctx });
      check(waits.length === 2 && waits.every((p) => /^ask\[[01]\]$/.test(p.at)) && JSON.stringify(state0) === was && state0.settings.leagueTypeId !== "questions",
        "  linked, but off (the user, 2026-11-07): it waits, the game untouched (still a Survival Pool)", JSON.stringify(waits));
      console.log("SKIP  the rest (its answers, the read, the grade, the flag): an outside number is off until the user says yes to a source");
      return;
    }
    const problems = S.setGame(state0, spec, { ctx });
    if (!problems.length) await pool.query("UPDATE leagues SET state = $1, updated_at = now() WHERE id = $2", [JSON.stringify(state0), QG]);
    const made = (await league(QG)).state;
    const words = G.describeSpec(S.gameOf(made), { castaway: "castaway" });
    check(ctx.tvmaze === true && !problems.length && made.settings.leagueTypeId === "questions" && words.rules.some((w) => /It's settled by the episode's TVmaze rating 7 days after it airs\. If TVmaze has no rating by then, it doesn't count either way\./.test(w)),
      "  linked: made a game of questions on Episode 6's TVmaze rating (its words)", JSON.stringify({ problems, words: words.rules }));

    // ---------- Episode 6's answers ----------
    for (const who of WHO) await seen(who, 5);
    const ask = (who, body) => as[who].call("POST", `/api/seasons/${sid}/answers?league=${QG}`, body);
    const read = async (who, episode) => (await as[who].call("GET", `/api/seasons/${sid}/answers?league=${QG}${episode ? `&episode=${episode}` : ""}`)).body;
    let g = await read("riley");
    check(g.episode === 6 && G.sameValue(g.questions?.map((x) => x.id), ["rating", "ou"]), "the answers route asks Episode 6's two rating questions", JSON.stringify([g.episode, g.questions?.map((x) => x.id)]));
    r = await ask("jordan", { answers: { rating: 12 } });
    check(r.status === 400 && /A rating, 0 to 10/.test(r.body?.error ?? ""), `  jordan's 12: refused (${r.body?.error})`, `${r.status} ${JSON.stringify(r.body)}`);
    const said = await Promise.all([ask("riley", { answers: { rating: 7.3, ou: "under" } }), ask("sam", { answers: { rating: 7.9, ou: "under" } }), ask("jordan", { answers: { rating: 7.6, ou: "over" } })]);
    check(said.every((x) => x.status === 200), "  riley 7.3 and under, sam 7.9 and under, jordan 7.6 and over", JSON.stringify(said.map((x) => x.body)));

    // ---------- Episode 6's results ----------
    await pool.query("UPDATE show_seasons SET premiere_date = premiere_date - 4 WHERE id = $1", [sid]);
    const st = (await league(QG)).state;
    const still = st.castaways.filter((c) => c.status !== "eliminated");
    await pool.query(
      `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, event_type, status, from_research, decided_at, post_merge)
       VALUES ($1, 6, 'elimination', $2, 'Voted Out', '', 'accepted', true, now(), false)`,
      [sid, still[0].name]
    );
    await syncSeasonLeagues(sid, null);
    for (const who of WHO) await seen(who, 6);
    g = await read("riley", 6);
    const waiting = g.questions?.filter((x) => ["rating", "ou"].includes(x.id)).map((x) => x.verdict?.state ?? x.state);
    check((g.points ?? 0) === 0 && !(await pool.query("SELECT 1 FROM outside_numbers WHERE season_id = $1", [sid])).rows.length,
      "Episode 6's results in: nothing read yet, so its rating questions wait (no points)", JSON.stringify({ points: g.points, waiting }));

    // ---------- The rating, read once ----------
    // Episode 6's air time as the read works it out (the season's schedule, moved four days back above).
    const [season] = await loadSeasons(pool, "ss.id = $1", [sid]);
    const airsAt = Air.episodeAirTime(season.schedule, 6, season.wikiAirDates).getTime();
    let asked = 0;
    const stand = (v) => async (id) => { asked++; if (id !== LISTING) throw new Error(`asked for ${id}`); return new Map([[6, v]]); };
    const quiet = () => {};
    const early = await settleOutside(pool, { now: airsAt + 6 * DAY, fetchRatings: stand(7.4), seasonIds: [sid], log: quiet });
    check(!early.some((x) => x.episode === 6), "  six days after Episode 6 aired: its rating isn't due", JSON.stringify(early));
    const stored = await settleOutside(pool, { now: airsAt + 7 * DAY + 60000, fetchRatings: stand(7.4), seasonIds: [sid], log: quiet });
    const rows = (await pool.query("SELECT episode, value::float AS value, why FROM outside_numbers WHERE season_id = $1 ORDER BY episode", [sid])).rows;
    const six = rows.find((x) => x.episode === 6);
    check(six?.value === 7.4 && rows.length === 1 && asked >= 1,
      "  seven days after: Episode 6's 7.4 stored (only from the game's first episode on)", JSON.stringify({ stored, rows }));
    g = await read("riley", 6);
    const table = ((await as.riley.call("GET", `/api/seasons/${sid}/games${q}`)).body.games ?? []).find((x) => x.leagueId === QG)?.table ?? [];
    const by = Object.fromEntries(table.map((t) => [Object.keys(fx.users).find((k) => fx.users[k] === t.userId), t.total]));
    check(g.points === 4 && by.riley === 4 && by.sam === 1 && (by.jordan ?? 0) === 0 && table[0].userId === fx.users.riley,
      "the next read grades it: riley 4 (closest, under), sam 1 (under), jordan 0; the Games tab ranks them", JSON.stringify({ points: g.points, table: by }));
    const again = await settleOutside(pool, { now: airsAt + 9 * DAY, fetchRatings: stand(9.9), seasonIds: [sid], log: quiet });
    const six2 = (await pool.query("SELECT value::float AS value FROM outside_numbers WHERE season_id = $1 AND episode = 6", [sid])).rows[0];
    const g2 = await read("riley", 6);
    check(!again.some((x) => x.episode === 6) && six2?.value === 7.4 && g2.points === 4, "  a later rating (9.9): nothing stored, nothing changes", JSON.stringify({ again, six2, points: g2.points }));

    // ---------- The flag ----------
    const flagged = checkLeague((await league(QG)).state);
    check(flagged.ok, "the game-specs flag's check passes on it", JSON.stringify(flagged));
  } catch (e) {
    failures++;
    console.log(`FAIL  the check threw: ${e.stack || e}`);
  } finally {
    if (!keep) await fixture.down(pool).catch((e) => console.log(`down: ${e.message}`));
    await pool.end();
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  }
})();
