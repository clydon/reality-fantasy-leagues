// Dev-only test bank: writes the stored formats' data halves (show_formats.data: a show's events, categories,
// exits, checklist and rules, no people) to tests/fixtures/stored-formats.json, so tests/rulebooks.test.js can
// check the rulebook every stored format reads back as (rulebook-from-format.js) without a database. Run it
// again when the stored formats change.
//
//   node scripts/dev-test/export-stored-formats.js     reads the local database (.env.local); refuses another
require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("export-stored-formats reads the local database only");
const OUT = path.join(__dirname, "..", "..", "tests", "fixtures", "stored-formats.json");

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    const { rows } = await pool.query("SELECT id, data FROM show_formats WHERE data IS NOT NULL ORDER BY id");
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(Object.fromEntries(rows.map((r) => [r.id, r.data])), null, 2)}\n`, "utf8");
    console.log(`[export] ${rows.length} stored formats -> ${path.relative(process.cwd(), OUT)}`);
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
