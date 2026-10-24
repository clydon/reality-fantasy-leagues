// Restores a backup-leagues.js backup into a fresh scratch database on the local server, then checks every
// table and every league's state against the backup's manifest (docs/PLAN-new-design.md, step 0a).
//
//   node scripts/restore-leagues.js <backupDir> --into=restore_<name> [--drop]
//
// Run it from the repo root. The server and login are AUTH_DATABASE_URL's (.env.local), which must be a
// local one; only the database name changes. The name must start with restore_: that database is dropped,
// created fresh, migrated with db/migrate.js, and loaded in one transaction. --drop removes it after the
// check; without it, it stays for looking around (drop it with the same command and --drop).
//
// Prints a diff: each table's rows in the backup and in the restore, and each league's state hash. Rows
// that point at something outside the backup (a --group backup leaves other leagues out) are loaded the way
// deleting that something would leave them, and the diff says so. Exits 1 on any other difference.
//
// A backup taken before step 0b's migrations has no couches or follows (backup-common.js LATER_TABLES): they're
// filled in from the restored leagues by the same files the migrations ran (0101, 0103), and listed as such.
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const util = require("util");
const { Pool } = require("pg");
const { migrate } = require("../db/migrate");
const C = require("./backup-common");

const CHUNK = 500;
const withDb = (url, name) => {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
};

/** Insert order: every table after the tables it points at; a cycle is broken by filling a nullable
 *  column in afterwards (`deferred`). */
function insertOrder(fks, tables) {
  const done = new Set();
  const order = [];
  // A table pointing at itself fills that column in afterwards.
  const deferred = fks.filter((f) => f.table === f.refTable && tables.includes(f.table));
  if (deferred.some((f) => f.notNull)) throw new Error("a table points at itself through a required column");
  const open = (t) => fks.filter((f) => f.table === t && f.refTable !== t && tables.includes(f.refTable) && !done.has(f.refTable) && !deferred.includes(f));
  let remaining = [...tables];
  while (remaining.length) {
    let next = remaining.filter((t) => !open(t).length);
    if (!next.length) {
      // A cycle (leagues and league_groups, leagues and league_rulesets): the table with fewest open
      // references, all of them nullable, goes in first with those filled in afterwards.
      const pick = remaining
        .map((t) => ({ t, cols: open(t) }))
        .filter((c) => c.cols.every((f) => !f.notNull))
        .sort((a, b) => a.cols.length - b.cols.length)[0];
      if (!pick) throw new Error(`no insert order: ${remaining.join(", ")} point at each other through required columns`);
      deferred.push(...pick.cols);
      next = [pick.t];
    }
    for (const t of next) {
      done.add(t);
      order.push(t);
    }
    remaining = remaining.filter((t) => !done.has(t));
  }
  return { order, deferred };
}

/** Rows pointing at something not in the backup: nulled where the key would null them, else left out. */
function settleReferences(rows, fks) {
  const notes = Object.fromEntries(C.TABLES.map((t) => [t, { nulled: 0, dropped: 0 }]));
  for (let changed = true; changed; ) {
    changed = false;
    for (const fk of fks) {
      if (!rows[fk.table]) continue;
      const present = new Set((rows[fk.refTable] || []).map((r) => r[fk.refColumn]));
      const kept = [];
      for (const r of rows[fk.table]) {
        if (r[fk.column] == null || present.has(r[fk.column])) {
          kept.push(r);
        } else if (fk.onDelete === "n" && !fk.notNull) {
          r[fk.column] = null;
          notes[fk.table].nulled++;
          kept.push(r);
        } else {
          notes[fk.table].dropped++;
          changed = true;
        }
      }
      rows[fk.table] = kept;
    }
  }
  return notes;
}

