// The preview service's own routes, asked as the app asks them (docs/PLAN-preview-release.md, step 9): over HTTP, signed with the
// shared secret (src/lib/server/preview-signature.ts). Unsigned, wrongly signed or stale asks are refused; a signed ask makes a
// preview from a definition (built here on the made-up season: tests/fixtures/preview-season) for an opaque owner key; the same key
// reopens it; another owner's signed removal leaves it; its owner's removes it. In development the app and the service are one
// server, so this is the only check of the asks' HTTP half before a service of its own exists (step 16).
//
// Needs this lane's dev server (BASE, default :3014; PREVIEW_SECRET as the server has it, unset in development) and its database.
//   node --env-file=.env.local scripts/dev-test/preview-service-check.js
const path = require("path");
const { Pool } = require("pg");
const root = path.resolve(__dirname, "../..");
const jiti = require("jiti")(__filename, { alias: { "@": path.join(root, "src") } });
const { signedHeaders } = jiti("../../src/lib/server/preview-signature.ts");
const Def = require(path.join(root, "tools/gameplay-bench/preview/definition.cjs"));
const { season } = require(path.join(root, "tests/fixtures/preview-season/season.js"));

const BASE = process.env.BASE || "http://localhost:3014";

(async () => {
  const db = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const results = [];
  const check = (name, ok, said) => { results.push(ok); console.log(`${ok ? "ok   " : "WRONG"} ${name}${said ? ": " + said : ""}`); };
  const send = async (method, p, body, headers) => { const r = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...headers }, body }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  const owner = "zt-svc-" + Date.now().toString(36);
  const ask = { owner, key: "zt-key", definition: Def.build(season(), { base: "pool", gameId: "pool", seed: 7 }), rates: Def.ratesOf(season()), exits: null, canMake: true };
  const text = JSON.stringify(ask);
  let id = null;
  try {
    check("unsigned: refused", (await send("POST", "/api/preview-live/make", text, {})).status === 401);
    check("signed for another body: refused", (await send("POST", "/api/preview-live/make", text, signedHeaders(text + " "))).status === 401);
    check("signed ten minutes ago: refused", (await send("POST", "/api/preview-live/make", text, signedHeaders(text, Date.now() - 600_000))).status === 401);
    const made = await send("POST", "/api/preview-live/make", text, signedHeaders(text));
    id = made.body.id;
    check("signed: made, with a way in", made.status === 200 && !!made.body.entry && made.body.reopened === false, `${made.status} ${made.body.error || ""}`);
    const again = await send("POST", "/api/preview-live/make", text, signedHeaders(text));
    check("the same owner and key: reopened", again.status === 200 && again.body.reopened === true && again.body.id === id);
    const other = JSON.stringify({ owner: owner + "-not" });
    await send("DELETE", `/api/preview-live/${id}`, other, signedHeaders(other));
    const [still] = (await db.query(`SELECT count(*)::int AS k FROM live_previews WHERE id = $1`, [id])).rows;
    check("another owner's removal: it stays", still.k === 1);
    const mine = JSON.stringify({ owner });
    const gone = await send("DELETE", `/api/preview-live/${id}`, mine, signedHeaders(mine));
    const [left] = (await db.query(`SELECT count(*)::int AS k FROM live_previews WHERE id = $1`, [id])).rows;
    check("its owner's removal: gone", gone.status === 200 && left.k === 0);
  } finally {
    if (id) await db.query(`DELETE FROM live_previews WHERE owner_key = $1`, [owner]);
    await db.end();
  }
  console.log(results.every(Boolean) ? "all held" : "SOME FAILED");
  process.exitCode = results.every(Boolean) ? 0 : 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
