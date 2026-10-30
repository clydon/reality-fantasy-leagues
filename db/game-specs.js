// The game-specs flag (app_settings 'game-specs', true or false; docs/PLAN-start-a-game-gpt.md step A2). On, every league
// carries the game it plays as data, settings.game (its game spec: src/lib/game/game-spec/), which the engine plays from
// ahead of its fields (state-logic.js gameOf); off (the default), it carries none and the engine reads its fields. Either
// way the engine reads the same game: every write keeps the fields and a carried spec in step (RosterLogic.setGame), and
// scripts/game-specs-flag.js's check proves every league scores the same with it on before it's turned on. Later steps
// (A3's later starts, A4's questions) put things in the spec its fields can't say, which is why it's carried at all.
//
// Turned on or off for every league by scripts/game-specs-flag.js (each under its own row lock); a league made while it's
// on carries its spec from the start (makeLeague, classic's settings route). Plain CommonJS (bare-node scripts and the
// Next routes both use it). `db` is a pool or a client.
const { specOf, sameValue } = require("../src/lib/game/game-spec/index.js");

const FLAG = "game-specs";

/** Whether the flag is on. Read every time (one small row), so a flip is seen at once everywhere. */
async function gameSpecsOn(db) {
  const { rows } = await db.query("SELECT value FROM app_settings WHERE key=$1", [FLAG]);
  return rows.length > 0 && rows[0].value === true;
}

async function setGameSpecsOn(db, on) {
  await db.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()`,
    [FLAG, JSON.stringify(!!on)]
  );
}

/**
 * Settings carrying the spec their fields play (`on`), or none (off). True when that changed them. A carried spec that
 * has drifted from its fields (written some way that skipped setGame) is put back to what the fields play.
 */
function carryGame(settings, on) {
  if (!settings || typeof settings !== "object") return false;
  if (!on) {
    if (!("game" in settings)) return false;
    delete settings.game;
    return true;
  }
  const g = specOf(settings);
  if (sameValue(settings.game, g)) return false;
  settings.game = g;
  return true;
}

/** A league's settings brought into step with the flag, inside its write (makeLeague, classic's settings route). */
async function syncLeagueGame(db, settings) {
  return carryGame(settings, await gameSpecsOn(db));
}

/** One league brought into step with `on`, under its row lock, written only when it changed. -> { saved } or null. */
async function syncLeagueRow(pool, leagueId, on) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT state FROM leagues WHERE id=$1 FOR UPDATE", [leagueId]);
    if (!rows.length) {
      await client.query("ROLLBACK");
      return null;
    }
    const state = rows[0].state;
    const saved = carryGame(state.settings, on);
    if (saved) await client.query("UPDATE leagues SET state=$1 WHERE id=$2", [JSON.stringify(state), leagueId]);
    await client.query("COMMIT");
    return { saved };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { FLAG, gameSpecsOn, setGameSpecsOn, carryGame, syncLeagueGame, syncLeagueRow };
