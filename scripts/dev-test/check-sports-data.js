// Dev-only check of the sports-data provider (src/lib/server/sports/: the interface, the ESPN adapter, the cache;
// docs/PLAN-sports-data.md step 1) against the REAL ESPN, like check-show-art.js: real calls, no app server.
//
// Each case asks ESPN what the app will, and checks what comes back has the basics, on games that have been played:
//   mlb   the 2026 World Series, Game 1 (Oct 23): search finds the Rays in baseball/mlb; the day's scoreboard has ESPN's 401908042,
//         "Tampa Bay Rays at Milwaukee Brewers", final, Brewers 3-2; the Rays' roster is players only (no Kevin Cash, their
//         manager) with headshots; the box score has both teams' batting and pitching in ESPN's own columns; Yandy Díaz's 2026
//         lines include the regular season (154 GP, 22 HR)
//   afl   the 2026 AFL Grand Final (Sep 26): the game, its box score's D/G/B columns for both teams (the roster prints, as ESPN's AFL
//         rosters come back empty)
//   f1    the 2026 United States Grand Prix (Oct 25): search finds racing/f1; one event in parts (practice, qualifying, race) whose
//         race has the whole field with places
//   epl   a Premier League day (Oct 25): its games, and a match sheet read as one table per team (soccer's stats are on its rosters)
//   nba   search finds the Celtics in basketball/nba; their roster, with headshots
//   cache the cache on the local database (rows keyed "zt-sports:", removed after): a miss asks, a hit doesn't, a finished game's
//         box score keeps for good, a past day's scoreboard a month, and an answer past its time is served when ESPN is down
// --leagues also reads ESPN's index of every sport and league (about 18 calls).
//
//   node scripts/dev-test/check-sports-data.js [--case=mlb,afl,f1,epl,nba,cache] [--leagues]
//
// No case touches a real show, league or person; only "cache" writes to the database (refuses a non-local one). Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { isDeepStrictEqual } = require("util");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });

const args = process.argv.slice(2);
const ALL = ["mlb", "afl", "f1", "epl", "nba", "cache"];
const cases = (args.find((a) => a.startsWith("--case=")) ?? `--case=${ALL.join(",")}`).slice(7).split(",").filter(Boolean);
const PREFIX = "zt-sports:";

const { espn } = jiti("../../src/lib/server/sports/espn.ts");
const { withCache } = jiti("../../src/lib/server/sports/cache.ts");
const { SportsUnavailable } = jiti("../../src/lib/server/sports/types.ts");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

/** ESPN, counting the calls that reach it. */
function counted(p) {
  const calls = [];
  const wrap = {};
  for (const k of Object.keys(p)) {
    wrap[k] = typeof p[k] === "function" ? (...a) => (calls.push(`${k}(${a.join(", ")})`), p[k](...a)) : p[k];
  }
  wrap.calls = calls;
  return wrap;
}

const table = (box, team, name) => box?.teams.find((t) => t.team.name === team)?.tables.find((t) => t.name === name);
const col = (t, label, row) => row.values[t.labels.indexOf(label)];

