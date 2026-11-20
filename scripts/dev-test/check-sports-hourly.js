// Dev-only check of sports results within the hour (docs/PLAN-sports-ready.md step 1.1, part 1): the hourly GitHub Actions job's
// db/sports-refresh.js runs the sports part of the daily listings job every hour (at five past), so a week's last final is in the
// standings within the hour instead of the next morning's daily run.
//
// On nfl-slate-fixture.js (the recorded NFL season through the stand-in ESPN; a game is being played for 3½ hours after its start,
// then final as recorded), with a default season game started before the week:
//   the week to its Monday night   the daily job each morning: every game final and kept but Monday night's; the week not final
//   during Monday night's game     the job's run at five past: the game being played, the week still not final
//   after it                       the first run after its final (at most an hour on): the game final and kept, the week final
//                                  (score.ts leagueGames: every game in it done), the season game reading its lines
// (Since part 2 a week in progress counts its games final as they end: check-sports-week-in-progress.js. Here "final" is every
// game in it done.)
//   a run with nothing new         an hour later: nothing saved or corrected, and ESPN (the stand-in) asked little
// The runs are the job's own script (fixture world.hourly(): a process of its own on the fixture's clock, against the stand-in and
// this season only). Prints PASS/FAIL, and when the daily job alone would have had the week final.
//
//   node scripts/dev-test/check-sports-hourly.js [--week=9] [--keep]
//
// Needs the local database and the NFL recording (see nfl-slate-fixture.js); no app server, never the real ESPN. Its rows are the
// fixture's (--keep leaves them). Don't run it beside another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "9"));
const HOUR = 3600_000;
const MIN = 60_000;
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);
/** The hourly job's next run at or after `t`: five past an hour. */
const nextRun = (t) => {
  const d = new Date(t);
  d.setUTCMinutes(5, 0, 0);
  if (d.getTime() < t) d.setUTCHours(d.getUTCHours() + 1);
  return d.getTime();
};
const iso = (t) => new Date(t).toISOString();

(async () => {
  const week = fx.weeksOf(fx.recording().input).find((w) => w.n === WEEK);
  if (!week || week.games.some((g) => g.state !== "post" || !g.box)) throw new Error(`--week=${WEEK} isn't a week the recording has played`);
  const last = week.games[week.games.length - 1];
  const w = await fx.up({ at: iso(Date.parse(week.first) - HOUR) });
  try {
    const { leagueGames } = fx.app("../../src/lib/server/sports/score.ts");
    const s = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false });
    const counted = async () => {
      const g = await leagueGames(await w.league(s.leagueId));
      return { done: !!g?.done.has(WEEK), lines: Object.keys(g?.lines.get(WEEK) ?? {}).length };
    };
    const row = async (id) => (await w.pool.query("SELECT state, final, lines IS NOT NULL AS kept FROM sports_events WHERE league = $1 AND event_id = $2", [fx.LEAGUE, id])).rows[0];

    // The week to an hour before Monday night's game, the daily job each morning.
    await w.days(iso(Date.parse(last.at) - HOUR));
    const { rows: kept } = await w.pool.query(
      `SELECT count(*) FILTER (WHERE f.final AND f.lines IS NOT NULL)::int AS kept FROM season_events e JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id WHERE e.season_id = $1 AND e.episode = $2`,
      [w.seasonId, WEEK]
    );
    let c = await counted();
    check(kept[0].kept === week.games.length - 1 && !c.done, `${week.label} to Monday night: ${kept[0].kept} of ${week.games.length} finals kept, the week not final (${last.name} to play)`, { kept: kept[0].kept, c });

    // During Monday night's game: the job's run at five past.
    const during = nextRun(Date.parse(last.at) + HOUR);
    w.advance(iso(during));
    let out = await w.hourly();
    const r1 = await row(last.id);
    c = await counted();
    check(/\[sports-refresh\]/.test(out) && r1?.state === "in" && !r1.final && !c.done, `the job's run at ${iso(during).slice(11, 16)}Z, ${last.name} being played: not final, nor the week`, { r1, c, out: out.slice(0, 300) });

    // The first run after its final.
    const end = Date.parse(last.at) + fx.GAME_MS;
    const first = nextRun(end);
    w.advance(iso(first));
    out = await w.hourly();
    const r2 = await row(last.id);
    c = await counted();
    fact(`${last.name} final at ${iso(end).slice(11, 16)}Z; the job's next run at ${iso(first).slice(11, 16)}Z (${Math.round((first - end) / MIN)} minutes on): ${out.trim().split("\n").find((l) => /finals saved/.test(l))}`);
    check(r2?.final && r2.kept && c.done && c.lines > 0 && first - end <= HOUR, `within the hour of its final, it's kept and ${week.label} is final (${c.lines} lines in the season game)`, { r2, c });
    const morning = new Date(end);
    morning.setUTCHours(11, 0, 0, 0);
    if (morning.getTime() < end) morning.setUTCDate(morning.getUTCDate() + 1);
    fact(`the daily job alone would have had it final at ${iso(morning).slice(0, 16)}Z, ${((morning.getTime() - end) / HOUR).toFixed(1)} hours after the final`);

    // An hour later, nothing new.
    const asked = w.espn.asked.length;
    w.advance(iso(first + HOUR));
    out = await w.hourly();
    const line = out.trim().split("\n").find((l) => /finals saved/.test(l)) ?? "";
    const saved = Number(/(\d+) finals saved/.exec(line)?.[1] ?? NaN);
    const corrected = Number(/(\d+) corrected/.exec(line)?.[1] ?? NaN);
    fact(`the next run: ${line.replace("[sports-refresh] ", "")}; the stand-in asked ${w.espn.asked.length - asked} times`);
    check(saved === 0 && corrected === 0, "an hour later, a run with nothing new saves and corrects nothing");

    console.log(failures ? "VERDICT (1.1 part 1): NOT YET" : "VERDICT (1.1 part 1): a week's last final is in the standings within the hour");
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
