// Dev-only check: computer players play a game from Start a game to its end (docs/PLAN-start-a-game-redo.md E1b), through the real
// routes on new-fixture.js's couch (ZT Survivor 51, results through Episode 5). For each gallery base named, alex starts it with
// computer players (POST /start: the catalog's own spec on the season's page), then reveals each episode to the game's last; the
// check reads game_answers and the season's games read.
//   - every computer player answers every question the game asks each week it plays (a card's lines and a ticket too), through
//     the game's last episode and none after it;
//   - staked answers are whole numbers of points, and in a game with a bank (C6) a computer player's stakes in any one week add up to
//     no more than the bank's start (the room itself, its points as they stand, is the unit tests': tests/bots-answer.test.js);
//   - the games read lists them as computer players with a total, and the game is over once alex has revealed its last;
//   - Beat the bot: our bot's call each week is written as the stand-in's (bot_calls made_by 'stand-in': the lane's AI keys are
//     blank), someone still in going into it, so the game grades.
// Needs: the dev server (npm run dev, or node scripts/lane.js dev) and its local database (AUTH_DATABASE_URL in .env.local). Every
// row it makes is the zt_nd_ fixture's, taken down at the end (--keep leaves it).
//   node scripts/dev-test/check-bots-play-through.js [--bases=sheet,props,beatbot,bank] [--pace=own|live] [--from=1] [--to=4]
//     [--bots=2] [--level=easy|normal|sharp] [--keep]
// --pace=own (the default) plays each week as alex reveals it; --pace=live starts from the fixture's next episode, so only its
// start is checked (nothing has aired to reveal).
process.chdir(require("path").join(__dirname, "..", ".."));
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const fixture = require("./new-fixture.js");
const { api } = require("./browser.js");
const C = require("../../src/lib/game/start-gallery/index.js");

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d;
const BASES = arg("bases", "sheet,props,beatbot,bank").split(",");
const PACE = arg("pace", "own");
const FROM = Number(arg("from", "1"));
const TO = Number(arg("to", "4"));
const BOTS = Number(arg("bots", "2"));
const LEVEL = arg("level", "normal");
const KEEP = process.argv.includes("--keep");

let failed = 0;
const check = (ok, what, more) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) {
    failed++;
    if (more) console.log(`      ${more}`);
  }
};

