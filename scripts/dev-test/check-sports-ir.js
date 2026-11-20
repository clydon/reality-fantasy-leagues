// Dev-only check of injured reserve on a real season (docs/PLAN-sports-ready.md step 2.4: the spec's get.ir, StateLogic.IrLogic,
// POST /api/leagues/[id]/ir). On nfl-slate-fixture.js (the recorded 2026 NFL season through the stand-in ESPN, about 2,550 people),
// the clock an hour before --week's first game: zt-nfl-ann starts the NFL's default season game (two IR places, for someone listed
// IR, O or PUP), computer players fill the other seats and the draft runs on the app's own reads (Ann's seat drafted for her, then
// hers again). The route is called in this process, signed in as zt_nfl_ann (next-after-stub.js's NextResponse). Then:
//   the spec      the game has the NFL's two IR places
//   refused       a healthy receiver can't go on IR (400, the reason said)
//   on IR         Ann's receiver marked Out (season_cast.injury, as the roster refresh writes it) goes on IR through the route: he's
//                 out of this week's lineup, a lineup with him is refused, and her roster has an open spot
//   bots          a computer player's starter on injured reserve goes on its IR on the next read
//   the spot      once the week has its results (the clock on past its last game), a free agent added into it with no drop (free
//                 agency, the engine's own move on the stored game)
//   healthy       a day's injury report later he's healthy: her adds are blocked; bringing him back with a full roster is refused
//                 until she drops someone with it (the route's dropId), who goes back to the free agents
//   stored        the game keeps its IR moves (midSeason.ir), never the rosters' injuries (read per request)
// Prints PASS/FAIL.
//
//   node scripts/dev-test/check-sports-ir.js [--week=9] [--seats=4] [--keep]
//
// Needs the local database (migrations through 0311) and the NFL recording (see nfl-slate-fixture.js); no app server, never the real
// ESPN. Its rows are the fixture's (--keep leaves them; the next run removes them first). Don't run it beside another check on
// nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "9"));
const SEATS = Number(arg("seats", "4"));
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
  const w = await fx.up({ at: new Date(Date.parse(week.first) - HOUR).toISOString() });
  try {
    const { readyLeague } = fx.app("../../src/lib/server/league-read.ts");
    const { withLeagueLock } = fx.app("../../src/lib/server/db.ts");
    const { addBot } = fx.app("../../src/lib/game/computer-players.ts");
    const { auth } = fx.app("../../src/lib/auth.ts");
    const route = fx.app("../../src/app/api/leagues/[leagueId]/ir/route.ts");
    const S = fx.app("../../src/lib/game/state-logic.js");
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
    const ann = st.players.find((p) => p.userId === w.users.ann.id || p.name?.toLowerCase().includes("ann")) ?? st.players[0];
    await withLeagueLock(s.leagueId, (x) => { x.players.find((p) => p.id === ann.id).automated = false; });
    st = await read(s.leagueId);
    check(S.IrLogic.places(st) === 2 && JSON.stringify(S.IrLogic.config(st).takes) === '["IR","O","PUP"]', "the spec: the NFL's two IR places, for someone listed IR, O or PUP", S.IrLogic.config(st));

    // Signed in as Ann; the route called in this process.
    const signed = await auth.api.signInUsername({ body: { username: "zt_nfl_ann", password: fx.PASSWORD }, asResponse: true });
    const cookie = (signed.headers.getSetCookie?.() ?? [signed.headers.get("set-cookie") ?? ""]).map((c) => c.split(";")[0]).join("; ");
    const call = async (body) => {
      const req = new Request(`http://localhost/api/leagues/${s.leagueId}/ir`, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
      const res = await route.POST(req, { params: Promise.resolve({ leagueId: s.leagueId }) });
      return { status: res.status, body: await res.json() };
    };
    const pos = (x, id) => x.castProps?.[id]?.position ?? "?";
    const mine = (x, pid) => x.castaways.filter((c) => (c.ownerIds || []).includes(pid)).map((c) => c.id);
    const name = (x, id) => S.Core.getCastaway(x, id)?.name ?? id;
    const hurt = async (x, id, injury) => w.pool.query("UPDATE season_cast SET injury = $2::jsonb WHERE id = $1", [S.Core.getCastaway(x, id).seasonCastId, injury ? JSON.stringify(injury) : null]);
    const ep = S.currentEpisode(st);
    const receivers = mine(st, ann.id).filter((id) => pos(st, id) === "WR");
    check(receivers.length >= 2, `Ann drafted receivers: ${receivers.map((id) => name(st, id)).join(", ")}`);
    const [wr, other] = receivers;

    const healthy = await call({ action: "place", castawayId: other });
    check(healthy.status === 400 && /Only someone listed IR, O, PUP can go on IR/.test(healthy.body.error), `a healthy receiver can't go on IR: "${healthy.body.error}"`);

    await hurt(st, wr, { code: "O", status: "Out", date: null });
    const placed = await call({ action: "place", castawayId: wr });
    st = await read(s.leagueId);
    check(placed.status === 200 && S.IrLogic.onNow(st, ann.id).has(wr), `${name(st, wr)} Out: on Ann's IR through the route`, placed.body.error);
    check(!S.ActiveRosterLogic.lineupFor(st, ep.id, ann.id).includes(wr), `out of her Week ${ep.number} lineup`);
    check(/is on IR: bring them back to start them/.test(S.ActiveRosterLogic.validateLineup(st, ep.id, ann.id, [wr]) || ""), "a lineup with him is refused");
    check(S.IrLogic.openSpots(st, ann.id) === 1, "her roster has an open spot");

    // A computer player's starter on injured reserve: on its IR at the next read.
    const bot = st.players.find((p) => p.automated);
    const starter = S.ActiveRosterLogic.lineupFor(st, ep.id, bot.id).find((id) => !S.ActiveRosterLogic.heldLocked(ep, id, fx.clock.now()));
    await hurt(st, starter, { code: "IR", status: "Injured Reserve", date: null });
    st = await read(s.leagueId);
    check(S.IrLogic.onNow(st, bot.id).has(starter) && !S.ActiveRosterLogic.lineupFor(st, ep.id, bot.id).includes(starter), `${bot.name}'s ${pos(st, starter)} ${name(st, starter)} on injured reserve: on its IR, out of its lineup`);

    // The open spot: a free agent with no drop (free agency's own move, on the stored game). A waiver week needs an episode with
    // results: the clock on past the week's last game, a day at a time (its finals arrive, the daily job each morning). The roster
    // refresh rewrites everyone's injuries from the recording (none), so he's marked Out again.
    await w.days(new Date(Date.parse(week.last) + 32 * HOUR).toISOString());
    await hurt(st, wr, { code: "O", status: "Out", date: null });
    st = await read(s.leagueId);
    check(S.EpisodeLogic.hasResults(st.episodes.find((e) => e.number === WEEK)) && S.IrLogic.onNow(st, ann.id).has(wr), `Week ${WEEK} has its results; ${name(st, wr)} still on IR`);
    const free = st.castaways.filter((c) => !(c.ownerIds || []).length && pos(st, c.id) === "WR").map((c) => c.id);
    let added = null;
    await withLeagueLock(s.leagueId, (x) => {
      S.WaiverLogic.openWindow(x, 2, fx.clock.now());
      S.WaiverLogic.process(x, {}, { now: fx.clock.now() });
      const why = S.WaiverLogic.freeAgencyMove(x, ann.id, free[0], null, fx.clock.now());
      if (!why) added = free[0];
      else fact(`free agency: ${why}`);
    });
    st = await read(s.leagueId);
    check(!!added && mine(st, ann.id).includes(added) && S.IrLogic.openSpots(st, ann.id) === 0, `${name(st, added)} added into the open spot, nobody dropped`);

    // Healthy: adds blocked; back needs room.
    await hurt(st, wr, null);
    st = await read(s.leagueId);
    check(/is healthy: bring them back from IR, or drop them, before you add anyone/.test(S.IrLogic.addProblem(st, ann.id) || ""), `${name(st, wr)} healthy again: Ann's adds are blocked`);
    const full = await call({ action: "back", castawayId: wr });
    check(full.status === 400 && /Your roster is full: drop someone to bring/.test(full.body.error), `bringing him back with a full roster is refused: "${full.body.error}"`);
    const back = await call({ action: "back", castawayId: wr, dropId: added });
    st = await read(s.leagueId);
    check(back.status === 200 && !S.IrLogic.onNow(st, ann.id).size && !mine(st, ann.id).includes(added) && !S.Core.getCastaway(st, added).ownerIds.length, `back with ${name(st, added)} dropped (a free agent again); her adds open`, back.body.error);
    check(S.IrLogic.addProblem(st, ann.id) === null, "nothing blocks her adds");

    const stored = await w.league(s.leagueId);
    check(Array.isArray(stored.midSeason?.ir) && stored.midSeason.ir.length >= 3 && !JSON.stringify(stored).includes("castInjuries"), `stored: the IR moves (${stored.midSeason?.ir?.length}), never the rosters' injuries`);

    console.log(failures ? "VERDICT (2.4): NOT YET" : "VERDICT (2.4): IR plays on a real season, through its route and the computer players");
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
