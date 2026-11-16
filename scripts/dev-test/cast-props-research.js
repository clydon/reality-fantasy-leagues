// Dev-only: research real shows' rulebooks and casts through OUR BOT, in this lane's local database, as a zt research admin
// (docs/PLAN-cast-properties.md, "Checks: real shows"). It drives the app's own routes, exactly as a person on the desk would:
// nothing here asks a chat itself, and the dev server must run without the site's paid keys (start it with
// ANTHROPIC_API_KEY= and OPENAI_API_KEY= blank; Getting it ready and the desk's Ask our bot use the bot only anyway).
//
//   node scripts/dev-test/cast-props-research.js up                 makes zt_rs_desk (a site admin; password zt-pass-12345)
//   node scripts/dev-test/cast-props-research.js add <tvmazeId> [--season=N] [--episodes]
//        Add a show from its TV listing as zt_rs_desk (POST /api/me/shows), then follows Getting it ready (GET/POST .../fill)
//        until it's done or stuck: a brand-new show's rulebook by our bot (made a game by itself), its cast, its episodes. Prints
//        the season id.
//   node scripts/dev-test/cast-props-research.js cast <seasonId> [--wait]   (--wait: only waits on an ask already running) the desk's Ask our bot for that season's cast, waits for the
//        staged answer and prints what it changes (nothing is sent: review and send on the desk, /desk/season/<id>/cast)
//   node scripts/dev-test/cast-props-research.js review <seasonId> --out=<dir> [--send] [--keep-ours]
//        the desk's cast page in a browser at 390 as zt_rs_desk: See what changed (screenshots of the whole sheet), each change
//        listed; --send presses Send and confirms, as a person on the desk does (the defaults: details and bios fill in where
//        there are none; with --keep-ours a person's spelling and starting group stay ours too, which they do by default anyway)
//   node scripts/dev-test/cast-props-research.js look <seasonId> --out=<dir> [--tap=<first name>] [--seen=N]
//        the season's Cast tab in a browser at 390 as zt_rs_desk (following it at --seen, 0 by default: its own zt follow row),
//        the wall, then that person's sheet: real data for a screenshot story
//   node scripts/dev-test/cast-props-research.js rulebook <seasonId> the desk's Check for changes on the season's rulebook by our
//        bot, waits for the answer and prints its cast block (nothing is applied: review it on the desk)
//   node scripts/dev-test/cast-props-research.js down               removes zt_rs_desk only (shows it added stay: created_by
//        goes null)
//
// Refuses a non-local database. Real shows, never real accounts: the only account is zt_rs_desk.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const { api, open, BASE } = require("./browser");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("cast-props-research runs against a local database only");
const USER = "zt_rs_desk";
const PASSWORD = "zt-pass-12345";
const args = process.argv.slice(2);
const [cmd, target] = args;
const opt = (k) => (args.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);

