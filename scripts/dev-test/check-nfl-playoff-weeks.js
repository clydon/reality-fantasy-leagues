// Dev-only check of where head to head's playoffs fall on an NFL slate (docs/PLAN-sports-ready.md, Phase 0 (d), then Phase 2.2 and
// BACKLOG 214). A game's playoffs take its last weeks, a round a week (state-logic.js MatchupLogic.playoffsFrom: the game's span's end,
// else the season's length as its schedule says, air-times.ts stampSeasonLength). An NFL slate is the regular season's 18 weeks, and
// Yahoo and ESPN end fantasy playoffs at Week 17, before Week 18's rested starters: where do ours fall?
//
// On nfl-slate-fixture.js (the recorded NFL season through the stand-in ESPN, the clock an hour before Week 1's first game; six
// people on the couch, so the top six can make the playoffs), as zt-nfl-ann:
//   the default       the season game as POST /api/sports/start starts it (start.ts startSport, "season": the football defaults'
//                     head to head): whether it has playoffs at all
//   with playoffs     the same game's rules with "A final at the end" set (the wizard's chips write rank.playoffs.teams: Top 2 and
//                     Top 4, and 6 on its stepper), started as the wizard starts a spec (start-spec.ts startFromSpec); and Top 4 on a
//                     game started at Week 9 (--from): each round's week, read as the league's poll reads the game (league-read.ts
//                     readyLeague stamps the season's length)
// What's asserted is the plan's recommendation for BACKLOG 214 (the user's call): wherever a game has playoffs, its final is by Week
// 17 (--last). On 2026-11-19 it fails (Phase 0 confirmed the inference): the default has no playoffs (the title is the standings
// after Week 18), and with any playoffs on, the final is Week 18 (Top 4: Weeks 17 and 18; 6 teams: 16 to 18). Its last line says
// which. Since step 2.2 (2026-11-20) it passes. BACKLOG 226 (the user's call of 2026-11-20) adds: the default plays a final between
// the top two in Week 17, its span ending there; a game scored by stats started to the season's end (the wizard's "The rest of the
// season", Season points here) ends at Week 17 too, and one whose maker picks Week 18 keeps it.
//
//   node scripts/dev-test/check-nfl-playoff-weeks.js [--last=17] [--from=9] [--keep]
//
// Needs the local database and the NFL recording (see nfl-slate-fixture.js); no app server, never the real ESPN. Its rows are the
// fixture's (--keep leaves them; the next run removes them first). Don't run it beside another check on nfl-slate-fixture.js.
const fx = require("./nfl-slate-fixture");

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const keep = process.argv.includes("--keep");
const LAST = Number(arg("last", "17"));
const FROM = Number(arg("from", "9"));
let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 400)})` : ""}`);
  if (!ok) failures++;
  return ok;
}
const fact = (s) => console.log(`      ${s}`);

