// Dev-only check of a game through the playoffs (docs/PLAN-sports-ready.md step 2.7; the user, 2026-11-20: a game's timing is the
// maker's, the regular season by default or on through the playoffs to the final). On nfl-slate-fixture.js with its stand-in
// postseason (nfl-postseason.js: the recorded season's Weeks 10 to 18 played, the 2025 bracket as this season's playoffs, each round
// listed once the round before is over), the clock an hour before Week 15's first game, through the app's own functions (the sports
// route's start, the daily listings job each morning, a league's read), with every seat a computer player:
//   the slate        one season of both stages: Weeks 1 to 18, then the Wild Card, the Divisional Round, the Conference
//                    Championship and the Super Bowl (19 to 22); each round's games linked as they're listed; the Pro Bowl never
//   the defaults     the season game (head to head) to the fantasy season's end, its final in Week 17; Pick'em to Week 18
//   the final        the same two with timing "final": no end of their own, running on through the playoffs, head to head's own
//                    playoffs at the game's end (the final in the Super Bowl's week), over once the Super Bowl is
//   team seasons     the Bills' (won at Jacksonville, lost at Denver), the Seahawks' (a bye, then the title) and the Dolphins' (not in
//                    it), each through the final: each takes its playoff games as they're set and ends once its team is out; the
//                    Bills' to the regular season's end ends with it
//   across the line  in the season game through the final, a held player whose team is out scores nothing in the next round and stays
//                    held; lineups go on (the computer players set each playoff week's)
//
//   node scripts/dev-test/check-sports-through-playoffs.js [--keep]
//
// Needs the local database and the NFL recording (see nfl-slate-fixture.js); no app server, never the real ESPN. About 60 days of the
// daily job, a few minutes. Its rows are the fixture's (--keep leaves them; the next run removes them first). Don't run it beside
// another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const keep = process.argv.includes("--keep");
const BOTS = 3;
const HOUR = 3_600_000;
const iso = (ms) => new Date(ms).toISOString();
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 500)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);
const TEAMS = { bills: "2", seahawks: "26", dolphins: "15", steelers: "23" };

