// Dev-only check (BACKLOG 87): the AI settles side bets with an episode's final results, through the real SQL and the real season
// sync (src/lib/server/season-decisions.ts syncLeagueDecisions -> bet-settle.ts), not a fake client (tests/bet-settle.test.js
// covers the engine's rule). A throwaway season (Survivor season 994, "zt-bets") and a league with three bets on Episode 1:
//   a sure answer           -> settled by the AI, the right call pays
//   a low-confidence answer -> left open, the AI's answer recorded for whoever runs the game
//   no answer for it        -> left open, nothing recorded
// First only who went home is in (early results): nothing is settled. Then a full answer makes them final and the sync settles.
// Then the commissioner changes the AI's call (as the PATCH route does: a mark with their seat) and the next sync leaves it alone.
//
//   node scripts/dev-test/check-bet-settle.js run     up, the checks, down; prints PASS/FAIL per check
//   node scripts/dev-test/check-bet-settle.js up      just the season and league, to look at by hand
//   node scripts/dev-test/check-bet-settle.js down
//
// Needs the local database (Docker survivor-draft-pg, npm run migrate); no dev server. Every row is keyed on season 994
// "zt-bets" and the league slug zt-bets-league. Refuses a non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const S = require("../../src/lib/game/state-logic.js");
const { syncLeagueDecisions } = jiti("../../src/lib/server/season-decisions.ts");

const SEASON = 994;
const SEASON_NAME = "zt-bets";
const SLUG = "zt-bets-league";
const CAST = ["Ann Example", "Bo Example", "Cy Example", "Di Example"];
const BETS = [
  { label: "Will anyone play an idol?", guesses: ["Yes", "No"] },
  { label: "Who wins immunity?", guesses: ["Ann Example", "Bo Example"] },
  { label: "Will it rain?", guesses: ["Yes", "No"] },
];

async function showId(pool) {
  const { rows } = await pool.query(`SELECT id FROM shows WHERE slug='survivor'`);
  return rows[0].id;
}

async function down(pool) {
  await pool.query(`DELETE FROM leagues WHERE slug=$1`, [SLUG]);
  await pool.query(`DELETE FROM episode_research WHERE show_id=$1 AND season_number=$2`, [await showId(pool), SEASON]);
  await pool.query(`DELETE FROM show_seasons WHERE season_number=$1 AND name=$2`, [SEASON, SEASON_NAME]);
}

async function up(pool) {
  await down(pool);
  const show = await showId(pool);
  const { rows } = await pool.query(
    `INSERT INTO show_seasons (show_id, season_number, name, status, episode_count, results_by, cast_size) VALUES ($1,$2,$3,'airing',7,'admin',$4) RETURNING id`,
    [show, SEASON, SEASON_NAME, CAST.length]
  );
  for (const [i, name] of CAST.entries()) await pool.query(`INSERT INTO season_cast (season_id, name, sort_order) VALUES ($1,$2,$3)`, [rows[0].id, name, i]);
  const state = S.defaultState();
  state.settings.showId = "survivor";
  state.settings.wikiSeason = SEASON;
  S.applyCastImport(state, { castaways: CAST.map((name) => ({ name })) });
  for (const name of ["zt Ann", "zt Bo", "zt Cy"]) S.addPlayer(state, name);
  S.updateSettings(state, "bonusEnabled", true);
  const ep = S.ensureEpisodeNumber(state, 1, false);
  ep.bets = BETS.map((b, i) => ({
    id: `bet_zt${i}`,
    label: b.label,
    points: 2,
    createdByPlayerId: null,
    predictions: b.guesses.map((guess, j) => ({ id: `pred_zt${i}${j}`, playerId: state.players[j].id, guess, correct: null })),
  }));
  await pool.query(`INSERT INTO leagues (name, slug, join_code, state) VALUES ('Bets check', $1, 'ZTBETS', $2)`, [SLUG, JSON.stringify(state)]);
  return { seasonId: rows[0].id, show };
}

