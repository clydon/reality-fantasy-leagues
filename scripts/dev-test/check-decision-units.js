// Dev-only check (docs/PLAN-new-design.md step R2): a count research reports rides on its staged result into the
// league, through the real SQL rather than a fake client (tests/episode-research-apply.test.js covers the logic).
// A throwaway season (Survivor season 993, "zt-units", admin-decided) and a league playing the World Series
// rulebook from the library (settings.rulebook, the way step R3 will write it). Research says Ann Example hit 3 home
// runs and pitched 6.67 innings; re-researched while pending, 4 home runs; the admin accepts; the league's events
// carry 4 and 6.67 and score 5 a home run times 4; a re-read after the accept can't move a decided count.
//
//   node scripts/dev-test/check-decision-units.js run     up, the checks, down; prints PASS/FAIL per check
//   node scripts/dev-test/check-decision-units.js up      just the season and league, to look at by hand
//   node scripts/dev-test/check-decision-units.js down
//
// Needs the local database (Docker survivor-draft-pg) with migration 0106 applied (npm run migrate); no dev server.
// Every row is keyed on season 993 "zt-units" and the league slug zt-units-league. Refuses a non-local database.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { Pool } = require("pg");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(__dirname, "..", "..", "src") } });
const S = require("../../src/lib/game/state-logic.js");
const { compileRulebook } = require("../../src/lib/game/formats/rulebook-compile.js");
const { formatForRulebook } = require("../../src/lib/game/formats/index.js");
const { LIBRARY } = require("../../src/lib/game/formats/library/index.js");
const ER = require("../../db/episode-research.js");
const { syncLeagueDecisions } = jiti("../../src/lib/server/season-decisions.ts");

const SEASON = 993;
const SEASON_NAME = "zt-units";
const SLUG = "zt-units-league";
const CAST = ["Ann Example", "Bo Example", "Cy Example"];
const { data } = compileRulebook(LIBRARY["world-series"].blocks, { id: "world-series" });

async function showId(pool) {
  const { rows } = await pool.query(`SELECT id FROM shows WHERE slug='survivor'`);
  return rows[0].id;
}

async function down(pool) {
  await pool.query(`DELETE FROM leagues WHERE slug=$1`, [SLUG]); // its applied-decision ledger cascades
  await pool.query(`DELETE FROM episode_research WHERE show_id=$1 AND season_number=$2`, [await showId(pool), SEASON]);
  await pool.query(`DELETE FROM show_seasons WHERE season_number=$1 AND name=$2`, [SEASON, SEASON_NAME]); // cast and decisions cascade
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
  state.settings.rulebook = { data, reader: "research" };
  S.applyCastImport(state, { castaways: CAST.map((name) => ({ name })) });
  await pool.query(`INSERT INTO leagues (name, slug, join_code, state) VALUES ('Units check', $1, 'ZTUNIT', $2)`, [SLUG, JSON.stringify(state)]);
  return { seasonId: rows[0].id, show };
}

// One research run for episode 1, stored and staged the way the app stages a paste.
async function research(pool, { seasonId, show }, homeRuns) {
  const person = (name, answers) => ({ name, leftTheGame: "no", exitMethod: null, sources: ["https://example.invalid"], confidence: "high", ...answers });
  const payload = { castaways: [person("Ann Example", { homeRun: homeRuns, inningsPitched: 6.67 }), person("Bo Example", { homeRun: 0 }), person("Cy Example", {})] };
  const { rows } = await pool.query(
    `INSERT INTO episode_research (show_id, season_number, episode_number, payload, provenance) VALUES ($1,$2,1,$3,'{}')
     ON CONFLICT (show_id, season_number, episode_number) WHERE source = 'combined' DO UPDATE SET payload=EXCLUDED.payload RETURNING id`,
    [show, SEASON, JSON.stringify(payload)]
  );
  return ER.stageResearchDecisions(pool, { id: rows[0].id, seasonId, episodeNumber: 1, payload, format: formatForRulebook(data) });
}

const units = async (pool, seasonId) => {
  const { rows } = await pool.query(`SELECT event_type, units, status FROM season_decisions WHERE season_id=$1 AND event_type IN ('homeRun','inningsPitched') ORDER BY event_type`, [seasonId]);
  return rows.map((r) => `${r.event_type} ${r.units} ${r.status}`).join(", ");
};

async function syncLeague(pool) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT id, state FROM leagues WHERE slug=$1`, [SLUG]);
    const state = rows[0].state;
    await syncLeagueDecisions(client, rows[0].id, state);
    return state;
  } finally {
    client.release();
  }
}

async function run(pool) {
  let failed = 0;
  const check = (label, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : `: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
  };
  const season = await up(pool);
  try {
    await research(pool, season, 3);
    check("staged with its count", await units(pool, season.seasonId), "homeRun 3 pending, inningsPitched 6.67 pending");
    await research(pool, season, 4);
    check("a re-read moves a pending count", await units(pool, season.seasonId), "homeRun 4 pending, inningsPitched 6.67 pending");
    await pool.query(`UPDATE season_decisions SET status='accepted', decided_at=now() WHERE season_id=$1`, [season.seasonId]);
    const state = await syncLeague(pool);
    const ep = state.episodes.find((e) => e.number === 1);
    const ann = state.castaways.find((c) => c.name === "Ann Example");
    const ev = (type) => ep.scoringEvents.find((e) => e.type === type && e.castawayId === ann.id);
    check("the league's events carry the counts", [ev("homeRun").units, ev("inningsPitched").units], [4, 6.67]);
    check("and score them", [S.ActiveRosterLogic.eventPoints(state, ev("homeRun")), S.ActiveRosterLogic.eventPoints(state, ev("inningsPitched"))], [20, 6.67]);
    check("nothing for a count of 0", ep.scoringEvents.filter((e) => e.type === "homeRun").length, 1);
    await research(pool, season, 5);
    check("a re-read can't move a decided count", await units(pool, season.seasonId), "homeRun 4 accepted, inningsPitched 6.67 accepted");
  } finally {
    await down(pool);
  }
  console.log(failed ? `${failed} failed` : "all passed");
  if (failed) process.exitCode = 1;
}

if (require.main === module) {
  const url = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url)) throw new Error("check-decision-units runs against a local database only");
  const pool = new Pool({ connectionString: url });
  const cmd = process.argv[2];
  const go = { run, up: (p) => up(p).then(() => console.log("[zt] up: season 993 zt-units, league zt-units-league")), down: (p) => down(p).then(() => console.log("[zt] down")) }[cmd];
  (go ? go(pool) : Promise.reject(new Error("usage: run | up | down")))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => pool.end());
}

module.exports = { up, down, run };
