// Dev-only: what would move if every episode were settled again under this tree's rules (docs/PLAN-results-settle.md, step D):
// a production backup restored into a scratch database, every episode settled again there the way POST /api/desk/settle-again
// does (community-results.ts settleEverything, as the system), and then, compared with the backup as it was:
//   - each result that goes in or comes out of the games (or changes how it's settled), by show, season and episode;
//   - each game whose players' totals move: who, from what to what;
//   - each notice the run would leave in someone's bell (the after-final "results changed" ones among them).
// Read-only for everything but its own scratch database: no bot is asked or told (settle-again's tie-break re-ask and its nudge
// to the bot's clock are left out, so a result waiting for a second look stays out here), and the paid AI keys, web push and
// email are blanked in this process before anything loads. The backup holds no push subscriptions, so nothing can reach a phone.
//
//   node scripts/dev-test/what-would-move.js --backup=<dir> [--into=restore_whatmoves] [--keep] [--reuse]
//
// --backup=<dir>  a backup made by scripts/backup-leagues.js (take a fresh one first: .session-loop/backup-prod-now.ps1 in the
//                 main folder). A path relative to the repo, or absolute (a lane can read the main folder's backups/).
// --into=<name>   the scratch database (must start with restore_; default restore_whatmoves), on .env.local's local server.
// --keep          leave the scratch database there afterwards, settled, for looking around (dropped by default).
// --reuse         settle the scratch database as it stands (a --keep run's is already settled: restore again instead).
//
// Needs the local Postgres only (no dev server). Prints real people's names and results (the couch's own data, for the user):
// keep its output out of git, as the backup is. Exits 0 when nothing moves, 1 when something does, 2 on an error.
require("dotenv").config({ path: ".env.local", quiet: true });
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");
const args = process.argv.slice(2);
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || null;
const flag = (k) => args.includes(`--${k}`);
const backup = opt("backup");
const into = opt("into") || "restore_whatmoves";
const LOCAL = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(LOCAL)) throw new Error("what-would-move runs against a local server only");
if (!/^restore_[a-z0-9_]+$/.test(into)) throw new Error("--into must be a restore_<name> database");
if (!backup && !flag("reuse")) throw new Error("--backup=<dir> is required (a backup made by scripts/backup-leagues.js)");
const withDb = (url, name) => {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
};

if (!flag("reuse")) {
  console.log(`[moves] restoring ${backup} into ${into} …`);
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "restore-leagues.js"), path.resolve(ROOT, backup), `--into=${into}`], { cwd: ROOT, encoding: "utf8" });
  const out = `${r.stdout}${r.stderr}`.trim().split("\n");
  console.log(out.slice(-4).map((l) => `  ${l}`).join("\n"));
  if (r.status !== 0) {
    console.error("[moves] the restore didn't match its backup: stopping");
    process.exit(2);
  }
}

