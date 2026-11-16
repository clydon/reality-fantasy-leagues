// Dev-only check for cast properties (docs/PLAN-cast-properties.md), against this lane's dev server, on a fixture of its own
// (zt_cp_ people: zt_cp_desk a site admin, zt_cp_jo who plays). The ZT CP Yacht is a made show (a series whose season plays by
// a rulebook from blocks, as Make it a game leaves one): Season 1 premieres in a week, its rulebook Below Deck's library one
// (department, and the job inside it, shown under a name), its six crew approved with no properties yet.
//   1. The rulebook on the desk (chunk 1): Who's playing lists the properties; an "Age" property is refused in the sheet (Done
//      off, the reason said); one added (Status, Veteran or Rookie) and saved as Fix a mistake; the server took it; the
//      summary line says what they're sorted by. A player is refused the rulebook.
// Screenshots go to <outDir>.
//
//   node scripts/lane.js dev                                    (this lane's server; BASE from .env.local)
//   node scripts/dev-test/check-cast-props.js <outDir> [--width=390] [--keep] [--only=1,2]
//   node scripts/dev-test/check-cast-props.js --up | --down     (only brings the fixture up, or takes it down)
//
// up/down: zt_cp_ accounts, the ZT CP Yacht (its season, cast, answers and runs cascade), its made format and rulebooks, and the
// admin_changes lines on them. Refuses a non-local database. Prints PASS/FAIL. Nothing here touches a real account or show.
require("dotenv").config({ path: ".env.local", quiet: true });
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const { open, api } = require("./browser");
const { settle } = require("./motion");
const { compileRulebook } = require("../../src/lib/game/formats/rulebook-compile.js");
const { LIBRARY } = require("../../src/lib/game/formats/library/index.js");

const DB = process.env.AUTH_DATABASE_URL || "";
if (!/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(DB)) throw new Error("check-cast-props runs against a local database only");

const args = process.argv.slice(2);
const out = args.find((a) => !a.startsWith("--"));
const width = Number((args.find((a) => a.startsWith("--width=")) || "--width=390").slice(8));
const keep = args.includes("--keep");
const only = (args.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean).map(Number);
const runs = (n) => !only.length || only.includes(n);
if (!out && !args.includes("--down") && !args.includes("--up")) throw new Error("usage: check-cast-props.js <outDir> [--width=390] [--keep] [--only=1,2] | --up | --down");

const PASSWORD = "zt-pass-12345";
const U = (k) => `zt_cp_${k}`;
const SHOW = "zt-cp-yacht";
const NAME = "ZT CP Yacht";
const FORMAT = "zt-cp-yacht";
// [name, department, job]: a charter crew, as the network bills it.
const CREW = [
  ["Kip Hale", "Bridge", "Captain"],
  ["Ana Monroe", "Interior", "Chief stew"],
  ["Dee Kwon", "Interior", "Second stew"],
  ["Finn Bligh", "Deck", "Bosun"],
  ["Gus Penn", "Deck", "Deckhand"],
  ["Rae Stone", "Galley", "Chef"],
];

