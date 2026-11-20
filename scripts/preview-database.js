// The preview service's database, marked as one (docs/PLAN-preview-release.md, step 5): the live tier writes a preview's copies only
// to a local database or to one carrying this mark (tools/gameplay-bench/live-db.cjs allowed/marked), and never to the app's.
// Marking refuses the app's database by its host (APP_DATABASE_HOSTS), and any database with a single person in it who isn't a
// preview's made-up one: a preview database holds nobody real.
//
//   PREVIEW_SERVICE=1 APP_DATABASE_HOSTS=<the app's db host> AUTH_DATABASE_URL=<the preview db> node scripts/preview-database.js mark
//   ... node scripts/preview-database.js check      says whether it's marked, and who's in it
const { Pool } = require("pg");
const { _guard } = require("../tools/gameplay-bench/live-db.cjs");

const PREVIEW_USER = /^[a-z0-9]{1,12}_ztgb[0-9a-f]{8}[0-9]{1,2}$/;

(async () => {
  const what = process.argv[2];
  if (!["mark", "check"].includes(what)) throw Error("mark or check");
  const url = process.env.AUTH_DATABASE_URL || "";
  if (_guard.allowed(url) !== "service") throw Error("Set PREVIEW_SERVICE=1 and point AUTH_DATABASE_URL at the preview service's database (not a local one)");
  const db = new Pool({ connectionString: url, max: 1 });
  try {
    const { rows: people } = await db.query(`SELECT username FROM "user"`);
    const real = people.filter((u) => !PREVIEW_USER.test(u.username || ""));
    const { rows } = await db.query(`SELECT value FROM app_settings WHERE key = 'preview_database'`);
    console.log(`marked: ${rows[0]?.value === true}; people: ${people.length}, not a preview's: ${real.length}`);
    if (what === "check") return;
    if (real.length) throw Error(`Not marking: ${real.length} ${real.length === 1 ? "person" : "people"} here aren't a preview's (a preview database holds nobody real)`);
    await db.query(`INSERT INTO app_settings (key, value, updated_at) VALUES ('preview_database', 'true'::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb, updated_at = now()`);
    console.log("marked as the preview service's database");
  } finally {
    await db.end();
  }
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