async function mlb(e) {
  console.log("\n== mlb: the 2026 World Series, Game 1");
  const found = await e.find("Tampa Bay Rays");
  const rays = found.find((f) => f.kind === "team" && f.name === "Tampa Bay Rays");
  check(rays?.league === "baseball/mlb" && rays.id === "30", "search: the Rays are team 30 in baseball/mlb", JSON.stringify(found.slice(0, 3)));
  const day = await e.eventsOn("baseball/mlb", "2026-10-23");
  const g1 = day.find((x) => x.id === "401908042");
  check(!!g1, "Oct 23's scoreboard has ESPN's 401908042", day.map((x) => `${x.id} ${x.name}`).join("; "));
  if (g1) {
    check(g1.name === "Tampa Bay Rays at Milwaukee Brewers" && g1.final && g1.state === "post", "  named as the listing does, and final", `${g1.name} ${g1.state} ${g1.final}`);
    const brewers = g1.competitors.find((c) => c.team?.name === "Milwaukee Brewers");
    check(g1.competitors.length === 2 && brewers?.score === "3" && brewers.winner === true && brewers.home === true, "  two teams; the Brewers won 3-2 at home", JSON.stringify(g1.competitors.map((c) => [c.team?.name, c.score, c.winner])));
    check(brewers?.team.also.includes("Brewers") && brewers.team.also.includes("Milwaukee"), "  a team's other names (Brewers, Milwaukee)", JSON.stringify(brewers?.team.also));
    check(g1.season === 2026 && /World Series/.test(g1.note ?? ""), "  its season and note", `${g1.season} ${g1.note}`);
  }
  const roster = await e.roster("baseball/mlb", "30");
  const shots = (roster ?? []).filter((p) => p.headshot).length;
  console.log(`  the Rays' roster: ${roster?.length ?? "none"} players, ${shots} headshots; groups ${[...new Set((roster ?? []).map((p) => p.group))].join(", ")}`);
  check((roster?.length ?? 0) >= 20 && shots >= roster.length * 0.8, "roster: 20+ players, most with headshots");
  check(!(roster ?? []).some((p) => /Kevin Cash/.test(p.name)), "  players only: no manager");
  check((roster ?? []).every((p) => p.id && p.name && p.position), "  each with ESPN's id, name and position");
  check((await e.roster("baseball/mlb", "99999")) === null, "a team ESPN doesn't have is null");
  const box = await e.boxScore("baseball/mlb", "401908042");
  check(box?.final === true && box.teams.length === 2, "box score: final, both teams");
  const bat = table(box, "Tampa Bay Rays", "batting");
  const pitch = table(box, "Milwaukee Brewers", "pitching");
  console.log(`  batting columns: ${bat?.labels.join(" ")}\n  pitching columns: ${pitch?.labels.join(" ")}`);
  check(bat?.labels.includes("H-AB") && bat.labels.includes("RBI") && bat.rows.length >= 9, "  the Rays' batting in ESPN's columns, nine or more lines");
  const yandy = bat?.rows.find((r) => r.person.id === "33481");
  check(!!yandy && col(bat, "H-AB", yandy) === "0-4" && yandy.starter === true, "  Yandy Díaz went 0-4, starting", JSON.stringify(yandy?.values));
  check(pitch?.labels.includes("IP") && pitch.labels.includes("ERA") && pitch.rows.some((r) => r.person.name === "Jacob Misiorowski"), "  the Brewers' pitching, Misiorowski on it");
  check(box?.teams.find((t) => t.team.name === "Milwaukee Brewers")?.winner === true, "  the winner");
  check((await e.boxScore("baseball/mlb", "1")) === null, "a game ESPN doesn't have is null");
  const lines = await e.seasonStats("baseball/mlb", "33481", 2026);
  const reg = lines?.find((l) => !/postseason/.test(l.category) && l.labels.includes("HR"));
  console.log(`  Yandy Díaz 2026: ${(lines ?? []).map((l) => l.name).join(", ")}`);
  check(!!reg && reg.values[reg.labels.indexOf("GP")] === "154" && reg.values[reg.labels.indexOf("HR")] === "22", "season stats: his 2026 regular season (154 GP, 22 HR)", JSON.stringify(reg));
  check((lines ?? []).some((l) => /postseason/.test(l.category)), "  and his 2026 postseason, apart");
}

async function afl(e) {
  console.log("\n== afl: the 2026 Grand Final");
  const day = await e.eventsOn("australian-football/afl", "2026-09-26");
  const gf = day.find((x) => /Brisbane Lions/.test(x.name) && /Fremantle/.test(x.name));
  check(!!gf?.final, "Sep 26's scoreboard has Brisbane Lions at Fremantle, final", day.map((x) => x.name).join("; "));
  if (!gf) return;
  const box = await e.boxScore("australian-football/afl", gf.id);
  const t = box?.teams[0]?.tables[0];
  console.log(`  columns: ${t?.labels.join(" ")}`);
  check(box?.teams.length === 2 && box.teams.every((x) => x.tables[0]?.rows.length >= 20), "box score: both teams, 20+ players each");
  check(t?.labels.includes("D") && t.labels.includes("G") && t.labels.includes("B"), "  in AFL's own columns (D, G, B)");
  const team = gf.competitors[0]?.team;
  const roster = team ? await e.roster("australian-football/afl", team.id) : null;
  console.log(`  ${team?.name}'s roster: ${roster === null ? "none" : `${roster.length} players`} (a roster from box scores is step 3's)`);
}

async function f1(e) {
  console.log("\n== f1: the 2026 United States Grand Prix");
  const found = await e.find("Formula 1");
  check(found.some((f) => f.kind === "league" && f.league === "racing/f1"), "search: Formula 1 is racing/f1", JSON.stringify(found.slice(0, 3)));
  const day = await e.eventsOn("racing/f1", "2026-10-25");
  const gp = day.find((x) => /United States Grand Prix/.test(x.name));
  check(!!gp, "Oct 25's scoreboard has the United States Grand Prix", day.map((x) => x.name).join("; "));
  if (!gp) return;
  console.log(`  ${gp.name}: parts ${gp.parts.map((p) => p.name).join(", ")}`);
  const race = gp.parts.find((p) => p.name === "Race");
  check(gp.parts.length >= 3 && !!race, "  an event in parts, one of them the race");
  check((race?.competitors.length ?? 0) >= 20 && race.competitors.every((c) => c.person?.name && Number.isInteger(c.place)), "  the race's whole field, each with a place", race?.competitors.slice(0, 3).map((c) => `${c.place} ${c.person?.name}`).join(", "));
}

async function epl(e) {
  console.log("\n== epl: a Premier League day");
  const day = await e.eventsOn("soccer/eng.1", "2026-10-25");
  check(day.length >= 3 && day.every((x) => x.competitors.length === 2 && x.competitors.every((c) => c.team)), "Oct 25's games, each two teams", day.map((x) => x.name).join("; "));
  const first = day.find((x) => x.final);
  if (!first) return check(false, "a finished game that day");
  const box = await e.boxScore("soccer/eng.1", first.id);
  const t = box?.teams[0]?.tables[0];
  console.log(`  ${first.name}: columns ${t?.labels.join(" ")}; ${box?.teams.map((x) => `${x.team.name} ${x.tables[0]?.rows.length ?? 0} players`).join(", ")}`);
  check(box?.teams.length === 2 && box.teams.every((x) => x.tables.length === 1 && x.tables[0].rows.length >= 11), "match sheet: one table per team, 11+ players");
  check(t?.labels.includes("YC") && t.rows.every((r) => r.values.length === t.labels.length), "  soccer's own columns, every line in them");
}