let failures = 0;
function check(ok, what, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}${!ok && detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

// ---------- the fixture ----------

async function down(pool) {
  const { rows: users } = await pool.query(`SELECT id FROM "user" WHERE username LIKE 'zt\\_cp\\_%'`);
  const ids = users.map((u) => u.id);
  await pool.query(
    `DELETE FROM admin_changes WHERE user_id = ANY($1::text[]) OR entity_id IN (
       SELECT ss.id::text FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $2
       UNION SELECT sc.id::text FROM season_cast sc JOIN show_seasons ss ON ss.id = sc.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug = $2
       UNION SELECT r.id::text FROM rulebooks r JOIN show_seasons ss ON ss.id = r.season_id JOIN shows s ON s.id = ss.show_id WHERE s.slug = $2)`,
    [ids, SHOW]
  );
  await pool.query("DELETE FROM rulebooks WHERE season_id IN (SELECT ss.id FROM show_seasons ss JOIN shows s ON s.id = ss.show_id WHERE s.slug = $1)", [SHOW]);
  await pool.query("DELETE FROM shows WHERE slug = $1", [SHOW]);
  await pool.query("DELETE FROM show_formats WHERE id = $1", [FORMAT]);
  await pool.query(`DELETE FROM "user" WHERE username LIKE 'zt\\_cp\\_%'`);
}

async function up(pool) {
  await down(pool);
  const { hashPassword } = await import("better-auth/crypto");
  const hash = await hashPassword(PASSWORD);
  const ids = {};
  const one = async (sql, params) => (await pool.query(sql, params)).rows[0];
  for (const [k, role] of [["desk", "admin"], ["jo", null]]) {
    const id = `zt-cp-${k}-${crypto.randomUUID().slice(0, 8)}`;
    ids[k] = id;
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", username, "displayUsername", role, approved, "createdAt", "updatedAt") VALUES ($1, $2, $3, true, $2, $2, $4, true, now() - interval '10 days', now())`,
      [id, U(k), `${U(k)}@zt-cp.example.com`, role]
    );
    await pool.query(`INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1, $2, 'credential', $2, $3, now(), now())`, [crypto.randomUUID(), id, hash]);
  }
  const blocks = JSON.parse(JSON.stringify(LIBRARY["below-deck"].blocks));
  blocks.show = NAME;
  const { data, problems } = compileRulebook(blocks, { id: FORMAT, reader: "research" });
  if (problems.length) throw new Error(`the fixture's rulebook doesn't compile: ${problems.map((p) => p.message || p).join("; ")}`);
  ids.show = (await one("INSERT INTO shows (slug, name, kind, created_by, set_up_at, format, castaway_term) VALUES ($1, $2, 'series', $3, now(), $4, 'Crew member') RETURNING id", [SHOW, NAME, ids.desk, FORMAT])).id;
  ids.s1 = (await one(
    `INSERT INTO show_seasons (show_id, season_number, status, premiere_date, air_time, air_tz, release, episode_count, cast_approved_at, cast_approved_by, cast_size)
     VALUES ($1, 1, 'upcoming', current_date + 7, '20:00', 'America/New_York', 'weekly', 12, now() - interval '2 days', $2, $3) RETURNING id`,
    [ids.show, ids.desk, CREW.length]
  )).id;
  ids.rulebook = (await one(
    `INSERT INTO rulebooks (name, kind, owner_kind, season_id, status, reader, blocks, compiled, compiled_source, aliases, provenance, review_status, created_by)
     VALUES ($1, 'series', 'season', $2, 'in_force', 'research', $3, $4, 'blocks', '{"events":{},"exits":{}}', '{"from":"made","by":"zt"}', 'reviewed', $5) RETURNING id`,
    [`${NAME} 1`, ids.s1, JSON.stringify(blocks), JSON.stringify(data), ids.desk]
  )).id;
  await pool.query("UPDATE show_seasons SET rulebook_id = $1, rulebook_live = true WHERE id = $2", [ids.rulebook, ids.s1]);
  await pool.query(
    `INSERT INTO show_formats (id, name, status, proposal, data, created_by, approved_by, approved_at) VALUES ($1, $2, 'approved', $3, $4, $5, $5, now())`,
    [FORMAT, NAME, JSON.stringify({ madeFrom: "rulebook", rulebookId: ids.rulebook }), JSON.stringify(data), ids.desk]
  );
  ids.cast = {};
  for (const [i, [n]] of CREW.entries()) ids.cast[n] = (await one("INSERT INTO season_cast (season_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id", [ids.s1, n, i])).id;
  console.log(`[zt] cast-props fixture up: sign in as ${U("desk")} (admin) or ${U("jo")}, password ${PASSWORD}; season ${ids.s1}, rulebook /desk/rulebook/${ids.rulebook}`);
  return ids;
}

// ---------- the parts ----------

