// Dev-only check of a sports season game at its own pace (docs/PLAN-sports-ready.md step 2.6; BACKLOG 218), on the recorded NFL
// season (nfl-slate-fixture.js: the stand-in ESPN, the process's clock). The user's rule: a team sport's seat at its own pace is never
// more than one game behind; when the next game starts, the one before counts as watched and the seat's mark moves on by itself.
// zt-nfl-ann starts the NFL's default season game at her own pace with computer players (alone with them: part b), an hour before
// --week's first game; the draft runs on the app's own reads. The routes and the app's functions are called in this process. Then:
//   options     the sheet: live recommended for a league, own for a game alone (part c); a start from early in the season isn't
//               taken (it starts with the game to come); one from the week just played is
//   the start   at her own pace, made and drafted together as a live game is, from the game to come
//   behind      --week played, its results in: Ann told nothing past her mark (the season's games read: no points); her week's
//               lineup still open, on her honour, after it's been played
//   the reveal  she reveals it: her mark moves, the computer players keep pace, her table and record take the week in
//   one behind  the next week played and she hasn't revealed it: still hers to set until the week after starts
//   moved       the week after's first kickoff: with no read at all, the hourly job (keepAllSportPace) moves her mark on (the game's,
//               her membership's and her show's), the computer players' too; the week she passed is closed to her, the new one
//               open; her table takes the week she passed in, never the one being played
//   on a read   the next week's first kickoff again, this time a read of her games moves her on
//   waivers     a waiver week waits for everyone to reach its week: none while Ann's behind, open once she reveals it; by the end
//               one has opened at each week everyone reached
// Prints PASS/FAIL.
//
//   node scripts/dev-test/check-sports-own-pace.js [--week=7] [--bots=3] [--keep]
//
// --week: the first week played (it and the two after it must be in the recording, the last of them with its next week's games:
// the 2026-11-15 recording plays up to Week 9, so 7 is the latest). Needs the local database and the NFL recording (see
// nfl-slate-fixture.js); no app server, never the real ESPN. Its rows are the fixture's (--keep leaves them; the next run removes
// them first). Don't run it beside another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const WEEK = Number(arg("week", "7"));
const BOTS = Number(arg("bots", "3"));
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
  const [w1, w2, w3, w4] = [0, 1, 2, 3].map((i) => weeks.find((x) => x.n === WEEK + i));
  if (!w1 || !w2 || !w3?.last || !w4?.first) throw new Error(`--week=${WEEK}: it, the two after it and the next week's games need to be in the recording`);
  const w = await fx.up({ at: iso(Date.parse(w1.first) - HOUR) });
  try {
    const { readyLeague } = fx.app("../../src/lib/server/league-read.ts");
    const { withLeagueLock } = fx.app("../../src/lib/server/db.ts");
    const { startOptions } = fx.app("../../src/lib/server/start-game.ts");
    const { seasonGames } = fx.app("../../src/lib/server/season-games.ts");
    const { revealSeason } = fx.app("../../src/lib/server/season-episodes.ts");
    const { keepAllSportPace } = fx.app("../../src/lib/server/sport-pace-clock.ts");
    const { auth } = fx.app("../../src/lib/auth.ts");
    const lineupRoute = fx.app("../../src/app/api/leagues/[leagueId]/episodes/[epId]/lineups/[playerId]/route.ts");
    const S = fx.app("../../src/lib/game/state-logic.js");
    const ann = w.users.ann;
    const read = async (id) => readyLeague(id, await w.league(id));

    // ---- The sheet's options (parts b and c) ----
    const now = () => new Date();
    const o = await startOptions(ann, w.seasonId, w.couchId, null, now());
    check(o.runs.recommended === "live" && o.runs.alone === "own" && o.runs.choices.includes("own"), `the sheet: live recommended for a league of people, own for a game alone or with computer players (${JSON.stringify(o.runs)})`);
    check(o.from === WEEK && !o.ownPace, `it starts with the game to come, Week ${WEEK} (${o.from})`);
    const early = await startOptions(ann, w.seasonId, w.couchId, null, now(), false, 2);
    check(early.from === WEEK && !early.ownPace, `a start from Week 2 of a season under way isn't taken: still Week ${WEEK} (${early.from}, own pace ${early.ownPace})`);
    const just = await startOptions(ann, w.seasonId, w.couchId, null, now(), false, WEEK - 1);
    check(just.from === WEEK - 1 && just.ownPace, `a start from the week just played is (Week ${just.from}, at your own pace)`);

    // ---- The start: alone with computer players, at her own pace, from the game to come ----
    const s = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false, pace: "own", bots: BOTS });
    let st = await w.league(s.leagueId);
    check(S.GhostLogic.ownPace(st) && st.settings.startedTogether && S.startEpisode(st) === WEEK && st.players.length === BOTS + 1, `started at her own pace from Week ${WEEK}, made as a live game, with ${BOTS} computer players (${st.players.length} seats)`);
    const annId = st.players.find((p) => !p.automated).id;
    await withLeagueLock(s.leagueId, (x) => {
      x.players.find((p) => p.id === annId).automated = true;
      S.DraftLogic.forceStart(x);
    });
    st = await read(s.leagueId);
    for (let i = 0; i < 20 && !S.DraftLogic.currentTurn(st)?.isComplete; i++) st = await read(s.leagueId);
    check(!!S.DraftLogic.currentTurn(st)?.isComplete, `drafted together on the app's own reads (${st.draftPicksMade} picks)`);
    await withLeagueLock(s.leagueId, (x) => { x.players.find((p) => p.id === annId).automated = false; });

    // Signed in as Ann, for the lineup route.
    const signed = await auth.api.signInUsername({ body: { username: "zt_nfl_ann", password: fx.PASSWORD }, asResponse: true });
    const cookie = (signed.headers.getSetCookie?.() ?? [signed.headers.get("set-cookie") ?? ""]).map((c) => c.split(";")[0]).join("; ");
    const lineup = async (n) => {
      const cur = await read(s.leagueId);
      const ep = cur.episodes.find((e) => e.number === n);
      if (!ep) return { status: 0, body: { error: `no Week ${n} yet` } };
      const mine = cur.castaways.filter((c) => (c.ownerIds || []).includes(annId)).map((c) => c.id);
      const ids = S.SlotLogic?.best ? S.SlotLogic.best(cur, mine, S.ActiveRosterLogic.activeSlots(cur)) : mine.slice(0, S.ActiveRosterLogic.activeSlots(cur));
      const req = new Request(`http://localhost/api/leagues/${s.leagueId}/episodes/${ep.id}/lineups/${annId}`, { method: "PUT", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ castawayIds: ids }) });
      const res = await lineupRoute.PUT(req, { params: Promise.resolve({ leagueId: s.leagueId, epId: ep.id, playerId: annId }) });
      return { status: res.status, body: await res.json() };
    };
    const view = async () => {
      const res = await seasonGames(ann, w.seasonId, w.couchId, null, { running: true });
      const v = res.games.find((g) => g.leagueId === s.leagueId);
      return { seen: res.seenThrough, v, me: v?.you ?? null, total: v?.you?.total ?? null, record: v?.you?.record ?? null };
    };
    const marks = async () => {
      const cur = await w.league(s.leagueId);
      const { rows: m } = await w.pool.query("SELECT results_seen_through FROM league_memberships WHERE league_id = $1 AND player_id = $2", [s.leagueId, annId]);
      const { rows: f } = await w.pool.query("SELECT seen_through FROM show_follows WHERE user_id = $1 AND season_id = $2", [ann.id, w.seasonId]);
      return {
        game: cur.players.find((p) => p.id === annId).lateJoin?.seenThrough ?? null,
        bots: cur.players.filter((p) => p.automated).map((p) => p.lateJoin?.seenThrough ?? null),
        membership: m[0]?.results_seen_through ?? null,
        follow: f[0]?.seen_through ?? null,
        // As a read has it: a sport's finals are stamped on the read (never stored).
        cur: await readyLeague(s.leagueId, cur),
      };
    };
    const played = (cur, n) => S.SpoilerLogic.latestWithResults(cur) >= n;

    // ---- Behind: Week 1 played, its results in, Ann hasn't watched it ----
    await w.days(iso(Date.parse(w1.last) + 32 * HOUR));
    st = await read(s.leagueId);
    let m = await marks();
    check(played(st, WEEK) && m.game === WEEK - 1 && S.GhostLogic.isCatchingUp(st, annId), `${w1.label} played and in: Ann's mark the week before (${m.game}), catching up`);
    let v = await view();
    check(v.seen === WEEK - 1 && v.total === 0 && (v.record?.wins ?? 0) + (v.record?.losses ?? 0) + (v.record?.ties ?? 0) === 0, `Ann's games read tells her nothing past her mark (seen ${v.seen}, her total ${v.total}, record ${JSON.stringify(v.record && [v.record.wins, v.record.losses, v.record.ties])})`);
    const weekOf = (cur, n) => S.WaiverLogic.periods(cur).find((p) => p.episode === n) ?? null;
    check(!weekOf(m.cur, WEEK), `no waiver week for ${w2.label} while she's behind: it waits for everyone to reach ${w1.label}`, S.WaiverLogic.periods(m.cur));
    let r = await lineup(WEEK);
    check(r.status === 200, `${w1.label}'s lineup is still hers to set after it was played (on her honour, until she watches it or ${w2.label} starts)`, r.body.error);

    // ---- The reveal ----
    await revealSeason(ann, w.seasonId, w.couchId, WEEK);
    m = await marks();
    v = await view();
    const rec = (x) => (x?.wins ?? 0) + (x?.losses ?? 0) + (x?.ties ?? 0);
    check(m.game === WEEK && m.membership === WEEK && m.bots.every((b) => b === WEEK), `she reveals ${w1.label}: her mark ${m.game} (membership ${m.membership}), the computer players keep pace (${m.bots.join(", ")})`);
    const opened = weekOf(m.cur, WEEK);
    check(opened?.phase === "open" && Date.parse(opened.processAt) > Date.now(), `the reveal opens ${w2.label}'s waivers (claims clear ${opened?.processAt})`, opened);
    check(v.seen === WEEK && v.total > 0 && rec(v.record) === 1, `her table takes it in: ${v.total} points, a record of ${rec(v.record)} game`, { seen: v.seen, total: v.total, record: v.record });

    // ---- One behind: Week 2 played, unrevealed; still hers until Week 3 starts ----
    await w.days(iso(Date.parse(w2.last) + 32 * HOUR));
    await withLeagueLock(s.leagueId, () => {});
    m = await marks();
    check(m.game === WEEK && played(m.cur, WEEK + 1), `${w2.label} played and in, Ann hasn't revealed it: still at ${m.game}, one behind`);
    r = await lineup(WEEK + 1);
    check(r.status === 200, `${w2.label}'s lineup still hers to set`, r.body.error);
    const totalBefore = v.total;

    // ---- Moved: Week 3's first kickoff, no read at all; the hourly job moves her ----
    const kickoff = Date.parse(w3.first);
    await w.advance(iso(kickoff + 10 * 60_000));
    const pacedRead = await keepAllSportPace([s.leagueId]);
    m = await marks();
    check(pacedRead === 1 && m.game === WEEK + 1 && m.membership === WEEK + 1 && m.follow === WEEK + 1, `${w3.label}'s first kickoff: the hourly job moves Ann's mark to ${w2.label} by itself (the game's ${m.game}, her membership's ${m.membership}, her show's ${m.follow})`);
    check(m.bots.every((b) => b === WEEK + 1), `the computer players with her (${m.bots.join(", ")})`);
    r = await lineup(WEEK + 1);
    check(r.status === 400, `${w2.label}, passed, is closed to her: "${r.body.error}"`);
    r = await lineup(WEEK + 2);
    check(r.status === 200, `${w3.label}'s lineup is hers now, being played, on her honour`, r.body.error);
    v = await view();
    check(v.seen === WEEK + 1 && v.total > totalBefore && rec(v.record) === 2, `her table takes ${w2.label} in (${totalBefore} to ${v.total}, a record of ${rec(v.record)} games), never ${w3.label}'s game under way`, { seen: v.seen, total: v.total, record: v.record });

    // ---- On a read: Week 3 played, Week 4's first kickoff; reading her games moves her ----
    await w.days(iso(Date.parse(w3.last) + 32 * HOUR));
    m = await marks();
    check(m.game === WEEK + 1 && played(m.cur, WEEK + 2), `${w3.label} played and in: Ann one behind again (${m.game})`);
    await w.advance(iso(Date.parse(w4.first) + 10 * 60_000));
    v = await view();
    m = await marks();
    check(m.game === WEEK + 2 && v.seen === WEEK + 2 && m.follow === WEEK + 2, `${w4.label}'s first kickoff: a read of her games moves her to ${w3.label} (${m.game}; she's told through ${v.seen})`);

    // ---- Waivers at their sync point: everyone's week ----
    const W = S.WaiverLogic;
    const periods = W.periods(m.cur);
    fact(`waiver weeks: ${periods.map((p) => `ep ${p.episode} ${p.phase}`).join(", ") || "none"}`);
    check(periods.some((p) => p.episode >= WEEK), `a waiver week opened once everyone reached the week it waits at`, periods);

    console.log(failures ? "VERDICT (2.6): NOT YET" : "VERDICT (2.6): a sports game at its own pace keeps everyone within one game, by itself");
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
