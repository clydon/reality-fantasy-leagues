// Dev-only check of a sports season game's waivers on a real season (docs/PLAN-sports-ready.md step 2.5; BACKLOG 219). The NFL's
// default season game has waivers that run by themselves now (a window every week, no limit but the team, a rolling order: Yahoo's
// defaults), and with each player locking at his own game its free agency runs until the week's last game starts. On
// nfl-slate-fixture.js (the recorded 2026 NFL season through the stand-in ESPN), the clock an hour before --week's first game:
// zt-nfl-ann starts the NFL's default season game, computer players fill the other seats and the draft runs on the app's own reads
// (Ann's seat drafted for her, then hers again). The routes are called in this process, signed in as zt_nfl_ann. Then:
//   the spec      the game's waivers: a window every week, its swaps the team's size, a rolling order
//   none yet      no waiver week before the week has its results
//   opens         the week played and its results in (the clock on a day at a time, the daily job each morning): next week's waivers
//                 open by themselves, claims clearing the day before its first game, free agents until its last game starts
//   a claim       Ann's claim (the claims route) runs with the week: she gets her free agent, or is told who was ahead of her
//   the lock      during Thursday night's game, a free agent in it can't come in (the free-agency route's 400)
//   Saturday      a free agent whose game is Sunday comes in
//   closes        once Monday night's game starts, free agency is over
// Prints PASS/FAIL.
//
//   node scripts/dev-test/check-sports-waivers.js [--week=8] [--seats=4] [--keep]
//
// --week: a week the recording has played whose next week it has the games of (the 2026-11-15 recording: up to 9; its Week 10
// isn't played, so the default, 8, plays Week 9 as the week the waivers are for). Needs the local database and the NFL recording
// (see nfl-slate-fixture.js); no app server, never the real ESPN. Its rows are the fixture's (--keep leaves them; the next run
// removes them first). Don't run it beside another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "8"));
const SEATS = Number(arg("seats", "4"));
const HOUR = 3600_000;
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);
const iso = (t) => new Date(t).toISOString();

