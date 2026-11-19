// Dev-only check of BACKLOG 108 (docs/PLAN-sports-ready.md, Phase 0 (c), then Phase 1.6's fix): Pick'em on a league's slate, as
// the sports route starts it. POST /api/sports/start with { league, slate: {}, game: "pickem" } starts the sport's plain Pick'em
// (src/lib/sports/start-games.ts SLATE, the defaults' "pickem": one "Who wins?" an episode, with no `each: "game"`), and a slate's
// episode is a week of games, not one: does it ask about each game, and is a week graded once its games are final?
//
// On nfl-slate-fixture.js (the recorded NFL season through the stand-in ESPN, the process clock an hour before the week's first
// game), as zt-nfl-ann:
//   the route's Pick'em    started through start.ts startSport (the route's own function) on the week, answered with the winner of
//                          the week's first game, then the week played (the clock past its last game, the stand-in answering as of
//                          then) and the daily job's sports part run (its finals kept)
//   the control            the gallery's Pick'em (start-gallery/sports.json sp-pickem: `each: "game"`), started as the wizard starts
//                          it (start-spec.ts startFromSpec) on the same week and answered with every game's winner: proof that the
//                          week, its finals and the grading work, so a miss above is the route's game and not the setup
// What's asserted is where Phase 1.6 leaves it: the route's Pick'em is either refused on a slate (specProblems) or asks about each
// game and grades the week. On 2026-11-19 it fails: the route's Pick'em asks one question a week with no sides to pick from, takes an
// answer anyway, and never grades it (Phase 0 confirmed the inference); the control grades every game. Its last line says which.
//
//   node scripts/dev-test/check-slate-pickem.js [--week=9] [--keep]
//
// --week: a week the recording has played (every game final with its box score; the 2026-11-15 recording's are 1 to 9).
// Needs the local database and the NFL recording (see nfl-slate-fixture.js); no app server, no browser, never the real ESPN.
// Its rows are the fixture's (--keep leaves them; the next run removes them first). Don't run it beside another check on
// nfl-slate-fixture.js: they share its people and slate.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "9"));
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);

