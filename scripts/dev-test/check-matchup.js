// Dev-only check of L1 part 3 (docs/PLAN-start-a-game-gpt.md track L): games straight from a team's schedule as a season of their
// own (src/lib/server/sports/matchup.ts, src/lib/sports/matchup.ts; db/migrations/0300), on this lane's database and the stand-in
// ESPN (fake-espn.js), never the real one. No app server: it calls the app's own code through jiti.
//
// The stand-in has a ZT league (basketball/zt-nba) shaped like the 76ers example: ZT 76ers (9020) open at ZT Knicks, then their
// home opener against ZT Cavaliers (final 114-106, a line of 237.5 kept only in its summary, as ESPN's pickcenter), then ZT Knicks
// at home tomorrow (a line on the scoreboard) and two at ZT Cavaliers' (a series, no line). It checks:
//   the home opener made from the schedule: the league's show made once ("Not a game yet", Players, Teams, Games), a season
//   named for it with its one episode linked to its event, the link saying so (never looked at again by the daily linking),
//   the matchup keyed by its event, both teams' players from their rosters with ESPN's ids, and the game's facts kept: its
//   sides, its final (the 76ers won, 220, under the 237.5 line from its summary);
//   asked again: the same season, nothing made; a series and the next game: more seasons of the same show, numbered on, the
//   next game's line from its day's scoreboard; the series' lineup locks (L4 part 1a: air-times.ts sportLocks) by its games' own starts,
//   by day and by the week;
//   the daily job's part (refreshSportsEvents): a line moved before the game is taken, the final once it's played (its line
//   kept), the season's status from its games, a linked game first seen after it ended given its summary's line; a matchup's
//   people come from its teams even once its league's show is a game.
// Every row it makes is keyed "zt-" (the show's slug and sports_league, the matchups' keys; seasons, episodes, links, people and
// matchups go with the show), its events' league is "basketball/zt-nba", its cache rows "zt-standin:"; it removes them at the
// end (--keep leaves them; the next run removes them first). Refuses a non-local database. Prints PASS/FAIL.
//
//   node scripts/dev-test/check-matchup.js [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const fakeEspn = require("./fake-espn");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-matchup runs against a local database only");
const keep = process.argv.includes("--keep");
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const LEAGUE = "basketball/zt-nba";

const { pool } = jiti("../../src/lib/server/db.ts");
const { makeMatchup, refreshSportsEvents } = jiti("../../src/lib/server/sports/matchup.ts");
const { sportsProviders } = jiti("../../src/lib/server/sports/index.ts");
const { castable } = jiti("../../src/lib/server/sports/cast.ts");
const { finalOf } = jiti("../../src/lib/sports/matchup.ts");
const { sportLocks } = jiti("../../src/lib/server/air-times.ts");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

async function down() {
  const shows = await pool.query("DELETE FROM shows WHERE sports_league LIKE 'zt-%' OR slug LIKE 'zt-zt-%'");
  const events = await pool.query("DELETE FROM sports_events WHERE league = $1", [LEAGUE]);
  const cache = await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-standin:%'");
  return shows.rowCount + events.rowCount + cache.rowCount;
}
/** The stand-in's answers asked again (the cache keeps today's and tomorrow's scoreboards an hour). */
const forget = () => pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-standin:%'");

