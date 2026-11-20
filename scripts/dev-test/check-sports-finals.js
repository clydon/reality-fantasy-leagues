// Dev-only check of a sports final never zeroed silently and read again for corrections (docs/PLAN-sports-ready.md step 1.2;
// src/lib/server/sports/finals.ts saveFinals, migration 0309). Before it, a final whose box score couldn't be read was kept as none
// two days on and never asked again: everyone in it scored 0 and nobody was told; and a kept final was never read again, so ESPN's
// corrections (the NFL's land midweek) never reached a table.
//
// On nfl-slate-fixture.js (the recorded 2026 NFL season through the stand-in ESPN, the clock an hour before the week's first game,
// a default season game started on it), with the week played a day at a time, the daily job each morning as production runs it:
//   unreadable      one of the week's games served with no box score: said on its row (read_tries, read_error) and asked again;
//                   its week waits while it's retried (never a zero yet)
//   kept as none    two days on, kept as none so its week can finish, but flagged: read_error stays, and the desk's Inbox lists it
//                   (desk-inbox.ts, a "Scores" item)
//   a correction    another game's box score edited after it was kept (its quarterback's passing yards up 22): read again about a
//                   day after it was kept, kept anew with a new lines_at, and the season game reads the new line
//   healed          the unreadable game's box score served again: read on the next try, its flag and the Inbox item gone
// Prints PASS/FAIL; its last line says whether finals are read and kept right.
//
//   node scripts/dev-test/check-sports-finals.js [--week=9] [--keep]
//
// Needs the local database (migration 0309 applied) and the NFL recording (see nfl-slate-fixture.js); no app server, never the
// real ESPN. Its rows are the fixture's (--keep leaves them). Don't run it beside another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "9"));
const HOUR = 3600_000;
const DAY = 24 * HOUR;
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);

(async () => {
  const week = fx.weeksOf(fx.recording().input).find((w) => w.n === WEEK);
  if (!week || week.games.some((g) => g.state !== "post" || !g.box)) throw new Error(`--week=${WEEK} isn't a week the recording has played`);
  const w = await fx.up({ at: new Date(Date.parse(week.first) - HOUR).toISOString() });
  try {
    const { leagueGames } = fx.app("../../src/lib/server/sports/score.ts");
    const { inbox } = fx.app("../../src/lib/server/desk-inbox.ts");
    const event = (id) => w.input.events.find((e) => e.id === id);
    const row = async (id) => (await w.pool.query("SELECT lines, lines_at, read_tries, read_error, checked_at FROM sports_events WHERE league = $1 AND event_id = $2", [fx.LEAGUE, id])).rows[0];
    const sunday = week.games.filter((g) => new Date(g.at).getUTCDay() === 0);
    // The unreadable game, and the game a correction comes to (its quarterback's passing yards), both on the Sunday.
    const U = sunday[0];
    const C = sunday.find((g) => g.id !== U.id && Object.values(g.box).some((t) => t.tables?.some((x) => x.name === "passing" && x.rows.length)));
    const savedBox = event(U.id).box;
    delete event(U.id).box;
    const s = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false });
    fact(`${week.label}: ${U.name} served with no box score; ${C.name}'s to be corrected; a season game started`);

    // The week played to its Monday night: every final but U's kept, U retried, the week not counted yet.
    await w.days(new Date(Date.parse(week.last) + 8 * HOUR).toISOString());
    const u1 = await row(U.id);
    check(u1.lines === null && u1.read_tries >= 1 && !!u1.read_error, `the unreadable game is said on its row and asked again, never zeroed (${u1.read_tries} tries: "${u1.read_error}")`, u1);
    let g = await leagueGames(await w.league(s.leagueId));
    check(!g?.done.has(WEEK), `its week waits while it's retried (${week.label} not counted yet)`);

    // A correction comes to C: its quarterback's passing yards up 22.
    const side = Object.values(event(C.id).box).find((t) => t.tables?.some((x) => x.name === "passing" && x.rows.length));
    const passing = side.tables.find((x) => x.name === "passing");
    const qb = passing.rows[0];
    const col = passing.labels.indexOf("YDS");
    const before = (await row(C.id)).lines?.[qb.id]?.PYDS;
    qb.stats[col] = String(Number(qb.stats[col]) + 22);
    const keptAt = (await row(C.id)).lines_at;
    fact(`${qb.name}'s ${C.name} passing yards: ${before}, then ESPN corrects them to ${qb.stats[col]}`);

    // Two days on: U kept as none and flagged; C read again a day after it was kept, its correction kept.
    await w.days(new Date(Date.parse(week.last) + 2 * DAY + 12 * HOUR).toISOString());
    const u2 = await row(U.id);
    check(JSON.stringify(u2.lines) === "{}" && !!u2.read_error, `two days on, the unreadable game is kept as none so its week can finish, flagged ("${u2.read_error}")`, u2);
    const items = (await inbox()).items.filter((i) => i.kind === "sports");
    const uName = (await w.pool.query("SELECT name FROM sports_events WHERE league = $1 AND event_id = $2", [fx.LEAGUE, U.id])).rows[0]?.name;
    check(!!uName && items.some((i) => i.title.includes(uName) && i.href.includes(w.seasonId)), `the desk's Inbox lists it (${items.map((i) => `"${i.title}"`).join(", ") || "nothing"})`);
    const c2 = await row(C.id);
    check(c2.lines?.[qb.id]?.PYDS === before + 22 && new Date(c2.lines_at) > new Date(keptAt), `the correction is kept: ${qb.name} ${c2.lines?.[qb.id]?.PYDS} passing yards, a new lines_at`, { PYDS: c2.lines?.[qb.id]?.PYDS, keptAt, now: c2.lines_at });
    g = await leagueGames(await w.league(s.leagueId));
    const castaway = (await w.league(s.leagueId)).castaways.find((x) => x.seasonCastId && x.name === qb.name);
    check(g?.done.has(WEEK) && g?.lines.get(WEEK)?.[castaway?.id]?.PYDS === before + 22, `the season game reads the corrected line (${week.label} counted: ${qb.name} ${g?.lines.get(WEEK)?.[castaway?.id]?.PYDS})`);

    // U's box score served again: read on the next try, the flag and the Inbox item gone.
    event(U.id).box = savedBox;
    await w.days(new Date(Date.parse(week.last) + 3 * DAY + 12 * HOUR).toISOString());
    const u3 = await row(U.id);
    check(Object.keys(u3.lines ?? {}).length > 0 && !u3.read_error, `served again, the game is read and its flag cleared (${Object.keys(u3.lines ?? {}).length} lines)`, u3);
    check(!(await inbox()).items.some((i) => i.kind === "sports"), "the desk's Inbox item is gone");

    console.log(failures ? "VERDICT (1.2): NOT YET: a final is still zeroed silently or a correction missed above" : "VERDICT (1.2): a final is never zeroed silently, and a correction reaches the table");
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
