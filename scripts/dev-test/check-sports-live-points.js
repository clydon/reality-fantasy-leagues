// Dev-only check of live points during games (docs/PLAN-sports-ready.md step 1.1, part 3): a game being played counts its lines so
// far, from the server's live poller (src/lib/server/sports/live-lines.ts through live-proxy.ts), as part 2's week in progress, so a
// matchup moves play by play; only for someone the season shows everything to; never a seat at its own pace, nor anyone hiding
// sports scores; never stored, never a matchup decided by it.
//
// On nfl-slate-fixture.js (the recorded NFL season through the stand-in ESPN), with a game recorded play by play
// (tests/fixtures/espn/nfl-<event>.json, by default 49ers at Falcons, Week 7) replayed live by the stand-in at the fixture's clock.
// Six people on the couch:
//   a live game      ann, bo, cy and di, head to head from --week (the football season game's rules, a lineup of three); each drafted
//                    one player of the replayed game (its two passers and two leading runners) and two quarterbacks of other games
//                    of the week; di hides sports scores (Sports scores too), at the week before, then at the week itself
//   an own-pace game ed and flo, made at their own pace before the week aired (paceTogether: no seat has a pace of its own yet),
//                    each with one of the replayed game's passers
// Moments of the replayed game (the fixture's clock and the replay's on the same moment):
//   the second quarter  ann's read (season-games.ts, as GET /api/seasons/[id]/games answers): the week early, each total her seats'
//                       replayed players' points so far, each line the replay's plays added up as of then (the oracle: the sport's
//                       own reader on the recording as known then); every record 0-0; one ask of ESPN for the game however many
//                       reads; a read without live (a write's, any other read) none of it; di (at the week before, and at the week)
//                       and ed and flo (own pace) shown none of it; the own-pace game's copy for ed cut besides (GhostLogic.viewFor)
//   the fourth quarter  ann's totals moved on (play by play); the others still none
//   final, not yet kept the replay's last answer (final, its box score's correction) counts, before the hourly job keeps it: still
//                       early, no matchup decided
//   kept                the hourly job's run keeps the final: the replayed game's lines the same as live had them at its final
// Also: a league named "zt-..." is never asked of ESPN with no stand-in set; and the size of ann's read (JSON, gzipped) with and
// without live, for docs/HOSTING.md.
// Prints PASS/FAIL.
//
//   node scripts/dev-test/check-sports-live-points.js [--week=7] [--event=401873017] [--keep]
//
// Needs the local database, the NFL recording (see nfl-slate-fixture.js) and the replayed game's recording in tests/fixtures/espn/;
// no app server, never the real ESPN. Its rows are the fixture's (--keep leaves them; the next run removes them first). Don't run it
// beside another check on nfl-slate-fixture.js.
const path = require("path");
const zlib = require("zlib");
const { isDeepStrictEqual } = require("util");
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "7"));
const EVENT = String(arg("event", "401873017"));
const HOUR = 3600_000;
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 600)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);
const iso = (t) => new Date(t).toISOString();
const round = (n) => Math.round(n * 100) / 100;

