// Dev-only check of L3 part 1 (docs/PLAN-start-a-game-gpt.md track L): a team game's counts saved once it's final
// (src/lib/server/sports/finals.ts saveFinals, db/migrations/0301 sports_events.lines) and a league's games read from them
// (src/lib/server/sports/score.ts leagueGames, sidesFor), on this lane's database. No app server and no ESPN, real or stand-in: an
// in-process provider ("zt-espn", a provider id of its own, so nothing here can reach a row of ESPN's) answers with the recorded
// 76ers home opener (tests/fixtures/espn/nba-401909093.json, through src/lib/sports/final.ts storedGame, as espn.ts does). It checks:
//   a final with no counts yet is still being played for everyone; saved once (the provider asked once, never again); a final the
//   provider has nothing for two days on kept as none; a game not linked by the seasons asked for, or a field's, left alone;
//   the league's read: the game final with its sides and everyone's lines in the league's people (a castaway by their
//   season_cast provider id, anyone else under the provider's), their roster's position group, a game past a viewer's mark still
//   to play, a game called off; the user's 76ers sentence graded from it (the 76ers, Maxey and Mitchell's 32, the under); the
//   sequence's line for a stat on it the same as the phone's scorer on ESPN's own summary; a side answer's faces.
// An answer the sport's reader throws on is said and, two days on, kept as none (it never holds up the rest).
// Every row it makes is keyed "zt-" (the show's slug; its season, episodes and people go with it) or provider "zt-espn"; it
// removes them at the end (--keep leaves them; the next run removes them first). Refuses a non-local database. Prints PASS/FAIL.
//
//   node scripts/dev-test/check-finals.js [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-finals runs against a local database only");
const keep = process.argv.includes("--keep");
const DAY = 86_400_000;
const P = "zt-espn";
const SLUG = "zt-finals";

const { pool } = jiti("../../src/lib/server/db.ts");
const { saveFinals } = jiti("../../src/lib/server/sports/finals.ts");
const { leagueGames, sidesFor } = jiti("../../src/lib/server/sports/score.ts");
const { sportOf, storedGame, statePoints, defaultsFor, groupOf } = jiti("../../src/lib/sports/index.ts");
const { statMoments } = require("../../src/lib/game/sequence/stats.js");
const { verdictOf, pointsFor } = require("../../src/lib/game/game-spec/index.js");
const examples = require("../../tests/fixtures/sports-examples.js");
const SIXERS = require("../../tests/fixtures/espn/nba-401909093.json");

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

async function down() {
  const shows = await pool.query("DELETE FROM shows WHERE slug = $1", [SLUG]);
  const events = await pool.query("DELETE FROM sports_events WHERE provider = $1", [P]);
  return shows.rowCount + events.rowCount;
}

