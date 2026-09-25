// Minimal migration runner: applies db/migrations/*.sql in filename order, once each, tracked in
// a schema_migrations table. Direct port of SurvivorDraft's db/migrate.js.
//
// RUNS ON EVERY BUILD (`npm run build` -> this, then `next build`), as well as by hand. It used to
// be manual only, on the reasoning that Next.js has no persistent server "boot" step to hang it
// off -- but a deploy is that step, and treating it as one is the difference between a migration
// being applied and a feature 500ing in production with `relation "season_cast" does not exist`,
// which is exactly how this changed. Two rules make that safe:
//
//   * no AUTH_DATABASE_URL -> skip loudly and exit 0, so a build with no database configured (a
//     local `npm run build`, CI, a fork) still works;
//   * the database is there but a migration fails -> exit 1, failing the build. Shipping code whose
//     schema didn't apply is the thing worth preventing.
//
// Concurrent builds (a preview and production deploying at once) take a Postgres advisory lock, so
// the second waits rather than racing the first into a half-applied file.
require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// Any constant works as long as every runner uses the same one -- it's just a name two connections
// can agree on. Session-scoped (pg_advisory_lock, not _xact_), so it covers the whole run rather
// than one file, and is released explicitly below.
const MIGRATION_LOCK = 8145723;

async function migrate(pool) {
  await pool.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK]);
  try {
    await applyAll(pool);
  } finally {
    await pool.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK]);
  }
}

async function applyAll(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const dir = path.join(__dirname, "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const { rows } = await pool.query("SELECT 1 FROM schema_migrations WHERE version=$1", [file]);
    if (rows.length) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log("[migrate] applied", file);
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`Migration ${file} failed: ${e.message}`);
    } finally {
      client.release();
    }
  }
}

if (require.main === module) {
  if (!process.env.AUTH_DATABASE_URL) {
    // Not an error: a build without a database configured is a legitimate thing to do (CI, a fork,
    // `npm run build` on a fresh clone). Said out loud rather than silently, because a DEPLOY that
    // prints this has its env var missing and will ship against an un-migrated database.
    console.warn("[migrate] no AUTH_DATABASE_URL set — skipping migrations. (A deploy printing this has it unset.)");
  } else {
    const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
    migrate(pool)
      .then(() => console.log("[migrate] up to date"))
      .catch((e) => {
        console.error(e);
        process.exitCode = 1;
      })
      .finally(() => pool.end());
  }
}

module.exports = { migrate };