(async () => {
  const summary = require(path.join(__dirname, "..", "..", "tests", "fixtures", "espn", `nfl-${EVENT}.json`));
  const week = fx.weeksOf(fx.recording().input).find((w) => w.n === WEEK);
  if (!week) throw new Error(`--week=${WEEK} isn't in the recording`);
  const liveGame = week.games.find((g) => String(g.id) === EVENT);
  if (!liveGame) throw new Error(`event ${EVENT} isn't one of ${week.label}'s games`);
  const others = week.games.filter((g) => g !== liveGame && g.box);
  const w = await fx.up({ at: iso(Date.parse(week.first) - 2 * HOUR), people: 6 });
  try {
    const S = fx.app("../../src/lib/game/state-logic.js");
    const L = fx.app("../../src/lib/sports/index.ts");
    const { readyLeague } = fx.app("../../src/lib/server/league-read.ts");
    const { startFromSpec } = fx.app("../../src/lib/server/start-spec.ts");
    const { withLeagueLock } = fx.app("../../src/lib/server/db.ts");
    const { seasonGames } = fx.app("../../src/lib/server/season-games.ts");
    const live = fx.app("../../src/lib/server/sports/live-lines.ts");
    const replayTools = require("./espn-replay");

    // The replayed game, served by the stand-in at the replay's moment (set with the fixture's clock, below).
    const r = w.espn.replay(summary, { speed: 1 });
    r.league = fx.LEAGUE;
    r.pause();
    const sport = L.sportOf(fx.LEAGUE);
    const at = (t) => {
      w.advance(iso(t));
      r.set(t);
    };
    // Who plays in it: each side's passer and leading runner (ESPN's box score's first rows).
    const box = sport.readBox(summary);
    const firstOf = (table) => (summary.boxscore?.players ?? []).map((t) => t.statistics?.find((s) => s.name === table)?.athletes?.[0]?.athlete?.id).filter(Boolean).map(String);
    const liveIds = [...firstOf("passing"), ...firstOf("rushing")];
    const firstOfBox = (g, table) => Object.values(g.box ?? {}).map((team) => team.tables?.find((t) => t.name === table)?.rows?.[0]?.id).filter(Boolean).map(String);
    const otherQbs = others.flatMap((g) => firstOfBox(g, "passing")).filter((id) => !liveIds.includes(id));
    if (liveIds.length !== 4 || otherQbs.length < 8) throw new Error(`couldn't find the players: ${JSON.stringify({ liveIds, otherQbs: otherQbs.length })}`);
    fact(`${week.label}: ${liveGame.name ?? EVENT} replayed live (${box ? Object.keys(box.people).length : 0} people in its box score); its players ${liveIds.join(", ")}`);

    // The live game: head to head of three a seat from this week.
    const d = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false });
    const spec = S.gameOf(await w.league(d.leagueId));
    const specOf = () => ({ ...structuredClone(spec), count: { start: 3 }, get: { ...spec.get, each: 3 }, span: { from: WEEK, to: w.slate.episodes } });
    const g1 = await startFromSpec(w.users.ann, w.seasonId, w.couchId, { spec: specOf(), name: "ZT live points", tell: false }, new Date());
    // The own-pace game: ed and flo, made at their own pace before the week aired, one each of the replayed game's passers (and two
    // others: the lineup is three).
    const g2 = await startFromSpec(w.users.ed, w.seasonId, w.couchId, { spec: { ...specOf(), count: { start: 3 } }, name: "ZT live points, own pace", tell: false, pace: "own" }, new Date());
    const { rows: cast } = await w.pool.query("SELECT id, provider_ids FROM season_cast WHERE season_id = $1", [w.seasonId]);
    const scOf = new Map(cast.flatMap((x) => Object.values(x.provider_ids ?? {}).map((v) => [String(v), x.id])));
    if ([...liveIds, ...otherQbs.slice(0, 8)].some((id) => !scOf.has(id))) throw new Error("some of the players aren't the season's people");
    const draft = async (leagueId, who, picks) => {
      const seats = {};
      await withLeagueLock(leagueId, (st) => {
        for (const x of who.slice(1)) S.addPlayer(st, `zt_nfl_${x}`);
        st.players.forEach((p, i) => (seats[who[i]] = p.id));
        const byCast = new Map(st.castaways.map((c) => [c.seasonCastId, c.id]));
        const wants = Object.fromEntries(who.map((x, i) => [seats[x], picks[i].map((id) => byCast.get(scOf.get(id)))]));
        for (let k = 0; k < who.length * 3; k++) {
          const turn = S.currentDraftTurn(st);
          S.draftToCurrentTurn(st, wants[turn.playerId].shift());
        }
        const ep = st.episodes.find((e) => e.number === WEEK);
        ep.lineups = Object.fromEntries(st.players.map((p) => [p.id, st.castaways.filter((c) => c.ownerIds.includes(p.id)).map((c) => c.id)]));
      });
      // Their accounts in the game, as a join makes them (the starter's is the start's).
      for (const x of who.slice(1)) await w.pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, $3, 'member')", [leagueId, w.users[x].id, seats[x]]);
      return seats;
    };
    const names = ["ann", "bo", "cy", "di"];
    const seats = await draft(g1.leagueId, names, names.map((_, i) => [liveIds[i], otherQbs[2 * i], otherQbs[2 * i + 1]]));
    const paceSeats = await draft(g2.leagueId, ["ed", "flo"], [[liveIds[0], otherQbs[0], otherQbs[1]], [liveIds[1], otherQbs[2], otherQbs[3]]]);
    // ed's and flo's user ids differ from their seats' player ids: the read is by user.
    const castOf = async (leagueId) => new Map((await w.league(leagueId)).castaways.map((c) => [c.seasonCastId, c.id]));
    const cast1 = await castOf(g1.leagueId);
    const liveCast = liveIds.map((id) => cast1.get(scOf.get(id)));

    // di hides sports scores, at the week before.
    const diId = w.users.di.id;
    await w.pool.query("INSERT INTO user_settings (user_id, hide_sports_scores) VALUES ($1, true) ON CONFLICT (user_id) DO UPDATE SET hide_sports_scores = true", [diId]);
    const markDi = (n) => w.pool.query("INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, $3, true) ON CONFLICT (user_id, season_id) DO UPDATE SET seen_through = EXCLUDED.seen_through", [diId, w.seasonId, n]);
    await markDi(WEEK - 1);

    // The reads.
    live.setLiveBase(w.espn.url);
    const asked = () => w.espn.asked.filter((p) => p.includes("/summary") && p.includes(`event=${EVENT}`)).length;
    const engine = async (leagueId, o) => {
      const st = await readyLeague(leagueId, await w.league(leagueId), o);
      return { st, ep: st.episodes.find((e) => e.number === WEEK), table: Object.fromEntries(S.computeScores(st).map((x) => [x.playerId, x.total])), rows: S.computeScores(st) };
    };
    const viewOf = async (who, leagueId) => {
      const res = await seasonGames(w.users[who], w.seasonId, w.couchId, null, { running: true });
      const v = res.games.find((g) => g.leagueId === leagueId);
      return { res, v, totals: Object.fromEntries((v?.table ?? []).map((x) => [x.playerId, x.total])) };
    };
    const zero = (t) => Object.values(t).every((x) => x === 0);
    // The oracle: the replayed game as known at a moment (its plays so far; the final's correction once final), its players' lines
    // as the engine's scorer reads them (Sport.full), and each seat's points from the table the game was given.
    const knownAt = (t) => {
      const asOf = replayTools.asOf(summary, t, { sport });
      return L.storedGame(sport, asOf);
    };
    /** Each seat's points this week, its three players' each counted alone (the engine's own table), added up. */
    const owedOf = (st, who, seatsOf) => {
      const teams = Object.fromEntries(st.players.map((p) => [p.id, st.castaways.filter((c) => c.ownerIds.includes(p.id)).map((c) => c.id)]));
      return Object.fromEntries(who.map((n) => [seatsOf[n], round(teams[seatsOf[n]].reduce((sum, c) => sum + (pointsOf(st, c).find((x) => x.playerId === seatsOf[n])?.total ?? 0), 0))]));
    };
    const pointsOf = (st, castId) => {
      // The engine's own points for one castaway this week: the seat's total with only them in it (computeScores on a copy).
      const c = structuredClone(st);
      for (const e of c.episodes) if (e.number !== WEEK) { delete e.statLines; delete e.statGames; }
      const ep = c.episodes.find((e) => e.number === WEEK);
      for (const k of Object.keys(ep.statLines ?? {})) if (k !== castId) delete ep.statLines[k];
      for (const g of Object.values(ep.statGames ?? {})) for (const k of Object.keys(g)) if (k !== castId) delete g[k];
      return S.computeScores(c);
    };

    // Before the game: nothing live (it hasn't started).
    at(r.first - 20 * 60_000);
    let a = await engine(g1.leagueId, { live: true });
    check(zero(a.table) && !a.ep?.statEarly, `before ${liveGame.name ?? EVENT} starts: nothing counted, the week not in progress`, { table: a.table, early: a.ep?.statEarly });

    // The second quarter: 40% of the way through its plays.
    const q2 = Math.round(r.first + 0.4 * (r.last - r.first));
    at(q2);
    const before = asked();
    a = await engine(g1.leagueId, { live: true });
    const known = knownAt(q2);
    const lines = a.ep?.statLines ?? {};
    check(a.ep?.statEarly === true && S.resultsStage(a.ep) === "early" && !S.episodeHasResults(a.ep), `${iso(q2).slice(11, 16)}Z, the second quarter: ${week.label} early (in progress), not yet "has results"`, { early: a.ep?.statEarly, stage: S.resultsStage(a.ep) });
    const linesOk = liveIds.every((id, i) => isDeepStrictEqual(lines[liveCast[i]] ?? null, known.lines[id] ? sport.full(known.lines[id]) : null));
    check(linesOk, `each replayed player's line is the recording's plays added up as of then (${liveIds.map((id) => Object.entries(known.lines[id] ?? {}).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(" ")).join("; ")})`, { lines: liveCast.map((c) => lines[c]), want: liveIds.map((id) => known.lines[id]) });
    const q2Table = a.table;
    const owed = owedOf(a.st, names, seats);
    const liveOf = (st) => Object.fromEntries(names.map((n, i) => [n, round(pointsOf(st, liveCast[i]).find((x) => x.playerId === seats[n])?.total ?? 0)]));
    const q2Live = liveOf(a.st);
    // Anyone else counted is a game of the week over by then that the hourly job hasn't kept yet: live has its final too.
    const elsewhere = Object.keys(lines).filter((c) => !liveCast.includes(c)).length;
    check(names.every((n) => round(q2Table[seats[n]]) === owed[seats[n]]) && Object.values(q2Live).some((x) => x !== 0), `each total its three players' points so far, the replayed one's ${names.map((n) => `${n} ${q2Live[n]}`).join(", ")} (${elsewhere} others' lines from the week's games over and not yet kept)`, { q2Table, owed });
    check(a.rows.every((x) => x.matchups && x.matchups.wins + x.matchups.losses + x.matchups.ties === 0), "no matchup decided: every record 0-0", a.rows.map((x) => x.matchups));
    await engine(g1.leagueId, { live: true });
    await engine(g2.leagueId, { live: true });
    check(asked() - before === 1, `one ask of the stand-in for the game over three reads in its 10 s (${asked() - before})`);
    const off = await engine(g1.leagueId);
    check(!off.ep?.statLines && !off.ep?.statEarly && zero(off.table), "a read without live (a write's, every other read) has none of it");

    const t0 = Date.now();
    const ann = await viewOf("ann", g1.leagueId);
    const annMs = Date.now() - t0;
    check(names.every((n) => round(ann.totals[seats[n]]) === round(q2Table[seats[n]])), `ann's read (the season's games, as the route answers): the same totals (${names.map((n) => `${n} ${round(ann.totals[seats[n]])}`).join(", ")})`, { got: ann.totals, want: q2Table });
    const di6 = await viewOf("di", g1.leagueId);
    check(!!di6.v && di6.res.seenThrough === WEEK - 1 && zero(di6.totals), `di, hiding sports scores at ${week.label}'s week before: shown none of it (totals all 0)`, { found: !!di6.v, seen: di6.res.seenThrough, totals: di6.totals });
    await markDi(WEEK);
    const di7 = await viewOf("di", g1.leagueId);
    // At the week itself, a game of the week kept would count for her as part 2 counts one; none has been kept yet, so anything at
    // all would be live's.
    check(!!di7.v && di7.res.seenThrough === WEEK && zero(di7.totals), `di at the week itself (marked seen while it's played): still no live points`, { found: !!di7.v, seen: di7.res.seenThrough, totals: di7.totals });
    for (const who of ["ed", "flo"]) {
      const v = await viewOf(who, g2.leagueId);
      check(!!v.v && zero(v.totals), `${who}, at their own pace (no seat has a pace of its own yet): shown none of it`, { found: !!v.v, totals: v.totals });
    }
    const paced = await engine(g2.leagueId, { live: true });
    const cut = S.GhostLogic.viewFor(paced.st, paceSeats.ed, null).episodes.find((e) => e.number === WEEK);
    check(paced.ep?.statEarly === true && !("statLines" in cut) && !("statEarly" in cut), "and were the own-pace game read with live points, ed's copy would leave the week out (GhostLogic.viewFor)", { full: !!paced.ep?.statLines, cut: Object.keys(cut) });

    // What a read costs: ann's read, with live and without.
    live.setLiveBase(null);
    const annOff = await viewOf("ann", g1.leagueId);
    live.setLiveBase(w.espn.url);
    const size = (x) => { const s = JSON.stringify(x.res); return { raw: Buffer.byteLength(s), gz: zlib.gzipSync(s).length }; };
    const [on, offSize] = [size(ann), size(annOff)];
    fact(`ann's read: ${(on.raw / 1024).toFixed(1)} KB (${(on.gz / 1024).toFixed(1)} KB gzipped) with live points, ${(offSize.raw / 1024).toFixed(1)} KB (${(offSize.gz / 1024).toFixed(1)} KB) without; ${annMs} ms with a new answer`);
    const slim = (x) => { const s = JSON.stringify({ table: x.v?.table, matchups: x.v?.matchups ?? null }); return { raw: Buffer.byteLength(s), gz: zlib.gzipSync(s).length }; };
    const t = slim(ann);
    fact(`its game's table and matchups alone: ${(t.raw / 1024).toFixed(1)} KB (${(t.gz / 1024).toFixed(1)} KB gzipped); every 15 s for an NFL game's 3 1/4 hours (780 reads), the whole read ~${Math.round((on.gz * 780) / 1048576)} MB a phone, the table alone ~${((t.gz * 780) / 1048576).toFixed(1)} MB`);

    // The fourth quarter: 85% of the way.
    const q4 = Math.round(r.first + 0.85 * (r.last - r.first));
    at(q4);
    a = await engine(g1.leagueId, { live: true });
    const q4Live = liveOf(a.st);
    const moved = names.filter((n) => q4Live[n] !== q2Live[n]);
    const owed4 = owedOf(a.st, names, seats);
    const known4 = knownAt(q4);
    check(moved.length > 0 && names.every((n) => round(a.table[seats[n]]) === owed4[seats[n]]) && liveIds.every((id, i) => isDeepStrictEqual(a.ep?.statLines?.[liveCast[i]] ?? null, known4.lines[id] ? sport.full(known4.lines[id]) : null)), `${iso(q4).slice(11, 16)}Z, the fourth quarter: the replayed players' points moved on (${names.map((n) => `${n} ${q2Live[n]} → ${q4Live[n]}`).join(", ")}), each line still the recording's as of then`, { moved, table: a.table, owed4 });
    const di7b = await viewOf("di", g1.leagueId);
    const ed4 = await viewOf("ed", g2.leagueId);
    check(!!di7b.v && !!ed4.v && zero(di7b.totals) && zero(ed4.totals), "di and ed still shown none of it");

    // Final, not yet kept: the replay's last answer, a minute after its last play.
    const fin = r.end + 60_000;
    at(fin);
    a = await engine(g1.leagueId, { live: true });
    const finalKnown = knownAt(fin);
    const liveFinal = liveCast.map((c) => a.ep?.statLines?.[c] ?? null);
    check(finalKnown.final && a.ep?.statEarly === true && liveIds.every((id, i) => isDeepStrictEqual(liveFinal[i], sport.full(finalKnown.lines[id] ?? {}))), `${iso(fin).slice(11, 16)}Z, final but not yet kept: its final lines count (the box score's correction in them), the week still early`, { final: finalKnown.final, early: a.ep?.statEarly, got: liveFinal, want: liveIds.map((id) => sport.full(finalKnown.lines[id] ?? {})) });
    check(a.rows.every((x) => x.matchups && x.matchups.wins + x.matchups.losses + x.matchups.ties === 0), "still no matchup decided (the week's other games, and the final not kept)");

    // Kept: the hourly job's run after the final.
    const run = new Date(fin);
    run.setUTCMinutes(5, 0, 0);
    if (run.getTime() < fin) run.setUTCHours(run.getUTCHours() + 1);
    const keptAt = Math.max(run.getTime(), Date.parse(liveGame.at) + fx.GAME_MS + 60_000);
    w.advance(iso(keptAt));
    r.set(keptAt);
    await w.hourly();
    const { rows: kept } = await w.pool.query("SELECT final, lines IS NOT NULL AS kept FROM sports_events WHERE league = $1 AND event_id = $2", [fx.LEAGUE, EVENT]);
    a = await engine(g1.leagueId);
    const keptLines = liveCast.map((c) => a.ep?.statLines?.[c] ?? null);
    check(kept[0]?.kept === true, `${iso(keptAt).slice(11, 16)}Z: the hourly job kept the final`, kept[0]);
    const same = liveIds.filter((_, i) => isDeepStrictEqual(keptLines[i], liveFinal[i]));
    check(same.length === liveIds.length, `the kept final's lines are live's at its final, for each replayed player (${same.length} of ${liveIds.length})`, { live: liveFinal, kept: keptLines });

    // A league named zt-...: never asked of ESPN with no stand-in set (the real ESPN never sees a check's games).
    live.setLiveBase(undefined);
    const n0 = w.espn.asked.length;
    const none = await live.liveLines([{ provider: "espn", league: fx.LEAGUE, event_id: EVENT, starts_at: new Date(Date.parse(liveGame.at)), state: "in", final: false, lines: null }], { now: Date.parse(liveGame.at) + HOUR });
    check(none === null && w.espn.asked.length === n0, `with no stand-in set, ${fx.LEAGUE}'s game isn't asked at all`);
    live.setLiveBase(w.espn.url);

    console.log(failures ? "VERDICT (1.1 part 3): NOT YET" : "VERDICT (1.1 part 3): a game's points move as it's played, for those shown everything only");
  } finally {
    live_reset();
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

function live_reset() {
  try {
    fx.app("../../src/lib/server/sports/live-lines.ts").setLiveBase(undefined);
  } catch {
    /* not loaded */
  }
}
