// Dev-only check of G3, the GPT learns sports (docs/PLAN-start-a-game-gpt.md track G): someone's words on a sport's season to a
// game, through the server's own code (src/lib/server/game-words.ts gameWords, packFor), on this lane's database, the stand-in ESPN
// (fake-espn.js) and the stand-in bot (fake-bot.js), never the real ones. No app server: it calls the app's code through jiti.
//
// The stand-in ESPN has a ZT team shaped like the 76ers example: ZT 76ers (9020) at home to ZT Cavaliers tomorrow (its home
// opener, ESPN's line 237.5 on the scoreboard), then two at ZT Knicks (a series, no line yet). Made from the schedule as matchups
// (L1 part 3's makeMatchup: the opener, the series), their people filled from the teams' rosters. It checks:
//   the pack the bot is given: a sport's (its league, its teams, its game with which side is home, not started, ESPN's line; no
//   score), its players each with their team and position, the stats a request can name in their words (PTS "Points"), the sport's
//   standard game; no moments, phases or roles;
//   the manual: the sports section, the sport's standard games (no show's presets), and only sports requests as its examples;
//   the user's 76ers sentence (tracker w003) drafted as a bot might ("points" for the stat, ESPN's 237.5 copied in as a line they
//   never said): our check reads PTS and the game's own line, and the game is the tracker's own, asked once of the bot, kept as a
//   row of game_word_asks with its result;
//   a typed change ("2 points each instead"): the game so far goes back with the change, and the changed game comes back;
//   the Lakers request (w052: "draft 2 players each, points rebounds assists all count 1") on the series' page, the bot's keys
//   its words ("rebounds"): the tracker's own game, everyone drafted and scored by the stats.
// Every row it makes is keyed "zt-" (the user zt_sports_words, the league's show by its sports_league "zt-espn:basketball/nba", its
// seasons, episodes, links and people with it, the events "zt-sw-*", the cache "zt-sw:"); it removes them at the end (--keep
// leaves them; the next run removes them first). Refuses a non-local database. Prints PASS/FAIL.
//
//   node scripts/dev-test/check-sports-words.js [--keep]
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src"), "@db": path.join(__dirname, "..", "..", "db") } });
const fakeEspn = require("./fake-espn");
const fakeBot = require("./fake-bot");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-sports-words runs against a local database only");
const keep = process.argv.includes("--keep");
const DAY = 24 * 3600_000;
const LEAGUE = "basketball/nba";
const USER = "zt_sports_words";

const { pool } = jiti("../../src/lib/server/db.ts");
const { makeMatchup } = jiti("../../src/lib/server/sports/matchup.ts");
const { sportsProviders } = jiti("../../src/lib/server/sports/index.ts");
const { castFromEvents } = jiti("../../src/lib/server/sports/cast.ts");
const { gameWords } = jiti("../../src/lib/server/game-words.ts");
const tracker = require("../../tests/fixtures/engine-capabilities.json");
const G = require("../../src/lib/game/game-spec/index.js");
/** The same game: every part as our defaults fill it in (a draft needn't carry the spec's version). */
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const same = (a, b) => !!a && JSON.stringify(canon(G.fullSpec(a))) === JSON.stringify(canon(G.fullSpec(b)));

const spec = (id) => tracker.corpus.requests.find((r) => r.id === id).spec;
const words = (id) => tracker.corpus.requests.find((r) => r.id === id).words;

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

async function down() {
  const shows = await pool.query("DELETE FROM shows WHERE sports_league LIKE 'zt-%' AND sports_league LIKE '%basketball/nba'");
  const events = await pool.query("DELETE FROM sports_events WHERE league = $1 AND event_id LIKE 'zt-sw-%'", [LEAGUE]);
  const cache = await pool.query("DELETE FROM sports_cache WHERE key LIKE 'zt-sw:%'");
  const user = await pool.query('DELETE FROM "user" WHERE id = $1', [USER]);
  return shows.rowCount + events.rowCount + cache.rowCount + user.rowCount;
}

/** The JSON on the line after a heading in a prompt (the pack). */
const packIn = (prompt) => JSON.parse(prompt.split("\n")[prompt.split("\n").findIndex((l) => l.startsWith("THE PAGE THEY'RE ON")) + 1]);
/** The words a game prompt fences after a heading. */
const fenced = (prompt, heading) => (prompt.slice(prompt.indexOf(heading)).match(/"""\n([\s\S]*?)\n"""/) || [])[1] || "";

