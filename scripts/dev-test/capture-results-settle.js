// Dev-only capture for how episode results settle themselves (docs/PLAN-results-settle.md), the frames of its screenshot story:
// on new-fixture.js (couch A "ZT Survivor 51": alex runs its games, jordan plays; couch B "ZT Extra": casey plays) with
// Episode 6 aired two days ago, so its final results (noon the next day) have passed. Two couches' answers disagree (alex's
// has Eric's reward, casey's has Devin's idol instead), so two results are split. Frames:
//   1. Backstage's home as alex (Needs you), 2. Backstage › Results for Episode 6 (the card on the split), 3. the desk's
//   Inbox and 4. the season's page on the desk (its Episodes), as the desk's own admin (zt_nd_desk);
//   then the tie-break run switched on and run by the clock a day after the split, with a stand-in bot (fake-bot.js) whose
//   answer sides with casey, and 5. jordan's bell (he's seen Episode 6), 6. the Inbox and 7. Results again.
// It drives screens and routes every version since the desk's step 4 has, so the same frames come before and after a change:
// run it on the old code, then the new, into two folders. No PASS/FAIL: the checks are check-new-settling.js and
// check-new-community.js. Puts the tie-break switch back as it was.
//
//   npm run dev                                                  (in another terminal; .env.local needs CRON_SECRET)
//   node scripts/dev-test/capture-results-settle.js <outDir> [--width=390] [--keep]
//
// Brings new-fixture.js up and takes it down (--keep leaves it); touches zt-nd rows only. Refuses a non-local database, and
// stops if another local season has bot research on or a question open (the clock and the tie-break plan every season).
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");
const fixture = require("./new-fixture");
const fakeBot = require("./fake-bot");
const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("capture-results-settle runs against a local database only");
if (!process.env.CRON_SECRET) throw new Error("CRON_SECRET isn't in .env.local");
const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
if (!out) throw new Error("usage: capture-results-settle.js <outDir> [--width=390] [--keep]");
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const OUT6 = "Cristian Chavez";
const DESK = fixture.username("desk");