(async () => {
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(process.env.AUTH_DATABASE_URL || "")) throw new Error("runs against a local database only");
  const fx = await fixture.up(pool);
  try {
    const alex = await api({ user: fixture.username("alex"), pass: fixture.PASSWORD });
    const url = `/api/seasons/${fx.seasonId}/start?couch=${fx.couchId}`;
    const o = (await alex.call("GET", `${url}&wizard=1`)).body;
    const pg = C.pageFacts(o.wizard.page, { show: o.label });
    const from = PACE === "own" ? FROM : o.from;
    const to = PACE === "own" ? TO : null;
    for (const id of BASES) {
      const base = C.baseById(id);
      if (!base) {
        check(false, `${id}: a gallery base`);
        continue;
      }
      const span = { from, to };
      const spec = { ...C.baseSpec(base, span, pg), span };
      const fit = C.botsFit(spec);
      // A base whose own rules don't play this span (a jury's split runs to the season's end): said, not failed.
      const own = C.check(spec, pg);
      if (!own.ok) {
        console.log(`SKIP  ${id}: doesn't play Episodes ${from}-${to ?? "the end"} (${(own.problems || []).map((p) => (Array.isArray(p) ? p[1] : p)).join("; ")})`);
        continue;
      }
      const made = await alex.call("POST", url, { spec, name: `${base.name || id} with computer players`, tell: false, pace: PACE, bots: BOTS, level: LEVEL });
      check(made.status === 200 && !fit, `${id}: started at ${PACE === "own" ? "your own" : "a live"} pace with ${BOTS} computer players`, fit || (made.body && made.body.error));
      if (made.status !== 200) continue;
      const leagueId = made.body.leagueId;
      const { rows: st } = await pool.query("SELECT state FROM leagues WHERE id = $1", [leagueId]);
      const state = st[0].state;
      const bots = state.players.filter((p) => p.automated).map((p) => p.id);
      // Our bot's call each week (Beat the bot), as the stand-in.
      const beats = (spec.ask || []).filter((q) => q && q.beat);
      if (beats.length) {
        const outAt = new Map(state.episodes.map((e) => [e.id, e.number]));
        for (let n = from; n <= (to ?? from); n++) {
          const still = state.castaways.filter((c) => c.status !== "eliminated" || (outAt.get(c.exitEpisodeId) || Infinity) >= n);
          for (const q of beats) await pool.query("INSERT INTO bot_calls (league_id, question, episode, answer, made_by) VALUES ($1, $2, $3, $4::jsonb, 'stand-in') ON CONFLICT DO NOTHING", [leagueId, q.id, n, JSON.stringify(still[n % still.length].id)]);
        }
      }
      const answers = async () => (await pool.query("SELECT player_id, question, episode, answer FROM game_answers WHERE league_id = $1", [leagueId])).rows;
      const weekOf = (rows, n) => rows.filter((r) => r.episode === n && bots.includes(r.player_id));
      // What each week asks: its questions asked each episode (a card's lines one each), and the ticket; and what's asked once (its
      // answers at episode 0).
      const start = await answers();
      const each = start.filter((r) => r.episode === from && bots.includes(r.player_id)).map((r) => r.question);
      const once = start.filter((r) => r.episode === 0 && bots.includes(r.player_id)).map((r) => r.question);
      const perWeek = new Set(each).size;
      const perGame = new Set(once).size;
      check(perWeek + perGame > 0 && each.length === perWeek * bots.length && once.length === perGame * bots.length, `${id}: at the start, each computer player's answers (${perWeek} for Episode ${from}, ${perGame} for the game)`, JSON.stringify([...each, ...once]));
      if (PACE === "own") {
        for (let n = from; n <= to; n++) {
          const r = await alex.call("POST", `/api/seasons/${fx.seasonId}/catchup`, { leagueId, couch: fx.couchId });
          if (r.status !== 200) {
            check(false, `${id}: alex reveals Episode ${n}`, `${r.status} ${r.body && r.body.error}`);
            break;
          }
        }
        const rows = await answers();
        const weeks = [];
        for (let n = from; n <= to; n++) weeks.push(weekOf(rows, n).length);
        if (perWeek) check(weeks.every((k) => k === perWeek * bots.length) && weekOf(rows, to + 1).length === 0, `${id}: every week through Episode ${to}, each computer player answers all ${perWeek}; none after (${weeks.join(", ")})`);
        if (perGame) check(weekOf(rows, 0).length === perGame * bots.length, `${id}: what's asked once, answered once each (${weekOf(rows, 0).length})`);
        const staked = rows.filter((r) => bots.includes(r.player_id) && r.answer && typeof r.answer === "object" && "stake" in r.answer);
        const stakes = staked.map((r) => r.answer.stake);
        if (stakes.length) check(stakes.every((n) => Number.isInteger(n) && n >= 0), `${id}: ${stakes.length} stakes, each a whole number of points`);
        const bank = spec.score && spec.score.bank && spec.score.bank.start;
        if (stakes.length && bank) {
          const weekly = new Map();
          for (const r of staked) weekly.set(`${r.player_id}|${r.episode}`, (weekly.get(`${r.player_id}|${r.episode}`) || 0) + r.answer.stake);
          check([...weekly.values()].every((n) => n <= bank), `${id}: each computer player's stakes in a week within the bank's ${bank} (most ${Math.max(...weekly.values())})`);
        }
      }
      const read = (await alex.call("GET", `/api/seasons/${fx.seasonId}/games?couch=${fx.couchId}`)).body;
      const game = (read.games || []).find((g) => g.leagueId === leagueId);
      const table = (game && game.table) || [];
      const theirs = table.filter((r) => r.bot);
      check(theirs.length === bots.length && theirs.every((r) => Number.isFinite(Number(r.total))), `${id}: the games read lists ${bots.length} computer players with their totals (${table.map((r) => `${r.name}${r.bot ? " (bot)" : ""} ${r.total}`).join(", ")})`);
      if (PACE === "own") check(!!(game && (game.over || game.ended)), `${id}: over once alex has revealed Episode ${to}`);
    }
  } finally {
    if (!KEEP) await fixture.down(pool);
    await pool.end();
  }
  console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
