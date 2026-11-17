// The catch-up's per-season locks in a database (src/lib/server/catch-up.ts underSeasonLock): who holds one, for how long, and
// (clear) ending only an orphaned holder. Found 2026-11-16 in production: a request Vercel ended at its 5-minute limit while
// holding a season's lock left a session that kept it, and every later episode of that season waited on it.
//
//   node scripts/catch-up-locks.js status --endpoint=<ep-...> [--production]   each queued season's lock: holder, state, idle for
//   node scripts/catch-up-locks.js clear --endpoint=<ep-...> [--production]    ends the sessions holding a catch-up lock that are
//                                                                              idle (not running a query) for 2 minutes or more
//     with CATCHUP_DATABASE_URL set to the database's connection string (a clipboard window: Claude never sees the string).
//     Production only with --production and its compute's id as --endpoint. Ends sessions only; changes no rows.
require("dotenv").config({ path: ".env.local", quiet: true });
const { Pool } = require("pg");

const PRODUCTION = "ep-empty-star-b42m1jue";
const args = process.argv.slice(2);
const cmd = args[0];
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || null;
const url = process.env.CATCHUP_DATABASE_URL;
if (!url) throw new Error("set CATCHUP_DATABASE_URL to the database's connection string");
const endpoint = (h) => h.split(".")[0].replace(/-pooler$/, "");
const host = new URL(url).hostname;
const want = opt("endpoint");
if (!want) throw new Error("--endpoint=<ep-...> is required");
if (endpoint(host) !== want && !/^(localhost|127\.0\.0\.1)$/.test(host)) throw new Error(`the string's host isn't ${want}`);
const isProduction = endpoint(host) === PRODUCTION;
if (isProduction !== args.includes("--production")) throw new Error(isProduction ? "that's production: add --production to mean it" : "--production given, but that isn't production's compute");
console.log(`[locks] on ${endpoint(host)}${isProduction ? " (PRODUCTION)" : ""}`);

(async () => {
  const pool = new Pool({ connectionString: url });
  pool.on("error", (e) => console.error("[locks] an idle connection closed:", e.message));
  try {
    // Each queued season's lock key, hashtext('catchup:<id>') as pg_advisory_lock takes it, split as pg_locks shows a bigint key.
    const { rows: seasons } = await pool.query(
      `SELECT c.season_id, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name, hashtext('catchup:' || c.season_id)::bigint AS k
         FROM season_catchups c JOIN show_seasons ss ON ss.id = c.season_id JOIN shows s ON s.id = ss.show_id`
    );
    const holders = [];
    for (const s of seasons) {
      const k = BigInt.asUintN(64, BigInt(s.k));
      const hi = Number(k >> 32n), lo = Number(k & 0xffffffffn);
      const { rows } = await pool.query(
        `SELECT l.pid, l.granted, a.state, extract(epoch FROM now() - a.state_change)::int AS idle_s, extract(epoch FROM now() - a.backend_start)::int AS age_s
           FROM pg_locks l LEFT JOIN pg_stat_activity a ON a.pid = l.pid
          WHERE l.locktype = 'advisory' AND l.classid = $1::oid AND l.objid = $2::oid AND l.objsubid = 1`,
        [hi, lo]
      );
      for (const r of rows) holders.push({ season: s.name, ...r });
      console.log(`[locks] ${s.name}: ${rows.length ? rows.map((r) => `pid ${r.pid} ${r.granted ? "holds" : "waits"} (${r.state ?? "?"}, idle ${r.idle_s ?? "?"} s, session ${r.age_s ?? "?"} s old)`).join("; ") : "free"}`);
    }
    if (cmd === "clear") {
      const orphans = holders.filter((h) => h.granted && h.state !== "active" && (h.idle_s ?? 0) >= 120);
      for (const h of orphans) {
        const { rows } = await pool.query("SELECT pg_terminate_backend($1) AS ended", [h.pid]);
        console.log(`[locks] ended pid ${h.pid} (${h.season}): ${rows[0].ended}`);
      }
      if (!orphans.length) console.log("[locks] nothing orphaned to end");
    } else if (cmd !== "status") throw new Error("usage: catch-up-locks.js status | clear, with --endpoint (and --production)");
  } catch (e) {
    console.error("[locks] failed:", e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