async function main() {
  const dir = process.argv[2];
  const into = (process.argv.find((a) => a.startsWith("--into=")) || "").slice(7);
  const drop = process.argv.includes("--drop");
  if (!dir || dir.startsWith("--")) throw new Error("usage: node scripts/restore-leagues.js <backupDir> --into=restore_<name> [--drop]");
  if (!/^restore_[a-z0-9_]+$/.test(into)) throw new Error("--into must be a database name starting with restore_ (lowercase, digits, _)");
  const base = process.env.AUTH_DATABASE_URL;
  if (!base) throw new Error("AUTH_DATABASE_URL isn't set (.env.local)");
  const host = new URL(base).hostname;
  if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) throw new Error(`restores go to the local server only, and AUTH_DATABASE_URL is on ${host}`);
  if (new URL(base).pathname.slice(1) === into) throw new Error("that's the dev database");

  const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
  // A backup of a database from before a later table's migration hasn't got it (C.LATER_TABLES): those are
  // filled in from the leagues after loading, as the migration would have.
  const tables = C.TABLES.filter((t) => manifest.tables[t]);
  const notBackedUp = C.TABLES.filter((t) => !manifest.tables[t]);
  for (const t of notBackedUp) if (!C.LATER_TABLES[t]) throw new Error(`the backup has no ${t}.json`);
  const rows = {};
  // First, that each file is what the backup wrote: its rows, as written (one per line, joined by ",\n",
  // which can't occur inside one), hash to the manifest's. Otherwise "the restore matches the file" proves
  // nothing about the database it came from.
  const changed = new Set();
  for (const t of tables) {
    const text = fs.readFileSync(path.join(dir, `${t}.json`), "utf8");
    rows[t] = JSON.parse(text);
    const body = text.startsWith("[\n") && text.endsWith("\n]\n") ? text.slice(2, -3) : null;
    if (body === null || C.hashLines(body ? body.split(",\n") : []) !== manifest.tables[t].hash) changed.add(t);
  }
  console.log(`[restore] ${dir}: backed up ${manifest.createdAt} from ${manifest.source.at}, ${manifest.leagues.length} leagues -> ${C.describeUrl(withDb(base, into))}`);

  const admin = new Pool({ connectionString: withDb(base, "postgres") });
  await admin.query(`DROP DATABASE IF EXISTS ${C.q(into)} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${C.q(into)}`);
  const pool = new Pool({ connectionString: withDb(base, into) });
  let failures = 0;
  try {
    const log = console.log;
    console.log = () => {}; // both print a line per step
    try {
      // Better Auth makes its own tables (user, session, account, verification; README: `npx @better-auth/cli
      // migrate`) before the app's migrations, which point at "user". Same here, with src/lib/auth.ts's
      // plugins but not its additionalFields: `approved` comes from migration 0058, as it did in production.
      const { getMigrations } = await import("better-auth/db/migration");
      const { username, admin } = await import("better-auth/plugins");
      await (await getMigrations({ database: pool, plugins: [username(), admin()] })).runMigrations();
      await migrate(pool);
    } finally {
      console.log = log;
    }
    const { rows: applied } = await pool.query("SELECT version FROM schema_migrations ORDER BY version");
    const have = new Set(applied.map((r) => r.version));
    const missing = manifest.migrations.filter((m) => !have.has(m));
    const extra = applied.map((r) => r.version).filter((m) => !manifest.migrations.includes(m));
    if (missing.length) console.log(`[restore] the backup's database had migrations this code doesn't: ${missing.join(", ")}`);
    if (extra.length) console.log(`[restore] this code has migrations the backup's database hadn't run: ${extra.join(", ")}`);

    const fks = (await C.foreignKeys(pool)).filter((f) => tables.includes(f.table));
    const notes = settleReferences(rows, fks);
    const { order, deferred } = insertOrder(fks, tables);

    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await db.query("SET LOCAL TIME ZONE 'UTC'");
      await db.query(`TRUNCATE ${C.TABLES.map(C.q).join(", ")} CASCADE`); // the rows migrations seed
      for (const t of order) {
        const targetCols = await C.columnsOf(db, t);
        const cols = manifest.tables[t].columns.filter((c) => targetCols.includes(c));
        const later = deferred.filter((f) => f.table === t).map((f) => f.column);
        for (let i = 0; i < rows[t].length; i += CHUNK) {
          const chunk = rows[t].slice(i, i + CHUNK).map((r) => (later.length ? { ...r, ...Object.fromEntries(later.map((c) => [c, null])) } : r));
          await db.query(
            `INSERT INTO ${C.q(t)} (${cols.map(C.q).join(", ")}) SELECT ${cols.map(C.q).join(", ")} FROM json_populate_recordset(NULL::${C.q(t)}, $1::json)`,
            [JSON.stringify(chunk)]
          );
        }
      }
      for (const f of deferred) {
        const pk = manifest.tables[f.table].primaryKey;
        for (const r of rows[f.table].filter((x) => x[f.column] != null)) {
          await db.query(`UPDATE ${C.q(f.table)} SET ${C.q(f.column)} = $1 WHERE ${pk.map((c, i) => `${C.q(c)} = $${i + 2}`).join(" AND ")}`, [
            r[f.column],
            ...pk.map((c) => r[c]),
          ]);
        }
      }
      for (const fill of [...new Set(notBackedUp.map((t) => C.LATER_TABLES[t].fill).filter(Boolean))]) {
        await db.query(fs.readFileSync(path.join(__dirname, "..", "db", "migrations", fill), "utf8"));
      }
      await db.query("COMMIT");
    } catch (e) {
      await db.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      db.release();
    }

    // The check: every table read back the way the backup read it, and each league's state.
    await pool.query("SET TIME ZONE 'UTC'");
    const width = Math.max(...C.TABLES.map((t) => t.length));
    console.log(`\n  ${"table".padEnd(width)}  backup  restored`);
    for (const t of notBackedUp) {
      const { rows: n } = await pool.query(`SELECT count(*)::int AS n FROM ${C.q(t)}`);
      const how = C.LATER_TABLES[t].fill ? `filled in from the leagues (${C.LATER_TABLES[t].fill})` : "none";
      console.log(`  ${t.padEnd(width)}       -  ${String(n[0].n).padStart(8)}  not in the backup (made before ${C.LATER_TABLES[t].since}): ${how}`);
    }
    for (const t of tables) {
      const m = manifest.tables[t];
      const targetCols = await C.columnsOf(pool, t);
      const cols = m.columns.filter((c) => targetCols.includes(c));
      const lines = await C.rowLines(pool, t, cols, m.primaryKey);
      const n = notes[t];
      const settled = n.nulled || n.dropped ? ` (${[n.nulled && `${n.nulled} references nulled`, n.dropped && `${n.dropped} rows left out`].filter(Boolean).join(", ")}: they point outside the backup)` : "";
      let verdict;
      if (cols.length === m.columns.length && C.hashLines(lines) === m.hash) verdict = "same";
      else {
        // Not byte for byte: compare as data, against the backup's rows as they were loaded.
        const key = (r) => JSON.stringify(m.primaryKey.map((c) => r[c]));
        const pick = (r) => Object.fromEntries(cols.map((c) => [c, r[c]]));
        const want = new Map(rows[t].map((r) => [key(r), pick(r)]));
        const got = lines.map((l) => JSON.parse(l));
        const differing = got.filter((r) => !util.isDeepStrictEqual(pick(r), want.get(key(r))));
        const lost = m.columns.filter((c) => !targetCols.includes(c));
        // Same data in different text (another Postgres version printing a value its own way) still matches.
        // Every row the backup had is here, less only those reported as left out.
        if (!differing.length && got.length === want.size && got.length === m.rows - n.dropped && !lost.length) verdict = "same data";
        else {
          verdict = `DIFFERENT: ${differing.length} rows${differing[0] ? `, first ${key(differing[0])}` : ""}${lost.length ? `; no column here for ${lost.join(", ")}` : ""}`;
          failures++;
        }
      }
      if (changed.has(t)) {
        verdict += `; ${t}.json IS NOT WHAT THE BACKUP WROTE`;
        failures++;
      }
      console.log(`  ${t.padEnd(width)}  ${String(m.rows).padStart(6)}  ${String(lines.length).padStart(8)}  ${verdict}${settled}`);
    }

    const { rows: states } = await pool.query("SELECT id, md5(state::text) AS hash FROM leagues");
    const restored = new Map(states.map((r) => [r.id, r.hash]));
    console.log(`\n  league state${" ".repeat(Math.max(0, width - 12))}  backup    restored`);
    for (const l of manifest.leagues) {
      const h = restored.get(l.id);
      const ok = h === l.stateHash;
      if (!ok) failures++;
      console.log(`  ${l.slug.padEnd(width)}  ${l.stateHash.slice(0, 8)}  ${(h || "missing").slice(0, 8)}  ${ok ? "same" : "DIFFERENT"}`);
    }
    console.log(failures ? `\n[restore] ${failures} differences` : `\n[restore] everything matches: ${tables.length} tables, ${manifest.leagues.length} leagues' state`);
  } finally {
    await pool.end();
    if (drop) await admin.query(`DROP DATABASE IF EXISTS ${C.q(into)} WITH (FORCE)`);
    await admin.end();
  }
  if (failures) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`[restore] ${e.message}`);
  process.exitCode = 1;
});