async function up(pool) {
  const { rows } = await pool.query(`SELECT id FROM "user" WHERE username = $1`, [USER]);
  if (rows.length) return console.log(`[zt] ${USER} is here`);
  const { hashPassword } = await import("better-auth/crypto");
  const id = `zt-rs-desk-${crypto.randomUUID().slice(0, 8)}`;
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', true, now(), now())`,
    [id, USER, `${USER}@zt-rs.example.com`]
  );
  await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, await hashPassword(PASSWORD)]);
  await pool.query(`INSERT INTO user_settings (user_id, ui) VALUES ($1, 'new') ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [id]);
  console.log(`[zt] ${USER} made (site admin)`);
}

async function add(as, listing) {
  const season = opt("season");
  const r = await as.call("POST", "/api/me/shows", { listing: Number(listing), ...(season ? { season: Number(season) } : {}) });
  if (r.status !== 200) throw new Error(`adding ${listing}: ${r.status} ${JSON.stringify(r.body)}`);
  const sid = r.body.seasonId;
  console.log(`[${stamp()}] added: season ${sid}`);
  // Getting it ready starts after Add's answer, as Add a show's sheet starts it; the episodes' results only with --episodes
  // (each aired episode is a bot ask on its clock).
  const st = await as.call("POST", `/api/seasons/${sid}/fill`, { action: "start", episodes: args.includes("--episodes") });
  if (st.status !== 200) throw new Error(`starting Getting it ready: ${st.status} ${JSON.stringify(st.body)}`);
  // Getting it ready, followed as the open page does (carrying on a run that stopped).
  const t0 = Date.now();
  let last = "";
  for (;;) {
    const s = (await as.call("GET", `/api/seasons/${sid}/fill`)).body;
    const line = `${s.status} ${s.step ?? "-"}${s.asking ? " (asking)" : ""}${s.away ? " (bot away)" : ""}${s.message ? `: ${s.message}` : ""}`;
    if (line !== last) console.log(`[${stamp()}] ${line}`);
    last = line;
    if (s.status === "done" || s.status === "stuck" || s.status === "none") break;
    if (s.due) await as.call("POST", `/api/seasons/${sid}/fill`, { action: "go" });
    if (Date.now() - t0 > 40 * 60_000) break;
    await sleep(5000);
  }
  console.log(`season ${sid}: /desk/season/${sid}/cast`);
}

async function cast(as, pool, sid) {
  const before = (await pool.query("SELECT max(created_at) AS t FROM season_cast_answers WHERE season_id = $1", [sid])).rows[0].t;
  if (!args.includes("--wait")) {
    const r = await as.call("POST", `/api/desk/seasons/${sid}/cast`, { ask: true });
    if (r.status !== 200) throw new Error(`asking: ${r.status} ${JSON.stringify(r.body)}`);
    console.log(`[${stamp()}] asked our bot for the cast`);
  }
  for (let i = 0; i < 120; i++) {
    await sleep(5000);
    const { rows } = await pool.query("SELECT id, created_at, sent_at, jsonb_array_length(people) AS n FROM season_cast_answers WHERE season_id = $1 AND ($2::timestamptz IS NULL OR created_at > $2) ORDER BY created_at DESC LIMIT 1", [sid, before]);
    if (rows[0]) {
      console.log(`[${stamp()}] staged: ${rows[0].n} people${rows[0].sent_at ? " (nothing changed: settled)" : ""}`);
      const page = (await as.call("GET", `/api/desk/seasons/${sid}/cast`)).body;
      console.log(JSON.stringify(page.review ?? page, null, 1).slice(0, 6000));
      return;
    }
    const run = (await pool.query("SELECT done_at, ok, message FROM desk_runs WHERE season_id = $1 AND kind = 'cast' ORDER BY asked_at DESC LIMIT 1", [sid])).rows[0];
    if (run && run.done_at && run.ok === false) throw new Error(`the bot's run failed: ${run.message || ""}`);
  }
  throw new Error("no answer in 10 minutes");
}

async function review(sid) {
  const out = opt("out");
  if (!out) throw new Error("review needs --out=<dir>");
  fs.mkdirSync(out, { recursive: true });
  const { page, close } = await open({ user: USER, pass: PASSWORD, width: 390, height: 844 });
  try {
    await page.goto(`${BASE}/desk/season/${sid}/cast`);
    await page.locator("[data-cast-see], [data-desk-cast]").first().waitFor({ timeout: 30000 });
    if (!(await page.locator("[data-cast-see]").count())) return console.log("nothing waits to be sent");
    await page.locator("[data-cast-see]").click();
    const sheet = page.locator("[data-cast-diff]");
    await sheet.waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
    const rows = await page.locator("[data-change]").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-change")}: ${e.innerText.replace(/\s+/g, " ").trim()}`));
    console.log(rows.join("\n"));
    // The whole sheet, a screen at a time.
    const n = await page.locator("[data-change]").count();
    for (let i = 0, shot = 0; i < n; i += 6, shot++) {
      await page.locator("[data-change]").nth(i).scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(out, `what-changed-${shot + 1}.jpg`), type: "jpeg", quality: 82 });
    }
    if (!args.includes("--send")) return;
    await page.locator("[data-cast-send]").click();
    await page.locator("[data-moves]").waitFor({ timeout: 30000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(out, "send.jpg"), type: "jpeg", quality: 82 });
    await page.locator("[data-guard-confirm]").click();
    await page.locator("[data-desk-cast='sent']").waitFor({ timeout: 30000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, "sent.jpg"), type: "jpeg", quality: 82, fullPage: true });
    console.log(`[${stamp()}] sent from the desk`);
  } finally {
    await close();
  }
}