(async () => {
  const week = fx.weeksOf(fx.recording().input).find((w) => w.n === WEEK);
  if (!week || !week.games.length || week.games.some((g) => g.state !== "post" || !g.box)) throw new Error(`--week=${WEEK} isn't a week the recording has played (every game final with its box score)`);
  const winner = (g) => (g.score[0] > g.score[1] ? g.home : g.score[1] > g.score[0] ? g.away : null);
  const decided = week.games.filter((g) => winner(g) !== null);
  const first = week.games[0];
  const w = await fx.up({ at: new Date(Date.parse(week.first) - 3600_000).toISOString() });
  try {
    const { gameQuestions, answerQuestions } = fx.app("../../src/lib/server/answers.ts");
    const { startFromSpec } = fx.app("../../src/lib/server/start-spec.ts");
    const gallery = require("../../src/lib/game/start-gallery/sports.json").bases.find((b) => b.id === "sp-pickem").spec;
    fact(`${week.label}: ${week.games.length} games, ${decided.length} with a winner; the clock at ${new Date().toISOString()}`);

    // The route's Pick'em, as POST /api/sports/start { league, slate: {}, game: "pickem" } starts it.
    let plain = null;
    let refused = null;
    try {
      plain = await w.start("ann", { league: fx.LEAGUE, slate: {}, game: "pickem", tell: false });
    } catch (e) {
      refused = `${e.status ?? ""} ${e.message}`;
    }
    const control = await startFromSpec(w.users.ann, w.seasonId, w.couchId, { spec: { ...gallery, span: { from: WEEK, to: w.slate.episodes } }, name: "ZT per-game Pick'em", tell: false }, new Date());
    check(!!control.leagueId && control.from === WEEK, `the control (the gallery's Pick'em, each game) starts on ${week.label}`, control);
    if (refused) {
      fact(`the route's Pick'em is refused on a slate: ${refused}`);
      check(true, "the route's Pick'em on a slate: refused (Phase 1.6's other fix)");
    } else {
      check(plain.seasonId === w.seasonId && plain.from === WEEK, `the route's Pick'em starts on the fixture's slate from ${week.label}`, plain);
      const q = (await gameQuestions(w.users.ann, w.seasonId, plain.leagueId)).questions[0];
      fact(`its question: "${q.ask}" each ${q.each ?? "episode"}, ${q.games?.length ?? 0} games, sides ${JSON.stringify(q.faces ?? null)}`);
      check(q.each === "game" && q.games?.length === week.games.length, `the route's Pick'em asks about each of the week's ${week.games.length} games`, { each: q.each, games: q.games?.length ?? null });
    }
    const cq = (await gameQuestions(w.users.ann, w.seasonId, control.leagueId)).questions[0];
    check(cq.each === "game" && cq.games?.length === week.games.length && cq.games.every((g) => g.sides?.length === 2), `the control asks about each of the week's ${week.games.length} games, both sides of each`, { games: cq.games?.length });

    // Answers: the route's, the first game's winner (all a week-long question can take); the control's, every game's.
    if (plain) {
      const a = await answerQuestions(w.users.ann, w.seasonId, plain.leagueId, { episode: WEEK, answers: { winner: winner(first) ?? first.home } });
      fact(`the route's Pick'em took "${a.questions[0].mine}" (the ${first.name} winner) for ${week.label}`);
    }
    const picks = Object.fromEntries(week.games.map((g) => [g.id, winner(g) ?? g.home]));
    const ca = await answerQuestions(w.users.ann, w.seasonId, control.leagueId, { episode: WEEK, answers: { winner: picks } });
    check(Object.keys(ca.questions[0].mine ?? {}).length === week.games.length, `the control took a pick for every game (${Object.keys(ca.questions[0].mine ?? {}).length})`);

    // The week played: the clock on a day at a time past its last game, the daily job each morning (its finals kept as they come).
    const errors = await w.days(new Date(Date.parse(week.last) + 8 * 3600_000).toISOString());
    const { rows: kept } = await w.pool.query(
      `SELECT count(*) FILTER (WHERE f.final AND f.lines IS NOT NULL)::int AS kept, count(*)::int AS n FROM season_events e
         JOIN sports_events f ON f.provider = e.provider AND f.league = e.league AND f.event_id = e.event_id WHERE e.season_id = $1 AND e.episode = $2`,
      [w.seasonId, WEEK]
    );
    check(kept[0].kept === week.games.length, `after the week, the daily job kept every final (${kept[0].kept} of ${week.games.length}; errors: ${errors.length})`, errors);

    const cg = await gameQuestions(w.users.ann, w.seasonId, control.leagueId, WEEK);
    check(cg.points === decided.length, `the control graded: ${cg.points} of ${decided.length} points for every right pick`, { points: cg.points, verdict: cg.questions[0]?.verdict });
    if (plain) {
      const pg = await gameQuestions(w.users.ann, w.seasonId, plain.leagueId, WEEK);
      fact(`the route's Pick'em after the week: ${pg.points} points, verdict ${JSON.stringify(pg.questions[0]?.verdict ?? null)}, status ${pg.questions[0]?.status}`);
      check(pg.points >= 1, "the route's Pick'em graded the week: the right pick scored", { points: pg.points, verdict: pg.questions[0]?.verdict ?? null });
    }
    const controlOk = cg.points === decided.length;
    const plainGraded = !plain || (await gameQuestions(w.users.ann, w.seasonId, plain.leagueId, WEEK)).points >= 1;
    console.log(
      !controlOk
        ? "VERDICT (c): INCONCLUSIVE: the control wasn't graded either, so the setup, not the route's game, is in question"
        : plainGraded
          ? "VERDICT (c): STRUCK: the route's Pick'em on a slate is graded (or refused)"
          : "VERDICT (c): CONFIRMED: the route's Pick'em on a slate is never graded (BACKLOG 108); the gallery's per-game Pick'em is"
    );
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