async function nba(e) {
  console.log("\n== nba: the Celtics");
  const found = await e.find("Boston Celtics");
  const team = found.find((f) => f.kind === "team" && f.league === "basketball/nba");
  check(!!team, "search: the Celtics in basketball/nba", JSON.stringify(found.slice(0, 3)));
  const roster = team ? await e.roster("basketball/nba", team.id) : null;
  const shots = (roster ?? []).filter((p) => p.headshot).length;
  console.log(`  ${roster?.length ?? 0} players, ${shots} headshots`);
  check((roster?.length ?? 0) >= 12 && shots >= roster.length * 0.8, "roster: 12+ players, most with headshots, in one list (no groups)");
}

async function leagues(e) {
  console.log("\n== leagues: ESPN's index");
  const all = await e.leagues();
  const ids = new Set(all.map((l) => l.id));
  console.log(`  ${all.length} leagues over ${new Set(all.map((l) => l.sport)).size} sports`);
  check(all.length >= 100, "a hundred or more");
  for (const id of ["baseball/mlb", "australian-football/afl", "racing/f1", "soccer/eng.1", "basketball/nba"]) check(ids.has(id), `  has ${id}`);
}

async function cache() {
  console.log("\n== cache (local database, rows keyed zt-sports:)");
  const DB = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("the cache case runs against a local database only");
  const { pool } = jiti("../../src/lib/server/db.ts");
  try {
    await pool.query("DELETE FROM sports_cache WHERE key LIKE $1", [`${PREFIX}%`]);
    const raw = counted(espn());
    const c = withCache(raw, { prefix: PREFIX });
    const first = await c.eventsOn("baseball/mlb", "2026-10-23");
    const again = await c.eventsOn("baseball/mlb", "2026-10-23");
    check(raw.calls.length === 1 && isDeepStrictEqual(first, again), "a day's games: asked once, then from the cache", raw.calls.join("; "));
    const row = async (k) => (await pool.query("SELECT expires_at, length(value::text) AS size FROM sports_cache WHERE key = $1", [PREFIX + k])).rows[0];
    const day = await row("espn:events:baseball/mlb:2026-10-23");
    const days = day?.expires_at ? (day.expires_at - Date.now()) / 86_400_000 : null;
    check(days > 29 && days <= 30, "  a past day, every game over: kept a month", String(days));
    await c.boxScore("baseball/mlb", "401908042");
    const box = await row("espn:box:baseball/mlb:401908042");
    check(!!box && box.expires_at === null, "a final game's box score: kept for good");
    console.log(`  stored sizes: the day ${day?.size} bytes, the box score ${box?.size} bytes (ESPN's own answer is ~1 MB)`);
    check(box?.size < 60_000, "  stored as read, not ESPN's raw answer");
    await c.find("Tampa Bay Rays");
    const before = raw.calls.length;
    await c.find("  tampa bay   RAYS ");
    check(raw.calls.length === before, "search: the same words, any spacing or case, from the cache");
    // Past its time, and ESPN down: the old answer is served.
    await pool.query("UPDATE sports_cache SET expires_at = now() - interval '1 minute' WHERE key = $1", [PREFIX + "espn:events:baseball/mlb:2026-10-23"]);
    const down = withCache({ ...espn(), eventsOn: async () => { throw new SportsUnavailable("ESPN answered 503"); } }, { prefix: PREFIX });
    const stale = await down.eventsOn("baseball/mlb", "2026-10-23");
    check(stale.some((x) => x.id === "401908042"), "ESPN down: the answer past its time is served");
    let threw = null;
    try {
      await down.eventsOn("baseball/mlb", "2026-10-22");
    } catch (e) {
      threw = e;
    }
    check(threw instanceof SportsUnavailable, "ESPN down with nothing cached: the caller hears it");
  } finally {
    const { rowCount } = await pool.query("DELETE FROM sports_cache WHERE key LIKE $1", [`${PREFIX}%`]);
    console.log(`  removed ${rowCount} zt-sports: rows`);
    await pool.end();
  }
}

(async () => {
  const e = espn();
  const t0 = Date.now();
  for (const c of cases) {
    if (c === "mlb") await mlb(e);
    else if (c === "afl") await afl(e);
    else if (c === "f1") await f1(e);
    else if (c === "epl") await epl(e);
    else if (c === "nba") await nba(e);
    else if (c === "cache") await cache();
    else throw new Error(`no case ${c} (${ALL.join(", ")})`);
  }
  if (args.includes("--leagues")) await leagues(e);
  console.log(`\n${failures ? `FAILED (${failures})` : "all good"} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (failures) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