(async () => {
  const gone = await down();
  if (gone) console.log(`(removed ${gone} rows a run before left)`);
  const now = Date.now();
  const at = (ms) => new Date(now + ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  const player = (id, name, position) => ({ id, name, position, headshot: `https://a.espncdn.com/i/headshots/nba/players/full/${id}.png` });
  const team = (id, name, short, location, abbreviation, roster) => ({ id, name, short, location, abbreviation, league: LEAGUE, roster });
  const box = (home, away) => ({
    [home.id]: { labels: ["MIN", "PTS"], rows: home.roster.map((p, i) => ({ id: p.id, name: p.name, position: p.position, stats: ["30", String(32 - i * 10)] })) },
    [away.id]: { labels: ["MIN", "PTS"], rows: away.roster.map((p, i) => ({ id: p.id, name: p.name, position: p.position, stats: ["30", String(32 - i * 10)] })) },
  });
  const sixers = team("9020", "ZT 76ers", "76ers", "ZT Philadelphia", "ZPH", [player("zt-p1", "ZT Maxey", "Guard"), player("zt-p2", "ZT Embiid", "Center")]);
  const cavs = team("9005", "ZT Cavaliers", "Cavaliers", "ZT Cleveland", "ZCL", [player("zt-c1", "ZT Mitchell", "Guard"), player("zt-c2", "ZT Mobley", "Forward")]);
  const knicks = team("9018", "ZT Knicks", "Knicks", "ZT New York", "ZNY", [player("zt-k1", "ZT Brunson", "Guard")]);
  const espn = await fakeEspn.start({
    teams: [sixers, cavs, knicks],
    events: [
      { league: LEAGUE, id: "zt-g1", at: at(-6 * DAY), home: "9018", away: "9020", state: "post", score: [100, 106], box: box(knicks, sixers) },
      { league: LEAGUE, id: "zt-g2", at: at(-4 * DAY), home: "9020", away: "9005", state: "post", score: [114, 106], box: box(sixers, cavs), odds: { details: "ZPH -2.5", overUnder: 237.5, spread: -2.5 } },
      { league: LEAGUE, id: "zt-g3", at: at(DAY), home: "9020", away: "9018", state: "pre", odds: { details: "ZPH -4.5", overUnder: 230.5, spread: -4.5 } },
      { league: LEAGUE, id: "zt-g4", at: at(2 * DAY), home: "9005", away: "9020", state: "pre" },
      { league: LEAGUE, id: "zt-g5", at: at(3 * DAY), home: "9005", away: "9020", state: "pre" },
    ],
  });
  const providers = sportsProviders({ base: espn.url });
  const opts = { league: LEAGUE, team: "9020", providers, prefix: "zt-", now: new Date(now) };
  try {
    // The home opener, made from the schedule.
    const opener = await makeMatchup({ ...opts, ask: { kind: "opener", home: true } });
    check(opener?.made && opener.games.join() === "zt-g2", "the home opener is made from the schedule: one game, its event", JSON.stringify(opener));
    const { rows: show } = await pool.query(
      "SELECT s.id, s.name, s.kind, s.slug, s.set_up_at, s.castaway_term, s.tribe_term, s.episode_term FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE ss.id = $1",
      [opener.seasonId]
    );
    const sh = show[0];
    check(sh.kind === "sport" && sh.set_up_at === null && sh.slug === "zt-zt-nba" && [sh.castaway_term, sh.tribe_term, sh.episode_term].join() === "Player,Team,Game", "its league's show: a sport, Not a game yet, Players, Teams and Games", JSON.stringify(sh));
    const { rows: season } = await pool.query("SELECT season_number, name, status, premiere_date, finale_date FROM show_seasons WHERE id = $1", [opener.seasonId]);
    check(season[0].season_number === 1 && /^Cavaliers at 76ers, \w{3} \d+$/.test(season[0].name) && season[0].status === "completed", "a season named for it, completed", JSON.stringify(season[0]));
    const { rows: eps } = await pool.query("SELECT number, air_at, title, source FROM season_episodes WHERE season_id = $1 ORDER BY number", [opener.seasonId]);
    const { rows: links } = await pool.query("SELECT episode, provider, league, event_id, teams FROM season_events WHERE season_id = $1", [opener.seasonId]);
    check(
      eps.length === 1 && eps[0].title === "ZT Cavaliers at ZT 76ers" && eps[0].air_at.toISOString() === new Date(now - 4 * DAY).toISOString().replace(/\.\d{3}Z$/, ".000Z") && links[0]?.event_id === "zt-g2" && links[0].teams.length === 2,
      "its episode is the game, linked to its event with both teams",
      JSON.stringify({ eps, links })
    );
    const { rows: link } = await pool.query("SELECT linked, next_at FROM sports_links WHERE season_id = $1", [opener.seasonId]);
    const { rows: due } = await pool.query(
      `SELECT EXISTS (SELECT 1 FROM season_episodes e WHERE e.season_id = $1 AND NOT EXISTS (SELECT 1 FROM season_events v WHERE v.season_id = e.season_id AND v.episode = e.number)) AS todo`,
      [opener.seasonId]
    );
    check(link[0]?.linked === 1 && link[0].next_at.getTime() > now && !due[0].todo, "its link says it's all linked: nothing for the daily linking to look for", JSON.stringify(link[0]));
    const { rows: m } = await pool.query("SELECT key, events, provider, league FROM sports_matchups WHERE season_id = $1", [opener.seasonId]);
    check(m[0]?.key === "zt-espn:basketball/zt-nba:zt-g2" && m[0].events.join() === "zt-g2", "the matchup is keyed by its event", JSON.stringify(m[0]));
    const { rows: cast } = await pool.query("SELECT name, tribe_name, role, provider_ids FROM season_cast WHERE season_id = $1 ORDER BY sort_order", [opener.seasonId]);
    check(
      cast.map((c) => `${c.tribe_name}:${c.name}:${c.provider_ids?.espn}`).join() === "ZT 76ers:ZT Maxey:zt-p1,ZT 76ers:ZT Embiid:zt-p2,ZT Cavaliers:ZT Mitchell:zt-c1,ZT Cavaliers:ZT Mobley:zt-c2",
      "its people: both teams' players from their rosters, with ESPN's ids",
      JSON.stringify(cast)
    );
    const fact = async (id) => (await pool.query("SELECT state, final, final_at, teams, odds, odds_at FROM sports_events WHERE league = $1 AND event_id = $2", [LEAGUE, id])).rows[0];
    const g2 = await fact("zt-g2");
    const settled = g2 && finalOf({ final: g2.final, sides: g2.teams }, g2.odds?.overUnder);
    check(
      g2?.final && g2.final_at && g2.odds?.overUnder === 237.5 && g2.odds.details === "ZPH -2.5" && g2.odds.provider === "ZT Book" && settled?.winner === "9020" && settled.total === 220 && settled.overUnder === "under",
      "its facts kept: the final (the 76ers won, 220) and the line from its summary (237.5): under",
      JSON.stringify(g2)
    );

    // Asked again: the same season.
    const again = await makeMatchup({ ...opts, ask: { kind: "games", events: ["zt-g2"] } });
    check(again && !again.made && again.seasonId === opener.seasonId, "asked again (by its event), the same season: nothing made", JSON.stringify(again));
    const { rows: count } = await pool.query("SELECT count(*)::int AS n FROM show_seasons WHERE show_id = $1", [sh.id]);
    check(count[0].n === 1, "one season still");

    // A series and the next game: more seasons of the same show.
    const series = await makeMatchup({ ...opts, ask: { kind: "series", against: "9005" } });
    const next = await makeMatchup({ ...opts, ask: { kind: "next", count: 1 } });
    const { rows: more } = await pool.query("SELECT ss.id, ss.season_number, ss.name, ss.status, ss.show_id FROM show_seasons ss WHERE ss.id = ANY($1::uuid[]) ORDER BY season_number", [[series?.seasonId, next?.seasonId]]);
    check(
      series?.made && series.games.join() === "zt-g4,zt-g5" && next?.made && next.games.join() === "zt-g3" && more.map((s) => s.season_number).join() === "2,3" && more.every((s) => s.show_id === sh.id && s.status === "upcoming"),
      "a series at the Cavaliers' and the next game: seasons 2 and 3 of the same show, upcoming",
      JSON.stringify(more)
    );
    check(/^76ers at Cavaliers, \w{3} \d+ – \w{3} \d+$/.test(more[0]?.name ?? ""), "the series is named for it", more[0]?.name);
    const g3 = await fact("zt-g3");
    const g4 = await fact("zt-g4");
    check(g3?.state === "pre" && g3.odds?.overUnder === 230.5 && !g3.final && g4 && g4.odds === null, "the next game's line from its day's scoreboard; none where the scoreboard has none", JSON.stringify({ g3, g4 }));

    // L4 part 1a: the series' lineup locks from its games' own starts (air-times.ts sportLocks): each its own start, by day (two
    // days apart), and by the week (the earlier start of the two when they share a Tuesday-to-Monday week).
    const starts = (await pool.query("SELECT episode, starts_at FROM season_events WHERE season_id = $1 ORDER BY episode", [series.seasonId])).rows.map((r) => r.starts_at.toISOString());
    const lockAt = async (closes) => [...(await sportLocks(pool, series.seasonId, closes)).entries()].sort((a, b) => a[0] - b[0]).map(([, at]) => at);
    const [byStart, byDay, byWeek] = [await lockAt("start"), await lockAt("daily"), await lockAt("weekly")];
    // The same Tuesday-to-Monday week in Eastern time, worked out here on its own: days from the first's Tuesday to the second.
    const day = (at) => new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(at))}T00:00:00Z`);
    const [d1, d2] = starts.map(day);
    const sameWeek = (d1.getUTCDay() - 2 + 7) % 7 + (d2 - d1) / DAY < 7;
    check(
      starts.length === 2 && byStart.join() === starts.join() && byDay.join() === starts.join() && byWeek.join() === (sameWeek ? [starts[0], starts[0]] : starts).join(),
      "the series' lineup locks: each game's own start, by day, and by the week",
      JSON.stringify({ starts, byStart, byDay, byWeek, sameWeek })
    );

    // The daily job's part: a line moved before the game is taken; the final once it's played, its line kept.
    const e3 = espn.events.find((e) => e.id === "zt-g3");
    e3.odds = { details: "ZPH -3.5", overUnder: 232.5, spread: -3.5 };
    await forget();
    const r1 = await refreshSportsEvents({ providers, now: new Date(now), only: [opener.seasonId, series.seasonId, next.seasonId] });
    check(r1.errors.length === 0 && (await fact("zt-g3")).odds?.overUnder === 232.5, "the daily job takes a line moved before the game", JSON.stringify(r1));
    e3.state = "post";
    e3.score = [120, 110];
    e3.odds = { details: "ZPH -9.5", overUnder: 250.5, spread: -9.5 };
    await forget();
    const later = new Date(now + 2 * DAY);
    await refreshSportsEvents({ providers, now: later, only: [next.seasonId] });
    const g3b = await fact("zt-g3");
    const f3 = finalOf({ final: g3b.final, sides: g3b.teams }, g3b.odds?.overUnder);
    check(g3b.final && g3b.state === "post" && g3b.odds.overUnder === 232.5 && f3?.winner === "9020" && f3.total === 230 && f3.overUnder === "under", "then its final, the line before it kept", JSON.stringify(g3b));
    const { rows: st } = await pool.query("SELECT id, status FROM show_seasons WHERE id = ANY($1::uuid[])", [[next.seasonId, series.seasonId]]);
    const status = Object.fromEntries(st.map((r) => [r.id, r.status]));
    check(status[next.seasonId] === "completed" && status[series.seasonId] === "airing", "each matchup's status from its games (the next game's over; the series has begun by then)", JSON.stringify(status));
    const fin = g3b.final_at;
    await forget();
    await refreshSportsEvents({ providers, now: later, only: [next.seasonId] });
    check((await fact("zt-g3")).final_at.getTime() === fin.getTime(), "a final is kept once: not read again");

    // A linked game first seen after it ended (its row gone, as for a TV listing's game the job reads late): the scoreboard has
    // no line then, so its summary's.
    await pool.query("DELETE FROM sports_events WHERE league = $1 AND event_id = 'zt-g2'", [LEAGUE]);
    await forget();
    await refreshSportsEvents({ providers, now: new Date(now - 2 * DAY), only: [opener.seasonId] });
    const g2b = await fact("zt-g2");
    check(g2b?.final && g2b.odds?.overUnder === 237.5, "a linked game first seen after it ended gets its line from its summary", JSON.stringify(g2b));

    // A matchup's people come from its teams, even once its league's show is a game.
    await pool.query("UPDATE shows SET set_up_at = now() WHERE id = $1", [sh.id]);
    const can = await castable(series.seasonId);
    check(can.ok, "a matchup's people come from its teams even once its league's show is a game", JSON.stringify(can));
  } finally {
    await espn.close();
    if (!keep) await down();
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
  process.exit(failures ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
