// Dev-only check before a change to how games score ships: do any league's totals move between a git ref's engine and this
// tree's? A fix to a scoring read (BACKLOG 57, 2026-11-14: a carried lineup reads who the seat held for that episode) can change a
// table that's already been played; this says which, before production does. Read-only: it writes nothing, anywhere.
//
// Each league's state is scored twice (StateLogic.computeScores on a migrated copy): by the engine at --ref (its src/lib/game,
// exported with git archive into the OS temp folder and taken out after) and by the working tree's. A league whose seats' totals
// or order differ is listed by its show, season and kind of game only: never a league's or a person's name or id (the repo and
// its logs are public; backups hold real people's data). Games scored outside their state (Weekly Calls, bingo, a game of
// questions) are compared on what their state holds, which is all the engine scores there.
//
//   node scripts/dev-test/compare-totals.js --backup=backups/prod-2026-10-30 [--ref=HEAD] [--detail]
//   node scripts/dev-test/compare-totals.js --db [--ref=HEAD] [--detail] [--all]
//
// --backup=<dir>  a backup made by scripts/backup-leagues.js (its leagues.json): production as it stood then, with no database
//                 and no connection string. Take a fresh one first for a push (the user runs it; its header says how).
// --db            the LOCAL database (.env.local AUTH_DATABASE_URL; refuses any other host). zt fixtures are left out
//                 unless --all.
// --ref=<ref>     the engine to compare against (default HEAD: what's committed, against what's in the tree).
// --detail        for each league that moves: which episodes' lineups differ for the seats that moved (a lineup game).
//
// Prints what it read, then each league that moves, then "no league's totals move" (exit 0) or how many do (exit 1).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..", "..");
const args = process.argv.slice(2);
const arg = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || null;
const flag = (k) => args.includes(`--${k}`);
const ref = arg("ref") || "HEAD";

/** A git ref's engine: its src/lib/game in a temp folder (tests/fixtures/scoring-shapes.js engineAt's way). */
function engineAt(at) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rfl-totals-"));
  fs.writeFileSync(path.join(dir, "game.tar"), execFileSync("git", ["archive", "--format=tar", at, "src/lib/game"], { cwd: root, maxBuffer: 1 << 28 }));
  execFileSync("tar", ["-xf", "game.tar"], { cwd: dir });
  return { S: require(path.join(dir, "src/lib/game/state-logic.js")), done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** The leagues to read: [{ state, deleted }] from a backup's leagues.json, or the local database. */
async function leagues() {
  const backup = arg("backup");
  if (backup) {
    const file = path.join(path.resolve(root, backup), "leagues.json");
    if (!fs.existsSync(file)) throw new Error(`no leagues.json in ${backup}: a backup made by scripts/backup-leagues.js`);
    const manifest = path.join(path.dirname(file), "manifest.json");
    const made = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, "utf8")).createdAt : null;
    console.log(`[totals] ${backup}${made ? `, made ${String(made).slice(0, 10)}` : ""}`);
    return JSON.parse(fs.readFileSync(file, "utf8")).map((r) => ({ state: typeof r.state === "string" ? JSON.parse(r.state) : r.state, deleted: !!r.deleted_at }));
  }
  if (!flag("db")) throw new Error("say what to read: --backup=<dir> or --db (the local database)");
  require("dotenv").config({ path: path.join(root, ".env.local"), quiet: true });
  const DB = process.env.AUTH_DATABASE_URL || "";
  if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("--db reads a local database only: use --backup for production");
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: DB });
  try {
    const { rows } = await pool.query(`SELECT state, deleted_at FROM leagues${flag("all") ? "" : " WHERE name NOT ILIKE 'zt%'"}`);
    console.log(`[totals] the local database${flag("all") ? "" : ", zt fixtures left out"}`);
    return rows.map((r) => ({ state: r.state, deleted: !!r.deleted_at }));
  } finally {
    await pool.end();
  }
}

(async () => {
  const was = engineAt(ref);
  const now = { S: require(path.join(root, "src/lib/game/state-logic.js")) };
  let moved = 0;
  try {
    const list = (await leagues()).filter((l) => l.state && Array.isArray(l.state.episodes));
    const table = (S, state) => {
      const s = S.migrateLeagueState(JSON.parse(JSON.stringify(state)));
      return { s, rows: S.computeScores(s).map((r) => [r.playerId, r.total]) };
    };
    let errors = 0;
    for (const { state, deleted } of list) {
      let a, b;
      try {
        a = table(was.S, state);
        b = table(now.S, state);
      } catch (e) {
        errors++;
        console.log(`  could not score a ${state.settings?.leagueTypeId ?? "?"} on ${state.settings?.showId ?? "?"} ${state.settings?.wikiSeason ?? ""}: ${e.message}`);
        continue;
      }
      const am = Object.fromEntries(a.rows), bm = Object.fromEntries(b.rows);
      const seats = Object.keys({ ...am, ...bm }).filter((k) => Math.abs((am[k] ?? 0) - (bm[k] ?? 0)) > 1e-9);
      const order = JSON.stringify(a.rows.map((r) => r[0])) !== JSON.stringify(b.rows.map((r) => r[0]));
      if (!seats.length && !order) continue;
      moved++;
      const rank = (rows, id) => rows.findIndex((r) => r[0] === id) + 1;
      const st = state.settings || {};
      console.log(`MOVES  ${st.showId ?? "?"} ${st.wikiSeason ?? ""} · ${st.leagueTypeId ?? "?"}${st.ownPace ? " · own pace" : ""}${deleted ? " · deleted" : ""} · ${state.players?.length ?? 0} seats, ${(state.midSeason?.log || []).length} moves logged`);
      for (const id of seats) console.log(`       a seat: ${am[id] ?? 0} -> ${bm[id] ?? 0} (place ${rank(a.rows, id)} -> ${rank(b.rows, id)})`);
      if (!seats.length) console.log("       the same totals, in another order");
      if (flag("detail") && was.S.ActiveRosterLogic && typeof was.S.ActiveRosterLogic.lineupFor === "function") {
        for (const id of seats) {
          const weeks = [...a.s.episodes].sort((x, y) => x.number - y.number).filter((e) => JSON.stringify(was.S.ActiveRosterLogic.lineupFor(a.s, e.id, id)) !== JSON.stringify(now.S.ActiveRosterLogic.lineupFor(b.s, e.id, id)));
          const stored = (e) => !!(e.lineups && Object.prototype.hasOwnProperty.call(e.lineups, id));
          if (weeks.length) console.log(`       its lineup differs for episode${weeks.length === 1 ? "" : "s"} ${weeks.map((e) => `${e.number}${stored(e) ? " (saved)" : " (carried)"}`).join(", ")}`);
        }
      }
    }
    console.log(`[totals] ${list.length} leagues scored by ${ref}'s engine and this tree's${errors ? `, ${errors} could not be scored` : ""}`);
    console.log(moved ? `\n${moved} league${moved === 1 ? "" : "s"} would change` : "\nno league's totals move");
    if (errors) moved = moved || 1;
  } finally {
    was.done();
  }
  process.exit(moved ? 1 : 0);
})().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
