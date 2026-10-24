// Dev-only test bank: bot research (db/bot-research.js), end to end. Drives the real schedule through
// the cron route with a test clock, so the real bot asks the real ChatGPT about a real episode, then
// checks the admin pages at phone width: the season's schedule and the episode's runs.
//
//   node scripts/dev-test/check-bot-research.js up [show=survivor] [season=51]
//   node scripts/dev-test/check-bot-research.js run <outDir> [width=390] [episode=5] [--quick-only]
//   node scripts/dev-test/check-bot-research.js down
//
// Needs `npm run dev`, the ask-AI bot (LLM_BROWSER_API_URL/KEY) and CRON_SECRET in .env.local. A full
// run takes up to two minutes, so `run` takes about five; --quick-only skips the two full runs.
//
// `up` copies a real season (its schedule and cast) into a throwaway show, slug "zt-bot-<show>",
// named like the real one so ChatGPT researches the real episode, with bot research switched on from
// well before the season. Everything it writes (runs, research, staged results) belongs to that show,
// which `down` deletes (every table cascades from it), with the admin zt_bot_admin / zt-pass-12345.
// Never touches the real season. Never run against a real database.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const { Pool } = require("pg");
const Air = require("../../src/lib/game/air-schedule.js");

const ADMIN = "zt_bot_admin";
const PASSWORD = "zt-pass-12345";
const id = () => Array.from(crypto.randomBytes(24), (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

async function fixture(pool) {
  const { rows } = await pool.query(
    `SELECT s.id AS show_id, s.slug, ss.id AS season_id, ss.season_number, to_char(ss.premiere_date,'YYYY-MM-DD') AS premiere_date,
            to_char(ss.air_time,'HH24:MI') AS air_time, ss.air_tz
       FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE s.slug LIKE 'zt-bot-%'`
  );
  return rows[0];
}

async function down(pool) {
  await pool.query(`DELETE FROM ai_briefs WHERE created_by IN (SELECT id FROM "user" WHERE username=$1)`, [ADMIN]);
  await pool.query(`DELETE FROM "user" WHERE username=$1`, [ADMIN]);
  await pool.query(`DELETE FROM shows WHERE slug LIKE 'zt-bot-%'`);
}

async function up(pool, showSlug, seasonNumber) {
  await down(pool);
  const { rows: src } = await pool.query(
    `SELECT s.*, ss.id AS season_id, ss.premiere_date, ss.air_time, ss.air_tz, ss.episode_count, ss.name AS season_name
       FROM shows s JOIN show_seasons ss ON ss.show_id = s.id WHERE s.slug=$1 AND ss.season_number=$2`,
    [showSlug, seasonNumber]
  );
  if (!src.length) throw new Error(`No ${showSlug} season ${seasonNumber} to copy`);
  const s = src[0];
  if (!s.premiere_date || !s.air_time) throw new Error(`${showSlug} season ${seasonNumber} has no air schedule to copy`);
  const { rows: show } = await pool.query(
    `INSERT INTO shows (slug, name, castaway_term, tribe_term, wiki_api_url, archived, format, research_domains)
     VALUES ($1,$2,$3,$4,$5,true,$6,$7) RETURNING id`,
    [`zt-bot-${showSlug}`, s.name, s.castaway_term, s.tribe_term, s.wiki_api_url, s.format, s.research_domains]
  );
  const { rows: season } = await pool.query(
    `INSERT INTO show_seasons (show_id, season_number, name, status, premiere_date, air_time, air_tz, episode_count,
                               bot_research_on, bot_research_since)
     VALUES ($1,$2,$3,'airing',$4,$5,$6,$7,true,$4::date - 7) RETURNING id`,
    [show[0].id, seasonNumber, s.season_name, s.premiere_date, s.air_time, s.air_tz, s.episode_count]
  );
  await pool.query(
    `INSERT INTO season_cast (season_id, name, tribe_name, photo_url, sort_order)
     SELECT $1, name, tribe_name, photo_url, sort_order FROM season_cast WHERE season_id=$2`,
    [season[0].id, s.season_id]
  );
  const { hashPassword } = await import("better-auth/crypto");
  const userId = id();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,true,$2,$2,'admin',now(),now())`,
    [userId, ADMIN, `${ADMIN}@example.invalid`]
  );
  await pool.query(
    `INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1,$2,'credential',$2,$3,now(),now())`,
    [id(), userId, await hashPassword(PASSWORD)]
  );
  console.log(`up: zt-bot-${showSlug} season ${seasonNumber} (${season[0].id}), admin ${ADMIN} / ${PASSWORD}`);
}

async function run(pool, out, width, episode, flags) {
  fs.mkdirSync(out, { recursive: true });
  const { BASE } = require("./browser");
  const failures = [];
  const expect = (ok, what) => (ok ? console.log("ok  ", what) : (failures.push(what), console.log("FAIL", what)));
  const f = await fixture(pool);
  if (!f) throw new Error("No fixture: run `up` first");
  const airedAt = Air.episodeAirTime({ premiereDate: f.premiere_date, airTime: f.air_time, airTz: f.air_tz }, episode, {});
  // Runs count from the episode's end: its air time plus the season's length (an hour when unset).
  const { rows: len } = await pool.query("SELECT episode_minutes FROM show_seasons WHERE id=$1", [f.season_id]);
  const endsAt = new Date(airedAt.getTime() + (len[0]?.episode_minutes || 60) * 60 * 1000);
  const at = (min) => new Date(endsAt.getTime() + min * 60 * 1000).toISOString();
  const auth = { Authorization: `Bearer ${process.env.CRON_SECRET}` };
  // Due lists are across every season with bot research on; only the fixture's count here.
  const dueAt = async (min) =>
    ((await (await fetch(`${BASE}/api/cron/bot-research?now=${at(min)}`, { headers: auth })).json()).due || []).filter((d) => d.season === f.slug);
  const tick = async (min) => (await fetch(`${BASE}/api/cron/bot-research?now=${at(min)}`, { method: "POST", headers: auth })).json();

  expect((await fetch(`${BASE}/api/cron/bot-research`)).status === 401, "the cron route refuses a call without the secret");
  expect((await dueAt(4)).length === 0, "nothing due 4 minutes after the episode ends");
  const due6 = await dueAt(6);
  expect(due6.length === 1 && due6[0].episode === episode && due6[0].slot === "quick@5", `the quick check is due 6 minutes after the end (${JSON.stringify(due6)})`);

  const quick = await tick(6);
  expect(quick.job && quick.job.slot === "quick@5", "the tick runs the quick check");
  expect(quick.ok === true, `the quick check found the episode: "${quick.message}"`);
  expect((await dueAt(7)).length === 0, "a successful quick check isn't due again");

  if (!flags.includes("--quick-only")) {
    const full = await tick(61);
    expect(full.job && full.job.slot === "full@60", "an hour after the end, the tick runs the full research");
    expect(full.ok === true && (full.result?.total ?? 0) > 0, `the full research staged results: "${full.message}"`);
    const again = await tick(541);
    expect(again.job && again.job.slot === "full@540" && again.ok === true && again.result?.merged === true, `nine hours after, it runs again and merges: "${again.message}"`);
    const { rows } = await pool.query("SELECT provenance->>'via' AS via FROM episode_research WHERE show_id=$1 AND episode_number=$2", [f.show_id, episode]);
    expect(rows[0]?.via === "bot", "the stored research says the bot pasted it");
  }

  // The admin pages, at phone width.
  const { open } = require("./browser");
  const { page, errors, close } = await open({ user: ADMIN, pass: PASSWORD, width });
  await page.goto(`${BASE}/admin/seasons/${f.season_id}/setup`, { waitUntil: "networkidle" });
  const section = page.locator("section", { hasText: "Ask ChatGPT after each episode airs" });
  await section.scrollIntoViewIfNeeded();
  expect(await section.getByText("Experimental").isVisible(), "Setup has the Bot research section, marked experimental");
  expect(await section.getByText("Quick check, 5 min after it ends").isVisible(), "the schedule lists the quick check");
  expect(await section.getByText("Full research, 9 h after it ends").isVisible(), "and the 9-hour full research");
  await page.screenshot({ path: `${out}/bot-setup-${width}.png`, fullPage: true });

  await page.goto(`${BASE}/admin/seasons/${f.season_id}/episodes/${episode}`, { waitUntil: "networkidle" });
  const runs = page.locator("section", { hasText: "Run quick now" });
  await runs.scrollIntoViewIfNeeded();
  expect(await runs.getByText(/ left\./).first().isVisible(), "the episode page shows the quick check's answer");
  await page.screenshot({ path: `${out}/bot-episode-${width}.png`, fullPage: true });

  await page.getByRole("button", { name: "Start" }).click();
  await page.getByRole("button", { name: "Ask ChatGPT for me" }).waitFor({ timeout: 15000 });
  expect(await page.getByText("Experimental").first().isVisible(), "the paste panel's primary is the experimental bot button");
  // A link once the prompt is built and parked as a brief; a disabled button until then.
  const chatgpt = page.getByRole("link", { name: /Open in ChatGPT/ });
  await chatgpt.waitFor({ timeout: 20000 }).catch(() => {});
  expect(await chatgpt.isVisible(), "with Open in ChatGPT beside Copy");
  expect((await page.getByRole("link", { name: /Claude|Gemini|Perplexity|Copilot/ }).count()) === 0, "and none of the other chats' test links");
  await page.screenshot({ path: `${out}/bot-paste-${width}.png`, fullPage: true });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(!overflow, "no horizontal scroll");
  expect(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
  await close();
  if (failures.length) {
    console.log(`\n${failures.length} failed`);
    process.exitCode = 1;
  }
}

(async () => {
  const [cmd, a, b, c, ...rest] = process.argv.slice(2);
  const pool = new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  try {
    if (cmd === "up") await up(pool, a || "survivor", Number(b || 51));
    else if (cmd === "down") {
      await down(pool);
      console.log("down: removed");
    } else if (cmd === "run" && a) await run(pool, a, parseInt(b || "390", 10), parseInt(c && !c.startsWith("--") ? c : "5", 10), [c, ...rest].filter(Boolean));
    else throw new Error("usage: check-bot-research.js up [show] [season] | run <outDir> [width] [episode] [--quick-only] | down");
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