(async () => {
  const weeks = fx.weeksOf(fx.recording().input);
  const week1 = weeks.find((w) => w.n === 1);
  const w = await fx.up({ at: new Date(Date.parse(week1.first) - 3600_000).toISOString(), people: 6 });
  try {
    const S = fx.app("../../src/lib/game/state-logic.js");
    const { readyLeague } = fx.app("../../src/lib/server/league-read.ts");
    const { startFromSpec } = fx.app("../../src/lib/server/start-spec.ts");
    const label = (n) => weeks.find((x) => x.n === n)?.label ?? `episode ${n}`;
    const placed = async (leagueId) => {
      const st = await readyLeague(leagueId, await w.league(leagueId));
      const parts = S.MatchupLogic.parts(st);
      const from = S.MatchupLogic.playoffsFrom(st, parts);
      const end = S.MatchupLogic.endsAt(st);
      return { st, parts, from, end, rounds: from === null ? [] : Array.from({ length: parts.playoffs.rounds }, (_, i) => from + i) };
    };
    // Step 2.7: the slate is the regular season and then the playoffs; the regular season's end is w.regular (18).
    fact(`the slate: ${w.slate.name}, ${w.slate.episodes} weeks, its regular season ${label(1)} to ${label(w.regular)}, its schedule's length stamped on a game as seasonEpisodes`);

    // The default season game, as the sports route starts it.
    const d = await w.start("ann", { seasonId: w.seasonId, game: "season", tell: false });
    const def = await placed(d.leagueId);
    fact(`the default season game: ${label(d.from)} to ${label(d.to)}, ranked by ${S.gameOf(def.st).rank.by}, playoffs ${JSON.stringify(def.parts?.playoffs ?? null)}, seasonEpisodes ${def.st.seasonEpisodes}`);
    if (!def.parts?.playoffs) fact(`so the default has no playoffs: the standings after ${label(d.to)} decide it`);
    check(def.parts?.playoffs?.teams === 2 && def.end === LAST && d.to === LAST, `(BACKLOG 226) the default plays a final between the top two in ${label(LAST)}, its span ending there`, { playoffs: def.parts?.playoffs ?? null, final: def.end, to: d.to });

    // BACKLOG 226: a game scored by stats to the season's end (the wizard's "The rest of the season", span.to null) ends at Week 17;
    // one whose maker picks Week 18 keeps it. Season points: the same rules ranked by total.
    const points = { ...structuredClone(S.gameOf(def.st)), rank: { by: "total" } };
    for (const [to, want] of [[null, LAST], [w.regular, w.regular]]) {
      const s = await startFromSpec(w.users.ann, w.seasonId, w.couchId, { spec: { ...structuredClone(points), span: { from: 1, to } }, name: `ZT Points ${to ?? "rest"}`, tell: false }, new Date());
      const st = await w.league(s.leagueId);
      const got = S.gameOf(st).span.to;
      check(got === want, `(BACKLOG 226) Season points started ${to === null ? "to the season's end" : `through ${label(to)}`}: it ends with ${label(want)} (it's ${got === null ? "the season's end" : label(got)})`);
    }

    // The same rules with playoffs, as the wizard's "A final at the end" writes them.
    const spec = S.gameOf(def.st);
    const ends = [];
    for (const [teams, from] of [[2, 1], [4, 1], [6, 1], [4, FROM]]) {
      const at = weeks.find((x) => x.n === from);
      if (from !== 1) w.advance(new Date(Date.parse(at.first) - 3600_000).toISOString());
      const body = { spec: { ...structuredClone(spec), span: { from, to: w.regular }, rank: { ...spec.rank, playoffs: { teams } } }, name: `ZT Top ${teams}`, tell: false };
      const s = await startFromSpec(w.users.ann, w.seasonId, w.couchId, body, new Date());
      const p = await placed(s.leagueId);
      ends.push(p.end);
      const what = p.rounds.map((n, i) => `${p.rounds.length - i === 1 ? "final" : p.rounds.length - i === 2 ? "semifinals" : "quarterfinals"} ${label(n)}`).join(", ");
      fact(`Top ${teams}, from ${label(from)}: ${p.parts.playoffs.rounds} round${p.parts.playoffs.rounds === 1 ? "" : "s"}: ${what || "none placed"}; the regular season ${label(from)} to ${label(p.from - 1)}`);
      check(p.end !== null && p.end <= LAST, `Top ${teams} from ${label(from)}: the final by ${label(LAST)} (it's ${p.end === null ? "nowhere" : label(p.end)})`);
    }
    const week18 = ends.every((e) => e === w.regular);
    console.log(
      week18
        ? `VERDICT (d): CONFIRMED: an NFL slate's playoffs end in ${label(w.regular)} (the default has none: the standings after ${label(w.regular)} decide it)`
        : ends.every((e) => e !== null && e <= LAST)
          ? `VERDICT (d): STRUCK: the playoffs end by ${label(LAST)}`
          : `VERDICT (d): MIXED: finals at ${ends.map(label).join(", ")}`
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
