// Dev-only check of L3 parts 1 and 3 (docs/PLAN-start-a-game-gpt.md track L): a game's or an event's counts saved once it's final
// (src/lib/server/sports/finals.ts saveFinals, db/migrations/0301 and 0302 sports_events.lines, people and shape) and a league's
// games read from them (src/lib/server/sports/score.ts leagueGames, sidesFor), on this lane's database. No app server and no ESPN,
// real or stand-in: an in-process provider ("zt-espn", a provider id of its own, so nothing here can reach a row of ESPN's) answers
// with the recorded 76ers home opener (tests/fixtures/espn/nba-401909093.json, through src/lib/sports/final.ts storedGame, as
// espn.ts does), golf's Bermuda Championship (pga-401850917.json, storedField) and the US Open's draws (atp-189-2026.json,
// storedCard; tennis's default scores each match by its format). It checks:
//   a final with no counts yet is still being played for everyone; saved once (the provider asked once, never again); a final the
//   provider has nothing for two days on kept as none; a game not linked by the seasons asked for, or in a league the app doesn't
//   read, left alone; a field's and a card's kept with their shape (standings; bouts, each bout's counts and results), read in the
//   league's people (the winner's place, a card's bouts by castaway scored at their formats as the phone scores them);
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
const { bracketOf } = require("../../src/lib/game/sequence/bracket.js");
const { sportOf, storedGame, storedField, storedCard, statePoints, defaultsFor, groupOf } = jiti("../../src/lib/sports/index.ts");
const { statMoments } = require("../../src/lib/game/sequence/stats.js");
const { verdictOf, pointsFor } = require("../../src/lib/game/game-spec/index.js");
const examples = require("../../tests/fixtures/sports-examples.js");
const SIXERS = require("../../tests/fixtures/espn/nba-401909093.json");
const BERMUDA = require("../../tests/fixtures/espn/pga-401850917.json");
const USOPEN = require("../../tests/fixtures/espn/atp-189-2026.json");

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
  const golf = sportOf("golf/pga");
  const tennis = sportOf("tennis/atp");
  const bermuda = golf.readBox(BERMUDA);
  const champ = bermuda.standings.find((x) => x.place === 1).id;
  const zverev = Object.values(tennis.readBox(USOPEN).people).find((p) => p.name === "Alexander Zverev").id;
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
      if (event === "401850917") return storedField(golf, BERMUDA);
      if (event === "189-2026") return storedCard(tennis, USOPEN);
      return event === "401909093" ? storedGame(nba, SIXERS) : null;
    },
  };
  const providers = [provider];
  try {
    const show = (await pool.query("INSERT INTO shows (slug, name, kind) VALUES ($1, 'ZT Finals', 'sport') RETURNING id", [SLUG])).rows[0].id;
    const seasonId = (await pool.query("INSERT INTO show_seasons (show_id, season_number) VALUES ($1, 1) RETURNING id", [show])).rows[0].id;
    // Four games: the opener (final, counts to save), one the provider has nothing for (final three days ago), one called off,
    // one still to play; a golf tournament (a field's) and a tennis event's draws (a card's), both final; and an event in a league
    // the app doesn't read (left alone). A field's and a card's link has no teams.
    const games = [
      [1, "basketball/nba", "401909093", -1 * DAY, "post", true, [{ id: "20", score: 114 }, { id: "5", score: 106 }]],
      [2, "basketball/nba", "zt-none", -3 * DAY, "post", true, [{ id: "20", score: 99 }, { id: "18", score: 98 }]],
      [6, "basketball/nba", "zt-bad", -4 * DAY, "post", true, [{ id: "20", score: 90 }, { id: "3", score: 80 }]],
      [3, "basketball/nba", "zt-off", -2 * DAY, "post", false, [{ id: "20" }, { id: "2" }]],
      [4, "basketball/nba", "zt-next", DAY, "pre", false, [{ id: "20" }, { id: "5" }]],
      [5, "golf/pga", "401850917", -1 * DAY, "post", true, null],
      [7, "tennis/atp", "189-2026", -1 * DAY, "post", true, null],
      // The same event on a later episode too (a listing's sessions of one event): scored and settled once, on the last.
      [9, "tennis/atp", "189-2026", -1 * DAY, "post", true, null],
      [8, "zt/unread", "zt-unread", -1 * DAY, "post", true, null],
    ];
    for (const [ep, league, event, at, state, final, teams] of games) {
      await pool.query("INSERT INTO season_episodes (season_id, number, air_at, source) VALUES ($1, $2, $3, 'listing')", [seasonId, ep, iso(at)]);
      await pool.query("INSERT INTO season_events (season_id, episode, provider, league, event_id, starts_at, teams) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)", [seasonId, ep, P, league, event, iso(at), teams ? JSON.stringify(teams) : null]);
      await pool.query(
        "INSERT INTO sports_events (provider, league, event_id, starts_at, state, teams, final, final_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8) ON CONFLICT DO NOTHING",
        [P, league, event, iso(at), state, JSON.stringify(teams ?? []), final, final ? iso(at + 3 * 3600_000) : null]
      );
    }
    // A final no season here links: never this check's to save.
    await pool.query("INSERT INTO sports_events (provider, league, event_id, starts_at, state, teams, final, final_at) VALUES ($1, 'basketball/nba', 'zt-other', $2, 'post', '[{\"id\":\"1\"}]'::jsonb, true, $2)", [P, iso(-DAY)]);
    // The league's people: Maxey and Mitchell from the sports data (their roster's position), and someone the provider never named.
    const cast = [["Tyrese Maxey", "Point Guard", athlete("Tyrese Maxey")], ["Donovan Mitchell", "Shooting Guard", athlete("Donovan Mitchell")], ["ZT Nobody", null, null], [bermuda.people[champ].name, null, champ], ["Alexander Zverev", null, zverev]];
    for (const [name, role, id] of cast) {
      const ids = id ? JSON.stringify({ [P]: id }) : null;
      await pool.query("INSERT INTO season_cast (season_id, name, role, provider_ids) VALUES ($1, $2, $3, $4::jsonb)", [seasonId, name, role, ids]);
    }
    const state = { settings: { showId: SLUG, wikiSeason: 1 }, castaways: [{ id: "c-maxey", name: "Tyrese Maxey" }, { id: "c-mitchell", name: "Donovan Mitchell" }, { id: "c-nobody", name: "ZT Nobody" }, { id: "c-champ", name: bermuda.people[champ].name }, { id: "c-zverev", name: "Alexander Zverev" }] };

    // Before anything's saved: the opener is final but its counts aren't kept, so it's still being played for everyone.
    let g = await leagueGames(state, { now: new Date(now) });
    check(g?.games.get(1)?.status === "in" && !g.lines.has(1), "a final with no counts kept yet is still being played", JSON.stringify(g?.games.get(1)));

    const r1 = await saveFinals({ providers, seasons: [seasonId], now: new Date(now) });
    const row = (event) => pool.query("SELECT lines, people, shape, lines_at FROM sports_events WHERE provider = $1 AND event_id = $2", [P, event]).then((x) => x.rows[0]);
    const opener = await row("401909093");
    check(r1.saved === 5 && opener.shape?.kind === "team" && opener.shape.periods?.length === 4 && opener.shape.periods[3]["20"] === 114 && !opener.shape.shootout && opener.lines?.[athlete("Tyrese Maxey")]?.PTS === 32 && opener.people?.[athlete("Tyrese Maxey")]?.team === "20" && !!opener.lines_at, "the opener's counts saved with it (Maxey's 32, his team), its quarters' ends in its shape (L4 part 2)", JSON.stringify(r1));
    const none = await row("zt-none");
    check(JSON.stringify(none.lines) === "{}" && !!none.lines_at, "a final the provider has nothing for two days on: kept as none");
    check(JSON.stringify((await row("zt-bad")).lines) === "{}" && r1.errors.some((e) => e.includes("zt-bad")), "an answer the reader can't read: said, kept as none once old, never holding up the rest");
    check((await row("zt-other")).lines === null, "a final no season asked for links: left alone");
    check((await row("zt-unread")).lines === null && !asked.includes("zt-unread"), "an event in a league the app doesn't read: left alone, never asked");
    const field = await row("401850917");
    check(field.shape?.kind === "field" && field.shape.standings?.find((x) => x.id === champ)?.place === 1 && field.lines?.[champ]?.POS === 1 && !!field.lines_at, "a field's final kept with its standings (the champion's place in his line)", JSON.stringify(field.shape?.standings?.slice(0, 2)));
    const draws = await row("189-2026");
    check(draws.shape?.kind === "card" && draws.shape.card?.bouts?.length > 0 && Object.keys(draws.shape.byBout ?? {}).length > 0 && draws.shape.results?.some((x) => x.winner === zverev || x.loser === zverev), "a card's final kept with its bouts, each bout's counts and the results");
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
    check(JSON.stringify([...(await sidesFor(state, 1))].sort()) === JSON.stringify(["20", "5"]) && (await sidesFor(state, 5)) === null, "a side answer's faces are the game's sides (a field's has none)");
    const tour = g.games.get(5);
    check(tour?.status === "final" && tour.places?.["c-champ"] === 1 && g.lines.get(5)?.["c-champ"]?.POS === 1, "the field read in the league's people: final, the champion first", JSON.stringify(tour?.places?.["c-champ"]));
    const golfScore = defaultsFor("golf").specs.season.spec.score;
    const champPts = statMoments(g.lines.get(5), golfScore).find((m) => m.castawayId === "c-champ")?.points;
    check(champPts === statePoints(golf, golfScore, golf.stateAt(BERMUDA))[champ].points, "the champion's moments at the game's table, as the phone scores them", String(champPts));
    check(g.games.get(7)?.status === "in" && !g.lines.has(7), "an event on two episodes: the earlier still being played for the server (never its final twice)", JSON.stringify(g.games.get(7)?.status));
    const ev = g.games.get(9);
    check(ev?.status === "final" && Object.values(ev.bouts ?? {}).some((b) => b.sides.includes("c-zverev")), "the draws read in the league's people: final, Zverev's matches his castaway's");
    const tennisScore = defaultsFor("tennis").specs.season.spec.score;
    const zPts = statMoments(g.lines.get(9), tennisScore, null, (id) => g.bouts.get(9)?.[id]).find((m) => m.castawayId === "c-zverev")?.points;
    const zPhone = statePoints(tennis, tennisScore, tennis.stateAt(USOPEN), { card: tennis.card(USOPEN) })[zverev].points;
    check((g.bouts.get(9)?.["c-zverev"]?.length ?? 0) > 1 && zPts === zPhone, "Zverev's matches each at their format, as the phone scores them", `${zPts} vs ${zPhone}`);
    // L4 part 2: squares' periods and a bracket's rounds, read back with the kept finals.
    check(JSON.stringify(game.periods?.map((e) => [e["20"], e["5"]])) === "[[18,35],[45,69],[82,90],[114,106]]", "the opener's quarters' ends read back (squares' pays)", JSON.stringify(game.periods));
    const draw = bracketOf(ev.bouts, "MS");
    check(draw.first === 7 && draw.winners[7]?.length === 64 && draw.winners[1]?.length === 1 && draw.over, "the men's singles draw read back round by round (a bracket's)", JSON.stringify([draw.first, draw.winners[1]]));
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