async function part1(pool, ids) {
  const jo = await api({ user: U("jo"), pass: PASSWORD });
  const refused = await jo.call("GET", `/api/desk/rulebooks/${ids.rulebook}`);
  check(refused.status === 403 || refused.status === 401, "1: a player is refused the rulebook", String(refused.status));

  const { page, close } = await open({ user: U("desk"), pass: PASSWORD, width, height: 844 });
  const shot = (n) => page.screenshot({ path: path.join(out, `${n}.jpg`), type: "jpeg", quality: 82 });
  try {
    await page.goto(`${process.env.BASE}/desk/rulebook/${ids.rulebook}`);
    const cast = page.locator('[data-part="cast"]');
    await cast.waitFor({ timeout: 30000 });
    check(/by department and job/.test(await cast.innerText()), "1: Who's playing says what they're sorted by", await cast.innerText());
    await cast.click();
    const sheet = page.locator('[data-question="properties"]');
    await sheet.waitFor({ timeout: 10000 });
    const props = await page.locator("[data-property]").evaluateAll((els) => els.map((e) => e.getAttribute("data-property")));
    check(props.join() === "department,job", "1: the sheet lists department and job", props.join());
    await sheet.scrollIntoViewIfNeeded();
    await settle(page);
    await shot("1-who-is-playing");

    // An age property: refused, said, Done off.
    await page.locator("[data-add-property]").click();
    const fresh = page.locator("[data-property]").last();
    await fresh.locator('[data-text="propertyName"]').fill("Age group");
    await fresh.locator('[data-text="propertyValues"]').fill("Under 30, Over 30");
    await page.waitForTimeout(300);
    const said = await page.locator("[data-property-problem]").allInnerTexts();
    check(said.some((m) => /never age/.test(m)) && (await page.locator("[data-done]").isDisabled()), "1: an age property is refused (said, Done off)", said.join(" | "));
    await fresh.scrollIntoViewIfNeeded();
    await shot("1-refused");

    // Status instead: Veteran or Rookie.
    await fresh.locator('[data-text="propertyName"]').fill("Status");
    await fresh.locator('[data-text="propertyValues"]').fill("Veteran, Rookie");
    await page.waitForTimeout(300);
    check((await page.locator("[data-property-problem]").count()) === 0 && !(await page.locator("[data-done]").isDisabled()), "1: Status (Veteran, Rookie) is fine");
    await page.locator("[data-done]").click();
    await page.locator("[data-save]").click();
    await page.locator('[data-kind="fix"]').click();
    await page.locator("[data-save-confirm]").click();
    await page.waitForTimeout(2500);
    const { rows } = await pool.query("SELECT blocks->'cast'->'properties' AS p FROM rulebooks WHERE season_id = $1 AND owner_kind = 'season' AND status <> 'archived'", [ids.s1]);
    const keys = (rows[0]?.p || []).map((p) => `${p.key}:${p.values ? p.values.join("/") : "any"}`);
    check(keys.join() === "department:Interior/Deck/Galley/Bridge,job:any,status:Veteran/Rookie", "1: saved, and the server kept the three", keys.join());
    await page.goto(`${process.env.BASE}/desk/rulebook/${ids.rulebook}`);
    await cast.waitFor({ timeout: 30000 });
    check(/by department and job and status/.test(await cast.innerText()), "1: the summary line has Status too", await cast.innerText());
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!wide, "1: nothing wider than the screen");
  } finally {
    await close();
  }
}

(async () => {
  const pool = new Pool({ connectionString: DB });
  try {
    if (args.includes("--down")) {
      await down(pool);
      console.log("[zt] cast-props fixture down");
      return;
    }
    const ids = await up(pool);
    if (args.includes("--up")) return;
    fs.mkdirSync(out, { recursive: true });
    if (runs(1)) await part1(pool, ids);
    if (!keep) await down(pool);
    console.log(failures ? `${failures} FAILED` : "ALL PASS");
    if (failures) process.exitCode = 1;
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
