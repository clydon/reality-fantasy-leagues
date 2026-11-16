// Dev-only: drive the catch-up (docs/PLAN-cast-properties.md chunk 6c, src/lib/server/catch-up.ts) on the lane's local database,
// through the desk's own route as zt_rs_desk (made by cast-props-research.js up, here too), with our bot answering. The dev
// server must run without the site's paid keys (ANTHROPIC_API_KEY= and OPENAI_API_KEY= blank); the catch-up asks our bot only.
//
//   node scripts/dev-test/catch-up.js status [<seasonId>]          every queued season (or one): its step, episode, line, holds
//   node scripts/dev-test/catch-up.js step <seasonId> [--steps=N]   its next step now (N in a row; each asks our bot), printing
//                                                                     where it is and what waits after each
//   node scripts/dev-test/catch-up.js start <seasonId>              queue it (or Try again after it stopped)
//   node scripts/dev-test/catch-up.js decide <holdId> sent|left     the desk's Send it / Leave it out for a held episode
//   node scripts/dev-test/catch-up.js rewind <seasonId> [--to=show|cast|episodes] [--episode=N]
//                                                                     put a season's catch-up back to a step (a rehearsal again)
//
// Prints show, season and game names and players' first names from the local copy only: the repo is public, so never paste
// its output from a production backup into a commit. Refuses a non-local database. The only account is zt_rs_desk.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");
const { api, BASE } = require("./browser");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("catch-up.js runs against a local database only");
const USER = "zt_rs_desk";
const PASSWORD = "zt-pass-12345";
const args = process.argv.slice(2);
const [cmd, target, third] = args;
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || null;
const stamp = () => new Date().toISOString().slice(11, 19);

const ROWS = `SELECT c.*, s.slug, ss.season_number FROM season_catchups c JOIN show_seasons ss ON ss.id = c.season_id JOIN shows s ON s.id = ss.show_id`;

function printHolds(holds) {
  for (const h of holds) {
    console.log(`    held: Episode ${h.episode} (${h.id})`);
    for (const g of h.games) {
      const moves = g.players.map((p) => `${String(p.name).split(" ")[0]} ${p.before} -> ${p.after}`).join(", ");
      console.log(`      ${g.name}${g.outside ? " (scored outside its state)" : ""}: ${moves || `episodes ${g.episodes.join(", ")} change`}`);
    }
  }
}

async function status(pool, as, id) {
  const { rows } = await pool.query(`${ROWS}${id ? " WHERE c.season_id = $1" : ""} ORDER BY s.slug, ss.season_number`, id ? [id] : []);
  for (const r of rows) {
    const page = (await as.call("GET", `/api/desk/seasons/${r.season_id}/catchup`)).body;
    console.log(`${r.slug} ${r.season_number} (${r.season_id}): ${page.status ? page.status.line : "none"}${r.message ? ` · last: ${r.message}` : ""}`);
    printHolds(page.holds || []);
  }
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    if (cmd === "rewind") {
      const to = opt("to") || "show";
      await pool.query(
        "UPDATE season_catchups SET step = $2, episode = $3, done_at = NULL, stuck_at = NULL, tries = 0, message = NULL, asking_at = NULL, tried_at = NULL WHERE season_id = $1",
        [target, to, Number(opt("episode") || 1)]
      );
      return console.log(`[catch-up] ${target} back to ${to}`);
    }
    const as = await api({ user: USER, pass: PASSWORD });
    console.log(`against ${BASE}`);
    if (cmd === "status") return await status(pool, as, target);
    if (cmd === "start") return console.log((await as.call("POST", `/api/desk/seasons/${target}/catchup`, { start: true })).body);
    if (cmd === "decide") {
      const { rows } = await pool.query("SELECT season_id FROM catchup_holds WHERE id = $1", [target]);
      if (!rows[0]) throw new Error("no such hold");
      return console.log((await as.call("POST", `/api/desk/seasons/${rows[0].season_id}/catchup`, { hold: target, decision: third })).body);
    }
    if (cmd === "step") {
      const n = Number(opt("steps") || 1);
      for (let i = 0; i < n; i++) {
        const r = await as.call("POST", `/api/desk/seasons/${target}/catchup`, { step: true });
        if (r.status !== 200) throw new Error(`step: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
        const { rows } = await pool.query(`${ROWS} WHERE c.season_id = $1`, [target]);
        console.log(`[${stamp()}] ${r.body.status ? r.body.status.line : "?"} · last: ${rows[0]?.message ?? "-"}`);
        printHolds(r.body.holds || []);
        if (rows[0]?.done_at || rows[0]?.stuck_at) break;
      }
      return;
    }
    throw new Error("usage: catch-up.js status [<seasonId>] | step <seasonId> [--steps=N] | start <seasonId> | decide <holdId> sent|left | rewind <seasonId>");
  } catch (e) {
    console.error(e.message || e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