(async () => {
  const gone = await down();
  if (gone) console.log(`(removed ${gone} rows a run before left)`);
  const nba = sportOf("basketball/nba");
  const box = nba.readBox(SIXERS);
  const athlete = (name) => Object.values(box.people).find((p) => p.name === name).id;
  const now = Date.now();
  const iso = (ms) => new Date(now + ms).toISOString();
  // The provider: the recorded opener for its event, nothing for any other; each ask counted.
  const asked = [];
  const provider = {
    id: P,
    name: "ZT ESPN",
    game: async (league, event) => {
      asked.push(event);
      // An answer the sport's reader can't read.
      if (event === "zt-bad") throw new TypeError("Cannot read properties of undefined (reading 'plays')");
      return event === "401909093" ? storedGame(nba, SIXERS) : null;
    },
  };
  const providers = [provider];
  try {
    const show = (await pool.query("INSERT INTO shows (slug, name, kind) VALUES ($1, 'ZT Finals', 'sport') RETURNING id", [SLUG])).rows[0].id;
    const seasonId = (await pool.query("INSERT INTO show_seasons (show_id, season_number) VALUES ($1, 1) RETURNING id", [show])).rows[0].id;
    // Four games: the opener (final, counts to save), one the provider has nothing for (final three days ago), one called off,
    // one still to play; and a golf event, a field's (left alone).
    const games = [
      [1, "basketball/nba", "401909093", -1 * DAY, "post", true, [{ id: "20", score: 114 }, { id: "5", score: 106 }]],
      [2, "basketball/nba", "zt-none", -3 * DAY, "post", true, [{ id: "20", score: 99 }, { id: "18", score: 98 }]],
      [6, "basketball/nba", "zt-bad", -4 * DAY, "post", true, [{ id: "20", score: 90 }, { id: "3", score: 80 }]],
      [3, "basketball/nba", "zt-off", -2 * DAY, "post", false, [{ id: "20" }, { id: "2" }]],
      [4, "basketball/nba", "zt-next", DAY, "pre", false, [{ id: "20" }, { id: "5" }]],
      [5, "golf/pga", "zt-golf", -1 * DAY, "post", true, [{ id: "zt-team" }]],
    ];
    for (const [ep, league, event, at, state, final, teams] of games) {
      await pool.query("INSERT INTO season_episodes (season_id, number, air_at, source) VALUES ($1, $2, $3, 'listing')", [seasonId, ep, iso(at)]);
      await pool.query("INSERT INTO season_events (season_id, episode, provider, league, event_id, starts_at, teams) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)", [seasonId, ep, P, league, event, iso(at), JSON.stringify(teams)]);
      await pool.query(
        "INSERT INTO sports_events (provider, league, event_id, starts_at, state, teams, final, final_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)",
        [P, league, event, iso(at), state, JSON.stringify(teams), final, final ? iso(at + 3 * 3600_000) : null]
      );
    }
    // A final no season here links: never this check's to save.
    await pool.query("INSERT INTO sports_events (provider, league, event_id, starts_at, state, teams, final, final_at) VALUES ($1, 'basketball/nba', 'zt-other', $2, 'post', '[{\"id\":\"1\"}]'::jsonb, true, $2)", [P, iso(-DAY)]);
    // The league's people: Maxey and Mitchell from the sports data (their roster's position), and someone the provider never named.
    const cast = [["Tyrese Maxey", "Point Guard"], ["Donovan Mitchell", "Shooting Guard"], ["ZT Nobody", null]];
    for (const [name, role] of cast) {
      const ids = name.startsWith("ZT") ? null : JSON.stringify({ [P]: athlete(name) });
      await pool.query("INSERT INTO season_cast (season_id, name, role, provider_ids) VALUES ($1, $2, $3, $4::jsonb)", [seasonId, name, role, ids]);
    }
    const state = { settings: { showId: SLUG, wikiSeason: 1 }, castaways: [{ id: "c-maxey", name: "Tyrese Maxey" }, { id: "c-mitchell", name: "Donovan Mitchell" }, { id: "c-nobody", name: "ZT Nobody" }] };

    // Before anything's saved: the opener is final but its counts aren't kept, so it's still being played for everyone.
    let g = await leagueGames(state, { now: new Date(now) });
    check(g?.games.get(1)?.status === "in" && !g.lines.has(1), "a final with no counts kept yet is still being played", JSON.stringify(g?.games.get(1)));

    const r1 = await saveFinals({ providers, seasons: [seasonId], now: new Date(now) });
    const row = (event) => pool.query("SELECT lines, people, lines_at FROM sports_events WHERE provider = $1 AND event_id = $2", [P, event]).then((x) => x.rows[0]);
    const opener = await row("401909093");
    check(r1.saved === 3 && opener.lines?.[athlete("Tyrese Maxey")]?.PTS === 32 && opener.people?.[athlete("Tyrese Maxey")]?.team === "20" && !!opener.lines_at, "the opener's counts saved with it (Maxey's 32, his team)", JSON.stringify(r1));
    const none = await row("zt-none");
    check(JSON.stringify(none.lines) === "{}" && !!none.lines_at, "a final the provider has nothing for two days on: kept as none");
    check(JSON.stringify((await row("zt-bad")).lines) === "{}" && r1.errors.some((e) => e.includes("zt-bad")), "an answer the reader can't read: said, kept as none once old, never holding up the rest");
    check((await row("zt-other")).lines === null, "a final no season asked for links: left alone");
    check((await row("zt-golf")).lines === null && !asked.includes("zt-golf"), "a field's event: left alone, never asked");
    const before = asked.length;
    const r2 = await saveFinals({ providers, seasons: [seasonId], now: new Date(now) });
    check(r2.saved === 0 && asked.length === before, "saved once: never asked again", `${r2.saved} saved, ${asked.length - before} asked`);

    // The league's read.
    g = await leagueGames(state, { now: new Date(now) });
    const game = g.games.get(1);
    check(game?.status === "final" && JSON.stringify(game.sides) === JSON.stringify([{ id: "20", score: 114 }, { id: "5", score: 106 }]), "the opener: final, 114-106", JSON.stringify(game?.sides));
    const lines = g.lines.get(1);
    check(lines?.["c-maxey"]?.PTS === 32 && lines?.["c-mitchell"]?.PTS === 32, "everyone's lines in the league's people (Maxey's and Mitchell's 32)");
    const other = Object.keys(lines ?? {}).filter((id) => !id.startsWith("c-"));
    check(other.length > 0 && other.every((id) => id.startsWith(`${P}:`)), "anyone else under the provider's id", other.slice(0, 3).join(", "));
    check(g.groups["c-maxey"] === groupOf(nba, "Point Guard") && !!g.groups["c-maxey"] && !("c-nobody" in g.groups), "a position group from the roster", JSON.stringify(g.groups));
    check(game.teams?.["c-maxey"] === "20" && game.teams?.["c-mitchell"] === "5", "each one's team");
    check(g.games.get(2)?.status === "final" && Object.keys(g.lines.get(2) ?? {}).length === 0, "the game kept as none: final, nobody's lines");
    check(g.games.get(3)?.status === "off", "a game over without a final (postponed, called off): off");
    check(g.games.get(4)?.status === "pre", "a game still to play");
    check(!g.games.has(5) && JSON.stringify([...(await sidesFor(state, 1))].sort()) === JSON.stringify(["20", "5"]), "a field's event isn't a team game's; a side answer's faces are the game's sides");
    const seen = await leagueGames(state, { mark: 0, now: new Date(now) });
    check(seen.games.get(1)?.status === "pre" && !seen.lines.has(1), "a game past the viewer's mark: still to play for them");

    // The user's 76ers sentence, graded from the read.
    const ex = examples.sixersOpener;
    const facts = { from: 1, to: 1, over: true, episodes: new Map(), names: new Map(), games: g.games };
    const [winner, top, total] = ex.spec.ask.map((q) => verdictOf(q, 1, facts));
    const under = Object.fromEntries(pointsFor(ex.spec.ask[2], total, [{ playerId: "a", answer: "under" }, { playerId: "b", answer: "over" }], facts));
    check(JSON.stringify(winner.right) === '["20"]' && JSON.stringify(top.right.slice().sort()) === '["c-maxey","c-mitchell"]' && total.value === 220 && JSON.stringify(under) === '{"a":1}', "the 76ers sentence: the 76ers, Maxey and Mitchell, 220 and the under");

    // The sequence's line for a stat on the read, the phone's scorer on ESPN's own summary.
    const score = defaultsFor("basketball").specs.season.spec.score;
    const moments = statMoments(lines, score, (id) => g.groups[id]);
    const phone = statePoints(nba, score, nba.stateAt(SIXERS));
    const maxey = moments.find((m) => m.castawayId === "c-maxey");
    check(maxey?.points === phone[athlete("Tyrese Maxey")].points && moments.length === Object.values(phone).filter((s) => s.points).length, "each holding's moments at the game's table, as the phone scores them", `${maxey?.points} vs ${phone[athlete("Tyrese Maxey")].points}`);
  } finally {
    if (!keep) await down();
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
