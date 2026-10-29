// Dev-only check for the desk's Settings (docs/PLAN-desk-parity.md part 7c), against this lane's dev server, on a fixture of
// its own (zt_dz_ people; ZT DZ Isle, Season 1 on its rulebook by itself and Season 2 not, a game on each, a deleted one on
// Season 2, and a game with no show picked, on the ZT DZ Couch):
//   1. Only site admins: zt_dz_oz (a player) is refused the flag's routes and Settings.
//   2. Which AI our bot asks: ChatGPT by default; Gemini and anything else refused; Claude (a line in Settings history), and
//      the next ask (a season's Cast › Ask our bot, through the stand-in bot) asks Claude; Undo, and the next asks ChatGPT.
//   3. The rulebooks flag: Switch on refused before a check; Check every league as a desk job (a second refused while it
//      runs; its progress; the tally: the games that score the same, ZT DZ Loose staying on built-in rules with why, the
//      deleted one left out; nothing written); Switch on (every game on its season's rulebook); Switch it off (ZT DZ Isle 1, on by itself, stays on: its
//      game keeps its rulebook, the other goes back); Undo both ways, a refused one; a check that found a game scoring
//      differently keeps it off; a check whose server went away is said to have stopped, and a new one may start.
//   4. Screens at --width: Settings' Our bot rows, Which AI our bot asks (Gemini greyed, saying why; Claude chosen, the toast's
//      Undo), Games on their rulebook (Check every league, the tally and its links, Switch on, then on: Switch it off, the
//      season that stays on), a check that keeps it off. Nothing wider than the screen.
//   5. Nothing real moved: every league that isn't zt_ has exactly the state and rulebook it had (its updated_at put back),
//      every rulebook that isn't the fixture's is as it was, the flag is off as it was.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                   (this lane's server, in another terminal; BASE from .env.local)
//   node scripts/dev-test/check-desk-settings.js <outDir> [--width=390] [--keep]
//   node scripts/dev-test/check-desk-settings.js --down        (takes the fixture down, nothing else)
//
// up/down: zt_dz_ accounts (sessions and seats go with them), the ZT DZ couch, the zt-dz- show (its seasons, rulebooks and
// runs go with it) and games, the admin_changes lines by zt_dz_ people, Settings' bot_ai and the flag's last check. It
// refuses to run with the rulebooks flag on (it turns it on and off: down turns it off) or the bot set to anything but
// ChatGPT. Its join codes all start Z5Q (no real one may: it refuses to run if one does). Refuses a non-local database.
// Prints PASS/FAIL.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const S = require("../../src/lib/game/state-logic.js");
const R = require("../../db/rulebooks.js");
const { flip } = require("../../db/rulebooks-flag.js");
const { open, api, BASE } = require("./browser");
const { settle } = require("./motion");
const fakeBot = require("./fake-bot");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-desk-settings runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const onlyDown = args.includes("--down");
if (!out && !onlyDown) throw new Error("usage: check-desk-settings.js <outDir> [--width=390] [--keep] | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_dz_${k}`;
const COUCH = "ZT DZ Couch";
const SHOW = ["zt-dz-isle", "ZT DZ Isle"];
const PREFIX = "Z5Q";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

async function down(pool) {
  // The flag back off (it's off before the check: up refuses otherwise), every league as its season decides.
  if (await R.rulebooksOn(pool)) await flip(pool, false, { log: () => {} });
  const { rows: games } = await pool.query("SELECT id FROM leagues WHERE slug LIKE 'zt-dz-%'");
  await pool.query(`DELETE FROM admin_changes WHERE user_id IN (SELECT id FROM "user" WHERE username LIKE 'zt\\_dz\\_%') OR (entity = 'game' AND entity_id = ANY($1))`, [games.map((r) => r.id)]);
  await pool.query("DELETE FROM leagues WHERE id = ANY($1::uuid[])", [games.map((r) => r.id)]);
  await pool.query("DELETE FROM couches WHERE name LIKE 'ZT DZ %'");
  await pool.query("DELETE FROM shows WHERE slug LIKE 'zt-dz-%'");
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_dz\\_%'`);
  await pool.query("DELETE FROM app_settings WHERE key IN ('bot_ai', 'rulebooks_check')");
}

async function up(pool) {
  await down(pool);
  const { rows: clash } = await pool.query("SELECT 1 FROM leagues WHERE join_code LIKE $1", [`${PREFIX}%`]);
  if (clash.length) throw new Error(`a league outside the fixture has a code starting ${PREFIX}: the code checks can't run here`);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const add = async (k, o = {}) => {
    const id = `zt-dz-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now(), now())`,
      [id, U(k), `${U(k)}@zt-dz.example.com`, o.role ?? null]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
  };
  await add("desk", { role: "admin" });
  for (const k of ["kim", "oz"]) await add(k);

  ids.show = (await pool.query(
    `INSERT INTO shows (slug, name, kind, format, set_up_at, castaway_term, tribe_term, created_at) VALUES ($1, $2, 'competition', 'survivor', now(), 'Castaway', 'Tribe', now()) RETURNING id`,
    SHOW
  )).rows[0].id;
  const season = async (key, n, live) => {
    ids[key] = (await pool.query("INSERT INTO show_seasons (show_id, season_number, status, rulebook_live) VALUES ($1, $2, 'airing', $3) RETURNING id", [ids.show, n, live])).rows[0].id;
    await R.ensureSeasonRulebook(pool, ids[key]);
  };
  await season("s1", 1, true);
  await season("s2", 2, false);
  for (const [i, [name, tribe]] of [["Zed Dee", "Red"], ["Zoe Dale", "Blue"], ["Zack Dunn", "Blue"]].entries())
    await pool.query("INSERT INTO season_cast (season_id, name, tribe_name, sort_order) VALUES ($1, $2, $3, $4), ($5, $2, $3, $4)", [ids.s1, name, tribe, i, ids.s2]);

  ids.couch = (await pool.query("INSERT INTO couches (name, created_by) VALUES ($1, $2) RETURNING id", [COUCH, ids.kim])).rows[0].id;
  await pool.query("INSERT INTO couch_members (couch_id, user_id, role, via) VALUES ($1, $2, 'owner', 'couch')", [ids.couch, ids.kim]);
  let codes = 0;
  const AB = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const game = async (key, name, o) => {
    const s = S.defaultState();
    s.players = [{ id: "p1", name: U("kim"), color: "#5089c9", disabled: false, active: true }];
    s.draftOrder = ["p1"];
    Object.assign(s.settings, { leagueTypeId: "classic-draft", ...(o.season ? { showId: SHOW[0], wikiSeason: String(o.season) } : {}) });
    const n = codes++;
    const { rows } = await pool.query(
      `INSERT INTO leagues (name, slug, join_code, state, created_by, couch_id, deleted_at, deleted_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [name, `zt-dz-${key}`, `${PREFIX}${AB[n]}${AB[crypto.randomInt(AB.length)]}`, S.migrateLeagueState(s), ids.kim, ids.couch, o.deleted ? new Date() : null, o.deleted ? ids.kim : null]
    );
    ids[key] = rows[0].id;
    // migrateLeagueState reads an old league with no show as Survivor's: a game made before its show was picked has none.
    if (!o.season) await pool.query("UPDATE leagues SET state = jsonb_set(state, '{settings,showId}', 'null') WHERE id = $1", [ids[key]]);
    await pool.query("INSERT INTO league_memberships (league_id, user_id, player_id, role) VALUES ($1, $2, 'p1', 'commissioner')", [ids[key], ids.kim]);
  };
  await game("live", "ZT DZ Live", { season: 1 });
  await game("plain", "ZT DZ Plain", { season: 2 });
  await game("loose", "ZT DZ Loose", {});
  await game("binned", "ZT DZ Binned", { season: 2, deleted: true });
  // Season 1 is on its rulebook by itself: its game carries it already (as the rulebook page's switch leaves it).
  await R.syncLeagueRow(pool, ids.live);
  return ids;
}

// Every real league's state, rulebook and when it last changed (a switch on and off rewrites a league's state, so its
// updated_at is put back at the end), and every rulebook that isn't the fixture's.
const REAL_LEAGUES = `SELECT md5(string_agg(id || state::text || coalesce(deleted_at::text, '') || coalesce(rulebook_id::text, '') || updated_at::text, ',' ORDER BY id)) AS h
  FROM leagues WHERE slug NOT LIKE 'zt-%'`;
const REAL_BOOKS = `SELECT md5(coalesce(string_agg(r.id::text || ':' || r.version::text || r.status || coalesce(r.compiled::text, ''), ',' ORDER BY r.id), '')) AS h FROM rulebooks r
  WHERE r.season_id IS NULL OR r.season_id NOT IN (SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug LIKE 'zt-dz-%')`;

(async () => {
  const pool = new Pool({ connectionString: DB });
  if (onlyDown) {
    await down(pool);
    await pool.end();
    console.log("zt_dz_ fixture down");
    return;
  }
  if (await R.rulebooksOn(pool)) throw new Error("the rulebooks flag is on here: this check turns it on and off, so it runs only with it off");
  const { rows: ai } = await pool.query("SELECT value FROM app_settings WHERE key = 'bot_ai'");
  if (ai[0] && ai[0].value !== "chatgpt") throw new Error(`our bot asks ${ai[0].value} here: this check puts it back to ChatGPT, so it runs only with ChatGPT`);
  fs.mkdirSync(out, { recursive: true });
  const before = (await pool.query(REAL_LEAGUES)).rows[0].h;
  const booksBefore = (await pool.query(REAL_BOOKS)).rows[0].h;
  // As text: a JS Date drops the microseconds.
  const stamps = (await pool.query("SELECT id, updated_at::text AS at FROM leagues WHERE slug NOT LIKE 'zt-%'")).rows;
  const closers = [];
  try {
    const ids = await up(pool);
    const bot = await fakeBot.start({ delayMs: 300, answer: () => "Not a cast: the stand-in only says which AI it was asked." });
    closers.push(bot.close);
    const headers = { "x-gys-bot": bot.url };
    const as = { desk: await api({ user: U("desk"), pass: PASSWORD, headers }), oz: await api({ user: U("oz"), pass: PASSWORD, headers }) };
    const undo = (id) => as.desk.call("POST", `/api/desk/changes/${id}/undo`, {});
    const settings = async () => (await as.desk.call("GET", "/api/desk/settings")).body;
    const flagCheck = async () => (await as.desk.call("GET", "/api/desk/settings/rulebooks")).body.check;
    const carries = async (id) => !!(await pool.query("SELECT state->'settings' ? 'rulebook' AS on FROM leagues WHERE id = $1", [id])).rows[0].on;
    const flagOn = () => R.rulebooksOn(pool);
    const drained = async (ms = 60000) => {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        const { rows } = await pool.query("SELECT 1 FROM desk_runs WHERE season_id = ANY($1::uuid[]) AND done_at IS NULL", [[ids.s1, ids.s2]]);
        if (!rows.length) return true;
        await sleep(400);
      }
      return false;
    };
    const askCast = async (seasonKey) => {
      const n = bot.asked.length;
      const r = await as.desk.call("POST", `/api/desk/seasons/${ids[seasonKey]}/cast`, { ask: true });
      await drained();
      return { status: r.status, asked: bot.asked.slice(n) };
    };
    const checked = async (ms = 120000) => {
      const until = Date.now() + ms;
      const seen = [];
      while (Date.now() < until) {
        const c = await flagCheck();
        if (c && c.state === "running") seen.push(c.done);
        if (c && c.state !== "running") return { c, seen };
        await sleep(300);
      }
      return { c: await flagCheck(), seen };
    };

    // ---- 1. only site admins ----
    const refused = await Promise.all([
      as.oz.call("GET", "/api/desk/settings/rulebooks"),
      as.oz.call("POST", "/api/desk/settings/rulebooks", { check: true }),
      as.oz.call("POST", "/api/desk/settings/rulebooks", { on: true }),
      as.oz.call("PUT", "/api/desk/settings", { botAi: "claude" }),
    ]);
    check(refused.every((r) => r.status === 403), "a player is refused the flag and Settings", refused.map((r) => r.status).join());

    // ---- 2. which AI our bot asks ----
    let s = await settings();
    check(s.settings.botAi === "chatgpt", "our bot asks ChatGPT by default", s.settings.botAi);
    let r = await as.desk.call("PUT", "/api/desk/settings", { botAi: "gemini" });
    check(r.status === 400 && /chatgpt or claude/.test(r.body.error), "Gemini refused: not one it can ask", JSON.stringify(r.body));
    r = await as.desk.call("PUT", "/api/desk/settings", { botAi: "claude" });
    const aiChange = r.body.changeIds?.[0];
    check(r.status === 200 && r.body.settings.botAi === "claude" && r.body.history[0].text === "Our bot asks Claude", "Claude: set, a line in Settings history", JSON.stringify(r.body.history?.[0]));
    let ask = await askCast("s1");
    check(ask.status === 200 && ask.asked.length === 1 && ask.asked[0].provider === "claude", "the next ask asks Claude", JSON.stringify(ask.asked.map((a) => a.provider)));
    r = await undo(aiChange);
    s = await settings();
    check(r.status === 200 && s.settings.botAi === "chatgpt", "Undo: ChatGPT again", JSON.stringify(r.body));
    ask = await askCast("s2");
    check(ask.asked.length === 1 && ask.asked[0].provider === "chatgpt", "and the next ask asks ChatGPT", JSON.stringify(ask.asked.map((a) => a.provider)));
    r = await undo(aiChange);
    check(r.status === 409, "the same Undo twice: refused", JSON.stringify(r.body));

    // ---- 3. the rulebooks flag ----
    check((await carries(ids.live)) && !(await carries(ids.plain)) && !(await carries(ids.loose)), "before: only ZT DZ Isle 1's game is on its rulebook");
    s = await settings();
    check(s.settings.rulebooks.everywhere === false && s.settings.rulebooks.seasons.some((x) => x.id === ids.s1 && x.games === 1), "Settings: ZT DZ Isle 1 on by itself, 1 game", JSON.stringify(s.settings.rulebooks));
    r = await as.desk.call("POST", "/api/desk/settings/rulebooks", { on: true });
    check(r.status === 409 && /Check every league first/.test(r.body.error) && !(await flagOn()), "Switch on before a check: refused", JSON.stringify(r.body));
    const realBefore = (await pool.query(REAL_LEAGUES)).rows[0].h;
    r = await as.desk.call("POST", "/api/desk/settings/rulebooks", { check: true });
    const again = await as.desk.call("POST", "/api/desk/settings/rulebooks", { check: true });
    check(r.status === 200 && r.body.check.state === "running", "Check every league: started", JSON.stringify(r.body));
    check(again.status === 409 || again.body.check?.state === "running" || (again.status === 200 && again.body.check), "a second check while one runs: refused (or the first was already done)", JSON.stringify(again.body));
    let { c } = await checked();
    check(c && c.state === "done" && c.ok && c.fresh && c.total > 0 && c.done === c.total, "it finished: every league and season checked", JSON.stringify(c && { state: c.state, ok: c.ok, done: c.done, total: c.total, error: c.error }));
    const loose = (c?.stay || []).find((l) => l.id === ids.loose);
    check(!!loose && loose.name === "ZT DZ Loose · ZT DZ Couch" && loose.line === "No show picked", "the tally: ZT DZ Loose stays on built-in rules, with why", JSON.stringify(loose));
    check(!(c?.stay || []).some((l) => l.id === ids.binned) && !(c?.differ || []).some((l) => l.id === ids.binned), "a deleted game isn't in the tally");
    check(c?.same >= 2 && !(c.differ || []).length && !(c.seasons || []).length, "the tally: the rest score the same, nothing differs", JSON.stringify({ same: c?.same, differ: c?.differ, seasons: c?.seasons }));
    check((await pool.query(REAL_LEAGUES)).rows[0].h === realBefore && !(await carries(ids.plain)) && !(await flagOn()), "the check wrote nothing");

    r = await as.desk.call("POST", "/api/desk/settings/rulebooks", { on: true });
    const onChange = r.body.changeIds?.[0];
    check(r.status === 200 && (await flagOn()) && (await carries(ids.plain)) && (await carries(ids.live)) && !(await carries(ids.loose)), "Switch on for every season: every game on its season's rulebook but ZT DZ Loose", JSON.stringify(r.body.error || r.body.leagues));
    check(r.body.settings?.rulebooks.everywhere === true && r.body.settings.rulebooks.leagues === r.body.leagues && /^Rulebooks for every season: on \(\d+ leagues?; \d+ stayed on built-in rules\)$/.test(r.body.history?.[0]?.text || ""), "Settings: on, and its History line", r.body.history?.[0]?.text);
    check(await carries(ids.binned), "the deleted game walked too: on its rulebook, for if it's restored");
    r = await as.desk.call("POST", "/api/desk/settings/rulebooks", { on: true });
    check(r.status === 409, "Switch on again: refused, it's on", JSON.stringify(r.body));
    r = await as.desk.call("POST", "/api/desk/settings/rulebooks", { on: false });
    const offChange = r.body.changeIds?.[0];
    check(r.status === 200 && !(await flagOn()) && (await carries(ids.live)) && !(await carries(ids.plain)), "Switch it off: ZT DZ Isle 1, on by itself, keeps its game on its rulebook; the other goes back", JSON.stringify(r.body.error));
    check(r.body.history?.[0]?.text === "Rulebooks for every season: off (ZT DZ Isle 1, on by itself, stayed on)", "its History line says what stayed on", r.body.history?.[0]?.text);
    r = await undo(offChange);
    check(r.status === 200 && (await flagOn()) && (await carries(ids.plain)), "Undo of off: every season on again", JSON.stringify(r.body));
    r = await undo(onChange);
    check(r.status === 200 && !(await flagOn()) && !(await carries(ids.plain)) && (await carries(ids.live)), "Undo of on: off again, ZT DZ Isle 1 still on", JSON.stringify(r.body));
    r = await undo(offChange);
    check(r.status === 409, "an undone change's Undo again: refused", JSON.stringify(r.body));
    check(!(await carries(ids.binned)), "and off again with the rest");

    // A check that found a game scoring differently keeps it off; one whose server went away has stopped.
    const job = (v) => pool.query("UPDATE app_settings SET value = $1::jsonb WHERE key = 'rulebooks_check'", [JSON.stringify(v)]);
    const held = {
      state: "done", startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), done: 9, total: 9, same: 4, ok: false, seasons: [],
      stay: [{ id: ids.loose, name: "ZT DZ Loose · ZT DZ Couch", line: "No show picked" }],
      differ: [{ id: ids.plain, name: "ZT DZ Plain · ZT DZ Couch", line: "ZT DZ Isle 2 · On its rulebook, its standings would change" }],
    };
    await job(held);
    r = await as.desk.call("POST", "/api/desk/settings/rulebooks", { on: true });
    check(r.status === 409 && /would score differently/.test(r.body.error) && !(await flagOn()), "a check that found a game scoring differently: it stays off", JSON.stringify(r.body));
    await job({ state: "running", startedAt: new Date().toISOString(), done: 2, total: 9, beat: new Date(Date.now() - 300000).toISOString() });
    c = await flagCheck();
    r = await as.desk.call("POST", "/api/desk/settings/rulebooks", { check: true });
    check(c.state === "stopped" && r.status === 200, "a check that stopped moving: said, and a new one may start", JSON.stringify([c.state, r.status]));
    await checked();

    // ---- 4. screens ----
    const dsk = await open({ user: U("desk"), pass: PASSWORD, width, height: 844, headers });
    closers.push(dsk.close);
    const failed = [];
    dsk.page.on("response", (res) => res.status() >= 400 && !res.url().endsWith("/favicon.ico") && failed.push(`${res.status()} ${res.url().replace(BASE, "")}`));
    await dsk.page.context().addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        const st = document.createElement("style");
        st.textContent = "nextjs-portal{display:none!important}";
        document.head.appendChild(st);
      });
    });
    const pg = dsk.page;
    let n = 0;
    const shot = async (name, full = false) => {
      await pg.waitForTimeout(350);
      await Promise.race([settle(pg), pg.waitForTimeout(3000)]);
      await pg.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}-${width}.png`), fullPage: full });
    };
    const fits = async (where) => {
      const wide = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(wide <= 0, `${where}: nothing wider than the screen`, `${wide}px`);
    };
    const toasted = async (re) => {
      try {
        await pg.waitForFunction((src) => new RegExp(src).test(document.querySelector("[data-toast]")?.textContent || ""), re.source, { timeout: 20000 });
      } catch {
        /* read what's there */
      }
      return ((await pg.locator("[data-toast]").textContent().catch(() => "")) || "").trim();
    };
    const sheet = () => pg.locator("[role=dialog][data-open]").last();
    const rowLine = async (data) => ((await pg.locator(`[data-desk-row='${data}']`).first().innerText().catch(() => "")) || "").replace(/\s+/g, " ");
    closers.unshift(async () => {
      if (failures) await pg.screenshot({ path: path.join(out, `zz-last-${width}.png`), fullPage: true }).catch(() => {});
    });

    await pg.goto(`${BASE}/desk/settings`, { waitUntil: "networkidle" });
    await pg.locator("[data-desk-row='bot-ai']").first().waitFor();
    check(/Which AI our bot asks/.test(await rowLine("bot-ai")) && /ChatGPT, signed in · free to us/.test(await rowLine("bot-ai")), "Settings › Our bot: Which AI our bot asks, ChatGPT", await rowLine("bot-ai"));
    await pg.locator("[data-desk-row='bot-ai']").first().scrollIntoViewIfNeeded();
    await shot("settings-our-bot");
    await fits("Settings");
    await pg.locator("[data-desk-row='bot-ai']").first().click();
    await sheet().locator("[data-bot-ai='gemini']").waitFor();
    check((await sheet().locator("[data-bot-ai='gemini']").getAttribute("aria-disabled")) === "true" && (await sheet().locator("[data-bot-ai='chatgpt']").getAttribute("aria-pressed")) === "true", "the sheet: ChatGPT chosen, Gemini greyed");
    await shot("which-ai");
    await sheet().locator("[data-bot-ai='gemini']").click({ force: true });
    check(/Gemini can't do the research prompts yet/.test(await toasted(/Gemini/)), "Gemini tapped: it says why");
    await sheet().locator("[data-bot-ai='claude']").click();
    check(/Our bot asks Claude from its next question/.test(await toasted(/Claude/)), "Claude: the toast");
    await pg.waitForFunction(() => /Claude, through its CLI/.test(document.querySelector("[data-desk-row='bot-ai']")?.textContent || ""));
    check((await pool.query("SELECT value FROM app_settings WHERE key = 'bot_ai'")).rows[0]?.value === "claude", "set: Claude");
    await shot("claude-chosen");
    await pg.locator("[data-toast] button", { hasText: "Undo" }).click();
    await pg.waitForFunction(() => /ChatGPT, signed in/.test(document.querySelector("[data-desk-row='bot-ai']")?.textContent || ""));
    check((await pool.query("SELECT value FROM app_settings WHERE key = 'bot_ai'")).rows[0]?.value === "chatgpt", "the toast's Undo: ChatGPT again");

    // Games on their rulebook: the check, the tally, Switch on.
    await pool.query("DELETE FROM app_settings WHERE key = 'rulebooks_check'");
    await pg.reload({ waitUntil: "networkidle" });
    await pg.locator("[data-desk-row='rulebooks']").first().click();
    await sheet().locator("[data-flag-check]").waitFor();
    check(/ZT DZ Isle 1/.test(await sheet().locator("[data-rulebooks-seasons]").innerText()) && /On by itself · 1 game plays by its rulebook/.test(await sheet().locator("[data-rulebooks-seasons]").innerText()), "the sheet: ZT DZ Isle 1 on by itself, 1 game");
    await shot("rulebooks-sheet");
    await sheet().locator("[data-flag-check]").click();
    await sheet().locator("[data-flag-tally]").waitFor({ timeout: 120000 });
    const tally = await sheet().locator("[data-flag-tally]").innerText();
    check(/score exactly the same/.test(tally) && (await sheet().locator(`[data-desk-item='flag-stay-${ids.loose}']`).count()) === 1 && /No show picked/.test(tally), "the tally: the same, and ZT DZ Loose with why", tally.slice(0, 200));
    check((await sheet().locator(`[data-desk-item='flag-stay-${ids.loose}']`).getAttribute("href")) === `/desk/game/${ids.loose}`, "ZT DZ Loose: a link to its game");
    await shot("tally", true);
    await sheet().locator("[data-flag-on]").click();
    check(/^Rulebooks for every season · \d+ leagues?/.test(await toasted(/Rulebooks for every season/)), "Switch on: the toast", await toasted(/Rulebooks/));
    await pg.waitForFunction(() => /Every season · \d+/.test(document.querySelector("[data-desk-row='rulebooks']")?.textContent || ""));
    check((await flagOn()) && (await carries(ids.plain)), "on: every season");
    await shot("flag-on");
    await pg.locator("[data-desk-row='rulebooks']").first().click();
    await sheet().locator("[data-flag-off]").waitFor();
    check(/ZT DZ Isle 1, on by itself, stays on/.test(await sheet().innerText()), "on: Switch it off says ZT DZ Isle 1 stays on");
    await shot("switch-off");
    await sheet().locator("[data-flag-off]").click();
    check(/Every season back on its built-in rules · ZT DZ Isle 1 stays on/.test(await toasted(/built-in rules/)), "Switch it off: the toast");
    await pg.waitForFunction(() => /every season at once: off/.test(document.querySelector("[data-desk-row='rulebooks']")?.textContent || ""));
    check(!(await flagOn()) && (await carries(ids.live)) && !(await carries(ids.plain)), "off: ZT DZ Isle 1 still on");

    // A check that keeps it off.
    await job(held);
    await pg.reload({ waitUntil: "networkidle" });
    await pg.locator("[data-desk-row='rulebooks']").first().click();
    await sheet().locator("[data-flag-held]").waitFor();
    check((await sheet().locator(`[data-desk-item='flag-differ-${ids.plain}']`).count()) === 1 && (await sheet().locator("[data-flag-on]").count()) === 0 && (await sheet().locator("[data-flag-again]").count()) === 1, "a game that would score differently: listed, no Switch on, Check again");
    await shot("held", true);
    await fits("the held tally");
    check(!failed.length, "no failed requests", failed.join(", "));
  } finally {
    for (const c of closers) await c().catch(() => {});
    if (!keep) await down(pool);
    // ---- 5. nothing real moved ----
    for (const st of stamps) await pool.query("UPDATE leagues SET updated_at = $2::timestamptz WHERE id = $1 AND updated_at <> $2::timestamptz", [st.id, st.at]);
    const after = (await pool.query(REAL_LEAGUES)).rows[0].h;
    check(after === before && !(await R.rulebooksOn(pool)), "nothing real moved: every real league's state and rulebook as it was, the flag off");
    check((await pool.query(REAL_BOOKS)).rows[0].h === booksBefore, "every real rulebook as it was");
    await pool.end();
  }
  console.log(failures ? `${failures} FAILED` : "ALL PASS");
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
