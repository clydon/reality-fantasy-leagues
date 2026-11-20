// Dev-only check of injuries and byes as facts a sports game reads (docs/PLAN-sports-ready.md step 1.5; migration 0310). A roster's
// injury (ESPN's `injuries[0]`: Questionable, Injured Reserve...) is kept on the person (season_cast.injury, espn.ts readRoster's
// injuryOf: Q, D, O, IR...) and refreshed by the daily job's roster refresh; a league's slate's week marks the teams with no game in
// it (a bye: sports/locks.ts byesOf). A game reads both per request (state.castInjuries, ep.byeTeams), never saving them; the lineup
// editor and the draft room show them in the design round (Phase 4.1/4.2), so nothing here is on a screen yet.
//
// On nfl-slate-fixture.js (the recorded 2026 NFL season through the stand-in ESPN, the clock an hour before the week's first game;
// the recording has no injuries, so a few are given in ESPN's own shape), as zt-nfl-ann with a default season game:
//   injuries     a quarterback Questionable and a receiver on Injured Reserve: kept on the season's people with their codes, nobody
//                else with one, and the season game reads them by castaway
//   byes         the week played: the week's teams with no game in it (the recording's: every team its games don't name) stamped on
//                the game's episode, and the week after (linked halfway) none
//   kept current a day on, the quarterback healthy and the receiver Out: the daily job's roster refresh changes both
//   never saved  after a write, the stored game holds neither
// Prints PASS/FAIL.
//
//   node scripts/dev-test/check-sports-injuries-byes.js [--week=9] [--keep]
//
// Needs the local database (migration 0310 applied) and the NFL recording (see nfl-slate-fixture.js); no app server, never the real
// ESPN. Its rows are the fixture's (--keep leaves them). Don't run it beside another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "9"));
const HOUR = 3600_000;
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);

(async () => {
  const input = fx.recording().input;
  const week = fx.weeksOf(input).find((w) => w.n === WEEK);
  if (!week) throw new Error(`--week=${WEEK} isn't in the recording`);
  // Who gets hurt: the first quarterback and the first receiver of the week's first game's home team.
  const team = input.teams.find((t) => t.id === week.games[0].home);
  const qbOf = (inp) => inp.teams.find((t) => t.id === team.id).roster.find((r) => r.abbr === "QB");
  const wrOf = (inp) => inp.teams.find((t) => t.id === team.id).roster.find((r) => r.abbr === "WR");
  const w = await fx.up({
    at: new Date(Date.parse(week.first) - HOUR).toISOString(),
    edit: (inp) => {
      qbOf(inp).injuries = [{ status: "Questionable", date: "2026-11-04T20:00Z" }];
      wrOf(inp).injuries = [{ status: "Injured Reserve", date: "2026-10-12T15:00Z" }];
    },
  });
  try {
    const { readyLeague } = fx.app("../../src/lib/server/league-read.ts");
    const { withLeagueLock } = fx.app("../../src/lib/server/db.ts");
    const qb = qbOf(w.input);
    const wr = wrOf(w.input);
    const injuryOf = async (id) => (await w.pool.query("SELECT injury FROM season_cast WHERE season_id = $1 AND provider_ids->>'espn' = $2", [w.seasonId, String(id)])).rows[0]?.injury ?? null;
    const { rows: hurt } = await w.pool.query("SELECT name, injury FROM season_cast WHERE season_id = $1 AND injury IS NOT NULL", [w.seasonId]);
    fact(`${team.name}: ${qb.name} (QB) Questionable, ${wr.name} (WR) on Injured Reserve`);
    check(hurt.length === 2 && (await injuryOf(qb.id))?.code === "Q" && (await injuryOf(wr.id))?.code === "IR", `the season's people keep their injuries, Q and IR, and nobody else has one (${hurt.map((h) => `${h.name} ${h.injury.code}`).join(", ")})`);

    const s = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false });
    const castawayOf = async (st, id) => {
      const { rows } = await w.pool.query("SELECT id FROM season_cast WHERE season_id = $1 AND provider_ids->>'espn' = $2", [w.seasonId, String(id)]);
      return st.castaways.find((c) => c.seasonCastId === rows[0]?.id);
    };
    let st = await readyLeague(s.leagueId, await w.league(s.leagueId));
    const qbC = await castawayOf(st, qb.id);
    check(st.castInjuries?.[qbC?.id]?.code === "Q" && Object.keys(st.castInjuries ?? {}).length === 2, `the season game reads them by castaway (${qb.name}: ${st.castInjuries?.[qbC?.id]?.status})`);

    // The week played: its byes, and the next week's none while it's linked halfway.
    await w.days(new Date(Date.parse(week.last) + 8 * HOUR).toISOString());
    const playing = new Set(week.games.flatMap((g) => [g.home, g.away]));
    const want = input.teams.filter((t) => !playing.has(t.id)).map((t) => t.name).sort();
    st = await readyLeague(s.leagueId, await w.league(s.leagueId));
    const ep = st.episodes.find((e) => e.number === WEEK);
    check(JSON.stringify(ep?.byeTeams) === JSON.stringify(want), `${week.label}'s byes stamped: ${(ep?.byeTeams ?? []).join(", ") || "none"} (the recording's: ${want.join(", ")})`, ep?.byeTeams);
    const after = st.episodes.find((e) => e.number === WEEK + 1);
    const { rows: linkedNext } = await w.pool.query("SELECT count(*)::int AS n FROM season_events WHERE season_id = $1 AND episode = $2", [w.seasonId, WEEK + 2]);
    check(!after?.byeTeams || linkedNext[0].n > 0, `Week ${WEEK + 1}'s byes not said while it's the last week linked (${after?.byeTeams ? after.byeTeams.join(", ") : "none said"})`);

    // A day on: the quarterback healthy, the receiver Out; the daily job's roster refresh.
    delete qbOf(w.input).injuries;
    wrOf(w.input).injuries = [{ status: "Out", date: "2026-11-11T15:00Z" }];
    await w.days(new Date(Date.parse(week.last) + 32 * HOUR).toISOString());
    check((await injuryOf(qb.id)) === null && (await injuryOf(wr.id))?.code === "O", `a day on, the daily refresh keeps them current: ${qb.name} healthy, ${wr.name} Out`, { qb: await injuryOf(qb.id), wr: await injuryOf(wr.id) });

    // Never saved: a write, then the stored game.
    await withLeagueLock(s.leagueId, () => {});
    const stored = JSON.stringify(await w.league(s.leagueId));
    check(!stored.includes("castInjuries") && !stored.includes("byeTeams"), "after a write, the stored game holds neither (read per request)");

    console.log(failures ? "VERDICT (1.5): NOT YET" : "VERDICT (1.5): injuries and byes are facts a game reads, kept current, never saved");
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