(async () => {
  const rec = fx.recording().input;
  const weeks = fx.weeksOf(rec);
  const w15 = weeks.find((x) => x.n === 15);
  const w = await fx.up({ at: iso(Date.parse(w15.first) - HOUR), postseason: true });
  try {
    const S = fx.app("../../src/lib/game/state-logic.js");
    const { readyLeague } = fx.app("../../src/lib/server/league-read.ts");
    const { withLeagueLock } = fx.app("../../src/lib/server/db.ts");
    const label = (n) => [...w.weeks, ...w.playoffWeeks].find((x) => x.n === n)?.label ?? `episode ${n}`;
    const read = async (id) => readyLeague(id, await w.league(id));
    const linked = async (seasonId) => {
      const { rows } = await w.pool.query("SELECT episode, count(*)::int AS n, array_agg(coalesce(note, '')) AS notes FROM season_events WHERE season_id = $1 GROUP BY episode ORDER BY episode", [seasonId]);
      return new Map(rows.map((r) => [r.episode, r]));
    };
    const pg = w.postseason.playoffs;
    const lastOfWeek = (n) => Math.max(...pg.filter((g) => g.week === n).map((g) => Date.parse(g.at)));

    // ---- The slate ----
    check(w.slate.stage === "full" && w.slate.episodes === 22 && w.regular === 18, `the slate is one season of both stages: ${w.slate.episodes} episodes, its regular season through ${label(w.regular)} (${w.slate.stage})`);
    const { rows: eps } = await w.pool.query("SELECT number, title FROM season_episodes WHERE season_id = $1 AND number > 17 ORDER BY number", [w.seasonId]);
    check(eps.map((e) => e.title).join(" | ") === "Week 18 | Wild Card | Divisional Round | Conference Championship | Super Bowl", `its playoffs' weeks as ESPN's calendar lists them (${eps.map((e) => e.title).join(" | ")})`);
    fact(`the stand-in: ${w.postseason.regular} regular-season games played as stand-ins, ${pg.length} playoff games (the Pro Bowl among them)`);

    // ---- The starts ----
    const start = async (name, body) => {
      const s = await w.start("ann", { tell: false, bots: BOTS, name, ...body });
      // Every seat a computer player, so the draft and each week's lineup are made by the app's own reads.
      await withLeagueLock(s.leagueId, (x) => {
        x.players.forEach((p) => (p.automated = true));
        if (S.gameOf(x).get.by === "draft") S.DraftLogic.forceStart(x);
      });
      let st = await read(s.leagueId);
      for (let i = 0; i < 20 && S.gameOf(st).get.by === "draft" && !S.DraftLogic.currentTurn(st)?.isComplete; i++) st = await read(s.leagueId);
      return { ...s, name };
    };
    const end = async (s) => S.endEpisode(await w.league(s.leagueId));
    const games = {
      season: await start("ZT season", { seasonId: w.seasonId, game: "season" }),
      seasonFinal: await start("ZT season final", { seasonId: w.seasonId, game: "season", timing: "final" }),
      pickem: await start("ZT pickem", { seasonId: w.seasonId, game: "pickem" }),
      pickemFinal: await start("ZT pickem final", { seasonId: w.seasonId, game: "pickem", timing: "final" }),
    };
    const team = {};
    for (const [k, id] of Object.entries(TEAMS).filter(([k]) => k !== "steelers")) team[k] = await start(`ZT ${k}`, { league: fx.LEAGUE, team: id, whole: "season", game: "pickem", timing: "final" });
    team.billsRegular = await start("ZT bills regular", { league: fx.LEAGUE, team: TEAMS.bills, whole: "season", game: "pickem" });
    check((await end(games.season)) === 17, `the season game (head to head, by stats) to the season's end plays the fantasy season: through ${label(17)} (${label(await end(games.season))})`);
    check((await end(games.pickem)) === 18, `Pick'em to the season's end plays the regular season: through ${label(18)} (${await end(games.pickem)})`);
    check((await end(games.seasonFinal)) === null && (await end(games.pickemFinal)) === null, "through the final: no end of their own");
    const { rows: ts } = await w.pool.query("SELECT m.season_id, m.key, m.regular_through, cardinality(m.events) AS n FROM sports_matchups m WHERE m.key LIKE '%:season:%' AND m.league = $1", [fx.LEAGUE]);
    check(ts.length === 3 && ts.every((t) => t.regular_through === 17 && t.n === 17), `each team's season keeps where its regular season ends: ${ts.map((t) => `${t.n} games, regular through ${t.regular_through}`).join("; ")}`);
    check((await end(team.billsRegular)) === 17 && (await end(team.bills)) === null, `the Bills' season to its end plays its regular season (through game ${await end(team.billsRegular)}); through the final has none`);
    const seasonOf = (s) => ts.find((t) => t.season_id === s.seasonId);

    // ---- Play on, a morning at a time, reading each game as its people would ----
    const all = [...Object.values(games), ...Object.values(team)];
    const until = async (to) => {
      const errors = [];
      let t = Date.now();
      while (t < Date.parse(to)) {
        t = Math.min(Date.parse(to), t + 24 * HOUR);
        errors.push(...(await w.days(iso(t))));
        for (const s of all) await read(s.leagueId);
      }
      if (errors.length) fact(`the daily job's errors: ${errors.slice(0, 3).join("; ")}`);
    };
    const over = async (s) => S.gameOver(await read(s.leagueId));

    // After Week 18, the Wild Card listed.
    const w18 = weeks.find((x) => x.n === 18);
    await until(iso(Date.parse(w18.last) + 30 * HOUR));
    const pre = await (async () => {
      const st = await read(games.season.leagueId);
      return { end: S.MatchupLogic.endsAt(st), over: S.gameOver(st) };
    })();
    check(pre.over && pre.end === 17, `the season game ended with its final in ${label(17)} (its end ${pre.end}, over ${pre.over})`);
    check(await over(games.pickem), `Pick'em to the regular season is over after ${label(18)}`);
    check(!(await over(games.seasonFinal)) && !(await over(games.pickemFinal)), "the two through the final run on");
    let l = await linked(w.seasonId);
    check(l.get(19)?.n === 6, `the Wild Card's six games linked to ${label(19)} as they're listed (${l.get(19)?.n ?? 0})`);
    const bills = await linked(team.bills.seasonId);
    check(bills.size === 18 && /Wild Card/.test(bills.get(18)?.notes?.[0] ?? ""), `the Bills' season takes its Wild Card game as episode 18 (${bills.size} episodes)`);
    const hawks0 = await linked(team.seahawks.seasonId);
    check(hawks0.size === 17, `the Seahawks' (a bye) has nothing new yet (${hawks0.size})`);
    check(!(await over(team.seahawks)) && !(await over(team.dolphins)) && !(await over(team.bills)), "none of the three team seasons is over: a bye isn't out, and nothing says the Dolphins are yet");
    check(await over(team.billsRegular), "the Bills' season to its regular season's end is over");

    // After the Wild Card round and the Divisional Round's listing.
    await until(iso(lastOfWeek(1) + 30 * HOUR));
    l = await linked(w.seasonId);
    check(l.get(20)?.n === 4, `the Divisional Round's four linked to ${label(20)} (${l.get(20)?.n ?? 0})`);
    const { rows: ended1 } = await w.pool.query("SELECT key, ended_at IS NOT NULL AS ended FROM sports_matchups WHERE season_id = ANY($1::uuid[])", [[team.dolphins.seasonId, team.seahawks.seasonId, team.bills.seasonId]]);
    const endedOf = (s) => ended1.find((r) => r.key === seasonOf(s)?.key)?.ended;
    check(endedOf(team.dolphins) === true && (await over(team.dolphins)), "the Dolphins' season ends once the Divisional Round is listed in full without them, and its game with it");
    check(endedOf(team.seahawks) === false && (await linked(team.seahawks.seasonId)).size === 18, "the Seahawks' takes its Divisional game; not out");

    // Across the line: in the season game through the final, the held players whose teams aren't in the Divisional Round.
    // Each held player's team: their season row's (season_cast.tribe_name, the team's name as the recording names it).
    const nameOf = new Map(rec.teams.map((t) => [t.id, t.name]));
    const inDiv = new Set(pg.filter((g) => g.week === 2).flatMap((g) => [nameOf.get(g.home), nameOf.get(g.away)]));
    const st19 = await read(games.seasonFinal.leagueId);
    const held = (st19.castaways || []).filter((c) => (c.ownerIds || []).length && c.seasonCastId);
    const { rows: teamRows } = await w.pool.query("SELECT id::text, tribe_name FROM season_cast WHERE id::text = ANY($1::text[])", [held.map((c) => String(c.seasonCastId))]);
    const teamOf = new Map(teamRows.map((r) => [r.id, r.tribe_name]));
    const teamName = (c) => teamOf.get(String(c.seasonCastId)) ?? null;
    const outs = held.filter((c) => teamName(c) && !inDiv.has(teamName(c)));
    const ins = held.filter((c) => teamName(c) && inDiv.has(teamName(c)));
    fact(`held: ${held.length}, ${outs.length} of teams out by the Divisional Round, ${ins.length} of teams in it`);

    // After the Divisional Round: the Bills out.
    await until(iso(lastOfWeek(2) + 30 * HOUR));
    check(await over(team.bills), "the Bills' season ends after its loss at Denver, and its game through the final with it");
    const billsSt = await read(team.bills.leagueId);
    check(S.lastEpisode(billsSt) === 19 && billsSt.seasonLast === 19, `its last episode the Divisional game (${S.lastEpisode(billsSt)}, its season's last ${billsSt.seasonLast})`);
    {
      const st = await read(games.seasonFinal.leagueId);
      const ep20 = st.episodes.find((e) => e.number === 20);
      const zero = (id) => {
        const line = ep20?.statLines?.[id];
        return line == null || Object.values(line).every((v) => !v);
      };
      const stillHeld = outs.filter((c) => (st.castaways.find((x) => x.id === c.id)?.ownerIds || []).length > 0);
      check(outs.length > 0 && stillHeld.length === outs.length && outs.every((c) => zero(c.id)), `${outs.length} held players whose teams are out score nothing in ${label(20)}, every one still held`, outs.filter((c) => !zero(c.id)).map((c) => c.name));
      check(!!ep20?.statLines && ins.some((c) => !zero(c.id)), `players of teams still in score there (${ins.filter((c) => !zero(c.id)).length} of ${ins.length})`);
    }

    // Through the Super Bowl.
    await until(iso(lastOfWeek(5) + 30 * HOUR));
    l = await linked(w.seasonId);
    check(l.get(21)?.n === 2 && l.get(22)?.n === 1, `the Conference Championship's two and the Super Bowl linked (${l.get(21)?.n}, ${l.get(22)?.n})`);
    const { rows: pro } = await w.pool.query("SELECT count(*)::int AS n FROM season_events WHERE league = $1 AND note ILIKE '%pro bowl%'", [fx.LEAGUE]);
    check(pro[0].n === 0, `the Pro Bowl never linked (${pro[0].n})`);
    const fin = await read(games.seasonFinal.leagueId);
    check(S.MatchupLogic.endsAt(fin) === 22 && S.gameOver(fin) && fin.seasonLast === 22, `the season game through the final: its own final in ${label(22)}, over once the Super Bowl is (its end ${S.MatchupLogic.endsAt(fin)}, the season's last ${fin.seasonLast})`);
    const played = fin.episodes.filter((e) => e.number >= 19 && e.statLines && Object.keys(e.statLines).length).map((e) => e.number);
    check(played.length === 4, `its playoff weeks scored (${played.join(", ")})`);
    check(await over(games.pickemFinal), "Pick'em through the final is over with the Super Bowl");
    check(await over(team.seahawks), "the Seahawks' season ends with the title");
    const { rows: hawks } = await w.pool.query("SELECT ended_at IS NOT NULL AS ended FROM sports_matchups WHERE key = $1", [seasonOf(team.seahawks).key]);
    check(hawks[0]?.ended === true && (await linked(team.seahawks.seasonId)).size === 20, "its three playoff games taken, the champion's season ended");
  } finally {
    await fx.finish(w, { keep });
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