(async () => {
  const gone = await down();
  if (gone) console.log(`(removed ${gone} rows a run before left)`);
  const now = Date.now();
  const at = (ms) => new Date(now + ms).toISOString().replace(/\.\d{3}Z$/, "Z");
  const player = (id, name, position) => ({ id, name, position });
  const team = (id, name, short, location, abbreviation, roster) => ({ id, name, short, location, abbreviation, league: LEAGUE, roster });
  const sixers = team("9020", "ZT 76ers", "76ers", "ZT Philadelphia", "ZPH", [player("zt-sw-p1", "ZT Maxey", "Guard"), player("zt-sw-p2", "ZT Embiid", "Center")]);
  const cavs = team("9005", "ZT Cavaliers", "Cavaliers", "ZT Cleveland", "ZCL", [player("zt-sw-c1", "ZT Mitchell", "Guard"), player("zt-sw-c2", "ZT Mobley", "Forward")]);
  const knicks = team("9018", "ZT Knicks", "Knicks", "ZT New York", "ZNY", [player("zt-sw-k1", "ZT Brunson", "Guard")]);
  const espn = await fakeEspn.start({
    teams: [sixers, cavs, knicks],
    events: [
      { league: LEAGUE, id: "zt-sw-g1", at: at(DAY), home: "9020", away: "9005", state: "pre", odds: { details: "ZPH -2.5", overUnder: 237.5, spread: -2.5 } },
      { league: LEAGUE, id: "zt-sw-g2", at: at(3 * DAY), home: "9018", away: "9020", state: "pre" },
      { league: LEAGUE, id: "zt-sw-g3", at: at(4 * DAY), home: "9018", away: "9020", state: "pre" },
    ],
  });
  // The stand-in bot: a game's words drafted as a bot might, keyed on the words it's given.
  const bot = await fakeBot.start({
    answer: (prompt, kind) => {
      const said = fenced(prompt, "THEIR WORDS");
      if (kind === "gameChange") {
        const game = JSON.parse(prompt.split("\n")[prompt.split("\n").findIndex((l) => l.startsWith("THE GAME SO FAR")) + 1]);
        for (const q of game.ask || []) q.points = 2;
        return JSON.stringify({ draft: 1, game, said: [{ part: "ask", quote: "2 points each" }], assumed: [], ask: [], cantYet: [], summary: "" });
      }
      if (/76ers home opener/.test(said))
        return `Here's the game:\n${JSON.stringify({
          draft: 1,
          game: {
            span: { from: 1, to: 1 },
            get: { by: "none" },
            score: { by: "answers" },
            ask: [
              { id: "winner", ask: "Who wins?", answer: "side", points: 1, settle: { by: "final", take: "winner" } },
              { id: "top", ask: "Who scores the most points?", answer: "person", points: 1, settle: { by: "stat", stat: "points", take: "most" } },
              { id: "total", ask: "Total points: over or under?", answer: "overUnder", line: 237.5, points: 1, settle: { by: "final", take: "total" } },
            ],
          },
          said: [{ part: "ask", quote: "predict 3 things: winner, top scorer, and over/under total points" }, { part: "span", quote: "the 76ers home opener" }],
          assumed: [{ part: "ask", value: 1, why: "no points named: a point each" }],
          ask: [],
          cantYet: [],
          summary: "Three questions on the home opener.",
        })}`;
      if (/draft 2 players each/.test(said))
        return JSON.stringify({
          draft: 1,
          game: { get: { by: "draft", each: 2 }, count: { all: true }, score: { by: "stats", points: { points: 1, rebounds: 1, assists: 1 } } },
          said: [{ part: "get", quote: "draft 2 players each" }, { part: "score", quote: "points rebounds assists all count 1" }],
          assumed: [],
          ask: [],
          cantYet: [],
          summary: "",
        });
      return JSON.stringify({ draft: 1, game: null, cantYet: [{ what: said, why: "the stand-in has no game for it" }] });
    },
  });
  const providers = sportsProviders({ base: espn.url, prefix: "zt-sw:" });
  try {
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt") VALUES ($1, 'zt sports words', 'zt-sports-words@example.invalid', true, $1, $1, now(), now())`, [USER]);
    const user = { id: USER, name: "zt sports words", email: "zt-sports-words@example.invalid", role: "user" };
    const opts = { league: LEAGUE, team: "9020", providers, prefix: "zt-", now: new Date(now) };
    const opener = await makeMatchup({ ...opts, ask: { kind: "opener", home: true } });
    const series = await makeMatchup({ ...opts, ask: { kind: "series", against: "9018" } });
    for (const m of [opener, series]) await castFromEvents(m.seasonId, { providers, now: new Date(now) });
    check(opener?.games?.join() === "zt-sw-g1" && series?.games?.join() === "zt-sw-g2,zt-sw-g3", "the opener and the series made from the stand-in's schedule", JSON.stringify([opener, series]));

    // The 76ers sentence on the opener's page.
    const first = await gameWords(user, opener.seasonId, { words: words("w003") }, bot.url);
    const asked = bot.asked.filter((a) => a.kind === "gameWords");
    check(asked.length === 1 && asked[0].search === false && asked[0].priority === "now", "the bot is asked once, search off, ahead of its queue", JSON.stringify(asked.map((a) => a.kind)));
    const prompt = asked[0].prompt;
    const pack = packIn(prompt);
    check(pack.kind === "sport" && pack.sport?.league === LEAGUE && pack.sport.id === "basketball", "the pack is a sport's, its league ESPN's", JSON.stringify(pack.sport));
    check(JSON.stringify(pack.teams.map((t) => t.name).sort()) === '["ZT 76ers","ZT Cavaliers"]', "its teams: the game's two sides", JSON.stringify(pack.teams));
    const g = pack.games[0];
    check(pack.games.length === 1 && g.episode === 1 && g.started === false && g.line === 237.5 && g.sides.find((s) => s.home)?.name === "ZT 76ers" && !JSON.stringify(g).includes("score"), "its game: which side is home, still to play, ESPN's line, no score", JSON.stringify(pack.games));
    check(pack.cast.length === 4 && pack.cast.every((c) => c.in && c.group && c.role) && pack.cast.some((c) => c.name === "ZT Maxey" && c.group === "ZT 76ers"), "its players, each with their team and position", JSON.stringify(pack.cast));
    check(pack.stats.some((s) => s.key === "PTS" && s.says === "Points") && pack.standard?.games?.some((x) => x.id === "pickem"), "the stats a request can name, in their words, and the sport's standard games", JSON.stringify(pack.standard));
    check(pack.moments === undefined && pack.roles === undefined && pack.phases.length === 0, "no moments, roles or phases on a sport's page");
    check(/THIS PAGE IS A SPORT'S/.test(prompt) && /THE SPORT'S STANDARD GAMES/.test(prompt) && !/PRESETS \(/.test(prompt), "the manual's sports section and the sport's standard games, no show presets");
    const examples = prompt.split("EXAMPLES THAT PLAY ON THIS PAGE")[1] || "";
    check(/76ers|Knicks|Lakers|Red Sox/.test(examples) && !/Survivor|castaway/.test(examples.split("EXAMPLES IT CAN'T")[0]), "its examples are sports requests only");
    const r = first.result;
    check(r.state === "game" && same(r.spec, spec("w003")), "the 76ers sentence: the tracker's own game", JSON.stringify({ state: r.state, spec: r.spec, ask: r.ask, problems: r.problems }));
    check(r.assumed.some((a) => a.part === "ask[2].line" && a.value === "game") && r.assumed.some((a) => a.part === "ask[1].settle.stat" && a.value === "PTS"), "our check read ESPN's line as the game's own (never a number they said) and \"points\" as PTS", JSON.stringify(r.assumed));
    check(/the game's line/.test(r.describe?.sentence || ""), "said in the engine's words", r.describe?.sentence);
    const { rows } = await pool.query("SELECT words, result IS NOT NULL AS kept, error FROM game_word_asks WHERE id = $1", [first.id]);
    check(rows[0]?.kept && !rows[0].error, "the ask is kept with its result");

    // A typed change.
    const changed = await gameWords(user, opener.seasonId, { change: { from: first.id, words: "2 points each instead" } }, bot.url);
    check(changed.result.state === "game" && changed.result.spec.ask.every((q) => q.points === 2) && changed.result.spec.ask[2].line === "game", "a typed change: the changed game, the game's own line kept", JSON.stringify(changed.result.spec));

    // The Lakers request (w052) on the series' page: its stat words read as keys.
    const draft = await gameWords(user, series.seasonId, { words: words("w052") }, bot.url);
    const p2 = packIn(bot.asked[bot.asked.length - 1].prompt);
    check(p2.games.length === 2 && p2.games.every((x) => x.line === undefined) && JSON.stringify(p2.teams.map((t) => t.name).sort()) === '["ZT 76ers","ZT Knicks"]', "the series' pack: its two games, no line yet, its two teams", JSON.stringify(p2.games));
    check(draft.result.state === "game" && same(draft.result.spec, spec("w052")), "the Lakers request: the tracker's own game, its words read as PTS, REB and AST", JSON.stringify({ spec: draft.result.spec, ask: draft.result.ask }));
  } finally {
    await bot.close();
    await espn.close();
    if (!keep) await down();
    await pool.end();
  }
  console.log(failures ? `\n${failures} FAILED` : "\nall passed");
  process.exit(failures ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