// A full answer from the prompt's own skeleton: everyone answered (high confidence), Cristian voted out, Danny's immunity;
// `eric` (his reward) and `devin` (an idol, medium confidence) vary between the answers.
function fullAnswer(prompt, { eric = true, devin = true } = {}) {
  const at = prompt.indexOf("Start from this skeleton");
  const a = JSON.parse(prompt.slice(prompt.indexOf("{", at), prompt.lastIndexOf("}") + 1));
  a.summary = "Episode six.";
  a.tribalCouncilHeld = "yes";
  for (const c of a.castaways) {
    for (const k of Object.keys(c)) if (c[k] === "unknown") c[k] = "no";
    Object.assign(c, { sources: ["https://example.com/recap"], confidence: "high" });
  }
  const who = (name) => a.castaways.find((c) => c.name === name);
  Object.assign(who(OUT6), { leftTheGame: "yes", exitMethod: "Voted Out", attendedTribal: "yes", votesReceived: 5 });
  Object.assign(who("Danny Kilby"), { wonIndividualImmunity: "yes" });
  if (eric) Object.assign(who("Eric Macksoud"), { wonIndividualReward: "yes" });
  if (devin) Object.assign(who("Devin Way"), { foundAdvantage: "yes", advantageFoundName: "hidden immunity idol", confidence: "medium" });
  return "```json\n" + JSON.stringify(a) + "\n```";
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  fs.mkdirSync(out, { recursive: true });
  const closers = [];
  const bot = await fakeBot.start({});
  closers.push(bot.close);
  const tiebreakWas = (await pool.query("SELECT value FROM app_settings WHERE key = 'tiebreak'")).rows[0];
  let up = false;
  try {
    const others = (await pool.query("SELECT s.slug FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE ss.bot_research_on AND s.slug <> 'zt-nd-survivor'")).rows;
    if (others.length) throw new Error(`another local season has bot research on (${others.map((r) => r.slug).join(", ")}): it would share the clock`);
    const open0 = (await pool.query(
      `SELECT count(*)::int AS n FROM (
         SELECT season_id FROM season_decisions WHERE fact_status = 'disputed' AND locked_at IS NULL
         UNION ALL SELECT season_id FROM fact_disputes WHERE status = 'open') q
        JOIN show_seasons ss ON ss.id = q.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug NOT LIKE 'zt-%'`
    )).rows[0].n;
    if (open0) throw new Error(`${open0} question(s) open on real local seasons: a tie-break run would ask about them`);
    const fx = await fixture.up(pool);
    up = true;
    const sid = fx.seasonId;
    const A = `?couch=${fx.couchId}`;
    const B = `?couch=${fx.extraCouchId}`;
    await pool.query(`UPDATE shows SET art_url = '/mock/showcase/art/survivor.jpg' WHERE slug = 'zt-nd-survivor'`);
    // The desk's own admin, as check-new-settling.js makes it.
    const { hashPassword } = await import("better-auth/crypto");
    const deskId = crypto.randomUUID();
    await pool.query(`INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, 'admin', now(), now())`, [
      deskId,
      DESK,
      `${DESK}@example.invalid`,
    ]);
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [
      crypto.randomUUID(),
      deskId,
      await hashPassword(fixture.PASSWORD),
    ]);
    await pool.query(`INSERT INTO user_settings (user_id, ui) SELECT unnest($1::text[]), 'new' ON CONFLICT (user_id) DO UPDATE SET ui = 'new'`, [[...Object.values(fx.users), deskId]]);
    await pool.query("DELETE FROM app_settings WHERE key = 'tiebreak'");
    // Episode 6 (weekly from the premiere) aired two days ago: its final results have passed.
    await pool.query(
      `UPDATE show_seasons SET air_time = ((now() - interval '2 days') AT TIME ZONE air_tz)::time,
              premiere_date = ((now() - interval '2 days') AT TIME ZONE air_tz)::date - 35 WHERE id = $1`,
      [sid]
    );
    const H = { "x-gys-bot": bot.url };
    const as = { desk: await api({ user: DESK, pass: fixture.PASSWORD, headers: H }) };
    for (const who of ["alex", "jordan", "casey"]) as[who] = await api({ user: fixture.username(who), pass: fixture.PASSWORD, headers: H });
    const reveal = (who, couch) => as[who].call("POST", `/api/seasons/${sid}/reveal`, { episode: 6, couch });
    const cron = async (method, at) => {
      const r = await fetch(`${BASE}/api/cron/bot-research?now=${encodeURIComponent(new Date(at).toISOString())}`, { method, headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, ...H } });
      return r.json();
    };

    // Two couches' answers disagree.
    await reveal("alex", fx.couchId);
    const aAsk = await as.alex.call("GET", `/api/seasons/${sid}/backstage/prompt${A}&episode=6&kind=full`);
    if (!aAsk.body?.prompt) throw new Error(`alex's question: ${aAsk.status} ${JSON.stringify(aAsk.body).slice(0, 300)}`);
    const aPrompt = aAsk.body.prompt;
    const aSent = await as.alex.call("POST", `/api/seasons/${sid}/backstage/results${A}`, { episode: 6, kind: "full", answer: fullAnswer(aPrompt, { eric: true, devin: false }) });
    // Once something is in, the others can see it (a reveal of an episode with nothing in doesn't stick).
    await reveal("casey", fx.extraCouchId);
    await reveal("jordan", fx.couchId);
    const cAsk = await as.casey.call("GET", `/api/seasons/${sid}/backstage/prompt${B}&episode=6&kind=full`);
    if (!cAsk.body?.prompt) throw new Error(`casey's question: ${cAsk.status} ${JSON.stringify(cAsk.body).slice(0, 300)}`);
    const cPrompt = cAsk.body.prompt;
    const cSent = await as.casey.call("POST", `/api/seasons/${sid}/backstage/results${B}`, { episode: 6, kind: "full", answer: fullAnswer(cPrompt, { eric: false, devin: true }) });
    console.log(`answers: alex ${aSent.status}, casey ${cSent.status}`);
    const split = (await pool.query("SELECT castaway_name, event_type, status, fact_status FROM season_decisions WHERE season_id = $1 AND episode_number = 6 AND fact_status = 'disputed'", [sid])).rows;
    console.log(`split: ${split.map((r) => `${r.castaway_name} ${r.event_type} (${r.status})`).join(", ") || "nothing"}`);

    const browser = async (user) => {
      const b = await open({ user, pass: fixture.PASSWORD, width, height: 844 });
      closers.push(b.close);
      await b.page.context().setExtraHTTPHeaders(H);
      await b.page.context().addInitScript(() => {
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal{display:none!important}";
          document.head.appendChild(s);
        });
      });
      return b.page;
    };
    let n = 0;
    const shot = async (p, name) => {
      await Promise.race([settle(p), p.waitForTimeout(3000)]);
      await p.waitForTimeout(400);
      const file = path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`);
      await p.screenshot({ path: file });
      console.log(`frame ${file}`);
    };
    const alex = await browser(fixture.username("alex"));
    const desk = await browser(DESK);
    const results = async (name) => {
      await alex.goto(`${BASE}/show/${sid}/backstage/results?ep=6`);
      await alex.locator("[data-fill-state]").waitFor({ timeout: 30000 });
      const card = alex.locator("[data-question='6']");
      await (await card.count() ? card : alex.locator("[data-fill-state]")).scrollIntoViewIfNeeded();
      await shot(alex, name);
    };
    const inbox = async (name) => {
      await desk.goto(`${BASE}/desk`);
      await desk.getByText(/this week|Coming up/i).first().waitFor({ timeout: 30000 }).catch(() => {});
      await shot(desk, name);
    };

    await alex.goto(`${BASE}/show/${sid}/backstage`);
    await alex.getByText("Needs you").first().waitFor({ timeout: 30000 });
    await shot(alex, "backstage-home");
    await results("backstage-results");
    await inbox("desk-inbox");
    await desk.goto(`${BASE}/desk/season/${sid}`);
    await desk.getByText(/Episode 6/).first().waitFor({ timeout: 30000 });
    await desk.getByText(/Episode 6/).first().scrollIntoViewIfNeeded();
    await shot(desk, "desk-season-episodes");

    // Our bot's second look: the switch on, the clock a day after the split, the stand-in siding with casey.
    await as.desk.call("PUT", "/api/desk/settings", { tiebreak: true });
    bot.answer = (p, kind) => (kind === "full" ? fullAnswer(p, { eric: false, devin: true }) : "{}");
    const splitAt = new Date((await pool.query(
      `SELECT max(researched_at) AS at FROM episode_research er JOIN shows s ON s.id = er.show_id WHERE s.slug = 'zt-nd-survivor' AND episode_number = 6 AND source <> 'combined'`
    )).rows[0].at).getTime();
    const tb = await cron("POST", splitAt + 25 * 3600 * 1000);
    console.log(`tie-break: ${tb.job?.kind ?? "none"} ${tb.ok === true ? "ok" : JSON.stringify(tb).slice(0, 160)}`);
    await new Promise((r) => setTimeout(r, 2500));
    const jordan = await browser(fixture.username("jordan"));
    await jordan.goto(`${BASE}/home?hub=focus`, { waitUntil: "load" });
    await jordan.locator("[data-bell]").waitFor({ timeout: 30000 });
    await jordan.locator("[data-bell]").click();
    await jordan.locator("[data-notes-sheet]").waitFor({ timeout: 15000 });
    await jordan.waitForTimeout(800);
    await shot(jordan, "jordan-bell");
    await inbox("desk-inbox-after-tiebreak");
    await results("backstage-results-after-tiebreak");
  } finally {
    await pool.query("DELETE FROM app_settings WHERE key = 'tiebreak'").catch(() => {});
    if (tiebreakWas) await pool.query("INSERT INTO app_settings (key, value, updated_at) VALUES ('tiebreak', $1::jsonb, now())", [JSON.stringify(tiebreakWas.value)]).catch(() => {});
    for (const c of closers.reverse()) await c().catch(() => {});
    if (up && !keep) await fixture.down(pool);
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
