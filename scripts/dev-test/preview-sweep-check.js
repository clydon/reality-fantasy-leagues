// Live previews' sweep (docs/PLAN-preview-release.md, step 7): previews left behind every way are gone after a sweep, and nothing
// else is. Made here, as zt-gb copies in this lane's database through the live maker (tools/gameplay-bench/preview/live.cjs) on the
// made-up season (tests/fixtures/preview-season): `--registered` previews past their time (rows in live_previews, never closed);
// `--orphans` previews the registry never knew, a day and more old (their rows' times moved back), some stopped partway; and one
// orphan made just now, which must stay. Then the open route sweeps (POST /api/preview-live/sweep), a second sweep inside the minute
// does nothing, and what's left is counted. Cleans up whatever it made either way.
//
// Needs this lane's dev server (BASE, default :3014) and its database (.env.local AUTH_DATABASE_URL).
//   node --env-file=.env.local scripts/dev-test/preview-sweep-check.js [--registered=5] [--orphans=8]
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");
const root = path.resolve(__dirname, "../..");
const Def = require(path.join(root, "tools/gameplay-bench/preview/definition.cjs"));
const Live = require(path.join(root, "tools/gameplay-bench/preview/live.cjs"));
const Tier = require(path.join(root, "tools/gameplay-bench/live-db.cjs"));
const { season } = require(path.join(root, "tests/fixtures/preview-season/season.js"));

const BASE = process.env.BASE || "http://localhost:3014";
const n = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || "").split("=")[1] || d);
const REGISTERED = n("registered", 5), ORPHANS = n("orphans", 8);

(async () => {
  const db = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const made = [];
  const one = async (sql, p) => (await db.query(sql, p)).rows;
  const make = async (base, stopPartway) => {
    const d = Def.build(season(), { base, gameId: base, seed: crypto.randomInt(1e6) });
    const out = await Live.make({ input: d, app: BASE, resultsFor: Def.resultsFor(season()), seasons: 0, onState: stopPartway ? (k) => { if (k >= 1) throw Error("stopped partway on purpose"); } : undefined });
    await out.rest.catch(() => {});
    made.push(out.preview);
    return out.preview;
  };
  const age = async (keys, hours) => {
    for (const k of keys) {
      await db.query(`UPDATE shows SET created_at = now() - make_interval(hours => $2) WHERE slug LIKE $1`, [`zt-gb-${k}-%`, hours]);
      await db.query(`UPDATE "user" SET "createdAt" = now() - make_interval(hours => $2) WHERE username LIKE $1`, [`%\\_ztgb${k}_%`, hours]);
    }
  };
  const sweep = async () => { const r = await fetch(`${BASE}/api/preview-live/sweep`, { method: "POST" }); return r.json(); };
  const count = async () => (await one(`SELECT count(*)::int AS k FROM shows WHERE slug LIKE 'zt-gb-%'`))[0].k;
  try {
    const before = await count();
    if (before) throw Error(`${before} zt-gb copies already here: clear them first (live-db down-all)`);
    // Registered, past their time.
    for (let i = 0; i < REGISTERED; i++) {
      const p = await make(i % 2 ? "pool" : "sheet");
      const { rows: [v] } = await db.query(`SELECT id FROM "user" WHERE username = $1`, [p.viewerUser]);
      await db.query(`INSERT INTO live_previews (id, owner_key, viewer_user_id, story, copies, expires_at) VALUES ($1, 'zt-sweep', $2, '{}'::jsonb, $3, now() - interval '1 minute')`, [crypto.randomUUID(), v.id, JSON.stringify(p.copies)]);
    }
    // Orphans a day and more old, a third of them stopped partway.
    const old = [];
    for (let i = 0; i < ORPHANS; i++) old.push(...(await make(i % 2 ? "pool" : "fantasy", i % 3 === 0)).copies);
    await age(old, 30);
    // An orphan made just now: younger than the longest a preview lives, so it stays.
    const fresh = (await make("pool")).copies;
    const total = await count();
    await db.query(`UPDATE app_settings SET updated_at = now() - interval '2 minutes' WHERE key = 'live_previews_swept'`);
    const first = await sweep(), second = await sweep();
    const left = await one(`SELECT slug FROM shows WHERE slug LIKE 'zt-gb-%'`);
    const leftKeys = new Set(left.map((r) => r.slug.split("-")[2]));
    const rows = (await one(`SELECT count(*)::int AS k FROM live_previews WHERE owner_key = 'zt-sweep'`))[0].k;
    const couches = (await one(`SELECT name FROM couches WHERE name LIKE 'ZT Bench %'`)).map((r) => r.name.slice(9));
    const ok = first.swept && first.expired === REGISTERED && !second.swept && rows === 0 && fresh.every((k) => leftKeys.has(k)) && leftKeys.size === fresh.length && couches.every((k) => fresh.includes(k));
    console.log(`${total} copies made (${REGISTERED} registered previews past their time, ${ORPHANS} orphans a day old, one fresh). First sweep: ${JSON.stringify(first)}; a second inside the minute: ${JSON.stringify(second)}. Left: ${leftKeys.size} cop${leftKeys.size === 1 ? "y" : "ies"} (the fresh orphan's ${fresh.length}), ${rows} registry rows. ${ok ? "OK" : "WRONG"}`);
    process.exitCode = ok ? 0 : 1;
  } finally {
    for (const p of made) await Live.down(p).catch(() => {});
    await db.query(`DELETE FROM live_previews WHERE owner_key = 'zt-sweep'`);
    const k = async (sql) => (await one(sql))[0].k;
    const after = { shows: await k(`SELECT count(*)::int AS k FROM shows WHERE slug LIKE 'zt-gb-%'`), leagues: await k(`SELECT count(*)::int AS k FROM leagues WHERE slug LIKE 'zt-gb-%'`), people: await k(`SELECT count(*)::int AS k FROM "user" WHERE username ~ '_ztgb[0-9a-f]{8}[0-9]{1,2}$'`), couches: await k(`SELECT count(*)::int AS k FROM couches WHERE name LIKE 'ZT Bench %'`) };
    console.log("after cleaning up: " + JSON.stringify(after));
    if (Object.values(after).some(Boolean)) process.exitCode = 1;
    await db.end();
    await Tier.close();
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