/** Who went home in Episode 1, accepted (early results), and the research's answers to two of the bets. */
async function early(pool, { seasonId, show }) {
  await pool.query(
    `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, method, status, from_research, decided_at, post_merge)
     VALUES ($1, 1, 'elimination', 'Di Example', 'Voted Out', 'accepted', true, now(), false)`,
    [seasonId]
  );
  const answer = (label, guesses, a, right, confidence) => ({ question: label, guesses, answer: a, correctGuesses: right, evidence: `zt: ${a}`, sources: [], confidence });
  const payload = {
    castaways: [],
    betAnswers: [answer(BETS[0].label, BETS[0].guesses, "Yes", ["Yes"], "high"), answer(BETS[1].label, BETS[1].guesses, "Bo Example", ["Bo Example"], "low")],
  };
  await pool.query(`INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance) VALUES ($1,$2,1,$3,'{}')`, [show, SEASON, JSON.stringify(payload)]);
}

/** Someone sends the full results: a scoring moment, and a full answer (the episode is final: season-decisions.ts fullAnswers). */
async function full(pool, { seasonId, show }) {
  await pool.query(
    `INSERT INTO season_decisions (season_id, episode_number, kind, castaway_name, event_type, status, from_research, decided_at, post_merge)
     VALUES ($1, 1, 'event', 'Bo Example', 'individualImmunity', 'accepted', true, now(), false)`,
    [seasonId]
  );
  await pool.query(
    `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance, source, covers) VALUES ($1,$2,1,'{}','{}','paste',$3)`,
    [show, SEASON, JSON.stringify({ people: CAST, kinds: null })]
  );
}

async function syncLeague(pool, edit) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT id, state FROM leagues WHERE slug=$1 FOR UPDATE`, [SLUG]);
    const state = rows[0].state;
    if (edit) edit(state);
    await syncLeagueDecisions(client, rows[0].id, state);
    await client.query(`UPDATE leagues SET state=$2 WHERE id=$1`, [rows[0].id, JSON.stringify(state)]);
    await client.query("COMMIT");
    return state;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

const marks = (state) => state.episodes.find((e) => e.number === 1).bets.map((b) => b.predictions.map((p) => p.correct));

async function run(pool) {
  let failed = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : `: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  };
  const season = await up(pool);
  try {
    await early(pool, season);
    let state = await syncLeague(pool);
    const ep = (s) => s.episodes.find((e) => e.number === 1);
    check("early results: who went home is in", S.resultsStage(ep(state)), "early");
    check("early results: no bet is settled", marks(state), [[null, null], [null, null], [null, null]]);

    await full(pool, season);
    state = await syncLeague(pool);
    check("final results", S.resultsStage(ep(state)), "final");
    check("the sure answer settles its bet; the others stay open", marks(state), [[true, false], [null, null], [null, null]]);
    const [idol, immunity, rain] = ep(state).bets;
    check("settled by the AI", [S.betDecision(idol), idol.ai.answer], [{ by: "ai", who: null }, "Yes"]);
    check("the unsure answer is recorded for whoever runs the game", [immunity.ai.answer, immunity.ai.settled, immunity.settledBy ?? null], ["Bo Example", false, null]);
    check("a bet the research wasn't asked stays as it was", rain.ai ?? null, null);
    // Each seat's bonus, in seat order (computeScores ranks them).
    const bonus = (s) => s.players.map((p) => S.computeScores(s).find((r) => r.playerId === p.id).bonus);
    check("the right call pays", bonus(state), [2, 0, 0]);

    // The commissioner (zt Cy's seat) says the AI got the idol wrong.
    const cy = state.players[2].id;
    state = await syncLeague(pool, (s) => {
      S.setBetPredictionCorrect(s, ep(s).id, "bet_zt0", "pred_zt00", false, cy);
      S.setBetPredictionCorrect(s, ep(s).id, "bet_zt0", "pred_zt01", true, cy);
    });
    check("their change stands through the next sync", marks(state)[0], [false, true]);
    check("and the page can say who changed it", S.betDecision(ep(state).bets[0]), { by: "changed", who: cy });
    check("the points follow", bonus(state), [0, 2, 0]);
  } finally {
    await down(pool);
  }
  console.log(failed ? `${failed} failed` : "all passed");
  if (failed) process.exitCode = 1;
}

if (require.main === module) {
  const url = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)) throw new Error("check-bet-settle runs against a local database only");
  const pool = new Pool({ connectionString: url });
  const cmd = process.argv[2];
  const go = { run, up: (p) => up(p).then(() => console.log("[zt] up: season 994 zt-bets, league zt-bets-league")), down: (p) => down(p).then(() => console.log("[zt] down")) }[cmd];
  (go ? go(pool) : Promise.reject(new Error("usage: run | up | down")))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { up, down, run };
