// The catch-up's rehearsal (docs/PLAN-cast-properties.md chunk 6c): runs every queued season's catch-up to the end on a Neon
// branch of production, through OUR BOT only, then prints what it would hold for the desk ("Would change scores"): the list the
// user sees before the push. Run after scripts/rehearse-migrations.js has migrated the branch (0441 queues the seasons).
//
//   node scripts/catch-up-rehearse.js --endpoint=<the branch's ep-... id> [--parallel=2] [--list]
//     (--list: only what's queued and what already waits, asking nothing; --only=<seasonId> and --steps=N: one season, N steps,
//     to try the script itself)
//     with REHEARSE_DATABASE_URL set to the branch's connection string (the clipboard window, .session-loop/rehearse-*.ps1:
//     Claude never sees the string).
//
// Never production: it refuses production's compute by id, any host a production backup in backups/ was read from, and any
// host whose endpoint isn't --endpoint. Nothing leaves the copy: the paid AI keys, web push and email are blanked in this
// process before anything loads, and the bot's clock is told nothing (that's production's only). Prints season names, results
// and the players whose totals would move (the couch's own data, for the user; the log stays in the gitignored .session-loop).
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");

const PRODUCTION = "ep-empty-star-b42m1jue";
const url = process.env.REHEARSE_DATABASE_URL;
if (!url) throw new Error("set REHEARSE_DATABASE_URL to the Neon branch's connection string");
const args = process.argv.slice(2);
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || null;
const endpoint = (h) => h.split(".")[0].replace(/-pooler$/, "");
const host = new URL(url).hostname;
const want = opt("endpoint");
if (!want) throw new Error("--endpoint=<the rehearsal branch's ep-... id> is required");
if (endpoint(host) === PRODUCTION || want === PRODUCTION) throw new Error("that's production's compute: use the rehearsal branch's");
if (endpoint(host) !== want) throw new Error(`the string's host isn't ${want}: copy the rehearsal branch's`);
const backups = path.join(__dirname, "..", "backups");
for (const dir of fs.existsSync(backups) ? fs.readdirSync(backups) : []) {
  const file = path.join(backups, dir, "manifest.json");
  if (!fs.existsSync(file)) continue;
  const at = JSON.parse(fs.readFileSync(file, "utf8")).source?.at || "";
  if (/neon\.tech/.test(at) && endpoint(at.split("/")[0].split(":")[0]) === endpoint(host)) throw new Error("a production backup was read from that host");
}
console.log(`[catch-up] on ${want}`);

// The copy only: everything below reads AUTH_DATABASE_URL, and nothing may spend or send.
process.env.AUTH_DATABASE_URL = url;
for (const k of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "XAI_API_KEY", "GEMINI_API_KEY", "VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "RESEND_API_KEY", "VERCEL_ENV"]) delete process.env[k];

const root = path.join(__dirname, "..");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(root, "src"), "@db": path.join(root, "db") } });
const C = jiti("../src/lib/server/catch-up.ts");
const { pool } = jiti("../src/lib/server/db.ts");
const stamp = () => new Date().toISOString().slice(11, 19);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function season(id, name) {
  for (let calls = 0; calls < Number(opt("steps") || 80); calls++) {
    const before = (await pool.query("SELECT tries FROM season_catchups WHERE season_id = $1", [id])).rows[0];
    await C.runOne(id, { budgetMs: 280_000 });
    const r = (await pool.query("SELECT step, episode, tries, message, stuck_at, done_at FROM season_catchups WHERE season_id = $1", [id])).rows[0];
    console.log(`[${stamp()}] ${name}: ${(await C.catchUpLine(id))?.line ?? "?"}${r.message ? ` · ${r.message.slice(0, 160)}` : ""}`);
    if (r.done_at || r.stuck_at) return;
    // A failed try: a short wait here (the clock's would be longer), the same six tries before it stops.
    if (r.tries > (before?.tries ?? 0)) await sleep(60_000);
  }
}

// The migration's queue, run again (it does nothing for a season queued already): a copy migrated before a fix to it still
// gets every season the migration now names.
const QUEUE = (() => {
  const sql = fs.readFileSync(path.join(root, "db", "migrations", "0441_season_catchups.sql"), "utf8");
  const m = sql.match(/INSERT INTO season_catchups[\s\S]*?ON CONFLICT DO NOTHING;/);
  if (!m) throw new Error("0441's queue statement wasn't found");
  return m[0];
})();

(async () => {
  try {
    const queued = await pool.query(QUEUE);
    if (queued.rowCount) console.log(`[catch-up] queued ${queued.rowCount} more season(s) as the migration now names them`);
    const { rows } = await pool.query(
      `SELECT c.season_id, COALESCE(ss.name, s.name || ' ' || ss.season_number) AS name FROM season_catchups c
         JOIN show_seasons ss ON ss.id = c.season_id JOIN shows s ON s.id = ss.show_id
        WHERE c.done_at IS NULL AND c.stuck_at IS NULL ORDER BY s.slug, ss.season_number`
    );
    console.log(`[catch-up] ${rows.length} season(s): ${rows.map((r) => r.name).join(", ")}`);
    if (args.includes("--list")) rows.length = 0;
    if (opt("only")) rows.splice(0, rows.length, ...rows.filter((r) => r.season_id === opt("only")));
    const queue = [...rows];
    const lanes = Array.from({ length: Math.max(1, Number(opt("parallel") || 2)) }, async () => {
      for (let r = queue.shift(); r; r = queue.shift()) await season(r.season_id, r.name);
    });
    await Promise.all(lanes);
    console.log("\n[catch-up] what would wait for the desk:");
    const holds = await C.holdsWaiting();
    if (!holds.length) console.log("  nothing: every episode went in with no score moving");
    for (const h of holds) {
      console.log(`  ${h.season}, Episode ${h.episode}:`);
      for (const c of h.changes) console.log(`    ${c.name ? `${c.name} · ` : ""}${c.label} (${c.how === "in" ? "goes in" : c.how === "out" ? "comes out" : "changes"})`);
      for (const g of h.games) console.log(`    ${g.name}: ${C.movesLine(g)}`);
    }
    const { rows: stopped } = await pool.query("SELECT season_id, message FROM season_catchups WHERE stuck_at IS NOT NULL");
    for (const s of stopped) console.log(`  stopped: ${s.season_id} · ${s.message}`);
    console.log("[catch-up] done");
  } catch (e) {
    console.error("[catch-up] failed:", e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
