// Dev-only: the preview service under load (docs/PLAN-preview-release.md, step 16): --at-once previews asked for at the same moment,
// signed as the app asks (preview-signature.ts), each a different made-up owner, on the made-up season (tests/fixtures/
// preview-season: no real people). Says which were made and which refused (past AT_ONCE: busy), how long each took, then waits for
// their last moments and reads what the month's ledger (live_preview_months) gained: CPU per preview made. Every preview it made is
// closed by its owner at the end, whatever happened.
//
//   BASE=https://<the service> PREVIEW_SECRET=<the shared one> AUTH_DATABASE_URL=<the service's database> \
//     node scripts/dev-test/preview-load-check.js [--at-once=11] [--game=pool] [--settle=60]
//
// Without AUTH_DATABASE_URL it skips the ledger. Against this lane's dev server (BASE=http://localhost:3014, its own .env.local) it
// works the same.
const path = require("path");
const root = path.resolve(__dirname, "../..");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(root, "src") } });
const { signedHeaders } = jiti(path.join(root, "src/lib/server/preview-signature.ts"));
const Def = require(path.join(root, "tools/gameplay-bench/preview/definition.cjs"));
const { season } = require(path.join(root, "tests/fixtures/preview-season/season.js"));

const BASE = (process.env.BASE || "http://localhost:3014").replace(/\/$/, "");
const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const N = Number(opt("at-once", "11")), GAME = opt("game", "pool"), SETTLE = Number(opt("settle", "60"));

const signed = (method, p, body) => fetch(BASE + p, { method, headers: { "content-type": "application/json", ...signedHeaders(method, p, body) }, body });

async function month(db) {
  if (!db) return null;
  const { rows: [m] } = await db.query(`SELECT previews, cpu_ms FROM live_preview_months WHERE month = date_trunc('month', now())::date`);
  return { previews: m?.previews ?? 0, cpuMs: Number(m?.cpu_ms ?? 0) };
}

(async () => {
  const db = process.env.AUTH_DATABASE_URL ? new (require("pg").Pool)({ connectionString: process.env.AUTH_DATABASE_URL }) : null;
  const stamp = Date.now().toString(36);
  const asks = Array.from({ length: N }, (_, i) => ({ owner: `zt-load-${stamp}-${i}`, key: `zt-load-${stamp}-${i}`, definition: Def.build(season(), { base: GAME, gameId: GAME, seed: 100 + i }), rates: Def.ratesOf(season()), exits: null, canMake: true }));
  const before = await month(db);
  const made = [];
  try {
    const t0 = Date.now();
    const results = await Promise.all(
      asks.map(async (a) => {
        const body = JSON.stringify(a), s = Date.now();
        const r = await signed("POST", "/api/preview-live/make", body).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: e.message }) }));
        const out = await r.json().catch(() => ({}));
        if (r.ok && out.id) made.push({ id: out.id, owner: a.owner });
        return { status: r.status, ms: Date.now() - s, error: out.error || null };
      })
    );
    const ok = results.filter((r) => r.status === 200), busy = results.filter((r) => r.status === 503 && /busy/i.test(r.error || ""));
    console.log(`${N} asked at once (${GAME}): ${ok.length} made, ${busy.length} busy, ${N - ok.length - busy.length} other, in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    for (const r of results) console.log(`  ${r.status} ${(r.ms / 1000).toFixed(1)} s${r.error ? ` ${r.error}` : ""}`);
    const times = ok.map((r) => r.ms).sort((a, b) => a - b);
    if (times.length) console.log(`  first moment back: fastest ${(times[0] / 1000).toFixed(1)} s, median ${(times[times.length >> 1] / 1000).toFixed(1)} s, slowest ${(times[times.length - 1] / 1000).toFixed(1)} s`);
    if (db) {
      // Each made preview adds its CPU once its last moment lands (after the answer): wait for them.
      await new Promise((r) => setTimeout(r, SETTLE * 1000));
      const after = await month(db);
      const n = after.previews - before.previews, cpu = after.cpuMs - before.cpuMs;
      console.log(`the month's ledger: +${n} previews, +${(cpu / 1000).toFixed(1)} s CPU${n ? `, ${(cpu / n / 1000).toFixed(1)} s each (phones' 1.5 s included)` : ""}; this month ${after.previews} previews, ${(after.cpuMs / 60000).toFixed(1)} CPU-minutes`);
    }
  } finally {
    for (const m of made) await signed("DELETE", `/api/preview-live/${m.id}`, JSON.stringify({ owner: m.owner })).catch(() => {});
    if (db) {
      const { rows: [left] } = await db.query(`SELECT count(*)::int AS k FROM live_previews WHERE owner_key LIKE 'zt-load-%'`);
      console.log(`closed ${made.length}; load previews left in the registry: ${left.k}`);
      await db.end();
    } else console.log(`closed ${made.length}`);
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
