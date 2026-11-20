// Dev-only check of computer players on a real-size pool (docs/PLAN-sports-ready.md step 2.3: lineup slots for every team sport, and
// computer players setting legal lineups). On nfl-slate-fixture.js (the recorded 2026 NFL season through the stand-in ESPN, about
// 2,550 people), the clock an hour before --week's first game: zt-nfl-ann starts the NFL's default season game (its slots QB, 2 WR,
// 2 RB, TE, W/R/T, K, DEF and six on the bench) and fills it with computer players (computer-players.ts addBot, as Start a game's
// "computer players" does), Ann's own seat drafted for her the same way, and the draft run by the app's own read (readyLeague runs
// the computer players' turns). Then:
//   teams     every team can fill every lineup slot (StateLogic.SlotLogic.draftKeeps: no team of six quarterbacks and no kicker)
//   lineups   each computer player's lineup for the week fits the slots, and starts nobody on a bye (the week's ep.byeTeams) where
//             someone on the bench could take that slot
//   injured   one computer player's starter marked Out (season_cast.injury, as the roster refresh writes it), one its bench can
//             stand in for: on the next read it starts someone else, a full and legal lineup
//   (the clock goes on a day at a time, the daily job each morning, until the week being set has its byes said: step 1.5 says a
//   week's byes once a later week has a game linked)
// Prints PASS/FAIL.
//
//   node scripts/dev-test/check-sports-bot-lineups.js [--week=9] [--seats=8] [--keep]
//
// --week: a week the recording has played with byes (the 2026-11-15 recording's Week 9: two teams). Needs the local database
// (migration 0310 applied) and the NFL recording (see nfl-slate-fixture.js); no app server, never the real ESPN. Its rows are the
// fixture's (--keep leaves them; the next run removes them first). Don't run it beside another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "9"));
const SEATS = Number(arg("seats", "8"));
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
    const S = fx.app("../../src/lib/game/state-logic.js");
    const read = async (id) => readyLeague(id, await w.league(id));

    const s = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false });
    // Computer players to fill the seats, and Ann's seat drafted the same way; the draft started as the Commissioner's Start does.
    await withLeagueLock(s.leagueId, (st) => {
      for (let i = st.players.length; i < SEATS; i++) addBot(st, "normal");
      for (const p of st.players) p.automated = true;
      S.DraftLogic.forceStart(st);
    });
    let st = await read(s.leagueId);
    for (let i = 0; i < 20 && !S.DraftLogic.currentTurn(st)?.isComplete; i++) st = await read(s.leagueId);
    const turn = S.DraftLogic.currentTurn(st);
    check(!!turn?.isComplete, `the draft finished on the app's own reads (${st.draftPicksMade} picks, ${st.players.length} seats, ${st.castaways.length} people in the pool)`);
    check(S.SlotLogic.on(st), "the season game reads its slots (its people's positions stamped)", S.SlotLogic.summary(st));
    const slots = S.SlotLogic.expanded(st);
    const teams = st.players.map((p) => ({ p, ids: st.castaways.filter((c) => (c.ownerIds || []).includes(p.id)).map((c) => c.id) }));
    const short = teams.filter((t) => S.SlotLogic.match(st, t.ids, slots).size < slots.length);
    const pos = (id) => st.castProps?.[id]?.position ?? "?";
    for (const t of teams.slice(0, 3)) fact(`${t.p.name}: ${t.ids.map(pos).sort().join(" ")}`);
    check(!short.length, `every team can fill all ${slots.length} slots (${S.SlotLogic.summary(st)})`, short.map((t) => `${t.p.name}: ${t.ids.map(pos).join(" ")}`));

    // The week's lineups: legal, and nobody on a bye where the bench has someone for the slot. A week's byes are said once a later
    // week has a game linked (step 1.5), so the clock goes on a day at a time (the daily job each morning) until the week the computer
    // players are setting has them, or a week has passed.
    let ep = S.currentEpisode(st);
    for (let d = 1; d <= 7 && ep && !ep.byeTeams?.length; d++) {
      await w.days(new Date(fx.clock.now() + 24 * HOUR).toISOString());
      st = await read(s.leagueId);
      ep = S.currentEpisode(st);
    }
    const team = (id) => { const c = S.Core.getCastaway(st, id); return c?.tribeId ? S.Core.getTribe(st, c.tribeId)?.name : null; };
    const byes = new Set(ep?.byeTeams ?? []);
    check(byes.size > 0, `Week ${ep?.number}'s byes are said, so the bye case runs: ${[...byes].join(", ")}`);
    const bad = [];
    const idle = [];
    for (const t of teams) {
      const set = S.ActiveRosterLogic.lineupFor(st, ep.id, t.p.id);
      const why = S.SlotLogic.problem(st, set);
      if (why || !set.length) bad.push(`${t.p.name}: ${why || "no lineup"}`);
      for (const id of set.filter((x) => byes.has(team(x)))) {
        const bench = t.ids.filter((x) => !set.includes(x) && !byes.has(team(x)) && !S.ActiveRosterLogic.heldLocked(ep, x, fx.clock.now()));
        const swap = bench.some((b) => !S.SlotLogic.problem(st, [...set.filter((x) => x !== id), b]));
        if (swap) idle.push(`${t.p.name}: ${S.Core.getCastaway(st, id).name} (${team(id)})`);
      }
    }
    check(!bad.length, `each computer player's Week ${ep.number} lineup fits the slots`, bad);
    check(!idle.length, "nobody on a bye starts where the bench has someone for the slot", idle);

    // A starter Out (one the bench can stand in for, his game not started): his seat starts someone else in his place.
    const locked = (id) => S.ActiveRosterLogic.heldLocked(ep, id, fx.clock.now());
    let hurt = null;
    for (const t of teams) {
      const set = S.ActiveRosterLogic.lineupFor(st, ep.id, t.p.id);
      const bench = t.ids.filter((x) => !set.includes(x) && !byes.has(team(x)) && !locked(x));
      const id = set.find((x) => !locked(x) && bench.some((b) => !S.SlotLogic.problem(st, [...set.filter((y) => y !== x), b])));
      if (id) { hurt = { t, id }; break; }
    }
    if (!hurt) fact("no starter the bench could stand in for: the injured case is skipped");
    else {
      const c = st.castaways.find((x) => x.id === hurt.id);
      await w.pool.query("UPDATE season_cast SET injury = $2::jsonb WHERE id = $1", [c.seasonCastId, JSON.stringify({ code: "O", status: "Out", date: null })]);
      st = await read(s.leagueId);
      const after = S.ActiveRosterLogic.lineupFor(st, ep.id, hurt.t.p.id);
      check(!after.includes(hurt.id) && !S.SlotLogic.problem(st, after) && after.length === slots.length, `${hurt.t.p.name}'s ${pos(hurt.id)} ${c.name} Out: someone from the bench starts in his place`, after.map(pos));
    }

    console.log(failures ? "VERDICT (2.3): NOT YET" : "VERDICT (2.3): computer players draft teams that fill the slots and start legal lineups on a real-size pool");
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