(async () => {
  const input = fx.recording().input;
  const weeks = fx.weeksOf(input);
  const week = weeks.find((w) => w.n === WEEK);
  const next = weeks.find((w) => w.n === WEEK + 1);
  if (!week || !next?.first) throw new Error(`--week=${WEEK} and the week after need to be in the recording`);
  const w = await fx.up({ at: iso(Date.parse(week.first) - HOUR) });
  try {
    const { readyLeague } = fx.app("../../src/lib/server/league-read.ts");
    const { withLeagueLock } = fx.app("../../src/lib/server/db.ts");
    const { addBot } = fx.app("../../src/lib/game/computer-players.ts");
    const { auth } = fx.app("../../src/lib/auth.ts");
    const claimsRoute = fx.app("../../src/app/api/leagues/[leagueId]/waivers/claims/route.ts");
    const faRoute = fx.app("../../src/app/api/leagues/[leagueId]/waivers/free-agency/route.ts");
    const S = fx.app("../../src/lib/game/state-logic.js");
    const W = S.WaiverLogic;
    const read = async (id) => readyLeague(id, await w.league(id));

    const s = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false });
    await withLeagueLock(s.leagueId, (st) => {
      for (let i = st.players.length; i < SEATS; i++) addBot(st, "normal");
      for (const p of st.players) p.automated = true;
      S.DraftLogic.forceStart(st);
    });
    let st = await read(s.leagueId);
    for (let i = 0; i < 20 && !S.DraftLogic.currentTurn(st)?.isComplete; i++) st = await read(s.leagueId);
    check(!!S.DraftLogic.currentTurn(st)?.isComplete, `the draft finished on the app's own reads (${st.draftPicksMade} picks)`);
    const ann = st.players[0];
    await withLeagueLock(s.leagueId, (x) => { x.players.find((p) => p.id === ann.id).automated = false; });
    st = await read(s.leagueId);
    const wv = W.waivers(st);
    check(wv.windows.schedule === "everyEpisode" && wv.windows.swaps === 15 && wv.order === "rolling" && !wv.daily, "the spec: a window every week, its swaps the team's (15), a rolling order", wv);
    check(!W.current(st), `no waiver week before Week ${WEEK} has its results`);

    // Signed in as Ann; the routes called in this process.
    const signed = await auth.api.signInUsername({ body: { username: "zt_nfl_ann", password: fx.PASSWORD }, asResponse: true });
    const cookie = (signed.headers.getSetCookie?.() ?? [signed.headers.get("set-cookie") ?? ""]).map((c) => c.split(";")[0]).join("; ");
    const call = async (route, method, sub, body) => {
      const req = new Request(`http://localhost/api/leagues/${s.leagueId}/waivers/${sub}`, { method, headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
      const res = await route[method](req, { params: Promise.resolve({ leagueId: s.leagueId }) });
      return { status: res.status, body: await res.json() };
    };

    // The week played, its results in: next week's waivers open by themselves.
    await w.days(iso(Date.parse(week.last) + 32 * HOUR));
    // As the hourly job's runs do (db/waivers.js): a write makes the next episode (withLeagueLock's ensureNextEpisode, after its
    // waiver clock), the next opens its waivers.
    await withLeagueLock(s.leagueId, () => {});
    await withLeagueLock(s.leagueId, () => {});
    st = await read(s.leagueId);
    const p = W.current(st);
    const ep = st.episodes.find((e) => e.number === WEEK + 1);
    const lastStart = S.ActiveRosterLogic.lastStartOf(ep);
    check(!!p && p.episode === WEEK && p.phase === "open" && p.window && p.swaps === 15, `Week ${WEEK}'s results open ${next.label}'s waivers by themselves`, p);
    check(!!p && Date.parse(p.processAt) === Date.parse(ep.airsAt) - 24 * HOUR, `claims clear the day before its first game (${p?.processAt}; it starts ${ep.airsAt})`);
    check(!!p && Date.parse(p.closesAt) === lastStart, `free agents until its last game starts (${p?.closesAt}), not its first`);

    // Ann's claim: a free receiver for her lowest-rated bench player (by whom she drafted last).
    const pos = (id) => st.castProps?.[id]?.position ?? "?";
    const mine = st.castaways.filter((c) => (c.ownerIds || []).includes(ann.id)).map((c) => c.id);
    const starting = new Set(S.ActiveRosterLogic.lineupFor(st, ep.id, ann.id));
    const drop = [...mine].reverse().find((id) => !starting.has(id));
    const team = (id) => { const c = S.Core.getCastaway(st, id); return c?.tribeId ? S.Core.getTribe(st, c.tribeId)?.name : null; };
    const games = (id) => ep.holdingGames?.[id] ?? [];
    const firstGame = Object.entries(ep.gameStarts).sort((a, b) => Date.parse(a[1].at) - Date.parse(b[1].at))[0];
    const free = st.castaways.filter((c) => !(c.ownerIds || []).length && pos(c.id) === "WR" && games(c.id).length).map((c) => c.id);
    const sunday = free.filter((id) => !games(id).includes(firstGame[0]));
    const thursday = free.filter((id) => games(id).includes(firstGame[0]));
    const claimed = sunday[sunday.length - 1];
    const sent = await call(claimsRoute, "PUT", "claims", { pairs: [{ addId: claimed, dropId: drop }] });
    check(sent.status === 200, `Ann's claim sent: ${S.Core.getCastaway(st, claimed).name} for ${S.Core.getCastaway(st, drop).name}`, sent.body.error);
    await w.advance(iso(Date.parse(p.processAt) + 60_000));
    st = await read(s.leagueId);
    const ran = W.periods(st).find((x) => x.id === p.id);
    const mineRun = (ran?.run?.results ?? []).filter((r) => r.playerId === ann.id);
    const got = mineRun.find((r) => r.outcome === "got");
    check(ran?.phase === "processed" && (got?.castawayId === claimed || mineRun.some((r) => r.passed?.length)), `the week ran: Ann ${got ? `got ${S.Core.getCastaway(st, claimed).name}` : `was told why not (${JSON.stringify(mineRun.map((r) => r.outcome))})`}`, ran?.run);

    // Thursday night's game under way: a free agent in it can't come in.
    const tnf = Date.parse(firstGame[1].at);
    await w.advance(iso(tnf + 30 * 60_000));
    st = await read(s.leagueId);
    const benchNow = st.castaways.filter((c) => (c.ownerIds || []).includes(ann.id)).map((c) => c.id).filter((id) => !S.ActiveRosterLogic.lineupFor(st, ep.id, ann.id).includes(id) && !games(id).includes(firstGame[0]));
    if (!thursday.length) fact(`no free receiver plays ${team(thursday[0]) ?? "Thursday night"}: the lock case is skipped`);
    else {
      const locked = await call(faRoute, "POST", "free-agency", { addId: thursday[0], dropId: benchNow[0] });
      check(locked.status === 400 && /game has started: add them once the day's over/.test(locked.body.error), `Thursday night: ${S.Core.getCastaway(st, thursday[0]).name} (${team(thursday[0])}, playing) can't come in: "${locked.body.error}"`);
    }

    // Saturday: a free agent whose game is Sunday comes in.
    await w.advance(iso(tnf + 2 * 24 * HOUR));
    st = await read(s.leagueId);
    const sat = st.castaways.filter((c) => !(c.ownerIds || []).length && pos(c.id) === "WR" && games(c.id).length && !games(c.id).includes(firstGame[0])).map((c) => c.id)[0];
    const bench2 = st.castaways.filter((c) => (c.ownerIds || []).includes(ann.id)).map((c) => c.id).filter((id) => !S.ActiveRosterLogic.lineupFor(st, ep.id, ann.id).includes(id) && !games(id).includes(firstGame[0]))[0];
    const added = await call(faRoute, "POST", "free-agency", { addId: sat, dropId: bench2 });
    st = await read(s.leagueId);
    check(added.status === 200 && (S.Core.getCastaway(st, sat).ownerIds || []).includes(ann.id), `Saturday: ${S.Core.getCastaway(st, sat).name} (${team(sat)}, playing Sunday) comes in for ${S.Core.getCastaway(st, bench2).name}`, added.body.error);

    // Monday night's game starts: free agency is over.
    await w.advance(iso(lastStart + 60_000));
    st = await read(s.leagueId);
    const late = st.castaways.find((c) => !(c.ownerIds || []).length && pos(c.id) === "WR")?.id;
    const shut = await call(faRoute, "POST", "free-agency", { addId: late, dropId: bench2 === sat ? mine[0] : sat });
    check(shut.status === 400 && /Free agency isn’t open/.test(shut.body.error) && !W.current(st), `once ${next.label}'s last game starts, free agency is over: "${shut.body.error}"`);

    console.log(failures ? "VERDICT (2.5): NOT YET" : "VERDICT (2.5): the NFL's waivers run by themselves, weekly, its free agency through the week with each player's lock");
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
