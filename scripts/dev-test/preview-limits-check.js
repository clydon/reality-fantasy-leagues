// Live previews' limits (docs/PLAN-preview-release.md, decision 4 and step 8), through the real routes as a zt_pv_ test account with
// a couch of its own: the week's share is worked out at the week's first look (3 to 20, from the month's budget: preview-share.ts)
// and kept for the week; the allowance counts down and refuses at none ("No previews left this week"), a preview that isn't made gives
// its use back, more than AT_ONCE being made at once is refused ("Busy"), a month whose budget is spent is refused ("full this
// month"), and a preview that's made adds what it cost to its month. Puts back everything it changes (the month's row, the uses,
// the stand-in previews) and removes its account.
//
// Needs this lane's dev server (BASE, default :3014) and its database (.env.local AUTH_DATABASE_URL).
//   node --env-file=.env.local scripts/dev-test/preview-limits-check.js
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
  const [month0] = await q(`SELECT previews, cpu_ms FROM live_preview_months WHERE month = date_trunc('month', now())::date`);
  const stand = [];
  let api = null;
  const results = [];
  const check = (name, ok, said) => { results.push(ok); console.log(`${ok ? "ok   " : "WRONG"} ${name}${said ? ": " + said : ""}`); };
  const uses = async () => (await q(`SELECT count(*)::int AS k FROM preview_uses WHERE user_id = $1`, [id]))[0].k;
  const make = async (game = "pool") => { const r = await api.call("POST", "/api/preview-live", { game }); return { status: r.status, body: typeof r.body === "object" ? r.body : {} }; };
  try {
    api = await signIn({ user: username, pass: password });
    if ((await api.call("POST", "/api/couches", { name: "zt-pv couch" })).status !== 200) throw Error("couch failed");
    const a0 = (await api.call("GET", "/api/previews/allowance")).body;
    const [kept] = await q(`SELECT allowance, basis FROM preview_week_shares WHERE user_id = $1`, [id]);
    check("a new week starts with its share, kept for the week", a0.open === true && a0.perWeek >= 3 && a0.perWeek <= 20 && a0.left === a0.perWeek && kept?.allowance === a0.perWeek && Number.isInteger(kept?.basis?.previewsLeft), `${a0.left} of ${a0.perWeek} left; ${JSON.stringify(kept?.basis)}`);
    // The week's share stays put (a share of 5 here, so the rest is the same whatever the month holds).
    await db.query(`UPDATE preview_week_shares SET allowance = 5 WHERE user_id = $1`, [id]);
    const a1 = (await api.call("GET", "/api/previews/allowance")).body;
    check("the week's share is the one kept, not worked out again", a1.perWeek === 5 && a1.left === 5, `${a1.left} of ${a1.perWeek}`);

    // Four used already this week; the fifth is made, and says none left.
    for (let i = 0; i < 4; i++) await db.query(`INSERT INTO preview_uses (user_id) VALUES ($1)`, [id]);
    const fifth = await make();
    check("the last preview of the week is made", fifth.status === 200 && fifth.body.left === 0, `${fifth.status}, ${fifth.body.left} left`);
    if (fifth.body.id) {
      // What it cost lands in its month once its copies have all been written.
      for (let t = 0; t < 60; t++) { const [m] = await q(`SELECT previews FROM live_preview_months WHERE month = date_trunc('month', now())::date`); if ((m?.previews ?? 0) > (month0?.previews ?? 0)) break; await new Promise((r) => setTimeout(r, 1000)); }
      const [m] = await q(`SELECT previews, cpu_ms FROM live_preview_months WHERE month = date_trunc('month', now())::date`);
      check("a preview made adds what it cost to its month", m && m.previews === (month0?.previews ?? 0) + 1 && Number(m.cpu_ms) > Number(month0?.cpu_ms ?? 0), m ? `${m.previews} previews, ${m.cpu_ms} ms` : "no row");
      await api.call("DELETE", `/api/preview-live/${fifth.body.id}`);
    }
    const sixth = await make();
    check("none left: refused, nothing taken", sixth.status === 429 && /No previews left this week/.test(sixth.body.error || "") && (await uses()) === 5, `${sixth.status} "${sixth.body.error}"`);

    // A preview that isn't made gives its use back (a game that doesn't exist).
    await db.query(`DELETE FROM preview_uses WHERE user_id = $1`, [id]);
    const bad = await make("no-such-game");
    check("a preview not made gives its use back", bad.status === 400 && (await uses()) === 0, `${bad.status}, ${await uses()} used`);

    // Ten being made already: busy, and the use given back.
    for (let i = 0; i < 10; i++) { const sid = crypto.randomUUID(); stand.push(sid); await db.query(`INSERT INTO live_previews (id, owner_key, story, expires_at) VALUES ($1, 'zt-limits', '{}'::jsonb, now() + interval '5 minutes')`, [sid]); }
    const busy = await make();
    check("ten being made at once: busy", busy.status === 503 && /Busy/.test(busy.body.error || "") && (await uses()) === 0, `${busy.status} "${busy.body.error}"`);
    await db.query(`DELETE FROM live_previews WHERE owner_key = 'zt-limits'`);

    // The month's budget spent: full, and the use given back.
    await db.query(`INSERT INTO live_preview_months (month, previews, cpu_ms) VALUES (date_trunc('month', now())::date, 0, 999999999) ON CONFLICT (month) DO UPDATE SET cpu_ms = 999999999`);
    const full = await make();
    check("the month's budget spent: full", full.status === 503 && /full this month/.test(full.body.error || "") && (await uses()) === 0, `${full.status} "${full.body.error}"`);
  } finally {
    await db.query(`DELETE FROM live_previews WHERE owner_key = 'zt-limits'`);
    if (month0) await db.query(`UPDATE live_preview_months SET previews = $1, cpu_ms = $2 WHERE month = date_trunc('month', now())::date`, [month0.previews, month0.cpu_ms]);
    else await db.query(`DELETE FROM live_preview_months WHERE month = date_trunc('month', now())::date`);
    await db.query(`DELETE FROM couches WHERE id IN (SELECT couch_id FROM couch_members WHERE user_id = $1 AND role = 'owner')`, [id]);
    await db.query(`DELETE FROM "user" WHERE id = $1`, [id]);
    await db.end();
  }
  console.log(results.every(Boolean) ? "all held" : "SOME FAILED");
  process.exitCode = results.every(Boolean) ? 0 : 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
