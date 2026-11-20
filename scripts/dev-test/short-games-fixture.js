// Dev-only: Round 3's busy season (docs/PLAN-start-a-game-redo.md, "Round 3: a show's games when short games are frequent", and E2,
// "Short games at scale"): new-fixture.js's couch (alex, riley, jordan, sam) on a longer ZT Survivor 51, 20 episodes with results in
// through Episode 19 and Episode 20 three days out, and `each` one-episode games before every episode (default three: a Prediction
// sheet, the pot and "most of us" in turn), about 60 games, all but the last episode's over. Each person's answers for each game are
// in, as the app stores them (game_answers): a mix of right and wrong, the same every time. Everyone has seen every episode but sam,
// two behind (a person behind: spoiler-safe reads). new-fixture's three linked leagues stay on the couch beside them. With `open`
// (Round 3's story), the next episode's games are still open for alex and sam: riley and jordan have answered, they haven't. With
// `bots` (Round 3's couch of one against computer players), each short game is alex's alone against that many computer players
// (Ada, Max, ...; normal), who answer as the rest do. With `next: false` (B3's Again), the next episode has no games yet: the
// last episode's are the newest, with nothing on after them.
//
//   node scripts/dev-test/short-games-fixture.js up [--episodes=20] [--through=19] [--each=3] [--open] [--bots=2] [--no-next]
//   node scripts/dev-test/short-games-fixture.js down
//
// Also a module: `up(pool, { episodes, through, each, open })` resolves new-fixture's up() result with `games`: [{ leagueId, episode, kind }];
// `down(pool)` is new-fixture's (every league here is slugged zt-nd-short-..., so it goes with the rest). Refuses a non-local
// database. Shares new-fixture's zt_nd_ couch: never run beside another check on it.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const { buildDemoState } = jiti("../../src/lib/game/demo-season-builder.ts");
const Bots = jiti("../../src/lib/game/computer-players.ts");
const S = require("../../src/lib/game/state-logic.js");
const C = require("../../src/lib/game/start-gallery/index.js");
const B = require("../../tests/fixtures/game-words/bank.js");
const fixture = require("./new-fixture");

const DB = process.env.AUTH_DATABASE_URL || "";
/** The short games, in turn before each episode: gallery bases with no draft, each settled by the results or the players. */
const KINDS = ["sheet", "pot", "majority"];
const SEATS = ["alex", "riley", "jordan", "sam"];
const CTX = B.ctxOf({ show: "Survivor", season: 51, rulebook: "survivor" });
/** The same number in [0, 1) for the same words. */
const feel = (s) => crypto.createHash("sha256").update(s).digest().readUInt32BE(0) / 2 ** 32;
const code = () => Array.from(crypto.randomBytes(6), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");

async function up(pool, { episodes = 20, through = 19, each = 3, open = false, bots = 0, next = true } = {}) {
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("short-games-fixture runs against a local database only");
  const fx = await fixture.up(pool, { episodes, through });
  const { data, seen, SHOW } = fixture.shape();
  const users = fx.users;
  const games = [];
  for (let n = 1; n <= Math.min(episodes, through + (next ? 1 : 0)); n++) {
    for (let k = 0; k < each; k++) {
      const kind = KINDS[(n + k) % KINDS.length];
      const seats = bots ? ["alex"] : SEATS;
      const state = JSON.parse(JSON.stringify(buildDemoState({ ...data, players: seats.map((key) => ({ key, name: key, color: "#888" })) }, "pickem", through)));
      S.migrateLeagueState(state);
      state.settings.showId = SHOW;
      state.settings.wikiSeason = 51;
      const problems = S.setGame(state, { ...C.baseById(kind).spec, span: { from: n, to: n } }, { ctx: CTX });
      if (problems.length) throw new Error(`${kind} on Episode ${n}: ${JSON.stringify(problems)}`);
      for (let b = 0; b < bots; b++) Bots.addBot(state, "normal");
      const name = `${C.baseById(kind).name} · Episode ${n}`;
      const { rows } = await pool.query(
        `INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, now() - make_interval(days => $7::int)) RETURNING id`,
        [name, `zt-nd-short-${n}-${k}`, code(), JSON.stringify(state), users.alex, fx.couchId, 7 * (through + 1 - n) + 1]
      );
      const leagueId = rows[0].id;
      for (const [j, who] of seats.entries()) {
        await pool.query(`INSERT INTO league_memberships (league_id, user_id, player_id, role, results_seen_through) VALUES ($1, $2, $3, $4, $5)`, [
          leagueId, users[who], state.players[j].id, who === "alex" ? "commissioner" : "member", seen[who],
        ]);
      }
      // Each person's answers for the episode, as the app stores them: who goes home among who was still in going into it (the one
      // who did, now and then), an idol found or not.
      const stillIn = data.castaways.filter((c) => c.exitEpisode >= n).map((c) => state.castaways.find((x) => x.name === c.name)).filter(Boolean);
      const out = data.castaways.find((c) => c.exitEpisode === n);
      for (const [j, p] of state.players.entries()) {
        const who = seats[j] ?? p.name;
        if (open && n === through + 1 && (who === "alex" || who === "sam")) continue;
        const pid = p.id;
        for (const q of S.AnswerLogic.questions(state)) {
          const r = feel(`${leagueId}|${who}|${q.id}`);
          let answer;
          if (q.answer === "person") {
            const right = out && q.settle && q.settle.take === "out" ? state.castaways.find((x) => x.name === out.name) : null;
            answer = right && r < 0.3 ? right.id : stillIn[Math.floor(r * stillIn.length)].id;
          } else if (q.answer === "yesNo") answer = r < 0.5 ? "yes" : "no";
          else continue;
          await pool.query(
            `INSERT INTO game_answers (league_id, player_id, question, episode, answer, answered_by, late, changes) VALUES ($1, $2, $3, $4, $5::jsonb, NULL, 0, 0)`,
            [leagueId, pid, q.id, n, JSON.stringify(answer)]
          );
        }
      }
      games.push({ leagueId, episode: n, kind });
    }
  }
  return { ...fx, games };
}

module.exports = { up, down: fixture.down, KINDS };

if (require.main === module) {
  const pool = new Pool({ connectionString: DB });
  const arg = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d);
  const cmd = process.argv[2];
  (cmd === "down" ? fixture.down(pool).then(() => console.log("[zt] short games down")) : up(pool, { episodes: arg("episodes", 20), through: arg("through", 19), each: arg("each", 3), open: process.argv.includes("--open"), bots: arg("bots", 0), next: !process.argv.includes("--no-next") }).then((fx) => console.log(`[zt] short games up: ${fx.games.length} one-episode games on ZT Survivor 51 (${fx.seasonId}); sign in as zt_nd_alex / ${fixture.PASSWORD}`)))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