async function look(pool, sid) {
  const out = opt("out");
  if (!out) throw new Error("look needs --out=<dir>");
  fs.mkdirSync(out, { recursive: true });
  const { rows: me } = await pool.query(`SELECT id FROM "user" WHERE username = $1`, [USER]);
  await pool.query(
    `INSERT INTO show_follows (user_id, season_id, seen_through, following) VALUES ($1, $2, $3, true)
     ON CONFLICT (user_id, season_id) DO UPDATE SET seen_through = EXCLUDED.seen_through, following = true`,
    [me[0].id, sid, Number(opt("seen") || 0)]
  );
  const { page, close } = await open({ user: USER, pass: PASSWORD, width: 390, height: 844 });
  try {
    await page.goto(`${BASE}/show/${sid}/cast`);
    await page.locator("[data-face-wall]").waitFor({ timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, "cast.jpg"), type: "jpeg", quality: 82 });
    await page.screenshot({ path: path.join(out, "cast.full.jpg"), type: "jpeg", quality: 82, fullPage: true });
    const who = opt("tap");
    const face = who ? page.locator(`[data-face-wall] button[data-cast="${who}"]`) : page.locator("[data-face-wall] button[data-cast]").first();
    await face.first().click();
    await page.locator('[role="dialog"]').last().waitFor({ timeout: 15000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(out, `sheet-${who || "first"}.jpg`), type: "jpeg", quality: 82 });
    console.log(`[${stamp()}] shot ${out}`);
  } finally {
    await close();
  }
}

async function rulebook(as, pool, sid) {
  const { rows } = await pool.query("SELECT id FROM rulebooks WHERE season_id = $1 AND owner_kind = 'season' AND status <> 'archived'", [sid]);
  if (!rows[0]) throw new Error("that season has no rulebook");
  const id = rows[0].id;
  const r = await as.call("POST", `/api/desk/rulebooks/${id}`, { action: "ask", kind: "check" });
  console.log(`[${stamp()}] Check for changes: ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`);
  if (r.status !== 200) throw new Error("not asked");
  for (let i = 0; i < 120; i++) {
    await sleep(5000);
    const page = (await as.call("GET", `/api/desk/rulebooks/${id}`)).body;
    const st = page.research && page.research.check;
    if (st && !st.asking && st.answer) {
      console.log(JSON.stringify(st.answer, null, 1).slice(0, 8000));
      const { rows: a } = await pool.query("SELECT answer FROM rulebook_answers WHERE rulebook_id = $1 AND kind = 'check' ORDER BY created_at DESC LIMIT 1", [id]);
      try {
        const { parseRulebookAnswer } = require("../../src/lib/game/formats/rulebook-research.js");
        console.log("its cast block:", JSON.stringify(parseRulebookAnswer(a[0].answer).cast, null, 1));
      } catch (e) {
        console.log("its answer can't be read:", e.message);
      }
      return;
    }
  }
  throw new Error("no answer in 10 minutes");
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    if (cmd === "up") return await up(pool);
    if (cmd === "down") {
      await pool.query(`DELETE FROM "user" WHERE username = $1`, [USER]);
      return console.log(`[zt] ${USER} removed`);
    }
    await up(pool);
    const as = await api({ user: USER, pass: PASSWORD });
    console.log(`against ${BASE}`);
    if (cmd === "add") await add(as, target);
    else if (cmd === "cast") await cast(as, pool, target);
    else if (cmd === "rulebook") await rulebook(as, pool, target);
    else if (cmd === "review") await review(target);
    else if (cmd === "look") await look(pool, target);
    else throw new Error("usage: cast-props-research.js up | add <tvmazeId> [--season=N] | cast <seasonId> | rulebook <seasonId> | down");
  } catch (e) {
    console.error(e.message || e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
