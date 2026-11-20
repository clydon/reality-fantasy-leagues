// Your preview, kept while you make the game (docs/PLAN-preview-release.md, decision 6 and step 8a), through the real routes as a
// zt_pv_ test account with a couch: asking for the same game at the same mark reopens your preview, free (no use taken); keeping it
// holds it a day from when it was made; a different game makes a new one and your last one goes (one at a time); and a kept one past
// its day is swept. (The story's own Go back and Create this game keeping it, and its page closing not removing a kept one, are
// preview-live-check.js --create's.) Removes its account and everything it made.
//
// Needs this lane's dev server (BASE, default :3014) and its database (.env.local AUTH_DATABASE_URL).
//   node --env-file=.env.local scripts/dev-test/preview-keep-check.js
const crypto = require("crypto");
const { Pool } = require("pg");
const { api: signIn } = require("./browser");

const BASE = process.env.BASE || "http://localhost:3014";

(async () => {
  const db = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const q = async (sql, p) => (await db.query(sql, p)).rows;
  const { hashPassword } = await import("better-auth/crypto");
  const id = crypto.randomUUID().replace(/-/g, ""), username = "zt_pv_" + id.slice(0, 8), password = "zt-pass-12345";
  await db.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", "createdAt", "updatedAt") VALUES ($1, 'Pat', $2, true, $3, 'Pat', now(), now())`, [id, username + "@example.invalid", username]);
  await db.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, await hashPassword(password)]);
  const results = [];
  const check = (name, ok, said) => { results.push(ok); console.log(`${ok ? "ok   " : "WRONG"} ${name}${said ? ": " + said : ""}`); };
  const uses = async () => (await q(`SELECT count(*)::int AS k FROM preview_uses WHERE user_id = $1`, [id]))[0].k;
  let api = null;
  const made = [];
  try {
    api = await signIn({ user: username, pass: password });
    if ((await api.call("POST", "/api/couches", { name: "zt-pv couch" })).status !== 200) throw Error("couch failed");
    const make = async (game) => { const r = await api.call("POST", "/api/preview-live", { game }); if (r.body?.id) made.push(r.body.id); return r; };

    const first = await make("pool");
    check("a preview is made, one use taken", first.status === 200 && first.body.reopened === false && (await uses()) === 1, `${first.status}, ${await uses()} used`);
    const again = await make("pool");
    check("the same game at the same mark reopens it, free", again.status === 200 && again.body.reopened === true && again.body.id === first.body.id && (await uses()) === 1, `reopened ${again.body.reopened}, ${await uses()} used`);
    const kept = await api.call("POST", `/api/preview-live/${first.body.id}/keep`);
    const [row] = await q(`SELECT extract(epoch FROM kept_until - created_at)::int AS held FROM live_previews WHERE id = $1`, [first.body.id]);
    check("kept: a day from when it was made", kept.status === 200 && row?.held === 86400, `${row?.held} s`);
    const other = await make("sheet");
    const [gone] = await q(`SELECT count(*)::int AS k FROM live_previews WHERE id = $1`, [first.body.id]);
    check("another game makes a new one, and the last one goes", other.status === 200 && other.body.reopened === false && other.body.id !== first.body.id && gone.k === 0 && (await uses()) === 2, `${other.status}, the pool's row ${gone.k ? "still there" : "gone"}, ${await uses()} used`);
    // Kept past its day: the sweep's.
    await api.call("POST", `/api/preview-live/${other.body.id}/keep`);
    await db.query(`UPDATE live_previews SET kept_until = now() - interval '1 minute' WHERE id = $1`, [other.body.id]);
    await db.query(`UPDATE app_settings SET updated_at = now() - interval '2 minutes' WHERE key = 'live_previews_swept'`);
    const swept = await (await fetch(`${BASE}/api/preview-live/sweep`, { method: "POST" })).json();
    const [left] = await q(`SELECT count(*)::int AS k FROM live_previews WHERE id = $1`, [other.body.id]);
    check("kept past its day: swept", left.k === 0 && swept.expired >= 1, JSON.stringify(swept));
  } finally {
    if (api) for (const pid of made) await api.call("DELETE", `/api/preview-live/${pid}`).catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));
    await db.query(`DELETE FROM couches WHERE id IN (SELECT couch_id FROM couch_members WHERE user_id = $1 AND role = 'owner')`, [id]);
    await db.query(`DELETE FROM "user" WHERE id = $1`, [id]);
    await db.end();
  }
  console.log(results.every(Boolean) ? "all held" : "SOME FAILED");
  process.exitCode = results.every(Boolean) ? 0 : 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