// The scratch copy only, and nothing that can spend or send.
process.env.AUTH_DATABASE_URL = withDb(LOCAL, into);
for (const k of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "XAI_API_KEY", "GEMINI_API_KEY", "VAPID_PRIVATE_KEY", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", "RESEND_API_KEY", "VERCEL_ENV", "BOT_URL", "BOT_TOKEN"]) delete process.env[k];

// after() runs the work at once here (next-after-stub.js); each piece is kept so the run waits for every notice to be written.
const pending = (globalThis.__afterPending = []);
const jiti = require("jiti")(__filename, { alias: { "@": path.join(ROOT, "src"), "@db": path.join(ROOT, "db"), "next/server": path.join(__dirname, "next-after-stub.js") } });
const S = require(path.join(ROOT, "src/lib/game/state-logic.js"));

async function snapshot(pool) {
  const { rows: leagues } = await pool.query("SELECT id, name, state FROM leagues WHERE deleted_at IS NULL ORDER BY created_at");
  const games = new Map();
  for (const l of leagues) {
    const st = l.state?.settings || {};
    try {
      const s = S.migrateLeagueState(JSON.parse(JSON.stringify(l.state)));
      const rows = S.computeScores(s);
      games.set(l.id, { label: `${st.showId ?? "?"} ${st.wikiSeason ?? ""} · ${st.leagueTypeId ?? "?"}${st.ownPace ? " · own pace" : ""}`, name: l.name || "", rows: rows.map((r) => ({ id: r.playerId, name: r.name, total: r.total })) });
    } catch (e) {
      games.set(l.id, { label: `${st.showId ?? "?"} ${st.wikiSeason ?? ""} · ${st.leagueTypeId ?? "?"}`, error: e.message, rows: [] });
    }
  }
  const { rows: results } = await pool.query(
    `SELECT d.id, sh.slug, ss.season_number, d.episode_number, d.kind, d.castaway_name, d.method, d.event_type, d.status, d.fact_status
       FROM season_decisions d JOIN show_seasons ss ON ss.id = d.season_id JOIN shows sh ON sh.id = ss.show_id`
  );
  return { games, results: new Map(results.map((r) => [r.id, r])) };
}

(async () => {
  const { pool } = jiti("../../src/lib/server/db.ts");
  const { settleEverything } = jiti("../../src/lib/server/community-results.ts");
  let moved = 0;
  try {
    const { rows: [{ now: t0 }] } = await pool.query("SELECT now()");
    const before = await snapshot(pool);
    console.log(`[moves] ${before.games.size} games, ${before.results.size} results before; settling every episode again …`);
    const settled = await settleEverything(null);
    while (pending.length) await Promise.all(pending.splice(0));
    const after = await snapshot(pool);
    console.log(`[moves] settled ${settled.episodes} episodes; ${settled.seasons} season${settled.seasons === 1 ? "" : "s"} had something move`);

    // Results: in the games = accepted.
    const what = (r) => `${r.castaway_name}: ${r.kind === "event" ? r.event_type : r.kind === "elimination" ? `out (${r.method || "?"})` : r.kind}`;
    const state = (r) => (r ? `${r.status === "accepted" ? "IN" : r.status}${r.fact_status ? `/${r.fact_status}` : ""}` : "gone");
    const byEp = new Map();
    for (const id of new Set([...before.results.keys(), ...after.results.keys()])) {
      const a = before.results.get(id), b = after.results.get(id);
      if (a && b && a.status === b.status && a.fact_status === b.fact_status) continue;
      const r = b || a;
      const key = `${r.slug} ${r.season_number} · Episode ${String(r.episode_number).padStart(2, " ")}`;
      const inGames = (x) => !!x && x.status === "accepted";
      const tag = inGames(a) === inGames(b) ? "  (how it's settled only)" : inGames(b) ? "  GOES IN" : "  COMES OUT";
      byEp.set(key, [...(byEp.get(key) || []), `${what(r)}: ${state(a)} -> ${state(b)}${tag}`]);
    }
    console.log(`\n== Results that change (${[...byEp.values()].flat().length}) ==`);
    for (const key of [...byEp.keys()].sort()) {
      console.log(key);
      for (const line of byEp.get(key)) console.log(`  ${line}`);
    }

    console.log("\n== Games whose points move ==");
    for (const [id, a] of before.games) {
      const b = after.games.get(id);
      if (!b) continue;
      const am = new Map(a.rows.map((r) => [r.id, r])), bm = new Map(b.rows.map((r) => [r.id, r]));
      const seats = [...new Set([...am.keys(), ...bm.keys()])].filter((k) => Math.abs((am.get(k)?.total ?? 0) - (bm.get(k)?.total ?? 0)) > 1e-9);
      if (!seats.length) continue;
      moved++;
      const place = (rows, k) => rows.findIndex((r) => r.id === k) + 1;
      console.log(`${a.label}${a.name ? ` · "${a.name}"` : ""}`);
      for (const k of seats) {
        const x = am.get(k), y = bm.get(k), d = (y?.total ?? 0) - (x?.total ?? 0);
        console.log(`  ${(x || y).name}: ${x?.total ?? 0} -> ${y?.total ?? 0} (${d > 0 ? "+" : ""}${Math.round(d * 100) / 100}), place ${place(a.rows, k)} -> ${place(b.rows, k)}`);
      }
    }
    if (!moved) console.log("  none");

    const { rows: told } = await pool.query(
      `SELECT u.name, n.type, n.title, n.body FROM notifications n JOIN "user" u ON u.id = n.user_id WHERE n.created_at >= $1 ORDER BY u.name, n.created_at`,
      [t0]
    );
    console.log(`\n== Notices the run leaves in bells (${told.length}) ==`);
    for (const n of told) console.log(`  ${n.name} [${n.type}] ${n.title} — ${n.body}`);
  } finally {
    await pool.end();
  }
  if (!flag("keep")) {
    const { Pool } = require("pg");
    const admin = new Pool({ connectionString: withDb(LOCAL, "postgres") });
    await admin.query(`DROP DATABASE IF EXISTS ${into} WITH (FORCE)`);
    await admin.end();
    console.log(`\n[moves] ${into} dropped`);
  } else console.log(`\n[moves] ${into} kept (settled): drop it with DROP DATABASE ${into}`);
  console.log(moved ? `[moves] ${moved} game${moved === 1 ? "" : "s"} would move` : "[moves] no game's points move");
  process.exit(moved ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
